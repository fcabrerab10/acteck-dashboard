// Acteck Ciudad · terreno: mar con oleaje, contorno real de México, sierras, carreteras curvas y árboles.
import * as THREE from 'three';
import { pxAEscena } from '../modelo.js';
import MEXICO from '../../comercial/sellout/mexico-estados.json';

export function terreno({ raiz, P, M, animados }) {
  const g_cerros = new THREE.Group(); raiz.add(g_cerros); // Sierra Madre, al norte de Guadalajara
  // Mar: un plano grande con oleaje suave debajo de todo.
  const aguaG = new THREE.PlaneGeometry(1300, 1000, 60, 48); const agua = new THREE.Mesh(aguaG, M(P.agua, { roughness: .35, metalness: .05, flatShading: true })); agua.rotation.x = -Math.PI / 2; agua.position.set(30, -.9, -20); raiz.add(agua);
  animados.push((t) => { const pos = aguaG.attributes.position; for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i); pos.setZ(i, Math.sin(x * .08 + t * 1.1) * .35 + Math.cos(y * .11 + t * .8) * .3); } pos.needsUpdate = true; aguaG.computeVertexNormals(); });
  // Tierra: el contorno real de México (32 estados del mapa de Sell Out) extruido como una meseta baja.
  const g = new THREE.Group();
  for (const e of MEXICO.estados) {
    const cmds = e.d.match(/[MLZ][^MLZ]*/gi) || []; let shape = null; const shapes = [];
    for (const c of cmds) { const t = c[0].toUpperCase(); const nums = (c.slice(1).match(/-?\d+(\.\d+)?/g) || []).map(Number); if (t === 'M') { shape = new THREE.Shape(); shapes.push(shape); const p = pxAEscena(nums[0], nums[1]); shape.moveTo(p.x, -p.z); } else if (t === 'L' && shape) { for (let i = 0; i + 1 < nums.length; i += 2) { const p = pxAEscena(nums[i], nums[i + 1]); shape.lineTo(p.x, -p.z); } } }
    for (const sh of shapes) { if (sh.curves.length < 3) continue; const geo = new THREE.ExtrudeGeometry(sh, { depth: 1.2, bevelEnabled: false }); const m = new THREE.Mesh(geo, M(P.suelo, { roughness: 1, flatShading: false })); m.rotation.x = -Math.PI / 2; m.position.y = -1.2; m.receiveShadow = true; g.add(m); }
  }
  raiz.add(g);
  // Sierras chicas en zonas sin ciudades (desiertos de Sonora/Chihuahua y Sierra Madre Occidental).
  [[-55, -45, 7], [-63, -53, 9], [-38, -71, 8], [-12, -72, 6], [-32, -47, 5], [-20, -12, 5], [-8, -36, 6], [-46, -36, 5]].forEach(([x, z, r], i) => { const c = new THREE.Mesh(new THREE.ConeGeometry(r, r * .9, 6), M(i % 2 ? P.cerro : P.cerro2, { roughness: 1 })); c.position.set(x, 0, z); c.receiveShadow = true; c.castShadow = true; g_cerros.add(c); });
}

// Carretera curva de a → b; regresa la curva para que los vehículos la recorran.
export function carretera({ raiz, P, M }, a, b, ancho = 1.6) {
  const mid = new THREE.Vector3((a.x + b.x) / 2 + (b.z - a.z) * .12, 0, (a.z + b.z) / 2 - (b.x - a.x) * .12);
  const curva = new THREE.QuadraticBezierCurve3(new THREE.Vector3(a.x, .05, a.z), mid, new THREE.Vector3(b.x, .05, b.z));
  const pts = curva.getPoints(40); const geo = new THREE.BufferGeometry(); const verts = []; const idx = [];
  for (let i = 0; i < pts.length; i++) { const p = pts[i]; const q = pts[Math.min(pts.length - 1, i + 1)]; const dx = q.x - p.x, dz = q.z - p.z; const l = Math.hypot(dx, dz) || 1; const nx = -dz / l * ancho / 2, nz = dx / l * ancho / 2; verts.push(p.x + nx, .06, p.z + nz, p.x - nx, .06, p.z - nz); if (i < pts.length - 1) { const o = i * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); } }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, M(P.calle, { roughness: 1 })); m.receiveShadow = true; raiz.add(m);
  return curva;
}

export function arbol({ P, M }, g, x, z, s = 1) { const t = new THREE.Mesh(new THREE.CylinderGeometry(.14 * s, .2 * s, 1.1 * s, 6), M(P.tronco)); t.position.set(x, .55 * s, z); t.castShadow = true; g.add(t); const c = new THREE.Mesh(new THREE.ConeGeometry(.95 * s, 2 * s, 7), M(Math.random() > .5 ? P.arbol : P.arbol2)); c.position.set(x, 1.9 * s, z); c.castShadow = true; g.add(c); const c2 = new THREE.Mesh(new THREE.ConeGeometry(.7 * s, 1.4 * s, 7), M(P.arbol)); c2.position.set(x, 2.8 * s, z); c2.castShadow = true; g.add(c2); }
