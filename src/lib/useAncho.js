// Ancho de un nodo con ResizeObserver, para decidir disposiciones por el ancho REAL del contenedor (no del viewport).
// Devuelve [refCallback, ancho]; 0 mientras no se mide (SSR incluido), así lo que dependa de él queda «como siempre».
import { useEffect, useState } from 'react';

export function useAncho() {
  const [nodo, setNodo] = useState(null);
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    if (!nodo || typeof ResizeObserver === 'undefined') return undefined;
    const medir = () => setAncho(nodo.clientWidth);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(nodo);
    return () => ro.disconnect();
  }, [nodo]);
  return [setNodo, ancho];
}
