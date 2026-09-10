// Tokens de movimiento · V3 (2026-09-10).
// Una sola curva (la de iOS) y cinco duraciones según lo que se mueve.
export const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
export const DUR = {
  tap: 140,      // botones y filas al presionar (scale .96)
  state: 220,    // segmented, toggles, chevrons, hover de cards
  content: 260,  // expandir filas, aparecer paneles
  page: 340,     // entrar a una página
  exit: 160,     // salir de una página / cerrar
};
export const STAGGER = 60; // desfase entre cards al entrar
export const t = (prop, ms = DUR.state) => `${prop} ${ms}ms ${EASE}`;
export const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
