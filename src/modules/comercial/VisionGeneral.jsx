import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Activity, TrendingUp, TrendingDown, ChevronRight, ChevronDown,
  Wallet, Package, Receipt, Target,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, Legend,
} from 'recharts';

// ────────── Constantes ──────────
const MESES_LBL  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MESES_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Paleta Bento (consistente con Estado de Resultados)
const PALETTE = {
  blue:   { bg: '#E6F1FB', text: '#042C53', mid: '#185FA5', strong: '#3B82F6' },
  teal:   { bg: '#E1F5EE', text: '#04342C', mid: '#0F6E56', strong: '#1D9E75' },
  purple: { bg: '#EEEDFE', text: '#26215C', mid: '#534AB7', strong: '#7F77DD' },
  coral:  { bg: '#FAECE7', text: '#4A1B0C', mid: '#993C1D', strong: '#D85A30' },
  amber:  { bg: '#FAEEDA', text: '#412402', mid: '#854F0B', strong: '#BA7517' },
  red:    { bg: '#FCEBEB', text: '#501313', mid: '#A32D2D', strong: '#E24B4A' },
  pink:   { bg: '#FBEAF0', text: '#4B1528', mid: '#993556', strong: '#D4537E' },
  green:  { bg: '#EAF3DE', text: '#173404', mid: '#3B6D11', strong: '#639922' },
  gray:   { bg: '#F1EFE8', text: '#2C2C2A', mid: '#5F5E5A', strong: '#888780' },
};

// Color por nombre de dimensión (canal/marca/categoría)
const CANAL_COLOR = {
  'DISTRIBUIDOR':         PALETTE.blue,
  'MAYOREO':              PALETTE.purple,
  'MERCADO LIBRE':        PALETTE.amber,
  'AMAZON':               PALETTE.coral,
  'SITIO WEB':            PALETTE.teal,
  'CYBERPURTA':           PALETTE.purple,
  'SANBORN':              PALETTE.pink,
  'WALMART':              PALETTE.purple,
  'MOSTRADOR':            PALETTE.green,
  'RETAIL REPRESENTADOS': PALETTE.coral,
  'RETAIL PROPIOS':       PALETTE.pink,
};
const colorBloque = (k) => CANAL_COLOR[String(k || '').toUpperCase()] || PALETTE.gray;

// ────────── Formateadores ──────────
const fmtCompact = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(Number(n));
  const sign = Number(n) < 0 ? '-' : '';
  if (a >= 1e6) return sign + '$' + (a / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return sign + '$' + (a / 1e3).toFixed(0) + 'K';
  return sign + '$' + Math.round(a);
};
const fmtMoney = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(Number(n));
  return (Number(n) < 0 ? '-' : '') + '$' + a.toLocaleString('es-MX', { maximumFractionDigits: 0 });
};
const fmtPct = (n) => n == null || isNaN(n) ? '—' : n.toFixed(1) + '%';
const fmtPctDelta = (n) => n == null || isNaN(n) ? '—' : (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
const fmtInt = (n) => n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('es-MX');

// ────────── Helpers ──────────
const sumYTDPor = (rows, fn, mesMax) => rows
  .filter((r) => Number(r.mes) <= mesMax)
  .reduce((s, r) => s + (Number(fn(r)) || 0), 0);

// ────────── Componente principal ──────────
export default function VisionGeneral() {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [aniosDisponibles, setAniosDisponibles] = useState([]);
  const [dimension, setDimension] = useState('canal'); // 'canal' | 'marca' | 'categoria'

  // Datos por dimensión (carga reactiva)
  const [margenAct, setMargenAct] = useState([]);
  const [margenPrev, setMargenPrev] = useState([]);
  const [margenPrev2, setMargenPrev2] = useState([]);
  const [clientesDim, setClientesDim] = useState([]);
  const [inventario, setInventario] = useState(null);
  const [cartera, setCartera] = useState([]);
  const [cuotas, setCuotas] = useState([]);
  const [loading, setLoading] = useState(true);

  const [bloqueExpandido, setBloqueExpandido] = useState(null);

  // ── Años disponibles
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('v_vision_canal_mensual').select('anio').order('anio', { ascending: false });
      const unique = Array.from(new Set((data || []).map((r) => r.anio))).sort((a, b) => b - a);
      setAniosDisponibles(unique);
      if (unique.length > 0 && !unique.includes(anio)) setAnio(unique[0]);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Carga por dimensión + año
  useEffect(() => {
    setLoading(true);
    setBloqueExpandido(null);
    (async () => {
      // Mapeo de dimensión → vista + columna clave
      const viewMap = {
        canal:     { view: 'v_vision_margen_canal',     key: 'admin_interna' },
        marca:     { view: 'v_vision_margen_marca',     key: 'marca' },
        categoria: { view: 'v_vision_margen_categoria', key: 'categoria' },
      };
      const { view } = viewMap[dimension];
      const [a, p, p2, c, inv, cart, q] = await Promise.all([
        supabase.from(view).select('*').eq('anio', anio),
        supabase.from(view).select('*').eq('anio', anio - 1),
        supabase.from(view).select('*').eq('anio', anio - 2),
        supabase.from('v_vision_clientes_canal').select('*').eq('anio', anio),
        supabase.from('v_vision_inventario_global').select('*').single(),
        supabase.from('v_vision_cartera_consolidada').select('*'),
        supabase.from('cuotas_canales').select('*').eq('anio', anio),
      ]);
      setMargenAct(a.data || []);
      setMargenPrev(p.data || []);
      setMargenPrev2(p2.data || []);
      setClientesDim(c.data || []);
      setInventario(inv.data || null);
      setCartera(cart.data || []);
      setCuotas(q.data || []);
      setLoading(false);
    })();
  }, [anio, dimension]);

  // ── Mes máximo con datos
  const mesMax = useMemo(() => {
    let m = 0;
    margenAct.forEach((r) => { if (Number(r.mes) > m) m = Number(r.mes); });
    return m || 12;
  }, [margenAct]);

  const dimKey = dimension === 'canal' ? 'admin_interna' : dimension === 'marca' ? 'marca' : 'categoria';

  // ── KPIs Hero (Venta, Margen, Mes actual, Run-rate)
  const kpis = useMemo(() => {
    const ventaYTD   = sumYTDPor(margenAct, (r) => r.venta, mesMax);
    const margenYTD  = sumYTDPor(margenAct, (r) => r.margen_bruto, mesMax);
    const piezasYTD  = sumYTDPor(margenAct, (r) => r.piezas, mesMax);
    const ventaPrev  = sumYTDPor(margenPrev, (r) => r.venta, mesMax);
    const ventaPrev2 = sumYTDPor(margenPrev2, (r) => r.venta, mesMax);
    const margenPrevYTD = sumYTDPor(margenPrev, (r) => r.margen_bruto, mesMax);

    // Mes actual (no acumulado)
    const ventaMes  = margenAct.filter((r) => Number(r.mes) === mesMax).reduce((s, r) => s + (Number(r.venta) || 0), 0);
    const ventaMesPrev = margenPrev.filter((r) => Number(r.mes) === mesMax).reduce((s, r) => s + (Number(r.venta) || 0), 0);

    // Run-rate: proyección lineal del año basada en YTD
    const runRate = mesMax > 0 ? ventaYTD * 12 / mesMax : 0;

    // Cuota total
    const cuotaTotal = cuotas.find((c) => c.dimension_tipo === 'TOTAL')?.meta_facturacion;
    const cumplYTD = cuotaTotal > 0 ? (ventaYTD / cuotaTotal) * 100 : null;
    const gapVsRunRate = cuotaTotal > 0 ? runRate - cuotaTotal : null;

    return {
      ventaYTD, margenYTD, piezasYTD, ventaPrev, ventaPrev2, margenPrevYTD,
      ventaMes, ventaMesPrev,
      pctMargen: ventaYTD > 0 ? (margenYTD / ventaYTD) * 100 : null,
      pctMargenPrev: ventaPrev > 0 ? (margenPrevYTD / ventaPrev) * 100 : null,
      deltaVenta:  ventaPrev > 0 ? ((ventaYTD - ventaPrev) / ventaPrev) * 100 : null,
      deltaVenta2: ventaPrev2 > 0 ? ((ventaYTD - ventaPrev2) / ventaPrev2) * 100 : null,
      deltaMes:    ventaMesPrev > 0 ? ((ventaMes - ventaMesPrev) / ventaMesPrev) * 100 : null,
      runRate,
      cuotaTotal,
      cumplYTD,
      gapVsRunRate,
      gapVsCuota: cuotaTotal > 0 ? cuotaTotal - ventaYTD : null,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [margenAct, margenPrev, margenPrev2, cuotas, mesMax]);

  // ── Bloques de dimensión (canal/marca/categoría)
  const bloques = useMemo(() => {
    const m = new Map();
    margenAct
      .filter((r) => Number(r.mes) <= mesMax)
      .forEach((r) => {
        const k = r[dimKey] || 'Otros';
        if (!m.has(k)) m.set(k, { key: k, venta: 0, margen: 0, piezas: 0, byMes: {} });
        const it = m.get(k);
        it.venta  += Number(r.venta) || 0;
        it.margen += Number(r.margen_bruto) || 0;
        it.piezas += Number(r.piezas) || 0;
        const ms = Number(r.mes);
        it.byMes[ms] = (it.byMes[ms] || 0) + (Number(r.venta) || 0);
      });
    // Δ YoY
    const prevMap = new Map();
    margenPrev
      .filter((r) => Number(r.mes) <= mesMax)
      .forEach((r) => {
        const k = r[dimKey] || 'Otros';
        prevMap.set(k, (prevMap.get(k) || 0) + (Number(r.venta) || 0));
      });
    const totalActual = Array.from(m.values()).reduce((s, c) => s + c.venta, 0);
    return Array.from(m.values())
      .map((it) => {
        const prev = prevMap.get(it.key) || 0;
        return {
          ...it,
          share: totalActual > 0 ? (it.venta / totalActual) * 100 : 0,
          deltaYoY: prev > 0 ? ((it.venta - prev) / prev) * 100 : null,
          pctMargen: it.venta > 0 ? (it.margen / it.venta) * 100 : null,
          spark: Array.from({ length: mesMax }, (_, i) => Number(it.byMes[i + 1]) || 0),
        };
      })
      .sort((a, b) => b.venta - a.venta);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [margenAct, margenPrev, dimKey, mesMax]);

  // ── Clientes por canal expandido (solo para drill-down)
  const clientesDelBloque = useMemo(() => {
    if (!bloqueExpandido || dimension !== 'canal') return [];
    return clientesDim
      .filter((c) => (c.admin_interna || c.canal) === bloqueExpandido)
      .filter((c) => c.cliente_label && c.cliente_label !== 'Sin nombre')
      .sort((a, b) => Number(b.venta || 0) - Number(a.venta || 0));
  }, [clientesDim, bloqueExpandido, dimension]);

  // ── Tendencia 3 años para gráfica
  const tendencia = useMemo(() => {
    const sumarPorMes = (rows) => {
      const arr = Array(12).fill(null);
      rows.forEach((r) => {
        const m = Number(r.mes);
        if (m < 1 || m > 12) return;
        arr[m - 1] = (arr[m - 1] || 0) + (Number(r.venta) || 0);
      });
      return arr;
    };
    const act = sumarPorMes(margenAct);
    const pr1 = sumarPorMes(margenPrev);
    const pr2 = sumarPorMes(margenPrev2);
    return Array.from({ length: 12 }, (_, i) => ({
      mes: MESES_LBL[i],
      [`${anio}`]: act[i],
      [`${anio - 1}`]: pr1[i],
      [`${anio - 2}`]: pr2[i],
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [margenAct, margenPrev, margenPrev2, anio]);

  // ── Cartera consolidada
  const carteraResumen = useMemo(() => {
    const total = cartera.reduce((s, c) => s + (Number(c.saldo_actual) || 0), 0);
    const vencido = cartera.reduce((s, c) => s + (Number(c.saldo_vencido) || 0), 0);
    const aging0_30 = cartera.reduce((s, c) => s + (Number(c.aging_d0_30) || 0), 0);
    const aging31_60 = cartera.reduce((s, c) => s + (Number(c.aging_d31_60) || 0), 0);
    const aging61_90 = cartera.reduce((s, c) => s + (Number(c.aging_d61_90) || 0), 0);
    const agingMas90 = cartera.reduce((s, c) => s + (Number(c.aging_mas90) || 0), 0);
    return { total, vencido, aging0_30, aging31_60, aging61_90, agingMas90,
             pctVencido: total > 0 ? (vencido / total) * 100 : null };
  }, [cartera]);

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-400">
        <Activity className="w-10 h-10 mx-auto mb-3" />
        Cargando visión general…
      </div>
    );
  }
  if (margenAct.length === 0) {
    return (
      <div className="p-12 text-center text-gray-500">
        <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Visión general</h2>
        <p>No hay datos para {anio}. Sube el archivo ERP en /uploads.html.</p>
      </div>
    );
  }

  return (
    <div className="max-w-none mx-auto p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 px-1">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-1">
            Dirección Comercial · YTD ene–{MESES_LBL[mesMax - 1]} {anio}
          </p>
          <h2 className="text-2xl font-medium text-gray-800">Visión general</h2>
        </div>
        <label className="flex flex-col text-[11px] text-gray-500">
          Año
          <select value={anio} onChange={(e) => setAnio(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white">
            {aniosDisponibles.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>

      {/* HERO */}
      <HeroCard kpis={kpis} anio={anio} mesMaxLabel={MESES_FULL[mesMax - 1]} />

      {/* KPIs financieros (margen, inventario, cartera) */}
      <div className="grid grid-cols-3 gap-2.5">
        <BentoKpi palette={PALETTE.teal} icon={TrendingUp} label="Margen bruto YTD"
          valor={fmtCompact(kpis.margenYTD)}
          delta={null}
          subtitulo={
            <span>
              <strong style={{ color: PALETTE.teal.text }}>{fmtPct(kpis.pctMargen)}</strong>
              {kpis.pctMargenPrev != null && (
                <span style={{ marginLeft: 6, color: PALETTE.teal.mid }}>
                  vs {kpis.pctMargenPrev.toFixed(1)}% en {anio - 1}
                </span>
              )}
            </span>
          } />
        <BentoKpi palette={PALETTE.purple} icon={Package} label="Inventario en stock"
          valor={fmtCompact(inventario?.valor_inventario)}
          delta={null}
          subtitulo={
            <span>
              {fmtInt(inventario?.skus_con_stock)} SKUs ·{' '}
              {kpis.ventaYTD > 0 && inventario?.valor_inventario
                ? Math.round((Number(inventario.valor_inventario) / (kpis.ventaYTD / mesMax)) ) + ' días cobertura'
                : ''}
            </span>
          } />
        <BentoKpi palette={PALETTE.coral} icon={Receipt} label="Cartera por cobrar"
          valor={fmtCompact(carteraResumen.total)}
          delta={null}
          subtitulo={
            <span>
              Vencido <strong style={{ color: PALETTE.coral.text }}>{fmtCompact(carteraResumen.vencido)}</strong>
              {carteraResumen.pctVencido != null && (
                <span> ({carteraResumen.pctVencido.toFixed(1)}%)</span>
              )}
            </span>
          } />
      </div>

      {/* Toggle dimensión */}
      <div className="flex items-center gap-3 px-1 mt-2">
        <span className="text-[11px] text-gray-500 uppercase tracking-widest">Ver mix por</span>
        <div className="inline-flex gap-0.5 bg-gray-100 rounded-lg p-0.5 text-xs">
          {[
            { id: 'canal',     lbl: 'Canal' },
            { id: 'marca',     lbl: 'Marca' },
            { id: 'categoria', lbl: 'Categoría' },
          ].map((t) => (
            <button key={t.id} onClick={() => setDimension(t.id)}
              className={`px-3 py-1 rounded ${dimension === t.id ? 'bg-white shadow text-purple-700 font-medium' : 'text-gray-600'}`}>
              {t.lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Bloques bento */}
      <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {bloques.map((b) => (
          <BloqueBento key={b.key} item={b}
            expandido={bloqueExpandido === b.key}
            onClick={() => setBloqueExpandido(bloqueExpandido === b.key ? null : b.key)}
            puedeExpandir={dimension === 'canal'} />
        ))}
      </div>

      {/* Drill-down de clientes del bloque expandido (solo dimension=canal) */}
      {bloqueExpandido && dimension === 'canal' && (
        <ClientesPanel canal={bloqueExpandido} clientes={clientesDelBloque}
          onClose={() => setBloqueExpandido(null)} />
      )}

      {/* Cartera con aging */}
      <CarteraCard cartera={cartera} resumen={carteraResumen} />

      {/* Tendencia 3 años */}
      <TendenciaCard data={tendencia} anio={anio} mesMax={mesMax} />

      <p className="text-[11px] text-gray-400 px-2">
        Fuente: vistas SQL sobre ventas_erp · inventario_acteck · estados_cuenta.
        Margen = monto_venta_pesos − costo_venta_pesos. Cuota: edita tabla{' '}
        <code>cuotas_canales</code> en Supabase.
      </p>
    </div>
  );
}

// ────────── HERO Card ──────────
function HeroCard({ kpis, anio, mesMaxLabel }) {
  return (
    <div className="grid gap-2.5" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
      {/* Facturación YTD grande */}
      <div style={{ background: PALETTE.blue.bg, borderRadius: 14, padding: '20px 24px' }}>
        <p style={{ fontSize: 11, margin: 0, color: PALETTE.blue.mid, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Facturación YTD
        </p>
        <p style={{ fontSize: 42, fontWeight: 500, margin: '6px 0 8px', color: PALETTE.blue.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
          {fmtCompact(kpis.ventaYTD)}
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-1" style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
          {kpis.deltaVenta != null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: kpis.deltaVenta >= 0 ? '#0F6E56' : '#A32D2D', fontWeight: 500 }}>
              {kpis.deltaVenta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {fmtPctDelta(kpis.deltaVenta)} vs {anio - 1}
              <span style={{ color: PALETTE.blue.mid, opacity: 0.7, fontWeight: 400 }}>
                ({fmtCompact(kpis.ventaPrev)})
              </span>
            </span>
          )}
          {kpis.deltaVenta2 != null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: kpis.deltaVenta2 >= 0 ? '#0F6E56' : '#A32D2D', fontWeight: 500 }}>
              {kpis.deltaVenta2 >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {fmtPctDelta(kpis.deltaVenta2)} vs {anio - 2}
              <span style={{ color: PALETTE.blue.mid, opacity: 0.7, fontWeight: 400 }}>
                ({fmtCompact(kpis.ventaPrev2)})
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Columna lateral: Mes actual + Run-rate vs cuota */}
      <div className="grid grid-rows-2 gap-2.5">
        <div style={{ background: PALETTE.teal.bg, borderRadius: 12, padding: '14px 16px' }}>
          <p style={{ fontSize: 11, margin: 0, color: PALETTE.teal.mid, letterSpacing: '0.03em' }}>
            {mesMaxLabel} (mes en curso)
          </p>
          <p style={{ fontSize: 24, fontWeight: 500, margin: '4px 0 2px', color: PALETTE.teal.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
            {fmtCompact(kpis.ventaMes)}
          </p>
          {kpis.deltaMes != null && (
            <span style={{ fontSize: 11, color: kpis.deltaMes >= 0 ? '#0F6E56' : '#A32D2D', fontVariantNumeric: 'tabular-nums' }}>
              {fmtPctDelta(kpis.deltaMes)} vs {mesMaxLabel.toLowerCase()} {anio - 1}
            </span>
          )}
        </div>
        <div style={{ background: kpis.cuotaTotal > 0 ? PALETTE.purple.bg : PALETTE.gray.bg, borderRadius: 12, padding: '14px 16px' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: 2 }}>
            <Target className="w-3.5 h-3.5" style={{ color: kpis.cuotaTotal > 0 ? PALETTE.purple.mid : PALETTE.gray.mid }} />
            <p style={{ fontSize: 11, margin: 0, color: kpis.cuotaTotal > 0 ? PALETTE.purple.mid : PALETTE.gray.mid, letterSpacing: '0.03em' }}>
              {kpis.cuotaTotal > 0 ? 'Run-rate vs cuota' : 'Run-rate proyectado'}
            </p>
          </div>
          <p style={{ fontSize: 24, fontWeight: 500, margin: '4px 0 2px',
            color: kpis.cuotaTotal > 0 ? PALETTE.purple.text : PALETTE.gray.text,
            fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
            {fmtCompact(kpis.runRate)}
          </p>
          {kpis.cuotaTotal > 0 ? (
            <span style={{ fontSize: 11, color: PALETTE.purple.mid }}>
              Meta: {fmtCompact(kpis.cuotaTotal)} ·{' '}
              <strong style={{ color: kpis.gapVsRunRate >= 0 ? '#0F6E56' : '#A32D2D' }}>
                {fmtPctDelta(kpis.cumplYTD - 100)} cumpl. YTD
              </strong>
            </span>
          ) : (
            <span style={{ fontSize: 11, color: PALETTE.gray.mid, fontStyle: 'italic' }}>
              Sin cuota cargada · agrega en cuotas_canales
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────── Bento KPI ──────────
function BentoKpi({ palette, icon: Icon, label, valor, subtitulo, delta, deltaLabel }) {
  return (
    <div style={{ background: palette.bg, borderRadius: 12, padding: '14px 16px' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 2 }}>
        <p style={{ fontSize: 11, margin: 0, color: palette.mid, letterSpacing: '0.03em' }}>{label}</p>
        {Icon && <Icon className="w-3.5 h-3.5" style={{ color: palette.mid }} />}
      </div>
      <p style={{ fontSize: 24, fontWeight: 500, margin: '4px 0 2px', color: palette.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
        {valor}
      </p>
      <div style={{ fontSize: 11, color: palette.mid, minHeight: 14 }}>
        {delta != null && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginRight: 8, fontWeight: 500,
            color: delta >= 0 ? '#0F6E56' : '#A32D2D' }}>
            {delta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {fmtPctDelta(delta)} {deltaLabel}
          </span>
        )}
        {subtitulo}
      </div>
    </div>
  );
}

// ────────── Bloque Bento (canal/marca/categoría) ──────────
function BloqueBento({ item, expandido, onClick, puedeExpandir }) {
  const palette = colorBloque(item.key);
  const max = Math.max(...item.spark, 0) || 1;
  const min = Math.min(...item.spark, 0);
  const range = max - min || 1;
  return (
    <button onClick={onClick}
      disabled={!puedeExpandir}
      style={{
        textAlign: 'left', display: 'block', background: '#fff',
        border: '1px solid ' + (expandido ? palette.mid : '#E2E8F0'),
        borderRadius: 12, padding: 14, cursor: puedeExpandir ? 'pointer' : 'default',
        transition: 'border 0.15s, box-shadow 0.15s',
        boxShadow: expandido ? `0 0 0 3px ${palette.bg}` : 'none',
      }}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span style={{ width: 10, height: 10, borderRadius: 5, background: palette.mid, display: 'inline-block' }} />
          <p style={{ fontSize: 12, margin: 0, color: '#1E293B', fontWeight: 500, lineHeight: 1.2 }}>{item.key}</p>
        </div>
        <span style={{ fontSize: 10, padding: '1px 8px', background: '#F1F5F9', borderRadius: 10, color: '#6B6A64', fontWeight: 500 }}>
          {item.share.toFixed(1)}%
        </span>
      </div>
      <p style={{ fontSize: 22, fontWeight: 500, margin: '6px 0 2px', color: '#0F172A', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
        {fmtCompact(item.venta)}
      </p>
      <div style={{ display: 'flex', gap: 10, fontSize: 11, fontVariantNumeric: 'tabular-nums', flexWrap: 'wrap' }}>
        {item.deltaYoY != null && (
          <span style={{ color: item.deltaYoY >= 0 ? '#0F6E56' : '#A32D2D', fontWeight: 500 }}>
            {fmtPctDelta(item.deltaYoY)} YoY
          </span>
        )}
        {item.pctMargen != null && (
          <span style={{ color: PALETTE.teal.mid }}>
            margen {item.pctMargen.toFixed(1)}%
          </span>
        )}
      </div>
      {/* Mini sparkline */}
      {item.spark.length > 0 && (
        <svg viewBox="0 0 120 28" style={{ width: '100%', height: 28, marginTop: 8 }} preserveAspectRatio="none">
          <polyline fill="none" stroke={palette.mid} strokeWidth="1.5"
            points={item.spark.map((v, i) => {
              const x = item.spark.length > 1 ? (i / (item.spark.length - 1)) * 120 : 60;
              const y = 28 - (((v - min) / range) * 24);
              return `${x},${y}`;
            }).join(' ')} />
        </svg>
      )}
      {puedeExpandir && (
        <div className="flex items-center gap-1 mt-1" style={{ fontSize: 10, color: '#94A3B8' }}>
          {expandido ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          {expandido ? 'ocultar clientes' : 'ver clientes'}
        </div>
      )}
    </button>
  );
}

// ────────── Drill-down: Clientes del canal ──────────
function ClientesPanel({ canal, clientes, onClose }) {
  if (clientes.length === 0) return null;
  const totalCanal = clientes.reduce((s, c) => s + (Number(c.venta) || 0), 0);
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-sm font-medium text-gray-800">
          Clientes en <span style={{ color: colorBloque(canal).mid }}>{canal}</span>
        </p>
        <button onClick={onClose} className="text-[11px] text-gray-500 hover:text-gray-800">cerrar ✕</button>
      </div>
      <table className="w-full" style={{ fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#FAFBFC', borderBottom: '1px solid #E2E8F0' }}>
            <th style={thLeft}>Cliente</th>
            <th style={thRight}>Venta YTD</th>
            <th style={thRight}>% del canal</th>
            <th style={thRight}>Margen $</th>
            <th style={thRight}>Margen %</th>
            <th style={thRight}>Piezas</th>
          </tr>
        </thead>
        <tbody>
          {clientes.slice(0, 12).map((c, i) => {
            const venta = Number(c.venta) || 0;
            const margen = Number(c.margen_bruto) || 0;
            const share = totalCanal > 0 ? (venta / totalCanal) * 100 : 0;
            const pctMargen = venta > 0 ? (margen / venta) * 100 : null;
            return (
              <tr key={c.cliente_label + i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ ...tdLeft, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={c.cliente_label}>
                  {c.cliente_label}
                </td>
                <td style={{ ...tdRight, fontWeight: 500 }}>{fmtCompact(venta)}</td>
                <td style={tdRight}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{share.toFixed(1)}%</span>
                    <span style={{ width: 40, height: 6, background: '#F1F5F9', borderRadius: 3, position: 'relative', overflow: 'hidden' }}>
                      <span style={{ position: 'absolute', inset: 0, width: `${Math.min(share, 100)}%`, background: colorBloque(canal).mid }} />
                    </span>
                  </span>
                </td>
                <td style={tdRight}>{fmtCompact(margen)}</td>
                <td style={{ ...tdRight, color: PALETTE.teal.mid, fontWeight: 500 }}>{fmtPct(pctMargen)}</td>
                <td style={tdRight}>{fmtInt(c.piezas)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ────────── Cartera con aging ──────────
function CarteraCard({ cartera, resumen }) {
  if (cartera.length === 0) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-sm font-medium text-gray-800">Cartera por cobrar</p>
        <p className="text-[11px] text-gray-400">
          Total {fmtMoney(resumen.total)} · Vencido {fmtCompact(resumen.vencido)}
          {resumen.pctVencido != null && ` (${resumen.pctVencido.toFixed(1)}%)`}
        </p>
      </div>
      <div className="grid grid-cols-4 gap-2 mb-4">
        <AgingTile palette={PALETTE.teal}  label="0–30 días"  valor={resumen.aging0_30}  total={resumen.total} />
        <AgingTile palette={PALETTE.amber} label="31–60 días" valor={resumen.aging31_60} total={resumen.total} />
        <AgingTile palette={PALETTE.coral} label="61–90 días" valor={resumen.aging61_90} total={resumen.total} />
        <AgingTile palette={PALETTE.red}   label="+90 días"   valor={resumen.agingMas90} total={resumen.total} />
      </div>
      <table className="w-full" style={{ fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#FAFBFC', borderBottom: '1px solid #E2E8F0' }}>
            <th style={thLeft}>Cliente</th>
            <th style={thRight}>Saldo total</th>
            <th style={thRight}>Vencido</th>
            <th style={thRight}>% vencido</th>
            <th style={thRight}>DSO</th>
            <th style={thRight}>Corte</th>
          </tr>
        </thead>
        <tbody>
          {cartera.sort((a, b) => Number(b.saldo_actual || 0) - Number(a.saldo_actual || 0)).map((c) => {
            const pctVenc = c.saldo_actual > 0 ? (Number(c.saldo_vencido) / Number(c.saldo_actual)) * 100 : 0;
            return (
              <tr key={c.cliente} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ ...tdLeft, textTransform: 'capitalize' }}>{c.cliente}</td>
                <td style={{ ...tdRight, fontWeight: 500 }}>{fmtCompact(c.saldo_actual)}</td>
                <td style={tdRight}>{fmtCompact(c.saldo_vencido)}</td>
                <td style={{ ...tdRight, color: pctVenc >= 20 ? PALETTE.red.mid : pctVenc >= 10 ? PALETTE.amber.mid : PALETTE.teal.mid, fontWeight: 500 }}>
                  {pctVenc.toFixed(1)}%
                </td>
                <td style={tdRight}>{c.dso != null ? Math.round(Number(c.dso)) + 'd' : '—'}</td>
                <td style={{ ...tdRight, color: '#94A3B8' }}>{c.fecha_corte || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AgingTile({ palette, label, valor, total }) {
  const pct = total > 0 ? (valor / total) * 100 : 0;
  return (
    <div style={{ background: palette.bg, borderRadius: 10, padding: '10px 12px' }}>
      <p style={{ fontSize: 10, color: palette.mid, margin: 0, letterSpacing: '0.03em', textTransform: 'uppercase' }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 500, margin: '4px 0 2px', color: palette.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
        {fmtCompact(valor)}
      </p>
      <p style={{ fontSize: 11, color: palette.mid, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
        {pct.toFixed(1)}%
      </p>
    </div>
  );
}

// ────────── Tendencia 3 años ──────────
function TendenciaCard({ data, anio, mesMax }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-sm font-medium text-gray-800">Tendencia mensual · 3 años</p>
        <p className="text-[11px] text-gray-400">{anio - 2}, {anio - 1}, {anio}</p>
      </div>
      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#6B6A64' }} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} />
            <YAxis tickFormatter={(v) => '$' + (v / 1e6).toFixed(0) + 'M'} tick={{ fontSize: 10, fill: '#6B6A64' }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => v != null ? fmtMoney(v) : '—'} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="line" />
            <Line type="monotone" dataKey={`${anio - 2}`} stroke={PALETTE.gray.mid} strokeWidth={1.2} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey={`${anio - 1}`} stroke={PALETTE.blue.mid}  strokeWidth={1.6} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey={`${anio}`}     stroke={PALETTE.purple.mid} strokeWidth={2.2} dot={{ r: 3, fill: PALETTE.purple.mid }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ────────── Estilos comunes ──────────
const thLeft = { padding: '8px 12px', textAlign: 'left', fontWeight: 500, color: '#6B6A64', fontSize: 11, whiteSpace: 'nowrap' };
const thRight = { padding: '8px 8px', textAlign: 'right', fontWeight: 500, color: '#6B6A64', fontSize: 11, whiteSpace: 'nowrap' };
const tdLeft = { padding: '8px 12px', color: '#334155', fontSize: 12 };
const tdRight = { padding: '8px 8px', textAlign: 'right', color: '#1E293B', fontSize: 12, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
