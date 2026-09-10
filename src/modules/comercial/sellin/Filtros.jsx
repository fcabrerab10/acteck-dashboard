// Filtros del Sell In consolidado · pills con conteo, combinables, botón Limpiar.
// grupos: [{ id, label, opciones: [{ id, label, n, tone? }], sel: Set }]   (multi-selección por grupo)
// toggles: [{ id, label, on, n }]                                          (banderas: sólo con venta, sólo con stock)
// Los conteos (n) los calcula el padre con los DEMÁS filtros aplicados.
import React from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { toneColors } from '../../../components/kit';

function PillFiltro({ label, n, on, tone, onClick, disabled }) {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  const [bgTone, colTone] = toneColors(theme, tone || 'gray');
  const accent = theme.accent || '#007AFF';
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={on}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, height: 24, padding: '0 9px', borderRadius: 999, cursor: disabled ? 'not-allowed' : 'pointer',
        border: `1px solid ${on ? accent : theme.border}`, background: on ? accent : (tone ? bgTone : theme.surface),
        color: on ? '#FFF' : disabled ? (theme.textSubtle || theme.textMuted) : (tone ? colTone : theme.text),
        fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: on ? 700 : 500, letterSpacing: '-0.005em', whiteSpace: 'nowrap', opacity: disabled && !on ? 0.55 : 1,
        transition: 'background 160ms, color 160ms, border-color 160ms',
      }}>
      {label}
      {n != null && (
        <span style={{ fontSize: 9.5, padding: '0 5px', borderRadius: 999, fontVariantNumeric: 'tabular-nums', fontWeight: 600,
          background: on ? 'rgba(255,255,255,0.22)' : (dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)'), color: on ? '#FFF' : theme.textMuted }}>{n}</span>
      )}
    </button>
  );
}

export default function Filtros({ grupos = [], toggles = [], onToggle, onToggleFlag, onLimpiar, activos = 0, style }) {
  const { theme } = useTheme();
  const lbl = { fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600, whiteSpace: 'nowrap', marginRight: 2 };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: TYPO.fontText, ...style }}>
      {grupos.map((g) => (
        <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', minHeight: 24 }}>
          <span style={{ ...lbl, width: 64 }}>{g.label}</span>
          {g.opciones.map((o) => (
            <PillFiltro key={o.id} label={o.label} n={o.n} on={g.sel.has(o.id)} tone={o.tone} disabled={!o.n && !g.sel.has(o.id)} onClick={() => onToggle(g.id, o.id)} />
          ))}
          {g.opciones.length === 0 && <span style={{ fontSize: 11, color: theme.textSubtle || theme.textMuted }}>Sin opciones</span>}
        </div>
      ))}
      {(toggles.length > 0 || activos > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', minHeight: 24 }}>
          <span style={{ ...lbl, width: 64 }}>Mostrar</span>
          {toggles.map((t) => <PillFiltro key={t.id} label={t.label} n={t.n} on={t.on} disabled={!t.n && !t.on} onClick={() => onToggleFlag(t.id)} />)}
          {activos > 0 && (
            <button type="button" onClick={onLimpiar}
              style={{ marginLeft: 6, display: 'inline-flex', alignItems: 'center', gap: 4, height: 24, padding: '0 9px', borderRadius: 999, border: 0, cursor: 'pointer', background: theme.surfaceInverse || '#000', color: theme.textOnInverse || '#F5F5F7', fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600 }}>
              <X size={10} /> Limpiar {activos > 1 ? `(${activos})` : ''}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
