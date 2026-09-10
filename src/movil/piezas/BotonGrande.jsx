// Botón grande de acción (50 px, radio 12). primario = accent · secundario = superficie con hairline · peligro = rojo.
import React, { useState } from 'react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';

export default function BotonGrande({ children, icon: Icon, primario = false, peligro = false, disabled = false, onClick, style }) {
  const { theme } = useTheme();
  const [down, setDown] = useState(false);
  const accent = peligro ? theme.red : theme.accent;
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      onTouchStart={() => setDown(true)} onTouchEnd={() => setDown(false)} onTouchCancel={() => setDown(false)}
      onMouseDown={() => setDown(true)} onMouseUp={() => setDown(false)} onMouseLeave={() => setDown(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: 50, borderRadius: 12,
        border: primario ? 0 : `1px solid ${theme.border}`, background: primario ? accent : theme.surface,
        color: primario ? (theme.textOnDark || '#FFF') : peligro ? accent : theme.text,
        fontFamily: TYPO.fontDisplay, fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em',
        opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer',
        transform: down && !disabled ? 'scale(0.97)' : 'scale(1)', transition: `transform ${DUR.tap}ms ${EASE}, opacity ${DUR.state}ms ${EASE}`, ...style,
      }}>
      {Icon && <Icon size={18} strokeWidth={2.2} />}{children}
    </button>
  );
}
