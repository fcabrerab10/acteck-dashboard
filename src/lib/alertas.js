// alertas.js — data layer de la bandeja "qué atender hoy".
// La tabla `alertas` la escribe el cron (api/cron.js?task=generar-alertas);
// desde la app sólo se lee y se resuelve/pospone. Por eso va con useQuery
// directo (staleTime 60 s) y NO con cachedQuery/fetchAll (cache de 5 min por URL).
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { queryClient } from './queryClient';
import { usePreferencias, setPreferencia } from './preferencias';

export const SEVERIDADES = ['critica', 'alta', 'media', 'info'];
export const SEV_ORDEN = { critica: 0, alta: 1, media: 2, info: 3 };
export const SEV_LABEL = { critica: 'Crítica', alta: 'Alta', media: 'Media', info: 'Info' };

const CLIENTES_CON_TAB = new Set(['digitalife', 'pcel', 'dicotech']);

// ─── Centro de notificaciones (2026-09-11) ───
export const AREAS = ['inventario', 'ventas', 'pagos', 'cobranza', 'datos', 'operacion', 'forecast', 'tracking'];
export const AREA_LABEL = { inventario: 'Inventario', ventas: 'Ventas', pagos: 'Pagos', cobranza: 'Cobranza', datos: 'Datos', operacion: 'Operación', forecast: 'Forecast', tracking: 'Tracking' };
const AREA_POR_TIPO = { stock_vs_transito: 'inventario', cuota_en_riesgo: 'ventas', devoluciones_anormales: 'ventas', rebate_por_generar: 'pagos', datos_sin_actualizar: 'datos', oc_sin_actualizar: 'operacion', reserva_3dias: 'forecast', reserva_dia: 'forecast', oc_detenida: 'tracking', oc_backorder_sin_po: 'tracking', factura_sin_oc: 'tracking' };
export const MODOS_AREA = ['inmediato', 'resumen', 'silencio'];
export const HORAS_RESUMEN = ['09:00', '13:00', '18:00'];  // horas con cron en vercel.json (15:00 / 19:00 / 00:00 UTC)
export const NOMBRE_CLIENTE = { digitalife: 'Digitalife', pcel: 'PCEL', dicotech: 'Dicotech', mayoreo: 'Mayoreo', distribuidor: 'Distribuidor', e_commerce: 'E-commerce', mostrador: 'Mostrador', retail_propios: 'Retail propios', retail_representados: 'Retail rep.', otros: 'Otros' };

/** Área de la alerta: columna `area` o, para filas viejas, derivada del tipo. */
export function areaAlerta(a) {
  return a?.area || AREA_POR_TIPO[a?.tipo] || 'operacion';
}

// Destino sugerido por tipo → { clienteKey, pagina } para onNavegar. `url` cuando
// el destino vive fuera de la SPA (uploads.html).
export function destinoAlerta(a) {
  switch (a?.tipo) {
    case 'stock_vs_transito':      return { clienteKey: null, pagina: 'inventarioGlobal', sku: a.sku };
    case 'cuota_en_riesgo':        return { clienteKey: a.cliente_key, pagina: 'sellIn' };
    case 'devoluciones_anormales': return CLIENTES_CON_TAB.has(a.cliente_key)
                                     ? { clienteKey: a.cliente_key, pagina: 'sellIn' }
                                     : { clienteKey: null, pagina: 'sellIn' };
    case 'rebate_por_generar':     return { clienteKey: a.cliente_key || 'dicotech', pagina: 'pagos' };
    case 'datos_sin_actualizar':   return { clienteKey: null, pagina: 'actualizacion' };
    case 'reserva_3dias':
    case 'reserva_dia':            return { clienteKey: null, pagina: 'forecastReservas', sku: a.sku };
    case 'oc_detenida':
    case 'oc_backorder_sin_po':
    case 'factura_sin_oc':         return { clienteKey: null, pagina: 'ordenesCompra', sku: a.sku };
    default:                       return a?.cliente_key ? { clienteKey: a.cliente_key, pagina: 'home' } : null;
  }
}

/** Acción directa: `accion` del cron si existe; si no, se deriva de destinoAlerta.
 *  Devuelve { tipo:'navegar', clienteKey, pagina, label, sku } | { tipo:'url', url, label } | null. */
export function accionAlerta(a) {
  const acc = a?.accion;
  if (acc && typeof acc === 'object') {
    if (acc.tipo === 'url' && acc.url) return { tipo: 'url', url: acc.url, label: acc.label || 'Abrir' };
    if (acc.tipo === 'navegar' && acc.pagina) return { tipo: 'navegar', clienteKey: acc.clienteKey ?? null, pagina: acc.pagina, label: acc.label || 'Ver', sku: a.sku || null };
  }
  const d = destinoAlerta(a);
  if (!d) return null;
  if (d.url) return { tipo: 'url', url: d.url, label: 'Abrir' };
  if (!d.pagina) return null;
  return { tipo: 'navegar', clienteKey: d.clienteKey ?? null, pagina: d.pagina, label: 'Ver', sku: d.sku || null };
}

/** Ejecuta la acción: url → pestaña nueva; navegar → onNavegar(clienteKey, pagina, extra). */
export function ejecutarAccion(a, onNavegar) {
  const acc = accionAlerta(a);
  if (!acc) return false;
  if (acc.tipo === 'url') { window.open(acc.url, '_blank', 'noopener'); return true; }
  onNavegar?.(acc.clienteKey, acc.pagina, { ...acc, alerta: a });
  return true;
}

export function ordenarAlertas(rows) {
  return (rows || []).slice().sort((a, b) =>
    (SEV_ORDEN[a.severidad] ?? 9) - (SEV_ORDEN[b.severidad] ?? 9)
    || String(b.actualizada_at || '').localeCompare(String(a.actualizada_at || '')));
}

async function fetchAlertas(clienteKey) {
  const ahora = new Date().toISOString();
  let q = supabase
    .from('alertas')
    .select('id,tipo,severidad,titulo,detalle,cliente_key,sku,valor,meta,clave,area,accion,caduca_at,generada_at,actualizada_at,snooze_hasta')
    .is('resuelta_at', null)
    .or(`snooze_hasta.is.null,snooze_hasta.lt.${ahora}`)
    .order('actualizada_at', { ascending: false })
    .limit(500);
  if (clienteKey) q = q.eq('cliente_key', clienteKey);
  const { data, error } = await q;
  if (error) throw error;
  return ordenarAlertas(data);
}

/** Alertas activas (no resueltas, sin snooze vigente). clienteKey null = todas. */
export function useAlertas({ clienteKey = null, enabled = true } = {}) {
  return useQuery({
    queryKey: ['alertas', clienteKey || 'global'],
    queryFn: () => fetchAlertas(clienteKey),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
    enabled,
  });
}

function invalidar() {
  return queryClient.invalidateQueries({ queryKey: ['alertas'] });
}

export async function resolverAlerta(id, email) {
  const { error } = await supabase
    .from('alertas')
    .update({ resuelta_at: new Date().toISOString(), resuelta_por: email || 'usuario' })
    .eq('id', id);
  if (error) throw error;
  await invalidar();
}

export async function posponerAlerta(id, dias = 3) {
  const hasta = new Date(Date.now() + Math.max(1, dias) * 86400000).toISOString();
  const { error } = await supabase
    .from('alertas')
    .update({ snooze_hasta: hasta })
    .eq('id', id);
  if (error) throw error;
  await invalidar();
}

export function contarPorSeveridad(rows) {
  const c = { critica: 0, alta: 0, media: 0, info: 0 };
  for (const r of rows || []) if (c[r.severidad] != null) c[r.severidad] += 1;
  return c;
}

// ═══ Centro de notificaciones ═══

/** Alertas pospuestas (snooze vigente), para la pestaña "Silenciadas". */
export function useAlertasPospuestas({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['alertas', 'pospuestas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alertas')
        .select('id,tipo,severidad,titulo,detalle,cliente_key,sku,valor,meta,clave,area,accion,caduca_at,generada_at,actualizada_at,snooze_hasta')
        .is('resuelta_at', null)
        .gt('snooze_hasta', new Date().toISOString())
        .order('snooze_hasta', { ascending: true })
        .limit(200);
      if (error) throw error;
      return ordenarAlertas(data);
    },
    staleTime: 60 * 1000,
    enabled,
  });
}

async function uidActual() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

/** Map alerta_id → leida_at del usuario actual (notificaciones_lectura). */
export function useNoLeidas({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['notif_lecturas'],
    queryFn: async () => {
      const uid = await uidActual();
      if (!uid) return new Map();
      const { data, error } = await supabase
        .from('notificaciones_lectura')
        .select('alerta_id,leida_at')
        .eq('usuario_id', uid)
        .limit(2000);
      if (error) throw error;
      return new Map((data || []).map((r) => [r.alerta_id, r.leida_at]));
    },
    staleTime: 60 * 1000,
    enabled,
  });
}

/** Nueva = nunca leída, o se (re)generó después de la última lectura.
 *  Se compara con generada_at (no actualizada_at: el cron la refresca a diario). */
export function esNueva(a, lecturas) {
  if (!lecturas) return true;
  const l = lecturas.get?.(a.id);
  if (!l) return true;
  return String(a.generada_at || '') > String(l);
}

/** Marca leídas (upsert por usuario) y refresca la query de lecturas. */
export async function marcarLeidas(ids) {
  const lista = (ids || []).filter((x) => x != null);
  if (!lista.length) return;
  const uid = await uidActual();
  if (!uid) return;
  const ahora = new Date().toISOString();
  // Optimista: la campana baja de inmediato.
  queryClient.setQueryData(['notif_lecturas'], (prev) => {
    const m = new Map(prev || []);
    lista.forEach((id) => m.set(id, ahora));
    return m;
  });
  const { error } = await supabase
    .from('notificaciones_lectura')
    .upsert(lista.map((alerta_id) => ({ usuario_id: uid, alerta_id, leida_at: ahora })), { onConflict: 'usuario_id,alerta_id' });
  if (error) { queryClient.invalidateQueries({ queryKey: ['notif_lecturas'] }); throw error; }
}

// ─── Preferencias (perfiles.preferencias.notif) ───
export const PREFS_NOTIF_DEFAULT = Object.freeze({
  areas: Object.freeze(Object.fromEntries(AREAS.map((a) => [a, 'resumen']))),
  clientes: null,
  resumen: Object.freeze({ hora: '13:00', correo: true }),
  criticas_correo: true,
});

export function normalizarPrefsNotif(n) {
  n = n && typeof n === 'object' ? n : {};
  const areas = {};
  for (const a of AREAS) areas[a] = MODOS_AREA.includes(n.areas?.[a]) ? n.areas[a] : 'resumen';
  return {
    areas,
    clientes: Array.isArray(n.clientes) && n.clientes.length ? n.clientes.slice() : null,
    resumen: { hora: n.resumen?.hora || '13:00', correo: n.resumen?.correo !== false },
    criticas_correo: n.criticas_correo !== false,
  };
}

/** Preferencias del centro leídas del store compartido de UI (src/lib/preferencias.js:
 *  perfiles.preferencias hidratado al entrar el perfil; localStorage antes del login). */
export function usePreferenciasNotif() {
  const { prefs } = usePreferencias();
  const notif = prefs?.notif;
  const data = useMemo(() => normalizarPrefsNotif(notif), [notif]);
  return { data, isLoading: false };
}

/** Guardado optimista: setPreferencia('notif', …) actualiza memoria + localStorage y
 *  persiste (debounce 400 ms) con la RPC set_preferencias, que hace merge de primer
 *  nivel sobre perfiles.preferencias — así no pisa `menu` ni lo pisan a él. */
export async function guardarPreferenciasNotif(notif) {
  const limpio = normalizarPrefsNotif(notif);
  setPreferencia('notif', limpio);
  return limpio;
}

/** ¿Aplica la alerta al filtro de clientes de las preferencias? (sin cliente → siempre) */
export function aplicaCliente(a, prefs) {
  const c = prefs?.clientes;
  return !c || !a?.cliente_key || c.includes(a.cliente_key);
}

/** Agrupa en pilas por área, ordenadas por severidad máxima y novedad. */
export function agruparPorArea(rows, lecturas) {
  const m = new Map();
  for (const a of rows || []) {
    const k = areaAlerta(a);
    if (!m.has(k)) m.set(k, { area: k, label: AREA_LABEL[k] || k, alertas: [], nuevas: 0, criticaNueva: false, ultima: '' });
    const p = m.get(k);
    p.alertas.push(a);
    const nueva = esNueva(a, lecturas);
    if (nueva) p.nuevas += 1;
    if (nueva && a.severidad === 'critica') p.criticaNueva = true;
    if (String(a.actualizada_at || '') > p.ultima) p.ultima = a.actualizada_at || '';
  }
  const pilas = [...m.values()];
  for (const p of pilas) p.alertas = ordenarAlertas(p.alertas);
  pilas.sort((x, y) =>
    (SEV_ORDEN[x.alertas[0]?.severidad] ?? 9) - (SEV_ORDEN[y.alertas[0]?.severidad] ?? 9)
    || y.nuevas - x.nuevas
    || String(y.ultima).localeCompare(String(x.ultima)));
  return pilas;
}
