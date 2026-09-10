// Botón pill · primario (accent) o secundario (hairline). Scale .96 al presionar; el primario toma ELEV.hover al pasar el cursor.
import React, { useState } from 'react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';
import { elevation } from '../../lib/elevation';

export default function Boton({ children, primario = false, peligro = false, icon: Icon, size = 'sm', onClick, disabled, title, style, type = 'button' }) {
  const { theme } = useTheme();
  const [down, setDown] = useState(false);
  const [hover, setHover] = useState(false);
  const accent = peligro ? (theme.red || '#FF3B30') : (theme.accent || '#007AFF');
  const h = size === 'md' ? 34 : 28;
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title}
      onMouseDown={() => setDown(true)} onMouseUp={() => setDown(false)} onMouseLeave={() => { setDown(false); setHover(false); }} onMouseEnter={() => setHover(true)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, height: h, padding: size === 'md' ? '0 16px' : '0 12px', borderRadius: 999,
        border: `1px solid ${primario ? accent : theme.border}`, background: primario ? accent : hover ? (theme.surfaceHover || 'rgba(0,0,0,0.03)') : theme.surface,
        color: primario ? '#FFF' : peligro ? accent : theme.text, fontFamily: TYPO.fontText, fontSize: size === 'md' ? 13 : 12, fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1, whiteSpace: 'nowrap',
        boxShadow: elevation(theme, primario && hover && !down && !disabled ? 'hover' : 'reposo'),
        transform: down && !disabled ? 'scale(0.96)' : 'scale(1)', transition: `transform ${DUR.tap}ms ${EASE}, background ${DUR.state}ms ${EASE}, box-shadow ${DUR.state}ms ${EASE}`, ...style,
      }}>
      {Icon && <Icon size={size === 'md' ? 14 : 13} strokeWidth={2} />}
      {children}
    </button>
  );
}
