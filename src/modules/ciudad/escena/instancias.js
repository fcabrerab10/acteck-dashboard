// Acteck Ciudad · instancias (3.90.3): las piezas repetidas (tiendas y casitas de clientes finales) se arman como mallas
// normales, se marcan con instanciar() y, al final de la construcción, plantarInstancias() las junta en un InstancedMesh
// por geometría+material (box() ya comparte ambos). Siguen tocables: cada instancia guarda su tag en userData.tags[instanceId]
// y la interacción lo lee con tagDe(objeto, instanceId).
import * as THREE from 'three';

export function instanciar(ctx, malla, tag = null) { (ctx.instancias ||= []).push({ malla, tag }); }

export function plantarInstancias({ raiz, interact, instancias = [] }) {
  if (!instancias.length) return;
  raiz.updateMatrixWorld(true);
  const aRaiz = new THREE.Matrix4().copy(raiz.matrixWorld).invert();
  const grupos = new Map();
  for (const it of instancias) { const k = `${it.malla.geometry.uuid}|${it.malla.material.uuid}`; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(it); }
  const m = new THREE.Matrix4();
  for (const lista of grupos.values()) {
    const { geometry, material, castShadow, receiveShadow } = lista[0].malla;
    const im = new THREE.InstancedMesh(geometry, material, lista.length); im.castShadow = castShadow; im.receiveShadow = receiveShadow;
    const tags = lista.map((it, i) => { im.setMatrixAt(i, m.multiplyMatrices(aRaiz, it.malla.matrixWorld)); it.malla.removeFromParent(); return it.tag; });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); raiz.add(im);
    if (tags.some(Boolean)) { im.userData.tags = tags; interact.push(im); }
  }
  instancias.length = 0;
}

export const tagDe = (o, id) => (o.userData.tags && id != null ? o.userData.tags[id] : o.userData.tag) || null;
