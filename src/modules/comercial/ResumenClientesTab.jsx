import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatMXN } from '../../lib/utils';
import {
  BarChart3, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  DollarSign, Package, Clock, Target, ArrowRight,
} from 'lucide-react';

/**
 * Resumen Clientes v2 — Dashboard ejecutivo de salud comercial
 * ─────────────────────────────────────────────────────────────
 * - Health Score ponderado por cliente (5 componentes)
 * - Alertas cross-cliente (pagos vencidos, cuotas bajas, inventario crítico)
 * - Ranking comparativo MoM
 * - Trend consolidado 12 meses (Sell-In vs Sell-Out)
 *
 * Solo los 3 clientes que gestiona Fernando directamente.
 */

const CLIENTES = [
  { key: 'digitalife',   nombre: 'Digitalife',    marca: 'Acteck / Balam Rush', color: '#3B82F6' },
  { key: 'pcel',         nombre: 'PCEL',          marca: 'Acteck',               color: '#EF4444' },
  { key: 'mercadolibre', nombre: 'Mercado Libre', marca: 'Balam Rush',           color: '#F59E0B' },
];

const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

// Pesos del Health Score
const PESOS = {
  cuota:      30,
  inventario: 25,
  dso:        20,
  vencidos:   15,
  marketing:  10,
};

// Umbrales de alertas
const UMBRAL_VENCIDO_ALERTA   = 100000;  // MXN
const UMBRAL_DSO_ALERTA       = 60;      // días
const UMBRAL_CUMPLIMIENTO_OK  = 90;      // %

// ────────── Helpers ──────────
const hoy = new Date();
const anioActual = hoy.getFullYear();
const mesActual = hoy.getMonth() + 1;

function clamp(n, min = 0, max = 100) { return Math.max(min, Math.min(max, n)); }
function pct(n) { return Number.isFinite(n) ? `${n.toFixed(0)}%` : '—'; }

function colorScore(s) {
  if (s == null) return '#94A3B8';
  if (s >= 80) return '#10B981';
  if (s >= 60) return '#F59E0B';
  return '#EF4444';
}

function gradeScore(s) {
  if (s == null) return 'Sin datos';
  if (s >= 85) return 'Excelente';
  if (s >= 70) return 'Bueno';
  if (s >= 55) return 'Regular';
  if (s >= 40) return 'En riesgo';
  return 'Crítico';
}

// ────────── Hook: data loader ──────────
// Usa las MISMAS fuentes que las pestañas per-cliente:
//   - v_ventas_mensuales_agg: agrega sell_in_sku + sellout_sku por cliente/mes (= HomeCliente)
//   - cuotas_mensuales: cuota_min y cuota_ideal por cliente/mes
//   - inventario_cliente: snapshot semanal con campo valor (MXN)
//   - estados_cuenta: último corte por cliente (DSO, saldo_vencido, aging)
function useResumenData() {
  const [state, setState] = useState({
    loading: true,
    ventasAgg: [],
    cuotasMensuales: [],
    inventarioCliente: [],
    estadosCuenta: [],
    inversionMkt: [],
  });

  useEffect(() => {
    (async () => {
      const [vaRes, cmRes, invRes, ecRes, mkRes] = await Promise.all([
        // Últimos 2 años para trend y MoM
        supabase.from('v_ventas_mensuales_agg')
          .select('cliente, anio, mes, sell_in, sell_out')
          .gte('anio', anioActual - 1),
        supabase.from('cuotas_mensuales')
          .select('cliente, mes, anio, cuota_min, cuota_ideal')
          .eq('anio', anioActual),
        supabase.from('inventario_cliente')
          .select('cliente, anio, semana, stock, valor')
          .order('anio', { ascending: false })
          .order('semana', { ascending: false })
          .limit(10000),
        supabase.from('estados_cuenta')
          .select('cliente, anio, semana, fecha_corte, saldo_actual, saldo_vencido, dso, aging_mas90')
          .order('fecha_corte', { ascending: false }),
        supabase.from('inversion_marketing')
          .select('cliente, anio, mes, monto')
          .eq('anio', anioActual),
      ]);

      setState({
        loading: false,
        ventasAgg:         vaRes.data  || [],
        cuotasMensuales:   cmRes.data  || [],
        inventarioCliente: invRes.data || [],
        estadosCuenta:     ecRes.data  || [],
        inversionMkt:      mkRes.data  || [],
      });
    })();
  }, []);

  return state;
}

// ────────── Cálculo del Health Score por cliente ──────────
// Alineado con HomeCliente.jsx (pestaña per-cliente):
//   - Sell-In YTD   = SUM(v_ventas_mensuales_agg.sell_in)  donde cliente y anio=actual, mes<=actual
//   - Sell-Out YTD  = SUM(v_ventas_mensuales_agg.sell_out) igual
//   - Cuota YTD     = SUM(cuotas_mensuales.cuota_min) mes<=actual
//   - Cuota anual   = SUM(cuotas_mensuales.cuota_min) todo el año
//   - Cumplimiento YTD = Sell-In YTD / Cuota YTD × 100
//   - Avance anual  = Sell-In YTD / Cuota anual × 100
//   - Inventario    = SUM(inventario_cliente.valor) del último snapshot (anio, semana máximos)
//   - Cobertura sem = valor / (sell_out_mensual_promedio / 4.33)
function calcularResumen(clienteKey, data) {
  const va = data.ventasAgg.filter((r) => r.cliente === clienteKey);
  const cm = data.cuotasMensuales.filter((r) => r.cliente === clienteKey);
  const inv = data.inventarioCliente.filter((r) => r.cliente === clienteKey);
  const ec = data.estadosCuenta.filter((r) => r.cliente === clienteKey);
  const mk = data.inversionMkt.filter((r) => r.cliente === clienteKey);

  // ── Sell-In / Sell-Out YTD y mes actual ──
  const vaAnio = va.filter((r) => r.anio === anioActual);
  const siYTD = vaAnio
    .filter((r) => Number(r.mes) <= mesActual)
    .reduce((a, r) => a + Number(r.sell_in || 0), 0);
  const soYTD = vaAnio
    .filter((r) => Number(r.mes) <= mesActual)
    .reduce((a, r) => a + Number(r.sell_out || 0), 0);

  const rowMesActual = vaAnio.find((r) => Number(r.mes) === mesActual);
  const mesPrevNum   = mesActual === 1 ? 12 : mesActual - 1;
  const anioPrev     = mesActual === 1 ? anioActual - 1 : anioActual;
  const rowMesPrev   = va.find((r) => Number(r.mes) === mesPrevNum && r.anio === anioPrev);

  const siMes     = Number(rowMesActual?.sell_in  || 0);
  const siMesPrev = Number(rowMesPrev?.sell_in    || 0);
  const soMes     = Number(rowMesActual?.sell_out || 0);
  const siMoM = siMesPrev > 0 ? ((siMes - siMesPrev) / siMesPrev) * 100 : null;

  // ── Cuota YTD y anual ──
  const cuotaYTD = cm
    .filter((r) => Number(r.mes) <= mesActual)
    .reduce((a, r) => a + Number(r.cuota_min || 0), 0);
  const cuotaAnual = cm.reduce((a, r) => a + Number(r.cuota_min || 0), 0);
  const cuotaIdealAnual = cm.reduce((a, r) => a + Number(r.cuota_ideal || 0), 0);
  const cuotaMesRow = cm.find((r) => Number(r.mes) === mesActual);
  const cuotaMes = Number(cuotaMesRow?.cuota_min || 0);

  const cumplimientoYTD = cuotaYTD > 0 ? (siYTD / cuotaYTD) * 100 : null;   // vs cuota acumulada
  const avanceAnual     = cuotaAnual > 0 ? (siYTD / cuotaAnual) * 100 : null; // % del año
  const cumplMesActual  = cuotaMes  > 0 ? (siMes / cuotaMes)  * 100 : null;

  // ── Inventario del último snapshot (anio + semana más reciente) ──
  let inventarioValor = 0;
  let inventarioPiezas = 0;
  let inventarioSemana = null;
  if (inv.length > 0) {
    // inv ya viene ordenado DESC por anio, semana
    const latest = inv.find((r) => r.anio != null && r.semana != null);
    if (latest) {
      const anioLatest = latest.anio;
      const semLatest  = latest.semana;
      const snap = inv.filter((r) => r.anio === anioLatest && r.semana === semLatest);
      inventarioValor  = snap.reduce((a, r) => a + Number(r.valor || 0), 0);
      inventarioPiezas = snap.reduce((a, r) => a + Number(r.stock || 0), 0);
      inventarioSemana = `${anioLatest}-${String(semLatest).padStart(2,'0')}`;
    }
  }

  // Cobertura en semanas: valor / (sell_out_mensual_promedio_3m / 4.33)
  // Si no hay sell_out (ej. ML) NO calculamos cobertura — score queda null
  const soUlt3m = vaAnio
    .filter((r) => Number(r.mes) >= Math.max(1, mesActual - 2) && Number(r.mes) <= mesActual)
    .reduce((a, r) => a + Number(r.sell_out || 0), 0);
  const soMensualProm = soUlt3m / 3;
  const inventarioSemanas = (soMensualProm > 0 && inventarioValor > 0)
    ? inventarioValor / (soMensualProm / 4.33)
    : null;

  // ── Estado de cuenta más reciente ──
  const ecLatest = ec[0];
  const saldoVencido = Number(ecLatest?.saldo_vencido || 0);
  const saldoActual  = Number(ecLatest?.saldo_actual  || 0);
  const dso          = Number(ecLatest?.dso           || 0);
  const aging90      = Number(ecLatest?.aging_mas90   || 0);
  const pctVencido   = saldoActual > 0 ? (saldoVencido / saldoActual) * 100 : 0;

  // ── Inversión marketing YTD y ROI ──
  const invMktYTD = mk.reduce((a, r) => a + Number(r.monto || 0), 0);
  const roiMkt = invMktYTD > 0 ? soYTD / invMktYTD : null;

  // ───── Score por componente (0–100) ─────
  // 1) Cumplimiento cuota YTD (lo más importante)
  const scoreCuota = cuotaYTD > 0 ? clamp(cumplimientoYTD, 0, 100) : null;

  // 2) Cobertura inventario: 8 semanas = 100, 2 = 0, lineal
  const scoreInv = inventarioSemanas != null
    ? clamp(((inventarioSemanas - 2) / 6) * 100, 0, 100)
    : null;

  // 3) DSO: ≤30d = 100, 60d = 50, ≥90d = 0
  const scoreDSO = dso > 0
    ? clamp(((90 - dso) / 60) * 100, 0, 100)
    : null;

  // 4) Pagos vencidos: 0% = 100, 10% = 0
  const scoreVen = saldoActual > 0
    ? clamp(((10 - pctVencido) / 10) * 100, 0, 100)
    : null;

  // 5) ROI marketing: ≥10 = 100, ≤2 = 0
  const scoreMkt = roiMkt != null
    ? clamp(((roiMkt - 2) / 8) * 100, 0, 100)
    : null;

  const componentes = [
    { id: 'cuota',      score: scoreCuota, peso: PESOS.cuota      },
    { id: 'inventario', score: scoreInv,   peso: PESOS.inventario },
    { id: 'dso',        score: scoreDSO,   peso: PESOS.dso        },
    { id: 'vencidos',   score: scoreVen,   peso: PESOS.vencidos   },
    { id: 'marketing',  score: scoreMkt,   peso: PESOS.marketing  },
  ];
  const activos = componentes.filter((c) => c.score != null);
  const pesoTotal = activos.reduce((a, c) => a + c.peso, 0);
  const healthScore = pesoTotal > 0
    ? activos.reduce((a, c) => a + c.score * c.peso, 0) / pesoTotal
    : null;

  return {
    healthScore,
    componentes,
    siYTD, soYTD,
    siMes, siMesPrev, siMoM,
    soMes,
    cuotaMes, cumplMesActual,
    cuotaYTD, cumplimientoYTD,
    cuotaAnual, cuotaIdealAnual, avanceAnual,
    saldoVencido, saldoActual, dso, aging90, pctVencido,
    inventarioValor, inventarioPiezas, inventarioSemana, inventarioSemanas,
    soMensualProm,
    invMktYTD, roiMkt,
  };
}

// ────────── Trend consolidado 12 meses ──────────
function calcularTrend(data) {
  const meses = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(anioActual, mesActual - 1 - i, 1);
    meses.push({ anio: d.getFullYear(), mes: d.getMonth() + 1 });
  }
  return meses.map(({ anio, mes }) => {
    let si = 0, so = 0;
    data.ventasAgg.forEach((r) => {
      if (r.anio !== anio) return;
      if (Number(r.mes) !== mes) return;
      si += Number(r.sell_in || 0);
      so += Number(r.sell_out || 0);
    });
    return {
      label: `${MESES_CORTO[mes - 1]} ${String(anio).slice(2)}`,
      sell_in: si,
      sell_out: so,
    };
  });
}

// ────────── Alertas cross-cliente ──────────
function calcularAlertas(resumenes) {
  const alertas = [];
  resumenes.forEach(({ cliente, resumen }) => {
    if (resumen.saldoVencido >= UMBRAL_VENCIDO_ALERTA) {
      alertas.push({
        tipo: 'vencido',
        cliente: cliente.nombre,
        mensaje: `${formatMXN(resumen.saldoVencido)} vencidos`,
        severidad: 'alta',
      });
    }
    if (resumen.dso >= UMBRAL_DSO_ALERTA) {
      alertas.push({
        tipo: 'dso',
        cliente: cliente.nombre,
        mensaje: `DSO alto: ${resumen.dso} días`,
        severidad: 'media',
      });
    }
    if (resumen.cumplimientoYTD != null && resumen.cumplimientoYTD < 70) {
      alertas.push({
        tipo: 'cuota',
        cliente: cliente.nombre,
        mensaje: `Cuota YTD al ${resumen.cumplimientoYTD.toFixed(0)}%`,
        severidad: 'alta',
      });
    }
    if (resumen.inventarioSemanas != null && resumen.inventarioSemanas < 2) {
      alertas.push({
        tipo: 'inventario',
        cliente: cliente.nombre,
        mensaje: `Inventario crítico: ${resumen.inventarioSemanas.toFixed(1)} sem`,
        severidad: 'alta',
      });
    }
  });
  return alertas;
}

// ────────── Componente principal ──────────
export default function ResumenClientesTab({ onDrillDown }) {
  const data = useResumenData();

  const resumenes = useMemo(() => {
    if (data.loading) return [];
    return CLIENTES.map((c) => ({
      cliente: c,
      resumen: calcularResumen(c.key, data),
    }));
  }, [data]);

  const trend   = useMemo(() => data.loading ? [] : calcularTrend(data),   [data]);
  const alertas = useMemo(() => calcularAlertas(resumenes), [resumenes]);

  if (data.loading) {
    return (
      <div className="p-6">
        <div className="text-gray-400 text-sm">Cargando resumen de clientes…</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-gray-700" />
          Resumen de Clientes
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Dashboard ejecutivo de los 3 clientes que gestionas directamente · Actualizado {hoy.toLocaleDateString('es-MX')}
        </p>
      </div>

      {/* Alertas cross-cliente */}
      {alertas.length > 0 && (
        <div className="bg-gradient-to-r from-red-50 via-amber-50 to-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="font-semibold text-red-800">
              {alertas.length} alerta{alertas.length !== 1 ? 's' : ''} requieren tu atención
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {alertas.map((a, i) => (
              <span
                key={i}
                className={[
                  'text-xs px-2.5 py-1 rounded-full border font-medium',
                  a.severidad === 'alta'
                    ? 'bg-red-100 border-red-300 text-red-800'
                    : 'bg-amber-100 border-amber-300 text-amber-800',
                ].join(' ')}
              >
                <strong>{a.cliente}:</strong> {a.mensaje}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 3 cards con Health Score */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {resumenes.map(({ cliente, resumen }) => (
          <ClienteCard
            key={cliente.key}
            cliente={cliente}
            resumen={resumen}
            onDrillDown={() => onDrillDown?.(cliente.key)}
          />
        ))}
      </div>

      {/* Ranking comparativo */}
      <RankingComparativo resumenes={resumenes} />

      {/* Trend consolidado */}
      <TrendConsolidado trend={trend} />
    </div>
  );
}

// ────────── Card por cliente ──────────
function ClienteCard({ cliente, resumen, onDrillDown }) {
  const s = resumen.healthScore;
  const color = colorScore(s);

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
      style={{ borderTop: `4px solid ${cliente.color}` }}
      onClick={onDrillDown}
    >
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-start justify-between">
        <div>
          <h3 className="font-bold text-gray-800 text-lg">{cliente.nombre}</h3>
          <p className="text-xs text-gray-500">{cliente.marca}</p>
        </div>
        <ArrowRight className="w-4 h-4 text-gray-400" />
      </div>

      {/* Score grande */}
      <div className="px-5 pb-3 flex items-center gap-4">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center shrink-0 relative"
          style={{
            background: `conic-gradient(${color} ${(s || 0) * 3.6}deg, #E5E7EB 0deg)`,
          }}
        >
          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center">
            <div className="text-center">
              <div className="text-xl font-bold leading-none" style={{ color }}>
                {s != null ? s.toFixed(0) : '—'}
              </div>
              <div className="text-[9px] uppercase tracking-wide text-gray-500 mt-0.5">
                Score
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold" style={{ color }}>
            {gradeScore(s)}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            Salud comercial general
          </div>
        </div>
      </div>

      {/* Breakdown de componentes */}
      <div className="px-5 pb-3 space-y-1.5">
        {resumen.componentes.map((c) => (
          <ComponenteBar key={c.id} id={c.id} score={c.score} peso={c.peso} />
        ))}
      </div>

      {/* KPIs: Sell-In YTD + cumplimiento */}
      <div className="border-t border-gray-100 px-5 py-3 space-y-2">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[10px] uppercase text-gray-500 tracking-wide">Sell-In YTD</div>
            <div className="font-bold text-gray-800 text-base">{formatMXN(resumen.siYTD)}</div>
          </div>
          {resumen.cumplimientoYTD != null && (
            <div className="text-right">
              <div className="text-[10px] uppercase text-gray-500 tracking-wide">Cumpl. YTD</div>
              <div className="font-bold text-base" style={{ color: colorScore(resumen.cumplimientoYTD) }}>
                {pct(resumen.cumplimientoYTD)}
              </div>
            </div>
          )}
        </div>
        {resumen.siMoM != null && <MoMIndicator pct={resumen.siMoM} />}

        {resumen.cuotaAnual > 0 && (
          <div>
            <div className="flex items-center justify-between text-[10px] text-gray-500">
              <span>Avance vs cuota anual</span>
              <span className="font-semibold" style={{ color: colorScore(resumen.avanceAnual) }}>
                {pct(resumen.avanceAnual)}
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
              <div className="h-full transition-all" style={{ width: `${Math.min(100, resumen.avanceAnual || 0)}%`, backgroundColor: colorScore(resumen.avanceAnual) }} />
            </div>
            <div className="text-[10px] text-gray-500 mt-1">
              Meta anual: {formatMXN(resumen.cuotaAnual)}
              {resumen.cuotaIdealAnual > resumen.cuotaAnual && (
                <span className="text-gray-400"> · Ideal {formatMXN(resumen.cuotaIdealAnual)}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* KPIs secundarios: inventario, DSO, vencido, sell-out */}
      <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-3 grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-gray-500">Sell-Out YTD</div>
          <div className="font-semibold text-gray-800">{resumen.soYTD > 0 ? formatMXN(resumen.soYTD) : '—'}</div>
        </div>
        <div>
          <div className="text-gray-500">Inventario cliente</div>
          <div className="font-semibold text-gray-800">
            {resumen.inventarioValor > 0 ? formatMXN(resumen.inventarioValor) : '—'}
          </div>
          {resumen.inventarioSemanas != null && (
            <div className="text-[10px] text-gray-500">
              ~{resumen.inventarioSemanas.toFixed(1)} sem cobertura
            </div>
          )}
        </div>
        <div>
          <div className="text-gray-500">DSO</div>
          <div className="font-semibold text-gray-800">
            {resumen.dso > 0 ? `${resumen.dso}d` : '—'}
          </div>
        </div>
        <div>
          <div className="text-gray-500">Vencido</div>
          <div className={[
            'font-semibold',
            resumen.saldoVencido >= UMBRAL_VENCIDO_ALERTA ? 'text-red-600' : 'text-gray-800',
          ].join(' ')}>
            {formatMXN(resumen.saldoVencido)}
          </div>
        </div>
      </div>
    </div>
  );
}

function ComponenteBar({ id, score, peso }) {
  const labels = {
    cuota:      'Cumplimiento cuota',
    inventario: 'Cobertura inventario',
    dso:        'Días cobro',
    vencidos:   'Pagos vencidos',
    marketing:  'ROI Marketing',
  };
  const icons = {
    cuota:      Target,
    inventario: Package,
    dso:        Clock,
    vencidos:   DollarSign,
    marketing:  TrendingUp,
  };
  const Icon = icons[id];
  const color = colorScore(score);
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <Icon className="w-3 h-3 text-gray-400 shrink-0" />
      <div className="flex-1 min-w-0 truncate text-gray-600">{labels[id]}</div>
      <div className="text-[10px] text-gray-400 tabular-nums shrink-0">{peso}%</div>
      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden shrink-0">
        {score != null && (
          <div className="h-full transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
        )}
      </div>
      <div className="w-8 text-right font-semibold tabular-nums shrink-0" style={{ color }}>
        {score != null ? score.toFixed(0) : '—'}
      </div>
    </div>
  );
}

function MoMIndicator({ pct }) {
  if (pct == null) return null;
  const up = pct >= 0;
  return (
    <div className={[
      'text-[10px] flex items-center gap-0.5',
      up ? 'text-emerald-600' : 'text-red-600',
    ].join(' ')}>
      {up ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
      {up ? '+' : ''}{pct.toFixed(1)}% vs mes anterior
    </div>
  );
}

// ────────── Ranking comparativo ──────────
function RankingComparativo({ resumenes }) {
  const rows = [...resumenes].sort((a, b) => (b.resumen.healthScore || 0) - (a.resumen.healthScore || 0));
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-gray-600" />
          Ranking comparativo
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50/50 text-xs text-gray-600 uppercase">
            <tr>
              <th className="text-left px-5 py-2">Cliente</th>
              <th className="text-right px-3 py-2">Score</th>
              <th className="text-right px-3 py-2">Sell-In YTD</th>
              <th className="text-right px-3 py-2">Sell-Out YTD</th>
              <th className="text-right px-3 py-2">Cuota YTD</th>
              <th className="text-right px-3 py-2">Cumpl. YTD</th>
              <th className="text-right px-3 py-2">Cuota anual</th>
              <th className="text-right px-3 py-2">Avance anual</th>
              <th className="text-right px-3 py-2">DSO</th>
              <th className="text-right px-3 py-2">Vencido</th>
              <th className="text-right px-5 py-2">MoM Sell-In</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ cliente, resumen }, i) => (
              <tr key={cliente.key} className="border-t border-gray-100 hover:bg-gray-50/50">
                <td className="px-5 py-2.5 font-medium text-gray-800">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cliente.color }} />
                    {cliente.nombre}
                  </div>
                </td>
                <td className="text-right px-3 py-2.5 font-bold" style={{ color: colorScore(resumen.healthScore) }}>
                  {resumen.healthScore != null ? resumen.healthScore.toFixed(0) : '—'}
                </td>
                <td className="text-right px-3 py-2.5 text-gray-700">{formatMXN(resumen.siYTD)}</td>
                <td className="text-right px-3 py-2.5 text-gray-700">{resumen.soYTD > 0 ? formatMXN(resumen.soYTD) : '—'}</td>
                <td className="text-right px-3 py-2.5 text-gray-700 text-xs">
                  {resumen.cuotaYTD > 0 ? formatMXN(resumen.cuotaYTD) : '—'}
                </td>
                <td className="text-right px-3 py-2.5 font-semibold">
                  {resumen.cumplimientoYTD != null ? (
                    <span style={{ color: colorScore(resumen.cumplimientoYTD) }}>
                      {pct(resumen.cumplimientoYTD)}
                    </span>
                  ) : '—'}
                </td>
                <td className="text-right px-3 py-2.5 text-gray-700 text-xs">
                  {resumen.cuotaAnual > 0 ? formatMXN(resumen.cuotaAnual) : '—'}
                </td>
                <td className="text-right px-3 py-2.5">
                  {resumen.avanceAnual != null ? (
                    <span style={{ color: colorScore(resumen.avanceAnual) }}>
                      {pct(resumen.avanceAnual)}
                    </span>
                  ) : '—'}
                </td>
                <td className="text-right px-3 py-2.5 text-gray-700">
                  {resumen.dso > 0 ? `${resumen.dso}d` : '—'}
                </td>
                <td className="text-right px-3 py-2.5">
                  <span className={resumen.saldoVencido >= UMBRAL_VENCIDO_ALERTA ? 'text-red-600 font-semibold' : 'text-gray-700'}>
                    {formatMXN(resumen.saldoVencido)}
                  </span>
                </td>
                <td className="text-right px-5 py-2.5">
                  {resumen.siMoM != null ? (
                    <span className={resumen.siMoM >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                      {resumen.siMoM >= 0 ? '+' : ''}{resumen.siMoM.toFixed(1)}%
                    </span>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ────────── Trend consolidado 12 meses (SVG puro) ──────────
function TrendConsolidado({ trend }) {
  const hayDatos = trend.some((r) => r.sell_in > 0 || r.sell_out > 0);
  const [hoverIdx, setHoverIdx] = useState(null);

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-gray-600" />
          Trend consolidado · 12 meses
        </h3>
        <span className="text-xs text-gray-400">Suma de los 3 clientes</span>
        <div className="flex-1" />
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#3B82F6' }} />
            <span className="text-gray-600">Sell-In</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#10B981' }} />
            <span className="text-gray-600">Sell-Out</span>
          </span>
        </div>
      </div>
      <div className="p-4">
        {!hayDatos ? (
          <div className="h-64 flex items-center justify-center text-sm text-gray-400">
            Sin datos suficientes
          </div>
        ) : (
          <TrendSvg trend={trend} hoverIdx={hoverIdx} setHoverIdx={setHoverIdx} />
        )}
      </div>
    </div>
  );
}

function TrendSvg({ trend, hoverIdx, setHoverIdx }) {
  const W = 960;
  const H = 280;
  const padL = 56, padR = 16, padT = 20, padB = 34;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const maxVal = Math.max(1, ...trend.flatMap((r) => [r.sell_in, r.sell_out]));
  const n = trend.length;
  const barW = innerW / n * 0.55;
  const slot = innerW / n;

  const yFor = (v) => padT + innerH - (v / maxVal) * innerH;
  const xFor = (i) => padL + slot * (i + 0.5);

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => (maxVal * i) / ticks);

  // Línea sell_out
  const path = trend.map((r, i) => `${i === 0 ? 'M' : 'L'}${xFor(i)},${yFor(r.sell_out)}`).join(' ');

  const fmtShort = (v) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
    return v.toFixed(0);
  };

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block' }}>
        {/* Grid lines + Y axis */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={padL} y1={yFor(v)} x2={W - padR} y2={yFor(v)} stroke="#E5E7EB" strokeDasharray="3 3" />
            <text x={padL - 6} y={yFor(v) + 4} fontSize="10" fill="#9CA3AF" textAnchor="end">
              {fmtShort(v)}
            </text>
          </g>
        ))}

        {/* Barras Sell-In */}
        {trend.map((r, i) => (
          <rect
            key={i}
            x={xFor(i) - barW / 2}
            y={yFor(r.sell_in)}
            width={barW}
            height={Math.max(0, padT + innerH - yFor(r.sell_in))}
            fill={hoverIdx === i ? '#2563EB' : '#3B82F6'}
            rx={3}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
            style={{ cursor: 'pointer', transition: 'fill 120ms' }}
          />
        ))}

        {/* Línea Sell-Out */}
        <path d={path} fill="none" stroke="#10B981" strokeWidth="2" />

        {/* Puntos Sell-Out */}
        {trend.map((r, i) => (
          <circle
            key={i}
            cx={xFor(i)}
            cy={yFor(r.sell_out)}
            r={hoverIdx === i ? 5 : 3}
            fill="#fff"
            stroke="#10B981"
            strokeWidth="2"
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
            style={{ cursor: 'pointer' }}
          />
        ))}

        {/* X axis labels */}
        {trend.map((r, i) => (
          <text
            key={i}
            x={xFor(i)}
            y={H - padB + 16}
            fontSize="10"
            fill={hoverIdx === i ? '#1F2937' : '#6B7280'}
            textAnchor="middle"
            fontWeight={hoverIdx === i ? 600 : 400}
          >
            {r.label}
          </text>
        ))}
      </svg>

      {/* Tooltip */}
      {hoverIdx != null && (
        <div
          className="absolute pointer-events-none bg-gray-900 text-white rounded-lg px-3 py-2 text-xs shadow-lg"
          style={{
            left: `calc(${(xFor(hoverIdx) / W) * 100}% - 80px)`,
            top: 8,
            minWidth: 160,
          }}
        >
          <div className="font-semibold mb-1">{trend[hoverIdx].label}</div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: '#3B82F6' }} />
            Sell-In: <span className="font-semibold tabular-nums">{formatMXN(trend[hoverIdx].sell_in)}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#10B981' }} />
            Sell-Out: <span className="font-semibold tabular-nums">{formatMXN(trend[hoverIdx].sell_out)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
