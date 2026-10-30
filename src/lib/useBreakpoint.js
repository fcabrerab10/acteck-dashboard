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
    window.addEventListener('orientationchange', onResize);
    return () => { window.removeEventListener('resize', onResize); window.removeEventListener('orientationchange', onResize); };
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

// ─── Shell móvil: ¿celular o web? ─────────────────────────────────────────────────────────────────────────────────
// 2026-10-05 (Fernando): «en el iPad quiero que se vea como en la laptop; el único con estilo celular es el celular».
// 2026-10-28 (iPhone plegable de Apple): pantalla exterior cerrado = app del celular; pantalla interior abierto = la web
//   como en la computadora, y cambia en vivo al abrir/cerrar. En un plegable `screen.width/height` no cambia como el
//   área visible, así que la regla decide por el VIEWPORT DE LAYOUT (innerWidth/innerHeight), no por la pantalla física:
//     · táctil y lado menor del viewport < 700 px CSS → celular (iPhone SE 375 … 17 Pro Max 440 · plegable cerrado ≈ 430).
//     · táctil y lado menor del viewport ≥ 700 → web (plegable abierto ≈ 700–900 por lado · iPad Air/Pro).
//     · no táctil → siempre web, aunque la ventana sea angosta (dispositivo.js la adapta).
//   Se decide con el viewport de layout, NUNCA con visualViewport.height: el teclado en pantalla encoge el visual
//   viewport y no debe cambiar de shell. Y mientras un campo tiene el foco no se re-evalúa.
//   Excepción iPad mini (pantalla física 744 × 1133 o 768 × 1024): vertical = celular, horizontal = web, decidido por la
//   pantalla (en horizontal su viewport queda < 700 por el chrome de Safari y seguiría siendo web).
// Sólo las medidas reales del iPad mini (744×1133 desde el mini 6 · 768×1024 los anteriores): antes era un rango 700–768 y
// atrapaba al iPhone plegable abierto (≈700×1000) como si fuera un iPad mini (2026-10-30).
export const esIpadMini = (ladoMenor, ladoMayor) => (Number(ladoMenor) === 744 && Number(ladoMayor) === 1133) || (Number(ladoMenor) === 768 && Number(ladoMayor) === 1024);
export const debeUsarShellMovil = (bp, touch, ladoMenor = Infinity, { ladoMayor = Infinity, vertical = false, viewportMenor = null } = {}) => {
  if (!touch) return false;
  if (esIpadMini(ladoMenor, ladoMayor)) return !!vertical;
  // 2026-10-30 · iPhone plegable abierto en horizontal: la pantalla mide ≥ 700 por lado pero el viewport de alto queda < 700
  // por las barras de Safari. Basta con que la PANTALLA o el VIEWPORT alcancen 700 en su lado menor para ser web; el
  // celular cerrado no llega a 700 en ninguno de los dos.
  // 2026-10-30 (2): el umbral del VIEWPORT baja a 600: ningún celular cerrado pasa de 440 por su lado menor, y el plegable
  // abierto en horizontal, con las barras de Safari, puede quedarse en 600–700 de alto. La pantalla sigue en 700.
  const vp = Number.isFinite(Number(viewportMenor)) && Number(viewportMenor) > 0 ? Number(viewportMenor) : 0;
  const pantalla = Number.isFinite(Number(ladoMenor)) ? Number(ladoMenor) : 0;
  if (vp >= UMBRAL_VIEWPORT_WEB) return false;
  return pantalla < 700;
};
export const UMBRAL_VIEWPORT_WEB = 600;

// Forzar el shell en ESTE dispositivo (localStorage): 'web' · 'celular' · null = automático. Lo cambia el usuario desde
// el panel del avatar; sirve de red de seguridad para aparatos que reportan medidas raras (plegables nuevos).
const LS_SHELL = 'acteck_shell_forzado_v1';
// También por URL: `?shell=web` · `?shell=celular` · `?shell=auto` (se guarda en este aparato y se limpia de la barra).
(function leerShellDeUrl() {
  try {
    if (typeof window === 'undefined') return;
    const u = new URL(window.location.href);
    const v = u.searchParams.get('shell');
    if (!v) return;
    if (v === 'web' || v === 'celular') localStorage.setItem(LS_SHELL, v); else if (v === 'auto') localStorage.removeItem(LS_SHELL);
    u.searchParams.delete('shell');
    window.history.replaceState(null, '', u.pathname + (u.search || '') + (u.hash || ''));
  } catch { /* sin window o sin storage */ }
})();
export function shellForzado() { try { return localStorage.getItem(LS_SHELL) || null; } catch { return null; } }
export function forzarShell(valor) {
  try { if (valor) localStorage.setItem(LS_SHELL, valor); else localStorage.removeItem(LS_SHELL); } catch { /* sin storage */ }
  try { window.dispatchEvent(new CustomEvent('acteck:shell')); } catch { /* sin window */ }
}
/** Medidas crudas para diagnóstico (avatar › Yo): pantalla y visible en px CSS, táctil, DPR. */
export function medidasDispositivo(win = typeof window !== 'undefined' ? window : null) {
  if (!win) return null;
  return { pantalla: [win.screen?.width || 0, win.screen?.height || 0], visible: [win.innerWidth || 0, win.innerHeight || 0], dpr: win.devicePixelRatio || 1 };
}

/** Lee ventana + pantalla y aplica la regla. Puro salvo por `window`; `touch` se pasa desde useIsTouch. */
export function medirShellMovil(touch, win = typeof window !== 'undefined' ? window : null) {
  if (!win) return false;
  const forzado = shellForzado();
  if (forzado === 'web') return false;
  if (forzado === 'celular') return true;
  const sw = win.screen?.width || Infinity, sh = win.screen?.height || Infinity;
  const iw = Number(win.innerWidth) || 0, ih = Number(win.innerHeight) || 0;
  const viewportMenor = iw > 0 && ih > 0 ? Math.min(iw, ih) : null;
  const vertical = ih > iw;
  return debeUsarShellMovil(null, touch, Math.min(sw, sh), { ladoMayor: Math.max(sw, sh), vertical, viewportMenor });
}

const DEBOUNCE_MS = 120;
const editando = () => {
  if (typeof document === 'undefined') return false;
  const el = document.activeElement;
  if (!el) return false;
  const tag = (el.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable === true;
};

/**
 * ¿Montar la app del celular? Re-evalúa al instante (debounce 120 ms) con resize · orientationchange ·
 * visualViewport.resize · matchMedia('(min-width: 700px)'), que es lo que dispara abrir/cerrar el plegable.
 * Si hay un campo con el foco (teclado en pantalla) se espera al blur para no cambiar de shell a media captura.
 */
export const useMobileShell = () => {
  const touch = useIsTouch();
  const [movil, setMovil] = useState(() => medirShellMovil(touch));
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let timer = null, pendiente = false;
    const medir = () => {
      timer = null;
      if (editando()) { pendiente = true; return; }
      pendiente = false;
      setMovil(medirShellMovil(touch));
    };
    const programar = () => { if (timer) clearTimeout(timer); timer = setTimeout(medir, DEBOUNCE_MS); };
    const alSoltarFoco = () => { if (pendiente) programar(); };
    window.addEventListener('resize', programar);
    window.addEventListener('orientationchange', programar);
    window.addEventListener('acteck:shell', programar);
    window.visualViewport?.addEventListener?.('resize', programar);
    const doc = typeof document !== 'undefined' ? document : null;
    doc?.addEventListener('focusout', alSoltarFoco);
    const mq = window.matchMedia ? window.matchMedia('(min-width: 700px)') : null;
    if (mq?.addEventListener) mq.addEventListener('change', programar); else mq?.addListener?.(programar);
    medir();
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('resize', programar);
      window.removeEventListener('orientationchange', programar);
      window.removeEventListener('acteck:shell', programar);
      window.visualViewport?.removeEventListener?.('resize', programar);
      doc?.removeEventListener('focusout', alSoltarFoco);
      if (mq?.removeEventListener) mq.removeEventListener('change', programar); else mq?.removeListener?.(programar);
    };
  }, [touch]);
  return movil;
};
