// Helpers compartidos del puente. Mismas reglas que uploads.html / xlsx-stream.js.
export const num = (v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/[$,\s]/g, ''));
  return Number.isNaN(n) ? null : n;
};
export const int = (v) => { const n = num(v); return n == null ? null : Math.trunc(n); };
export const txt = (v) => (v == null ? null : String(v).trim() || null);

/** Date (mssql) | 'YYYY-MM-DD…' | 'DD/MM/YYYY' | serial Excel → 'YYYY-MM-DD' */
export const isoDate = (v) => {
  if (v == null || v === '') return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    // mssql entrega DATE/DATETIME en hora local (useUTC=false): tomar componentes locales.
    const y = v.getFullYear(), m = String(v.getMonth() + 1).padStart(2, '0'), d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400) * 1000);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

export const snake = (s) => String(s || '').trim().toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/** Acceso a columnas sin importar mayúsculas/acentos: row.get('MontoVentaPesos'). */
export function rowAccessor(row) {
  const map = new Map();
  for (const k of Object.keys(row)) map.set(snake(k), row[k]);
  return (...names) => {
    for (const n of names) { const v = map.get(snake(n)); if (v !== undefined) return v; }
    return undefined;
  };
}

export function log(...a) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(ts, ...a);
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
