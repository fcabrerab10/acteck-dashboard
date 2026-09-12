// Carga histórica puntual (2026-09-12) — se corre a mano, no es parte del build.
//
//   node --import 'data:text/javascript,import{register}from"node:module";import{pathToFileURL}from"node:url";register("./scripts/_resolver.mjs",pathToFileURL("./"))' \
//        scripts/cargar-historico-clientes.mjs [--dry]
//
// Usa LOS MISMOS parsers de src/lib/parsers/ que el importador del dashboard (sólo se
// stubea `window.XLSX` y `File`), con la fecha de corte forzada por archivo: así los
// snapshots caen en su semana real y no en la del día de carga.
// Archivos y semanas destino: docs/HISTORICO_CLIENTES.md §4.1 y §4.2.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import XLSX from 'xlsx';

globalThis.window = { XLSX };
const P = await import('../src/lib/parsers/index.js');

const SB = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SRK = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
if (!SB || !SRK) { console.error('Faltan VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const DRY = process.argv.includes('--dry');
const H = (extra = {}) => ({ apikey: SRK, Authorization: 'Bearer ' + SRK, 'Content-Type': 'application/json', ...extra });
const HOME = os.homedir();

// cliente = sólo para estados de cuenta · fechaCorte = 'YYYY-MM-DD' del corte real
const ARCHIVOS = [
  // ── Estados de cuenta de PCEL (§4.1) ──
  { parser: 'estadoCuenta', opts: { cliente: 'pcel' },     fechaCorte: '2025-12-03', file: `${HOME}/Downloads/Clientes/PCEL/Antigüedad de Saldos - Cuentas por Cobrar-PCEL.xlsx`, destino: 'EdC PCEL sem 49/2025' },
  { parser: 'estadoCuenta', opts: { cliente: 'pcel' },     fechaCorte: '2026-01-27', file: `${HOME}/Downloads/Personal/Antigüedad de Saldos - Cuentas por Cobrar-PC ONLINE.xlsx`, destino: 'EdC PCEL sem 5/2026' },
  { parser: 'estadoCuenta', opts: { cliente: 'pcel' },     fechaCorte: '2026-04-21', file: `${HOME}/Downloads/Antigüedad de Saldos - Cuentas por Cobrar-PC ONLINE.xlsx`, destino: 'EdC PCEL sem 17/2026' },
  { parser: 'estadoCuenta', opts: { cliente: 'pcel' },     fechaCorte: '2026-06-30', file: `${HOME}/Downloads/Antigüedad de Saldos - Cuentas por Cobrar-PC ONLINE-01-07.xlsx`, destino: 'EdC PCEL sem 27/2026 (con detalle)' },
  // ── Inventarios de cliente (§4.2) ──
  { parser: 'dicotechInventario', fechaCorte: '2026-08-03', file: `${HOME}/Downloads/Reporte-Inventario_Inventario Acteck Semanal (11).csv`, destino: 'Inventario Dicotech sem 32/2026' },
  { parser: 'dicotechInventario', fechaCorte: '2026-06-01', file: `${HOME}/Downloads/Reporte-Inventario_Inventario Acteck Semanal.csv`, destino: 'Inventario Dicotech sem 23/2026' },
  { parser: 'digitalifeInv',      fechaCorte: '2026-04-10', file: `${HOME}/Downloads/Acteck_BalamRush_Inventario (1).xlsx`, destino: 'Inventario Digitalife sem 15/2026' },
];

async function upsert(table, onConflict, filas) {
  // Mismo dedup por unique key que postChunks() del importador: la última fila gana.
  const keys = onConflict.split(',').map((k) => k.trim());
  const vistos = new Map();
  for (const r of filas) vistos.set(keys.map((c) => String(r[c] ?? '')).join('||'), r);
  const rows = [...vistos.values()];
  for (let i = 0; i < rows.length; i += 500) {
    const r = await fetch(`${SB}/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: 'POST', headers: H({ Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify(rows.slice(i, i + 500)),
    });
    if (!r.ok) throw new Error(`${table} ${r.status}: ${(await r.text()).slice(0, 300)}`);
  }
}

/** Misma lógica que api/upload-estado-cuenta.js (ese endpoint exige JWT de super admin):
 *  upsert del resumen por (cliente, anio, semana) → borra el detalle previo de ese id → inserta. */
async function subirEstadoCuenta({ resumen, detalle }) {
  const up = await fetch(`${SB}/rest/v1/estados_cuenta?on_conflict=cliente,anio,semana`, {
    method: 'POST', headers: H({ Prefer: 'resolution=merge-duplicates,return=representation' }), body: JSON.stringify([resumen]),
  });
  if (!up.ok) throw new Error(`estados_cuenta ${up.status}: ${(await up.text()).slice(0, 300)}`);
  const id = (await up.json())?.[0]?.id;
  if (!id) throw new Error('estados_cuenta sin id');
  await fetch(`${SB}/rest/v1/estados_cuenta_detalle?estado_cuenta_id=eq.${id}`, { method: 'DELETE', headers: H({ Prefer: 'return=minimal' }) });
  const rows = detalle.map((d) => ({ ...d, estado_cuenta_id: id }));
  for (let i = 0; i < rows.length; i += 200) {
    const r = await fetch(`${SB}/rest/v1/estados_cuenta_detalle`, { method: 'POST', headers: H({ Prefer: 'return=minimal' }), body: JSON.stringify(rows.slice(i, i + 200)) });
    if (!r.ok) throw new Error(`estados_cuenta_detalle ${r.status}: ${(await r.text()).slice(0, 300)}`);
  }
  return { id, filas: rows.length };
}

for (const a of ARCHIVOS) {
  if (!fs.existsSync(a.file)) { console.log(`✗ NO EXISTE · ${a.destino} · ${a.file}`); continue; }
  const wb = XLSX.readFile(a.file, { type: 'file', cellDates: true, cellStyles: false, raw: false });
  const opts = { ...(a.opts || {}), fechaCorte: `${a.fechaCorte}T12:00:00Z` };
  const jobs = [].concat(P[a.parser](wb, path.basename(a.file), opts));
  for (const j of jobs) {
    console.log(`· ${a.destino} → ${j.table || j.endpoint}: ${j.resumen}`);
    if (DRY) continue;
    if (j.endpoint) console.log(`   → estados_cuenta id=${(await subirEstadoCuenta(j.body)).id}`);
    else if (j.rows?.length) await upsert(j.table, j.onConflict, j.rows);
  }
}
console.log(DRY ? '\nDRY RUN — no se escribió nada.' : '\nListo.');
