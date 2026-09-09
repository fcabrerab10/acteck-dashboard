#!/usr/bin/env node
// Carga el Master Embarques desde un .xlsx exportado de Google Sheets
// (por ejemplo, bajado con el conector de Drive de Claude) usando las MISMAS
// transformaciones que el sync por API (api/_embarques.js).
//
//   node --env-file=credenciales.env embarques-xlsx.mjs "Master Embarques.xlsx" [--dry-run]
import { readFileSync } from 'node:fs';
import XLSX from 'xlsx';
import { HOJAS_HISTORICAS, HOJAS_SECUNDARIAS, transformEmbarques, anioDeHoja } from '../api/_embarques.js';
import { upsertRows, logSyncEvent, describirTransporte } from './lib/api.mjs';
import { upsertEmbarquesCompras } from './lib/embarques.mjs';
import { log } from './lib/util.mjs';

const file = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
if (!file) { console.log('uso: embarques-xlsx.mjs <archivo.xlsx> [--dry-run]'); process.exit(2); }

const wb = XLSX.read(readFileSync(file), { cellDates: true });
const hoja = (n) => { const sh = wb.Sheets[n]; return sh ? XLSX.utils.sheet_to_json(sh, { header: 1, raw: true, defval: null }) : null; };
log(`▸ embarques desde ${file} · pestañas: ${wb.SheetNames.join(' · ')} · ${describirTransporte()}${dryRun ? ' (dry-run)' : ''}`);
const t0 = Date.now(); const detalles = {}; let total = 0;
try {
  let hist = [];
  for (const h of HOJAS_HISTORICAS) {
    const raw = hoja(h); if (!raw || raw.length < 2) continue;
    const rows = transformEmbarques(raw, { anioDefault: anioDeHoja(h) });
    log(`  hoja "${h}": ${raw.length - 1} filas → ${rows.length} válidas`); detalles[h] = rows.length; hist = hist.concat(rows);
  }
  total += await upsertEmbarquesCompras(hist, { dryRun });
  const ON = { programacion_arribos: 'contenedor', series_generadas: 'po,sku', proveedores_master: 'codigo,articulo', catalogo_articulos: 'articulo' };
  for (const sec of HOJAS_SECUNDARIAS) {
    const nombre = sec.sheets.find((n) => wb.Sheets[n]); if (!nombre) continue;
    const rows = sec.transform(hoja(nombre));
    log(`  hoja "${nombre}" → ${sec.table}: ${rows.length} filas`); detalles[sec.table] = rows.length;
    await upsertRows(sec.table, ON[sec.table], rows, { dryRun }); total += rows.length;
  }
  log(`✓ embarques: ${total} filas en ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  await logSyncEvent('embarques_compras', { src_id: 'master-embarques', status_key: 'embarques', status: 'success', filas: total, duracion_ms: Date.now() - t0, detalles: { tipo: 'sync-xlsx', archivo: file, ...detalles } }, { dryRun });
} catch (e) {
  log(`✗ embarques: ${e.message}`);
  await logSyncEvent('embarques_compras', { src_id: 'master-embarques', status_key: 'embarques', status: 'error', duracion_ms: Date.now() - t0, detalles: { tipo: 'sync-xlsx', mensaje: String(e.message).slice(0, 500) } }, { dryRun });
  process.exit(1);
}
