// Acteck Ciudad · instancias (3.90.3): las piezas repetidas (tiendas y casitas de clientes finales) se arman como mallas
// normales, se marcan con instanciar() y, al final de la construcción, plantarInstancias() las junta en un InstancedMesh
// por geometría+material (box() ya comparte ambos). Siguen tocables: cada instancia guarda su tag en userData.tags[instanceId]
// y la interacción lo lee con tagDe(objeto, instanceId).
// Dinámicas (3.90.4: personas, camiones, coches): la malla original se queda en su grupo pero invisible, así las animaciones
// (caminar(), piernas, rutas) no cambian; actualizarInstancias() copia cada cuadro su matrixWorld al instanceMatrix.
import * as THREE from 'three';

export function instanciar(ctx, malla, tag = null, dinamico = false) { (ctx.instancias ||= []).push({ malla, tag, dinamico }); }
// Geometrías compartidas que no son cajas (cilindros, esferas, conos): una por clave en toda la escena.
export const geo = (ctx, k, crear) => { const c = (ctx.geoComp ||= new Map()); if (!c.has(k)) c.set(k, crear()); return c.get(k); };

export function plantarInstancias(ctx) {
  const { raiz, interact, instancias = [] } = ctx;
  if (!instancias.length) return;
  raiz.updateMatrixWorld(true);
  const aRaiz = new THREE.Matrix4().copy(raiz.matrixWorld).invert();
  const grupos = new Map();
  for (const it of instancias) { it.tag ||= it.malla.userData.tag || null; const k = `${it.malla.geometry.uuid}|${it.malla.material.uuid}|${it.dinamico ? 1 : 0}|${it.tag ? 1 : 0}|${it.malla.userData.detalle || ''}`; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(it); }
  const m = new THREE.Matrix4(); const quitar = new Set(); ctx.dinamicas = [];
  for (const lista of grupos.values()) {
    const { geometry, material, castShadow, receiveShadow } = lista[0].malla;
    const im = new THREE.InstancedMesh(geometry, material, lista.length); im.castShadow = castShadow; im.receiveShadow = receiveShadow; if (lista[0].malla.userData.detalle) im.userData.detalle = lista[0].malla.userData.detalle;
    const tags = lista.map((it, i) => { im.setMatrixAt(i, m.multiplyMatrices(aRaiz, it.malla.matrixWorld)); quitar.add(it.malla); if (it.dinamico) it.malla.visible = false; else it.malla.removeFromParent(); return it.tag; });
    if (lista[0].dinamico) ctx.dinamicas.push({ im, mallas: lista.map((it) => it.malla), aRaiz });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); raiz.add(im);
    if (tags.some(Boolean)) { im.userData.tags = tags; interact.push(im); }
  }
  // las mallas originales ya no se tocan directo: el raycast pega en el InstancedMesh
  const quedan = interact.filter((o) => !quitar.has(o)); interact.length = 0; interact.push(...quedan);
  instancias.length = 0;
}

// Cada cuadro, después de las animaciones: la posición de cada pieza dinámica pasa a su instancia.
const _m = new THREE.Matrix4();
export function actualizarInstancias({ dinamicas }) {
  if (!dinamicas) return;
  for (const { im, mallas, aRaiz } of dinamicas) {
    if (!im.visible) continue; // oculta por nivel de detalle: no se calcula
    for (let i = 0; i < mallas.length; i++) { mallas[i].updateWorldMatrix(true, false); im.setMatrixAt(i, _m.multiplyMatrices(aRaiz, mallas[i].matrixWorld)); }
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); // se mueven: sin esto el raycast y el recorte de cámara usan la esfera vieja
  }
}

export const tagDe = (o, id) => (o.userData.tags && id != null ? o.userData.tags[id] : o.userData.tag) || null;
