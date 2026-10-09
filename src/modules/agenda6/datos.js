// Agenda «que te lleva» (V6 · 2026-10-08) · acciones RÁPIDAS y bitácora de movidas.
// Regla de velocidad: cada acción pinta al instante (parche local), se guarda atrás por el buzón, y la recarga completa de
// la agenda se agrupa en UNA sola 2 s después (antes cada clic invalidaba toda la caché y volvía a bajar la agenda).
// Cada acción deja una fila en agenda_movidas con el estado anterior → «Movidas hoy» y Deshacer (toast de 6 s).
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { queryClient } from '../../lib/queryClient';
import { escribir } from '../../lib/buzon';
import { toast } from '../../components/kit';
import { parcharItemLocal, recargarAgenda, KEY_AGENDA } from '../agenda5/base/datos';
import { decidir } from '../agenda5/dia/datos';
import { antesDe, cambiosDe, LABEL_MOVIDA, isoDe, sumarDiasIso, interpretarLibre } from './calculo';

const KEY_MOVIDAS = (uid, fecha) => ['agenda', 'movidas', uid, fecha];
let recargaTimer = null;
/** Recarga agrupada: muchas acciones seguidas = una sola recarga de la agenda (no de toda la caché). */
export function recargaAgrupada(ms = 2000) {
  if (recargaTimer) clearTimeout(recargaTimer);
  recargaTimer = setTimeout(() => { recargaTimer = null; queryClient.invalidateQueries({ queryKey: KEY_AGENDA }); }, ms);
}

async function uid() { const { data } = await supabase.auth.getUser(); return data?.user?.id || null; }

/** Escribe el cambio del ítem: parche local inmediato + buzón + recarga agrupada. */
export async function actualizarRapido(id, cambios, { prevResponsables = null } = {}) {
  const c = { ...cambios };
  if (Array.isArray(c.responsables) && prevResponsables) {
    const me = await uid();
    const nuevos = c.responsables.filter((u) => !prevResponsables.includes(u) && u !== me);
    if (nuevos.length) { c.notificar_a = nuevos; c.notificar_motivo = 'asignado'; }
  }
  parcharItemLocal(id, c);
  try { await escribir({ tabla: 'agenda_items', op: 'update', filas: c, match: { id }, origen: 'Agenda' }); }
  catch (e) { await recargarAgenda(); throw e; }
  recargaAgrupada();
}

/** Registra una movida (para «Movidas hoy» y Deshacer). No bloquea: si falla, sólo se pierde el rastro. */
export async function registrarMovida({ item, accion, antes, despues }) {
  const u = await uid(); if (!u) return null;
  const fila = { usuario: u, fecha: isoDe(new Date()), item_id: item?.id || null, accion, titulo: item?.titulo || null, antes: antes || null, despues: despues || null };
  const { data } = await supabase.from('agenda_movidas').insert(fila).select('*').single();
  queryClient.setQueryData(KEY_MOVIDAS(u, fila.fecha), (prev) => (prev ? [data, ...prev] : [data]));
  return data;
}

/** Deshace una movida: restaura `antes` en el ítem y la marca como deshecha. */
export async function deshacerMovida(m) {
  if (!m?.item_id || !m.antes) return;
  await actualizarRapido(m.item_id, m.antes);
  await supabase.from('agenda_movidas').update({ deshecha_at: new Date().toISOString() }).eq('id', m.id);
  queryClient.setQueryData(KEY_MOVIDAS(m.usuario, m.fecha), (prev) => (prev ? prev.map((x) => (x.id === m.id ? { ...x, deshecha_at: new Date().toISOString() } : x)) : prev));
}

export function useMovidas(uidActual, fecha = isoDe(new Date()), enabled = true) {
  return useQuery({
    queryKey: KEY_MOVIDAS(uidActual, fecha), enabled: !!uidActual && enabled, staleTime: 60 * 1000,
    queryFn: async () => { const { data, error } = await supabase.from('agenda_movidas').select('*').eq('usuario', uidActual).eq('fecha', fecha).order('created_at', { ascending: false }).limit(60); if (error) throw error; return data || []; },
  });
}

/**
 * Acción de la Agenda sobre un ítem: hecha · reabrir · hoy · manana · semana · yano · mandar · fecha.
 * Pinta al instante, guarda atrás, registra la movida y avisa con «Deshacer» 6 s.
 */
export async function accionItem(item, accion, { hoyIso = isoDe(new Date()), destino = null, responsables = null, avisar = true } = {}) {
  const antes = antesDe(item);
  const cambios = cambiosDe(accion, { hoyIso, destino, responsables });
  await actualizarRapido(item.id, cambios, { prevResponsables: accion === 'mandar' ? (item.responsables || []) : null });
  let movida = null;
  try { movida = await registrarMovida({ item, accion, antes, despues: cambios }); } catch { /* sin rastro, pero el cambio ya está */ }
  if (avisar) {
    const texto = { hecha: 'Hecha', reabrir: 'Reabierta', hoy: 'Para hoy', manana: 'Pasó a mañana', semana: 'Pasó a esta semana', yano: 'Marcada «ya no»', mandar: 'Mandada', fecha: 'Cambió de fecha' }[accion] || 'Listo';
    toast.ok(`${texto} · ${String(item.titulo || '').slice(0, 42)}`, { ms: 6000, accion: 'Deshacer', onAccion: () => { if (movida) deshacerMovida(movida).catch((e) => toast.error(e.message)); else actualizarRapido(item.id, antes).catch((e) => toast.error(e.message)); } });
  }
  return movida;
}

/** Crea un pendiente desde la captura libre (interpretarLibre): personas y clientes como chips ya confirmados. */
export async function crearLibre(texto, { personas = [], propietario = null, hoy = new Date(), interp = null, extra = {} } = {}) {
  const i = interp || interpretarLibre(texto, personas, hoy);
  const creado_por = await uid();
  const prop = propietario || creado_por;
  const responsables = i.responsables?.length ? i.responsables : [prop];
  const row = {
    tipo: i.tipo === 'reunion' ? 'tarea' : (i.tipo || 'tarea'), titulo: i.titulo || '(sin título)', estado: 'abierta', prioridad: i.prioridad || 'media',
    cuando: i.cuando || null, fecha_limite: i.fecha_limite || null, hora: i.hora || null, duracion_min: i.duracion_min || null,
    cliente_key: i.cliente_key || 'interno', clientes: (i.clientes || []).slice(1), categoria: i.categoria || null,
    responsables, propietario: prop, bandeja: !!i.bandeja && !i.cuando, creado_por, origen: { captura: texto },
    notificar_a: responsables.filter((u) => u !== creado_por), notificar_motivo: responsables.some((u) => u !== creado_por) ? 'asignado' : null,
    ...extra,
  };
  const { data, offline } = await escribir({ tabla: 'agenda_items', op: 'insert', filas: row, origen: 'Agenda', titulo: row.titulo });
  queryClient.setQueryData(KEY_AGENDA, (prev) => (prev && data ? { ...prev, items: [...prev.items, data] } : prev));
  if (!offline) recargaAgrupada();
  return { item: data, interpretado: i };
}

// ─── Organizar y cerrar el día ───
const LS = (u, f) => `agenda_organizado_${u}_${f}`;
export function organizadoHoy(uidActual, fecha = isoDe(new Date())) { try { return !!localStorage.getItem(LS(uidActual, fecha)); } catch { return false; } }
export function recordarOrganizado(uidActual, fecha = isoDe(new Date()), valor = 'si') { try { localStorage.setItem(LS(uidActual, fecha), valor); } catch { /* sin storage */ } }

/** Marca el día como organizado (registro del día + localStorage). */
export async function marcarOrganizado(uidActual, fecha = isoDe(new Date())) {
  recordarOrganizado(uidActual, fecha);
  await supabase.from('agenda_registro_dia').upsert({ usuario: uidActual, fecha, organizado_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'usuario,fecha' });
  queryClient.invalidateQueries({ queryKey: ['agenda5', 'extra'] });
}

/** Cierra un día (hoy o ayer): registro + lo abierto de ese día pasa a mañana, cada uno como movida con deshacer. */
export async function cerrarDiaV6(uidActual, fecha, { energia = null, resumen = '', manana_empiezo = '' } = {}, abiertos = []) {
  const destino = sumarDiasIso(fecha, 1);
  for (const it of abiertos) await accionItem(it, 'fecha', { destino, avisar: false });
  const { error } = await supabase.from('agenda_registro_dia').upsert({ usuario: uidActual, fecha, energia, resumen, manana_empiezo, cerrado_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'usuario,fecha' });
  if (error) throw error;
  queryClient.invalidateQueries({ queryKey: ['agenda5', 'extra'] });
  recargaAgrupada(300);
}

/** Decide una propuesta del negocio (reusa agenda5/dia/datos.js#decidir). */
export const decidirPropuesta = decidir;
