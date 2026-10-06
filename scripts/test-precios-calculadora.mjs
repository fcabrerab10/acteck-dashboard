// Calculadora de precio y margen del celular (Estrategia de Precios · 2026-10-05): node --test scripts/test-precios-calculadora.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { calcular, descuentoDesdePrecio, precioDesdeDescuento, tonoMargen, margenLineas } from '../src/modules/comercial/precios/calculadora.js';

const base = { precioLista: 1235, costo: 1002, piezas: 150, margenMinimo: 15 };

test('descuento → precio neto, margen, monto y utilidad a 2 decimales', () => {
  const r = calcular({ ...base, descuentoPct: 8 });
  assert.equal(r.precioNeto, 1136.2);
  assert.equal(r.descuentoPct, 8);
  assert.equal(r.margenPct, 11.81);
  assert.equal(r.monto, 170430);
  assert.equal(r.utilidad, 20130);
  assert.equal(r.piezas, 150);
});

test('precio escrito → descuento deducido; ida y vuelta consistentes', () => {
  const r = calcular({ ...base, precio: 1136.2 });
  assert.equal(r.descuentoPct, 8);
  assert.equal(r.precioNeto, 1136.2);
  // Ida y vuelta por un % a 2 decimales puede mover 1 centavo; dentro de calcular() el precio escrito siempre manda.
  assert.ok(Math.abs(precioDesdeDescuento(1235, descuentoDesdePrecio(1235, 1100)) - 1100) <= 0.05);
  assert.equal(descuentoDesdePrecio(0, 100), 0, 'sin precio de lista no hay descuento');
});

test('el precio manda sobre el descuento cuando vienen los dos', () => {
  const r = calcular({ ...base, precio: 1235, descuentoPct: 20 });
  assert.equal(r.descuentoPct, 0); assert.equal(r.precioNeto, 1235);
});

test('aviso de margen bajo el mínimo (naranja) y de pérdida (rojo)', () => {
  const r = calcular({ ...base, descuentoPct: 8 });
  assert.equal(r.tono, 'orange');
  assert.equal(r.avisos.length, 1); assert.equal(r.avisos[0].tipo, 'margen');
  assert.match(r.avisos[0].texto, /11\.8 % de margen, debajo de tu mínimo de 15 %/);
  const p = calcular({ ...base, descuentoPct: 25 });
  assert.equal(p.tono, 'red'); assert.equal(p.avisos[0].tipo, 'perdida');
  assert.ok(p.margenPct < 0);
  const ok = calcular({ ...base, descuentoPct: 0 });
  assert.equal(ok.tono, 'green'); assert.equal(ok.avisos.length, 0);
  assert.equal(tonoMargen(null), 'gray');
});

test('aviso cuando el neto queda por debajo de lo ya facturado al cliente', () => {
  const r = calcular({ ...base, descuentoPct: 8, precioFacturado: 1235, facturadoFecha: '2026-09-18', clienteLabel: 'PCEL' });
  const f = r.avisos.find((a) => a.tipo === 'facturado');
  assert.ok(f); assert.match(f.texto, /a PCEL ya le facturaste a \$1,235 en sep 26; con este precio quedas \$98\.8 abajo/);
  const sin = calcular({ ...base, descuentoPct: 0, precioFacturado: 1235 });
  assert.ok(!sin.avisos.some((a) => a.tipo === 'facturado'), 'igual a lo facturado: sin aviso');
});

test('sin costo (sin permiso sensible) no hay margen ni utilidad, pero sí neto y monto', () => {
  const r = calcular({ precioLista: 100, descuentoPct: 10, piezas: 20 });
  assert.equal(r.precioNeto, 90); assert.equal(r.monto, 1800);
  assert.equal(r.margenPct, null); assert.equal(r.utilidad, null); assert.equal(r.tono, 'gray'); assert.equal(r.avisos.length, 0);
});

test('piezas negativas o decimales se normalizan; precio negativo queda en 0', () => {
  assert.equal(calcular({ precioLista: 100, descuentoPct: 0, piezas: -3 }).piezas, 0);
  assert.equal(calcular({ precioLista: 100, descuentoPct: 0, piezas: 2.6 }).piezas, 3);
  assert.equal(calcular({ precioLista: 100, precio: -5 }).precioNeto, 0);
});

test('margen total de la propuesta ponderado por monto; líneas sin costo quedan fuera del %', () => {
  const r = margenLineas([{ piezas: 150, precio: 1136.2, costo: 1002 }, { piezas: 200, precio: 887, costo: 700 }, { piezas: 10, precio: 50 }]);
  assert.equal(r.monto, 348330);
  assert.equal(r.utilidad, 57530);
  assert.equal(r.margenPct, 16.54);
  assert.equal(r.sinCosto, 1);
  assert.equal(margenLineas([]).margenPct, null);
});
