// Layout Claro · HomeCliente estilo apple.com landing.
// Hero blanco con venta mes gigante + sección negra 4 metric cards
// + grid 2×2 áreas + tech-specs top SKUs + timeline tareas.
import React from 'react';
import { TYPO } from '../../../lib/themeTokens';
import { ShoppingCart, ShoppingBag, Package, Wallet } from 'lucide-react';
import {
  typo, fmtCompact, fmtNumber, MESES_FULL,
  ChartVentaMensual, DeltaLine, ProgressBar, TareasPanel, TopSkusTable,
} from './shared';

export default function LayoutClaro({ theme, cliente, clienteKey, kpis, mesActual, ventasPorMes, cuotasPorMes, invLatest, selloutSemana, topSkus, tareas, minutasList, onKpiClick }) {
  return (
    <div style={{ background: theme.bg, color: theme.text, fontFamily: TYPO.fontText }}>
      {/* ─── HERO BLANCO — nombre cliente + venta mes ─── */}
      <section style={{ background: theme.bg, padding: '60px 40px 40px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: cliente.color || theme.text }} />
          <span style={{ ...typo({ fs: 21, w: 400 }), fontFamily: TYPO.fontDisplay, color: theme.text }}>
            {cliente.label || clienteKey}
          </span>
        </div>
        <div style={{ ...typo({ fs: 13, w: 500 }), color: theme.textMuted, marginBottom: 12 }}>
          Venta del mes · {MESES_FULL[mesActual - 1]}
        </div>
        <div style={{
          ...typo(TYPO.heroMax), fontFamily: TYPO.fontDisplay,
          color: theme.text, fontVariantNumeric: 'tabular-nums', margin: 0,
        }}>{fmtCompact(kpis.ventaMes)}</div>
        <div style={{ marginTop: 24 }}>
          <DeltaLine theme={theme} pct={kpis.deltaVentaYoY} label={`vs ${MESES_FULL[mesActual - 1]} anterior`} size="lg" />
        </div>
        {kpis.cumplMes != null && (
          <div style={{ maxWidth: 400, margin: '40px auto 0' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', ...typo({ fs: 13, w: 500 }),
              color: theme.textMuted, marginBottom: 8,
            }}>
              <span>Cumplimiento de cuota</span>
              <span style={{ color: theme.text, fontVariantNumeric: 'tabular-nums' }}>{kpis.cumplMes.toFixed(1)}%</span>
            </div>
            <ProgressBar theme={theme} pct={kpis.cumplMes} />
            <div style={{ ...typo(TYPO.caption), color: theme.textMuted, marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>
              Meta: {fmtCompact(kpis.cuotaMes)}
            </div>
          </div>
        )}
      </section>

      {/* ─── SECCIÓN NEGRA ALTERNADA · 4 metric cards ─── */}
      <section style={{
        background: theme.surfaceDark, color: theme.textOnDark,
        padding: '80px 40px', textAlign: 'center',
      }}>
        <h3 style={{
          ...typo(TYPO.hero), fontFamily: TYPO.fontDisplay,
          color: theme.textOnDark, margin: '0 0 20px',
        }}>El cierre completo.</h3>
        <p style={{
          ...typo({ fs: 19, w: 400 }), fontFamily: TYPO.fontText,
          color: 'rgba(245,245,247,0.85)', maxWidth: 640, margin: '0 auto 60px',
          lineHeight: 1.4,
        }}>
          Todo lo que necesitas revisar del cliente en un solo lugar.
        </p>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 40,
          maxWidth: 1100, margin: '0 auto',
        }}>
          <BlackMetric theme={theme} icon={ShoppingCart} label="Sell In YTD"
            value={fmtCompact(kpis.ventaYTD)} delta={kpis.deltaVentaYTD} onClick={() => onKpiClick?.('sellin')} />
          <BlackMetric theme={theme} icon={ShoppingBag} label="Sell Out YTD"
            value={fmtCompact(kpis.sellOutYTD)} delta={kpis.deltaSellOutYTD} onClick={() => onKpiClick?.('sellout')} />
          <BlackMetric theme={theme} icon={Package} label="Inventario"
            value={fmtCompact(invLatest.valor)} sub={`${fmtNumber(invLatest.unidades)} pzs · ${invLatest.skus} SKUs`}
            onClick={() => onKpiClick?.('inventario')} />
          <BlackMetric theme={theme} icon={Wallet} label="Sellout semana"
            value={fmtCompact(selloutSemana.total)} delta={selloutSemana.delta}
            onClick={() => onKpiClick?.('sellout')} />
        </div>
      </section>

      {/* ─── GRID 2×2 · áreas con feature cards ─── */}
      <section style={{
        background: theme.bgAlt, padding: 24,
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24,
      }}>
        <FeatureCard theme={theme} variant="white"
          cat="TENDENCIA"
          title={`Venta neta ${new Date().getFullYear()}.`}
          highlight={`Comparativa mensual vs ${new Date().getFullYear() - 1} y cuota.`}
          body={
            <ChartVentaMensual theme={theme} ventasPorMes={ventasPorMes}
              cuotasPorMes={cuotasPorMes} mesMax={mesActual} />
          }
        />
        <FeatureCard theme={theme} variant="black"
          cat="TOP SKUs · YTD"
          title="Los productos que"
          highlight="mueven el negocio."
          body={<TopSkusTable theme={{ ...theme, text: theme.textOnDark, textMuted: 'rgba(245,245,247,0.6)', divider: 'rgba(255,255,255,0.06)' }} topSkus={topSkus} />}
        />
        <FeatureCard theme={theme} variant="black"
          cat="PENDIENTES"
          title="Tareas activas"
          highlight={`del equipo con ${cliente.label || clienteKey}.`}
          body={<TareasPanel theme={{ ...theme, text: theme.textOnDark, textMuted: 'rgba(245,245,247,0.6)', textSubtle: 'rgba(245,245,247,0.4)' }} tareas={tareas} />}
        />
        <FeatureCard theme={theme} variant="white"
          cat="ÚLTIMAS MINUTAS"
          title="Lo que hemos"
          highlight="conversado con el cliente."
          body={
            minutasList?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {minutasList.slice(0, 3).map((m) => (
                  <div key={m.id} style={{ padding: '10px 0', borderBottom: `1px solid ${theme.divider}` }}>
                    <div style={{ ...typo(TYPO.caption), color: theme.textMuted, marginBottom: 4 }}>
                      {m.fecha_reunion && new Date(m.fecha_reunion).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                    <div style={{ ...typo({ fs: 14, w: 500 }), color: theme.text, fontFamily: TYPO.fontText }}>
                      {m.tema || m.resumen || 'Reunión'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ ...typo(TYPO.body), color: theme.textMuted, textAlign: 'center', padding: '32px 0' }}>Sin minutas</div>
            )
          }
        />
      </section>

      {/* ─── FOOTER ─── */}
      <div style={{
        background: theme.bgAlt, padding: '24px 40px',
        borderTop: `1px solid ${theme.border}`,
        ...typo(TYPO.caption), color: theme.textMuted, fontFamily: TYPO.fontText,
        display: 'flex', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', gap: 20 }}>
          <span>Cifras en MXN</span>
          <span>Actualizado hoy</span>
        </div>
        <div>Cliente: {cliente.label || clienteKey}</div>
      </div>
    </div>
  );
}

// ─── BlackMetric ───
function BlackMetric({ theme, icon: Icon, label, value, delta, sub, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: 'transparent', border: 'none', cursor: onClick ? 'pointer' : 'default',
      textAlign: 'center', padding: 0, fontFamily: 'inherit', color: 'inherit',
    }}>
      {Icon && (
        <div style={{ marginBottom: 12 }}>
          <Icon style={{ width: 24, height: 24, strokeWidth: 1.5, opacity: 0.7 }} />
        </div>
      )}
      <div style={{
        ...typo({ fs: 12, w: 500, ls: '0.08em' }), fontFamily: TYPO.fontText,
        color: 'rgba(245,245,247,0.6)', textTransform: 'uppercase', marginBottom: 12,
      }}>{label}</div>
      <div style={{
        ...typo(TYPO.kpiMd), fontFamily: TYPO.fontDisplay,
        color: theme.textOnDark, fontVariantNumeric: 'tabular-nums', margin: 0,
      }}>{value}</div>
      {delta != null && (
        <div style={{
          ...typo({ fs: 14, w: 500 }), fontFamily: TYPO.fontText,
          color: delta >= 0 ? theme.green : theme.red,
          marginTop: 12, fontVariantNumeric: 'tabular-nums',
        }}>
          {delta >= 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}%
        </div>
      )}
      {sub && !delta && (
        <div style={{ ...typo(TYPO.caption), color: 'rgba(245,245,247,0.6)', marginTop: 10 }}>{sub}</div>
      )}
    </button>
  );
}

// ─── Feature card alternada ───
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
