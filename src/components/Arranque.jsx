// Arranque en frío (3.68.0): «acteck.» con el punto azul latiendo sobre el fondo del tema, mientras se
// comprueba la sesión. Con `saliendo` se desvanece (500 ms) y debajo ya entran las tarjetas (ver lib/entrada.js).
// Usa las variables que index.html pinta antes de React (--t-bg / --t-text): no hay destello de color.
import React from 'react';

const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

export default function Arranque({ saliendo = false }) {
  return (
    <div aria-hidden style={{
      position: 'fixed', inset: 0, zIndex: 300, display: 'grid', placeItems: 'center',
      background: 'var(--t-bg, #F5F5F7)', color: 'var(--t-text, #1D1D1F)',
      opacity: saliendo ? 0 : 1, transition: `opacity 500ms ${EASE}`, pointerEvents: saliendo ? 'none' : 'auto',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif',
      WebkitFontSmoothing: 'antialiased',
    }}>
      <style>{`
        @keyframes arranquePunto { 0%, 100% { transform: scale(1); filter: none; } 50% { transform: scale(1.5); filter: drop-shadow(0 0 14px rgba(10,132,255,.9)); } }
        @media (prefers-reduced-motion: reduce) { .arranque-punto { animation: none !important; } }
      `}</style>
      <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, userSelect: 'none' }}>
        acteck<span className="arranque-punto" style={{ display: 'inline-block', color: '#0A84FF', transformOrigin: '50% 60%', animation: `arranquePunto 950ms ${EASE} infinite` }}>.</span>
      </div>
    </div>
  );
}
