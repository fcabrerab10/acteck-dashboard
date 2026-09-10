// Hero móvil · card inversa (negra en Claro/Marfil, clara en Midnight), radio 12, frase + hasta 3 stats abajo.
import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';

export default function HeroM({ eyebrow, frase, sub, stats = [], children, onClick, style }) {
  const { theme } = useTheme();
  const bg = theme.surfaceInverse || theme.surfaceDark;
  const text = theme.textOnInverse || theme.textOnDark;
  const muted = theme.mode === 'dark' ? 'rgba(29,29,31,0.62)' : 'rgba(245,245,247,0.62)';
  const hair = theme.mode === 'dark' ? 'rgba(29,29,31,0.12)' : 'rgba(245,245,247,0.14)';
  return (
    <div onClick={onClick} role={onClick ? 'button' : undefined}
      style={{ background: bg, color: text, borderRadius: 12, padding: '16px 18px 14px', margin: '0 16px', fontFamily: TYPO.fontText, position: 'relative', cursor: onClick ? 'pointer' : 'default', transition: `transform ${DUR.tap}ms ${EASE}`, ...style }}>
      {eyebrow && (
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: muted, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: theme.red, display: 'inline-block' }} />{eyebrow}
        </div>
      )}
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 19, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.2, margin: '4px 0 0', paddingRight: onClick ? 18 : 0 }}>{frase}</div>
      {sub && <div style={{ fontSize: 12, color: muted, marginTop: 4, lineHeight: 1.4 }}>{sub}</div>}
      {children}
      {stats.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.length}, minmax(0,1fr))`, gap: 12, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${hair}` }}>
          {stats.map((s, i) => (
            <div key={i} style={{ minWidth: 0 }}>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.k}</div>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: s.color || text, lineHeight: 1.15, whiteSpace: 'nowrap' }}>{s.v}</div>
              {s.sub != null && <div style={{ fontSize: 10.5, color: muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.sub}</div>}
            </div>
          ))}
        </div>
      )}
      {onClick && <ChevronRight size={16} style={{ position: 'absolute', top: 16, right: 14, color: muted }} />}
    </div>
  );
}
