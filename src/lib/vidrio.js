// Vidrio del chrome · deslizador de 3 paradas (aprobado por Fernando, 2026-09-22).
//
//   Opaco (default)  = EXACTAMENTE como siempre. No se define ninguna variable: cada pieza
//                      del chrome resuelve el fallback de su `var(--vidrio-*, …)`, que es su
//                      literal de toda la vida. Cero regresión.
//   Tintado          = el color del tema al 60 % + blur 10px.
//   Vidrio           = 8 % blanco sobre oscuro / 55 % blanco sobre claro + blur 16px + saturate(120 %)
//                      + hairline luminoso + luz interna arriba (los mismos tokens que la pastilla
//                      "A · Vidrio" de components/nav/Resaltado.jsx).
//
// SÓLO toca el chrome: barras, sidebar, cajón, hojas, modales y la paleta ⌘K. El contenido
// (Hero, KpiCard, Panel, tablas) no lee estas variables.
//
// La preferencia es POR DISPOSITIVO (localStorage, no por usuario): setPrefDispositivo(modo, 'vidrio', …).
// Con prefers-reduced-transparency o prefers-reduced-motion se fuerza Opaco.
//
//   function App() { useVidrio(); … }      // una sola vez, en la raíz
import { useEffect } from 'react';
import { useTheme } from './themeContext';
import { useDispositivo, usePrefsDispositivo } from './dispositivo';

export const NIVELES_VIDRIO = [
  { id: 'opaco',   label: 'Opaco',   desc: 'Como siempre: barras y hojas sólidas.' },
  { id: 'tintado', label: 'Tintado', desc: 'El color del tema translúcido, con desenfoque suave.' },
  { id: 'vidrio',  label: 'Vidrio',  desc: 'Cristal esmerilado con borde luminoso (como la pastilla del menú).' },
];
export const VIDRIO_DEFECTO = 'opaco';
export const esNivelVidrio = (v) => NIVELES_VIDRIO.some((n) => n.id === v);

// Las `-oscuro` son para el chrome que SIEMPRE es oscuro (la barra estilo apple.com): ahí el vidrio
// claro dejaría el texto blanco ilegible, así que se tinta en negro con el mismo desenfoque.
/** Claves que se escriben en documentElement. Se BORRAN en 'opaco'. */
export const VARS_VIDRIO = [
  '--vidrio-bg', '--vidrio-blur', '--vidrio-border', '--vidrio-shine',
  '--vidrio-bg-oscuro', '--vidrio-border-oscuro', '--vidrio-shine-oscuro',
];

const esOscuro = (theme) => theme?.mode === 'dark' || theme?.key === 'midnight';
const esMarfil = (theme) => theme?.key === 'marfil';

// Luz interna + hairline del mockup "Vidrio" (misma familia que estiloVidrio de Resaltado.jsx).
const BRILLO_OSCURO = 'inset 0 0 0 .5px rgba(255,255,255,.18), inset 0 1px 0 rgba(255,255,255,.22)';
const BRILLO_CLARO  = 'inset 0 0 0 .5px rgba(255,255,255,.7), inset 0 1px 0 rgba(255,255,255,.9)';

/**
 * Variables CSS de un nivel. `opaco` → {} (no se define nada: mandan los fallbacks).
 * Pura y testeable: no toca el DOM.
 */
export function varsVidrio(nivel, theme) {
  const dark = esOscuro(theme);
  if (nivel === 'tintado') {
    return {
      '--vidrio-bg': dark ? 'rgba(28,28,30,0.60)' : esMarfil(theme) ? 'rgba(255,251,244,0.60)' : 'rgba(255,255,255,0.60)',
      '--vidrio-blur': 'saturate(180%) blur(10px)',
      '--vidrio-border': `1px solid ${dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)'}`,
      '--vidrio-shine': '0 0 0 0 rgba(0,0,0,0)',
      '--vidrio-bg-oscuro': 'rgba(29,29,31,0.60)',
      '--vidrio-border-oscuro': '1px solid rgba(255,255,255,0.10)',
      '--vidrio-shine-oscuro': '0 0 0 0 rgba(0,0,0,0)',
    };
  }
  if (nivel === 'vidrio') {
    return {
      '--vidrio-bg': dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.55)',
      '--vidrio-blur': 'saturate(120%) blur(16px)',
      '--vidrio-border': `1px solid ${dark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.70)'}`,
      '--vidrio-shine': dark ? BRILLO_OSCURO : BRILLO_CLARO,
      '--vidrio-bg-oscuro': 'rgba(29,29,31,0.55)',
      '--vidrio-border-oscuro': '1px solid rgba(255,255,255,0.16)',
      '--vidrio-shine-oscuro': BRILLO_OSCURO,
    };
  }
  return {};
}

/** ¿El sistema pide menos transparencia / movimiento? Entonces mandamos Opaco. */
export function sistemaPideOpaco() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  const m = (q) => { try { return !!window.matchMedia(q).matches; } catch { return false; } };
  return m('(prefers-reduced-transparency: reduce)') || m('(prefers-reduced-motion: reduce)');
}

/** Nivel que de verdad se aplica (respeta las preferencias del sistema). */
export function nivelEfectivo(nivel, { forzarOpaco = false } = {}) {
  if (forzarOpaco) return 'opaco';
  return esNivelVidrio(nivel) ? nivel : VIDRIO_DEFECTO;
}

/** Escribe (o borra) las variables en <html>. En 'opaco' las borra: todo queda como siempre. */
export function aplicarVidrio(nivel, theme) {
  if (typeof document === 'undefined') return;
  const raiz = document.documentElement;
  if (!raiz || !raiz.style || typeof raiz.style.setProperty !== 'function') return;
  const vars = varsVidrio(nivel, theme);
  VARS_VIDRIO.forEach((k) => {
    if (vars[k] != null) raiz.style.setProperty(k, vars[k]);
    else raiz.style.removeProperty?.(k);
  });
  if (raiz.dataset) raiz.dataset.vidrio = Object.keys(vars).length ? nivel : 'opaco';
}

/** Hook de raíz: lee la preferencia de ESTE dispositivo y la aplica. Devuelve el nivel efectivo. */
export function useVidrio() {
  const { theme } = useTheme();
  const { modo } = useDispositivo();
  const prefs = usePrefsDispositivo();
  const nivel = nivelEfectivo(prefs.vidrio, { forzarOpaco: sistemaPideOpaco() });
  useEffect(() => { aplicarVidrio(nivel, theme); }, [nivel, theme]);
  useEffect(() => () => aplicarVidrio('opaco', theme), []); // eslint-disable-line react-hooks/exhaustive-deps
  return { nivel, modo };
}

export default useVidrio;
