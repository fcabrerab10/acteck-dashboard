// Recarga puntual del sell out de Dicotech (2026-09-12) — se corre a mano, no es parte del build.
//
//   node scripts/recargar-sellout-dicotech.mjs [--dry]
//
// Qué hace, en este orden:
//   1) Reconstruye 2026-05-01 → 2026-05-17 (semanas ISO 18 parcial, 19 y 20) desde
//      `sellout_general` (mayorista DICOTECH, puente SQL): es el único tramo del que no
//      hay CSV en disco. Monto = `importe` (sin IVA).
//   2) Carga los CSV semanales de Revko (~/Downloads) con la MISMA lógica del parser
//      `src/lib/parsers/dicotech.js`: monto sin IVA y row_hash determinista, así que
//      recargar CSVs traslapados sobrescribe en vez de duplicar.
//
// Escribe por PostgREST con SUPABASE_SERVICE_ROLE_KEY, igual que bridge/lib/api.mjs.
// El rango destino (>= 2026-05-01) debe haberse borrado antes; respaldo en
// `_respaldo_sellout_detalle_20260912`.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import XLSX from 'xlsx';

const SB = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SRK = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
if (!SB || !SRK) { console.error('Faltan VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const DRY = process.argv.includes('--dry');

const H = (extra = {}) => ({ apikey: SRK, Authorization: 'Bearer ' + SRK, 'Content-Type': 'application/json', ...extra });
const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; } return String(h); };
const hashVentaRevko = ({ folio, sku, fecha, cantidad, precio }) => hash(['REVKO', folio ?? '', sku ?? '', fecha ?? '', cantidad ?? '', precio ?? ''].join('|'));
const toNum = (v) => { if (v == null || v === '' || v === '#N/A') return null; const n = Number(v); return isNaN(n) ? null : n; };
const toStr = (v) => { if (v == null) return null; const s = String(v).trim(); return s === '' || s === '#N/A' ? null : s; };
const toISODate = (v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') { const d = new Date(Math.round((v - 25569) * 86400 * 1000)); return isNaN(d) ? null : d.toISOString().slice(0, 10); }
  const d = new Date(v); return isNaN(d) ? null : d.toISOString().slice(0, 10);
};

async function upsert(rows) {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const r = await fetch(`${SB}/rest/v1/sellout_detalle?on_conflict=cliente,fecha,no_parte,row_hash`, {
      method: 'POST', headers: H({ Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify(chunk),
    });
    if (!r.ok) throw new Error(`upsert ${r.status}: ${(await r.text()).slice(0, 300)}`);
  }
}

/** Dedup en memoria por la unique key (la última gana), como hace el importador. */
const dedup = (rows) => {
  const m = new Map();
  for (const r of rows) m.set(`${r.cliente}||${r.fecha}||${r.no_parte}||${r.row_hash}`, r);
  return [...m.values()];
};

// ── 1) Semanas 18-parcial/19/20 desde sellout_general ────────────────────────
async function desdeGeneral() {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${SB}/rest/v1/sellout_general?select=fecha,sku,descripcion,marca,cantidad,precio_unitario,importe,factura&mayorista=eq.DICOTECH&fecha=gte.2026-05-01&fecha=lte.2026-05-17&order=fecha`, {
      headers: H({ Range: `${from}-${from + 999}`, 'Range-Unit': 'items' }),
    });
    if (!r.ok) throw new Error(`select ${r.status}`);
    const rows = await r.json();
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out.map((g) => {
    const sku = (toStr(g.sku) || '').toUpperCase() || null;
    if (!sku || !g.fecha) return null;
    const cantidad = toNum(g.cantidad), precio = toNum(g.precio_unitario), neto = toNum(g.importe);
    return {
      cliente: 'dicotech', fecha: g.fecha, marca: toStr(g.marca), no_parte: sku, descripcion: toStr(g.descripcion),
      cantidad, precio, descuento: 0, iva: 0, subtotal: neto, total: neto,
      row_hash: hashVentaRevko({ folio: toStr(g.factura), sku, fecha: g.fecha, cantidad, precio }),
    };
  }).filter(Boolean);
}

// ── 2) CSVs semanales de Revko ───────────────────────────────────────────────
function desdeCsv(file) {
  const wb = XLSX.readFile(file, { type: 'file', cellDates: true, raw: false });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null, raw: true });
  return rows.map((r) => {
    const fecha = toISODate(r['Fecha']);
    const noParte = (toStr(r['Numero de parte']) || '').toUpperCase() || null;
    if (!fecha || !noParte) return null;
    const cantidad = toNum(r['Cantidad']);
    const precio = toNum(r['precio_venta_antes_IVA']);
    const descuento = toNum(r['Descuento'] ?? r['descuento']) || 0;
    let neto = toNum(r['total_venta_antes_IVA']);
    if (neto == null && cantidad != null && precio != null) neto = Math.round((cantidad * precio - descuento) * 10000) / 10000;
    return {
      cliente: 'dicotech', fecha, marca: toStr(r['Marca']), no_parte: noParte, descripcion: toStr(r['Descripcion']),
      cantidad, precio, descuento: 0, iva: 0, subtotal: neto, total: neto,
      row_hash: hashVentaRevko({ folio: toStr(r['Venta']), sku: noParte, fecha, cantidad, precio }),
    };
  }).filter(Boolean);
}

const dl = path.join(os.homedir(), 'Downloads');
const csvs = fs.readdirSync(dl)
  .filter((f) => /^Reporte-SellOut_Ventas Semanal Acteck_Revko.*\.csv$/.test(f))
  .map((f) => path.join(dl, f))
  .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);

const gen = await desdeGeneral();
console.log(`sellout_general 2026-05-01→05-17: ${gen.length} filas`);
if (!DRY) await upsert(dedup(gen));

let total = 0;
for (const f of csvs) {
  const rows = dedup(desdeCsv(f));
  const fechas = rows.map((r) => r.fecha).sort();
  console.log(`${path.basename(f)}: ${rows.length} filas · ${fechas[0]} → ${fechas[fechas.length - 1]}`);
  if (!DRY) await upsert(rows);
  total += rows.length;
}
console.log(`\nTotal CSV: ${total} filas (dedup en destino por row_hash determinista)${DRY ? ' · DRY RUN' : ''}`);
