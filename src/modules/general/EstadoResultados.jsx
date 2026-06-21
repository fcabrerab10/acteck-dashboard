import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Calculator, TrendingUp, TrendingDown, ChevronRight, ChevronDown,
} from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, LineChart, Legend,
} from 'recharts';

// ────────── Constantes ──────────
const MESES_LBL  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MESES_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Grupos colapsables de la tabla. Cada grupo lista las cuentas (cuenta_norm)
// que pertenecen y la fila subtotal (si aplica). El orden refleja la
// estructura del Excel.
const GRUPOS_TABLA = [
  {
    id: 'ingresos', label: 'Ingresos', color: '#3B82F6', defaultOpen: true,
    cuentas: ['ventas_y_servicios_a_tasa_general','ventas_y_servicios_a_tasa_0','devol_desctos_o_bonif_sobre_ingresos'],
    subtotal: 'venta_neta',
  },
  {
    id: 'costos', label: 'Costos', color: '#F97316', defaultOpen: true,
    cuentas: ['costo_de_ventas','costo_de_venta_empaque','costo_ecommerce','dev_desc_o_bonificacion_s_compra','destruccion_fiscal_2025','total_costo_de_venta'],
    subtotal: 'utilidad_bruta',
  },
  {
    id: 'gastos', label: 'Gastos Operativos', color: '#EF4444', defaultOpen: true,
    cuentas: ['gastos_generales','nomina','distribucion','arrendamiento','arrendamiento_estrategia','viaticos_com','otros_gastos','proyectos','total_gastos_proyectos','total_gastos'],
    subtotal: 'uafir_sin_proyectos',
    extra:    'uafir_con_proyectos',  // mostrar también UAFIR con proyectos
  },
  {
    id: 'indicadores_gasto', label: 'Indicadores de Gasto', color: '#8B5CF6', defaultOpen: false,
    cuentas: ['alcance_gasto_vs_venta_n','alcance_gasto_vs_venta_n_presupuesto'],
    formato: 'pct',  // estas líneas son %
  },
  {
    id: 'otros', label: 'Otros Ingresos', color: '#0EA5E9', defaultOpen: false,
    cuentas: ['otros_ingresos','comision_proyectos'],
  },
  {
    id: 'financieros', label: 'Gastos y Productos Financieros', color: '#7C3AED', defaultOpen: false,
    cuentas: [
      'gastos_financieros','comisiones_cartas_de_credito','comisiones_y_sit_bancarias',
      'intereses_a_cargo_nacional','intereses_cartas_de_credito','intereses_prestamo_ing_jcr',
      'perdida_cambiaria','perdida_revaluaciones','objetivo_anual_2',
      'productos_financieros','intereses_a_favor_bancarios_nacional','utilidad_cambiaria','utilidad_revaluaciones',
      'total_productos_financieros',
    ],
  },
  {
    id: 'utilidad', label: 'Utilidad Final', color: '#10B981', defaultOpen: true,
    cuentas: ['uaii_contable_con_proyecctos','uaii_contable_sin_proyectos'],
  },
  {
    id: 'info', label: 'Información General', color: '#94A3B8', defaultOpen: false,
    cuentas: ['t_c_dof','colaboradores','vta_colaborador','uti_colaborador','interes_ing_jcr_mxn'],
    formato: 'mixto',
  },
];

// ────────── Formateadores ──────────
const fmtCompact = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1e6) return sign + '$' + (a / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return sign + '$' + (a / 1e3).toFixed(0) + 'K';
  return sign + '$' + Math.round(a);
};
const fmtMoney = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(n);
  return (n < 0 ? '-' : '') + '$' + a.toLocaleString('es-MX', { maximumFractionDigits: 0 });
};
const fmtPct = (n) => n == null || isNaN(n) ? '—' : n.toFixed(1) + '%';
const fmtPctDelta = (n) => n == null || isNaN(n) ? '—' : (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
const fmtNumber = (n) => n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('es-MX');
const esSubcuenta = (cuenta) => /^\s*\*/.test(cuenta || '');

// ────────── Componente principal ──────────
export default function EstadoResultados() {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [aniosDisponibles, setAniosDisponibles] = useState([]);
  const [rows, setRows] = useState([]);
  const [rowsPrev, setRowsPrev] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mesEnfoque, setMesEnfoque] = useState(0); // 0 = YTD acumulado
  const [showVsPpto, setShowVsPpto] = useState(false);
  const [showVsAnioPrev, setShowVsAnioPrev] = useState(true);

  // ── Año disponibles
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('estados_resultados').select('anio').order('anio', { ascending: false });
      const unique = Array.from(new Set((data || []).map((r) => r.anio))).sort((a, b) => b - a);
      setAniosDisponibles(unique);
      if (unique.length > 0 && !unique.includes(anio)) setAnio(unique[0]);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Carga año actual + año anterior
  useEffect(() => {
    setLoading(true);
    (async () => {
      const [a, p] = await Promise.all([
        supabase.from('estados_resultados').select('*').eq('anio', anio).order('orden'),
        supabase.from('estados_resultados').select('cuenta_norm,mes,valor').eq('anio', anio - 1),
      ]);
      setRows(a.data || []);
      setRowsPrev(p.data || []);
      setLoading(false);
    })();
  }, [anio]);

  // ── Pivote: cuenta_norm → { cuenta, orden, es_subtotal, valores: {1..12} }
  const byCuenta = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => {
      const k = r.cuenta_norm;
      if (!m.has(k)) m.set(k, { cuenta_norm: k, cuenta: r.cuenta, orden: r.orden ?? 999, es_subtotal: !!r.es_subtotal, valores: {} });
      m.get(k).valores[Number(r.mes)] = Number(r.valor);
    });
    return m;
  }, [rows]);

  const byCuentaPrev = useMemo(() => {
    const m = new Map();
    rowsPrev.forEach((r) => {
      const k = r.cuenta_norm;
      if (!m.has(k)) m.set(k, { valores: {} });
      m.get(k).valores[Number(r.mes)] = Number(r.valor);
    });
    return m;
  }, [rowsPrev]);

  // ── Mes máximo con datos
  const mesMax = useMemo(() => {
    let m = 0;
    rows.forEach((r) => { if (Number(r.mes) > m) m = Number(r.mes); });
    return m || 12;
  }, [rows]);

  // ── Helper: total de una cuenta en (mesEnfoque o YTD)
  const totalCuenta = (m, slug, fromPrev = false) => {
    const src = fromPrev ? byCuentaPrev : byCuenta;
    const c = src.get(slug);
    if (!c) return 0;
    if (m === 0) {
      // YTD: sumar 1..mesMax
      let s = 0;
      for (let i = 1; i <= mesMax; i++) s += Number(c.valores[i]) || 0;
      return s;
    }
    return Number(c.valores[m]) || 0;
  };

  // ── KPIs (siempre YTD para tarjetas grandes; cascada usa mesEnfoque)
  const kpis = useMemo(() => {
    const get = (slug, prev = false) => totalCuenta(0, slug, prev);
    const ventaNeta = get('venta_neta');
    const utilBruta = get('utilidad_bruta');
    const uafir     = get('uafir_sin_proyectos');
    const uaii      = get('uaii_contable_sin_proyectos');
    const ventaPrev = get('venta_neta', true);
    const utilPrev  = get('utilidad_bruta', true);
    const uafirPrev = get('uafir_sin_proyectos', true);
    const uaiiPrev  = get('uaii_contable_sin_proyectos', true);
    return {
      ventaNeta, utilBruta, uafir, uaii,
      pctBruta: ventaNeta > 0 ? (utilBruta / ventaNeta) * 100 : null,
      pctUafir: ventaNeta > 0 ? (uafir / ventaNeta) * 100 : null,
      pctUaii:  ventaNeta > 0 ? (uaii / ventaNeta) * 100 : null,
      deltaVenta: ventaPrev > 0 ? ((ventaNeta - ventaPrev) / ventaPrev) * 100 : null,
      deltaUtil:  utilPrev  > 0 ? ((utilBruta - utilPrev) / utilPrev) * 100 : null,
      deltaUafir: uafirPrev > 0 ? ((uafir - uafirPrev) / uafirPrev) * 100 : null,
      deltaUaii:  uaiiPrev  > 0 ? ((uaii - uaiiPrev) / uaiiPrev) * 100 : null,
      ventaPrev, utilPrev, uafirPrev, uaiiPrev,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byCuenta, byCuentaPrev, mesMax]);

  // ── Cascada (waterfall): pasos del P&L con valores y % vs Venta Neta
  const cascada = useMemo(() => {
    const m = mesEnfoque;
    const get = (slug) => totalCuenta(m, slug);
    const ventaTG  = get('ventas_y_servicios_a_tasa_general');
    const venta0   = get('ventas_y_servicios_a_tasa_0');
    const devs     = get('devol_desctos_o_bonif_sobre_ingresos'); // viene negativo
    const ventaBruta = ventaTG + venta0;
    const ventaNeta  = get('venta_neta');
    const costoTotal = get('total_costo_de_venta');
    const utilBruta  = get('utilidad_bruta');
    const totalGastosOp = get('total_gastos');     // sin proyectos
    const proyectos     = get('proyectos');
    const uafirSP    = get('uafir_sin_proyectos');
    const uafirCP    = get('uafir_con_proyectos');
    const otrosIng   = get('otros_ingresos') + get('comision_proyectos');
    const totalFin   = get('total_productos_financieros');
    const uaii       = get('uaii_contable_sin_proyectos');

    // % vs Venta Neta para anotaciones
    const pct = (v) => ventaNeta !== 0 ? (v / ventaNeta) * 100 : null;

    return [
      { kind: 'start', label: 'Venta Bruta', valor: ventaBruta, pct: pct(ventaBruta), color: '#2563EB' },
      { kind: 'down',  label: 'Devoluciones', valor: devs, pct: pct(devs), color: '#EF4444' },
      { kind: 'sub',   label: 'Venta Neta', valor: ventaNeta, pct: 100, color: '#1D4ED8' },
      { kind: 'down',  label: 'Costo Total', valor: -costoTotal, pct: pct(-costoTotal), color: '#F97316' },
      { kind: 'sub',   label: 'Utilidad Bruta', valor: utilBruta, pct: pct(utilBruta), color: '#0EA5E9' },
      { kind: 'down',  label: 'Gastos Operativos', valor: -totalGastosOp, pct: pct(-totalGastosOp), color: '#EF4444' },
      { kind: 'sub',   label: 'UAFIR sin Proy.', valor: uafirSP, pct: pct(uafirSP), color: '#10B981' },
      { kind: 'down',  label: 'Proyectos', valor: -proyectos, pct: pct(-proyectos), color: '#A855F7' },
      { kind: 'sub',   label: 'UAFIR con Proy.', valor: uafirCP, pct: pct(uafirCP), color: '#059669' },
      { kind: 'down',  label: 'Financieros Netos', valor: -totalFin, pct: pct(-totalFin), color: '#F59E0B' },
      { kind: 'down',  label: 'Otros Ingresos', valor: -otrosIng, pct: pct(-otrosIng), color: '#06B6D4' },
      { kind: 'end',   label: 'UAII', valor: uaii, pct: pct(uaii), color: '#065F46' },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byCuenta, mesEnfoque, mesMax]);

  // ── Datos para la tira de sparklines: 12 meses por cuenta clave
  const sparkData = useMemo(() => {
    const series = (slug, prev = false) => {
      const arr = [];
      const src = prev ? byCuentaPrev : byCuenta;
      const c = src.get(slug);
      for (let i = 1; i <= 12; i++) {
        arr.push(Number(c?.valores[i]) || 0);
      }
      return arr;
    };
    return {
      ventaNeta:        series('venta_neta'),
      ventaNetaPrev:    series('venta_neta', true),
      utilBruta:        series('utilidad_bruta'),
      utilBrutaPrev:    series('utilidad_bruta', true),
      uafir:            series('uafir_sin_proyectos'),
      uafirPrev:        series('uafir_sin_proyectos', true),
      uaii:             series('uaii_contable_sin_proyectos'),
      uaiiPrev:         series('uaii_contable_sin_proyectos', true),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byCuenta, byCuentaPrev]);

  // ── Datos para gráfica de tendencia grande
  const trendData = useMemo(() => {
    const data = [];
    for (let i = 1; i <= 12; i++) {
      const vn   = totalCuenta(i, 'venta_neta');
      const ub   = totalCuenta(i, 'utilidad_bruta');
      const uf   = totalCuenta(i, 'uafir_sin_proyectos');
      const vnP  = totalCuenta(i, 'venta_neta', true);
      const ufP  = totalCuenta(i, 'uafir_sin_proyectos', true);
      data.push({
        mes: MESES_LBL[i - 1],
        ventaNeta: vn || null,
        utilBruta: ub || null,
        uafir: uf || null,
        ventaNetaPrev: vnP || null,
        uafirPrev: ufP || null,
        margenBrutoPct: vn > 0 ? (ub / vn) * 100 : null,
        uafirPct:       vn > 0 ? (uf / vn) * 100 : null,
      });
    }
    return data;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byCuenta, byCuentaPrev]);

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-400">
        <Calculator className="w-10 h-10 mx-auto mb-3" />
        Cargando estado de resultados…
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="p-12 text-center text-gray-500">
        <Calculator className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Estado de Resultados</h2>
        <p>No hay datos para {anio}. Sube los cierres en /uploads.html.</p>
      </div>
    );
  }

  return (
    <div className="max-w-none mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Estado de Resultados</h2>
          <p className="text-xs text-gray-500 mt-1">
            REVKO TECHNOLOGY SA DE CV · YTD ene–{MESES_LBL[mesMax - 1]} {anio}
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="flex flex-col text-xs text-gray-500">
            Año
            <select value={anio} onChange={(e) => setAnio(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white">
              {aniosDisponibles.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label className="flex flex-col text-xs text-gray-500">
            Foco
            <select value={mesEnfoque} onChange={(e) => setMesEnfoque(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white">
              <option value={0}>YTD acumulado</option>
              {Array.from({ length: mesMax }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{MESES_FULL[m - 1]} {anio}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* KPIs YTD */}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard icon="💰" titulo="Venta Neta YTD" color="#3B82F6"
          valor={fmtCompact(kpis.ventaNeta)} delta={kpis.deltaVenta}
          sparkActual={sparkData.ventaNeta} sparkPrev={sparkData.ventaNetaPrev}
          prevLabel={`${anio - 1}: ${fmtCompact(kpis.ventaPrev)}`} />
        <KpiCard icon="📊" titulo="Utilidad Bruta YTD" color="#10B981"
          valor={fmtCompact(kpis.utilBruta)} delta={kpis.deltaUtil}
          sparkActual={sparkData.utilBruta} sparkPrev={sparkData.utilBrutaPrev}
          prevLabel={kpis.pctBruta != null ? `Margen ${kpis.pctBruta.toFixed(1)}%` : ''} />
        <KpiCard icon="🏁" titulo="UAFIR sin Proyectos" color="#8B5CF6"
          valor={fmtCompact(kpis.uafir)} delta={kpis.deltaUafir}
          sparkActual={sparkData.uafir} sparkPrev={sparkData.uafirPrev}
          prevLabel={kpis.pctUafir != null ? `% Venta ${kpis.pctUafir.toFixed(1)}%` : ''} />
        <KpiCard icon="🎯" titulo="UAII Final" color="#065F46"
          valor={fmtCompact(kpis.uaii)} delta={kpis.deltaUaii}
          sparkActual={sparkData.uaii} sparkPrev={sparkData.uaiiPrev}
          prevLabel={kpis.pctUaii != null ? `% Venta ${kpis.pctUaii.toFixed(1)}%` : ''} />
      </div>

      {/* Cascada */}
      <Cascada steps={cascada} mesLabel={mesEnfoque === 0 ? 'YTD' : MESES_FULL[mesEnfoque - 1]} />

      {/* Gráfica de tendencia */}
      <TrendChart data={trendData} anio={anio} anioPrev={anio - 1} mesMax={mesMax} />

      {/* Tabla detallada por grupos */}
      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-lg font-bold text-gray-800">Detalle por cuenta</h3>
          <div className="flex items-center gap-3 text-xs text-gray-600">
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={showVsAnioPrev}
                onChange={(e) => setShowVsAnioPrev(e.target.checked)} className="rounded border-gray-300" />
              Comparativo {anio - 1}
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={showVsPpto}
                onChange={(e) => setShowVsPpto(e.target.checked)} className="rounded border-gray-300" />
              Mostrar % vs presupuesto
            </label>
          </div>
        </div>
        {GRUPOS_TABLA.map((g) => (
          <GrupoTabla key={g.id} grupo={g} byCuenta={byCuenta} byCuentaPrev={byCuentaPrev}
            mesMax={mesMax} anio={anio} showVsAnioPrev={showVsAnioPrev} />
        ))}
      </div>

      <p className="text-xs text-gray-400 px-2">
        Fuente: tabla <code>estados_resultados</code> · alimentada desde /uploads.html
      </p>
    </div>
  );
}

// ────────── Tarjeta KPI con mini sparkline ──────────
function KpiCard({ icon, titulo, color, valor, delta, prevLabel, sparkActual, sparkPrev }) {
  const sparkVals = (sparkActual || []).filter((v) => v != null);
  const max = Math.max(...sparkVals, 0) || 1;
  const min = Math.min(...sparkVals, 0);
  const range = max - min || 1;
  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0',
      borderLeft: '4px solid ' + color, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <p style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, margin: 0 }}>
        {icon} {titulo}
      </p>
      <p style={{ fontSize: 24, fontWeight: 800, color: '#1E293B', lineHeight: 1.1, margin: '6px 0 0 0' }}>{valor}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        {delta != null && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 600,
            color: delta >= 0 ? '#10B981' : '#EF4444' }}>
            {delta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {fmtPctDelta(delta)}
          </span>
        )}
        {prevLabel && <span style={{ fontSize: 11, color: '#94A3B8' }}>{prevLabel}</span>}
      </div>
      {/* Sparkline 12 meses */}
      {sparkVals.length > 0 && (
        <svg viewBox="0 0 120 28" style={{ width: '100%', height: 28, marginTop: 8 }} preserveAspectRatio="none">
          {sparkPrev && sparkPrev.some(v => v) && (
            <polyline fill="none" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="2,2"
              points={sparkPrev.map((v, i) => {
                const x = (i / 11) * 120;
                const y = 28 - ((Number(v) || 0 - min) / range) * 26;
                return `${x},${y}`;
              }).join(' ')} />
          )}
          <polyline fill="none" stroke={color} strokeWidth="1.5"
            points={sparkActual.map((v, i) => {
              if (v == null) return null;
              const x = (i / 11) * 120;
              const y = 28 - (((v - min) / range) * 26);
              return `${x},${y}`;
            }).filter(Boolean).join(' ')} />
        </svg>
      )}
    </div>
  );
}

// ────────── Cascada visual ──────────
function Cascada({ steps, mesLabel }) {
  // El máximo absoluto (positivo) marca la escala. Para subtotales escalonados
  // usamos el monto absoluto del paso y su signo lo refleja el color.
  const maxAbs = Math.max(...steps.map((s) => Math.abs(Number(s.valor) || 0)), 1);
  const totalHeight = 220;
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-bold text-gray-800">Cascada del P&amp;L</h3>
        <span className="text-xs text-gray-500">{mesLabel} · % calculados sobre Venta Neta</span>
      </div>
      <p className="text-xs text-gray-400 mb-4">De Venta Bruta a UAII en {steps.length} pasos. Barras hacia arriba = ingreso/utilidad · hacia abajo = costo/gasto.</p>
      <div className="flex items-end overflow-x-auto pb-2" style={{ gap: 4, minHeight: totalHeight + 80 }}>
        {steps.map((s, i) => {
          const h = (Math.abs(s.valor) / maxAbs) * totalHeight;
          const isDown = s.valor < 0 || s.kind === 'down';
          const isSub = s.kind === 'sub' || s.kind === 'start' || s.kind === 'end';
          return (
            <div key={i} className="flex flex-col items-center" style={{ minWidth: 90, flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1E293B', textAlign: 'center', marginBottom: 4 }}>
                {fmtCompact(s.valor)}
              </div>
              <div style={{
                fontSize: 9, color: s.pct == null ? '#CBD5E1' : s.pct < 0 ? '#B91C1C' : '#475569',
                textAlign: 'center', marginBottom: 2,
              }}>
                {s.pct != null ? `${s.pct.toFixed(1)}%` : ''}
              </div>
              <div style={{
                width: '70%', height: Math.max(h, 6),
                background: s.color,
                borderRadius: isSub ? 6 : 4,
                opacity: isSub ? 1 : 0.85,
                boxShadow: isSub ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                position: 'relative',
              }}>
                {isDown && !isSub && (
                  <div style={{
                    position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                    color: s.color, fontSize: 14, fontWeight: 700,
                  }}>▼</div>
                )}
              </div>
              <div style={{
                fontSize: 10, fontWeight: isSub ? 700 : 500,
                color: isSub ? '#0F172A' : '#475569',
                textAlign: 'center', marginTop: 6, lineHeight: 1.2,
                textTransform: isSub ? 'uppercase' : 'none', letterSpacing: isSub ? 0.3 : 0,
              }}>
                {s.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ────────── Gráfica de tendencia ──────────
function TrendChart({ data, anio, anioPrev, mesMax }) {
  const [modo, setModo] = useState('venta'); // 'venta' | 'margen' | 'uafir'
  const trimMes = (d) => d.slice(0, mesMax);
  const dataAplicada = trimMes(data);

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <h3 className="text-lg font-bold text-gray-800">Tendencia mes a mes</h3>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 text-xs">
          {[
            { id: 'venta',  lbl: 'Venta Neta' },
            { id: 'uafir',  lbl: 'UAFIR' },
            { id: 'margen', lbl: 'Márgenes %' },
          ].map((t) => (
            <button key={t.id} onClick={() => setModo(t.id)}
              className={`px-3 py-1 rounded ${modo === t.id ? 'bg-white shadow text-blue-600 font-semibold' : 'text-gray-500'}`}>
              {t.lbl}
            </button>
          ))}
        </div>
      </div>
      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer>
          {modo === 'margen' ? (
            <LineChart data={dataAplicada} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#F1F5F9" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => v.toFixed(0) + '%'} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => v != null ? v.toFixed(1) + '%' : '—'} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="margenBrutoPct" name="Margen Bruto %" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="uafirPct" name="UAFIR %" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          ) : (
            <ComposedChart data={dataAplicada} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#F1F5F9" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => '$' + (v / 1e6).toFixed(0) + 'M'} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => v != null ? fmtMoney(v) : '—'} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {modo === 'venta' && (
                <>
                  <Bar dataKey="ventaNetaPrev" name={`Venta ${anioPrev}`} fill="#CBD5E1" />
                  <Bar dataKey="ventaNeta" name={`Venta ${anio}`} fill="#3B82F6" />
                </>
              )}
              {modo === 'uafir' && (
                <>
                  <Bar dataKey="uafirPrev" name={`UAFIR ${anioPrev}`} fill="#DDD6FE" />
                  <Bar dataKey="uafir" name={`UAFIR ${anio}`} fill="#8B5CF6" />
                </>
              )}
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ────────── Grupo colapsable de la tabla ──────────
function GrupoTabla({ grupo, byCuenta, byCuentaPrev, mesMax, anio, showVsAnioPrev }) {
  const [open, setOpen] = useState(grupo.defaultOpen);

  // Cuentas a renderizar (mantienen orden de la BD)
  const cuentas = grupo.cuentas
    .map((slug) => byCuenta.get(slug))
    .filter(Boolean)
    .sort((a, b) => a.orden - b.orden);
  if (grupo.extra) {
    const e = byCuenta.get(grupo.extra);
    if (e) cuentas.push(e);
  }

  // Subtotal del grupo (si aplica)
  const sub = grupo.subtotal ? byCuenta.get(grupo.subtotal) : null;

  // Total del grupo (acumulado YTD)
  const subTotal = sub ? sumYTD(sub, mesMax) : null;
  const subTotalPrev = sub ? sumYTD(byCuentaPrev.get(grupo.subtotal), mesMax) : null;
  const deltaSub = subTotal != null && subTotalPrev > 0
    ? ((subTotal - subTotalPrev) / subTotalPrev) * 100 : null;

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      {/* Header del grupo */}
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
        style={{ background: open ? '#F8FAFC' : '#fff', borderBottom: open ? '1px solid #E2E8F0' : '' }}>
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          <span style={{ width: 6, height: 6, borderRadius: 3, background: grupo.color, display: 'inline-block' }} />
          <span className="font-semibold text-sm text-gray-800">{grupo.label}</span>
          <span className="text-xs text-gray-400">({cuentas.length} cuentas)</span>
        </div>
        {sub && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-500">YTD:</span>
            <span className="font-bold text-gray-800">{fmtCompact(subTotal)}</span>
            {showVsAnioPrev && deltaSub != null && (
              <span style={{ color: deltaSub >= 0 ? '#10B981' : '#EF4444', fontSize: 11, fontWeight: 600 }}>
                {fmtPctDelta(deltaSub)}
              </span>
            )}
          </div>
        )}
      </button>

      {/* Body */}
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full" style={{ fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#FAFBFC' }}>
                <th style={thLeft}>Cuenta</th>
                {MESES_LBL.slice(0, 12).map((m, i) => (
                  <th key={m} style={{ ...thRight, color: i + 1 === mesMax ? '#1D4ED8' : '#475569' }}>{m}</th>
                ))}
                <th style={{ ...thRight, background: '#ECFDF5', color: '#065F46', borderLeft: '2px solid #A7F3D0' }}>YTD</th>
                {showVsAnioPrev && (
                  <th style={{ ...thRight, background: '#FAF5FF', color: '#6B21A8' }}>vs {anio - 1}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {cuentas.map((c) => (
                <FilaCuenta key={c.cuenta_norm} cuenta={c} prev={byCuentaPrev.get(c.cuenta_norm)}
                  mesMax={mesMax} formato={grupo.formato} showVsAnioPrev={showVsAnioPrev} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilaCuenta({ cuenta, prev, mesMax, formato, showVsAnioPrev }) {
  const isSub = cuenta.es_subtotal;
  const isSubcuenta = esSubcuenta(cuenta.cuenta);
  const ytd = sumYTD(cuenta, mesMax);
  const ytdPrev = sumYTD(prev, mesMax);
  const delta = ytdPrev > 0 ? ((ytd - ytdPrev) / ytdPrev) * 100 : null;

  const formatCell = (v) => {
    if (v == null) return '—';
    if (formato === 'pct') return fmtPct(v * 100);
    if (cuenta.cuenta_norm === 't_c_dof' || cuenta.cuenta_norm === 'colaboradores') return fmtNumber(v);
    if (formato === 'mixto') {
      if (['vta_colaborador','uti_colaborador','interes_ing_jcr_mxn'].includes(cuenta.cuenta_norm)) return fmtMoney(v);
      return fmtNumber(v);
    }
    return fmtMoney(v);
  };

  return (
    <tr style={{
      borderBottom: '1px solid #F1F5F9',
      background: isSub ? '#F1F5F9' : 'transparent',
      fontWeight: isSub ? 700 : 400,
    }}>
      <td style={{
        ...tdLeft,
        paddingLeft: isSubcuenta ? 32 : 12,
        color: isSub ? '#0F172A' : isSubcuenta ? '#94A3B8' : '#334155',
        fontStyle: isSubcuenta ? 'italic' : 'normal',
        background: isSub ? '#F1F5F9' : '#fff',
      }} title={cuenta.cuenta}>
        {cuenta.cuenta}
      </td>
      {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => {
        const v = cuenta.valores?.[m];
        return (
          <td key={m} style={{
            ...tdRight,
            color: v == null ? '#CBD5E1' : v < 0 ? '#B91C1C' : '#1E293B',
            background: m === mesMax && !isSub ? '#EFF6FF' : undefined,
          }}>{formatCell(v)}</td>
        );
      })}
      <td style={{
        ...tdRight,
        background: isSub ? '#D1FAE5' : '#ECFDF5',
        color: ytd < 0 ? '#B91C1C' : '#065F46',
        fontWeight: 700, borderLeft: '2px solid #A7F3D0',
      }}>{formato === 'pct' ? '—' : fmtCompact(ytd)}</td>
      {showVsAnioPrev && (
        <td style={{
          ...tdRight, background: '#FAF5FF',
          color: delta == null ? '#94A3B8' : delta >= 0 ? '#10B981' : '#EF4444',
          fontWeight: 600,
        }}>{delta == null ? '—' : fmtPctDelta(delta)}</td>
      )}
    </tr>
  );
}

const thLeft = { padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: 11, position: 'sticky', left: 0, background: '#FAFBFC', minWidth: 240 };
const thRight = { padding: '8px 6px', textAlign: 'right', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' };
const tdLeft = { padding: '6px 12px', whiteSpace: 'nowrap', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', position: 'sticky', left: 0 };
const tdRight = { padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' };

function sumYTD(cuenta, mesMax) {
  if (!cuenta || !cuenta.valores) return 0;
  let s = 0;
  for (let i = 1; i <= mesMax; i++) s += Number(cuenta.valores[i]) || 0;
  return s;
}
