// GET /api/sync-status → devuelve todas las filas de sync_status
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supa = createClient(url, key, { auth: { persistSession: false } });

export default async function handler(req, res) {
  try {
    if (!url || !key) return res.status(500).json({ error: 'Supabase env vars missing' });
    const { data, error } = await supa.from('sync_status').select('fuente, ultima_actualizacion, registros, meta').order('fuente');
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, items: data || [] });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message || e) });
  }
}
