import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Calculator, ChevronRight, ChevronDown, TrendingUp, TrendingDown,
  Info, Printer, X, AlertTriangle, ArrowRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  CartesianGrid, ResponsiveContainer, LineChart, Line, Legend, LabelList,
} from 'recharts';

// ────────── Constantes ──────────
const MESES_LBL  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MESES_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Paleta Bento — fondos suaves + tinta oscura para texto
const PALETTE = {
  blue:   { bg: '#E6F1FB', text: '#042C53', mid: '#185FA5', strong: '#3B82F6' },
  teal:   { bg: '#E1F5EE', text: '#04342C', mid: '#0F6E56', strong: '#1D9E75' },
  purple: { bg: '#EEEDFE', text: '#26215C', mid: '#534AB7', strong: '#7F77DD' },
  coral:  { bg: '#FAECE7', text: '#4A1B0C', mid: '#993C1D', strong: '#D85A30' },
  amber:  { bg: '#FAEEDA', text: '#412402', mid: '#854F0B', strong: '#BA7517' },
  red:    { bg: '#FCEBEB', text: '#501313', mid: '#A32D2D', strong: '#E24B4A' },
  gray:   { bg: '#F1EFE8', text: '#2C2C2A', mid: '#5F5E5A', strong: '#888780' },
};

// Grupos colapsables de la tabla
const GRUPOS_TABLA = [
  { id: 'ingresos', label: 'Ingresos', color: PALETTE.blue.strong, defaultOpen: true,
    cuentas: ['ventas_y_servicios_a_tasa_general','ventas_y_servicios_a_tasa_0','devol_desctos_o_bonif_sobre_ingresos'],
    subtotal: 'venta_neta' },
  { id: 'costos', label: 'Costos', color: PALETTE.amber.strong, defaultOpen: true,
    cuentas: ['costo_de_ventas','costo_de_venta_empaque','costo_ecommerce','dev_desc_o_bonificacion_s_compra','destruccion_fiscal_2025','total_costo_de_venta'],
    subtotal: 'utilidad_bruta' },
  { id: 'gastos', label: 'Gastos Operativos', color: PALETTE.red.strong, defaultOpen: true,
    cuentas: ['gastos_generales','nomina','distribucion','arrendamiento','arrendamiento_estrategia','viaticos_com','otros_gastos','proyectos','total_gastos_proyectos','total_gastos'],
    subtotal: 'uafir_sin_proyectos',
    extra: 'uafir_con_proyectos' },
  { id: 'indicadores_gasto', label: 'Indicadores de Gasto', color: PALETTE.purple.strong, defaultOpen: false,
    cuentas: ['alcance_gasto_vs_venta_n','alcance_gasto_vs_venta_n_presupuesto'],
    formato: 'pct' },
  { id: 'otros', label: 'Otros Ingresos', color: PALETTE.teal.strong, defaultOpen: false,
    cuentas: ['otros_ingresos','comision_proyectos'] },
  { id: 'financieros', label: 'Gastos y Productos Financieros', color: PALETTE.purple.mid, defaultOpen: false,
    cuentas: [
      'gastos_financieros','comisiones_cartas_de_credito','comisiones_y_sit_bancarias',
      'intereses_a_cargo_nacional','intereses_cartas_de_credito','intereses_prestamo_ing_jcr',
      'perdida_cambiaria','perdida_revaluaciones','objetivo_anual_2',
      'productos_financieros','intereses_a_favor_bancarios_nacional','utilidad_cambiaria','utilidad_revaluaciones',
      'total_productos_financieros',
    ] },
  { id: 'utilidad', label: 'Utilidad Final', color: PALETTE.coral.strong, defaultOpen: true,
    cuentas: ['uaii_contable_con_proyecctos','uaii_contable_sin_proyectos'] },
  { id: 'info', label: 'Información General', color: PALETTE.gray.strong, defaultOpen: false,
    cuentas: ['t_c_dof','colaboradores','vta_colaborador','uti_colaborador','interes_ing_jcr_mxn'],
    formato: 'mixto' },
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
  const [mesEnfoque, setMesEnfoque] = useState(0);
  const [showVsAnioPrev, setShowVsAnioPrev] = useState(true);
  const [mesDrillDown, setMesDrillDown] = useState(null);

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

  const byCuenta = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => {
      const k = r.cuenta_norm;
      if (!m.has(k)) m.set(k, {
        cuenta_norm: k, cuenta: r.cuenta,
        orden: r.orden ?? 999, es_subtotal: !!r.es_subtotal,
        valores: {}, notas: {},
      });
      const c = m.get(k);
      c.valores[Number(r.mes)] = Number(r.valor);
      if (r.nota) c.notas[Number(r.mes)] = r.nota;
    });
    // Detectar nota general (cuando todos los meses repiten el mismo texto)
    for (const c of m.values()) {
      const entries = Object.values(c.notas || {});
      const uniq = Array.from(new Set(entries));
      c.notaGeneral = (uniq.length === 1 && entries.length >= 3) ? uniq[0] : null;
    }
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

  const mesMax = useMemo(() => {
    let m = 0;
    rows.forEach((r) => { if (Number(r.mes) > m) m = Number(r.mes); });
    return m || 12;
  }, [rows]);

  const totalCuenta = (m, slug, fromPrev = false) => {
    const src = fromPrev ? byCuentaPrev : byCuenta;
    const c = src.get(slug);
    if (!c) return 0;
    if (m === 0) {
      let s = 0;
      for (let i = 1; i <= mesMax; i++) s += Number(c.valores[i]) || 0;
      return s;
    }
    return Number(c.valores[m]) || 0;
  };

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

  // ── Cascada como waterfall: cada paso lleva 'base' invisible + 'monto' visible
  const cascadaData = useMemo(() => {
    const m = mesEnfoque;
    const get = (slug) => totalCuenta(m, slug);
    const ventaTG  = get('ventas_y_servicios_a_tasa_general');
    const venta0   = get('ventas_y_servicios_a_tasa_0');
    const devs     = Math.abs(get('devol_desctos_o_bonif_sobre_ingresos'));
    const ventaBruta = ventaTG + venta0;
    const ventaNeta  = get('venta_neta');
    const costoTotal = get('total_costo_de_venta');
    const utilBruta  = get('utilidad_bruta');
    const totalGastosOp = get('total_gastos');
    const proyectos     = get('proyectos');
    const uafirSP    = get('uafir_sin_proyectos');
    const uafirCP    = get('uafir_con_proyectos');
    const totalFin   = get('total_productos_financieros');
    const otrosIng   = get('otros_ingresos') + get('comision_proyectos');
    const uaii       = get('uaii_contable_sin_proyectos');
    const pct = (v) => ventaNeta !== 0 ? (v / ventaNeta) * 100 : null;

    return [
      { name: 'Venta\nBruta', base: 0, monto: ventaBruta, valor: ventaBruta, pct: pct(ventaBruta), color: PALETTE.blue.mid, kind: 'sub' },
      { name: '(–) Devs', base: ventaNeta, monto: devs, valor: -devs, pct: pct(-devs), color: PALETTE.red.mid, kind: 'neg' },
      { name: 'Venta\nNeta', base: 0, monto: ventaNeta, valor: ventaNeta, pct: 100, color: PALETTE.blue.strong, kind: 'sub' },
      { name: '(–) Costo', base: utilBruta, monto: costoTotal, valor: -costoTotal, pct: pct(-costoTotal), color: PALETTE.amber.mid, kind: 'neg' },
      { name: 'Util.\nBruta', base: 0, monto: utilBruta, valor: utilBruta, pct: pct(utilBruta), color: PALETTE.teal.mid, kind: 'sub' },
      { name: '(–) Gastos\nOp.', base: uafirSP, monto: totalGastosOp, valor: -totalGastosOp, pct: pct(-totalGastosOp), color: PALETTE.red.mid, kind: 'neg' },
      { name: 'UAFIR\ns/Proy.', base: 0, monto: uafirSP, valor: uafirSP, pct: pct(uafirSP), color: PALETTE.purple.mid, kind: 'sub' },
      { name: '(–) Proy.', base: uafirCP, monto: proyectos, valor: -proyectos, pct: pct(-proyectos), color: PALETTE.purple.strong, kind: 'neg' },
      { name: 'UAFIR\nc/Proy.', base: 0, monto: uafirCP, valor: uafirCP, pct: pct(uafirCP), color: PALETTE.purple.text, kind: 'sub' },
      { name: 'Fin. y\nOtros', base: uaii, monto: Math.abs(totalFin + otrosIng), valor: -(totalFin + otrosIng), pct: pct(-(totalFin + otrosIng)), color: PALETTE.amber.strong, kind: 'neg' },
      { name: 'UAII', base: 0, monto: uaii, valor: uaii, pct: pct(uaii), color: PALETTE.coral.mid, kind: 'sub' },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byCuenta, mesEnfoque, mesMax]);

  // ── Alertas automáticas: detecta variaciones notables en cuentas clave
  const alertas = useMemo(() => {
    const CUENTAS_CLAVE = ['venta_neta','utilidad_bruta','uafir_sin_proyectos','total_gastos','nomina','distribucion','arrendamiento','proyectos','gastos_generales','gastos_financieros'];
    const items = [];
    CUENTAS_CLAVE.forEach((slug) => {
      const c = byCuenta.get(slug);
      if (!c) return;
      // MoM en último mes con datos
      if (mesMax >= 2) {
        const v = c.valores[mesMax];
        const vPrev = c.valores[mesMax - 1];
        if (v != null && vPrev != null && Math.abs(vPrev) > 1000) {
          const delta = ((v - vPrev) / Math.abs(vPrev)) * 100;
          if (Math.abs(delta) >= 25) {
            items.push({
              type: 'mom',
              cuenta: c.cuenta, slug,
              mes: mesMax, delta,
              mensaje: `${c.cuenta} ${delta > 0 ? 'subió' : 'bajó'} ${Math.abs(delta).toFixed(1)}% en ${MESES_FULL[mesMax-1]} vs ${MESES_FULL[mesMax-2]}`,
            });
          }
        }
      }
      // YoY
      const v = c.valores[mesMax];
      const cPrev = byCuentaPrev.get(slug);
      const vPrevY = cPrev?.valores?.[mesMax];
      if (v != null && vPrevY != null && Math.abs(vPrevY) > 1000) {
        const delta = ((v - vPrevY) / Math.abs(vPrevY)) * 100;
        if (Math.abs(delta) >= 40) {
          items.push({
            type: 'yoy',
            cuenta: c.cuenta, slug,
            mes: mesMax, delta,
            mensaje: `${c.cuenta} ${MESES_FULL[mesMax-1]} ${anio}: ${delta > 0 ? '+' : ''}${delta.toFixed(1)}% vs ${anio - 1}`,
          });
        }
      }
    });
    return items;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byCuenta, byCuentaPrev, mesMax, anio]);

  // ── Ficha del mes: composición + top variaciones
  const fichaMes = useMemo(() => {
    if (!mesDrillDown) return null;
    const m = mesDrillDown;
    const get = (slug) => byCuenta.get(slug);
    const ventaNeta = get('venta_neta')?.valores?.[m] || 0;
    const utilBruta = get('utilidad_bruta')?.valores?.[m] || 0;
    const uafir     = get('uafir_sin_proyectos')?.valores?.[m] || 0;
    const uaii      = get('uaii_contable_sin_proyectos')?.valores?.[m] || 0;
    const ventaPrev = byCuentaPrev.get('venta_neta')?.valores?.[m] || 0;

    // Variaciones vs mes anterior — solo cuentas detalle
    const varsMoM = [];
    byCuenta.forEach((c) => {
      if (c.es_subtotal) return;
      const v = c.valores[m];
      const vPrev = c.valores[m - 1];
      if (v != null && vPrev != null && Math.abs(vPrev) > 1000) {
        const deltaAbs = v - vPrev;
        const deltaPct = (deltaAbs / Math.abs(vPrev)) * 100;
        if (Math.abs(deltaAbs) > 50000) {
          varsMoM.push({ cuenta: c.cuenta, deltaAbs, deltaPct, valor: v, valorPrev: vPrev });
        }
      }
    });
    varsMoM.sort((a, b) => Math.abs(b.deltaAbs) - Math.abs(a.deltaAbs));

    // Variaciones YoY (mismo mes año anterior)
    const varsYoY = [];
    byCuenta.forEach((c) => {
      if (c.es_subtotal) return;
      const v = c.valores[m];
      const cPrev = byCuentaPrev.get(c.cuenta_norm);
      const vPrev = cPrev?.valores?.[m];
      if (v != null && vPrev != null && Math.abs(vPrev) > 1000) {
        const deltaAbs = v - vPrev;
        const deltaPct = (deltaAbs / Math.abs(vPrev)) * 100;
        if (Math.abs(deltaAbs) > 50000) {
          varsYoY.push({ cuenta: c.cuenta, deltaAbs, deltaPct, valor: v, valorPrev: vPrev });
        }
      }
    });
    varsYoY.sort((a, b) => Math.abs(b.deltaAbs) - Math.abs(a.deltaAbs));

    // Top gastos del mes
    const GASTOS_SLUGS = ['gastos_generales','nomina','distribucion','arrendamiento','viaticos_com','proyectos','costo_de_ventas'];
    const topGastos = GASTOS_SLUGS
      .map((slug) => {
        const c = byCuenta.get(slug);
        return c ? { cuenta: c.cuenta, valor: c.valores[m] || 0 } : null;
      })
      .filter((g) => g && g.valor > 0)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);

    return {
      mes: m, ventaNeta, utilBruta, uafir, uaii,
      ventaPrev,
      pctBruta: ventaNeta > 0 ? (utilBruta / ventaNeta) * 100 : null,
      pctUafir: ventaNeta > 0 ? (uafir / ventaNeta) * 100 : null,
      deltaVenta: ventaPrev > 0 ? ((ventaNeta - ventaPrev) / ventaPrev) * 100 : null,
      varsMoM: varsMoM.slice(0, 5),
      varsYoY: varsYoY.slice(0, 5),
      topGastos,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byCuenta, byCuentaPrev, mesDrillDown]);

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
    <div className="max-w-none mx-auto p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 px-1">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-1">
            REVKO Technology · {mesEnfoque === 0 ? `YTD ene–${MESES_LBL[mesMax - 1]}` : MESES_FULL[mesEnfoque - 1]} {anio}
          </p>
          <h2 className="text-2xl font-medium text-gray-800">Estado de resultados</h2>
        </div>
        <div className="flex items-end gap-2 edr-no-print">
          <label className="flex flex-col text-[11px] text-gray-500">
            Año
            <select value={anio} onChange={(e) => setAnio(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white">
              {aniosDisponibles.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label className="flex flex-col text-[11px] text-gray-500">
            Foco
            <select value={mesEnfoque} onChange={(e) => setMesEnfoque(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white">
              <option value={0}>YTD acumulado</option>
              {Array.from({ length: mesMax }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{MESES_FULL[m - 1]} {anio}</option>
              ))}
            </select>
          </label>
          <button onClick={() => window.print()}
            title="Exportar PDF (Imprimir → Guardar como PDF)"
            className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white hover:bg-gray-50 text-gray-700">
            <Printer className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      {/* Alertas / outliers */}
      {alertas.length > 0 && (
        <AlertasBanner alertas={alertas} onMesClick={(m) => setMesDrillDown(m)} />
      )}

      {/* KPIs Bento */}
      <div className="grid grid-cols-4 gap-2.5">
        <BentoKpi palette={PALETTE.blue} label="Venta neta" valor={fmtCompact(kpis.ventaNeta)}
          subtitulo={kpis.deltaVenta == null ? `${anio - 1} sin datos` : ''}
          delta={kpis.deltaVenta} deltaLabel={`vs ${anio - 1}`} />
        <BentoKpi palette={PALETTE.teal} label="Utilidad bruta" valor={fmtCompact(kpis.utilBruta)}
          subtitulo={kpis.pctBruta != null ? `Margen ${kpis.pctBruta.toFixed(1)}%` : ''}
          delta={kpis.deltaUtil} deltaLabel={`vs ${anio - 1}`} />
        <BentoKpi palette={PALETTE.purple} label="UAFIR s/ proyectos" valor={fmtCompact(kpis.uafir)}
          subtitulo={kpis.pctUafir != null ? `${kpis.pctUafir.toFixed(1)}% s/ venta` : ''}
          delta={kpis.deltaUafir} deltaLabel={`vs ${anio - 1}`} />
        <BentoKpi palette={PALETTE.coral} label="UAII" valor={fmtCompact(kpis.uaii)}
          subtitulo={kpis.pctUaii != null ? `${kpis.pctUaii.toFixed(1)}% s/ venta` : ''}
          delta={kpis.deltaUaii} deltaLabel={`vs ${anio - 1}`} />
      </div>

      {/* Cascada + Tendencia */}
      <div className="grid gap-2.5" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
        <CascadaCard
          data={cascadaData}
          mesLabel={mesEnfoque === 0 ? `YTD ${anio}` : `${MESES_FULL[mesEnfoque - 1]} ${anio}`}
          onAbrirMes={mesEnfoque === 0 ? null : () => setMesDrillDown(mesEnfoque)}
        />
        <TrendCard
          data={trendData} anio={anio} anioPrev={anio - 1} mesMax={mesMax}
          onMesClick={(mesIdx) => setMesDrillDown(mesIdx + 1)}
        />
      </div>

      {/* Tabla por grupos */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-base font-medium text-gray-800">Detalle por cuenta</h3>
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer edr-no-print">
            <input type="checkbox" checked={showVsAnioPrev}
              onChange={(e) => setShowVsAnioPrev(e.target.checked)} className="rounded border-gray-300" />
            Comparativo {anio - 1}
          </label>
        </div>
        {GRUPOS_TABLA.map((g) => (
          <GrupoTabla key={g.id} grupo={g} byCuenta={byCuenta} byCuentaPrev={byCuentaPrev}
            mesMax={mesMax} anio={anio} showVsAnioPrev={showVsAnioPrev}
            onMesClick={(m) => setMesDrillDown(m)} />
        ))}
      </div>

      <p className="text-[11px] text-gray-400 px-2">
        Fuente: tabla <code>estados_resultados</code> · alimentada desde /uploads.html
      </p>

      {/* Drill-down modal */}
      {fichaMes && (
        <FichaMesModal
          ficha={fichaMes}
          anio={anio}
          anioPrev={anio - 1}
          onClose={() => setMesDrillDown(null)}
        />
      )}

      {/* Estilos para impresión PDF */}
      <style>{`
        @media print {
          .edr-no-print { display: none !important; }
          @page { size: A3 landscape; margin: 12mm; }
          body { background: #fff !important; }
        }
      `}</style>
    </div>
  );
}

// ────────── Bento KPI ──────────
function BentoKpi({ palette, label, valor, subtitulo, delta, deltaLabel }) {
  return (
    <div style={{ background: palette.bg, borderRadius: 12, padding: '14px 16px' }}>
      <p style={{ fontSize: 11, margin: 0, color: palette.mid, letterSpacing: '0.03em' }}>{label}</p>
      <p style={{
        fontSize: 24, fontWeight: 500, margin: '6px 0 4px',
        color: palette.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1,
      }}>
        {valor}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 14, flexWrap: 'wrap' }}>
        {delta != null && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 500,
            color: delta >= 0 ? '#0F6E56' : '#A32D2D' }}>
            {delta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {fmtPctDelta(delta)} {deltaLabel}
          </span>
        )}
        {subtitulo && <span style={{ fontSize: 11, color: palette.mid }}>{subtitulo}</span>}
      </div>
    </div>
  );
}

// ────────── Cascada (waterfall) ──────────
function CascadaCard({ data, mesLabel, onAbrirMes }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-sm font-medium text-gray-800">Cascada del P&amp;L</p>
        <div className="flex items-center gap-3">
          {onAbrirMes && (
            <button onClick={onAbrirMes}
              className="text-[11px] text-purple-700 hover:underline flex items-center gap-1 edr-no-print">
              Ver ficha del mes <ArrowRight className="w-3 h-3" />
            </button>
          )}
          <p className="text-[11px] text-gray-400">{mesLabel}</p>
        </div>
      </div>
      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 24, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6B6A64' }} interval={0} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} />
            <YAxis tickFormatter={(v) => '$' + (v / 1e6).toFixed(0) + 'M'} tick={{ fontSize: 10, fill: '#6B6A64' }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: 'rgba(0,0,0,0.04)' }}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
              formatter={(v, name, p) => {
                if (name === 'base') return null;
                const item = p?.payload;
                const valFmt = fmtMoney(item.valor);
                const pctFmt = item.pct != null ? ` · ${item.pct.toFixed(1)}%` : '';
                return [valFmt + pctFmt, item.name.replace('\n', ' ')];
              }}
            />
            <Bar dataKey="base" stackId="a" fill="transparent" isAnimationActive={false} />
            <Bar dataKey="monto" stackId="a" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
              <LabelList dataKey="valor" position="top" formatter={(v) => fmtCompact(v)}
                style={{ fontSize: 10, fill: '#1E293B', fontWeight: 500 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] text-gray-400 mt-1 italic">Etiqueta arriba = monto · % calculados sobre Venta Neta</p>
    </div>
  );
}

// ────────── Tendencia ──────────
function TrendCard({ data, anio, anioPrev, mesMax }) {
  const [modo, setModo] = useState('venta');
  const dataAplicada = data.slice(0, Math.max(mesMax, 3));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
      <div className="flex items-center justify-between mb-2 gap-2">
        <p className="text-sm font-medium text-gray-800">Tendencia mensual</p>
        <div className="flex gap-0.5 bg-gray-100 rounded-md p-0.5 text-[10px]">
          {[
            { id: 'venta',  lbl: 'Venta' },
            { id: 'uafir',  lbl: 'UAFIR' },
            { id: 'margen', lbl: 'Márgenes' },
          ].map((t) => (
            <button key={t.id} onClick={() => setModo(t.id)}
              className={`px-2 py-0.5 rounded ${modo === t.id ? 'bg-white shadow-sm text-purple-700 font-medium' : 'text-gray-500'}`}>
              {t.lbl}
            </button>
          ))}
        </div>
      </div>
      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer>
          {modo === 'margen' ? (
            <LineChart data={dataAplicada} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#6B6A64' }} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} />
              <YAxis tickFormatter={(v) => v.toFixed(0) + '%'} tick={{ fontSize: 10, fill: '#6B6A64' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => v != null ? v.toFixed(1) + '%' : '—'} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="line" />
              <Line type="monotone" dataKey="margenBrutoPct" name="Margen Bruto %" stroke={PALETTE.teal.mid} strokeWidth={2} dot={{ r: 3, fill: PALETTE.teal.mid }} />
              <Line type="monotone" dataKey="uafirPct" name="UAFIR %" stroke={PALETTE.purple.mid} strokeWidth={2} dot={{ r: 3, fill: PALETTE.purple.mid }} />
            </LineChart>
          ) : (
            <BarChart data={dataAplicada} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#6B6A64' }} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} />
              <YAxis tickFormatter={(v) => '$' + (v / 1e6).toFixed(0) + 'M'} tick={{ fontSize: 10, fill: '#6B6A64' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => v != null ? fmtMoney(v) : '—'} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {modo === 'venta' && (
                <>
                  <Bar dataKey="ventaNetaPrev" name={`Venta ${anioPrev}`} fill={PALETTE.purple.bg} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="ventaNeta" name={`Venta ${anio}`} fill={PALETTE.purple.mid} radius={[4, 4, 0, 0]} />
                </>
              )}
              {modo === 'uafir' && (
                <>
                  <Bar dataKey="uafirPrev" name={`UAFIR ${anioPrev}`} fill={PALETTE.teal.bg} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="uafir" name={`UAFIR ${anio}`} fill={PALETTE.teal.mid} radius={[4, 4, 0, 0]} />
                </>
              )}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ────────── Grupo colapsable de la tabla ──────────
function GrupoTabla({ grupo, byCuenta, byCuentaPrev, mesMax, anio, showVsAnioPrev, onMesClick }) {
  const [open, setOpen] = useState(grupo.defaultOpen);
  const cuentas = grupo.cuentas.map((slug) => byCuenta.get(slug)).filter(Boolean).sort((a, b) => a.orden - b.orden);
  if (grupo.extra) {
    const e = byCuenta.get(grupo.extra);
    if (e) cuentas.push(e);
  }
  const sub = grupo.subtotal ? byCuenta.get(grupo.subtotal) : null;
  const subTotal = sub ? sumYTD(sub, mesMax) : null;
  const subTotalPrev = sub ? sumYTD(byCuentaPrev.get(grupo.subtotal), mesMax) : null;
  const deltaSub = subTotal != null && subTotalPrev > 0 ? ((subTotal - subTotalPrev) / subTotalPrev) * 100 : null;

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors"
        style={{ background: open ? '#FAFBFC' : '#fff', borderBottom: open ? '1px solid #E2E8F0' : '' }}>
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
          <span style={{ width: 6, height: 6, borderRadius: 3, background: grupo.color, display: 'inline-block' }} />
          <span className="font-medium text-sm text-gray-800">{grupo.label}</span>
          <span className="text-[11px] text-gray-400">{cuentas.length}</span>
        </div>
        {sub && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-500 text-[11px]">YTD</span>
            <span className="font-medium text-gray-800" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtCompact(subTotal)}</span>
            {showVsAnioPrev && deltaSub != null && (
              <span style={{ color: deltaSub >= 0 ? '#0F6E56' : '#A32D2D', fontSize: 11, fontWeight: 500 }}>
                {fmtPctDelta(deltaSub)}
              </span>
            )}
          </div>
        )}
      </button>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full" style={{ fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#FAFBFC' }}>
                <th style={thLeft}>Cuenta</th>
                {MESES_LBL.slice(0, 12).map((m, i) => (
                  <th key={m}
                    onClick={() => onMesClick && onMesClick(i + 1)}
                    title={`Ver ficha del mes ${m}`}
                    style={{ ...thRight, color: i + 1 === mesMax ? PALETTE.purple.mid : '#6B6A64', cursor: onMesClick ? 'pointer' : 'default' }}>
                    {m}
                  </th>
                ))}
                <th style={{ ...thRight, background: PALETTE.teal.bg, color: PALETTE.teal.text }}>YTD</th>
                {showVsAnioPrev && (
                  <th style={{ ...thRight, background: PALETTE.purple.bg, color: PALETTE.purple.text }}>vs {anio - 1}</th>
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
      background: isSub ? '#F8FAFC' : 'transparent',
      fontWeight: isSub ? 500 : 400,
    }}>
      <td style={{
        ...tdLeft,
        paddingLeft: isSubcuenta ? 32 : 12,
        color: isSub ? '#0F172A' : isSubcuenta ? '#94A3B8' : '#334155',
        fontStyle: isSubcuenta ? 'italic' : 'normal',
        background: isSub ? '#F8FAFC' : '#fff',
      }} title={cuenta.notaGeneral || cuenta.cuenta}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {cuenta.cuenta}
          {cuenta.notaGeneral && (
            <Info className="w-3 h-3" style={{ color: PALETTE.amber.mid }} />
          )}
        </span>
      </td>
      {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => {
        const v = cuenta.valores?.[m];
        const nota = cuenta.notas?.[m] && cuenta.notas[m] !== cuenta.notaGeneral ? cuenta.notas[m] : null;
        return (
          <td key={m}
            title={nota || (v != null ? formatCell(v) : '')}
            style={{
              ...tdRight,
              color: v == null ? '#CBD5E1' : v < 0 ? PALETTE.red.mid : '#1E293B',
              background: m === mesMax && !isSub ? PALETTE.purple.bg : undefined,
              fontVariantNumeric: 'tabular-nums',
              position: 'relative',
            }}>
            {formatCell(v)}
            {nota && (
              <span style={{
                position: 'absolute', top: 2, right: 2,
                width: 6, height: 6, borderRadius: 3, background: PALETTE.amber.strong,
              }} title={nota} />
            )}
          </td>
        );
      })}
      <td style={{
        ...tdRight,
        background: PALETTE.teal.bg,
        color: ytd < 0 ? PALETTE.red.mid : PALETTE.teal.text,
        fontWeight: 500, fontVariantNumeric: 'tabular-nums',
      }}>{formato === 'pct' ? '—' : fmtCompact(ytd)}</td>
      {showVsAnioPrev && (
        <td style={{
          ...tdRight, background: PALETTE.purple.bg,
          color: delta == null ? '#94A3B8' : delta >= 0 ? '#0F6E56' : '#A32D2D',
          fontWeight: 500, fontVariantNumeric: 'tabular-nums',
        }}>{delta == null ? '—' : fmtPctDelta(delta)}</td>
      )}
    </tr>
  );
}

const thLeft = { padding: '8px 12px', textAlign: 'left', fontWeight: 500, color: '#6B6A64', fontSize: 11, position: 'sticky', left: 0, background: '#FAFBFC', minWidth: 240 };
const thRight = { padding: '8px 6px', textAlign: 'right', fontWeight: 500, fontSize: 11, whiteSpace: 'nowrap' };
const tdLeft = { padding: '6px 12px', whiteSpace: 'nowrap', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', position: 'sticky', left: 0, fontSize: 12 };
const tdRight = { padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap', fontSize: 12 };

// ────────── Banda de alertas ──────────
function AlertasBanner({ alertas, onMesClick }) {
  return (
    <div style={{
      background: PALETTE.amber.bg, borderRadius: 12, padding: '10px 14px',
      borderLeft: `4px solid ${PALETTE.amber.strong}`,
    }} className="edr-no-print">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 flex-none mt-0.5" style={{ color: PALETTE.amber.mid }} />
        <div className="flex-1">
          <p style={{ fontSize: 11, color: PALETTE.amber.mid, fontWeight: 500, margin: 0, letterSpacing: '0.03em' }}>
            Señales para revisar ({alertas.length})
          </p>
          <ul style={{ margin: '4px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: '4px 18px' }}>
            {alertas.map((a, i) => (
              <li key={i} style={{ fontSize: 12, color: PALETTE.amber.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  display: 'inline-block', minWidth: 28, padding: '1px 6px', borderRadius: 10,
                  fontSize: 10, background: a.type === 'yoy' ? PALETTE.purple.bg : PALETTE.coral.bg,
                  color: a.type === 'yoy' ? PALETTE.purple.text : PALETTE.coral.text,
                  textAlign: 'center', fontWeight: 500,
                }}>
                  {a.type === 'yoy' ? 'YoY' : 'MoM'}
                </span>
                {a.mensaje}
                <button onClick={() => onMesClick(a.mes)}
                  className="text-[10px] underline hover:no-underline"
                  style={{ color: PALETTE.amber.mid }}>ver mes</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ────────── Modal: Ficha del Mes ──────────
function FichaMesModal({ ficha, anio, anioPrev, onClose }) {
  const { mes, ventaNeta, utilBruta, uafir, uaii, ventaPrev, pctBruta, pctUafir, deltaVenta, varsMoM, varsYoY, topGastos } = ficha;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)',
      display: 'flex', justifyContent: 'flex-end', zIndex: 100,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: '#fff', width: 480, maxWidth: '95vw', height: '100vh',
        overflowY: 'auto', padding: 24, boxShadow: '-8px 0 24px rgba(0,0,0,0.15)',
      }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p style={{ fontSize: 11, color: PALETTE.gray.mid, letterSpacing: '0.05em', textTransform: 'uppercase', margin: 0 }}>
              Ficha del mes
            </p>
            <h3 style={{ fontSize: 22, fontWeight: 500, margin: '4px 0 0', color: PALETTE.gray.text }}>
              {MESES_FULL[mes - 1]} {anio}
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        {/* KPIs del mes */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          <BentoKpi palette={PALETTE.blue} label="Venta neta" valor={fmtCompact(ventaNeta)}
            subtitulo={ventaPrev > 0 ? `${anioPrev}: ${fmtCompact(ventaPrev)}` : `${anioPrev} sin datos`}
            delta={deltaVenta} deltaLabel="YoY" />
          <BentoKpi palette={PALETTE.teal} label="Utilidad bruta" valor={fmtCompact(utilBruta)}
            subtitulo={pctBruta != null ? `Margen ${pctBruta.toFixed(1)}%` : ''} delta={null} />
          <BentoKpi palette={PALETTE.purple} label="UAFIR s/ proy" valor={fmtCompact(uafir)}
            subtitulo={pctUafir != null ? `${pctUafir.toFixed(1)}% s/ venta` : ''} delta={null} />
          <BentoKpi palette={PALETTE.coral} label="UAII" valor={fmtCompact(uaii)}
            subtitulo="" delta={null} />
        </div>

        {/* Top gastos */}
        {topGastos.length > 0 && (
          <Section titulo="Top 5 gastos del mes">
            {topGastos.map((g, i) => (
              <RowDetalle key={i} izq={g.cuenta} der={fmtMoney(g.valor)} barPct={(g.valor / topGastos[0].valor) * 100} barColor={PALETTE.red.mid} />
            ))}
          </Section>
        )}

        {/* Variaciones MoM */}
        {varsMoM.length > 0 && (
          <Section titulo={`5 variaciones vs ${MESES_FULL[mes - 2] || 'mes anterior'}`}>
            {varsMoM.map((v, i) => <VarRow key={i} v={v} />)}
          </Section>
        )}

        {/* Variaciones YoY */}
        {varsYoY.length > 0 && (
          <Section titulo={`5 variaciones vs ${MESES_FULL[mes - 1]} ${anioPrev}`}>
            {varsYoY.map((v, i) => <VarRow key={i} v={v} />)}
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ titulo, children }) {
  return (
    <div className="mb-5">
      <p style={{ fontSize: 11, color: PALETTE.gray.mid, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>
        {titulo}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function RowDetalle({ izq, der, barPct, barColor }) {
  return (
    <div className="relative" style={{ padding: '6px 10px', background: '#FAFBFC', borderRadius: 6 }}>
      {barPct != null && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 6, overflow: 'hidden', pointerEvents: 'none',
        }}>
          <div style={{ width: `${Math.min(barPct, 100)}%`, height: '100%', background: barColor, opacity: 0.08 }} />
        </div>
      )}
      <div className="relative flex justify-between items-center gap-3">
        <span style={{ fontSize: 12, color: PALETTE.gray.text }}>{izq}</span>
        <span style={{ fontSize: 12, fontWeight: 500, color: PALETTE.gray.text, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{der}</span>
      </div>
    </div>
  );
}

function VarRow({ v }) {
  const subio = v.deltaAbs > 0;
  return (
    <div style={{ padding: '6px 10px', background: '#FAFBFC', borderRadius: 6 }}>
      <div className="flex justify-between items-center gap-3">
        <span style={{ fontSize: 12, color: PALETTE.gray.text, flex: 1 }}>{v.cuenta}</span>
        <span style={{ fontSize: 11, color: subio ? PALETTE.red.mid : PALETTE.teal.mid, fontWeight: 500, whiteSpace: 'nowrap' }}>
          {subio ? '▲' : '▼'} {fmtCompact(Math.abs(v.deltaAbs))} ({fmtPctDelta(v.deltaPct)})
        </span>
      </div>
      <div className="flex justify-between gap-3" style={{ fontSize: 10, color: PALETTE.gray.mid, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>
        <span>antes: {fmtCompact(v.valorPrev)}</span>
        <span>ahora: {fmtCompact(v.valor)}</span>
      </div>
    </div>
  );
}

function sumYTD(cuenta, mesMax) {
  if (!cuenta || !cuenta.valores) return 0;
  let s = 0;
  for (let i = 1; i <= mesMax; i++) s += Number(cuenta.valores[i]) || 0;
  return s;
}
