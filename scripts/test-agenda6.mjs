// Agenda «que te lleva» (V6 · 2026-10-08): cálculo puro. node --test scripts/test-agenda6.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
test.after(async () => { await vite.close(); setTimeout(() => process.exit(process.exitCode || 0), 200).unref(); });
const c = await vite.ssrLoadModule('/src/modules/agenda6/calculo.js');

const HOY = new Date(2026, 9, 8, 12, 40); // jueves 8 oct 12:40
const U = 'u-f', K = 'u-k', J = 'u-j';
const personas = [{ user_id: U, nombre: 'Fernando Cabrera', email: 'f@a.com' }, { user_id: K, nombre: 'Karolina Veliz', email: 'k@a.com' }, { user_id: J, nombre: 'Jhordy Sánchez', email: 'j@a.com' }];
const it = (id, extra) => ({ id, tipo: 'tarea', titulo: `T ${id}`, estado: 'abierta', propietario: U, responsables: [U], cliente_key: 'interno', created_at: '2026-10-01', ...extra });
const items = [
  it('a', { cuando: '2026-10-08', hora: '09:00', estado: 'hecha', completado_en: '2026-10-08T09:22:00' }),
  it('b', { cuando: '2026-10-08', hora: '12:00', cliente_key: 'dicotech' }),
  it('c', { cuando: '2026-10-08', cliente_key: 'pcel' }),
  it('d', { cuando: '2026-10-03', cliente_key: 'digitalife' }),            // vencida
  it('e', { fecha_limite: '2026-10-06' }),                                   // vencida por límite
  it('f', { cuando: '2026-10-07', estado: 'hecha', completado_en: '2026-10-07T18:00:00' }),
  it('g', { cuando: '2026-10-07' }),                                         // de ayer, abierta
  it('m1', { cuando: '2026-10-09', responsables: [K], cliente_key: 'digitalife' }),        // mandada a Karolina
  it('m2', { cuando: '2026-10-06', responsables: [J], cliente_key: 'digitalife' }),        // mandada a Jhordy, vencida
  it('m3', { cuando: '2026-10-08', responsables: [K], estado: 'hecha', completado_en: '2026-10-08T11:52:00' }),
  it('p1', { tipo: 'punto', reunion_id: 'r1', cliente_key: 'digitalife' }),
  { ...it('x', { cuando: '2026-10-08' }), propietario: K, responsables: [K] },             // de Karolina, no mía
];
const reuniones = [{ id: 'r1', titulo: 'Junta Digitalife', fecha: '2026-10-13', cliente_key: 'digitalife' }];

// ── SSR de las vistas (web y celular) con los mismos datos de ejemplo ──
import React from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
globalThis.window ??= globalThis;
globalThis.navigator ??= { userAgent: 'node', language: 'es-MX', onLine: true };
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {}, clear() {} };
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.addEventListener ??= () => {}; globalThis.removeEventListener ??= () => {};
const { ThemeContext } = await vite.ssrLoadModule('/src/lib/themeContext.jsx');
const { getTheme } = await vite.ssrLoadModule('/src/lib/themeTokens.js');
const { NavContext } = await vite.ssrLoadModule('/src/movil/nav.jsx');
const Hoy6 = (await vite.ssrLoadModule('/src/modules/agenda6/Hoy6.jsx')).default;
const Mande = (await vite.ssrLoadModule('/src/modules/agenda6/Mande.jsx')).default;
const PorCliente = (await vite.ssrLoadModule('/src/modules/agenda6/PorCliente.jsx')).default;
const { OrganizaCuerpo } = await vite.ssrLoadModule('/src/modules/agenda6/OrganizaDia.jsx');
const HoyM6 = (await vite.ssrLoadModule('/src/movil/pestanas/agenda6/HoyM6.jsx')).default;
const MandeM = (await vite.ssrLoadModule('/src/movil/pestanas/agenda6/MandeM.jsx')).default;
const PorClienteM = (await vite.ssrLoadModule('/src/movil/pestanas/agenda6/PorClienteM.jsx')).default;
const theme = getTheme('midnight');
const qc = new QueryClient();
const nav = { modo: 'barra', perfil: { user_id: U, es_super_admin: true }, push() {}, pop() {}, navegar() {} };
const h = (C, props) => renderToString(React.createElement(QueryClientProvider, { client: qc }, React.createElement(ThemeContext.Provider, { value: { theme, setThemeKey() {} } }, React.createElement(NavContext.Provider, { value: nav }, React.createElement(C, props)))));
const hoyReal = new Date(); const hoyRealIso = c.isoDe(hoyReal);
const itemsHoy = items.map((it) => ({ ...it, cuando: it.cuando ? it.cuando.replace('2026-10-08', hoyRealIso).replace('2026-10-07', c.sumarDiasIso(hoyRealIso, -1)).replace('2026-10-03', c.sumarDiasIso(hoyRealIso, -5)).replace('2026-10-06', c.sumarDiasIso(hoyRealIso, -2)).replace('2026-10-09', c.sumarDiasIso(hoyRealIso, 1)) : it.cuando, fecha_limite: it.fecha_limite ? c.sumarDiasIso(hoyRealIso, -2) : it.fecha_limite, completado_en: it.completado_en ? `${hoyRealIso}T09:00:00` : it.completado_en }));
const pp = new Map(personas.map((p) => [p.user_id, p]));
const d = { items: itemsHoy, reuniones: reuniones.map((r) => ({ ...r, fecha: c.sumarDiasIso(hoyRealIso, 5) })), google: [], registros: [], checkins: [], personas, personasPorId: pp, porId: new Map(itemsHoy.map((i) => [i.id, i])) };
const horas = { armar: '00:01', pausa: '00:02', retomar: '00:03', cierre: '23:58' };
const sano = (s, w) => { assert.ok(!/NaN|undefined|\[object Object\]/.test(s), `${w}: NaN/undefined`); };
const comW = { d, uid: U, propietario: U, personasPorId: pp, puedeEditar: true, horas, persona: personas[0], onAbrirItem() {}, onCapturar() {}, onAbrirReunion() {}, onOrganizar() {}, onIrA() {} };
const comM = { d, uid: U, propietario: U, personasPorId: pp, puedeEditar: true, hoy: hoyReal, horas, persona: personas[0], abrirItem() {}, abrirMinuta() {}, onOrganizar() {}, onIrA() {}, onNuevo() {} };

test('estadoDelDia: fase, lo que quedó, avance y ayer sin cerrar', () => {
  const e = c.estadoDelDia({ items, uid: U, hoy: HOY, registros: [], organizadoHoy: false });
  assert.equal(e.fase, 'organizar'); assert.equal(e.hoyIso, '2026-10-08'); assert.equal(e.ayerIso, '2026-10-07');
  assert.equal(e.ayerSinCerrar, true); assert.deepEqual(e.ayer, { fecha: '2026-10-07', hechas: 1, total: 2 });
  assert.deepEqual(e.quedo.map((x) => x.id), ['d', 'e', 'g']);
  assert.deepEqual(e.avance, { hechas: 1, total: 3, pct: 33 });
  const e2 = c.estadoDelDia({ items, uid: U, hoy: HOY, registros: [{ usuario: U, fecha: '2026-10-07', cerrado_at: 'x' }], organizadoHoy: true });
  assert.equal(e2.fase, 'trabajar'); assert.equal(e2.ayerSinCerrar, false);
  assert.equal(c.estadoDelDia({ items, uid: U, hoy: new Date(2026, 9, 8, 22, 30), organizadoHoy: true }).fase, 'cierre');
  assert.match(c.fraseDia(e, 'Fernando'), /antes de empezar, organiza tu día: traes 3 de antes/);
  assert.match(c.fraseDia(e2), /^Vas 1 de 3\. Traes 3 de antes\./);
});

test('interpretarLibre: personas y clientes sin símbolos', () => {
  const a = c.interpretarLibre('Pedirle a Karolina los estados de cuenta de Dicotech y PCEL para el lunes', personas, HOY);
  assert.deepEqual(a.responsables, [K]); assert.deepEqual(a.clientes, ['pcel', 'dicotech']); assert.equal(a.cliente_key, 'pcel');
  assert.equal(a.cuando, '2026-10-12'); assert.ok(a.chips.some((x) => x.label === '→ Karolina')); assert.ok(a.chips.some((x) => x.label === 'Dicotech'));
  const b = c.interpretarLibre('Llamar a Carlos de Digitalife 11am', personas, HOY);
  assert.deepEqual(b.responsables, []); assert.deepEqual(b.clientes, ['digitalife']); assert.equal(b.hora, '11:00'); assert.equal(b.cuando, '2026-10-08');
  const d = c.interpretarLibre('Karolina: cuadrar apoyos de agosto', personas, HOY);
  assert.deepEqual(d.responsables, [K]); assert.equal(d.titulo, 'cuadrar apoyos de agosto');
  const e = c.interpretarLibre('Revisar la junta de mañana con Alejandro', personas, HOY);
  assert.deepEqual(e.responsables, []); assert.deepEqual(e.clientes, []); assert.equal(e.cuando, '2026-10-09');
  const f = c.interpretarLibre('Mandar a Karolina y Jhordy la lista de SKUs #cva', personas, HOY);
  assert.deepEqual(f.responsables.sort(), [J, K].sort()); assert.deepEqual(f.clientes, ['cva']);
});

test('delegadas y porCliente', () => {
  const pp = new Map(personas.map((p) => [p.user_id, p]));
  const d = c.delegadas(items, U, HOY, { personasPorId: pp });
  assert.deepEqual(d.vencidas.map((x) => x.id), ['m2']); assert.deepEqual(d.enCurso.map((x) => x.id), ['m1']); assert.deepEqual(d.hechas.map((x) => x.id), ['m3']);
  assert.equal(d.total, 2); assert.deepEqual(d.porPersona.map((x) => x.persona.user_id).sort(), [J, K].sort());
  const pc = c.porCliente(items, reuniones, U, HOY);
  const dl = pc.find((g) => g.cliente === 'digitalife');
  assert.deepEqual(dl.items.map((x) => x.id), ['d', 'm2', 'm1', 'p1']); assert.equal(dl.acuerdos, 1); assert.equal(dl.mandadas, 2); assert.equal(dl.vencidas, 2); assert.equal(dl.proximaReunion, '2026-10-13');
  assert.equal(dl.items.find((x) => x.id === 'p1').reunionTitulo, 'Junta Digitalife');
});

test('movidas: antesDe y cambiosDe', () => {
  const a = c.antesDe(items[1]);
  assert.equal(a.estado, 'abierta'); assert.equal(a.cuando, '2026-10-08'); assert.deepEqual(a.responsables, [U]);
  assert.equal(c.cambiosDe('manana', { hoyIso: '2026-10-08' }).cuando, '2026-10-09');
  assert.equal(c.cambiosDe('hecha', {}).estado, 'hecha'); assert.equal(c.cambiosDe('yano', {}).estado, 'cancelada');
  assert.deepEqual(c.cambiosDe('mandar', { responsables: [K, J] }).responsables, [K, J]);
});

test('SSR web: Hoy6 · Lo que mandé · Por cliente · Organiza', () => {
  const s1 = h(Hoy6, comW); sano(s1, 'Hoy6'); assert.match(s1, /Tu día/); assert.match(s1, /T b/); assert.match(s1, /De antes/); assert.match(s1, /Lo que mandé/); assert.match(s1, /Organizar mi día|Ahora|Lo que toca/);
  const s2 = h(Mande, comW); sano(s2, 'Mande'); assert.match(s2, /Vencidas/); assert.match(s2, /T m2/); assert.match(s2, /Karolina/);
  const s3 = h(PorCliente, comW); sano(s3, 'PorCliente'); assert.match(s3, /Digitalife/); assert.match(s3, /acuerdos/); assert.match(s3, /Reunión/);
  const e = c.estadoDelDia({ items: itemsHoy, uid: U, hoy: hoyReal, horas, registros: [], organizadoHoy: false });
  const s4 = h(OrganizaCuerpo, { d, uid: U, propietario: U, hoy: hoyReal, hoyIso: hoyRealIso, horas, estado: e, puedeEditar: true }); sano(s4, 'Organiza');
  assert.match(s4, /no se cerró|Lo que quedó/); // paso 0 (ayer sin cerrar) o paso 1
});
test('SSR celular: HoyM6 · MandeM · PorClienteM', () => {
  const s1 = h(HoyM6, comM); sano(s1, 'HoyM6'); assert.match(s1, /Tu día/); assert.match(s1, /Desliza/); assert.match(s1, /Lo que mandé/);
  const s2 = h(MandeM, comM); sano(s2, 'MandeM'); assert.match(s2, /Vencidas/); assert.match(s2, /Recordar/);
  const s3 = h(PorClienteM, comM); sano(s3, 'PorClienteM'); assert.match(s3, /Digitalife/); assert.match(s3, /Nuevo para/);
});
