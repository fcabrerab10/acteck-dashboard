// Trazo de tendencia para tarjetas de cifra (2026-11-11): línea + área tenue, ancho completo de la tarjeta.
// `puntos` = números (null se salta). Sin ejes ni lectura: sólo la forma de los últimos meses.
import React from 'react';
import { useTheme } from '../../lib/themeContext';

export default function Trazo({ puntos = [], color, h = 26, style }) {
  const { theme } = useTheme();
  const vals = puntos.map((v) => (v == null || Number.isNaN(Number(v)) ? null : Number(v)));
  const con = vals.filter((v) => v != null);
  if (con.length < 2) return null;
  const W = 200, max = Math.max(...con), min = Math.min(...con), rango = max - min || 1, n = vals.length;
  const pts = [];
  vals.forEach((v, i) => { if (v != null) pts.push([(i / (n - 1)) * W, h - 2 - ((v - min) / rango) * (h - 5)]); });
  const linea = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const c = color || theme.accent || '#007AFF';
  return (
    <svg viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none" aria-hidden style={{ display: 'block', width: '100%', height: h, ...style }}>
      <path d={`${linea}L${pts[pts.length - 1][0].toFixed(1)},${h}L${pts[0][0].toFixed(1)},${h}Z`} fill={c} opacity="0.12" />
      <path d={linea} fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
