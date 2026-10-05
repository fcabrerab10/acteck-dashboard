// Acteck Ciudad · etiquetas (sprites de texto que crecen con el zoom) y formatos cortos.
import * as THREE from 'three';

export function etiqueta({ oscuro, sprites }, texto, color) { const c = document.createElement('canvas'); const ctx = c.getContext('2d'); const f = 'bold 44px -apple-system, BlinkMacSystemFont, "SF Pro Display", Helvetica, Arial, sans-serif'; ctx.font = f; const w = Math.ceil(ctx.measureText(texto).width) + 48; c.width = w; c.height = 72; ctx.font = f; ctx.fillStyle = oscuro ? 'rgba(28,28,30,.92)' : 'rgba(255,255,255,.92)'; ctx.beginPath(); ctx.roundRect(0, 0, w, 72, 36); ctx.fill(); ctx.fillStyle = oscuro && color === '#1D1D1F' ? '#F5F5F7' : color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(texto, w / 2, 38); const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); sp.scale.set(w / 72 * 2.3, 2.3, 1); sp.renderOrder = 10; sp.userData.base = { w: w / 72 * 2.3, h: 2.3 }; sprites.push(sp); return sp; }

// Cada cuadro: tamaño según zoom y se ocultan las que piden estar más cerca (userData.minZoom).
export function escalarEtiquetas(sprites, zoom) { const fz = Math.max(.7, Math.min(2.6, zoom / 30)); for (const sp of sprites) { sp.scale.set(sp.userData.base.w * fz, sp.userData.base.h * fz, 1); sp.visible = zoom <= (sp.userData.minZoom ?? 999); } }

export function fmtK(v) { return v >= 1e6 ? `${(v / 1e6).toFixed(1)} M` : v >= 1e3 ? `${Math.round(v / 1e3)} K` : String(Math.round(v)); }
export function capital(s) { return String(s).toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase()); }
