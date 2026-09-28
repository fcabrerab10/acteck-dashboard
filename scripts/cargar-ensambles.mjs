// Carga masiva de archivos de ensambles de Digitalife (2026-09-28).
//   node scripts/cargar-ensambles.mjs <archivo.xlsx | carpeta> [más…]
// Usa el MISMO parser que el importador (src/lib/parsers/digitalife.js) y escribe directo con el service role
// (upsert por cliente,fecha,folio,sku,row_hash: se puede repetir sin duplicar). Al final refresca las MVs.
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));
const URL = env.VITE_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' };
const args = process.argv.slice(2);
if (!args.length) { console.log('uso: node scripts/cargar-ensambles.mjs <archivo.xlsx | carpeta> …'); process.exit(2); }
const archivos = args.flatMap((a) => fs.statSync(a).isDirectory() ? fs.readdirSync(a).filter((f) => /\.xlsx?$/i.test(f) && !f.startsWith('~')).map((f) => path.join(a, f)) : [a]);
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { digitalifeEnsambles } = await vite.ssrLoadModule('/src/lib/parsers/digitalife.js');
const XLSX = (await import('xlsx')).default;
globalThis.XLSX = XLSX; globalThis.window = globalThis.window || { XLSX };   // _util.js#XLSX() lee el global del navegador
let total = 0;
for (const f of archivos) {
  const wb = XLSX.readFile(f, { cellDates: true });
  const job = digitalifeEnsambles(wb, path.basename(f));
  const seen = new Map(); for (const r of job.rows) seen.set(job.onConflict.split(',').map((k) => String(r[k] ?? '')).join('|'), r);
  const rows = [...seen.values()];
  for (let i = 0; i < rows.length; i += 500) {
    const r = await fetch(`${URL}/rest/v1/sellout_ensambles?on_conflict=${job.onConflict}`, { method: 'POST', headers: H, body: JSON.stringify(rows.slice(i, i + 500)) });
    if (!r.ok) { console.error('ERROR', f, r.status, await r.text()); process.exit(1); }
  }
  total += rows.length;
  console.log(`✓ ${path.basename(f)} · ${job.resumen}`);
}
const r = await fetch(`${URL}/rest/v1/rpc/refresh_mv_sellout_unificado`, { method: 'POST', headers: H, body: '{}' });
console.log(`MVs: ${r.ok ? 'refrescadas' : 'no se pudieron refrescar (' + r.status + ')'} · ${total} filas en ${archivos.length} archivo(s)`);
await vite.close(); process.exit(0);
