// Acteck Ciudad · interacción: arrastrar (el punto agarrado se queda bajo el cursor), girar (botón derecho o shift),
// zoom con rueda hacia el cursor, pellizco en iPad, teclado y hover/clic sobre lo tocable.
import * as THREE from 'three';

export function crearInteraccion(canvas, { cam, vista, colocarCam, colocarCamEn }, { onClick }) {
  const st = { hov: null, drag: null, mouse: { x: -1, y: -1 }, inercia: { x: 0, z: 0 }, teclas: {}, ultimoInput: performance.now() };
  const despertar = () => { st.ultimoInput = performance.now(); }; // cualquier gesto saca a la escena del modo calma
  const ray = new THREE.Raycaster(); const vec = new THREE.Vector2();
  const planoSuelo = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const aNDC = (cx, cy) => { const r = canvas.getBoundingClientRect(); return new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); };
  // Punto del suelo bajo el cursor (la cámara es ortográfica: el rayo es paralelo a la vista).
  const suelo = (cx, cy) => { ray.setFromCamera(aNDC(cx, cy), cam); const p = new THREE.Vector3(); return ray.ray.intersectPlane(planoSuelo, p) ? p : null; };
  let ultimoMov = null;
  canvas.addEventListener('pointerdown', (e) => { despertar(); const p = suelo(e.clientX, e.clientY); st.drag = { x: e.clientX, y: e.clientY, p, cx: vista.cx, cz: vista.cz, ang: vista.ang, m: false, btn: e.button, shift: e.shiftKey, t: performance.now() }; st.inercia = { x: 0, z: 0 }; ultimoMov = null; canvas.setPointerCapture?.(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    st.mouse = { x: e.clientX, y: e.clientY }; despertar();
    const drag = st.drag; if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) drag.m = true;
    if (drag.btn === 2 || drag.shift) { vista.ang = drag.ang - dx * .004; colocarCam(); return; }
    // El punto del suelo que agarraste se queda bajo el cursor: la cámara se mueve lo contrario.
    colocarCamEn(drag.cx, drag.cz); const q = suelo(e.clientX, e.clientY); if (!q || !drag.p) return;
    const nx = drag.cx - (q.x - drag.p.x), nz = drag.cz - (q.z - drag.p.z);
    const ahora = performance.now(); if (ultimoMov) { const dt = Math.max(1, ahora - ultimoMov.t); st.inercia = { x: (nx - ultimoMov.x) / dt * 16, z: (nz - ultimoMov.z) / dt * 16 }; } ultimoMov = { x: nx, z: nz, t: ahora };
    vista.cx = vista.cxObj = nx; vista.cz = vista.czObj = nz; colocarCam();
  });
  const soltar = () => { const drag = st.drag; if (drag && !drag.m) onClick?.(st.hov ? st.hov.userData.tag : null); if (drag && drag.m && performance.now() - (ultimoMov?.t || 0) > 80) st.inercia = { x: 0, z: 0 }; st.drag = null; };
  canvas.addEventListener('pointerup', soltar); canvas.addEventListener('pointercancel', () => { st.drag = null; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  // Rueda: zoom hacia el cursor (el punto bajo el mouse no se mueve).
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); despertar(); const antes = suelo(e.clientX, e.clientY); const f = e.deltaY > 0 ? 1.1 : .9; const z = Math.max(8, Math.min(120, vista.zoom * f)); if (antes) { const k = z / vista.zoom; vista.cxObj = antes.x + (vista.cxObj - antes.x) * k; vista.czObj = antes.z + (vista.czObj - antes.z) * k; } vista.zoomObj = z; }, { passive: false });
  // pellizco (iPad) → zoom; un dedo arrastra (pointer events)
  let pinch = null; canvas.addEventListener('touchstart', (e) => { despertar(); if (e.touches.length === 2) pinch = { d: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY), z: vista.zoomObj }; }, { passive: true });
  canvas.addEventListener('touchmove', (e) => { if (pinch && e.touches.length === 2) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); vista.zoomObj = Math.max(8, Math.min(120, pinch.z * pinch.d / d)); } }, { passive: true });
  canvas.addEventListener('touchend', () => { pinch = null; });
  const onKey = (e) => { if (/INPUT|TEXTAREA/.test(e.target?.tagName || '')) return; despertar(); st.teclas[e.key.toLowerCase()] = e.type === 'keydown'; };
  window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);

  // Cada cuadro: qué objeto queda bajo el cursor, cursor de mano y posición en pantalla para el globo.
  let hovPrev = null;
  function hover(interact, onHover) {
    if (st.mouse.x >= 0 && !st.drag) { const r = canvas.getBoundingClientRect(); vec.set(((st.mouse.x - r.left) / r.width) * 2 - 1, -((st.mouse.y - r.top) / r.height) * 2 + 1); ray.setFromCamera(vec, cam); const hs = ray.intersectObjects(interact, false); st.hov = hs.length ? hs[0].object : null; }
    const hov = st.hov;
    if (hov !== hovPrev) { hovPrev = hov; canvas.style.cursor = hov ? 'pointer' : 'grab'; }
    if (onHover) { if (hov) { const p = new THREE.Vector3(); hov.getWorldPosition(p); p.y += (hov.geometry?.parameters?.height || 1) + 1.2; const sp = p.project(cam); const r = canvas.getBoundingClientRect(); onHover(hov.userData.tag, { x: r.left + (sp.x + 1) / 2 * r.width, y: r.top + (1 - sp.y) / 2 * r.height }); } else onHover(null); }
  }
  return { st, hover, quitar() { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); } };
}
