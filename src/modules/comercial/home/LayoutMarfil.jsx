// Layout Marfil · HomeCliente estilo apple.com/newsroom.
// Hero warm eyebrow pill + venta mes + featurette azul con 4 métricas
// + detail card marfil con timeline mensual + top SKUs.
import React from 'react';
import { TYPO } from '../../../lib/themeTokens';
import {
  typo, fmtCompact, fmtNumber, MESES_FULL,
  ChartVentaMensual, DeltaLine, ProgressBar, TareasPanel, TopSkusTable,
} from './shared';

export default function LayoutMarfil({ theme, cliente, clienteKey, kpis, mesActual, ventasPorMes, cuotasPorMes, invLatest, selloutSemana, topSkus, tareas, minutasList, onKpiClick }) {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: cliente.color || theme.text }} />
          <span style={{ ...typo({ fs: 15, w: 500 }), fontFamily: TYPO.fontDisplay, color: theme.text }}>
            {cliente.label || clienteKey}
          </span>
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
          {MESES_FULL[mesActual - 1]} {new Date().getFullYear()}
        </div>
        <h2 style={{
          ...typo(TYPO.heroDisplay), fontFamily: TYPO.fontDisplay,
          color: theme.text, margin: '0 0 32px',
        }}>
          {cliente.label || clienteKey}.
        </h2>
        <p style={{
          ...typo({ fs: 22, w: 400, lh: 1.4 }), fontFamily: TYPO.fontText,
          color: theme.textMuted, maxWidth: 640, margin: '0 auto 48px',
        }}>
          El cierre del mes en un vistazo.
        </p>
        <div style={{
          ...typo(TYPO.heroMax), fontFamily: TYPO.fontDisplay,
          color: theme.text, margin: 0, fontVariantNumeric: 'tabular-nums',
        }}>{fmtCompact(kpis.ventaMes)}</div>
        <div style={{ marginTop: 24 }}>
          <DeltaLine theme={theme} pct={kpis.deltaVentaYoY} label="vs mes anterior" size="lg" />
        </div>
        {kpis.cumplMes != null && (
          <div style={{ maxWidth: 400, margin: '32px auto 0' }}>
            <ProgressBar theme={theme} pct={kpis.cumplMes} color={theme.accent} />
            <div style={{
              ...typo(TYPO.caption), color: theme.textMuted, marginTop: 8,
              display: 'flex', justifyContent: 'space-between',
            }}>
              <span>Cumplimiento cuota · {kpis.cumplMes.toFixed(1)}%</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>Meta {fmtCompact(kpis.cuotaMes)}</span>
            </div>
          </div>
        )}
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
          El cierre acumulado
        </div>
        <h3 style={{
          ...typo(TYPO.hero), fontFamily: TYPO.fontDisplay,
          color: theme.textOnInverse || '#F7F3EC', margin: '0 0 20px',
        }}>Todo el año en 4 números.</h3>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 40,
          maxWidth: 1100, margin: '60px auto 0', textAlign: 'left',
        }}>
          <InverseMetric theme={theme} label="Sell In YTD" value={fmtCompact(kpis.ventaYTD)} delta={kpis.deltaVentaYTD} onClick={() => onKpiClick?.('sellin')} />
          <InverseMetric theme={theme} label="Sell Out YTD" value={fmtCompact(kpis.sellOutYTD)} delta={kpis.deltaSellOutYTD} onClick={() => onKpiClick?.('sellout')} />
          <InverseMetric theme={theme} label="Inventario" value={fmtCompact(invLatest.valor)} sub={`${fmtNumber(invLatest.unidades)} pzs`} onClick={() => onKpiClick?.('inventario')} />
          <InverseMetric theme={theme} label="Sellout semana" value={fmtCompact(selloutSemana.total)} delta={selloutSemana.delta} onClick={() => onKpiClick?.('sellout')} />
        </div>
      </div>

      {/* Detail card marfil oscuro con tendencia */}
      <div style={{
        background: theme.surface, margin: '40px 0 0',
        borderRadius: 24, padding: 40,
      }}>
        <h4 style={{
          ...typo({ fs: 28, w: 600, ls: '-0.025em' }), fontFamily: TYPO.fontDisplay,
          color: theme.text, margin: '0 0 24px',
        }}>Tendencia mensual.</h4>
        <ChartVentaMensual theme={theme} ventasPorMes={ventasPorMes}
          cuotasPorMes={cuotasPorMes} mesMax={mesActual} />
      </div>

      {/* Grid 2 col · Top SKUs + Tareas */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, marginTop: 20,
      }}>
        <div style={{ background: theme.surface, borderRadius: 24, padding: 32 }}>
          <h4 style={{
            ...typo({ fs: 22, w: 600, ls: '-0.02em' }), fontFamily: TYPO.fontDisplay,
            color: theme.text, margin: '0 0 8px',
          }}>Top SKUs.</h4>
          <p style={{ ...typo(TYPO.body), color: theme.textMuted, fontFamily: TYPO.fontText, margin: '0 0 24px' }}>
            Los 10 productos que más movieron el año.
          </p>
          <TopSkusTable theme={theme} topSkus={topSkus} />
        </div>
        <div style={{ background: theme.surface, borderRadius: 24, padding: 32 }}>
          <h4 style={{
            ...typo({ fs: 22, w: 600, ls: '-0.02em' }), fontFamily: TYPO.fontDisplay,
            color: theme.text, margin: '0 0 8px',
          }}>Pendientes.</h4>
          <p style={{ ...typo(TYPO.body), color: theme.textMuted, fontFamily: TYPO.fontText, margin: '0 0 24px' }}>
            Con el equipo del cliente.
          </p>
          <TareasPanel theme={theme} tareas={tareas} max={6} />
        </div>
      </div>

      {/* Minutas timeline */}
      {minutasList?.length > 0 && (
        <div style={{
          background: theme.surface, borderRadius: 24, padding: 32, marginTop: 20,
        }}>
          <h4 style={{
            ...typo({ fs: 22, w: 600, ls: '-0.02em' }), fontFamily: TYPO.fontDisplay,
            color: theme.text, margin: '0 0 24px',
          }}>Últimas conversaciones.</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {minutasList.slice(0, 3).map((m) => (
              <div key={m.id} style={{
                padding: 20, background: theme.bg, borderRadius: 16,
              }}>
                <div style={{
                  ...typo(TYPO.eyebrow), color: theme.eyebrowColor || theme.orange,
                  fontWeight: 600, marginBottom: 8,
                }}>
                  {m.fecha_reunion && new Date(m.fecha_reunion).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}
                </div>
                <div style={{ ...typo({ fs: 15, w: 500 }), color: theme.text, fontFamily: TYPO.fontText }}>
                  {m.tema || m.resumen || 'Reunión'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p style={{
        ...typo(TYPO.caption), color: theme.textSubtle,
        textAlign: 'center', marginTop: 40, fontFamily: TYPO.fontText,
      }}>Cifras en MXN · Actualizado hoy</p>
    </div>
  );
}

function InverseMetric({ theme, label, value, delta, sub, onClick }) {
  const muted = theme.textMutedOnInverse || 'rgba(255,255,255,0.7)';
  return (
    <button onClick={onClick} style={{
      background: 'transparent', border: 'none', cursor: onClick ? 'pointer' : 'default',
      padding: 0, fontFamily: 'inherit', color: 'inherit', textAlign: 'left',
      borderTop: `1px solid rgba(247,243,236,0.2)`, paddingTop: 24,
    }}>
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
          {delta != null && sub && ' · '}
          {sub}
        </div>
      )}
    </button>
  );
}
