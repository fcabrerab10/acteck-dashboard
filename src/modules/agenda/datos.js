// Agenda · capa de datos (React Query + Supabase). Sin layout: la reutiliza Inicio (bloque "Hoy") y la app móvil.
//
// agenda_items / agenda_reuniones las ESCRIBE la app → se leen sin cachedQuery (fetchPaged directo, staleTime 60 s)
// y tras cada escritura: invalidateDataCache() + invalidación de ['agenda'].
// Las fuentes del sistema (alertas, tránsito, frescura, tracking) van por sus hooks/caches existentes.
//
//   const { items, reuniones, personas, personasPorId, porId, cargando } = useAgendaDatos();
//   const { bandeja, avisos, cargando } = useBandejaHoy({ ligero: true });   // Inicio · sin tracking
//   await crearItem({ titulo:'… #pcel @karolina', tipo:'tarea', fecha_limite }, personas)
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase, DB_CONFIGURED } from '../../lib/supabase';
import { queryClient } from '../../lib/queryClient';
import { fetchAll, fetchPaged, invalidateDataCache } from '../../lib/queries';
import { useAlertas } from '../../lib/alertas';
import { useTrackingDatos } from '../comercial/tracking/datos';
import { calcularTodo } from '../comercial/tracking/calculo';
import { useFuentesConfig } from '../settings/importador/fuentesConfig';
import { useEstadoImportador } from '../settings/importador/useImportadorData';
import { frescuraManual } from '../settings/importador/frescura';
import { GRUPOS } from '../settings/importador/config';
import { parsearEtiquetas, conHandles } from './etiquetas';
import { bandeja as calcBandeja, avisosSistema, isoDia, sumarDias } from './calculo';

export const KEY_AGENDA = ['agenda', 'datos'];
export const KEY_PERSONAS = ['agenda', 'personas'];
const STALE_MS = 60 * 1000;
const DIAS_HISTORIAL_HECHAS = 120;   // tareas hechas que se cargan (para cumplimiento y "hecho hoy")
const DIAS_REUNIONES_ATRAS = 365;

const lanzar = (r) => { if (r?.error) throw new Error(r.error.message || String(r.error)); return r?.data; };

function leer(table, select, extra = (q) => q, orderCol = 'created_at') {
  return fetchPaged((from, to, withCount) => extra(supabase.from(table).select(select, withCount ? { count: 'exact' } : undefined).order(orderCol, { ascending: true }).range(from, to)), { label: table });
}

// ─── Personas (perfiles internos activos) ───
export async function fetchPersonas() {
  if (!DB_CONFIGURED) return [];
  const { data, error } = await supabase.from('perfiles').select('user_id,nombre,email,puesto,tipo,activo,es_super_admin,avatar_url').eq('activo', true).eq('tipo', 'interno').order('nombre');
  if (error) throw error;
  return conHandles(data || []);
}
export function usePersonas() {
  const q = useQuery({ queryKey: KEY_PERSONAS, queryFn: fetchPersonas, staleTime: 5 * 60 * 1000 });
  const personas = q.data || [];
  const personasPorId = useMemo(() => new Map(personas.map((p) => [p.user_id, p])), [personas]);
  return { personas, personasPorId, cargando: q.isLoading };
}

// ─── Ítems y reuniones ───
export async function fetchAgenda() {
  if (!DB_CONFIGURED) return { items: [], reuniones: [] };
  const desdeHechas = isoDia(sumarDias(new Date(), -DIAS_HISTORIAL_HECHAS));
  const desdeReu = sumarDias(new Date(), -DIAS_REUNIONES_ATRAS).toISOString();
  const [abiertos, hechos, reuniones] = await Promise.all([
    leer('agenda_items', '*', (q) => q.in('estado', ['abierta', 'arrastrada'])),
    leer('agenda_items', '*', (q) => q.in('estado', ['hecha', 'cancelada']).gte('updated_at', desdeHechas)),
    leer('agenda_reuniones', '*', (q) => q.gte('fecha', desdeReu), 'fecha'),
  ]);
  return { items: [...abiertos, ...hechos], reuniones };
}

export function useAgendaDatos({ enabled = true } = {}) {
  const q = useQuery({ queryKey: KEY_AGENDA, queryFn: fetchAgenda, staleTime: STALE_MS, refetchOnWindowFocus: true, enabled });
  const { personas, personasPorId, cargando: cargandoP } = usePersonas();
  const items = q.data?.items || [];
  const reuniones = q.data?.reuniones || [];
  const porId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  return { items, reuniones, personas, personasPorId, porId, cargando: q.isLoading || cargandoP, error: q.error || null, refetch: q.refetch, cargadoAt: q.dataUpdatedAt };
}

/** Tras escribir: cache central + esta pantalla. */
export async function recargarAgenda() {
  await invalidateDataCache();
  return queryClient.invalidateQueries({ queryKey: ['agenda'] });
}

/** Actualización optimista en la cache (la pantalla responde al instante; el refetch confirma). */
export function parcharItemLocal(id, cambios) {
  queryClient.setQueryData(KEY_AGENDA, (prev) => prev ? { ...prev, items: prev.items.map((i) => (i.id === id ? { ...i, ...cambios } : i)) } : prev);
}
export function parcharReunionLocal(id, cambios) {
  queryClient.setQueryData(KEY_AGENDA, (prev) => prev ? { ...prev, reuniones: prev.reuniones.map((r) => (r.id === id ? { ...r, ...cambios } : r)) } : prev);
}

async function uid() { const { data } = await supabase.auth.getUser(); return data?.user?.id || null; }
const limpio = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

/**
 * Crea un ítem. `texto` puede traer #cliente @persona /categoría (se parsean con `personas`).
 * campos: { tipo, notas, fecha_limite, hora, prioridad, reunion_id, cliente_key, responsables, categoria, orden, origen }
 */
export async function crearItem({ texto, titulo, ...campos }, personas = []) {
  const p = texto != null ? parsearEtiquetas(texto, personas) : { titulo, cliente_key: null, responsables: [], categoria: null };
  const creado_por = await uid();
  const responsables = campos.responsables?.length ? campos.responsables : p.responsables;
  const row = limpio({
    tipo: campos.tipo || 'tarea', titulo: p.titulo || titulo || '(sin título)', notas: campos.notas ?? null,
    estado: 'abierta', categoria: campos.categoria ?? p.categoria ?? null, prioridad: campos.prioridad || 'media',
    fecha_limite: campos.fecha_limite || null, hora: campos.hora || null,
    cliente_key: campos.cliente_key ?? p.cliente_key ?? (campos.tipo === 'punto' ? null : 'interno'),
    responsables, reunion_id: campos.reunion_id || null, arrastrado_desde: campos.arrastrado_desde || null,
    origen: campos.origen ?? null, orden: campos.orden ?? 0, creado_por,
    // aviso a los responsables distintos de quien crea (el cron lo vuelve alerta agenda_asignado)
    notificar_a: responsables.filter((u) => u !== creado_por), notificar_motivo: responsables.some((u) => u !== creado_por) ? 'asignado' : null,
  });
  const data = lanzar(await supabase.from('agenda_items').insert(row).select('*').single());
  queryClient.setQueryData(KEY_AGENDA, (prev) => prev ? { ...prev, items: [...prev.items, data] } : prev);
  await recargarAgenda();
  return data;
}

/** Actualiza campos de un ítem (optimista). Si cambian responsables, avisa a los nuevos. */
export async function actualizarItem(id, cambios, { prevResponsables = null } = {}) {
  const me = await uid();
  const c = limpio({ ...cambios });
  if (Array.isArray(c.responsables) && prevResponsables) {
    const nuevos = c.responsables.filter((u) => !prevResponsables.includes(u) && u !== me);
    if (nuevos.length) { c.notificar_a = nuevos; c.notificar_motivo = 'asignado'; }
  }
  if (c.estado === 'hecha' && c.completado_en === undefined) c.completado_en = new Date().toISOString();
  if (c.estado === 'abierta' && c.completado_en === undefined) c.completado_en = null;
  parcharItemLocal(id, c);
  try { lanzar(await supabase.from('agenda_items').update(c).eq('id', id)); }
  catch (e) { await recargarAgenda(); throw e; }
  await recargarAgenda();
}

/** Palomita: alterna abierta ↔ hecha. */
export function completarItem(item, hecha = true) {
  return actualizarItem(item.id, hecha ? { estado: 'hecha', completado_en: new Date().toISOString() } : { estado: 'abierta', completado_en: null });
}

/** Reedita un ítem desde texto con etiquetas (hoja de tarea). */
export function guardarItemDesdeTexto(item, texto, personas, extra = {}) {
  const p = parsearEtiquetas(texto, personas);
  return actualizarItem(item.id, { titulo: p.titulo || item.titulo, cliente_key: p.cliente_key ?? item.cliente_key, responsables: p.responsables.length ? p.responsables : (extra.responsables ?? item.responsables), categoria: p.categoria ?? extra.categoria ?? item.categoria, ...extra }, { prevResponsables: item.responsables || [] });
}

export async function borrarItem(id) {
  queryClient.setQueryData(KEY_AGENDA, (prev) => prev ? { ...prev, items: prev.items.filter((i) => i.id !== id) } : prev);
  try { lanzar(await supabase.from('agenda_items').delete().eq('id', id)); }
  finally { await recargarAgenda(); }
}

// ─── Reuniones ───
/** r = { titulo, tipo, cliente_key, fecha (ISO), fecha_fin, duracion_min, lugar, asistentes, notas, google_event_id } */
export async function crearReunion(r) {
  const creado_por = await uid();
  const row = limpio({ tipo: r.tipo || 'reunion', titulo: r.titulo || 'Reunión', cliente_key: r.cliente_key || 'interno', fecha: r.fecha, fecha_fin: r.fecha_fin || null, duracion_min: r.duracion_min || 60, lugar: r.lugar || null, asistentes: r.asistentes || [], notas: r.notas || null, google_event_id: r.google_event_id || null, estado: 'programada', creado_por });
  const data = lanzar(await supabase.from('agenda_reuniones').insert(row).select('*').single());
  // Al crear una reunión, los puntos abiertos de reuniones cerradas del mismo cliente se arrastran a ésta.
  let arrastrados = 0;
  if (data.tipo === 'reunion') { try { arrastrados = lanzar(await supabase.rpc('agenda_arrastrar_pendientes', { p_reunion: data.id })) || 0; } catch (e) { console.warn('[agenda] arrastrar:', e.message); } }
  await recargarAgenda();
  return { ...data, arrastrados };
}

export async function actualizarReunion(id, cambios) {
  const c = limpio(cambios);
  parcharReunionLocal(id, c);
  try { lanzar(await supabase.from('agenda_reuniones').update(c).eq('id', id)); }
  catch (e) { await recargarAgenda(); throw e; }
  await recargarAgenda();
}

export async function borrarReunion(id) {
  queryClient.setQueryData(KEY_AGENDA, (prev) => prev ? { ...prev, reuniones: prev.reuniones.filter((r) => r.id !== id), items: prev.items.filter((i) => i.reunion_id !== id || i.tipo !== 'punto') } : prev);
  try { lanzar(await supabase.from('agenda_items').delete().eq('reunion_id', id).eq('tipo', 'punto')); lanzar(await supabase.from('agenda_reuniones').delete().eq('id', id)); }
  finally { await recargarAgenda(); }
}

/** Cierra la reunión (RPC): avisos a responsables + arrastre a la siguiente del mismo cliente. → { cerrada, avisos, arrastrados, siguiente } */
export async function cerrarReunion(id) {
  const r = lanzar(await supabase.rpc('agenda_cerrar_reunion', { p_reunion: id }));
  await recargarAgenda();
  return r || {};
}
/** "Preparar": trae a esta reunión los puntos abiertos de las anteriores cerradas del mismo cliente. → n */
export async function prepararReunion(id) {
  const n = lanzar(await supabase.rpc('agenda_arrastrar_pendientes', { p_reunion: id }));
  await recargarAgenda();
  return n || 0;
}

/**
 * Guardado al momento de un punto de la minuta (lo llama Minuta.jsx con debounce 600 ms por línea).
 * Si `id` es null crea el punto; si no, lo actualiza. Devuelve la fila. NO invalida la cache global en cada
 * tecla: parcha la fila localmente y deja el refetch para cuando se cierra la minuta (recargarAgenda()).
 */
export async function guardarPunto({ id, reunion, texto, orden, estado, fecha_limite, resolucion, responsables, categoria, cliente_key, prev }, personas = []) {
  const p = parsearEtiquetas(texto, personas);
  const campos = limpio({
    titulo: p.titulo || '(sin título)', cliente_key: p.cliente_key ?? cliente_key ?? reunion.cliente_key ?? null,
    responsables: p.responsables.length ? p.responsables : responsables, categoria: p.categoria ?? categoria ?? null,
    orden, estado, fecha_limite, resolucion,
  });
  if (!id) {
    const creado_por = await uid();
    const row = { tipo: 'punto', reunion_id: reunion.id, estado: 'abierta', prioridad: 'media', ...campos, responsables: campos.responsables || [], creado_por, notificar_a: (campos.responsables || []).filter((u) => u !== creado_por), notificar_motivo: (campos.responsables || []).some((u) => u !== creado_por) ? 'asignado' : null };
    const data = lanzar(await supabase.from('agenda_items').insert(row).select('*').single());
    queryClient.setQueryData(KEY_AGENDA, (pv) => pv ? { ...pv, items: [...pv.items, data] } : pv);
    return data;
  }
  const me = await uid();
  if (prev && Array.isArray(campos.responsables)) {
    const nuevos = campos.responsables.filter((u) => !(prev.responsables || []).includes(u) && u !== me);
    if (nuevos.length) { campos.notificar_a = nuevos; campos.notificar_motivo = 'asignado'; }
  }
  if (campos.estado === 'hecha' && !prev?.completado_en) campos.completado_en = new Date().toISOString();
  if (campos.estado === 'abierta') campos.completado_en = null;
  parcharItemLocal(id, campos);
  const data = lanzar(await supabase.from('agenda_items').update(campos).eq('id', id).select('*').single());
  parcharItemLocal(id, data);
  return data;
}

// ─── Fuentes del sistema → avisos ───
/** Tránsito de PO (v_transito_sku, cache 5 min). */
export function useTransito(enabled = true) {
  return useQuery({ queryKey: ['agenda', 'transito'], queryFn: () => fetchAll('v_transito_sku', 'sku,cantidad,eta_mas_cercana,embarques_detalle', (q) => q.gt('cantidad', 0)), staleTime: 5 * 60 * 1000, enabled });
}

/** Fuentes manuales del importador con su estado de frescura (cadencia + última carga). */
export function useFuentesManuales(enabled = true) {
  const { fuentes } = useFuentesConfig({ enabled });
  const { status, upload } = useEstadoImportador({ enabled });
  return useMemo(() => {
    if (!status) return [];
    const ahora = new Date();
    return fuentes.map((f) => ({ id: f.id, titulo: f.titulo, grupo: f.grupo, grupoLabel: GRUPOS.find((g) => g.id === f.grupo)?.label || '', estado: frescuraManual(f, status, ahora, upload?.[f.statusKey]) }));
  }, [fuentes, status, upload]);
}

/**
 * Bandeja de hoy + avisos del sistema. `ligero` (Inicio): sin tracking ni frescura del importador
 * (evita 12 queries + /api/status en la portada); la pestaña Agenda carga todo.
 */
export function useBandejaHoy({ ligero = false, enabled = true } = {}) {
  const ag = useAgendaDatos({ enabled });
  const alertasQ = useAlertas({ clienteKey: null, enabled });
  const transitoQ = useTransito(enabled);
  const fuentesManuales = useFuentesManuales(enabled && !ligero);
  const trackingQ = useTrackingDatos({ enabled: enabled && !ligero });
  const hoy = useMemo(() => new Date(), []);
  const tracking = useMemo(() => (trackingQ.data && !ligero ? calcularTodo(trackingQ.data, hoy) : []), [trackingQ.data, ligero, hoy]);
  const avisos = useMemo(() => avisosSistema({ alertas: alertasQ.data || [], transito: transitoQ.data || [], fuentesManuales, tracking, hoy }), [alertasQ.data, transitoQ.data, fuentesManuales, tracking, hoy]);
  const b = useMemo(() => calcBandeja(ag.items, hoy), [ag.items, hoy]);
  return { ...ag, bandeja: b, avisos, alertas: alertasQ.data || [], transito: transitoQ.data || [], fuentesManuales, tracking, hoy, cargando: ag.cargando, cargandoAvisos: alertasQ.isLoading || (!ligero && trackingQ.isLoading) };
}
