// api/admin/sync.js — un solo endpoint para la bitácora de cargas (Vercel Hobby permite máximo 12 funciones por deploy).
// POST → registra un evento (antes /api/admin/log-sync-event). GET → lista eventos (antes /api/admin/sync-history).
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../_auth.js';

const SB_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ALLOWED_STATUS = new Set(['success', 'error', 'warning']);

export default async function handler(req, res) {
  if (req.method === 'POST') return registrar(req, res);
  if (req.method === 'GET') return historial(req, res);
  return res.status(405).json({ error: 'GET o POST' });
}

async function registrar(req, res) {
  if (!SRK) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' });

  const perfil = await requireAuth(req, res);
  if (!perfil) return;

  const {
    src_id,
    status_key,
    status,
    filas,
    filename,
    duracion_ms,
    detalles,
  } = req.body || {};

  if (!src_id || typeof src_id !== 'string') {
    return res.status(400).json({ error: 'src_id (string) required' });
  }
  if (!status || !ALLOWED_STATUS.has(status)) {
    return res.status(400).json({ error: 'status must be one of: ' + [...ALLOWED_STATUS].join(', ') });
  }

  const admin = createClient(SB_URL, SRK);

  const row = {
    src_id: src_id.slice(0, 100),
    status_key: status_key ? String(status_key).slice(0, 100) : null,
    status,
    filas: filas == null || filas === '' ? null : Math.max(0, parseInt(filas, 10) || 0),
    filename: filename ? String(filename).slice(0, 300) : null,
    duracion_ms: duracion_ms == null || duracion_ms === '' ? null : Math.max(0, parseInt(duracion_ms, 10) || 0),
    detalles: detalles && typeof detalles === 'object' ? detalles : null,
    user_id: perfil.user_id,
    user_nombre: perfil.nombre || perfil.email || null,
  };

  const { data, error } = await admin
    .from('sync_events')
    .insert(row)
    .select('id')
    .single();

  if (error) {
    // No queremos que un fallo del historial rompa el flujo de uploads.
    // Devolvemos 500 pero el cliente cae al fallback localStorage.
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true, id: data.id });
}

async function historial(req, res) {
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
