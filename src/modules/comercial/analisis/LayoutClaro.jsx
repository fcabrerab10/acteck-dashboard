// Layout Claro · Análisis por Cliente estilo apple.com landing.
// Hero blanco con venta YTD + progress cuota → sección negra 3 métricas →
// grid 2×2 (chart YoY + canales) → tech-specs ranking clientes.
import React from 'react';
import { TYPO } from '../../../lib/themeTokens';
import {
  typo, fmtCompact, fmtNumber, MESES_FULL,
  ChartYoY, DeltaLine, ProgressBar, CanalesList, ClientesRanking,
} from './shared';

export default function LayoutClaro({ theme, kpis, yoyMensual, canales, clientesRanking, mesMax, anio, setAnio, aniosDisponibles }) {
  const anioPrev = anio - 1;
  return (
    <div style={{ background: theme.bg, color: theme.text, fontFamily: TYPO.fontText }}>
      {/* Sub-nav sticky */}
      <div className="edr-no-print" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 40px', borderBottom: `1px solid ${theme.border}`,
        background: theme.bg, position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ ...typo(TYPO.caption), color: theme.textMuted }}>
          Comercial <span style={{ margin: '0 8px', color: theme.textSubtle }}>›</span>
          <span style={{ color: theme.text, fontWeight: 500 }}>Análisis por cliente</span>
        </div>
        {aniosDisponibles.length > 1 && (
          <div style={{
            display: 'inline-flex', background: 'rgba(0,0,0,0.05)',
            padding: 3, borderRadius: 10, gap: 1,
          }}>
            {aniosDisponibles.map((y) => (
              <button key={y} onClick={() => setAnio(y)} style={{
                background: y === anio ? 'white' : 'transparent',
                color: y === anio ? theme.text : theme.textMuted,
                border: 'none', padding: '6px 14px', ...typo(TYPO.eyebrow), fontFamily: TYPO.fontText,
                borderRadius: 7, cursor: 'pointer',
                boxShadow: y === anio ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                fontWeight: y === anio ? 600 : 500,
              }}>{y}</button>
            ))}
          </div>
        )}
      </div>

      {/* Hero blanco */}
      <section style={{ background: theme.bg, padding: '60px 40px 40px', textAlign: 'center' }}>
        <div style={{ ...typo({ fs: 13, w: 500 }), color: theme.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Facturación consolidada · {anio}
        </div>
        <h2 style={{ ...typo(TYPO.heroDisplay), fontFamily: TYPO.fontDisplay, color: theme.text, margin: '0 0 20px' }}>
          {kpis.cumpl != null && kpis.cumpl >= 90
            ? 'Cerca de la meta anual.'
            : kpis.deltaYTD != null && kpis.deltaYTD > 0
            ? 'Creciendo vs el año anterior.'
            : 'Análisis por cliente.'}
        </h2>
        <p style={{ ...typo(TYPO.tagline), fontFamily: TYPO.fontDisplay, color: theme.text, margin: '0 auto 40px', maxWidth: 720 }}>
          {kpis.activos} clientes activos generaron el total del año.
        </p>
        <div style={{ ...typo(TYPO.heroMax), fontFamily: TYPO.fontDisplay, color: theme.text, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
          {fmtCompact(kpis.ventaYTD)}
        </div>
        <div style={{ marginTop: 24 }}>
          <DeltaLine theme={theme} pct={kpis.deltaYTD} label={`vs YTD ${anioPrev}`} size="lg" />
        </div>
        {kpis.cuotaTotal > 0 && (
          <div style={{ maxWidth: 480, margin: '48px auto 0' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', ...typo({ fs: 13, w: 500 }),
              color: theme.textMuted, marginBottom: 10,
            }}>
              <span>Cuota anual</span>
              <span style={{ color: theme.text, fontVariantNumeric: 'tabular-nums' }}>
                {kpis.cumpl?.toFixed(1)}% · Meta {fmtCompact(kpis.cuotaTotal)}
              </span>
            </div>
            <ProgressBar theme={theme} pct={kpis.cumpl} height={10} />
          </div>
        )}
      </section>

      {/* Sección negra */}
      <section style={{
        background: theme.surfaceDark, color: theme.textOnDark,
        padding: '80px 40px', textAlign: 'center',
      }}>
        <h3 style={{ ...typo(TYPO.hero), fontFamily: TYPO.fontDisplay, color: theme.textOnDark, margin: '0 0 20px' }}>
          El detalle del mes.
        </h3>
        <p style={{
          ...typo({ fs: 19, w: 400 }), fontFamily: TYPO.fontText,
          color: 'rgba(245,245,247,0.85)', maxWidth: 640, margin: '0 auto 60px', lineHeight: 1.4,
        }}>
          Venta del mes en curso, comparativa con {anioPrev} y clientes activos.
        </p>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 60,
          maxWidth: 900, margin: '0 auto',
        }}>
          <BlackMetric theme={theme} label={`${MESES_FULL[mesMax - 1]} ${anio}`}
            value={fmtCompact(kpis.ventaMes)} delta={kpis.deltaMes} deltaLabel={`vs ${anioPrev}`} />
          <BlackMetric theme={theme} label="Clientes activos"
            value={fmtNumber(kpis.activos)} sub="con facturación en el año" />
          <BlackMetric theme={theme} label="Cumplimiento YTD"
            value={kpis.cumpl != null ? `${kpis.cumpl.toFixed(1)}%` : '—'}
            sub={kpis.gap != null ? `Falta ${fmtCompact(kpis.gap)}` : ''} />
        </div>
      </section>

      {/* Grid 2×2 alternado */}
      <section style={{
        background: theme.bgAlt, padding: 24,
        display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 24,
      }}>
        <FeatureCard theme={theme} variant="white"
          cat={`TENDENCIA MENSUAL ${anio}`}
          title="Cómo va el año"
          highlight={`comparado con ${anioPrev}.`}
          body={<ChartYoY theme={theme} yoyMensual={yoyMensual} mesMax={mesMax} anioActual={anio} anioPrev={anioPrev} />}
        />
        <FeatureCard theme={theme} variant="black"
          cat="POR CANAL"
          title="Composición"
          highlight="YTD."
          body={<CanalesList theme={{ ...theme, text: theme.textOnDark, textMuted: 'rgba(245,245,247,0.6)', divider: 'rgba(255,255,255,0.1)' }} canales={canales} />}
        />
      </section>

      {/* Tech specs ranking clientes */}
      <section style={{ background: theme.bg, padding: '80px 80px' }}>
        <h3 style={{
          ...typo({ fs: 40, w: 600, ls: '-0.03em' }), fontFamily: TYPO.fontDisplay,
          color: theme.text, textAlign: 'center', margin: '0 0 12px',
        }}>Ranking de clientes.</h3>
        <p style={{
          ...typo({ fs: 17, w: 400 }), fontFamily: TYPO.fontText,
          color: theme.textMuted, textAlign: 'center', margin: '0 0 48px',
        }}>Los 20 primeros por venta acumulada en {anio}.</p>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <ClientesRanking theme={theme} clientes={clientesRanking} max={20} />
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
          <span>Fuente: ERP Acteck consolidado</span>
        </div>
        <div>{anio} · {clientesRanking.length} clientes</div>
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
          {delta >= 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}%
          <span style={{ color: 'rgba(245,245,247,0.6)', fontWeight: 400, marginLeft: 4 }}>{deltaLabel}</span>
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
