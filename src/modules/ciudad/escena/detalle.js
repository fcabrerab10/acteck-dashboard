// Acteck Ciudad · nivel de detalle por zoom (3.90.5). Las piezas marcadas con userData.detalle ('gente' | 'fino') se ocultan
// cuando la cámara está lejos (umbrales DETALLE en modelo.js). Las instancias ocultas tampoco se recalculan cada cuadro.
import { capasVisibles } from '../modelo.js';

// Junta una vez (después de plantarInstancias) lo que tiene capa; las mallas originales de piezas dinámicas ya van invisibles.
export function prepararDetalle(raiz) {
  const lista = []; raiz.traverse((o) => { if (o.userData.detalle && (o.isInstancedMesh || o.visible)) lista.push(o); });
  return { lista, ultimo: null };
}

// Cada cuadro: sólo toca la visibilidad cuando cambia el nivel.
export function aplicarDetalle(det, zoom) {
  const capas = capasVisibles(zoom); const k = `${capas.gente}|${capas.fino}`;
  if (k === det.ultimo) return; det.ultimo = k;
  for (const o of det.lista) o.visible = capas[o.userData.detalle] !== false;
}
