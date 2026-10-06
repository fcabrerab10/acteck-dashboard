// Tracking de pedidos e Inventario global en el celular (2026-10-05): SSR de las vistas puras con datos de ejemplo
// (sin red) + las funciones puras que comparten con la web (embudoHoy · resumenInventario · agruparPorPO) + rutas.
//   node --test scripts/test-movil-tracking-inventario-ssr.mjs
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
const { TrackingMVista, embudoHoy } = await vite.ssrLoadModule('/src/movil/pestanas/tracking/TrackingM.jsx');
const { InventarioMVista } = await vite.ssrLoadModule('/src/movil/pestanas/inventario/InventarioM.jsx');
const calcInv = await vite.ssrLoadModule('/src/movil/pestanas/inventario/calculo.js');
const { calcularTodo, resumen, surtirHoy, backorderPorSku } = await vite.ssrLoadModule('/src/modules/comercial/tracking/calculo.js');
const { agregarSkus, resumenInventario } = await vite.ssrLoadModule('/src/modules/comercial/inventario/agregar.js');
const { agruparPorPO } = await vite.ssrLoadModule('/src/modules/comercial/inventario/arribos.js');
const { inventarioDesdeVista } = await vite.ssrLoadModule('/src/lib/medidas.js');
const { destino } = await vite.ssrLoadModule('/src/movil/rutas.js');

const qc = new QueryClient();
const nav = { modo: 'barra', perfil: { user_id: 'u-f', es_super_admin: true }, push() {}, pop() {}, navegar() {}, agregarSku() {} };
// React mete `<!-- -->` entre nodos de texto contiguos («OC <!-- -->4500218»): se quitan para poder buscar frases.
const render = (C, props, themeKey = 'midnight') => renderToString(React.createElement(QueryClientProvider, { client: qc },
  React.createElement(ThemeContext.Provider, { value: { theme: getTheme(themeKey), setThemeKey() {} } },
    React.createElement(NavContext.Provider, { value: nav }, React.createElement(C, props))))).replace(/<!--.*?-->/g, '');
const sano = (s, donde) => { assert.ok(!/NaN|undefined|\[object Object\]/.test(s), `${donde}: NaN/undefined/[object Object] en el HTML`); };

// ── Tracking · datos de ejemplo con la misma forma que devuelve tracking/datos.js#cargarTodo ──
const HOY = new Date(2026, 9, 5, 12); // 5 oct 2026
const datosTracking = {
  ocs: [
    { id: 'oc1', cliente_key: 'pcel', numero_oc_cliente: '4500218', fecha_recibida: '2026-09-28T10:00:00Z', facturas: [], fuente: 'manual', updated_at: '2026-09-30T00:00:00Z' },
    { id: 'oc2', cliente_key: 'digitalife', numero_oc_cliente: 'DL-7781', fecha_recibida: '2026-10-03T10:00:00Z', facturas: [], fuente: 'manual', updated_at: '2026-10-03T00:00:00Z' },
    { id: 'oc3', cliente_key: 'dicotech', numero_oc_cliente: '99120', fecha_recibida: '2026-09-20T10:00:00Z', facturas: [], fuente: 'manual', updated_at: '2026-09-26T00:00:00Z' },
  ],
  ocSkus: [
    { id: 's1', oc_id: 'oc1', sku: 'AC-943178', cantidad_ordenada: 200, precio_unitario: 100 },
    { id: 's2', oc_id: 'oc1', sku: 'AC-943253', cantidad_ordenada: 150, precio_unitario: 200 },
    { id: 's3', oc_id: 'oc2', sku: 'BR-930012', cantidad_ordenada: 40, precio_unitario: 350 },
    { id: 's4', oc_id: 'oc3', sku: 'AC-939409', cantidad_ordenada: 70, precio_unitario: 50 },
  ],
  facturas: [
    { id: 'f1', oc_id: 'oc1', folio: 'A10381203', fecha: '2026-09-30', piezas: 270, monto: 34000, fuente: 'erp', ligada_por: 'referencia' },
    { id: 'f2', oc_id: 'oc3', folio: 'A10381300', fecha: '2026-09-22', piezas: 70, monto: 3500, fuente: 'erp', ligada_por: 'referencia' },
  ],
  facturaSkus: [
    { factura_id: 'f1', sku: 'AC-943178', piezas: 200 }, { factura_id: 'f1', sku: 'AC-943253', piezas: 70 },
    { factura_id: 'f2', sku: 'AC-939409', piezas: 70 },
  ],
  envios: [{ id: 'e1', oc_id: 'oc3', numero_envio: 1, fuente: 'manual', fecha_surtida: '2026-09-23T10:00:00Z', fecha_entregada: '2026-09-25T10:00:00Z', paqueteria: 'Estafeta', guia_rastreo: 'G-1' }],
  envioSkus: [],
  cotizaciones: [],
  erpFacturas: [],
  transito: new Map([['AC-943253', { cantidad: 2000, eta: '2026-10-21', po: '7712' }]]),
  stock: new Map([['AC-943253', { disponible: 0, porAlmacen: {} }], ['BR-930012', { disponible: 500, porAlmacen: { GDL: 500 } }]]),
  roadmap: new Map([['AC-943178', { sku: 'AC-943178', descripcion: 'Mouse inalámbrico' }], ['BR-930012', { sku: 'BR-930012', descripcion: 'Teclado gamer' }]]),
  roadmapRows: [],
  cargadoAt: HOY.toISOString(),
};

const filas = calcularTodo(datosTracking, HOY);
const res = resumen(filas, HOY);
const surtir = surtirHoy(filas);
const backorder = backorderPorSku(filas);

test('tracking · calculo con los datos de ejemplo: 2 abiertas, 1 entregada, una surtible, una detenida', () => {
  assert.equal(filas.length, 3);
  assert.equal(res.abiertas, 2);
  assert.equal(filas.find((o) => o.id === 'oc3').etapa, 'entregada');
  assert.equal(surtir.length, 1, 'DL-7781 tiene stock completo → surtible hoy');
  assert.equal(surtir[0].numero_oc_cliente, 'DL-7781');
  assert.ok(filas.find((o) => o.id === 'oc1').detenida, '4500218 facturada parcial hace > 3 d → detenida');
  assert.equal(backorder.length, 2);
});

test('tracking · embudoHoy: una fila por etapa, sólo abiertas salvo Entregada, barra proporcional', () => {
  const e = embudoHoy(filas);
  assert.deepEqual(e.map((x) => x.etapa), ['cotizacion', 'recibida', 'facturada', 'enviada', 'entregada']);
  const por = Object.fromEntries(e.map((x) => [x.etapa, x]));
  assert.equal(por.recibida.n, 1);
  assert.equal(por.facturada.n, 1);
  assert.equal(por.entregada.n, 1);
  assert.equal(por.cotizacion.n, 0);
  assert.equal(por.facturada.detenidas, 1);
  assert.equal(por.recibida.ancho, 100);
  assert.equal(por.cotizacion.ancho, 0);
  assert.equal(por.recibida.monto, 40 * 350);
  assert.deepEqual(embudoHoy([]).map((x) => x.n), [0, 0, 0, 0, 0]);
});

test('tracking · TrackingMVista renderiza hero, KPIs, Surtir hoy, embudo y la lista por cliente', () => {
  const s = render(TrackingMVista, { filas, res, surtir, backorder, hoy: HOY, onAbrir() {}, onEnvio() {}, onCompartir() {}, onCompartirSurtir() {} });
  sano(s, 'TrackingMVista');
  assert.match(s, /Tracking/);
  assert.match(s, /2 OCs abiertas, 1 detenida/);
  assert.match(s, /Fill rate 90 d/);
  assert.match(s, /Días a entrega/);
  assert.match(s, /Backorder/);
  assert.match(s, /Monto abierto/);
  assert.match(s, /Surtir hoy/);
  assert.match(s, /DL-7781/);
  assert.match(s, /Por etapa/);
  assert.match(s, /Recibida/); assert.match(s, /Facturada/); assert.match(s, /Entregada/);
  assert.match(s, /OC 4500218/);
  assert.match(s, /PCEL/); assert.match(s, /Digitalife/);
  assert.match(s, /detenida/);
  assert.match(s, /\$34 K|\$54 K|\$14 K/); // monto de la OC en la fila
  assert.match(s, /Desliza una fila/); // hay onEnvio
  // Sin permiso de edición no se ofrece el gesto de envío.
  const s2 = render(TrackingMVista, { filas, res, surtir, backorder, hoy: HOY, onAbrir() {}, onEnvio: null, onCompartir() {} }, 'claro');
  sano(s2, 'TrackingMVista sin editar');
  assert.ok(!/Desliza una fila/.test(s2));
});

test('tracking · vista vacía (sin pedidos) no rompe', () => {
  const r0 = resumen([], HOY);
  const s = render(TrackingMVista, { filas: [], res: r0, surtir: [], backorder: [], hoy: HOY });
  sano(s, 'TrackingMVista vacía');
  assert.match(s, /Sin pedidos abiertos/);
  assert.match(s, /todo entregado/);
});

// ── Inventario · datos de ejemplo con la forma de v_inventario_almacen_medida (sólo en_inv_actual = true) ──
const filasInv = [
  { articulo: 'AC-943178', no_almacen: 1, cedis: 'ALMACENES GUADALAJARA', disponible: 900, inventario: 1000, costopromedio: 120, costodisponible: 108000, costoinventario: 120000 },
  { articulo: 'AC-943178', no_almacen: 3, cedis: 'ALMACENES MEXICO', disponible: 200, inventario: 200, costopromedio: 120, costodisponible: 24000, costoinventario: 24000 },
  { articulo: 'AC-943253', no_almacen: 1, cedis: 'ALMACENES GUADALAJARA', disponible: 0, inventario: 0, costopromedio: 300, costodisponible: 0, costoinventario: 0 },
  { articulo: 'BR-930012', no_almacen: 1, cedis: 'ALMACENES GUADALAJARA', disponible: 5000, inventario: 5000, costopromedio: 50, costodisponible: 250000, costoinventario: 250000 },
  { articulo: 'AC-939409', no_almacen: 1, cedis: 'ALMACENES GUADALAJARA', disponible: 40, inventario: 40, costopromedio: 20, costodisponible: 800, costoinventario: 800 },
  { articulo: 'AV-100001', no_almacen: 1, cedis: 'ALMACENES GUADALAJARA', disponible: 10, inventario: 10, costopromedio: 400, costodisponible: 4000, costoinventario: 4000 },
];
const descripciones = new Map([
  ['AC-943178', { descripcion: 'Mouse inalámbrico', marca: 'ACTECK', familia: 'Mouse' }],
  ['AC-943253', { descripcion: 'Bocina portátil', marca: 'Acteck', familia: 'Audio' }],
  ['BR-930012', { descripcion: 'Teclado gamer', marca: 'BALAM RUSH', familia: 'Teclado' }],
]);
const transito = new Map([
  ['AC-943253', { cantidad: 2000, eta: '2026-10-21', supplier: 'SHENZHEN X CO., LTD', pos: [{ po: '7712', estatus: 'TRANSITO MARITIMO', cantidad: 2000, eta: '2026-10-21', etd: '2026-09-20', cedis: 'GDL', contenedor: 'MSKU1' }] }],
  ['AC-939409', { cantidad: 500, eta: '2026-11-06', supplier: 'OTRO', pos: [{ po: 'ABT278', estatus: 'EN PRODUCCION', cantidad: 500, eta: '2026-11-06', etd: null, cedis: 'MEX', contenedor: '' }] }],
]);
const demanda = new Map([['AC-943178', 600], ['AC-943253', 300], ['BR-930012', 100], ['AC-939409', 200]]);
const leadTime = new Map([['AC-943253', { dias: 104, min: 90, max: 120, muestras: 3 }]]);
const medidas = inventarioDesdeVista({ inv_actual: 398800, inv_actual_piezas: 6250, inv_actual_disponible: 6150, dias_inv: 141.2, cv_ultimos_3_meses: 254000, skus_con_stock: 5 });

const skuRows = agregarSkus(filasInv, { descripciones, transito, leadTime, demanda });
const resInv = resumenInventario(skuRows, medidas);
const porSku = new Map(skuRows.map((r) => [r.sku, r]));
const pos = agruparPorPO({ transito, porSku, descripciones, navieraPor: new Map([['MSKU1', 'Maersk']]), hoy: HOY });

test('inventario · agregarSkus + resumenInventario: agotado, crítico, sobre-stock, en camino y cifras del director', () => {
  const r = Object.fromEntries(skuRows.map((x) => [x.sku, x]));
  assert.equal(r['AC-943178'].totalPz, 1200);
  assert.equal(r['AC-943178'].valor, 144000);
  assert.equal(r['AC-943178'].marca, 'Acteck', 'la marca se normaliza');
  assert.equal(r['AV-100001'].marca, 'Audive', 'sin roadmap se infiere del prefijo');
  assert.ok(r['AC-943253'].agotado, 'sin stock y con demanda → agotado');
  assert.ok(r['AC-943253'].riesgo, 'agotado con tránsito → riesgo');
  assert.ok(r['AC-939409'].critico, '40 pz a 200/mes = 6 d → crítico');
  assert.ok(r['BR-930012'].sobrestock, '5000 pz a 100/mes = 1500 d → sobre-stock');
  assert.equal(r['AV-100001'].estado, 'Sin demanda');
  assert.equal(resInv.valor, 398800, 'Inv Actual = medida oficial, no la suma');
  assert.equal(resInv.piezas, 6250);
  assert.equal(resInv.diasInv, 141.2);
  assert.equal(resInv.agotados, 1);
  assert.equal(resInv.criticos, 1);
  assert.equal(resInv.sobrestock, 1);
  assert.equal(resInv.transitoPz, 2500);
  assert.equal(resInv.transitoPos, 2);
  assert.equal(resInv.proximaEta, '2026-10-21');
  assert.equal(resInv.demandaPerdida, 300);
  // Sin la fila de medidas se cae a lo sumado en pantalla (piezas y valor), sin días.
  const sinMedidas = resumenInventario(skuRows, null);
  assert.equal(sinMedidas.valor, 144000 + 250000 + 800 + 4000);
  assert.equal(sinMedidas.diasInv, null);
});

test('inventario · agruparPorPO: una fila por PO, ETA más cercana primero, naviera y «resuelve»', () => {
  assert.deepEqual(pos.map((p) => p.po), ['7712', 'ABT278']);
  assert.equal(pos[0].piezas, 2000);
  assert.equal(pos[0].naviera, 'Maersk');
  assert.equal(pos[0].resuelve, 1, 'trae el SKU agotado');
  assert.equal(pos[0].diasEnTransito, 15, 'ETD 20 sep → 5 oct');
  assert.equal(pos[1].diasEnTransito, null);
  assert.equal(pos[1].nSkus, 1);
  assert.deepEqual(agruparPorPO({ transito: new Map() }), []);
});

// 3.81.0 (2026-10-05): la pantalla se rehízo (vista pura = InventarioMVista({ r }) con r de inventario/calculo.js#resumenInventarioM;
// la frase y el detalle se prueban en scripts/test-inventario-movil-ssr.mjs). Aquí sólo que sigue montando con estos datos.
const armarInv = (sensible) => calcInv.resumenInventarioM({ res: resInv, medidas, meses: [], pos, porSku, precios: new Map(), filas: filasInv, roadmapMap: descripciones, skuAnio: [], roadmap: [], skuRows, hoy: HOY, sensible });

test('inventario · fraseInventario (calculo.js) con y sin permiso sensible', () => {
  const llega = calcInv.llegadas({ pos, porSku, hoy: HOY });
  assert.match(calcInv.fraseInventario({ res: resInv, llega, sensible: true }), /^\$399K en piso, 141 días al ritmo de los 3 meses cerrados; 1 SKU agotado con demanda y \$600K llegan en octubre\.$/);
  assert.match(calcInv.fraseInventario({ res: resInv, llega, sensible: false }), /^6,250 pz en piso, 141 días/);
  assert.equal(calcInv.fraseInventario({ res: resumenInventario([], null), llega: calcInv.llegadas({ pos: [], hoy: HOY }), sensible: false }), '0 pz en piso.');
});

test('inventario · InventarioMVista renderiza hero, 4 KPIs y tabla (sensible y no sensible)', () => {
  const s = render(InventarioMVista, { r: armarInv(true), categorias: [], onSku() {}, onSop() {} });
  sano(s, 'InventarioMVista sensible');
  assert.match(s, /\$399K en piso/);
  assert.match(s, /Valor del inventario actual/);
  assert.match(s, /Cambio contra el mes pasado/);
  assert.match(s, /Llega en octubre/); assert.match(s, /2 PO/);
  assert.match(s, /Vueltas de inventario del año/);
  assert.match(s, /Agotados con demanda/);
  const s2 = render(InventarioMVista, { r: armarInv(false), categorias: [], onSku() {} }, 'claro');
  sano(s2, 'InventarioMVista no sensible');
  assert.ok(!/\$/.test(s2), 'sin permiso sensible no hay pesos a costo');
  assert.match(s2, /6,250 pz en piso/);
});

test('inventario · vista vacía no rompe', () => {
  const r0 = calcInv.resumenInventarioM({ res: resumenInventario([], null), medidas: null, meses: [], pos: [], filas: [], skuAnio: [], skuRows: [], hoy: HOY, sensible: false });
  const s = render(InventarioMVista, { r: r0, categorias: [] });
  sano(s, 'InventarioMVista vacía');
  assert.match(s, /Sin fotos de cierre de mes todavía/);
});

test('rutas · ordenesCompra → TrackingM e inventarioGlobal → InventarioM (push)', () => {
  const t = destino({ pagina: 'ordenesCompra' });
  assert.equal(t.tipo, 'push'); assert.equal(t.key, 'tracking');
  const tOc = destino({ pagina: 'ordenesCompra', extra: { ocId: 'x1' } });
  assert.equal(tOc.key, 'oc-x1', 'una alerta sigue abriendo la ficha de la OC');
  const i = destino({ pagina: 'inventarioGlobal' });
  assert.equal(i.tipo, 'push'); assert.equal(i.key, 'inventario');
  assert.equal(destino({ pagina: 'estrategiaPrecios' }).key, 'precios', 'Estrategia de precios abre su pantalla propia (3.82)');
});
