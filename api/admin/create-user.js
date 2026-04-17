import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Verify caller is admin via their access token
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No autorizado' });

  const supabaseUser = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  );
  const { data: { user }, error: authErr } = await supabaseUser.auth.getUser(authHeader.replace('Bearer ', ''));
  if (authErr || !user) return res.status(401).json({ error: 'Token inválido' });

  // Admin client (service role bypasses RLS)
  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Check super_admin role using admin client to bypass RLS
  const { data: callerProfile } = await supabaseAdmin.from('perfiles').select('rol').eq('user_id', user.id).single();
  if (!callerProfile || callerProfile.rol !== 'super_admin') return res.status(403).json({ error: 'Solo Super Admin puede crear usuarios' });

  const { email, password, nombre, rol, clientes, modulos, pestanas_cliente, puede_editar } = req.body;
  if (!email || !password || !nombre || !rol) return res.status(400).json({ error: 'Faltan campos requeridos' });

  const { data: authData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  if (createErr) return res.status(400).json({ error: createErr.message });

  const { error: profileErr } = await supabaseAdmin.from('perfiles').insert({
    user_id: authData.user.id,
    nombre,
    email,
    rol: rol || 'viewer',
    clientes: clientes || [],
    modulos: modulos || [],
    pestanas_cliente: pestanas_cliente || [],
    puede_editar: puede_editar !== undefined ? puede_editar : false,
    activo: true
  });
  if (profileErr) return res.status(400).json({ error: profileErr.message });

  return res.status(200).json({ ok: true, user_id: authData.user.id, message: 'Usuario creado exitosamente' });
}
