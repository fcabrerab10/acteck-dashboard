// Acteck Ciudad · rebote (3.90.73, Etapa 7): lo que se toca «rebota» medio segundo (aplasta y estira, como juego).
// Instancias: todas las piezas con el mismo tag (cuerpo, techo, toldo… de una tienda) se escalan alrededor de un pivote común
// en el suelo, así no se separan. Mallas sueltas (oficina, CEDIS): se escala su grupo padre desde su origen (a ras de suelo).
// Las piezas dinámicas (gente, camiones) no rebotan: actualizarInstancias() reescribe su matriz cada cuadro.
import * as THREE from 'three';
import { rebote } from '../modelo.js';

export function crearRebote({ raiz, interact, dinamicas }) {
  let activo = null; let t = 0;
  const T = new THREE.Matrix4(), S = new THREE.Matrix4(), Ti = new THREE.Matrix4(), m = new THREE.Matrix4();
  function restaurar() {
    if (!activo) return;
    for (const { im, i, base } of activo.inst) { im.setMatrixAt(i, base); im.instanceMatrix.needsUpdate = true; }
    for (const { o, base } of activo.objs) o.scale.copy(base);
    activo = null;
  }
  function tocar(obj, tag) {
    restaurar(); if (!obj || !tag) return;
    const dinam = new Set((dinamicas || []).map((d) => d.im));
    const inst = []; const objs = new Map();
    for (const o of interact) {
      if (o.isInstancedMesh) { if (dinam.has(o) || !o.userData.tags) continue; o.userData.tags.forEach((tg, i) => { if (tg === tag) { const base = new THREE.Matrix4(); o.getMatrixAt(i, base); inst.push({ im: o, i, base }); } }); }
      else if (o.userData.tag === tag && o.isMesh) { const g = o.parent && o.parent !== raiz ? o.parent : o; if (!objs.has(g)) objs.set(g, { o: g, base: g.scale.clone() }); }
    }
    for (const g of [...objs.keys()]) for (let a = g.parent; a; a = a.parent) if (objs.has(a)) { objs.delete(g); break; } // si el abuelo ya rebota, el nieto no (si no, rebota doble)
    if (!inst.length && !objs.size) return;
    // pivote: centro (x, z) de las piezas y la altura más baja (≈ el suelo de la tienda)
    const p = new THREE.Vector3(), piv = new THREE.Vector3(0, Infinity, 0);
    for (const it of inst) { p.setFromMatrixPosition(it.base); piv.x += p.x; piv.z += p.z; piv.y = Math.min(piv.y, p.y); }
    if (inst.length) { piv.x /= inst.length; piv.z /= inst.length; piv.y = Math.max(0, piv.y - .5); }
    activo = { inst, objs: [...objs.values()], piv }; t = 0;
  }
  function paso(dt) {
    if (!activo) return;
    t += dt; const r = rebote(t);
    if (r.fin) { restaurar(); return; }
    T.makeTranslation(activo.piv.x, activo.piv.y, activo.piv.z); Ti.makeTranslation(-activo.piv.x, -activo.piv.y, -activo.piv.z); S.makeScale(r.xz, r.y, r.xz);
    for (const { im, i, base } of activo.inst) { im.setMatrixAt(i, m.copy(T).multiply(S).multiply(Ti).multiply(base)); im.instanceMatrix.needsUpdate = true; }
    for (const { o, base } of activo.objs) o.scale.set(base.x * r.xz, base.y * r.y, base.z * r.xz);
  }
  return { tocar, paso, restaurar };
}
