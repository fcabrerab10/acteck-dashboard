// Layout Marfil · Estado de Resultados estilo apple.com/newsroom + Investor.
// Hero centrado + featurette azul bleed edge-to-edge + detail card marfil oscuro.
import React from 'react';
import { AppleSegment } from '../../../components/apple';
import { TYPO } from '../../../lib/themeTokens';
import { Printer } from 'lucide-react';
import {
  typo, fmtCompact, fmtNumber, fmtPctDelta, sumYTD,
  MESES_LBL, INFO_SLUGS, GRUPOS_TABLA, ReportTable, NoticePill,
} from './shared';

export default function LayoutMarfil({
  theme, anio, setAnio, aniosDisponibles, mesMax,
  byCuenta, byCuentaPrev, kpis, trendData,
  alertasActivas, onDismissAlerta, setMesDrillDown,
}) {
  return (
    <div style={{
      background: theme.bg, color: theme.text,
      padding: '48px 40px', fontFamily: TYPO.fontText,
    }}>
      {/* Top bar */}
      <div className="edr-no-print" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 48, paddingBottom: 20,
        borderBottom: `1px solid ${theme.border}`,
      }}>
        <div style={{ ...typo(TYPO.caption), color: theme.textMuted }}>
          General <span style={{ color: theme.textSubtle, margin: '0 8px' }}>›</span>
          <span style={{ color: theme.text, fontWeight: 500 }}>Estado de resultados</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {aniosDisponibles.length > 1 && (
            <AppleSegment
              options={aniosDisponibles.map((y) => ({ value: y, label: String(y) }))}
              value={anio} onChange={setAnio}
            />
          )}
          <button onClick={() => window.print()}
            style={{
              padding: '10px 20px', borderRadius: 999, background: theme.accent,
              color: theme.textOnDark || '#F7F3EC', border: 'none',
              ...typo(TYPO.eyebrow), fontFamily: TYPO.fontText,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
            <Printer style={{ width: 13, height: 13 }} /> Exportar PDF
          </button>
        </div>
      </div>

      {alertasActivas.length > 0 && (
        <NoticePill theme={theme} alertas={alertasActivas}
          onDismiss={onDismissAlerta} onMesClick={setMesDrillDown} />
      )}

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
          {anio} · Cierre disponible
        </div>
        <h2 style={{
          ...typo(TYPO.heroDisplay), fontFamily: TYPO.fontDisplay,
          color: theme.text, margin: '0 0 32px', maxWidth: 900, marginLeft: 'auto', marginRight: 'auto',
        }}>
          {kpis.deltaUaii != null && kpis.deltaUaii > 100
            ? <>Un trimestre<br/>récord.</>
            : <>Estado de<br/>resultados.</>}
        </h2>
        <p style={{
          ...typo({ fs: 22, w: 400, lh: 1.4 }), fontFamily: TYPO.fontText,
          color: theme.textMuted, maxWidth: 640, margin: '0 auto 48px',
        }}>
          La UAII de REVKO cerró en el mejor arranque de {anio} de los últimos 3 años.
        </p>
        <div style={{
          ...typo(TYPO.heroMax), fontFamily: TYPO.fontDisplay,
          color: theme.text, margin: 0, fontVariantNumeric: 'tabular-nums',
        }}>{fmtCompact(kpis.uaii)}</div>
        <div style={{
          ...typo({ fs: 21, w: 500 }), fontFamily: TYPO.fontText,
          color: theme.green, marginTop: 24, fontVariantNumeric: 'tabular-nums',
        }}>
          {kpis.deltaUaii != null && (
            <>↑ {kpis.deltaUaii.toFixed(1)}% <span style={{ color: theme.textMuted, fontWeight: 400, marginLeft: 10 }}>
              vs {anio - 1}{kpis.pctUaii != null && ` · ${kpis.pctUaii.toFixed(1)}% s/ venta neta`}
            </span></>
          )}
        </div>
      </div>

      {/* Featurette azul bleed edge-to-edge */}
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
          Los números detrás
        </div>
        <h3 style={{
          ...typo(TYPO.hero), fontFamily: TYPO.fontDisplay,
          color: theme.textOnInverse || '#F7F3EC', margin: '0 0 20px',
        }}>Todo lo que hizo posible este cierre.</h3>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 40,
          maxWidth: 900, margin: '60px auto 0', textAlign: 'left',
        }}>
          <InverseMetric theme={theme} label="Venta neta" value={fmtCompact(kpis.ventaNeta)} delta={kpis.deltaVenta} />
          <InverseMetric theme={theme} label="Utilidad bruta" value={fmtCompact(kpis.utilBruta)}
            delta={kpis.deltaUtil} sub={kpis.pctBruta != null ? `Margen ${kpis.pctBruta.toFixed(1)}%` : ''} />
          <InverseMetric theme={theme} label="UAFIR s/ proyectos" value={fmtCompact(kpis.uafir)}
            delta={kpis.deltaUafir} sub={kpis.pctUafir != null ? `${kpis.pctUafir.toFixed(1)}% s/ venta` : ''} />
        </div>
      </div>

      {/* Detail card en marfil oscuro */}
      <div style={{
        background: theme.surface, margin: '40px 0 0',
        borderRadius: 24, padding: 40,
      }}>
        <h4 style={{
          ...typo({ fs: 32, w: 600, ls: '-0.025em' }), fontFamily: TYPO.fontDisplay,
          color: theme.text, margin: '0 0 32px',
        }}>Detalle por cuenta.</h4>

        <div style={{ overflowX: 'auto' }}>
          <ReportTable theme={theme} grupos={GRUPOS_TABLA}
            byCuenta={byCuenta} byCuentaPrev={byCuentaPrev}
            trendData={trendData} mesMax={mesMax} anio={anio}
            onMesClick={setMesDrillDown} />
        </div>
      </div>

      {/* Info general en cards marfil */}
      <div style={{ marginTop: 40, marginBottom: 20, paddingBottom: 12, borderBottom: `1px solid ${theme.border}` }}>
        <h4 style={{ ...typo(TYPO.h2), fontFamily: TYPO.fontDisplay, color: theme.text, margin: 0, fontSize: 22 }}>Información general.</h4>
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12,
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
              background: theme.surface, borderRadius: 16, padding: 18,
            }}>
              <div style={{
                ...typo({ fs: 11, w: 600, ls: '0.06em' }), fontFamily: TYPO.fontText,
                color: theme.textMuted, textTransform: 'uppercase', marginBottom: 8,
              }}>{c.cuenta}</div>
              <div style={{
                ...typo({ fs: 22, w: 600, ls: '-0.02em' }), fontFamily: TYPO.fontDisplay,
                color: theme.text, fontVariantNumeric: 'tabular-nums', margin: '0 0 4px',
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
  );
}

function InverseMetric({ theme, label, value, delta, sub }) {
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
          {delta != null && `↑ ${delta.toFixed(1)}%`}
          {delta != null && sub && ' · '}
          {sub}
        </div>
      )}
    </div>
  );
}
