// Smoke SSR de "Compras en camino" (2026-09-12) + regla de ancho en Tracking Pedidos:
// carga con el pipeline de Vite todos los archivos que se tocaron y prueba la lógica pura
// de `poPendiente` en el motor del S&OP (forecast/calculo.js), sin tocar la red.
//   node --test scripts/test-sop-ssr.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });

test.after(() => vite.close());

test('los archivos tocados cargan y exportan default', async () => {
  for (const m of [
    '/src/modules/comercial/ForecastClientesTab.jsx',
    '/src/modules/comercial/forecast/ComprasEnCamino.jsx',
    '/src/modules/comercial/forecast/TablaForecast.jsx',
    '/src/modules/comercial/TrackingPedidos.jsx',
    '/src/modules/comercial/tracking/TablaPedidos.jsx',
    '/src/modules/comercial/tracking/DrillOC.jsx',
    '/src/modules/comercial/tracking/Backorder.jsx',
    '/src/modules/comercial/tracking/SurtirHoy.jsx',
    '/src/modules/comercial/tracking/FacturasSinOC.jsx',
    '/src/movil/pestanas/SOP.jsx',
  ]) {
    const mod = await vite.ssrLoadModule(m);
    assert.equal(typeof mod.default, 'function', `${m} debe exportar default`);
  }
  const hook = await vite.ssrLoadModule('/src/modules/comercial/forecast/useForecastData.js');
  assert.equal(typeof hook.useForecastData, 'function');
});

// ── Motor: poPendiente es INFORMATIVO y no debe mover brecha ni sugerido ──
const baseData = (extra = {}) => ({
  inventario: [{ sku: 'AC-100', inventario: 100, disponible: 100 }],
  transito: [],
  leadTimes: [],
  metadata: [],
  demanda: [],
  roadmap: [],
  embarques: [],
  reporteSkus: [{ sku: 'AC-100', orden: 1 }, { sku: 'AC-200', orden: 2 }],
  facturacion: [],
  progArribos: [],
  catalogoArticulos: [],
  skuConfig: [],
  ...extra,
});

const CP = [
  { sku: 'AC-100', po: 'ABT1', proveedor: 'PROV UNO', fecha_po: '2026-06-01', piezas_pendientes: 500, usd_pendiente: 5000, eta: null, en_master_embarques: false, dias_desde_po: 100 },
  { sku: 'AC-100', po: 'ABT2', proveedor: 'PROV UNO', fecha_po: '2026-05-01', piezas_pendientes: 300, usd_pendiente: 3000, eta: '2026-11-01', en_master_embarques: true, dias_desde_po: 130 },
  { sku: 'AC-999', po: 'ABT3', proveedor: 'PROV DOS', fecha_po: '2026-07-01', piezas_pendientes: 0, usd_pendiente: 0, eta: null, en_master_embarques: false, dias_desde_po: 70 },
];

test('poPendiente: agrega piezas y USD por SKU, ordena las POs por fecha y marca sinTransito', async () => {
  const { calcularForecast } = await vite.ssrLoadModule('/src/modules/comercial/forecast/calculo.js');
  const rows = calcularForecast(baseData({ comprasPendientes: CP }), 3);
  const r = rows.find((x) => x.sku === 'AC-100');
  assert.ok(r, 'AC-100 debe estar en el universo del Reporte');
  assert.equal(r.poPendiente.piezas, 800, 'suma las dos POs pendientes');
  assert.equal(r.poPendiente.usd, 8000);
  assert.equal(r.poPendiente.pos.length, 2);
  assert.deepEqual(r.poPendiente.pos.map((p) => p.po), ['ABT2', 'ABT1'], 'POs ordenadas por fecha de emisión');
  assert.equal(r.poPendiente.pos[0].enMasterEmbarques, true);
  assert.equal(r.poPendiente.sinTransito, true, 'sin tránsito en v_transito_sku → la píldora se pinta');

  const sinPo = rows.find((x) => x.sku === 'AC-200');
  assert.equal(sinPo.poPendiente, null, 'SKU sin PO pendiente no trae el objeto');
});

test('poPendiente: los renglones con pendiente 0 se ignoran', async () => {
  const { calcularForecast } = await vite.ssrLoadModule('/src/modules/comercial/forecast/calculo.js');
  const rows = calcularForecast(baseData({ reporteSkus: [{ sku: 'AC-999', orden: 1 }], comprasPendientes: CP }), 3);
  assert.equal(rows.find((x) => x.sku === 'AC-999').poPendiente, null);
});

test('poPendiente: con tránsito vivo, sinTransito = false (no se pinta la píldora)', async () => {
  const { calcularForecast } = await vite.ssrLoadModule('/src/modules/comercial/forecast/calculo.js');
  const transito = [{ sku: 'AC-100', cantidad: 400, eta_mas_cercana: '2026-10-01', embarques_detalle: [{ po: 'ABT2', cantidad: 400, eta: '2026-10-01' }] }];
  const rows = calcularForecast(baseData({ transito, comprasPendientes: CP }), 3);
  const r = rows.find((x) => x.sku === 'AC-100');
  assert.equal(r.poPendiente.piezas, 800);
  assert.equal(r.poPendiente.sinTransito, false);
});

test('poPendiente NO cambia brecha, sugerido ni objetivo (es informativo)', async () => {
  const { calcularForecast } = await vite.ssrLoadModule('/src/modules/comercial/forecast/calculo.js');
  const hoy = new Date();
  const mesKey = (i) => { const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1); return { anio: d.getFullYear(), mes: d.getMonth() + 1 }; };
  const facturacion = [1, 2, 3, 4].map((i) => ({ sku: 'AC-100', cliente_nombre: 'PC ONLINE', canal: 'mayoreo', piezas: 600, ...mesKey(i) }));
  const sin = calcularForecast(baseData({ facturacion }), 3);
  const con = calcularForecast(baseData({ facturacion, comprasPendientes: CP }), 3);
  const a = sin.find((x) => x.sku === 'AC-100');
  const b = con.find((x) => x.sku === 'AC-100');
  assert.ok(b.poPendiente, 'la fila con compras_oc sí trae poPendiente');
  for (const k of ['brecha', 'sugerido', 'objetivo3m', 'necesidadNeta', 'ritmo3m', 'coberturaDiasErp', 'inv', 'traCant']) {
    assert.deepEqual(b[k], a[k], `${k} no debe cambiar por las POs pendientes`);
  }
});

test('poPendiente: sin la fuente (data sin comprasPendientes) nada se rompe', async () => {
  const { calcularForecast } = await vite.ssrLoadModule('/src/modules/comercial/forecast/calculo.js');
  const rows = calcularForecast(baseData(), 3);
  assert.ok(rows.length > 0);
  assert.equal(rows.every((r) => r.poPendiente === null), true);
});

test('Tracking · regla de ancho: la tabla de pedidos no pasa de 10 columnas', async () => {
  const fs = await import('node:fs/promises');
  const src = await fs.readFile(new URL('../src/modules/comercial/tracking/TablaPedidos.jsx', import.meta.url), 'utf8');
  const bloque = src.slice(src.indexOf('const columnas = ['), src.indexOf('const excel = ()'));
  const keys = [...bloque.matchAll(/\{ key: '([a-zA-Z_]+)'/g)].map((m) => m[1]);
  assert.ok(keys.length <= 10, `la tabla de pedidos tiene ${keys.length} columnas: ${keys.join(', ')}`);
  assert.ok(!keys.includes('facturas'), 'el detalle de facturas se movió al drill');
  assert.ok(!keys.includes('envio'), 'el detalle de envío se movió al drill');
  assert.ok(!keys.includes('recibida'), 'la fecha de recibida vive dentro de la celda de la OC');
});
