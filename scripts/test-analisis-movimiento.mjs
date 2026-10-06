// «Dónde está el movimiento» · pruebas del cálculo puro.
//   node --test scripts/test-analisis-movimiento.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { movimientos, explicar } from '../src/modules/comercial/analisis/movimiento.js';

// Sell in de un cliente (mv_analisis_cliente_sku_mes): sep y oct 2026 + algo de historia.
const SKU = [
  { anio: 2026, mes: 10, articulo: 'AC-943154', categoria: 'Monitores', fact_neta: 186000, piezas_venta_neta: 150 }, // primera vez
  { anio: 2026, mes: 9,  articulo: 'AC-944526', categoria: 'Monitores', fact_neta: 58000,  piezas_venta_neta: 40 },  // se cae a nada
  { anio: 2026, mes: 9,  articulo: 'BR-937658', categoria: 'Fuentes',   fact_neta: 35000,  piezas_venta_neta: 50 },
  { anio: 2026, mes: 10, articulo: 'BR-937658', categoria: 'Fuentes',   fact_neta: 71000,  piezas_venta_neta: 100 }, // el doble
  { anio: 2026, mes: 8,  articulo: 'BR-937658', categoria: 'Fuentes',   fact_neta: 30000,  piezas_venta_neta: 42 },
  { anio: 2026, mes: 9,  articulo: 'AC-935845', categoria: 'Gabinetes', fact_neta: 34000,  piezas_venta_neta: 70 },
  { anio: 2026, mes: 10, articulo: 'AC-935845', categoria: 'Gabinetes', fact_neta: 0,      piezas_venta_neta: 0 },
  { anio: 2026, mes: 9,  articulo: 'AC-900001', categoria: 'Audio',     fact_neta: 10000,  piezas_venta_neta: 10 },
  { anio: 2026, mes: 10, articulo: 'AC-900001', categoria: 'Audio',     fact_neta: 10500,  piezas_venta_neta: 11 },  // < umbral
  { anio: 2025, mes: 10, articulo: 'AC-944526', categoria: 'Monitores', fact_neta: 50000,  piezas_venta_neta: 35 },  // historia
];
const CAT = [
  { anio: 2026, mes: 9,  categoria: 'Monitores', fact_neta: 58000 }, { anio: 2026, mes: 10, categoria: 'Monitores', fact_neta: 186000 },
  { anio: 2026, mes: 9,  categoria: 'Fuentes',   fact_neta: 35000 }, { anio: 2026, mes: 10, categoria: 'Fuentes',   fact_neta: 71000 },
  { anio: 2026, mes: 9,  categoria: 'Gabinetes', fact_neta: 34000 }, { anio: 2026, mes: 10, categoria: 'Gabinetes', fact_neta: 0 },
];
const DESC = { 'AC-943154': 'Monitor Vivid 27', 'AC-944526': 'Monitor Brite 18.5' };
const grupos = [
  { tipo: 'SKU', filas: SKU, clave: 'articulo', valor: 'fact_neta', piezas: 'piezas_venta_neta', etiqueta: (k) => DESC[k] || '' },
  { tipo: 'Categoría', filas: CAT, clave: 'categoria', valor: 'fact_neta' },
];
const categoriaDe = Object.fromEntries(SKU.map((r) => [r.articulo, r.categoria]));

test('movimientos · subidas y bajadas en pesos, ordenadas por tamaño, con explicación', () => {
  const r = movimientos({ grupos, anio: 2026, mes: 10, top: 6, categoriaDe });
  assert.equal(r.mesLbl, 'oct'); assert.equal(r.mesPrevLbl, 'sep');
  const claves = r.filas.map((f) => `${f.tipo}:${f.clave}`);
  assert.ok(claves.includes('SKU:AC-943154'), 'el monitor nuevo sube');
  assert.ok(claves.includes('SKU:AC-944526'), 'el monitor que se cayó baja');
  assert.ok(claves.includes('SKU:BR-937658'));
  assert.ok(!claves.includes('SKU:AC-900001'), 'un movimiento de $500 queda fuera (umbral)');
  // La categoría Monitores sube +128K, pero AC-943154 (+186K) ya la explica: no se repite. Gabinetes tampoco (AC-935845 la explica).
  assert.ok(!claves.includes('Categoría:Monitores'));
  assert.ok(!claves.includes('Categoría:Gabinetes'));
  assert.equal(r.filas[0].clave, 'AC-943154', 'el mayor en valor absoluto va primero');
  assert.equal(r.filas[0].etiqueta, 'Monitor Vivid 27');
  assert.equal(r.filas[0].explicacion, '150 pz · por primera vez');
  const brite = r.filas.find((f) => f.clave === 'AC-944526');
  assert.equal(brite.delta, -58000);
  assert.equal(brite.explicacion, 'en sep $58K · en oct nada');
  assert.equal(brite.primeraVez, false, 'tenía historia en 2025');
  assert.equal(r.filas.find((f) => f.clave === 'BR-937658').explicacion, 'el doble que en sep');
  assert.equal(r.filas.find((f) => f.clave === 'AC-935845').explicacion, 'en sep $34K · en oct nada');
  assert.ok(r.suben.length >= 2 && r.bajan.length >= 2);
});

test('movimientos · sin categoriaDe, la categoría sí entra; top recorta', () => {
  const r = movimientos({ grupos, anio: 2026, mes: 10, top: 3 });
  assert.equal(r.filas.length, 3);
  assert.ok(movimientos({ grupos, anio: 2026, mes: 10, top: 10 }).filas.some((f) => f.tipo === 'Categoría'));
});

test('movimientos · enero compara contra diciembre del año anterior y vacío no rompe', () => {
  const g = [{ tipo: 'SKU', filas: [{ anio: 2025, mes: 12, sku: 'X', importe: 5000 }, { anio: 2026, mes: 1, sku: 'X', importe: 12000 }], clave: 'sku', valor: 'importe' }];
  const r = movimientos({ grupos: g, anio: 2026, mes: 1 });
  assert.equal(r.mesPrevLbl, 'dic');
  assert.equal(r.filas[0].delta, 7000);
  assert.equal(r.filas[0].explicacion, '+140 % vs dic');
  assert.deepEqual(movimientos({ grupos: [], anio: 2026, mes: 1 }).filas, []);
});

test('explicar · mitad, piezas y nada previo sin historia', () => {
  assert.equal(explicar({ act: 50, prev: 100, pzAct: 0, pzPrev: 0 }, 'oct', 'sep'), 'la mitad que en sep');
  assert.equal(explicar({ act: 5000, prev: 4000, pzAct: 150, pzPrev: 70 }, 'oct', 'sep'), 'de 70 a 150 pz');
  assert.equal(explicar({ act: 9000, prev: 0, pzAct: 0, pzPrev: 0, primeraVez: false }, 'oct', 'sep'), 'en sep nada · en oct $9K');
});
