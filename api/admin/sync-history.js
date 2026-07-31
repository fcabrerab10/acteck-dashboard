// api/admin/sync-history.js
// Lee el historial compartido de cargas del uploader central.
// Query:
//   ?src_id=<opcional>     — filtra a una tarjeta específica
//   ?limit=<1..50>         — default 10
//
// Auth: cualquier usuario autenticado. Usa service_role para saltarse RLS
// (equivalente al gate hecho en requireAuth). Ordena por created_at DESC.

import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../_auth.js';

const SB_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  if (!SRK) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' });

  const perfil = await requireAuth(req, res);
  if (!perfil) return;

  const src_id = req.query.src_id ? String(req.query.src_id) : null;
  const limitRaw = parseInt(req.query.limit, 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, limitRaw)) : 10;

  const admin = createClient(SB_URL, SRK);
  let q = admin
    .from('sync_events')
    .select('id, src_id, status_key, status, filas, filename, duracion_ms, detalles, user_id, user_nombre, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (src_id) q = q.eq('src_id', src_id);

  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ events: data || [] });
}
