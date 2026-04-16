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

// Paginated fetch — PostgREST default limit is 1000
async function fetchAll(path) {
  const rows = [];
  const PAGE = 1000;
  let offset = 0;
  while (true) {
    const url = `${SB_URL}/rest/v1/${path}&limit=${PAGE}&offset=${offset}`;
    const r = await fetch(url, {
      headers: {
        apikey: SRK,
        Authorization: 'Bearer ' + SRK,
        'Content-Type': 'application/json',
        Prefer: 'count=none',
      },
    });
    if (!r.ok) throw new Error('Failed to read: ' + (await r.text()).slice(0, 200));
    const batch = await r.json();
    rows.push(...batch);
    if (batch.length < PAGE) break;
    offset += PAGE;
  }
  return rows;
}

// Recalc ventas_mensuales from ventas_erp
async function recalcVentasMensuales() {
  const rows = await fetchAll('ventas_erp?select=cliente_nombre,anio,mes,monto_venta_pesos&cliente_nombre=not.is.null');

  // Aggregate by (cliente, anio, mes)
  const agg = {};
  for (const row of rows) {
    const clienteNombre = String(row.cliente_nombre || '').trim();
    const cliente = CLIENT_MAP[clienteNombre];
    if (!cliente) continue;

    const anio = parseInt(row.anio);
    const mes = parseInt(row.mes);
    if (!anio || !mes) continue;

    const key = `${cliente}|${anio}|${mes}`;
    if (!agg[key]) agg[key] = { cliente, anio, mes, sell_in: 0 };
    agg[key].sell_in += Number(row.monto_venta_pesos) || 0;
  }

  const upsertRows = Object.values(agg);
  if (!upsertRows.length) return { table: 'ventas_mensuales', count: 0 };

  // Delete existing sell_in data first (preserve sell_out by updating, not replacing)
  // We delete all rows and re-insert to avoid stale data from old calculations
  const clients = [...new Set(upsertRows.map(r => r.cliente))];
  for (const c of clients) {
    await fetch(`${SB_URL}/rest/v1/ventas_mensuales?cliente=eq.${c}`, {
      method: 'DELETE',
      headers: { apikey: SRK, Authorization: 'Bearer ' + SRK },
    });
  }

  // Insert fresh rows
  const CHUNK = 200;
  for (let i = 0; i < upsertRows.length; i += CHUNK) {
    const batch = upsertRows.slice(i, i + CHUNK);
    const ur = await fetch(`${SB_URL}/rest/v1/ventas_mensuales`, {
      method: 'POST',
      headers: {
        apikey: SRK,
        Authorization: 'Bearer ' + SRK,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(batch),
    });
    if (!ur.ok) throw new Error('ventas_mensuales insert failed: ' + (await ur.text()).slice(0, 200));
  }
  return { table: 'ventas_mensuales', count: upsertRows.length };
}

// Recalc sell_in_sku from ventas_erp
async function recalcSellInSku() {
  const rows = await fetchAll('ventas_erp?select=cliente_nombre,anio,mes,articulo,piezas,monto_venta_pesos&cliente_nombre=not.is.null');

  const agg = {};
  for (const row of rows) {
    const clienteNombre = String(row.cliente_nombre || '').trim();
    const cliente = CLIENT_MAP[clienteNombre];
    if (!cliente) continue;

    const anio = parseInt(row.anio);
    const mes = parseInt(row.mes);
    if (!anio || !mes) continue;

    const sku = String(row.articulo || '').trim();
    if (!sku) continue;

    const key = `${cliente}|${sku}|${anio}|${mes}`;
    if (!agg[key]) agg[key] = { cliente, sku, anio, mes, monto_pesos: 0, piezas: 0 };
    agg[key].monto_pesos += Number(row.monto_venta_pesos) || 0;
    agg[key].piezas += Number(row.piezas) || 0;
  }

  const upsertRows = Object.values(agg);
  if (!upsertRows.length) return { table: 'sell_in_sku', count: 0 };

  // Delete stale data first (old rows may have wrong SKU from canal_articulo bug)
  const clients = [...new Set(upsertRows.map(r => r.cliente))];
  for (const c of clients) {
    await fetch(`${SB_URL}/rest/v1/sell_in_sku?cliente=eq.${c}`, {
      method: 'DELETE',
      headers: { apikey: SRK, Authorization: 'Bearer ' + SRK },
    });
  }

  // Insert fresh rows
  const CHUNK = 200;
  for (let i = 0; i < upsertRows.length; i += CHUNK) {
    const batch = upsertRows.slice(i, i + CHUNK);
    const ur = await fetch(`${SB_URL}/rest/v1/sell_in_sku`, {
      method: 'POST',
      headers: {
        apikey: SRK,
        Authorization: 'Bearer ' + SRK,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(batch),
    });
    if (!ur.ok) throw new Error('sell_in_sku insert failed: ' + (await ur.text()).slice(0, 200));
  }
  return { table: 'sell_in_sku', count: upsertRows.length };
}

// Recalc sellout_sku from sellout_detalle
async function recalcSelloutSku() {
  const rows = await fetchAll('sellout_detalle?select=cliente,fecha,no_parte,cantidad,total');

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
    if (!agg[key]) agg[key] = { cliente, sku, anio, mes, piezas: 0, monto_pesos: 0 };
    agg[key].piezas += Number(row.cantidad) || 0;
    agg[key].monto_pesos += Number(row.total) || 0;
  }

  const upsertRows = Object.values(agg);
  if (!upsertRows.length) return { table: 'sellout_sku', count: 0 };

  // Delete stale/test data first, then insert fresh
  const clients = [...new Set(upsertRows.map(r => r.cliente))];
  for (const c of clients) {
    await fetch(`${SB_URL}/rest/v1/sellout_sku?cliente=eq.${c}`, {
      method: 'DELETE',
      headers: { apikey: SRK, Authorization: 'Bearer ' + SRK },
    });
  }
  // Also clean up any test rows
  await fetch(`${SB_URL}/rest/v1/sellout_sku?cliente=like.*test*`, {
    method: 'DELETE',
    headers: { apikey: SRK, Authorization: 'Bearer ' + SRK },
  });

  const CHUNK = 200;
  for (let i = 0; i < upsertRows.length; i += CHUNK) {
    const batch = upsertRows.slice(i, i + CHUNK);
    const ur = await fetch(`${SB_URL}/rest/v1/sellout_sku`, {
      method: 'POST',
      headers: {
        apikey: SRK,
        Authorization: 'Bearer ' + SRK,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(batch),
    });
    if (!ur.ok) throw new Error('sellout_sku insert failed: ' + (await ur.text()).slice(0, 200));
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
    const { tables, debug, reset } = req.body || {};

    // Reset mode: delete all rows from a logical group of tables
    // { reset: 'sellout' } → wipes sellout_detalle and sellout_sku
    if (reset) {
      const resetMap = {
        sellout: ['sellout_detalle', 'sellout_sku'],
      };
      const tablesToWipe = resetMap[reset];
      if (!tablesToWipe) {
        return res.status(400).json({ error: 'unknown reset group. options: ' + Object.keys(resetMap).join(', ') });
      }
      const wipeResults = [];
      for (const t of tablesToWipe) {
        const r = await fetch(`${SB_URL}/rest/v1/${t}?id=gte.0`, {
          method: 'DELETE',
          headers: { apikey: SRK, Authorization: 'Bearer ' + SRK, Prefer: 'count=exact' },
        });
        // Fallback for tables without numeric id: delete via a column that always exists
        if (!r.ok) {
          // try by cliente (works for sellout_detalle & sellout_sku)
          const r2 = await fetch(`${SB_URL}/rest/v1/${t}?cliente=not.is.null`, {
            method: 'DELETE',
            headers: { apikey: SRK, Authorization: 'Bearer ' + SRK, Prefer: 'count=exact' },
          });
          wipeResults.push({ table: t, deleted: r2.headers.get('content-range'), ok: r2.ok });
        } else {
          wipeResults.push({ table: t, deleted: r.headers.get('content-range'), ok: true });
        }
      }
      return res.status(200).json({ ok: true, reset, results: wipeResults });
    }

    // Debug mode: return column names of a table
    if (debug) {
      const r = await fetch(`${SB_URL}/rest/v1/${debug}?limit=1`, {
        headers: { apikey: SRK, Authorization: 'Bearer ' + SRK },
      });
      if (!r.ok) return res.status(r.status).json({ error: await r.text() });
      const data = await r.json();
      return res.status(200).json({ columns: data.length ? Object.keys(data[0]) : 'empty', sample: data[0] || null });
    }

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
