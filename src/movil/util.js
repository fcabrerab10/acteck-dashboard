// Utilidades de la app móvil V3 · fechas locales, saludo, formato.
export { money, moneyCompact, int, pct, fechaCorta, relativo } from '../lib/format';

export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export const N = (v) => Number(v) || 0;

/** Fecha local del dispositivo como 'YYYY-MM-DD' (sin corrimiento UTC). */
export function hoyISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function saludo(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

/** 'miércoles 10 de septiembre' */
export function diaLargo(d = new Date()) {
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES_LARGO[d.getMonth()]}`;
}

export const nombreCorto = (perfil) => String(perfil?.nombre || perfil?.email || '').trim().split(/\s+/)[0] || '';

/** +12.3% / -4.0% con signo. */
export function deltaPct(v, d = 0) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  return `${n > 0 ? '+' : ''}${n.toFixed(d)}%`;
}

export const tonoCuota = (p) => (p == null ? 'gray' : p >= 100 ? 'green' : p >= 85 ? 'blue' : 'orange');
export const tonoDelta = (v) => (v == null ? 'gray' : v >= 0 ? 'green' : 'red');

/** Recientes en localStorage (lista corta, sin duplicados). */
export function leerLS(key, fallback = []) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
export function guardarLS(key, valor) {
  try { localStorage.setItem(key, JSON.stringify(valor)); } catch { /* sin storage */ }
}

/** Fila de lista con tres estados comunes. */
export const MONO = '"SF Mono", ui-monospace, Menlo, monospace';
