// Pruebas del cálculo puro de Sell Out consolidado.
//   node scripts/test-sellout-calculo.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  idxMes, deIdx, yoy, ratio, ultimosMeses, mtdPorCuenta, ytdPorCuenta, totalDe, ultimoDiaConVenta,
  ultimoMesConVenta, semanasInventario, sumaUltimosMeses, construirFilas, totalesDeFilas, porCanal,
  composicion, serie12, porEstado, skusDeCuenta, alertasDeCuenta, ritmoProyectado,
} from '../src/modules/comercial/sellout/calculo.js';
import { textoResumenMes, textoEstatusCuenta, capitalizarEstado, fraseHero } from '../src/modules/comercial/sellout/textos.js';

// ── Datos de laboratorio ──────────────────────────────────────────────────────
const CUENTAS = [
  { cuenta: 'ct',        nombre: 'CT INTERNACIONAL DEL NOROESTE', canal_sellout: 'mayoreo',      erp_cliente: '00183', propio: false, granularidad: 'dia' },
  { cuenta: 'digitalife', nombre: 'DIGITALIFE (API GLOBAL)',      canal_sellout: 'distribuidor', erp_cliente: '00764', propio: true,  granularidad: 'dia' },
  { cuenta: 'directo',   nombre: 'MOSTRADOR + E-COMMERCE',        canal_sellout: 'directo',      erp_cliente: null,    propio: false, granularidad: 'mes' },
];

// sep 2026 (días 3, 10 y 20) y sep 2025 (días 4 y 25) · directo siempre con dia = 0.
const DIAS = [
  { cuenta: 'ct', anio: 2026, mes: 9, dia: 3,  importe: 100, cantidad: 10 },
  { cuenta: 'ct', anio: 2026, mes: 9, dia: 10, importe: 200, cantidad: 20 },
  { cuenta: 'ct', anio: 2026, mes: 9, dia: 20, importe: 700, cantidad: 70 },
  { cuenta: 'ct', anio: 2026, mes: 8, dia: 15, importe: 500, cantidad: 50 },
  { cuenta: 'ct', anio: 2025, mes: 9, dia: 4,  importe: 150, cantidad: 15 },
  { cuenta: 'ct', anio: 2025, mes: 9, dia: 25, importe: 350, cantidad: 35 },
  { cuenta: 'digitalife', anio: 2026, mes: 9, dia: 5, importe: 400, cantidad: 40 },
  { cuenta: 'digitalife', anio: 2025, mes: 9, dia: 5, importe: 500, cantidad: 50 },
  { cuenta: 'directo', anio: 2026, mes: 9, dia: 0, importe: 90, cantidad: 9 },
  { cuenta: 'directo', anio: 2025, mes: 9, dia: 0, importe: 60, cantidad: 6 },
];

const mesFila = (cuenta, anio, mes, extra = {}) => ({
  cuenta, anio, mes,
  nombre: CUENTAS.find((c) => c.cuenta === cuenta).nombre,
  canal_sellout: CUENTAS.find((c) => c.cuenta === cuenta).canal_sellout,
  importe: 0, cantidad: 0, ...extra,
});
const MENSUAL = [
  mesFila('ct', 2026, 7, { importe: 400, cantidad: 40, sell_in: 1000, sucursales: 50, vend_activos: 200 }),
  mesFila('ct', 2026, 8, { importe: 500, cantidad: 50, sell_in: 1100, sucursales: 52, vend_activos: 210 }),
  mesFila('ct', 2026, 9, { importe: 1000, cantidad: 100, sell_in: 2000, sucursales: 56, facturas: 400,
    cf_activos: 0, vend_activos: 290, importe_sin_estado: 1000, importe_sin_cliente: 1000 }),
  mesFila('ct', 2025, 9, { importe: 500, cantidad: 50, sell_in: 1500 }),
  mesFila('digitalife', 2026, 7, { importe: 300, cantidad: 30, sell_in: 600, inv_valor: 700, inv_piezas: 70, inv_skus: 12 }),
  mesFila('digitalife', 2026, 8, { importe: 350, cantidad: 35, sell_in: 650, inv_valor: 720, inv_piezas: 72, inv_skus: 12 }),
  mesFila('digitalife', 2026, 9, { importe: 400, cantidad: 40, sell_in: 800, inv_valor: 740, inv_piezas: 65, inv_skus: 11 }),
  mesFila('digitalife', 2025, 9, { importe: 500, cantidad: 50, sell_in: 900 }),
  mesFila('directo', 2026, 9, { importe: 90, cantidad: 9 }),
  mesFila('directo', 2025, 9, { importe: 60, cantidad: 6 }),
];

// ── Utilidades de mes ─────────────────────────────────────────────────────────
test('índice de mes y vuelta', () => {
  assert.equal(idxMes(2026, 1) - idxMes(2025, 12), 1);
  assert.deepEqual(deIdx(idxMes(2026, 9)), { anio: 2026, mes: 9 });
  const u = ultimosMeses(2026, 2, 3);
  assert.deepEqual(u, [{ anio: 2025, mes: 12 }, { anio: 2026, mes: 1 }, { anio: 2026, mes: 2 }]);
  assert.equal(ultimosMeses(2026, 9, 12).length, 12);
});

test('yoy y ratio protegen la división por cero', () => {
  assert.equal(yoy(120, 100), 20);
  assert.equal(yoy(100, 0), null);
  assert.equal(yoy(80, 100), -20);
  assert.equal(ratio(50, 200), 25);
  assert.equal(ratio(50, 0), null);
});

// ── MTD / YTD ────────────────────────────────────────────────────────────────
test('MTD corta por día y respeta el centinela dia = 0', () => {
  const m = mtdPorCuenta(DIAS, 2026, 9, 10);
  assert.equal(m.get('ct').importe, 300);            // días 3 y 10, NO el 20
  assert.equal(m.get('digitalife').importe, 400);    // día 5
  assert.equal(m.get('directo').importe, 90);        // dia = 0 siempre entra
  const p = mtdPorCuenta(DIAS, 2025, 9, 10);
  assert.equal(p.get('ct').importe, 150);            // sólo el día 4
  assert.equal(p.get('directo').importe, 60);        // mes completo, como en 2026
});

test('MTD completo suma el mes entero', () => {
  const m = mtdPorCuenta(DIAS, 2026, 9, 31);
  assert.equal(m.get('ct').importe, 1000);
  assert.equal(m.get('ct').cantidad, 100);
});

test('YTD suma meses previos completos y el mes en curso hasta el corte', () => {
  const y = ytdPorCuenta(DIAS, 2026, 9, 10);
  assert.equal(y.get('ct').importe, 800);            // 500 de agosto + 300 de sep al día 10
  const t = totalDe(y);
  assert.equal(t.importe, 800 + 400 + 90);
  assert.equal(totalDe(y, new Set(['ct'])).importe, 800);
});

test('último día y último mes con venta', () => {
  assert.equal(ultimoDiaConVenta(DIAS, 2026, 9), 20);
  assert.equal(ultimoDiaConVenta(DIAS, 2026, 12), 0);
  assert.deepEqual(ultimoMesConVenta(DIAS), { anio: 2026, mes: 9 });
});

// ── Inventario ───────────────────────────────────────────────────────────────
test('semanas de inventario se calculan en piezas sobre 13 semanas', () => {
  assert.equal(semanasInventario(130, 130), 13);     // 130 pz de stock, 10 pz/semana
  assert.equal(semanasInventario(0, 100), null);
  assert.equal(semanasInventario(100, 0), null);
  assert.equal(semanasInventario(null, 100), null);
});

test('sumaUltimosMeses toma la ventana correcta', () => {
  assert.equal(sumaUltimosMeses(MENSUAL, 'ct', 2026, 9, 3, 'cantidad'), 40 + 50 + 100);
  assert.equal(sumaUltimosMeses(MENSUAL, 'ct', 2026, 9, 1, 'cantidad'), 100);
  // `desplazar` = 1 → los 3 meses cerrados anteriores (jun, jul, ago): sólo hay jul y ago.
  assert.equal(sumaUltimosMeses(MENSUAL, 'ct', 2026, 9, 3, 'cantidad', 1), 40 + 50);
});

// ── Filas de la tabla ────────────────────────────────────────────────────────
test('construirFilas arma la tabla con MTD, YTD, SO/SI e inventario', () => {
  const filas = construirFilas({ cuentas: CUENTAS, mensual: MENSUAL, dias: DIAS, anio: 2026, mes: 9, corteDia: 10 });
  const ct = filas.find((f) => f.cuenta === 'ct');
  assert.equal(ct.importe, 300);
  assert.equal(ct.importePrev, 150);
  assert.equal(ct.yoy, 100);
  assert.equal(ct.ytd, 800);
  assert.equal(ct.sellIn, 2000);
  assert.equal(Math.round(ct.soSi), 15);             // 300 / 2000
  assert.equal(ct.invValor, null);                   // CT no reporta inventario
  assert.equal(ct.invSemanas, null);
  assert.equal(ct.sucursales, 56);
  assert.equal(ct.vendedores, 290);
  assert.equal(ct.tendencia.length, 6);
  assert.equal(ct.serie12.length, 12);
  assert.equal(ct.serie12[11].importe, 1000);        // el último mes de la serie es el seleccionado

  const dl = filas.find((f) => f.cuenta === 'digitalife');
  assert.equal(dl.invValor, 740);
  assert.equal(dl.invPiezas, 65);
  // El ritmo son los 3 meses CERRADOS (jun, jul, ago): sólo hay jul 30 y ago 35 pz.
  assert.ok(Math.abs(dl.invSemanas - 65 / ((30 + 35) / 13)) < 1e-9);
  assert.equal(dl.yoy, -20);

  const dir = filas.find((f) => f.cuenta === 'directo');
  assert.equal(dir.soSi, 100);                        // el directo ES su propio sell in
  assert.equal(dir.importe, 90);
});

test('las fuentes mensuales comparan contra la misma fracción del mes anterior', () => {
  // Septiembre tiene 30 días; al corte del día 10 sólo ha transcurrido 1/3 del mes.
  // El directo trae el mes en curso incompleto, así que a 2025 se le aplica ese mismo 1/3.
  const filas = construirFilas({ cuentas: CUENTAS, mensual: MENSUAL, dias: DIAS, anio: 2026, mes: 9, corteDia: 10 });
  const dir = filas.find((f) => f.cuenta === 'directo');
  assert.ok(Math.abs(dir.importePrev - 60 / 3) < 1e-9, 'sep 2025 del directo debe ir prorrateado a 1/3');
  assert.ok(Math.abs(dir.yoy - 350) < 1e-9);          // 90 vs 20
  // Con el mes completo no se recorta nada.
  const completo = construirFilas({ cuentas: CUENTAS, mensual: MENSUAL, dias: DIAS, anio: 2026, mes: 9, corteDia: 30 });
  assert.equal(completo.find((f) => f.cuenta === 'directo').importePrev, 60);
  // Las fuentes con detalle diario no se tocan.
  assert.equal(filas.find((f) => f.cuenta === 'ct').importePrev, 150);
});

test('una cuenta sin fuente de sell out sale con sinFuente y su sell in va aparte', () => {
  // Ingram retail representados (04126): factura, pero nadie reporta su sell out.
  const cuentas = [...CUENTAS, {
    cuenta: 'ingram_retail', fuente: null, nombre: 'INGRAM MICRO (RETAIL REPRESENTADOS)',
    canal_sellout: 'mayoreo', erp_cliente: '04126', propio: false, granularidad: 'mes', tiene_sellout: false,
  }];
  const mensual = [...MENSUAL, { cuenta: 'ingram_retail', anio: 2026, mes: 9, importe: 0, cantidad: 0, sell_in: 2500, sell_in_piezas: 1800 }];
  const filas = construirFilas({ cuentas, mensual, dias: DIAS, anio: 2026, mes: 9, corteDia: 30 });
  const ir = filas.find((f) => f.cuenta === 'ingram_retail');
  assert.equal(ir.sinFuente, true);
  assert.equal(ir.importe, 0);
  assert.equal(ir.yoy, null, 'sin sell out no hay YoY que enseñar');
  assert.equal(ir.soSi, null, 'sin sell out no hay sell out / sell in');
  assert.equal(ir.sellIn, 2500, 'su sell in sí se conserva');

  const tot = totalesDeFilas(filas);
  assert.equal(tot.sinFuente, 1);
  assert.equal(tot.sellInSinFuente, 2500);
  // El sell in de la cuenta sin fuente NO entra en el denominador del SO/SI del equipo.
  assert.equal(tot.sellIn, totalesDeFilas(filas.filter((f) => !f.sinFuente)).sellIn);
  // Las cuentas con fuente no cambian.
  assert.equal(filas.find((f) => f.cuenta === 'ct').sinFuente, false);
});

test('totalesDeFilas sólo cuenta inventario de quien lo reporta y "sin estado" del mayoreo', () => {
  const filas = construirFilas({ cuentas: CUENTAS, mensual: MENSUAL, dias: DIAS, anio: 2026, mes: 9, corteDia: 10 });
  const t = totalesDeFilas(filas);
  assert.equal(t.importe, 300 + 400 + 90);
  assert.equal(t.importePrev, 150 + 500 + 20); // el directo va prorrateado a 1/3 del mes
  assert.equal(t.conInventario, 1);
  assert.equal(t.invValor, 740);
  assert.equal(t.mayoreoImporte, 300);
  assert.equal(t.sinEstado, 1000);
  assert.equal(Math.round(t.yoy * 10) / 10, 17.9);    // 790 vs 670 (el directo prorrateado)
});

test('porCanal reparte y ordena', () => {
  const filas = construirFilas({ cuentas: CUENTAS, mensual: MENSUAL, dias: DIAS, anio: 2026, mes: 9, corteDia: 10 });
  const c = porCanal(filas);
  assert.deepEqual(c.map((x) => x.id), ['distribuidor', 'mayoreo', 'directo']);
  assert.equal(Math.round(c.reduce((s, x) => s + x.pct, 0)), 100);
});

// ── Composición y series ─────────────────────────────────────────────────────
const SKU_MES = [
  { cuenta: 'ct', anio: 2026, mes: 9, sku: 'AC-1', marca: 'ACTECK', categoria: 'Control', importe: 600, cantidad: 60 },
  { cuenta: 'ct', anio: 2026, mes: 9, sku: 'BR-1', marca: 'BALAM RUSH', categoria: 'Gabinete', importe: 400, cantidad: 40 },
  { cuenta: 'digitalife', anio: 2026, mes: 9, sku: 'AC-1', marca: 'ACTECK', categoria: 'Control', importe: 400, cantidad: 40 },
  { cuenta: 'digitalife', anio: 2026, mes: 8, sku: 'AC-1', marca: 'ACTECK', categoria: 'Control', importe: 350, cantidad: 35 },
];

test('composicion agrupa por dimensión, filtra por cuenta y agrupa la cola en Otros', () => {
  const porMarca = composicion(SKU_MES.filter((r) => r.mes === 9), 'marca');
  assert.deepEqual(porMarca.map((x) => x.label), ['ACTECK', 'BALAM RUSH']);
  assert.equal(porMarca[0].importe, 1000);
  assert.equal(Math.round(porMarca[0].pct), 71);
  const soloCt = composicion(SKU_MES.filter((r) => r.mes === 9), 'marca', new Set(['ct']));
  assert.equal(soloCt[0].importe, 600);
  const conTope = composicion(SKU_MES.filter((r) => r.mes === 9), 'marca', null, 1);
  assert.equal(conTope[1].label, 'Otros (1)');
});

test('serie12 separa canales y arrastra el sell in', () => {
  const s = serie12(MENSUAL, 2026, 9);
  assert.equal(s.length, 12);
  const sep = s[11];
  assert.equal(sep.x, 'Sep');
  assert.equal(sep.total, 1000 + 400 + 90);
  assert.equal(sep.mayoreo, 1000);
  assert.equal(sep.distribuidor, 400);
  assert.equal(sep.directo, 90);
  assert.equal(sep.sellIn, 2800);
  const soloDl = serie12(MENSUAL, 2026, 9, new Set(['digitalife']));
  assert.equal(soloDl[11].total, 400);
});

// ── Estados ──────────────────────────────────────────────────────────────────
const ESTADOS = [
  { cuenta: 'ct', anio: 2026, mes: 9, estado: 'JALISCO', importe: 600, cantidad: 60, clientes_finales: 30, vendedores: 8 },
  { cuenta: 'ct', anio: 2026, mes: 9, estado: 'SIN ESTADO', importe: 400, cantidad: 40, clientes_finales: 0, vendedores: 2 },
  { cuenta: 'ct', anio: 2025, mes: 9, estado: 'JALISCO', importe: 300, cantidad: 30, clientes_finales: 20, vendedores: 6 },
  { cuenta: 'ct', anio: 2026, mes: 8, estado: 'JALISCO', importe: 999, cantidad: 99, clientes_finales: 1, vendedores: 1 },
];

test('porEstado compara contra el mismo mes del año anterior', () => {
  const e = porEstado(ESTADOS, 2026, 9);
  assert.equal(e.length, 2);
  assert.equal(e[0].estado, 'JALISCO');
  assert.equal(e[0].importe, 600);
  assert.equal(e[0].yoy, 100);
  assert.equal(Math.round(e[0].pct), 60);
  assert.equal(e[1].estado, 'SIN ESTADO');
  assert.equal(e[1].yoy, null);
});

// ── Drill: SKUs y alertas ────────────────────────────────────────────────────
const INV_SKU = [
  { sku: 'AC-1', stock: 130, valor: 1300, dias_sin_venta: 5 },
  { sku: 'BR-1', stock: 0, valor: 0, dias_sin_venta: 45 },
];

test('SO / SI no se muestra cuando el sell in es cero o negativo', () => {
  const mensual = [...MENSUAL.filter((r) => !(r.cuenta === 'ct' && r.anio === 2026 && r.mes === 9)),
    mesFila('ct', 2026, 9, { importe: 1000, cantidad: 100, sell_in: 0 })];
  const cero = construirFilas({ cuentas: CUENTAS, mensual, dias: DIAS, anio: 2026, mes: 9, corteDia: 10 });
  assert.equal(cero.find((f) => f.cuenta === 'ct').soSi, null);
  const mensualNeg = [...MENSUAL.filter((r) => !(r.cuenta === 'ct' && r.anio === 2026 && r.mes === 9)),
    mesFila('ct', 2026, 9, { importe: 1000, cantidad: 100, sell_in: -500 })];
  const neg = construirFilas({ cuentas: CUENTAS, mensual: mensualNeg, dias: DIAS, anio: 2026, mes: 9, corteDia: 10 });
  assert.equal(neg.find((f) => f.cuenta === 'ct').soSi, null);
});

test('skusDeCuenta reparte por mes y cruza el stock del cliente', () => {
  const filas = skusDeCuenta(SKU_MES.filter((r) => r.cuenta === 'ct'), INV_SKU, 2026, 9, 'piezas');
  assert.equal(filas.length, 2);
  assert.equal(filas[0].sku, 'AC-1');
  assert.equal(filas[0].mesActual, 60);
  assert.equal(filas[0].meses.length, 12);
  assert.equal(filas[0].stock, 130);
  // últimos 3 meses = 60 pz → ritmo 60/13 por semana → 130 / (60/13) ≈ 28.2
  assert.ok(Math.abs(filas[0].semanas - 130 / (60 / 13)) < 1e-9);
  assert.equal(filas[1].stock, 0);
  assert.equal(filas[1].semanas, null);
});

test('alertasDeCuenta sólo mira días sin venta cuando la fuente lo trae', () => {
  const filas = skusDeCuenta(SKU_MES.filter((r) => r.cuenta === 'ct'), INV_SKU, 2026, 9, 'piezas');
  const a = alertasDeCuenta(filas, true);
  assert.equal(a.sinStockConVenta, 1);               // BR-1 vendió y tiene 0
  assert.equal(a.sinVenta30, 0);                     // BR-1 tiene 45 d pero sin stock
  const sinDato = alertasDeCuenta(filas, false);
  assert.equal(sinDato.sinVenta30, 0);
});

test('ritmoProyectado extrapola el mes', () => {
  assert.equal(Math.round(ritmoProyectado(300, 10, 2026, 9)), 900);   // septiembre tiene 30 días
  assert.equal(ritmoProyectado(300, 0, 2026, 9), null);
});

// ── Textos ───────────────────────────────────────────────────────────────────
test('los textos para compartir no traen nada sensible', () => {
  const filas = construirFilas({ cuentas: CUENTAS, mensual: MENSUAL, dias: DIAS, anio: 2026, mes: 9, corteDia: 10 });
  const tot = totalesDeFilas(filas);
  const txt = textoResumenMes({ anio: 2026, mes: 9, tot, canales: porCanal(filas), top: filas, corteDia: 10, cuentasActivas: 3, cuentasTotal: 3 });
  assert.match(txt, /SELL OUT · SEPTIEMBRE 2026/);
  assert.match(txt, /Al día 10/);
  assert.match(txt, /POR CANAL/);
  for (const prohibida of [/margen/i, /contribuci/i, /utilidad/i, /costo/i, /\bMC\b/, /\bMUC\b/]) {
    assert.ok(!prohibida.test(txt), `el resumen no debe mencionar ${prohibida}`);
  }
  const est = textoEstatusCuenta({ fila: filas[1], anio: 2026, mes: 9, corteDia: 10,
    topSkus: skusDeCuenta(SKU_MES.filter((r) => r.cuenta === 'digitalife'), INV_SKU, 2026, 9, 'piezas'),
    alertas: { sinStockConVenta: 2, sinVenta30: 1 }, estados: [{ estado: 'JALISCO', pct: 60 }] });
  assert.match(est, /DIGITALIFE/);
  assert.match(est, /Inventario en su almacén/);
  assert.match(est, /DÓNDE VENDE/);
  for (const prohibida of [/margen/i, /contribuci/i, /utilidad/i, /costo/i]) {
    assert.ok(!prohibida.test(est), `el estatus no debe mencionar ${prohibida}`);
  }
});

test('capitalizarEstado repone los acentos', () => {
  assert.equal(capitalizarEstado('CIUDAD DE MEXICO'), 'Ciudad de México');
  assert.equal(capitalizarEstado('JALISCO'), 'Jalisco');
  assert.equal(capitalizarEstado('QUINTANA ROO'), 'Quintana Roo');
  assert.equal(capitalizarEstado('SIN ESTADO'), 'Sin estado');
});

test('fraseHero se lee como una frase', () => {
  const f = fraseHero({ importe: 18_400_000, yoy: 12, soSi: 47 }, 2026, 9);
  assert.equal(f, 'El equipo desplazó $18.4 M, 12 % arriba de sep 25 a mismo día; es el 47 % del sell in del mes.');
  const sinPrev = fraseHero({ importe: 100, yoy: null, soSi: null }, 2026, 9);
  assert.match(sinPrev, /sin comparativo/);
});
