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

// ─── Disposiciones de paneles (layouts con nombre) ───
// Cada disposición es una rejilla CSS con `grid-template-areas`; cada hueco (slot) lleva una
// pantalla independiente. El slot 0 (área "a") es SIEMPRE la pestaña activa de la app.
//   uno · dos · tres · dosArriba1Lado · unoLado2Derecha · unoArriba2Abajo · cuatro
export const LETRAS_SLOT = ['a', 'b', 'c', 'd'];

/** Ancho mínimo por columna y alto mínimo por fila para que una disposición sea usable. */
export const MIN_ANCHO_SLOT = 900;
export const MIN_ALTO_SLOT = 420;

export const DISPOSICIONES = [
  { id: 'uno',             nombre: 'Una pantalla',     descripcion: 'Como siempre: una sola pantalla a todo lo ancho.', areas: [['a']] },
  { id: 'dos',             nombre: 'Comparativa',      descripcion: 'Dos pantallas lado a lado.',                        areas: [['a', 'b']] },
  { id: 'tres',            nombre: 'Tres en fila',     descripcion: 'Tres pantallas lado a lado.',                       areas: [['a', 'b', 'c']] },
  { id: 'dosArriba1Lado',  nombre: 'Dos y una alta',   descripcion: 'Dos apiladas a la izquierda y una alta a la derecha.', areas: [['a', 'c'], ['b', 'c']] },
  { id: 'unoLado2Derecha', nombre: 'Una alta y dos',   descripcion: 'Una alta a la izquierda y dos apiladas a la derecha.', areas: [['a', 'b'], ['a', 'c']] },
  { id: 'unoArriba2Abajo', nombre: 'Una arriba, dos abajo', descripcion: 'Una ancha arriba y dos abajo.',                 areas: [['a', 'a'], ['b', 'c']] },
  { id: 'cuatro',          nombre: '4 puestos',        descripcion: 'Cuatro pantallas en rejilla 2 × 2.',                 areas: [['a', 'b'], ['c', 'd']] },
].map((d) => {
  const filas = d.areas.length;
  const cols = d.areas[0].length;
  const letras = [...new Set(d.areas.flat())];
  return {
    ...d,
    filas,
    cols,
    slots: letras.length,
    gridTemplateAreas: d.areas.map((f) => `"${f.join(' ')}"`).join(' '),
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${filas}, minmax(0, 1fr))`,
  };
});

export const DISPOSICION_POR_ID = Object.fromEntries(DISPOSICIONES.map((d) => [d.id, d]));
export const DISPOSICION_DEFECTO = 'uno';
export const PANELES_VACIO = { disposicion: DISPOSICION_DEFECTO, slots: [] };

/** Rectángulos normalizados (0..1) de cada slot: los usan los pictogramas del selector. */
export function rectosDisposicion(id) {
  const d = DISPOSICION_POR_ID[id];
  if (!d) return [];
  return LETRAS_SLOT.slice(0, d.slots).map((letra) => {
    let f0 = Infinity; let f1 = -1; let c0 = Infinity; let c1 = -1;
    d.areas.forEach((fila, f) => fila.forEach((celda, c) => {
      if (celda !== letra) return;
      f0 = Math.min(f0, f); f1 = Math.max(f1, f); c0 = Math.min(c0, c); c1 = Math.max(c1, c);
    }));
    return { x: c0 / d.cols, y: f0 / d.filas, w: (c1 - c0 + 1) / d.cols, h: (f1 - f0 + 1) / d.filas };
  });
}

/** Fila/columna (0-based) donde empieza un slot. Sirve para elegir ▲▼ vs ◀▶ al moverlo. */
export function posicionSlot(id, i) {
  const r = rectosDisposicion(id)[i];
  const d = DISPOSICION_POR_ID[id];
  if (!r || !d) return { fila: 0, col: 0 };
  return { fila: Math.round(r.y * d.filas), col: Math.round(r.x * d.cols) };
}

/** ¿Cabe esta disposición en este monitor? Devuelve también el porqué cuando no. */
export function disposicionDisponible(id, { ancho, alto } = {}) {
  const d = DISPOSICION_POR_ID[id];
  if (!d) return { disponible: false, razon: 'Esa disposición no existe.' };
  if (d.slots <= 1) return { disponible: true, razon: '' };
  const w = Number(ancho) || 0;
  const h = Number(alto) || 0;
  if (d.cols > 1 && w / d.cols < MIN_ANCHO_SLOT) {
    return { disponible: false, razon: `Cada panel necesita ${MIN_ANCHO_SLOT} px de ancho: en ${w || '?'} px sólo caben ${Math.max(1, Math.floor(w / MIN_ANCHO_SLOT))} en fila.` };
  }
  if (d.filas > 1 && h / d.filas < MIN_ALTO_SLOT) {
    return { disponible: false, razon: `Los paneles apilados piden ${MIN_ALTO_SLOT} px de alto cada uno: tu pantalla mide ${h || '?'} px.` };
  }
  return { disponible: true, razon: '' };
}

/** Todas las disposiciones, marcadas con `disponible` y `razon`. */
export function disposicionesDisponibles(medidas) {
  return DISPOSICIONES.map((d) => ({ ...d, ...disposicionDisponible(d.id, medidas) }));
}

/** Si la elegida no cabe, la mayor que sí quepa sin pasarse de huecos. */
export function disposicionEfectiva(id, medidas) {
  if (disposicionDisponible(id, medidas).disponible) return id;
  const quiere = DISPOSICION_POR_ID[id]?.slots || 1;
  const cand = DISPOSICIONES
    .filter((d) => d.slots <= quiere && disposicionDisponible(d.id, medidas).disponible)
    .sort((a, b) => b.slots - a.slots);
  return cand[0]?.id || DISPOSICION_DEFECTO;
}

/** La disposición con `n` huecos que mejor quepa aquí (para cerrar un panel). */
export function disposicionParaSlots(n, medidas) {
  const exacta = DISPOSICIONES.find((d) => d.slots === n && disposicionDisponible(d.id, medidas).disponible);
  if (exacta) return exacta.id;
  const menor = DISPOSICIONES
    .filter((d) => d.slots <= n && disposicionDisponible(d.id, medidas).disponible)
    .sort((a, b) => b.slots - a.slots);
  return menor[0]?.id || DISPOSICION_DEFECTO;
}

const POR_LARGO = { 1: 'uno', 2: 'dos', 3: 'tres', 4: 'cuatro' };

/**
 * Forma canónica de la preferencia `paneles`. Acepta lo viejo (array de columnas, hasta la
 * versión de "1·2·3·4 columnas") y lo nuevo (`{ disposicion, slots }`). Nunca lanza.
 */
export function migrarPaneles(valor) {
  if (Array.isArray(valor)) {
    const n = valor.length;
    if (n < 2) return { disposicion: DISPOSICION_DEFECTO, slots: [] };
    const id = POR_LARGO[Math.min(4, n)] || 'cuatro';
    return { disposicion: id, slots: normalizarPaneles(valor, DISPOSICION_POR_ID[id].slots) };
  }
  if (valor && typeof valor === 'object') {
    const id = DISPOSICION_POR_ID[valor.disposicion] ? valor.disposicion : DISPOSICION_DEFECTO;
    const d = DISPOSICION_POR_ID[id];
    if (d.slots <= 1) return { disposicion: DISPOSICION_DEFECTO, slots: [] };
    return { disposicion: id, slots: normalizarPaneles(Array.isArray(valor.slots) ? valor.slots : [], d.slots) };
  }
  return { disposicion: DISPOSICION_DEFECTO, slots: [] };
}

/** Lo que de verdad se pinta en este monitor: migrado, recortado a lo que cabe y relleno. */
export function panelesEfectivos(valor, medidas) {
  const base = migrarPaneles(valor);
  const id = disposicionEfectiva(base.disposicion, medidas);
  const d = DISPOSICION_POR_ID[id] || DISPOSICION_POR_ID[DISPOSICION_DEFECTO];
  if (d.slots <= 1) return { disposicion: DISPOSICION_DEFECTO, slots: [] };
  return { disposicion: id, slots: normalizarPaneles(base.slots, d.slots) };
}

/** Intercambia dos huecos. Devuelve un array nuevo; si los índices no valen, deja todo igual. */
export function intercambiarSlots(slots, i, j) {
  const l = Array.isArray(slots) ? slots.slice() : [];
  if (i === j || !l[i] || !l[j]) return l;
  const t = l[i]; l[i] = l[j]; l[j] = t;
  return l;
}

// ─── Preferencias por modo ───
// `vidrio` ∈ opaco | tintado | vidrio (ver src/lib/vidrio.js). 'opaco' = el chrome de siempre.
export const NIVELES_VIDRIO_IDS = ['opaco', 'tintado', 'vidrio'];
export const DEFAULTS_DISPOSITIVO = {
  telefono:        { densidad: 'comoda',  sidebar: 'completa', anchoMax: 1600, paneles: PANELES_VACIO, vidrio: 'opaco' },
  tabletaCompacta: { densidad: 'comoda',  sidebar: 'iconos',   anchoMax: 1600, paneles: PANELES_VACIO, vidrio: 'opaco' },
  tableta:         { densidad: 'comoda',  sidebar: 'iconos',   anchoMax: 1600, paneles: PANELES_VACIO, vidrio: 'opaco' },
  laptop:          { densidad: 'comoda',  sidebar: 'completa', anchoMax: 1600, paneles: PANELES_VACIO, vidrio: 'opaco' },
  panoramico:      { densidad: 'comoda',  sidebar: 'completa', anchoMax: 1600, paneles: PANELES_VACIO, vidrio: 'opaco' },
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
  p.paneles = migrarPaneles(p.paneles);
  if (!['comoda', 'compacta'].includes(p.densidad)) p.densidad = base.densidad;
  if (!['completa', 'iconos'].includes(p.sidebar)) p.sidebar = base.sidebar;
  if (!NIVELES_VIDRIO_IDS.includes(p.vidrio)) p.vidrio = base.vidrio;
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
