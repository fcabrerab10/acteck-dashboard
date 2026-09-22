// Ajuste automático del ancho de las columnas de mes en Detalle por SKU.
// Regla de ancho (Fernando, 2026-09-22): la tabla cabe en su tarjeta, nunca se navega
// lateralmente. Con dos años seleccionados (24 meses) a 1440 px no cabía a 38 px por mes,
// así que se mide el contenedor y se reparte el espacio: 38 px cuando sobra, hasta 26 px
// cuando falta, con la descripción recortada a 150 px y tipografía 10 px en modo compacto.
import { useEffect, useState } from 'react';

export const ANCHO_MES_MAX = 38;
export const ANCHO_MES_MIN = 26;

export function calcularAnchoMes(anchoContenedor, nMeses, fijos, descNormal = 200, descCompacta = 150) {
  if (!anchoContenedor || !nMeses) return { anchoMes: ANCHO_MES_MAX, compacto: false, desc: descNormal };
  const libre = (desc) => anchoContenedor - fijos - desc - 2;
  let anchoMes = Math.floor(libre(descNormal) / nMeses);
  if (anchoMes >= ANCHO_MES_MAX) return { anchoMes: ANCHO_MES_MAX, compacto: false, desc: descNormal };
  anchoMes = Math.floor(libre(descCompacta) / nMeses);
  return { anchoMes: Math.max(ANCHO_MES_MIN, Math.min(ANCHO_MES_MAX, anchoMes)), compacto: true, desc: descCompacta };
}

/** Mide el contenedor (ref) y devuelve { anchoMes, compacto, desc } para nMeses columnas. */
export function useAnchoMes(ref, nMeses, fijos) {
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const medir = () => setAncho(el.clientWidth);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return calcularAnchoMes(ancho, nMeses, fijos);
}
