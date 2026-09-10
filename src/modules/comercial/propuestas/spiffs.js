// spiffs.js — carga del Excel de SPIFFs (parser + replace vía /api/import-central). Extraído de PropuestasTab.jsx.
// Layout del Excel: fila 1 = título con total, fila 2 = headers, fila 3+ = data.
// Headers esperados (col B..H): Articulo · Descripcion 1 · Situación · Valor Spiff x Unidad MXN · Spiff Total · Inv Total · Transito.
import { supabase } from '../../../lib/supabase';

export async function parseSpiffsExcel(file) {
  const mod = await import('xlsx-js-style');
  const XLSX = mod.default || mod;
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const sh = wb.Sheets[wb.SheetNames[0]];
  if (!sh) throw new Error('El archivo está vacío');
  const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: null });
  const out = [];
  for (const r of rows.slice(2)) {
    const sku = r?.[0] ? String(r[0]).trim() : null;
    const monto = Number(r?.[3]);
    if (!sku || !monto || monto <= 0) continue;
    out.push({ sku, descripcion: r?.[1] ? String(r[1]).trim() : null, situacion: r?.[2] ? String(r[2]).trim() : null, monto });
  }
  if (out.length === 0) throw new Error('No se encontraron filas válidas (columnas B=SKU, E=Valor Spiff)');
  return out;
}

// "Spiff Q1 2026" → 01-ene a 31-mar 2026 · fallback: mes actual completo.
export function inferVigenciaFromFilename(name) {
  const m = /Q([1-4])[\s_-]*(\d{4})/i.exec(name || '');
  if (m) {
    const q = parseInt(m[1]), anio = parseInt(m[2]);
    const mesIni = (q - 1) * 3 + 1, mesFin = q * 3;
    const finDia = new Date(anio, mesFin, 0).getDate();
    return { inicio: `${anio}-${String(mesIni).padStart(2, '0')}-01`, fin: `${anio}-${String(mesFin).padStart(2, '0')}-${String(finDia).padStart(2, '0')}` };
  }
  const hoy = new Date();
  const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  return {
    inicio: `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`,
    fin: `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, '0')}-${String(fin.getDate()).padStart(2, '0')}`,
  };
}

export async function subirSpiffs(spiffs, { vigencia_inicio, vigencia_fin, fuente }) {
  const rows = spiffs.map((s) => ({ ...s, vigencia_inicio, vigencia_fin, fuente }));
  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token;
  if (!token) throw new Error('No hay sesión activa');
  const res = await fetch('/api/import-central', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ table: 'spiffs', rows, _replaceAll: true }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

export async function borrarSpiffsExistentes() {
  const { data: sess } = await supabase.auth.getSession();
  if (!sess?.session?.access_token) return;
  await supabase.from('spiffs').delete().gte('id', 0);
}

/** Flujo completo del botón "Excel de SPIFFs": parse → replace → resumen para el toast. */
export async function cargarExcelSpiffs(file) {
  const spiffs = await parseSpiffsExcel(file);
  const { inicio, fin } = inferVigenciaFromFilename(file.name);
  await borrarSpiffsExistentes();
  await subirSpiffs(spiffs, { vigencia_inicio: inicio, vigencia_fin: fin, fuente: file.name });
  return { n: spiffs.length, inicio, fin };
}
