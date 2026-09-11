// Pruebas del parser "Pegar correo" del Tracking Pedidos (sin ejemplos reales todavía: casos sintéticos tolerantes).
//   node scripts/test-tracking-parser.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { parsearCorreoOC, parsearLinea, detectarOC, detectarFecha, detectarCliente } from '../src/modules/comercial/tracking/parserCorreoOC.js';

test('correo típico: OC etiquetada, cliente, fecha y líneas con cantidad', () => {
  const txt = `Asunto: Orden de compra 4500218 – PC Online
Buen día Karolina, adjunto la OC 4500218 con fecha 04/09/2026.
AC-943178 Mouse Acteck Óptico 200 pz $100.00
AC-943253  Monitor 21.5 VA CL215   150 pzas
AC-939409 - Monitor 19.5 CB195 x 70
Saludos`;
  const r = parsearCorreoOC(txt);
  assert.equal(r.cliente_key, 'pcel');
  assert.equal(r.numero_oc, '4500218');
  assert.equal(r.fecha, '2026-09-04');
  assert.equal(r.lineas.length, 3);
  assert.deepEqual(r.lineas.map((l) => [l.sku, l.cantidad]), [['AC-943178', 200], ['AC-943253', 150], ['AC-939409', 70]]);
  assert.equal(r.lineas[0].precio, 100);
  assert.match(r.lineas[1].descripcion, /Monitor 21.5/);
  assert.equal(r.avisos.length, 0);
});

test('tabla pegada con tabs y cantidad antes del SKU; unidades no se confunden con cantidad', () => {
  const txt = `Digitalife · OC-48211 · 8 de septiembre de 2026
Cant\tSKU\tDescripción
640\tBR-943918\tGabinete Nitrox Glow 4700C 500 W
2,000\tAC-928830\tCable 1.5 m 16 GB`;
  const r = parsearCorreoOC(txt);
  assert.equal(r.cliente_key, 'digitalife');
  assert.equal(r.numero_oc, 'OC-48211');
  assert.equal(r.fecha, '2026-09-08');
  assert.deepEqual(r.lineas.map((l) => [l.sku, l.cantidad]), [['BR-943918', 640], ['AC-928830', 2000]]);
});

test('sin etiqueta de OC ni cliente: avisa y propone el primer número suelto; Dicotech por Revko', () => {
  const r = parsearCorreoOC('Favor de surtir 174804 para Revko.\nES-123456 50 unidades');
  assert.equal(r.cliente_key, 'dicotech');
  assert.equal(r.numero_oc, '174804');
  assert.ok(r.avisos.some((a) => /sin etiqueta/.test(a)));
  assert.ok(r.avisos.some((a) => /Sin fecha/.test(a)));
  assert.equal(r.lineas[0].cantidad, 50);
});

test('línea sin cantidad avisa; SKU repetido suma; texto vacío', () => {
  const r = parsearCorreoOC('OC DT-0931\nAC-943178 Mouse\nAC-943178 20 pz');
  assert.equal(r.numero_oc, 'DT-0931');
  assert.equal(r.lineas.length, 1);
  assert.equal(r.lineas[0].cantidad, 20);
  assert.ok(r.avisos.some((a) => /repetido/.test(a)));
  const v = parsearCorreoOC('');
  assert.equal(v.lineas.length, 0);
  assert.equal(v.avisos.length, 1);
});

test('detectores sueltos', () => {
  assert.equal(detectarOC('Orden de compra: 4500218').numero_oc, '4500218');
  assert.equal(detectarOC('O.C. #48211').numero_oc, '48211');
  assert.equal(detectarOC('Pedido No. 174804').numero_oc, '174804');
  assert.equal(detectarOC('PO-12345').numero_oc, 'PO-12345');
  assert.equal(detectarOC('nada').numero_oc, '');
  assert.equal(detectarFecha('entregar el 2026-09-21'), '2026-09-21');
  assert.equal(detectarFecha('fecha 21-09-26'), '2026-09-21');
  assert.equal(detectarFecha('el 21 sep 2026'), '2026-09-21');
  assert.equal(detectarFecha('sin fecha'), null);
  assert.equal(detectarCliente('para API GLOBAL'), 'digitalife');
  assert.equal(detectarCliente('hola'), null);
  assert.deepEqual(parsearLinea('AC-943178 Monitor 27" 144 Hz 120 pz'), { sku: 'AC-943178', cantidad: 120, precio: 0, descripcion: 'Monitor 27" 144 Hz' });
  assert.equal(parsearLinea('sin sku'), null);
});
