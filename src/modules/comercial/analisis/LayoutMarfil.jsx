// Layout Marfil · Análisis por Cliente estilo apple.com/newsroom.
// Hero warm eyebrow + venta YTD + progress → featurette azul con 4 métricas →
// detail card marfil con chart YoY + grid 2 col (canales + ranking).
import React from 'react';
import { TYPO } from '../../../lib/themeTokens';
import {
  typo, fmtCompact, fmtNumber, MESES_FULL,
  ChartYoY, DeltaLine, ProgressBar, CanalesList, ClientesRanking,
} from './shared';

export default function LayoutMarfil({ theme, kpis, yoyMensual, canales, clientesRanking, mesMax, anio, setAnio, aniosDisponibles }) {
  const anioPrev = anio - 1;
  return (
    <div style={{
      background: theme.bg, color: theme.text,
      padding: '48px 40px', fontFamily: TYPO.fontText,
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 48, paddingBottom: 20, borderBottom: `1px solid ${theme.border}`,
      }}>
        <div style={{ ...typo(TYPO.caption), color: theme.textMuted }}>
          Comercial <span style={{ color: theme.textSubtle, margin: '0 8px' }}>›</span>
          <span style={{ color: theme.text, fontWeight: 500 }}>Análisis por cliente</span>
        </div>
        {aniosDisponibles.length > 1 && (
          <div style={{ display: 'flex', gap: 8 }}>
            {aniosDisponibles.map((y) => (
              <button key={y} onClick={() => setAnio(y)} style={{
                padding: '8px 16px', borderRadius: 999,
                background: y === anio ? theme.accent : 'transparent',
                color: y === anio ? theme.textOnDark : theme.text,
                border: y === anio ? 'none' : `1px solid ${theme.border}`,
                ...typo(TYPO.eyebrow), fontFamily: TYPO.fontText, cursor: 'pointer',
                fontWeight: 500,
              }}>{y}</button>
            ))}
          </div>
        )}
      </div>

      {/* Hero centrado */}
      <div style={{ textAlign: 'center', padding: '60px 20px 80px' }}>
        <div style={{
          display: 'inline-block', padding: '6px 14px',
          background: theme.eyebrowSoft || 'rgba(196,82,13,0.10)',
          color: theme.eyebrowColor || theme.orange,
          borderRadius: 999,
          ...typo({ fs: 12, w: 600 }), fontFamily: TYPO.fontText,
          marginBottom: 28,
        }}>
          Análisis · {anio}
        </div>
        <h2 style={{
          ...typo(TYPO.heroDisplay), fontFamily: TYPO.fontDisplay,
          color: theme.text, margin: '0 0 32px',
        }}>
          {kpis.deltaYTD != null && kpis.deltaYTD > 10
            ? <>Creciendo con<br/>{fmtNumber(kpis.activos)} clientes.</>
            : <>Consolidado de<br/>{fmtNumber(kpis.activos)} clientes.</>}
        </h2>
        <p style={{
          ...typo({ fs: 22, w: 400, lh: 1.4 }), fontFamily: TYPO.fontText,
          color: theme.textMuted, maxWidth: 640, margin: '0 auto 48px',
        }}>
          Facturación acumulada del año y comparativo con {anioPrev}.
        </p>
        <div style={{
          ...typo(TYPO.heroMax), fontFamily: TYPO.fontDisplay,
          color: theme.text, margin: 0, fontVariantNumeric: 'tabular-nums',
        }}>{fmtCompact(kpis.ventaYTD)}</div>
        {kpis.deltaYTD != null && (
          <div style={{ marginTop: 24 }}>
            <DeltaLine theme={theme} pct={kpis.deltaYTD} label={`vs ${anioPrev}`} size="lg" />
          </div>
        )}
        {kpis.cuotaTotal > 0 && (
          <div style={{ maxWidth: 480, margin: '32px auto 0' }}>
            <ProgressBar theme={theme} pct={kpis.cumpl} color={theme.accent} height={8} />
            <div style={{
              ...typo(TYPO.caption), color: theme.textMuted, marginTop: 8,
              display: 'flex', justifyContent: 'space-between',
            }}>
              <span>Meta anual · {kpis.cumpl?.toFixed(1)}%</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtCompact(kpis.cuotaTotal)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Featurette azul */}
      <div style={{
        background: theme.surfaceInverse || theme.accent,
        color: theme.textOnInverse || theme.textOnDark,
        margin: '40px -40px', padding: '80px 60px', textAlign: 'center',
      }}>
        <div style={{
          ...typo({ fs: 12, w: 600, ls: '0.08em' }), fontFamily: TYPO.fontText,
          color: theme.textMutedOnInverse || 'rgba(255,255,255,0.7)',
          textTransform: 'uppercase', marginBottom: 16,
        }}>
          Los números del mes
        </div>
        <h3 style={{
          ...typo(TYPO.hero), fontFamily: TYPO.fontDisplay,
          color: theme.textOnInverse || '#F7F3EC', margin: '0 0 20px',
        }}>{MESES_FULL[mesMax - 1]} en detalle.</h3>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 40,
          maxWidth: 1100, margin: '60px auto 0', textAlign: 'left',
        }}>
          <InverseMetric theme={theme} label={`${MESES_FULL[mesMax - 1]} ${anio}`}
            value={fmtCompact(kpis.ventaMes)} delta={kpis.deltaMes} deltaLabel={`vs ${anioPrev}`} />
          <InverseMetric theme={theme} label={`${MESES_FULL[mesMax - 1]} ${anioPrev}`}
            value={fmtCompact(kpis.ventaMesPrev)} sub="Base comparativo" />
          <InverseMetric theme={theme} label="Clientes activos"
            value={fmtNumber(kpis.activos)} sub={`en ${anio}`} />
          <InverseMetric theme={theme} label="Cumplimiento anual"
            value={kpis.cumpl != null ? `${kpis.cumpl.toFixed(1)}%` : '—'}
            sub={kpis.gap != null ? `Falta ${fmtCompact(kpis.gap)}` : ''} />
        </div>
      </div>

      {/* Detail card chart */}
      <div style={{
        background: theme.surface, margin: '40px 0 0',
        borderRadius: 24, padding: 40,
      }}>
        <h4 style={{
          ...typo({ fs: 28, w: 600, ls: '-0.025em' }), fontFamily: TYPO.fontDisplay,
          color: theme.text, margin: '0 0 24px',
        }}>Tendencia mensual.</h4>
        <ChartYoY theme={theme} yoyMensual={yoyMensual} mesMax={mesMax} anioActual={anio} anioPrev={anioPrev} />
      </div>

      {/* 2 cards: canales + ranking */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 20, marginTop: 20 }}>
        <div style={{ background: theme.surface, borderRadius: 24, padding: 32 }}>
          <h4 style={{
            ...typo({ fs: 22, w: 600, ls: '-0.02em' }), fontFamily: TYPO.fontDisplay,
            color: theme.text, margin: '0 0 8px',
          }}>Canales.</h4>
          <p style={{ ...typo(TYPO.body), color: theme.textMuted, fontFamily: TYPO.fontText, margin: '0 0 24px' }}>
            Composición del portafolio YTD.
          </p>
          <CanalesList theme={theme} canales={canales} max={10} />
        </div>
        <div style={{ background: theme.surface, borderRadius: 24, padding: 32 }}>
          <h4 style={{
            ...typo({ fs: 22, w: 600, ls: '-0.02em' }), fontFamily: TYPO.fontDisplay,
            color: theme.text, margin: '0 0 8px',
          }}>Ranking clientes.</h4>
          <p style={{ ...typo(TYPO.body), color: theme.textMuted, fontFamily: TYPO.fontText, margin: '0 0 24px' }}>
            Los 20 primeros por facturación acumulada.
          </p>
          <ClientesRanking theme={theme} clientes={clientesRanking} max={20} />
        </div>
      </div>

      <p style={{
        ...typo(TYPO.caption), color: theme.textSubtle,
        textAlign: 'center', marginTop: 40, fontFamily: TYPO.fontText,
      }}>Cifras en MXN · Fuente: ERP Acteck consolidado</p>
    </div>
  );
}

function InverseMetric({ theme, label, value, delta, deltaLabel, sub }) {
  const muted = theme.textMutedOnInverse || 'rgba(255,255,255,0.7)';
  return (
    <div style={{ borderTop: `1px solid rgba(247,243,236,0.2)`, paddingTop: 24 }}>
      <div style={{
        ...typo({ fs: 12, w: 600, ls: '0.08em' }), fontFamily: TYPO.fontText,
        color: muted, textTransform: 'uppercase', marginBottom: 12,
      }}>{label}</div>
      <div style={{
        ...typo(TYPO.kpiMd), fontFamily: TYPO.fontDisplay,
        color: theme.textOnInverse || '#F7F3EC', margin: 0, fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
      {(delta != null || sub) && (
        <div style={{
          ...typo({ fs: 14, w: 400 }), fontFamily: TYPO.fontText,
          color: muted, marginTop: 6, fontVariantNumeric: 'tabular-nums',
        }}>
          {delta != null && `${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta).toFixed(1)}%`}
          {delta != null && (deltaLabel || sub) && ' · '}
          {deltaLabel || sub}
        </div>
      )}
    </div>
  );
}
