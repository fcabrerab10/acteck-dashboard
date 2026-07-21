// Layout Midnight · Estado de Resultados estilo iPhone Pro OLED.
// Hero cinemático + KPI band film-frame + tabla dark con UAII en cyan glow.
import React from 'react';
import { AppleSegment } from '../../../components/apple';
import { TYPO } from '../../../lib/themeTokens';
import { Printer } from 'lucide-react';
import {
  typo, fmtCompact, fmtNumber, fmtPctDelta, sumYTD,
  MESES_LBL, INFO_SLUGS, GRUPOS_TABLA, ReportTable, NoticePill, DeltaLine,
} from './shared';

export default function LayoutMidnight({
  theme, anio, setAnio, aniosDisponibles, mesMax,
  byCuenta, byCuentaPrev, kpis, trendData,
  alertasActivas, onDismissAlerta, setMesDrillDown,
}) {
  return (
    <div style={{
      background: theme.bg, color: theme.text,
      padding: '48px 40px', position: 'relative', overflow: 'hidden',
      fontFamily: TYPO.fontText,
    }}>
      {/* Glows radiales tenues en esquinas */}
      <div style={{
        position: 'absolute', top: -100, left: -100, width: 500, height: 500,
        background: theme.glowCyan, pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -100, right: -100, width: 600, height: 600,
        background: theme.glowPurple, pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Top bar */}
        <div className="edr-no-print" style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 60, paddingBottom: 16,
          borderBottom: `1px solid ${theme.border}`,
        }}>
          <div style={{ ...typo(TYPO.caption), color: theme.textMuted }}>
            General <span style={{ margin: '0 8px' }}>›</span>
            <span style={{ color: theme.text, fontWeight: 500 }}>Estado de resultados</span>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 14px', background: theme.accentBg,
              color: theme.accent, borderRadius: 999,
              ...typo(TYPO.eyebrow), fontFamily: TYPO.fontText,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: 999, background: theme.accent,
                boxShadow: `0 0 8px ${theme.accentGlow || 'rgba(100,210,255,0.8)'}`,
              }} />
              Sincronizado
            </div>
            {aniosDisponibles.length > 1 && (
              <AppleSegment
                options={aniosDisponibles.map((y) => ({ value: y, label: String(y) }))}
                value={anio} onChange={setAnio}
              />
            )}
            <button onClick={() => window.print()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 999,
                background: 'transparent', border: `1px solid ${theme.border}`,
                color: theme.text, ...typo(TYPO.eyebrow), fontFamily: TYPO.fontText,
                cursor: 'pointer',
              }}>
              <Printer style={{ width: 13, height: 13 }} /> PDF
            </button>
          </div>
        </div>

        {alertasActivas.length > 0 && (
          <NoticePill theme={theme} alertas={alertasActivas}
            onDismiss={onDismissAlerta} onMesClick={setMesDrillDown} />
        )}

        {/* Hero cinematográfico */}
        <div style={{
          textAlign: 'center', padding: '80px 20px 100px',
          borderBottom: `1px solid ${theme.border}`, marginBottom: 60,
        }}>
          <div style={{
            ...typo({ fs: 13, w: 500, ls: '0.15em' }), fontFamily: TYPO.fontText,
            color: theme.textMuted, textTransform: 'uppercase', marginBottom: 24,
          }}>
            Utilidad antes de impuestos · {anio}
          </div>
          <h2 style={{
            ...typo(TYPO.heroMax), fontFamily: TYPO.fontDisplay,
            color: theme.textStrong || theme.text, margin: '0 0 12px',
            fontVariantNumeric: 'tabular-nums',
            textShadow: `0 0 40px ${theme.accentGlow || 'rgba(100,210,255,0.15)'}`,
          }}>{fmtCompact(kpis.uaii)}</h2>
          <p style={{
            ...typo({ fs: 24, w: 400 }), fontFamily: TYPO.fontText,
            color: theme.textMuted, margin: '20px 0 0',
          }}>
            {kpis.deltaUaii != null && (
              <>↑ <span style={{ color: theme.accent, fontWeight: 500 }}>{kpis.deltaUaii.toFixed(1)}%</span> vs {anio - 1} · </>
            )}
            {kpis.pctUaii != null && <><span style={{ color: theme.accent, fontWeight: 500 }}>{kpis.pctUaii.toFixed(1)}%</span> s/venta</>}
          </p>
        </div>

        {/* KPI band film-frame */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          borderTop: `1px solid ${theme.borderStrong}`,
          borderBottom: `1px solid ${theme.borderStrong}`,
          marginBottom: 60,
        }}>
          <KpiCell theme={theme} label="Venta neta" value={fmtCompact(kpis.ventaNeta)} delta={kpis.deltaVenta} last={false} />
          <KpiCell theme={theme} label="Utilidad bruta" value={fmtCompact(kpis.utilBruta)} delta={kpis.deltaUtil} last={false} />
          <KpiCell theme={theme} label="Margen bruto" value={kpis.pctBruta != null ? kpis.pctBruta.toFixed(1) + '%' : '—'} delta={kpis.deltaMargen} isPts last={false} />
          <KpiCell theme={theme} label="UAFIR s/ proy." value={fmtCompact(kpis.uafir)} delta={kpis.deltaUafir} last={true} />
        </div>

        {/* Detail header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          paddingBottom: 16, borderBottom: `1px solid ${theme.borderStrong}`, marginBottom: 20,
        }}>
          <h3 style={{
            ...typo(TYPO.h2), fontFamily: TYPO.fontDisplay,
            color: theme.textStrong || theme.text, margin: 0,
          }}>Detalle por cuenta.</h3>
          <div style={{ ...typo(TYPO.caption), color: theme.textMuted }}>
            YTD Ene–{MESES_LBL[mesMax - 1]} {anio} · MXN
          </div>
        </div>

        {/* Detail card */}
        <div style={{
          background: theme.surface, border: `1px solid ${theme.border}`,
          borderRadius: 16, padding: '8px 24px 20px', overflowX: 'auto',
        }}>
          <ReportTable theme={theme} grupos={GRUPOS_TABLA}
            byCuenta={byCuenta} byCuentaPrev={byCuentaPrev}
            trendData={trendData} mesMax={mesMax} anio={anio}
            onMesClick={setMesDrillDown} />
        </div>

        {/* Info general */}
        <div style={{ marginTop: 60, marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${theme.borderStrong}` }}>
          <h4 style={{ ...typo(TYPO.h2), fontFamily: TYPO.fontDisplay, color: theme.text, margin: 0 }}>Información general.</h4>
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
        }}>
          {INFO_SLUGS.map((slug) => {
            const c = byCuenta.get(slug);
            if (!c) return null;
            const val = c.valores?.[mesMax] ?? null;
            const valPrev = byCuentaPrev.get(slug)?.valores?.[mesMax] ?? null;
            const delta = valPrev > 0 && val != null ? ((val - valPrev) / valPrev) * 100 : null;
            let formatted = '—';
            if (val != null) {
              formatted = (slug === 't_c_dof' || slug === 'colaboradores') ? fmtNumber(val) : fmtCompact(val);
            }
            return (
              <div key={slug} style={{
                background: theme.surface, border: `1px solid ${theme.border}`,
                borderRadius: 16, padding: 18,
              }}>
                <div style={{
                  ...typo({ fs: 11, w: 600, ls: '0.06em' }), fontFamily: TYPO.fontText,
                  color: theme.textMuted, textTransform: 'uppercase', marginBottom: 8,
                }}>{c.cuenta}</div>
                <div style={{
                  ...typo({ fs: 22, w: 600, ls: '-0.02em' }), fontFamily: TYPO.fontDisplay,
                  color: theme.textStrong || theme.text, fontVariantNumeric: 'tabular-nums', margin: '0 0 4px',
                }}>{formatted}</div>
                <div style={{ ...typo(TYPO.caption), color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                  {anio - 1}: {valPrev != null ? ((slug === 't_c_dof' || slug === 'colaboradores') ? fmtNumber(valPrev) : fmtCompact(valPrev)) : '—'}
                  {delta != null && (
                    <span style={{ color: delta >= 0 ? theme.green : theme.red, fontWeight: 500, marginLeft: 6 }}>
                      {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p style={{
          ...typo(TYPO.caption), color: theme.textSubtle,
          textAlign: 'center', marginTop: 40, fontFamily: TYPO.fontText,
        }}>Cifras en MXN · Fuente: estados_resultados</p>
      </div>
    </div>
  );
}

function KpiCell({ theme, label, value, delta, isPts, last }) {
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
      <DeltaLine theme={theme} pct={delta} isPts={isPts} />
    </div>
  );
}
