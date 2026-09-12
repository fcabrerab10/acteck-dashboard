// Hero narrativo · 1 por pantalla. Card inversa (negra en Claro/Marfil, elevada en Midnight).
// eyebrow · frase · sub · hasta 3 HeroStat a la derecha.
import React from 'react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';

// `medida`: tooltip con el nombre y la fórmula oficial (src/lib/medidas.js → tooltip()).
export function HeroStat({ k, v, sub, color, medida }) {
  const { theme } = useTheme();
  const muted = theme.mode === 'dark' ? 'rgba(29,29,31,0.66)' : 'rgba(245,245,247,0.66)';
  return (
    <div title={medida || undefined} style={{ textAlign: 'right', minWidth: 0 }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: muted, fontWeight: 600, whiteSpace: 'nowrap' }}>{k}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: color || (theme.textOnInverse || '#F5F5F7'), lineHeight: 1.15, whiteSpace: 'nowrap' }}>{v}</div>
      {sub != null && <div style={{ fontFamily: TYPO.fontText, fontSize: 10, color: muted, whiteSpace: 'nowrap' }}>{sub}</div>}
    </div>
  );
}

export default function Hero({ eyebrow, titulo, sub, dot = true, stats = [], children, style }) {
  const { theme } = useTheme();
  const bg = theme.surfaceInverse || '#000';
  const text = theme.textOnInverse || '#F5F5F7';
  const muted = theme.mode === 'dark' ? 'rgba(29,29,31,0.66)' : 'rgba(245,245,247,0.66)';
  return (
    <div style={{
      background: bg, color: text, borderRadius: 12, padding: '14px 18px',
      display: 'grid', gridTemplateColumns: `minmax(0, 1fr) repeat(${stats.length}, auto)`, gap: 20, alignItems: 'center',
      fontFamily: TYPO.fontText, ...style,
    }}>
      <div style={{ minWidth: 0 }}>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: muted, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {dot && <span style={{ width: 7, height: 7, borderRadius: 999, background: theme.red || '#FF3B30', display: 'inline-block' }} />}
          {eyebrow}
        </span>
        <h2 style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 600, margin: '3px 0 2px', letterSpacing: '-0.025em', color: text, lineHeight: 1.15 }}>{titulo}</h2>
        {sub && <p style={{ color: muted, fontSize: 11.5, maxWidth: 460, lineHeight: 1.4, margin: 0 }}>{sub}</p>}
        {children}
      </div>
      {stats.map((s, i) => <HeroStat key={i} {...s} />)}
    </div>
  );
}
