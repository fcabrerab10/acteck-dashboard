// Acteck Ciudad · interacción: arrastrar (el punto agarrado se queda bajo el cursor), girar (botón derecho o shift),
// zoom con rueda hacia el cursor, pellizco en iPad, teclado y hover/clic sobre lo tocable.
import * as THREE from 'three';
import { tagDe } from './instancias.js';
import { zoomEnRango, gestoDosDedos } from '../modelo.js';

// Visible de verdad: la malla y todos sus padres (el cascarón del CEDIS se oculta por grupo al «Entrar», 3.90.31).
const visibleArriba = (o) => { for (let x = o; x; x = x.parent) if (!x.visible) return false; return true; };

export function crearInteraccion(canvas, { cam, vista, colocarCam, colocarCamEn }, { onClick }) {
  const st = { hov: null, drag: null, mouse: { x: -1, y: -1 }, inercia: { x: 0, z: 0 }, teclas: {}, ultimoInput: performance.now() };
  // 3.90.8: todos los eventos cuelgan de un AbortController; quitar() los suelta todos. Ciudad.jsx rearma la escena sobre el
  // MISMO canvas (cambio de modelo o de día/noche): antes los del canvas se quedaban y retenían cada escena vieja.
  const ab = new AbortController(); const on = (t, f, o = {}) => canvas.addEventListener(t, f, { ...o, signal: ab.signal });
  const despertar = () => { st.ultimoInput = performance.now(); }; // cualquier gesto saca a la escena del modo calma
  const ray = new THREE.Raycaster(); const vec = new THREE.Vector2();
  const planoSuelo = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const aNDC = (cx, cy) => { const r = canvas.getBoundingClientRect(); return new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); };
  // Punto del suelo bajo el cursor (la cámara es ortográfica: el rayo es paralelo a la vista).
  const suelo = (cx, cy) => { ray.setFromCamera(aNDC(cx, cy), cam); const p = new THREE.Vector3(); return ray.ray.intersectPlane(planoSuelo, p) ? p : null; };
  let ultimoMov = null;
  on('pointerdown', (e) => { despertar(); st.mouse = { x: e.clientX, y: e.clientY }; st.tactil = e.pointerType === 'touch'; st.largo = false; clearTimeout(st.tLargo); if (st.tactil) st.tLargo = setTimeout(() => { if (st.drag && !st.drag.m && !pinch) { st.largo = true; navigator.vibrate?.(15); } }, 550); /* toque largo = info (3.90.77) */ const p = suelo(e.clientX, e.clientY); st.drag = { x: e.clientX, y: e.clientY, p, cx: vista.cx, cz: vista.cz, ang: vista.ang, m: false, btn: e.button, shift: e.shiftKey, t: performance.now() }; st.inercia = { x: 0, z: 0 }; ultimoMov = null; canvas.setPointerCapture?.(e.pointerId); });
  on('pointermove', (e) => {
    st.mouse = { x: e.clientX, y: e.clientY }; despertar();
    const drag = st.drag; if (!drag || pinch) return; // con dos dedos manda el gesto (zoom + giro)
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) drag.m = true;
    if (drag.btn === 2 || drag.shift) { vista.ang = drag.ang - dx * .004; colocarCam(); return; }
    // El punto del suelo que agarraste se queda bajo el cursor: la cámara se mueve lo contrario.
    colocarCamEn(drag.cx, drag.cz); const q = suelo(e.clientX, e.clientY); if (!q || !drag.p) return;
    const nx = drag.cx - (q.x - drag.p.x), nz = drag.cz - (q.z - drag.p.z);
    const ahora = performance.now(); if (ultimoMov) { const dt = Math.max(1, ahora - ultimoMov.t); st.inercia = { x: (nx - ultimoMov.x) / dt * 16, z: (nz - ultimoMov.z) / dt * 16 }; } ultimoMov = { x: nx, z: nz, t: ahora };
    vista.cx = vista.cxObj = nx; vista.cz = vista.czObj = nz; colocarCam();
  });
  const soltar = () => { const drag = st.drag; clearTimeout(st.tLargo); if (st.largo) { st.largo = false; st.drag = null; if (st.tactil) st.mouse = { x: -1, y: -1 }; return; } /* soltar el toque largo sólo quita la info */ if (drag && !drag.m) elegir(drag.x, drag.y); /* el toque elige lo que está bajo el dedo, no lo último con hover */ if (drag && !drag.m) st.sel = st.hov ? { obj: st.hov, id: st.hovId } : null; /* la tarjeta sigue a lo tocado (3.90.27) */ if (drag && !drag.m) onClick?.(st.hov ? tagDe(st.hov, st.hovId) : null); if (drag && drag.m && performance.now() - (ultimoMov?.t || 0) > 80) st.inercia = { x: 0, z: 0 }; st.drag = null; };
  on('pointerup', (e) => { soltar(); if (e.pointerType === 'touch' && !st.largo) st.mouse = { x: -1, y: -1 }; }); on('pointercancel', () => { st.drag = null; });
  on('contextmenu', (e) => e.preventDefault());
  // Rueda: zoom hacia el cursor (el punto bajo el mouse no se mueve).
  on('wheel', (e) => { e.preventDefault(); despertar(); const antes = suelo(e.clientX, e.clientY); const f = e.deltaY > 0 ? 1.1 : .9; const z = zoomEnRango(vista.zoom * f); if (antes) { const k = z / vista.zoom; vista.cxObj = antes.x + (vista.cxObj - antes.x) * k; vista.czObj = antes.z + (vista.czObj - antes.z) * k; } vista.zoomObj = z; }, { passive: false });
  // pellizco (iPad) → zoom; un dedo arrastra (pointer events)
  // dos dedos (3.90.77): pellizco = zoom y girar los dedos = girar la cámara; el arrastre de un dedo se pausa mientras tanto
  const dedos = (e) => [{ x: e.touches[0].clientX, y: e.touches[0].clientY }, { x: e.touches[1].clientX, y: e.touches[1].clientY }];
  let pinch = null; on('touchstart', (e) => { despertar(); if (e.touches.length === 2) { pinch = { p: dedos(e), z: vista.zoomObj, ang: vista.ang }; st.drag = null; st.largo = false; clearTimeout(st.tLargo); } }, { passive: true });
  on('touchmove', (e) => { if (pinch && e.touches.length === 2) { const g = gestoDosDedos(pinch.p, dedos(e)); vista.zoomObj = zoomEnRango(pinch.z * g.escala); vista.ang = pinch.ang - g.giro; colocarCam(); despertar(); } }, { passive: true });
  on('touchend', (e) => { if (e.touches.length < 2) pinch = null; });
  const onKey = (e) => { if (/INPUT|TEXTAREA/.test(e.target?.tagName || '')) return; despertar(); st.teclas[e.key.toLowerCase()] = e.type === 'keydown'; };
  window.addEventListener('keydown', onKey, { signal: ab.signal }); window.addEventListener('keyup', onKey, { signal: ab.signal });

  // Cada cuadro: qué objeto queda bajo el cursor, cursor de mano y posición en pantalla para el globo.
  let hovPrev = null; const mtx = new THREE.Matrix4();
  // Posición en pantalla (px del documento) encima de un objeto o de una de sus instancias; null si queda fuera del lienzo.
  function posPantalla(obj, id, dentro = false) { const p = new THREE.Vector3(); if (obj.isInstancedMesh && id != null) { obj.getMatrixAt(id, mtx); p.setFromMatrixPosition(mtx).applyMatrix4(obj.matrixWorld); } else obj.getWorldPosition(p); p.y += (obj.geometry?.parameters?.height || 1) + 1.2; const sp = p.project(cam); if (dentro && (Math.abs(sp.x) > 1 || Math.abs(sp.y) > 1)) return null; const r = canvas.getBoundingClientRect(); return { x: r.left + (sp.x + 1) / 2 * r.width, y: r.top + (1 - sp.y) / 2 * r.height }; }
  let tocables = []; // la lista de la escena (llega en cada hover)
  function elegir(cx, cy) { if (cx < 0) return; const r = canvas.getBoundingClientRect(); vec.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); ray.setFromCamera(vec, cam); const hs = ray.intersectObjects(tocables, false).filter((h) => visibleArriba(h.object)); /* lo oculto por zoom no se toca */ st.hov = hs.length ? hs[0].object : null; st.hovId = hs.length ? hs[0].instanceId : undefined; }
  function hover(interact, onHover) {
    tocables = interact;
    if (!st.drag || st.largo) elegir(st.mouse.x, st.mouse.y);
    if (st.tactil && !st.largo) { st.hov = st.drag ? st.hov : null; if (hovPrev) { hovPrev = null; onHover?.(null); } return; } // en táctil la info sólo sale con toque largo
    const hov = st.hov; const tag = hov ? tagDe(hov, st.hovId) : null;
    if (tag !== hovPrev) { hovPrev = tag; canvas.style.cursor = tag ? 'pointer' : 'grab'; }
    if (onHover) { if (tag) onHover(tag, posPantalla(hov, st.hovId)); else onHover(null); }
  }
  // Dónde está ahora en pantalla lo último que se tocó (para que la tarjeta lo siga); null si no hay o salió del lienzo.
  const posSeleccion = () => (st.sel?.obj?.visible !== false && st.sel ? posPantalla(st.sel.obj, st.sel.id, true) : null);
  return { st, hover, posSeleccion, quitar() { ab.abort(); } };
}
