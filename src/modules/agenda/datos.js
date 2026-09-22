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
import { parsearEtiquetas, conHandles, asignables } from './etiquetas';
import { bandeja as calcBandeja, avisosSistema, isoDia, sumarDias, progresoPorItem, registrarContacto, comentariosPorItem } from './calculo';
import { filasAItems } from './reparto';

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
  // V4: David Millán no entra a la Agenda (ver CORREOS_SIN_AGENDA en etiquetas.js).
  return conHandles(asignables(data || []));
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

/**
 * Reparto de la minuta ("Anota y reparte al cerrar", 2026-09-21): crea un punto por cada acuerdo
 * detectado en las notas y, si `cerrar`, cierra la reunión con el mismo RPC de siempre
 * (`agenda_cerrar_reunion`). Las filas vienen de `reparto.js#detectarAcuerdos`; las que ya existían
 * como punto de la reunión llegan con `incluir: false`, así que no se duplican.
 *   → { creados, cierre }
 */
export async function repartirAcuerdos({ reunion, filas, orden0 = 0, cerrar = true }, personas = []) {
  if (!reunion?.id) throw new Error('Sin reunión');
  const rows = filasAItems(filas, reunion, { orden0 });
  let creados = 0;
  for (const r of rows) { await crearItem(r, personas); creados += 1; }
  const cierre = cerrar ? await cerrarReunion(reunion.id) : null;
  await recargarAgenda();
  return { creados, cierre };
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

// ═══════════════════ V4 · 2026-09-21 ═══════════════════════════════════════════
// agenda_subtareas y cuentas_seguimiento(+_notas) las ESCRIBE la app → nunca con cachedQuery;
// tras cada escritura: recargarAgenda() (invalidateDataCache + invalidateQueries(['agenda'])).

export const KEY_SUBTAREAS = ['agenda', 'subtareas'];
export const KEY_CUENTAS   = ['agenda', 'cuentas'];
export const KEY_NOTAS     = ['agenda', 'cuentas', 'notas'];

// ─── Subtareas ───
export async function fetchSubtareas() {
  if (!DB_CONFIGURED) return [];
  return leer('agenda_subtareas', '*', (q) => q, 'created_at');
}
export function useSubtareas({ enabled = true } = {}) {
  const q = useQuery({ queryKey: KEY_SUBTAREAS, queryFn: fetchSubtareas, staleTime: STALE_MS, enabled });
  const subtareas = q.data || [];
  const progreso = useMemo(() => progresoPorItem(subtareas), [subtareas]);
  return { subtareas, progreso, cargando: q.isLoading, error: q.error || null };
}

const parcharSubtareas = (fn) => queryClient.setQueryData(KEY_SUBTAREAS, (prev) => (Array.isArray(prev) ? fn(prev) : prev));

export async function crearSubtarea(itemId, titulo, orden = 0) {
  const t = String(titulo || '').trim();
  if (!t) throw new Error('Escribe la subtarea');
  const row = { item_id: itemId, titulo: t, hecha: false, orden, creado_por: await uid() };
  const data = lanzar(await supabase.from('agenda_subtareas').insert(row).select('*').single());
  parcharSubtareas((prev) => [...prev, data]);
  await recargarAgenda();
  return data;
}
export async function actualizarSubtarea(id, cambios) {
  const c = limpio(cambios);
  parcharSubtareas((prev) => prev.map((s) => (s.id === id ? { ...s, ...c } : s)));
  try { lanzar(await supabase.from('agenda_subtareas').update(c).eq('id', id)); }
  finally { await recargarAgenda(); }
}
export const marcarSubtarea = (s, hecha) => actualizarSubtarea(s.id, { hecha: !!hecha });
export async function borrarSubtarea(id) {
  parcharSubtareas((prev) => prev.filter((s) => s.id !== id));
  try { lanzar(await supabase.from('agenda_subtareas').delete().eq('id', id)); }
  finally { await recargarAgenda(); }
}
/** Sube o baja una subtarea dentro de su ítem (reescribe `orden` de la lista completa). */
export async function moverSubtarea(lista, id, delta) {
  const i = lista.findIndex((s) => s.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= lista.length) return;
  const arr = [...lista];
  [arr[i], arr[j]] = [arr[j], arr[i]];
  parcharSubtareas((prev) => prev.map((s) => { const k = arr.findIndex((x) => x.id === s.id); return k >= 0 ? { ...s, orden: k } : s; }));
  try { await Promise.all(arr.map((s, k) => supabase.from('agenda_subtareas').update({ orden: k }).eq('id', s.id))); }
  finally { await recargarAgenda(); }
}

// ─── Cuentas que sigo ───
export async function fetchCuentas() {
  if (!DB_CONFIGURED) return { cuentas: [], notas: [] };
  const [cuentas, notas] = await Promise.all([
    leer('cuentas_seguimiento', '*', (q) => q, 'created_at'),
    leer('cuentas_seguimiento_notas', '*', (q) => q, 'created_at'),
  ]);
  return { cuentas, notas };
}
export function useCuentas({ enabled = true } = {}) {
  const q = useQuery({ queryKey: KEY_CUENTAS, queryFn: fetchCuentas, staleTime: STALE_MS, enabled });
  const cuentas = q.data?.cuentas || [];
  const notas = q.data?.notas || [];
  const notasPorCuenta = useMemo(() => {
    const m = new Map();
    for (const n of [...notas].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || String(b.created_at || '').localeCompare(String(a.created_at || '')))) {
      if (!m.has(n.cuenta_id)) m.set(n.cuenta_id, []);
      m.get(n.cuenta_id).push(n);
    }
    return m;
  }, [notas]);
  return { cuentas, notas, notasPorCuenta, cargando: q.isLoading, error: q.error || null };
}

const parcharCuentas = (fn) => queryClient.setQueryData(KEY_CUENTAS, (prev) => (prev ? { ...prev, cuentas: fn(prev.cuentas) } : prev));

export async function crearCuenta(c) {
  const row = limpio({
    nombre: String(c.nombre || '').trim(), contacto: c.contacto || null, telefono: c.telefono || null, email: c.email || null,
    empresa: c.empresa || null, tipo: c.tipo === 'mayorista' ? 'mayorista' : 'directa', mayorista: c.mayorista || null,
    vendedor: c.vendedor || null, cliente_erp: c.cliente_erp || null, notas: c.notas || null,
    proximo_seguimiento: c.proximo_seguimiento || null, recordar_cada_dias: Number(c.recordar_cada_dias) || 14,
    ultimo_contacto: c.ultimo_contacto || null, estado: c.estado || 'activa', creado_por: await uid(),
  });
  if (!row.nombre) throw new Error('La cuenta necesita un nombre');
  const data = lanzar(await supabase.from('cuentas_seguimiento').insert(row).select('*').single());
  parcharCuentas((prev) => [...prev, data]);
  await recargarAgenda();
  return data;
}
export async function actualizarCuenta(id, cambios) {
  const c = limpio(cambios);
  parcharCuentas((prev) => prev.map((x) => (x.id === id ? { ...x, ...c } : x)));
  try { lanzar(await supabase.from('cuentas_seguimiento').update(c).eq('id', id)); }
  catch (e) { await recargarAgenda(); throw e; }
  await recargarAgenda();
}
export async function borrarCuenta(id) {
  parcharCuentas((prev) => prev.filter((x) => x.id !== id));
  try { lanzar(await supabase.from('cuentas_seguimiento').delete().eq('id', id)); }
  finally { await recargarAgenda(); }
}
/** Nota de la bitácora. Si `avanzar`, además corre el seguimiento (último = hoy, próximo = hoy + cadencia). */
export async function agregarNotaCuenta(cuenta, texto, { avanzar = false, hoy = new Date() } = {}) {
  const t = String(texto || '').trim();
  if (!t) throw new Error('Escribe qué pasó');
  const row = { cuenta_id: cuenta.id, fecha: isoDia(hoy), texto: t, creado_por: await uid() };
  const data = lanzar(await supabase.from('cuentas_seguimiento_notas').insert(row).select('*').single());
  queryClient.setQueryData(KEY_CUENTAS, (prev) => (prev ? { ...prev, notas: [...prev.notas, data] } : prev));
  if (avanzar) await actualizarCuenta(cuenta.id, registrarContacto(cuenta, hoy));
  else await recargarAgenda();
  return data;
}
/** "Registrar contacto": mueve las fechas y deja la nota (si la hay) en la bitácora. */
export async function registrarContactoCuenta(cuenta, texto = '', hoy = new Date()) {
  if (String(texto || '').trim()) return agregarNotaCuenta(cuenta, texto, { avanzar: true, hoy });
  return actualizarCuenta(cuenta.id, registrarContacto(cuenta, hoy));
}
/** Crea un pendiente ligado a una cuenta (origen.cuenta_id, igual que la semilla de la migración). */
export function crearPendienteDeCuenta(cuenta, { texto, fecha_limite, responsables } = {}, personas = []) {
  return crearItem({
    texto: texto || `Seguimiento: ${cuenta.nombre}${cuenta.empresa ? ` (${cuenta.empresa})` : ''}`,
    tipo: 'tarea', categoria: 'comercial', cliente_key: null,
    fecha_limite: fecha_limite || cuenta.proximo_seguimiento || null,
    responsables: responsables?.length ? responsables : undefined,
    origen: { fuente: 'cuentas_seguimiento', cuenta_id: cuenta.id },
  }, personas);
}

// ─── Todo lo que necesita la pestaña Agenda V4 ───
/**
 * Datos de la Agenda V4: ítems + reuniones + subtareas + cuentas (+ Google lo pide la pantalla).
 * A diferencia de useBandejaHoy NO trae las alertas de SKUs: esas viven en la campana
 * (decisión de Fernando 2026-09-21). Los avisos del calendario (arribos, cargas) tampoco:
 * el calendario los sigue pintando desde sus propias fuentes si la pantalla las pasa.
 */
export function useAgendaV4({ enabled = true } = {}) {
  const ag = useAgendaDatos({ enabled });
  const sub = useSubtareas({ enabled });
  const cta = useCuentas({ enabled });
  const com = useComentarios({ enabled });   // hilos de seguimiento por punto (2026-09-21)
  const hoy = useMemo(() => new Date(), []);
  return {
    ...ag, ...sub, ...cta, ...com, hoy,
    cargando: ag.cargando || sub.cargando || cta.cargando,
    error: ag.error || sub.error || cta.error || com.error || null,
  };
}

/**
 * Últimas reuniones con minuta de UN cliente (Resumen del cliente → "Últimas minutas y acuerdos").
 * Consulta acotada: no arrastra toda la agenda a la portada del cliente.
 *   → [{ id, titulo, fecha, estado, abiertos, total }]
 */
export function useMinutasCliente(clienteKey, { limite = 5, enabled = true } = {}) {
  const q = useQuery({
    queryKey: ['agenda', 'minutas-cliente', clienteKey, limite],
    enabled: !!clienteKey && !!enabled && DB_CONFIGURED,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const reu = lanzar(await supabase.from('agenda_reuniones')
        .select('id,titulo,fecha,estado,cliente_key,tipo')
        .eq('cliente_key', clienteKey).eq('tipo', 'reunion')
        .order('fecha', { ascending: false }).limit(limite)) || [];
      if (!reu.length) return [];
      const puntos = lanzar(await supabase.from('agenda_items')
        .select('id,reunion_id,estado').eq('tipo', 'punto').in('reunion_id', reu.map((r) => r.id))) || [];
      return reu.map((r) => {
        const mios = puntos.filter((p) => p.reunion_id === r.id);
        return { ...r, total: mios.length, abiertos: mios.filter((p) => p.estado === 'abierta').length };
      });
    },
  });
  return { minutas: q.data || [], cargando: q.isLoading, error: q.error || null };
}

// ═══════════════════ Seguimiento por punto · 2026-09-21 ════════════════════════
// agenda_item_comentarios la ESCRIBE la app → nunca con cachedQuery; tras cada escritura,
// recargarAgenda() (invalidateDataCache + invalidateQueries(['agenda'])).

export const KEY_COMENTARIOS = ['agenda', 'comentarios'];

export async function fetchComentarios() {
  if (!DB_CONFIGURED) return [];
  return leer('agenda_item_comentarios', '*', (q) => q, 'created_at');
}

/** Comentarios de todos los puntos + Map(item_id → hilo ordenado). */
export function useComentarios({ enabled = true } = {}) {
  const q = useQuery({ queryKey: KEY_COMENTARIOS, queryFn: fetchComentarios, staleTime: STALE_MS, enabled });
  const comentarios = q.data || [];
  const comentariosPor = useMemo(() => comentariosPorItem(comentarios), [comentarios]);
  return { comentarios, comentariosPor, cargando: q.isLoading, error: q.error || null };
}

const parcharComentarios = (fn) => queryClient.setQueryData(KEY_COMENTARIOS, (prev) => (Array.isArray(prev) ? fn(prev) : prev));

/**
 * Comentario bajo un punto. `reunionId` = la reunión EN LA QUE se comenta (por omisión la del punto,
 * que la rellena el trigger agenda_comentario_defaults). Optimista: la fila entra en la cache al
 * instante y el refetch la confirma.
 */
export async function crearComentario({ itemId, texto, tipo = 'seguimiento', reunionId = null }) {
  const t = String(texto || '').trim();
  if (!t) throw new Error('Escribe el comentario');
  if (!itemId) throw new Error('Sin punto');
  const row = limpio({ item_id: itemId, texto: t, tipo, reunion_id: reunionId || undefined, autor: await uid() });
  const data = lanzar(await supabase.from('agenda_item_comentarios').insert(row).select('*').single());
  parcharComentarios((prev) => [...prev, data]);
  await recargarAgenda();
  return data;
}

export async function borrarComentario(id) {
  parcharComentarios((prev) => prev.filter((c) => c.id !== id));
  try { lanzar(await supabase.from('agenda_item_comentarios').delete().eq('id', id)); }
  finally { await recargarAgenda(); }
}

/**
 * «Traer puntos abiertos» del panel «Reunión anterior»: copia a `reunionId` los puntos abiertos de
 * `desdeId` (RPC agenda_traer_puntos, misma semántica que el arrastre: la copia queda 'abierta' y
 * el original 'arrastrada', con origen.item_anterior / origen.reunion_anterior para el hilo). → n
 */
export async function traerPuntosDeReunion(reunionId, desdeId) {
  const n = lanzar(await supabase.rpc('agenda_traer_puntos', { p_reunion: reunionId, p_desde: desdeId }));
  await recargarAgenda();
  return n || 0;
}

/** Pendiente (tarea) creado desde un punto de la minuta: queda ligado por origen.punto_id. */
export function crearPendienteDePunto(punto, { texto, fecha_limite, responsables } = {}, personas = []) {
  return crearItem({
    texto: texto || punto.titulo,
    tipo: 'tarea', categoria: punto.categoria || null, cliente_key: punto.cliente_key || null,
    fecha_limite: fecha_limite ?? punto.fecha_limite ?? null,
    responsables: responsables?.length ? responsables : (punto.responsables || []),
    origen: { fuente: 'punto', punto_id: punto.id, reunion_id: punto.reunion_id || null },
  }, personas);
}

/**
 * Sube o baja un punto dentro de su reunión (reescribe `orden` de la lista completa), igual que
 * moverSubtarea. Así se puede preparar el orden del día de una reunión próxima.
 */
export async function moverPunto(lista, id, delta) {
  const i = lista.findIndex((p) => p.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= lista.length) return;
  const arr = [...lista];
  [arr[i], arr[j]] = [arr[j], arr[i]];
  arr.forEach((p, k) => parcharItemLocal(p.id, { orden: k }));
  try { await Promise.all(arr.map((p, k) => supabase.from('agenda_items').update({ orden: k }).eq('id', p.id))); }
  finally { await recargarAgenda(); }
}
