// Pruebas del motor puro de "Proyectos y abasto" (src/modules/comercial/proyectos/calculo.js).
//   node --test scripts/test-proyectos-calculo.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcular, matriz, tablero, detalleSku, mesesHorizonte, leadTimeDe,
  arribosDeTransito, LEAD_TIME_DEFAULT, claveMes,
} from '../src/modules/comercial/proyectos/calculo.js';

// Hoy fijo: 15 de octubre de 2026 → horizonte oct-26 … mar-27.
const HOY = new Date(2026, 9, 15);
const MESES = mesesHorizonte(HOY, 6);

const proyecto = (id, mes, extra = {}) => ({
  id, nombre: `P${id}`, cliente: 'digitalife', anio: 2026, mes,
  probabilidad: 'confirmado', responsable: 'Fernando', ...extra,
});
const linea = (id, proyecto_id, sku, piezas, extra = {}) => ({ id, proyecto_id, sku, piezas, reservado: 0, ...extra });

test('el horizonte son 6 meses consecutivos empezando por el actual', () => {
  assert.equal(MESES.length, 6);
  assert.equal(MESES[0].clave, '2026-10');
  assert.equal(MESES[5].clave, '2027-03');
  assert.equal(MESES[0].label, 'Oct 26');
});

test('FIFO por mes: el mes más cercano se lleva el disponible y el siguiente se queda corto', () => {
  const r = calcular({
    proyectos: [proyecto('a', 10), proyecto('b', 11)],
    lineas: [linea('l1', 'a', 'SKU1', 100), linea('l2', 'b', 'SKU1', 100)],
    inventario: [{ sku: 'SKU1', disponible: 120 }],
    transito: [], leadTimes: [], meses: MESES, hoy: HOY,
  });
  const oct = r.celdaPorSkuMes.get('SKU1|2026-10');
  const nov = r.celdaPorSkuMes.get('SKU1|2026-11');
  assert.equal(oct.disponible, 100);
  assert.equal(oct.faltante, 0);
  assert.equal(nov.disponible, 20, 'a noviembre sólo le quedan 20 piezas');
  assert.equal(nov.faltante, 80);
  assert.equal(nov.tono, 'rojo');
});

test('el tránsito cubre el mes sólo si su ETA cae dentro del mes o antes', () => {
  const base = {
    proyectos: [proyecto('a', 10)],
    lineas: [linea('l1', 'a', 'SKU1', 100)],
    inventario: [], leadTimes: [], meses: MESES, hoy: HOY,
  };
  const aTiempo = calcular({ ...base, transito: [{ sku: 'SKU1', cantidad: 100, embarques_detalle: [{ cantidad: 100, eta: '2026-10-28', po: 'PO1' }] }] });
  const tarde = calcular({ ...base, transito: [{ sku: 'SKU1', cantidad: 100, embarques_detalle: [{ cantidad: 100, eta: '2026-11-02', po: 'PO1' }] }] });

  const c1 = aTiempo.celdaPorSkuMes.get('SKU1|2026-10');
  assert.equal(c1.transitoAntes, 100);
  assert.equal(c1.faltante, 0);

  const c2 = tarde.celdaPorSkuMes.get('SKU1|2026-10');
  assert.equal(c2.transitoAntes, 0);
  assert.equal(c2.faltante, 100);
  assert.equal(c2.transitoDespues, 100, 'el embarque existe, pero llega después del mes objetivo');
  assert.equal(c2.etaTarde, '2026-11-02');
});

test('la cobertura del proyecto es piezas cubiertas / piezas comprometidas', () => {
  const r = calcular({
    proyectos: [proyecto('a', 10)],
    lineas: [linea('l1', 'a', 'SKU1', 100), linea('l2', 'a', 'SKU2', 100)],
    inventario: [{ sku: 'SKU1', disponible: 100 }, { sku: 'SKU2', disponible: 50 }],
    transito: [], leadTimes: [], meses: MESES, hoy: HOY,
  });
  const p = r.porProyecto.find((x) => x.id === 'a');
  assert.equal(p.pz, 200);
  assert.equal(p.cubierto, 150);
  assert.equal(Math.round(p.cubiertoPct), 75);
  assert.equal(p.faltante, 50);
  assert.deepEqual(p.faltantes.map((f) => [f.sku, f.faltante]), [['SKU2', 50]]);
});

test('los tonos: verde con holgura, naranja cuando está justo, rojo cuando falta', () => {
  const caso = (disponible) => calcular({
    proyectos: [proyecto('a', 10)],
    lineas: [linea('l1', 'a', 'SKU1', 100)],
    inventario: [{ sku: 'SKU1', disponible }],
    transito: [], leadTimes: [], meses: MESES, hoy: HOY,
  }).celdaPorSkuMes.get('SKU1|2026-10').tono;
  assert.equal(caso(200), 'verde');    // sobran 100 sobre 100 = 100 % de holgura
  assert.equal(caso(105), 'naranja');  // sobran 5 sobre 100 = 5 % < 15 %
  assert.equal(caso(80), 'rojo');
});

test('un proyecto cancelado no consume inventario ni aparece como demanda', () => {
  const r = calcular({
    proyectos: [proyecto('a', 10, { probabilidad: 'cancelado' }), proyecto('b', 10)],
    lineas: [linea('l1', 'a', 'SKU1', 500), linea('l2', 'b', 'SKU1', 100)],
    inventario: [{ sku: 'SKU1', disponible: 150 }],
    transito: [], leadTimes: [], meses: MESES, hoy: HOY,
  });
  const oct = r.celdaPorSkuMes.get('SKU1|2026-10');
  assert.equal(oct.necesidad, 100, 'la demanda del cancelado no cuenta');
  assert.equal(oct.faltante, 0);
  assert.equal(r.resumen.proyectos, 1);
  assert.equal(r.resumen.piezas, 100);
  assert.ok(r.porProyecto.some((p) => p.id === 'a'), 'el cancelado sigue listándose, sólo no compromete piezas');
});

test('el filtro "sólo confirmados" deja fuera prospectos y probables', () => {
  const datos = {
    proyectos: [proyecto('a', 10, { probabilidad: 'prospecto' }), proyecto('b', 10)],
    lineas: [linea('l1', 'a', 'SKU1', 100), linea('l2', 'b', 'SKU1', 100)],
    inventario: [{ sku: 'SKU1', disponible: 100 }],
    transito: [], leadTimes: [], meses: MESES, hoy: HOY,
  };
  const todos = calcular(datos);
  const solo = calcular({ ...datos, filtros: { soloConfirmados: true } });
  assert.equal(todos.resumen.piezas, 200);
  assert.equal(solo.resumen.piezas, 100);
  assert.equal(solo.celdaPorSkuMes.get('SKU1|2026-10').faltante, 0);
});

test('la fecha límite de compra es el inicio del mes objetivo menos el lead time real', () => {
  const r = calcular({
    proyectos: [proyecto('a', 12)],
    lineas: [linea('l1', 'a', 'SKU1', 100)],
    inventario: [], transito: [],
    leadTimes: [{ sku: 'SKU1', dias_promedio: 30, supplier_principal: 'ACME' }],
    meses: MESES, hoy: HOY,
  });
  const c = r.comprasSugeridas[0];
  assert.equal(c.sku, 'SKU1');
  assert.equal(c.falta, 100);
  assert.equal(c.proveedor, 'ACME');
  assert.equal(c.leadTime, 30);
  assert.equal(c.limite, '2026-11-01', '1-dic menos 30 días');
  assert.equal(c.llegaTarde, false);
});

test('sin historia del SKU el lead time cae al default de 104 días y el límite puede quedar vencido', () => {
  const lt = leadTimeDe('SKU9', [], null);
  assert.equal(lt.dias, LEAD_TIME_DEFAULT);
  assert.equal(lt.fuente, 'default');
  const r = calcular({
    proyectos: [proyecto('a', 11)],
    lineas: [linea('l1', 'a', 'SKU9', 50)],
    inventario: [], transito: [], leadTimes: [], meses: MESES, hoy: HOY,
  });
  const c = r.comprasSugeridas[0];
  assert.equal(c.leadTime, 104);
  assert.equal(c.limite, '2026-07-20', '1-nov menos 104 días');
  assert.equal(c.llegaTarde, true, 'la fecha límite ya pasó');
  assert.ok(c.diasAlLimite < 0);
});

test('el resumen del hero recalcula el % sobre los totales (nunca promedia porcentajes)', () => {
  const r = calcular({
    proyectos: [proyecto('a', 10), proyecto('b', 11)],
    lineas: [linea('l1', 'a', 'SKU1', 10), linea('l2', 'b', 'SKU2', 990)],
    inventario: [{ sku: 'SKU1', disponible: 10 }, { sku: 'SKU2', disponible: 0 }],
    transito: [], leadTimes: [], meses: MESES, hoy: HOY,
  });
  // Promediar los % de cada proyecto daría 50 %; lo correcto es 10/1000 = 1 %.
  assert.equal(r.resumen.piezas, 1000);
  assert.equal(r.resumen.cubierto, 10);
  assert.equal(Math.round(r.resumen.cubiertoPct), 1);
  assert.equal(r.resumen.skusPorComprar, 1);
  assert.equal(r.resumen.piezasPorComprar, 990);
});

test('sin proyectos el % de cobertura es null (se pinta "—", no 0)', () => {
  const r = calcular({ proyectos: [], lineas: [], inventario: [], transito: [], leadTimes: [], meses: MESES, hoy: HOY });
  assert.equal(r.resumen.cubiertoPct, null);
  assert.equal(r.resumen.proyectos, 0);
  assert.deepEqual(r.comprasSugeridas, []);
});

test('la matriz arma una fila por SKU con celda por mes y sabe filtrar los faltantes', () => {
  const r = calcular({
    proyectos: [proyecto('a', 10), proyecto('b', 11)],
    lineas: [linea('l1', 'a', 'SKU1', 100), linea('l2', 'b', 'SKU2', 100)],
    inventario: [{ sku: 'SKU1', disponible: 500 }],
    transito: [], leadTimes: [], meses: MESES, hoy: HOY,
  });
  const todas = matriz(r, { medida: 'necesidad' });
  assert.equal(todas.length, 2);
  assert.equal(todas[0].sku, 'SKU2', 'primero el que tiene faltante');
  assert.equal(todas[0]['2026-11'], 100);
  assert.equal(todas[0]['2026-10'], null, 'un mes sin demanda va vacío, no 0');

  const soloF = matriz(r, { medida: 'faltante', soloFaltante: true });
  assert.equal(soloF.length, 1);
  assert.equal(soloF[0].sku, 'SKU2');
  assert.equal(soloF[0]['2026-11'], 100);
});

test('el tablero agrupa por mes y manda a "Más adelante" lo que cae fuera del horizonte', () => {
  const r = calcular({
    proyectos: [proyecto('a', 10), { ...proyecto('z', 8), anio: 2027 }],
    lineas: [linea('l1', 'a', 'SKU1', 10), linea('l2', 'z', 'SKU1', 10)],
    inventario: [{ sku: 'SKU1', disponible: 100 }],
    transito: [], leadTimes: [], meses: MESES, hoy: HOY,
  });
  const cols = tablero(r);
  assert.equal(cols.length, 7, '6 meses + la columna de "Más adelante"');
  assert.equal(cols[0].clave, '2026-10');
  assert.equal(cols[0].proyectos.length, 1);
  assert.equal(cols.at(-1).clave, 'fuera');
  assert.equal(cols.at(-1).proyectos[0].id, 'z');
  assert.equal(claveMes(2027, 8), '2027-08');
});

test('el detalle del SKU trae sus meses, los proyectos que lo piden y su sugerido de compra', () => {
  const r = calcular({
    proyectos: [proyecto('a', 10), proyecto('b', 11)],
    lineas: [linea('l1', 'a', 'SKU1', 100), linea('l2', 'b', 'SKU1', 100)],
    inventario: [{ sku: 'SKU1', disponible: 100 }],
    transito: [], leadTimes: [{ sku: 'SKU1', dias_promedio: 20, supplier_principal: 'ACME' }],
    meses: MESES, hoy: HOY,
  });
  const d = detalleSku(r, 'SKU1');
  assert.equal(d.celdas.length, 2);
  assert.equal(d.proyectos.length, 2);
  assert.equal(d.compra.falta, 100);
  assert.equal(d.compra.limite, '2026-10-12');
});

test('los arribos sin ETA nunca cubren un mes y van al final de la fila', () => {
  const m = arribosDeTransito([{ sku: 'SKU1', cantidad: 300, embarques_detalle: [
    { cantidad: 100, eta: null, po: 'SIN' },
    { cantidad: 200, eta: '2026-10-05', po: 'PO1' },
  ] }]);
  assert.deepEqual(m.get('SKU1').map((a) => a.po), ['PO1', 'SIN']);
  const r = calcular({
    proyectos: [proyecto('a', 10)],
    lineas: [linea('l1', 'a', 'SKU1', 300)],
    inventario: [], leadTimes: [], meses: MESES, hoy: HOY,
    transito: [{ sku: 'SKU1', cantidad: 300, embarques_detalle: [{ cantidad: 100, eta: null }, { cantidad: 200, eta: '2026-10-05' }] }],
  });
  const c = r.celdaPorSkuMes.get('SKU1|2026-10');
  assert.equal(c.transitoAntes, 200);
  assert.equal(c.faltante, 100);
});

test('el filtro por cliente sólo deja los proyectos de ese cliente', () => {
  const r = calcular({
    proyectos: [proyecto('a', 10), proyecto('b', 10, { cliente: 'pcel' })],
    lineas: [linea('l1', 'a', 'SKU1', 100), linea('l2', 'b', 'SKU1', 100)],
    inventario: [{ sku: 'SKU1', disponible: 1000 }],
    transito: [], leadTimes: [], meses: MESES, hoy: HOY,
    filtros: { clientes: ['pcel'] },
  });
  assert.equal(r.porProyecto.length, 1);
  assert.equal(r.porProyecto[0].cliente, 'pcel');
  assert.equal(r.celdaPorSkuMes.get('SKU1|2026-10').necesidad, 100);
});
