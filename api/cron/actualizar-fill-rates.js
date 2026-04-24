// api/cron/actualizar-fill-rates.js
// Cruza todas las OCs activas (no completa, no cancelada) contra ventas_erp
// y actualiza cantidad_surtida. Los triggers SQL recalculan fill_rate y estado.

const SB_URL = process.env.VITE_SUPABASE_URL || 'https://hrhccvuhnedahznewgaj.supabase.co';
const SRK    = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (process.env.CRON_SECRET) {
    const got = req.headers.authorization?.replace(/^Bearer\s+/, '') || req.headers['x-cron-secret'];
    if (got !== process.env.CRON_SECRET) return res.status(401).json({ error: 'unauthorized' });
  }

  if (!SRK) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' });

  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/actualizar_fill_rate_todas`, {
      method: 'POST',
      headers: {
        apikey: SRK,
        Authorization: 'Bearer ' + SRK,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!r.ok) {
      const err = await r.text();
      return res.status(502).json({ error: err.slice(0, 500) });
    }

    const rows = await r.json();  // [{oc_id, cliente, oc_numero, skus_actualizados}, ...]
    const totalSkus = rows.reduce((a, x) => a + (x.skus_actualizados || 0), 0);

    return res.status(200).json({
      ok: true,
      ocs_procesadas: rows.length,
      skus_actualizados: totalSkus,
      ts: new Date().toISOString(),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
