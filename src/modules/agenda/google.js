// Agenda · Google Calendar (cliente). Habla con api/google-calendar.js con el JWT del usuario (apiFetch).
// Los eventos de Google se muestran, no se editan aquí (enlace a Google). Lo creado aquí se crea allá.
//
//   const { conectado, email, estado, cargando } = useGoogleEstado();
//   await conectarGoogle();                 // redirige a Google
//   const { data: eventos } = useGoogleEventos(desde, hasta, conectado);
//   const { id } = await crearEventoGoogle({ titulo, inicio, fin, lugar, descripcion, asistentes })
import { useQuery } from '@tanstack/react-query';
import { supabase, DB_CONFIGURED } from '../../lib/supabase';
import { queryClient } from '../../lib/queryClient';
import { apiFetch } from '../../lib/apiFetch';

export const KEY_GOOGLE = ['agenda', 'google'];

export const MENSAJES_GOOGLE = {
  sin_config: 'Google no está configurado en el servidor (faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).',
  no_conectado: 'Google no está conectado.',
  reconectar: 'La conexión con Google caducó: vuelve a conectar.',
};

async function llamar(action, { method = 'GET', body, qs = {} } = {}) {
  const params = new URLSearchParams({ action, ...qs });
  const r = await apiFetch(`/api/google-calendar?${params}`, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const js = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(js.error || `HTTP ${r.status}`); e.codigo = js.codigo || null; e.status = r.status; throw e; }
  return js;
}

/** Fila propia de agenda_google (sin refresh_token: la columna no es legible desde la app). */
export async function fetchGoogleEstado() {
  if (!DB_CONFIGURED) return { conectado: false };
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user?.id) return { conectado: false };
  const { data, error } = await supabase.from('agenda_google').select('user_id,email,calendar_id,conectado_at,ultima_sync,ultimo_error').eq('user_id', u.user.id).maybeSingle();
  if (error) throw error;
  return { conectado: !!data, email: data?.email || null, conectado_at: data?.conectado_at || null, ultima_sync: data?.ultima_sync || null, ultimo_error: data?.ultimo_error || null };
}
export function useGoogleEstado() {
  const q = useQuery({ queryKey: [...KEY_GOOGLE, 'estado'], queryFn: fetchGoogleEstado, staleTime: 5 * 60 * 1000 });
  return { conectado: !!q.data?.conectado, email: q.data?.email || null, ultimaSync: q.data?.ultima_sync || null, ultimoError: q.data?.ultimo_error || null, cargando: q.isLoading, refetch: q.refetch };
}

/** Pide la URL de consentimiento y redirige. Lanza con .codigo 'sin_config' si el servidor no tiene credenciales. */
export async function conectarGoogle() {
  const { url } = await llamar('auth');
  try { sessionStorage.setItem('agenda_volver', '1'); } catch {}
  window.location.assign(url);
}
export async function desconectarGoogle() {
  await llamar('disconnect', { method: 'POST', body: {} });
  await queryClient.invalidateQueries({ queryKey: KEY_GOOGLE });
}

export function useGoogleEventos(desde, hasta, enabled = true) {
  return useQuery({
    queryKey: [...KEY_GOOGLE, 'eventos', desde, hasta],
    queryFn: async () => (await llamar('events', { qs: { from: new Date(desde).toISOString(), to: new Date(hasta).toISOString() } })).events || [],
    staleTime: 2 * 60 * 1000, enabled: !!enabled && !!desde && !!hasta, retry: false,
  });
}
export const invalidarGoogle = () => queryClient.invalidateQueries({ queryKey: [...KEY_GOOGLE, 'eventos'] });

export async function crearEventoGoogle(ev) { const r = await llamar('create', { method: 'POST', body: ev }); invalidarGoogle(); return r; }
export async function actualizarEventoGoogle(ev) { const r = await llamar('update', { method: 'POST', body: ev }); invalidarGoogle(); return r; }
export async function borrarEventoGoogle(id) { const r = await llamar('delete', { method: 'POST', body: { id } }); invalidarGoogle(); return r; }

/** Al volver de Google (?google=ok|error&motivo=…) devuelve { ok, motivo } una sola vez y limpia la URL. */
export function leerRetornoGoogle() {
  if (typeof window === 'undefined') return null;
  const u = new URL(window.location.href);
  const g = u.searchParams.get('google');
  if (!g) return null;
  const motivo = u.searchParams.get('motivo');
  u.searchParams.delete('google'); u.searchParams.delete('motivo');
  window.history.replaceState({}, '', u.pathname + (u.search || '') + u.hash);
  queryClient.invalidateQueries({ queryKey: KEY_GOOGLE });
  return { ok: g === 'ok', motivo };
}
