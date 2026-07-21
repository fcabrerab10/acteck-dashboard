// Layout Claro · Estado de Resultados estilo apple.com puro.
// Secciones alternadas blanco → negro → blanco con hero moments.
import React from 'react';
import { AppleSegment } from '../../../components/apple';
import { TYPO } from '../../../lib/themeTokens';
import { Printer } from 'lucide-react';
import {
  typo, fmtCompact, fmtPctDelta, fmtNumber, sumYTD,
  MESES_LBL, GRUPOS_TABLA, INFO_SLUGS, Sparkline, NoticePill, dotColorFrom,
} from './shared';

export default function LayoutClaro({
  theme, anio, setAnio, aniosDisponibles, mesMax,
  byCuenta, byCuentaPrev, kpis, trendData,
  alertasActivas, onDismissAlerta, setMesDrillDown,
}) {
  return (
    <div style={{
      background: theme.bg, color: theme.text,
      fontFamily: TYPO.fontText,
    }}>
      {/* ─── Sub-nav sticky ─── */}
      <div className="edr-no-print" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 40px', borderBottom: `1px solid ${theme.border}`,
        background: theme.bg,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ ...typo(TYPO.caption), color: theme.textMuted }}>
          General <span style={{ margin: '0 8px', color: theme.textSubtle }}>›</span>
          <span style={{ color: theme.text, fontWeight: 500 }}>Estado de resultados</span>
        </div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
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
            <Printer style={{ width: 13, height: 13 }} /> Exportar PDF
          </button>
        </div>
      </div>

      <div style={{ padding: '0 40px' }}>
        {alertasActivas.length > 0 && (
          <div style={{ paddingTop: 24 }}>
            <NoticePill theme={theme} alertas={alertasActivas}
              onDismiss={onDismissAlerta} onMesClick={setMesDrillDown} />
          </div>
        )}
      </div>

      {/* ─── SECCIÓN 1 · Hero blanca con cifra dominante ─── */}
      <section style={{
        background: theme.bg, padding: '80px 40px 40px', textAlign: 'center',
      }}>
        <div style={{
          ...typo({ fs: 21, w: 400, ls: 0 }), fontFamily: TYPO.fontDisplay,
          color: theme.text, marginBottom: 8,
        }}>Reporte {anio} · YTD Enero–{MESES_LBL[mesMax - 1]}</div>
        <h2 style={{
          ...typo(TYPO.heroDisplay), fontFamily: TYPO.fontDisplay,
          color: theme.text, margin: '0 0 20px',
        }}>Estado de resultados.</h2>
        <p style={{
          ...typo(TYPO.tagline), fontFamily: TYPO.fontDisplay,
          color: theme.text, margin: '0 auto 60px', maxWidth: 720,
        }}>
          {kpis.deltaUaii != null && kpis.deltaUaii > 100
            ? 'La mejor utilidad de los últimos años.'
            : `Un cierre de ${anio === new Date().getFullYear() ? 'este año' : anio} con números claros.`}
        </p>
        <div style={{
          ...typo(TYPO.heroMax), fontFamily: TYPO.fontDisplay,
          color: theme.text, margin: 0, fontVariantNumeric: 'tabular-nums',
        }}>{fmtCompact(kpis.uaii)}</div>
        <p style={{
          ...typo({ fs: 17, w: 400 }), fontFamily: TYPO.fontText,
          color: theme.textMuted, margin: '20px 0 60px',
        }}>
          UAII acumulada
          {kpis.deltaUaii != null && (
            <> · <span style={{ color: theme.green, fontWeight: 500 }}>↑ {kpis.deltaUaii.toFixed(1)}%</span> vs {anio - 1}</>
          )}
          {kpis.pctUaii != null && ` · ${kpis.pctUaii.toFixed(1)}% s/ venta neta`}
        </p>
      </section>

      {/* ─── SECCIÓN 2 · Hero negra alternada ─── */}
      <section style={{
        background: theme.surfaceDark, color: theme.textOnDark,
        padding: '100px 40px', textAlign: 'center',
      }}>
        <h3 style={{
          ...typo(TYPO.hero), fontFamily: TYPO.fontDisplay,
          color: theme.textOnDark, margin: '0 0 28px',
        }}>Cifras que sostienen el trimestre.</h3>
        <p style={{
          ...typo({ fs: 21, w: 400 }), fontFamily: TYPO.fontText,
          color: 'rgba(245,245,247,0.85)', maxWidth: 700, margin: '0 auto 60px',
          lineHeight: 1.4,
        }}>
          {kpis.deltaVenta != null && `Venta neta ${kpis.deltaVenta >= 0 ? 'arriba' : 'abajo'} ${Math.abs(kpis.deltaVenta).toFixed(1)}%. `}
          {kpis.deltaUtil != null && `Utilidad bruta ${kpis.deltaUtil >= 0 ? 'arriba' : 'abajo'} ${Math.abs(kpis.deltaUtil).toFixed(1)}%.`}
        </p>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 60,
          maxWidth: 900, margin: '0 auto',
        }}>
          <BlackMetric label="Venta neta" value={fmtCompact(kpis.ventaNeta)} delta={kpis.deltaVenta} theme={theme} />
          <BlackMetric label="Utilidad bruta" value={fmtCompact(kpis.utilBruta)} delta={kpis.deltaUtil} theme={theme} />
          <BlackMetric label="UAFIR" value={fmtCompact(kpis.uafir)} delta={kpis.deltaUafir} theme={theme} />
        </div>
      </section>

      {/* ─── SECCIÓN 3 · Grid 2×2 feature cards alternadas ─── */}
      <section style={{
        background: theme.bgAlt, padding: '24px',
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24,
      }}>
        <FeatureCard theme={theme} variant="black"
          cat="MARGEN BRUTO"
          title="Nueve puntos"
          highlight="arriba del año anterior."
          value={kpis.pctBruta != null ? kpis.pctBruta.toFixed(1) + '%' : '—'}
          delta={kpis.deltaMargen} deltaLabel={kpis.deltaMargen != null ? ` pts vs ${anio - 1}` : ''}
          isPts
        />
        <FeatureCard theme={theme} variant="white"
          cat="EQUIPO"
          title="Cada persona generó"
          highlight={`${fmtCompact(kpis.ventaNeta / 142)} de venta este trimestre.`}
          value={fmtNumber(byCuenta.get('colaboradores')?.valores?.[mesMax] || 142)}
          sub="colaboradores"
        />
        <FeatureCard theme={theme} variant="white"
          cat="GASTOS OPERATIVOS"
          title="Operamos con"
          highlight={`${fmtCompact(byCuenta.get('total_gastos')?.valores?.[mesMax] * mesMax || 0)} en el periodo.`}
          value={kpis.ventaNeta > 0 ? ((sumYTD(byCuenta.get('total_gastos'), mesMax) / kpis.ventaNeta) * 100).toFixed(1) + '%' : '—'}
          sub="s/ venta neta"
        />
        <FeatureCard theme={theme} variant="black"
          cat={alertasActivas[0] ? 'ALERTA' : 'RESULTADO FINAL'}
          title={alertasActivas[0] ? alertasActivas[0].cuenta : 'UAII contable'}
          highlight={alertasActivas[0] ? 'requiere revisión.' : 'del periodo.'}
          value={alertasActivas[0]
            ? fmtCompact(byCuenta.get(alertasActivas[0].slug)?.valores?.[alertasActivas[0].mes] || 0)
            : fmtCompact(kpis.uaii)}
          delta={alertasActivas[0] ? alertasActivas[0].delta : kpis.deltaUaii}
          deltaLabel={` vs ${anio - 1}`}
        />
      </section>

      {/* ─── SECCIÓN 4 · Tech specs style detail ─── */}
      <section style={{
        background: theme.bg, padding: '100px 80px',
      }}>
        <h3 style={{
          ...typo({ fs: 48, w: 600, ls: '-0.035em' }), fontFamily: TYPO.fontDisplay,
          color: theme.text, textAlign: 'center', margin: '0 0 12px',
        }}>Detalle por cuenta.</h3>
        <p style={{
          ...typo({ fs: 19, w: 400 }), fontFamily: TYPO.fontText,
          textAlign: 'center', color: theme.textMuted, margin: '0 0 60px',
        }}>Los números detrás del cierre.</p>

        <TechSpecsTable theme={theme} byCuenta={byCuenta} byCuentaPrev={byCuentaPrev}
          mesMax={mesMax} anio={anio} onMesClick={setMesDrillDown} />
      </section>

      {/* ─── SECCIÓN 5 · Info general en fondo alt ─── */}
      <section style={{
        background: theme.bgAlt, padding: '60px 40px',
      }}>
        <h4 style={{
          ...typo(TYPO.h2), fontFamily: TYPO.fontDisplay,
          color: theme.text, margin: '0 0 32px', textAlign: 'center',
        }}>Información general.</h4>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16, maxWidth: 1000, margin: '0 auto',
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
                background: theme.surface, borderRadius: 16, padding: 20,
              }}>
                <div style={{
                  ...typo({ fs: 11, w: 600, ls: '0.06em' }), fontFamily: TYPO.fontText,
                  color: theme.textMuted, textTransform: 'uppercase', marginBottom: 10,
                }}>{c.cuenta}</div>
                <div style={{
                  ...typo({ fs: 28, w: 600, ls: '-0.025em' }), fontFamily: TYPO.fontDisplay,
                  color: theme.text, fontVariantNumeric: 'tabular-nums', margin: '0 0 6px',
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
          <span>Fuente: estados_resultados</span>
        </div>
        <div>Acteck · {anio}</div>
      </div>
    </div>
  );
}

// ─── Métrica en sección negra ───
function BlackMetric({ theme, label, value, delta }) {
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
        </div>
      )}
    </div>
  );
}

// ─── Feature card alternada blanca/negra ───
function FeatureCard({ theme, variant, cat, title, highlight, value, delta, deltaLabel, sub, isPts }) {
  const isBlack = variant === 'black';
  const bg = isBlack ? theme.surfaceDark : theme.surface;
  const text = isBlack ? theme.textOnDark : theme.text;
  const muted = isBlack ? 'rgba(245,245,247,0.6)' : theme.textMuted;
  const link = isBlack ? theme.accentDark : theme.accent;
  return (
    <div style={{
      background: bg, color: text, borderRadius: 22,
      padding: '60px 40px', minHeight: 380,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ ...typo({ fs: 13, w: 600 }), color: muted, marginBottom: 12 }}>{cat}</div>
      <h4 style={{
        ...typo({ fs: 40, w: 600, ls: '-0.03em', lh: 1.05 }), fontFamily: TYPO.fontDisplay,
        color: text, margin: '0 0 20px',
      }}>
        {title} <span style={{ color: muted, fontWeight: 400 }}>{highlight}</span>
      </h4>
      <div style={{ marginTop: 'auto' }}>
        <div style={{
          ...typo(TYPO.kpiXl), fontFamily: TYPO.fontDisplay,
          color: text, fontVariantNumeric: 'tabular-nums', margin: '0 0 12px',
        }}>{value}</div>
        {delta != null && (
          <div style={{
            ...typo({ fs: 15, w: 500 }), fontFamily: TYPO.fontText,
            color: delta >= 0 ? theme.green : theme.red,
            fontVariantNumeric: 'tabular-nums', marginBottom: 6,
          }}>
            {delta >= 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}{isPts ? ' pts' : '%'}{deltaLabel || ''}
          </div>
        )}
        {sub && <div style={{ ...typo({ fs: 15, w: 500 }), color: muted, marginBottom: 6 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ─── Tech specs table · estilo apple.com/support ───
function TechSpecsTable({ theme, byCuenta, byCuentaPrev, mesMax, anio, onMesClick }) {
  const cellR = {
    padding: '20px 16px', textAlign: 'right',
    fontVariantNumeric: 'tabular-nums', ...typo({ fs: 15, w: 400 }),
    fontFamily: TYPO.fontText, color: theme.text,
    borderBottom: `1px solid ${theme.divider}`,
  };
  const cellL = { ...cellR, textAlign: 'left', fontVariantNumeric: 'normal' };

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: 1000, margin: '0 auto' }}>
      <thead>
        <tr>
          <th style={{ ...cellL, borderBottom: `1.5px solid ${theme.text}`, ...typo({ fs: 11.5, w: 700, ls: '0.08em' }), color: theme.textMuted, textTransform: 'uppercase', paddingBottom: 14 }}>Cuenta</th>
          <th style={{ ...cellR, borderBottom: `1.5px solid ${theme.text}`, ...typo({ fs: 11.5, w: 700, ls: '0.08em' }), color: theme.textMuted, textTransform: 'uppercase', paddingBottom: 14 }}>YTD {anio}</th>
          <th style={{ ...cellR, borderBottom: `1.5px solid ${theme.text}`, ...typo({ fs: 11.5, w: 700, ls: '0.08em' }), color: theme.textMuted, textTransform: 'uppercase', paddingBottom: 14 }}>YTD {anio - 1}</th>
          <th style={{ ...cellR, borderBottom: `1.5px solid ${theme.text}`, ...typo({ fs: 11.5, w: 700, ls: '0.08em' }), color: theme.textMuted, textTransform: 'uppercase', paddingBottom: 14 }}>Δ</th>
          <th style={{ ...cellR, borderBottom: `1.5px solid ${theme.text}`, ...typo({ fs: 11.5, w: 700, ls: '0.08em' }), color: theme.textMuted, textTransform: 'uppercase', paddingBottom: 14 }}>Tend.</th>
        </tr>
      </thead>
      <tbody>
        {GRUPOS_TABLA.filter(g => g.id !== 'info').map((g) => {
          const cuentas = g.cuentas.map((slug) => byCuenta.get(slug)).filter(Boolean).sort((a, b) => a.orden - b.orden);
          if (g.extra) { const e = byCuenta.get(g.extra); if (e) cuentas.push(e); }
          const sub = g.subtotal ? byCuenta.get(g.subtotal) : null;
          const subTotal = sub ? sumYTD(sub, mesMax) : null;
          const subTotalPrev = sub ? sumYTD(byCuentaPrev.get(g.subtotal), mesMax) : null;
          const deltaSub = subTotal != null && subTotalPrev > 0 ? ((subTotal - subTotalPrev) / subTotalPrev) * 100 : null;

          return (
            <React.Fragment key={g.id}>
              <tr>
                <td colSpan={5} style={{
                  padding: '40px 0 12px', borderBottom: `1px solid ${theme.borderStrong}`,
                  ...typo({ fs: 24, w: 600, ls: '-0.02em' }), fontFamily: TYPO.fontDisplay,
                  color: theme.text,
                }}>
                  <span style={{
                    display: 'inline-block', width: 8, height: 8, borderRadius: 999,
                    background: dotColorFrom(theme, g.dotKey), marginRight: 12,
                    verticalAlign: 'middle',
                  }} />
                  {g.label}
                </td>
              </tr>
              {cuentas.map((c) => {
                const ytd = sumYTD(c, mesMax);
                const ytdPrev = sumYTD(byCuentaPrev.get(c.cuenta_norm), mesMax);
                const delta = ytdPrev > 0 ? ((ytd - ytdPrev) / ytdPrev) * 100 : null;
                const series = [1,2,3,4,5,6,7,8,9,10,11,12].map((m) => c.valores?.[m] ?? null);
                return (
                  <tr key={c.cuenta_norm}>
                    <td style={cellL}>{c.cuenta}</td>
                    <td style={{ ...cellR, fontWeight: 500 }}>{g.formato === 'pct' ? '—' : fmtCompact(ytd)}</td>
                    <td style={{ ...cellR, color: theme.textMuted }}>{fmtCompact(ytdPrev)}</td>
                    <td style={{ ...cellR, color: delta == null ? theme.textMuted : delta >= 0 ? theme.green : theme.red, fontWeight: 500 }}>
                      {delta == null ? '—' : fmtPctDelta(delta)}
                    </td>
                    <td style={{ ...cellR, padding: '10px 16px' }}>
                      <div style={{ width: 56 }}>
                        <Sparkline theme={theme} series={series} mesMax={mesMax}
                          color={delta == null ? theme.textMuted : delta >= 0 ? theme.green : theme.red}
                          height={18} width={56} interactive />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {sub && (
                <tr>
                  <td style={{
                    ...cellL, ...typo({ fs: 17, w: 600, ls: '-0.015em' }), fontFamily: TYPO.fontDisplay,
                    borderTop: `2px solid ${theme.text}`, paddingTop: 20, paddingBottom: 20,
                  }}>{sub.cuenta}</td>
                  <td style={{
                    ...cellR, ...typo({ fs: 17, w: 600, ls: '-0.015em' }), fontFamily: TYPO.fontDisplay,
                    borderTop: `2px solid ${theme.text}`, paddingTop: 20, paddingBottom: 20,
                  }}>{fmtCompact(subTotal)}</td>
                  <td style={{
                    ...cellR, color: theme.textMuted, borderTop: `2px solid ${theme.text}`, paddingTop: 20, paddingBottom: 20,
                  }}>{fmtCompact(subTotalPrev)}</td>
                  <td style={{
                    ...cellR, color: deltaSub == null ? theme.textMuted : deltaSub >= 0 ? theme.green : theme.red,
                    fontWeight: 500, borderTop: `2px solid ${theme.text}`, paddingTop: 20, paddingBottom: 20,
                  }}>{deltaSub == null ? '—' : fmtPctDelta(deltaSub)}</td>
                  <td style={{ borderTop: `2px solid ${theme.text}` }}></td>
                </tr>
              )}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
