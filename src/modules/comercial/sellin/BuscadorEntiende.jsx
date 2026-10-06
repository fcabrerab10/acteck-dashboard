// Buscador «que entiende» para la web (2026-10-06; Fernando: «el buscador que entiende, aplicarlo al armador, Inventario y
// las tablas por SKU»). Mismo motor que el celular (lib/buscarSku.js): interpreta lo escrito como chips (SKU, marca,
// categoría, pulgadas, palabras) y los pinta DENTRO de la pastilla, cada uno con × que quita del texto las palabras que lo
// produjeron. El filtrado lo hace cada pantalla con `coincideSku(fila, interp, fila.indice)`.
import React from 'react';
import { Search, X } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { interpretarBusqueda, quitarChip } from '../../../lib/buscarSku';

export default function BuscadorEntiende({ value, onChange, resultados, categorias = [], placeholder = 'Buscar: AC-9431, monitor 27", balam, teclado inalámbrico…', width = 420, autoFocus = false, title }) {
  const { theme } = useTheme();
  const [focus, setFocus] = React.useState(false);
  const interp = React.useMemo(() => interpretarBusqueda(value, { categorias }), [value, categorias]);
  const chips = value ? interp.chips : [];
  return (
    <div title={title} style={{
      display: 'flex', alignItems: 'center', gap: 6, minHeight: 30, padding: '2px 8px 2px 10px', borderRadius: 9, width, maxWidth: '100%', flexWrap: 'wrap',
      background: theme.surface, border: `1px solid ${focus ? (theme.accent || '#007AFF') : theme.border}`,
      boxShadow: focus ? `0 0 0 3px ${theme.accent || '#007AFF'}22` : 'none', transition: 'border-color 160ms, box-shadow 160ms', fontFamily: TYPO.fontText,
    }}>
      <Search size={13} style={{ color: theme.textMuted, flexShrink: 0 }} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} aria-label="Buscar SKU"
        style={{ flex: 1, minWidth: 120, border: 0, outline: 0, background: 'transparent', fontFamily: TYPO.fontText, fontSize: 12, color: theme.text, height: 24 }} />
      {chips.map((c, i) => (
        <button key={`${c.tipo}-${c.valor}-${i}`} type="button" onClick={() => onChange(quitarChip(value, c, { categorias }))} aria-label={`Quitar ${c.label}`} title="Quitar"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 0, borderRadius: 999, padding: '2px 6px 2px 8px', background: `${theme.accent}1A`, color: theme.accent, fontFamily: TYPO.fontText, fontSize: 10.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {c.label}<X size={10} strokeWidth={2.6} />
        </button>
      ))}
      {resultados != null && value && (
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{resultados}</span>
      )}
      {value && (
        <button type="button" onClick={() => onChange('')} title="Limpiar búsqueda" aria-label="Limpiar búsqueda"
          style={{ width: 18, height: 18, borderRadius: 999, border: 0, cursor: 'pointer', background: theme.mode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)', color: theme.textMuted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <X size={10} />
        </button>
      )}
    </div>
  );
}
