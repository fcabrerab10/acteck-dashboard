// api/recalculate.js
// Recalculates intermediate/materialized tables after data uploads.
// POST { tables: ['ventas_mensuales','sell_in_sku','sellout_sku'] }

const SB_URL = process.env.VITE_SUPABASE_URL || 'https://hrhccvuhnedahznewgaj.supabase.co';
const SRK    = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Client name mapping: ERP clientenombre → dashboard ID
const CLIENT_MAP = {
  'API GLOBAL': 'digitalife',
  'PC ONLINE': 'pcel',
  'PUBLICO GENERAL MERCADO LIBRE': 'mercadolibre',
  'PUBLICO GENERAL ML': 'mercadolibre',
};

async function sbQuery(sql) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      apikey: SRK,
      Authorization: 'Bearer ' + SRK,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!r.ok) {
    // RPC function may not exist — fall back to direct PostgREST operations
    return null;
  }
  return await r.json();
}

// Recalc ventas_mensuales from ventas_erp
async function recalcVentasMensuales() {
  // Step 1: Get aggregated data from ventas_erp
  const fetchUrl = `${SB_URL}/rest/v1/ventas_erp?select=clientenombre,fecha,cantidad,total`;
  const r = await fetch(fetchUrl, {
    headers: {
      apikey: SRK,
      Authorization: 'Bearer ' + SRK,
      'Content-Type': 'application/json',
      Prefer: 'count=none',
    },
  });
  if (!r.ok) throw new Error('Failed to read ventas_erp: ' + (await r.text()).slice(0, 200));
  const rows = await r.json();

  // Aggregate by (cliente, anio, mes)
  const agg = {};
  for (const row of rows) {
    const clienteNombre = String(row.clientenombre || '').trim();
    const cliente = CLIENT_MAP[clienteNombre];
    if (!cliente) continue;

    let fecha = row.fecha;
    if (typeof fecha === 'string') fecha = new Date(fecha);
    else if (typeof fecha === 'number') fecha = new Date(Math.round((fecha - 25569) * 86400 * 1000));
    if (!fecha || isNaN(fecha)) continue;

    const anio = fecha.getFullYear ? fecha.getFullYear() : new Date(fecha).getFullYear();
    const mes = (fecha.getMonth ? fecha.getMonth() : new Date(fecha).getMonth()) + 1;
    const key = `${cliente}|${anio}|${mes}`;
    if (!agg[key]) agg[key] = { cliente, anio, mes, sell_in: 0 };
    agg[key].sell_in += Number(row.total) || 0;
  }

  const upsertRows = Object.values(agg);
  if (!upsertRows.length) return { table: 'ventas_mensuales', count: 0 };

  // Upsert in chunks
  const CHUNK = 200;
  for (let i = 0; i < upsertRows.length; i += CHUNK) {
    const batch = upsertRows.slice(i, i + CHUNK);
    const ur = await fetch(`${SB_URL}/rest/v1/ventas_mensuales?on_conflict=cliente,anio,mes`, {
      method: 'POST',
      headers: {
        apikey: SRK,
        Authorization: 'Bearer ' + SRK,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(batch),
    });
    if (!ur.ok) throw new Error('ventas_mensuales upsert failed: ' + (await ur.text()).slice(0, 200));
  }
  return { table: 'ventas_mensuales', count: upsertRows.length };
}

// Recalc sell_in_sku from ventas_erp
async function recalcSellInSku() {
  const fetchUrl = `${SB_URL}/rest/v1/ventas_erp?select=clientenombre,fecha,canalarticulo,cantidad,total`;
  const r = await fetch(fetchUrl, {
    headers: {
      apikey: SRK,
      Authorization: 'Bearer ' + SRK,
      'Content-Type': 'application/json',
      Prefer: 'count=none',
    },
  });
  if (!r.ok) throw new Error('Failed to read ventas_erp: ' + (await r.text()).slice(0, 200));
  const rows = await r.json();

  const agg = {};
  for (const row of rows) {
    const clienteNombre = String(row.clientenombre || '').trim();
    const cliente = CLIENT_MAP[clienteNombre];
    if (!cliente) continue;

    let fecha = row.fecha;
    if (typeof fecha === 'string') fecha = new Date(fecha);
    else if (typeof fecha === 'number') fecha = new Date(Math.round((fecha - 25569) * 86400 * 1000));
    if (!fecha || isNaN(fecha)) continue;

    const anio = fecha.getFullYear ? fecha.getFullYear() : new Date(fecha).getFullYear();
    const mes = (fecha.getMonth ? fecha.getMonth() : new Date(fecha).getMonth()) + 1;
    const sku = String(row.canalarticulo || '').trim();
    if (!sku) continue;

    const key = `${cliente}|${sku}|${anio}|${mes}`;
    if (!agg[key]) agg[key] = { cliente, sku, anio, mes, monto_pesos: 0, cantidad: 0 };
    agg[key].monto_pesos += Number(row.total) || 0;
    agg[key].cantidad += Number(row.cantidad) || 0;
  }

  const upsertRows = Object.values(agg);
  if (!upsertRows.length) return { table: 'sell_in_sku', count: 0 };

  const CHUNK = 200;
  for (let i = 0; i < upsertRows.length; i += CHUNK) {
    const batch = upsertRows.slice(i, i + CHUNK);
    const ur = await fetch(`${SB_URL}/rest/v1/sell_in_sku?on_conflict=cliente,sku,anio,mes`, {
      method: 'POST',
      headers: {
        apikey: SRK,
        Authorization: 'Bearer ' + SRK,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(batch),
    });
    if (!ur.ok) throw new Error('sell_in_sku upsert failed: ' + (await ur.text()).slice(0, 200));
  }
  return { table: 'sell_in_sku', count: upsertRows.length };
}

// Recalc sellout_sku from sellout_detalle
async function recalcSelloutSku() {
  const fetchUrl = `${SB_URL}/rest/v1/sellout_detalle?select=cliente,fecha,no_parte,cantidad,total`;
  const r = await fetch(fetchUrl, {
    headers: {
      apikey: SRK,
      Authorization: 'Bearer ' + SRK,
      'Content-Type': 'application/json',
      Prefer: 'count=none',
    },
  });
  if (!r.ok) throw new Error('Failed to read sellout_detalle: ' + (await r.text()).slice(0, 200));
  const rows = await r.json();

  const agg = {};
  for (const row of rows) {
    const cliente = row.cliente || 'digitalife';
    let fecha = row.fecha;
    if (typeof fecha === 'string') fecha = new Date(fecha);
    if (!fecha || isNaN(new Date(fecha))) continue;

    const d = new Date(fecha);
    const anio = d.getFullYear();
    const mes = d.getMonth() + 1;
    const sku = String(row.no_parte || '').trim();
    if (!sku) continue;

    const key = `${cliente}|${sku}|${anio}|${mes}`;
    if (!agg[key]) agg[key] = { cliente, sku, anio, mes, cantidad: 0, monto_pesos: 0 };
    agg[key].cantidad += Number(row.cantidad) || 0;
    agg[key].monto_pesos += Number(row.total) || 0;
  }

  const upsertRows = Object.values(agg);
  if (!upsertRows.length) return { table: 'sellout_sku', count: 0 };

  const CHUNK = 200;
  for (let i = 0; i < upsertRows.length; i += CHUNK) {
    const batch = upsertRows.slice(i, i + CHUNK);
    const ur = await fetch(`${SB_URL}/rest/v1/sellout_sku?on_conflict=cliente,sku,anio,mes`, {
      method: 'POST',
      headers: {
        apikey: SRK,
        Authorization: 'Bearer ' + SRK,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(batch),
    });
    if (!ur.ok) throw new Error('sellout_sku upsert failed: ' + (await ur.text()).slice(0, 200));
  }
  return { table: 'sellout_sku', count: upsertRows.length };
}

const RECALC_MAP = {
  ventas_mensuales: recalcVentasMensuales,
  sell_in_sku: recalcSellInSku,
  sellout_sku: recalcSelloutSku,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!SRK) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' });

  try {
    const { tables } = req.body || {};
    if (!Array.isArray(tables) || !tables.length) {
      return res.status(400).json({ error: 'tables[] required. Options: ' + Object.keys(RECALC_MAP).join(', ') });
    }

    const results = [];
    for (const t of tables) {
      const fn = RECALC_MAP[t];
      if (!fn) {
        results.push({ table: t, error: 'unknown table' });
        continue;
      }
      try {
        const r = await fn();
        results.push(r);
      } catch (e) {
        results.push({ table: t, error: e.message });
      }
    }

    res.status(200).json({ ok: true, results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
