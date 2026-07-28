// MobileEdR — Estado de Resultados mobile-native.
// Reemplaza EstadoResultados desktop cuando mobile === true.
//
// Estructura del mockup aprobado:
//   - Back header · Dirección General
//   - Título "Estado de Resultados" + subtítulo YTD
//   - Year picker chips scroll H
//   - 2×2 KPI tiles (Venta neta YTD, Utilidad bruta, UAFIR, Utilidad neta)
//   - Utilidad final card destacada
//   - Chart mensual Venta vs Utilidad (barras dobles)
//   - Waterfall del mes actual (Venta → Costo → Gastos → Financ = Utilidad)
//   - Grupos colapsables por sección P&L
//
// Usa tokens de useTheme() para respetar los 3 temas (Claro/Midnight/Marfil).

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, TrendingUp, TrendingDown, DollarSign, Percent, Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';

const MES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MES_FULL  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Cuentas clave (mismos slugs que usa EstadoResultados desktop)
const CUENTA = {
  VENTA_NETA:    'venta_neta',
  UT_BRUTA:      'utilidad_bruta',
  UAFIR:         'uafir_sin_proyectos',
  UAFIR_CON:     'uafir_con_proyectos',
  COSTO:         'total_costo_de_venta',
  GASTOS:        'total_gastos',
  FINANCIEROS:   'total_productos_financieros',
  UTILIDAD_FIN:  'uaii_contable_con_proyecctos', // typo del schema real
  UTILIDAD_FIN_ALT: 'uaii_contable_sin_proyectos',
};

// Secciones P&L (subset del desktop, colapsables)
const SECCIONES = [
  { id: 'ingresos', label: 'Ingresos', colorKey: 'green', defaultOpen: true,
    cuentas: ['ventas_y_servicios_a_tasa_general','ventas_y_servicios_a_tasa_0','devol_desctos_o_bonif_sobre_ingresos'],
    subtotal: 'venta_neta' },
  { id: 'costos', label: 'Costos', colorKey: 'red', defaultOpen: true, negativo: true,
    cuentas: ['costo_de_ventas','costo_de_venta_empaque','costo_ecommerce','dev_desc_o_bonificacion_s_compra','destruccion_fiscal_2025'],
    subtotal: 'total_costo_de_venta' },
  { id: 'gastos', label: 'Gastos operativos', colorKey: 'orange', defaultOpen: false, negativo: true,
    cuentas: ['gastos_generales','nomina','distribucion','arrendamiento','viaticos_com','otros_gastos','proyectos'],
    subtotal: 'total_gastos' },
  { id: 'financieros', label: 'Financieros', colorKey: 'pink', defaultOpen: false,
    cuentas: ['gastos_financieros','productos_financieros','utilidad_cambiaria','perdida_cambiaria','intereses_a_cargo_nacional','intereses_a_favor_bancarios_nacional'],
    subtotal: 'total_productos_financieros' },
  { id: 'otros', label: 'Otros ingresos', colorKey: 'accent', defaultOpen: false,
    cuentas: ['otros_ingresos','comision_proyectos'] },
];

const fmtCompact = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(0)}K`;
  return `${sign}$${Math.round(a)}`;
};
const fmtPct = (n) => (n == null || !isFinite(n)) ? '—' : `${n.toFixed(1)}%`;

export default function MobileEdR({ onBack, onNavegar }) {
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [aniosDisp, setAniosDisp] = useState([]);
  const [rows, setRows] = useState([]);
  const [rowsPrev, setRowsPrev] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(
    Object.fromEntries(SECCIONES.map(s => [s.id, s.defaultOpen || false]))
  );

  // Años disponibles
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('estados_resultados').select('anio');
      const setA = new Set((data || []).map(r => Number(r.anio)));
      const arr = Array.from(setA).sort((a, b) => a - b);
      setAniosDisp(arr);
      if (arr.length && !arr.includes(anio)) setAnio(arr[arr.length - 1]);
    })();
  }, []);

  // Data del año + año-1
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [r, rp] = await Promise.all([
        supabase.from('estados_resultados').select('cuenta_norm,mes,valor').eq('anio', anio),
        supabase.from('estados_resultados').select('cuenta_norm,mes,valor').eq('anio', anio - 1),
      ]);
      if (!alive) return;
      setRows(r.data || []);
      setRowsPrev(rp.data || []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [anio]);

  // Helpers de lookup
  const getMes = (rowset, cuenta, mes) => {
    const r = rowset.find(x => x.cuenta_norm === cuenta && Number(x.mes) === mes);
    return r ? Number(r.valor) || 0 : 0;
  };
  const getYTD = (rowset, cuenta) => {
    return rowset.filter(x => x.cuenta_norm === cuenta).reduce((s, x) => s + (Number(x.valor) || 0), 0);
  };
  const getSerieMensual = (rowset, cuenta) => {
    const arr = Array(12).fill(0);
    rowset.forEach(x => {
      if (x.cuenta_norm !== cuenta) return;
      const m = Number(x.mes) - 1;
      if (m >= 0 && m < 12) arr[m] += Number(x.valor) || 0;
    });
    return arr;
  };

  // Último mes con data (venta neta > 0)
  const mesActual = useMemo(() => {
    const serie = getSerieMensual(rows, CUENTA.VENTA_NETA);
    let last = 0;
    for (let i = 0; i < 12; i++) if (Math.abs(serie[i]) > 0) last = i + 1;
    return last || new Date().getMonth() + 1;
  }, [rows]);

  // KPIs
  const ventaYTD = useMemo(() => getYTD(rows, CUENTA.VENTA_NETA), [rows]);
  const utBrutaYTD = useMemo(() => getYTD(rows, CUENTA.UT_BRUTA), [rows]);
  const uafirYTD = useMemo(() => {
    const withProj = getYTD(rows, CUENTA.UAFIR_CON);
    return withProj || getYTD(rows, CUENTA.UAFIR);
  }, [rows]);
  const utFinalYTD = useMemo(() => {
    const con = getYTD(rows, CUENTA.UTILIDAD_FIN);
    return con || getYTD(rows, CUENTA.UTILIDAD_FIN_ALT);
  }, [rows]);

  const ventaYTDPrev = useMemo(() => getYTD(rowsPrev, CUENTA.VENTA_NETA), [rowsPrev]);
  const utFinalYTDPrev = useMemo(() => {
    const con = getYTD(rowsPrev, CUENTA.UTILIDAD_FIN);
    return con || getYTD(rowsPrev, CUENTA.UTILIDAD_FIN_ALT);
  }, [rowsPrev]);

  const deltaVenta = ventaYTDPrev > 0 ? Math.round(((ventaYTD - ventaYTDPrev) / ventaYTDPrev) * 100) : null;
  const margenBruto = ventaYTD > 0 ? (utBrutaYTD / ventaYTD) * 100 : null;
  const margenNeto = ventaYTD > 0 ? (utFinalYTD / ventaYTD) * 100 : null;

  // Series mensuales para chart
  const serieVenta = useMemo(() => getSerieMensual(rows, CUENTA.VENTA_NETA), [rows]);
  const serieUtilidad = useMemo(() => {
    const con = getSerieMensual(rows, CUENTA.UTILIDAD_FIN);
    const sum = con.reduce((s, v) => s + v, 0);
    if (sum !== 0) return con;
    return getSerieMensual(rows, CUENTA.UTILIDAD_FIN_ALT);
  }, [rows]);

  // Waterfall del mes actual
  const wf = useMemo(() => {
    const venta = getMes(rows, CUENTA.VENTA_NETA, mesActual);
    const costo = Math.abs(getMes(rows, CUENTA.COSTO, mesActual));
    const gastos = Math.abs(getMes(rows, CUENTA.GASTOS, mesActual));
    const financ = Math.abs(getMes(rows, CUENTA.FINANCIEROS, mesActual));
    let ut = getMes(rows, CUENTA.UTILIDAD_FIN, mesActual);
    if (ut === 0) ut = getMes(rows, CUENTA.UTILIDAD_FIN_ALT, mesActual);
    return { venta, costo, gastos, financ, ut };
  }, [rows, mesActual]);

  return (
    <div style={{ background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100vh' }}>
      {/* Back */}
      <div style={{ padding: '10px 18px 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onBack}
          style={{ background: 'transparent', border: 'none', padding: '6px 10px', color: theme.accent, fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}
        >
          <ChevronLeft size={16} strokeWidth={2.2} /> Inicio
        </button>
        <span style={{ fontSize: 12.5, color: theme.textMuted, fontWeight: 600 }}>Dirección General</span>
      </div>

      {/* Título */}
      <div style={{ padding: '2px 18px 6px' }}>
        <h1 style={{ margin: 0, fontFamily: TYPO.fontDisplay, fontSize: 30, fontWeight: 700, letterSpacing: '-.03em', color: theme.text }}>Estado de Resultados</h1>
        <div style={{ color: theme.textMuted, fontSize: 12.5, marginTop: 2 }}>
          {MES_FULL[mesActual - 1]} {anio} · YTD acumulado
        </div>
      </div>

      {/* Year picker */}
      <div style={{ padding: '10px 18px 8px', display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }} className="medr-hide">
        {aniosDisp.map(a => (
          <button key={a}
            onClick={() => setAnio(a)}
            style={{
              flex: '0 0 auto', padding: '7px 14px', borderRadius: 999,
              background: anio === a ? theme.text : theme.surface,
              border: `1px solid ${anio === a ? theme.text : theme.border}`,
              color: anio === a ? theme.bg : theme.textMuted,
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: TYPO.fontText,
              transition: 'background 240ms cubic-bezier(.32,.72,0,1), color 240ms',
            }}
          >{a}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: theme.textMuted, fontSize: 13 }}>Cargando…</div>
      ) : !rows.length ? (
        <div style={{ margin: '4px 18px', padding: 24, textAlign: 'center', color: theme.textMuted, fontSize: 13, background: theme.surface, border: `1px dashed ${theme.border}`, borderRadius: 12 }}>
          Sin datos del EdR para {anio}.
        </div>
      ) : (
        <>
          {/* 2×2 KPI tiles */}
          <div style={{ padding: '6px 18px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <KpiTile theme={theme} label="Venta neta YTD"
              value={fmtCompact(ventaYTD)}
              delta={deltaVenta != null ? `${deltaVenta > 0 ? '+' : ''}${deltaVenta}% vs ${anio - 1}` : `${MES_CORTO[mesActual - 1]} ${anio}`}
              positive={deltaVenta != null && deltaVenta >= 0} />
            <KpiTile theme={theme} label="Utilidad bruta"
              value={fmtCompact(utBrutaYTD)}
              delta={margenBruto != null ? `${fmtPct(margenBruto)} margen` : '—'}
              positive={margenBruto != null && margenBruto >= 20} />
            <KpiTile theme={theme} label="UAFIR"
              value={fmtCompact(uafirYTD)}
              delta={ventaYTD > 0 ? `${fmtPct((uafirYTD / ventaYTD) * 100)} vs venta` : '—'}
              positive={uafirYTD > 0} />
            <KpiTile theme={theme} label="Utilidad neta"
              value={fmtCompact(utFinalYTD)}
              delta={margenNeto != null ? `${fmtPct(margenNeto)} margen` : '—'}
              positive={utFinalYTD >= 0} />
          </div>

          {/* Utilidad final card destacada */}
          <div style={{
            margin: '4px 18px 10px', padding: '16px 18px', borderRadius: 16,
            background: utFinalYTD >= 0
              ? (isDark ? 'linear-gradient(135deg, rgba(48,209,88,.14), rgba(48,209,88,.06))' : 'linear-gradient(135deg, rgba(52,199,89,.14), rgba(52,199,89,.06))')
              : (isDark ? 'linear-gradient(135deg, rgba(255,69,58,.14), rgba(255,69,58,.06))' : 'linear-gradient(135deg, rgba(255,59,48,.14), rgba(255,59,48,.06))'),
            border: `1px solid ${utFinalYTD >= 0 ? (isDark ? 'rgba(48,209,88,.30)' : 'rgba(52,199,89,.30)') : 'rgba(255,59,48,.30)'}`,
          }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: theme.textMuted, fontWeight: 700 }}>Utilidad final · YTD</div>
            <div style={{
              fontSize: 28, fontWeight: 800, letterSpacing: '-.03em',
              color: utFinalYTD >= 0 ? (theme.green || '#34C759') : (theme.red || '#FF3B30'),
              fontVariantNumeric: 'tabular-nums', marginTop: 4, fontFamily: TYPO.fontDisplay,
            }}>
              {utFinalYTD >= 0 ? '+' : ''}{fmtCompact(utFinalYTD)}
            </div>
            {ventaYTD > 0 && (
              <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>
                de {fmtCompact(ventaYTD)} en ingresos · <b style={{ color: margenNeto >= 8 ? (theme.green || '#34C759') : (theme.orange || '#FF9500') }}>{fmtPct(margenNeto)}</b> de margen neto
              </div>
            )}
          </div>

          {/* Chart mensual Venta vs Utilidad */}
          <div style={{ margin: '4px 18px 8px', padding: 14, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-.01em', color: theme.text }}>Venta vs Utilidad</div>
              <div style={{ fontSize: 11, color: theme.textMuted }}>{anio} · mensual</div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 11, color: theme.textMuted }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: theme.accent }} />
                Venta neta
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: theme.green || '#34C759' }} />
                Utilidad
              </span>
            </div>
            <ChartVentaUtilidad theme={theme} serieVenta={serieVenta} serieUtilidad={serieUtilidad} />
          </div>

          {/* Waterfall del mes actual */}
          <div style={{ margin: '4px 18px 8px', padding: 14, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-.01em', color: theme.text }}>Composición · {MES_CORTO[mesActual - 1]}</div>
              <div style={{ fontSize: 11, color: theme.textMuted }}>{fmtCompact(wf.venta)} ventas</div>
            </div>
            <Waterfall theme={theme} isDark={isDark} wf={wf} />
          </div>

          {/* Grupos colapsables */}
          <div style={{ padding: '12px 18px 6px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-.01em', color: theme.text }}>Detalle por sección</div>
            <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>Tap para expandir</div>
          </div>
          <div style={{ padding: '0 18px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SECCIONES.map((sec) => {
              const open = expanded[sec.id];
              const subtotal = sec.subtotal ? getYTD(rows, sec.subtotal) : sec.cuentas.reduce((s, c) => s + getYTD(rows, c), 0);
              const colorMap = {
                green: theme.green || '#34C759', red: theme.red || '#FF3B30',
                orange: theme.orange || '#FF9500', pink: theme.pink || '#FF2D55',
                accent: theme.accent, purple: theme.purple || '#AF52DE',
              };
              const color = colorMap[sec.colorKey] || theme.accent;
              return (
                <div key={sec.id} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, overflow: 'hidden' }}>
                  <button
                    onClick={() => setExpanded(prev => ({ ...prev, [sec.id]: !prev[sec.id] }))}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                      background: 'transparent', border: 'none',
                      borderBottom: open ? `1px solid ${theme.divider}` : 'none',
                      cursor: 'pointer', textAlign: 'left', fontFamily: TYPO.fontText,
                    }}
                  >
                    <div style={{
                      width: 30, height: 30, borderRadius: 8, background: color,
                      display: 'grid', placeItems: 'center', color: '#fff',
                    }}>
                      {sec.negativo ? <TrendingDown size={15} strokeWidth={2} /> : <TrendingUp size={15} strokeWidth={2} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-.01em', color: theme.text }}>{sec.label}</div>
                    </div>
                    <div style={{
                      fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                      color: sec.negativo ? (theme.red || '#FF3B30') : theme.text,
                      fontFamily: TYPO.fontDisplay,
                    }}>{sec.negativo && subtotal > 0 ? '-' : ''}{fmtCompact(subtotal)}</div>
                    {open
                      ? <ChevronDown size={14} style={{ color: theme.textSubtle }} />
                      : <ChevronRight size={14} style={{ color: theme.textSubtle }} />}
                  </button>
                  {open && (
                    <div>
                      {sec.cuentas.map((c) => {
                        const v = getYTD(rows, c);
                        if (v === 0) return null;
                        const displayName = c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                        return (
                          <div key={c} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '9px 14px', borderTop: `1px solid ${theme.divider}`, fontSize: 12.5,
                          }}>
                            <span style={{ color: theme.textMuted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                              {displayName}
                            </span>
                            <span style={{
                              color: v < 0 ? (theme.red || '#FF3B30') : theme.text,
                              fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: 12,
                            }}>{fmtCompact(v)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
      <style>{`.medr-hide::-webkit-scrollbar { display: none; }`}</style>
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

function ChartVentaUtilidad({ theme, serieVenta, serieUtilidad }) {
  // Solo meses con data
  const maxIdx = (() => {
    let m = -1;
    for (let i = 0; i < 12; i++) if (Math.abs(serieVenta[i]) > 0 || Math.abs(serieUtilidad[i]) > 0) m = i;
    return m;
  })();
  const nMeses = maxIdx + 1;
  if (nMeses <= 0) return <div style={{ padding: 12, textAlign: 'center', color: theme.textMuted, fontSize: 12 }}>Sin data mensual</div>;

  const W = 340, H = 130, PAD_TOP = 4, PAD_BOTTOM = 18;
  const maxV = Math.max(...serieVenta.slice(0, nMeses), 1);
  const slotW = W / Math.max(nMeses, 1);
  const barW = Math.min(16, slotW * 0.4);
  const scale = (v) => ((H - PAD_TOP - PAD_BOTTOM) * Math.abs(v)) / maxV;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
      {Array.from({ length: nMeses }).map((_, i) => {
        const v = serieVenta[i] || 0;
        const u = serieUtilidad[i] || 0;
        const cx = i * slotW + slotW / 2;
        const hv = scale(v);
        const hu = scale(u);
        return (
          <g key={i}>
            <rect x={cx - barW - 1} y={H - PAD_BOTTOM - hv} width={barW} height={hv} fill={theme.accent} opacity="0.9" rx="1.5" />
            <rect x={cx + 1} y={H - PAD_BOTTOM - hu} width={barW} height={hu} fill={theme.green || '#34C759'} opacity="0.9" rx="1.5" />
            <text x={cx} y={H - 4} textAnchor="middle" fontSize="9" fill={theme.textMuted} fontFamily={TYPO.fontText}>{MES_CORTO[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Waterfall({ theme, isDark, wf }) {
  const { venta, costo, gastos, financ, ut } = wf;
  const rows = [
    { lbl: 'Venta neta',    val: venta,      pct: 100,                              color: theme.accent,             sign: '' },
    { lbl: 'Costo venta',   val: -costo,     pct: venta > 0 ? (costo / venta) * 100 : 0,   color: theme.red || '#FF3B30',  sign: '-' },
    { lbl: 'Gastos oper.',  val: -gastos,    pct: venta > 0 ? (gastos / venta) * 100 : 0,  color: theme.orange || '#FF9500', sign: '-' },
    { lbl: 'Financieros',   val: -financ,    pct: venta > 0 ? (financ / venta) * 100 : 0,  color: theme.pink || '#FF2D55',  sign: '-' },
  ];
  const utPct = venta > 0 ? (Math.abs(ut) / venta) * 100 : 0;
  const trackBg = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((r) => (
        <div key={r.lbl} style={{ display: 'grid', gridTemplateColumns: '96px 1fr 80px', alignItems: 'center', gap: 10, fontSize: 12 }}>
          <span style={{ color: theme.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.lbl}</span>
          <div style={{ height: 8, background: trackBg, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, r.pct)}%`, background: r.color, borderRadius: 4, transition: 'width 400ms cubic-bezier(.32,.72,0,1)' }} />
          </div>
          <span style={{ textAlign: 'right', color: theme.text, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{fmtCompact(r.val)}</span>
        </div>
      ))}
      {/* Total utilidad */}
      <div style={{
        display: 'grid', gridTemplateColumns: '96px 1fr 80px', alignItems: 'center', gap: 10, fontSize: 12,
        borderTop: `1px solid ${theme.divider}`, paddingTop: 8, marginTop: 4,
      }}>
        <span style={{ color: ut >= 0 ? (theme.green || '#34C759') : (theme.red || '#FF3B30'), fontWeight: 800 }}>= Utilidad</span>
        <div style={{ height: 8, background: trackBg, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, utPct)}%`, background: ut >= 0 ? (theme.green || '#34C759') : (theme.red || '#FF3B30'), borderRadius: 4, transition: 'width 400ms cubic-bezier(.32,.72,0,1)' }} />
        </div>
        <span style={{ textAlign: 'right', color: ut >= 0 ? (theme.green || '#34C759') : (theme.red || '#FF3B30'), fontVariantNumeric: 'tabular-nums', fontWeight: 800 }}>
          {ut >= 0 ? '+' : ''}{fmtCompact(ut)}
        </span>
      </div>
    </div>
  );
}
