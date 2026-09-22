import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularAnchoMes, ANCHO_MES_MAX, ANCHO_MES_MIN } from '../src/modules/comercial/sellin/ajuste.js';
const FIJOS = 118 + 68 + 54 + 62;
test('12 meses a 1158 px: ancho máximo, sin compactar', () => {
  const r = calcularAnchoMes(1158, 12, FIJOS);
  assert.equal(r.anchoMes, ANCHO_MES_MAX); assert.equal(r.compacto, false);
});
test('24 meses a 1158 px: compacta y cabe', () => {
  const r = calcularAnchoMes(1158, 24, FIJOS);
  assert.equal(r.compacto, true);
  assert.ok(r.anchoMes >= ANCHO_MES_MIN && r.anchoMes < ANCHO_MES_MAX);
  assert.ok(FIJOS + r.desc + r.anchoMes * 24 <= 1158);
});
test('sin medida: valores por defecto', () => {
  assert.equal(calcularAnchoMes(0, 24, FIJOS).anchoMes, ANCHO_MES_MAX);
});
