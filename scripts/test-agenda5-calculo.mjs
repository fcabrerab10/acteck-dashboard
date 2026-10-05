import test from 'node:test';
import assert from 'node:assert/strict';
import { hoyDe, bandejaDe, pendientesDe, porProyecto, conteosMes, bloquesDia, fraseHoy, siguienteDe } from '../src/modules/agenda5/calculo.js';
const hoy = new Date(2026, 9, 4, 9, 0); const U = 'u-f';
const items = [
  { id: '1', estado: 'abierta', propietario: U, titulo: 'Propuesta', cuando: '2026-10-04', hora: '10:00', duracion_min: 45, created_at: '1' },
  { id: '2', estado: 'abierta', propietario: U, titulo: 'Llamar', cuando: '2026-10-04', duracion_min: 15, created_at: '2' },
  { id: '3', estado: 'abierta', propietario: U, titulo: 'De ayer', cuando: '2026-10-03', created_at: '3' },
  { id: '4', estado: 'abierta', propietario: U, titulo: 'Idea suelta', bandeja: true, tipo: 'idea', created_at: '4' },
  { id: '5', estado: 'hecha', propietario: U, titulo: 'Hecha hoy', cuando: '2026-10-04', min_real: 52, completado_en: '2026-10-04T08:00:00Z', created_at: '5' },
  { id: '6', estado: 'abierta', propietario: 'u-k', titulo: 'De Karolina', cuando: '2026-10-04', created_at: '6' },
  { id: '7', estado: 'abierta', propietario: U, titulo: 'Vence hoy sin cuando', fecha_limite: '2026-10-04', created_at: '7' },
  { id: '8', estado: 'abierta', propietario: U, titulo: 'Próxima semana', fecha_limite: '2026-10-09', created_at: '8' },
  { id: '9', estado: 'abierta', propietario: U, titulo: 'Algún día', cuando: '2026-10-01', snooze_hasta: '2026-11-01', created_at: '9' },
  { id: '10', estado: 'abierta', propietario: U, titulo: 'En proyecto', proyecto_id: 'p1', created_at: '10' },
];
test('hoy', () => {
  const h = hoyDe(items, U, hoy, { reuniones: [{ id: 'r', fecha: '2026-10-04T12:30:00', duracion_min: 30, titulo: '1:1' }], ahora: hoy });
  assert.deepEqual(h.deHoy.map((i) => i.id), ['1', '2', '7']); assert.deepEqual(h.deAyer.map((i) => i.id), ['3']); assert.deepEqual(h.hechasHoy.map((i) => i.id), ['5']);
  assert.equal(h.minTareas, 60); assert.equal(h.minReuniones, 30); assert.equal(h.minReales, 52); assert.equal(h.cierre.getHours(), 10); assert.equal(h.sinEstimado, 1);
  assert.match(fraseHoy(h), /3 pendientes · 1 h planeadas · 1 reunión · 1 de ayer · con eso cierras a las 10:00/);
  const b = bloquesDia(h, { hoyIso: '2026-10-04' }); assert.deepEqual(b.map((x) => x.id), ['t-1', 'r-r']);
});
test('bandeja, pendientes, proyectos, conteos', () => {
  assert.deepEqual(bandejaDe(items, U, hoy).map((i) => i.id), ['4']);
  const p = pendientesDe(items, U, hoy);
  assert.deepEqual(p.vencidos.map((i) => i.id), ['3']); assert.deepEqual(p.hoy.map((i) => i.id), ['1', '2', '7']); assert.deepEqual(p.proximos.map((i) => i.id), ['8']); assert.deepEqual(p.cuandoSea.map((i) => i.id), ['10']); assert.deepEqual(p.algunDia.map((i) => i.id), ['9']);
  const pr = porProyecto(items, [{ id: 'p1', nombre: 'Bocinas', area_id: 'a1' }], [{ id: 'a1', nombre: 'Digitalife' }], U);
  assert.equal(pr[0].proyectos[0].items.length, 1); assert.equal(pr[0].abiertos, 1);
  const c = conteosMes(items, U); assert.equal(c.get('2026-10-04').tareas, 3); assert.equal(c.get('2026-10-04').hechas, 1); assert.equal(c.get('2026-10-09').tareas, 1);
});
test('siguienteDe: qué toca ahora y la cola del día', () => {
  const h = hoyDe(items, U, hoy, { reuniones: [{ id: 'r', fecha: '2026-10-04T12:30:00', duracion_min: 30, titulo: '1:1' }], ahora: hoy });
  const s = siguienteDe(h, new Date(2026, 9, 4, 10, 10), { hoyIso: '2026-10-04' });
  assert.equal(s.actual?.id, 't-1');                       // la tarea de las 10:00 está en curso
  assert.equal(s.cola[0].id, '1');                          // y encabeza la cola
  assert.ok(s.cola.some((i) => i.id === '3'));              // el vencido va antes que lo sin hora
  assert.ok(s.cola.findIndex((i) => i.id === '3') < s.cola.findIndex((i) => i.id === '2'));
  assert.equal(new Set(s.cola.map((i) => i.id)).size, s.cola.length);
  const t = siguienteDe(h, new Date(2026, 9, 4, 7, 0), { hoyIso: '2026-10-04' });
  assert.equal(t.actual, null); assert.equal(t.proximo?.id, 't-1'); assert.equal(t.minutosLibres, 180);
});
