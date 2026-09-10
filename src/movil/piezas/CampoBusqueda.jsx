// Campo de búsqueda iOS (36 px, fondo gris, lupa, botón borrar). autoFocus opcional.
import React, { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';

export default function CampoBusqueda({ value, onChange, placeholder = 'Buscar', autoFocus = false, onSubmit, style }) {
  const { theme } = useTheme();
  const ref = useRef(null);
  useEffect(() => { if (autoFocus) { const t = setTimeout(() => ref.current?.focus(), 380); return () => clearTimeout(t); } }, [autoFocus]);
  const dark = theme.mode === 'dark';
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 10px', borderRadius: 11, background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(120,120,128,0.12)', ...style }}>
      <Search size={16} style={{ color: theme.textMuted, flexShrink: 0 }} />
      <input ref={ref} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" autoCorrect="off" autoCapitalize="characters" spellCheck={false} enterKeyHint="search"
        onKeyDown={(e) => { if (e.key === 'Enter') { onSubmit?.(value); e.currentTarget.blur(); } }}
        style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', fontFamily: TYPO.fontText, fontSize: 16, color: theme.text }} />
      {value && (
        <button type="button" onClick={() => { onChange(''); ref.current?.focus(); }} aria-label="Borrar"
          style={{ width: 20, height: 20, borderRadius: 999, border: 0, background: theme.textSubtle || theme.textMuted, color: theme.surface, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer', flexShrink: 0 }}>
          <X size={12} strokeWidth={3} />
        </button>
      )}
    </label>
  );
}
