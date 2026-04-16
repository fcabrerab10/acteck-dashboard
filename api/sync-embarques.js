// api/sync-embarques.js
// Fetches Master Embarques from Google Sheets (CSV export) and upserts to embarques_compras.
// Maps all columns from the sheet.

export const config = { api: { bodyParser: false } };

const SB_URL = process.env.VITE_SUPABASE_URL || 'https://hrhccvuhnedahznewgaj.supabase.co';
const SRK    = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SHEET_ID = '1m2I_oTd4EYTQ1v5KQOAZGIPmt58K3jRUbHGk0ed0JoQ';
const GID      = '2121397748';
const CSV_URL  = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

function snake(s) {
  return String(s).trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function toNum(v) { if (v == null || v === '' || v === '#N/A') return null; const n = Number(v); return isNaN(n) ? null : n; }
function toStr(v) { if (v == null) return null; const s = String(v).trim(); return s === '' || s === '#N/A' ? null : s; }
function toDate(v) {
  if (!v || v === '' || v === '#N/A') return null;
  // Try parsing common date formats
  const d = new Date(v);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

function parseCSV(text) {
  const lines = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      lines.push(current); current = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      lines.push(current); current = '';
      // Mark row boundary
      lines.push('\n');
    } else {
      current += ch;
    }
  }
  if (current) lines.push(current);

  // Split into rows
  const rows = [];
  let row = [];
  for (const cell of lines) {
    if (cell === '\n') { if (row.length) rows.push(row); row = []; }
    else row.push(cell);
  }
  if (row.length) rows.push(row);
  return rows;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!SRK) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' });

  try {
    // Fetch CSV from Google Sheets
    const csvResp = await fetch(CSV_URL);
    if (!csvResp.ok) {
      return res.status(502).json({ error: 'Failed to fetch Google Sheet', status: csvResp.status });
    }
    const csvText = await csvResp.text();

    const parsed = parseCSV(csvText);
    if (parsed.length < 2) return res.status(200).json({ ok: true, count: 0, msg: 'No data rows' });

    const headers = parsed[0].map(h => snake(h));
    const dataRows = parsed.slice(1);

    const rows = [];
    for (const cells of dataRows) {
      const obj = {};
      for (let i = 0; i < headers.length; i++) {
        const h = headers[i];
        const v = cells[i] || null;
        obj[h] = v;
      }

      // Map to embarques_compras columns — keep all columns as snake_case
      const po = toStr(obj.po);
      const codigo = toStr(obj.codigo);
      if (!po && !codigo) continue; // skip empty rows

      const mapped = {
        po,
        codigo,
        estatus: toStr(obj.estatus),
        marca: toStr(obj.marca),
        sku: toStr(obj.sku),
        descripcion: toStr(obj.descripcion),
        cantidad: toNum(obj.cantidad),
        costo_usd: toNum(obj.costo_usd ?? obj.costo),
        total_usd: toNum(obj.total_usd ?? obj.total),
        proveedor: toStr(obj.proveedor),
        fecha_po: toDate(obj.fecha_po),
        etd: toDate(obj.etd),
        eta: toDate(obj.eta),
        naviera: toStr(obj.naviera),
        contenedor: toStr(obj.contenedor),
        bl: toStr(obj.bl),
        pedimento: toStr(obj.pedimento),
        fecha_arribo: toDate(obj.fecha_arribo),
        almacen_destino: toStr(obj.almacen_destino),
        notas: toStr(obj.notas),
      };

      // Also preserve any extra columns not explicitly mapped
      for (const [k, v] of Object.entries(obj)) {
        if (!(k in mapped) && v != null && String(v).trim() !== '') {
          mapped[k] = toStr(v);
        }
      }

      rows.push(mapped);
    }

    if (!rows.length) return res.status(200).json({ ok: true, count: 0, msg: 'No valid rows' });

    // Upsert in chunks
    const CHUNK = 200;
    let total = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const batch = rows.slice(i, i + CHUNK);
      const ur = await fetch(`${SB_URL}/rest/v1/embarques_compras?on_conflict=po,codigo`, {
        method: 'POST',
        headers: {
          apikey: SRK,
          Authorization: 'Bearer ' + SRK,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(batch),
      });
      if (!ur.ok) {
        const errText = await ur.text();
        return res.status(ur.status).json({ error: 'upsert failed', detail: errText.slice(0, 500), batch: i });
      }
      total += batch.length;
    }

    res.status(200).json({ ok: true, count: total });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
