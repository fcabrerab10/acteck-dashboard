// Foto mensual del forecast (silenciosa, sin UI) → tabla forecast_snapshots (migración 20260911_sop_forecast_snapshots.sql).
// La pantalla la llama al terminar de calcular: upsert de las filas del mes en curso como máximo una vez al día
// por usuario (localStorage sop_snapshot_YYYY-MM-DD) y sólo si el perfil es interno (o super admin).
// Nunca lanza: cualquier error se registra en consola y se reintenta al día siguiente.
import { supabase } from '../../../lib/supabase';

const CHUNK = 500;

export const esPerfilInterno = (perfil) => !!perfil && (perfil.tipo === 'interno' || !!perfil.es_super_admin);

const claveHoy = () => {
  const d = new Date();
  return `sop_snapshot_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const escribir = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin localStorage (Safari privado) */ } };

/** Filas del snapshot a partir de las filas del motor (calcularForecast). */
export function filasSnapshot(rows, fecha = new Date()) {
  const anio = fecha.getFullYear(), mes = fecha.getMonth() + 1;
  const tomado_at = fecha.toISOString();
  const num = (v) => (v == null || !isFinite(Number(v)) ? null : Number(v));
  return (rows || []).filter((r) => r && r.sku).map((r) => ({
    anio, mes, sku: r.sku,
    demanda_mes: num(r.demandaMesErp),
    stock: num(r.inv),
    transito: num(r.traCant),
    sugerido: num(r.sugerido),
    cobertura_dias: num(r.coberturaDiasErp),
    tomado_at,
  }));
}

/** Guarda la foto del mes (si toca hoy). Devuelve 'guardado' | 'ya' | 'omitido' | 'error'. */
export async function guardarSnapshotMensual(rows, perfil) {
  if (!esPerfilInterno(perfil) || !rows || rows.length === 0) return 'omitido';
  const clave = claveHoy();
  if (leer(clave)) return 'ya';
  const filas = filasSnapshot(rows);
  try {
    for (let i = 0; i < filas.length; i += CHUNK) {
      const { error } = await supabase.from('forecast_snapshots').upsert(filas.slice(i, i + CHUNK), { onConflict: 'anio,mes,sku' });
      if (error) throw error;
    }
    escribir(clave, String(filas.length));
    return 'guardado';
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[S&OP] no se pudo guardar la foto mensual del forecast', e?.message || e);
    return 'error';
  }
}
