import test from 'node:test';
import assert from 'node:assert/strict';
import { ventana, mesesCerrados, estacionalidad, sugerir, redondear, validar, filasPlantilla, mesKey } from '../src/modules/comercial/proyectos/forecastCalc.js';

const hoy = new Date(2026, 9, 1); // 1 oct 2026
const V = ventana('2026-11', 6);
const serie = (obj) => new Map(Object.entries(obj));

test('ventana y meses cerrados', () => {
  assert.deepEqual(V.map((m) => m.key), ['2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04']);
  assert.deepEqual(mesesCerrados(3, hoy), ['2026-07', '2026-08', '2026-09']);
  assert.equal(V[0].label, 'Nov 26');
});

test('redondeo: múltiplos de 5 desde 20, enteros abajo, nunca negativo', () => {
  assert.equal(redondear(3.6), 4); assert.equal(redondear(22), 20); assert.equal(redondear(23), 25); assert.equal(redondear(-4), 0);
});

test('estacionalidad: sólo con ≥ 6 meses del año anterior y acotada', () => {
  const s = serie({ '2025-01': 10, '2025-02': 10, '2025-03': 10, '2025-04': 10, '2025-05': 10, '2025-06': 10, '2025-11': 30, '2025-12': 1 });
  assert.ok(Math.abs(estacionalidad(s, 2026, 11) - 1.6) < 1e-9, 'nov del año anterior fue 30 vs prom ~11 → tope 1.6');
  assert.equal(estacionalidad(s, 2026, 12), 0.6, 'dic fue 1 → piso 0.6');
  assert.equal(estacionalidad(s, 2026, 7), 1, 'sin venta ese mes → 1');
  assert.equal(estacionalidad(serie({ '2025-11': 30 }), 2026, 11), 1, 'menos de 6 meses → 1');
});

test('sugerido: base de 3 meses cerrados, inventario en exceso descontado, proyectos sumados, CRM excluido', () => {
  const series = new Map([
    ['AC-1', serie({ '2026-07': 90, '2026-08': 110, '2026-09': 100 })],   // base 100
    ['AC-2', serie({ '2026-07': 10, '2026-08': 10, '2026-09': 10 })],     // base 10, en el CRM
    ['AC-3', serie({ '2026-07': 40, '2026-08': 40, '2026-09': 40 })],     // base 40, stock 100 → exceso 60
  ]);
  const stock = new Map([['AC-3', 100]]);
  const proyectos = [{ sku: 'AC-1', key: '2026-12', piezas: 500, nombre: 'Escuelas', probabilidad: 'confirmado' }, { sku: 'AC-9', key: '2026-11', piezas: 30, nombre: 'Gabinetes', probabilidad: 'probable' }];
  const r = sugerir({ ventanaMeses: V, series, stock, proyectos, excluir: new Set(['AC-2']), hoy });
  const f1 = r.filas.find((f) => f.sku === 'AC-1');
  assert.equal(f1.meses['2026-11'], 100); assert.equal(f1.meses['2026-12'], 600, '100 base + 500 proyecto'); assert.equal(f1.origen, 'mixto');
  assert.match(f1.justificacion, /Ritmo de sell out de 100 pz\/mes/); assert.match(f1.justificacion, /Escuelas/);
  assert.ok(!r.filas.find((f) => f.sku === 'AC-2'), 'el SKU con forecast en el CRM no se sugiere'); assert.deepEqual(r.excluidos, ['AC-2']);
  const f3 = r.filas.find((f) => f.sku === 'AC-3');
  assert.equal(f3.meses['2026-11'], null, 'nov: 40 de demanda cubiertos por el exceso de 60');
  assert.equal(f3.meses['2026-12'], 20, 'dic: quedan 20 de exceso → 40 − 20');
  assert.equal(f3.meses['2027-01'], 40);
  const f9 = r.filas.find((f) => f.sku === 'AC-9');
  assert.equal(f9.origen, 'proyecto'); assert.equal(f9.meses['2026-11'], 30); assert.equal(f9.total, 30);
  assert.equal(r.totales.skus, 3);
});

test('roadmap acota, justificación mínima y filas de plantilla', () => {
  const series = new Map([['XX-1', serie({ '2026-09': 30 })], ['AC-1', serie({ '2026-09': 30 })]]);
  const roadmap = new Map([['AC-1', { descripcion: 'Monitor' }]]);
  const r = sugerir({ ventanaMeses: V, series, roadmap, hoy });
  assert.deepEqual(r.filas.map((f) => f.sku), ['AC-1']);
  assert.equal(r.filas[0].descripcion, 'Monitor');
  assert.deepEqual(validar([{ sku: 'A', meses: { '2026-11': 5 }, justificacion: 'corto' }]).map((e) => e.sku), ['A']);
  assert.equal(validar([{ sku: 'A', meses: { '2026-11': 0 }, justificacion: '' }]).length, 0, 'fila vacía no se valida');
  const p = filasPlantilla(r.filas, { tipo: 'directa', clienteCodigo: '00764' });
  assert.equal(p[0].cliente, '00764'); assert.equal(p[0].tipo, 'directa'); assert.ok(p[0].justificacion.length >= 15);
  assert.equal(mesKey(2027, 1), '2027-01');
});
