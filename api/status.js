// api/status.js
// Dispatcher consolidado: reemplaza last-update.js, sync-status.js, upload-status.js
// (Vercel Hobby permite máx. 12 serverless functions.)
//
//   GET /api/status?type=last    → { last_update, per_table }
//   GET /api/status?type=sync    → { ok, items }
//   GET /api/status?type=upload  → { <fuente>: { ... } }

import { createClient } from '@supabase/supabase-js';
import { requireAuth } from './_auth.js';

const SB_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://hrhccvuhnedahznewgaj.supabase.co';
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;

const LAST_TABLES = [
  'inventario_acteck',
  'ventas_erp',
  'sellout_detalle',
  'inventario_cliente',
  'roadmap_sku',
  'precios_sku',
  'transito_sku',
];

const UPLOAD_QUERIES = {
  facturacion_global: 'facturacion_clientes?select=anio,mes&order=anio.desc,mes.desc&limit=1',
  inventario_acteck:  'inventario_acteck?select=updated_at&order=updated_at.desc&limit=1',
  roadmap:            'roadmap_sku?select=updated_at&order=updated_at.desc&limit=1',
  precios:            'precios_sku?select=updated_at&order=updated_at.desc&limit=1',
  embarques:          'embarques_compras?select=updated_at&order=updated_at.desc&limit=1',
  estados_resultados: 'estados_resultados?select=anio,mes,updated_at&order=anio.desc,mes.desc&limit=1',
  sellout_digitalife: 'sellout_detalle?cliente=eq.digitalife&select=fecha,updated_at&order=fecha.desc&limit=1',
  sellout_dicotech:   'sellout_detalle?cliente=eq.dicotech&select=fecha,updated_at&order=fecha.desc&limit=1',
  sellout_pcel:       'sellout_pcel?select=anio,semana&order=anio.desc,semana.desc&limit=1',
  inv_digitalife:     'inventario_cliente?cliente=eq.digitalife&select=anio,semana,updated_at&order=anio.desc,semana.desc&limit=1',
  inv_dicotech:       'inventario_cliente?cliente=eq.dicotech&select=anio,semana,updated_at&order=anio.desc,semana.desc&limit=1',
  ec_digitalife:      'estados_cuenta?cliente=eq.digitalife&select=anio,semana,fecha_corte,updated_at&order=anio.desc,semana.desc&limit=1',
  ec_pcel:            'estados_cuenta?cliente=eq.pcel&select=anio,semana,fecha_corte,updated_at&order=anio.desc,semana.desc&limit=1',
  ec_dicotech:        'estados_cuenta?cliente=eq.dicotech&select=anio,semana,fecha_corte,updated_at&order=anio.desc,semana.desc&limit=1',
};

async function restRow(query) {
  try {
    const r = await fetch(SB_URL + '/rest/v1/' + query, {
      headers: { apikey: SRK, Authorization: 'Bearer ' + SRK },
    });
    if (!r.ok) return null;
    const j = await r.json();
    return (j && j[0]) || null;
  } catch { return null; }
}

async function handleLast(res) {
  const per = {};
  await Promise.all(LAST_TABLES.map(async t => {
    const row = await restRow(t + '?select=updated_at&order=updated_at.desc&limit=1');
    per[t] = row?.updated_at || null;
  }));
  let max = null;
  for (const t of LAST_TABLES) {
    const v = per[t];
    if (v && (!max || v > max)) max = v;
  }
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ last_update: max, per_table: per });
}

async function handleSync(res) {
  const supa = createClient(SB_URL, SRK, { auth: { persistSession: false } });
  const { data, error } = await supa
    .from('sync_status')
    .select('fuente, ultima_actualizacion, registros, meta')
    .order('fuente');
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true, items: data || [] });
}

async function handleUpload(res) {
  const entries = await Promise.all(
    Object.entries(UPLOAD_QUERIES).map(async ([k, q]) => [k, await restRow(q)])
  );
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(Object.fromEntries(entries));
}

export default async function handler(req, res) {
  if (!SRK) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' });
  const perfil = await requireAuth(req, res);
  if (!perfil) return;

  const type = String(req.query?.type || '').toLowerCase();
  try {
    if (type === 'last')   return await handleLast(res);
    if (type === 'sync')   return await handleSync(res);
    if (type === 'upload') return await handleUpload(res);
    return res.status(400).json({ error: 'unknown type; use ?type=last|sync|upload' });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
