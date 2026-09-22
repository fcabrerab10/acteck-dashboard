// Barra inferior del celular (modo "barra") · qué entradas salen según el perfil, y que la Agenda
// sea una pestaña RAÍZ del shell (no un push) desde 2026-09-22.
//   node --test scripts/test-movil-barra-ssr.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

globalThis.window ??= globalThis;
globalThis.navigator ??= { userAgent: 'node', language: 'es-MX', onLine: true };
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {}, clear() {} };
globalThis.sessionStorage ??= globalThis.localStorage;
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.requestAnimationFrame ??= (f) => setTimeout(f, 0);
globalThis.addEventListener ??= () => {};
globalThis.removeEventListener ??= () => {};

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
test.after(async () => { await vite.close(); setTimeout(() => process.exit(process.exitCode || 0), 200).unref(); });

const { entradasBarra } = await vite.ssrLoadModule('/src/movil/menu/BarraGrupos.jsx');
const { construirArbol } = await vite.ssrLoadModule('/src/components/nav/arbol.js');
const { destino, TABS_RAIZ } = await vite.ssrLoadModule('/src/movil/rutas.js');
const { puedeVerPaginaGlobal } = await vite.ssrLoadModule('/src/lib/permisos.js');

// Perfiles de referencia (los mismos casos que usa Administración).
const SUPER = { user_id: 'u-fer', es_super_admin: true, permisos: {} };
// David Millán: lo ve casi todo, pero la Agenda queda en 'oculto' (decisión de Fernando).
const DAVID = {
  user_id: 'u-dav',
  permisos: { globales: { vision_general: 'ver', resumen_clientes: 'ver', sell_in: 'ver', estado_resultados: 'ver' } },
};
// Karolina: interna con Agenda en 'edit'.
const KARO = {
  user_id: 'u-kar',
  permisos: { globales: { vision_general: 'ver', resumen_clientes: 'ver', agenda: 'edit' } },
};
// Externo de un cliente: ni Inicio ni Agenda.
const EXTERNO = { user_id: 'u-ext', permisos: { clientes: { pcel: { home: 'ver', sellIn: 'ver' } } } };

const ids = (perfil) => entradasBarra(construirArbol(perfil, { movil: true }), perfil).map((e) => e.id);

test('la Agenda es pestaña raíz del shell, no un push', () => {
  assert.ok(TABS_RAIZ.includes('agenda'), 'TABS_RAIZ debe incluir "agenda"');
  assert.deepEqual(TABS_RAIZ, ['inicio', 'agenda', 'clientes', 'alertas', 'buscar']);
  const d = destino({ pagina: 'agenda' });
  assert.equal(d.tipo, 'tab');
  assert.equal(d.tab, 'agenda');
  // Una notificación (extra) viaja con la pestaña para que MovilApp la pase como `inicial`.
  const conExtra = destino({ pagina: 'agenda', extra: { itemId: 'a' } });
  assert.deepEqual(conExtra, { tipo: 'tab', tab: 'agenda', extra: { itemId: 'a' } });
  // La página vieja adminInterna sigue cayendo en la misma pestaña.
  assert.equal(destino({ pagina: 'adminInterna' }).tab, 'agenda');
});

test('"Agenda" sale en la barra sólo con el permiso global agenda', () => {
  assert.ok(puedeVerPaginaGlobal(SUPER, 'agenda'));
  assert.ok(puedeVerPaginaGlobal(KARO, 'agenda'));
  assert.equal(puedeVerPaginaGlobal(DAVID, 'agenda'), false);
  assert.equal(puedeVerPaginaGlobal(EXTERNO, 'agenda'), false);

  assert.ok(ids(SUPER).includes('agenda'), 'el super admin ve Agenda');
  assert.ok(ids(KARO).includes('agenda'), 'Karolina ve Agenda');
  assert.ok(!ids(DAVID).includes('agenda'), 'David Millán NO ve Agenda');
  assert.ok(!ids(EXTERNO).includes('agenda'), 'un externo NO ve Agenda');
});

test('el orden de la barra es Inicio · Agenda · … y no se movió lo demás', () => {
  const l = ids(SUPER);
  // "General" no sale en el celular: su único nodo (Estado de Resultados) es soloWeb.
  assert.deepEqual(l, ['inicio', 'agenda', 'direccionComercial', 'clientesPropios', 'interno']);
  assert.deepEqual(ids(DAVID).slice(0, 2), ['inicio', 'direccionComercial']);
  assert.deepEqual(ids(EXTERNO), ['clientesPropios']);
});

test('entradasBarra aguanta un árbol o un perfil vacíos', () => {
  assert.deepEqual(entradasBarra([], null), []);
  assert.deepEqual(entradasBarra(undefined, undefined), []);
});
