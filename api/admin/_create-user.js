import { createClient } from '@supabase/supabase-js';

// ── Crea colaborador (o invitación) + perfil ──────────────────────────────
// Body:
//   { nombre, email, puesto, tipo, permisos, metodo, password? }
//   metodo: 'invite' (default, recomendado) | 'password'
//
// - 'invite': llama a supabaseAdmin.auth.admin.inviteUserByEmail. Supabase
//   dispara el email de invitación (usar template "Invite User" en el
//   dashboard). El usuario sigue el link a /#/set-password.
// - 'password': createUser({ email, password, email_confirm: true }).
//
// En ambos casos se inserta el perfil con estado 'pendiente' (para invite)
// o 'activo' (para password). Nunca crea super admin.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No autorizado' });

  const supabaseUser = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  );
  const { data: { user }, error: authErr } = await supabaseUser.auth.getUser(authHeader.replace('Bearer ', ''));
  if (authErr || !user) return res.status(401).json({ error: 'Token inválido' });

  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: callerProfile } = await supabaseAdmin.from('perfiles')
    .select('rol, es_super_admin, nombre').eq('user_id', user.id).single();
  const esSuper = callerProfile?.es_super_admin === true || callerProfile?.rol === 'super_admin';
  if (!esSuper) return res.status(403).json({ error: 'Solo Super Admin puede crear usuarios' });

  const {
    email, nombre, tipo, puesto, permisos,
    metodo = 'invite', password,
    // compat
    rol, clientes, modulos, pestanas_cliente, puede_editar,
  } = req.body;

  if (!email || !nombre) return res.status(400).json({ error: 'Faltan nombre o email' });
  if (metodo === 'password' && !password) return res.status(400).json({ error: 'Falta la contraseña' });

  // Base URL para el redirect del email de invitación
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const baseUrl = process.env.PUBLIC_SITE_URL || `${proto}://${host}`;
  const redirectTo = `${baseUrl}/#/set-password`;

  let userId, estado;

  if (metodo === 'invite') {
    const { data: inviteData, error: inviteErr } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: {
          full_name: nombre,
          invited_by_name: callerProfile?.nombre || 'Un admin',
          invited_by_id: user.id,
          puesto: puesto || null,
        },
      });
    if (inviteErr) return res.status(400).json({ error: inviteErr.message });
    userId = inviteData.user.id;
    estado = 'pendiente';
  } else {
    const { data: authData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: nombre, puesto: puesto || null },
    });
    if (createErr) return res.status(400).json({ error: createErr.message });
    userId = authData.user.id;
    estado = 'activo';
  }

  const perfilRow = {
    user_id: userId,
    nombre,
    email,
    tipo: tipo || 'interno',
    puesto: puesto || null,
    permisos: permisos || null,
    es_super_admin: false,
    // compat legacy
    rol: rol || (tipo === 'externo' ? 'cliente' : 'asistente'),
    clientes: clientes || [],
    modulos: modulos || [],
    pestanas_cliente: pestanas_cliente || [],
    puede_editar: puede_editar !== undefined ? puede_editar : false,
    activo: true,
  };
  // Solo intentamos setear estado/suspended/invited_by si las columnas existen
  // (ver docs/RLS_POLICIES.md → sección Migraciones). Un ALTER ... IF NOT EXISTS
  // manual en Supabase permite estos campos; si no existen, el insert los ignora
  // gracias a que hacemos un segundo update controlado.
  const { error: profileErr } = await supabaseAdmin.from('perfiles').insert(perfilRow);
  if (profileErr) {
    // Si el perfil falla, revertimos el user auth para no dejar huérfanos.
    try { await supabaseAdmin.auth.admin.deleteUser(userId); } catch {}
    return res.status(400).json({ error: profileErr.message });
  }
  // Best-effort: setear estado/invited_by si existen
  await supabaseAdmin.from('perfiles')
    .update({ estado, invited_by: user.id, invited_at: new Date().toISOString() })
    .eq('user_id', userId)
    .then(() => {}, () => {});

  return res.status(200).json({
    ok: true,
    user_id: userId,
    metodo,
    estado,
    message: metodo === 'invite' ? 'Invitación enviada' : 'Usuario creado',
  });
}
