import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import AppleLoader from '../../components/apple/AppleLoader';
import { useTheme } from '../../lib/themeContext';
import { AppleH1, AppleEyebrow, AppleSegment } from '../../components/apple';
import { TYPO } from '../../lib/themeTokens';
import { Calculator, Printer, X, AlertTriangle, ChevronRight } from 'lucide-react';

// ────────── Constantes ──────────
const MESES_LBL  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MESES_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Grupos colapsables — cada uno con dot semantic color (leído del theme)
const GRUPOS_TABLA = [
  { id: 'ingresos', label: 'Ingresos', dotKey: 'green', defaultOpen: true,
    cuentas: ['ventas_y_servicios_a_tasa_general','ventas_y_servicios_a_tasa_0','devol_desctos_o_bonif_sobre_ingresos'],
    subtotal: 'venta_neta' },
  { id: 'costos', label: 'Costo de ventas', dotKey: 'orange', defaultOpen: true,
    cuentas: ['costo_de_ventas','costo_de_venta_empaque','costo_ecommerce','dev_desc_o_bonificacion_s_compra','destruccion_fiscal_2025','total_costo_de_venta'],
    subtotal: 'utilidad_bruta' },
  { id: 'gastos', label: 'Gastos operativos', dotKey: 'red', defaultOpen: true,
    cuentas: ['gastos_generales','nomina','distribucion','arrendamiento','arrendamiento_estrategia','viaticos_com','otros_gastos','proyectos','total_gastos_proyectos','total_gastos'],
    subtotal: 'uafir_sin_proyectos',
    extra: 'uafir_con_proyectos' },
  { id: 'indicadores_gasto', label: 'Indicadores de gasto', dotKey: 'purple', defaultOpen: false,
    cuentas: ['alcance_gasto_vs_venta_n','alcance_gasto_vs_venta_n_presupuesto'],
    formato: 'pct' },
  { id: 'otros', label: 'Otros ingresos', dotKey: 'accent', defaultOpen: false,
    cuentas: ['otros_ingresos','comision_proyectos'] },
  { id: 'financieros', label: 'Gastos y productos financieros', dotKey: 'pink', defaultOpen: false,
    cuentas: [
      'gastos_financieros','comisiones_cartas_de_credito','comisiones_y_sit_bancarias',
      'intereses_a_cargo_nacional','intereses_cartas_de_credito','intereses_prestamo_ing_jcr',
      'perdida_cambiaria','perdida_revaluaciones','objetivo_anual_2',
      'productos_financieros','intereses_a_favor_bancarios_nacional','utilidad_cambiaria','utilidad_revaluaciones',
      'total_productos_financieros',
    ] },
  { id: 'utilidad', label: 'Utilidad final', dotKey: 'orange', defaultOpen: true,
    cuentas: ['uaii_contable_con_proyecctos','uaii_contable_sin_proyectos'] },
];

const INFO_SLUGS = ['t_c_dof','colaboradores','vta_colaborador','uti_colaborador','interes_ing_jcr_mxn'];

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

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export default function EstadoResultados() {
  const { theme } = useTheme();
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [aniosDisponibles, setAniosDisponibles] = useState([]);
  const [rows, setRows] = useState([]);
  const [rowsPrev, setRowsPrev] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mesDrillDown, setMesDrillDown] = useState(null);
  const [modoTrend, setModoTrend] = useState('venta'); // venta | uafir | margen
  const [alertasDescartadas, setAlertasDescartadas] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('edr_alertas_descartadas') || '[]')); }
    catch { return new Set(); }
  });
  const persistirDescartadas = (next) => {
    setAlertasDescartadas(next);
    try { localStorage.setItem('edr_alertas_descartadas', JSON.stringify(Array.from(next))); } catch {}
  };

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
      deltaMargen: (ventaPrev > 0 && utilPrev != null) ?
        ((utilBruta / ventaNeta) - (utilPrev / ventaPrev)) * 100 : null,
      ventaPrev, utilPrev, uafirPrev, uaiiPrev,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byCuenta, byCuentaPrev, mesMax]);

  // ── Serie mensual para sparklines y tendencia
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
        ventaNeta:     i <= mesMax ? (vn || null) : null,
        utilBruta:     i <= mesMax ? (ub || null) : null,
        uafir:         i <= mesMax ? (uf || null) : null,
        ventaNetaPrev: vnP || null,
        uafirPrev:     ufP || null,
        margenBrutoPct: vn > 0 ? (ub / vn) * 100 : null,
        uafirPct:       vn > 0 ? (uf / vn) * 100 : null,
      });
    }
    return data;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byCuenta, byCuentaPrev, mesMax]);

  // ── Alertas
  const alertas = useMemo(() => {
    const CUENTAS_CLAVE = ['venta_neta','utilidad_bruta','uafir_sin_proyectos','total_gastos','nomina','distribucion','arrendamiento','proyectos','gastos_generales','gastos_financieros'];
    const items = [];
    CUENTAS_CLAVE.forEach((slug) => {
      const c = byCuenta.get(slug);
      if (!c) return;
      if (mesMax >= 2) {
        const v = c.valores[mesMax];
        const vPrev = c.valores[mesMax - 1];
        if (v != null && vPrev != null && Math.abs(vPrev) > 1000) {
          const delta = ((v - vPrev) / Math.abs(vPrev)) * 100;
          if (Math.abs(delta) >= 25) {
            items.push({
              id: `${anio}-mom-${slug}-${mesMax}`, type: 'mom',
              cuenta: c.cuenta, slug, mes: mesMax, delta,
              mensaje: `${c.cuenta} ${delta > 0 ? 'subió' : 'bajó'} ${Math.abs(delta).toFixed(1)}% en ${MESES_FULL[mesMax-1]} vs ${MESES_FULL[mesMax-2]}`,
            });
          }
        }
      }
      const v = c.valores[mesMax];
      const cPrev = byCuentaPrev.get(slug);
      const vPrevY = cPrev?.valores?.[mesMax];
      if (v != null && vPrevY != null && Math.abs(vPrevY) > 1000) {
        const delta = ((v - vPrevY) / Math.abs(vPrevY)) * 100;
        if (Math.abs(delta) >= 40) {
          items.push({
            id: `${anio}-yoy-${slug}-${mesMax}`, type: 'yoy',
            cuenta: c.cuenta, slug, mes: mesMax, delta,
            mensaje: `${c.cuenta} ${MESES_FULL[mesMax-1]} ${anio}: ${delta > 0 ? '+' : ''}${delta.toFixed(1)}% vs ${anio - 1}`,
          });
        }
      }
    });
    return items;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byCuenta, byCuentaPrev, mesMax, anio]);

  const alertasActivas = alertas.filter((a) => !alertasDescartadas.has(a.id));

  // ── Ficha del mes (para modal)
  const fichaMes = useMemo(() => {
    if (!mesDrillDown) return null;
    const m = mesDrillDown;
    const get = (slug) => byCuenta.get(slug);
    const ventaNeta = get('venta_neta')?.valores?.[m] || 0;
    const utilBruta = get('utilidad_bruta')?.valores?.[m] || 0;
    const uafir     = get('uafir_sin_proyectos')?.valores?.[m] || 0;
    const uaii      = get('uaii_contable_sin_proyectos')?.valores?.[m] || 0;
    const ventaPrev = byCuentaPrev.get('venta_neta')?.valores?.[m] || 0;

    const varsMoM = [];
    byCuenta.forEach((c) => {
      if (c.es_subtotal) return;
      const v = c.valores[m]; const vPrev = c.valores[m - 1];
      if (v != null && vPrev != null && Math.abs(vPrev) > 1000) {
        const deltaAbs = v - vPrev;
        const deltaPct = (deltaAbs / Math.abs(vPrev)) * 100;
        if (Math.abs(deltaAbs) > 50000) varsMoM.push({ cuenta: c.cuenta, deltaAbs, deltaPct, valor: v, valorPrev: vPrev });
      }
    });
    varsMoM.sort((a, b) => Math.abs(b.deltaAbs) - Math.abs(a.deltaAbs));

    const varsYoY = [];
    byCuenta.forEach((c) => {
      if (c.es_subtotal) return;
      const v = c.valores[m]; const vPrev = byCuentaPrev.get(c.cuenta_norm)?.valores?.[m];
      if (v != null && vPrev != null && Math.abs(vPrev) > 1000) {
        const deltaAbs = v - vPrev;
        const deltaPct = (deltaAbs / Math.abs(vPrev)) * 100;
        if (Math.abs(deltaAbs) > 50000) varsYoY.push({ cuenta: c.cuenta, deltaAbs, deltaPct, valor: v, valorPrev: vPrev });
      }
    });
    varsYoY.sort((a, b) => Math.abs(b.deltaAbs) - Math.abs(a.deltaAbs));

    return {
      mes: m, ventaNeta, utilBruta, uafir, uaii, ventaPrev,
      pctBruta: ventaNeta > 0 ? (utilBruta / ventaNeta) * 100 : null,
      pctUafir: ventaNeta > 0 ? (uafir / ventaNeta) * 100 : null,
      deltaVenta: ventaPrev > 0 ? ((ventaNeta - ventaPrev) / ventaPrev) * 100 : null,
      varsMoM: varsMoM.slice(0, 5),
      varsYoY: varsYoY.slice(0, 5),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byCuenta, byCuentaPrev, mesDrillDown]);

  if (loading) return <AppleLoader label="Cargando estado de resultados…" />;
  if (rows.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: theme.textMuted }}>
        <Calculator style={{ width: 48, height: 48, margin: '0 auto 16px', color: theme.textSubtle, strokeWidth: 1.2 }} />
        <div style={{ ...typo(TYPO.h2), color: theme.text, marginBottom: 8 }}>Estado de resultados</div>
        <div style={{ ...typo(TYPO.body), color: theme.textMuted }}>No hay datos para {anio}. Sube los cierres en /uploads.html.</div>
      </div>
    );
  }

  // ═══ RENDER ═══
  return (
    <div style={{ maxWidth: 1240, margin: '0 auto', padding: '32px 24px 60px' }}>
      {/* ─── Top bar: breadcrumb + segment año + PDF ─── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 24,
      }} className="edr-no-print">
        <div style={{ ...typo(TYPO.caption), color: theme.textMuted }}>
          General · <span style={{ color: theme.text, fontWeight: 500 }}>Estado de resultados</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {aniosDisponibles.length > 1 && (
            <AppleSegment
              options={aniosDisponibles.map((y) => ({ value: y, label: String(y) }))}
              value={anio} onChange={setAnio}
            />
          )}
          <button onClick={() => window.print()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 999,
              background: 'transparent', border: `1px solid ${theme.border}`,
              color: theme.text, ...typo(TYPO.eyebrow), fontFamily: TYPO.fontText,
              cursor: 'pointer', transition: 'background 200ms cubic-bezier(0.32, 0.72, 0, 1)',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = theme.surfaceHover}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            <Printer style={{ width: 13, height: 13, strokeWidth: 2 }} /> Exportar PDF
          </button>
        </div>
      </div>

      {/* ─── Header ─── */}
      <div style={{ marginBottom: 20 }}>
        <AppleH1>Estado de resultados.</AppleH1>
        <p style={{
          ...typo(TYPO.body), color: theme.textMuted,
          margin: '8px 0 0', fontFamily: TYPO.fontText,
        }}>
          REVKO Technology · {anio === new Date().getFullYear() ? 'YTD' : `Enero – ${MESES_LBL[mesMax - 1]}`} {anio} · MXN
        </p>
      </div>

      {/* ─── Notice pill (alertas) ─── */}
      {alertasActivas.length > 0 && (
        <NoticePill theme={theme} alertas={alertasActivas}
          onDismiss={(id) => persistirDescartadas(new Set([...alertasDescartadas, id]))}
          onMesClick={(m) => setMesDrillDown(m)} />
      )}

      {/* ═══════════ BENTO — visual summary ═══════════ */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12, marginBottom: 32,
      }}>
        {/* Hero ring UAII (2x2) */}
        <HeroRing theme={theme} kpis={kpis} anio={anio} mesMax={mesMax} />

        <KpiMini theme={theme} label="Venta neta"
          value={fmtCompact(kpis.ventaNeta)}
          delta={kpis.deltaVenta} deltaLabel={`vs ${anio - 1}`}
          series={trendData.map((d) => d.ventaNeta)} mesMax={mesMax} />

        <KpiMini theme={theme} label="Utilidad bruta"
          value={fmtCompact(kpis.utilBruta)}
          delta={kpis.deltaUtil} deltaLabel={`vs ${anio - 1}`}
          series={trendData.map((d) => d.utilBruta)} mesMax={mesMax} />

        <KpiMini theme={theme} label="Margen bruto"
          value={kpis.pctBruta != null ? kpis.pctBruta.toFixed(1) + '%' : '—'}
          delta={kpis.deltaMargen} deltaLabel="pts vs 25" isPts
          series={trendData.map((d) => d.margenBrutoPct)} mesMax={mesMax} />

        <KpiMini theme={theme} label="UAFIR s/ proy."
          value={fmtCompact(kpis.uafir)}
          delta={kpis.deltaUafir} deltaLabel={`vs ${anio - 1}`}
          series={trendData.map((d) => d.uafir)} mesMax={mesMax} />

        {/* Tendencia wide (span 4) */}
        <TrendCard theme={theme} data={trendData} anio={anio} mesMax={mesMax}
          modo={modoTrend} setModo={setModoTrend}
          onMesClick={(m) => setMesDrillDown(m)} />
      </div>

      {/* ═══════════ REPORT — detalle formal ═══════════ */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        padding: '12px 0 12px', borderBottom: `2px solid ${theme.text}`,
        marginBottom: 20,
      }}>
        <div>
          <h2 style={{ ...typo(TYPO.h2), color: theme.text, margin: 0 }}>Detalle por cuenta.</h2>
          <div style={{ ...typo(TYPO.body), color: theme.textMuted, fontFamily: TYPO.fontText, marginTop: 4 }}>
            Cada cuenta con desglose mensual, YTD, comparativo {anio - 1} y variación
          </div>
        </div>
        <div style={{
          textAlign: 'right', ...typo(TYPO.caption),
          color: theme.textMuted, fontFamily: TYPO.fontText,
          fontVariantNumeric: 'tabular-nums',
        }}>
          <div>Última actualización · <span style={{ color: theme.text, fontWeight: 500 }}>{MESES_LBL[mesMax - 1]} {anio}</span></div>
          <div>Preparado por Dashboard Acteck</div>
        </div>
      </div>

      <div style={{
        background: theme.surface, borderRadius: 20,
        boxShadow: theme.shadow, padding: '8px 24px 24px',
        overflowX: 'auto',
        backdropFilter: theme.mode === 'vibrant' ? 'blur(20px) saturate(180%)' : undefined,
        WebkitBackdropFilter: theme.mode === 'vibrant' ? 'blur(20px) saturate(180%)' : undefined,
        border: theme.mode === 'dark' || theme.mode === 'vibrant' ? `1px solid ${theme.border}` : 'none',
      }}>
        <ReportTable theme={theme} grupos={GRUPOS_TABLA}
          byCuenta={byCuenta} byCuentaPrev={byCuentaPrev}
          trendData={trendData} mesMax={mesMax} anio={anio}
          onMesClick={(m) => setMesDrillDown(m)} />
      </div>

      {/* ─── Info general ─── */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        padding: '40px 0 12px', borderBottom: `1px solid ${theme.border}`,
        marginBottom: 16,
      }}>
        <h2 style={{ ...typo(TYPO.h2), color: theme.text, margin: 0, fontSize: 22 }}>Información general.</h2>
      </div>
      <InfoGeneral theme={theme} byCuenta={byCuenta} byCuentaPrev={byCuentaPrev} mesMax={mesMax} anio={anio} />

      <p style={{
        ...typo(TYPO.caption), color: theme.textSubtle,
        textAlign: 'center', marginTop: 32, fontFamily: TYPO.fontText,
      }}>
        Cifras en MXN. Fuente: <code style={{
          background: theme.surfaceHover, padding: '2px 6px', borderRadius: 4,
          fontSize: 11, fontFamily: 'ui-monospace, monospace',
        }}>estados_resultados</code> · alimentada desde /uploads.html
      </p>

      {/* Modal drill-down */}
      {fichaMes && (
        <FichaMesModal theme={theme} ficha={fichaMes} anio={anio} anioPrev={anio - 1}
          onClose={() => setMesDrillDown(null)} />
      )}

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

// ═══════════════════════════════════════════════════════════════════
// Helpers de estilo
// ═══════════════════════════════════════════════════════════════════
function typo(t) {
  return {
    fontFamily: t === TYPO.body || t === TYPO.sub || t === TYPO.eyebrow || t === TYPO.label || t === TYPO.caption
      ? TYPO.fontText : TYPO.fontDisplay,
    fontSize: t.fs, fontWeight: t.w, letterSpacing: t.ls, lineHeight: t.lh || 1.4,
  };
}

const dotColorFrom = (theme, key) => {
  const map = {
    green: theme.green, red: theme.red, orange: theme.orange,
    pink: theme.pink, purple: theme.purple, accent: theme.accent,
  };
  return map[key] || theme.textMuted;
};

// ═══════════════════════════════════════════════════════════════════
// HERO RING — card 2x2 con ring gradient tipo Fitness
// ═══════════════════════════════════════════════════════════════════
function HeroRing({ theme, kpis, anio, mesMax }) {
  // Ring % = margen UAII s/ venta (cap 30% para visualizar)
  const marginUaii = kpis.pctUaii;
  const ringPct = marginUaii != null ? Math.min(Math.max(marginUaii / 30, 0), 1) : 0;
  const dashArray = ringPct * 264; // circunferencia r=42 → 2πr ≈ 264

  return (
    <div style={{
      gridColumn: 'span 2', gridRow: 'span 2',
      background: theme.surface,
      backdropFilter: theme.mode === 'vibrant' ? 'blur(20px) saturate(180%)' : undefined,
      WebkitBackdropFilter: theme.mode === 'vibrant' ? 'blur(20px) saturate(180%)' : undefined,
      border: theme.mode === 'dark' || theme.mode === 'vibrant' ? `1px solid ${theme.border}` : 'none',
      borderRadius: 22, boxShadow: theme.shadow, padding: 32,
      display: 'flex', alignItems: 'center', gap: 28,
    }}>
      <svg viewBox="0 0 100 100" style={{ width: 200, height: 200, flexShrink: 0 }}>
        <circle cx="50" cy="50" r="42" fill="none" stroke={theme.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} strokeWidth="10" />
        <circle cx="50" cy="50" r="42" fill="none" stroke="url(#heroRingGrad)" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${dashArray} 264`} transform="rotate(-90 50 50)" />
        <defs>
          <linearGradient id="heroRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={theme.orange} />
            <stop offset="100%" stopColor={theme.pink} />
          </linearGradient>
        </defs>
        <text x="50" y="46" textAnchor="middle" fontSize="9" fill={theme.textMuted}
          fontWeight="500" fontFamily={TYPO.fontText}>margen UAII</text>
        <text x="50" y="60" textAnchor="middle" fontSize="16" fontWeight="700" fill={theme.text}
          fontFamily={TYPO.fontDisplay} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {marginUaii != null ? marginUaii.toFixed(1) + '%' : '—'}
        </text>
        <text x="50" y="72" textAnchor="middle" fontSize="7" fill={theme.textSubtle}
          fontFamily={TYPO.fontText}>s/ venta neta</text>
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...typo(TYPO.eyebrow), color: theme.textMuted, marginBottom: 10 }}>
          UAII acumulada · {anio}
        </div>
        <div style={{
          ...typo({ fs: 64, w: 600, ls: '-0.045em', lh: 1 }),
          fontFamily: TYPO.fontDisplay,
          color: theme.text,
          fontVariantNumeric: 'tabular-nums',
          marginBottom: 12,
        }}>{fmtCompact(kpis.uaii)}</div>
        <DeltaLine theme={theme} pct={kpis.deltaUaii} label={`vs ${anio - 1}`} big />
        <div style={{
          ...typo(TYPO.caption), color: theme.textMuted, fontFamily: TYPO.fontText,
          marginTop: 16, paddingTop: 16, borderTop: `1px solid ${theme.divider}`,
        }}>
          Promedio mensual · <span style={{ color: theme.text, fontWeight: 500 }}>
            {fmtCompact(mesMax > 0 ? kpis.uaii / mesMax : 0)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// KPI MINI — card chica con sparkline
// ═══════════════════════════════════════════════════════════════════
function KpiMini({ theme, label, value, delta, deltaLabel, series, mesMax, isPts }) {
  return (
    <div style={{
      background: theme.surface,
      backdropFilter: theme.mode === 'vibrant' ? 'blur(20px) saturate(180%)' : undefined,
      WebkitBackdropFilter: theme.mode === 'vibrant' ? 'blur(20px) saturate(180%)' : undefined,
      border: theme.mode === 'dark' || theme.mode === 'vibrant' ? `1px solid ${theme.border}` : 'none',
      borderRadius: 20, boxShadow: theme.shadow, padding: 20,
    }}>
      <div style={{
        ...typo({ fs: 11, w: 600, ls: '0.06em' }),
        fontFamily: TYPO.fontText,
        color: theme.textMuted, textTransform: 'uppercase',
        marginBottom: 10,
      }}>{label}</div>
      <div style={{
        ...typo({ fs: 26, w: 600, ls: '-0.02em', lh: 1 }),
        fontFamily: TYPO.fontDisplay,
        color: theme.text,
        fontVariantNumeric: 'tabular-nums',
        marginBottom: 6,
      }}>{value}</div>
      <DeltaLine theme={theme} pct={delta} label={deltaLabel} isPts={isPts} />
      <div style={{ marginTop: 10 }}>
        <Sparkline theme={theme} series={series} mesMax={mesMax}
          color={delta != null && delta < 0 ? theme.red : theme.text} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SPARKLINE
// ═══════════════════════════════════════════════════════════════════
function Sparkline({ theme, series, mesMax, color, height = 24, width = 100 }) {
  const points = (series || []).slice(0, mesMax).filter((v) => v != null && !isNaN(v));
  if (points.length < 2) return <div style={{ height }} />;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const poly = points.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block', width: '100%', height }}>
      <polyline points={poly} fill="none" stroke={color || theme.text}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DELTA LINE — "↑ 21.8% vs 2025"
// ═══════════════════════════════════════════════════════════════════
function DeltaLine({ theme, pct, label, big, isPts }) {
  if (pct == null || !isFinite(pct)) return <div style={{ ...typo(TYPO.caption), color: theme.textMuted }}>—</div>;
  const isPos = pct >= 0;
  const col = isPos ? theme.green : theme.red;
  return (
    <div style={{
      ...typo(big ? { fs: 15, w: 500, ls: 0 } : { fs: 11.5, w: 500, ls: 0 }),
      fontFamily: TYPO.fontText,
      color: col,
      fontVariantNumeric: 'tabular-nums',
    }}>
      {isPos ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}{isPts ? ' pts' : '%'}
      {label && <span style={{ color: theme.textMuted, fontWeight: 400, marginLeft: 6 }}>{label}</span>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// NOTICE PILL — alertas discretas estilo Apple
// ═══════════════════════════════════════════════════════════════════
function NoticePill({ theme, alertas, onDismiss, onMesClick }) {
  const [open, setOpen] = useState(false);
  const primaria = alertas[0];
  const rest = alertas.length - 1;
  return (
    <div className="edr-no-print" style={{ marginBottom: 24 }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        background: theme.mode === 'dark' ? 'rgba(255,149,0,0.14)' : 'rgba(245,99,0,0.08)',
        color: theme.mode === 'dark' ? theme.orange : '#B25000',
        padding: '9px 16px', borderRadius: 999,
        ...typo(TYPO.eyebrow), fontFamily: TYPO.fontText,
        cursor: 'pointer',
      }} onClick={() => setOpen(!open)}>
        <span style={{
          width: 6, height: 6, borderRadius: 999,
          background: theme.orange, flexShrink: 0,
        }} />
        <span>
          {primaria.mensaje}
          {rest > 0 && <span style={{ opacity: 0.65, marginLeft: 8 }}>· {rest} más</span>}
        </span>
        <ChevronRight style={{
          width: 12, height: 12,
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 240ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        }} />
      </div>
      {open && (
        <div style={{
          background: theme.surface, borderRadius: 14,
          border: `1px solid ${theme.border}`,
          marginTop: 8, padding: 12,
          boxShadow: theme.shadow,
          backdropFilter: theme.mode === 'vibrant' ? 'blur(20px) saturate(180%)' : undefined,
        }}>
          {alertas.map((a) => (
            <div key={a.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 8,
              ...typo(TYPO.caption), fontFamily: TYPO.fontText, color: theme.text,
            }}>
              <span style={{
                ...typo({ fs: 10, w: 700, ls: '0.06em' }),
                background: a.type === 'yoy' ? theme.purple + '20' : theme.orange + '20',
                color: a.type === 'yoy' ? theme.purple : theme.orange,
                padding: '2px 7px', borderRadius: 999,
                textTransform: 'uppercase',
              }}>{a.type}</span>
              <span style={{ flex: 1 }}>{a.mensaje}</span>
              <button onClick={() => onMesClick(a.mes)}
                style={{
                  background: 'transparent', border: 'none', ...typo(TYPO.caption),
                  color: theme.accent, cursor: 'pointer', fontFamily: TYPO.fontText, padding: 4,
                }}>Ver mes</button>
              <button onClick={() => onDismiss(a.id)}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: theme.textMuted, padding: 2, lineHeight: 0,
                }}><X style={{ width: 12, height: 12 }} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TREND CARD — gráfica wide con área gradient + comparativo dashed
// ═══════════════════════════════════════════════════════════════════
function TrendCard({ theme, data, anio, mesMax, modo, setModo, onMesClick }) {
  const config = {
    venta:  { key: 'ventaNeta',  keyPrev: 'ventaNetaPrev', label: 'Venta neta', fmt: fmtCompact },
    uafir:  { key: 'uafir',      keyPrev: 'uafirPrev',     label: 'UAFIR',      fmt: fmtCompact },
    margen: { key: 'margenBrutoPct', keyPrev: null,        label: 'Margen bruto', fmt: (v) => v != null ? v.toFixed(1) + '%' : '—' },
  }[modo];

  const seriesA = data.map((d) => d[config.key]);
  const seriesB = config.keyPrev ? data.map((d) => d[config.keyPrev]) : null;
  const allVals = [...seriesA, ...(seriesB || [])].filter((v) => v != null && !isNaN(v));
  if (allVals.length === 0) return null;

  const min = Math.min(...allVals, 0);
  const max = Math.max(...allVals);
  const range = (max - min) || 1;

  const W = 900, H = 200;
  const padL = 40, padR = 40, padT = 30, padB = 40;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const stepX = chartW / 11; // 12 meses

  const scaleY = (v) => padT + chartH - ((v - min) / range) * chartH;
  const scaleX = (i) => padL + i * stepX;

  const pointsA = seriesA.map((v, i) => v != null ? { x: scaleX(i), y: scaleY(v), i, v } : null).filter(Boolean);
  const pointsB = seriesB ? seriesB.map((v, i) => v != null ? { x: scaleX(i), y: scaleY(v), i, v } : null).filter(Boolean) : [];

  const linePathA = pointsA.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPathA = pointsA.length ?
    `${linePathA} L ${pointsA[pointsA.length - 1].x} ${padT + chartH} L ${pointsA[0].x} ${padT + chartH} Z` : '';
  const linePathB = pointsB.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  const promedio = allVals.reduce((a, b) => a + b, 0) / allVals.length;

  return (
    <div style={{
      gridColumn: 'span 4',
      background: theme.surface,
      backdropFilter: theme.mode === 'vibrant' ? 'blur(20px) saturate(180%)' : undefined,
      WebkitBackdropFilter: theme.mode === 'vibrant' ? 'blur(20px) saturate(180%)' : undefined,
      border: theme.mode === 'dark' || theme.mode === 'vibrant' ? `1px solid ${theme.border}` : 'none',
      borderRadius: 20, boxShadow: theme.shadow, padding: '24px 28px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
        <div>
          <div style={{
            ...typo({ fs: 11, w: 600, ls: '0.06em' }),
            fontFamily: TYPO.fontText,
            color: theme.textMuted, textTransform: 'uppercase',
          }}>Tendencia mensual · {config.label}</div>
          <div style={{
            ...typo({ fs: 22, w: 600, ls: '-0.02em' }),
            fontFamily: TYPO.fontDisplay,
            color: theme.text, marginTop: 4, fontVariantNumeric: 'tabular-nums',
          }}>Promedio {config.fmt(promedio)}/mes</div>
          <div style={{ ...typo(TYPO.caption), color: theme.textMuted, marginTop: 2, fontFamily: TYPO.fontText }}>
            Comparativo con {anio - 1} (línea punteada)
          </div>
        </div>
        <AppleSegment
          options={[
            { value: 'venta', label: 'Venta' },
            { value: 'uafir', label: 'UAFIR' },
            { value: 'margen', label: 'Margen' },
          ]}
          value={modo} onChange={setModo}
        />
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={theme.text} stopOpacity="0.14" />
            <stop offset="100%" stopColor={theme.text} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* baseline */}
        <line x1={padL} y1={scaleY(0)} x2={W - padR} y2={scaleY(0)} stroke={theme.divider} strokeWidth="1" />

        {/* Serie prev (dashed) */}
        {pointsB.length > 1 && (
          <>
            <path d={linePathB} fill="none" stroke={theme.textSubtle} strokeWidth="1.5" strokeDasharray="4 3" />
            {pointsB.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="3" fill={theme.textSubtle} />
            ))}
          </>
        )}

        {/* Serie actual (solid + area) */}
        {areaPathA && <path d={areaPathA} fill="url(#trendArea)" />}
        {linePathA && <path d={linePathA} fill="none" stroke={theme.text} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
        {pointsA.map((p) => (
          <g key={p.i}>
            <circle cx={p.x} cy={p.y} r="5" fill={theme.text}
              style={{ cursor: 'pointer' }}
              onClick={() => onMesClick && onMesClick(p.i + 1)} />
            <text x={p.x} y={p.y - 12} textAnchor="middle"
              fontSize="11" fontWeight="600" fill={theme.text}
              fontFamily={TYPO.fontDisplay}
              style={{ fontVariantNumeric: 'tabular-nums' }}>
              {config.fmt(p.v)}
            </text>
          </g>
        ))}

        {/* X labels */}
        {MESES_LBL.map((m, i) => (
          <text key={m} x={scaleX(i)} y={H - 12} textAnchor="middle"
            fontSize="11" fill={i < mesMax ? theme.textMuted : theme.textSubtle}
            fontFamily={TYPO.fontText}>{m}</text>
        ))}
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// REPORT TABLE — tabla formal con grupos, subtotales, sparklines
// ═══════════════════════════════════════════════════════════════════
function ReportTable({ theme, grupos, byCuenta, byCuentaPrev, trendData, mesMax, anio, onMesClick }) {
  const cellR = {
    padding: '10px 10px', textAlign: 'right',
    fontVariantNumeric: 'tabular-nums', ...typo({ fs: 13, w: 400, ls: 0 }),
    fontFamily: TYPO.fontText, color: theme.text,
    borderBottom: `1px solid ${theme.divider}`,
  };
  const cellL = { ...cellR, textAlign: 'left', fontVariantNumeric: 'normal' };
  const headR = {
    padding: '14px 10px 10px', textAlign: 'right',
    ...typo({ fs: 10.5, w: 700, ls: '0.08em' }),
    fontFamily: TYPO.fontText,
    color: theme.textMuted, textTransform: 'uppercase',
    borderBottom: `1.5px solid ${theme.text}`,
    background: theme.surface,
    position: 'sticky', top: 0, zIndex: 2,
  };
  const headL = { ...headR, textAlign: 'left' };

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 940 }}>
      <thead>
        <tr>
          <th style={headL}>Cuenta</th>
          <th style={headR}>Ene</th>
          <th style={headR}>Feb</th>
          <th style={headR}>Mar</th>
          <th style={headR}>Abr</th>
          <th style={headR}>May</th>
          <th style={headR}>Jun</th>
          <th style={headR}>Jul</th>
          <th style={headR}>Ago</th>
          <th style={headR}>Sep</th>
          <th style={headR}>Oct</th>
          <th style={headR}>Nov</th>
          <th style={headR}>Dic</th>
          <th style={headR}>YTD {anio}</th>
          <th style={headR}>YTD {anio - 1}</th>
          <th style={headR}>Δ %</th>
          <th style={headR}>Tend.</th>
        </tr>
      </thead>
      <tbody>
        {grupos.map((g) => {
          const cuentas = g.cuentas
            .map((slug) => byCuenta.get(slug))
            .filter(Boolean)
            .sort((a, b) => a.orden - b.orden);
          if (g.extra) {
            const e = byCuenta.get(g.extra);
            if (e) cuentas.push(e);
          }
          const sub = g.subtotal ? byCuenta.get(g.subtotal) : null;
          const subTotal = sub ? sumYTD(sub, mesMax) : null;
          const subTotalPrev = sub ? sumYTD(byCuentaPrev.get(g.subtotal), mesMax) : null;
          const deltaSub = subTotal != null && subTotalPrev > 0 ? ((subTotal - subTotalPrev) / subTotalPrev) * 100 : null;

          return (
            <React.Fragment key={g.id}>
              <tr>
                <td colSpan={17} style={{
                  background: theme.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  padding: '14px 10px',
                  ...typo({ fs: 10.5, w: 700, ls: '0.09em' }),
                  fontFamily: TYPO.fontText, color: theme.textMuted, textTransform: 'uppercase',
                }}>
                  <span style={{
                    display: 'inline-block', width: 6, height: 6,
                    borderRadius: 999, background: dotColorFrom(theme, g.dotKey),
                    marginRight: 10, verticalAlign: 'middle',
                  }} />
                  {g.label}
                </td>
              </tr>
              {cuentas.map((c) => (
                <ReportRow key={c.cuenta_norm} theme={theme}
                  cuenta={c} prev={byCuentaPrev.get(c.cuenta_norm)}
                  mesMax={mesMax} formato={g.formato}
                  onMesClick={onMesClick} />
              ))}
              {sub && (
                <tr>
                  <td style={{
                    ...cellL, ...typo({ fs: 14, w: 600, ls: '-0.01em' }),
                    fontFamily: TYPO.fontDisplay,
                    padding: '14px 10px',
                    borderTop: `1.5px solid ${theme.text}`,
                    borderBottom: `2px solid ${theme.text}`,
                  }}>{sub.cuenta}</td>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => (
                    <td key={m} style={{
                      ...cellR, ...typo({ fs: 13, w: 600, ls: 0 }),
                      fontFamily: TYPO.fontDisplay,
                      padding: '14px 10px',
                      borderTop: `1.5px solid ${theme.text}`, borderBottom: `2px solid ${theme.text}`,
                    }}>{sub.valores[m] != null ? fmtCompact(sub.valores[m]) : '—'}</td>
                  ))}
                  <td style={{
                    ...cellR, ...typo({ fs: 14, w: 600, ls: '-0.01em' }),
                    fontFamily: TYPO.fontDisplay,
                    padding: '14px 10px',
                    borderTop: `1.5px solid ${theme.text}`, borderBottom: `2px solid ${theme.text}`,
                  }}>{fmtCompact(subTotal)}</td>
                  <td style={{
                    ...cellR, color: theme.textMuted,
                    padding: '14px 10px',
                    borderTop: `1.5px solid ${theme.text}`, borderBottom: `2px solid ${theme.text}`,
                  }}>{fmtCompact(subTotalPrev)}</td>
                  <td style={{
                    ...cellR, color: deltaSub == null ? theme.textMuted : deltaSub >= 0 ? theme.green : theme.red,
                    fontWeight: 500,
                    padding: '14px 10px',
                    borderTop: `1.5px solid ${theme.text}`, borderBottom: `2px solid ${theme.text}`,
                  }}>{deltaSub == null ? '—' : fmtPctDelta(deltaSub)}</td>
                  <td style={{
                    ...cellR, padding: '10px 10px',
                    borderTop: `1.5px solid ${theme.text}`, borderBottom: `2px solid ${theme.text}`,
                  }}>
                    <div style={{ width: 56 }}>
                      <Sparkline theme={theme} series={trendData.map((d) => d[g.subtotal === 'venta_neta' ? 'ventaNeta' : g.subtotal === 'utilidad_bruta' ? 'utilBruta' : 'uafir'])}
                        mesMax={mesMax} color={theme.text} height={18} width={56} />
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

function ReportRow({ theme, cuenta, prev, mesMax, formato, onMesClick }) {
  const isSubcuenta = esSubcuenta(cuenta.cuenta);
  const ytd = sumYTD(cuenta, mesMax);
  const ytdPrev = sumYTD(prev, mesMax);
  const delta = ytdPrev > 0 ? ((ytd - ytdPrev) / ytdPrev) * 100 : null;

  const fmtCell = (v) => {
    if (v == null) return '—';
    if (formato === 'pct') return fmtPct(v * 100);
    return fmtCompact(v);
  };

  // Sparkline por fila
  const series = [1,2,3,4,5,6,7,8,9,10,11,12].map((m) => cuenta.valores?.[m] ?? null);

  const cellR = {
    padding: '9px 10px', textAlign: 'right',
    fontVariantNumeric: 'tabular-nums', ...typo({ fs: 13, w: 400 }),
    fontFamily: TYPO.fontText, color: theme.text,
    borderBottom: `1px solid ${theme.divider}`,
    whiteSpace: 'nowrap',
  };
  const cellL = { ...cellR, textAlign: 'left', fontVariantNumeric: 'normal', paddingLeft: isSubcuenta ? 26 : 10 };

  const [hover, setHover] = useState(false);
  return (
    <tr
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ background: hover ? (theme.mode === 'dark' ? 'rgba(10,132,255,0.06)' : 'rgba(0,113,227,0.03)') : 'transparent' }}
    >
      <td style={{ ...cellL, color: isSubcuenta ? theme.textSubtle : theme.text,
        fontStyle: isSubcuenta ? 'italic' : 'normal' }}
        title={cuenta.notaGeneral || cuenta.cuenta}>
        {cuenta.cuenta}
      </td>
      {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => {
        const v = cuenta.valores?.[m];
        const isEmpty = v == null;
        return (
          <td key={m}
            onClick={() => v != null && onMesClick && onMesClick(m)}
            style={{
              ...cellR,
              color: isEmpty ? theme.textSubtle : v < 0 ? theme.red : theme.text,
              cursor: v != null ? 'pointer' : 'default',
            }}
            title={cuenta.notas?.[m] || ''}>
            {fmtCell(v)}
          </td>
        );
      })}
      <td style={{ ...cellR, fontWeight: 500 }}>{formato === 'pct' ? '—' : fmtCompact(ytd)}</td>
      <td style={{ ...cellR, color: theme.textMuted }}>{fmtCompact(ytdPrev)}</td>
      <td style={{ ...cellR, color: delta == null ? theme.textMuted : delta >= 0 ? theme.green : theme.red, fontWeight: 500 }}>
        {delta == null ? '—' : fmtPctDelta(delta)}
      </td>
      <td style={{ ...cellR, padding: '6px 10px' }}>
        <div style={{ width: 56 }}>
          <Sparkline theme={theme} series={series} mesMax={mesMax}
            color={delta == null ? theme.textMuted : delta >= 0 ? theme.green : theme.red}
            height={18} width={56} />
        </div>
      </td>
    </tr>
  );
}

// ═══════════════════════════════════════════════════════════════════
// INFO GENERAL — mini cards al pie
// ═══════════════════════════════════════════════════════════════════
function InfoGeneral({ theme, byCuenta, byCuentaPrev, mesMax, anio }) {
  const items = INFO_SLUGS.map((slug) => {
    const c = byCuenta.get(slug);
    if (!c) return null;
    const val = c.valores?.[mesMax] ?? null;
    const valPrev = byCuentaPrev.get(slug)?.valores?.[mesMax] ?? null;
    const delta = valPrev > 0 && val != null ? ((val - valPrev) / valPrev) * 100 : null;
    let formatted = '—';
    if (val != null) {
      if (slug === 't_c_dof' || slug === 'colaboradores') formatted = fmtNumber(val);
      else formatted = fmtCompact(val);
    }
    return {
      slug, label: c.cuenta, valor: formatted, valPrev, delta,
    };
  }).filter(Boolean);

  if (items.length === 0) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      {items.map((it) => (
        <div key={it.slug} style={{
          background: theme.surface,
          backdropFilter: theme.mode === 'vibrant' ? 'blur(20px) saturate(180%)' : undefined,
          WebkitBackdropFilter: theme.mode === 'vibrant' ? 'blur(20px) saturate(180%)' : undefined,
          border: theme.mode === 'dark' || theme.mode === 'vibrant' ? `1px solid ${theme.border}` : 'none',
          borderRadius: 16, boxShadow: theme.shadow, padding: 18,
        }}>
          <div style={{
            ...typo({ fs: 11, w: 600, ls: '0.06em' }),
            fontFamily: TYPO.fontText, color: theme.textMuted,
            textTransform: 'uppercase', marginBottom: 8,
          }}>{it.label}</div>
          <div style={{
            ...typo({ fs: 22, w: 600, ls: '-0.02em' }),
            fontFamily: TYPO.fontDisplay,
            color: theme.text, marginBottom: 4,
            fontVariantNumeric: 'tabular-nums',
          }}>{it.valor}</div>
          <div style={{ ...typo(TYPO.caption), color: theme.textMuted, fontFamily: TYPO.fontText, fontVariantNumeric: 'tabular-nums' }}>
            {anio - 1}: {it.valPrev != null ? (it.slug === 't_c_dof' || it.slug === 'colaboradores' ? fmtNumber(it.valPrev) : fmtCompact(it.valPrev)) : '—'}
            {it.delta != null && (
              <span style={{ color: it.delta >= 0 ? theme.green : theme.red, fontWeight: 500, marginLeft: 6 }}>
                {it.delta >= 0 ? '+' : ''}{it.delta.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FICHA MES MODAL — drill-down side panel
// ═══════════════════════════════════════════════════════════════════
function FichaMesModal({ theme, ficha, anio, anioPrev, onClose }) {
  const { mes, ventaNeta, utilBruta, uafir, uaii, ventaPrev, pctBruta, pctUafir, deltaVenta, varsMoM, varsYoY } = ficha;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', justifyContent: 'flex-end', zIndex: 100,
      backdropFilter: 'blur(6px)',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: theme.bgElevated, width: 500, maxWidth: '95vw', height: '100vh',
        overflowY: 'auto', padding: 32,
        boxShadow: '-12px 0 40px rgba(0,0,0,0.2)',
        color: theme.text,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ ...typo(TYPO.eyebrow), color: theme.textMuted, fontFamily: TYPO.fontText }}>Ficha del mes</div>
            <div style={{ ...typo({ fs: 28, w: 600, ls: '-0.025em' }), fontFamily: TYPO.fontDisplay, color: theme.text, marginTop: 6 }}>
              {MESES_FULL[mes - 1]} {anio}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: theme.textMuted, padding: 6,
          }}><X style={{ width: 20, height: 20 }} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 28 }}>
          <MiniStat theme={theme} label="Venta neta" value={fmtCompact(ventaNeta)}
            sub={ventaPrev > 0 ? `${anioPrev}: ${fmtCompact(ventaPrev)}` : ''} delta={deltaVenta} />
          <MiniStat theme={theme} label="Utilidad bruta" value={fmtCompact(utilBruta)}
            sub={pctBruta != null ? `Margen ${pctBruta.toFixed(1)}%` : ''} />
          <MiniStat theme={theme} label="UAFIR s/ proy" value={fmtCompact(uafir)}
            sub={pctUafir != null ? `${pctUafir.toFixed(1)}% s/ venta` : ''} />
          <MiniStat theme={theme} label="UAII" value={fmtCompact(uaii)} />
        </div>

        {varsMoM.length > 0 && (
          <FichaSection theme={theme} title={`Top variaciones vs ${MESES_FULL[mes - 2] || 'mes anterior'}`}>
            {varsMoM.map((v, i) => <VarRow key={i} theme={theme} v={v} />)}
          </FichaSection>
        )}
        {varsYoY.length > 0 && (
          <FichaSection theme={theme} title={`Top variaciones vs ${MESES_FULL[mes - 1]} ${anioPrev}`}>
            {varsYoY.map((v, i) => <VarRow key={i} theme={theme} v={v} />)}
          </FichaSection>
        )}
      </div>
    </div>
  );
}

function MiniStat({ theme, label, value, sub, delta }) {
  return (
    <div style={{
      background: theme.surface, borderRadius: 14, padding: 14,
      border: theme.mode === 'dark' ? `1px solid ${theme.border}` : 'none',
    }}>
      <div style={{ ...typo(TYPO.label), color: theme.textMuted, fontFamily: TYPO.fontText }}>{label}</div>
      <div style={{
        ...typo({ fs: 22, w: 600, ls: '-0.02em' }), fontFamily: TYPO.fontDisplay,
        color: theme.text, margin: '6px 0 4px', fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
      {delta != null && <DeltaLine theme={theme} pct={delta} label="YoY" />}
      {sub && <div style={{ ...typo(TYPO.caption), color: theme.textMuted, fontFamily: TYPO.fontText, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function FichaSection({ theme, title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        ...typo({ fs: 11, w: 700, ls: '0.06em' }), fontFamily: TYPO.fontText,
        color: theme.textMuted, textTransform: 'uppercase', marginBottom: 10,
      }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  );
}

function VarRow({ theme, v }) {
  const subio = v.deltaAbs > 0;
  const col = subio ? theme.red : theme.green;
  return (
    <div style={{ padding: '10px 12px', background: theme.surface, borderRadius: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span style={{ ...typo(TYPO.body), color: theme.text, fontFamily: TYPO.fontText, flex: 1 }}>{v.cuenta}</span>
        <span style={{ ...typo(TYPO.caption), color: col, fontFamily: TYPO.fontText, fontWeight: 500, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {subio ? '↑' : '↓'} {fmtCompact(Math.abs(v.deltaAbs))} ({fmtPctDelta(v.deltaPct)})
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', ...typo(TYPO.caption), color: theme.textSubtle, fontFamily: TYPO.fontText, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
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
