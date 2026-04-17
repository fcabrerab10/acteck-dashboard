// api/upload-estado-cuenta.js
// Recibe {resumen: {...}, detalle: [...]} y:
// 1) UPSERT estados_cuenta por (cliente, anio, semana) devolviendo el id
// 2) Borra detalle previo para ese id
// 3) Inserta detalle nuevo en chunks
// Además, si no viene tipo_cambio, intenta obtener el USD/MXN del día.

export const config = { api: { bodyParser: { sizeLimit: '6mb' } } };

const SB_URL = process.env.VITE_SUPABASE_URL || 'https://hrhccvuhnedahznewgaj.supabase.co';
const SRK    = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CHUNK  = 200;

async function fetchTCday() {
  try {
    const r = await fetch('https://api.exchangerate-api.com/v4/latest/USD', { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    const j = await r.json();
    const mxn = j?.rates?.MXN;
    return typeof mxn === 'number' ? Number(mxn.toFixed(4)) : null;
  } catch { return null; }
}

async function sbReq(method, path, body, extraHeaders = {}) {
  const r = await fetch(`${SB_URL}/rest/v1${path}`, {
    method,
    headers: {
      apikey: SRK,
      Authorization: 'Bearer ' + SRK,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: r.status, ok: r.ok, data };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!SRK) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' });

  try {
    const { resumen, detalle } = req.body || {};
    if (!resumen || typeof resumen !== 'object')
      return res.status(400).json({ error: 'resumen required' });
    if (!resumen.cliente || resumen.anio == null || resumen.semana == null)
      return res.status(400).json({ error: 'resumen.cliente/anio/semana required' });
    if (!Array.isArray(detalle))
      return res.status(400).json({ error: 'detalle must be array' });

    // Si no viene tipo_cambio, intentar obtenerlo del API público
    let resumenBody = { ...resumen };
    if (resumenBody.tipo_cambio == null) {
      const tc = await fetchTCday();
      if (tc) resumenBody.tipo_cambio = tc;
    }

    // 1) UPSERT resumen y obtener id
    const up = await sbReq(
      'POST',
      '/estados_cuenta?on_conflict=cliente,anio,semana',
      [resumenBody],
      { Prefer: 'resolution=merge-duplicates,return=representation' }
    );
    if (!up.ok) return res.status(up.status).json({ error: 'upsert resumen failed', detail: up.data });
    const id = Array.isArray(up.data) && up.data[0]?.id;
    if (!id) return res.status(500).json({ error: 'no id returned from upsert', detail: up.data });

    // 2) DELETE detalle previo
    const del = await sbReq('DELETE', `/estados_cuenta_detalle?estado_cuenta_id=eq.${id}`, null, {
      Prefer: 'return=minimal',
    });
    if (!del.ok) return res.status(del.status).json({ error: 'delete detalle failed', detail: del.data, id });

    // 3) INSERT detalle en chunks
    let insertedTotal = 0;
    const rows = detalle.map(d => ({ ...d, estado_cuenta_id: id }));
    for (let i = 0; i < rows.length; i += CHUNK) {
      const batch = rows.slice(i, i + CHUNK);
      const ins = await sbReq('POST', '/estados_cuenta_detalle', batch, { Prefer: 'return=minimal' });
      if (!ins.ok) {
        return res.status(ins.status).json({
          error: 'insert detalle failed', detail: ins.data,
          id, insertedBeforeFail: insertedTotal, chunkIdx: i,
        });
      }
      insertedTotal += batch.length;
    }

    res.status(200).json({
      ok: true,
      id,
      cliente: resumen.cliente,
      anio: resumen.anio,
      semana: resumen.semana,
      tipo_cambio: resumenBody.tipo_cambio ?? null,
      detalle_insertado: insertedTotal,
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
}
