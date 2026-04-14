// api/last-update.js
// Returns the most recent updated_at timestamp across the central Excel tables.
// Used by the dashboard to show the 'Ultima actualizacion' label.

const SB_URL = process.env.VITE_SUPABASE_URL || 'https://hrhccvuhnedahznewgaj.supabase.co';
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TABLES = [
  'inventario_acteck',
  'ventas_erp',
  'sellout_detalle',
  'inventario_cliente',
  'roadmap_sku',
  'precios_sku',
  'transito_sku'
];

export default async function handler(req, res) {
  if (!SRK) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' });
  try {
    const per = {};
    await Promise.all(TABLES.map(async t => {
      const url = SB_URL + '/rest/v1/' + t + '?select=updated_at&order=updated_at.desc&limit=1';
      try {
        const r = await fetch(url, { headers: { apikey: SRK, Authorization: 'Bearer ' + SRK } });
        if (!r.ok) { per[t] = null; return; }
        const j = await r.json();
        per[t] = (j && j[0] && j[0].updated_at) || null;
      } catch (e) { per[t] = null; }
    }));
    let max = null;
    for (const t of TABLES) {
      const v = per[t];
      if (v && (!max || v > max)) max = v;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ last_update: max, per_table: per });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
