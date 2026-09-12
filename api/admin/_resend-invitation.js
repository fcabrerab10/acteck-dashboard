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

  // Primero intentamos invite (funciona si el usuario no existe todavía).
  // Si falla porque ya existe, usamos generateLink({ type: 'recovery' })
  // que sí soporta usuarios existentes y manda un email de acceso.
  const { error: inviteErr } = await supabaseAdmin.auth.admin
    .inviteUserByEmail(email, { redirectTo });

  if (!inviteErr) {
    return res.status(200).json({ ok: true, message: 'Invitación reenviada' });
  }

  // El error clásico es "A user with this email address has already been registered"
  const yaExiste = /already been registered|already exists/i.test(inviteErr.message || '');
  if (!yaExiste) {
    return res.status(400).json({ error: inviteErr.message });
  }

  // Usuario ya existe → link de recovery (usa el mismo redirectTo).
  const { error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo },
  });
  if (linkErr) return res.status(400).json({ error: linkErr.message });

  return res.status(200).json({
    ok: true,
    message: 'Link de acceso reenviado (usa el template "Reset Password" de Supabase).',
  });
}
