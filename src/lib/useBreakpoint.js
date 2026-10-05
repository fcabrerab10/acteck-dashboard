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

// Shell móvil SÓLO en el celular (2026-10-05, Fernando: «en el iPad quiero que se vea como en la laptop; el único con
// estilo celular es el celular tal cual»). Regla pura: dispositivo táctil cuyo lado menor de pantalla mide menos de
// 700 px (iPhone SE 375 … iPhone 17 Pro Max 440). iPad mini (744 × 1133), iPad Pro y cualquier computadora —aunque la
// ventana sea angosta— usan el shell de escritorio (dispositivo.js lo adapta: sidebar en iconos en tabletas).
export const debeUsarShellMovil = (bp, touch, ladoMenor = Infinity) => !!touch && Number(ladoMenor) < 700;

export const useMobileShell = () => {
  useBreakpoint(); // re-render al cambiar de tamaño (orientación)
  const touch = useIsTouch();
  const lado = typeof window !== 'undefined' && window.screen ? Math.min(window.screen.width || Infinity, window.screen.height || Infinity) : Infinity;
  return debeUsarShellMovil(null, touch, lado);
};
