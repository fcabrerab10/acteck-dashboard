// Hook responsive alineado a los breakpoints del manual §12:
// mobile 320-767 · tablet 768-1023 · laptop 1024-1439 · desktop 1440-1919 · wide 1920+
import { useEffect, useState } from 'react';

const compute = (w) => {
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  if (w < 1440) return 'laptop';
  if (w < 1920) return 'desktop';
  return 'wide';
};

export function useBreakpoint() {
  const [bp, setBp] = useState(() =>
    typeof window !== 'undefined' ? compute(window.innerWidth) : 'desktop'
  );

  useEffect(() => {
    const onResize = () => setBp(compute(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return bp;
}

export const isMobile     = (bp) => bp === 'mobile';
export const isTablet     = (bp) => bp === 'tablet';
export const isMobileDown = (bp) => bp === 'mobile';
export const isTabletDown = (bp) => bp === 'mobile' || bp === 'tablet';
export const isDesktopUp  = (bp) => bp === 'laptop' || bp === 'desktop' || bp === 'wide';

// Detecta si el dispositivo es principalmente táctil (iPad landscape cae en
// 'laptop' por ancho pero necesita el shell mobile). Devuelve `true` para
// iPhone, iPad (todas las orientaciones) y otros dispositivos coarse pointer.
export function useIsTouch() {
  const [touch, setTouch] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(pointer: coarse)');
    const handler = (e) => setTouch(e.matches);
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else mq.removeListener(handler);
    };
  }, []);
  return touch;
}

// True cuando conviene usar shell mobile: iPhone/iPad en cualquier orientación.
// - mobile / tablet siempre
// - laptop (<1440) sólo si es dispositivo touch (iPad landscape)
// Regla pura (2026-09-28, Fernando: «cuando trabajamos en pantalla dividida se hace la versión del celular»):
// una computadora (puntero fino) a media pantalla —768 a 1023 px— sigue siendo escritorio; el shell móvil sólo
// va en teléfonos (< 768) y en dispositivos táctiles hasta 1439 px (iPad en cualquier orientación).
export const debeUsarShellMovil = (bp, touch) => bp === 'mobile' || ((bp === 'tablet' || bp === 'laptop') && !!touch);
export const useMobileShell = () => {
  const bp = useBreakpoint();
  const touch = useIsTouch();
  return debeUsarShellMovil(bp, touch);
};
