// Cliente de /api/import-central (Vercel). El puente nunca habla con Supabase
// directo: no necesita el service role key. Autentica con x-sync-secret.
import { log, sleep } from './util.mjs';

const BASE = (process.env.DASHBOARD_URL || 'https://acteck-dashboard.vercel.app').replace(/\/$/, '');
const SECRET = process.env.SYNC_SECRET || '';

async function post(body, { retries = 4 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fetch(`${BASE}/api/import-central`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-sync-secret': SECRET },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });
      const text = await r.text();
      let json = null; try { json = JSON.parse(text); } catch { /* texto */ }
      if (r.ok) return json;
      // 4xx (salvo 408/429) no se reintenta: es un error de datos o de auth.
      if (r.status < 500 && r.status !== 408 && r.status !== 429) {
        throw new Error(`HTTP ${r.status} ${text.slice(0, 400)}`);
      }
      lastErr = new Error(`HTTP ${r.status} ${text.slice(0, 300)}`);
    } catch (e) {
      if (/^HTTP 4/.test(e.message)) throw e;
      lastErr = e;
    }
    if (i < retries) { const wait = 2000 * 2 ** i; log(`  reintento ${i + 1}/${retries} en ${wait / 1000}s · ${lastErr.message}`); await sleep(wait); }
  }
  throw lastErr;
}

/**
 * Sube rows a `table` por chunks. El PRIMER chunk viaja solo y lleva las
 * instrucciones de borrado (deleteAll / deleteAnios), igual que uploads.html
 * (postChunksFast). El resto va en paralelo (concurrency).
 */
export async function upsertRows(table, onConflict, rows, { deleteAll = false, deleteAnios = null, chunk = 500, concurrency = 4, dryRun = false } = {}) {
  if (!rows.length) {
    if (deleteAll || deleteAnios?.length) log(`  ${table}: 0 filas · no se borra nada (protección contra vistas vacías)`);
    return { ok: 0, chunks: 0 };
  }
  const chunks = [];
  for (let i = 0; i < rows.length; i += chunk) chunks.push(rows.slice(i, i + chunk));
  log(`  ${table}: ${rows.length} filas en ${chunks.length} chunks${deleteAll ? ' · replace completo' : ''}${deleteAnios?.length ? ' · replace años ' + deleteAnios.join(',') : ''}`);
  if (dryRun) { log('  dry-run: no se envía nada. Muestra:', JSON.stringify(rows[0]).slice(0, 300)); return { ok: 0, chunks: 0, dryRun: true }; }

  const first = { table, rows: chunks[0], onConflict };
  if (deleteAll) first.deleteAll = true;
  if (deleteAnios?.length) first.deleteAnios = deleteAnios;
  await post(first);
  let ok = chunks[0].length, next = 1;
  const worker = async () => {
    while (next < chunks.length) {
      const i = next++;
      await post({ table, rows: chunks[i], onConflict });
      ok += chunks[i].length;
      if (i % 20 === 0) log(`  ${table}: ${ok}/${rows.length}`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, chunks.length) }, worker));
  return { ok, chunks: chunks.length };
}

/** Paso posterior a erp_ventas: reconstruye facturacion_clientes para esos años. */
export async function finalizeErpVentas(anios, { dryRun = false } = {}) {
  if (dryRun) return { dryRun: true };
  return post({ table: 'erp_ventas', finalize: 'refresh_facturacion_clientes', anios });
}

/** Deja rastro en sync_events / sync_status (historial del uploader). */
export async function logSyncEvent(table, ev, { dryRun = false } = {}) {
  if (dryRun) return;
  try { await post({ table, syncEvent: { origen: 'Puente SQL (Mac mini)', ...ev } }, { retries: 1 }); }
  catch (e) { log(`  (no se pudo registrar sync_event: ${e.message})`); }
}

/** Ping de autenticación: manda un syncEvent 'warning' inofensivo. */
export async function ping() {
  return post({ table: 'roadmap_sku', syncEvent: { src_id: 'bridge-ping', status: 'warning', detalles: { tipo: 'ping' } } }, { retries: 0 });
}
