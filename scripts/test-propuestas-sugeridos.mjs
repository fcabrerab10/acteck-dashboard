import test from 'node:test';
import assert from 'node:assert/strict';
import { sugeridoDe } from '../src/modules/comercial/propuestas/sugeridos.js';
const base = { sellout90: 90, invCliente: 0 }; // 30 pz/mes, sin stock en el cliente → necesita 30
test('con inventario de sobra se sugiere lo que necesita', () => {
  const s = sugeridoDe({ ...base, dispActeck: 500 });
  assert.equal(s.piezas, 30); assert.equal(s.necesarias, 30); assert.equal(s.sinStock, false);
});
test('con poco inventario se sugiere lo disponible en múltiplos de 5', () => {
  const s = sugeridoDe({ ...base, dispActeck: 17 });
  assert.equal(s.piezas, 15); assert.equal(s.necesarias, 30);
});
test('sin inventario: sugerido sin stock con su arribo, piezas 0', () => {
  const s = sugeridoDe({ ...base, dispActeck: 3, arribo: { fecha: '2026-11-21', piezas: 18000 } });
  assert.equal(s.piezas, 0); assert.equal(s.sinStock, true); assert.equal(s.arribo.piezas, 18000);
});
test('sin dispActeck cae a invActeck', () => {
  assert.equal(sugeridoDe({ ...base, invActeck: 40 }).piezas, 30);
});
