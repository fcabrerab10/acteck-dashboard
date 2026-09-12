// Avatar de perfil · helpers + componente.
//
//   const { url, iniciales, colorIniciales } = useAvatar(perfil);
//   <AvatarImg perfil={perfil} size={32} />
//   const canvas = await recortarSelfie(file);            // cuadrado 1024 (o el canvas del recorte manual)
//   const { avatar_url, generado_por } = await subirSelfie(canvas, 'noche', { userId });
//
// `usePerfilVivo(perfil)` mezcla el perfil de App.jsx con cambios hechos en sesión (foto, nombre, puesto…)
// para que la UI se actualice al instante sin refetch del perfil (App.jsx no expone setPerfil).
import React, { useState, useSyncExternalStore } from 'react';
import { apiFetch } from './apiFetch';
import { useTheme } from './themeContext';
import { TYPO } from './themeTokens';

// Dónde va la cara sobre public/avatares/fondo-*.svg (1024×1024). Cambiar aquí y en los SVG a la vez.
export const COMPOSICION = { lado: 1024, cx: 512, cy: 400, r: 150 };
export const FONDOS = [
  { id: 'noche', label: 'Ciudad de noche', src: '/avatares/fondo-noche.svg' },
  { id: 'dia',   label: 'Ciudad de día',   src: '/avatares/fondo-dia.svg' },
];
export const fondoPorGenero = (genero) => (genero === 'femenino' ? 'dia' : genero === 'masculino' ? 'noche' : null);

// ─── Store de cambios locales al perfil (por user_id) ───
let overrides = {};
const listeners = new Set();
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
const snapshot = () => overrides;
export function aplicarPerfilLocal(userId, patch) {
  if (!userId || !patch) return;
  overrides = { ...overrides, [userId]: { ...(overrides[userId] || {}), ...patch } };
  listeners.forEach((l) => l());
}
export function usePerfilVivo(perfil) {
  const ov = useSyncExternalStore(subscribe, snapshot, snapshot);
  const extra = perfil?.user_id ? ov[perfil.user_id] : null;
  return extra ? { ...perfil, ...extra } : perfil;
}

// ─── Iniciales y color estable por email ───
export function inicialesDe(perfil) {
  const base = (perfil?.nombre || perfil?.email || 'U').split('@')[0];
  const partes = base.split(/[\s._-]+/).filter(Boolean);
  return partes.slice(0, 2).map((s) => s[0].toUpperCase()).join('') || 'U';
}
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
// Degradado iOS suave: dos tonos vecinos del mismo matiz, decidido por el email (siempre el mismo color).
export function colorInicialesDe(perfil) {
  const hue = hash(String(perfil?.email || perfil?.nombre || 'u').toLowerCase()) % 360;
  return `linear-gradient(135deg, hsl(${hue} 62% 58%), hsl(${(hue + 28) % 360} 66% 46%))`;
}

export function useAvatar(perfil) {
  const vivo = usePerfilVivo(perfil);
  return {
    url: vivo?.avatar_url || null,
    estado: vivo?.avatar_estado || null,
    iniciales: inicialesDe(vivo),
    colorIniciales: colorInicialesDe(vivo),
  };
}

// ─── Canvas ───
function cargarImagen(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo leer la imagen'));
    img.src = src;
  });
}
export async function archivoAImagen(file) {
  const url = URL.createObjectURL(file);
  try { return await cargarImagen(url); } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}

/** Recorte cuadrado centrado + resize a 1024. Devuelve un canvas. */
export async function recortarSelfie(file, lado = COMPOSICION.lado) {
  const img = file instanceof HTMLImageElement ? file : await archivoAImagen(file);
  const s = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - s) / 2; const sy = (img.naturalHeight - s) / 2;
  const c = document.createElement('canvas'); c.width = lado; c.height = lado;
  c.getContext('2d').drawImage(img, sx, sy, s, s, 0, 0, lado, lado);
  return c;
}

/** JPEG dataURL ≤ maxBytes (baja calidad si hace falta). */
export function canvasAJpeg(canvas, calidad = 0.9, maxBytes = 2 * 1024 * 1024) {
  let q = calidad; let out = canvas.toDataURL('image/jpeg', q);
  while (out.length * 0.75 > maxBytes && q > 0.4) { q -= 0.1; out = canvas.toDataURL('image/jpeg', q); }
  return out;
}

/** Fallback local: selfie en círculo sobre el fondo ilustrado. Devuelve PNG dataURL 1024×1024. */
export async function componerFallback(selfieCanvas, fondo = 'noche') {
  const f = FONDOS.find((x) => x.id === fondo) || FONDOS[0];
  const bg = await cargarImagen(f.src);
  const { lado, cx, cy, r } = COMPOSICION;
  const c = document.createElement('canvas'); c.width = lado; c.height = lado;
  const ctx = c.getContext('2d');
  ctx.drawImage(bg, 0, 0, lado, lado);
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
  ctx.drawImage(selfieCanvas, cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = 8; ctx.strokeStyle = fondo === 'dia' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)'; ctx.stroke();
  return c.toDataURL('image/png');
}

/**
 * Sube la selfie (canvas cuadrado o File) y pide la ilustración.
 * Compone el fallback en el cliente y lo manda también: si el servidor no tiene proveedor de IA lo usa tal cual.
 * onEstado('preparando' | 'subiendo') para la UI. Devuelve { avatar_url, generado_por }.
 */
export async function subirSelfie(fuente, fondo = 'noche', { userId, onEstado } = {}) {
  onEstado?.('preparando');
  const canvas = fuente instanceof HTMLCanvasElement ? fuente : await recortarSelfie(fuente);
  const selfie = canvasAJpeg(canvas, 0.9);
  const avatar = await componerFallback(canvas, fondo);
  onEstado?.('subiendo');
  const r = await apiFetch('/api/avatar', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ selfie, fondo, avatar }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || `Error ${r.status}`);
  if (userId) aplicarPerfilLocal(userId, { avatar_url: j.avatar_url, avatar_estado: 'listo', avatar_fondo: fondo });
  return j;
}

export async function quitarAvatar(userId) {
  const r = await apiFetch('/api/avatar', { method: 'DELETE' });
  if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || `Error ${r.status}`);
  if (userId) aplicarPerfilLocal(userId, { avatar_url: null, avatar_estado: null });
}

// ─── Componente ───
// (archivo .js: sin JSX; se usa createElement para que Vite no exija .jsx)
const h = React.createElement;
const TAMANOS = [24, 32, 40, 72, 120]; // tamaños previstos; cualquier otro número también funciona
export function AvatarImg({ perfil, size = 32, title, style, onClick, src }) {
  const { theme } = useTheme();
  const { url, iniciales, colorIniciales } = useAvatar(perfil);
  const [roto, setRoto] = useState(false);
  const s = TAMANOS.includes(size) ? size : Number(size) || 32;
  const final = src || url;
  const base = {
    width: s, height: s, borderRadius: 999, flexShrink: 0, overflow: 'hidden', boxSizing: 'border-box',
    border: `1px solid ${theme.border}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    cursor: onClick ? 'pointer' : 'default', userSelect: 'none', ...style,
  };
  if (final && !roto) {
    return h('span', { title, onClick, style: { ...base, background: theme.surface } },
      // width/height fijos + lazy/async: la foto nunca empuja el layout ni bloquea el
      // primer pintado (listas de equipo, notificaciones y menús de la app móvil).
      h('img', { src: final, alt: title || iniciales, width: s, height: s, loading: 'lazy', decoding: 'async', onError: () => setRoto(true),
        style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' } }));
  }
  return h('span', {
    title, onClick, 'aria-label': title || iniciales,
    style: { ...base, background: colorIniciales, color: theme.textOnDark || theme.surface,
      fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: Math.round(s * 0.38), letterSpacing: '-0.01em' },
  }, iniciales);
}

export default AvatarImg;
