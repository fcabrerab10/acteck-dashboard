// Vista dividida «lista + detalle» en Agenda y Propuestas (web · 2026-11-20). node --test scripts/test-vista-dividida.mjs
// Reglas puras (cuándo se parte) + SSR de las vistas nuevas: detalle del pendiente en línea y detalle de la propuesta.
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
test.after(async () => { await vite.close(); setTimeout(() => process.exit(process.exitCode || 0), 200).unref(); });

globalThis.window ??= globalThis;
globalThis.navigator ??= { userAgent: 'node', language: 'es-MX', onLine: true };
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {}, clear() {} };
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.addEventListener ??= () => {}; globalThis.removeEventListener ??= () => {};

const { ThemeContext } = await vite.ssrLoadModule('/src/lib/themeContext.jsx');
const { getTheme } = await vite.ssrLoadModule('/src/lib/themeTokens.js');
const div = await vite.ssrLoadModule('/src/modules/agenda6/Dividida.jsx');
const HojaItem = (await vite.ssrLoadModule('/src/modules/agenda5/base/HojaItem.jsx')).default;
const prop = await vite.ssrLoadModule('/src/modules/comercial/propuestas/PropuestasDivididas.jsx');
const disp = await vite.ssrLoadModule('/src/lib/dispositivo.js');

const theme = getTheme('midnight');
const h = (el) => renderToString(React.createElement(ThemeContext.Provider, { value: { theme, setThemeKey() {} } }, el)).replace(/<!-- -->/g, '');
const sano = (s, w) => assert.ok(!/NaN|undefined|\[object Object\]/.test(s), `${w}: NaN/undefined`);

// ── Agenda ──
test('Agenda · sólo se parte con la preferencia, ancho suficiente y en las cuatro vistas', () => {
  const { cabeDividida, ANCHO_MIN_DIVIDIDA, MODULOS_DIVIDIDOS } = div;
  assert.deepEqual(MODULOS_DIVIDIDOS, ['hoy6', 'pendientes', 'mande', 'clientes']);
  for (const modulo of MODULOS_DIVIDIDOS) assert.equal(cabeDividida({ dividida: true, ancho: ANCHO_MIN_DIVIDIDA, modulo }), true, modulo);
  assert.equal(cabeDividida({ dividida: false, ancho: 1400, modulo: 'hoy6' }), false, 'sin la preferencia queda como hoy');
  assert.equal(cabeDividida({ dividida: true, ancho: ANCHO_MIN_DIVIDIDA - 1, modulo: 'hoy6' }), false, 'angosto → hoja');
  assert.equal(cabeDividida({ dividida: true, ancho: 0, modulo: 'hoy6' }), false, 'sin medir (SSR) → hoja');
  for (const modulo of ['reuniones', 'semana', 'bandeja', 'ideas', 'registro', 'equipo', 'hoy', 'dia']) assert.equal(cabeDividida({ dividida: true, ancho: 1400, modulo }), false, modulo);
});

test('La preferencia «dividida» sigue apagada por defecto salvo en el plegable', () => {
  for (const [modo, d] of Object.entries(disp.DEFAULTS_DISPOSITIVO)) assert.equal(d.dividida, modo === 'plegable', modo);
});

const U = 'u-f', K = 'u-k';
const personas = [{ user_id: U, nombre: 'Fernando Cabrera', email: 'f@a.com' }, { user_id: K, nombre: 'Karolina Veliz', email: 'k@a.com' }];
const personasPorId = new Map(personas.map((p) => [p.user_id, p]));
const item = { id: 'it-1', tipo: 'tarea', titulo: 'Mandar propuesta de bocinas', estado: 'abierta', propietario: U, responsables: [U, K], cliente_key: 'digitalife', prioridad: 'alta', fecha_limite: '2026-11-21', hora: '10:30:00', notas: 'Con la lista provisional', created_at: '2026-11-18T10:00:00Z' };
const propsItem = { item, personas, personasPorId, porId: new Map([[item.id, item]]), reuniones: [], hoy: new Date(2026, 10, 20, 12), subtareas: [{ id: 's1', item_id: 'it-1', titulo: 'Revisar inventario', hecha: false, orden: 1 }], comentariosPor: new Map(), items: [item], puedeEditar: true, onClose() {}, onAbrirMinuta() {} };

test('Agenda · el detalle del pendiente se pinta en línea, sin hoja, con el mismo contenido', () => {
  const s = h(React.createElement(HojaItem, { ...propsItem, enLinea: true }));
  sano(s, 'HojaItem en línea');
  assert.match(s, /data-item-en-linea="it-1"/);
  assert.ok(!/role="dialog"/.test(s), 'en línea no hay diálogo ni scrim');
  assert.match(s, /aria-label="Cerrar detalle"/, 'trae su × para cerrar');
  for (const t of ['Tarea', 'Fecha límite', 'Prioridad', 'Estado', 'En qué quedó', 'Seguimiento', 'Notas', 'Hecha', 'Eliminar', 'Con la lista provisional']) assert.ok(s.includes(t), `falta «${t}»`);
  assert.match(s, /value="2026-11-21"/);
  // Sólo lectura: sin botones de acción.
  const l = h(React.createElement(HojaItem, { ...propsItem, enLinea: true, puedeEditar: false }));
  assert.ok(!l.includes('Eliminar') && l.includes('Mandar propuesta de bocinas'));
});

test('Agenda · armazón: sin detalle la lista va a ancho completo; con detalle, dos columnas y la fila marcada', () => {
  const { AgendaDividida } = div;
  const lista = React.createElement('div', { 'data-fila-rapida': 'it-1' }, 'fila');
  const sin = h(React.createElement(AgendaDividida, null, lista));
  assert.match(sin, /data-agenda-dividida="no"/);
  assert.ok(!/<aside/.test(sin) && !/grid-template-columns/.test(sin));
  const con = h(React.createElement(AgendaDividida, { itemId: 'it-1', detalle: React.createElement(HojaItem, { ...propsItem, enLinea: true }) }, lista));
  sano(con, 'AgendaDividida');
  assert.match(con, /data-agenda-dividida="si"/);
  assert.match(con, /grid-template-columns:minmax\(0, ?1fr\) minmax\(320px, ?46%\)/);
  assert.match(con, /<aside[^>]*max-height:calc\(100dvh - 120px\)/, 'el detalle nunca pasa del alto visible');
  assert.ok(con.includes('[data-fila-rapida=&quot;it-1&quot;]') || con.includes('[data-fila-rapida="it-1"]'), 'marca la fila abierta');
  assert.ok(con.indexOf('data-fila-rapida="it-1"') < con.indexOf('data-item-en-linea'), 'lista a la izquierda, detalle a la derecha');
});

// ── Propuestas ──
const lineas = [
  { sku: 'AC-935777', descripcion: 'Bocina portátil 20 W', piezas: 50, precio: 399.5, lista: 'API PROVISIONAL' },
  { sku: 'BR-936781', descripcion: 'Gabinete Batauro', piezas: 20, precio: 1250, custom: true },
];
const P = [
  { id: 'p1', clienteKey: 'digitalife', clienteLabel: 'Digitalife', nombre: 'Cierre noviembre', folio: 'PRP-2611-003', estado: 'borrador', anio: 2026, mes: 11, vigencia: '2026-11-30', tstamp: Date.parse('2026-11-18'), updatedAt: '2026-11-19T10:00:00Z', lineas, resumen: { skus: 2, piezas: 70, total: 44975 } },
  { id: 'p2', clienteKey: 'pcel', clienteLabel: 'PCEL', nombre: '', estado: 'enviada', anio: 2026, mes: 10, tstamp: Date.parse('2026-10-05'), enviadaAt: '2026-10-06T10:00:00Z', lineas: [lineas[0]], costoOculto: 123 },
];
const ef = new Map([['p2', { pct: 42, montoFact: 8400, montoProp: 19975, skusConvertidos: 1, lineas: [{ sku: 'AC-935777' }], ventana: [{ anio: 2026, mes: 11 }], completa: false }]]);

test('Propuestas · sólo se parte con la preferencia, ≥ 900 px y algo que mostrar', () => {
  const f = prop.cabeDivididaPropuestas;
  assert.equal(f({ dividida: true, ancho: 900, n: 3 }), true);
  assert.equal(f({ dividida: false, ancho: 1600, n: 3 }), false);
  assert.equal(f({ dividida: true, ancho: 899, n: 3 }), false);
  assert.equal(f({ dividida: true, ancho: 0, n: 3 }), false);
  assert.equal(f({ dividida: true, ancho: 1600, n: 0 }), false);
});

test('Propuestas · filas de la lista: cliente · nombre, folio · mes · monto y estado como pill', () => {
  const [a, b] = prop.itemsDeLista(P);
  assert.equal(a.titulo, 'Digitalife · Cierre noviembre');
  assert.match(a.sub, /^PRP-2611-003 · Nov 2026 · \$/);
  assert.deepEqual(a.pill, { l: 'Borrador', tone: a.pill.tone });
  assert.equal(b.titulo, 'PCEL · Sin nombre');
  assert.match(b.sub, /^Oct 2026 · \$/);
  assert.equal(b.pill.l, 'Enviada');
  assert.deepEqual(prop.resumenLectura(P[1]), { skus: 1, piezas: 50, total: 19975 }, 'sin resumen guardado se calcula de las líneas');
});

test('Propuestas · detalle en lectura: resumen, líneas y acciones; nada de costo ni margen', () => {
  const s = h(React.createElement(prop.DetallePropuesta, { p: P[0] }));
  sano(s, 'DetallePropuesta borrador');
  for (const t of ['Cierre noviembre', 'PRP-2611-003', 'Digitalife', 'Noviembre 2026', 'Borrador', 'AC-935777', 'Bocina portátil 20 W', 'BR-936781', 'Editar en el armador', 'Duplicar', 'Compartir y enviar', 'Eliminar', 'Total', 'Piezas', 'SKUs']) assert.ok(s.includes(t), `falta «${t}»`);
  assert.ok(s.includes('$44,975'), 'total');
  assert.ok(s.includes('$19,975'), 'monto de la línea = piezas × precio');
  assert.ok(!/margen|costo|utilidad/i.test(s.replace(/title="[^"]*"/g, '')), 'no muestra costo ni margen');
  const e = h(React.createElement(prop.DetallePropuesta, { p: P[1], ef: ef.get('p2') }));
  sano(e, 'DetallePropuesta enviada');
  for (const t of ['Sin nombre', 'Enviada', 'Abrir en el armador', 'Adjuntar Excel final', 'Convertido 42 %', 'ventana Nov 2026', '(en curso)']) assert.ok(e.includes(t), `falta «${t}»`);
  assert.ok(!e.includes('Eliminar'), 'sólo los borradores se eliminan');
});

test('Propuestas · lista a la izquierda y detalle de la elegida a la derecha', () => {
  const s = h(React.createElement(prop.default, { propuestas: P, efectividades: ef }));
  sano(s, 'PropuestasDivididas');
  assert.match(s, /grid-template-columns:300px minmax\(0, ?1fr\)/);
  assert.ok(s.includes('Propuestas · 2'));
  assert.match(s, /data-detalle-propuesta="p1"/, 'abre la primera por defecto');
  assert.ok(s.indexOf('PCEL · Sin nombre') < s.indexOf('data-detalle-propuesta'), 'la lista va antes que el detalle');
  const o = h(React.createElement(prop.default, { propuestas: P, efectividades: ef, inicial: 'p2' }));
  assert.match(o, /data-detalle-propuesta="p2"/);
  assert.equal(h(React.createElement(prop.default, { propuestas: [] })), '');
});
