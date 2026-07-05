import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Activity, TrendingUp, TrendingDown, ChevronRight, ChevronDown,
  Wallet, Package, Receipt, Target, ShoppingBag, Ship, X,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
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
  const [inventarioMarca, setInventarioMarca] = useState([]);
  const [caminoResumen, setCaminoResumen] = useState([]);
  const [caminoCalendario, setCaminoCalendario] = useState([]);
  const [caminoProximas, setCaminoProximas] = useState([]);
  const [caminoSemanal, setCaminoSemanal] = useState([]);
  const [caminoRetrasadas, setCaminoRetrasadas] = useState([]);
  const [caminoProveedores, setCaminoProveedores] = useState([]);
  const [caminoAgotados, setCaminoAgotados] = useState([]);
  const [caminoLeadtime, setCaminoLeadtime] = useState(null);
  const [comprasYTD, setComprasYTD] = useState([]);
  const [cartera, setCartera] = useState([]);
  const [cuotas, setCuotas] = useState([]);
  const [loading, setLoading] = useState(true);

  const [sellCanal, setSellCanal] = useState([]);
  const [sellCanalPrev, setSellCanalPrev] = useState([]);
  const [sellMayoristas, setSellMayoristas] = useState([]);
  const [sellRotacion, setSellRotacion] = useState([]);
  const [sellMensual, setSellMensual] = useState([]);
  const [sellMensualPrev, setSellMensualPrev] = useState([]);
  const [sellTopSkus, setSellTopSkus] = useState([]);
  const [sellTopClientes, setSellTopClientes] = useState([]);
  const [sellPromosResumen, setSellPromosResumen] = useState(null);
  const [sellPromosSkus, setSellPromosSkus] = useState([]);

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
      // Fuente: facturacion_clientes (Excel "Venta Facturación" del ERP).
      // Por ahora solo soportamos dimension='canal' — marca/categoría
      // requieren ventas_erp completo con marca/familia.
      const [a, p, p2, c, inv, invMarca, cart, q, cRes, cCal, cProx, cSem, cRet, cProv, cAgo, cLT, cYTD,
             sCan, sCanPrev, sMay, sRot, sMen, sMenPrev, sSkus, sCli, sPromo, sPromoSkus] = await Promise.all([
        supabase.from('v_vision_factura_canal').select('*').eq('anio', anio),
        supabase.from('v_vision_factura_canal').select('*').eq('anio', anio - 1),
        supabase.from('v_vision_factura_canal').select('*').eq('anio', anio - 2),
        supabase.from('v_vision_factura_clientes').select('*').eq('anio', anio),
        supabase.from('v_vision_inventario_global').select('*').single(),
        supabase.from('v_vision_inventario_marca').select('*').order('valor', { ascending: false, nullsFirst: false }),
        supabase.from('v_vision_cartera_consolidada').select('*'),
        supabase.from('cuotas_canales').select('*').eq('anio', anio),
        supabase.from('v_vision_camino_resumen').select('*'),
        supabase.from('v_vision_camino_calendario').select('*'),
        supabase.from('v_vision_camino_proximas').select('*').limit(10),
        supabase.from('v_vision_camino_semanal').select('*').limit(12),
        supabase.from('v_vision_camino_retrasadas').select('*'),
        supabase.from('v_vision_camino_proveedores').select('*').limit(8),
        supabase.from('v_vision_camino_agotados').select('*').limit(10),
        supabase.from('v_vision_camino_leadtime').select('*').single(),
        supabase.from('v_vision_camino_compras_ytd').select('*'),
        supabase.from('v_vision_sellout_canal').select('*').eq('anio', anio),
        supabase.from('v_vision_sellout_canal').select('*').eq('anio', anio - 1),
        supabase.from('v_vision_sellout_mayoristas').select('*').eq('anio', anio).order('importe', { ascending: false }),
        supabase.from('v_vision_sellout_rotacion').select('*').order('rotacion_pct', { ascending: true, nullsFirst: false }),
        supabase.from('v_vision_sellout_mensual').select('*').eq('anio', anio),
        supabase.from('v_vision_sellout_mensual').select('*').eq('anio', anio - 1),
        supabase.from('v_vision_sellout_top_skus').select('*').eq('anio', anio).order('importe', { ascending: false }).limit(10),
        supabase.from('v_vision_sellout_top_clientes').select('*').eq('anio', anio).order('importe', { ascending: false }).limit(10),
        supabase.from('v_vision_sellout_promos').select('*').single(),
        supabase.from('v_vision_sellout_promos_top_skus').select('*').order('importe', { ascending: false }).limit(5),
      ]);
      setMargenAct(a.data || []);
      setMargenPrev(p.data || []);
      setMargenPrev2(p2.data || []);
      setClientesDim(c.data || []);
      setInventario(inv.data || null);
      setInventarioMarca(invMarca.data || []);
      setCartera(cart.data || []);
      setCuotas(q.data || []);
      setCaminoResumen(cRes.data || []);
      setCaminoCalendario(cCal.data || []);
      setCaminoProximas(cProx.data || []);
      setCaminoSemanal(cSem.data || []);
      setCaminoRetrasadas(cRet.data || []);
      setCaminoProveedores(cProv.data || []);
      setCaminoAgotados(cAgo.data || []);
      setCaminoLeadtime(cLT.data || null);
      setComprasYTD(cYTD.data || []);
      setSellCanal(sCan.data || []);
      setSellCanalPrev(sCanPrev.data || []);
      setSellMayoristas(sMay.data || []);
      setSellRotacion(sRot.data || []);
      setSellMensual(sMen.data || []);
      setSellMensualPrev(sMenPrev.data || []);
      setSellTopSkus(sSkus.data || []);
      setSellTopClientes(sCli.data || []);
      setSellPromosResumen(sPromo.data || null);
      setSellPromosSkus(sPromoSkus.data || []);
      setLoading(false);
    })();
  }, [anio, dimension]);

  // ── Mes máximo con datos
  const mesMax = useMemo(() => {
    let m = 0;
    margenAct.forEach((r) => { if (Number(r.mes) > m) m = Number(r.mes); });
    return m || 12;
  }, [margenAct]);

  // Siempre dimension = 'canal' por ahora (facturacion_clientes no trae marca/categoría).
  const dimKey = 'canal';

  // ── KPIs Hero (Venta YTD, Mes actual, Run-rate, # clientes activos)
  // Sin margen — facturacion_clientes no trae costo. Pendiente fórmula.
  const kpis = useMemo(() => {
    const ventaYTD   = sumYTDPor(margenAct, (r) => r.venta, mesMax);
    const piezasYTD  = sumYTDPor(margenAct, (r) => r.piezas, mesMax);
    const ventaPrev  = sumYTDPor(margenPrev, (r) => r.venta, mesMax);
    const ventaPrev2 = sumYTDPor(margenPrev2, (r) => r.venta, mesMax);

    // Mes actual (no acumulado)
    const ventaMes  = margenAct.filter((r) => Number(r.mes) === mesMax).reduce((s, r) => s + (Number(r.venta) || 0), 0);
    const ventaMesPrev = margenPrev.filter((r) => Number(r.mes) === mesMax).reduce((s, r) => s + (Number(r.venta) || 0), 0);

    // # clientes activos YTD
    const nClientesActivos = new Set(clientesDim.map((c) => c.cliente_nombre)).size;

    // Run-rate: proyección lineal del año basada en YTD
    const runRate = mesMax > 0 ? ventaYTD * 12 / mesMax : 0;

    // Cuota total
    const cuotaTotal = cuotas.find((c) => c.dimension_tipo === 'TOTAL')?.meta_facturacion;
    const cumplYTD = cuotaTotal > 0 ? (ventaYTD / cuotaTotal) * 100 : null;
    const gapVsRunRate = cuotaTotal > 0 ? runRate - cuotaTotal : null;

    return {
      ventaYTD, piezasYTD, ventaPrev, ventaPrev2,
      ventaMes, ventaMesPrev,
      nClientesActivos,
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
  }, [margenAct, margenPrev, margenPrev2, clientesDim, cuotas, mesMax]);

  // ── Bloques por canal (sin margen — pendiente de fórmula)
  const bloques = useMemo(() => {
    const m = new Map();
    margenAct
      .filter((r) => Number(r.mes) <= mesMax)
      .forEach((r) => {
        const k = r[dimKey] || 'Otros';
        if (!m.has(k)) m.set(k, { key: k, venta: 0, piezas: 0, byMes: {} });
        const it = m.get(k);
        it.venta  += Number(r.venta) || 0;
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
          pctMargen: null,
          spark: Array.from({ length: mesMax }, (_, i) => Number(it.byMes[i + 1]) || 0),
        };
      })
      .sort((a, b) => b.venta - a.venta);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [margenAct, margenPrev, dimKey, mesMax]);

  // ── Clientes del canal expandido (drill-down)
  const clientesDelBloque = useMemo(() => {
    if (!bloqueExpandido) return [];
    return clientesDim
      .filter((c) => c.canal === bloqueExpandido)
      .filter((c) => c.cliente_nombre && c.cliente_nombre !== 'Sin nombre')
      .sort((a, b) => Number(b.venta || 0) - Number(a.venta || 0));
  }, [clientesDim, bloqueExpandido]);

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

  // ── Sell-out del mes actual + comparativo mismo mes año anterior
  const sellOutMes = useMemo(() => {
    const total    = sellMensual.filter((r) => Number(r.mes) === mesMax).reduce((s, r) => s + (Number(r.importe) || 0), 0);
    const prev     = sellMensualPrev.filter((r) => Number(r.mes) === mesMax).reduce((s, r) => s + (Number(r.importe) || 0), 0);
    const ytd      = sellMensual.filter((r) => Number(r.mes) <= mesMax).reduce((s, r) => s + (Number(r.importe) || 0), 0);
    const ytdPrev  = sellMensualPrev.filter((r) => Number(r.mes) <= mesMax).reduce((s, r) => s + (Number(r.importe) || 0), 0);
    // Rotación agregada YTD = sellout ytd / sell-in con lag 90d agregado
    const sellinLag = sellRotacion.reduce((s, r) => s + (Number(r.sellin_lag_90d) || 0), 0);
    const sellOutYtdMayoreo = sellRotacion.reduce((s, r) => s + (Number(r.sellout_ytd) || 0), 0);
    return {
      total, prev, ytd, ytdPrev,
      deltaYoY: prev > 0 ? ((total - prev) / prev) * 100 : null,
      deltaYTD: ytdPrev > 0 ? ((ytd - ytdPrev) / ytdPrev) * 100 : null,
      rotacionYTD: sellinLag > 0 ? (sellOutYtdMayoreo / sellinLag) * 100 : null,
      sellinLag, sellOutYtdMayoreo,
    };
  }, [sellMensual, sellMensualPrev, sellRotacion, mesMax]);

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

      {/* KPIs: Inventario + 2 placeholders Próximamente */}
      <div className="grid grid-cols-3 gap-2.5">
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
        <ProximamenteKpi icon={Receipt} label="Cartera por cobrar"
          nota="En construcción" />
        <BentoKpi palette={PALETTE.coral} icon={ShoppingBag} label="Sell Out del canal"
          valor={fmtCompact(sellOutMes.total)}
          delta={sellOutMes.deltaYoY}
          deltaLabel={`vs ${MESES_LBL[mesMax - 1]} ${anio - 1}`}
          subtitulo={
            <span>
              YTD {fmtCompact(sellOutMes.ytd)} · rotación {sellOutMes.rotacionYTD != null ? fmtPct(sellOutMes.rotacionYTD) : '—'}
            </span>
          } />
      </div>

      {/* Toggle dimensión */}
      <div className="flex items-center gap-3 px-1 mt-2 flex-wrap">
        <span className="text-[11px] text-gray-500 uppercase tracking-widest">Ver mix por</span>
        <div className="inline-flex gap-0.5 bg-gray-100 rounded-lg p-0.5 text-xs">
          {[
            { id: 'canal',     lbl: 'Canal', enabled: true },
            { id: 'marca',     lbl: 'Marca', enabled: false },
            { id: 'categoria', lbl: 'Categoría', enabled: false },
          ].map((t) => (
            <button key={t.id}
              onClick={() => t.enabled && setDimension(t.id)}
              disabled={!t.enabled}
              title={!t.enabled ? 'Pendiente — requiere ventas_erp completo con marca/familia' : ''}
              className={`px-3 py-1 rounded ${
                dimension === t.id
                  ? 'bg-white shadow text-purple-700 font-medium'
                  : t.enabled ? 'text-gray-600' : 'text-gray-300 cursor-not-allowed'
              }`}>
              {t.lbl}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-gray-400 italic">Marca / Categor&iacute;a pendientes</span>
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
          mensualAct={margenAct} mensualPrev={margenPrev}
          anio={anio} mesMax={mesMax}
          onClose={() => setBloqueExpandido(null)} />
      )}

      {/* Tendencia 3 años */}
      <TendenciaCard data={tendencia} anio={anio} mesMax={mesMax} />

      {/* Bloque Sell Out */}
      <SellOutBloque
        sellCanal={sellCanal} sellCanalPrev={sellCanalPrev}
        sellMayoristas={sellMayoristas} sellRotacion={sellRotacion}
        sellMensual={sellMensual} sellMensualPrev={sellMensualPrev}
        sellTopSkus={sellTopSkus} sellTopClientes={sellTopClientes}
        sellPromosResumen={sellPromosResumen} sellPromosSkus={sellPromosSkus}
        sellOutMes={sellOutMes}
        anio={anio} mesMax={mesMax}
      />

      {/* Sección de inventario */}
      <InventarioSection inventario={inventario}
        inventarioMarca={inventarioMarca}
        caminoResumen={caminoResumen}
        caminoCalendario={caminoCalendario}
        caminoProximas={caminoProximas}
        caminoSemanal={caminoSemanal}
        caminoRetrasadas={caminoRetrasadas}
        caminoProveedores={caminoProveedores}
        caminoAgotados={caminoAgotados}
        caminoLeadtime={caminoLeadtime}
        comprasYTD={comprasYTD}
        anio={anio}
        ventaPromMes={mesMax > 0 ? kpis.ventaYTD / mesMax : 0} />

      <p className="text-[11px] text-gray-400 px-2">
        Fuente: facturacion_clientes (canal × cliente × SKU × mes), inventario_acteck
        (almacenes comerciales). Margen y cartera pendientes de fuente.
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

// ────────── Drill-down: detalle del canal con chart y clientes ──────────
function ClientesPanel({ canal, clientes, mensualAct, mensualPrev, anio, mesMax, onClose }) {
  const totalCanal = clientes.reduce((s, c) => s + (Number(c.venta) || 0), 0);
  const palette = colorBloque(canal);

  // KPIs del canal
  const ytdAct  = mensualAct.filter((r) => r.canal === canal && Number(r.mes) <= mesMax)
    .reduce((s, r) => s + (Number(r.venta) || 0), 0);
  const ytdPrev = mensualPrev.filter((r) => r.canal === canal && Number(r.mes) <= mesMax)
    .reduce((s, r) => s + (Number(r.venta) || 0), 0);
  const delta = ytdPrev > 0 ? ((ytdAct - ytdPrev) / ytdPrev) * 100 : null;
  const ventaMes  = mensualAct.filter((r) => r.canal === canal && Number(r.mes) === mesMax)
    .reduce((s, r) => s + (Number(r.venta) || 0), 0);
  const ventaMesPrev = mensualPrev.filter((r) => r.canal === canal && Number(r.mes) === mesMax)
    .reduce((s, r) => s + (Number(r.venta) || 0), 0);
  const deltaMes = ventaMesPrev > 0 ? ((ventaMes - ventaMesPrev) / ventaMesPrev) * 100 : null;

  // Data mensual para barras lado a lado
  const trendData = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const a = mensualAct.filter((r) => r.canal === canal && Number(r.mes) === m).reduce((s, r) => s + (Number(r.venta) || 0), 0);
    const p = mensualPrev.filter((r) => r.canal === canal && Number(r.mes) === m).reduce((s, r) => s + (Number(r.venta) || 0), 0);
    return { mes: MESES_LBL[i], anioPrev: p || null, anioAct: m <= mesMax ? (a || null) : null };
  });

  return (
    <div className="bg-white rounded-xl p-4" style={{ border: `1px solid ${palette.mid}` }}>
      <div className="flex items-start justify-between mb-3 flex-wrap gap-3">
        <div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 12, height: 12, borderRadius: 6, background: palette.mid, display: 'inline-block' }} />
            <span className="text-lg font-medium text-gray-800">{canal}</span>
          </span>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {clientes.length} clientes · {((ytdAct / (mensualAct.reduce((s, r) => s + (Number(r.venta) || 0), 0) || 1)) * 100).toFixed(1)}% del negocio total
          </p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700" title="Cerrar">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 4 mini-KPIs del canal */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <MiniKpi palette={palette} label={`YTD ${anio}`}      valor={fmtCompact(ytdAct)} />
        <MiniKpi palette={PALETTE.gray} label={`YTD ${anio - 1}`} valor={fmtCompact(ytdPrev)} />
        <MiniKpi palette={delta == null ? PALETTE.gray : delta >= 0 ? PALETTE.teal : PALETTE.red}
          label="Δ YoY"
          valor={delta == null ? '—' : fmtPctDelta(delta)} />
        <MiniKpi palette={PALETTE.amber}
          label={`${MESES_FULL[mesMax - 1]} ${anio}`}
          valor={fmtCompact(ventaMes)}
          sub={deltaMes != null ? fmtPctDelta(deltaMes) + ' YoY' : ''} />
      </div>

      {/* Bar chart 2025 vs 2026 */}
      <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-1">Facturación mensual · {anio - 1} vs {anio}</p>
      <div style={{ width: '100%', height: 220, marginBottom: 16 }}>
        <ResponsiveContainer>
          <BarChart data={trendData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#6B6A64' }} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} />
            <YAxis tickFormatter={(v) => '$' + (v / 1e6).toFixed(0) + 'M'} tick={{ fontSize: 10, fill: '#6B6A64' }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => fmtMoney(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="square" />
            <Bar dataKey="anioPrev" name={`${anio - 1}`} fill={palette.bg} stroke={palette.mid} strokeWidth={1} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="anioAct"  name={`${anio}`}     fill={palette.mid} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {clientes.length === 0 ? null : (
        <>
      <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-1">Top clientes del canal · YTD</p>
      <table className="w-full" style={{ fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#FAFBFC', borderBottom: '1px solid #E2E8F0' }}>
            <th style={thLeft}>#</th>
            <th style={thLeft}>Cliente</th>
            <th style={thRight}>Venta YTD</th>
            <th style={thRight}>% del canal</th>
            <th style={thRight}>Piezas</th>
            <th style={thRight}>Meses activos</th>
          </tr>
        </thead>
        <tbody>
          {clientes.slice(0, 25).map((c, i) => {
            const venta = Number(c.venta) || 0;
            const share = totalCanal > 0 ? (venta / totalCanal) * 100 : 0;
            return (
              <tr key={c.cliente_nombre + i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ ...tdLeft, color: '#94A3B8' }}>{i + 1}</td>
                <td style={{ ...tdLeft, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={c.cliente_nombre}>
                  {c.cliente_nombre}
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
                <td style={tdRight}>{fmtInt(c.piezas)}</td>
                <td style={tdRight}>{c.meses_activos || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </>
      )}
    </div>
  );
}

// ────────── Mini KPI tile (drill-down del canal) ──────────
function MiniKpi({ palette, label, valor, sub }) {
  return (
    <div style={{ background: palette.bg, borderRadius: 8, padding: '8px 12px' }}>
      <p style={{ fontSize: 10, margin: 0, color: palette.mid, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 500, margin: '2px 0 0', color: palette.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
        {valor}
      </p>
      {sub && <p style={{ fontSize: 10, color: palette.mid, margin: '2px 0 0', fontVariantNumeric: 'tabular-nums' }}>{sub}</p>}
    </div>
  );
}

// ────────── Tile "Próximamente" ──────────
function ProximamenteKpi({ icon: Icon, label, nota }) {
  return (
    <div style={{
      background: '#F8FAFC', borderRadius: 12, padding: '14px 16px',
      border: '1px dashed #CBD5E1', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 84,
    }}>
      <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
        {Icon && <Icon className="w-3.5 h-3.5" style={{ color: '#94A3B8' }} />}
        <p style={{ fontSize: 11, margin: 0, color: '#94A3B8', letterSpacing: '0.03em' }}>{label}</p>
      </div>
      <p style={{ fontSize: 16, fontWeight: 500, margin: 0, color: '#64748B' }}>Próximamente</p>
      {nota && <p style={{ fontSize: 10, color: '#94A3B8', margin: '2px 0 0', fontStyle: 'italic' }}>{nota}</p>}
    </div>
  );
}

// ────────── Cartera con aging (legacy — no se usa por ahora) ──────────
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

// ────────── Sección de Inventario ──────────
function InventarioSection({ inventario, inventarioMarca, caminoResumen, caminoCalendario, caminoProximas, caminoSemanal, caminoRetrasadas, caminoProveedores, caminoAgotados, caminoLeadtime, comprasYTD, anio, ventaPromMes }) {
  // Buckets de estatus en orden de pipeline + total agregado
  const BUCKET_LABELS = {
    produccion:        { label: 'En producción',      palette: PALETTE.amber },
    transito:          { label: 'Tránsito marítimo',  palette: PALETTE.blue },
    pendiente_modular: { label: 'Pendiente modular',  palette: PALETTE.purple },
    por_zarpar:        { label: 'Por zarpar',         palette: PALETTE.coral },
    por_consolidar:    { label: 'Por consolidar',     palette: PALETTE.gray },
    sin_embarque:      { label: 'Sin embarque',       palette: PALETTE.gray },
    otro:              { label: 'Otro',               palette: PALETTE.gray },
  };
  const BUCKET_ORDER = ['produccion', 'transito', 'pendiente_modular', 'por_zarpar', 'por_consolidar'];
  const resumenMap = new Map(caminoResumen.map((r) => [r.bucket_estatus, r]));
  const totalEnCamino = caminoResumen
    .filter((r) => ['produccion','transito','pendiente_modular','por_zarpar','por_consolidar'].includes(r.bucket_estatus))
    .reduce((s, r) => s + (Number(r.valor_mxn) || 0), 0);
  const totalPiezasEnCamino = caminoResumen
    .filter((r) => ['produccion','transito','pendiente_modular','por_zarpar','por_consolidar'].includes(r.bucket_estatus))
    .reduce((s, r) => s + (Number(r.piezas) || 0), 0);
  const totalPosEnCamino = caminoResumen
    .filter((r) => ['produccion','transito','pendiente_modular','por_zarpar','por_consolidar'].includes(r.bucket_estatus))
    .reduce((s, r) => s + (Number(r.pos) || 0), 0);
  const sinEmbarque = resumenMap.get('sin_embarque');
  const tieneCamino = totalEnCamino > 0 || totalPosEnCamino > 0;

  // KPIs strip
  const valorInv = Number(inventario?.valor_inventario) || 0;
  const piezas   = Number(inventario?.piezas_disponibles) || 0;
  const skus     = Number(inventario?.skus_con_stock) || 0;
  const agotados = Number(inventario?.skus_agotados) || 0;
  const diasCob  = ventaPromMes > 0 ? Math.round(valorInv / ventaPromMes * 30) : null;
  const cobLbl   = diasCob == null ? '—'
                  : diasCob < 60  ? 'Bajo'
                  : diasCob > 120 ? 'Alto'
                  : 'Sano';

  // Filtra marcas y agrupa pequeñas en "Otros"
  const totalMarca = inventarioMarca.reduce((s, m) => s + (Number(m.valor) || 0), 0);
  const marcasTop = inventarioMarca
    .filter((m) => (Number(m.valor) || 0) > 0)
    .slice(0, 5);
  const otrasMarcasVal = inventarioMarca
    .slice(5)
    .reduce((s, m) => s + (Number(m.valor) || 0), 0);
  const marcasParaDonut = otrasMarcasVal > 0
    ? [...marcasTop, { marca: 'Otras marcas', valor: otrasMarcasVal, skus: 0 }]
    : marcasTop;
  const MARCA_COLOR = {
    'ACTECK': PALETTE.purple.mid,
    'BALAM RUSH': PALETTE.coral.strong,
    'MOBIFREE': PALETTE.blue.mid,
    'SWANN': PALETTE.teal.mid,
    'EVOROK': PALETTE.amber.mid,
    'Sin marca': PALETTE.gray.mid,
    'Otras marcas': PALETTE.gray.strong,
  };
  const colorMarca = (m) => MARCA_COLOR[String(m).toUpperCase()] || MARCA_COLOR[m] || PALETTE.pink.mid;

  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between px-1">
        <p className="text-[11px] uppercase tracking-widest text-gray-500">
          <Package className="inline w-3 h-3 mr-1" style={{ verticalAlign: -1 }} />
          Inventario
        </p>
        <p className="text-[11px] text-gray-400">
          Almacenes comerciales · al {inventario?.ultima_carga ? new Date(inventario.ultima_carga).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
        </p>
      </div>

      {/* 4 KPI tiles */}
      <div className="grid grid-cols-4 gap-2">
        <div style={{ background: PALETTE.purple.bg, borderRadius: 12, padding: '12px 14px' }}>
          <p style={{ fontSize: 10, color: PALETTE.purple.mid, margin: 0, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Valor en stock</p>
          <p style={{ fontSize: 22, fontWeight: 500, margin: '4px 0 2px', color: PALETTE.purple.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
            {fmtCompact(valorInv)}
          </p>
          <p style={{ fontSize: 11, color: PALETTE.purple.mid, margin: 0 }}>
            {fmtInt(piezas)} piezas · {fmtInt(skus)} SKUs
          </p>
        </div>
        <div style={{ background: PALETTE.teal.bg, borderRadius: 12, padding: '12px 14px' }}>
          <p style={{ fontSize: 10, color: PALETTE.teal.mid, margin: 0, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Días cobertura</p>
          <p style={{ fontSize: 22, fontWeight: 500, margin: '4px 0 2px', color: PALETTE.teal.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
            {diasCob != null ? `~${diasCob} días` : '—'}
          </p>
          <p style={{ fontSize: 11, color: PALETTE.teal.mid, margin: 0 }}>{cobLbl}</p>
        </div>
        <div style={{ background: PALETTE.amber.bg, borderRadius: 12, padding: '12px 14px' }}>
          <p style={{ fontSize: 10, color: PALETTE.amber.mid, margin: 0, textTransform: 'uppercase', letterSpacing: '0.03em' }}>SKUs agotados</p>
          <p style={{ fontSize: 22, fontWeight: 500, margin: '4px 0 2px', color: PALETTE.amber.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
            {fmtInt(agotados)}
          </p>
          <p style={{ fontSize: 11, color: PALETTE.amber.mid, margin: 0 }}>Con venta reciente</p>
        </div>
        {tieneCamino ? (
          <div style={{ background: PALETTE.blue.bg, borderRadius: 12, padding: '12px 14px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 2 }}>
              <p style={{ fontSize: 10, color: PALETTE.blue.mid, margin: 0, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Valor en camino</p>
              <Ship className="w-3.5 h-3.5" style={{ color: PALETTE.blue.mid }} />
            </div>
            <p style={{ fontSize: 22, fontWeight: 500, margin: '4px 0 2px', color: PALETTE.blue.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
              {fmtCompact(totalEnCamino)}
            </p>
            <p style={{ fontSize: 11, color: PALETTE.blue.mid, margin: 0 }}>
              {fmtInt(totalPosEnCamino)} PO · {fmtInt(totalPiezasEnCamino)} pzs
            </p>
          </div>
        ) : (
          <ProximamenteKpi icon={Ship} label="Valor en camino" nota="Sube ERP con Vw_TablaH_Compras" />
        )}
      </div>

      {/* Composición: marca + categoría pendiente */}
      <div className="grid gap-2.5" style={{ gridTemplateColumns: '1fr 1.4fr' }}>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-800 mb-2">Composición por marca</p>
          {marcasParaDonut.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Sin datos de marca</p>
          ) : (
            <>
              <div style={{ width: '100%', height: 180 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={marcasParaDonut} dataKey="valor" nameKey="marca"
                      innerRadius={48} outerRadius={80} stroke="#fff" strokeWidth={2}
                      isAnimationActive={false}>
                      {marcasParaDonut.map((m, i) => <Cell key={i} fill={colorMarca(m.marca)} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmtMoney(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex flex-col gap-1">
                {marcasParaDonut.map((m) => {
                  const share = totalMarca > 0 ? ((Number(m.valor) || 0) / totalMarca) * 100 : 0;
                  return (
                    <div key={m.marca} className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1.5">
                        <span style={{ width: 8, height: 8, background: colorMarca(m.marca), display: 'inline-block' }} />
                        {m.marca}
                      </span>
                      <span style={{ fontVariantNumeric: 'tabular-nums', color: '#64748B' }}>
                        {fmtCompact(m.valor)} · {share.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div style={{
          background: '#F8FAFC', borderRadius: 12, padding: 16, border: '1px dashed #CBD5E1',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: 320,
        }}>
          <Package className="w-7 h-7 mb-2" style={{ color: '#94A3B8' }} />
          <p className="text-[13px] text-gray-600 font-medium m-0">Composición por categoría</p>
          <p className="text-[14px] text-gray-800 font-medium mt-1">Próximamente</p>
          <p className="text-[11px] text-gray-400 mt-2 italic text-center" style={{ maxWidth: 280 }}>
            Pendiente confirmar fuente de categorías
          </p>
        </div>
      </div>

      {/* Inventario en camino */}
      {!tieneCamino ? (
        <div style={{
          background: '#F8FAFC', borderRadius: 12, padding: '28px 16px', border: '1px dashed #CBD5E1',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        }}>
          <Ship className="w-8 h-8 mb-2" style={{ color: '#94A3B8' }} />
          <p className="text-[13px] text-gray-600 font-medium m-0">Inventario en camino</p>
          <p className="text-[16px] text-gray-800 font-medium mt-1">Sin datos cargados</p>
          <p className="text-[11px] text-gray-400 mt-2 italic text-center" style={{ maxWidth: 420 }}>
            Sube el ERP con la hoja Vw_TablaH_Compras para ver POs pendientes con valor MXN.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
            <p className="text-sm font-medium text-gray-800">
              <Ship className="inline w-4 h-4 mr-1" style={{ verticalAlign: -2 }} />
              Inventario en camino
            </p>
            <p className="text-[11px] text-gray-400">
              Vw_TablaH_Compras × Master Embarques · {fmtInt(totalPosEnCamino)} POs activas
            </p>
          </div>

          {/* Banner alerta PO en retraso */}
          {caminoRetrasadas.length > 0 && (
            <RetrasadasBanner retrasadas={caminoRetrasadas} />
          )}

          {/* Hero: 3 KPIs grandes (Valor / Lead time / Compras YTD vs prev) */}
          <CaminoHero
            valor={totalEnCamino}
            piezas={totalPiezasEnCamino}
            pos={totalPosEnCamino}
            inventarioStock={Number(inventario?.valor_inventario) || 0}
            leadtime={caminoLeadtime}
            comprasYTD={comprasYTD}
            anio={anio}
          />

          {/* Lead time por etapa */}
          {caminoLeadtime && caminoLeadtime.lt_total > 0 && (
            <LeadtimeEtapas lt={caminoLeadtime} />
          )}

          {/* Tiles por estatus */}
          <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1.5">Por estatus actual</p>
          <div className="grid gap-1.5 mb-4" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
            {BUCKET_ORDER.map((k) => {
              const cfg = BUCKET_LABELS[k];
              const r = resumenMap.get(k);
              const val = Number(r?.valor_mxn) || 0;
              const piezas = Number(r?.piezas) || 0;
              const pos = Number(r?.pos) || 0;
              return (
                <div key={k} style={{ background: cfg.palette.bg, borderRadius: 10, padding: '10px 12px' }}>
                  <p style={{ fontSize: 9, color: cfg.palette.mid, margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{cfg.label}</p>
                  <p style={{ fontSize: 18, fontWeight: 500, margin: '2px 0 0', color: cfg.palette.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                    {val > 0 ? fmtCompact(val) : '—'}
                  </p>
                  <p style={{ fontSize: 10, color: cfg.palette.mid, margin: '1px 0 0', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtInt(piezas)} pzs · {pos} PO
                  </p>
                </div>
              );
            })}
          </div>

          {/* Concentración semanal (próximas semanas) */}
          {caminoSemanal.length > 0 && (
            <ConcentracionSemanal semanas={caminoSemanal} />
          )}

          {/* 2 columnas: Top proveedores + SKUs agotados con orden */}
          {(caminoProveedores.length > 0 || caminoAgotados.length > 0) && (
            <div className="grid gap-2.5 mb-4" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
              {caminoProveedores.length > 0 && (
                <TopProveedores proveedores={caminoProveedores} totalCamino={totalEnCamino} />
              )}
              {caminoAgotados.length > 0 && (
                <AgotadosConOrden agotados={caminoAgotados} />
              )}
            </div>
          )}

          {/* Próximas PO */}
          {caminoProximas.length > 0 && (
            <>
              <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1.5">Próximas {Math.min(caminoProximas.length, 10)} POs en llegar</p>
              <div className="overflow-x-auto">
                <table className="w-full" style={{ fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: '#FAFBFC', borderBottom: '1px solid #E2E8F0' }}>
                      <th style={thLeft}>PO</th>
                      <th style={thLeft}>Proveedor</th>
                      <th style={thRight}>ETA CEDIS</th>
                      <th style={thRight}>SKUs</th>
                      <th style={thRight}>Piezas</th>
                      <th style={thRight}>Valor MXN</th>
                      <th style={thLeft}>Estatus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {caminoProximas.slice(0, 10).map((r) => {
                      const cfg = BUCKET_LABELS[r.bucket_estatus] || BUCKET_LABELS.otro;
                      const eta = r.eta_cedis || r.eta_puerto;
                      return (
                        <tr key={r.movid} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={tdLeft}>{r.movid}</td>
                          <td style={{ ...tdLeft, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.proveedor}>
                            {r.proveedor}
                          </td>
                          <td style={tdRight}>{eta ? new Date(eta).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '—'}</td>
                          <td style={tdRight}>{fmtInt(r.skus)}</td>
                          <td style={tdRight}>{fmtInt(r.piezas)}</td>
                          <td style={{ ...tdRight, fontWeight: 500 }}>{fmtCompact(r.valor_mxn)}</td>
                          <td style={tdLeft}>
                            <span style={{
                              fontSize: 10, padding: '1px 6px', borderRadius: 8,
                              background: cfg.palette.bg, color: cfg.palette.text,
                            }}>{cfg.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Sin embarque asignado */}
          {sinEmbarque && Number(sinEmbarque.valor_mxn) > 0 && (
            <div className="mt-4 p-3 rounded-lg flex items-center justify-between gap-3" style={{ background: PALETTE.gray.bg, border: `1px dashed ${PALETTE.gray.mid}` }}>
              <div>
                <p className="text-[11px] m-0 font-medium" style={{ color: PALETTE.gray.text }}>
                  {fmtInt(sinEmbarque.pos)} POs sin embarque asignado en Master
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: PALETTE.gray.mid }}>
                  Probablemente compras nacionales o aún sin mapear en Master Embarques.
                </p>
              </div>
              <span className="font-medium" style={{ fontSize: 14, color: PALETTE.gray.text, fontVariantNumeric: 'tabular-nums' }}>
                {fmtCompact(sinEmbarque.valor_mxn)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ────────── Sub-componentes del bloque 'Inventario en camino' ──────────

function RetrasadasBanner({ retrasadas }) {
  const total = retrasadas.reduce((s, r) => s + (Number(r.valor_mxn) || 0), 0);
  const top = retrasadas.slice(0, 2);
  const restante = retrasadas.length - top.length;
  return (
    <div style={{
      background: PALETTE.red.bg, border: `1px solid ${PALETTE.red.strong}`, borderRadius: 10,
      padding: '12px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <i className="ti ti-alert-triangle" style={{ fontSize: 22, color: PALETTE.red.mid, flex: 'none' }} aria-hidden="true" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, margin: 0, color: PALETTE.red.text, fontWeight: 500 }}>
          {retrasadas.length} {retrasadas.length === 1 ? 'PO' : 'POs'} en retraso · {fmtCompact(total)} atrapados
        </p>
        <p style={{ fontSize: 11, margin: '2px 0 0', color: PALETTE.red.mid }}>
          {top.map((r, i) => (
            <span key={r.movid}>
              {i > 0 && ' · '}
              <strong>{r.movid}</strong> {r.dias_retraso}d retraso ({r.dias_desde_emision}d desde emisión) {fmtCompact(r.valor_mxn)}
            </span>
          ))}
          {restante > 0 && ` · y ${restante} más`}
        </p>
      </div>
    </div>
  );
}

function CaminoHero({ valor, piezas, pos, inventarioStock, leadtime, comprasYTD, anio }) {
  const ratioStock = inventarioStock > 0 ? Math.round((valor / inventarioStock) * 100) : null;
  const ytdAct = comprasYTD.find((r) => r.anio === anio);
  const ytdPrev = comprasYTD.find((r) => r.anio === anio - 1);
  const valorYTD = Number(ytdAct?.valor_mxn) || 0;
  const valorYTDPrev = Number(ytdPrev?.valor_mxn) || 0;
  const deltaYoY = valorYTDPrev > 0 ? ((valorYTD - valorYTDPrev) / valorYTDPrev) * 100 : null;

  return (
    <div className="grid gap-2.5 mb-3.5" style={{ gridTemplateColumns: '1.6fr 1fr 1fr' }}>
      <div style={{ background: PALETTE.blue.bg, borderRadius: 12, padding: '14px 18px' }}>
        <p style={{ fontSize: 11, margin: 0, color: PALETTE.blue.mid, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Valor en tránsito</p>
        <p style={{ fontSize: 34, fontWeight: 500, margin: '4px 0 2px', color: PALETTE.blue.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
          {fmtCompact(valor)}
        </p>
        <p style={{ fontSize: 11, color: PALETTE.blue.mid, margin: 0 }}>
          {fmtInt(piezas)} piezas · {pos} órdenes{ratioStock != null ? ` · ${ratioStock}% del stock actual` : ''}
        </p>
      </div>
      <div style={{ background: PALETTE.amber.bg, borderRadius: 12, padding: '14px 18px' }}>
        <div className="flex items-center gap-1" style={{ marginBottom: 2 }}>
          <i className="ti ti-clock" style={{ fontSize: 12, color: PALETTE.amber.mid }} aria-hidden="true" />
          <p style={{ fontSize: 11, margin: 0, color: PALETTE.amber.mid, letterSpacing: '0.03em' }}>Lead time promedio</p>
        </div>
        <p style={{ fontSize: 24, fontWeight: 500, margin: '4px 0 2px', color: PALETTE.amber.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
          {leadtime?.lt_total != null ? `${leadtime.lt_total} días` : '—'}
        </p>
        <p style={{ fontSize: 11, color: PALETTE.amber.mid, margin: 0 }}>
          Emisión → arribo CEDIS
        </p>
      </div>
      <div style={{ background: PALETTE.purple.bg, borderRadius: 12, padding: '14px 18px' }}>
        <div className="flex items-center gap-1" style={{ marginBottom: 2 }}>
          <i className="ti ti-shopping-cart" style={{ fontSize: 12, color: PALETTE.purple.mid }} aria-hidden="true" />
          <p style={{ fontSize: 11, margin: 0, color: PALETTE.purple.mid, letterSpacing: '0.03em' }}>Compras YTD {anio}</p>
        </div>
        <p style={{ fontSize: 24, fontWeight: 500, margin: '4px 0 2px', color: PALETTE.purple.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
          {fmtCompact(valorYTD)}
        </p>
        <p style={{ fontSize: 11, margin: 0 }}>
          {deltaYoY != null && (
            <span style={{ color: deltaYoY >= 0 ? '#0F6E56' : '#A32D2D', fontWeight: 500 }}>
              {fmtPctDelta(deltaYoY)} vs {anio - 1}
            </span>
          )}
          {ytdAct && <span style={{ color: PALETTE.purple.mid }}> · {fmtInt(ytdAct.pos)} PO · {fmtInt(ytdAct.skus)} SKUs</span>}
        </p>
      </div>
    </div>
  );
}

function LeadtimeEtapas({ lt }) {
  const total = lt.lt_total || 1;
  const etapas = [
    { label: '1. Producción',       dias: lt.lt_produccion, color: '#BA7517' },
    { label: '2. Tránsito marítimo', dias: lt.lt_transito,   color: '#185FA5' },
    { label: '3. Aduana → CEDIS',    dias: lt.lt_aduana,     color: '#1D9E75' },
  ];
  return (
    <>
      <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1.5">Lead time desglosado por etapa</p>
      <div className="grid gap-1.5 mb-4" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {etapas.map((e) => {
          const pct = Math.round((e.dias / total) * 100);
          return (
            <div key={e.label} style={{ background: '#F8FAFC', borderRadius: 8, padding: '8px 12px' }}>
              <div className="flex items-center justify-between">
                <p style={{ fontSize: 10, margin: 0, color: '#6B6A64', textTransform: 'uppercase' }}>{e.label}</p>
                <span style={{ fontSize: 10, color: '#94A3B8' }}>~{pct}%</span>
              </div>
              <p style={{ fontSize: 18, fontWeight: 500, margin: '2px 0 0', color: '#1E293B', fontVariantNumeric: 'tabular-nums' }}>
                {e.dias} días
              </p>
              <div style={{ height: 4, background: '#E2E8F0', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                <div style={{ width: pct + '%', height: '100%', background: e.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function ConcentracionSemanal({ semanas }) {
  const data = semanas.map((r) => ({
    semana: new Date(r.semana).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }),
    valor: (Number(r.valor_mxn) || 0) / 1e6,
    pos: Number(r.pos) || 0,
    piezas: Number(r.piezas) || 0,
    skus: Number(r.skus) || 0,
  }));
  const max = Math.max(...data.map((d) => d.valor), 0);
  const colors = data.map((d) => d.valor === max && max > 0 ? PALETTE.coral.mid : PALETTE.blue.mid);
  const picoLabel = max > 0 ? data.find((d) => d.valor === max) : null;
  return (
    <>
      <div className="flex items-baseline justify-between mb-1.5">
        <p className="text-[10px] uppercase tracking-widest text-gray-500 m-0">Concentración semanal de llegadas</p>
        {picoLabel && (
          <p className="text-[10px] text-gray-400 m-0 italic">
            Pico: semana del {picoLabel.semana} · ${picoLabel.valor.toFixed(2)}M / {fmtInt(picoLabel.piezas)} pzs
          </p>
        )}
      </div>
      <div style={{ width: '100%', height: 200, marginBottom: 18 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="semana" tick={{ fontSize: 9, fill: '#6B6A64' }} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} />
            <YAxis tickFormatter={(v) => '$' + v + 'M'} tick={{ fontSize: 10, fill: '#6B6A64' }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v, name, p) => {
                if (name !== 'valor') return null;
                const d = p.payload;
                return ['$' + v.toFixed(2) + 'M MXN', `${d.pos} PO · ${fmtInt(d.skus)} SKUs · ${fmtInt(d.piezas)} pzs`];
              }}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Bar dataKey="valor" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {data.map((_, i) => <Cell key={i} fill={colors[i]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

function TopProveedores({ proveedores, totalCamino }) {
  const top5 = proveedores.slice(0, 5);
  const restante = proveedores.slice(5);
  const restanteVal = restante.reduce((s, p) => s + (Number(p.valor_mxn) || 0), 0);
  const restantePos = restante.reduce((s, p) => s + (Number(p.pos) || 0), 0);
  const topPct = totalCamino > 0 ? (top5.slice(0, 3).reduce((s, p) => s + (Number(p.valor_mxn) || 0), 0) / totalCamino) * 100 : 0;
  const topProvPct = totalCamino > 0 && top5[0] ? (Number(top5[0].valor_mxn) / totalCamino) * 100 : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <p className="text-[10px] uppercase tracking-widest text-gray-500 m-0">Top proveedores en tránsito</p>
        <p className="text-[10px] text-gray-400 m-0 italic">Top 3 = {topPct.toFixed(0)}%</p>
      </div>
      <table className="w-full" style={{ fontSize: 11, borderCollapse: 'collapse' }}>
        <tbody style={{ fontVariantNumeric: 'tabular-nums' }}>
          {top5.map((p, i) => {
            const pct = totalCamino > 0 ? (Number(p.valor_mxn) / totalCamino) * 100 : 0;
            const isTop = i === 0;
            const barColor = isTop ? PALETTE.red.mid : PALETTE.blue.mid;
            return (
              <tr key={p.proveedor} style={{ borderBottom: '0.5px solid #E2E8F0' }}>
                <td style={{ padding: '6px 8px', color: '#1E293B', fontWeight: isTop ? 500 : 400, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.proveedor}>
                  {p.proveedor}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: '#6B6A64' }}>{p.pos} PO</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', width: '45%' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, width: '100%' }}>
                    <span style={{ flex: 1, height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                      <span style={{ display: 'block', width: Math.min(pct, 100) + '%', height: '100%', background: barColor }} />
                    </span>
                    <span style={{ whiteSpace: 'nowrap', fontWeight: isTop ? 500 : 400 }}>
                      {fmtCompact(p.valor_mxn)} · {pct.toFixed(1)}%
                    </span>
                  </span>
                </td>
              </tr>
            );
          })}
          {restante.length > 0 && (
            <tr>
              <td style={{ padding: '6px 8px', color: '#1E293B' }}>Otros ({restante.length})</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#6B6A64' }}>{restantePos} PO</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, width: '100%' }}>
                  <span style={{ flex: 1, height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                    <span style={{ display: 'block', width: Math.min(totalCamino > 0 ? (restanteVal / totalCamino) * 100 : 0, 100) + '%', height: '100%', background: '#888780' }} />
                  </span>
                  <span style={{ whiteSpace: 'nowrap' }}>{fmtCompact(restanteVal)} · {totalCamino > 0 ? ((restanteVal / totalCamino) * 100).toFixed(1) : 0}%</span>
                </span>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {topProvPct >= 30 && (
        <p style={{ fontSize: 10, color: PALETTE.red.mid, margin: '6px 0 0', fontStyle: 'italic' }}>
          <i className="ti ti-alert-circle" style={{ fontSize: 11, verticalAlign: -1 }} aria-hidden="true" />{' '}
          Riesgo: {topProvPct.toFixed(1)}% concentrado en 1 proveedor
        </p>
      )}
    </div>
  );
}

function AgotadosConOrden({ agotados }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <p className="text-[10px] uppercase tracking-widest text-gray-500 m-0">SKUs agotados con orden</p>
        <p className="text-[10px] text-gray-400 m-0 italic">{agotados.length} agotados</p>
      </div>
      <div className="flex flex-col gap-1.5">
        {agotados.map((a) => {
          const sinOrden = a.dias_para_llegar === -1 || a.pzs_camino === 0;
          const vencido = a.dias_para_llegar === 0;
          const palette = sinOrden ? PALETTE.red : vencido ? PALETTE.amber : PALETTE.teal;
          const etaLabel = sinOrden ? 'Sin orden'
                          : vencido ? 'Vencido'
                          : `Llega en ${a.dias_para_llegar} día${a.dias_para_llegar === 1 ? '' : 's'}`;
          return (
            <div key={a.articulo} style={{
              background: palette.bg, borderLeft: `3px solid ${palette.mid}`, borderRadius: 6, padding: '8px 12px',
            }}>
              <div className="flex justify-between items-center" style={{ fontSize: 11 }}>
                <span style={{ fontWeight: 500, color: palette.text }}>{a.articulo}</span>
                <span style={{ color: palette.mid, fontWeight: 500 }}>{etaLabel}</span>
              </div>
              <p style={{ fontSize: 10, color: palette.mid, margin: '1px 0 0', fontVariantNumeric: 'tabular-nums' }}>
                {sinOrden ? 'Agotado · acción: emitir PO'
                          : `${fmtInt(a.pzs_camino)} piezas en camino${a.movid ? ` (${a.movid})` : ''}`}
                {a.eta_estimada && !sinOrden && ` · ETA ${new Date(a.eta_estimada).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════
// Bloque Sell Out
// ══════════════════════════════════════════════════
const CANAL_SELLOUT_META = {
  mayoreo:      { label: 'Mayoreo',       palette: PALETTE.blue,  nota: 'Con lag 90d · 13 mayoristas' },
  distribuidor: { label: 'Distribuidor',  palette: PALETTE.teal,  nota: 'Con lag 90d · Digitalife · PCEL · Dicotech' },
  directo:      { label: 'Venta directa', palette: PALETTE.coral, nota: 'Sin lag · Mostrador · E-com · Marketplaces' },
};

function SellOutBloque({
  sellCanal, sellCanalPrev, sellMayoristas, sellRotacion,
  sellMensual, sellMensualPrev, sellTopSkus, sellTopClientes,
  sellPromosResumen, sellPromosSkus, sellOutMes,
  anio, mesMax,
}) {
  const canalRows = useMemo(() => {
    const total = sellCanal.reduce((s, r) => s + (Number(r.importe) || 0), 0);
    const prevMap = new Map(sellCanalPrev.map((r) => [r.canal_sellout, Number(r.importe) || 0]));
    return ['mayoreo', 'distribuidor', 'directo'].map((k) => {
      const cur = sellCanal.find((r) => r.canal_sellout === k);
      const importe = Number(cur?.importe) || 0;
      const prev    = prevMap.get(k) || 0;
      return {
        key: k,
        importe, prev,
        share: total > 0 ? (importe / total) * 100 : 0,
        deltaYoY: prev > 0 ? ((importe - prev) / prev) * 100 : null,
        clientes: Number(cur?.clientes_finales) || 0,
        skus: Number(cur?.skus) || 0,
      };
    });
  }, [sellCanal, sellCanalPrev]);

  const totalYTD = canalRows.reduce((s, r) => s + r.importe, 0);

  const rotacionAlertas = useMemo(() => {
    return sellRotacion
      .filter((r) => Number(r.sellin_lag_90d) > 0 && Number(r.rotacion_pct) < 70)
      .sort((a, b) => Number(a.rotacion_pct) - Number(b.rotacion_pct))
      .slice(0, 5);
  }, [sellRotacion]);

  const serie12m = useMemo(() => {
    const sumar = (rows) => {
      const arr = Array(12).fill(0);
      rows.forEach((r) => {
        const m = Number(r.mes);
        if (m >= 1 && m <= 12) arr[m - 1] += Number(r.importe) || 0;
      });
      return arr;
    };
    const act = sumar(sellMensual);
    const prv = sumar(sellMensualPrev);
    return Array.from({ length: 12 }, (_, i) => ({
      mes: MESES_LBL[i],
      [`${anio}`]: act[i] || null,
      [`${anio - 1}`]: prv[i] || null,
    }));
  }, [sellMensual, sellMensualPrev, anio]);

  const mayoristaMax = Math.max(...sellMayoristas.map((m) => Number(m.importe) || 0), 1);

  const hayDatos = totalYTD > 0 || sellMayoristas.length > 0;

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between px-1">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-1">Bloque · Sell Out</p>
          <h3 className="text-lg font-medium text-gray-800">Sell out del canal</h3>
        </div>
        <span className="text-xs text-gray-500">Ajustado por 90 días de crédito · {anio}</span>
      </div>

      {!hayDatos && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 p-4 text-sm">
          Aún no hay datos de <code>sellout_general</code> en Supabase.
          Sube el archivo Sellout General.xlsx en <code>/uploads.html</code> para activar este bloque.
        </div>
      )}

      {/* ① KPIs globales */}
      <div className="grid grid-cols-4 gap-2.5">
        <BentoKpi palette={PALETTE.coral} icon={ShoppingBag} label={`Sell-out ${MESES_LBL[mesMax - 1]}`}
          valor={fmtCompact(sellOutMes.total)}
          delta={sellOutMes.deltaYoY}
          deltaLabel={`vs ${MESES_LBL[mesMax - 1]} ${anio - 1}`}
          subtitulo={<span>{fmtCompact(sellOutMes.prev)} en {anio - 1}</span>} />
        <BentoKpi palette={PALETTE.blue} icon={TrendingUp} label="Sell-out YTD"
          valor={fmtCompact(sellOutMes.ytd)}
          delta={sellOutMes.deltaYTD}
          deltaLabel="YoY"
          subtitulo={<span>{fmtCompact(sellOutMes.ytdPrev)} en {anio - 1}</span>} />
        <BentoKpi palette={PALETTE.teal} icon={Activity} label="Rotación del canal"
          valor={sellOutMes.rotacionYTD != null ? fmtPct(sellOutMes.rotacionYTD) : '—'}
          delta={null}
          subtitulo={<span>{fmtCompact(sellOutMes.sellOutYtdMayoreo)} / {fmtCompact(sellOutMes.sellinLag)} sell-in Q1</span>} />
        <BentoKpi palette={PALETTE.purple} icon={ShoppingBag} label="Clientes finales activos"
          valor={fmtInt(sellTopClientes.length > 0
            ? canalRows.reduce((s, r) => s + r.clientes, 0)
            : 0)}
          delta={null}
          subtitulo={<span>en {sellMayoristas.length || '—'} mayoristas</span>} />
      </div>

      {/* ② Sell-out por canal */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-800">Sell-out por canal</h4>
          <span className="text-xs text-gray-500">YTD {anio}</span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {canalRows.map((c) => {
            const meta = CANAL_SELLOUT_META[c.key];
            const pal = meta.palette;
            const rotCanal = c.key === 'directo' ? 100 : null;
            return (
              <div key={c.key} className="rounded-xl p-3" style={{ background: pal.bg }}>
                <div className="text-[10px] font-medium uppercase tracking-wider" style={{ color: pal.mid }}>
                  {meta.label}
                </div>
                <div className="text-2xl font-medium mt-1" style={{ color: pal.text }}>
                  {fmtCompact(c.importe)}
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: pal.mid }}>
                  {fmtPct(c.share)} del total{c.deltaYoY != null && ` · ${fmtPctDelta(c.deltaYoY)} YoY`}
                </div>
                <div className="text-[10px] mt-2 pt-2 border-t" style={{ borderColor: pal.soft || pal.mid + '30', color: pal.text }}>
                  {rotCanal != null ? `Rotación ${fmtPct(rotCanal)} · sin lag` : meta.nota}
                </div>
                <div className="text-[10px] mt-1" style={{ color: pal.mid }}>
                  {fmtInt(c.clientes)} clientes · {fmtInt(c.skus)} SKUs
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ③ Ranking mayoristas */}
      {sellMayoristas.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-800">Ranking de mayoristas</h4>
            <span className="text-xs text-gray-500">{sellMayoristas.length} activos</span>
          </div>
          <div className="space-y-2">
            {sellMayoristas.slice(0, 13).map((m, i) => {
              const w = mayoristaMax > 0 ? (Number(m.importe) / mayoristaMax) * 100 : 0;
              return (
                <div key={m.mayorista} className="grid items-center gap-2 text-xs"
                  style={{ gridTemplateColumns: '24px 180px 1fr auto' }}>
                  <span className="text-gray-400">#{i + 1}</span>
                  <span className="text-gray-800 truncate">{m.mayorista}</span>
                  <div className="bg-gray-100 rounded h-3 relative">
                    <div className="absolute left-0 top-0 h-3 rounded"
                      style={{ background: PALETTE.blue.mid, width: `${Math.max(2, w)}%` }} />
                  </div>
                  <span className="text-gray-800 font-medium text-right whitespace-nowrap">
                    {fmtCompact(m.importe)}
                    <span className="ml-1 text-gray-400">
                      · {totalYTD > 0 ? fmtPct((Number(m.importe) / totalYTD) * 100) : '—'}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ④ Alerta rotación baja */}
      {rotacionAlertas.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-800">Rotación &lt; 70% (con 90 días de crédito)</h4>
            <span className="text-xs text-rose-700">{rotacionAlertas.length} con riesgo</span>
          </div>
          <div className="space-y-1.5">
            {rotacionAlertas.map((r) => {
              const rot = Number(r.rotacion_pct);
              const critico = rot < 60;
              return (
                <div key={r.mayorista}
                  className={`rounded-lg p-2.5 flex justify-between items-center ${
                    critico ? 'bg-rose-50 border border-rose-200' : 'bg-amber-50 border border-amber-200'
                  }`}>
                  <div>
                    <div className={`text-xs font-medium ${critico ? 'text-rose-800' : 'text-amber-800'}`}>{r.mayorista}</div>
                    <div className={`text-[10px] ${critico ? 'text-rose-700' : 'text-amber-700'}`}>
                      Sell-in Q1 {fmtCompact(r.sellin_lag_90d)} · Sell-out YTD {fmtCompact(r.sellout_ytd)} · Rotación {fmtPct(rot)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${critico ? 'text-rose-800' : 'text-amber-800'}`}>
                      {fmtCompact(r.sin_rotar)}
                    </div>
                    <div className={`text-[10px] ${critico ? 'text-rose-700' : 'text-amber-700'}`}>sin rotar</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ⑤ Tendencia mensual */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-800">Sell-out mensual {anio} vs {anio - 1}</h4>
          <div className="text-[11px] text-gray-500">
            <span className="inline-block w-2.5 h-2.5 mr-1 align-middle rounded-sm" style={{ background: PALETTE.coral.mid }} /> {anio}
            <span className="ml-2 inline-block w-2.5 h-2.5 mr-1 align-middle rounded-sm" style={{ background: PALETTE.coral.soft || PALETTE.coral.mid + '60' }} /> {anio - 1}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={serie12m} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#888' }} />
            <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 11, fill: '#888' }} width={50} />
            <Tooltip formatter={(v) => v == null ? '—' : fmtMoney(v)} />
            <Line type="monotone" dataKey={`${anio - 1}`} stroke={PALETTE.coral.soft || '#F5C4B3'} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey={`${anio}`} stroke={PALETTE.coral.mid} strokeWidth={2.5} dot={{ r: 3, fill: PALETTE.coral.mid }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ⑥ + ⑦ Top SKUs + Top clientes finales */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <h4 className="text-sm font-medium text-gray-800 mb-3">Top 10 SKUs por sell-out YTD</h4>
          {sellTopSkus.length === 0 ? (
            <div className="text-xs text-gray-500">Sin datos.</div>
          ) : (
            <div className="space-y-1">
              {sellTopSkus.map((s, i) => (
                <div key={s.sku} className="flex items-baseline gap-2 text-xs">
                  <span className="text-gray-400 w-5">{i + 1}</span>
                  <span className="font-mono text-gray-700 flex-1 truncate">{s.sku}</span>
                  <span className="text-gray-400 tabular-nums">{fmtInt(s.clientes)} cli</span>
                  <span className="text-gray-800 font-medium tabular-nums w-16 text-right">{fmtCompact(s.importe)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <h4 className="text-sm font-medium text-gray-800 mb-3">Top 10 clientes finales</h4>
          {sellTopClientes.length === 0 ? (
            <div className="text-xs text-gray-500">Sin datos.</div>
          ) : (
            <div className="space-y-1">
              {sellTopClientes.map((c, i) => (
                <div key={c.cliente_final} className="flex items-baseline gap-2 text-xs">
                  <span className="text-gray-400 w-5">{i + 1}</span>
                  <span className="text-gray-700 flex-1 truncate" title={c.cliente_final}>{c.cliente_final}</span>
                  <span className="text-gray-400 tabular-nums text-[10px]">{fmtInt(c.mayoristas_o_canales)} vía</span>
                  <span className="text-gray-800 font-medium tabular-nums w-16 text-right">{fmtCompact(c.importe)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ⑧ Mes actual vs mismo mes año pasado */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-800">
            {MESES_FULL[mesMax - 1]} {anio} vs {MESES_FULL[mesMax - 1]} {anio - 1}
          </h4>
          <span className="text-xs text-gray-500">estacional</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center py-3 rounded-lg" style={{ background: PALETTE.blue.bg }}>
            <div className="text-[10px] tracking-widest" style={{ color: PALETTE.blue.mid }}>
              {MESES_LBL[mesMax - 1].toUpperCase()} {anio - 1}
            </div>
            <div className="text-2xl font-medium mt-1" style={{ color: PALETTE.blue.text }}>{fmtCompact(sellOutMes.prev)}</div>
          </div>
          <div className={`text-center py-3 rounded-lg ${sellOutMes.deltaYoY != null && sellOutMes.deltaYoY >= 0 ? 'bg-emerald-50' : 'bg-rose-50'}`}>
            <div className={`text-[10px] tracking-widest ${sellOutMes.deltaYoY != null && sellOutMes.deltaYoY >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {MESES_LBL[mesMax - 1].toUpperCase()} {anio}
            </div>
            <div className={`text-2xl font-medium mt-1 ${sellOutMes.deltaYoY != null && sellOutMes.deltaYoY >= 0 ? 'text-emerald-900' : 'text-rose-900'}`}>
              {fmtCompact(sellOutMes.total)}
            </div>
            {sellOutMes.deltaYoY != null && (
              <div className={`text-[11px] mt-1 ${sellOutMes.deltaYoY >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {fmtCompact(sellOutMes.total - sellOutMes.prev)} ({fmtPctDelta(sellOutMes.deltaYoY)})
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ⑨ Efectividad de promos por temporada */}
      {sellPromosResumen && sellPromosResumen.campania && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-800">Efectividad de promos por temporada</h4>
            <span className="text-xs text-gray-500">{MESES_FULL[mesMax - 1]} {anio}</span>
          </div>
          <div className="grid grid-cols-4 gap-2 mb-3">
            <div className="rounded-lg p-3" style={{ background: PALETTE.amber.bg }}>
              <div className="text-[10px] tracking-widest" style={{ color: PALETTE.amber.mid }}>CAMPAÑA</div>
              <div className="text-sm font-medium mt-1" style={{ color: PALETTE.amber.text }}>{sellPromosResumen.campania}</div>
              <div className="text-[11px] mt-1" style={{ color: PALETTE.amber.mid }}>
                {fmtInt(sellPromosResumen.skus_campania)} SKUs
              </div>
            </div>
            <div className="rounded-lg p-3" style={{ background: PALETTE.gray.bg }}>
              <div className="text-[10px] tracking-widest" style={{ color: PALETTE.gray.mid }}>SELLOUT EN PROMO</div>
              <div className="text-base font-medium mt-1" style={{ color: PALETTE.gray.text }}>{fmtCompact(sellPromosResumen.sellout_en_promo)}</div>
              <div className="text-[11px] mt-1" style={{ color: PALETTE.gray.mid }}>
                {(() => {
                  const total = (Number(sellPromosResumen.sellout_en_promo) || 0) + (Number(sellPromosResumen.sellout_fuera_promo) || 0);
                  return total > 0 ? fmtPct((Number(sellPromosResumen.sellout_en_promo) / total) * 100) : '—';
                })()} del total
              </div>
            </div>
            <div className="rounded-lg p-3" style={{ background: PALETTE.gray.bg }}>
              <div className="text-[10px] tracking-widest" style={{ color: PALETTE.gray.mid }}>SELLOUT FUERA</div>
              <div className="text-base font-medium mt-1" style={{ color: PALETTE.gray.text }}>{fmtCompact(sellPromosResumen.sellout_fuera_promo)}</div>
            </div>
            <div className="rounded-lg p-3 bg-emerald-50">
              <div className="text-[10px] tracking-widest text-emerald-700">LIFT VS MES ANTERIOR</div>
              {(() => {
                const cur = Number(sellPromosResumen.sellout_en_promo) || 0;
                const prev = Number(sellPromosResumen.sellout_promo_mes_prev) || 0;
                const lift = prev > 0 ? ((cur - prev) / prev) * 100 : null;
                return (
                  <>
                    <div className="text-base font-medium mt-1 text-emerald-900">{lift != null ? fmtPctDelta(lift) : '—'}</div>
                    <div className="text-[11px] mt-1 text-emerald-700">{fmtCompact(prev)} → {fmtCompact(cur)}</div>
                  </>
                );
              })()}
            </div>
          </div>
          {sellPromosSkus.length > 0 && (
            <>
              <div className="text-[11px] text-gray-600 font-medium mb-2">Top 5 SKUs de la campaña</div>
              <div className="space-y-1">
                {sellPromosSkus.map((s, i) => (
                  <div key={s.sku} className="grid gap-2 items-baseline text-xs"
                    style={{ gridTemplateColumns: '24px 1fr auto auto auto' }}>
                    <span className="text-gray-400">{i + 1}</span>
                    <span className="font-mono text-gray-700">{s.sku}</span>
                    <span className="text-gray-500 text-right">{s.promo_pct != null ? `${(Number(s.promo_pct) * 100).toFixed(0)}% off` : '—'}</span>
                    <span className="text-gray-500 text-right">{fmtInt(s.piezas)} pz</span>
                    <span className="text-gray-800 font-medium text-right w-16">{fmtCompact(s.importe)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

// ────────── Estilos comunes ──────────
const thLeft = { padding: '8px 12px', textAlign: 'left', fontWeight: 500, color: '#6B6A64', fontSize: 11, whiteSpace: 'nowrap' };
const thRight = { padding: '8px 8px', textAlign: 'right', fontWeight: 500, color: '#6B6A64', fontSize: 11, whiteSpace: 'nowrap' };
const tdLeft = { padding: '8px 12px', color: '#334155', fontSize: 12 };
const tdRight = { padding: '8px 8px', textAlign: 'right', color: '#1E293B', fontSize: 12, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
