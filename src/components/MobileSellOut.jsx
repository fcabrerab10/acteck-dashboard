// MobileSellOut — pestaña interior Sell Out mobile-native.
// Aplica a Digitalife, Dicotech y PCEL (reemplaza SellOut{Cliente}V2 en mobile).
//
// Patrones mobile-native del mockup v3:
//   - Back header
//   - 2×2 KPI tiles (SO mes, SO 90d, SKUs vendidos, clientes activos)
//   - Sparklines scroll H mensuales
//   - Bar-list por marca (y por sucursal si el cliente lo tiene · Dicotech)
//   - Chips familia scroll H
//   - SKU list stackeado

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';
import { CLIENTES } from './Sidebar';

const MES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MARCA_COLORS = ['#007AFF', '#FF2D55', '#FF9500', '#5856D6', '#34C759', '#AF52DE'];
const SUC_COLORS   = ['#5856D6', '#34C759', '#FF9500', '#5AC8FA', '#FF2D55', '#AF52DE'];

const fmtMXN = (n) => {
  if (!isFinite(n) || !n) return '$0';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
};
const fmtInt = (n) => (isFinite(n) ? Math.round(n).toLocaleString('es-MX') : '—');

async function fetchAll(table, select, applyFilter = (q) => q) {
  // sellout_general devuelve HTTP 500 intermitente con ilike+range+order
  // (índice no cubre bien el filtro). Usamos chunks de 500 para tablas de
  // transacciones y de 1000 para el resto. También subimos retries a 6
  // porque en producción se observaron rachas de 3 500s consecutivos.
  const HEAVY_TABLES = new Set(['sellout_general', 'sellout_detalle', 'facturacion_clientes']);
  const PAGE = HEAVY_TABLES.has(table) ? 500 : 1000;
  const MAX_RETRIES = 6;
  const BACKOFF = [500, 1000, 2000, 4000, 8000, 16000];

  const acc = [];
  // BUG-FIX: cuando select === '*' o el primer campo es '*', antes se ejecutaba
    // .order('*') y Supabase respondía HTTP 400 → 6 retries fallaban → throw →
    // React Query devolvía data:[] silenciosamente.
    const orderCol = (() => {
      if (!select || select === '*') return 'id';
      if (/(^|,)\s*id\s*(,|$)/i.test(select)) return 'id';
      const first = select.split(',')[0].trim();
      return first === '*' ? 'id' : first;
    })();
  let from = 0;
  while (true) {
    let lastErr = null; let data = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      let q = supabase.from(table).select(select).order(orderCol, { ascending: true }).range(from, from + PAGE - 1);
      q = applyFilter(q);
      const res = await q;
      if (!res.error) { data = res.data || []; break; }
      lastErr = res.error;
      if (attempt < MAX_RETRIES - 1) {
        console.warn(`[fetchAll] ${table} chunk from=${from} attempt ${attempt + 1} falló (retry en ${BACKOFF[attempt]}ms):`, lastErr?.message || lastErr);
        await new Promise((r) => setTimeout(r, BACKOFF[attempt]));
      }
    }
    if (data == null) {
      // Falló definitivamente. Lanzamos throw para que el useEffect muestre
      // error visible en vez de renderizar data parcial (que es exactamente
      // lo que causaba discrepancias entre usuarios).
      console.error(`[fetchAll] ${table} chunk from=${from} falló tras ${MAX_RETRIES} intentos. DATA INCOMPLETA — abortando para no mostrar números incorrectos.`);
      throw new Error(`No se pudo cargar ${table} completo (chunk ${from}). Refresca la página. Detalle: ${lastErr?.message || 'error desconocido'}`);
    }
    if (data.length === 0) break;
    acc.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return acc;
}

// Nombre de vista por cliente
const VIEW = (cliente) => ({
  mensual: `v_sellout_${cliente}_mensual`,
  skuMes:  `v_sellout_${cliente}_sku_mes`,
  marcaMes: `v_sellout_${cliente}_marca_mes`,
  sucursalMes: cliente === 'dicotech' ? 'v_sellout_dicotech_sucursal_mes' : null,
});

export default function MobileSellOut({ clienteKey, onBack, onNavegar }) {
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';

  const anio = new Date().getFullYear();
  const mesActual = new Date().getMonth() + 1;
  const cliente = CLIENTES[clienteKey];
  const views = VIEW(clienteKey);

  const [loading, setLoading] = useState(true);
  const [mensual, setMensual] = useState([]);
  const [skuMes, setSkuMes] = useState([]);
  const [marcaMes, setMarcaMes] = useState([]);
  const [sucursalMes, setSucursalMes] = useState([]);
  const [roadmap, setRoadmap] = useState([]);
  const [famFiltro, setFamFiltro] = useState('Todas');
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const tasks = [
          fetchAll(views.mensual, 'anio,mes,piezas,monto', (q) => q.in('anio', [anio - 1, anio])),
          fetchAll(views.skuMes, 'sku,anio,mes,piezas,monto', (q) => q.eq('anio', anio)),
          fetchAll(views.marcaMes, 'marca,anio,mes,piezas,monto', (q) => q.eq('anio', anio).eq('mes', mesActual)).catch(() => []),
          fetchAll('roadmap_sku', 'sku,marca,descripcion,familia'),
        ];
        if (views.sucursalMes) {
          tasks.push(fetchAll(views.sucursalMes, 'sucursal,anio,mes,piezas,monto', (q) => q.eq('anio', anio).eq('mes', mesActual)));
        } else {
          tasks.push(Promise.resolve([]));
        }
        const [m, s, mm, rm, su] = await Promise.all(tasks);
        if (!alive) return;
        setMensual(m || []);
        setSkuMes(s || []);
        setMarcaMes(mm || []);
        setRoadmap(rm || []);
        setSucursalMes(su || []);
      } catch (e) {
        if (alive) setError(e.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [clienteKey, anio, mesActual]);

  const roadmapMap = useMemo(() => {
    const m = new Map();
    for (const r of roadmap) m.set(r.sku, r);
    return m;
  }, [roadmap]);

  // Series mensuales (año actual)
  const serieMonto = useMemo(() => {
    const arr = Array(12).fill(0);
    for (const r of mensual) {
      if (Number(r.anio) !== anio) continue;
      const i = Number(r.mes) - 1;
      if (i >= 0 && i < 12) arr[i] += Number(r.monto) || 0;
    }
    return arr;
  }, [mensual, anio]);
  const seriePiezas = useMemo(() => {
    const arr = Array(12).fill(0);
    for (const r of mensual) {
      if (Number(r.anio) !== anio) continue;
      const i = Number(r.mes) - 1;
      if (i >= 0 && i < 12) arr[i] += Number(r.piezas) || 0;
    }
    return arr;
  }, [mensual, anio]);

  // KPIs
  const kpis = useMemo(() => {
    const soMes = serieMonto[mesActual - 1] || 0;
    const so90d = serieMonto.slice(Math.max(0, mesActual - 3), mesActual).reduce((s, v) => s + v, 0);
    const prevMes = mesActual > 1 ? serieMonto[mesActual - 2] : 0;
    const delta = prevMes > 0 ? Math.round(((soMes - prevMes) / prevMes) * 100) : 0;
    const piezasMes = seriePiezas[mesActual - 1] || 0;
    const skusVendidos = new Set();
    for (const r of skuMes) {
      if (Number(r.mes) === mesActual && (Number(r.monto) > 0 || Number(r.piezas) > 0)) skusVendidos.add(r.sku);
    }
    const ticket = piezasMes > 0 ? soMes / piezasMes : 0;
    return { soMes, so90d, delta, piezasMes, skusVendidos: skusVendidos.size, ticket };
  }, [serieMonto, seriePiezas, skuMes, mesActual]);

  // Top marca
  const porMarca = useMemo(() => {
    const m = new Map();
    // Preferir vista agregada si tiene data
    if (marcaMes.length > 0) {
      for (const r of marcaMes) {
        const k = r.marca || 'Otras';
        m.set(k, (m.get(k) || 0) + (Number(r.monto) || 0));
      }
    } else {
      // Fallback: derivar de skuMes + roadmap para el mes actual
      for (const r of skuMes) {
        if (Number(r.mes) !== mesActual) continue;
        const k = roadmapMap.get(r.sku)?.marca || 'Otras';
        m.set(k, (m.get(k) || 0) + (Number(r.monto) || 0));
      }
    }
    const arr = Array.from(m.entries()).map(([n, monto]) => ({ n, monto })).sort((a, b) => b.monto - a.monto);
    const total = arr.reduce((s, r) => s + r.monto, 0);
    return arr.map(r => ({ ...r, pct: total > 0 ? (r.monto / total) * 100 : 0 })).slice(0, 5);
  }, [marcaMes, skuMes, roadmapMap, mesActual]);

  // Top sucursal (solo Dicotech)
  const porSucursal = useMemo(() => {
    if (!sucursalMes.length) return [];
    const arr = sucursalMes
      .map(r => ({ n: r.sucursal, monto: Number(r.monto) || 0 }))
      .sort((a, b) => b.monto - a.monto);
    const total = arr.reduce((s, r) => s + r.monto, 0);
    return arr.map(r => ({ ...r, pct: total > 0 ? (r.monto / total) * 100 : 0 })).slice(0, 6);
  }, [sucursalMes]);

  // Familias
  const familias = useMemo(() => {
    const set = new Set();
    for (const r of skuMes) {
      if (Number(r.mes) !== mesActual) continue;
      const fam = roadmapMap.get(r.sku)?.familia;
      if (fam) set.add(fam.trim());
    }
    return ['Todas', ...Array.from(set).sort()];
  }, [skuMes, roadmapMap, mesActual]);

  const skuList = useMemo(() => {
    const map = new Map();
    for (const r of skuMes) {
      if (Number(r.mes) !== mesActual) continue;
      const rm = roadmapMap.get(r.sku);
      const familia = (rm?.familia || 'Sin familia').trim();
      if (famFiltro !== 'Todas' && familia !== famFiltro) continue;
      if (!map.has(r.sku)) map.set(r.sku, { sku: r.sku, descripcion: rm?.descripcion || '', familia, monto: 0, piezas: 0 });
      const it = map.get(r.sku);
      it.monto += Number(r.monto) || 0;
      it.piezas += Number(r.piezas) || 0;
    }
    return Array.from(map.values()).sort((a, b) => b.monto - a.monto).slice(0, 30);
  }, [skuMes, roadmapMap, famFiltro, mesActual]);

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
        <h1 style={{ margin: 0, fontFamily: TYPO.fontDisplay, fontSize: 32, fontWeight: 700, letterSpacing: '-.03em', color: theme.text }}>Sell Out</h1>
        <div style={{ color: theme.textMuted, fontSize: 12.5, marginTop: 2 }}>{MES_CORTO[mesActual - 1]} {anio}</div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: theme.textMuted, fontSize: 13 }}>Cargando…</div>
      ) : error ? (
        <div style={{ margin: '4px 18px', padding: 16, background: 'rgba(255,59,48,.10)', border: '1px solid rgba(255,59,48,.22)', borderRadius: 12, color: theme.red || '#FF3B30', fontSize: 12.5 }}>
          {error}
        </div>
      ) : (
        <>
          {/* 2×2 KPI tiles */}
          <div style={{ padding: '10px 18px 6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <KpiTile theme={theme} label={`SO ${MES_CORTO[mesActual - 1]}`}
              value={fmtMXN(kpis.soMes)}
              delta={kpis.delta ? `${kpis.delta > 0 ? '+' : ''}${kpis.delta}% vs mes ant.` : '—'}
              positive={kpis.delta >= 0} />
            <KpiTile theme={theme} label="SO 90 días"
              value={fmtMXN(kpis.so90d)}
              delta={`${MES_CORTO[Math.max(0, mesActual - 3)]}–${MES_CORTO[mesActual - 1]}`} />
            <KpiTile theme={theme} label="SKUs vendidos"
              value={kpis.skusVendidos}
              delta={`${fmtInt(kpis.piezasMes)} pz`} />
            <KpiTile theme={theme} label="Ticket promedio"
              value={fmtMXN(kpis.ticket)}
              delta="por pieza" />
          </div>

          {/* Sparklines mensuales scroll H */}
          <SectionHead theme={theme} title="Evolución mensual" sub={`${anio}`} />
          <div style={{ padding: '4px 18px 8px', display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }} className="mso-hide">
            {serieMonto.map((m, i) => {
              const activo = i + 1 === mesActual;
              const prev = i > 0 ? serieMonto[i - 1] : 0;
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
                  <Sparkline data={serieMonto.slice(Math.max(0, i - 5), i + 1)} color={activo ? theme.accent : theme.textSubtle || theme.textMuted} />
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
              <SectionHead theme={theme} title="Sell Out por marca" sub={`${MES_CORTO[mesActual - 1]} · ${fmtMXN(porMarca.reduce((s, r) => s + r.monto, 0))}`} />
              <BarList theme={theme} isDark={isDark} data={porMarca} colors={MARCA_COLORS} />
            </>
          )}

          {/* Bar-list por sucursal (solo Dicotech) */}
          {porSucursal.length > 0 && (
            <>
              <SectionHead theme={theme} title="Top sucursales" sub={`${MES_CORTO[mesActual - 1]} · ${fmtMXN(porSucursal.reduce((s, r) => s + r.monto, 0))}`} />
              <BarList theme={theme} isDark={isDark} data={porSucursal} colors={SUC_COLORS} />
            </>
          )}

          {/* Filtros familia */}
          <SectionHead theme={theme} title="Detalle por SKU" sub={`${skuList.length} SKUs`} />
          <div style={{ padding: '4px 18px 6px', display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }} className="mso-hide">
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
            {skuList.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: theme.textMuted, fontSize: 13, background: theme.surface, border: `1px dashed ${theme.border}`, borderRadius: 12, marginTop: 8 }}>
                Sin ventas en este filtro este mes
              </div>
            )}
            {skuList.map((s) => (
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

      <style>{`.mso-hide::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}

// ─────────────── Sub-componentes ───────────────
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

function BarList({ theme, isDark, data, colors }) {
  return (
    <div style={{ margin: '4px 18px 8px', padding: 14, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.map((r, i) => {
          const color = colors[i] || theme.accent;
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
