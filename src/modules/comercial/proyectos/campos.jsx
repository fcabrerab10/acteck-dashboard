// Campos de formulario de "Proyectos y abasto" (sólo tokens de tema, nada de Tailwind de color).
import React from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';

export function Campo({ label, hint, children, style }) {
  const { theme } = useTheme();
  return (
    <label style={{ display: 'block', minWidth: 0, ...style }}>
      <span style={{ display: 'block', fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: theme.textMuted, marginBottom: 4 }}>{label}</span>
      {children}
      {hint && <span style={{ display: 'block', fontSize: 10.5, color: theme.textSubtle || theme.textMuted, marginTop: 3 }}>{hint}</span>}
    </label>
  );
}

const baseInput = (theme) => ({
  width: '100%', boxSizing: 'border-box', height: 32, padding: '0 10px', borderRadius: 9,
  border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text,
  fontFamily: TYPO.fontText, fontSize: 12.5, outline: 'none',
});

export function Entrada({ valor, onChange, tipo = 'text', placeholder, disabled, min, style, onEnter }) {
  const { theme } = useTheme();
  return (
    <input type={tipo} value={valor ?? ''} placeholder={placeholder} disabled={disabled} min={min}
      onChange={(e) => onChange?.(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') onEnter?.(e.currentTarget.value); }}
      style={{ ...baseInput(theme), opacity: disabled ? 0.5 : 1, fontVariantNumeric: tipo === 'number' ? 'tabular-nums' : 'normal', ...style }} />
  );
}

export function AreaTexto({ valor, onChange, placeholder, filas = 3, style }) {
  const { theme } = useTheme();
  return (
    <textarea value={valor ?? ''} placeholder={placeholder} rows={filas} onChange={(e) => onChange?.(e.target.value)}
      style={{ ...baseInput(theme), height: 'auto', padding: '8px 10px', resize: 'vertical', lineHeight: 1.45, ...style }} />
  );
}

export function Selector({ valor, onChange, opciones = [], disabled, style }) {
  const { theme } = useTheme();
  return (
    <select value={valor ?? ''} disabled={disabled} onChange={(e) => onChange?.(e.target.value)}
      style={{ ...baseInput(theme), opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer', ...style }}>
      {opciones.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );
}
