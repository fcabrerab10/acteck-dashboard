// Pruebas del cálculo puro de Actividad del equipo (telemetría, auditoría, agenda, inactividad, pulso).
//   node scripts/test-equipo-calculo.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isoDia, inicioSemana, diasHabilesEntre, sesiones, resumenTelemetria, acciones, principales, resumenAcciones,
  cumplimientoAgenda, vencidosEquipo, inactividad, evaluacionPendiente, serieBonos, pulsoEquipo, ordenarPersonas, bonoEstimado,
} from '../src/modules/interno/equipo/calculo.js';
import { traducirAccion, humanizar, textoInactividad, fraseHero } from '../src/modules/interno/equipo/textos.js';

const HOY = new Date(2026, 8, 10, 11); // jueves 10 sep 2026, 11:00 local
const ts = (dia, hora) => new Date(`${dia}T${hora}:00`).toISOString();
const hb = (dia, hora, extra = {}) => ({ user_id: 'u1', ts: ts(dia, hora), tipo: 10, cliente: 2, pagina: 3, ...extra });

test('fechas: isoDia local, lunes de la semana, días hábiles', () => {
  assert.equal(isoDia(HOY), '2026-09-10');
  assert.equal(isoDia(inicioSemana(HOY)), '2026-09-07');
  assert.equal(isoDia(inicioSemana(new Date(2026, 8, 6))), '2026-08-31'); // domingo → lunes anterior
  assert.equal(diasHabilesEntre(new Date(2026, 8, 9), HOY), 1);
  assert.equal(diasHabilesEntre(new Date(2026, 8, 4), HOY), 4);            // vie 4 → jue 10: lun, mar, mié, jue
  assert.equal(diasHabilesEntre(HOY, HOY), 0);
  assert.equal(diasHabilesEntre(null, HOY), null);
});

test('sesiones: se cortan por huecos > 30 min y suman heartbeats', () => {
  const evs = [hb('2026-09-10', '09:00'), hb('2026-09-10', '09:01'), hb('2026-09-10', '09:02'), hb('2026-09-10', '10:30'), { user_id: 'u1', ts: ts('2026-09-10', '10:31'), tipo: 5, pagina: 3 }];
  const s = sesiones(evs);
  assert.equal(s.length, 2);
  assert.equal(s[0].minutos, 3);
  assert.equal(s[1].minutos, 1);
  assert.equal(s[1].acciones, 1);
  assert.equal(s[0].dia, '2026-09-10');
  assert.deepEqual(s[0].paginas, { 3: 3 });
});

test('resumenTelemetria: activo hoy, minutos de la semana, cliente top', () => {
  const evs = [hb('2026-09-03', '09:00'), hb('2026-09-08', '09:00', { cliente: 1 }), hb('2026-09-08', '09:01', { cliente: 1 }), hb('2026-09-10', '10:00', { cliente: 2 })];
  const r = resumenTelemetria(evs, { hoy: HOY });
  assert.equal(r.activoHoy, true);
  assert.equal(r.diasActivos, 3);
  assert.equal(r.diasActivosSemana, 2);
  assert.equal(r.minutos, 4);
  assert.equal(r.minutosSemana, 3);
  assert.equal(r.sesionesSemana, 2);
  assert.equal(r.clienteTop, 1);
  assert.equal(r.pctClienteTop, 67);
  assert.equal(isoDia(r.ultimo), '2026-09-10');
  const vacio = resumenTelemetria([], { hoy: HOY });
  assert.equal(vacio.activoHoy, false);
  assert.equal(vacio.ultimo, null);
});

test('traducirAccion: mapa de negocio, funciones por cambios, fallback humanizado', () => {
  assert.equal(traducirAccion({ tabla: 'oc_clientes', operacion: 'INSERT' }).label, 'OC registrada');
  assert.equal(traducirAccion({ tabla: 'propuestas_borradores', operacion: 'UPDATE', cambios: { estado: { de: 'borrador', a: 'enviada' } } }).label, 'Propuesta enviada');
  assert.equal(traducirAccion({ tabla: 'propuestas_borradores', operacion: 'UPDATE', cambios: { titulo: { de: 'a', a: 'b' } } }).label, 'Propuesta editada');
  assert.equal(traducirAccion({ tabla: 'sync_solicitudes', operacion: 'INSERT' }).label, 'Corrida pedida');
  assert.equal(traducirAccion({ tabla: 'agenda_items', operacion: 'INSERT', cambios: { tipo: 'punto' } }).label, 'Punto de reunión creado');
  assert.equal(traducirAccion({ tabla: 'agenda_items', operacion: 'UPDATE', cambios: { estado: { de: 'abierta', a: 'hecha' } } }).label, 'Pendiente cerrado');
  assert.equal(traducirAccion({ tabla: 'sop_reuniones', operacion: 'INSERT' }).label, 'Reunión de S&OP registrada');
  assert.equal(traducirAccion({ tabla: 'perfiles', operacion: 'UPDATE', cambios: { permisos: { de: {}, a: {} } } }).label, 'Permisos cambiados');
  assert.equal(traducirAccion({ tabla: 'perfiles', operacion: 'UPDATE', cambios: { preferencias: { de: {}, a: {} } } }), null);   // ruido de UI
  assert.equal(traducirAccion({ tabla: 'perfiles', operacion: 'UPDATE', cambios: { tema_ui: { de: 'claro', a: 'midnight' } } }), null);
  assert.equal(traducirAccion({ tabla: 'perfiles', operacion: 'UPDATE', cambios: { se_evalua: { de: false, a: true } } }).label, 'Evaluación mensual activada');
  assert.equal(acciones([{ tabla: 'perfiles', operacion: 'UPDATE', cambios: { preferencias: { de: {}, a: {} } }, creado_at: '2026-09-10T10:00:00Z' }, { tabla: 'pagos', operacion: 'INSERT', cambios: {}, creado_at: '2026-09-10T11:00:00Z' }]).length, 1);
  assert.equal(traducirAccion({ tabla: 'evaluaciones_mensuales', operacion: 'UPDATE', cambios: { cerrada: { de: false, a: true } } }).label, 'Evaluación mensual cerrada');
  assert.equal(traducirAccion({ tabla: 'tabla_rara', operacion: 'DELETE' }).label, 'Tabla rara eliminado');
  assert.equal(traducirAccion({ tabla: 'tabla_rara', operacion: 'DELETE' }).area, 'Otros');
  assert.equal(humanizar('oc_x', 'INSERT'), 'Oc x creado');
});

test('resumenAcciones: semana actual, 3 principales, por día y 4 semanas', () => {
  const f = (dia, tabla, operacion, cambios = {}) => ({ tabla, operacion, cambios, creado_at: ts(dia, '10:00'), usuario_id: 'u1' });
  const filas = [
    f('2026-09-10', 'oc_clientes', 'INSERT'), f('2026-09-09', 'oc_clientes', 'INSERT'), f('2026-09-08', 'oc_clientes', 'INSERT'),
    f('2026-09-08', 'sync_solicitudes', 'INSERT'), f('2026-09-07', 'sync_solicitudes', 'INSERT'),
    f('2026-09-07', 'agenda_items', 'UPDATE', { estado: { de: 'abierta', a: 'hecha' } }),
    f('2026-09-03', 'pagos', 'INSERT'), f('2026-08-20', 'pagos', 'INSERT'), f('2026-08-01', 'pagos', 'INSERT'),
  ];
  const r = resumenAcciones(filas, { hoy: HOY });
  assert.equal(r.total, 9);
  assert.equal(r.semana, 6);
  assert.deepEqual(r.principales, [{ label: 'OC registrada', n: 3 }, { label: 'Corrida pedida', n: 2 }, { label: 'Pendiente cerrado', n: 1 }]);
  assert.equal(r.porDia[0].dia, '2026-09-10');
  assert.equal(r.porDia.find((d) => d.dia === '2026-09-08').items.length, 2);
  assert.equal(r.semanas.length, 4);
  assert.equal(r.semanas[0].inicio, '2026-09-07');
  assert.equal(r.semanas[0].total, 6);
  assert.equal(r.semanas[1].total, 1);   // 3 sep
  assert.equal(r.semanas[3].total, 1);   // 20 ago (17-23 ago)
  assert.deepEqual(principales([], 3), []);
});

const it = (o) => ({ tipo: 'tarea', estado: 'abierta', responsables: ['u1'], fecha_limite: null, completado_en: null, ...o });
const AGENDA = [
  it({ id: 'a', fecha_limite: '2026-09-08' }),                                        // vencida
  it({ id: 'b', fecha_limite: '2026-09-15' }),                                        // abierta futura
  it({ id: 'c', estado: 'hecha', fecha_limite: '2026-09-05', completado_en: ts('2026-09-04', '10:00') }),   // a tiempo
  it({ id: 'd', estado: 'hecha', fecha_limite: '2026-09-01', completado_en: ts('2026-09-03', '10:00') }),   // tarde
  it({ id: 'e', tipo: 'punto', estado: 'hecha', fecha_limite: null, completado_en: ts('2026-09-02', '10:00') }), // punto a tiempo
  it({ id: 'f', estado: 'hecha', completado_en: ts('2026-07-01', '10:00') }),          // fuera de 30 d
  it({ id: 'g', responsables: ['u2'], fecha_limite: '2026-09-01' }),                  // de otro, vencida
  it({ id: 'h', estado: 'cancelada', fecha_limite: '2026-09-01' }),
];

test('cumplimientoAgenda: abiertos, vencidos, cerrados a tiempo en 30 d, puntos', () => {
  const c = cumplimientoAgenda(AGENDA, 'u1', { hoy: HOY });
  assert.equal(c.abiertos, 2);
  assert.equal(c.vencidos, 1);
  assert.equal(c.cerrados, 3);
  assert.equal(c.aTiempo, 2);
  assert.equal(c.pctATiempo, 67);
  assert.equal(c.puntosCerrados, 1);
  assert.equal(isoDia(c.ultimoCierre), '2026-09-04');
  assert.deepEqual(c.listaAbiertos.map((x) => x.id), ['a', 'b']);
  assert.equal(vencidosEquipo(AGENDA, { hoy: HOY }), 2);
  const nada = cumplimientoAgenda([], 'u1', { hoy: HOY });
  assert.equal(nada.pctATiempo, null);
});

test('inactividad: umbral en días hábiles, sin entrar / sin cerrar', () => {
  assert.equal(inactividad({ ultimoEvento: ts('2026-09-10', '09:00'), hoy: HOY }), null);
  assert.equal(inactividad({ ultimoEvento: ts('2026-09-08', '09:00'), hoy: HOY, umbral: 3 }), null); // 2 hábiles
  const i = inactividad({ ultimoEvento: ts('2026-09-04', '09:00'), hoy: HOY, umbral: 3 });      // 4 hábiles
  assert.equal(i.sinEntrar, true); assert.equal(i.diasSinEntrar, 4);
  assert.equal(textoInactividad(i), 'sin entrar 4 días hábiles');
  const j = inactividad({ ultimoEvento: ts('2026-09-10', '09:00'), agenda: { abiertos: 2, ultimoCierre: ts('2026-09-01', '09:00') }, hoy: HOY, umbral: 3 });
  assert.equal(j.sinEntrar, false); assert.equal(j.sinCerrar, true); assert.equal(j.diasSinCerrar, 7);
  assert.equal(textoInactividad(j), 'sin cerrar pendientes 7 días hábiles');
  assert.equal(inactividad({ ultimoEvento: ts('2026-09-10', '09:00'), agenda: { abiertos: 0, ultimoCierre: null }, hoy: HOY }), null);
  const nunca = inactividad({ ultimoEvento: null, hoy: HOY, umbral: 2 });
  assert.equal(nunca.sinEntrar, true); assert.equal(nunca.diasSinEntrar, 2);
});

test('evaluación: pendiente del mes anterior sólo con se_evalua; serie de 12 meses; bono', () => {
  const evals = [{ user_id: 'k', anio: 2026, mes: 8, cerrada: false, bono_total: 5000, cuota_pct: 90 }, { user_id: 'k', anio: 2026, mes: 7, cerrada: true, bono_total: 6000, cuota_pct: 110 }];
  assert.equal(evaluacionPendiente({ user_id: 'k', se_evalua: false }, evals, { hoy: HOY }), null);
  const p = evaluacionPendiente({ user_id: 'k', se_evalua: true }, evals, { hoy: HOY });
  assert.deepEqual(p, { anio: 2026, mes: 8, existe: true, vencida: true });
  assert.equal(evaluacionPendiente({ user_id: 'k', se_evalua: true }, [{ user_id: 'k', anio: 2026, mes: 8, cerrada: true }], { hoy: HOY }), null);
  const s = serieBonos(evals, 'k', { hoy: HOY });
  assert.equal(s.length, 12);
  assert.deepEqual(s[11], { anio: 2026, mes: 9, bono: null, cuotaPct: null, cerrada: false });
  assert.equal(s[10].bono, 5000);
  assert.equal(s[9].cerrada, true);
  assert.equal(s[0].anio, 2025); assert.equal(s[0].mes, 10);
  assert.equal(bonoEstimado(1_000_000), 3400);
});

test('pulsoEquipo y ordenarPersonas', () => {
  const us = [{ user_id: 'a', nombre: 'Zoe' }, { user_id: 'b', nombre: 'Ana', se_evalua: true }, { user_id: 'c', nombre: 'Beto' }];
  const por = new Map([
    ['a', { tele: { activoHoy: true, sesionesSemana: 3, minutosSemana: 100 }, acc: { semana: 4 }, agenda: { cerrados: 2, aTiempo: 2 }, inact: null }],
    ['b', { tele: { activoHoy: false, sesionesSemana: 1, minutosSemana: 20 }, acc: { semana: 1 }, agenda: { cerrados: 2, aTiempo: 1 }, inact: null }],
    ['c', { tele: { activoHoy: false, sesionesSemana: 0, minutosSemana: 0 }, acc: { semana: 0 }, agenda: null, inact: { sinEntrar: true } }],
  ]);
  const p = pulsoEquipo(us, por, { agendaItems: AGENDA, hoy: HOY });
  assert.equal(p.activosHoy, 1); assert.equal(p.sesionesSemana, 4); assert.equal(p.accionesSemana, 5);
  assert.equal(p.minutosSemana, 120); assert.equal(p.inactivos, 1); assert.equal(p.vencidosEquipo, 2); assert.equal(p.pctATiempo, 75);
  assert.equal(fraseHero(p, 3), '1 persona de 3 ha entrado hoy.');
  assert.equal(fraseHero({ activosHoy: 3 }, 3), 'Todo el equipo ha entrado hoy.');
  assert.deepEqual(ordenarPersonas(us, por).map((u) => u.user_id), ['c', 'b', 'a']);
  const sinAgenda = pulsoEquipo(us, por, { agendaItems: null, hoy: HOY });
  assert.equal(sinAgenda.vencidosEquipo, null);
});
