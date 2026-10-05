// Agenda V5 · datos. Reusa el acceso de la V4 (useAgendaDatos: items + reuniones; usePersonas; actualizarItem con buzón
// sin conexión) y añade áreas, proyectos, registro del día y check-ins. Los eventos de Google se normalizan a
// { id, titulo, inicio, fin, todoElDia, url }.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { queryClient } from '../../lib/queryClient';
import { escribir } from '../../lib/buzon';
import { useAgendaDatos, usePersonas, actualizarItem, recargarAgenda, KEY_AGENDA, useSubtareas, useComentarios } from '../agenda/datos';
import { useGoogleEstado, useGoogleEventos, conectarGoogle } from '../agenda/google';
import { interpretarCaptura } from './interpretar';
import { isoDia, sumarDias } from './calculo';
export { actualizarItem, completarItem, borrarItem, crearReunion, actualizarReunion } from '../agenda/datos';

const KEY_EXTRA = ['agenda5', 'extra'];
async function uid() { const { data } = await supabase.auth.getUser(); return data?.user?.id || null; }
const limpio = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

export function useExtra5(enabled = true) {
  return useQuery({ queryKey: KEY_EXTRA, enabled, staleTime: 60 * 1000, queryFn: async () => {
    const desde = isoDia(sumarDias(new Date(), -45));
    const [a, p, r, c, o] = await Promise.all([
      supabase.from('agenda_areas').select('*').eq('archivada', false).order('orden'),
      supabase.from('agenda_proyectos').select('*').order('orden'),
      supabase.from('agenda_registro_dia').select('*').gte('fecha', desde),
      supabase.from('agenda_checkins').select('*').gte('fecha', desde),
      supabase.from('agenda_objetivos_semana').select('*').gte('semana', desde),
    ]);
    for (const x of [a, p, r, c, o]) if (x.error) throw x.error;
    return { areas: a.data || [], proyectos: p.data || [], registros: r.data || [], checkins: c.data || [], objetivos: o.data || [] };
  } });
}
export const invalidarExtra = () => queryClient.invalidateQueries({ queryKey: KEY_EXTRA });

function normalizarGoogle(evs = []) {
  return evs.map((e) => ({ id: e.id, titulo: e.summary || 'Evento', inicio: e.start?.dateTime || (e.start?.date ? `${e.start.date}T00:00:00` : null), fin: e.end?.dateTime || (e.end?.date ? `${e.end.date}T00:00:00` : null), todoElDia: !!e.start?.date && !e.start?.dateTime, url: e.htmlLink || null, lugar: e.location || null, asistentes: e.attendees || [] })).filter((e) => e.inicio);
}

/** Todo lo que necesita la pestaña para una fecha de referencia (mes visible ± 1). */
export function useAgenda5({ mesRef = new Date(), enabled = true } = {}) {
  const d = useAgendaDatos({ enabled });
  const ex = useExtra5(enabled);
  const sub = useSubtareas({ enabled });
  const com = useComentarios({ enabled });
  const g = useGoogleEstado();
  const desde = useMemo(() => isoDia(new Date(mesRef.getFullYear(), mesRef.getMonth() - 1, 1)), [mesRef]);
  const hasta = useMemo(() => isoDia(new Date(mesRef.getFullYear(), mesRef.getMonth() + 2, 0)), [mesRef]);
  const gq = useGoogleEventos(desde, hasta, enabled && g.conectado);
  const google = useMemo(() => normalizarGoogle(gq.data || []), [gq.data]);
  return { ...d, ...(ex.data || { areas: [], proyectos: [], registros: [], checkins: [], objetivos: [] }), google, googleEstado: { ...g, cargando: gq.isLoading, conectar: conectarGoogle },
    subtareas: sub.data || [], comentarios: com.data || [], cargando: d.cargando || ex.isLoading, error: d.error || ex.error || null };
}

/** Captura rápida → ítem. `propietario` = de quién es la agenda que se está viendo. */
export async function crearDesdeCaptura(texto, { personas = [], propietario = null, hoy = new Date(), extra = {} } = {}) {
  const i = interpretarCaptura(texto, personas, hoy);
  const creado_por = await uid();
  const prop = propietario || creado_por;
  const responsables = i.responsables.length ? i.responsables : [prop];
  const row = limpio({
    tipo: i.tipo === 'reunion' ? 'tarea' : i.tipo, titulo: i.titulo || '(sin título)', estado: 'abierta', prioridad: i.prioridad || 'media',
    cuando: i.cuando, fecha_limite: i.fecha_limite, hora: i.hora, duracion_min: i.duracion_min, cliente_key: i.cliente_key || 'interno', categoria: i.categoria,
    responsables, propietario: prop, bandeja: !!i.bandeja, creado_por, origen: { captura: texto },
    notificar_a: responsables.filter((u) => u !== creado_por), notificar_motivo: responsables.some((u) => u !== creado_por) ? 'asignado' : null,
    ...extra,
  });
  const { data, offline } = await escribir({ tabla: 'agenda_items', op: 'insert', filas: row, origen: 'Agenda', titulo: row.titulo });
  queryClient.setQueryData(KEY_AGENDA, (prev) => (prev ? { ...prev, items: [...prev.items, data] } : prev));
  if (!offline) await recargarAgenda();
  return { item: data, interpretado: i };
}

/** Triage de la Bandeja: 1 tarea · 2 idea · 3 reunión(= tarea con hora) · H posponer · X descartar. */
export const triage = (it, cambios) => actualizarItem(it.id, { bandeja: false, ...cambios });
export const posponer = (it, dias = 7) => actualizarItem(it.id, { snooze_hasta: isoDia(sumarDias(new Date(), dias)) });
export const moverA = (it, iso) => actualizarItem(it.id, { cuando: iso, bandeja: false, snooze_hasta: null });
export const descartar = (it) => actualizarItem(it.id, { estado: 'cancelada', bandeja: false });
export const estimar = (it, min) => actualizarItem(it.id, { duracion_min: min });

/** Cronómetro: un solo ítem corriendo por persona (inicio_real). Al parar suma a min_real. */
export async function cronometro(it, accion) {
  if (accion === 'iniciar') return actualizarItem(it.id, { inicio_real: new Date().toISOString() });
  const ini = it.inicio_real ? new Date(it.inicio_real).getTime() : null;
  const extra = ini ? Math.max(1, Math.round((Date.now() - ini) / 60000)) : 0;
  return actualizarItem(it.id, { inicio_real: null, min_real: (Number(it.min_real) || 0) + extra });
}

export async function crearArea(nombre, { color = null, cliente_key = null, propietario = null } = {}) {
  const prop = propietario || (await uid());
  const { data, error } = await supabase.from('agenda_areas').insert({ nombre, color, cliente_key, propietario: prop }).select().single();
  if (error) throw error; await invalidarExtra(); return data;
}
export async function crearProyecto(nombre, { area_id = null, propietario = null } = {}) {
  const prop = propietario || (await uid());
  const { data, error } = await supabase.from('agenda_proyectos').insert({ nombre, area_id, propietario: prop }).select().single();
  if (error) throw error; await invalidarExtra(); return data;
}
export async function guardarRegistroDia(usuario, fecha, campos) {
  const { error } = await supabase.from('agenda_registro_dia').upsert({ usuario, fecha, ...campos, updated_at: new Date().toISOString() }, { onConflict: 'usuario,fecha' });
  if (error) throw error; await invalidarExtra();
}
export async function guardarCheckin(usuario, fecha, tipo, respuesta) {
  const { error } = await supabase.from('agenda_checkins').upsert({ usuario, fecha, tipo, respuesta, updated_at: new Date().toISOString() }, { onConflict: 'usuario,fecha,tipo' });
  if (error) throw error; await invalidarExtra();
}
export { usePersonas };
