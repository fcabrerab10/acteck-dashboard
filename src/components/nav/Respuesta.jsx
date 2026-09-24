// Tarjeta de respuesta de «Buscar o preguntar» (web, dentro de la paleta ⌘K). Cifra grande, sub,
// hasta 5 renglones, botón «Abrir …» y enlaces «También». Mientras carga, silueta.
import React from 'react';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';
import { hairline, hoverBg } from './comun';

export default function Respuesta({ r, cargando, theme, on, onAbrir, onIr }) {
  const borde = `1px solid ${hairline(theme)}`;
  if (cargando && !r) {
    return (
      <div style={{ margin: 6, padding: '12px 14px', borderRadius: 10, border: borde, background: hoverBg(theme) }}>
        <div style={{ height: 9, width: 160, borderRadius: 4, background: theme.border, opacity: 0.6 }} />
        <div style={{ height: 24, width: 110, borderRadius: 6, background: theme.border, opacity: 0.5, marginTop: 10 }} />
        <div style={{ height: 9, width: 220, borderRadius: 4, background: theme.border, opacity: 0.4, marginTop: 8 }} />
      </div>
    );
  }
  if (!r) return null;
  return (
    <div data-respuesta style={{ margin: 6, padding: '12px 14px', borderRadius: 10, border: `1px solid ${on ? theme.accent : hairline(theme)}`, background: on ? (theme.accentBg || 'rgba(0,122,255,0.08)') : hoverBg(theme), transition: `border-color ${DUR.tap}ms ${EASE}, background ${DUR.tap}ms ${EASE}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: theme.textSubtle || theme.textMuted }}>
        <Sparkles size={11} />{r.titulo}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', color: r.error ? theme.red || '#FF3B30' : theme.text }}>{r.cifra}</span>
        {r.sub && <span style={{ fontSize: 12, color: theme.textMuted }}>{r.sub}</span>}
      </div>
      {r.lineas?.length > 0 && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {r.lineas.map((l, i) => <div key={i} style={{ fontSize: 12, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l}</div>)}
        </div>
      )}
      {(r.abrir || r.tambien?.length > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {r.abrir && (
            <button type="button" onClick={() => onAbrir?.(r.abrir)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8, border: 0, background: theme.accent, color: '#FFF', fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {r.abrir.label}<ArrowUpRight size={12} />
            </button>
          )}
          {r.tambien?.length > 0 && (
            <span style={{ fontSize: 11.5, color: theme.textMuted, display: 'inline-flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              También:
              {r.tambien.map((t, i) => (
                <button key={i} type="button" onClick={() => onIr?.(t)} style={{ border: 0, background: 'transparent', padding: '2px 4px', color: theme.accent, fontFamily: TYPO.fontText, fontSize: 11.5, cursor: 'pointer' }}>{t.label}{i < r.tambien.length - 1 ? ' ·' : ''}</button>
              ))}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Chips de ejemplo cuando la paleta está vacía. */
export function Sugerencias({ lista, theme, onElegir }) {
  return (
    <div style={{ padding: '6px 10px 10px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {lista.map((s) => (
        <button key={s} type="button" onClick={() => onElegir(s)} style={{ border: `1px solid ${hairline(theme)}`, background: 'transparent', color: theme.textMuted, borderRadius: 999, padding: '4px 10px', fontFamily: TYPO.fontText, fontSize: 11.5, cursor: 'pointer' }}>{s}</button>
      ))}
    </div>
  );
}
