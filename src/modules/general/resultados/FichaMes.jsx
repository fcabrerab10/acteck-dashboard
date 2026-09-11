// Ficha del mes · HojaLateral (misma información que el modal anterior): 4 cifras del mes con su
// comparativo YoY, top variaciones vs mes anterior y vs mismo mes del año anterior, notas del cierre.
import React from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { HojaLateral } from '../../../components/perfil/comun';
import { KpiCard, DeltaPill, Pill } from '../../../components/kit';
import { money, moneyCompact, pct } from '../../../lib/format';
import { MESES_FULL } from './calculo';

export default function FichaMes({ ficha, anio, abierto, onClose }) {
  const { theme } = useTheme();
  const f = ficha;
  return (
    <HojaLateral abierto={abierto} onClose={onClose} theme={theme} ancho={520}
      titulo={f ? `${MESES_FULL[f.mes - 1]} ${anio}` : 'Ficha del mes'}
      sub={f ? `Ficha del mes · comparativo vs ${MESES_FULL[f.mes - 2] || '—'} y vs ${MESES_FULL[f.mes - 1]} ${anio - 1}` : ''}>
      {f && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 4px 8px', fontFamily: TYPO.fontText }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <KpiCard eyebrow="Venta neta" big={moneyCompact(f.ventaNeta)} bigSmall={f.ventaPrev != null ? `${anio - 1}: ${moneyCompact(f.ventaPrev)}` : undefined}
              badge={f.deltaVenta != null ? { tone: f.deltaVenta >= 0 ? 'green' : 'red', l: `${f.deltaVenta >= 0 ? '↑' : '↓'} ${Math.abs(f.deltaVenta).toFixed(1)}%` } : undefined} />
            <KpiCard eyebrow="Utilidad bruta" big={moneyCompact(f.utilBruta)} bigSmall={f.pctBruta != null ? `margen ${pct(f.pctBruta)}` : undefined}
              badge={f.deltaUtil != null ? { tone: f.deltaUtil >= 0 ? 'green' : 'red', l: `${f.deltaUtil >= 0 ? '↑' : '↓'} ${Math.abs(f.deltaUtil).toFixed(1)}%` } : undefined} />
            <KpiCard eyebrow="UAII · UAFIR s/ proy." big={moneyCompact(f.uafir)} bigSmall={f.pctUafir != null ? `${pct(f.pctUafir)} s/ venta` : undefined}
              badge={f.deltaUafir != null ? { tone: f.deltaUafir >= 0 ? 'green' : 'red', l: `${f.deltaUafir >= 0 ? '↑' : '↓'} ${Math.abs(f.deltaUafir).toFixed(1)}%` } : undefined} />
            <KpiCard eyebrow="UAI · UAII contable s/ proy." big={moneyCompact(f.uaii)} bigSmall={f.pctUaii != null ? `${pct(f.pctUaii)} s/ venta` : undefined}
              badge={f.deltaUaii != null ? { tone: f.deltaUaii >= 0 ? 'green' : 'red', l: `${f.deltaUaii >= 0 ? '↑' : '↓'} ${Math.abs(f.deltaUaii).toFixed(1)}%` } : undefined} />
          </div>

          {f.varsMoM.length > 0 && (
            <Seccion theme={theme} titulo={`Top variaciones vs ${MESES_FULL[f.mes - 2] || 'mes anterior'}`}>
              {f.varsMoM.map((v) => <VarRow key={v.slug} theme={theme} v={v} />)}
            </Seccion>
          )}
          {f.varsYoY.length > 0 && (
            <Seccion theme={theme} titulo={`Top variaciones vs ${MESES_FULL[f.mes - 1]} ${anio - 1}`}>
              {f.varsYoY.map((v) => <VarRow key={v.slug} theme={theme} v={v} />)}
            </Seccion>
          )}
          {f.varsMoM.length === 0 && f.varsYoY.length === 0 && (
            <div style={{ fontSize: 12, color: theme.textMuted }}>Sin variaciones mayores a $50K en las cuentas de detalle.</div>
          )}
          {f.notas.length > 0 && (
            <Seccion theme={theme} titulo="Notas del cierre">
              {f.notas.map((n, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 12, color: theme.text, padding: '4px 0' }}>
                  <Pill tone="gray" size="xs">{n.cuenta}</Pill>
                  <span style={{ color: theme.textMuted }}>{n.nota}</span>
                </div>
              ))}
            </Seccion>
          )}
        </div>
      )}
    </HojaLateral>
  );
}

function Seccion({ theme, titulo, children }) {
  return (
    <div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: theme.textMuted, marginBottom: 6 }}>{titulo}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{children}</div>
    </div>
  );
}

// Para gastos subir es malo; se conserva la lectura del modal anterior (↑ rojo / ↓ verde).
function VarRow({ theme, v }) {
  const subio = v.deltaAbs > 0;
  return (
    <div style={{ padding: '8px 10px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12.5, color: theme.text, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.cuenta}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums', fontSize: 11.5, fontWeight: 600, color: subio ? theme.red : theme.green, whiteSpace: 'nowrap' }}>
            {subio ? '↑' : '↓'} {moneyCompact(Math.abs(v.deltaAbs))}
          </span>
          <DeltaPill value={v.deltaPct} invert digits={1} />
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: theme.textSubtle || theme.textMuted, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
        <span>antes: {money(v.valorPrev)}</span>
        <span>ahora: {money(v.valor)}</span>
      </div>
    </div>
  );
}
