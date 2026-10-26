// loadSheetJS (2026-10-26): usa la librería empaquetada, no el CDN; y leerWorkbook lee un CSV y un xlsx de verdad.
// node --test scripts/test-sheetjs-carga.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
globalThis.window ??= globalThis;
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
test.after(async () => { await vite.close(); setTimeout(() => process.exit(process.exitCode || 0), 200).unref(); });
test('loadSheetJS devuelve una librería con read aunque window.XLSX esté vacío', async () => {
  globalThis.window.XLSX = {}; // lo que deja el chunk vendor-xlsx al abrir Propuestas/Inventario
  const { loadSheetJS } = await vite.ssrLoadModule('/src/lib/utils.js');
  const X = await loadSheetJS();
  assert.equal(typeof X.read, 'function'); assert.equal(typeof globalThis.window.XLSX.read, 'function');
  const { leerWorkbook, XLSX } = await vite.ssrLoadModule('/src/lib/parsers/_util.js');
  const csv = 'sku,piezas\nAC-1,5\nBR-2,7\n';
  const wb = await leerWorkbook({ arrayBuffer: async () => new TextEncoder().encode(csv).buffer });
  const rows = XLSX().utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  assert.deepEqual(rows, [{ sku: 'AC-1', piezas: 5 }, { sku: 'BR-2', piezas: 7 }]);
  const out = X.write(wb, { type: 'array', bookType: 'xlsx' });
  const wb2 = await leerWorkbook({ arrayBuffer: async () => out });
  assert.equal(XLSX().utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]]).length, 2);
});
