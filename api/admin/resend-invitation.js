import { createClient } from '@supabase/supabase-js';

// Reenvía invitación por email. Solo super admin.
// Body: { email }
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

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Falta email' });

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const baseUrl = process.env.PUBLIC_SITE_URL || `${proto}://${host}`;
  const redirectTo = `${baseUrl}/#/set-password`;

  const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (error) return res.status(400).json({ error: error.message });

  return res.status(200).json({ ok: true, message: 'Invitación reenviada' });
}
