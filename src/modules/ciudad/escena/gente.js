// Acteck Ciudad · personas low-poly y su caminata por una ruta de puntos (piernas que se mueven al andar).
import * as THREE from 'three';
import { instanciar, geo } from './instancias.js';

// 3.90.4: geometrías de tamaño 1 compartidas (la escala va en la malla) y todas las piezas instanciadas como dinámicas.
export function persona(ctx, col, s = 1) {
  const { M } = ctx; const g = new THREE.Group();
  const pieza = (k, crear, color, y) => { const m = new THREE.Mesh(geo(ctx, k, crear), M(color)); m.scale.setScalar(s); m.position.y = y * s; m.castShadow = true; m.userData.detalle = 'gente'; return m; };
  const cuerpo = pieza('perCuerpo', () => new THREE.CylinderGeometry(.32, .38, 1.1, 8), col, .95);
  const cab = pieza('perCabeza', () => new THREE.SphereGeometry(.3, 10, 8), 0xF3CFA8, 1.75);
  const p1 = pieza('perPierna', () => new THREE.CylinderGeometry(.11, .11, .5, 6), 0x3B4252, .25); p1.castShadow = false; p1.position.x = -.14 * s; const p2 = p1.clone(); p2.position.x = .14 * s;
  g.add(cuerpo, cab, p1, p2); g.userData.piernas = [p1, p2];
  for (const m of [cuerpo, cab, p1, p2]) instanciar(ctx, m, null, true);
  return g;
}

export function caminar(per, ruta, s, origen) { const n = ruta.length; if (!n || !Number.isFinite(s)) return; const k = ((Math.floor(s) % n) + n) % n, f = ((s % 1) + 1) % 1; const a = ruta[k], b = ruta[(k + 1) % n]; const x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f; per.position.set(origen.x + x, per.position.y, origen.z + z); per.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]); const mov = Math.hypot(b[0] - a[0], b[1] - a[1]) > .01; const sw = mov ? Math.sin(s * 14) * .5 : 0; per.userData.piernas[0].rotation.x = sw; per.userData.piernas[1].rotation.x = -sw; }
