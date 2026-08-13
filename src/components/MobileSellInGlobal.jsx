// MobileSellInGlobal — Sell In consolidado cross-cliente.

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';
import { CLIENTES } from './Sidebar';

const MES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const CLIENTE_DOT = { digitalife: '#5856D6', dicotech: '#FF9500', pcel: '#34C759' };
const MARCA_COLOR = { ACTECK: '#007AFF', 'BALAM RUSH': '#FF2D55', OTRAS: '#8E8E93' };

const fmtCompact = (n) => {
  if (!isFinite(n) || !n) return '$0';
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(0)}K`;
  return `${s}$${Math.round(a)}`;
};
const fmtInt = (n) => (isFinite(n) ? Math.round(n).toLocaleString('es-MX') : '—');

async function fetchAll(table, select, applyFilter = q => q) {
  const PAGE = 1000;
  const acc = [];
  const firstCol = (select || 'id').split(',')[0].trim();
  const orderCol = /(^|,)\s*id\s*(,|$)/i.test(select) ? 'id' : firstCol;
  let from = 0;
  while (true) {
    let lastErr = null; let data = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      let q = supabase.from(table).select(select).order(orderCol, { ascending: true }).range(from, from + PAGE - 1);
      q = applyFilter(q);
      const res = await q;
      if (!res.error) { data = res.data || []; break; }
      lastErr = res.error;
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
    }
    if (data == null) {
      console.warn(`[fetchAll] ${table} chunk from=${from} falló tras 3 intentos:`, lastErr);
      return acc;
    }
    if (data.length === 0) break;
    acc.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return acc;
}

export default function MobileSellInGlobal({ onBack, onNavegar }) {
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [fact, setFact] = useState([]);         // Global YTD (vista pre-agregada)
  const [factRaw, setFactRaw] = useState([]);   // Raw con cliente_key para desglose
  const [roadmap, setRoadmap] = useState([]);
  const [cuotas, setCuotas] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      // Alineado con desktop SellInCliente(clienteKey=null): usa vistas globales
      // pre-agregadas server-side. Además fetch facturacion_clientes raw para
      // desglose por cliente (las vistas globales no lo traen).
      const [fGlobal, fRaw, r, cGlobal] = await Promise.all([
        fetchAll('v_facturacion_global_sku_mes', 'sku,anio,mes,piezas,monto', q => q.eq('anio', anio)),
        fetchAll('facturacion_clientes', 'sku,cliente_key,anio,mes,piezas,monto', q => q.eq('anio', anio)),
        fetchAll('roadmap_sku', 'sku,marca,descripcion,familia'),
        fetchAll('v_cuota_global_mensual', 'mes,cuota_min,cuota_ideal', q => q.eq('anio', anio)),
      ]);
      // fGlobal para KPIs YTD (montos oficiales del server-side aggregate).
      // fRaw para desglose por cliente (vistas globales no traen cliente_key).
      // Si vista global no existe, fact cae a fRaw.
      const f = fGlobal.length > 0 ? fGlobal : fRaw;
      const c = cGlobal;
      setFactRaw(fRaw);
      if (!alive) return;
      setFact(f); setRoadmap(r); setCuotas(c); setLoading(false);
    })();
    return () => { alive = false; };
  }, [anio]);

  const roadmapMap = useMemo(() => { const m = new Map(); roadmap.forEach(r => m.set(r.sku, r)); return m; }, [roadmap]);

  const mesActual = useMemo(() => {
    let last = 0;
    fact.forEach(r => { const m = Number(r.mes) || 0; if (m > last && Number(r.monto) > 0) last = m; });
    return last || new Date().getMonth() + 1;
  }, [fact]);

  const kpis = useMemo(() => {
    const mesM = fact.filter(r => Number(r.mes) === mesActual);
    const facturado = mesM.reduce((s, r) => s + (Number(r.monto) || 0), 0);
    const piezas = mesM.reduce((s, r) => s + (Number(r.piezas) || 0), 0);
    const prevMes = mesActual > 1 ? fact.filter(r => Number(r.mes) === mesActual - 1).reduce((s, r) => s + (Number(r.monto) || 0), 0) : 0;
    const delta = prevMes > 0 ? Math.round(((facturado - prevMes) / prevMes) * 100) : 0;
    // cuota_ideal como meta oficial (matching desktop). Si no hay cuota_ideal, cuota_min.
    const cuotaMes = cuotas.filter(r => Number(r.mes) === mesActual).reduce((s, r) => s + (Number(r.cuota_ideal || r.cuota_min) || 0), 0);
    const pct = cuotaMes > 0 ? Math.round((facturado / cuotaMes) * 100) : 0;
    const ticket = piezas > 0 ? facturado / piezas : 0;
    return { facturado, piezas, delta, cuotaMes, pct, ticket, gap: Math.max(0, cuotaMes - facturado) };
  }, [fact, cuotas, mesActual]);

  const serie = useMemo(() => {
    const arr = Array(12).fill(0);
    fact.forEach(r => { const m = Number(r.mes) - 1; if (m >= 0 && m < 12) arr[m] += Number(r.monto) || 0; });
    return arr;
  }, [fact]);

  // Desglose por cliente usa factRaw porque la vista global no trae cliente_key
  const porCliente = useMemo(() => {
    const m = new Map();
    factRaw.filter(r => Number(r.mes) === mesActual).forEach(r => {
      const k = r.cliente_key;
      m.set(k, (m.get(k) || 0) + (Number(r.monto) || 0));
    });
    const arr = Array.from(m.entries()).map(([k, v]) => ({ k, label: CLIENTES[k]?.label || k, color: CLIENTE_DOT[k] || theme.accent, monto: v })).sort((a, b) => b.monto - a.monto);
    const total = arr.reduce((s, r) => s + r.monto, 0);
    return arr.map(r => ({ ...r, pct: total > 0 ? (r.monto / total) * 100 : 0 }));
  }, [factRaw, mesActual, theme.accent]);

  const porMarca = useMemo(() => {
    const m = new Map();
    fact.filter(r => Number(r.mes) === mesActual).forEach(r => {
      const mk = (roadmapMap.get(r.sku)?.marca || 'OTRAS').toUpperCase();
      m.set(mk, (m.get(mk) || 0) + (Number(r.monto) || 0));
    });
    const arr = Array.from(m.entries()).map(([k, v]) => ({ k, monto: v, color: MARCA_COLOR[k] || theme.textMuted })).sort((a, b) => b.monto - a.monto);
    const total = arr.reduce((s, r) => s + r.monto, 0);
    return arr.map(r => ({ ...r, pct: total > 0 ? (r.monto / total) * 100 : 0 })).slice(0, 5);
  }, [fact, roadmapMap, mesActual, theme.textMuted]);

  const topSKUs = useMemo(() => {
    const m = new Map();
    fact.filter(r => Number(r.mes) === mesActual).forEach(r => {
      if (!m.has(r.sku)) m.set(r.sku, { sku: r.sku, monto: 0, piezas: 0, desc: roadmapMap.get(r.sku)?.descripcion || '' });
      const it = m.get(r.sku);
      it.monto += Number(r.monto) || 0; it.piezas += Number(r.piezas) || 0;
    });
    return Array.from(m.values()).sort((a, b) => b.monto - a.monto).slice(0, 10);
  }, [fact, roadmapMap, mesActual]);

  const [anios, setAnios] = useState([]);
  useEffect(() => { (async () => {
    const d = await fetchAll('facturacion_clientes', 'anio', q => q);
    setAnios(Array.from(new Set(d.map(r => Number(r.anio)))).sort());
  })(); }, []);

  return (
    <div style={{ background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100vh' }}>
      <BackHdr theme={theme} onBack={onBack} eyebrow="Dirección Comercial" />
      <TitleH theme={theme} h="Sell In" sub={`Global · ${MES_CORTO[mesActual - 1]} ${anio}`} />
      <YearPicker theme={theme} anios={anios.length ? anios : [anio - 1, anio]} anio={anio} setAnio={setAnio} />

      {loading ? <Loading theme={theme} /> : (
        <>
          <div style={{ padding: '6px 18px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Kpi theme={theme} label={`Facturado ${MES_CORTO[mesActual - 1]}`} value={fmtCompact(kpis.facturado)} delta={kpis.delta ? `${kpis.delta > 0 ? '+' : ''}${kpis.delta}% mes ant.` : '—'} positive={kpis.delta >= 0} />
            <Kpi theme={theme} label="Cuota" value={`${kpis.pct}%`} delta={kpis.gap > 0 ? `gap ${fmtCompact(kpis.gap)}` : 'on track'} positive={kpis.pct >= 100} />
            <Kpi theme={theme} label="Piezas" value={fmtInt(kpis.piezas)} delta="del mes" />
            <Kpi theme={theme} label="Ticket prom." value={fmtCompact(kpis.ticket)} delta="por pieza" />
          </div>

          <ChartMensual theme={theme} serie={serie} color={theme.accent} mesActual={mesActual} anio={anio} title="Evolución mensual" />

          {porCliente.length > 0 && <BarList theme={theme} isDark={isDark} title="Por cliente" sub={MES_CORTO[mesActual - 1]} data={porCliente} />}
          {porMarca.length > 0 && <BarList theme={theme} isDark={isDark} title="Por marca" sub={MES_CORTO[mesActual - 1]} data={porMarca.map(r => ({ ...r, label: r.k }))} />}

          <SecH theme={theme} title="Top SKUs" sub={`${topSKUs.length}`} />
          <div style={{ padding: '0 18px 24px' }}>
            {topSKUs.map(s => (
              <div key={s.sku} style={{ padding: '10px 0', borderTop: `1px solid ${theme.divider}`, display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 12px' }}>
                <div style={{ fontSize: 11.5, color: theme.textMuted, fontFamily: '"SF Mono", ui-monospace, monospace', gridColumn: 1 }}>{s.sku}</div>
                <div style={{ fontSize: 13, color: theme.text, fontWeight: 600, gridColumn: 1, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{s.desc || '(sin descripción)'}</div>
                <div style={{ gridColumn: 2, gridRow: '1 / span 2', alignSelf: 'center', textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: theme.text, fontFamily: TYPO.fontDisplay }}>{fmtCompact(s.monto)}</div>
                  <div style={{ fontSize: 10.5, color: theme.textMuted }}>{fmtInt(s.piezas)} pz</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Helpers compartidos
function BackHdr({ theme, onBack, eyebrow }) {
  return (
    <div style={{ padding: '10px 18px 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <button onClick={onBack} style={{ background: 'transparent', border: 'none', padding: '6px 10px', color: theme.accent, fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}>
        <ChevronLeft size={16} strokeWidth={2.2} /> Inicio
      </button>
      <span style={{ fontSize: 12.5, color: theme.textMuted, fontWeight: 600 }}>{eyebrow}</span>
    </div>
  );
}
function TitleH({ theme, h, sub }) {
  return (
    <div style={{ padding: '2px 18px 6px' }}>
      <h1 style={{ margin: 0, fontFamily: TYPO.fontDisplay, fontSize: 30, fontWeight: 700, letterSpacing: '-.03em', color: theme.text }}>{h}</h1>
      {sub && <div style={{ color: theme.textMuted, fontSize: 12.5, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
function YearPicker({ theme, anios, anio, setAnio }) {
  return (
    <div style={{ padding: '10px 18px 8px', display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
      {anios.map(a => (
        <button key={a} onClick={() => setAnio(a)}
          style={{ flex: '0 0 auto', padding: '7px 14px', borderRadius: 999, background: anio === a ? theme.text : theme.surface, border: `1px solid ${anio === a ? theme.text : theme.border}`, color: anio === a ? theme.bg : theme.textMuted, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: TYPO.fontText }}
        >{a}</button>
      ))}
    </div>
  );
}
function Kpi({ theme, label, value, delta, positive }) {
  const color = positive === true ? (theme.green || '#34C759') : positive === false ? (theme.pink || theme.red || '#FF3B30') : theme.textMuted;
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 12 }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: theme.textMuted, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.02em', marginTop: 2, color: theme.text, fontVariantNumeric: 'tabular-nums', fontFamily: TYPO.fontDisplay }}>{value}</div>
      {delta && <div style={{ fontSize: 10.5, fontWeight: 600, marginTop: 1, color }}>{delta}</div>}
    </div>
  );
}
function SecH({ theme, title, sub }) {
  return (
    <div style={{ padding: '12px 18px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-.01em', color: theme.text, fontFamily: TYPO.fontDisplay }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: theme.textMuted }}>{sub}</div>}
    </div>
  );
}
function Loading({ theme }) {
  return <div style={{ padding: 40, textAlign: 'center', color: theme.textMuted, fontSize: 13 }}>Cargando…</div>;
}
function BarList({ theme, isDark, title, sub, data }) {
  const total = data.reduce((s, r) => s + r.monto, 0);
  return (
    <>
      <SecH theme={theme} title={title} sub={sub ? `${sub} · ${fmtCompact(total)}` : fmtCompact(total)} />
      <div style={{ margin: '4px 18px 8px', padding: 14, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.map((r, i) => (
            <div key={r.k || r.label || i} style={{ display: 'grid', gridTemplateColumns: '82px 1fr 78px', alignItems: 'center', gap: 10, fontSize: 12 }}>
              <span style={{ color: theme.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
              <div style={{ height: 8, background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${r.pct}%`, background: r.color || theme.accent, borderRadius: 4, transition: 'width 400ms cubic-bezier(.32,.72,0,1)' }} />
              </div>
              <span style={{ textAlign: 'right', color: theme.text, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{fmtCompact(r.monto)}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
function ChartMensual({ theme, serie, color, mesActual, anio, title }) {
  const maxIdx = (() => { let m = -1; for (let i = 0; i < 12; i++) if (Math.abs(serie[i]) > 0) m = i; return m; })();
  const nMeses = maxIdx + 1;
  if (nMeses <= 0) return null;
  const W = 340, H = 100, PAD_TOP = 4, PAD_BOTTOM = 18;
  const maxV = Math.max(...serie.slice(0, nMeses), 1);
  const slotW = W / Math.max(nMeses, 1);
  const barW = Math.min(20, slotW * 0.7);
  const scale = (v) => ((H - PAD_TOP - PAD_BOTTOM) * Math.abs(v)) / maxV;
  return (
    <>
      <SecH theme={theme} title={title} sub={`${anio} · mensual`} />
      <div style={{ margin: '4px 18px 8px', padding: 14, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16 }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
          {Array.from({ length: nMeses }).map((_, i) => {
            const cx = i * slotW + slotW / 2;
            const h = scale(serie[i] || 0);
            const activo = i + 1 === mesActual;
            return (
              <g key={i}>
                <rect x={cx - barW / 2} y={H - PAD_BOTTOM - h} width={barW} height={h} fill={color} opacity={activo ? 1 : 0.55} rx="2" />
                <text x={cx} y={H - 4} textAnchor="middle" fontSize="9" fill={theme.textMuted} fontFamily={TYPO.fontText}>{MES_CORTO[i]}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </>
  );
}
