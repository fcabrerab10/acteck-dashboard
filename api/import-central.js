// api/import-central.js
// Endpoint simple de upsert por chunks. El cliente parsea el Excel y envÃÂ­a
// lotes de filas ya mapeadas: { table, rows, onConflict }
//
// Tablas permitidas y sus unique keys:
//   inventario_acteck   -> "articulo,no_almacen"
//   ventas_erp          -> "venta_id,venta_renglon"
//   sellout_detalle     -> "cliente,fecha,no_parte,row_hash"
//   inventario_cliente  -> "cliente,sku"

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

const SB_URL = process.env.VITE_SUPABASE_URL || 'https://hrhccvuhnedahznewgaj.supabase.co';
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED = {
  inventario_acteck:  'articulo,no_almacen',
  ventas_erp:         'venta_id,venta_renglon',
  sellout_detalle:    'cliente,fecha,no_parte,row_hash',
  inventario_cliente: 'cliente,sku',
  roadmap_sku:       'sku',
  precios_sku:       'sku',
  transito_sku:      'sku,row_hash',
  sellout_pcel:          'anio,semana,sku',
  estados_cuenta:        'cliente,anio,semana',
  estados_cuenta_detalle:'id',
  embarques_compras:     'po,codigo'
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!SRK) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' });

  try {
    const { table, rows } = req.body || {};
    if (!table || !ALLOWED[table]) return res.status(400).json({ error: 'invalid table. allowed: ' + Object.keys(ALLOWED).join(', ') });
    if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ error: 'rows[] required' });

    const url = `${SB_URL}/rest/v1/${table}?on_conflict=${ALLOWED[table]}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: SRK,
        Authorization: 'Bearer ' + SRK,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(rows)
    });
    if (!r.ok) {
      const txt = await r.text();
      return res.status(r.status).json({ error: 'upsert failed', detail: txt.slice(0, 500), table, count: rows.length });
    }
    res.status(200).json({ ok: true, table, count: rows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
