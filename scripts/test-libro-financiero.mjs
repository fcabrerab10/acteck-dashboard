// Estado de Resultados V4 · libro financiero de los consultores (2026-11-09).
//   node --test scripts/test-libro-financiero.mjs
// Parser (periodo del libro, grupos de gastos, formato largo), motor puro (estado, mes a mes, indicadores)
// y SSR de la vista con datos de ejemplo. Sin red.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';
import XLSX from 'xlsx-js-style';

globalThis.window ??= globalThis;
globalThis.window.XLSX = XLSX;
globalThis.navigator ??= { userAgent: 'node', language: 'es-MX', onLine: true };
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {}, clear() {} };
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.requestAnimationFrame ??= (f) => setTimeout(f, 0);
globalThis.addEventListener ??= () => {};
globalThis.removeEventListener ??= () => {};

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
test.after(async () => { await vite.close(); setTimeout(() => process.exit(process.exitCode || 0), 200).unref(); });

const { default: libroFinanciero, periodoDelLibro, nivelesGastos } = await vite.ssrLoadModule('/src/lib/parsers/libroFinanciero.js');
const C = await vite.ssrLoadModule('/src/modules/general/resultados/libroCalc.js');
const { ThemeProvider } = await vite.ssrLoadModule('/src/lib/themeContext.jsx');
const { EstadoLibroVista, armar } = await vite.ssrLoadModule('/src/modules/general/EstadoResultados.jsx');

// ─── libro de ejemplo (misma forma que REVKO LIBRO 09-09-26.xlsx, cifras inventadas) ───
function libroEjemplo() {
  const wb = XLSX.utils.book_new();
  const add = (nombre, aoa) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), nombre);
  add('CONSO GRAL', [
    ['ACK'], ['INFORME CONSOLIDADO A FEBRERO 2026'], ['CONCEPTO', 'Mes', 'Acum.'],
    ['VENTAS NETAS', 100000, 220000], ['Presupuesto1', 110000, 200000], ['% alcanzado', 0.909, 1.1],
    ['UTILIDAD BRUTA', 25000, 55000], ['Presupuesto2', 27500, 50000], ['% alcanzado', 0.909, 1.1],
    ['% UTILIDAD BRUTA', 0.25, 0.25], ['% presupuesto3', 0.25, 0.25], ['% alcanzado', 1, 1],
    ['GASTOS DE OPERACION', 12000, 25000], ['Gastos Financieros', 1000, 2000], ['Perdida Cambiaria', -500, -1000],
    ['Presupuesto4', 11000, 22000], ['%  gastado S/Ventas', 0.12, 0.114],
    ['UTILIDAD NETA', 12500, 29000], ['Presupuesto5', 10000, 20000], ['%  S/Ventas', 0.125, 0.132],
    ['DIAS CARTERA', null, 100], ['Presupuesto6', null, 90], ['% alcanzado', null, 0.9],
    ['CARTERA + 120', null, 5000], ['CARTERA TOTAL', null, 100000], ['%', null, 0.05],
    ['P. Terminado            Dias', null, 120], ['Importe', null, 150000000],
    ['PASIVO BANCOS', null, 70000000], ['PASIVO PROV. Y OTROS', null, 150000000], ['SUMA A TERCEROS', null, 220000000], ['PASIVO TOTAL', null, 220000000],
  ]);
  add('CONSO. COMP. AÑO ANTER.', [
    ['REVKO'], ['Informe Consolidado y Comparativo con año anterior a FEBRERO 2026'], [], [null, 'MES', null, 'ACUMULADO'],
    ['CONCEPTO', 2025, 2026, 2025, 2026],
    ['VENTAS NETAS', 90000, 100000, 180000, 220000], ['Presupuesto1', 80000, 110000, 160000, 200000], ['% alcanzado', 1.125, 0.909, 1.125, 1.1],
    ['UTILIDAD BRUTA', 20000, 25000, 40000, 55000], ['GASTOS DE OPERACION', 10000, 12000, 20000, 25000],
    ['Gastos Financieros', 1500, 1000, 3000, 2000], ['Perdida Cambiaria', 200, -500, 400, -1000],
    ['UTILIDAD NETA', 8300, 12500, 16600, 29000], ['DIAS CARTERA', null, null, 95, 100], ['SUMA A TERCEROS', null, null, 300000000, 220000000],
  ]);
  add('GTOS.GDL X MES', [
    ['REVKO'], [null, null, null, null, 'ACUMULADO'], ['GASTOS DE VENTA Y ADMINISTRACION', 'ENERO', 'FEBRERO', 'ACUMULADO', '2026'], [],
    ['NOMINA', 8000, 8500, 16500], ['SUELDOS', 8000, 8500, 16500], ['PERCEPCION NORMAL', 5000, 5500, 10500], ['IMSS', 3000, 3000, 6000],
    ['DISTRIBUCION', 3000, 2500, 5500], ['FLETES', 1000, 1000, 2000], ['PAQUETERIA', 2000, 1500, 3500],
    ['SEGUROS Y FIANZAS', 2000, 1000, 3000], ['SEGUROS Y FIANZAS', 2000, 1000, 3000],
    ['SUMA TOTAL', 13000, 12000, 25000], ['%  S/VENTAS', 0.108, 0.12, 0.114], ['VENTAS', 120000, 100000, 220000],
  ]);
  add('GTOS.GDL COMP. AÑO ANT. ', [
    ['REVKO'], ['COMPARATIVO DE GASTOS CON AÑO ANTERIOR'], [null, 'ACUMULADO'], ['CONCEPTO', 'AL MES DE FEBRERO'],
    ['GASTOS DE VENTA Y ADMINISTRACION', 2025, '%', 2026, '%'],
    ['NOMINA', 14000, 0.08, 16500, 0.075], ['SUELDOS', 14000, 0.08, 16500, 0.075], ['DISTRIBUCION', 6000, 0.03, 5500, 0.025], ['SUMA TOTAL', 20000, 0.11, 25000, 0.11], ['VENTAS', 180000, null, 220000],
  ]);
  add('CART.X MES ', [
    ['ANTIGUEDAD DE SALDOS'], [], ['REVKO'], [null, 'POR', '1 A 30', '31 A 60', '61 A 90', '91 A 180', '+180', null, 'RESER.', 'DIAS'],
    ['DIC.DEL 2025', 80000, 10000, 5000, 1000, 500, 2000, 98500, -1000, 95], ['ENERO', 85000, 9000, 4000, 1000, 500, 2000, 101500, -1000, 98], ['FEBRERO', 82000, 11000, 3000, 1000, 500, 2500, 100000, -1000, 100],
    ['DIF.DIC-2025 Y FEB.2026', 2000, 1000, -2000, 0, 0, 500, 1500, 0, 5],
  ]);
  add('COMP.VTAS.UTIL.', [
    ['COMPARATIVO DE VENTAS Y UTILIDAD NETAS'], [], [null, 2025, null, null, 2026], [null, 'VENTAS', 'UTILIDAD', '%', 'VENTAS', 'UTILIDAD', '%'],
    ['ENERO', 90000, 8300, 0.09, 120000, 16500, 0.14], ['FEBRERO', 90000, 8300, 0.09, 100000, 12500, 0.125], ['MARZO', 95000, 9000, 0.09, null, null, null],
    ['TOTALES', 1100000, 100000, 0.09, 220000, 29000, 0.13],
  ]);
  add('COMP.ROTAC.INVENT.', [
    [], ['COMPARATIVO DE ROTACION DE INVENTARIOS'], [null, 2025, null, null, 2026], [null, 'INVENTARIO', 'ROT.INV.', null, 'INVENTARIO', 'ROT.INV.'], [],
    ['DIC AÑO ANTER.', 140000000, 100, null, 151000000, 90], ['ENERO', 150000000, 110, null, 160000000, 115], ['FEBRERO', 152000000, 112, null, 150000000, 120],
  ]);
  add('REP EMPLEADOS', [
    ['RELACION DE PERSONAL DE 2022 A FEBRERO 2026'], [null, 2024, 2025, 2026], [], [null, 45627, 45992, 46023, 46054], [], [], [],
    ['ACK GDL Y MEX', 84, 85, 86, 86], ['VTAS /PERS', 456, 821000, 1395000, 1162000], ['UTIL/PERS', -97, 22000, 191000, 145000],
  ]);
  add('E.ORIGEN', [
    ['ESTADO DE ORIGEN Y APLICACION DE RECURSOS'], ['REVKO'], [null, null, null, 'FEBRERO'], [null, null, 'BALANCE GENERAL', null, 'ORIGEN DE', null, null, 'APLICACION'],
    ['CONCEPTO', null, 'AL', 'AL', 'RECURSOS', null, 'SUMA', 'DE'], [null, null, 46022, 46054, 'PROPIOS', 'AJENOS', null, 'RECURSOS'],
    ['ACTIVO'], [null, 'CAJA Y BANCOS', 42000000, 30000000, 12000000, null, 12000000, 0], [null, 'INVENTARIOS', 151000000, 150000000, 1000000, null, 1000000, 0], ['SUMA ACTIVO', null, 193000000, 180000000, 13000000, 0, 13000000, 0],
    ['PASIVO'], [null, 'PROVEEDORES', 160000000, 150000000, null, 0, 0, -10000000], ['SUMA PASIVO', null, 160000000, 150000000, 0, 0, 0, 10000000],
    ['CAPITAL'], [null, 'RESULTADO EJERCICIO', 0, 29000, 29000, null, 29000, 0], ['SUMA CAPITAL', null, 33000000, 30029000, 29000, 0, 29000, 0],
  ]);
  add('ROI ', [['REVKO'], ['ROI 2026'], [], [null, null, 'CANTIDADES A FEBRERO'], [null, 'CAP. INICIAL', 'UTILIDAD', 'ROI', 'REAL ANUALIZADO', 'UTILIDAD', 'ROI', 'ANUALIZADO', 'DIFER.'], ['FEBRERO', 216000000, 29000, 0.013, 0.08, 20000, 0.009, 0.055, 0.004]]);
  return wb;
}

test('periodo del libro: título de CONSO GRAL o nombre del archivo', () => {
  assert.deepEqual(periodoDelLibro([['ACK'], ['INFORME CONSOLIDADO A SEPTIEMBRE 2026']]), { anio: 2026, mes: 9, origen: 'título del libro' });
  assert.deepEqual(periodoDelLibro([['ACK'], ['CONSOLIDADO A FEBRERO 2026']]), { anio: 2026, mes: 2, origen: 'título del libro' });
  assert.deepEqual(periodoDelLibro([['x']], 'REVKO LIBRO 09-09-26 (1).xlsx'), { anio: 2026, mes: 9, origen: 'nombre del archivo' });
  assert.throws(() => periodoDelLibro([['x']], 'otro.xlsx'), /No se detectó el mes/);
});

test('grupos de gastos: un renglón es grupo si su acumulado es la suma de los siguientes (anidado)', () => {
  const n = nivelesGastos([
    { label: 'NOMINA', acum: 16500 }, { label: 'SUELDOS', acum: 16500 }, { label: 'PERCEPCION', acum: 10500 }, { label: 'IMSS', acum: 6000 },
    { label: 'DISTRIBUCION', acum: 5500 }, { label: 'FLETES', acum: 2000 }, { label: 'PAQUETERIA', acum: 3500 },
    { label: 'COMISIONES', acum: 0 },
  ]);
  assert.deepEqual(n.map((x) => x.nivel), [0, 1, 2, 2, 0, 1, 1, 0]);
  assert.equal(n[2].padreIdx, 1);
  assert.equal(n[5].padreIdx, 4);
});

const job = libroFinanciero(libroEjemplo(), 'REVKO LIBRO 02-02-26.xlsx');

test('parser: formato largo con las nueve hojas, periodo y llaves únicas', () => {
  assert.equal(job.table, 'libro_financiero');
  assert.deepEqual(job.periodoLibro, { anio: 2026, mes: 2, origen: 'título del libro' });
  assert.equal(job.periodo, undefined, 'sin `periodo`: el importador no debe pedir confirmar una semana');
  const hojas = new Set(job.rows.map((r) => r.hoja));
  for (const h of ['conso', 'gastos', 'gastos_acum', 'cartera', 'ventas_utilidad', 'inventario', 'personal', 'balance', 'roi']) assert.ok(hojas.has(h), h);
  const llaves = new Set(job.rows.map((r) => `${r.anio}|${r.mes}|${r.hoja}|${r.clave}|${r.columna}`));
  assert.equal(llaves.size, job.rows.length, 'sin llaves repetidas');
  const g = (hoja, anio, mes, clave, col = 'valor') => job.rows.find((r) => r.hoja === hoja && r.anio === anio && r.mes === mes && r.clave === clave && r.columna === col)?.valor;
  assert.equal(g('conso', 2026, 2, 'ventas', 'real_acum'), 220000);
  assert.equal(g('conso', 2026, 2, 'gastos', 'ppto_mes'), 11000, 'el Presupuesto4 cuelga de gastos, no de la cambiaria');
  assert.equal(g('conso', 2026, 2, 'gastos', 'pct_acum'), 0.114);
  assert.equal(g('conso', 2025, 2, 'ventas', 'real_mes'), 90000, 'el comparativo deja el año anterior');
  assert.equal(g('conso', 2025, 2, 'utilidad_neta', 'real_acum'), 16600);
  assert.equal(g('gastos', 2026, 1, 'nomina'), 8000);
  assert.equal(job.rows.find((r) => r.hoja === 'gastos' && r.clave === 'percepcion_normal').padre, 'sueldos');
  assert.equal(job.rows.find((r) => r.hoja === 'gastos' && r.clave === 'seguros_y_fianzas_2').nivel, 1, 'misma cuenta repetida = hija con sufijo');
  assert.equal(g('gastos_acum', 2025, 2, 'nomina'), 14000);
  assert.equal(g('cartera', 2025, 12, 'dias'), 95);
  assert.equal(g('cartera', 2026, 2, 'mas_180'), 2500);
  assert.equal(g('ventas_utilidad', 2025, 0, 'ventas'), 1100000, 'TOTALES → mes 0');
  assert.equal(g('inventario', 2025, 12, 'rotacion'), 90, 'DIC AÑO ANTER. del 2026 = diciembre 2025');
  assert.equal(g('personal', 2025, 0, 'personas'), 85, 'años cerrados con mes 0');
  assert.equal(g('personal', 2026, 2, 'venta_persona'), 1162000);
  assert.equal(g('balance', 2026, 2, 'caja_y_bancos', 'saldo'), 30000000);
  assert.equal(job.rows.find((r) => r.hoja === 'balance' && r.clave === 'proveedores').padre, 'pasivo');
  assert.equal(g('roi', 2026, 2, 'roi'), 0.013);
});

test('motor: estado acumulado y del mes, alcance, año anterior y grupos de gasto', () => {
  const idx = C.indexar(job.rows);
  assert.deepEqual(C.mesesConLibro(idx, 2026), [2]);
  const e = C.estado(idx, 2026, 2, 'acum');
  const f = Object.fromEntries(e.filas.map((x) => [x.id, x]));
  assert.equal(f.ventas.real, 220000); assert.equal(f.ventas.ppto, 200000); assert.ok(Math.abs(f.ventas.alcance - 1.1) < 1e-9); assert.equal(f.ventas.tono, 'ok');
  assert.equal(f.costo.real, 165000); assert.equal(f.costo.ppto, 150000); assert.equal(f.costo.tono, 'casi', 'costo 10 % arriba del plan = naranja');
  assert.equal(f.utilidad_bruta.ant, 40000); assert.ok(Math.abs(f.utilidad_bruta.delta - 0.375) < 1e-9);
  assert.ok(Math.abs(f.margen_bruto.real - 0.25) < 1e-9); assert.ok(Math.abs(f.margen_bruto.ant - 40000 / 180000) < 1e-9);
  assert.equal(f.gastos.real, 25000); assert.equal(f.gastos.ppto, 22000); assert.equal(f.gastos.tono, 'mal');
  assert.equal(f.cambiario.real, 1000, 'pérdida cambiaria negativa = ganancia positiva');
  assert.equal(f.utilidad_neta.real, 29000); assert.equal(f.utilidad_neta.ant, 16600);
  assert.ok(Math.abs(f.otros.real - (29000 - (55000 - 25000 - 2000 + 1000))) < 1e-6, 'otros cuadra la utilidad neta');
  const grupos = e.filas.filter((x) => x.tipo === 'hijo');
  assert.deepEqual(grupos.map((x) => x.label), ['NOMINA', 'DISTRIBUCION', 'SEGUROS Y FIANZAS'], 'grupos nivel 0 por monto');
  assert.equal(grupos[0].real, 16500); assert.equal(grupos[0].ant, 14000);
  assert.equal(grupos[0].hijos[0].hijos.length, 2, 'sueldos → percepción e IMSS');
  const em = C.estado(idx, 2026, 2, 'mes');
  const fm = Object.fromEntries(em.filas.map((x) => [x.id, x]));
  assert.equal(fm.ventas.real, 100000); assert.equal(fm.ventas.tono, 'casi', '91 % del plan = naranja');
});

test('motor: mes a mes, indicadores, cinco años, cartera y balance', () => {
  const idx = C.indexar(job.rows);
  const mm = C.mesAMes(idx, 2026);
  assert.deepEqual(mm.meses, [2]);
  assert.equal(mm.columnas[0].ventas, 100000); assert.equal(mm.acum.ventas, 220000); assert.equal(mm.acum.label, 'Acum');
  const ind = Object.fromEntries(C.indicadores(idx, 2026, 2).map((i) => [i.id, i]));
  assert.equal(ind.cartera.real, 100); assert.equal(ind.cartera.meta, 90); assert.equal(ind.cartera.ant, 95); assert.equal(ind.cartera.tono, 'casi');
  assert.equal(ind.deuda.real, 220000000); assert.equal(ind.deuda.ant, 300000000); assert.equal(ind.deuda.tono, 'ok');
  assert.ok(Math.abs(ind.roi.real - 0.00013) < 1e-9);
  assert.equal(ind.personal.real, 86); assert.equal(ind.personal.ant, 85);
  const cinco = C.cincoAnios(idx, 2026, 2);
  assert.deepEqual(cinco.map((x) => [x.anio, x.ventas, x.utilidad]), [[2025, 180000, 16600], [2026, 220000, 29000]]);
  assert.equal(cinco[0].totalVentas, 1100000);
  const cart = C.carteraPorMes(idx, 2026);
  assert.deepEqual(cart.map((x) => x.label), ['Dic 2025', 'Ene', 'Feb']);
  const bal = C.balance(idx, 2026, 2);
  assert.equal(bal[0].lineas[0].concepto, 'CAJA Y BANCOS'); assert.equal(bal[0].suma.saldo, 180000000);
  assert.equal(C.miles(-1234567), '(1,235)'); assert.equal(C.miles(1234567, { paren: true }), '(1,235)');
});

test('SSR: la vista pinta estado, mes a mes e indicadores sin red', () => {
  const idx = C.indexar(job.rows);
  const datos = armar(idx, 2026, 2, 'acum', [2]);
  const html = renderToString(React.createElement(ThemeProvider, null, React.createElement(EstadoLibroVista, { datos, anio: 2026, anios: [2026], mes: 2, meses: [2], periodo: 'acum' })));
  for (const t of ['Estado de Resultados', 'Acumulado · enero a febrero', 'Ventas netas', 'Utilidad bruta', 'margen bruto', 'Gastos de operación', 'Utilidad neta', 'Mes a mes · 2026', 'Días de cartera', '220,000', '110 %']) assert.ok(html.includes(t), t);
  const m = renderToString(React.createElement(ThemeProvider, null, React.createElement(EstadoLibroVista, { datos: armar(idx, 2026, 2, 'mes', [2]), anio: 2026, anios: [2026], mes: 2, meses: [2], periodo: 'mes' })));
  assert.ok(m.includes('100,000'));
});
