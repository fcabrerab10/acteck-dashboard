// Layout Midnight · Sell In estilo iPhone Pro OLED.
// Top bar minimal → hero cifra 200px cyan glow → KPI band 4 →
// card chart + card familias → tabla dark top SKUs.
import React from 'react';
import { TYPO } from '../../../lib/themeTokens';
import {
  typo, fmtCompact, fmtNumber, MESES_FULL, CLIENTES_META,
  ChartMensual, DeltaLine, FamiliasList, TopSkusTable, ProgressBar,
} from './shared';

export default function LayoutMidnight({ theme, clienteKey, kpis, chartData, familiasYTD, topSkus, mesActual, anioActual, anioPrev, esGlobal }) {
  const clienteMeta = esGlobal
    ? { nombre: 'Consolidado', marca: 'Todos los clientes', color: theme.accent }
    : CLIENTES_META[clienteKey] || { nombre: clienteKey, color: theme.accent };

  return (
    <div style={{
      background: theme.bg, color: theme.text,
      padding: '48px 40px', position: 'relative', overflow: 'hidden',
      fontFamily: TYPO.fontText,
    }}>
      {/* Glows */}
      <div style={{ position: 'absolute', top: -100, left: -100, width: 500, height: 500, background: theme.glowCyan, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -100, right: -100, width: 600, height: 600, background: theme.glowPurple, pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Top bar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 60, paddingBottom: 16, borderBottom: `1px solid ${theme.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              width: 10, height: 10, borderRadius: 999, background: clienteMeta.color,
              boxShadow: `0 0 8px ${clienteMeta.color}80`,
            }} />
            <span style={{ ...typo({ fs: 15, w: 600 }), fontFamily: TYPO.fontDisplay, color: theme.text }}>
              {clienteMeta.nombre}
            </span>
            <span style={{ ...typo(TYPO.caption), color: theme.textMuted, marginLeft: 8 }}>
              · Sell In {anioActual}
            </span>
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 14px', background: theme.accentBg,
            color: theme.accent, borderRadius: 999,
            ...typo(TYPO.eyebrow), fontFamily: TYPO.fontText,
          }}>
            YTD · Ene–{MESES_FULL[mesActual - 1]}
          </div>
        </div>

        {/* Hero cinemático */}
        <div style={{
          textAlign: 'center', padding: '80px 20px 100px',
          borderBottom: `1px solid ${theme.border}`, marginBottom: 60,
        }}>
          <div style={{
            ...typo({ fs: 13, w: 500, ls: '0.15em' }), fontFamily: TYPO.fontText,
            color: theme.textMuted, textTransform: 'uppercase', marginBottom: 24,
          }}>
            Facturación acumulada · {anioActual}
          </div>
          <h2 style={{
            ...typo(TYPO.heroMax), fontFamily: TYPO.fontDisplay,
            color: theme.textStrong || theme.text, margin: '0 0 20px',
            fontVariantNumeric: 'tabular-nums',
            textShadow: `0 0 40px ${theme.accentGlow || 'rgba(100,210,255,0.15)'}`,
          }}>{fmtCompact(kpis.ytdMonto)}</h2>
          <p style={{
            ...typo({ fs: 21, w: 400 }), fontFamily: TYPO.fontText,
            color: theme.textMuted, margin: '20px 0 0',
          }}>
            {kpis.yoyYTD != null && (
              <>{kpis.yoyYTD >= 0 ? '↑' : '↓'} <span style={{ color: theme.accent, fontWeight: 500 }}>{Math.abs(kpis.yoyYTD).toFixed(1)}%</span> vs {anioPrev}</>
            )}
            {kpis.cumplAnual != null && (
              <> · <span style={{ color: theme.accent, fontWeight: 500 }}>{kpis.cumplAnual.toFixed(1)}%</span> de meta anual</>
            )}
          </p>
          {kpis.cuotaAnualIdeal > 0 && (
            <div style={{ maxWidth: 480, margin: '32px auto 0' }}>
              <ProgressBar theme={theme} pct={kpis.cumplAnual} color={theme.accent} height={6} />
              <div style={{ ...typo(TYPO.caption), color: theme.textMuted, marginTop: 8, textAlign: 'center' }}>
                Meta anual: <span style={{ color: theme.text, fontVariantNumeric: 'tabular-nums' }}>{fmtCompact(kpis.cuotaAnualIdeal)}</span>
              </div>
            </div>
          )}
        </div>

        {/* KPI band film-frame */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          borderTop: `1px solid ${theme.borderStrong}`,
          borderBottom: `1px solid ${theme.borderStrong}`,
          marginBottom: 60,
        }}>
          <KpiCell theme={theme} label={MESES_FULL[mesActual - 1]} value={fmtCompact(kpis.montoMes)} delta={kpis.yoyMes} last={false} />
          <KpiCell theme={theme} label="Cumplimiento mes" value={kpis.cumplMes != null ? `${kpis.cumplMes.toFixed(1)}%` : '—'}
            sub={kpis.cuotaMes ? `Meta ${fmtCompact(kpis.cuotaMes.ideal)}` : ''} last={false} />
          <KpiCell theme={theme} label="Piezas YTD" value={fmtNumber(kpis.ytdPiezas)} sub="unidades" last={false} />
          <KpiCell theme={theme} label="Cumplimiento YTD" value={kpis.cumplYTD != null ? `${kpis.cumplYTD.toFixed(1)}%` : '—'}
            sub={`Meta ${fmtCompact(kpis.ytdCuotaIdeal)}`} last={true} />
        </div>

        {/* Card chart mensual grande */}
        <div style={{
          background: theme.surface, border: `1px solid ${theme.border}`,
          borderRadius: 16, padding: 24, marginBottom: 20,
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            paddingBottom: 12, borderBottom: `1px solid ${theme.borderStrong}`, marginBottom: 16,
          }}>
            <div>
              <div style={{ ...typo({ fs: 11, w: 600, ls: '0.06em' }), fontFamily: TYPO.fontText, color: theme.textMuted, textTransform: 'uppercase' }}>Tendencia mensual</div>
              <div style={{ ...typo({ fs: 22, w: 600, ls: '-0.02em' }), fontFamily: TYPO.fontDisplay, color: theme.textStrong || theme.text, marginTop: 4 }}>
                Sell In {anioActual}
              </div>
            </div>
            <div style={{ ...typo(TYPO.caption), color: theme.textMuted, textAlign: 'right' }}>
              <div>Línea sólida: {anioActual}</div>
              <div>Punteado: {anioPrev} · Cuota</div>
            </div>
          </div>
          <ChartMensual theme={theme} chartData={chartData} mesMax={mesActual} anioActual={anioActual} anioPrev={anioPrev} />
        </div>

        {/* 2 cards: familias + top SKUs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 20 }}>
          <div style={{
            background: theme.surface, border: `1px solid ${theme.border}`,
            borderRadius: 16, padding: 24,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              paddingBottom: 12, borderBottom: `1px solid ${theme.borderStrong}`, marginBottom: 16,
            }}>
              <h4 style={{ ...typo(TYPO.h3), fontFamily: TYPO.fontDisplay, color: theme.text, margin: 0 }}>Composición</h4>
              <span style={{ ...typo(TYPO.caption), color: theme.textMuted }}>Por familia · YTD</span>
            </div>
            <FamiliasList theme={theme} familias={familiasYTD} />
          </div>
          <div style={{
            background: theme.surface, border: `1px solid ${theme.border}`,
            borderRadius: 16, padding: 24,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              paddingBottom: 12, borderBottom: `1px solid ${theme.borderStrong}`, marginBottom: 16,
            }}>
              <h4 style={{ ...typo(TYPO.h3), fontFamily: TYPO.fontDisplay, color: theme.text, margin: 0 }}>Top SKUs</h4>
              <span style={{ ...typo(TYPO.caption), color: theme.textMuted }}>Los 10 primeros · YTD</span>
            </div>
            <TopSkusTable theme={theme} topSkus={topSkus} />
          </div>
        </div>

        <p style={{
          ...typo(TYPO.caption), color: theme.textSubtle,
          textAlign: 'center', marginTop: 40, fontFamily: TYPO.fontText,
        }}>Cifras en MXN · Fuente: ERP Acteck</p>
      </div>
    </div>
  );
}

function KpiCell({ theme, label, value, delta, sub, last }) {
  return (
    <div style={{
      padding: '32px 24px',
      borderRight: last ? 'none' : `1px solid ${theme.border}`,
    }}>
      <div style={{
        ...typo({ fs: 11, w: 600, ls: '0.1em' }), fontFamily: TYPO.fontText,
        color: theme.textMuted, textTransform: 'uppercase', marginBottom: 16,
      }}>{label}</div>
      <div style={{
        ...typo(TYPO.kpiMd), fontFamily: TYPO.fontDisplay,
        color: theme.textStrong || theme.text, fontVariantNumeric: 'tabular-nums', margin: '0 0 8px',
      }}>{value}</div>
      {delta != null && <DeltaLine theme={theme} pct={delta} />}
      {sub && !delta && <div style={{ ...typo(TYPO.caption), color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{sub}</div>}
    </div>
  );
}
