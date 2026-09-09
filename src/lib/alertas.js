// alertas.js — data layer de la bandeja "qué atender hoy".
// La tabla `alertas` la escribe el cron (api/cron.js?task=generar-alertas);
// desde la app sólo se lee y se resuelve/pospone. Por eso va con useQuery
// directo (staleTime 60 s) y NO con cachedQuery/fetchAll (cache de 5 min por URL).
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { queryClient } from './queryClient';

export const SEVERIDADES = ['critica', 'alta', 'media', 'info'];
export const SEV_ORDEN = { critica: 0, alta: 1, media: 2, info: 3 };
export const SEV_LABEL = { critica: 'Crítica', alta: 'Alta', media: 'Media', info: 'Info' };

const CLIENTES_CON_TAB = new Set(['digitalife', 'pcel', 'dicotech']);

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
    case 'datos_sin_actualizar':   return { clienteKey: null, pagina: null, url: '/uploads.html' };
    default:                       return a?.cliente_key ? { clienteKey: a.cliente_key, pagina: 'home' } : null;
  }
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
    .select('id,tipo,severidad,titulo,detalle,cliente_key,sku,valor,meta,clave,generada_at,actualizada_at,snooze_hasta')
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
