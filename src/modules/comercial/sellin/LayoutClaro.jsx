// Layout Claro · Sell In estilo apple.com landing.
// Hero blanco con cuota + progress → sección negra 3 métricas →
// grid 2×2 (chart, familias, top SKUs, insights) → tech-specs SKU table.
import React from 'react';
import { TYPO } from '../../../lib/themeTokens';
import {
  typo, fmtCompact, fmtNumber, MESES_FULL, CLIENTES_META,
  ChartMensual, DeltaLine, ProgressBar, FamiliasList, TopSkusTable,
} from './shared';

export default function LayoutClaro({ theme, clienteKey, kpis, chartData, familiasYTD, topSkus, mesActual, anioActual, anioPrev, esGlobal }) {
  const clienteMeta = esGlobal
    ? { nombre: 'Consolidado', marca: 'Todos los clientes' }
    : CLIENTES_META[clienteKey] || { nombre: clienteKey, marca: '' };

  return (
    <div style={{ background: theme.bg, color: theme.text, fontFamily: TYPO.fontText }}>
      {/* Hero blanco */}
      <section style={{ background: theme.bg, padding: '60px 40px 40px', textAlign: 'center' }}>
        <div style={{ ...typo({ fs: 13, w: 500 }), color: theme.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Sell In · {clienteMeta.nombre} · {anioActual}
        </div>
        <h2 style={{
          ...typo(TYPO.heroDisplay), fontFamily: TYPO.fontDisplay,
          color: theme.text, margin: '0 0 20px',
        }}>
          {kpis.cumplAnual != null ? `Al ${kpis.cumplAnual.toFixed(1)}% de la meta.` : 'Sell In.'}
        </h2>
        <p style={{
          ...typo(TYPO.tagline), fontFamily: TYPO.fontDisplay,
          color: theme.text, margin: '0 auto 40px', maxWidth: 720,
        }}>
          Facturación acumulada y proyección a fin de año.
        </p>
        <div style={{
          ...typo(TYPO.heroMax), fontFamily: TYPO.fontDisplay,
          color: theme.text, margin: 0, fontVariantNumeric: 'tabular-nums',
        }}>{fmtCompact(kpis.ytdMonto)}</div>
        <div style={{ marginTop: 24 }}>
          <DeltaLine theme={theme} pct={kpis.yoyYTD} label={`vs YTD ${anioPrev}`} size="lg" />
        </div>
        {kpis.cuotaAnualIdeal > 0 && (
          <div style={{ maxWidth: 480, margin: '48px auto 0' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', ...typo({ fs: 13, w: 500 }),
              color: theme.textMuted, marginBottom: 10,
            }}>
              <span>Cuota anual</span>
              <span style={{ color: theme.text, fontVariantNumeric: 'tabular-nums' }}>
                {kpis.cumplAnual?.toFixed(1)}% · Meta {fmtCompact(kpis.cuotaAnualIdeal)}
              </span>
            </div>
            <ProgressBar theme={theme} pct={kpis.cumplAnual} height={10} />
          </div>
        )}
      </section>

      {/* Sección negra */}
      <section style={{
        background: theme.surfaceDark, color: theme.textOnDark,
        padding: '80px 40px', textAlign: 'center',
      }}>
        <h3 style={{
          ...typo(TYPO.hero), fontFamily: TYPO.fontDisplay,
          color: theme.textOnDark, margin: '0 0 20px',
        }}>Cómo va el mes.</h3>
        <p style={{
          ...typo({ fs: 19, w: 400 }), fontFamily: TYPO.fontText,
          color: 'rgba(245,245,247,0.85)', maxWidth: 640, margin: '0 auto 60px', lineHeight: 1.4,
        }}>
          Facturación del mes actual, comparativa con {anioPrev} y cumplimiento de cuota.
        </p>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 60,
          maxWidth: 900, margin: '0 auto',
        }}>
          <BlackMetric theme={theme} label={`${MESES_FULL[mesActual - 1]} ${anioActual}`}
            value={fmtCompact(kpis.montoMes)} delta={kpis.yoyMes} deltaLabel="vs año prev" />
          <BlackMetric theme={theme} label="Cumplimiento del mes"
            value={kpis.cumplMes != null ? `${kpis.cumplMes.toFixed(1)}%` : '—'}
            sub={kpis.cuotaMes ? `Meta ${fmtCompact(kpis.cuotaMes.ideal)}` : ''} />
          <BlackMetric theme={theme} label="Piezas del mes"
            value={fmtNumber(kpis.piezasMes)} sub="unidades" />
        </div>
      </section>

      {/* Grid 2×2 alternado */}
      <section style={{
        background: theme.bgAlt, padding: 24,
        display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 24,
      }}>
        <FeatureCard theme={theme} variant="white"
          cat="TENDENCIA MENSUAL"
          title="Evolución"
          highlight={`vs ${anioPrev} y cuota.`}
          body={<ChartMensual theme={theme} chartData={chartData} mesMax={mesActual} anioActual={anioActual} anioPrev={anioPrev} />}
        />
        <FeatureCard theme={theme} variant="black"
          cat="COMPOSICIÓN"
          title="Por familia"
          highlight="YTD."
          body={<FamiliasList theme={{ ...theme, text: theme.textOnDark, textMuted: 'rgba(245,245,247,0.6)', divider: 'rgba(255,255,255,0.1)' }} familias={familiasYTD} />}
        />
      </section>

      {/* Tabla top SKUs tech-specs */}
      <section style={{ background: theme.bg, padding: '80px 80px' }}>
        <h3 style={{
          ...typo({ fs: 40, w: 600, ls: '-0.03em' }), fontFamily: TYPO.fontDisplay,
          color: theme.text, textAlign: 'center', margin: '0 0 12px',
        }}>Top SKUs del año.</h3>
        <p style={{
          ...typo({ fs: 17, w: 400 }), fontFamily: TYPO.fontText,
          color: theme.textMuted, textAlign: 'center', margin: '0 0 48px',
        }}>Los productos que mueven el negocio.</p>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <TopSkusTable theme={theme} topSkus={topSkus} maxRows={15} />
        </div>
      </section>

      {/* Footer */}
      <div style={{
        background: theme.bgAlt, padding: '24px 40px',
        borderTop: `1px solid ${theme.border}`,
        ...typo(TYPO.caption), color: theme.textMuted, fontFamily: TYPO.fontText,
        display: 'flex', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', gap: 20 }}>
          <span>Cifras en MXN</span>
          <span>Fuente: ERP Acteck</span>
        </div>
        <div>{esGlobal ? 'Consolidado' : clienteMeta.nombre} · {anioActual}</div>
      </div>
    </div>
  );
}

function BlackMetric({ theme, label, value, delta, deltaLabel, sub }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        ...typo({ fs: 12, w: 500, ls: '0.08em' }), fontFamily: TYPO.fontText,
        color: 'rgba(245,245,247,0.6)', textTransform: 'uppercase', marginBottom: 16,
      }}>{label}</div>
      <div style={{
        ...typo(TYPO.kpiLg), fontFamily: TYPO.fontDisplay,
        color: theme.textOnDark, fontVariantNumeric: 'tabular-nums', margin: 0,
      }}>{value}</div>
      {delta != null && (
        <div style={{
          ...typo({ fs: 15, w: 500 }), fontFamily: TYPO.fontText,
          color: delta >= 0 ? theme.green : theme.red,
          marginTop: 12, fontVariantNumeric: 'tabular-nums',
        }}>
          {delta >= 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}% <span style={{ color: 'rgba(245,245,247,0.6)', fontWeight: 400, marginLeft: 4 }}>{deltaLabel}</span>
        </div>
      )}
      {sub && !delta && (
        <div style={{ ...typo({ fs: 14 }), color: 'rgba(245,245,247,0.6)', marginTop: 12 }}>{sub}</div>
      )}
    </div>
  );
}

function FeatureCard({ theme, variant, cat, title, highlight, body }) {
  const isBlack = variant === 'black';
  const bg = isBlack ? theme.surfaceDark : theme.surface;
  const text = isBlack ? theme.textOnDark : theme.text;
  const muted = isBlack ? 'rgba(245,245,247,0.6)' : theme.textMuted;
  return (
    <div style={{
      background: bg, color: text, borderRadius: 22,
      padding: '40px 32px', minHeight: 380,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ ...typo({ fs: 13, w: 600 }), color: muted, marginBottom: 12 }}>{cat}</div>
      <h4 style={{
        ...typo({ fs: 32, w: 600, ls: '-0.03em', lh: 1.05 }), fontFamily: TYPO.fontDisplay,
        color: text, margin: '0 0 24px',
      }}>
        {title} <span style={{ color: muted, fontWeight: 400 }}>{highlight}</span>
      </h4>
      <div style={{ flex: 1, minHeight: 0 }}>{body}</div>
    </div>
  );
}
