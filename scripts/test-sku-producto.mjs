// Regla de «SKU de producto» (2026-11-18) y su efecto en la lista de inventario.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { esSkuProducto } from '../src/lib/sku.js';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
test.after(async () => { await vite.close(); setTimeout(() => process.exit(process.exitCode || 0), 200).unref(); });
const { agregarSkus } = await vite.ssrLoadModule('/src/modules/comercial/inventario/agregar.js');

test('forma de producto: dos letras, guion, seis dígitos', () => {
  for (const s of ['AC-935777', 'br-946353', ' EY-445981 ', 'ES-05001', 'ES-05001E', 'TB-05003E', 'AC-935777B', 'ES-05001EW']) assert.ok(esSkuProducto(s), s);
  for (const s of ['MVIS-001', 'RT-0102', 'ES-05001EWX', 'CA-ES-05001E', 'AC-936026_1', 'ST-S49838', 'AC-935777-B', 'AC-9357', '', null]) assert.ok(!esSkuProducto(s), String(s));
});

test('inventario: entran roadmap y productos nuevos; refacciones y cajas no', () => {
  const fila = (articulo) => ({ articulo, no_almacen: 1, inventario: 10, disponible: 10, costoinventario: 100, costodisponible: 100, costopromedio: 10 });
  const ctx = { descripciones: new Map([['AC-111111', { descripcion: 'En roadmap' }], ['KIT-RARO', { descripcion: 'Clave rara pero en roadmap' }]]), transito: new Map(), leadTime: new Map(), demanda: new Map() };
  const skus = agregarSkus(['AC-111111', 'KIT-RARO', 'BR-946353', 'MVIS-001', 'RT-0102'].map(fila), ctx).map((r) => r.sku).sort();
  assert.deepEqual(skus, ['AC-111111', 'BR-946353', 'KIT-RARO']);
});
