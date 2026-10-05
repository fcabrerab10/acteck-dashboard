// Agenda V5 · SSR de Hoy, Bandeja y Pendientes con datos de prueba (atrapa imports rotos y JSX inválido).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const { ThemeContext } = await vite.ssrLoadModule('/src/lib/themeContext.jsx');
const { getTheme } = await vite.ssrLoadModule('/src/lib/themeTokens.js');
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const { default: Hoy } = await vite.ssrLoadModule('/src/modules/agenda5/Hoy.jsx');
const { default: Bandeja } = await vite.ssrLoadModule('/src/modules/agenda5/Bandeja.jsx');
const { default: Pendientes } = await vite.ssrLoadModule('/src/modules/agenda5/Pendientes.jsx');
test.after(() => vite.close());
const theme = getTheme('claro');
const qc = new QueryClient();
const h = (C, props) => renderToString(React.createElement(QueryClientProvider, { client: qc }, React.createElement(ThemeContext.Provider, { value: { theme, setThemeKey() {} } }, React.createElement(C, props))));
const { isoDia } = await vite.ssrLoadModule('/src/modules/agenda5/calculo.js'); const hoyIso = isoDia(new Date());
const U = 'u-f';
const d = { items: [
  { id: '1', estado: 'abierta', propietario: U, titulo: 'Enviar propuesta Digitalife', cuando: hoyIso, hora: '10:00', duracion_min: 45, cliente_key: 'digitalife', created_at: '1' },
  { id: '2', estado: 'abierta', propietario: U, titulo: 'Idea bocinas CT', bandeja: true, tipo: 'idea', created_at: '2' },
  { id: '3', estado: 'abierta', propietario: U, titulo: 'Revisar forecast PCEL', fecha_limite: '2099-01-01', created_at: '3' },
], reuniones: [], google: [{ id: 'g1', titulo: 'Digitalife semanal', inicio: `${hoyIso}T09:00:00`, fin: `${hoyIso}T10:00:00` }], areas: [{ id: 'a1', nombre: 'Digitalife', propietario: U, color: '#0A84FF' }], proyectos: [], registros: [], checkins: [], googleEstado: { conectado: true, email: 'f@x' } };
const personasPorId = new Map([[U, { user_id: U, nombre: 'Fernando Cabrera' }]]);
test('Hoy', () => { const s = h(Hoy, { d, uid: U, propietario: U, personasPorId, puedeEditar: true }); assert.match(s, /Enviar propuesta Digitalife/); assert.match(s, /Digitalife semanal/); assert.match(s, /Reloj del día/); assert.match(s, /1 pendiente · 45 min planeadas · 1 reunión/); assert.match(s, /●/); });
test('Bandeja', () => { const s = h(Bandeja, { d, uid: U, propietario: U, personasPorId, puedeEditar: true }); assert.match(s, /Idea bocinas CT/); assert.match(s, /1 por clasificar/); });
test('Pendientes', () => { const s = h(Pendientes, { d, uid: U, propietario: U, personasPorId, puedeEditar: true }); assert.match(s, /Revisar forecast PCEL/); assert.match(s, /Más adelante/); });
