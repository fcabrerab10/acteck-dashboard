// Cuotas por trimestre (2026-10-02, Fernando: «quisiera ver si han logrado sus cuotas en los Q»).
// Entrada: mensual = Map(idxMes → { fact_neta }) del cliente, cuotas = mapa de calc.js (cliente|anio|mes → cuota).
import React from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, Pill } from '../../../components/kit';
import { idxMes, cuotaPeriodo } from './calc';
import { money, pct } from './formato';

const N = (v) => Number(v) || 0;
const Q = [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]];

export function cuotasPorTrimestre(mensual, cuotas, cliente, anio, mesMax) {
  return Q.map((meses, i) => {
    const venta = meses.reduce((s, m) => s + N(mensual.get(idxMes(anio, m))?.fact_neta), 0);
    const ventaPrev = meses.reduce((s, m) => s + N(mensual.get(idxMes(anio - 1, m))?.fact_neta), 0);
    const cuota = meses.reduce((s, m) => { const c = cuotaPeriodo(cuotas, cliente, anio, m, 'mes'); return c == null ? s : s + c; }, 0) || null;
    const cerrado = meses[2] < mesMax, enCurso = meses.includes(mesMax);
    const p = cuota ? (venta / cuota) * 100 : null;
    return { q: i + 1, meses, venta, ventaPrev, cuota, pct: p, cerrado, enCurso, futuro: meses[0] > mesMax, logrado: cerrado && p != null ? p >= 100 : null, yoy: ventaPrev > 0 ? ((venta - ventaPrev) / ventaPrev) * 100 : null };
  });
}

export default function CuotasTrimestre({ mensual, cuotas, cliente, anio, mesMax }) {
  const { theme } = useTheme();
  const qs = cuotasPorTrimestre(mensual, cuotas, cliente, anio, mesMax);
  const logrados = qs.filter((q) => q.logrado === true).length, cerrados = qs.filter((q) => q.cerrado).length;
  const hayCuota = qs.some((q) => q.cuota);
  return (
    <Panel titulo={`Cuotas por trimestre · ${anio}`} meta={hayCuota ? `${logrados} de ${cerrados} trimestre${cerrados === 1 ? '' : 's'} cerrado${cerrados === 1 ? '' : 's'} logrado${logrados === 1 ? '' : 's'}` : 'sin cuota cargada para este cliente'}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
        {qs.map((q) => {
          const color = q.pct == null ? theme.textMuted : q.pct >= 100 ? theme.green : q.pct >= 85 ? theme.accent : q.pct >= 60 ? theme.orange : theme.red;
          return (
            <div key={q.q} style={{ border: `1px solid ${theme.border}`, borderRadius: 10, padding: '8px 10px', opacity: q.futuro ? 0.45 : 1, background: q.enCurso ? `${theme.accent}08` : 'transparent' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 700, color: theme.text }}>Q{q.q}</span>
                {q.logrado === true && <Pill size="xs" tone="green">Logrado</Pill>}
                {q.logrado === false && <Pill size="xs" tone="red">No logrado</Pill>}
                {q.enCurso && <Pill size="xs" tone="blue">En curso</Pill>}
                {q.futuro && <Pill size="xs" tone="gray">Por venir</Pill>}
              </div>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>{q.futuro ? '—' : money(q.venta)}</div>
              <div style={{ fontSize: 10.5, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{q.cuota ? `de ${money(q.cuota)} de cuota` : 'sin cuota'}{q.yoy != null && !q.futuro ? ` · ${q.yoy >= 0 ? '+' : ''}${q.yoy.toFixed(0)}% vs ${anio - 1}` : ''}</div>
              {q.cuota && !q.futuro && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 999, background: `${theme.text}12`, overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.min(100, q.pct)}%`, background: color, borderRadius: 999 }} /></div>
                  <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{pct(q.pct, 0)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
