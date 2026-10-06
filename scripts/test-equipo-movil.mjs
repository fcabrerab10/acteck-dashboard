// Actividad del equipo en el celular (3.88.0 · 2026-10-06): cálculo puro (serie 4 semanas, frases, ritmo, estado) + SSR
// de Equipo, Persona y la ruta. Sin red.
//   node --test scripts/test-equipo-movil.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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

const { ThemeContext } = await vite.ssrLoadModule('/src/lib/themeContext.jsx');
const { getTheme } = await vite.ssrLoadModule('/src/lib/themeTokens.js');
const { NavContext } = await vite.ssrLoadModule('/src/movil/nav.jsx');
const calc = await vite.ssrLoadModule('/src/movil/pestanas/equipo/calculo.js');
const web = await vite.ssrLoadModule('/src/modules/interno/equipo/calculo.js');
const { EquipoVista } = await vite.ssrLoadModule('/src/movil/pestanas/equipo/Equipo.jsx');
const { PersonaVista } = await vite.ssrLoadModule('/src/movil/pestanas/equipo/Persona.jsx');
const rutas = await vite.ssrLoadModule('/src/movil/rutas.js');

const qc = new QueryClient();
const nav = { modo: 'barra', perfil: { user_id: 'u-f', es_super_admin: true }, push() {}, pop() {}, navegar() {} };
const render = (C, props) => renderToString(React.createElement(QueryClientProvider, { client: qc }, React.createElement(ThemeContext.Provider, { value: { theme: getTheme('midnight'), setThemeKey() {} } }, React.createElement(NavContext.Provider, { value: nav }, React.createElement(C, props))))).replace(/<!--.*?-->/g, '');
const sano = (s, d) => assert.ok(!/NaN|undefined|\[object Object\]/.test(s), `${d}: NaN/undefined en el HTML`);

// Martes 6 oct 2026, 11:00
const HOY = new Date(2026, 9, 6, 11);
const ts = (dia, hora) => new Date(`${dia}T${hora}:00`).toISOString();
const hb = (uid, dia, hora, extra = {}) => ({ user_id: uid, ts: ts(dia, hora), tipo: 10, cliente: 1, pagina: 3, ...extra });
const horasK = { armar: '08:30', pausa: '13:00', retomar: '14:00', cierre: '18:00' };
const horasF = { armar: '09:00', pausa: '15:00', retomar: '17:00', cierre: '22:00' };
const usuarios = [
  { user_id: 'u-f', nombre: 'Fernando Cabrera', puesto: 'director', tipo: 'interno', activo: true, se_evalua: false, preferencias: { agenda: { horas: horasF } } },
  { user_id: 'u-k', nombre: 'Karolina Ruiz', puesto: 'asistente comercial', tipo: 'interno', activo: true, se_evalua: true, genero: 'f', preferencias: { agenda: { horas: horasK } } },
  { user_id: 'u-d', nombre: 'David Millán', puesto: 'contralor', tipo: 'interno', activo: true, se_evalua: false },
  { user_id: 'u-x', nombre: 'Juan de Digitalife', tipo: 'externo', activo: true },
];
const internos = usuarios.filter((u) => u.tipo !== 'externo'), externos = usuarios.filter((u) => u.tipo === 'externo');
// Eventos: Karolina hoy 8:40–10:52 (latidos cada minuto no hace falta: 3 latidos) y ayer; Fernando hoy; David hace 6 días hábiles (28 sep); externo hace 2 d
const eventos = [
  ...['08:40', '08:41', '08:42', '10:50', '10:52'].map((h) => hb('u-k', '2026-10-06', h)),
  ...['09:10', '09:11'].map((h) => hb('u-k', '2026-10-05', h)),
  ...['09:00', '09:01', '09:02'].map((h) => hb('u-f', '2026-10-06', h)),
  hb('u-d', '2026-09-28', '10:00'), hb('u-x', '2026-10-04', '12:00', { cliente: 1 }),
];
const item = (id, resp, estado, fecha_limite, extra = {}) => ({ id, tipo: 'tarea', titulo: `Pendiente ${id}`, estado, fecha_limite, responsables: [resp], propietario: resp, ...extra });
const agendaItems = [
  item('k1', 'u-k', 'abierta', '2026-10-01', { cliente_key: 'digitalife' }), item('k2', 'u-k', 'abierta', '2026-10-02', { cliente_key: 'digitalife' }), item('k3', 'u-k', 'abierta', '2026-09-30'),
  item('k4', 'u-k', 'abierta', '2026-10-06', { cuando: '2026-10-06', hora: '12:00', duracion_min: 60 }), item('k5', 'u-k', 'hecha', '2026-10-06', { cuando: '2026-10-06', hora: '08:30', duracion_min: 30, min_real: 25, completado_en: ts('2026-10-06', '08:52') }),
  item('k6', 'u-k', 'hecha', '2026-09-20', { completado_en: ts('2026-09-19', '10:00') }), item('k7', 'u-k', 'hecha', '2026-09-22', { completado_en: ts('2026-09-25', '10:00') }),
  item('f1', 'u-f', 'abierta', '2026-10-03'), item('f2', 'u-f', 'abierta', '2026-10-20'),
];
const registrosHoy = [{ usuario: 'u-k', fecha: '2026-10-06', cerrado_at: null, energia: null, resumen: null }];

function armar(umbral = 3) {
  const porUsuario = new Map();
  const desdeSemana = web.inicioSemana(HOY);
  const hoyIso = web.isoDia(HOY);
  for (const u of usuarios) {
    const tele = web.resumenTelemetria(eventos.filter((e) => e.user_id === u.user_id), { hoy: HOY, desdeSemana });
    const acc = web.resumenAcciones([], { hoy: HOY });
    const ag = web.cumplimientoAgenda(agendaItems, u.user_id, { hoy: HOY });
    const inact = u.tipo === 'externo' ? null : web.inactividad({ ultimoEvento: tele.ultimo, agenda: ag, hoy: HOY, umbral });
    const vencidos = (ag?.listaAbiertos || []).filter((i) => i.fecha_limite && String(i.fecha_limite).slice(0, 10) < hoyIso);
    porUsuario.set(u.user_id, { tele, acc, agenda: ag, vencidos, inact, evalPendiente: web.evaluacionPendiente(u, [], { hoy: HOY }) });
  }
  const pulso = web.pulsoEquipo(internos, porUsuario, { agendaItems, hoy: HOY });
  return { porUsuario, pulso };
}

test('serieActividadDias: 28 días, personas distintas y horas por día, lunes etiquetados', () => {
  const s = calc.serieActividadDias(eventos, { hoy: HOY, soloUsuarios: new Set(internos.map((u) => u.user_id)) });
  assert.equal(s.length, 28); assert.equal(s.at(-1).dia, '2026-10-06'); assert.equal(s.at(-1).personas, 2); assert.equal(s.at(-1).horas, 0.1);
  assert.equal(s.at(-2).personas, 1); assert.equal(s.find((d) => d.dia === '2026-09-28').personas, 1); assert.equal(s.find((d) => d.dia === '2026-10-04').personas, 0);
  assert.equal(s.filter((d) => d.lunes).length, 4); assert.equal(calc.etiquetaDia(s.at(-2)), 'L'); assert.equal(calc.etiquetaDia(s.at(-1)), '');
  assert.equal(s.at(-1).label, 'mar 6 oct');
});

test('fraseEquipo, vencidos por persona, rezagado y sub', () => {
  const { porUsuario, pulso } = armar();
  const v = calc.vencidosPorPersona(internos, porUsuario);
  assert.deepEqual(v, [{ nombre: 'Karolina', n: 3 }, { nombre: 'Fernando', n: 1 }]);
  assert.equal(calc.lineaVencidos(v), 'Karolina 3 · Fernando 1');
  const r = calc.masRezagado(internos, porUsuario);
  assert.equal(r.nombre, 'David'); assert.equal(r.sinEntrar, true); assert.equal(r.dias, 6);
  const f = calc.fraseEquipo({ pulso, total: 3, vencidos: v, rezagado: r, agendaDisponible: true });
  assert.equal(f, '2 de 3 entraron hoy; el equipo trae 4 pendientes vencidos (3 de Karolina) y el 67 % de los pendientes de 30 días se cerró a tiempo. David lleva 6 días hábiles sin entrar.');
  assert.equal(calc.subEquipo({ pulso, evalsPendientes: [usuarios[1]], hoy: HOY }), '10m activas esta semana · 4 sesiones · 1 evaluación de sep sin cerrar');
  const u = calc.ultimoEnEntrar(internos, porUsuario); assert.equal(u.nombre, 'Karolina'); assert.equal(calc.haceCuanto(u.ts, HOY), 'hace 8 min');
  assert.equal(calc.haceCuanto(ts('2026-10-06', '08:00'), HOY), 'hace 3 h'); assert.equal(calc.haceCuanto(ts('2026-10-05', '10:00'), HOY), 'ayer'); assert.equal(calc.haceCuanto(ts('2026-10-02', '10:00'), HOY), 'hace 4 d');
});

test('ritmo, línea de la fila, estado y sub de la ficha', () => {
  const { porUsuario } = armar();
  assert.equal(calc.ritmoTexto(horasK), '8:30 → 13:00 · 14:00 → 18:00');
  assert.equal(calc.ritmoTexto({ armar: '09:00', pausa: '18:00', retomar: '18:00', cierre: '18:00' }), '9:00 → 18:00');
  assert.equal(calc.ritmoTexto(null), null);
  const k = usuarios[1], dk = porUsuario.get('u-k');
  assert.equal(calc.lineaPersona({ u: k, datos: dk, hoy: HOY }), '8:30 → 13:00 · 14:00 → 18:00 · día armado · plan 1h 30m · real 25m');
  assert.equal(calc.lineaPersona({ u: usuarios[2], datos: porUsuario.get('u-d'), hoy: HOY }), 'sin ritmo configurado · sin armar su día');
  assert.deepEqual(calc.estadoPersona({ datos: dk, hoy: HOY }), { tone: 'green', label: 'hace 8 min' });
  assert.deepEqual(calc.estadoPersona({ datos: porUsuario.get('u-d'), hoy: HOY }), { tone: 'red', label: '6 d sin entrar' });
  assert.deepEqual(calc.estadoPersona({ datos: porUsuario.get('u-f'), hoy: HOY }), { tone: 'orange', label: '3 d sin cerrar' }); // tiene un vencido y nunca ha cerrado nada
  assert.deepEqual(calc.estadoPersona({ datos: { ...porUsuario.get('u-f'), inact: null }, hoy: HOY }), { tone: 'green', label: 'hace 1 h' });
  assert.equal(calc.subPersona({ u: k, tele: dk.tele, hoy: HOY }), 'asistente comercial · 8:30 → 13:00 · 14:00 → 18:00 · activa hace 8 min');
  assert.equal(calc.subPersona({ u: usuarios[2], tele: porUsuario.get('u-d').tele, hoy: HOY }), 'contralor · última entrada hace 8 d');
  assert.equal(calc.vencidosPorGrupo(dk.vencidos), '2 Digitalife · 1 sin cliente');
});

test('frase «hoy» de la persona, semana, lo que más tocó, evaluación y mensaje', async () => {
  const { porUsuario } = armar();
  const { datosSuDia } = await vite.ssrLoadModule('/src/modules/interno/equipo/SuDia.jsx');
  const k = usuarios[1], dk = porUsuario.get('u-k');
  const s = datosSuDia({ u: k, agenda: dk.agenda, registrosHoy });
  assert.equal(calc.frasePersonaHoy({ u: k, s, vencidos: dk.vencidos, registro: s.registro, hoy: HOY }), 'Armó su día con 2 pendientes; lleva 1 hecho y 25m de las 1h 30m planeadas. Trae 3 vencidos, 2 Digitalife.');
  assert.equal(calc.subPersonaHoy({ registro: { cerrado_at: ts('2026-10-05', '18:12'), energia: 4, resumen: 'faltó cuadrar el BPRM-102' }, tele: dk.tele }), 'cerró a las 18:12 con energía 4/4 · «faltó cuadrar el BPRM-102»');
  assert.equal(calc.subPersonaHoy({ registro: null, tele: dk.tele }), '2 días de 5 esta semana · 7m activas');
  const sem = calc.diasSemana(dk.tele, { hoy: HOY, inicio: web.inicioSemana(HOY) });
  assert.equal(sem.length, 7); assert.equal(sem[0].letra, 'L'); assert.equal(sem[0].minutos, 2); assert.equal(sem[1].hoy, true); assert.equal(sem[1].minutos, 5); assert.equal(sem[2].futuro, true);
  assert.equal(calc.loQueMasToco({ lista: [{ area: 'Pagos' }, { area: 'Pagos' }, { area: 'Agenda' }] }, dk.tele), 'Lo que más tocó: Pagos (2 acciones) · Agenda (1 acción)');
  assert.match(calc.loQueMasToco(null, dk.tele, { paginaLabel: { 3: 'Sell In' } }), /^Pantallas: Sell In/);
  assert.equal(calc.fraseEvaluacion({ ratings: [5, 3, 5, 4, 4], tareas: [{ cumplida: true }, { cumplida: true }, { cumplida: false }], pctATiempo: 74, bonoTotal: 4200, ajustes: -300 }), 'Va en 4.2 de 5: cumplió 2 de 3 tareas y el 74 % de sus pendientes a tiempo. Bono del mes $4,200 con un ajuste de −$300.');
  assert.equal(calc.fraseEvaluacion({ ratings: [0, 0, 0, 0, 0], tareas: [], pctATiempo: null, bonoTotal: 3000, ajustes: 0 }), 'Sin calificar aún. Bono del mes $3,000.');
  assert.equal(calc.subEvaluacion({ ratings: [5, 3, 0, 0, 0], historial: [4, 4.2, null], nRubros: 5 }), 'promedio de los últimos 2 meses 4.1 · 3 rubros por calificar');
  const msg = calc.textoMensaje({ u: k, vencidos: dk.vencidos, deHoy: s.deHoy, hoy: HOY });
  assert.match(msg, /^Hola Karolina,\n\nTraes 3 pendientes vencidos:\n• Pendiente k3 \(límite 2026-09-30\)/); assert.match(msg, /Para hoy tienes 1 pendiente:\n• 12:00 Pendiente k4/);
});

test('SSR · Equipo y Persona con datos de ejemplo', () => {
  const { porUsuario, pulso } = armar();
  const serie = calc.serieActividadDias(eventos, { hoy: HOY });
  const html = render(EquipoVista, { hoy: HOY, hoyIso: '2026-10-06', internos, externos, internosOrden: web.ordenarPersonas(internos, porUsuario), externosOrden: externos, porUsuario, pulso, evalsPendientes: [usuarios[1]], serie, agendaDisponible: true, umbral: 3, onUmbral() {} });
  sano(html, 'equipo');
  assert.match(html, /2 de 3 entraron hoy/); assert.match(html, /Activos hoy/); assert.match(html, /Pendientes a tiempo/); assert.match(html, /Vencidos del equipo/); assert.match(html, /Karolina 3 · Fernando 1/);
  assert.match(html, /Evaluaciones/); assert.match(html, /sep · Karolina/); assert.match(html, /Actividad por día · 4 semanas/); assert.match(html, /Personas activas/); assert.match(html, /Inactivo a partir de/); assert.match(html, /3 días/);
  assert.match(html, /Acteck · equipo interno/); assert.match(html, /8:30 → 13:00 · 14:00 → 18:00 · día armado/); assert.match(html, /3 venc\./); assert.match(html, /6 d sin entrar/); assert.match(html, /Externos · clientes y aliados/);
  assert.ok(!/margen|costo|utilidad/i.test(html), 'sin costos ni márgenes');

  const k = usuarios[1];
  const p = render(PersonaVista, { u: k, datos: porUsuario.get('u-k'), agendaDisponible: true, evaluaciones: [], mesActual: null, registrosHoy, hoy: HOY, nav, invalidar() {}, onMensaje() {}, onReasignar() {} });
  sano(p, 'persona');
  assert.match(p, /Karolina Ruiz/); assert.match(p, /asistente comercial · 8:30 → 13:00 · 14:00 → 18:00 · activa hace 8 min/); assert.match(p, /Su día/); assert.match(p, /Semana/); assert.match(p, /Pendientes/); assert.match(p, /Evaluación/);
  assert.match(p, /Armó su día con 2 pendientes; lleva 1 hecho/); assert.match(p, /Esta semana/); assert.match(p, /A tiempo/); assert.match(p, /2 Digitalife · 1 sin cliente/); assert.match(p, /Mandar mensaje/); assert.match(p, /Sin celular en su perfil/); assert.match(p, /Reasignar vencidos/);
  const sem = render(PersonaVista, { u: k, datos: porUsuario.get('u-k'), agendaDisponible: true, evaluaciones: [], mesActual: null, registrosHoy, hoy: HOY, nav, vistaInicial: 'semana' });
  sano(sem, 'semana'); assert.match(sem, /entradas por día/); assert.match(sem, /Día por día/); assert.match(sem, /Pantallas: /);
  const pen = render(PersonaVista, { u: k, datos: porUsuario.get('u-k'), agendaDisponible: true, evaluaciones: [], mesActual: null, registrosHoy, hoy: HOY, nav, vistaInicial: 'pendientes' });
  sano(pen, 'pendientes'); assert.match(pen, /Vencidos/); assert.match(pen, /Pendiente k3/); assert.match(pen, /Reasignar/);
  const ext = render(PersonaVista, { u: usuarios[3], datos: porUsuario.get('u-x'), agendaDisponible: true, evaluaciones: [], mesActual: null, registrosHoy, hoy: HOY, nav });
  sano(ext, 'externo'); assert.match(ext, /Externo/); assert.match(ext, /Digitalife/);
});

test('telefonoWa / urlWhatsApp: 10 dígitos → 52, con lada se respeta, basura → null', () => {
  assert.equal(calc.telefonoWa('33 1234 5678'), '523312345678'); assert.equal(calc.telefonoWa('+52 (33) 1234-5678'), '523312345678'); assert.equal(calc.telefonoWa('12345'), null); assert.equal(calc.telefonoWa(null), null);
  assert.equal(calc.urlWhatsApp('3312345678', 'Hola Karolina'), 'https://wa.me/523312345678?text=Hola%20Karolina'); assert.equal(calc.urlWhatsApp('', 'x'), null);
});

test('ruta: telemetria → Equipo (push)', () => {
  const d = rutas.destino({ pagina: 'telemetria' });
  assert.equal(d.tipo, 'push'); assert.equal(d.key, 'equipo');
});
