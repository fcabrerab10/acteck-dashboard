// Piezas propias de la pantalla móvil "Sell In" consolidado.
//   Sparkline  — tendencia de 6 meses dentro de una fila de canal (SVG liviano; 7 canales = 7 sparklines,
//                Recharts sería demasiado para una lista). Último punto marcado.
//   BarraMes   — barra del hero: relleno = MTD / cuota, marca = ritmo esperado al día de hoy.
//   TablaHeat  — heatmap genérico filas × meses con primera columna fija, columna Total y fila Total.
//                Lo usan el heatmap de 6 meses del SKU y la tabla "clientes que lo compran".
import React from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { HeatCell } from '../../../components/kit';
import { MONO, N } from '../../util';

export function Sparkline({ valores = [], ancho = 62, alto = 26, color }) {
  const { theme } = useTheme();
  const col = color || theme.accent;
  const vals = valores.map((v) => N(v));
  const max = Math.max(...vals, 0), min = Math.min(...vals, 0);
  if (!vals.length || max === min) {
    return <svg width={ancho} height={alto} aria-hidden style={{ flexShrink: 0, opacity: 0.5 }}><line x1={1} y1={alto / 2} x2={ancho - 1} y2={alto / 2} stroke={theme.border} strokeWidth={1.5} /></svg>;
  }
  const px = (i) => 1 + (i * (ancho - 2)) / Math.max(1, vals.length - 1);
  const py = (v) => alto - 2 - ((v - min) / (max - min)) * (alto - 4);
  const d = vals.map((v, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
  const area = `${d} L${px(vals.length - 1).toFixed(1)},${alto} L${px(0).toFixed(1)},${alto} Z`;
  return (
    <svg width={ancho} height={alto} aria-hidden style={{ flexShrink: 0, overflow: 'visible' }}>
      <path d={area} fill={col} opacity={0.10} />
      <path d={d} fill="none" stroke={col} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={px(vals.length - 1)} cy={py(vals[vals.length - 1])} r={2.2} fill={col} />
    </svg>
  );
}

/** Barra del hero: relleno = avance sobre la cuota; la marca vertical es el ritmo esperado al día de hoy. */
export function BarraMes({ mtd, cuota, ritmo, theme }) {
  if (!(cuota > 0)) return null;
  const pct = Math.min(100, (mtd / cuota) * 100);
  const marca = ritmo != null ? Math.min(100, Math.max(0, ritmo * 100)) : null;
  const inverso = theme.mode === 'dark' ? 'rgba(29,29,31,0.16)' : 'rgba(245,245,247,0.18)';
  const muted = theme.mode === 'dark' ? 'rgba(29,29,31,0.62)' : 'rgba(245,245,247,0.62)';
  const relleno = pct >= 100 ? theme.green : marca != null && pct >= marca ? (theme.textOnInverse || theme.textOnDark) : theme.orange;
  return (
    <div style={{ marginTop: 12, position: 'relative' }}>
      <div style={{ height: 6, background: inverso, borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: 6, width: `${pct}%`, background: relleno, borderRadius: 999 }} />
      </div>
      {marca != null && <span aria-hidden style={{ position: 'absolute', top: -3, left: `${marca}%`, width: 2, height: 12, background: theme.textOnInverse || theme.textOnDark, opacity: 0.8, borderRadius: 1 }} />}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10.5, color: muted, fontVariantNumeric: 'tabular-nums' }}>
        <span>{marca != null ? `ritmo esperado ${Math.round(marca)}%` : ''}</span><span>{Math.round(pct)}% de la cuota</span>
      </div>
    </div>
  );
}

/** Heatmap filas × columnas con primera columna fija, columna Total y fila Total. */
export function TablaHeat({ columnas = [], filas = [], fmt, etiquetaFilas = '', totalLabel = 'Total', conTotalFila = true }) {
  const { theme } = useTheme();
  const f = fmt || ((n) => Math.round(n).toLocaleString('es-MX'));
  const totalesCol = columnas.map((_, i) => filas.reduce((s, x) => s + N(x.valores?.[i]), 0));
  const maxTotalCol = Math.max(0, ...totalesCol);
  const granTotal = totalesCol.reduce((s, v) => s + v, 0);
  const th = { position: 'sticky', top: 0, background: theme.surface, zIndex: 1, padding: '8px 6px', fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: theme.textMuted, textAlign: 'center', whiteSpace: 'nowrap', borderBottom: `1px solid ${theme.border}` };
  const tdLabel = { position: 'sticky', left: 0, background: theme.surface, zIndex: 1, padding: '7px 10px', fontSize: 12.5, fontWeight: 500, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150, borderRight: `1px solid ${theme.border}` };
  const td = { padding: '5px 5px', textAlign: 'center' };
  const tdTot = { ...td, fontFamily: MONO, fontSize: 11, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden' }}>
      {filas.length === 0 && <div style={{ padding: 18, fontSize: 12.5, color: theme.textMuted, textAlign: 'center' }}>Sin movimiento en estos meses.</div>}
      {filas.length > 0 && (
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 160 + columnas.length * 62 + 70 }}>
            <thead>
              <tr>
                <th style={{ ...th, ...tdLabel, textAlign: 'left', zIndex: 2, textTransform: 'none', letterSpacing: 0, fontSize: 10.5 }}>{etiquetaFilas}</th>
                {columnas.map((c) => <th key={c} style={th}>{c}</th>)}
                <th style={th}>Total</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => {
                const max = Math.max(0, ...(fila.valores || []).map((v) => N(v)));
                const tot = (fila.valores || []).reduce((s, v) => s + N(v), 0);
                return (
                  <tr key={fila.label}>
                    <td style={tdLabel} title={fila.label}>{fila.label}{fila.sub && <span style={{ display: 'block', fontSize: 10.5, color: theme.textMuted, fontWeight: 400 }}>{fila.sub}</span>}</td>
                    {columnas.map((c, i) => <td key={c} style={td}><HeatCell v={N(fila.valores?.[i])} max={max} fmt={f} /></td>)}
                    <td style={{ ...tdTot, fontWeight: 600, color: theme.text }}>{f(tot)}</td>
                  </tr>
                );
              })}
              {conTotalFila && filas.length > 1 && (
                <tr>
                  <td style={{ ...tdLabel, fontFamily: TYPO.fontDisplay, fontWeight: 600, borderTop: `1px solid ${theme.border}` }}>{totalLabel}</td>
                  {totalesCol.map((v, i) => <td key={i} style={{ ...td, borderTop: `1px solid ${theme.border}` }}><HeatCell v={v} max={maxTotalCol} fmt={f} /></td>)}
                  <td style={{ ...tdTot, borderTop: `1px solid ${theme.border}`, fontWeight: 700, color: theme.text }}>{f(granTotal)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
