// Smoke SSR de lo que se tocó para "tiempos reales de importación" (2026-09-12):
// carga con el pipeline de Vite las pantallas y el hook nuevo, y prueba la lógica pura
// (resumen ponderado y nombre corto de proveedor) sin tocar la red.
//   node --test scripts/test-embarques-ssr.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });

test.after(() => vite.close());

test('las pantallas tocadas cargan y exportan default', async () => {
  for (const m of [
    '/src/modules/comercial/ForecastClientesTab.jsx',
    '/src/modules/comercial/forecast/TiemposProveedores.jsx',
    '/src/modules/comercial/InventarioGlobal.jsx',
    '/src/modules/comercial/inventario/ProximosArribos.jsx',
    '/src/modules/comercial/inventario/HistoricoPanel.jsx',
    '/src/movil/pestanas/SOP.jsx',
  ]) {
    const mod = await vite.ssrLoadModule(m);
    assert.equal(typeof mod.default, 'function', `${m} debe exportar default`);
  }
});

test('useEmbarquesTiempos exporta el hook y los helpers puros', async () => {
  const mod = await vite.ssrLoadModule('/src/modules/comercial/forecast/useEmbarquesTiempos.js');
  for (const k of ['useEmbarquesTiempos', 'useNavieraPorContenedor', 'resumen', 'nombreProveedor']) {
    assert.equal(typeof mod[k], 'function', `debe exportar ${k}`);
  }
});

test('resumen(): los USD/CBM no se promedian, se recalculan; los días se ponderan por muestras', async () => {
  const { resumen } = await vite.ssrLoadModule('/src/modules/comercial/forecast/useEmbarquesTiempos.js');
  assert.deepEqual(resumen([]).usdPorCbm, null);
  assert.equal(resumen(null).embarques, 0);

  const filas = [
    { embarques: 10, cbm: 650, fob_usd: 100000, flete_usd: 36500, flete_medido_usd: 36500, cbm_medido: 650, dias_transito_med: 30, dias_total_med: 100, n_transito: 10 },
    { embarques: 2, cbm: 130, fob_usd: 20000, flete_usd: 13000, flete_medido_usd: 13000, cbm_medido: 130, dias_transito_med: 40, dias_total_med: 200, n_transito: 2 },
  ];
  const r = resumen(filas);
  assert.equal(r.embarques, 12);
  assert.equal(r.cbm, 780);
  assert.equal(r.fleteUsd, 49500);
  // 49,500 / 780 = 63.46 — NO el promedio simple de 56.2 y 100.
  assert.ok(Math.abs(r.usdPorCbm - 49500 / 780) < 1e-9, `usdPorCbm = ${r.usdPorCbm}`);
  // ponderado: (30*10 + 40*2) / 12 = 31.7, no 35.
  assert.ok(Math.abs(r.transitoMed - 380 / 12) < 1e-9, `transitoMed = ${r.transitoMed}`);
  assert.ok(Math.abs(r.totalMed - 1400 / 12) < 1e-9, `totalMed = ${r.totalMed}`);
});

test('resumen(): una fila sin CBM no ensucia el $/CBM ni los días', async () => {
  const { resumen } = await vite.ssrLoadModule('/src/modules/comercial/forecast/useEmbarquesTiempos.js');
  const r = resumen([
    { embarques: 1, cbm: 65, flete_usd: 3250, flete_medido_usd: 3250, cbm_medido: 65, dias_transito_med: 33, n_transito: 1 },
    { embarques: 1, cbm: null, flete_usd: null, flete_medido_usd: null, cbm_medido: null, dias_transito_med: null, n_transito: 0 },
  ]);
  assert.equal(r.usdPorCbm, 50);
  assert.equal(r.transitoMed, 33);
});

test('nombreProveedor() recorta los sufijos legales', async () => {
  const { nombreProveedor } = await vite.ssrLoadModule('/src/modules/comercial/forecast/useEmbarquesTiempos.js');
  assert.equal(nombreProveedor('SHENZHEN ACTECK COORPORATION LIMITED'), 'SHENZHEN ACTECK');
  assert.equal(nombreProveedor('MAXPAC TECHNOLOGY CO., LIMITED'), 'MAXPAC');
  assert.equal(nombreProveedor('ANJI PARTNER FURNITURE CO., LTD'), 'ANJI PARTNER FURNITURE');
  assert.equal(nombreProveedor(null), '');
});
