// Smoke SSR de la Agenda V4: carga con el pipeline de Vite todos los módulos que toca el rediseño
// (web y móvil) y RENDERIZA a string las piezas que no necesitan red, con datos sembrados, para
// atrapar imports rotos, JSX inválido y NaN/undefined antes de abrir el navegador.
//   node --test scripts/test-agenda-ssr.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';

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

const HOY = new Date(2026, 8, 21, 11);   // lunes 21 sep 2026
const PERSONAS = [
  { user_id: 'u-fer', nombre: 'Fernando Cabrera', email: 'fernando.cabrera@acteck.com', handle: 'fernando' },
  { user_id: 'u-kar', nombre: 'Karolina Veliz', email: 'karolina.veliz@acteck.com', handle: 'karolina' },
];
const PP = new Map(PERSONAS.map((p) => [p.user_id, p]));
const it = (o) => ({ tipo: 'tarea', estado: 'abierta', prioridad: 'media', responsables: ['u-fer'], cliente_key: 'pcel', categoria: null, notas: null, created_at: '2026-09-01', creado_por: 'u-kar', ...o });
const ITEMS = [
  it({ id: 'a', titulo: 'Confirmar rebate Q3', fecha_limite: '2026-09-18' }),
  it({ id: 'b', titulo: 'Mandar propuesta a CT', fecha_limite: '2026-09-21', cliente_key: 'ct' }),
  it({ id: 'c', titulo: 'Material POP', fecha_limite: '2026-09-24', cliente_key: 'dicotech', responsables: ['u-kar'] }),
  it({ id: 'd', titulo: 'Idea suelta', fecha_limite: null, responsables: [] }),
  it({ id: 'e', titulo: 'Subir el P&L', fecha_limite: '2026-09-10', estado: 'hecha', completado_en: '2026-09-11T10:00:00Z' }),
  it({ id: 'f', titulo: 'Cancelado', fecha_limite: '2026-09-09', estado: 'cancelada', updated_at: '2026-09-09T10:00:00Z' }),
];
const SUBTAREAS = [
  { id: 's1', item_id: 'a', titulo: 'Bajar el reporte', hecha: true, orden: 0, created_at: '2026-09-02' },
  { id: 's2', item_id: 'a', titulo: 'Cruzar con el ERP', hecha: false, orden: 1, created_at: '2026-09-03' },
  { id: 's3', item_id: 'b', titulo: 'Único paso', hecha: true, orden: 0, created_at: '2026-09-04' },
];
const REUNIONES = [
  { id: 'r1', tipo: 'reunion', titulo: 'Revisión de sell-out', cliente_key: 'pcel', fecha: '2026-09-21T17:00:00Z', duracion_min: 60, estado: 'programada', asistentes: [] },
  { id: 'r2', tipo: 'viaje', titulo: 'Viaje a Monterrey', cliente_key: 'interno', fecha: '2026-09-24T15:00:00Z', fecha_fin: '2026-09-26T23:00:00Z', duracion_min: 540, estado: 'programada', asistentes: [] },
];
const CUENTAS = [
  { id: 'c1', nombre: 'Luis De Viana', empresa: null, telefono: '+52 55 1053 6205', tipo: 'mayorista', mayorista: 'CVA', vendedor: '', estado: 'activa', proximo_seguimiento: '2026-09-18', recordar_cada_dias: 14, ultimo_contacto: null, notas: 'Proyectos del Tec.' },
  { id: 'c2', nombre: 'Juan José', empresa: 'PSA Cómputo y Papelería', telefono: '+52 618 237 0717', tipo: 'mayorista', mayorista: 'CVA', vendedor: 'Sarahi', estado: 'activa', proximo_seguimiento: '2026-10-30', recordar_cada_dias: 14, ultimo_contacto: '2026-09-15', notas: null },
];
const NOTAS = new Map([['c1', [{ id: 'n1', cuenta_id: 'c1', fecha: '2026-09-01', texto: 'Se presentó el portafolio.' }]]]);

const sano = (html, donde) => {
  assert.ok(!/NaN/.test(html), `${donde}: sale un NaN en pantalla`);
  assert.ok(!/undefined/.test(html), `${donde}: sale un "undefined" en pantalla`);
  assert.ok(!/\[object Object\]/.test(html), `${donde}: sale un [object Object]`);
};

test('cargan todos los módulos que toca la Agenda V4 (web y móvil)', async () => {
  const conDefault = [
    '/src/modules/agenda/Agenda.jsx', '/src/modules/agenda/Calendario.jsx', '/src/modules/agenda/Mes.jsx',
    '/src/modules/agenda/Semana.jsx', '/src/modules/agenda/Pendientes.jsx', '/src/modules/agenda/Cuentas.jsx',
    '/src/modules/agenda/Archivados.jsx', '/src/modules/agenda/Subtareas.jsx', '/src/modules/agenda/HojaItem.jsx',
    '/src/modules/agenda/Reuniones.jsx', '/src/modules/agenda/Minuta.jsx', '/src/modules/agenda/FormReunion.jsx',
    '/src/modules/agenda/HojaReparto.jsx', '/src/movil/pestanas/agenda/Reparto.jsx', '/src/movil/pestanas/agenda/Minuta.jsx',
    '/src/movil/pestanas/agenda/Agenda.jsx', '/src/movil/pestanas/agenda/Pendientes.jsx',
    '/src/movil/pestanas/agenda/Cuentas.jsx', '/src/movil/pestanas/agenda/Archivados.jsx',
    '/src/movil/pestanas/agenda/Semana.jsx', '/src/movil/pestanas/agenda/Captura.jsx',
    '/src/modules/comercial/HomeClienteV3.jsx',
  ];
  for (const m of conDefault) {
    const mod = await vite.ssrLoadModule(m);
    assert.equal(typeof mod.default, 'function', `${m} debe exportar default`);
  }
  const datos = await vite.ssrLoadModule('/src/modules/agenda/datos.js');
  for (const h of ['useAgendaV4', 'useSubtareas', 'useCuentas', 'useMinutasCliente', 'crearSubtarea', 'marcarSubtarea',
    'borrarSubtarea', 'moverSubtarea', 'crearCuenta', 'actualizarCuenta', 'borrarCuenta', 'agregarNotaCuenta',
    'registrarContactoCuenta', 'crearPendienteDeCuenta', 'repartirAcuerdos']) {
    assert.equal(typeof datos[h], 'function', `datos.js debe exportar ${h}`);
  }
  const bloques = await vite.ssrLoadModule('/src/modules/comercial/home/bloques.jsx');
  assert.equal(typeof bloques.MinutasCliente, 'function', 'el Resumen del cliente necesita MinutasCliente');
  const inicio = await vite.ssrLoadModule('/src/modules/general/inicio/bloques.jsx');
  assert.equal(typeof inicio.agruparAvisos, 'function', 'el bloque Hoy de Inicio agrupa los avisos de SKUs');
});

test('la lista por horizonte renderiza con datos sembrados', async () => {
  const { default: Pendientes } = await vite.ssrLoadModule('/src/modules/agenda/Pendientes.jsx');
  const { ThemeProvider } = await vite.ssrLoadModule('/src/lib/themeContext.jsx');
  const { progresoPorItem } = await vite.ssrLoadModule('/src/modules/agenda/calculo.js');
  const html = renderToString(React.createElement(ThemeProvider, null, React.createElement(Pendientes, {
    items: ITEMS, personas: PERSONAS, personasPorId: PP, porId: new Map(ITEMS.map((i) => [i.id, i])),
    reuniones: REUNIONES, hoy: HOY, uid: 'u-fer', progreso: progresoPorItem(SUBTAREAS), puedeEditar: true,
    onAbrir: () => {}, onToggle: () => {}, onPosponer: () => {},
  })));
  sano(html, 'Pendientes');
  assert.ok(html.includes('Vencidos'), 'el bloque de vencidos debe salir');
  assert.ok(html.includes('Confirmar rebate Q3'), 'el vencido de Fernando aparece');
  assert.ok(html.includes('Mandar propuesta a CT'), 'lo de hoy aparece');
  assert.ok(!html.includes('Material POP'), 'lo de Karolina NO sale en "Mis pendientes"');
  assert.ok(!html.includes('Subir el P&amp;L') && !html.includes('Subir el P&L'), 'lo hecho no sale en Pendientes');
  assert.ok(html.includes('1/2'), 'el progreso de subtareas sale como pastilla');
});

test('archivados muestra lo hecho y lo cancelado, nunca lo abierto', async () => {
  const { default: Archivados } = await vite.ssrLoadModule('/src/modules/agenda/Archivados.jsx');
  const { ThemeProvider } = await vite.ssrLoadModule('/src/lib/themeContext.jsx');
  const html = renderToString(React.createElement(ThemeProvider, null, React.createElement(Archivados, {
    items: ITEMS, personasPorId: PP, hoy: HOY, progreso: new Map(), puedeEditar: true, onAbrir: () => {},
  })));
  sano(html, 'Archivados');
  assert.ok(html.includes('Cancelado'), 'lo cancelado se archiva');
  assert.ok(html.includes('Desarchivar'), 'se puede desarchivar');
  assert.ok(!html.includes('Confirmar rebate Q3'), 'lo abierto no se archiva');
});

test('la lista de cuentas pinta el semáforo, el teléfono y los enlaces', async () => {
  const { default: Cuentas } = await vite.ssrLoadModule('/src/modules/agenda/Cuentas.jsx');
  const { ThemeProvider } = await vite.ssrLoadModule('/src/lib/themeContext.jsx');
  const html = renderToString(React.createElement(ThemeProvider, null, React.createElement(Cuentas, {
    cuentas: CUENTAS, notasPorCuenta: NOTAS, personas: PERSONAS, hoy: HOY, puedeEditar: true, onNavegarPendientes: () => {},
  })));
  sano(html, 'Cuentas');
  assert.ok(html.includes('Luis De Viana'), 'la cuenta vencida sale');
  assert.ok(html.includes('seguimiento vencido'), 'el encabezado cuenta los vencidos');
  assert.ok(html.includes('wa.me/525510536205'), 'el enlace de WhatsApp está normalizado');
  assert.ok(html.includes('tel:+525510536205'), 'el enlace de llamada está normalizado');
  assert.ok(html.includes('Sarahi'), 'el vendedor que lleva la cuenta se ve');
});

test('el checklist de subtareas sugiere cerrar el pendiente pero no lo cierra solo', async () => {
  const { default: Subtareas } = await vite.ssrLoadModule('/src/modules/agenda/Subtareas.jsx');
  const { ThemeProvider } = await vite.ssrLoadModule('/src/lib/themeContext.jsx');
  const parcial = renderToString(React.createElement(ThemeProvider, null, React.createElement(Subtareas, {
    item: ITEMS[0], subtareas: SUBTAREAS, puedeEditar: true, onMarcarHecho: () => {},
  })));
  sano(parcial, 'Subtareas (parcial)');
  assert.ok(parcial.includes('1/2'));
  assert.ok(!parcial.includes('¿marcar como hecho?'), 'con pasos pendientes no se sugiere cerrar');
  const completo = renderToString(React.createElement(ThemeProvider, null, React.createElement(Subtareas, {
    item: ITEMS[1], subtareas: SUBTAREAS, puedeEditar: true, onMarcarHecho: () => {},
  })));
  assert.ok(completo.includes('¿marcar como hecho?'), 'con todo listo se sugiere, con botón');
  assert.ok(completo.includes('1/1'));
});

test('el calendario del mes pinta 42 celdas con reuniones, viajes y pendientes', async () => {
  const { default: Mes } = await vite.ssrLoadModule('/src/modules/agenda/Mes.jsx');
  const { ThemeProvider } = await vite.ssrLoadModule('/src/lib/themeContext.jsx');
  const { FUENTES_CALENDARIO } = await vite.ssrLoadModule('/src/modules/agenda/calculo.js');
  const toggles = new Set(FUENTES_CALENDARIO.map((f) => f.id));
  const html = renderToString(React.createElement(ThemeProvider, null, React.createElement(Mes, {
    ini: new Date(2026, 8, 1), datos: { reuniones: REUNIONES, items: ITEMS, google: [] }, toggles, hoy: HOY,
    onAbrir: () => {}, onDia: () => {}, puedeEditar: true, onSoltar: () => {},
  })));
  sano(html, 'Mes');
  assert.ok(html.includes('Revisión de sell-out'), 'la reunión se pinta en su día');
  assert.ok(html.includes('Viaje a Monterrey'), 'el viaje se pinta');
  assert.ok((html.match(/Viaje a Monterrey/g) || []).length >= 3, 'el viaje ocupa sus tres días (24, 25 y 26)');
  assert.ok(html.includes('Mandar propuesta a CT'), 'los pendientes con fecha se pintan');
  assert.ok(!html.includes('Idea suelta'), 'lo que no tiene fecha no cae en ningún día');
});

test('los avisos de SKUs del bloque "Hoy" de Inicio se agrupan en una línea por área', async () => {
  const { agruparAvisos } = await vite.ssrLoadModule('/src/modules/general/inicio/bloques.jsx');
  const avisos = [
    ...Array.from({ length: 90 }, (_, i) => ({ id: `a${i}`, fuente: 'Alertas', severidad: i < 3 ? 'critica' : 'media' })),
    { id: 't1', fuente: 'Tracking', severidad: 'alta' },
  ];
  const g = agruparAvisos(avisos);
  assert.equal(g.length, 2, 'dos líneas: una por fuente, no 91 filas');
  assert.deepEqual(g[0], { fuente: 'Alertas', n: 90, criticos: 3, pagina: 'inicio' });
  assert.equal(g[1].fuente, 'Tracking');
  assert.deepEqual(agruparAvisos([]), []);
});

test('el correo de la Agenda se arma con lo correcto y no se manda vacío', async () => {
  const { armarCorreoAgenda, destinatariosAhora } = await import('../api/cron.js');
  const items = ITEMS.map((i) => ({ ...i }));
  const manana = armarCorreoAgenda({
    momento: 'manana', userId: 'u-fer', items, reuniones: REUNIONES,
    cuentas: [CUENTAS[0]], fuentes: [], hoy: '2026-09-21',
  });
  assert.equal(manana.titulo, 'Lo que dejaste');
  const titulos = manana.secciones.map((s) => s.titulo);
  assert.deepEqual(titulos, ['Vencidos', 'Hoy', 'Cuentas por contactar']);
  assert.equal(manana.secciones[0].filas[0].titulo, 'Confirmar rebate Q3');
  assert.match(manana.secciones[2].filas[0].titulo, /Luis De Viana/);

  const tarde = armarCorreoAgenda({
    momento: 'tarde', userId: 'u-kar', items, reuniones: REUNIONES,
    cuentas: [], fuentes: [{ titulo: 'Sell Out Digitalife', vence: '2026-09-22' }], hoy: '2026-09-21',
  });
  assert.equal(tarde.titulo, 'Lo que tienes mañana');
  assert.ok(tarde.secciones.some((s) => s.titulo === 'Cargas de datos de mañana'));

  // Sin nada que contar: null (la task no manda correo).
  assert.equal(armarCorreoAgenda({ momento: 'manana', userId: 'u-nadie', items, reuniones: [], cuentas: [], fuentes: [], hoy: '2026-09-21' }), null);
  assert.equal(armarCorreoAgenda({ momento: 'tarde', userId: 'u-nadie', items: [], reuniones: [], cuentas: [], fuentes: [], hoy: '2026-09-21' }), null);

  // Horarios: 08:15 Karolina · 08:30 Fernando · 15:00 Karolina · 17:00 Fernando (L-V).
  assert.deepEqual(destinatariosAhora('08:15'), [{ email: 'karolina.veliz@acteck.com', momento: 'manana' }]);
  assert.deepEqual(destinatariosAhora('08:30'), [{ email: 'fernando.cabrera@acteck.com', momento: 'manana' }]);
  assert.deepEqual(destinatariosAhora('15:00'), [{ email: 'karolina.veliz@acteck.com', momento: 'tarde' }]);
  assert.deepEqual(destinatariosAhora('17:00'), [{ email: 'fernando.cabrera@acteck.com', momento: 'tarde' }]);
  assert.deepEqual(destinatariosAhora('11:00'), [], 'fuera de horario no se manda nada');
  // David Millán nunca está en la lista.
  assert.equal(['08:15', '08:30', '15:00', '17:00'].some((h) => destinatariosAhora(h).some((x) => /dmillan/.test(x.email))), false);
});

test('los crones de la Agenda están declarados en vercel.json', async () => {
  const { readFileSync } = await import('node:fs');
  const v = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const agenda = v.crons.filter((c) => c.path.includes('agenda-correo'));
  assert.deepEqual(agenda.map((c) => c.schedule).sort(), ['0 21,23 * * 1-5', '15,30 14 * * 1-5']);
  assert.equal(v.crons.some((c) => c.path.includes('agenda-hoy')), false, 'agenda-hoy se reemplazó por agenda-correo');
  // Plan Hobby: 12 funciones serverless; los crones no cuentan, pero conviene no dispararse.
  assert.ok(v.crons.length <= 20, 'demasiadas entradas de cron');
});

test('el reparto de la minuta pinta una fila por acuerdo y sabe cerrar', async () => {
  const { default: Reparto } = await vite.ssrLoadModule('/src/modules/agenda/HojaReparto.jsx');
  const { ThemeProvider } = await vite.ssrLoadModule('/src/lib/themeContext.jsx');
  const { detectarAcuerdos } = await vite.ssrLoadModule('/src/modules/agenda/reparto.js');
  const notas = [
    'Revisamos el avance del trimestre con Karolina.',
    '- Mandar la cotización actualizada',
    'Confirmar el POP @karolina el viernes',
    '- Confirmar rebate Q3',
  ].join('\n');
  const filas = detectarAcuerdos(notas, { clienteKey: 'pcel', personas: PERSONAS, hoy: HOY, yo: 'u-fer', existentes: [{ titulo: 'Confirmar rebate Q3' }] });
  assert.equal(filas.length, 3, 'tres líneas son acuerdo; el contexto no');
  assert.equal(filas[2].incluir, false, 'lo que ya existe no se vuelve a crear');
  const html = renderToString(React.createElement(ThemeProvider, null, React.createElement(Reparto, {
    abierto: true, reunion: REUNIONES[0], filas, personas: PERSONAS, hoy: HOY, onClose: () => {}, onListo: () => {},
  })));
  sano(html, 'Reparto');
  assert.ok(html.includes('Mandar la cotización actualizada'), 'el acuerdo con viñeta sale');
  assert.ok(html.includes('Confirmar el POP'), 'el acuerdo con @ y fecha sale');
  assert.ok(html.includes('Crear 2 pendientes y cerrar minuta'), 'el pie cuenta sólo lo incluido');
  assert.ok(html.includes('Sólo guardar notas'), 'la salida sin crear nada está a la mano');
  assert.ok(html.includes('ya está en la minuta'), 'lo duplicado se avisa');
});
