// Pruebas de las funciones puras de Estrategia de Precios (elasticidad, simulador, precio bajo por cliente).
//   node scripts/test-precios-elasticidad.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { elasticidadSku, elasticidadPorCategoria, elegirElasticidad, ritmoMensual, simular, precioBajoPorCliente, ELASTICIDAD_DEFAULT } from '../src/modules/comercial/precios/elasticidad.js';

const HOY = new Date(2026, 8, 10); // 10 sep 2026 → último mes cerrado: ago 2026
const fila = (anio, mes, piezas, monto = piezas * 100, cliente_nombre = 'CVA', cliente_key = 'mayoreo') => ({ anio, mes, piezas, monto, cliente_nombre, cliente_key });

test('elasticidadSku: subida del 10 % en abr-2026 con −12 % de piezas → −1.2 (ventana cerrada)', () => {
  // ene-mar: 100 pz/mes · abr (cambio) · may-jul: 88 pz/mes · ago cerrado
  const fact = [fila(2026, 1, 100), fila(2026, 2, 100), fila(2026, 3, 100), fila(2026, 4, 95), fila(2026, 5, 88), fila(2026, 6, 88), fila(2026, 7, 88), fila(2026, 8, 90)];
  const r = elasticidadSku({ cambios: [{ lista: 'Mayoreo AAA', anio: 2026, mes: 4, de: 100, a: 110 }], fact, hoy: HOY });
  assert.equal(r.filas.length, 1);
  const f = r.filas[0];
  assert.equal(f.cerrado, true);
  assert.ok(Math.abs(f.deltaPrecioPct - 10) < 1e-9);
  assert.equal(f.antes, 100);
  assert.equal(f.despues, 88);
  assert.ok(Math.abs(f.deltaPzPct - -12) < 1e-9);
  assert.ok(Math.abs(f.elasticidad - -1.2) < 1e-9);
  assert.ok(Math.abs(r.elasticidad - -1.2) < 1e-9);
  assert.equal(r.n, 1);
});

test('elasticidadSku: ventana abierta (cambio en jul-2026, hoy 10 sep) queda pendiente y no promedia', () => {
  const fact = [fila(2026, 4, 100), fila(2026, 5, 100), fila(2026, 6, 100), fila(2026, 8, 50)];
  const r = elasticidadSku({ cambios: [{ lista: 'Mayoreo AAA', anio: 2026, mes: 7, de: 100, a: 120 }], fact, hoy: HOY });
  assert.equal(r.filas[0].cerrado, false);
  assert.equal(r.filas[0].elasticidad, null);
  assert.equal(r.elasticidad, null);
  assert.equal(r.pendientes, 1);
  assert.equal(r.cerrados, 0);
});

test('elasticidadSku: ignora otras listas, cambios sin precio anterior y promedia varios cambios', () => {
  const fact = [];
  for (let m = 1; m <= 12; m++) fact.push(fila(2025, m, m <= 3 ? 100 : m <= 7 ? 80 : 120)); // caída tras abr, subida tras ago
  fact.push(fila(2026, 1, 120), fila(2026, 2, 120), fila(2026, 3, 120));
  const cambios = [
    { lista: 'Mayoreo AAA', anio: 2025, mes: 4, de: 100, a: 120 },   // +20 % precio · pz 100 → 80 (−20 %) → −1.0
    { lista: 'Mayoreo AAA', anio: 2025, mes: 8, de: 120, a: 96 },    // −20 % precio · pz 80 → 120 (+50 %) → −2.5
    { lista: 'DICOTECH', anio: 2025, mes: 6, de: 90, a: 99 },        // otra lista: fuera
    { lista: 'Mayoreo AAA', anio: 2025, mes: 10, de: 0, a: 99 },     // sin precio anterior: fuera
  ];
  const r = elasticidadSku({ cambios, fact, hoy: HOY });
  assert.equal(r.filas.length, 2);
  assert.equal(r.filas[0].mes, 8); // orden: más reciente primero
  assert.ok(Math.abs(r.filas[1].elasticidad - -1.0) < 1e-9);
  assert.ok(Math.abs(r.filas[0].elasticidad - -2.5) < 1e-9);
  assert.ok(Math.abs(r.elasticidad - -1.75) < 1e-9);
});

test('elasticidadSku: sin cambios → bloque vacío', () => {
  const r = elasticidadSku({ cambios: [], fact: [fila(2026, 5, 10)], hoy: HOY });
  assert.deepEqual(r, { filas: [], elasticidad: null, n: 0, cerrados: 0, pendientes: 0 });
});

test('elasticidadPorCategoria: promedio simple de los SKUs con elasticidad; ignora SKUs sin ventana cerrada', () => {
  const factA = [fila(2026, 1, 100), fila(2026, 2, 100), fila(2026, 3, 100), fila(2026, 5, 90), fila(2026, 6, 90), fila(2026, 7, 90)]; // −10 % pz
  const factB = [fila(2026, 1, 50), fila(2026, 2, 50), fila(2026, 3, 50), fila(2026, 5, 35), fila(2026, 6, 35), fila(2026, 7, 35)];    // −30 % pz
  const cambiosPorSku = new Map([
    ['A', [{ lista: 'Mayoreo AAA', anio: 2026, mes: 4, de: 100, a: 110 }]], // −1.0
    ['B', [{ lista: 'Mayoreo AAA', anio: 2026, mes: 4, de: 100, a: 110 }]], // −3.0
    ['C', [{ lista: 'Mayoreo AAA', anio: 2026, mes: 8, de: 100, a: 110 }]], // pendiente
    ['D', [{ lista: 'Mayoreo AAA', anio: 2026, mes: 4, de: 100, a: 110 }]], // sin categoría
  ]);
  const factPorSku = new Map([['A', factA], ['B', factB], ['C', factA], ['D', factA]]);
  const cat = { A: 'Mouse', B: 'Mouse', C: 'Mouse', D: null };
  const r = elasticidadPorCategoria({ cambiosPorSku, factPorSku, categoriaDe: (s) => cat[s], hoy: HOY });
  assert.equal(r.size, 1);
  assert.equal(r.get('Mouse').n, 2);
  assert.ok(Math.abs(r.get('Mouse').elasticidad - -2.0) < 1e-9);
});

test('elegirElasticidad: SKU → categoría → supuesto → default', () => {
  assert.deepEqual(elegirElasticidad({ sku: -0.8, categoria: -1.5, supuesto: -2 }), { valor: -0.8, origen: 'sku' });
  assert.deepEqual(elegirElasticidad({ sku: null, categoria: -1.5, supuesto: -2 }), { valor: -1.5, origen: 'categoria' });
  assert.deepEqual(elegirElasticidad({ supuesto: '-2' }), { valor: -2, origen: 'supuesto' });
  assert.deepEqual(elegirElasticidad({}), { valor: ELASTICIDAD_DEFAULT, origen: 'default' });
});

test('ritmoMensual: promedio de los 3 meses cerrados (jun-ago con hoy = 10 sep), sin el mes en curso', () => {
  const fact = [fila(2026, 5, 999), fila(2026, 6, 100), fila(2026, 7, 200), fila(2026, 8, 300), fila(2026, 9, 5000)];
  assert.equal(ritmoMensual(fact, { hoy: HOY }), 200);
  assert.equal(ritmoMensual([fila(2026, 8, 30)], { hoy: HOY }), 10); // meses sin dato cuentan como 0
});

test('simular: +10 % de precio con elasticidad −1.2 → −12 % piezas; IVA, margen y Δ monto', () => {
  const s = simular({ precioActual: 100, precioNuevo: 110, costo: 70, ritmo: 200, elasticidad: -1.2 });
  assert.ok(Math.abs(s.deltaPrecioPct - 10) < 1e-9);
  assert.ok(Math.abs(s.conIva - 127.6) < 1e-9);
  assert.ok(Math.abs(s.margenPct - (40 / 110) * 100) < 1e-9);
  assert.ok(Math.abs(s.margenActualPct - 30) < 1e-9);
  assert.ok(Math.abs(s.piezasEstimadas - 176) < 1e-9);
  assert.ok(Math.abs(s.deltaPiezasPct - -12) < 1e-9);
  assert.equal(s.montoActual, 20000);
  assert.ok(Math.abs(s.montoEstimado - 19360) < 1e-9);
  assert.ok(Math.abs(s.deltaMonto - -640) < 1e-9);
});

test('simular: sin costo no hay margen; las piezas nunca bajan de 0; precio sin cambio = todo igual', () => {
  const s = simular({ precioActual: 100, precioNuevo: 300, costo: 0, ritmo: 50, elasticidad: -1.2 });
  assert.equal(s.margenPct, null);
  assert.equal(s.piezasEstimadas, 0);
  const t = simular({ precioActual: 100, precioNuevo: 100, costo: 60, ritmo: 50, elasticidad: -1.2 });
  assert.equal(t.deltaPrecioPct, 0); assert.equal(t.piezasEstimadas, 50); assert.equal(t.deltaMonto, 0);
});

test('precioBajoPorCliente: sólo meses bajo la lista (−0.5 %), agrega por cliente, "desde" = primer mes, orden por dejado', () => {
  const listaDe = (f) => (f.cliente_key === 'pcel' ? 'PCEL PROVISIONAL' : 'Mayoreo AAA');
  const precioDeLista = (l) => ({ 'Mayoreo AAA': 100, 'PCEL PROVISIONAL': 95 }[l] ?? null);
  const fact = [
    fila(2026, 2, 10, 10 * 99.6, 'CVA', 'mayoreo'),   // 99.6 ≥ 99.5 → dentro de tolerancia, NO cuenta
    fila(2026, 3, 10, 10 * 90, 'CVA', 'mayoreo'),     // bajo · desde mar
    fila(2026, 5, 20, 20 * 95, 'CVA', 'mayoreo'),     // bajo
    fila(2026, 6, 50, 50 * 100, 'CVA', 'mayoreo'),    // a lista, no cuenta
    fila(2026, 1, 100, 100 * 80, 'PC ONLINE', 'pcel'),// bajo vs PCEL 95 · desde ene
    fila(2025, 12, 100, 100 * 10, 'PC ONLINE', 'pcel'),// otro año, fuera
    fila(2026, 4, 5, 5 * 50, 'DESCONOCIDO', 'otro'),  // lista AAA 100 → bajo
  ];
  const r = precioBajoPorCliente(fact, { listaDe, precioDeLista, anio: 2026 });
  assert.deepEqual(r.map((c) => c.cliente), ['PC ONLINE', 'DESCONOCIDO', 'CVA']);
  const pc = r[0];
  assert.equal(pc.lista, 'PCEL PROVISIONAL'); assert.equal(pc.piezas, 100); assert.equal(pc.real, 80); assert.equal(pc.dejado, 1500);
  assert.deepEqual(pc.desde, { anio: 2026, mes: 1 });
  const cva = r[2];
  assert.equal(cva.piezas, 30); assert.equal(cva.meses, 2);
  assert.ok(Math.abs(cva.real - (900 + 1900) / 30) < 1e-9);
  assert.deepEqual(cva.desde, { anio: 2026, mes: 3 });
  assert.ok(Math.abs(cva.dejado - (100 - cva.real) * 30) < 1e-9);
});
