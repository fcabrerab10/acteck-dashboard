// Barra de cuota para el HeroM (tarjeta inversa): se llena y cambia de color (rojo < 60 · naranja < 85 · azul < 100 ·
// verde), con monto y %. Extraída de Inicio.jsx el 2026-10-05 para que la usen Inicio y Análisis por cliente.
import React from 'react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { moneyCompact } from '../util';

export default function BarraCuotaM({ valor, cuota, label, formato = moneyCompact }) {
  const { theme } = useTheme();
  if (!cuota) return null;
  const p = Math.max(0, (valor / cuota) * 100);
  const color = p >= 100 ? theme.green : p >= 85 ? (theme.teal || theme.accent) : p >= 60 ? theme.orange : theme.red;
  // Va dentro del HeroM (tarjeta inversa): en tema oscuro la tarjeta es clara, así que el texto es oscuro.
  const texto = theme.textOnInverse || theme.textOnDark || theme.surface;
  const muted = theme.mode === 'dark' ? 'rgba(29,29,31,0.62)' : 'rgba(245,245,247,0.7)';
  const pista = theme.mode === 'dark' ? 'rgba(29,29,31,0.12)' : 'rgba(255,255,255,0.14)';
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 11.5, color: muted, fontVariantNumeric: 'tabular-nums', gap: 8 }}>
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><b style={{ color: texto, fontWeight: 600 }}>{formato(valor)}</b> de {formato(cuota)}{label ? ` de ${label}` : ''}</span>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 700, color, flexShrink: 0 }}>{Math.round(p)}%</span>
      </div>
      <div style={{ marginTop: 4, height: 8, borderRadius: 999, background: pista, overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.min(100, p)}%`, background: color, borderRadius: 999, transition: 'width 420ms cubic-bezier(0.32,0.72,0,1)' }} /></div>
    </div>
  );
}
