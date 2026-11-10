// Recarga de líneas repetidas de Digitalife (2026-11-10).
//   node scripts/recargar-repetidas-digitalife.mjs            → sólo informa (cobertura y cuánto sube por año)
//   node scripts/recargar-repetidas-digitalife.mjs --cargar   → inserta las líneas `#2`, `#3`… que faltaban
// El archivo de ventas no trae folio y la regla vieja fundía en una las líneas idénticas del mismo día
// (ver `numerarRepetidas` en src/lib/parsers/digitalife.js). Lee el histórico y todos los semanales de
// Descargas con el parser nuevo; la primera línea de cada grupo conserva su hash, así que sólo se AGREGAN
// las repeticiones. Idempotente (upsert).
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { createServer } from 'vite';

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));
const BASE = env.VITE_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' };
const CARGAR = process.argv.includes('--cargar');

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const P = await vite.ssrLoadModule('/src/lib/parsers/digitalife.js');
const XLSX = (await import('xlsx-js-style')).default;
globalThis.window = { XLSX };

const DL = path.join(os.homedir(), 'Downloads');
const HIST = path.join(os.homedir(), 'Desktop', 'Actualización Dashboard', 'Historico Sellout Digitalife.xlsx');
const esVenta = (f) => f.startsWith('Acteck_BalamRush_Ventas') && !f.includes('Ensambles') && f.endsWith('.xlsx');
const esEnsamble = (f) => f.startsWith('Acteck_BalamRush_Ventas_Ensambles') && f.endsWith('.xlsx');
const ventas = [...(fs.existsSync(HIST) ? [HIST] : []), ...fs.readdirSync(DL).filter(esVenta).map((f) => path.join(DL, f))];
const dirEns = path.join(DL, 'Ensambles_Digitalife_historico');
const ens = [
  ...(fs.existsSync(dirEns) ? fs.readdirSync(dirEns).filter((f) => f.toLowerCase().endsWith('.xlsx') && !f.startsWith('~')).map((f) => path.join(dirEns, f)) : []),
  ...fs.readdirSync(DL).filter(esEnsamble).map((f) => path.join(DL, f)),
];

async function todo(tabla, filtro, cols) {
  const out = [];
  for (let o = 0; ; o += 1000) {
    const r = await (await fetch(`${BASE}/rest/v1/${tabla}?${filtro}&select=${cols}&order=fecha&limit=1000&offset=${o}`, { headers: H })).json();
    out.push(...r);
    if (r.length < 1000) break;
  }
  return out;
}

async function correr(nombre, archivos, parser, tabla, valorDe) {
  const union = new Map();
  const dias = new Set();
  let malos = 0;
  let onConflict = null;
  for (const f of archivos) {
    let job;
    try { job = P[parser](XLSX.readFile(f, { cellDates: true }), path.basename(f), {}); }
    catch (e) { malos += 1; console.log('  ! no se pudo leer', path.basename(f), String(e.message).slice(0, 80)); continue; }
    onConflict = job.onConflict;
    for (const r of job.rows) { union.set(onConflict.split(',').map((k) => String(r[k] ?? '')).join('|'), r); dias.add(r.fecha); }
  }
  const db = await todo(tabla, 'cliente=eq.digitalife', `fecha,row_hash,cantidad,${valorDe}`);
  const enBase = new Set(db.map((r) => `${r.fecha}|${r.row_hash}`));
  const diasDb = new Set(db.map((r) => r.fecha));
  const sinArchivo = [...diasDb].filter((d) => !dias.has(d)).sort();
  const nuevas = [...union.values()].filter((r) => String(r.row_hash).includes('#') && !enBase.has(`${r.fecha}|${r.row_hash}`));
  const suma = (lista) => { const o = {}; for (const r of lista) { const a = r.fecha.slice(0, 4); o[a] = o[a] || { n: 0, pz: 0, v: 0 }; o[a].n += 1; o[a].pz += Number(r.cantidad) || 0; o[a].v += Number(r[valorDe]) || 0; } return o; };
  const porAnio = suma(nuevas);
  const dbAnio = suma(db);
  const ord = [...dias].sort();
  console.log(`== ${nombre}: ${archivos.length} archivos (${malos} ilegibles) · días en archivos ${dias.size} (${ord[0]} → ${ord[ord.length - 1]}) · días en la base ${diasDb.size} · días de la base sin archivo: ${sinArchivo.length}${sinArchivo.length ? ` (${sinArchivo[0]} … ${sinArchivo[sinArchivo.length - 1]})` : ''}`);
  for (const a of Object.keys(dbAnio).sort()) {
    const b = dbAnio[a];
    const x = porAnio[a] || { n: 0, pz: 0, v: 0 };
    console.log(`   ${a}: base ${b.n} líneas · ${b.pz} pz · ${Math.round(b.v)}  →  faltan ${x.n} líneas · ${x.pz} pz · ${Math.round(x.v)} (${b.pz ? (x.pz / b.pz * 100).toFixed(1) : 0} % en piezas)`);
  }
  if (sinArchivo.length) {
    const meses = {};
    for (const d of sinArchivo) meses[d.slice(0, 7)] = (meses[d.slice(0, 7)] || 0) + 1;
    console.log('   días sin archivo por mes:', JSON.stringify(meses));
  }
  if (CARGAR && nuevas.length) {
    for (let i = 0; i < nuevas.length; i += 500) {
      const r = await fetch(`${BASE}/rest/v1/${tabla}?on_conflict=${onConflict}`, { method: 'POST', headers: H, body: JSON.stringify(nuevas.slice(i, i + 500)) });
      if (!r.ok) { console.error('ERROR', r.status, await r.text()); process.exit(1); }
    }
    console.log(`   ✓ cargadas ${nuevas.length} líneas repetidas`);
  }
}

await correr('Ventas', ventas, 'digitalifeSellout', 'sellout_detalle', 'total');
await correr('Ensambles', ens, 'digitalifeEnsambles', 'sellout_ensambles', 'cantidad');
await vite.close();
process.exit(0);
