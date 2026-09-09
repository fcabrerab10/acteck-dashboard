// Escritura a Supabase. Dos transportes, se elige por .env:
//   · DIRECTO (recomendado): SUPABASE_SERVICE_ROLE_KEY presente → PostgREST
//     directo (upsert/delete/rpc), sin pasar por Vercel. Misma lógica que
//     api/import-central.js (replace, finalize, refresh de MV, sync_events).
//   · VÍA VERCEL (respaldo): sin key → POST /api/import-central con SYNC_SECRET.
import { log, sleep } from './util.mjs';

const SB_URL = (process.env.SUPABASE_URL || 'https://hrhccvuhnedahznewgaj.supabase.co').replace(/\/$/, '');
const SRK = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const BASE = (process.env.DASHBOARD_URL || 'https://acteck-dashboard.vercel.app').replace(/\/$/, '');
const SECRET = process.env.SYNC_SECRET || '';
export const DIRECTO = SRK.length > 20;
export const describirTransporte = () => (DIRECTO ? `directo a Supabase (${SB_URL})` : `vía Vercel (${BASE}/api/import-central)`);

// Tablas cuya carga obliga a refrescar mv_sellout_unificado (igual que import-central).
const AFECTA_SELLOUT_MV = new Set(['sellout_general', 'sellout_detalle', 'sellout_pcel', 'facturacion_clientes']);
const ORIGEN = 'Puente SQL (Mac mini)';

// ── HTTP con reintentos (5xx / red); 4xx no se reintenta ────────────────────
async function http(url, init, { retries = 4 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fetch(url, { ...init, signal: AbortSignal.timeout(180_000) });
      const text = await r.text();
      let json = null; try { json = JSON.parse(text); } catch { /* texto */ }
      if (r.ok) return json;
      if (r.status < 500 && r.status !== 408 && r.status !== 429) throw new Error(`HTTP ${r.status} ${text.slice(0, 400)}`);
      lastErr = new Error(`HTTP ${r.status} ${text.slice(0, 300)}`);
    } catch (e) {
      if (/^HTTP 4/.test(e.message)) throw e;
      lastErr = e;
    }
    if (i < retries) { const wait = 2000 * 2 ** i; log(`  reintento ${i + 1}/${retries} en ${wait / 1000}s · ${lastErr.message}`); await sleep(wait); }
  }
  throw lastErr;
}

// ── Transporte DIRECTO (PostgREST) ──────────────────────────────────────────
const sbHeaders = (extra = {}) => ({ apikey: SRK, Authorization: 'Bearer ' + SRK, 'Content-Type': 'application/json', ...extra });
const sb = {
  upsert: (table, onConflict, rows) => http(`${SB_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST', headers: sbHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify(rows),
  }),
  del: (table, filter) => http(`${SB_URL}/rest/v1/${table}?${filter}`, { method: 'DELETE', headers: sbHeaders({ Prefer: 'return=minimal' }) }),
  rpc: (fn, body = {}) => http(`${SB_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: sbHeaders(), body: JSON.stringify(body) }, { retries: 1 }),
};

// ── Transporte VÍA VERCEL ───────────────────────────────────────────────────
const vercel = (body, opts) => http(`${BASE}/api/import-central`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'x-sync-secret': SECRET }, body: JSON.stringify(body),
}, opts);

/**
 * Sube rows a `table` por chunks. Las instrucciones de borrado (deleteAll /
 * deleteAnios) se aplican ANTES del primer chunk; los demás van en paralelo.
 */
export async function upsertRows(table, onConflict, rows, { deleteAll = false, deleteAnios = null, chunk = DIRECTO ? 1000 : 500, concurrency = 4, dryRun = false } = {}) {
  if (!rows.length) {
    if (deleteAll || deleteAnios?.length) log(`  ${table}: 0 filas · no se borra nada (protección contra vistas vacías)`);
    return { ok: 0, chunks: 0 };
  }
  const chunks = [];
  for (let i = 0; i < rows.length; i += chunk) chunks.push(rows.slice(i, i + chunk));
  log(`  ${table}: ${rows.length} filas en ${chunks.length} chunks${deleteAll ? ' · replace completo' : ''}${deleteAnios?.length ? ' · replace años ' + deleteAnios.join(',') : ''}`);
  if (dryRun) { log('  dry-run: no se envía nada. Muestra:', JSON.stringify(rows[0]).slice(0, 300)); return { ok: 0, chunks: 0, dryRun: true }; }

  let ok = 0, next = 0;
  if (DIRECTO) {
    if (deleteAll) await sb.del(table, `${onConflict.split(',')[0].trim()}=not.is.null`);
    for (const a of deleteAnios || []) await sb.del(table, `anio=eq.${parseInt(a, 10)}`);
  } else {
    const first = { table, rows: chunks[0], onConflict };
    if (deleteAll) first.deleteAll = true;
    if (deleteAnios?.length) first.deleteAnios = deleteAnios;
    await vercel(first);
    ok = chunks[0].length; next = 1;
  }
  const worker = async () => {
    while (next < chunks.length) {
      const i = next++;
      if (DIRECTO) await sb.upsert(table, onConflict, chunks[i]);
      else await vercel({ table, rows: chunks[i], onConflict });
      ok += chunks[i].length;
      if (i % 20 === 0 && i > 0) log(`  ${table}: ${ok}/${rows.length}`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, chunks.length) }, worker));
  if (DIRECTO && AFECTA_SELLOUT_MV.has(table)) {
    log('  refresh_mv_sellout_unificado…');
    await sb.rpc('refresh_mv_sellout_unificado', {}).catch((e) => log(`  (refresh MV falló: ${e.message})`));
  }
  return { ok, chunks: chunks.length };
}

/** Paso posterior a erp_ventas: reconstruye facturacion_clientes para esos años. */
export async function finalizeErpVentas(anios, { dryRun = false } = {}) {
  if (dryRun) return { dryRun: true };
  if (!DIRECTO) return vercel({ table: 'erp_ventas', finalize: 'refresh_facturacion_clientes', anios });
  const resumen = await sb.rpc('refresh_facturacion_clientes', { p_anios: anios });
  await sb.rpc('refresh_mv_sellout_unificado', {}).catch(() => {});
  return { resumen };
}

/** Deja rastro en sync_events / sync_status (historial del uploader). */
export async function logSyncEvent(table, ev, { dryRun = false } = {}) {
  if (dryRun) return;
  try {
    if (!DIRECTO) { await vercel({ table, syncEvent: { origen: ORIGEN, ...ev } }, { retries: 1 }); return; }
    const row = {
      src_id: String(ev.src_id || table).slice(0, 100), status_key: ev.status_key || null, status: ev.status,
      filas: ev.filas ?? null, duracion_ms: ev.duracion_ms ?? null, detalles: ev.detalles || null, user_id: null, user_nombre: ORIGEN,
    };
    await http(`${SB_URL}/rest/v1/sync_events`, { method: 'POST', headers: sbHeaders({ Prefer: 'return=minimal' }), body: JSON.stringify(row) }, { retries: 1 });
    if (ev.status === 'success' && ev.status_key) {
      await http(`${SB_URL}/rest/v1/sync_status?on_conflict=fuente`, {
        method: 'POST', headers: sbHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify({ fuente: ev.status_key, ultima_actualizacion: new Date().toISOString(), registros: ev.filas ?? null, meta: { origen: ORIGEN, ...(ev.detalles || {}) } }),
      }, { retries: 1 });
    }
  } catch (e) { log(`  (no se pudo registrar sync_event: ${e.message})`); }
}

/** Ping de credenciales. */
export async function ping() {
  if (DIRECTO) return http(`${SB_URL}/rest/v1/sync_status?select=fuente&limit=1`, { headers: sbHeaders() }, { retries: 0 });
  return vercel({ table: 'roadmap_sku', syncEvent: { src_id: 'bridge-ping', status: 'warning', detalles: { tipo: 'ping' } } }, { retries: 0 });
}
