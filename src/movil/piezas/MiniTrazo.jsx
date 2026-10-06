// Mini trazo (sparkline) de 56×18 para las filas de lista: 6 meses de un cliente, una sucursal, un vendedor…
// `puntos` = números (los null se saltan); `color` manda (verde/rojo por tendencia lo decide quien lo pinta).
import React from 'react';
import { useTheme } from '../../lib/themeContext';

export default function MiniTrazo({ puntos = [], color, w = 56, h = 18, grosor = 1.6, style }) {
  const { theme } = useTheme();
  const vals = puntos.map((v) => (v == null || Number.isNaN(Number(v)) ? null : Number(v)));
  const con = vals.filter((v) => v != null);
  if (con.length < 2) return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ flexShrink: 0, ...style }} aria-hidden />;
  const max = Math.max(...con), min = Math.min(...con), rango = max - min || 1;
  const n = vals.length;
  let d = '';
  vals.forEach((v, i) => {
    if (v == null) return;
    const x = (i / (n - 1)) * (w - 2) + 1, y = h - 2 - ((v - min) / rango) * (h - 4);
    d += `${d ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ flexShrink: 0, display: 'block', ...style }} aria-hidden>
      <path d={d} fill="none" stroke={color || theme.accent} strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
