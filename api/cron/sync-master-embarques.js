// api/cron/sync-master-embarques.js
// Descarga Master Embarques desde Google Sheets (CSV público) y upserta a embarques_compras.
//
// ENV requeridas:
//   SUPABASE_SERVICE_ROLE_KEY
//   MASTER_EMBARQUES_SHEET_ID     (ID del Google Sheet; el sheet debe estar como "anyone with link can view")
//   MASTER_EMBARQUES_SHEET_NAME   (opcional, default "2026" — se puede cambiar al cerrar el año)
//   CRON_SECRET                   (opcional, si está presente se valida contra header x-cron-secret)

const SB_URL = process.env.VITE_SUPABASE_URL || 'https://hrhccvuhnedahznewgaj.supabase.co';
const SRK    = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SHEET_ID   = process.env.MASTER_EMBARQUES_SHEET_ID;
const SHEET_NAME = process.env.MASTER_EMBARQUES_SHEET_NAME || String(new Date().getFullYear());

// ────────── CSV parser (robusto con comillas) ──────────
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i+1] === '"') { cur += '"'; i++; continue; }
      if (c === '"') { inQuotes = false; continue; }
      cur += c;
    } else {
      if (c === '"') { inQuotes = true; continue; }
      if (c === ',') { row.push(cur); cur = ''; continue; }
      if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; continue; }
      if (c === '\r') continue;
      cur += c;
    }
  }
  if (cur !== '' || row.length > 0) { row.push(cur); rows.push(row); }
  return rows;
}

// ────────── Normalización ──────────
function snake(s) {
  return String(s || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}
function toStr(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' || s === '#N/A' ? null : s;
}
function toNum(v) {
  if (v == null || v === '' || v === '#N/A') return null;
  const n = Number(String(v).replace(/[$,]/g, ''));
  return isNaN(n) ? null : n;
}
function toInt(v) { const n = toNum(v); return n == null ? null : Math.round(n); }

// Fecha: "dd/mm/yyyy", "d/m/yy", etc
function toISODate(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  // Si viene "Monday, 5 de January" tipo dateformula, ignorar (no es un dato de fecha ISO consistente)
  if (/[A-Za-z]/.test(s) && !/\d{1,2}[\/\-]\d{1,2}/.test(s)) {
    const d = new Date(s);
    return isNaN(d) ? null : d.toISOString().slice(0, 10);
  }
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (!m) {
    const d = new Date(s);
    return isNaN(d) ? null : d.toISOString().slice(0, 10);
  }
  let [, a, b, c] = m;
  const year = c.length === 2 ? `20${c}` : c;
  return `${year}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
}

function classifyCedis(raw) {
  const s = (raw == null ? '' : String(raw)).trim();
  if (!s) return { cedis: null, entrega_directa_cliente: null };
  if (/^\d/.test(s)) return { cedis: s, entrega_directa_cliente: null };
  return { cedis: s, entrega_directa_cliente: s };
}

// ────────── Transform CSV → rows para embarques_compras ──────────
function transformRows(rawRows) {
  if (rawRows.length < 2) return [];
  const header = rawRows[0].map(snake);

  // Helpers para indexar
  const idx = (names) => {
    for (const n of Array.isArray(names) ? names : [names]) {
      const i = header.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };

  const col = {
    po:             idx('po'),
    fecha_emision:  idx('fecha_emision'),
    grupo:          idx('grupo'),
    cbm:            idx('cbm'),
    f_a:            idx(['f_a', 'fa']),
    porcentaje:     idx('porcentaje'),
    familia:        idx('familia'),
    codigo:         idx('codigo'),
    descripcion:    idx('descripcion'),
    po_qty:         idx('po_qty'),
    shp_qty:        idx('shp_qty'),
    unit_price:     idx('unit_price'),
    total_amount:   idx('total_amount'),
    metodo_pago:    idx('metodo_de_pago'),
    supplier:       idx('supplier'),
    fecha_ini_prod: idx('fecha_inicio_de_produccion'),
    fin_prod:       idx('fin_de_produccion'),
    ref_ff:         idx('ref_ff'),
    naviera:        idx('naviera'),
    tipo_carga:     idx('tipo_de_carga'),
    tipo_cont:      idx('tipo_de_cont'),
    costo_flete:    idx('costo_flete'),
    fdw:            idx('fdw'),
    contenedor:     idx('contenedor'),
    etd:            idx('etd'),
    eta_puerto:     idx('eta_puerto'),
    a_a:            idx(['a_a', 'aa']),
    arribo_cedis:   idx('arribo_a_cedis'),
    lt:             idx('lt'),
    cedis:          idx('cedis'),
    estatus:        idx('estatus'),
    com_trafico:    idx('comentarios_trafico'),
    com_diseno:     idx('comentarios_diseno'),
  };

  const rows = [];
  for (let i = 1; i < rawRows.length; i++) {
    const r = rawRows[i];
    const po = toStr(r[col.po]);
    const codigo = toStr(r[col.codigo]);
    if (!po || !codigo) continue;

    const { cedis, entrega_directa_cliente } = classifyCedis(r[col.cedis]);

    rows.push({
      po,
      codigo,
      fecha_emision:   toISODate(r[col.fecha_emision]),
      grupo:           toStr(r[col.grupo]),
      cbm:             toNum(r[col.cbm]),
      fraccion_arancelaria: toStr(r[col.f_a]),
      porcentaje:      toNum(r[col.porcentaje]),
      familia:         toStr(r[col.familia]),
      descripcion:     toStr(r[col.descripcion]),
      po_qty:          toInt(r[col.po_qty]),
      shp_qty:         toInt(r[col.shp_qty]),
      unit_price:      toNum(r[col.unit_price]),
      total_amount:    toNum(r[col.total_amount]),
      metodo_pago:     toStr(r[col.metodo_pago]),
      supplier:        toStr(r[col.supplier]),
      fecha_inicio_produccion: toISODate(r[col.fecha_ini_prod]),
      fin_produccion:  toISODate(r[col.fin_prod]),
      ref_ff:          toStr(r[col.ref_ff]),
      naviera:         toStr(r[col.naviera]),
      tipo_carga:      toStr(r[col.tipo_carga]),
      tipo_contenedor: toStr(r[col.tipo_cont]),
      costo_flete:     toNum(r[col.costo_flete]),
      fdw:             toStr(r[col.fdw]),
      contenedor:      toStr(r[col.contenedor]),
      etd:             toISODate(r[col.etd]),
      eta_puerto:      toISODate(r[col.eta_puerto]),
      agente_aduanal:  toStr(r[col.a_a]),
      arribo_cedis:    toISODate(r[col.arribo_cedis]),
      lt:              toStr(r[col.lt]),
      cedis,
      entrega_directa_cliente,
      estatus:         toStr(r[col.estatus]),
      comentarios_trafico: toStr(r[col.com_trafico]),
      comentarios_diseno:  toStr(r[col.com_diseno]),
    });
  }

  // Dedup por (po, codigo) conservando último
  const seen = new Map();
  for (const r of rows) seen.set(`${r.po}||${r.codigo}`, r);
  return [...seen.values()];
}

// ────────── Upsert por chunks vía PostgREST ──────────
async function upsertChunks(rows) {
  const CHUNK = 200;
  let ok = 0, fail = 0;
  const errors = [];
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const r = await fetch(`${SB_URL}/rest/v1/embarques_compras?on_conflict=po,codigo`, {
      method: 'POST',
      headers: {
        apikey: SRK,
        Authorization: 'Bearer ' + SRK,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(batch),
    });
    if (r.ok) ok += batch.length;
    else {
      fail += batch.length;
      errors.push({ batch: i, status: r.status, err: (await r.text()).slice(0, 300) });
    }
  }
  return { ok, fail, errors };
}

// ────────── Handler ──────────
export default async function handler(req, res) {
  // Validación opcional de secret (Vercel manda Authorization: Bearer <CRON_SECRET> en crons privados)
  if (process.env.CRON_SECRET) {
    const got = req.headers.authorization?.replace(/^Bearer\s+/, '') ||
                req.headers['x-cron-secret'];
    if (got !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  }

  if (!SRK) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' });
  if (!SHEET_ID) return res.status(500).json({ error: 'MASTER_EMBARQUES_SHEET_ID no configurada — ve a Vercel → Settings → Environment Variables' });

  try {
    // Descarga CSV de la hoja con nombre `SHEET_NAME`
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;
    const resp = await fetch(url, { redirect: 'follow' });
    if (!resp.ok) {
      return res.status(502).json({
        error: `No se pudo descargar el sheet (${resp.status}). Verifica que esté compartido como "anyone with link can view".`,
        url: url.replace(SHEET_ID, SHEET_ID.slice(0, 6) + '…'),
      });
    }
    const csvText = await resp.text();
    const rawRows = parseCSV(csvText);

    if (rawRows.length < 2) {
      return res.status(200).json({ ok: true, rows_parsed: 0, msg: 'Hoja vacía' });
    }

    const rows = transformRows(rawRows);
    if (rows.length === 0) {
      return res.status(200).json({ ok: true, rows_parsed: rawRows.length - 1, rows_valid: 0, msg: 'Sin filas válidas' });
    }

    const result = await upsertChunks(rows);
    return res.status(200).json({
      ok: result.fail === 0,
      rows_parsed: rawRows.length - 1,
      rows_valid: rows.length,
      upserted: result.ok,
      failed: result.fail,
      errors: result.errors.slice(0, 3),
      sheet: SHEET_NAME,
      ts: new Date().toISOString(),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
