// src/lib/format.js — fuente única de formato (V3).
//
// Reglas:
//   - Todo número nulo / NaN / no finito se muestra como '—' (nunca "NaN" ni "$NaN").
//   - Moneda siempre MXN, es-MX, sin decimales.
//   - Fechas de entrada en ISO ('YYYY-MM-DD' o 'YYYY-MM-DDTHH:mm:ssZ'); nunca se
//     construyen con `new Date('YYYY-MM-DD')` para evitar el corrimiento de zona horaria.
//
// `formatMXN` y `formatFecha` se reexportan de utils.js para compatibilidad: las
// pantallas existentes siguen importándolos de '../../lib/utils' hasta que se migren.
// Ver docs/LIMPIEZA_V3.md → "Helpers de formato duplicados" para la lista pendiente.

export { formatMXN, formatFecha } from './utils.js';

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_TITULO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const NUM_MXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const NUM_INT = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

const esNumero = (n) => typeof n === 'number' ? Number.isFinite(n) : (n != null && n !== '' && Number.isFinite(Number(n)));
const aNumero = (n) => (typeof n === 'number' ? n : Number(n));

/** $1,234,567 — MXN sin decimales. Nulo/NaN → '—'. */
export function money(n) {
  if (!esNumero(n)) return '—';
  return NUM_MXN.format(aNumero(n));
}

/** $1.2M · $820K · $950 — para KPIs y ejes. Nulo/NaN → '—'. 0 → '$0'. */
export function moneyCompact(n) {
  if (!esNumero(n)) return '—';
  const v = aNumero(n);
  const a = Math.abs(v);
  const s = v < 0 ? '-' : '';
  if (a >= 1e9) return `${s}$${trimDec((a / 1e9).toFixed(1))}B`;
  if (a >= 1e6) return `${s}$${trimDec((a / 1e6).toFixed(1))}M`;
  if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}K`;
  return `${s}$${Math.round(a)}`;
}

/** 1,234,567 — entero con separador de miles es-MX. Nulo/NaN → '—'. */
export function int(n) {
  if (!esNumero(n)) return '—';
  return NUM_INT.format(Math.round(aNumero(n)));
}

/** 12.3% — `n` ya viene en puntos porcentuales (12.3, no 0.123). `d` decimales. */
export function pct(n, d = 1) {
  if (!esNumero(n)) return '—';
  return `${aNumero(n).toFixed(d)}%`;
}

/** +2.5 pp / -0.8 pp — diferencia en puntos porcentuales, con signo explícito. */
export function pp(n, d = 1) {
  if (!esNumero(n)) return '—';
  const v = aNumero(n);
  const s = v > 0 ? '+' : '';
  return `${s}${v.toFixed(d)} pp`;
}

/** '2026-09-09' → '09 Sep 2026'. Acepta ISO con hora. Nulo → '—'. */
export function fecha(iso) {
  const p = partesISO(iso);
  if (!p) return '—';
  return `${String(p.d).padStart(2, '0')} ${MESES_TITULO[p.m - 1]} ${p.y}`;
}

/** '2026-09-09' → '9 sep'. Nulo → '—'. */
export function fechaCorta(iso) {
  const p = partesISO(iso);
  if (!p) return '—';
  return `${p.d} ${MESES_CORTOS[p.m - 1]}`;
}

/**
 * 'hace 2 h' · 'hace 5 min' · 'ahora' · 'hace 3 d' · 'en 2 h' (fechas futuras).
 * `ahora` se puede inyectar para pruebas.
 */
export function relativo(iso, ahora = Date.now()) {
  if (!iso) return '—';
  const t = typeof iso === 'number' ? iso : Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  const diff = ahora - t;
  const futuro = diff < 0;
  const abs = Math.abs(diff);
  const seg = Math.round(abs / 1000);
  let txt;
  if (seg < 45) return 'ahora';
  else if (seg < 3600) txt = `${Math.round(seg / 60)} min`;
  else if (seg < 86400) txt = `${Math.round(seg / 3600)} h`;
  else if (seg < 86400 * 30) txt = `${Math.round(seg / 86400)} d`;
  else if (seg < 86400 * 365) txt = `${Math.round(seg / (86400 * 30))} mes${Math.round(seg / (86400 * 30)) === 1 ? '' : 'es'}`;
  else { const a = Math.round(seg / (86400 * 365)); txt = `${a} año${a === 1 ? '' : 's'}`; }
  return futuro ? `en ${txt}` : `hace ${txt}`;
}

// ────────── internos ──────────

function trimDec(s) {
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}

/** Extrae { y, m, d } de 'YYYY-MM-DD…' sin pasar por Date (sin corrimiento de TZ). */
function partesISO(iso) {
  if (!iso) return null;
  if (iso instanceof Date) {
    if (Number.isNaN(iso.getTime())) return null;
    return { y: iso.getFullYear(), m: iso.getMonth() + 1, d: iso.getDate() };
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (!m) return null;
  const y = Number(m[1]), mm = Number(m[2]), d = Number(m[3]);
  if (mm < 1 || mm > 12 || d < 1 || d > 31) return null;
  return { y, m: mm, d };
}
