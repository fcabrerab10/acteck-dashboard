// Helpers compartidos por los parsers de fuentes manuales (misma semántica que
// public/uploads.html y bridge/lib/util.mjs). SheetJS se carga bajo demanda con
// loadSheetJS() de src/lib/utils.js: NUNCA importarlo estático.
import { loadSheetJS } from '../utils';

export const XLSX = () => {
  if (typeof window === 'undefined' || !window.XLSX) throw new Error('SheetJS no está cargado: usa leerWorkbook() antes de parsear');
  return window.XLSX;
};

/** Lee un File (xlsx/xls/csv) y devuelve el workbook de SheetJS. */
export async function leerWorkbook(file) {
  const X = await loadSheetJS();
  const buf = await file.arrayBuffer();
  return X.read(buf, { type: 'array', cellDates: true, cellStyles: false, cellHTML: false, cellFormula: false, bookVBA: false });
}

export function toISODate(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(d) ? null : d.toISOString().slice(0, 10);
  }
  const d = new Date(v);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}
export function toNum(v) { if (v == null || v === '' || v === '#N/A') return null; const n = Number(v); return isNaN(n) ? null : n; }
export function toInt(v) { const n = toNum(v); return n == null ? null : Math.round(n); }
export function toStr(v) { if (v == null) return null; const s = String(v).trim(); return s === '' || s === '#N/A' ? null : s; }
export function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; } return String(h); }
export function snake(s) { return String(s).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); }
export const norm = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** { Columna Con Acentos: v } → { columna_con_acentos: v } */
export function objSnake(r) { const o = {}; for (const k of Object.keys(r)) o[snake(k)] = r[k]; return o; }

/** Semana "de calendario" que usan los snapshots de inventario (misma fórmula que uploads.html). */
export function semanaSnapshot(now = new Date()) {
  const anio = now.getFullYear();
  const jan1 = new Date(anio, 0, 1);
  const days = Math.floor((now - jan1) / 86400000);
  return { anio, semana: Math.ceil((days + jan1.getDay() + 1) / 7) };
}

/**
 * Fecha del corte de un snapshot (inventario de clientes, inventario por sucursal,
 * estados de cuenta). NUNCA el día de la carga: se resuelve, en este orden,
 *   1) opts.fechaCorte — la que el usuario eligió en el importador
 *   2) una fecha en el nombre del archivo (YYYY-MM-DD, DD-MM-YYYY, DD.MM.YY…)
 *   3) opts.fechaArchivo — file.lastModified (el día en que se descargó el corte)
 *   4) fechasDatos — la fecha máxima razonable de los propios datos
 * Si no se puede resolver ninguna, lanza: el importador pide la semana al usuario.
 */
export function fechaDeCorte(opts = {}, { fileName = '', fechasDatos = [] } = {}) {
  const limpia = (v) => { const d = v instanceof Date ? v : new Date(v); return isNaN(d) ? null : d; };
  if (opts.fechaCorte) { const d = limpia(opts.fechaCorte); if (d) return { fecha: d, origen: 'elegida' }; }
  const m = String(fileName || '').match(/(20\d{2})[-_.](\d{1,2})[-_.](\d{1,2})/) || String(fileName || '').match(/(\d{1,2})[-_.](\d{1,2})[-_.](20\d{2})/);
  if (m) {
    const [a, b, c] = m.slice(1).map(Number);
    const d = m[1].length === 4 ? new Date(Date.UTC(a, b - 1, c)) : new Date(Date.UTC(c, b - 1, a));
    if (!isNaN(d)) return { fecha: d, origen: 'nombre del archivo' };
  }
  if (opts.fechaArchivo) { const d = limpia(opts.fechaArchivo); if (d) return { fecha: d, origen: 'fecha del archivo' }; }
  const hoy = Date.now();
  const validas = fechasDatos.map(limpia).filter((d) => d && d.getTime() <= hoy).sort((x, y) => y - x);
  if (validas.length) return { fecha: validas[0], origen: 'datos del archivo' };
  throw new Error('No se pudo determinar la fecha del corte: elige la semana en el importador antes de subir el archivo.');
}

/** Año y semana ISO de una fecha (el año ISO es el del jueves de esa semana). */
export function anioSemanaISO(d) {
  const date = new Date(Date.UTC(d.getUTCFullYear?.() ?? d.getFullYear(), d.getUTCMonth?.() ?? d.getMonth(), d.getUTCDate?.() ?? d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const anio = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(anio, 0, 1));
  return { anio, semana: Math.ceil(((date - yearStart) / 86400000 + 1) / 7) };
}

/** Semana del corte: fechaDeCorte() + anioSemanaISO(). Devuelve { anio, semana, fecha, origen }. */
export function semanaDeCorte(opts = {}, ctx = {}) {
  const { fecha, origen } = fechaDeCorte(opts, ctx);
  if (opts.anio && opts.semana) return { anio: Number(opts.anio), semana: Number(opts.semana), fecha, origen: 'elegida' };
  return { ...anioSemanaISO(fecha), fecha, origen };
}

/** Semana ISO 8601 (lunes como inicio). */
export function isoWeek(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}

export const primeraHoja = (wb, ...nombres) => {
  for (const n of nombres) if (n && wb.Sheets[n]) return wb.Sheets[n];
  return wb.Sheets[wb.SheetNames[0]];
};
