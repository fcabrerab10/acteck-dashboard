// Orquestador de una carga manual: lee el archivo (SheetJS bajo demanda), corre el
// parser de src/lib/parsers/, sube por /api/import-central en chunks (o al endpoint
// propio de la fuente), recalcula tablas derivadas y deja rastro en sync_events.
import { apiFetch } from '../../../lib/apiFetch';
import * as P from '../../../lib/parsers';

const CHUNK = 500, CONCURRENCIA = 3;

async function post(url, body) {
  let ultimo = null;
  for (let intento = 1; intento <= 4; intento++) {
    const r = await apiFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) return r.json().catch(() => ({}));
    const txt = (await r.text().catch(() => '')).slice(0, 300);
    ultimo = new Error(`HTTP ${r.status}: ${txt}`);
    if (r.status < 500 && r.status !== 429) break;
    await new Promise((ok) => setTimeout(ok, 600 * intento));
  }
  throw ultimo;
}

/** Sube rows por chunks. Las instrucciones de borrado viajan sólo en el primero. */
async function postChunks(job, onProgress) {
  const keys = job.onConflict.split(',').map((k) => k.trim());
  const seen = new Map();
  for (const row of job.rows) seen.set(keys.map((c) => String(row[c] ?? '')).join('||'), row);
  const rows = [...seen.values()];
  const batches = [];
  for (let i = 0; i < rows.length; i += CHUNK) batches.push(rows.slice(i, i + CHUNK));
  if (!batches.length) return { filas: 0, dedup: job.rows.length };
  const primero = { table: job.table, onConflict: job.onConflict, rows: batches[0] };
  if (job.replace) primero.deleteAll = true;
  if (job.deleteAnios?.length) primero.deleteAnios = job.deleteAnios;
  if (job.deletePeriodos?.length) primero.deletePeriodos = job.deletePeriodos;
  if (job.deleteCliente) primero.deleteCliente = job.deleteCliente;
  await post('/api/import-central', primero);
  let hechas = batches[0].length, idx = 1;
  onProgress?.(hechas, rows.length);
  await Promise.all(Array.from({ length: Math.min(CONCURRENCIA, batches.length) }, async () => {
    while (idx < batches.length) {
      const b = batches[idx++];
      await post('/api/import-central', { table: job.table, onConflict: job.onConflict, rows: b });
      hechas += b.length;
      onProgress?.(hechas, rows.length);
    }
  }));
  return { filas: hechas, dedup: job.rows.length - rows.length };
}

async function logEvento(fuente, ev) {
  try {
    await apiFetch('/api/admin/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ src_id: fuente.id, status_key: fuente.statusKey, ...ev }) });
  } catch { /* el historial no debe romper la carga */ }
}

/**
 * subirArchivo(fuente, file, { opts, onProgress(pct 0..1, texto) }) → { filas, lineas, ms }
 * Lanza Error con mensaje legible si algo falla (ya registrado en sync_events).
 */
export async function subirArchivo(fuente, file, { opts = {}, onProgress } = {}) {
  const t0 = Date.now();
  const lineas = [];
  const paso = (pct, txt) => onProgress?.(pct, txt);
  try {
    paso(0.02, `Leyendo ${file.name}…`);
    const wb = await P.leerWorkbook(file);
    const parser = P[fuente.parser];
    if (!parser) throw new Error(`Parser desconocido: ${fuente.parser}`);
    paso(0.08, 'Interpretando…');
    const jobs = [].concat(parser(wb, file.name, { ...(fuente.opts || {}), ...opts }));
    const totalFilas = jobs.reduce((s, j) => s + (j.rows?.length ?? j.filas ?? 0), 0);
    if (!totalFilas) throw new Error('El archivo no trajo filas válidas (revisa la hoja y los encabezados).');
    let subidas = 0, filas = 0;
    const recalc = new Set();
    for (const job of jobs) {
      if (job.resumen) lineas.push(`${job.table || job.endpoint}: ${job.resumen}`);
      if (job.endpoint) {
        paso(0.1 + 0.8 * (subidas / totalFilas), `Enviando ${job.body?.resumen?.cliente || ''}…`);
        const j = await post(job.endpoint, job.body);
        filas += job.filas || 0; subidas += job.filas || 0;
        if (j?.detalle_insertado != null) lineas.push(`estado_cuenta id=${j.id} · TC ${j.tipo_cambio ?? '—'} · ${j.detalle_insertado} facturas`);
        continue;
      }
      const r = await postChunks(job, (h, n) => paso(0.1 + 0.8 * ((subidas + h) / totalFilas), `Subiendo ${job.table} · ${(subidas + h).toLocaleString('es-MX')} / ${totalFilas.toLocaleString('es-MX')}`));
      subidas += job.rows.length; filas += r.filas;
      if (r.dedup) lineas.push(`${job.table}: ${r.dedup} duplicadas omitidas`);
      for (const t of job.recalc || []) recalc.add(t);
    }
    if (recalc.size) {
      paso(0.92, `Recalculando ${[...recalc].join(', ')}…`);
      try {
        const rj = await post('/api/recalculate', { tables: [...recalc] });
        for (const r of rj?.results || []) lineas.push(`${r.table}: ${r.count ?? 0} filas recalculadas${r.error ? ' · ' + r.error : ''}`);
      } catch (e) { lineas.push(`recalculate falló: ${e.message}`); }
    }
    const ms = Date.now() - t0;
    paso(1, 'Listo');
    await logEvento(fuente, { status: 'success', filas, filename: file.name, duracion_ms: ms, detalles: { tipo: 'upload', origen: 'importador', resumen: lineas.slice(0, 6) } });
    return { filas, lineas, ms };
  } catch (e) {
    const ms = Date.now() - t0;
    await logEvento(fuente, { status: 'error', filename: file.name, duracion_ms: ms, detalles: { tipo: 'upload', origen: 'importador', mensaje: String(e.message).slice(0, 500) } });
    throw e;
  }
}
