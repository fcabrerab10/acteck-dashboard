// Inventario de la empresa en el celular (3.81.0 · 2026-10-05): SSR de la vista pura con datos de ejemplo (sin red)
// + cálculo puro (cambio contra el cierre del mes pasado, qué llega este mes / en total, demanda desde el pivote,
// serie de 12 meses con días de inventario, mixes, frase, tabla de stock al cierre) + rutas.
//   node --test scripts/test-inventario-movil-ssr.mjs
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
const { InventarioMVista } = await vite.ssrLoadModule('/src/movil/pestanas/inventario/InventarioM.jsx');
const calc = await vite.ssrLoadModule('/src/movil/pestanas/inventario/calculo.js');
const { mapaTransito } = await vite.ssrLoadModule('/src/movil/pestanas/inventario/datos.js');
const { agregarSkus, resumenInventario } = await vite.ssrLoadModule('/src/modules/comercial/inventario/agregar.js');
const { agruparPorPO } = await vite.ssrLoadModule('/src/modules/comercial/inventario/arribos.js');
const { inventarioDesdeVista } = await vite.ssrLoadModule('/src/lib/medidas.js');
const { categoriasDe } = await vite.ssrLoadModule('/src/movil/pestanas/sellout/skuAnual.js');
const { destino } = await vite.ssrLoadModule('/src/movil/rutas.js');

const qc = new QueryClient();
const nav = { modo: 'barra', perfil: { user_id: 'u-f', es_super_admin: true }, push() {}, pop() {}, navegar() {}, agregarSku() {} };
const render = (C, props, themeKey = 'midnight') => renderToString(React.createElement(QueryClientProvider, { client: qc },
  React.createElement(ThemeContext.Provider, { value: { theme: getTheme(themeKey), setThemeKey() {} } },
    React.createElement(NavContext.Provider, { value: nav }, React.createElement(C, props))))).replace(/<!--.*?-->/g, '');
const sano = (s, donde) => { assert.ok(!/NaN|undefined|\[object Object\]/.test(s), `${donde}: NaN/undefined/[object Object] en el HTML`); };

const HOY = new Date(2026, 9, 5, 12); // 5 oct 2026: los primeros días del mes comparan contra el cierre de septiembre
const arr = (f) => Array.from({ length: 12 }, (_, i) => f(i + 1));

// ── datos de ejemplo con la forma de las vistas ──
const FILAS = [ // v_inventario_almacen_medida (en_inv_actual = true)
  { articulo: 'AC-943178', no_almacen: 1, almacen_nombre: 'Central GDL', cedis: 'ALMACENES GUADALAJARA', disponible: 900, inventario: 1000, costopromedio: 120, costodisponible: 108000, costoinventario: 120000 },
  { articulo: 'AC-943178', no_almacen: 3, almacen_nombre: 'Tultitlán CDMX', cedis: 'ALMACENES MEXICO', disponible: 200, inventario: 200, costopromedio: 120, costodisponible: 24000, costoinventario: 24000 },
  { articulo: 'AC-943253', no_almacen: 1, almacen_nombre: 'Central GDL', cedis: 'ALMACENES GUADALAJARA', disponible: 0, inventario: 0, costopromedio: 300, costodisponible: 0, costoinventario: 0 },
  { articulo: 'BR-930012', no_almacen: 1, almacen_nombre: 'Central GDL', cedis: 'ALMACENES GUADALAJARA', disponible: 5000, inventario: 5000, costopromedio: 50, costodisponible: 250000, costoinventario: 250000 },
  { articulo: 'AV-100001', no_almacen: 71, almacen_nombre: 'E-commerce Tultitlán', cedis: null, disponible: 10, inventario: 10, costopromedio: 400, costodisponible: 4000, costoinventario: 4000 },
];
const ROADMAP = [
  { sku: 'AC-943178', descripcion: 'Mouse inalámbrico', marca: 'ACTECK', categoria: 'Periféricos' },
  { sku: 'AC-943253', descripcion: 'Bocina portátil', marca: 'Acteck', categoria: 'Audio' },
  { sku: 'BR-930012', descripcion: 'Teclado gamer', marca: 'BALAM RUSH', categoria: 'Periféricos' },
];
const roadmapMap = new Map(ROADMAP.map((x) => [x.sku, { descripcion: x.descripcion, marca: x.marca, familia: '', rdmp: '', categoria: x.categoria }]));
const TRANSITO_ROWS = [ // v_transito_sku
  { sku: 'AC-943253', supplier: 'SHENZHEN X', cantidad: 2000, eta_mas_cercana: '2026-10-21', embarques_detalle: [{ po: '7712', estatus: 'TRANSITO MARITIMO', cantidad: 2000, eta: '2026-10-21', etd: '2026-09-20', cedis: 'GDL', contenedor: 'MSKU1' }] },
  { sku: 'AV-200002', supplier: 'OTRO', cantidad: 500, eta_mas_cercana: '2026-11-06', embarques_detalle: [{ po: 'ABT278', estatus: 'EN PRODUCCION', cantidad: 500, eta: '2026-11-06', etd: null, cedis: 'MEX', contenedor: '' }] },
  { sku: 'AC-943178', supplier: 'SHENZHEN X', cantidad: 300, eta_mas_cercana: '2026-10-28', embarques_detalle: [{ po: '7730', estatus: 'PROXIMO A ZARPAR', cantidad: 300, eta: '2026-10-28', etd: '2026-10-10', cedis: 'GDL', contenedor: '' }] },
];
const DEMANDA_ROWS = [ // v_sellin_global_sku_anio: piezas por mes; cerrados = jul, ago, sep 2026
  { sku: 'AC-943178', anio: 2026, piezas: arr((m) => (m <= 9 ? 600 : null)) },
  { sku: 'AC-943253', anio: 2026, piezas: arr((m) => (m === 7 ? 300 : m === 8 ? 300 : m === 9 ? 300 : 0)) },
  { sku: 'BR-930012', anio: 2026, piezas: arr(() => 100) },
  { sku: 'AC-943178', anio: 2025, piezas: arr(() => 9999) }, // año fuera de los cerrados: no cuenta
];
const MESES = [ // v_inventario_cv_mes: sólo sep y oct 2026 con foto (como hoy en producción)
  ...arr((m) => ({ anio: 2025, mes: m, inv_cierre_mes: null, inv_cierre_mes_piezas: null, cv_ultimos_3_meses: 90000, costo_venta_neta: 30000, piezas_venta_neta: 300 })),
  ...arr((m) => ({ anio: 2026, mes: m, inv_cierre_mes: m === 9 ? 420000 : m === 10 ? 398800 : null, inv_cierre_mes_piezas: m === 9 ? 6500 : m === 10 ? 6210 : null, fecha_cierre: m === 9 ? '2026-09-30' : m === 10 ? '2026-10-05' : null, cv_ultimos_3_meses: 90000, costo_venta_neta: 30000, piezas_venta_neta: 300 })),
];
const SKU_ANIO = [ // v_inventario_sku_anio
  { sku: 'AC-943178', anio: 2026, piezas: arr((m) => (m === 9 ? 1300 : m === 10 ? 1200 : null)), valor: arr((m) => (m === 9 ? 156000 : m === 10 ? 144000 : null)) },
  { sku: 'BR-930012', anio: 2026, piezas: arr((m) => (m === 9 ? 5100 : m === 10 ? 5000 : null)), valor: arr((m) => (m === 9 ? 255000 : m === 10 ? 250000 : null)) },
  { sku: 'AV-100001', anio: 2026, piezas: arr((m) => (m === 10 ? 10 : null)), valor: arr((m) => (m === 10 ? 4000 : null)) },
];
const PRECIOS = new Map([['ABT278|AV-200002', 12]]); // USD; el SKU no existe en inventario → unit_price × TC
const MEDIDAS_ROW = { inv_actual: 398800, inv_actual_piezas: 6210, inv_actual_disponible: 6110, dias_inv: 398.8, cv_ultimos_3_meses: 90000, skus_con_stock: 4, costo_promedio: 64.2, vueltas_inv: 2.01, ytd_costo_venta: 279000, inv_promedio: 139000, costo_compra_tc17: 170000, compra_usd_pendiente: 10000 };

const cerrados = calc.mesesCerradosDe(HOY);
const demanda = calc.demandaDesdePivot(DEMANDA_ROWS, cerrados);
const transito = mapaTransito(TRANSITO_ROWS);
const skuRows = agregarSkus(FILAS, { descripciones: roadmapMap, transito, leadTime: new Map(), demanda });
const medidas = inventarioDesdeVista(MEDIDAS_ROW);
const res = resumenInventario(skuRows, medidas);
const porSku = new Map(skuRows.map((x) => [x.sku, x]));
const pos = agruparPorPO({ transito, porSku, descripciones: roadmapMap, hoy: HOY });
const armar = (sensible) => calc.resumenInventarioM({ res, medidas, meses: MESES, pos, porSku, precios: PRECIOS, filas: FILAS, roadmapMap, skuAnio: SKU_ANIO, roadmap: ROADMAP, skuRows, hoy: HOY, sensible });
const R = armar(true);

test('demanda desde el pivote: promedio de los 3 meses cerrados, sólo del año que toca', () => {
  assert.deepEqual(cerrados.map((c) => `${c.anio}-${c.mes}`), ['2026-9', '2026-8', '2026-7']);
  assert.equal(demanda.get('AC-943178'), 600);
  assert.equal(demanda.get('AC-943253'), 300);
  assert.equal(demanda.get('BR-930012'), 100);
  assert.ok(skuRows.find((r) => r.sku === 'AC-943253').agotado, 'sin stock y con demanda → agotado');
  assert.equal(res.agotados, 1);
});

test('cambio contra el mes pasado: Inv Actual hoy vs cierre de septiembre (no vs 5 días)', () => {
  const c = calc.cambioMesPasado({ medidas, meses: MESES, hoy: HOY, sensible: true });
  assert.equal(c.valor, 398800 - 420000);
  assert.equal(Math.round(c.pct * 10) / 10, -5);
  assert.equal(c.mesLabel, 'Sep');
  assert.equal(c.fechaCierre, '2026-09-30');
  const pz = calc.cambioMesPasado({ medidas, meses: MESES, hoy: HOY, sensible: false });
  assert.equal(pz.valor, 6210 - 6500);
  // Sin cierre del mes anterior → null, no 0.
  const sin = calc.cambioMesPasado({ medidas, meses: MESES.filter((m) => !(m.anio === 2026 && m.mes === 9)), hoy: HOY, sensible: true });
  assert.equal(sin.valor, null); assert.equal(sin.pct, null);
  // En enero el mes anterior es diciembre del año pasado.
  assert.deepEqual(calc.mesAnterior(2026, 1), { anio: 2025, mes: 12 });
});

test('llega este mes / viene en total: ETA en octubre vs todo el tránsito, $ a costo del SKU o unit_price × TC', () => {
  const l = R.llega;
  assert.equal(l.mesLabel, 'octubre');
  assert.equal(l.mes.pos, 2, '7712 (21 oct) y 7730 (28 oct)');
  assert.equal(l.mes.piezas, 2300);
  assert.equal(l.mes.valor, 2000 * 300 + 300 * 120, 'AC-943253 al costo de referencia 300 · AC-943178 a 120');
  assert.equal(l.total.pos, 3);
  assert.equal(l.total.piezas, 2800);
  assert.equal(calc.tcDe(medidas), 17, 'TC deducido de costo_compra_tc17 / compra_usd_pendiente');
  assert.equal(l.total.valor, l.mes.valor + 500 * 12 * 17, 'AV-200002 no existe en inventario → unit_price USD × 17');
  assert.equal(l.total.sinPrecio, 0);
  assert.equal(l.mes.proximaEta, '2026-10-21');
  const vacio = calc.llegadas({ pos: [], hoy: HOY });
  assert.equal(vacio.total.piezas, 0); assert.equal(vacio.mes.pos, 0);
});

test('serie de 12 meses: inventario al cierre vs venta promedio 3 m, días = inv / CV3 × 90; en piezas sin permiso', () => {
  const s = R.serie;
  assert.equal(s.length, 12);
  assert.equal(s[11].label, 'Oct'); assert.equal(s[0].label, 'Nov');
  assert.equal(s[11].inv, 398800);
  assert.equal(s[11].cv, 30000, 'CV 3 meses / 3');
  assert.equal(Math.round(s[11].dias), Math.round((398800 / 90000) * 90));
  assert.equal(s[10].inv, 420000);
  assert.equal(s[9].inv, null, 'agosto sin foto → la línea se corta, no 0');
  const pz = armar(false).serie;
  assert.equal(pz[11].inv, 6210);
  assert.equal(pz[11].cv, 300, 'piezas vendidas promedio de los 3 meses anteriores');
});

test('mixes del inventario actual por categoría · marca · almacén (sensible en $, si no en pz)', () => {
  const m = R.mixes;
  assert.deepEqual(m.categoria.map((x) => x.label), ['Periféricos', 'Sin categoría']);
  assert.equal(m.categoria[0].v, 144000 + 250000);
  assert.equal(m.marca.find((x) => x.label === 'Audive').v, 4000, 'AV- sin roadmap → marca por prefijo');
  assert.equal(m.marca.find((x) => x.label === 'Balam Rush').v, 250000);
  assert.deepEqual(m.almacen.map((x) => x.label), ['Central GDL', 'Tultitlán CDMX', 'E-commerce Tultitlán']);
  const pz = armar(false).mixes;
  assert.equal(pz.categoria[0].v, 1200 + 5000);
});

test('frase del hero con y sin permiso sensible', () => {
  assert.equal(R.frase, '$399K en piso, 399 días al ritmo de los 3 meses cerrados; 1 SKU agotado con demanda y $636K llegan en octubre.');
  const f = armar(false).frase;
  assert.match(f, /^6,210 pz en piso, 399 días al ritmo de los 3 meses cerrados; 1 SKU agotado con demanda y 2,300 pz llegan en octubre\.$/);
  assert.ok(!/\$/.test(f));
  // Sin nada en camino ni agotados.
  assert.equal(calc.fraseInventario({ res: { valor: 1e6, piezas: 10, diasInv: null, agotados: 0 }, llega: calc.llegadas({ pos: [], hoy: HOY }), sensible: true }), '$1.0M en piso.');
});

test('tabla de stock al cierre: una fila por SKU con la ventana de 12 meses, ordenada por el último mes con foto', () => {
  const t = R.tabla;
  assert.deepEqual(t.map((f) => f.sku), ['BR-930012', 'AC-943178', 'AV-100001']);
  assert.equal(t[1].descripcion, 'Mouse inalámbrico');
  assert.equal(t[1].monto[11], 144000); assert.equal(t[1].monto[10], 156000); assert.equal(t[1].monto[9], 0);
  assert.equal(t[1].piezas[11], 1200);
  assert.equal(t[1].montoPrev, null, 'sin 2025 no hay Δ');
  assert.equal(calc.filasStockAnual({ rows: [], hoy: HOY }).length, 0);
});

test('InventarioMVista renderiza hero, 4 KPIs, gráfica, pay, tabla y agotados (sensible)', () => {
  const s = render(InventarioMVista, { r: R, categorias: categoriasDe(ROADMAP), onSku() {}, onSop() {} });
  sano(s, 'InventarioMVista sensible');
  assert.match(s, /\$399K en piso/);
  assert.match(s, /costo promedio \$64/);
  assert.match(s, /Valor del inventario actual/);
  assert.match(s, /Cambio contra el mes pasado/); assert.match(s, /-\$21K/); assert.match(s, /-5%<\/span> vs cierre de sep/);
  assert.match(s, /Llega en octubre/); assert.match(s, /\$636K/); assert.match(s, /en total \$738K \(3 PO\)/);
  assert.match(s, /Vueltas de inventario del año/); assert.match(s, /2\.0×/);
  assert.match(s, /Inventario al cierre de mes/); assert.match(s, /Venta promedio 3 m/);
  assert.match(s, /Mix del inventario actual/); assert.match(s, /Periféricos/);
  assert.match(s, /Stock al cierre por SKU/); assert.match(s, /BR-930012/); assert.match(s, /Teclado gamer/);
  assert.match(s, /Agotados con demanda/); assert.match(s, /Ver en S&amp;OP/);
  assert.ok(!/Sobre-stock|Arribos/.test(s), 'las pestañas viejas quedaron fuera');
});

test('InventarioMVista sin permiso sensible: todo en piezas, ningún peso', () => {
  const s = render(InventarioMVista, { r: armar(false), categorias: [], onSku() {} }, 'claro');
  sano(s, 'InventarioMVista no sensible');
  assert.ok(!/\$/.test(s), 'sin permiso sensible no hay pesos');
  assert.match(s, /6,210 pz en piso/);
  assert.match(s, /-290 pz/);
  assert.match(s, /2,300 pz/);
  assert.match(s, /en piezas/);
});

test('InventarioMVista vacía (sin fotos, sin tránsito) no rompe', () => {
  const res0 = resumenInventario([], null);
  const r0 = calc.resumenInventarioM({ res: res0, medidas: null, meses: [], pos: [], filas: [], skuAnio: [], skuRows: [], hoy: HOY, sensible: false });
  const s = render(InventarioMVista, { r: r0, categorias: [] });
  sano(s, 'InventarioMVista vacía');
  assert.match(s, /0 pz en piso/);
  assert.match(s, /Sin fotos de cierre de mes todavía/);
  assert.match(s, /sin embarques pendientes/);
});

test('rutas · inventarioGlobal → InventarioM (push) y forecastClientes → S&OP', () => {
  const i = destino({ pagina: 'inventarioGlobal' });
  assert.equal(i.tipo, 'push'); assert.equal(i.key, 'inventario');
  assert.equal(destino({ pagina: 'forecastClientes' }).key, 'sop');
});
