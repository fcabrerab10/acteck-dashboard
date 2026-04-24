import { createClient } from '@supabase/supabase-js';

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

  // Admin client (service role bypasses RLS)
  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Check super_admin using es_super_admin (nuevo modelo). Mantiene
  // compat con rol legacy por si aún no se migra.
  const { data: callerProfile } = await supabaseAdmin.from('perfiles')
    .select('rol, es_super_admin').eq('user_id', user.id).single();
  const esSuper = callerProfile?.es_super_admin === true || callerProfile?.rol === 'super_admin';
  if (!esSuper) return res.status(403).json({ error: 'Solo Super Admin' });

  const { perfil_id, updates, new_password } = req.body;
  if (!perfil_id) return res.status(400).json({ error: 'Falta perfil_id' });

  // Update profile
  if (updates) {
    const { error } = await supabaseAdmin.from('perfiles').update(updates).eq('id', perfil_id);
    if (error) return res.status(400).json({ error: error.message });
  }

  // Update password if provided
  if (new_password) {
    const { data: perfil } = await supabaseAdmin.from('perfiles').select('user_id').eq('id', perfil_id).single();
    if (perfil) {
      await supabaseAdmin.auth.admin.updateUserById(perfil.user_id, { password: new_password });
    }
  }

  return res.status(200).json({ ok: true, message: 'Usuario actualizado' });
}
