// Acteck Ciudad · etiquetas (sprites de texto que crecen con el zoom) y formatos cortos.
import * as THREE from 'three';
import { etiquetasSinEncimar } from '../modelo.js';

export function etiqueta({ oscuro, sprites }, texto, color) { const c = document.createElement('canvas'); const ctx = c.getContext('2d'); const f = 'bold 44px -apple-system, BlinkMacSystemFont, "SF Pro Display", Helvetica, Arial, sans-serif'; ctx.font = f; const w = Math.ceil(ctx.measureText(texto).width) + 48; c.width = w; c.height = 72; ctx.font = f; ctx.fillStyle = oscuro ? 'rgba(28,28,30,.92)' : 'rgba(255,255,255,.92)'; ctx.beginPath(); ctx.roundRect(0, 0, w, 72, 36); ctx.fill(); ctx.fillStyle = oscuro && color === '#1D1D1F' ? '#F5F5F7' : color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(texto, w / 2, 38); const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); sp.scale.set(w / 72 * 2.3, 2.3, 1); sp.renderOrder = 10; sp.userData.base = { w: w / 72 * 2.3, h: 2.3 }; sprites.push(sp); return sp; }

// Cada cuadro: tamaño según zoom, se ocultan las que piden estar más cerca (userData.minZoom) y, de las que quedan, las que se
// enciman en pantalla con otra de más prioridad (userData.prioridad; 3.90.6). La cámara es ortográfica: 1 unidad = alto/(2·zoom) px.
const _v = new THREE.Vector3();
export function escalarEtiquetas(sprites, zoom, cam = null, ancho = 0, alto = 0) {
  const fz = Math.max(.7, Math.min(2.6, zoom / 30)); const cand = []; const cajas = [];
  for (const sp of sprites) { sp.scale.set(sp.userData.base.w * fz, sp.userData.base.h * fz, 1); sp.visible = zoom <= (sp.userData.minZoom ?? 999); if (sp.visible) cand.push(sp); }
  if (!cam || !(ancho > 0) || !(alto > 0) || cand.length < 2) return;
  const px = alto / (2 * zoom);
  for (const sp of cand) { sp.getWorldPosition(_v).project(cam); cajas.push({ x: _v.x * ancho / 2, y: -_v.y * alto / 2, w: sp.scale.x * px, h: sp.scale.y * px, prioridad: sp.userData.prioridad || 0 }); }
  etiquetasSinEncimar(cajas).forEach((v, i) => { cand[i].visible = v; });
}

export function fmtK(v) { return v >= 1e6 ? `${(v / 1e6).toFixed(1)} M` : v >= 1e3 ? `${Math.round(v / 1e3)} K` : String(Math.round(v)); }
export function capital(s) { return String(s).toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase()); }
