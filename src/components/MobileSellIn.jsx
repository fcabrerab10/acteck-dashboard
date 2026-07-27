// MobileSellIn — pestaña interior Sell In mobile-native.
// Reemplaza SellInClienteV2/Dicotech/Pcel en mobile.
//
// Patrones mobile-native del mockup v3:
//   - Back header "← Cliente"
//   - Título "Sell In"
//   - 2×2 KPI tiles compactas
//   - Sparklines scroll horizontal (mensuales)
//   - Bar-list vertical por marca (reemplaza pie/bar chart apachurrado)
//   - Chips familia scroll H
//   - SKUs stackeados verticalmente (no tabla horizontal)

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';
import { CLIENTES } from './Sidebar';

const MES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const fmtMXN = (n) => {
  if (!isFinite(n) || !n) return '$0';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
};
const fmtInt = (n) => (isFinite(n) ? Math.round(n).toLocaleString('es-MX') : '—');

async function fetchAll(table, select, applyFilter = (q) => q) {
  const PAGE = 1000;
  let acc = [], from = 0;
  while (true) {
    let q = supabase.from(table).select(select).range(from, from + PAGE - 1);
    q = applyFilter(q);
    const { data, error } = await q;
    if (error || !data || data.length === 0) break;
    acc = acc.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return acc;
}

export default function MobileSellIn({ clienteKey, onBack, onNavegar }) {
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';

  const anio = new Date().getFullYear();
  const mesActual = new Date().getMonth() + 1;
  const cliente = CLIENTES[clienteKey];

  const [loading, setLoading] = useState(true);
  const [facturacion, setFacturacion] = useState([]);
  const [roadmap, setRoadmap] = useState([]);
  const [cuotas, setCuotas] = useState([]);
  const [famFiltro, setFamFiltro] = useState('Todas');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [fact, rdmp, ct] = await Promise.all([
        fetchAll('facturacion_clientes', 'sku,anio,mes,piezas,monto',
          (q) => q.eq('cliente_key', clienteKey).eq('anio', anio)),
        fetchAll('roadmap_sku', 'sku,marca,descripcion,familia'),
        fetchAll('cuotas_mensuales', 'mes,cuota_min,cuota_ideal',
          (q) => q.eq('cliente', clienteKey).eq('anio', anio)),
      ]);
      if (!alive) return;
      setFacturacion(fact);
      setRoadmap(rdmp);
      setCuotas(ct);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [clienteKey, anio]);

  const roadmapMap = useMemo(() => {
    const m = new Map();
    for (const r of roadmap) m.set(r.sku, r);
    return m;
  }, [roadmap]);

  // Mensual
  const mensual = useMemo(() => {
    const monto = Array(12).fill(0), piezas = Array(12).fill(0);
    for (const r of facturacion) {
      const i = Number(r.mes) - 1;
      if (i < 0 || i > 11) continue;
      monto[i] += Number(r.monto) || 0;
      piezas[i] += Number(r.piezas) || 0;
    }
    return { monto, piezas };
  }, [facturacion]);

  const cuotaPorMes = useMemo(() => {
    const m = new Map();
    for (const c of cuotas) m.set(Number(c.mes), Number(c.cuota_min) || Number(c.cuota_ideal) || 0);
    return m;
  }, [cuotas]);

  // KPIs mes actual
  const kpis = useMemo(() => {
    const facturadoMes = mensual.monto[mesActual - 1];
    const cuotaMes = cuotaPorMes.get(mesActual) || 0;
    const cuotaPct = cuotaMes > 0 ? Math.round((facturadoMes / cuotaMes) * 100) : 0;
    const piezasMes = mensual.piezas[mesActual - 1];
    const skusMes = new Set();
    for (const r of facturacion) {
      if (Number(r.mes) === mesActual && (Number(r.monto) > 0 || Number(r.piezas) > 0)) skusMes.add(r.sku);
    }
    const ticket = piezasMes > 0 ? facturadoMes / piezasMes : 0;
    const facturadoMesAnt = mensual.monto[mesActual - 2] || 0;
    const delta = facturadoMesAnt > 0 ? Math.round(((facturadoMes - facturadoMesAnt) / facturadoMesAnt) * 100) : 0;
    return { facturadoMes, cuotaMes, cuotaPct, piezasMes, skusMes: skusMes.size, ticket, delta };
  }, [mensual, cuotaPorMes, mesActual, facturacion]);

  // Por marca (mes actual)
  const porMarca = useMemo(() => {
    const m = new Map();
    for (const r of facturacion) {
      if (Number(r.mes) !== mesActual) continue;
      const marca = roadmapMap.get(r.sku)?.marca || 'Otras';
      if (!m.has(marca)) m.set(marca, 0);
      m.set(marca, m.get(marca) + (Number(r.monto) || 0));
    }
    const arr = Array.from(m.entries()).map(([n, monto]) => ({ n, monto })).sort((a, b) => b.monto - a.monto);
    const total = arr.reduce((s, r) => s + r.monto, 0);
    return arr.map(r => ({ ...r, pct: total > 0 ? (r.monto / total) * 100 : 0 })).slice(0, 5);
  }, [facturacion, roadmapMap, mesActual]);

  // Familias disponibles
  const familias = useMemo(() => {
    const set = new Set();
    for (const r of facturacion) {
      const rm = roadmapMap.get(r.sku);
      if (rm?.familia) set.add(rm.familia.trim());
    }
    return ['Todas', ...Array.from(set).sort()];
  }, [facturacion, roadmapMap]);

  // SKUs del mes con datos
  const skusMes = useMemo(() => {
    const map = new Map();
    for (const r of facturacion) {
      if (Number(r.mes) !== mesActual) continue;
      const sku = r.sku;
      const rm = roadmapMap.get(sku);
      const familia = (rm?.familia || 'Sin familia').trim();
      if (famFiltro !== 'Todas' && familia !== famFiltro) continue;
      if (!map.has(sku)) map.set(sku, { sku, descripcion: rm?.descripcion || '', familia, monto: 0, piezas: 0 });
      const it = map.get(sku);
      it.monto += Number(r.monto) || 0;
      it.piezas += Number(r.piezas) || 0;
    }
    return Array.from(map.values()).sort((a, b) => b.monto - a.monto).slice(0, 30);
  }, [facturacion, roadmapMap, mesActual, famFiltro]);

  return (
    <div style={{ background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100vh' }}>
      {/* Back header */}
      <div style={{ padding: '10px 18px 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onBack}
          style={{ background: 'transparent', border: 'none', padding: '6px 10px', color: theme.accent, fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}
        >
          <ChevronLeft size={16} strokeWidth={2.2} /> Cliente
        </button>
        <span style={{ fontSize: 12.5, color: theme.textMuted, fontWeight: 600 }}>{cliente?.label || clienteKey}</span>
      </div>

      {/* Título */}
      <div style={{ padding: '2px 18px 6px' }}>
        <h1 style={{ margin: 0, fontFamily: TYPO.fontDisplay, fontSize: 32, fontWeight: 700, letterSpacing: '-.03em', color: theme.text }}>Sell In</h1>
        <div style={{ color: theme.textMuted, fontSize: 12.5, marginTop: 2 }}>{MES_CORTO[mesActual - 1]} {anio}</div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: theme.textMuted, fontSize: 13 }}>Cargando…</div>
      ) : (
        <>
          {/* 2×2 KPI tiles */}
          <div style={{ padding: '10px 18px 6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <KpiTile theme={theme} label={`Facturado ${MES_CORTO[mesActual - 1]}`}
              value={fmtMXN(kpis.facturadoMes)}
              delta={kpis.delta ? `${kpis.delta > 0 ? '+' : ''}${kpis.delta}% vs mes ant.` : '—'}
              positive={kpis.delta >= 0} />
            <KpiTile theme={theme} label="Cuota"
              value={`${kpis.cuotaPct}%`}
              delta={kpis.cuotaMes > kpis.facturadoMes ? `Gap ${fmtMXN(kpis.cuotaMes - kpis.facturadoMes)}` : 'On track'}
              positive={kpis.cuotaPct >= 100} />
            <KpiTile theme={theme} label="SKUs facturados"
              value={kpis.skusMes}
              delta={`${fmtInt(kpis.piezasMes)} pz`} />
            <KpiTile theme={theme} label="Ticket promedio"
              value={fmtMXN(kpis.ticket)}
              delta="por pieza" />
          </div>

          {/* Sparklines mensuales scroll H */}
          <SectionHead theme={theme} title="Evolución mensual" sub={`${anio}`} />
          <div style={{ padding: '4px 18px 8px', display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }} className="msi-hide">
            {mensual.monto.map((m, i) => {
              const activo = i + 1 === mesActual;
              const prev = i > 0 ? mensual.monto[i - 1] : 0;
              const delta = prev > 0 ? Math.round(((m - prev) / prev) * 100) : 0;
              return (
                <div key={i} style={{
                  flex: '0 0 128px',
                  background: theme.surface, border: `1px solid ${activo ? theme.accent : theme.border}`,
                  borderRadius: 14, padding: 12,
                  display: 'flex', flexDirection: 'column',
                }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: theme.textMuted, fontWeight: 700 }}>{MES_CORTO[i]}</div>
                  <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.02em', marginTop: 2, color: theme.text, fontVariantNumeric: 'tabular-nums', fontFamily: TYPO.fontDisplay }}>{fmtMXN(m)}</div>
                  <Sparkline data={mensual.monto.slice(Math.max(0, i - 5), i + 1)} color={activo ? theme.accent : theme.textSubtle || theme.textMuted} />
                  <div style={{ fontSize: 10.5, fontWeight: 600, marginTop: 4,
                    color: delta > 0 ? (theme.green || '#34C759') : delta < 0 ? (theme.pink || '#FF3B30') : theme.textMuted }}>
                    {delta > 0 ? '+' : ''}{delta}%
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bar-list por marca */}
          {porMarca.length > 0 && (
            <>
              <SectionHead theme={theme} title="Sell In por marca" sub={`${MES_CORTO[mesActual - 1]} · ${fmtMXN(porMarca.reduce((s, r) => s + r.monto, 0))}`} />
              <div style={{ margin: '4px 18px 8px', padding: 14, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {porMarca.map((r, i) => {
                    const color = MARCA_COLORS[i] || theme.accent;
                    return (
                      <div key={r.n} style={{ display: 'grid', gridTemplateColumns: '78px 1fr 78px', alignItems: 'center', gap: 10, fontSize: 12 }}>
                        <span style={{ color: theme.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.n}</span>
                        <div style={{ height: 8, background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${r.pct}%`, background: color, borderRadius: 4, transition: 'width 400ms cubic-bezier(.4,0,.2,1)' }} />
                        </div>
                        <span style={{ textAlign: 'right', color: theme.text, fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 12 }}>{fmtMXN(r.monto)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Filtros familia */}
          <SectionHead theme={theme} title="Detalle por SKU" sub={`${skusMes.length} SKUs`} />
          <div style={{ padding: '4px 18px 6px', display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }} className="msi-hide">
            {familias.map((f) => (
              <button key={f}
                onClick={() => setFamFiltro(f)}
                style={{
                  flex: '0 0 auto', padding: '7px 12px', borderRadius: 100,
                  background: famFiltro === f ? theme.text : theme.surface,
                  border: `1px solid ${famFiltro === f ? theme.text : theme.border}`,
                  color: famFiltro === f ? theme.bg : theme.textMuted,
                  fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                  cursor: 'pointer', fontFamily: TYPO.fontText,
                }}
              >{f}</button>
            ))}
          </div>

          {/* SKU list stackeado */}
          <div style={{ padding: '0 18px 24px' }}>
            {skusMes.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: theme.textMuted, fontSize: 13, background: theme.surface, border: `1px dashed ${theme.border}`, borderRadius: 12, marginTop: 8 }}>
                Sin ventas en este filtro este mes
              </div>
            )}
            {skusMes.map((s) => (
              <div key={s.sku} style={{
                padding: '10px 0', borderTop: `1px solid ${theme.divider}`,
                display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 12px',
              }}>
                <div style={{ fontSize: 11.5, color: theme.textMuted, fontFamily: '"SF Mono", ui-monospace, monospace', gridColumn: 1 }}>{s.sku}</div>
                <div style={{ fontSize: 13, color: theme.text, fontWeight: 600, gridColumn: 1, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{s.descripcion || '(sin descripción)'}</div>
                <div style={{ gridColumn: 2, gridRow: '1 / span 2', alignSelf: 'center', textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: theme.text, fontFamily: TYPO.fontDisplay }}>{fmtMXN(s.monto)}</div>
                  <div style={{ fontSize: 10.5, color: theme.textMuted }}>{fmtInt(s.piezas)} pz</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <style>{`.msi-hide::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}

// ─────────────── Sub-componentes ───────────────
const MARCA_COLORS = ['#007AFF', '#FF2D55', '#FF9500', '#5856D6', '#34C759', '#AF52DE'];

function KpiTile({ theme, label, value, delta, positive }) {
  const color = positive === true ? (theme.green || '#34C759') : positive === false ? (theme.pink || theme.red || '#FF3B30') : theme.textMuted;
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 12 }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: theme.textMuted, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.02em', marginTop: 2, color: theme.text, fontVariantNumeric: 'tabular-nums', fontFamily: TYPO.fontDisplay }}>{value}</div>
      {delta && <div style={{ fontSize: 10.5, fontWeight: 600, marginTop: 1, color }}>{delta}</div>}
    </div>
  );
}

function SectionHead({ theme, title, sub }) {
  return (
    <div style={{ padding: '12px 18px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-.01em', color: theme.text, fontFamily: TYPO.fontDisplay }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: theme.textMuted }}>{sub}</div>}
    </div>
  );
}

function Sparkline({ data, color }) {
  if (!data || data.length < 2) return <div style={{ height: 30 }} />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 104, h = 30;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => `${i * step},${h - ((v - min) / range) * h}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ marginTop: 6 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
