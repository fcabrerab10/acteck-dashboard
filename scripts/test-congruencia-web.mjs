// Congruencia web ↔ celular (2026-11-18): los cinco bloques que el celular tenía y la web no.
//   1 Sell In consolidado · período Mes · YTD (motor sellin/resumen.js con la facturación que ya baja la web)
//   2 Sell In consolidado · columna Δ 12 m (sellout/skuAnual.js#ventanasDesdeAnios / deltaVentana)
//   3 Inventario · «Inventario vs venta · 12 meses» y composición Categoría · Marca · Almacén
//   4 Propuestas · «Propuesto vs facturado · 12 meses» (propuestas/resumen.js con efectividades ya calculadas)
//   5 Propuestas › Revisar · todos los precios de lista de la línea (preciosDeLinea + PreciosLinea)
// Cálculo puro + SSR de las vistas nuevas, sin red.   node --test scripts/test-congruencia-web.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';

globalThis.window ??= globalThis;
globalThis.navigator ??= { userAgent: 'node', language: 'es-MX', onLine: true };
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {}, clear() {} };
globalThis.sessionStorage ??= globalThis.localStorage;
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.requestAnimationFrame ??= (f) => setTimeout(f, 0);
globalThis.addEventListener ??= () => {};
globalThis.removeEventListener ??= () => {};

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
test.after(async () => { await vite.close(); setTimeout(() => process.exit(process.exitCode || 0), 200).unref(); });

const { ThemeContext } = await vite.ssrLoadModule('/src/lib/themeContext.jsx');
const { getTheme } = await vite.ssrLoadModule('/src/lib/themeTokens.js');
const sku = await vite.ssrLoadModule('/src/modules/comercial/sellout/skuAnual.js');
const si = await vite.ssrLoadModule('/src/modules/comercial/sellin/resumen.js');
const siMovil = await vite.ssrLoadModule('/src/movil/pestanas/sellin/calculo.js');
const inv = await vite.ssrLoadModule('/src/modules/comercial/inventario/calculoEmpresa.js');
const invMovil = await vite.ssrLoadModule('/src/movil/pestanas/inventario/calculo.js');
const prop = await vite.ssrLoadModule('/src/modules/comercial/propuestas/resumen.js');
const propMovil = await vite.ssrLoadModule('/src/movil/pestanas/propuestas/calculo.js');
const { InventarioVsVentaPanel, ComposicionPanel } = await vite.ssrLoadModule('/src/modules/comercial/inventario/InventarioVentaPanel.jsx');
const { default: PreciosLinea } = await vite.ssrLoadModule('/src/modules/comercial/propuestas/PreciosLinea.jsx');

const render = (C, props, themeKey = 'midnight') => renderToString(
  React.createElement(ThemeContext.Provider, { value: { theme: getTheme(themeKey), setThemeKey() {} } }, React.createElement(C, props)),
).replace(/<!--.*?-->/g, '');
const sano = (s, donde) => assert.ok(!/NaN|undefined|\[object Object\]/.test(s), `${donde}: NaN/undefined/[object Object] en el HTML`);

test('los motores movidos a modules siguen saliendo por el archivo del celular (reexport)', () => {
  assert.equal(siMovil.resumenSellIn, si.resumenSellIn);
  assert.equal(invMovil.serieInventario, inv.serieInventario);
  assert.equal(invMovil.mixesInventario, inv.mixesInventario);
  assert.equal(propMovil.resumenPropuestas, prop.resumenPropuestas);
});

test('Δ 12 m: ventana que termina en el mes elegido contra la misma un año antes; «—» sin año anterior', () => {
  const porAnio = { 2024: Array(12).fill(10), 2025: Array(12).fill(20), 2026: Array(12).fill(30) };
  // Ventana abr 2025 – mar 2026: 9 × 20 + 3 × 30 = 270 · anterior abr 2024 – mar 2025: 9 × 10 + 3 × 20 = 150 → +80 %
  const v = sku.ventanasDesdeAnios(porAnio, 2026, 3);
  assert.equal(v.actual.reduce((a, b) => a + b, 0), 270);
  assert.equal(v.prev.reduce((a, b) => a + b, 0), 150);
  assert.equal(Math.round(v.delta), 80);
  // Año anterior en ceros → sin Δ (nunca Infinity ni 0 %)
  assert.equal(sku.ventanasDesdeAnios({ 2025: Array(12).fill(0), 2026: Array(12).fill(5) }, 2026, 12).delta, null);
  // Sin ningún año de la ventana anterior cargado → prev null
  const solo = sku.ventanasDesdeAnios({ 2026: Array(12).fill(5) }, 2026, 12);
  assert.equal(solo.prev, null); assert.equal(solo.delta, null);
  assert.equal(sku.deltaVentana([1, 2], null), null);
  assert.equal(sku.deltaVentana([50, 50], [100, 100]), -50);
});

test('Sell In web · Mes · YTD con la facturación de la pantalla (sin medidas del director ni consultas nuevas)', () => {
  const medidas = [];
  for (const anio of [2024, 2025, 2026]) for (let m = 1; m <= 12; m += 1) medidas.push({ anio, mes: m, fact_neta: anio === 2026 ? (m <= 11 ? 60e6 : 0) : 50e6, piezas_venta_neta: 1000 });
  const d = { medidas, cuotaCanales: [], cuotaMensual: Array.from({ length: 12 }, (_, i) => ({ anio: 2026, mes: i + 1, cuota_ideal: 80e6 })) };
  const hoy = new Date(2026, 10, 15, 12); // 15 nov 2026
  // Mes cerrado (septiembre): sin prorrateo, 75 % de cuota, +20 % vs 2025
  const mes = si.resumenSellIn(d, { anio: 2026, mes: 9, modo: 'mes', hoy, sensible: false });
  assert.equal(mes.enCurso, false);
  assert.equal(Math.round(mes.pctCuota), 75);
  assert.equal(Math.round(mes.yoy), 20);
  assert.equal(mes.prevComparable, 50e6);
  assert.equal(mes.otro.fact_neta, 9 * 60e6, 'en modo Mes el «otro» período es el YTD al mes elegido');
  assert.ok(!/margen/i.test(mes.frase), 'sin sensible la frase no menciona margen');
  // YTD a septiembre
  const ytd = si.resumenSellIn(d, { anio: 2026, mes: 9, modo: 'ytd', hoy, sensible: false });
  assert.equal(ytd.cur.fact_neta, 9 * 60e6);
  assert.equal(ytd.cuotaPeriodo, 9 * 80e6);
  assert.equal(ytd.otro.fact_neta, 60e6, 'en modo YTD el «otro» período es el mes');
  // Mes en curso: el año anterior se prorratea a mismo día (15 de 30)
  const curso = si.resumenSellIn(d, { anio: 2026, mes: 11, modo: 'mes', hoy, sensible: false });
  assert.equal(curso.enCurso, true);
  assert.equal(curso.prevComparable, 25e6);
  assert.equal(Math.round(curso.yoy), 140);
});

test('Inventario · serie de 12 meses (dinero o piezas) y composición por categoría · marca · almacén', () => {
  const hoy = new Date(2026, 10, 18, 12);
  const meses = [
    { anio: 2026, mes: 8, inv_cierre_mes: null, inv_cierre_mes_piezas: null, cv_ultimos_3_meses: 240e6, piezas_venta_neta: 90000 },
    { anio: 2026, mes: 9, inv_cierre_mes: 150e6, inv_cierre_mes_piezas: 700000, cv_ultimos_3_meses: 270e6, piezas_venta_neta: 100000 },
    { anio: 2026, mes: 10, inv_cierre_mes: 160e6, inv_cierre_mes_piezas: 720000, cv_ultimos_3_meses: 300e6, piezas_venta_neta: 110000 },
  ];
  const s = inv.serieInventario({ meses, hoy, sensible: true });
  assert.equal(s.length, 12);
  const oct = s.find((x) => x.mes === 10 && x.anio === 2026);
  assert.equal(oct.inv, 160e6); assert.equal(oct.cv, 100e6); assert.equal(Math.round(oct.dias), 48);
  const pz = inv.serieInventario({ meses, hoy, sensible: false }).find((x) => x.mes === 10);
  assert.equal(pz.inv, 720000, 'sin permiso sensible la serie va en piezas');
  assert.equal(Math.round(pz.cv), 63333, 'piezas: promedio de los 3 meses anteriores con dato (sep + ago) / 3');

  const filas = [
    { articulo: 'AC-100001', no_almacen: 1, almacen_nombre: 'GEN GDL', inventario: 100, costoinventario: 50000 },
    { articulo: 'AC-100001', no_almacen: 3, almacen_nombre: 'GEN MEX', inventario: 50, costoinventario: 25000 },
    { articulo: 'BR-200002', no_almacen: 1, almacen_nombre: 'GEN GDL', inventario: 10, costoinventario: 90000 },
  ];
  const rd = new Map([['AC-100001', { categoria: 'Monitores', marca: 'ACTECK' }], ['BR-200002', { categoria: 'Sillas', marca: '' }]]);
  const mx = inv.mixesInventario(filas, rd, { sensible: true });
  assert.deepEqual(mx.categoria.map((x) => [x.label, x.v]), [['Sillas', 90000], ['Monitores', 75000]]);
  assert.deepEqual(mx.marca.map((x) => x.label), ['Balam Rush', 'Acteck']);
  assert.deepEqual(mx.almacen.map((x) => [x.label, x.v]), [['GEN GDL', 140000], ['GEN MEX', 25000]]);
  const mxPz = inv.mixesInventario(filas, rd, { sensible: false });
  assert.deepEqual(mxPz.categoria.map((x) => [x.label, x.v]), [['Monitores', 150], ['Sillas', 10]]);

  for (const tema of ['midnight', 'light']) {
    const g = render(InventarioVsVentaPanel, { serie: s, sensible: true }, tema);
    assert.match(g, /Inventario vs venta · 12 meses/); assert.match(g, /2 cierres con foto/); sano(g, 'InventarioVsVentaPanel');
    const c = render(ComposicionPanel, { mixes: mx, sensible: true }, tema);
    assert.match(c, /Composición del inventario/); assert.match(c, /Sillas/); assert.match(c, /Categoría/); assert.match(c, /Almacén/); sano(c, 'ComposicionPanel');
  }
  const vacio = render(InventarioVsVentaPanel, { serie: inv.serieInventario({ meses: [], hoy }), sensible: false });
  assert.match(vacio, /sin cierres de mes todavía/);
  const cPz = render(ComposicionPanel, { mixes: mxPz, sensible: false });
  assert.match(cPz, /piezas/); assert.ok(!/\$/.test(cPz), 'sin permiso sensible la composición no enseña dinero');
});

test('Propuestas · serie propuesto vs facturado con las efectividades que ya tiene la landing web', () => {
  const hoy = new Date(2026, 10, 18, 12);
  const propuestas = [
    { id: 'a', estado: 'cerrada', anio: 2026, mes: 10, resumen: { total: 100000 }, lineas: [{ sku: 'AC-1' }], enviadaAt: '2026-10-02T12:00:00Z' },
    { id: 'b', estado: 'enviada', anio: 2026, mes: 11, resumen: { total: 40000 }, lineas: [], enviadaAt: '2026-11-03T12:00:00Z' },
    { id: 'c', estado: 'borrador', anio: 2026, mes: 11, resumen: { total: 999999 }, lineas: [] },
  ];
  const efectividades = new Map([['a', { pct: 60, completa: true, montoProp: 100000, montoFact: 60000, skusConvertidos: 1 }]]);
  const r = prop.resumenPropuestas({ propuestas, efectividades, anio: 2026, mes: 11, hoy });
  assert.equal(r.serie.length, 12);
  const oct = r.serie[10], nov = r.serie[11];
  assert.equal(oct.propuesto, 100000); assert.equal(oct.facturado, 60000);
  assert.equal(nov.propuesto, 40000, 'los borradores no cuentan como propuesto'); assert.equal(nov.facturado, 0);
  assert.equal(r.serie[0].facturado, null, 'mes sin propuestas: sin punto de facturado');
  assert.equal(Math.round(r.conversion), 60);
});

test('Revisar · todos los precios de lista de la línea con Δ % contra el precio actual', () => {
  const precios = { 'Mayoreo AAA': 1000, 'Distribuidor': 1100, 'E-commerce': 900, Vacía: 0 };
  const o = prop.preciosDeLinea(precios, { precio: 1000, listaSel: 'Mayoreo AAA' });
  assert.deepEqual(o.map((x) => x.lista), ['Distribuidor', 'Mayoreo AAA', 'E-commerce'], 'de mayor a menor, sin listas en 0');
  assert.equal(Math.round(o[0].delta), 10); assert.equal(o[1].delta, null); assert.equal(Math.round(o[2].delta), -10);
  assert.deepEqual(o.map((x) => x.elegida), [false, true, false]);
  assert.equal(prop.preciosDeLinea(precios, { precio: 0 })[0].delta, null, 'línea sin precio: sin Δ');
  assert.deepEqual(prop.preciosDeLinea(undefined), []);

  const html = render(PreciosLinea, { r: { sku: 'AC-935777', precios, precio: 1000, listaSel: 'Mayoreo AAA' } });
  assert.match(html, /Precios de lista de AC-935777/); assert.match(html, /Distribuidor/); assert.match(html, /\+10\.0 % vs actual/);
  assert.match(html, /−10\.0 % vs actual/); assert.match(html, /Elegida/); assert.match(html, /precio actual/);
  assert.equal((html.match(/<button/g) || []).length, 3, 'cada lista es un botón (sirve con dedo)');
  assert.ok(!/costo|margen/i.test(html), 'los precios de lista no enseñan costo ni margen');
  sano(html, 'PreciosLinea');
  const sin = render(PreciosLinea, { r: { sku: 'AC-1', precios: {}, precio: 500, listaSel: '__custom' } });
  assert.match(sin, /no tiene precio en las listas/); assert.match(sin, /personalizado/);
});
