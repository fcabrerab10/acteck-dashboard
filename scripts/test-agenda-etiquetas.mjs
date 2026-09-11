// Pruebas de las etiquetas de Agenda (#cliente · @persona · /categoría).
//   node scripts/test-agenda-etiquetas.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { parsearEtiquetas, tokenActivo, sugerencias, aplicarSugerencia, handleDe, conHandles, textoConEtiquetas, buscarCliente, buscarCategoria, normalizar } from '../src/modules/agenda/etiquetas.js';

const P = [
  { user_id: 'u-fer', nombre: 'Fernando Cabrera', email: 'fernando.cabrera@acteck.com' },
  { user_id: 'u-kar', nombre: 'Karolina Veliz', email: 'karolina.veliz@acteck.com' },
  { user_id: 'u-dav', nombre: 'David Millan', email: 'dmillan@acteck.com' },
  { user_id: 'u-dav2', nombre: 'David Perez', email: 'dperez@acteck.com' },
];

test('parsea #cliente @persona /categoría y limpia el título', () => {
  const r = parsearEtiquetas('Enviar estado de cuenta #pcel @karolina /pagos', P);
  assert.equal(r.titulo, 'Enviar estado de cuenta');
  assert.equal(r.cliente_key, 'pcel');
  assert.deepEqual(r.responsables, ['u-kar']);
  assert.equal(r.categoria, 'pagos');
  assert.deepEqual(r.desconocidas, []);
});

test('alias de cliente y categoría, acentos, mayúsculas', () => {
  assert.equal(parsearEtiquetas('Rebate #DL', P).cliente_key, 'digitalife');
  assert.equal(parsearEtiquetas('Rebate #Dicotech /Logística', P).categoria, 'logistico');
  assert.equal(parsearEtiquetas('Junta #interno /Administración', P).categoria, 'administracion');
  assert.equal(buscarCliente('mercadolibre'), 'mercadolibre');
  assert.equal(buscarCategoria('mkt'), 'marketing');
  assert.equal(normalizar('Logística Ñ'), 'logistica n');
});

test('@persona desconocida se queda en el título y se reporta', () => {
  const r = parsearEtiquetas('Llamar @juan mañana', P);
  assert.equal(r.titulo, 'Llamar @juan mañana');
  assert.deepEqual(r.responsables, []);
  assert.deepEqual(r.desconocidas, ['@juan']);
});

test('varias personas, sin duplicar; handle con apellido cuando choca el nombre', () => {
  const r = parsearEtiquetas('Revisar @fernando @david.millan @fernando', P);
  assert.deepEqual(r.responsables, ['u-fer', 'u-dav']);
  assert.equal(handleDe(P[2], P), 'david.millan');
  assert.equal(handleDe(P[1], P), 'karolina');
  assert.equal(conHandles(P)[3].handle, 'david.perez');
});

test('token activo y sugerencias', () => {
  const t = tokenActivo('hola #pc', 8);
  assert.deepEqual(t, { tipo: 'cliente', sigla: '#', texto: 'pc', desde: 5, hasta: 8 });
  assert.equal(sugerencias(t, P)[0].id, 'pcel');
  const t2 = tokenActivo('ver @ka', 7);
  const s2 = sugerencias(t2, P);
  assert.equal(s2.length, 1); assert.equal(s2[0].id, 'u-kar'); assert.equal(s2[0].insertar, '@karolina');
  const t3 = tokenActivo('x /', 3);
  assert.equal(sugerencias(t3, P).length, 5);
  assert.equal(tokenActivo('sin nada', 8), null);
  assert.equal(tokenActivo('email@dominio', 13), null); // @ pegado a texto no es etiqueta
  const ap = aplicarSugerencia('ver @ka', t2, s2[0]);
  assert.equal(ap.texto, 'ver @karolina ');
  assert.equal(ap.cursor, 14);
});

test('textoConEtiquetas reconstruye el texto editable', () => {
  const txt = textoConEtiquetas({ titulo: 'Rebate Q3', cliente_key: 'digitalife', responsables: ['u-fer'], categoria: 'comercial' }, P);
  assert.equal(txt, 'Rebate Q3 #digitalife @fernando /comercial');
  const r = parsearEtiquetas(txt, P);
  assert.equal(r.titulo, 'Rebate Q3'); assert.equal(r.cliente_key, 'digitalife'); assert.deepEqual(r.responsables, ['u-fer']); assert.equal(r.categoria, 'comercial');
});

// ─── fechaNatural (captura rápida móvil) ───
import { fechaNatural } from '../src/modules/agenda/etiquetas.js';
const HOY = new Date(2026, 8, 10, 9, 0); // jueves 10 sep 2026

test('fechaNatural: hoy, mañana, pasado mañana', () => {
  assert.equal(fechaNatural('Llamar a PCEL hoy', HOY).fecha, '2026-09-10');
  const r = fechaNatural('Mandar muestras #pcel mañana', HOY);
  assert.equal(r.fecha, '2026-09-11'); assert.equal(r.texto, 'Mandar muestras #pcel'); assert.equal(r.frase, 'mañana');
  assert.equal(fechaNatural('Revisar pasado mañana', HOY).fecha, '2026-09-12');
  // "por la mañana" no es fecha
  const s = fechaNatural('Revisar por la mañana', HOY);
  assert.equal(s.fecha, null); assert.equal(s.texto, 'Revisar por la mañana');
});

test('fechaNatural: día de la semana (siguiente, nunca hoy)', () => {
  assert.equal(fechaNatural('Enviar edo. de cuenta el viernes', HOY).fecha, '2026-09-11');
  assert.equal(fechaNatural('Junta el próximo lunes', HOY).fecha, '2026-09-14');
  assert.equal(fechaNatural('Junta jueves', HOY).fecha, '2026-09-17'); // hoy es jueves → el siguiente
  assert.equal(fechaNatural('Ver el Miércoles', HOY).texto, 'Ver');
});

test('fechaNatural: fechas explícitas', () => {
  assert.equal(fechaNatural('Promo Buen Fin 15 sep', HOY).fecha, '2026-09-15');
  assert.equal(fechaNatural('Promo para el 15 de septiembre', HOY).fecha, '2026-09-15');
  assert.equal(fechaNatural('Cierre 21/09', HOY).fecha, '2026-09-21');
  assert.equal(fechaNatural('Cierre 21/09/2027', HOY).fecha, '2027-09-21');
  assert.equal(fechaNatural('Rebate 15 ene', HOY).fecha, '2027-01-15'); // ya pasó este año → el siguiente
  assert.equal(fechaNatural('Promo Buen Fin 15 sep', HOY).texto, 'Promo Buen Fin');
});

test('fechaNatural: relativas y hora', () => {
  assert.equal(fechaNatural('Seguimiento en 3 días', HOY).fecha, '2026-09-13');
  assert.equal(fechaNatural('Seguimiento en dos semanas', HOY).fecha, '2026-09-24');
  assert.equal(fechaNatural('Plan la próxima semana', HOY).fecha, '2026-09-14');
  assert.equal(fechaNatural('Cierre fin de mes', HOY).fecha, '2026-09-30');
  const r = fechaNatural('Reunión PCEL el viernes a las 4 pm', HOY);
  assert.equal(r.fecha, '2026-09-11'); assert.equal(r.hora, '16:00'); assert.equal(r.texto, 'Reunión PCEL');
  assert.equal(fechaNatural('Llamar mañana a las 12', HOY).hora, '12:00');
  assert.equal(fechaNatural('Llamar mañana 9:30', HOY).hora, '09:30');
  assert.equal(fechaNatural('Llamar a las 4', HOY).hora, '16:00');
  assert.equal(fechaNatural('Comprar 200 pz', HOY).hora, null);
  assert.equal(fechaNatural('Sin fecha alguna', HOY).fecha, null);
});
