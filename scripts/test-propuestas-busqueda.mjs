import test from 'node:test';
import assert from 'node:assert/strict';
import { indiceDe, tokens, coincide } from '../src/modules/comercial/propuestas/filtros.js';
const r = { sku: 'AC-943338', descripcion: 'Silla de Oficina Flux Base EC343HR / PP + Malla + Espuma de alta suavidad / Pistón Clase 3', marca: 'Acteck', familia: 'Sillas y Mesas', rdmp: 'RMI' };
const idx = indiceDe(r);
const busca = (q) => coincide(idx, tokens(q));
test('SKU con o sin guion, con espacio o sólo el número', () => {
  for (const q of ['AC-943338', 'ac943338', 'ac 943338', '943338', 'AC-9433']) assert.ok(busca(q), q);
});
test('descripción con acentos, signos y espacios dobles', () => {
  for (const q of ['silla  oficina', 'Pistón clase 3', 'malla+espuma', 'flux/base', 'ec343hr', 'sillas mesas acteck']) assert.ok(busca(q), q);
  assert.ok(!busca('monitor'));
});
test('el punto entre dígitos se respeta', () => {
  const m = indiceDe({ sku: 'AC-1', descripcion: 'Monitor 21.5 VA' });
  assert.ok(coincide(m, tokens('21.5'))); assert.ok(!coincide(m, tokens('21.6')));
});
