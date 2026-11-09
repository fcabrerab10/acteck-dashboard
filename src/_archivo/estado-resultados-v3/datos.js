// Estado de Resultados V3 · acceso a datos. Sólo lecturas por src/lib/queries.js (cache 5 min).
// estados_resultados la escribe el importador (no la app): fetchAll/cachedQuery sin invalidación.
import { supabase } from '../../../lib/supabase';
import { fetchAll, cachedQuery } from '../../../lib/queries';

const SELECT = 'id,anio,mes,cuenta,cuenta_norm,valor,orden,es_subtotal,nota';
const ERP_COLS = 'mes,fact_bruta,devoluciones,rmas,bonificaciones,fact_neta,venta_neta,contribucion,utilidad_comercial';

/** Años con P&L cargado, descendente. */
export async function cargarAnios() {
  const { data, error } = await cachedQuery(supabase.from('estados_resultados').select('anio').order('anio', { ascending: false }).limit(20000));
  if (error) throw error;
  return Array.from(new Set((data || []).map((r) => Number(r.anio)).filter(Boolean))).sort((a, b) => b - a);
}

/** Filas del año y del anterior (en paralelo). */
export async function cargarEstado(anio) {
  const [rows, rowsPrev] = await Promise.all([
    fetchAll('estados_resultados', SELECT, (q) => q.eq('anio', anio)),
    fetchAll('estados_resultados', SELECT, (q) => q.eq('anio', anio - 1)),
  ]);
  return { rows: rows || [], rowsPrev: rowsPrev || [] };
}

/** Medidas del ERP por mes (v_erp_medidas_mes lee la MV: ms). Vacío si falla (el puente se oculta). */
export async function cargarErp(anio) {
  try {
    const { data, error } = await cachedQuery(supabase.from('v_erp_medidas_mes').select(ERP_COLS).eq('anio', anio).order('mes'));
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.warn('[EstadoResultados] v_erp_medidas_mes', e?.message || e);
    return [];
  }
}
