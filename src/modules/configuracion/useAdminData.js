// Datos de Administración (sólo super admin). React Query directo sobre Supabase; `perfiles` es una
// tabla que la app escribe, así que NO pasa por cachedQuery/fetchAll (regla de Rendimiento en CLAUDE.md).
//
//   useUsuariosAdmin()        → { usuarios, cargando, error, refetch, actualizar(id, patch, { optimista }) }
//   useActividadUsuarios(us)  → { porUserId: { [user_id]: ts ISO }, cargando }   (eventos_usuario, último evento)
//   useUltimoCambioPermisos() → { data: { creado_at, usuario_email, registro_id } | null }
//   useEstadoSistema()        → { data: { supabaseMs, alertasHoy, ultimoSync, auditoria: { filas, masAntigua } } }
import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

const KEY_USUARIOS = ['admin', 'usuarios'];
const DIAS_ACTIVO = 30;
export const MS_DIA = 86400000;

export function useUsuariosAdmin() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: KEY_USUARIOS,
    queryFn: async () => {
      const { data, error } = await supabase.from('perfiles').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    staleTime: 60000,
  });

  /** Update directo (RLS: perfiles_write para super admin). Optimista con rollback; devuelve el error si falla. */
  const actualizar = useCallback(async (id, patch) => {
    const previo = qc.getQueryData(KEY_USUARIOS);
    qc.setQueryData(KEY_USUARIOS, (lista) => (lista || []).map((u) => (u.id === id ? { ...u, ...patch } : u)));
    const { error } = await supabase.from('perfiles').update(patch).eq('id', id);
    if (error) { qc.setQueryData(KEY_USUARIOS, previo); throw error; }
    return true;
  }, [qc]);

  return { usuarios: q.data || [], cargando: q.isLoading, error: q.error, refetch: q.refetch, actualizar };
}

/** Última actividad por usuario (eventos_usuario: RLS deja leer todo al super admin). Una consulta limit 1 por usuario. */
export function useActividadUsuarios(usuarios) {
  const ids = useMemo(() => (usuarios || []).map((u) => u.user_id).filter(Boolean).sort(), [usuarios]);
  const q = useQuery({
    queryKey: ['admin', 'actividad', ids],
    enabled: ids.length > 0,
    staleTime: 5 * 60000,
    queryFn: async () => {
      const filas = await Promise.all(ids.map(async (uid) => {
        const { data } = await supabase.from('eventos_usuario').select('ts').eq('user_id', uid).order('ts', { ascending: false }).limit(1);
        return [uid, data?.[0]?.ts || null];
      }));
      return Object.fromEntries(filas);
    },
  });
  return { porUserId: q.data || {}, cargando: q.isLoading };
}

export const activoReciente = (ts, ahora = Date.now()) => !!ts && ahora - Date.parse(ts) <= DIAS_ACTIVO * MS_DIA;

/** Último cambio de `permisos` registrado por el trigger de auditoría sobre perfiles. */
export function useUltimoCambioPermisos() {
  return useQuery({
    queryKey: ['admin', 'ultimo-cambio-permisos'],
    staleTime: 60000,
    queryFn: async () => {
      const { data, error } = await supabase.from('auditoria_cambios')
        .select('creado_at, usuario_email, registro_id, cambios')
        .eq('tabla', 'perfiles')
        .not('cambios->permisos', 'is', null)
        .order('creado_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] || null;
    },
  });
}

/** Estado de servicios: ping a Supabase (ms), alertas generadas hoy (cron), último sync_event, tamaño de la auditoría. */
export function useEstadoSistema(enabled = true) {
  return useQuery({
    queryKey: ['admin', 'sistema'],
    enabled,
    staleTime: 60000,
    refetchInterval: enabled ? 60000 : false,
    queryFn: async () => {
      const t0 = performance.now();
      const ping = await supabase.from('perfiles').select('id', { head: true, count: 'exact' }).limit(1);
      const supabaseMs = ping.error ? null : Math.round(performance.now() - t0);
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
      const [al, ev, aud, audMin] = await Promise.all([
        supabase.from('alertas').select('id', { head: true, count: 'exact' }).gte('generada_at', hoy.toISOString()),
        supabase.from('sync_events').select('status_key, status, user_nombre, created_at').order('created_at', { ascending: false }).limit(1),
        supabase.from('auditoria_cambios').select('id', { head: true, count: 'exact' }),
        supabase.from('auditoria_cambios').select('creado_at').order('creado_at', { ascending: true }).limit(1),
      ]);
      return {
        supabaseOk: !ping.error, supabaseMs,
        alertasHoy: al.error ? null : (al.count ?? 0),
        ultimoSync: ev.data?.[0] || null,
        auditoria: { filas: aud.error ? null : (aud.count ?? 0), masAntigua: audMin.data?.[0]?.creado_at || null },
      };
    },
  });
}

/** Navegación desde Administración hacia otra página global (App.jsx escucha `acteck:navegar`). */
export const irAPagina = (pagina, clienteKey = null) =>
  window.dispatchEvent(new CustomEvent('acteck:navegar', { detail: { pagina, clienteKey } }));
