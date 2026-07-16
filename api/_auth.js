// api/_auth.js — helpers de autenticación compartidos por endpoints /api/*.
//
// Los endpoints que usan SUPABASE_SERVICE_ROLE_KEY bypasean RLS. Sin este
// gate, cualquiera podría escribir/borrar datos maestros. Todos deben pasar
// por requireSuperAdmin() al inicio del handler.
import { createClient } from '@supabase/supabase-js';

const SB_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SB_ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Verifica que el caller sea super_admin. Si sí, retorna el perfil.
 * Si no, responde con 401/403 y retorna null (el handler debe hacer `return`).
 *
 * Uso:
 *   const perfil = await requireSuperAdmin(req, res);
 *   if (!perfil) return;
 *   // ... resto del handler
 */
export async function requireSuperAdmin(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader) { res.status(401).json({ error: 'No autorizado' }); return null; }
  if (!SB_URL || !SB_ANON) { res.status(500).json({ error: 'Supabase URL/ANON missing' }); return null; }
  if (!SRK) { res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' }); return null; }

  const sbUser = createClient(SB_URL, SB_ANON);
  const { data: { user }, error } = await sbUser.auth.getUser(authHeader.replace('Bearer ', ''));
  if (error || !user) { res.status(401).json({ error: 'Token inválido' }); return null; }

  const sbAdmin = createClient(SB_URL, SRK);
  const { data: perfil } = await sbAdmin.from('perfiles')
    .select('user_id,email,nombre,rol,tipo,es_super_admin,permisos')
    .eq('user_id', user.id).single();

  const esSuper = perfil?.es_super_admin === true || perfil?.rol === 'super_admin';
  if (!esSuper) { res.status(403).json({ error: 'Solo Super Admin puede ejecutar esta acción' }); return null; }
  return perfil;
}

/**
 * Verifica que el caller esté autenticado (no importa el rol). Retorna el
 * perfil o null si falla la auth (ya respondió el error).
 */
export async function requireAuth(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader) { res.status(401).json({ error: 'No autorizado' }); return null; }
  if (!SB_URL || !SB_ANON) { res.status(500).json({ error: 'Supabase URL/ANON missing' }); return null; }

  const sbUser = createClient(SB_URL, SB_ANON);
  const { data: { user }, error } = await sbUser.auth.getUser(authHeader.replace('Bearer ', ''));
  if (error || !user) { res.status(401).json({ error: 'Token inválido' }); return null; }

  if (SRK) {
    const sbAdmin = createClient(SB_URL, SRK);
    const { data: perfil } = await sbAdmin.from('perfiles')
      .select('user_id,email,nombre,rol,tipo,es_super_admin,permisos')
      .eq('user_id', user.id).single();
    return perfil || { user_id: user.id, email: user.email };
  }
  return { user_id: user.id, email: user.email };
}

/**
 * Verifica que la request venga del cron de Vercel. Requiere header
 * `authorization: Bearer <CRON_SECRET>`. Retorna true/false — no responde
 * directamente para dar al handler flexibilidad.
 */
export function isCronRequest(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const h = req.headers.authorization || '';
  return h === `Bearer ${secret}`;
}
