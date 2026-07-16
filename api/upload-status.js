// GET /api/upload-status
// Devuelve, por cada fuente del panel de Actualización de datos, su última
// fecha de datos (max(fecha) o max(anio,semana,mes)) y el updated_at de
// la tabla.

import { requireAuth } from './_auth.js';

const SB_URL = process.env.VITE_SUPABASE_URL || 'https://hrhccvuhnedahznewgaj.supabase.co';
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function row(query) {
  try {
    const r = await fetch(SB_URL + '/rest/v1/' + query, {
      headers: { apikey: SRK, Authorization: 'Bearer ' + SRK },
    });
    if (!r.ok) return null;
    const j = await r.json();
    return (j && j[0]) || null;
  } catch (e) {
    return null;
  }
}

export default async function handler(req, res) {
  if (!SRK) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' });
  }
  const perfil = await requireAuth(req, res);
  if (!perfil) return;

  const queries = {
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

  const entries = await Promise.all(
    Object.entries(queries).map(async ([key, q]) => [key, await row(q)])
  );
  const out = Object.fromEntries(entries);

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(out);
}
