// Pill de estatus · un solo componente para tiers, estatus, deltas y etiquetas.
// tone: green | blue | orange | red | yellow | purple | gray | inverse · dot opcional.
import React from 'react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';

export function toneColors(theme, tone) {
  const dark = theme.mode === 'dark';
  const map = {
    green:  [dark ? 'rgba(48,209,88,0.18)' : 'rgba(52,199,89,0.14)',   dark ? '#30D158' : '#1F7A3D'],
    blue:   [dark ? 'rgba(10,132,255,0.18)' : 'rgba(0,122,255,0.12)',  dark ? '#64B5FF' : '#0A5DC2'],
    orange: [dark ? 'rgba(255,159,10,0.18)' : 'rgba(255,149,0,0.16)',  dark ? '#FF9F0A' : '#9A5500'],
    red:    [dark ? 'rgba(255,69,58,0.18)'  : 'rgba(255,59,48,0.12)',  dark ? '#FF6961' : '#B00020'],
    yellow: [dark ? 'rgba(255,214,10,0.18)' : 'rgba(255,204,0,0.22)',  dark ? '#FFD60A' : '#7A5B00'],
    purple: [dark ? 'rgba(191,90,242,0.18)' : 'rgba(175,82,222,0.14)', dark ? '#DA8FFF' : '#6D2AA0'],
    gray:   [dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',     theme.textMuted],
    inverse:[theme.surfaceInverse || '#000', theme.textOnInverse || '#F5F5F7'],
  };
  return map[tone] || map.gray;
}

export default function Pill({ tone = 'gray', dot = false, size = 'sm', children, onClick, title, style }) {
  const { theme } = useTheme();
  const [bg, col] = toneColors(theme, tone);
  const xs = size === 'xs';
  return (
    <span onClick={onClick} title={title} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: xs ? '1px 6px' : '2px 8px', borderRadius: 999,
      background: bg, color: col, fontFamily: TYPO.fontDisplay, fontSize: xs ? 9.5 : 10.5, fontWeight: 600, letterSpacing: '0.02em',
      whiteSpace: 'nowrap', lineHeight: 1.5, cursor: onClick ? 'pointer' : 'inherit', fontVariantNumeric: 'tabular-nums', ...style,
    }}>
      {dot && <span style={{ width: 5, height: 5, borderRadius: 999, background: 'currentColor', display: 'inline-block', flexShrink: 0 }} />}
      {children}
    </span>
  );
}

// Delta ↑/↓ en pill, verde/rojo (o invertido para métricas donde bajar es bueno).
export function DeltaPill({ value, invert = false, digits = 0, suffix = '%' }) {
  if (value == null || Number.isNaN(value)) return <Pill tone="gray">—</Pill>;
  const good = invert ? value <= 0 : value >= 0;
  return <Pill tone={good ? 'green' : 'red'}>{value >= 0 ? '↑' : '↓'} {Math.abs(value).toFixed(digits)}{suffix}</Pill>;
}
