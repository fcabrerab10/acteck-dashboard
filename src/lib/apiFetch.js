// Helper para llamar a /api/* incluyendo el JWT del usuario.
// Los endpoints protegidos con requireSuperAdmin/requireAuth necesitan
// `Authorization: Bearer <access_token>`.
import { supabase } from './supabase';

export async function apiFetch(url, init = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = { ...(init.headers || {}) };
  if (session?.access_token) headers.authorization = `Bearer ${session.access_token}`;
  return fetch(url, { ...init, headers });
}
