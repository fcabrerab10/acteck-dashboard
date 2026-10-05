// Agenda V5 móvil (3.70.0): SSR de las vistas Día · Bandeja · Pendientes con datos de ejemplo.
// node --test scripts/test-agenda5-movil-ssr.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

globalThis.window ??= globalThis;
globalThis.navigator ??= { userAgent: 'node', language: 'es-MX', onLine: true };
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {}, clear() {} };
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.addEventListener ??= () => {};
globalThis.removeEventListener ??= () => {};

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
test.after(async () => { await vite.close(); setTimeout(() => process.exit(process.exitCode || 0), 200).unref(); });
const { ThemeContext } = await vite.ssrLoadModule('/src/lib/themeContext.jsx');
const { getTheme } = await vite.ssrLoadModule('/src/lib/themeTokens.js');
const { NavContext } = await vite.ssrLoadModule('/src/movil/nav.jsx');
const { HoyM, BandejaM, PendientesM } = await vite.ssrLoadModule('/src/movil/pestanas/agenda5/AgendaM.jsx');
const { isoDia } = await vite.ssrLoadModule('/src/modules/agenda5/calculo.js');
const theme = getTheme('midnight');
const qc = new QueryClient();
const nav = { modo: 'barra', perfil: { user_id: 'u-f', es_super_admin: true }, push() {}, pop() {}, navegar() {} };
const h = (C, props) => renderToString(React.createElement(QueryClientProvider, { client: qc }, React.createElement(ThemeContext.Provider, { value: { theme, setThemeKey() {} } }, React.createElement(NavContext.Provider, { value: nav }, React.createElement(C, props)))));
const hoy = new Date(); const hoyIso = isoDia(hoy);
const U = 'u-f';
const d = { items: [
  { id: '1', estado: 'abierta', propietario: U, titulo: 'Enviar propuesta Digitalife', cuando: hoyIso, hora: '10:00', duracion_min: 45, cliente_key: 'digitalife', created_at: '1' },
  { id: '4', estado: 'abierta', propietario: U, titulo: 'Llamar a Juan', cuando: hoyIso, cliente_key: 'pcel', created_at: '4' },
  { id: '2', estado: 'abierta', propietario: U, titulo: 'Idea bocinas CT', bandeja: true, tipo: 'idea', created_at: '2' },
  { id: '3', estado: 'abierta', propietario: U, titulo: 'Revisar forecast PCEL', fecha_limite: '2099-01-01', created_at: '3' },
], reuniones: [], google: [{ id: 'g1', titulo: 'Digitalife semanal', inicio: `${hoyIso}T09:00:00`, fin: `${hoyIso}T10:00:00` }], registros: [], checkins: [], personas: [], personasPorId: new Map() };
const com = { d, uid: U, propietario: U, puedeEditar: true, esMia: true, hoy, abrirItem() {}, toggle() {}, posponerM() {}, personasPorId: new Map([[U, { nombre: 'Fernando' }]]), nav, dia: hoyIso, abrirMinuta() {} };
const sano = (s, w) => { assert.ok(!/NaN|undefined|\[object Object\]/.test(s), `${w}: NaN/undefined`); };
test('Día: horario en lista, pendientes sin hora', () => { const s = h(HoyM, com); sano(s, 'Día'); assert.match(s, /Horario/); assert.match(s, /09:00/); assert.match(s, /Digitalife semanal/); assert.match(s, /10:00/); assert.match(s, /Enviar propuesta Digitalife/); assert.match(s, /Llamar a Juan/); assert.match(s, /Pendientes de hoy/); assert.match(s, /Ahora|Lo que toca/); assert.match(s, /Guíame · 2 por hacer/); });
test('Bandeja', () => { const s = h(BandejaM, com); sano(s, 'Bandeja'); assert.match(s, /Idea bocinas CT/); });
test('Pendientes', () => { const s = h(PendientesM, com); sano(s, 'Pendientes'); assert.match(s, /Revisar forecast PCEL/); assert.match(s, /Más adelante/); });
