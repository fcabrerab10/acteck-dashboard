import React, { useEffect, useMemo, useState, Component } from 'react';
import { supabase } from '../../lib/supabase';
import { formatMXN } from '../../lib/utils';

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
  const { sku, marca, descripcion, categoria, familia, rdmp, anioActual, anioPrev, mesActual } = props;

  // ── 1) State ──
  const [cargando, setCargando] = useState(true);
  const [errFetch, setErrFetch] = useState(null);
  const [fact, setFact] = useState([]);
  const [precios, setPrecios] = useState([]);
  const [inv, setInv] = useState([]);
  const [promos, setPromos] = useState([]);
  const [hoverMes, setHoverMes] = useState(null); // 0-11 or null

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
          supabase.from('precios_sku')
            .select('lista,precio').eq('sku', sku).eq('anio', anioActual).eq('mes', mesActual),
          supabase.from('inventario_acteck')
            .select('no_almacen,disponible').eq('articulo', sku),
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
        if (!m.has(k)) m.set(k, { nombre: k, canal: r?.canal || 'MAYOREO', clienteKey: r?.cliente_key, piezas: 0, monto: 0, prevMonto: 0, prevPiezas: 0 });
        const it = m.get(k);
        it.piezas += Number(r?.piezas) || 0;
        it.monto  += Number(r?.monto)  || 0;
      }
      for (const r of fact) {
        if (r?.anio !== anioPrev) continue;
        const k = r?.cliente_nombre || '(sin nombre)';
        if (!m.has(k)) continue;
        m.get(k).prevMonto += Number(r?.monto) || 0;
        m.get(k).prevPiezas += Number(r?.piezas) || 0;
      }
      const arr = Array.from(m.values()).sort((a, b) => b.monto - a.monto);
      const tot = arr.reduce((s, x) => s + x.monto, 0);
      return arr.map((v) => ({
        ...v,
        pct: tot ? (v.monto / tot * 100) : 0,
        yoy: v.prevMonto > 0 ? ((v.monto - v.prevMonto) / v.prevMonto * 100) : null,
      }));
    } catch { return []; }
  }, [fact, anioActual, anioPrev]);

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

  const stockTotal = inv.reduce((s, r) => s + (Number(r?.disponible) || 0), 0);
  const numAlmacenes = inv.filter((r) => (Number(r?.disponible) || 0) > 0).length;
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

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 px-5 pt-3.5 pb-1 text-[11px] text-gray-500 flex-wrap">
        <span className="font-semibold text-gray-800">{sku} · {descripcion || '—'}</span>
        <span className="text-gray-300">·</span>
        <span>{marca || '—'}</span>
        {categoria && <><span className="text-gray-300">·</span><span>{categoria}</span></>}
        {familia && <><span className="text-gray-300">·</span><span>{familia}</span></>}
        {rdmp && (
          <>
            <span className="text-gray-300">·</span>
            <span className="text-[9px] font-medium px-1 py-0.5 rounded"
              style={{ background: rmpColor.bg, color: rmpColor.text }}>{rdmp}</span>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 p-5 pt-2">

        {/* COL 1 — Quién compra */}
        <div className="lg:pr-5 lg:border-r border-gray-200">
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-[9.5px] uppercase tracking-widest font-semibold text-gray-500">Quién compra · YTD {anioActual}</span>
            <span className="text-[10.5px] text-gray-400">
              {clientesOcultos > 0 ? `${topN.length} de ${clientesAgregados.length} · share ≥ ${UMBRAL_SHARE}%` : `${clientesAgregados.length} clientes distintos`}
            </span>
          </div>
          {topN.length === 0 ? (
            <div className="text-xs text-gray-400 italic">Sin facturación en {anioActual}.</div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                {topN.map((c) => {
                  const canalKey = String(c.canal || '').toUpperCase();
                  const style = CANAL_STYLE[canalKey] || CANAL_STYLE.MAYOREO;
                  return (
                    <div key={c.nombre} className="pb-1.5 border-b border-dashed border-[#E5EAF0] last:border-b-0 last:pb-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider"
                          style={{ background: style.bg, color: style.color }}>{style.label}</span>
                        <span className="text-[11.5px] font-medium text-gray-800 truncate flex-1">{c.nombre}</span>
                        <span className="text-[11px] text-gray-500 font-medium tabular-nums">{(c.pct || 0).toFixed(1)}%</span>
                      </div>
                      <div className="h-[3px] bg-[#E4EAF2] rounded-full overflow-hidden mt-1">
                        <span className="block h-full rounded-full"
                          style={{ width: `${((c.pct || 0) / maxPct * 100).toFixed(1)}%`, background: (c.pct || 0) >= 10 ? '#0EA5E9' : '#94A3B8' }} />
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-500 mt-1 tabular-nums">
                        <span>{fmtInt(c.piezas)} pz · {formatMXN(c.monto)}</span>
                        {c.yoy != null ? (
                          <span className={c.yoy >= 0 ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>
                            {c.yoy >= 0 ? '+' : ''}{c.yoy.toFixed(0)}% YoY
                          </span>
                        ) : c.piezas > 0 ? (
                          <span className="text-emerald-700 font-semibold">nuevo</span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between items-end mt-3 pt-2.5 border-t border-gray-200">
                <div>
                  <div className="text-[15px] font-semibold tabular-nums">{top3Pct.toFixed(1)}%</div>
                  <div className="text-[9.5px] uppercase tracking-widest text-gray-500">Top 3 concentran</div>
                </div>
                <div className="text-right">
                  <div className="text-[15px] font-semibold tabular-nums">{clientesAgregados.length}</div>
                  <div className="text-[9.5px] uppercase tracking-widest text-gray-500">Clientes distintos YTD</div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* COL 2 — Cuándo */}
        <div className="lg:px-5 lg:border-r border-gray-200">
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-[9.5px] uppercase tracking-widest font-semibold text-gray-500">Cuándo lo compran · 12 meses</span>
            <span className="text-[10.5px] text-gray-400">Piezas / mes</span>
          </div>
          <div className="relative">
            <svg viewBox="0 0 400 88" preserveAspectRatio="none"
              onMouseLeave={() => setHoverMes(null)}
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                const xVb = ((e.clientX - r.left) / r.width) * 400;
                const i = Math.round((xVb - 15) / 32.7);
                if (i >= 0 && i < 12) setHoverMes(i); else setHoverMes(null);
              }}
              style={{ width: '100%', height: 88, display: 'block', cursor: 'crosshair' }}>
              <line x1="0" y1="65" x2="400" y2="65" stroke="#E5EAF2" strokeWidth="1" />
              {hoverMes != null && (
                <line x1={svgX(hoverMes).toFixed(1)} y1="4" x2={svgX(hoverMes).toFixed(1)} y2="75"
                  stroke="#94A3B8" strokeWidth="1" strokeDasharray="2 2" />
              )}
              {path2025 && <path d={path2025} stroke="#F59E0B" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
              {serie2025.map((p, i) => (
                <circle key={`a${i}`} cx={svgX(i).toFixed(1)} cy={svgY(p.piezas)}
                  r={hoverMes === i ? 3.5 : 2} fill="#F59E0B" />
              ))}
              {path2026 && <path d={path2026} stroke="#0EA5E9" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
              {serie2026.slice(0, Math.max(0, puntos2026Hasta - 1)).map((p, i) => (
                <circle key={`b${i}`} cx={svgX(i).toFixed(1)} cy={svgY(p.piezas)}
                  r={hoverMes === i ? 4 : 2.6} fill="#0EA5E9" />
              ))}
              {puntos2026Hasta > 0 && serie2026[puntos2026Hasta - 1] && (
                <circle cx={svgX(puntos2026Hasta - 1).toFixed(1)} cy={svgY(serie2026[puntos2026Hasta - 1].piezas)}
                  r={hoverMes === puntos2026Hasta - 1 ? 4.5 : 3}
                  fill="white" stroke="#0EA5E9" strokeWidth="2" />
              )}
            </svg>
            {hoverMes != null && (() => {
              const v25 = serie2025[hoverMes]?.piezas || 0;
              const hasV26 = hoverMes < puntos2026Hasta;
              const v26 = hasV26 ? (serie2026[hoverMes]?.piezas || 0) : null;
              const delta = hasV26 && v25 > 0 ? ((v26 - v25) / v25 * 100) : null;
              const leftPct = ((svgX(hoverMes) / 400) * 100).toFixed(1);
              const alignRight = hoverMes >= 8;
              return (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: `${leftPct}%`,
                  transform: alignRight ? 'translateX(calc(-100% - 8px))' : 'translateX(8px)',
                  pointerEvents: 'none',
                }}>
                  <div className="bg-white border border-gray-200 rounded-md shadow-md px-2.5 py-1.5 text-[10.5px] whitespace-nowrap">
                    <div className="font-semibold text-gray-800 mb-1">{MESES[hoverMes]}</div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded-sm" style={{ background: '#F59E0B' }} />
                      <span className="text-gray-600">{anioPrev}</span>
                      <span className="tabular-nums font-semibold text-gray-800 ml-auto">{fmtInt(v25)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="inline-block w-2 h-2 rounded-sm" style={{ background: '#0EA5E9' }} />
                      <span className="text-gray-600">{anioActual}</span>
                      <span className="tabular-nums font-semibold text-gray-800 ml-auto">
                        {hasV26 ? fmtInt(v26) : '—'}
                      </span>
                    </div>
                    {delta != null && (
                      <div className={`mt-1 pt-1 border-t border-gray-100 text-[10px] tabular-nums font-semibold ${delta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {delta >= 0 ? '+' : ''}{delta.toFixed(1)}% YoY
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="grid mt-1 text-[9px] text-gray-400 tabular-nums" style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}>
            {MESES.map((m) => <span key={m} className="text-center">{m}</span>)}
          </div>
          <div className="flex gap-3 text-[10.5px] text-gray-500 mt-2">
            <span><span className="inline-block w-2 h-0.5 mr-1 align-middle rounded-sm" style={{ background: '#F59E0B' }} />{anioPrev}</span>
            <span><span className="inline-block w-2 h-0.5 mr-1 align-middle rounded-sm" style={{ background: '#0EA5E9' }} />{anioActual}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div>
              <div className="text-[9.5px] uppercase tracking-widest text-gray-500">YoY {closedCount}m</div>
              <div className={`text-[17px] font-semibold tabular-nums ${yoy6m == null ? 'text-gray-400' : yoy6m >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {yoy6m == null ? '—' : `${yoy6m >= 0 ? '+' : ''}${yoy6m.toFixed(1)}%`}
              </div>
              <div className="text-[10px] text-gray-400 tabular-nums">{fmtInt(p6mAct)} vs {fmtInt(p6mPrev)} pz</div>
            </div>
            <div>
              <div className="text-[9.5px] uppercase tracking-widest text-gray-500">Últ. 3m vs prev</div>
              <div className={`text-[17px] font-semibold tabular-nums ${trend3m == null ? 'text-gray-400' : trend3m >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {trend3m == null ? '—' : `${trend3m >= 0 ? '+' : ''}${trend3m.toFixed(1)}%`}
              </div>
              <div className="text-[10px] text-gray-400 tabular-nums">{fmtInt(sum3act)} vs {fmtInt(sum3prev)} pz</div>
            </div>
          </div>
        </div>

        {/* COL 3 — Precio + Stock */}
        <div className="lg:pl-5">
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-[9.5px] uppercase tracking-widest font-semibold text-gray-500">A qué precio · {mesActualLabel} {anioActual}</span>
            {yieldPct != null && <span className="text-[10.5px] text-gray-400">Yield {yieldPct.toFixed(1)}%</span>}
          </div>
          <div className="flex flex-col gap-0.5 text-[11.5px]">
            {precioAAA != null && (
              <div className="flex justify-between items-baseline py-1 px-2 rounded" style={{ background: '#FEF9C3' }}>
                <span className="text-gray-700 font-medium">Mayoreo AAA <span className="text-[10px] text-gray-500 font-normal">
                  {promoEfectiva.pct > 0 ? 'neto' : 'lista'}
                </span></span>
                <span className="tabular-nums font-semibold">{formatMXN(precioAAAneto)}</span>
              </div>
            )}
            {['DICOTECH', 'PCEL PROVISIONAL', 'API PROVISIONAL', 'DECME PROVISIONAL'].map((l) => (
              precioMap[l] != null && (
                <div key={l} className="flex justify-between py-1 text-gray-700">
                  <span className="font-medium">{l.replace(' PROVISIONAL', '')}</span>
                  <span className="tabular-nums">{formatMXN(precioMap[l])}</span>
                </div>
              )
            ))}
            {Object.keys(precioMap).length === 0 && (
              <span className="text-gray-400 italic text-[11px]">Sin precios cargados para este mes</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2.5 mt-2.5 border-t border-gray-200">
            <div>
              <div className="text-[9.5px] uppercase tracking-widest text-gray-500">Precio prom. real {anioActual}</div>
              <div className={`text-[16px] font-semibold tabular-nums ${yieldPct == null ? 'text-gray-400' : yieldPct >= 95 ? 'text-emerald-700' : yieldPct >= 85 ? 'text-amber-700' : 'text-rose-700'}`}>
                {precioPromReal ? formatMXN(precioPromReal) : '—'}
              </div>
              <div className="text-[10px] text-gray-400">{yieldPct ? `${yieldPct.toFixed(1)}% del AAA neto` : 'Sin venta YTD'}</div>
            </div>
            <div>
              <div className="text-[9.5px] uppercase tracking-widest text-gray-500">Promo activa</div>
              <div className={`text-[16px] font-semibold tabular-nums ${promoEfectiva.pct > 0 ? 'text-emerald-700' : 'text-gray-400'}`}>
                {promoEfectiva.pct > 0 ? `−${(promoEfectiva.pct * 100).toFixed(1)}%` : '—'}
              </div>
              <div className="text-[10px] text-gray-400 truncate" title={promoEfectiva.campanias.join(' · ')}>
                {promoEfectiva.campanias.length ? promoEfectiva.campanias.join(' · ') : 'Sin campaña este mes'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2.5 mt-2.5 border-t border-gray-200">
            <div>
              <div className="text-[9.5px] uppercase tracking-widest text-gray-500">Inventario Acteck</div>
              <div className={`text-[16px] font-semibold tabular-nums ${stockTotal <= 0 ? 'text-rose-700' : 'text-gray-800'}`}>
                {fmtInt(stockTotal)} pz
              </div>
              <div className="text-[10px] text-gray-400">{numAlmacenes} almacenes</div>
            </div>
            <div>
              <div className="text-[9.5px] uppercase tracking-widest text-gray-500">Días de cobertura</div>
              <div className={`text-[16px] font-semibold tabular-nums ${covTone === 'bad' ? 'text-rose-700' : covTone === 'warn' ? 'text-amber-700' : covTone === 'good' ? 'text-emerald-700' : 'text-gray-400'}`}>
                {covLabel}
              </div>
              <div className="text-[10px] text-gray-400">{covSub}</div>
            </div>
          </div>

          {cobertura != null && (cobertura < 1.5 || cobertura > 6) && (
            <div className="mt-3 px-2.5 py-2 rounded text-[11px] font-medium border-l-4"
              style={cobertura < 1.5
                ? { background: '#FEE2E2', color: '#991B1B', borderColor: '#EF4444' }
                : { background: '#FEF3C7', color: '#92400E', borderColor: '#F59E0B' }}>
              {cobertura < 1.5
                ? 'Cobertura crítica · programar reposición'
                : 'Cobertura elevada · considerar frenar OC / activar promo'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
