// Panel · contenedor de sección (radio 12, hairline) con título, meta y acciones; plegable opcional.
// `elevable`: al pasar el cursor toma la sombra ELEV.hover (para paneles clicables o destacados).
// `onToggle(abierto)`: avisa al padre al plegar/desplegar (para montar contenido pesado sólo al abrir).
import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';
import { elevation } from '../../lib/elevation';

export default function Panel({ titulo, meta, acciones, children, plegable = false, abiertoInicial = true, elevable = false, padding = '10px 12px', style, id, onToggle }) {
  const { theme } = useTheme();
  const [abierto, setAbierto] = useState(abiertoInicial);
  const [hover, setHover] = useState(false);
  const open = plegable ? abierto : true;
  const alternar = () => { const n = !abierto; setAbierto(n); onToggle?.(n); };
  return (
    <div id={id} onMouseEnter={elevable ? () => setHover(true) : undefined} onMouseLeave={elevable ? () => setHover(false) : undefined}
      style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, fontFamily: TYPO.fontText,
        boxShadow: elevation(theme, elevable && hover ? 'hover' : 'reposo'), transition: `box-shadow ${DUR.state}ms ${EASE}`, ...style }}>
      {(titulo || acciones) && (
        <div onClick={plegable ? alternar : undefined}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 12px', cursor: plegable ? 'pointer' : 'default', borderBottom: open && children ? `1px solid ${theme.border}` : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {plegable && <ChevronDown size={13} style={{ color: theme.textMuted, transform: open ? 'rotate(0)' : 'rotate(-90deg)', transition: `transform ${DUR.state}ms ${EASE}` }} />}
            <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, letterSpacing: '-0.01em', color: theme.text, whiteSpace: 'nowrap' }}>{titulo}</span>
            {meta && <span style={{ fontSize: 10.5, color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta}</span>}
          </div>
          {acciones && <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>{acciones}</div>}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: `grid-template-rows ${DUR.content}ms ${EASE}` }}>
        <div style={{ overflow: 'hidden' }}><div style={{ padding }}>{children}</div></div>
      </div>
    </div>
  );
}
