// Actividad del equipo · capa de datos (React Query directo sobre Supabase).
// Todas las tablas que se leen aquí las escribe la app (eventos_usuario, auditoria_cambios,
// agenda_items, evaluaciones_mensuales, perfiles), así que NO pasan por cachedQuery/fetchAll
// (regla de Rendimiento en CLAUDE.md); se usa fetchPaged (paginación paralela sin cache) + useQuery.
//
//   useDatosEquipo()                → { usuarios, eventos, auditoria, agenda, evaluaciones, mesActual, cargando, error, refetch }
//   useDetalleMes(userId, anio, mes)→ evaluación + facturación + cuota de ese mes (para la hoja)
//   useUmbralInactividad()          → [umbral, setUmbral]  · perfiles.preferencias.equipo.umbralInactividad del super admin
//   upsertEvaluacion(...)           → escribe evaluaciones_mensuales (optimista desde el componente)
import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { fetchPaged } from '../../../lib/queries';
import { usePreferencias, setPreferencia, getPath } from '../../../lib/preferencias';
import { CLIENTES_BONO, UMBRAL_INACTIVIDAD_DEFAULT, UMBRALES_INACTIVIDAD, sumarDias, isoDia, bonoEstimado, cuotaTotal, facturadoTotal } from './calculo.js';

export const DIAS_HISTORIA = 28;
export const KEY_EQUIPO = ['equipo'];
const STALE = 60 * 1000;

const PERFIL_COLS = 'id,user_id,nombre,email,rol,tipo,puesto,activo,estado,es_super_admin,se_evalua,avatar_url,avatar_estado,avatar_fondo,genero';

// ISO del inicio (00:00 local) de hace N días — límite inferior de eventos y auditoría.
function desdeISO(dias) {
  const d = sumarDias(new Date(), -dias); d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

const conCount = (withCount) => (withCount ? { count: 'exact' } : undefined);

async function leerPerfiles() {
  const { data, error } = await supabase.from('perfiles').select(PERFIL_COLS).order('nombre');
  if (error) throw error;
  return data || [];
}

async function leerEventos(desde) {
  return fetchPaged((from, to, withCount) => supabase.from('eventos_usuario')
    .select('user_id,ts,tipo,cliente,pagina', conCount(withCount))
    .gte('ts', desde).order('ts', { ascending: false }).range(from, to), { pageSize: 1000, label: 'eventos_usuario' });
}

async function leerAuditoria(desde) {
  return fetchPaged((from, to, withCount) => supabase.from('auditoria_cambios')
    .select('id,tabla,operacion,registro_id,cliente_key,usuario_id,cambios,creado_at', conCount(withCount))
    .gte('creado_at', desde).not('usuario_id', 'is', null).order('creado_at', { ascending: false }).range(from, to), { pageSize: 1000, label: 'auditoria_cambios' });
}

/** Tolerante: si agenda_items no existe aún (o falla RLS), devuelve { disponible:false }. */
async function leerAgenda(desde) {
  try {
    const { data, error } = await supabase.from('agenda_items')
      .select('id,tipo,titulo,estado,fecha_limite,responsables,completado_en,reunion_id,cliente_key,prioridad')
      .or(`estado.in.(abierta,arrastrada),completado_en.gte.${desde},updated_at.gte.${desde}`)
      .limit(5000);
    if (error) throw error;
    return { disponible: true, items: data || [] };
  } catch (e) {
    console.warn('[equipo] agenda no disponible:', e?.message || e);
    return { disponible: false, items: [], error: e?.message || String(e) };
  }
}

async function leerEvaluaciones() {
  const hoy = new Date();
  const a = hoy.getFullYear() - 1;
  const { data, error } = await supabase.from('evaluaciones_mensuales')
    .select('id,user_id,anio,mes,cerrada,bono_total,cuota_pct,facturacion,cuota_total')
    .gte('anio', a).order('anio', { ascending: false }).order('mes', { ascending: false }).limit(500);
  if (error) throw error;
  return data || [];
}

async function leerMes(anio, mes) {
  const [fact, cuotas] = await Promise.all([
    supabase.from('facturacion_clientes').select('monto,cliente_key').in('cliente_key', CLIENTES_BONO).eq('anio', anio).eq('mes', mes),
    supabase.from('cuotas_mensuales').select('cliente,cuota_min').in('cliente', ['pcel', 'dicotech']).eq('anio', anio).eq('mes', mes),
  ]);
  const facturacion = facturadoTotal(fact.data);
  const cuota = cuotaTotal(cuotas.data);
  return { anio, mes, facturacion, cuota, cuotaPct: cuota > 0 ? facturacion / cuota * 100 : 0, bonoBase: bonoEstimado(facturacion) };
}

export function useDatosEquipo(enabled = true) {
  const q = useQuery({
    queryKey: KEY_EQUIPO,
    enabled,
    staleTime: STALE,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const desde = desdeISO(DIAS_HISTORIA);
      const hoy = new Date();
      const safe = (p, fallback, label) => p.catch((e) => { console.warn(`[equipo][${label}]`, e?.message || e); return fallback; });
      const [usuarios, eventos, auditoria, agenda, evaluaciones, mesActual] = await Promise.all([
        leerPerfiles(),
        safe(leerEventos(desde), [], 'eventos_usuario'),
        safe(leerAuditoria(desde), [], 'auditoria_cambios'),
        leerAgenda(desde),
        safe(leerEvaluaciones(), [], 'evaluaciones_mensuales'),
        safe(leerMes(hoy.getFullYear(), hoy.getMonth() + 1), { facturacion: 0, cuota: 0, cuotaPct: 0, bonoBase: bonoEstimado(0) }, 'mes'),
      ]);
      return { usuarios, eventos, auditoria, agenda, evaluaciones, mesActual, desde, cargadoAt: Date.now() };
    },
  });
  return { ...(q.data || { usuarios: [], eventos: [], auditoria: [], agenda: { disponible: false, items: [] }, evaluaciones: [], mesActual: null }), cargando: q.isLoading, error: q.error, refetch: q.refetch };
}

/** Evaluación, facturación y cuota de un mes concreto (hoja lateral). */
export function useDetalleMes(userId, anio, mes, enabled = true) {
  return useQuery({
    queryKey: ['equipo', 'mes', userId, anio, mes],
    enabled: enabled && !!userId && !!anio && !!mes,
    staleTime: STALE,
    queryFn: async () => {
      const [m, ev] = await Promise.all([
        leerMes(anio, mes),
        supabase.from('evaluaciones_mensuales').select('*').eq('user_id', userId).eq('anio', anio).eq('mes', mes).maybeSingle(),
      ]);
      return { ...m, evaluacion: ev.data || null };
    },
  });
}

/** Escritura de evaluaciones_mensuales (insert si no hay id). Devuelve el id. */
export async function upsertEvaluacion({ id, userId, anio, mes, base, patch }) {
  if (id) {
    const { error } = await supabase.from('evaluaciones_mensuales').update(patch).eq('id', id);
    if (error) throw error;
    return id;
  }
  const { data, error } = await supabase.from('evaluaciones_mensuales')
    .insert({ user_id: userId, anio, mes, ...base, ...patch }).select('id').single();
  if (error) throw error;
  return data?.id || null;
}

/** Invalida datos del equipo y del mes tras escribir. */
export function useInvalidarEquipo() {
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries({ queryKey: KEY_EQUIPO }), [qc]);
}

// ─── Umbral de inactividad ───
// Se guarda en perfiles.preferencias.equipo.umbralInactividad del usuario que lo cambia (el super
// admin, único que ve la pantalla) vía el store de preferencias (RPC set_preferencias con merge).
// El cron (api/cron.js · regla equipo_inactivo) lee el mismo valor del perfil con es_super_admin.
export const PREF_UMBRAL = 'equipo.umbralInactividad';
export function useUmbralInactividad() {
  const { prefs } = usePreferencias();
  const raw = Number(getPath(prefs, PREF_UMBRAL, UMBRAL_INACTIVIDAD_DEFAULT));
  const umbral = UMBRALES_INACTIVIDAD.includes(raw) ? raw : UMBRAL_INACTIVIDAD_DEFAULT;
  const setUmbral = useCallback((n) => setPreferencia(PREF_UMBRAL, UMBRALES_INACTIVIDAD.includes(Number(n)) ? Number(n) : UMBRAL_INACTIVIDAD_DEFAULT), []);
  return [umbral, setUmbral];
}

/** Índices por usuario (memo helper). */
export function useIndicesPorUsuario(eventos, auditoria) {
  return useMemo(() => {
    const ev = new Map(), au = new Map();
    for (const e of eventos || []) { if (!ev.has(e.user_id)) ev.set(e.user_id, []); ev.get(e.user_id).push(e); }
    for (const a of auditoria || []) { if (!au.has(a.usuario_id)) au.set(a.usuario_id, []); au.get(a.usuario_id).push(a); }
    return { eventosPor: ev, auditoriaPor: au };
  }, [eventos, auditoria]);
}

export { isoDia };
