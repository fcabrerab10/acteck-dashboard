// Layout Midnight · HomeCliente estilo iPhone Pro OLED.
// Top bar dot cliente + hero cinemático venta mes 140px cyan glow +
// KPI band film-frame + 4 cards dark con datos + tabla top SKUs.
import React from 'react';
import { TYPO } from '../../../lib/themeTokens';
import {
  typo, fmtCompact, fmtNumber, MESES_FULL, MESES_LBL,
  ChartVentaMensual, DeltaLine, ProgressBar, TareasPanel, TopSkusTable,
} from './shared';

export default function LayoutMidnight({ theme, cliente, clienteKey, kpis, mesActual, ventasPorMes, cuotasPorMes, invLatest, selloutSemana, topSkus, tareas, minutasList, onKpiClick }) {
  return (
    <div style={{
      background: theme.bg, color: theme.text,
      padding: '48px 40px', position: 'relative', overflow: 'hidden',
      fontFamily: TYPO.fontText,
    }}>
      {/* Glows radiales del OLED */}
      <div style={{
        position: 'absolute', top: -100, left: -100, width: 500, height: 500,
        background: theme.glowCyan, pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -100, right: -100, width: 600, height: 600,
        background: theme.glowPurple, pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Top bar con dot del cliente */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 60, paddingBottom: 16,
          borderBottom: `1px solid ${theme.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              width: 10, height: 10, borderRadius: 999, background: cliente.color || theme.accent,
              boxShadow: `0 0 8px ${cliente.color || theme.accent}80`,
            }} />
            <span style={{ ...typo({ fs: 15, w: 600 }), fontFamily: TYPO.fontDisplay, color: theme.text }}>
              {cliente.label || clienteKey}
            </span>
            <span style={{ ...typo(TYPO.caption), color: theme.textMuted, marginLeft: 8 }}>
              · Venta del mes
            </span>
          </div>
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
            {MESES_FULL[mesActual - 1]}
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
            Sell In · {MESES_FULL[mesActual - 1]}
          </div>
          <h2 style={{
            ...typo(TYPO.heroMax), fontFamily: TYPO.fontDisplay,
            color: theme.textStrong || theme.text, margin: '0 0 20px',
            fontVariantNumeric: 'tabular-nums',
            textShadow: `0 0 40px ${theme.accentGlow || 'rgba(100,210,255,0.15)'}`,
          }}>{fmtCompact(kpis.ventaMes)}</h2>
          <p style={{
            ...typo({ fs: 21, w: 400 }), fontFamily: TYPO.fontText,
            color: theme.textMuted, margin: '20px 0 0',
          }}>
            {kpis.deltaVentaYoY != null && (
              <>↑ <span style={{ color: theme.accent, fontWeight: 500 }}>{Math.abs(kpis.deltaVentaYoY).toFixed(1)}%</span> vs mes anterior</>
            )}
            {kpis.cumplMes != null && (
              <> · <span style={{ color: theme.accent, fontWeight: 500 }}>{kpis.cumplMes.toFixed(1)}%</span> de cuota</>
            )}
          </p>
        </div>

        {/* KPI band film-frame */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          borderTop: `1px solid ${theme.borderStrong}`,
          borderBottom: `1px solid ${theme.borderStrong}`,
          marginBottom: 60,
        }}>
          <KpiCell theme={theme} label="Sell In YTD" value={fmtCompact(kpis.ventaYTD)} delta={kpis.deltaVentaYTD} last={false} onClick={() => onKpiClick?.('sellin')} />
          <KpiCell theme={theme} label="Sell Out YTD" value={fmtCompact(kpis.sellOutYTD)} delta={kpis.deltaSellOutYTD} last={false} onClick={() => onKpiClick?.('sellout')} />
          <KpiCell theme={theme} label="Inventario" value={fmtCompact(invLatest.valor)} sub={`${fmtNumber(invLatest.unidades)} pzs`} last={false} onClick={() => onKpiClick?.('inventario')} />
          <KpiCell theme={theme} label="Sellout semana" value={fmtCompact(selloutSemana.total)} delta={selloutSemana.delta} last={true} onClick={() => onKpiClick?.('sellout')} />
        </div>

        {/* Chart tendencia */}
        <div style={{
          background: theme.surface, border: `1px solid ${theme.border}`,
          borderRadius: 16, padding: 24, marginBottom: 24,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
            <div>
              <div style={{ ...typo({ fs: 11, w: 600, ls: '0.06em' }), fontFamily: TYPO.fontText, color: theme.textMuted, textTransform: 'uppercase' }}>Tendencia mensual</div>
              <div style={{ ...typo({ fs: 22, w: 600, ls: '-0.02em' }), fontFamily: TYPO.fontDisplay, color: theme.textStrong || theme.text, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                {fmtCompact(kpis.ventaYTD)} <span style={{ color: theme.textMuted, ...typo(TYPO.body) }}>YTD</span>
              </div>
            </div>
            <div style={{ ...typo(TYPO.caption), color: theme.textMuted, textAlign: 'right' }}>
              <div>Línea sólida: {new Date().getFullYear()}</div>
              <div>Línea punteada: cuota · Año anterior</div>
            </div>
          </div>
          <ChartVentaMensual theme={theme} ventasPorMes={ventasPorMes}
            cuotasPorMes={cuotasPorMes} mesMax={mesActual} />
        </div>

        {/* 2 cards de detalle: SKUs + Tareas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
          <div style={{
            background: theme.surface, border: `1px solid ${theme.border}`,
            borderRadius: 16, padding: 24,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              paddingBottom: 12, borderBottom: `1px solid ${theme.borderStrong}`, marginBottom: 12,
            }}>
              <h4 style={{ ...typo(TYPO.h3), fontFamily: TYPO.fontDisplay, color: theme.text, margin: 0 }}>Top SKUs · YTD</h4>
              <span style={{ ...typo(TYPO.caption), color: theme.textMuted }}>Top 10 por venta</span>
            </div>
            <TopSkusTable theme={theme} topSkus={topSkus} />
          </div>
          <div style={{
            background: theme.surface, border: `1px solid ${theme.border}`,
            borderRadius: 16, padding: 24,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              paddingBottom: 12, borderBottom: `1px solid ${theme.borderStrong}`, marginBottom: 12,
            }}>
              <h4 style={{ ...typo(TYPO.h3), fontFamily: TYPO.fontDisplay, color: theme.text, margin: 0 }}>Pendientes</h4>
              <span style={{ ...typo(TYPO.caption), color: theme.textMuted }}>Tareas activas</span>
            </div>
            <TareasPanel theme={theme} tareas={tareas} max={6} />
          </div>
        </div>

        {/* Minutas timeline */}
        {minutasList?.length > 0 && (
          <div style={{
            background: theme.surface, border: `1px solid ${theme.border}`,
            borderRadius: 16, padding: 24, marginTop: 20,
          }}>
            <h4 style={{
              ...typo(TYPO.h3), fontFamily: TYPO.fontDisplay, color: theme.text,
              margin: '0 0 16px', paddingBottom: 12, borderBottom: `1px solid ${theme.borderStrong}`,
            }}>Últimas minutas</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              {minutasList.slice(0, 3).map((m) => (
                <div key={m.id} style={{ padding: '12px 0' }}>
                  <div style={{ ...typo(TYPO.caption), color: theme.accent, fontWeight: 500, marginBottom: 6 }}>
                    {m.fecha_reunion && new Date(m.fecha_reunion).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}
                  </div>
                  <div style={{ ...typo({ fs: 14, w: 500 }), color: theme.text, fontFamily: TYPO.fontText }}>
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
        }}>Cifras en MXN · Última actualización hoy</p>
      </div>
    </div>
  );
}

function KpiCell({ theme, label, value, delta, sub, last, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '32px 24px', borderRight: last ? 'none' : `1px solid ${theme.border}`,
      background: 'transparent', border: 'none', borderLeft: 'none', borderTop: 'none', borderBottom: 'none',
      cursor: onClick ? 'pointer' : 'default', textAlign: 'left', color: 'inherit', fontFamily: 'inherit',
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
    </button>
  );
}
