// Layout Midnight · Análisis por Cliente estilo iPhone Pro OLED.
// Top bar + hero cifra 200px cyan glow → KPI band 4 →
// card chart YoY + card canales + card ranking dark.
import React from 'react';
import { TYPO } from '../../../lib/themeTokens';
import {
  typo, fmtCompact, fmtNumber, MESES_FULL,
  ChartYoY, DeltaLine, ProgressBar, CanalesList, ClientesRanking,
} from './shared';

export default function LayoutMidnight({ theme, kpis, yoyMensual, canales, clientesRanking, mesMax, anio, setAnio, aniosDisponibles }) {
  const anioPrev = anio - 1;
  return (
    <div style={{
      background: theme.bg, color: theme.text,
      padding: '48px 40px', position: 'relative', overflow: 'hidden',
      fontFamily: TYPO.fontText,
    }}>
      <div style={{ position: 'absolute', top: -100, left: -100, width: 500, height: 500, background: theme.glowCyan, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -100, right: -100, width: 600, height: 600, background: theme.glowPurple, pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Top bar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 60, paddingBottom: 16, borderBottom: `1px solid ${theme.border}`,
        }}>
          <div style={{ ...typo(TYPO.caption), color: theme.textMuted }}>
            Comercial <span style={{ margin: '0 8px' }}>›</span>
            <span style={{ color: theme.text, fontWeight: 500 }}>Análisis por cliente</span>
          </div>
          {aniosDisponibles.length > 1 && (
            <div style={{
              display: 'inline-flex', background: 'rgba(255,255,255,0.08)',
              padding: 3, borderRadius: 10, gap: 1,
            }}>
              {aniosDisponibles.map((y) => (
                <button key={y} onClick={() => setAnio(y)} style={{
                  background: y === anio ? 'rgba(255,255,255,0.15)' : 'transparent',
                  color: y === anio ? theme.text : theme.textMuted,
                  border: 'none', padding: '6px 14px', ...typo(TYPO.eyebrow), fontFamily: TYPO.fontText,
                  borderRadius: 7, cursor: 'pointer',
                  fontWeight: y === anio ? 600 : 500,
                }}>{y}</button>
              ))}
            </div>
          )}
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
            Facturación consolidada · {anio}
          </div>
          <h2 style={{
            ...typo(TYPO.heroMax), fontFamily: TYPO.fontDisplay,
            color: theme.textStrong || theme.text, margin: '0 0 20px',
            fontVariantNumeric: 'tabular-nums',
            textShadow: `0 0 40px ${theme.accentGlow || 'rgba(100,210,255,0.15)'}`,
          }}>{fmtCompact(kpis.ventaYTD)}</h2>
          <p style={{
            ...typo({ fs: 21, w: 400 }), fontFamily: TYPO.fontText,
            color: theme.textMuted, margin: '20px 0 0',
          }}>
            {kpis.deltaYTD != null && (
              <>{kpis.deltaYTD >= 0 ? '↑' : '↓'} <span style={{ color: theme.accent, fontWeight: 500 }}>{Math.abs(kpis.deltaYTD).toFixed(1)}%</span> vs {anioPrev} · </>
            )}
            <span style={{ color: theme.accent, fontWeight: 500 }}>{fmtNumber(kpis.activos)}</span> clientes activos
          </p>
          {kpis.cuotaTotal > 0 && (
            <div style={{ maxWidth: 480, margin: '32px auto 0' }}>
              <ProgressBar theme={theme} pct={kpis.cumpl} color={theme.accent} height={6} />
              <div style={{ ...typo(TYPO.caption), color: theme.textMuted, marginTop: 8, textAlign: 'center' }}>
                Cumplimiento anual · <span style={{ color: theme.text }}>{kpis.cumpl?.toFixed(1)}%</span> · Meta {fmtCompact(kpis.cuotaTotal)}
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
          <KpiCell theme={theme} label={`${MESES_FULL[mesMax - 1]} ${anio}`} value={fmtCompact(kpis.ventaMes)} delta={kpis.deltaMes} last={false} />
          <KpiCell theme={theme} label="YTD anterior" value={fmtCompact(kpis.ventaYTDPrev)} sub={`Base ${anioPrev}`} last={false} />
          <KpiCell theme={theme} label="Clientes activos" value={fmtNumber(kpis.activos)} sub="con facturación" last={false} />
          <KpiCell theme={theme} label="Cumplimiento" value={kpis.cumpl != null ? `${kpis.cumpl.toFixed(1)}%` : '—'} sub={kpis.gap != null ? `Falta ${fmtCompact(kpis.gap)}` : ''} last={true} />
        </div>

        {/* Card chart YoY */}
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
                {anio} vs {anioPrev}
              </div>
            </div>
            <div style={{ ...typo(TYPO.caption), color: theme.textMuted, textAlign: 'right' }}>
              Sólido: {anio} · Punteado: {anioPrev}
            </div>
          </div>
          <ChartYoY theme={theme} yoyMensual={yoyMensual} mesMax={mesMax} anioActual={anio} anioPrev={anioPrev} />
        </div>

        {/* 2 cards: canales + ranking */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 20 }}>
          <div style={{
            background: theme.surface, border: `1px solid ${theme.border}`,
            borderRadius: 16, padding: 24,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              paddingBottom: 12, borderBottom: `1px solid ${theme.borderStrong}`, marginBottom: 16,
            }}>
              <h4 style={{ ...typo(TYPO.h3), fontFamily: TYPO.fontDisplay, color: theme.text, margin: 0 }}>Canales</h4>
              <span style={{ ...typo(TYPO.caption), color: theme.textMuted }}>Share YTD · YoY</span>
            </div>
            <CanalesList theme={theme} canales={canales} />
          </div>
          <div style={{
            background: theme.surface, border: `1px solid ${theme.border}`,
            borderRadius: 16, padding: 24,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              paddingBottom: 12, borderBottom: `1px solid ${theme.borderStrong}`, marginBottom: 16,
            }}>
              <h4 style={{ ...typo(TYPO.h3), fontFamily: TYPO.fontDisplay, color: theme.text, margin: 0 }}>Ranking clientes</h4>
              <span style={{ ...typo(TYPO.caption), color: theme.textMuted }}>Top 15 · YTD {anio}</span>
            </div>
            <ClientesRanking theme={theme} clientes={clientesRanking} max={15} />
          </div>
        </div>

        <p style={{
          ...typo(TYPO.caption), color: theme.textSubtle,
          textAlign: 'center', marginTop: 40, fontFamily: TYPO.fontText,
        }}>Cifras en MXN · Fuente: ERP Acteck consolidado</p>
      </div>
    </div>
  );
}

function KpiCell({ theme, label, value, delta, sub, last }) {
  return (
    <div style={{ padding: '32px 24px', borderRight: last ? 'none' : `1px solid ${theme.border}` }}>
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
