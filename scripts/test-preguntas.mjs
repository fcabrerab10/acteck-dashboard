import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretar, pareceP } from '../src/lib/preguntas/interpretar.js';
const hoy = new Date(2026, 8, 24);
const I = (t) => interpretar(t, { hoy });

test('búsquedas normales no se interpretan', () => {
  assert.equal(I('monitor'), null); assert.equal(I('AC-943253'), null); assert.equal(I('Digitalife'), null);
  assert.equal(pareceP('inventario global'), true); // pestaña con palabra clave: la paleta muestra ambas cosas
});
test('cuota del cliente con mes actual por defecto', () => {
  const i = I('cuánto va digitalife de cuota'); assert.equal(i.tipo, 'cuota'); assert.equal(i.cliente, 'digitalife'); assert.equal(i.mes, null);
  const j = I('¿cómo vamos con PCEL en agosto?'); assert.equal(j.tipo, 'cuota'); assert.equal(j.cliente, 'pcel'); assert.equal(j.mes, 8); assert.equal(j.anio, 2026);
});
test('ventas con periodo', () => {
  const i = I('venta de dicotech en diciembre'); assert.equal(i.tipo, 'ventas'); assert.equal(i.mes, 12); assert.equal(i.anio, 2025, 'diciembre aún no llega: es del año pasado');
  const j = I('cuánto vendimos en 2025'); assert.equal(j.tipo, 'ventas'); assert.equal(j.cliente, null); assert.equal(j.anio, 2025); assert.equal(j.relativo, 'anio');
  const k = I('ventas de digitalife el mes pasado'); assert.equal(k.mes, 8); assert.equal(k.anio, 2026);
});
test('stock y tránsito por SKU', () => {
  assert.deepEqual([I('stock de AC-943253').tipo, I('stock de AC-943253').sku], ['stock', 'AC-943253']);
  assert.equal(I('cuándo llega BR-940726').tipo, 'transito');
  assert.equal(I('hay inventario de ac943253').sku, 'AC-943253');
});
test('agenda: pendientes y reuniones', () => {
  assert.deepEqual([I('pendientes de hoy').tipo, I('pendientes de hoy').cuando], ['pendientes', 'hoy']);
  assert.equal(I('qué tengo vencido').cuando, 'vencidos');
  assert.deepEqual([I('reunión de mañana').tipo, I('reunión de mañana').cuando], ['reunion', 'manana']);
  assert.equal(I('abre la reunión de digitalife').abrir, true);
});
test('pagos, cobranza, margen, sell out, inventario de empresa', () => {
  assert.equal(I('pagos por autorizar').tipo, 'pagos');
  assert.deepEqual([I('cartera vencida de digitalife').tipo, I('cartera vencida de digitalife').cliente], ['cobranza', 'digitalife']);
  assert.equal(I('margen de pcel').tipo, 'margen');
  assert.equal(I('sell out de pcel').tipo, 'sellout');
  assert.equal(I('cuánto inventario tenemos').tipo, 'inventarioEmpresa');
  assert.deepEqual([I('inventario de digitalife').tipo, I('inventario de digitalife').foco], ['sellout', 'inventario']);
});
