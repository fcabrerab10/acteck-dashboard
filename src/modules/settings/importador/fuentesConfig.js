// Cadencias editables de las fuentes manuales (tabla `fuentes_config`, migración
// 20260911_fuentes_config.sql). La app la ESCRIBE (super admin) → React Query directo con
// invalidación, nunca cachedQuery.
//
//   const { fuentes, configs, cargando } = useFuentesConfig();   // FUENTES con la cadencia efectiva
//   await guardarCadencia('digitalife-sellout', { tipo: 'semanal', dia: 1, tolerancia: 3 }, 'Fernando');
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase, DB_CONFIGURED } from '../../../lib/supabase';
import { queryClient } from '../../../lib/queryClient';
import { FUENTES, normalizarCadencia } from './config';

const KEY = ['fuentes_config'];
const STALE_MS = 5 * 60 * 1000;
const VACIO = Object.freeze({});

export async function fetchFuentesConfig() {
  if (!DB_CONFIGURED) return {};
  const { data, error } = await supabase.from('fuentes_config').select('fuente_id, cadencia, updated_at, updated_by');
  if (error) throw error;
  return Object.fromEntries((data || []).map((r) => [r.fuente_id, { ...r, cadencia: normalizarCadencia(r.cadencia) }]));
}

/** FUENTES con la cadencia de fuentes_config aplicada (o la del código si no hay fila). Pura. */
export function aplicarConfig(configs) {
  return FUENTES.map((f) => {
    const c = configs?.[f.id];
    return c ? { ...f, cadencia: c.cadencia, cadenciaEditadaAt: c.updated_at, cadenciaEditadaPor: c.updated_by } : { ...f, cadencia: normalizarCadencia(f.cadencia) };
  });
}

export function useFuentesConfig({ enabled = true } = {}) {
  const q = useQuery({ queryKey: KEY, queryFn: fetchFuentesConfig, staleTime: STALE_MS, enabled });
  const configs = q.data || VACIO;
  const fuentes = useMemo(() => aplicarConfig(configs), [configs]);
  return { fuentes, configs, cargando: q.isLoading, error: q.error || null, refetch: q.refetch };
}

export async function guardarCadencia(fuenteId, cadencia, quien = null) {
  const c = normalizarCadencia(cadencia);
  const { error } = await supabase.from('fuentes_config').upsert({ fuente_id: fuenteId, cadencia: c, updated_at: new Date().toISOString(), updated_by: quien }, { onConflict: 'fuente_id' });
  if (error) throw error;
  await queryClient.invalidateQueries({ queryKey: KEY });
  return c;
}
