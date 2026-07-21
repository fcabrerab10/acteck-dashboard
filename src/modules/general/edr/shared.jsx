// Shared helpers para los 3 layouts de Estado de Resultados.
// Formatters, constantes, GRUPOS_TABLA, hook de datos, componentes comunes.
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { TYPO } from '../../../lib/themeTokens';
import { X } from 'lucide-react';

// ─── Constantes ───
export const MESES_LBL  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
export const MESES_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export const GRUPOS_TABLA = [
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

export const INFO_SLUGS = ['t_c_dof','colaboradores','vta_colaborador','uti_colaborador','interes_ing_jcr_mxn'];

// ─── Formatters ───
export const fmtCompact = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1e6) return sign + '$' + (a / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return sign + '$' + (a / 1e3).toFixed(0) + 'K';
  return sign + '$' + Math.round(a);
};
export const fmtMoney = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(n);
  return (n < 0 ? '-' : '') + '$' + a.toLocaleString('es-MX', { maximumFractionDigits: 0 });
};
export const fmtPct = (n) => n == null || isNaN(n) ? '—' : n.toFixed(1) + '%';
export const fmtPctDelta = (n) => n == null || isNaN(n) ? '—' : (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
export const fmtNumber = (n) => n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('es-MX');

// ─── Helper de estilo tipográfico ───
export function typo(t) {
  return {
    fontFamily: t === TYPO.body || t === TYPO.bodyLg || t === TYPO.sub || t === TYPO.eyebrow || t === TYPO.label || t === TYPO.caption
      ? TYPO.fontText : TYPO.fontDisplay,
    fontSize: t.fs, fontWeight: t.w, letterSpacing: t.ls, lineHeight: t.lh || 1.4,
  };
}

export const dotColorFrom = (theme, key) => {
  const map = {
    green: theme.green, red: theme.red, orange: theme.orange,
    pink: theme.pink, purple: theme.purple, accent: theme.accent,
  };
  return map[key] || theme.textMuted;
};

// ─── Hook: carga datos del EdR desde Supabase ───
export function useEdRData(anio) {
  const [rows, setRows] = useState([]);
  const [rowsPrev, setRowsPrev] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aniosDisponibles, setAniosDisponibles] = useState([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('estados_resultados').select('anio').order('anio', { ascending: false });
      const unique = Array.from(new Set((data || []).map((r) => r.anio))).sort((a, b) => b - a);
      setAniosDisponibles(unique);
    })();
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

  return {
    rows, loading, aniosDisponibles,
    byCuenta, byCuentaPrev, mesMax,
    totalCuenta, kpis, trendData,
  };
}

// ─── Helper para calcular alertas ───
export function computeAlertas(byCuenta, byCuentaPrev, mesMax, anio) {
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
}

// ─── Helper para computar ficha del mes drilldown ───
export function computeFichaMes(byCuenta, byCuentaPrev, mesDrillDown) {
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
}

export function sumYTD(cuenta, mesMax) {
  if (!cuenta || !cuenta.valores) return 0;
  let s = 0;
  for (let i = 1; i <= mesMax; i++) s += Number(cuenta.valores[i]) || 0;
  return s;
}

export const esSubcuenta = (cuenta) => /^\s*\*/.test(cuenta || '');

// ═══════════════════════════════════════════════════════════════════
// COMPONENTES COMPARTIDOS
// ═══════════════════════════════════════════════════════════════════

// ─── DeltaLine · ↑ 21.8% vs 2025 ───
export function DeltaLine({ theme, pct, label, size = 'sm', isPts }) {
  if (pct == null || !isFinite(pct)) return <span style={{ ...typo(TYPO.caption), color: theme.textMuted }}>—</span>;
  const isPos = pct >= 0;
  const col = isPos ? theme.green : theme.red;
  const t = size === 'lg' ? { fs: 19, w: 500, ls: 0 } : size === 'md' ? { fs: 15, w: 500, ls: 0 } : { fs: 12, w: 500, ls: 0 };
  return (
    <span style={{
      ...typo(t), fontFamily: TYPO.fontText,
      color: col, fontVariantNumeric: 'tabular-nums',
    }}>
      {isPos ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}{isPts ? ' pts' : '%'}
      {label && <span style={{ color: theme.textMuted, fontWeight: 400, marginLeft: 6 }}>{label}</span>}
    </span>
  );
}

// ─── Sparkline SVG interactivo ───
export function Sparkline({ theme, series, mesMax, color, height = 24, width = 100, interactive = false, fmt = fmtCompact }) {
  const [hoverI, setHoverI] = useState(null);
  const points = (series || []).slice(0, mesMax).filter((v) => v != null && !isNaN(v));
  if (points.length < 2) return <div style={{ height }} />;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const coords = points.map((v, i) => ({
    x: i * step,
    y: height - ((v - min) / range) * (height - 4) - 2,
    v,
  }));
  const poly = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    const i = Math.round(x / step);
    setHoverI(i >= 0 && i < coords.length ? i : null);
  };

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"
      style={{ display: 'block', width: '100%', height, cursor: interactive ? 'crosshair' : 'default' }}
      onMouseMove={interactive ? handleMove : undefined}
      onMouseLeave={interactive ? () => setHoverI(null) : undefined}>
      <polyline points={poly} fill="none" stroke={color || theme.text}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {interactive && hoverI != null && coords[hoverI] && (
        <>
          <circle cx={coords[hoverI].x} cy={coords[hoverI].y} r="2.5" fill={color || theme.text} />
          <title>{`${MESES_LBL[hoverI]}: ${fmt(coords[hoverI].v)}`}</title>
        </>
      )}
    </svg>
  );
}

// ─── NoticePill · alerta discreta estilo Apple ───
export function NoticePill({ theme, alertas, onDismiss, onMesClick }) {
  const [open, setOpen] = useState(false);
  const primaria = alertas[0];
  const rest = alertas.length - 1;
  const bg = theme.mode === 'dark'
    ? (theme.accentBg || 'rgba(50,200,255,0.10)')
    : (theme.eyebrowSoft || 'rgba(196,82,13,0.08)');
  const col = theme.mode === 'dark' ? theme.accent : (theme.eyebrowColor || theme.orange);
  return (
    <div className="edr-no-print" style={{ marginBottom: 24 }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        background: bg, color: col,
        padding: '9px 16px', borderRadius: 999,
        ...typo(TYPO.eyebrow), fontFamily: TYPO.fontText,
        cursor: 'pointer',
      }} onClick={() => setOpen(!open)}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: col, flexShrink: 0 }} />
        <span>
          {primaria.mensaje}
          {rest > 0 && <span style={{ opacity: 0.65, marginLeft: 8 }}>· {rest} más</span>}
        </span>
      </div>
      {open && (
        <div style={{
          background: theme.surface, borderRadius: 14,
          border: `1px solid ${theme.border}`, marginTop: 8, padding: 12,
        }}>
          {alertas.map((a) => (
            <div key={a.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 8,
              ...typo(TYPO.caption), fontFamily: TYPO.fontText, color: theme.text,
            }}>
              <span style={{
                ...typo({ fs: 10, w: 700, ls: '0.06em' }),
                background: a.type === 'yoy' ? theme.accentSoft || 'rgba(0,102,204,0.10)' : bg,
                color: a.type === 'yoy' ? theme.accent : col,
                padding: '2px 7px', borderRadius: 999, textTransform: 'uppercase',
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

// ─── FichaMesModal · drill-down side panel ───
export function FichaMesModal({ theme, ficha, anio, anioPrev, onClose }) {
  const { mes, ventaNeta, utilBruta, uafir, uaii, ventaPrev, pctBruta, pctUafir, deltaVenta, varsMoM, varsYoY } = ficha;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', justifyContent: 'flex-end', zIndex: 100,
      backdropFilter: 'blur(6px)',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: theme.bg, width: 500, maxWidth: '95vw', height: '100vh',
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

// ─── ReportTable · tabla formal compartida por Midnight/Marfil ───
// Claro usa su propia tabla más limpia (tech-specs style).
export function ReportTable({ theme, grupos, byCuenta, byCuentaPrev, trendData, mesMax, anio, onMesClick }) {
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
  const grpBg = theme.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 940 }}>
      <thead>
        <tr>
          <th style={headL}>Cuenta</th>
          {MESES_LBL.map((m) => <th key={m} style={headR}>{m}</th>)}
          <th style={headR}>YTD {anio}</th>
          <th style={headR}>YTD {anio - 1}</th>
          <th style={headR}>Δ %</th>
          <th style={headR}>Tend.</th>
        </tr>
      </thead>
      <tbody>
        {grupos.map((g) => {
          const cuentas = g.cuentas.map((slug) => byCuenta.get(slug)).filter(Boolean).sort((a, b) => a.orden - b.orden);
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
                  background: grpBg, padding: '14px 10px',
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
                    fontFamily: TYPO.fontDisplay, padding: '14px 10px',
                    borderTop: `1.5px solid ${theme.text}`, borderBottom: `2px solid ${theme.text}`,
                  }}>{sub.cuenta}</td>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => (
                    <td key={m} style={{
                      ...cellR, ...typo({ fs: 13, w: 600, ls: 0 }),
                      fontFamily: TYPO.fontDisplay, padding: '14px 10px',
                      borderTop: `1.5px solid ${theme.text}`, borderBottom: `2px solid ${theme.text}`,
                    }}>{sub.valores[m] != null ? fmtCompact(sub.valores[m]) : '—'}</td>
                  ))}
                  <td style={{
                    ...cellR, ...typo({ fs: 14, w: 600, ls: '-0.01em' }),
                    fontFamily: TYPO.fontDisplay, padding: '14px 10px',
                    borderTop: `1.5px solid ${theme.text}`, borderBottom: `2px solid ${theme.text}`,
                  }}>{fmtCompact(subTotal)}</td>
                  <td style={{
                    ...cellR, color: theme.textMuted, padding: '14px 10px',
                    borderTop: `1.5px solid ${theme.text}`, borderBottom: `2px solid ${theme.text}`,
                  }}>{fmtCompact(subTotalPrev)}</td>
                  <td style={{
                    ...cellR, color: deltaSub == null ? theme.textMuted : deltaSub >= 0 ? theme.green : theme.red,
                    fontWeight: 500, padding: '14px 10px',
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

  const series = [1,2,3,4,5,6,7,8,9,10,11,12].map((m) => cuenta.valores?.[m] ?? null);

  const cellR = {
    padding: '9px 10px', textAlign: 'right',
    fontVariantNumeric: 'tabular-nums', ...typo({ fs: 13, w: 400 }),
    fontFamily: TYPO.fontText, color: theme.text,
    borderBottom: `1px solid ${theme.divider}`, whiteSpace: 'nowrap',
  };
  const cellL = { ...cellR, textAlign: 'left', fontVariantNumeric: 'normal', paddingLeft: isSubcuenta ? 26 : 10 };

  const [hover, setHover] = useState(false);
  const hoverBg = theme.mode === 'dark' ? 'rgba(100,210,255,0.06)' : 'rgba(0,102,204,0.03)';

  return (
    <tr
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ background: hover ? hoverBg : 'transparent' }}
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
