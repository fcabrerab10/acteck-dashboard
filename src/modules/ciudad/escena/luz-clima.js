// Acteck Ciudad · paleta, luces y clima (cielo, nubes, lluvia). Clima de Open-Meteo para Guadalajara; si no llega, manda el tema.
import * as THREE from 'three';

export const PAL = {
  dia:   { cielo: 0xEAF2F7, suelo: 0xE8DCC2, suelo2: 0xDFCFAE, calle: 0xCDBFA3, banqueta: 0xE6DCC8, agua: 0x6FB1E8, agua2: 0x5AA0DA, cerro: 0xC9D8C3, cerro2: 0xB4C8B0, arbol: 0x7FA66B, arbol2: 0x6B9458, tronco: 0x8B6D4B,
           oficina: 0xF6EEDC, oficinaTecho: 0xE0C6A2, cedis: 0xE8A77A, cedisTecho: 0xD98F63, tienda: 0xF3E7D3, tiendaTecho: 0xC98B5B, ventana: 0x3B4252, ventanaOn: 0xFFE9A8, camion: 0xF4F1EA, cabina: 0xE05A45, barco: 0xF4F1EA, barcoCab: 0x3B4252, nube: 0xFFFFFF, sol: 1.35, amb: .85, fog: 0xEAF2F7 },
  noche: { cielo: 0x121722, suelo: 0x343644, suelo2: 0x25252D, calle: 0x1B1C22, banqueta: 0x33343C, agua: 0x18324D, agua2: 0x15293F, cerro: 0x25303A, cerro2: 0x1E272F, arbol: 0x2E4A33, arbol2: 0x27402C, tronco: 0x3A2E24,
           oficina: 0x3B3F4B, oficinaTecho: 0x4A4F5C, cedis: 0x5C4335, cedisTecho: 0x6B4E3E, tienda: 0x3C3F4A, tiendaTecho: 0x5A4030, ventana: 0x1D1F26, ventanaOn: 0xFFD66B, camion: 0xC9C6BE, cabina: 0xE05A45, barco: 0xC9C6BE, barcoCab: 0x2A2E38, nube: 0x2A3140, sol: .4, amb: .55, fog: 0x121722 },
};
export const ACC = { azul: 0x0A84FF, verde: 0x30D158, naranja: 0xFF9F0A, rojo: 0xFF453A, morado: 0xBF5AF2, gris: 0x8E8E93 };

export function luces({ scene, P, nubosidad }) {
  const hemi = new THREE.HemisphereLight(0xffffff, 0x9a8c74, P.amb + nubosidad * .2); scene.add(hemi);
  const sol = new THREE.DirectionalLight(0xfff4e0, P.sol * (1 - nubosidad * .45)); sol.castShadow = true; sol.shadow.mapSize.set(3072, 3072);
  Object.assign(sol.shadow.camera, { left: -220, right: 220, top: 220, bottom: -220, near: 10, far: 600 }); sol.position.set(90, 160, 70); sol.shadow.bias = -0.0006; sol.shadow.normalBias = .03; scene.add(sol);
  const luzNoche = new THREE.Group(); scene.add(luzNoche);
}

export function fondo({ scene, P, noche, nubosidad }) {
  scene.background = new THREE.Color(P.cielo).lerp(new THREE.Color(noche ? 0x0b0d12 : 0xC9D2DA), nubosidad * .7);
}

// Nubes (más con más nubosidad) y lluvia si Open-Meteo dice que llueve.
export function cielo({ raiz, P, M, nubosidad, clima, animados }) {
  const nNubes = Math.round(2 + nubosidad * 14);
  for (let i = 0; i < nNubes; i++) { const g = new THREE.Group(); for (let k = 0; k < 4; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(2.2 + (k % 2) * 1.4, 8, 6), M(P.nube, { roughness: 1 })); s.position.set(k * 2.4 - 3, (k % 2) * .8, (k % 3) * .6); g.add(s); } g.scale.setScalar(1 + (i % 3) * .35); g.position.set(-200 + i * (400 / nNubes), 62 + (i % 3) * 6, -90 + (i % 5) * 36); raiz.add(g); animados.push((t) => { g.position.x += .01; if (g.position.x > 220) g.position.x = -220; }); }
  if (clima?.lluvia) { const n = 900; const geo = new THREE.BufferGeometry(); const pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos[i * 3] = -120 + Math.random() * 240; pos[i * 3 + 1] = Math.random() * 50; pos[i * 3 + 2] = -120 + Math.random() * 240; } geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const lluvia = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x9fbbe0, size: .35, transparent: true, opacity: .7 })); raiz.add(lluvia); animados.push(() => { const p = geo.attributes.position; for (let i = 0; i < n; i++) { let y = p.getY(i) - .9; if (y < 0) y = 50; p.setY(i, y); } p.needsUpdate = true; }); }
}
