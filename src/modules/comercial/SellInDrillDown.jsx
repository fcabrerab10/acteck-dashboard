import React, { useEffect, useMemo, useState, Component } from 'react';
import { supabase } from '../../lib/supabase';
import { formatMXN } from '../../lib/utils';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Star, Percent, AlertTriangle } from 'lucide-react';

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MESES_LARGO = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const ROADMAP_COLOR = {
  RMI:  { bg:'#E1F5EE', text:'#085041' },
  RML:  { bg:'#EEEDFE', text:'#3C3489' },
  2026: { bg:'#FAEEDA', text:'#854F0B' },
  RMS:  { bg:'#FBEAF0', text:'#993556' },
};

const CANAL_STYLE = {
  DISTRIBUIDOR: { bg: '#E5EAF2', color: '#334155', label: 'Distrib' },
  MAYOREO:      { bg: '#EEEDFE', color: '#3730A3', label: 'Mayoreo' },
  'E-COMMERCE': { bg: '#D1FAE5', color: '#065F46', label: 'E-com' },
  DIGITALIFE:   { bg: '#E0F2FE', color: '#075985', label: 'Digitalife' },
  PCEL:         { bg: '#E0F2FE', color: '#075985', label: 'PCEL' },
  DICOTECH:     { bg: '#E0F2FE', color: '#075985', label: 'Dicotech' },
};

const fmtInt = (n) => {
  if (n == null || !isFinite(n)) return '—';
  try { return Math.round(n).toLocaleString('es-MX'); } catch { return String(Math.round(n)); }
};

// Error boundary alrededor del drill-down para que no tumbe la app
export class DrillDownBoundary extends Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { console.error('[DrillDownSKU]', err, info); }
  componentDidUpdate(prev) {
    if (prev.sku !== this.props.sku && this.state.err) this.setState({ err: null });
  }
  render() {
    if (this.state.err) {
      return (
        <div className="p-4 text-xs text-rose-800 bg-rose-50 border-l-4 border-rose-500">
          No se pudo cargar el detalle · {String(this.state.err.message || this.state.err)}
        </div>
      );
    }
    return this.props.children;
  }
}

export default function SellInDrillDown(props) {
  const { theme } = useTheme();
  const { sku, marca, descripcion, categoria, familia, rdmp, anioActual, anioPrev, mesActual } = props;

  // ── 1) State ──
  const [cargando, setCargando] = useState(true);
  const [errFetch, setErrFetch] = useState(null);
  const [fact, setFact] = useState([]);
  const [precios, setPrecios] = useState([]);
  const [inv, setInv] = useState([]);
  const [promos, setPromos] = useState([]);
  const [hoverMes, setHoverMes] = useState(null); // 0-11 or null
  const [mostrarCola, setMostrarCola] = useState(false);

  // ── 2) Fetch on-demand con try/catch ──
  useEffect(() => {
    let cancelled = false;
    setCargando(true);
    setErrFetch(null);
    (async () => {
      try {
        const [fRes, pRes, iRes, prRes] = await Promise.all([
          supabase.from('facturacion_clientes')
            .select('cliente_nombre,cliente_key,canal,anio,mes,piezas,monto')
            .eq('sku', sku).in('anio', [anioPrev, anioActual]),
          // Precios vigentes por lista desde vista canónica (1 fila por sku+lista, precio más reciente).
          supabase.from('v_estrategia_precios_lista')
            .select('lista,precio').eq('sku', sku),
          // Fernando (2026-08-12): usar inventario (físico total) en vez de disponible.
          // Sólo Propuestas usa disponible.
          supabase.from('inventario_acteck')
            .select('no_almacen,inventario').eq('articulo', sku),
          supabase.from('promos_temporada')
            .select('campania,promo_pct').eq('sku', sku).eq('anio', anioActual).eq('mes', mesActual),
        ]);
        if (cancelled) return;
        setFact(Array.isArray(fRes?.data) ? fRes.data : []);
        setPrecios(Array.isArray(pRes?.data) ? pRes.data : []);
        setInv(Array.isArray(iRes?.data) ? iRes.data : []);
        setPromos(Array.isArray(prRes?.data) ? prRes.data : []);
        setCargando(false);
      } catch (e) {
        if (cancelled) return;
        setErrFetch(e?.message || String(e));
        setCargando(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sku, anioActual, anioPrev, mesActual]);

  // ── 3) Todos los useMemo — TODOS antes de cualquier early return ──
  const clientesAgregados = useMemo(() => {
    try {
      const m = new Map();
      for (const r of fact) {
        if (r?.anio !== anioActual) continue;
        const k = r?.cliente_nombre || '(sin nombre)';
        if (!m.has(k)) m.set(k, { nombre: k, canal: r?.canal || 'MAYOREO', clienteKey: r?.cliente_key, piezas: 0, monto: 0, prevMonto: 0, prevPiezas: 0, mensual: Array(12).fill(0) });
        const it = m.get(k);
        it.piezas += Number(r?.piezas) || 0;
        it.monto  += Number(r?.monto)  || 0;
        const mi = Number(r?.mes) - 1;
        if (mi >= 0 && mi < 12) it.mensual[mi] += Number(r?.piezas) || 0;
      }
      for (const r of fact) {
        if (r?.anio !== anioPrev) continue;
        const k = r?.cliente_nombre || '(sin nombre)';
        if (!m.has(k)) continue;
        m.get(k).prevMonto += Number(r?.monto) || 0;
        m.get(k).prevPiezas += Number(r?.piezas) || 0;
      }
      const arr = Array.from(m.values()).sort((a, b) => b.piezas - a.piezas);
      const totPz = arr.reduce((s, x) => s + x.piezas, 0);
      const tot = arr.reduce((s, x) => s + x.monto, 0);
      return arr.map((v) => ({
        ...v,
        pct: tot ? (v.monto / tot * 100) : 0,
        pctPz: totPz ? (v.piezas / totPz * 100) : 0,
        yoy: v.prevMonto > 0 ? ((v.monto - v.prevMonto) / v.prevMonto * 100) : null,
        yoyPz: v.prevPiezas > 0 ? ((v.piezas - v.prevPiezas) / v.prevPiezas * 100) : null,
      }));
    } catch { return []; }
  }, [fact, anioActual, anioPrev]);

  // Pareto: clientes que concentran el 80% (por piezas)
  const paretoData = useMemo(() => {
    const ord = clientesAgregados;
    let acum = 0, corte = 0;
    const withAcum = ord.map((c, i) => {
      acum += (c.pctPz || 0);
      if (acum < 80) corte = i + 1;
      else if (corte === i) corte = i + 1;
      return { ...c, pctAcum: acum };
    });
    // Asegurar que corte llegue al primer índice que cruza 80
    if (corte === 0 && withAcum.length > 0) corte = 1;
    else if (corte < withAcum.length) {
      // avanzar hasta el índice donde se cruza 80
      let a = 0;
      for (let i = 0; i < withAcum.length; i++) {
        a += (withAcum[i].pctPz || 0);
        if (a >= 80) { corte = i + 1; break; }
      }
    }
    return { ord: withAcum, corte };
  }, [clientesAgregados]);

  const totalYTD = useMemo(() => {
    try {
      let piezas = 0, monto = 0;
      for (const r of fact) if (r?.anio === anioActual) { piezas += Number(r?.piezas) || 0; monto += Number(r?.monto) || 0; }
      return { piezas, monto };
    } catch { return { piezas: 0, monto: 0 }; }
  }, [fact, anioActual]);

  const serie = useMemo(() => {
    try {
      const out = [];
      for (const y of [anioPrev, anioActual]) {
        for (let mes = 1; mes <= 12; mes++) {
          let piezas = 0;
          for (const r of fact) if (r?.anio === y && r?.mes === mes) piezas += Number(r?.piezas) || 0;
          out.push({ anio: y, mes, piezas });
        }
      }
      return out;
    } catch { return Array(24).fill(null).map((_, i) => ({ anio: i < 12 ? anioPrev : anioActual, mes: (i % 12) + 1, piezas: 0 })); }
  }, [fact, anioActual, anioPrev]);

  const precioMap = useMemo(() => {
    const m = {};
    try { for (const p of precios) if (p?.lista) m[p.lista] = Number(p.precio) || 0; } catch {}
    return m;
  }, [precios]);

  const promoEfectiva = useMemo(() => {
    try {
      let factor = 1;
      const nombres = [];
      for (const p of promos) {
        const pct = Number(p?.promo_pct);
        if (isFinite(pct)) factor *= (1 - pct);
        if (p?.campania) nombres.push(p.campania);
      }
      return { pct: 1 - factor, campanias: nombres };
    } catch { return { pct: 0, campanias: [] }; }
  }, [promos]);

  // ── 4) Early returns ──
  if (errFetch) {
    return <div className="p-4 text-xs text-rose-700 bg-rose-50 border-l-4 border-rose-500">Error al cargar: {errFetch}</div>;
  }
  if (cargando) {
    return <div className="p-6 text-center text-xs text-gray-500">Cargando datos del SKU…</div>;
  }

  // ── 5) Derivados solo cuando ya hay data ──
  // Solo mostrar clientes con share significativo (≥3%). Si ninguno pasa
  // el umbral, mostrar los 3 primeros para no dejar el panel vacío.
  const UMBRAL_SHARE = 3;
  const clientesRelevantes = clientesAgregados.filter((c) => (c.pct || 0) >= UMBRAL_SHARE);
  const topN = clientesRelevantes.length > 0 ? clientesRelevantes : clientesAgregados.slice(0, 3);
  const clientesOcultos = clientesAgregados.length - topN.length;
  const maxPct = Math.max(1, ...topN.map((c) => c.pct || 0));
  const top3Pct = clientesAgregados.slice(0, 3).reduce((s, c) => s + (c.pct || 0), 0);

  const serieMax = Math.max(1, ...serie.map((x) => x?.piezas || 0));
  const svgY = (v) => 75 - ((v || 0) / serieMax) * 70;
  const serie2025 = serie.slice(0, 12);
  const serie2026 = serie.slice(12, 24);
  const puntos2026Hasta = Math.max(0, Math.min(12, mesActual));
  // Ambas líneas en el mismo eje X (12 meses). Espaciado: 12 pts a lo ancho
  // de ~370px → step ≈ 32.7px, iniciando en x=15.
  const svgX = (i) => 15 + i * 32.7;
  const path2025 = serie2025.map((p, i) => `${i === 0 ? 'M' : 'L'} ${svgX(i).toFixed(1)},${svgY(p.piezas)}`).join(' ');
  const path2026 = serie2026.slice(0, puntos2026Hasta).map((p, i) => `${i === 0 ? 'M' : 'L'} ${svgX(i).toFixed(1)},${svgY(p.piezas)}`).join(' ');

  const closedCount = Math.max(0, mesActual - 1);
  const p6mAct = serie2026.slice(0, closedCount).reduce((s, x) => s + (x?.piezas || 0), 0);
  const p6mPrev = serie2025.slice(0, closedCount).reduce((s, x) => s + (x?.piezas || 0), 0);
  const yoy6m = p6mPrev > 0 ? ((p6mAct - p6mPrev) / p6mPrev * 100) : null;
  const sum3act = serie2026.slice(Math.max(0, closedCount - 3), closedCount).reduce((s, x) => s + (x?.piezas || 0), 0);
  const sum3prev = serie2026.slice(Math.max(0, closedCount - 6), Math.max(0, closedCount - 3)).reduce((s, x) => s + (x?.piezas || 0), 0);
  const trend3m = sum3prev > 0 ? ((sum3act - sum3prev) / sum3prev * 100) : null;

  const precioAAA = precioMap['Mayoreo AAA'];
  const precioAAAneto = precioAAA != null ? precioAAA * (1 - promoEfectiva.pct) : null;
  const precioPromReal = totalYTD.piezas > 0 ? totalYTD.monto / totalYTD.piezas : null;
  const yieldPct = precioAAAneto && precioPromReal ? (precioPromReal / precioAAAneto * 100) : null;

  const stockTotal = inv.reduce((s, r) => s + (Number(r?.inventario) || 0), 0);
  const numAlmacenes = inv.filter((r) => (Number(r?.inventario) || 0) > 0).length;
  const ventaPromMes = closedCount > 0 ? (totalYTD.piezas / closedCount) : 0;
  const cobertura = ventaPromMes > 0 ? (stockTotal / ventaPromMes) : null;

  let covTone = 'neutral';
  let covSub = 'Sin ventas para calcular';
  if (cobertura != null) {
    if (cobertura < 1.5) { covTone = 'bad'; covSub = 'Riesgo de faltante'; }
    else if (cobertura <= 6) { covTone = 'good'; covSub = 'Cobertura sana'; }
    else { covTone = 'warn'; covSub = 'Sobre-stock vs venta actual'; }
  }
  const covLabel = cobertura == null ? '—' : `≈ ${cobertura.toFixed(1)} meses`;

  const rmpColor = ROADMAP_COLOR[rdmp] || { bg: '#F1EFE8', text: '#2C2C2A' };
  const mesActualLabel = MESES_LARGO[Math.max(0, Math.min(11, mesActual - 1))];

  // ── Apple Fitness insights style · Opción 3 ──
  const green = theme.green || '#34C759';
  const red = theme.red || '#FF3B30';
  const orange = theme.orange || '#FF9500';
  const blue = theme.accent || '#007AFF';
  const purple = theme.purple || '#AF52DE';

  // Chart data para recharts
  const serieChart = Array.from({ length: 12 }, (_, i) => ({
    mes: MESES[i],
    [`${anioActual}`]: i < puntos2026Hasta ? (serie2026[i]?.piezas || 0) : null,
    [`${anioPrev}`]: serie2025[i]?.piezas || 0,
  }));

  // Insight helpers
  const topCliente = topN[0] || null;
  const yoyLabel = yoy6m == null ? '—' : `${yoy6m >= 0 ? '+' : ''}${yoy6m.toFixed(1)}%`;
  const trendClass = yoy6m == null ? 'neutral' : yoy6m >= 0 ? 'pos' : 'neg';
  const yieldClass = yieldPct == null ? 'neutral' : yieldPct >= 95 ? 'pos' : yieldPct >= 85 ? 'warn' : 'neg';

  // Insight card helper · más compacto
  const InsightCard = ({ IconComp, tone, chip, kpi, kpiTone, headline }) => {
    const iconBgMap = { blue: `${blue}22`, green: `${green}22`, orange: `${orange}22`, purple: `${purple}22`, red: `${red}22` };
    const iconColMap = { blue, green, orange, purple, red };
    const kpiColMap = { pos: green, neg: red, warn: orange, neutral: theme.text };
    return (
      <div style={{
        background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12,
        padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4, minHeight: 92,
        fontFamily: TYPO.fontText, cursor: 'default',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{
            width: 26, height: 26, borderRadius: 8, background: iconBgMap[tone], color: iconColMap[tone],
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <IconComp style={{ width: 13, height: 13 }} strokeWidth={1.8} />
          </div>
          {chip && (
            <span style={{
              fontSize: 9, padding: '2px 7px', borderRadius: 999,
              background: theme.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
              color: theme.textMuted, fontWeight: 500,
            }}>{chip}</span>
          )}
        </div>
        <div style={{
          fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em',
          color: kpiColMap[kpiTone] || theme.text, fontVariantNumeric: 'tabular-nums', marginTop: 2, lineHeight: 1,
        }}>{kpi}</div>
        <div style={{
          fontSize: 11, fontWeight: 400, color: theme.textMuted,
          lineHeight: 1.3, marginTop: 'auto',
        }}>{headline}</div>
      </div>
    );
  };

  return (
    <div style={{ background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, borderTop: `3px solid ${blue}` }}>
      {/* Header inline compacto sobre bg gris */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: theme.surface, borderBottom: `1px solid ${theme.border}`, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: '-apple-system, "SF Mono", ui-monospace, monospace', fontSize: 11, fontWeight: 600, color: theme.text }}>{sku}</span>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 500, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 200 }}>{descripcion || '—'}</span>
        <span style={{ fontSize: 10, color: theme.textMuted }}>· {marca || '—'}{categoria ? ` · ${categoria}` : ''}{familia ? ` · ${familia}` : ''}</span>
        {rdmp && (
          <span style={{
            fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 999,
            background: `${blue}22`, color: blue, textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>{rdmp}</span>
        )}
      </div>

      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Banda 1 · 4 Insight cards + Precios inline (5 cols) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) minmax(240px, 1.4fr)', gap: 8, alignItems: 'stretch' }}>
          <InsightCard
            IconComp={TrendingUp} tone={yoy6m == null ? 'purple' : yoy6m >= 0 ? 'green' : 'red'}
            chip="Tendencia"
            kpi={yoyLabel}
            kpiTone={trendClass}
            headline={
              yoy6m == null ? <>Sin comparativo YoY disponible.</>
              : <>{yoy6m >= 0 ? 'Crece' : 'Cae'} {Math.abs(yoy6m).toFixed(1)}% YoY en piezas.<br/><span style={{ color: theme.text }}>{fmtInt(p6mAct)} vs {fmtInt(p6mPrev)}</span> acumulado {closedCount}m.</>
            }
          />
          <InsightCard
            IconComp={Star} tone="blue"
            chip="Concentración"
            kpi={`${(topCliente?.pct || 0).toFixed(0)}%`}
            kpiTone="neutral"
            headline={
              topCliente ? <><strong style={{ color: theme.text }}>{topCliente.nombre}</strong> concentra {(topCliente.pct || 0).toFixed(1)}% de las ventas del SKU.</>
              : <>Sin ventas registradas en {anioActual}.</>
            }
          />
          <InsightCard
            IconComp={Percent} tone={yieldClass === 'pos' ? 'green' : yieldClass === 'warn' ? 'orange' : yieldClass === 'neg' ? 'red' : 'purple'}
            chip="Precio"
            kpi={yieldPct != null ? `${yieldPct.toFixed(1)}%` : '—'}
            kpiTone={yieldClass}
            headline={
              yieldPct == null ? <>Sin datos de precio AAA o de venta.</>
              : <>Yield real vs AAA — vende {yieldPct >= 95 ? 'cerca del precio ideal' : yieldPct >= 85 ? 'ligeramente por debajo del ideal' : 'muy por debajo del ideal'}.</>
            }
          />
          <InsightCard
            IconComp={AlertTriangle} tone={covTone === 'bad' ? 'red' : covTone === 'warn' ? 'orange' : covTone === 'good' ? 'green' : 'purple'}
            chip={cobertura == null ? 'Stock' : cobertura < 1.5 ? 'Alerta' : cobertura > 6 ? 'Alerta' : 'Stock'}
            kpi={covLabel}
            kpiTone={covTone === 'bad' ? 'neg' : covTone === 'warn' ? 'warn' : covTone === 'good' ? 'pos' : 'neutral'}
            headline={
              cobertura == null ? <>Sin ventas para calcular cobertura.</>
              : cobertura < 1.5 ? <>Cobertura crítica. Programar reposición.</>
              : cobertura > 6 ? <>Cobertura elevada. Frenar OC o activar promo.</>
              : <>Cobertura sana en almacenes.</>
            }
          />

          {/* Precios inline (5 chips) — misma banda que los KPIs */}
          <div style={{
            background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12,
            padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4, minHeight: 92,
            position: 'relative',
          }}>
            <div style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 2, background: orange, borderRadius: 2 }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 6 }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: theme.textMuted }}>
                Precios · {mesActualLabel}
              </span>
              {yieldPct != null && (
                <span style={{ fontSize: 9, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>Yield {yieldPct.toFixed(1)}%</span>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 3, marginTop: 2, paddingLeft: 6 }}>
              {[
                { k: 'AAA', l: 'Mayoreo AAA', v: precioAAAneto },
                { k: 'DICO', l: 'DICOTECH', v: precioMap['DICOTECH'] },
                { k: 'PCEL', l: 'PCEL PROVISIONAL', v: precioMap['PCEL PROVISIONAL'] },
                { k: 'API', l: 'API PROVISIONAL', v: precioMap['API PROVISIONAL'] },
                { k: 'DECME', l: 'DECME PROVISIONAL', v: precioMap['DECME PROVISIONAL'] },
              ].map((p) => {
                const isAAA = p.k === 'AAA';
                return (
                  <div key={p.k} style={{
                    padding: '3px 5px', borderRadius: 5,
                    background: isAAA ? `${blue}12` : (theme.divider || theme.border),
                    textAlign: 'center',
                  }} title={p.l}>
                    <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: isAAA ? blue : theme.textMuted }}>{p.k}</div>
                    <div style={{
                      fontFamily: 'SF Mono, ui-monospace, monospace', fontSize: 10.5, fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums', marginTop: 1, color: theme.text,
                    }}>{p.v != null ? formatMXN(p.v) : '—'}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 'auto', paddingLeft: 6, paddingTop: 4, borderTop: `1px solid ${theme.divider || theme.border}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: theme.textMuted }}>Prom real</div>
                <div style={{ fontFamily: 'SF Mono, ui-monospace, monospace', fontSize: 11.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: yieldPct == null ? theme.textMuted : yieldPct >= 95 ? green : yieldPct >= 85 ? orange : red, marginTop: 1 }}>
                  {precioPromReal ? formatMXN(precioPromReal) : '—'}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: theme.textMuted }}>Promo</div>
                <div style={{ fontSize: 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: promoEfectiva.pct > 0 ? green : theme.textMuted, marginTop: 1 }}>
                  {promoEfectiva.pct > 0 ? `−${(promoEfectiva.pct * 100).toFixed(1)}%` : 'Sin campaña'}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: theme.textMuted }}>Stock</div>
                <div style={{ fontSize: 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: stockTotal <= 0 ? red : theme.text, marginTop: 1 }}>
                  {fmtInt(stockTotal)} pz · {numAlmacenes} alm
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Banda 2 · Chart + Top clientes (2 cols) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 8 }}>
          {/* Chart 12 meses */}
          <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '8px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
              <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: theme.textMuted, fontWeight: 600, margin: 0 }}>Evolución 12 meses</p>
              <div style={{ display: 'inline-flex', gap: 10, fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 2, borderRadius: 1, background: blue }} />{anioActual}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 2, borderRadius: 1, background: theme.textMuted, opacity: 0.55 }} />{anioPrev}</span>
              </div>
            </div>
            <div style={{ width: '100%', height: 90 }}>
              <ResponsiveContainer>
                <AreaChart data={serieChart} margin={{ top: 6, right: 4, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`fillSku-${String(sku).replace(/\W/g, '').slice(0, 20)}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={blue} stopOpacity={0.20} />
                      <stop offset="100%" stopColor={blue} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={theme.border} vertical={false} strokeOpacity={0.6} />
                  <XAxis dataKey="mes" tick={{ fontSize: 9, fill: theme.textMuted }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis tickFormatter={(v) => v == null ? '' : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} tick={{ fontSize: 9, fill: theme.textMuted }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip
                    formatter={(v, name) => [fmtInt(v) + ' pz', name]}
                    contentStyle={{ fontSize: 12, borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}
                    labelStyle={{ color: theme.textMuted, fontWeight: 500 }}
                  />
                  <Area type="monotone" dataKey={`${anioPrev}`} stroke={theme.textMuted} strokeOpacity={0.55} strokeWidth={1.4} fill="none" dot={false} isAnimationActive={false} />
                  <Area type="monotone" dataKey={`${anioActual}`} stroke={blue} strokeWidth={2.4} fill={`url(#fillSku-${String(sku).replace(/\W/g, '').slice(0, 20)})`} dot={false} activeDot={{ r: 4, fill: theme.surface, stroke: blue, strokeWidth: 2.5 }} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: theme.textMuted, fontWeight: 600, margin: '14px 0 8px' }}>
              Top clientes · {clientesAgregados.length} distintos
            </p>
            {topN.length === 0 ? (
              <p style={{ fontSize: 11, color: theme.textMuted, fontStyle: 'italic' }}>Sin facturación en {anioActual}.</p>
            ) : (
              <div style={{ display: 'grid', gap: 6 }}>
                {topN.map((c) => {
                  const canalKey = String(c.canal || '').toUpperCase();
                  const canalCol = canalKey === 'MAYOREO' ? purple : canalKey === 'DISTRIBUIDOR' ? blue : canalKey === 'E-COMMERCE' ? (theme.teal || '#5AC8FA') : canalKey === 'MOSTRADOR' ? green : theme.textMuted;
                  const barW = Math.max(2, ((c.pct || 0) / maxPct) * 100);
                  return (
                    <div key={c.nombre} style={{ padding: '4px 0', borderBottom: `1px dashed ${theme.border}` }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: `${canalCol}22`, color: canalCol, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {canalKey === 'E-COMMERCE' ? 'E-com' : (canalKey.charAt(0) + canalKey.slice(1).toLowerCase()).slice(0, 8)}
                        </span>
                        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 500, color: theme.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</span>
                        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, color: theme.text, fontVariantNumeric: 'tabular-nums' }}>{(c.pct || 0).toFixed(1)}%</span>
                      </div>
                      <div style={{ height: 3, borderRadius: 999, background: theme.border, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${barW}%`, background: canalCol, borderRadius: 999 }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                        <span>{fmtInt(c.piezas)} pz · {formatMXN(c.monto)}</span>
                        {c.yoy != null ? (
                          <span style={{ color: c.yoy >= 0 ? green : red, fontWeight: 500 }}>{c.yoy >= 0 ? '+' : ''}{c.yoy.toFixed(0)}% YoY</span>
                        ) : c.piezas > 0 ? (
                          <span style={{ color: green, fontWeight: 500 }}>nuevo</span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {topN.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTop: `1px solid ${theme.border}` }}>
                <div>
                  <p style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, color: theme.text, fontVariantNumeric: 'tabular-nums', margin: 0 }}>{top3Pct.toFixed(1)}%</p>
                  <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: theme.textMuted, fontWeight: 600, margin: 0 }}>Top 3 concentran</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, color: theme.text, fontVariantNumeric: 'tabular-nums', margin: 0 }}>{clientesAgregados.length}</p>
                  <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: theme.textMuted, fontWeight: 600, margin: 0 }}>Clientes distintos</p>
                </div>
              </div>
            )}
          </div>

          {/* Top clientes (banda 2 · derecha) */}
          <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '8px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
              <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: theme.textMuted, fontWeight: 600, margin: 0 }}>
                Top clientes
              </p>
              <span style={{ fontSize: 10, color: theme.accent, fontWeight: 600 }}>{clientesAgregados.length} distintos</span>
            </div>
            {topN.length === 0 ? (
              <p style={{ fontSize: 11, color: theme.textMuted, fontStyle: 'italic' }}>Sin facturación en {anioActual}.</p>
            ) : (
              <div style={{ display: 'grid', gap: 4 }}>
                {topN.slice(0, 4).map((c) => {
                  const canalKey = String(c.canal || '').toUpperCase();
                  const canalCol = canalKey === 'MAYOREO' ? purple : canalKey === 'DISTRIBUIDOR' ? blue : canalKey === 'E-COMMERCE' ? (theme.teal || '#5AC8FA') : canalKey === 'MOSTRADOR' ? green : theme.textMuted;
                  const barW = Math.max(2, ((c.pct || 0) / maxPct) * 100);
                  return (
                    <div key={c.nombre} style={{ padding: '3px 0', borderBottom: `1px dashed ${theme.border}` }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 8.5, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: `${canalCol}22`, color: canalCol, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {canalKey === 'E-COMMERCE' ? 'E-com' : (canalKey.charAt(0) + canalKey.slice(1).toLowerCase()).slice(0, 8)}
                        </span>
                        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 500, color: theme.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</span>
                        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, color: theme.text, fontVariantNumeric: 'tabular-nums' }}>{(c.pct || 0).toFixed(1)}%</span>
                        {c.yoy != null && (
                          <span style={{ fontSize: 9, color: c.yoy >= 0 ? green : red, fontWeight: 600, fontVariantNumeric: 'tabular-nums', minWidth: 34, textAlign: 'right' }}>{c.yoy >= 0 ? '+' : ''}{c.yoy.toFixed(0)}%</span>
                        )}
                      </div>
                      <div style={{ height: 2, borderRadius: 999, background: theme.border, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${barW}%`, background: canalCol, borderRadius: 999 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {topN.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTop: `1px solid ${theme.border}`, fontSize: 9.5, color: theme.textMuted }}>
                <span><strong style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{top3Pct.toFixed(1)}%</strong> top 3</span>
                <span>{clientesAgregados.length} clientes total</span>
              </div>
            )}
          </div>
        </div>

        {/* Banda 3 · Heatmap Pareto cliente × mes */}
        {clientesAgregados.length > 0 && (() => {
          const pareto = paretoData.ord.slice(0, paretoData.corte);
          const cola = paretoData.ord.slice(paretoData.corte);
          const colaMensual = Array(12).fill(0).map((_, mi) => cola.reduce((a, c) => a + (c.mensual?.[mi] || 0), 0));
          const colaTotal = cola.reduce((a, c) => a + c.piezas, 0);
          const colaPct = cola.reduce((a, c) => a + (c.pctPz || 0), 0);
          const totalesMes = Array(12).fill(0).map((_, mi) => clientesAgregados.reduce((a, c) => a + (c.mensual?.[mi] || 0), 0));
          const totalMaxMes = Math.max(0, ...totalesMes);
          const grandTotal = totalesMes.reduce((a, b) => a + b, 0);

          const nivel = (v, max) => {
            if (!v || v <= 0 || !max) return 0;
            const r = v / max;
            if (r < 0.15) return 1;
            if (r < 0.35) return 2;
            if (r < 0.60) return 3;
            if (r < 0.85) return 4;
            return 5;
          };
          const heatBg = (lv) => {
            if (lv === 0) return 'transparent';
            const alphas = [0, 0.05, 0.11, 0.20, 0.30, 0.44];
            return theme.mode === 'dark' ? `rgba(10,132,255,${alphas[lv]})` : `rgba(0,122,255,${alphas[lv]})`;
          };
          const heatColor = (lv) => (lv >= 4 ? blue : theme.text);
          const HeatCell = ({ v, max }) => {
            if (!v || v <= 0) return <span style={{ color: theme.textSubtle, fontSize: 11 }}>—</span>;
            const lv = nivel(v, max);
            return (
              <span style={{
                display: 'inline-block', padding: '2px 7px', borderRadius: 999,
                background: heatBg(lv), color: heatColor(lv),
                fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums',
                fontSize: 11, fontWeight: lv >= 4 ? 700 : 500,
                letterSpacing: '-0.01em', minWidth: 32, textAlign: 'center', lineHeight: 1.3,
              }}>{Math.round(v).toLocaleString('es-MX')}</span>
            );
          };
          const NumPillC = ({ value, strong }) => {
            const n = Number(value || 0);
            if (!n) return <span style={{ color: theme.textSubtle, fontSize: 11 }}>—</span>;
            return (
              <span style={{
                display: 'inline-block', padding: '2px 7px', borderRadius: 999,
                background: theme.mode === 'dark' ? `rgba(10,132,255,${strong ? 0.11 : 0.05})` : `rgba(0,122,255,${strong ? 0.11 : 0.05})`,
                color: theme.text,
                fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums',
                fontSize: strong ? 11.5 : 11, fontWeight: strong ? 700 : 500,
                letterSpacing: '-0.01em', minWidth: 32, textAlign: 'center', lineHeight: 1.3,
              }}>{Math.round(n).toLocaleString('es-MX')}</span>
            );
          };
          const PctPill = ({ pct }) => (
            <span style={{
              display: 'inline-block', padding: '1px 6px', borderRadius: 999,
              background: theme.mode === 'dark' ? 'rgba(255,159,10,0.14)' : 'rgba(255,149,0,0.12)',
              color: orange,
              fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums',
              fontSize: 10, fontWeight: 700, letterSpacing: '-0.005em', minWidth: 30, textAlign: 'center',
            }}>{pct >= 1 ? `${Math.round(pct)}%` : pct > 0 ? `${pct.toFixed(1)}%` : '—'}</span>
          );

          const th = { padding: '5px 6px', fontFamily: TYPO.fontDisplay, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textMuted, borderBottom: `1px solid ${theme.divider || theme.border}`, textAlign: 'right' };
          const thL = { ...th, textAlign: 'left' };
          const td = { padding: '4px 6px', textAlign: 'right', verticalAlign: 'middle', borderBottom: `1px solid ${theme.divider || theme.border}` };
          const tdL = { ...td, textAlign: 'left' };

          const renderFila = (p, i, esMenor = false) => {
            const maxCli = Math.max(0, ...(p.mensual || []));
            const canalKey = String(p.canal || '').toUpperCase();
            const canalCol = canalKey === 'MAYOREO' ? purple : canalKey === 'DISTRIBUIDOR' ? blue : canalKey === 'E-COMMERCE' ? (theme.teal || '#5AC8FA') : canalKey === 'MOSTRADOR' ? green : theme.textMuted;
            return (
              <tr key={`c-${i}-${p.nombre}`}>
                <td style={{ ...tdL, padding: '4px 6px 4px 8px', fontFamily: 'SF Mono, ui-monospace, monospace', fontSize: 10, color: theme.textMuted, fontWeight: 600, fontVariantNumeric: 'tabular-nums', width: 22 }}>{i + 1}</td>
                <td style={tdL}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, paddingLeft: esMenor ? 12 : 0 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 50, background: canalCol, flex: '0 0 6px' }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 500, color: theme.text, letterSpacing: '-0.01em', lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}>{p.nombre}</div>
                      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textSubtle, marginTop: 1, lineHeight: 1.1 }}>
                        {canalKey || '—'}{p.yoy != null ? <> · YoY <span style={{ color: p.yoy >= 0 ? green : red, fontWeight: 700 }}>{p.yoy >= 0 ? '+' : ''}{p.yoy.toFixed(0)}%</span></> : ''}
                      </div>
                    </div>
                  </div>
                </td>
                {(p.mensual || []).map((v, mi) => (
                  <td key={mi} style={td}><HeatCell v={v} max={maxCli} /></td>
                ))}
                <td style={td}><NumPillC value={p.piezas / 12} /></td>
                <td style={td}><NumPillC value={p.piezas} strong /></td>
                <td style={td}><PctPill pct={p.pctPz} /></td>
                <td style={{ ...td, fontFamily: 'SF Mono, ui-monospace, monospace', fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                  {(p.pctAcum ?? 0).toFixed(1)}%
                </td>
              </tr>
            );
          };

          return (
            <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '8px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, marginBottom: 2, borderBottom: `1px solid ${theme.divider || theme.border}`, gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
                  <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text }}>Consumo cliente × mes · Pareto 80%</span>
                  <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, color: theme.textMuted, fontWeight: 500 }}>
                    {clientesAgregados.length} clientes · intensidad = mes vs pico del cliente
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textMuted }}>
                  <span>−</span>
                  {[0.05, 0.11, 0.20, 0.30, 0.44].map((a, i) => (
                    <span key={i} style={{ width: 12, height: 8, borderRadius: 2, background: theme.mode === 'dark' ? `rgba(10,132,255,${a})` : `rgba(0,122,255,${a})` }} />
                  ))}
                  <span>+</span>
                  <span style={{ width: 1, height: 10, background: theme.divider || theme.border, margin: '0 3px' }} />
                  <span style={{ padding: '1px 6px', borderRadius: 999, background: theme.mode === 'dark' ? 'rgba(255,159,10,0.14)' : 'rgba(255,149,0,0.12)', color: orange, fontSize: 9, fontWeight: 700 }}>80%</span>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...thL, width: 22 }}>#</th>
                      <th style={thL}>Cliente</th>
                      {MESES.map((m, i) => <th key={i} style={th}>{m}</th>)}
                      <th style={th}>Prom /m</th>
                      <th style={th}>Total</th>
                      <th style={th}>%</th>
                      <th style={th}>Acum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pareto.map((p, i) => renderFila(p, i))}
                    {cola.length > 0 && (
                      <tr>
                        <td colSpan={MESES.length + 6} style={{ padding: 0 }}>
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px',
                            background: theme.mode === 'dark' ? 'rgba(255,159,10,0.05)' : 'rgba(255,149,0,0.04)',
                            borderTop: `1px dashed ${orange}`, borderBottom: `1px dashed ${orange}`,
                          }}>
                            <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: orange }}>Corte Pareto · 80%</span>
                            <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, color: theme.textMuted, fontWeight: 500 }}>
                              {pareto.length} cliente{pareto.length === 1 ? '' : 's'} concentran el {(pareto[pareto.length - 1]?.pctAcum ?? 0).toFixed(1)}% de la venta
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                    {cola.length > 0 && (
                      <tr
                        onClick={() => setMostrarCola((v) => !v)}
                        style={{ cursor: 'pointer', background: theme.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)' }}
                      >
                        <td style={{ ...tdL, padding: '4px 6px 4px 8px', color: blue, fontFamily: 'SF Mono, ui-monospace, monospace', fontSize: 10, fontWeight: 600 }}>
                          {mostrarCola ? '▾' : '▸'}
                        </td>
                        <td style={tdL}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                            <span style={{ width: 6, height: 6, borderRadius: 50, background: theme.textMuted, flex: '0 0 6px' }} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 500, color: blue, letterSpacing: '-0.01em', lineHeight: 1.15 }}>
                                Cola larga · {cola.length} cliente{cola.length === 1 ? '' : 's'} menores
                              </div>
                              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textSubtle, marginTop: 1, lineHeight: 1.1 }}>
                                {colaPct.toFixed(1)}% restante · click para {mostrarCola ? 'colapsar' : 'expandir'}
                              </div>
                            </div>
                          </div>
                        </td>
                        {colaMensual.map((v, mi) => (
                          <td key={mi} style={td}><HeatCell v={v} max={Math.max(0, ...colaMensual)} /></td>
                        ))}
                        <td style={td}><NumPillC value={colaTotal / 12} /></td>
                        <td style={td}><NumPillC value={colaTotal} strong /></td>
                        <td style={td}><PctPill pct={colaPct} /></td>
                        <td style={{ ...td, fontFamily: 'SF Mono, ui-monospace, monospace', fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>100.0%</td>
                      </tr>
                    )}
                    {mostrarCola && cola.map((p, i) => renderFila(p, pareto.length + i, true))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2} style={{ padding: '6px 6px 4px', borderTop: `1px solid ${theme.divider || theme.border}`, textAlign: 'left', fontFamily: TYPO.fontDisplay, fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textMuted, fontWeight: 700 }}>
                        Total {clientesAgregados.length} clientes
                      </td>
                      {totalesMes.map((v, i) => (
                        <td key={i} style={{ padding: '6px 6px 4px', textAlign: 'right', borderTop: `1px solid ${theme.divider || theme.border}` }}><HeatCell v={v} max={totalMaxMes} /></td>
                      ))}
                      <td style={{ padding: '6px 6px 4px', textAlign: 'right', borderTop: `1px solid ${theme.divider || theme.border}` }}><NumPillC value={grandTotal / 12} strong /></td>
                      <td style={{ padding: '6px 6px 4px', textAlign: 'right', borderTop: `1px solid ${theme.divider || theme.border}` }}><NumPillC value={grandTotal} strong /></td>
                      <td style={{ padding: '6px 6px 4px', textAlign: 'right', borderTop: `1px solid ${theme.divider || theme.border}`, fontFamily: TYPO.fontDisplay, fontSize: 10, color: theme.textMuted, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>100%</td>
                      <td style={{ borderTop: `1px solid ${theme.divider || theme.border}` }} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          );
        })()}

        {/* Alert compacta si aplica */}
        {cobertura != null && (cobertura < 1.5 || cobertura > 6) && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12,
            background: cobertura < 1.5 ? `${red}18` : `${orange}18`,
            color: cobertura < 1.5 ? red : orange, fontSize: 12, fontWeight: 500,
          }}>
            <span style={{
              width: 24, height: 24, borderRadius: 8,
              background: cobertura < 1.5 ? `${red}28` : `${orange}28`,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700,
            }}>⚠</span>
            <div>
              <strong>{cobertura < 1.5 ? 'Cobertura crítica' : 'Cobertura elevada'}</strong>
              <span style={{ fontWeight: 400, marginLeft: 4 }}>— {cobertura < 1.5 ? 'programar reposición inmediata' : 'considerar frenar OC o activar promo'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
