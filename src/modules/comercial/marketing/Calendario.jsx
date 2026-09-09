// Calendario compacto de Marketing · vista mes (celdas sin bordes, puntos por tipo,
// día seleccionado en fondo inverso) y vista anual (12 mini-meses con conteo).
import React, { useMemo } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { EASE, DUR } from '../../../components/kit';
import { DIAS_SEMANA, MESES_CORTOS, tipoMeta, parseFecha, money } from './config';

export function CalendarioMes({ anio, mes, actividades, diaSeleccionado, onSelectDia, hoy }) {
  const { theme } = useTheme();
  const inv = theme.surfaceInverse || '#000', onInv = theme.textOnInverse || '#F5F5F7';
  const celdas = useMemo(() => {
    const first = new Date(anio, mes - 1, 1);
    const last = new Date(anio, mes, 0).getDate();
    const offset = (first.getDay() + 6) % 7; // lunes = 0
    const out = [];
    for (let i = 0; i < offset; i++) out.push(null);
    for (let d = 1; d <= last; d++) out.push({ day: d, acts: actividades.filter((a) => parseFecha(a.fecha)?.d === d) });
    return out;
  }, [anio, mes, actividades]);
  const h = parseFecha(hoy);
  const esHoy = (d) => h && h.y === anio && h.m === mes && h.d === d;
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
        {DIAS_SEMANA.map((d, i) => <div key={i} style={{ textAlign: 'center', fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.06em', color: theme.textSubtle || theme.textMuted, padding: '2px 0' }}>{d}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {celdas.map((c, i) => {
          if (!c) return <div key={`e${i}`} />;
          const sel = c.day === diaSeleccionado;
          return (
            <button key={c.day} type="button" onClick={() => onSelectDia(sel ? null : c.day)} title={c.acts.length ? c.acts.map((a) => `${tipoMeta(a.tipo).label}: ${a.nombre || ''}`).join('\n') : undefined}
              onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = theme.surfaceHover || 'rgba(0,0,0,0.03)'; }}
              onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = 'transparent'; }}
              style={{
                border: 0, padding: '4px 2px 3px', minHeight: 40, borderRadius: 8, cursor: 'pointer',
                background: sel ? inv : 'transparent', color: sel ? onInv : theme.text,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                transition: `background ${DUR.state}ms ${EASE}`,
              }}>
              <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: esHoy(c.day) || sel ? 700 : 500, fontVariantNumeric: 'tabular-nums', lineHeight: 1, color: esHoy(c.day) && !sel ? (theme.accent || '#007AFF') : 'inherit' }}>{c.day}</span>
              <span style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center', minHeight: 5 }}>
                {c.acts.slice(0, 4).map((a) => <span key={a.id} style={{ width: 5, height: 5, borderRadius: 999, background: sel ? onInv : tipoMeta(a.tipo).color, opacity: a.estatus === 'completado' || a.estatus === 'archivado' ? 0.4 : 1 }} />)}
                {c.acts.length > 4 && <span style={{ fontSize: 8, lineHeight: '5px', color: sel ? onInv : theme.textMuted }}>+{c.acts.length - 4}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CalendarioAnual({ anio, porMes, mesSel, onSelectMes }) {
  const { theme } = useTheme();
  const inv = theme.surfaceInverse || '#000', onInv = theme.textOnInverse || '#F5F5F7';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
        const d = porMes[m] || { total: 0, inv: 0, porTipo: {} };
        const sel = m === mesSel;
        return (
          <button key={m} type="button" onClick={() => onSelectMes(m)}
            onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = theme.surfaceHover || 'rgba(0,0,0,0.03)'; }}
            onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = theme.bg; }}
            style={{
              border: 0, borderRadius: 10, padding: '8px 10px', cursor: 'pointer', textAlign: 'left', minHeight: 66,
              background: sel ? inv : theme.bg, color: sel ? onInv : theme.text, display: 'flex', flexDirection: 'column', gap: 4,
              transition: `background ${DUR.state}ms ${EASE}`,
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, letterSpacing: '-0.01em' }}>{MESES_CORTOS[m - 1]}</span>
              <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1, opacity: d.total ? 1 : 0.35 }}>{d.total}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
              <span style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {Object.entries(d.porTipo).map(([t, c]) => <span key={t} title={`${tipoMeta(t).label}: ${c}`} style={{ width: 6, height: 6, borderRadius: 999, background: sel ? onInv : tipoMeta(t).color, display: 'inline-block' }} />)}
              </span>
              <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, fontVariantNumeric: 'tabular-nums', color: sel ? onInv : theme.textMuted, opacity: sel ? 0.7 : 1 }}>{d.inv > 0 ? money(d.inv) : ''}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
