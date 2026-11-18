// Tipo de cambio oficial (FIX Banxico/DOF) desde la tabla `tipo_cambio` (la llena el cron con BANXICO_TOKEN).
// useTipoCambio() → { valor, fecha, cargando }: el último FIX publicado. tcEnFecha(rows, fecha) para históricos.
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { cachedQuery } from './queries';

export const FUENTE_TC = 'FIX Banxico · DOF';

export async function fetchTipoCambio(dias = 400) {
  const desde = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
  const { data, error } = await cachedQuery(supabase.from('tipo_cambio').select('fecha,valor').gte('fecha', desde).order('fecha', { ascending: true }));
  if (error) throw error;
  return (data || []).map((r) => ({ fecha: r.fecha, valor: Number(r.valor) }));
}

/** TC vigente en una fecha: último FIX publicado en o antes de esa fecha (rows ordenadas asc). */
export function tcEnFecha(rows, fecha) {
  const f = String(fecha).slice(0, 10);
  let v = null;
  for (const r of rows || []) { if (r.fecha <= f) v = r.valor; else break; }
  return v;
}

export function useTipoCambio() {
  const q = useQuery({ queryKey: ['tipo_cambio'], queryFn: () => fetchTipoCambio(), staleTime: 60 * 60 * 1000 });
  const rows = q.data || [];
  const ultimo = rows.length ? rows[rows.length - 1] : null;
  return { valor: ultimo?.valor ?? null, fecha: ultimo?.fecha ?? null, rows, cargando: q.isLoading, error: q.error, tcEnFecha: (f) => tcEnFecha(rows, f) };
}
