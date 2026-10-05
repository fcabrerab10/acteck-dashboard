import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretarCaptura, duracionNatural, etiquetaFecha } from '../src/modules/agenda5/interpretar.js';
const hoy = new Date(2026, 9, 4); // sábado 4 oct 2026
const personas = [{ user_id: 'u-k', nombre: 'Karolina Veliz', email: 'karolina.veliz@acteck.com', handle: 'karolina' }, { user_id: 'u-f', nombre: 'Fernando Cabrera', email: 'fernando.cabrera@acteck.com', handle: 'fernando' }];
test('captura completa', () => {
  const r = interpretarCaptura('Llamar a Juan mañana 10am 30m #Dicotech @karolina p1', personas, hoy);
  assert.equal(r.titulo, 'Llamar a Juan'); assert.equal(r.cuando, '2026-10-05'); assert.equal(r.hora, '10:00'); assert.equal(r.duracion_min, 30);
  assert.equal(r.cliente_key, 'dicotech'); assert.deepEqual(r.responsables, ['u-k']); assert.equal(r.prioridad, 'alta'); assert.equal(r.tipo, 'tarea'); assert.equal(r.bandeja, false);
  assert.ok(r.chips.map((c) => c.label).includes('Mañana 10:00'));
});
test('idea sin fecha va a la bandeja; duración en horas', () => {
  const r = interpretarCaptura('Idea: kit de bocinas para CT 1h30', personas, hoy);
  assert.equal(r.tipo, 'idea'); assert.equal(r.titulo, 'kit de bocinas para CT'); assert.equal(r.duracion_min, 90); assert.equal(r.bandeja, true); assert.equal(r.cuando, null);
  assert.equal(duracionNatural('revisar por 45 min el forecast').min, 45); assert.equal(duracionNatural('revisar por 45 min el forecast').texto, 'revisar el forecast');
});
test('hoy a las 4 → hoy 16:00; lunes → fecha límite', () => {
  const a = interpretarCaptura('Cuadrar apoyos hoy a las 4', personas, hoy);
  assert.equal(a.cuando, '2026-10-04'); assert.equal(a.hora, '16:00'); assert.equal(a.fecha_limite, null);
  const b = interpretarCaptura('Entregar propuesta el lunes !!', personas, hoy);
  assert.equal(b.cuando, '2026-10-05'); assert.equal(b.fecha_limite, '2026-10-05'); assert.equal(b.prioridad, 'media');
  assert.equal(etiquetaFecha('2026-10-07', hoy), 'mié'); assert.equal(etiquetaFecha('2026-11-20', hoy), '20 nov');
});
