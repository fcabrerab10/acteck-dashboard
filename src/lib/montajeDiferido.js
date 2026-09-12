// montajeDiferido · abrir un panel perezoso SIN perder su animación de entrada.
//
// Problema: los overlays del dashboard (Paleta, AtajosHoja, CambiarFoto, PreferenciasHoja)
// animan la entrada con `abierto: false → true` (Overlay funde el velo, HojaLateral desliza).
// Si el componente se monta YA con `abierto=true` — que es lo que pasa cuando es `lazy()`
// y sólo se monta al abrirlo — el navegador nunca ve el estado inicial y el panel aparece
// de golpe, sin fundido ni deslizamiento. Se nota, y el trato es no cambiar la sensación.
//
// Solución: bajar el módulo, montarlo CERRADO y forzar ese pintado (flushSync), y abrirlo
// en el frame siguiente. Cuesta un frame (~16 ms) la PRIMERA vez; después el componente ya
// está montado y abre igual que siempre. Con el prefetch en ralentí el módulo ya está en
// memoria, así que `cargar()` resuelve en un microtask.
import { flushSync } from 'react-dom';

export async function abrirDiferido({ cargar, yaMontado, montar, abrir }) {
  if (yaMontado) { abrir(); return; }
  try { await cargar(); } catch { /* si falla la red, React.lazy lo reintenta al renderizar */ }
  flushSync(montar);                                       // se monta cerrado y se pinta
  await new Promise((r) => requestAnimationFrame(r));       // un frame con el estado inicial
  abrir();                                                  // …y ahora sí, la transición
}
