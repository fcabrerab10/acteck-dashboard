import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretarBusqueda, coincideSku, resumenBusqueda } from '../src/lib/buscarSku.js';

const cats = ['Monitores', 'Gabinetes', 'Fuentes de poder', 'Periféricos', 'Audio'];
const filas = [
  { sku: 'AC-943154', descripcion: 'Monitor Plano 27 VA Captive Vivid SP270 II / FHD / 100Hz', marca: 'ACTECK', categoria: 'Monitores' },
  { sku: 'BR-937658', descripcion: 'Fuente de Poder Balam Rush GR Burst 650W 80 Plus', marca: 'BALAM RUSH', categoria: 'Fuentes de poder' },
  { sku: 'AC-944526', descripcion: 'Monitor Plano 18.5 TN Captive Brite CB185 / HD / 60Hz', marca: 'ACTECK', categoria: 'Monitores' },
];
const busca = (q) => { const i = interpretarBusqueda(q, { categorias: cats }); return filas.filter((r) => coincideSku(r, i)).map((r) => r.sku); };

test('entiende SKU con o sin guion y parcial', () => {
  const i = interpretarBusqueda('943154', { categorias: cats });
  assert.equal(i.chips[0].tipo, 'sku');
  assert.deepEqual(busca('943154'), ['AC-943154']);
  assert.deepEqual(busca('ac-9431'), ['AC-943154']);
  assert.deepEqual(busca('AC9445'), ['AC-944526']);
});
test('entiende marca, categoría, pulgadas y palabras en cualquier orden', () => {
  assert.deepEqual(busca('balam'), ['BR-937658']);
  assert.deepEqual(busca('monitores'), ['AC-943154', 'AC-944526']);
  assert.deepEqual(busca('27 monitor'), ['AC-943154']);
  assert.deepEqual(busca('fuente 650'), ['BR-937658']);
  assert.deepEqual(busca('acteck monitores 18.5'), ['AC-944526']);
  const i = interpretarBusqueda('balam rush fuentes 650w', { categorias: cats });
  assert.deepEqual(i.chips.map((c) => c.tipo), ['marca', 'categoria', 'palabra']);
  assert.equal(resumenBusqueda(interpretarBusqueda('ac-9431 monitores', { categorias: cats })), 'SKU AC-9431 · Categoría Monitores');
});
test('sin acentos ni signos, vacío = todo', () => {
  assert.deepEqual(busca('Perifericos'), []);
  assert.equal(interpretarBusqueda('   ').vacio, true);
  assert.deepEqual(busca('vivid, sp270'), ['AC-943154']);
});
