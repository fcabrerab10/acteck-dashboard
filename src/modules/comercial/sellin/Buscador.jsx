// Buscador del Sell In consolidado · busca por cualquier palabra (descripción, marca, categoría, familia,
// roadmap o parte del SKU), sin acentos y en cualquier orden. No cambia el orden de la tabla (roadmap).
import React from 'react';
import { Search, X } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';

export default function Buscador({ value, onChange, resultados, placeholder = 'Buscar: mouse inalámbrico negro, AC-93, teclado balam…', width = 340, autoFocus = false }) {
  const { theme } = useTheme();
  const [focus, setFocus] = React.useState(false);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, height: 30, padding: '0 8px 0 10px', borderRadius: 9, width, maxWidth: '100%',
      background: theme.surface, border: `1px solid ${focus ? (theme.accent || '#007AFF') : theme.border}`,
      boxShadow: focus ? `0 0 0 3px ${theme.accent || '#007AFF'}22` : 'none', transition: 'border-color 160ms, box-shadow 160ms', fontFamily: TYPO.fontText,
    }}>
      <Search size={13} style={{ color: theme.textMuted, flexShrink: 0 }} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} aria-label="Buscar SKU"
        style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', fontFamily: TYPO.fontText, fontSize: 12, color: theme.text }} />
      {resultados != null && value && (
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{resultados}</span>
      )}
      {value && (
        <button type="button" onClick={() => onChange('')} title="Limpiar búsqueda" aria-label="Limpiar búsqueda"
          style={{ width: 18, height: 18, borderRadius: 999, border: 0, cursor: 'pointer', background: theme.mode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)', color: theme.textMuted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}>
          <X size={10} />
        </button>
      )}
    </div>
  );
}
