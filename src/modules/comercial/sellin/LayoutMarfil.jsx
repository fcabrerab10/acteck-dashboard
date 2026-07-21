// Layout Marfil · Sell In estilo apple.com/newsroom.
// Hero warm eyebrow → cifra YTD → featurette azul con 4 métricas →
// detail card marfil con tendencia + composición + top SKUs.
import React from 'react';
import { TYPO } from '../../../lib/themeTokens';
import {
  typo, fmtCompact, fmtNumber, MESES_FULL, CLIENTES_META,
  ChartMensual, DeltaLine, ProgressBar, FamiliasList, TopSkusTable,
} from './shared';

export default function LayoutMarfil({ theme, clienteKey, kpis, chartData, familiasYTD, topSkus, mesActual, anioActual, anioPrev, esGlobal }) {
  const clienteMeta = esGlobal
    ? { nombre: 'Consolidado', marca: 'Todos los clientes' }
    : CLIENTES_META[clienteKey] || { nombre: clienteKey };

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
          <span style={{ color: theme.text, fontWeight: 500 }}>Sell In · {clienteMeta.nombre}</span>
        </div>
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
          Sell In · {anioActual}
        </div>
        <h2 style={{
          ...typo(TYPO.heroDisplay), fontFamily: TYPO.fontDisplay,
          color: theme.text, margin: '0 0 32px',
        }}>
          {kpis.cumplAnual != null && kpis.cumplAnual >= 90
            ? <>En camino a superar<br/>la meta anual.</>
            : kpis.cumplAnual != null
            ? <>Al {kpis.cumplAnual.toFixed(0)}% de<br/>la meta anual.</>
            : <>Facturación acumulada.</>}
        </h2>
        <p style={{
          ...typo({ fs: 22, w: 400, lh: 1.4 }), fontFamily: TYPO.fontText,
          color: theme.textMuted, maxWidth: 640, margin: '0 auto 48px',
        }}>
          El cierre YTD y el comparativo con {anioPrev}.
        </p>
        <div style={{
          ...typo(TYPO.heroMax), fontFamily: TYPO.fontDisplay,
          color: theme.text, margin: 0, fontVariantNumeric: 'tabular-nums',
        }}>{fmtCompact(kpis.ytdMonto)}</div>
        {kpis.yoyYTD != null && (
          <div style={{ marginTop: 24 }}>
            <DeltaLine theme={theme} pct={kpis.yoyYTD} label={`vs ${anioPrev}`} size="lg" />
          </div>
        )}
        {kpis.cuotaAnualIdeal > 0 && (
          <div style={{ maxWidth: 480, margin: '32px auto 0' }}>
            <ProgressBar theme={theme} pct={kpis.cumplAnual} color={theme.accent} height={8} />
            <div style={{
              ...typo(TYPO.caption), color: theme.textMuted, marginTop: 8,
              display: 'flex', justifyContent: 'space-between',
            }}>
              <span>Meta anual · {kpis.cumplAnual?.toFixed(1)}%</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtCompact(kpis.cuotaAnualIdeal)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Featurette azul bleed */}
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
          El detalle del mes
        </div>
        <h3 style={{
          ...typo(TYPO.hero), fontFamily: TYPO.fontDisplay,
          color: theme.textOnInverse || '#F7F3EC', margin: '0 0 20px',
        }}>Cómo va {MESES_FULL[mesActual - 1]}.</h3>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 40,
          maxWidth: 1100, margin: '60px auto 0', textAlign: 'left',
        }}>
          <InverseMetric theme={theme} label={`${MESES_FULL[mesActual - 1]} ${anioActual}`}
            value={fmtCompact(kpis.montoMes)} delta={kpis.yoyMes} deltaLabel={`vs ${anioPrev}`} />
          <InverseMetric theme={theme} label="Cumplimiento mes"
            value={kpis.cumplMes != null ? `${kpis.cumplMes.toFixed(1)}%` : '—'}
            sub={kpis.cuotaMes ? `Meta ${fmtCompact(kpis.cuotaMes.ideal)}` : ''} />
          <InverseMetric theme={theme} label="Piezas del mes"
            value={fmtNumber(kpis.piezasMes)} sub="unidades" />
          <InverseMetric theme={theme} label="Cumplimiento YTD"
            value={kpis.cumplYTD != null ? `${kpis.cumplYTD.toFixed(1)}%` : '—'}
            sub={`Meta ${fmtCompact(kpis.ytdCuotaIdeal)}`} />
        </div>
      </div>

      {/* Detail card marfil · chart */}
      <div style={{
        background: theme.surface, margin: '40px 0 0',
        borderRadius: 24, padding: 40,
      }}>
        <h4 style={{
          ...typo({ fs: 28, w: 600, ls: '-0.025em' }), fontFamily: TYPO.fontDisplay,
          color: theme.text, margin: '0 0 24px',
        }}>Tendencia mensual.</h4>
        <ChartMensual theme={theme} chartData={chartData} mesMax={mesActual} anioActual={anioActual} anioPrev={anioPrev} />
      </div>

      {/* Grid 2 col · familias + top SKUs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 20, marginTop: 20 }}>
        <div style={{ background: theme.surface, borderRadius: 24, padding: 32 }}>
          <h4 style={{
            ...typo({ fs: 22, w: 600, ls: '-0.02em' }), fontFamily: TYPO.fontDisplay,
            color: theme.text, margin: '0 0 8px',
          }}>Familias.</h4>
          <p style={{ ...typo(TYPO.body), color: theme.textMuted, fontFamily: TYPO.fontText, margin: '0 0 24px' }}>
            Composición del portafolio YTD.
          </p>
          <FamiliasList theme={theme} familias={familiasYTD} max={8} />
        </div>
        <div style={{ background: theme.surface, borderRadius: 24, padding: 32 }}>
          <h4 style={{
            ...typo({ fs: 22, w: 600, ls: '-0.02em' }), fontFamily: TYPO.fontDisplay,
            color: theme.text, margin: '0 0 8px',
          }}>Top SKUs.</h4>
          <p style={{ ...typo(TYPO.body), color: theme.textMuted, fontFamily: TYPO.fontText, margin: '0 0 24px' }}>
            Los 15 productos que más facturaron.
          </p>
          <TopSkusTable theme={theme} topSkus={topSkus} maxRows={15} />
        </div>
      </div>

      <p style={{
        ...typo(TYPO.caption), color: theme.textSubtle,
        textAlign: 'center', marginTop: 40, fontFamily: TYPO.fontText,
      }}>Cifras en MXN · Fuente: ERP Acteck</p>
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
