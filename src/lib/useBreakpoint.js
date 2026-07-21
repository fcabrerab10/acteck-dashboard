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
