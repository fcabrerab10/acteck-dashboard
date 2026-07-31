import { createClient } from '@supabase/supabase-js';

// Suspende o reactiva un usuario. Solo super admin.
// Body: { perfil_id, suspended: bool }
// Setea perfiles.activo = !suspended (mantiene compat con LoginPage que checa activo)
// y perfiles.estado = 'suspendido' | 'activo' (best-effort si la columna existe).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No autorizado' });

  const supabaseUser = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  );
  const { data: { user } } = await supabaseUser.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!user) return res.status(401).json({ error: 'Token inválido' });

  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { data: callerProfile } = await supabaseAdmin.from('perfiles')
    .select('rol, es_super_admin').eq('user_id', user.id).single();
  const esSuper = callerProfile?.es_super_admin === true || callerProfile?.rol === 'super_admin';
  if (!esSuper) return res.status(403).json({ error: 'Solo Super Admin' });

  const { perfil_id, suspended } = req.body;
  if (!perfil_id || typeof suspended !== 'boolean') return res.status(400).json({ error: 'Faltan perfil_id o suspended' });

  const { data: targetPerfil } = await supabaseAdmin.from('perfiles')
    .select('user_id, es_super_admin').eq('id', perfil_id).single();
  if (!targetPerfil) return res.status(404).json({ error: 'Perfil no encontrado' });
  if (targetPerfil.es_super_admin) return res.status(403).json({ error: 'No se puede suspender a un super admin' });

  const { error } = await supabaseAdmin.from('perfiles')
    .update({ activo: !suspended })
    .eq('id', perfil_id);
  if (error) return res.status(400).json({ error: error.message });

  // Best-effort estado
  await supabaseAdmin.from('perfiles')
    .update({ estado: suspended ? 'suspendido' : 'activo' })
    .eq('id', perfil_id)
    .then(() => {}, () => {});

  return res.status(200).json({ ok: true, message: suspended ? 'Usuario suspendido' : 'Usuario reactivado' });
}
