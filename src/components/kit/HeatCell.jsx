// Celda de heatmap Pareto · 5 intensidades relativas al máximo de la fila (extraída de SellInDrillDown).
import React from 'react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';

export const nivel = (v, max) => { if (!v || !max) return 0; const r = v / max; return r >= 0.85 ? 5 : r >= 0.6 ? 4 : r >= 0.4 ? 3 : r >= 0.2 ? 2 : 1; };

export default function HeatCell({ v, max, fmt = (n) => Math.round(n).toLocaleString('es-MX') }) {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  if (!v || v <= 0) return <span style={{ color: theme.textSubtle || theme.textMuted, fontSize: 11 }}>—</span>;
  const lv = nivel(v, max);
  const base = dark ? '100,210,255' : '0,122,255';
  const alpha = [0, 0.08, 0.18, 0.32, 0.55, 1][lv];
  const bg = lv === 5 ? (dark ? '#64D2FF' : theme.accent || '#007AFF') : `rgba(${base},${alpha})`;
  const col = lv >= 3 ? (dark ? '#000' : '#FFF') : theme.text;
  return (
    <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 999, background: bg, color: col, fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums', fontSize: 11, fontWeight: lv >= 4 ? 700 : 500, letterSpacing: '-0.01em', minWidth: 32, textAlign: 'center', lineHeight: 1.3 }}>{fmt(v)}</span>
  );
}
