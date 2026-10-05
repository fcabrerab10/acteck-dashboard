// Acteck Ciudad · cámara isométrica (ortográfica) con giro, zoom y movimiento suavizado (teclas, inercia del arrastre).
import * as THREE from 'three';

export function crearCamara(canvas, R) {
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 900);
  const vista = { cx: 20, cz: -24, zoom: 70, ang: Math.PI / 4, zoomObj: 70, cxObj: 20, czObj: -24 };
  const W = () => canvas.clientWidth || 800, H = () => canvas.clientHeight || 600;
  function resize() { const w = W(), h = H(); R.setSize(w, h, false); const a = w / h; cam.left = -vista.zoom * a; cam.right = vista.zoom * a; cam.top = vista.zoom; cam.bottom = -vista.zoom; cam.updateProjectionMatrix(); }
  function colocarCamEn(cx, cz) { cam.position.set(cx + Math.cos(vista.ang) * 300, 240, cz + Math.sin(vista.ang) * 300); cam.lookAt(cx, 0, cz); }
  function colocarCam() { colocarCamEn(vista.cx, vista.cz); }
  resize(); colocarCam();
  // Cada cuadro: WASD/flechas, inercia del arrastre y suavizado hacia el objetivo (como iOS).
  function mover(dt, st) {
    const { teclas } = st;
    const v = 60 * dt * (vista.zoom / 34); const fw = { x: -Math.cos(vista.ang), z: -Math.sin(vista.ang) }; const rt = { x: -Math.sin(vista.ang), z: Math.cos(vista.ang) }; if (teclas.w || teclas.arrowup) { vista.cxObj += fw.x * v; vista.czObj += fw.z * v; } if (teclas.s || teclas.arrowdown) { vista.cxObj -= fw.x * v; vista.czObj -= fw.z * v; } if (teclas.d || teclas.arrowright) { vista.cxObj += rt.x * v; vista.czObj += rt.z * v; } if (teclas.a || teclas.arrowleft) { vista.cxObj -= rt.x * v; vista.czObj -= rt.z * v; }
    if (!st.drag && (Math.abs(st.inercia.x) + Math.abs(st.inercia.z)) > .01) { vista.cxObj += st.inercia.x; vista.czObj += st.inercia.z; st.inercia.x *= .9; st.inercia.z *= .9; }
    const k = 1 - Math.pow(.001, dt); vista.cx += (vista.cxObj - vista.cx) * k; vista.cz += (vista.czObj - vista.cz) * k; const z0 = vista.zoom; vista.zoom += (vista.zoomObj - vista.zoom) * k; if (Math.abs(z0 - vista.zoom) > 1e-4) resize(); colocarCam();
  }
  // ¿La cámara sigue acercándose a su objetivo (arrastre, inercia, irA, zoom)?
  function moviendose() { return Math.abs(vista.cxObj - vista.cx) + Math.abs(vista.czObj - vista.cz) + Math.abs(vista.zoomObj - vista.zoom) > .01; }
  return { cam, vista, resize, colocarCam, colocarCamEn, mover, moviendose };
}
