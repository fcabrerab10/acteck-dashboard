// Resaltado del ítem activo en los menús · "A · Vidrio" (aprobado 2026-09-11).
//
// UNA sola pastilla de vidrio esmerilado detrás del elemento activo, que se DESLIZA a su nueva posición
// en DUR.state (220 ms) con EASE. Sin color de acento: el texto y el icono se quedan en theme.text con
// peso 600, para no competir con las pills de estado ni con los heros negros.
//
//   const res = useResaltadoDeslizante(activoKey, { radio: 999, plano: false });
//   <div ref={res.refContenedor} style={{ position: 'relative', … }}>
//     {res.pastilla}
//     {items.map((i) => <button key={i.id} ref={res.refItem(i.id)} style={{ position: 'relative', … }} />)}
//   </div>
//
// La pastilla se mide con getBoundingClientRect del ítem activo relativo al contenedor (+ scroll del
// contenedor, para que las coordenadas sean de contenido y no salten al hacer scroll). Se recalcula al
// cambiar el activo, al redimensionar (ResizeObserver del contenedor y del ítem), al hacer scroll del
// contenedor y con las fuentes cargadas. Con prefers-reduced-motion no hay transición.
//
// Cuando no se puede deslizar (listas virtualizadas, hojas con varios contenedores, filas sueltas) se usa
// el mismo estilo estático: estiloVidrio(theme, { plano }).
//   · plano: superficies blancas planas (sidebar iPad, cajón claro, listas de la hoja) donde el vidrio
//     translúcido casi no contrasta → fondo rgba(0,0,0,.05) con las mismas luces internas.
//   · oscuro: chrome siempre oscuro (barra apple.com) aunque el tema sea Claro.
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { EASE, DUR, reduceMotion } from '../../lib/motion';

// Copia local de esMidnight (comun.jsx importa este archivo: se evita la dependencia circular).
const esMidnight = (theme) => theme?.key === 'midnight' || theme?.mode === 'dark';

const SOMBRA_CLARO = 'inset 0 0 0 .5px rgba(255,255,255,.7), inset 0 1px 0 rgba(255,255,255,.9), 0 1px 2px rgba(0,0,0,.06), 0 4px 12px rgba(0,0,0,.08)';
const SOMBRA_OSCURO = 'inset 0 0 0 .5px rgba(255,255,255,.18), inset 0 1px 0 rgba(255,255,255,.22), 0 1px 2px rgba(0,0,0,.4), 0 6px 16px rgba(0,0,0,.45)';
const BLUR = 'blur(14px) saturate(160%)';

/** Estilo de la pastilla de vidrio (mockup A). `plano` para superficies blancas planas; `oscuro` fuerza la variante oscura. */
export function estiloVidrio(theme, { plano = false, oscuro = false, radio } = {}) {
  const dark = oscuro || esMidnight(theme);
  return {
    background: dark ? 'rgba(255,255,255,.12)' : plano ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.55)',
    backdropFilter: BLUR,
    WebkitBackdropFilter: BLUR,
    boxShadow: dark ? SOMBRA_OSCURO : SOMBRA_CLARO,
    ...(radio != null ? { borderRadius: radio } : null),
  };
}

/**
 * Pastilla única que se desliza al ítem activo.
 * @param activoKey clave del ítem activo (la misma que se pasó a refItem); null = sin pastilla.
 * @param opts { theme, radio, plano, oscuro, inset, deps }
 * @returns { refContenedor, refItem, pastilla, remedir, caja }
 */
export function useResaltadoDeslizante(activoKey, opts = {}) {
  const { theme, radio = 999, plano = false, oscuro = false, inset = 0, deps } = opts;
  const refContenedor = useRef(null);
  const elementos = useRef(new Map());   // key → elemento
  const callbacks = useRef(new Map());   // key → ref callback memoizado
  const [caja, setCaja] = useState(null);
  const [animar, setAnimar] = useState(false);
  const cajaRef = useRef(null);

  const medir = useCallback(() => {
    const cont = refContenedor.current;
    const el = activoKey != null ? elementos.current.get(activoKey) : null;
    if (!cont || !el || !el.isConnected) { cajaRef.current = null; setCaja(null); setAnimar(false); return; }
    const c = cont.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) { cajaRef.current = null; setCaja(null); setAnimar(false); return; }
    const nueva = {
      x: Math.round(r.left - c.left + cont.scrollLeft) + inset,
      y: Math.round(r.top - c.top + cont.scrollTop) + inset,
      w: Math.round(r.width) - inset * 2,
      h: Math.round(r.height) - inset * 2,
    };
    const prev = cajaRef.current;
    if (prev && prev.x === nueva.x && prev.y === nueva.y && prev.w === nueva.w && prev.h === nueva.h) return;
    cajaRef.current = nueva;
    setCaja(nueva);
  }, [activoKey, inset]);

  const refItem = useCallback((key) => {
    let cb = callbacks.current.get(key);
    if (!cb) {
      cb = (el) => { if (el) elementos.current.set(key, el); else elementos.current.delete(key); };
      callbacks.current.set(key, cb);
    }
    return cb;
  }, []);

  // Medida inicial y en cada cambio de activo / dependencias del que lo dibuja.
  useLayoutEffect(() => { medir(); }, [medir, deps]); // eslint-disable-line react-hooks/exhaustive-deps

  // La primera vez aparece sin deslizarse (fade); a partir de ahí sí anima.
  useEffect(() => {
    if (!caja) { setAnimar(false); return undefined; }
    if (animar) return undefined;
    const t = setTimeout(() => setAnimar(true), 40);
    return () => clearTimeout(t);
  }, [caja, animar]);

  // Tamaño del contenedor y del ítem activo · scroll del contenedor · fuentes.
  useEffect(() => {
    const cont = refContenedor.current;
    if (!cont) return undefined;
    const el = activoKey != null ? elementos.current.get(activoKey) : null;
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => medir());
      ro.observe(cont);
      if (el) ro.observe(el);
    }
    const onScroll = () => medir();
    cont.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    document.fonts?.ready?.then(() => medir()).catch(() => {});
    const raf = requestAnimationFrame(() => medir());
    return () => {
      ro?.disconnect();
      cont.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [medir, activoKey]);

  const sinMovimiento = reduceMotion();
  const pastilla = useMemo(() => (
    <span aria-hidden data-resaltado style={{
      position: 'absolute', left: 0, top: 0, zIndex: 0, pointerEvents: 'none', borderRadius: radio,
      width: caja?.w || 0, height: caja?.h || 0,
      transform: `translate3d(${caja?.x || 0}px, ${caja?.y || 0}px, 0)`,
      opacity: caja ? 1 : 0,
      ...estiloVidrio(theme, { plano, oscuro }),
      transition: sinMovimiento || !animar
        ? `opacity ${DUR.state}ms ${EASE}`
        : `transform ${DUR.state}ms ${EASE}, width ${DUR.state}ms ${EASE}, height ${DUR.state}ms ${EASE}, opacity ${DUR.state}ms ${EASE}`,
      willChange: 'transform, width, height',
    }} />
  ), [caja, theme, radio, plano, oscuro, animar, sinMovimiento]);

  return { refContenedor, refItem, pastilla, remedir: medir, caja };
}

export default useResaltadoDeslizante;
