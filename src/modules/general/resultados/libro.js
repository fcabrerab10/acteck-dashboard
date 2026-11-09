// Estado de Resultados · acceso a datos del libro financiero (2026-11-09).
// `libro_financiero` la escribe el importador (no la app): fetchAllQ con la caché de siempre.
// Baja el año elegido y el anterior (consolidado, gastos, cartera, balance, ROI, personal) y, aparte,
// las dos hojas de cinco años (ventas/utilidad e inventario), que son chicas.
import { supabase } from '../../../lib/supabase';
import { fetchAllQ } from '../../../lib/queries';

const COLS = 'anio,mes,hoja,clave,columna,valor,concepto,orden,nivel,padre,libro_anio,libro_mes';
const HOJAS_LARGAS = ['ventas_utilidad', 'inventario'];

export async function cargarLibro(anio) {
  const [deAnio, largas] = await Promise.all([
    fetchAllQ(() => supabase.from('libro_financiero').select(COLS).in('anio', [anio - 1, anio]).not('hoja', 'in', `(${HOJAS_LARGAS.join(',')})`), { orderCol: 'clave', label: 'libro_financiero' }),
    fetchAllQ(() => supabase.from('libro_financiero').select(COLS).in('hoja', HOJAS_LARGAS), { orderCol: 'clave', label: 'libro_financiero_5a' }),
  ]);
  return [...(deAnio || []), ...(largas || [])];
}

/** Años con libro (desc). Lee sólo la hoja ROI, una fila por libro. */
export async function cargarAniosLibro() {
  const rows = await fetchAllQ(() => supabase.from('libro_financiero').select('anio,mes').eq('hoja', 'roi').eq('clave', 'roi'), { orderCol: 'anio', label: 'libro_financiero_anios' });
  return Array.from(new Set((rows || []).map((r) => Number(r.anio)).filter(Boolean))).sort((a, b) => b - a);
}
