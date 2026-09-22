// Pruebas de la fuente única de marcas propias (src/lib/marcas.js).
//   node --test scripts/test-marcas.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MARCAS_PROPIAS, MARCAS_CASA_LABEL, marcaDeSku, esSkuPropio, normalizarMarca,
  esMarcaPropia, marcaPropia, colorMarca, etiquetaMarcasCliente, OPCIONES_MARCA_PROPIA,
} from '../src/lib/marcas.js';

test('las tres marcas de la casa están dadas de alta, en orden', () => {
  assert.deepEqual(MARCAS_PROPIAS.map((m) => m.key), ['acteck', 'balamrush', 'audive']);
  assert.deepEqual(MARCAS_PROPIAS.map((m) => m.label), ['Acteck', 'Balam Rush', 'Audive']);
  assert.equal(OPCIONES_MARCA_PROPIA.length, 3);
});

test('marcaDeSku infiere la marca del prefijo, con o sin guion', () => {
  assert.equal(marcaDeSku('AV-946360'), 'Audive');
  assert.equal(marcaDeSku('av-946384'), 'Audive');
  assert.equal(marcaDeSku('AC-935555'), 'Acteck');
  assert.equal(marcaDeSku('AC935555'), 'Acteck');
  assert.equal(marcaDeSku('BR-929222'), 'Balam Rush');
});

test('marcaDeSku conserva los prefijos de terceros que ya se usaban', () => {
  assert.equal(marcaDeSku('SW-1234'), 'Swann');
  assert.equal(marcaDeSku('ES-1234'), 'Acteck');
  assert.equal(marcaDeSku('MG-1234'), 'DXT Gaming');
  assert.equal(marcaDeSku('NA-1234'), 'Xtreme PC');
});

test('marcaDeSku devuelve null cuando no reconoce el prefijo', () => {
  assert.equal(marcaDeSku('XX-1'), null);
  assert.equal(marcaDeSku(''), null);
  assert.equal(marcaDeSku(null), null);
  assert.equal(marcaDeSku(undefined), null);
});

test('esSkuPropio sólo es cierto para AC / BR / AV', () => {
  assert.equal(esSkuPropio('AV-946360'), true);
  assert.equal(esSkuPropio('BR-1'), true);
  assert.equal(esSkuPropio('SW-1'), false, 'Swann es de terceros');
  assert.equal(esSkuPropio('ES-1'), false, 'prefijo viejo: se reconoce pero no es propio por prefijo');
});

test('normalizarMarca colapsa las variantes de escritura', () => {
  assert.equal(normalizarMarca('ACTECK'), 'Acteck');
  assert.equal(normalizarMarca(' acteck '), 'Acteck');
  assert.equal(normalizarMarca('BALAM RUSH'), 'Balam Rush');
  assert.equal(normalizarMarca('Balam'), 'Balam Rush');
  assert.equal(normalizarMarca('Balam Rush Spectrum'), 'Balam Rush', 'Spectrum es modelo, no marca');
  assert.equal(normalizarMarca('AUDIVE'), 'Audive');
  assert.equal(normalizarMarca('audive'), 'Audive');
});

test('normalizarMarca no inventa: lo desconocido vuelve recortado, lo vacío vuelve vacío', () => {
  assert.equal(normalizarMarca(' Vorago '), 'Vorago');
  assert.equal(normalizarMarca(''), '');
  assert.equal(normalizarMarca(null), '');
  assert.equal(normalizarMarca(undefined), '');
});

test('esMarcaPropia acepta cualquier variante de escritura', () => {
  assert.equal(esMarcaPropia('AUDIVE'), true);
  assert.equal(esMarcaPropia('Balam Rush Spectrum'), true);
  assert.equal(esMarcaPropia('Vorago'), false);
  assert.equal(esMarcaPropia(''), false);
});

test('colorMarca da el color oficial y un gris neutro para lo demás', () => {
  assert.equal(colorMarca('ACTECK'), '#007AFF');
  assert.equal(colorMarca('Balam Rush'), '#8B5CF6');
  assert.equal(colorMarca('Audive'), '#FF9500');
  assert.equal(colorMarca('Vorago'), '#8E8E93');
  assert.equal(colorMarca('Vorago', '#123456'), '#123456');
});

test('marcaPropia funciona con key y con etiqueta', () => {
  assert.equal(marcaPropia('audive')?.label, 'Audive');
  assert.equal(marcaPropia('Audive')?.key, 'audive');
  assert.equal(marcaPropia('balamrush')?.color, '#8B5CF6');
  assert.equal(marcaPropia('Vorago'), null);
});

test('etiquetaMarcasCliente arma la línea de los clientes', () => {
  assert.equal(etiquetaMarcasCliente(['acteck', 'balamrush', 'audive']), 'Acteck · Balam Rush · Audive');
  assert.equal(etiquetaMarcasCliente(['acteck']), 'Acteck');
  assert.equal(etiquetaMarcasCliente([]), '');
  assert.equal(MARCAS_CASA_LABEL, 'Acteck · Balam Rush · Audive');
});
