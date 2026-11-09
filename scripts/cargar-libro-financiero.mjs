// Carga de libros financieros de los consultores (2026-11-09).
//   node scripts/cargar-libro-financiero.mjs <REVKO LIBRO MM-MM-AA.xlsx | carpeta> [más…] [--dry]
// Mismo parser que el importador (src/lib/parsers/libroFinanciero.js); escribe directo con el service role
// (upsert por anio,mes,hoja,clave,columna: se puede repetir). Con --dry sólo imprime el resumen.
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));
const URL = env.VITE_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' };
const dry = process.argv.includes('--dry');
const args = process.argv.slice(2).filter((a) => a !== '--dry');
if (!args.length) { console.log('uso: node scripts/cargar-libro-financiero.mjs <archivo.xlsx | carpeta> … [--dry]'); process.exit(2); }
const archivos = args.flatMap((a) => fs.statSync(a).isDirectory() ? fs.readdirSync(a).filter((f) => /\.xlsx?$/i.test(f) && !f.startsWith('~')).map((f) => path.join(a, f)) : [a]);
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { default: libroFinanciero } = await vite.ssrLoadModule('/src/lib/parsers/libroFinanciero.js');
const XLSX = (await import('xlsx-js-style')).default;
globalThis.XLSX = XLSX; globalThis.window = globalThis.window || { XLSX };
// Orden: por periodo del libro, para que el más reciente pise a los anteriores.
const jobs = archivos.map((f) => { const wb = XLSX.readFile(f, { cellStyles: false }); const job = libroFinanciero(wb, path.basename(f)); return { f, job }; })
  .sort((a, b) => (a.job.periodoLibro.anio - b.job.periodoLibro.anio) || (a.job.periodoLibro.mes - b.job.periodoLibro.mes));
let total = 0;
for (const { f, job } of jobs) {
  const porHoja = {}; for (const r of job.rows) porHoja[r.hoja] = (porHoja[r.hoja] || 0) + 1;
  console.log(`${dry ? '·' : '✓'} ${path.basename(f)} · ${job.resumen}`);
  console.log('   ', Object.entries(porHoja).map(([h, n]) => `${h} ${n}`).join(' · '));
  if (dry) continue;
  for (let i = 0; i < job.rows.length; i += 500) {
    const r = await fetch(`${URL}/rest/v1/libro_financiero?on_conflict=${job.onConflict}`, { method: 'POST', headers: H, body: JSON.stringify(job.rows.slice(i, i + 500)) });
    if (!r.ok) { console.error('ERROR', f, r.status, await r.text()); process.exit(1); }
  }
  total += job.rows.length;
}
if (!dry) console.log(`${total} filas en ${archivos.length} libro(s)`);
await vite.close(); process.exit(0);
