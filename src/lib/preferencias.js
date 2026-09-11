// Preferencias de UI por usuario · store mínimo compartido (sin provider).
//
//   const { prefs, setPreferencia, favoritos, toggleFavorito } = usePreferencias();
//   setPreferencia('menu.modo', 'barra');
//
// Fuente de verdad: perfiles.preferencias (jsonb) → se hidrata al entrar el perfil.
// Antes del login (o si Supabase falla) vive en localStorage (`prefs_ui_v1`).
// Escritura: optimista en memoria + localStorage, y RPC `set_preferencias`
// (SECURITY DEFINER, sólo la fila propia; ver migración 20260911_perfiles_preferencias.sql).
import { useEffect, useSyncExternalStore, useCallback } from 'react';
import { supabase, DB_CONFIGURED } from './supabase';
import { usePerfil } from './perfilContext';

export const MODOS_MENU = [
  { id: 'barra',   label: 'Barra',   desc: 'Barra superior con mega-menú. Sin sidebar.' },
  { id: 'sidebar', label: 'Sidebar', desc: 'Sidebar translúcida estilo iPad, colapsable.' },
  { id: 'iphone',  label: 'iPhone',  desc: 'Barra inferior flotante con hojas.' },
];

// Menú de la app móvil (src/movil): cajón lateral desde la izquierda o barra inferior por grupos.
export const MODOS_MENU_MOVIL = [
  { id: 'cajon', label: 'Cajón', desc: '☰ abre un cajón lateral con el árbol completo.' },
  { id: 'barra', label: 'Barra', desc: 'Barra inferior: Inicio · General · Comercial · Clientes · Interno.' },
];

// Agenda: disposición de la pestaña (A Bandeja Hoy · C Tablero por etiqueta). Se elige en Preferencias como el menú.
export const MODOS_AGENDA = [
  { id: 'bandeja', label: 'Bandeja', desc: 'Lista de hoy: vencidas, hoy y próximos; calendario y equipo al lado.' },
  { id: 'tablero', label: 'Tablero', desc: 'Columnas por cliente, persona, categoría o estado; tarjetas que se arrastran.' },
];

export const PREFS_DEFAULT = {
  menu: { modo: 'sidebar', modoMovil: 'cajon', favoritos: ['inicio'], densidad: 'comoda', inicio: 'inicio' },
  agenda: { modo: 'bandeja' },
};

const LS_KEY = 'prefs_ui_v1';

const esObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
function merge(base, extra) {
  if (!esObj(extra)) return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(extra)) {
    out[k] = esObj(v) && esObj(base?.[k]) ? merge(base[k], v) : v;
  }
  return out;
}
function leerLocal() {
  try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function guardarLocal(p) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch {}
}
function setPath(obj, path, valor) {
  const keys = path.split('.');
  const out = { ...obj };
  let cur = out;
  keys.forEach((k, i) => {
    if (i === keys.length - 1) cur[k] = valor;
    else { cur[k] = esObj(cur[k]) ? { ...cur[k] } : {}; cur = cur[k]; }
  });
  return out;
}
export function getPath(obj, path, fallback) {
  const v = path.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
  return v === undefined ? fallback : v;
}

// ─── Store ───
let estado = merge(PREFS_DEFAULT, leerLocal());
let userIdHidratado = null;
const listeners = new Set();
const emitir = () => listeners.forEach((l) => l());
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
const getSnapshot = () => estado;

let timerRemoto = null;
let pendienteRemoto = null;
function persistirRemoto(userId, prefs) {
  if (!DB_CONFIGURED || !userId) return;
  pendienteRemoto = prefs;
  if (timerRemoto) clearTimeout(timerRemoto);
  timerRemoto = setTimeout(async () => {
    const p = pendienteRemoto; pendienteRemoto = null; timerRemoto = null;
    try {
      const { error } = await supabase.rpc('set_preferencias', { p_preferencias: p });
      if (error) console.warn('[preferencias] no se pudo guardar en Supabase:', error.message);
    } catch (e) { console.warn('[preferencias] error al guardar:', e?.message || e); }
  }, 400);
}

export function hidratarPreferencias(perfil) {
  const uid = perfil?.user_id || null;
  if (uid && uid === userIdHidratado) return;
  userIdHidratado = uid;
  if (!uid) return;
  // El perfil manda; lo local sólo rellena huecos (p. ej. usuario nuevo sin preferencias).
  const remotas = esObj(perfil?.preferencias) ? perfil.preferencias : {};
  estado = merge(merge(PREFS_DEFAULT, leerLocal()), remotas);
  guardarLocal(estado);
  emitir();
}

export function setPreferencia(path, valor) {
  estado = setPath(estado, path, valor);
  guardarLocal(estado);
  emitir();
  persistirRemoto(userIdHidratado, estado);
}

export function getPreferencias() { return estado; }

// ─── Hook ───
export function usePreferencias() {
  const perfil = usePerfil();
  useEffect(() => { hidratarPreferencias(perfil); }, [perfil]);
  const prefs = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const menu = { ...PREFS_DEFAULT.menu, ...(prefs.menu || {}) };
  const favoritos = Array.isArray(menu.favoritos) ? menu.favoritos : PREFS_DEFAULT.menu.favoritos;

  const toggleFavorito = useCallback((id) => {
    const actual = getPath(estado, 'menu.favoritos', PREFS_DEFAULT.menu.favoritos);
    const next = actual.includes(id) ? actual.filter((x) => x !== id) : [...actual, id];
    setPreferencia('menu.favoritos', next);
  }, []);

  const moverFavorito = useCallback((id, dir) => {
    const actual = [...getPath(estado, 'menu.favoritos', PREFS_DEFAULT.menu.favoritos)];
    const i = actual.indexOf(id); const j = i + dir;
    if (i < 0 || j < 0 || j >= actual.length) return;
    [actual[i], actual[j]] = [actual[j], actual[i]];
    setPreferencia('menu.favoritos', actual);
  }, []);

  return { prefs, menu, favoritos, setPreferencia, toggleFavorito, moverFavorito };
}
