// Inicio móvil · «<año> frente a <año-1>» (2026-10-05, propuesta A elegida por Fernando: «muy importante que el
// desplazamiento dentro de la gráfica sea muy bueno»). Desde el mismo día es un envoltorio fino de la pieza genérica
// `piezas/GraficaScrub` (series: cuota punteada, año anterior gris, año en curso con área): lo que se ve no cambió.
// Tocar sin arrastrar elige el mes (`onMes(1..12)`).
import React from 'react';
import { useTheme } from '../../../lib/themeContext';
import { GraficaScrub as Scrub } from '../../piezas';

export default function GraficaScrub({ meses, anio, formato, mesActivo, onMes }) {
  const { theme } = useTheme();
  const gris = theme.mode === 'dark' ? (theme.textSubtle || '#8E8E93') : (theme.textSubtle || '#AEAEB2');
  const series = [
    { key: 'cuota', label: 'Cuota', color: theme.orange, dash: true },
    { key: 'prev', label: String(anio - 1), color: gris },
    { key: 'fn', label: String(anio), color: theme.accent, area: true, grosor: 2.6 },
  ];
  const tooltip = (sel) => (
    <>
      <b style={{ fontSize: 12.5 }}>{sel.label}{sel.enCurso ? ' ·' : ''}</b> · {anio} <b style={{ fontSize: 12.5 }}>{sel.fn != null ? formato(sel.fn) : '—'}</b>{sel.pct != null ? ` · ${Math.round(sel.pct)}% cuota` : ''}<br />
      {anio - 1} {sel.prev != null ? formato(sel.prev) : '—'}{sel.yoy != null ? <> · <span style={{ color: sel.yoy >= 0 ? theme.green : theme.red }}>{sel.yoy >= 0 ? '+' : ''}{Math.round(sel.yoy)}%</span></> : null}{sel.cuota ? ` · cuota ${formato(sel.cuota)}` : ''}
    </>
  );
  return <Scrub series={series} datos={meses} formato={formato} tooltip={tooltip} activo={mesActivo} onTocar={(k) => { if (onMes && meses[k]?.fn != null) onMes(k + 1); }} />;
}
