// Sell Out y Sell In de la empresa en el celular (3.80.0 · 2026-10-05): SSR de las vistas puras con datos de ejemplo
// (sin red) + cálculo puro (mes en curso vacío → último mes con sell out; sell in con cuota y prorrateo a mismo día;
// tabla por SKU × 12 meses con Δ y orden; buscador con chips y quitarChip) + rutas.
//   node --test scripts/test-sellout-sellin-movil-ssr.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
const { NavContext } = await vite.ssrLoadModule('/src/movil/nav.jsx');
const { SellOutVista } = await vite.ssrLoadModule('/src/movil/pestanas/selloutGlobal/SellOutGlobal.jsx');
const { SellInVista } = await vite.ssrLoadModule('/src/movil/pestanas/sellin/SellInGlobal.jsx');
const so = await vite.ssrLoadModule('/src/movil/pestanas/selloutGlobal/calculo.js');
const si = await vite.ssrLoadModule('/src/movil/pestanas/sellin/calculo.js');
const { filasSkuAnual, columnasVentana, categoriasDe } = await vite.ssrLoadModule('/src/movil/pestanas/sellout/skuAnual.js');
const TablaAnualMod = await vite.ssrLoadModule('/src/movil/pestanas/sellout/TablaAnual.jsx');
const DetalleMod = await vite.ssrLoadModule('/src/movil/pestanas/sellout/DetalleSkuAnual.jsx');
const { interpretarBusqueda, quitarChip } = await vite.ssrLoadModule('/src/lib/buscarSku.js');
const { destino } = await vite.ssrLoadModule('/src/movil/rutas.js');
const datosSo = await vite.ssrLoadModule('/src/modules/comercial/sellout/datos.js');
const datosSi = await vite.ssrLoadModule('/src/movil/pestanas/sellin/datos.js');

const qc = new QueryClient();
const nav = { modo: 'barra', perfil: { user_id: 'u-f', es_super_admin: true }, push() {}, pop() {}, navegar() {}, agregarSku() {} };
const render = (C, props, themeKey = 'midnight') => renderToString(React.createElement(QueryClientProvider, { client: qc },
  React.createElement(ThemeContext.Provider, { value: { theme: getTheme(themeKey), setThemeKey() {} } },
    React.createElement(NavContext.Provider, { value: nav }, React.createElement(C, props))))).replace(/<!--.*?-->/g, '');
const sano = (s, donde) => { assert.ok(!/NaN|undefined|\[object Object\]/.test(s), `${donde}: NaN/undefined/[object Object] en el HTML`); };

const HOY = new Date(2026, 9, 9, 12); // 9 oct 2026: octubre todavía sin sell out
const ANIO = 2026;

// ── Sell Out · cuentas, mensual (2 años), días y sku × año ──
const CUENTAS = [
  { cuenta: 'cva', fuente: 'GRUPO CVA', nombre: 'Grupo CVA', canal_sellout: 'mayoreo', erp_cliente: '00417', propio: false, granularidad: 'dia', tiene_sellout: true },
  { cuenta: 'ct', fuente: 'CT', nombre: 'CT Internacional', canal_sellout: 'mayoreo', erp_cliente: '00183', propio: false, granularidad: 'dia', tiene_sellout: true },
  { cuenta: 'digitalife', fuente: 'DIGITALIFE', nombre: 'Digitalife', canal_sellout: 'distribuidor', erp_cliente: '00764', propio: true, granularidad: 'dia', tiene_sellout: true },
  { cuenta: 'ingram_retail', fuente: null, nombre: 'Ingram retail', canal_sellout: 'mayoreo', erp_cliente: '04126', propio: false, granularidad: 'dia', tiene_sellout: false },
];
const MENSUAL = [], DIAS = [];
const mesFila = (cuenta, anio, mes, importe, extra = {}) => ({ cuenta, nombre: CUENTAS.find((c) => c.cuenta === cuenta).nombre, canal_sellout: CUENTAS.find((c) => c.cuenta === cuenta).canal_sellout, anio, mes, importe, cantidad: importe / 1000, sell_in: importe / 1.9, sell_in_piezas: importe / 2000, ...extra });
for (const [cuenta, base] of [['cva', 20e6], ['ct', 30e6], ['digitalife', 6e6]]) {
  for (let m = 1; m <= 12; m += 1) { MENSUAL.push(mesFila(cuenta, 2025, m, base * 0.6)); for (let d = 1; d <= 28; d += 1) DIAS.push({ cuenta, anio: 2025, mes: m, dia: d, importe: (base * 0.6) / 28, cantidad: 1 }); }
  for (let m = 1; m <= 9; m += 1) { MENSUAL.push(mesFila(cuenta, 2026, m, base, { inv_valor: base * 0.6, inv_piezas: base / 1000 * 2, inv_skus: 100 })); for (let d = 1; d <= 28; d += 1) DIAS.push({ cuenta, anio: 2026, mes: m, dia: d, importe: base / 28, cantidad: 1 }); }
}
for (let m = 1; m <= 9; m += 1) MENSUAL.push({ cuenta: 'ingram_retail', nombre: 'Ingram retail', canal_sellout: 'mayoreo', anio: 2026, mes: m, importe: 0, cantidad: 0, sell_in: 5e6 });
const arr = (f) => Array.from({ length: 12 }, (_, i) => f(i + 1));
const SKU_ANIO = [
  { sku: 'AC-943154', anio: 2026, marca: 'ACTECK', categoria: 'Monitores', monto: arr((m) => (m <= 9 ? 400000 + m * 10000 : null)), piezas: arr((m) => (m <= 9 ? 300 : null)) },
  { sku: 'AC-943154', anio: 2025, marca: 'ACTECK', categoria: 'Monitores', monto: arr(() => 300000), piezas: arr(() => 250) },
  { sku: 'BR-937658', anio: 2026, marca: 'BALAM RUSH', categoria: 'Fuentes de poder', monto: arr((m) => (m <= 9 ? 250000 : null)), piezas: arr((m) => (m <= 9 ? 180 : null)) },
  { sku: 'BR-937658', anio: 2025, marca: 'BALAM RUSH', categoria: 'Fuentes de poder', monto: arr(() => 260000), piezas: arr(() => 190) },
  { sku: 'AC-929042', anio: 2026, marca: 'ACTECK', categoria: 'Gabinetes', monto: arr((m) => (m <= 9 ? 90000 : null)), piezas: arr((m) => (m <= 9 ? 120 : null)) },
];
const ROADMAP = [
  { sku: 'AC-943154', descripcion: 'Monitor Plano 27 VA Captive Vivid SP270 II', marca: 'Acteck', categoria: 'Monitores' },
  { sku: 'BR-937658', descripcion: 'Fuente de Poder GR Burst 650W', marca: 'Balam Rush', categoria: 'Fuentes de poder' },
  { sku: 'AC-929042', descripcion: 'Gabinete Atom Slim', marca: 'Acteck', categoria: 'Gabinetes' },
  { sku: 'AC-900001', descripcion: 'Teclado sin movimiento', marca: 'Acteck', categoria: 'Periféricos' },
];

test('sell out · octubre sin sell out → usa septiembre y lo dice; cifras del motor de la web', () => {
  const r = so.resumenSellOut({ cuentas: CUENTAS, mensual: MENSUAL, dias: DIAS, skuAnio: SKU_ANIO, roadmap: ROADMAP, anio: ANIO, mes: 10, modo: 'mes', hoy: HOY });
  assert.equal(r.mes, 9); assert.equal(r.anio, 2026); assert.equal(r.esOtroMes, true);
  assert.equal(Math.round(r.importe), 56e6, 'sell out de septiembre = CVA + CT + Digitalife');
  assert.ok(r.yoy > 60 && r.yoy < 70, `YoY a mismo día ≈ +67 % (${r.yoy})`);
  assert.equal(r.cuentasConSellOut, 3); assert.equal(r.cuentasConFuente, 3, 'Ingram retail no cuenta: sin fuente');
  assert.ok(r.soSi > 185 && r.soSi < 195, `SO/SI ≈ 190 % sin el sell in de Ingram retail (${r.soSi})`);
  assert.equal(r.inv.cuentas, 3); assert.ok(r.inv.semanas > 0);
  assert.equal(r.skus.activos, 3); assert.equal(r.skus.roadmap, 4); assert.equal(r.skus.sinMovimiento, 1);
  assert.match(r.frase, /^El canal desplazó \$56\.0 M en septiembre, 67 % arriba de sep 25; SO\/SI 1\.9\d y \d+ semanas de inventario en cuentas\.$/);
  assert.match(r.reparto, /^CT Internacional 54 % · Grupo CVA 36 % · Digitalife 11 %$/);
  assert.equal(r.serie.length, 12); assert.equal(r.serie[9].cur, null, 'octubre sin dato = null, no $0'); assert.equal(r.serie[8].cur, 56e6);
  assert.equal(r.mixes.canal[0].label, 'Mayoreo'); assert.equal(r.mixes.marca[0].label, 'Acteck'); assert.equal(r.mixes.categoria[0].label, 'Monitores');
  assert.equal(r.tabla.length, 3); assert.equal(r.tabla[0].sku, 'AC-943154'); assert.equal(r.columnas[0], 'Oct 25'); assert.equal(r.columnas[11], 'Sep 26');
});

test('sell out · YTD a septiembre y un mes con sell out no se mueve', () => {
  const r = so.resumenSellOut({ cuentas: CUENTAS, mensual: MENSUAL, dias: DIAS, skuAnio: SKU_ANIO, roadmap: ROADMAP, anio: ANIO, mes: 9, modo: 'ytd', hoy: HOY });
  assert.equal(r.esOtroMes, false); assert.equal(Math.round(r.importe / 1e6), 504, 'YTD = 9 × 56 M');
  assert.equal(r.mixes.canal.length, 2);
  const v = so.mesUsado(MENSUAL, 2024, 3); assert.equal(v.vacio, true, 'sin nada antes → vacío, no se inventa');
});

test('sell out · la vista pura renderiza sin NaN (Mes y YTD)', () => {
  for (const modo of ['mes', 'ytd']) {
    const r = so.resumenSellOut({ cuentas: CUENTAS, mensual: MENSUAL, dias: DIAS, skuAnio: SKU_ANIO, roadmap: ROADMAP, anio: ANIO, mes: 10, modo, hoy: HOY });
    const html = render(SellOutVista, { r, categorias: categoriasDe(ROADMAP), onSku() {} });
    sano(html, `SellOutVista ${modo}`);
    assert.ok(html.includes('último con sell out'), 'avisa que usa el último mes con sell out');
    assert.ok(html.includes('SO / SI') && html.includes('Inventario en cuentas') && html.includes('SKUs activos'));
    assert.ok(html.includes('AC-943154') && html.includes('Monitor Plano 27'), 'la tabla trae el SKU y su descripción');
    assert.ok(html.includes('Oct 25') && html.includes('Sep 26'), 'columnas de la ventana de 12 meses');
    assert.ok(!html.includes('Grupo CVA</'), 'sin tabla de cuentas');
  }
});

// ── Sell In · medidas, cuotas, dimensiones, clientes, sku × año ──
const MEDIDAS = [];
for (const a of [2025, 2026]) for (let m = 1; m <= (a === 2026 ? 10 : 12); m += 1) {
  const fn = a === 2026 ? (m === 10 ? 12e6 : 46e6) : 60e6;
  MEDIDAS.push({ anio: a, mes: m, fact_bruta: fn * 1.05, devoluciones: -fn * 0.05, rmas: 0, bonificaciones: -fn * 0.07, fact_neta: fn, venta_neta: fn * 0.93, costo_venta_neta: fn * 0.75, contribucion: fn * 0.19, utilidad_comercial: fn * 0.12, piezas_venta_neta: fn / 500 });
}
const CUOTA_MENSUAL = Array.from({ length: 12 }, (_, i) => ({ anio: 2026, mes: i + 1, cuota_min: 55e6, cuota_ideal: 64e6 }));
const DIM = [];
for (const a of [2025, 2026]) for (let m = 1; m <= (a === 2026 ? 10 : 12); m += 1) {
  DIM.push({ anio: a, mes: m, dimension: 'canal', valor: 'MAYOREO', venta: 30e6, piezas: 1 }, { anio: a, mes: m, dimension: 'canal', valor: 'DISTRIBUIDOR', venta: 10e6, piezas: 1 },
    { anio: a, mes: m, dimension: 'marca', valor: 'Acteck', venta: 35e6, piezas: 1 }, { anio: a, mes: m, dimension: 'categoria', valor: 'Monitores', venta: 20e6, piezas: 1 });
}
const CLIENTES = [];
for (const c of ['00417', '00183', '00764', '00999']) for (const a of [2025, 2026]) for (let m = 1; m <= (a === 2026 ? 10 : 12); m += 1) {
  if (c === '00999' && (a === 2025 || m < 9)) continue; // nuevo en septiembre 2026
  if (c === '00764' && a === 2026 && m === 10) continue; // Digitalife no compró en octubre
  CLIENTES.push({ cliente: c, anio: a, mes: m, fact_neta: 1e6 });
}
const SKU_SI = SKU_ANIO.map((r) => ({ sku: r.sku, anio: r.anio, monto: r.monto, piezas: r.piezas }));
const D_SI = { medidas: MEDIDAS, cuotaCanales: [], cuotaMensual: CUOTA_MENSUAL, dimMes: DIM, clientesMes: CLIENTES, skuAnio: SKU_SI, roadmap: ROADMAP };

test('sell in · septiembre cerrado: cuota, margen, YoY, clientes', () => {
  const r = si.resumenSellIn(D_SI, { anio: ANIO, mes: 9, modo: 'mes', hoy: HOY, sensible: true });
  assert.equal(r.enCurso, false);
  assert.equal(Math.round(r.pctCuota), 72, '46 M de 64 M');
  assert.ok(Math.abs(r.cur.mc - 19) < 0.01, 'MC se recalcula al agregar');
  assert.ok(Math.abs(r.yoy + 23.3) < 0.1, `−23 % vs sep 2025 (${r.yoy})`);
  assert.equal(r.frase, 'Septiembre cerró al 72 % de cuota con margen del 19.0 %, 23 % abajo de sep 2025.');
  assert.equal(r.clientes.conCompra, 4); assert.equal(r.clientes.activosAnio, 4); assert.equal(r.clientes.nuevos, 1);
  assert.equal(Math.round(r.otro.fact_neta / 1e6), 414, 'KPI 2 = YTD');
  assert.equal(r.mixes.canal[0].label, 'Mayoreo'); assert.equal(r.serie[9].fn, 12e6); assert.equal(r.serie[10].fn, null);
  const sin = si.resumenSellIn(D_SI, { anio: ANIO, mes: 9, modo: 'mes', hoy: HOY, sensible: false });
  assert.ok(!/margen/.test(sin.frase), 'sin permiso sensible la frase no trae margen');
});

test('sell in · octubre en curso se prorratea a mismo día y YTD compara meses completos', () => {
  const r = si.resumenSellIn(D_SI, { anio: ANIO, mes: 10, modo: 'mes', hoy: HOY, sensible: true });
  assert.equal(r.enCurso, true);
  // 12 M vs 60 M × 9/31 = 17.4 M → −31 %
  assert.ok(Math.abs(r.yoy + 31.1) < 0.2, `YoY a mismo día (${r.yoy})`);
  assert.match(r.frase, /^Octubre va al 19 % de cuota con margen del 19\.0 %, 31 % abajo de oct 2025 a mismo día\.$/);
  assert.equal(r.clientes.conCompra, 3, 'Digitalife no compró en octubre');
  const y = si.resumenSellIn(D_SI, { anio: ANIO, mes: 10, modo: 'ytd', hoy: HOY, sensible: true });
  assert.equal(Math.round(y.cur.fact_neta / 1e6), 426); assert.equal(Math.round(y.pctCuota), 67, '426 de 640');
});

test('sell in · la vista pura renderiza con y sin permiso sensible', () => {
  const r = si.resumenSellIn(D_SI, { anio: ANIO, mes: 9, modo: 'mes', hoy: HOY, sensible: true });
  const html = render(SellInVista, { r, sensible: true, categorias: categoriasDe(ROADMAP), onSku() {} });
  sano(html, 'SellInVista');
  assert.ok(html.includes('Margen MC') && html.includes('Clientes con compra') && html.includes('72% cuota'));
  assert.ok(html.includes('stroke-dasharray'), 'la cuota va punteada en la gráfica');
  const html2 = render(SellInVista, { r: si.resumenSellIn(D_SI, { anio: ANIO, mes: 9, modo: 'mes', hoy: HOY, sensible: false }), sensible: false, categorias: [], onSku() {} });
  sano(html2, 'SellInVista sin sensible');
  assert.ok(!html2.includes('Margen MC') && html2.includes('Piezas · sep'), 'sin sensible la tarjeta de margen es de piezas');
});

// ── Tabla SKU × 12 meses: ventana, Δ, orden ──
test('filasSkuAnual · ventana de 12 meses que cruza de año, Δ vs los mismos 12 del año anterior', () => {
  const filas = filasSkuAnual({ rows: SKU_ANIO, anio: 2026, mes: 9, roadmap: ROADMAP });
  const mon = filas.find((f) => f.sku === 'AC-943154');
  assert.equal(mon.monto.length, 12); assert.equal(mon.monto[0], 300000, 'oct 2025'); assert.equal(mon.monto[11], 490000, 'sep 2026');
  assert.equal(mon.montoPrev[11], 300000, 'sep 2025'); assert.equal(mon.montoPrev[0], 0, 'oct 2024 no cargado → 0');
  assert.equal(mon.descripcion, 'Monitor Plano 27 VA Captive Vivid SP270 II'); assert.equal(mon.marca, 'Acteck');
  assert.deepEqual(columnasVentana(2026, 12), ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']);
  const sinPrev = filas.find((f) => f.sku === 'AC-929042'); assert.equal(sinPrev.montoPrev, null, 'sin año anterior → sin Δ');
});

test('TablaAnual · ordenarFilas por mes, Total y Δ (los «—» al final) y la vista con Δ', () => {
  const { ordenarFilas, deltaFila } = TablaAnualMod;
  const filas = [
    { label: 'A', valores: [1, 9, 0], prev: [1, 1, 1] },
    { label: 'B', valores: [5, 2, 0], prev: null },
    { label: 'C', valores: [3, 3, 3], prev: [9, 9, 9] },
  ];
  assert.deepEqual(ordenarFilas(filas, { col: 'total', dir: 'desc' }).map((f) => f.label), ['A', 'C', 'B']);
  assert.deepEqual(ordenarFilas(filas, { col: 'total', dir: 'asc' }).map((f) => f.label), ['B', 'C', 'A']);
  assert.deepEqual(ordenarFilas(filas, { col: 0, dir: 'desc' }).map((f) => f.label), ['B', 'C', 'A']);
  assert.deepEqual(ordenarFilas(filas, { col: 'delta', dir: 'desc' }).map((f) => f.label), ['A', 'C', 'B'], 'B sin prev va al final');
  assert.equal(Math.round(deltaFila(filas[0])), 233); assert.equal(deltaFila(filas[1]), null);
  const html = render(TablaAnualMod.default, { columnas: ['Ene', 'Feb', 'Mar'], filas, ordenable: true, conDelta: true, ordenInicial: { col: 'total', dir: 'desc' } });
  sano(html, 'TablaAnual');
  assert.ok(html.includes('Total ▾'), 'flecha en el encabezado activo');
  assert.ok(html.includes('+233%') && html.includes('−67%') === false && html.includes('-67%'), 'Δ por fila');
  const viejo = render(TablaAnualMod.default, { columnas: ['Ene', 'Feb', 'Mar'], filas: [{ label: '2026', valores: [1, 2, 3] }] });
  assert.ok(!viejo.includes('Δ') && viejo.includes('Prom'), 'sin las props nuevas la tabla es la de siempre');
});

test('DetalleSkuAnual · buscador con chips y quitarChip', () => {
  const cats = categoriasDe(ROADMAP);
  const i = interpretarBusqueda('acteck monitores 27 pulgadas', { categorias: cats });
  assert.deepEqual(i.chips.map((c) => c.tipo), ['marca', 'categoria', 'pulgadas']);
  assert.equal(quitarChip('acteck monitores 27 pulgadas', i.chips[1], { categorias: cats }), 'acteck 27 pulgadas');
  assert.equal(quitarChip('acteck monitores 27 pulgadas', i.chips[2], { categorias: cats }), 'acteck monitores', 'quita las dos palabras del chip');
  assert.equal(quitarChip('balam rush fuente', interpretarBusqueda('balam rush fuente', { categorias: cats }).chips[0], { categorias: cats }), 'fuente');
  assert.equal(quitarChip('27 pulgadas', interpretarBusqueda('27 pulgadas', { categorias: cats }).chips[0], { categorias: cats }), '');
  const filas = filasSkuAnual({ rows: SKU_ANIO, anio: 2026, mes: 9, roadmap: ROADMAP });
  const html = render(DetalleMod.default, { filas, columnas: columnasVentana(2026, 9), categorias: cats, onSku() {} });
  sano(html, 'DetalleSkuAnual');
  assert.ok(html.includes('Piezas') && html.includes('3 SKUs') && html.includes('Δ'));
  const chips = render(DetalleMod.ChipsEntendido, { chips: i.chips });
  assert.ok(chips.includes('Marca Acteck') && chips.includes('Categoría Monitores') && chips.includes('27&quot;'));
});

test('hooks y rutas', () => {
  assert.equal(typeof datosSo.useSkuAnio, 'function');
  assert.equal(typeof datosSi.useSellInEmpresa, 'function');
  assert.equal(destino({ pagina: 'sellOut' }).tipo, 'push');
  assert.equal(destino({ pagina: 'sellIn' }).tipo, 'push');
});
