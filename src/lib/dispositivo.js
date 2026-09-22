// Dispositivo · un solo lugar decide "en qué tipo de pantalla estoy" y guarda las
// preferencias de esa pantalla (no del usuario: viven en localStorage, por máquina).
//
//   const { modo, ancho, alto, touch, orientacion } = useDispositivo();
//   const prefs = usePrefsDispositivo();            // prefs del modo actual, ya con defaults
//   setPrefDispositivo('panoramico', 'anchoMax', 1900);
//
// Modos (el ancho manda; el táctil sólo desempata las tabletas):
//   telefono         < 700
//   tabletaCompacta  700–899  ·  y 900–1099 táctil en vertical (iPad mini)
//   tableta          900–1279 táctil
//   laptop           900–1279 sin táctil  ·  1280–1899
//   panoramico       ≥ 1900 (monitores de 27" a 49")
//
// OJO: este módulo NO decide si se monta la app móvil (eso sigue en useMobileShell,
// con la misma semántica de siempre). Sólo adapta el shell web y las pantallas.
import { useEffect, useSyncExternalStore } from 'react';

export const MODOS = ['telefono', 'tabletaCompacta', 'tableta', 'laptop', 'panoramico'];

// ─── Detección (pura, testeable) ───
export function modoDe({ ancho, alto = 0, touch = false } = {}) {
  const w = Number(ancho);
  if (!Number.isFinite(w) || w <= 0) return 'laptop';
  if (w < 700) return 'telefono';
  if (w < 900) return 'tabletaCompacta';
  if (w < 1100 && touch && alto > w) return 'tabletaCompacta'; // iPad mini en vertical
  if (w < 1280) return touch ? 'tableta' : 'laptop';
  if (w < 1900) return 'laptop';
  return 'panoramico';
}

export const orientacionDe = ({ ancho = 0, alto = 0 } = {}) => (ancho >= alto ? 'horizontal' : 'vertical');

/** Columnas de paneles que caben: mínimo 900 px por columna, máximo 4. */
export function maxColumnas(ancho) {
  const w = Number(ancho);
  if (!Number.isFinite(w)) return 1;
  return Math.max(1, Math.min(4, Math.floor(w / 900)));
}

// ─── Preferencias por modo ───
export const DEFAULTS_DISPOSITIVO = {
  telefono:        { densidad: 'comoda',  sidebar: 'completa', anchoMax: 1600, paneles: [] },
  tabletaCompacta: { densidad: 'comoda',  sidebar: 'iconos',   anchoMax: 1600, paneles: [] },
  tableta:         { densidad: 'comoda',  sidebar: 'iconos',   anchoMax: 1600, paneles: [] },
  laptop:          { densidad: 'comoda',  sidebar: 'completa', anchoMax: 1600, paneles: [] },
  panoramico:      { densidad: 'comoda',  sidebar: 'completa', anchoMax: 1600, paneles: [] },
};

export const ANCHOS_MAX = [
  { id: 1400, label: '1400' },
  { id: 1600, label: '1600' },
  { id: 1900, label: '1900' },
  { id: 0,    label: 'Todo' }, // 0 = sin tope
];

export const LS_DISPOSITIVO = 'disp_prefs_v1';

const almacenPorDefecto = () => {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
};

function leerCrudo(st) {
  const s = st || almacenPorDefecto();
  if (!s) return {};
  try { const raw = s.getItem(LS_DISPOSITIVO); const o = raw ? JSON.parse(raw) : null; return o && typeof o === 'object' ? o : {}; }
  catch { return {}; }
}
function escribirCrudo(todo, st) {
  const s = st || almacenPorDefecto();
  if (!s) return;
  try { s.setItem(LS_DISPOSITIVO, JSON.stringify(todo)); } catch { /* modo privado */ }
}

/** Prefs de un modo, ya mezcladas con sus defaults. Nunca devuelve undefined. */
export function leerPrefsDispositivo(modo, st) {
  const base = DEFAULTS_DISPOSITIVO[modo] || DEFAULTS_DISPOSITIVO.laptop;
  const guardado = leerCrudo(st)[modo];
  const p = { ...base, ...(guardado && typeof guardado === 'object' ? guardado : {}) };
  if (!Array.isArray(p.paneles)) p.paneles = [];
  if (!['comoda', 'compacta'].includes(p.densidad)) p.densidad = base.densidad;
  if (!['completa', 'iconos'].includes(p.sidebar)) p.sidebar = base.sidebar;
  if (!Number.isFinite(Number(p.anchoMax))) p.anchoMax = base.anchoMax;
  else p.anchoMax = Number(p.anchoMax);
  return p;
}

const listeners = new Set();
const emitir = () => listeners.forEach((l) => l());
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };

/** Guarda una preferencia del modo indicado (y avisa a los hooks). */
export function setPrefDispositivo(modo, clave, valor, st) {
  const todo = leerCrudo(st);
  todo[modo] = { ...(todo[modo] || {}), [clave]: valor };
  escribirCrudo(todo, st);
  emitir();
  return leerPrefsDispositivo(modo, st);
}

/** Normaliza la lista de paneles a `n` columnas (rellena con Inicio y recorta). */
export function normalizarPaneles(paneles, n, relleno = { pagina: 'inicio', clienteKey: null }) {
  const lista = Array.isArray(paneles) ? paneles : [];
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const p = lista[i];
    out.push(p && typeof p === 'object' && p.pagina
      ? { pagina: String(p.pagina), clienteKey: p.clienteKey || null }
      : { ...relleno });
  }
  return out;
}

// ─── Hooks ───
const medir = () => {
  if (typeof window === 'undefined') return { ancho: 1440, alto: 900, touch: false };
  let touch = false;
  try { touch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches); } catch { touch = false; }
  return { ancho: window.innerWidth || 1440, alto: window.innerHeight || 900, touch };
};

let medida = medir();
let clave = `${medida.ancho}x${medida.alto}x${medida.touch}`;
let instantanea = { ...medida, modo: modoDe(medida), orientacion: orientacionDe(medida) };
const listenersDisp = new Set();
const subDisp = (l) => { listenersDisp.add(l); return () => listenersDisp.delete(l); };
const snapDisp = () => instantanea;

function recalcular() {
  const m = medir();
  const k = `${m.ancho}x${m.alto}x${m.touch}`;
  if (k === clave) return;
  clave = k;
  instantanea = { ...m, modo: modoDe(m), orientacion: orientacionDe(m) };
  listenersDisp.forEach((l) => l());
}

let escuchando = false;
function escuchar() {
  if (escuchando || typeof window === 'undefined') return;
  escuchando = true;
  window.addEventListener('resize', recalcular);
  window.addEventListener('orientationchange', recalcular);
}

export function useDispositivo() {
  useEffect(() => { escuchar(); recalcular(); }, []);
  return useSyncExternalStore(subDisp, snapDisp, snapDisp);
}

let version = 0;
const verSnapshot = () => version;
listeners.add(() => { version += 1; });

/** Prefs del modo actual (reactivas a setPrefDispositivo y al cambio de modo). */
export function usePrefsDispositivo(modoForzado) {
  const { modo } = useDispositivo();
  const m = modoForzado || modo;
  useSyncExternalStore(subscribe, verSnapshot, verSnapshot); // re-render al guardar una pref
  return leerPrefsDispositivo(m);
}

// ─── Variables CSS de densidad ───
// Las consumen Panel, KpiCard y TablaCompacta del kit; sin ellas todo queda como estaba.
export const VARS_DENSIDAD = {
  comoda:   { '--densidad': 'comoda',   '--dens-panel-pad': '10px 12px', '--dens-kpi-pad': '12px 14px', '--dens-fila-pad': '5px 8px' },
  compacta: { '--densidad': 'compacta', '--dens-panel-pad': '7px 10px',  '--dens-kpi-pad': '9px 12px',  '--dens-fila-pad': '3px 7px' },
};

export function aplicarDensidad(densidad) {
  if (typeof document === 'undefined') return;
  const raiz = document.documentElement;
  if (!raiz || !raiz.style || typeof raiz.style.setProperty !== 'function') return;
  const vars = VARS_DENSIDAD[densidad] || VARS_DENSIDAD.comoda;
  Object.entries(vars).forEach(([k, v]) => raiz.style.setProperty(k, v));
}
