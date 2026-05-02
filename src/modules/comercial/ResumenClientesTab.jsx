import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatMXN } from '../../lib/utils';
import { PCEL_REAL } from '../../lib/constants';
import { fetchInventarioCliente, fetchSelloutSku } from '../../lib/pcelAdapter';
import {
  BarChart3, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  DollarSign, Package, Clock, Target, ArrowRight,
} from 'lucide-react';
import ReporteSection from './ReporteSection';

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

// Pesos del Health Score por cliente. Refleja la priorización que Fernando
// definió:
//   1) Cumplimiento cuota sell-in
//   2) Desplazamiento del inventario (cobertura calculada del sellout)
//   3) Marketing
//   4) Crédito y cobranza (DSO + Vencidos)
//
// Para Mercado Libre — no aplica nada del esquema clásico (no hay factura,
// ni cuota mensual, ni almacén físico Acteck) → tarjeta especial sin score.
const PESOS_POR_CLIENTE = {
  digitalife: { cuota: 35, inventario: 25, marketing: 15, dso: 15, vencidos: 10 },
  pcel:       { cuota: 40, inventario: 25, marketing:  0, dso: 20, vencidos: 15 }, // marketing N/A
  mercadolibre: null, // tratamiento aparte: solo crecimiento sell-out
};
function aplicaComponente(cliente, comp) {
  const p = PESOS_POR_CLIENTE[cliente];
  return p != null && (p[comp] || 0) > 0;
}
function pesoComponente(cliente, comp) {
  const p = PESOS_POR_CLIENTE[cliente];
  return p ? (p[comp] || 0) : 0;
}

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
// Fuentes alineadas 1:1 con las pestañas per-cliente:
//   - v_ventas_mensuales_agg: sell_in_sku + sellout_sku agregados por cliente/mes
//   - cuotas_mensuales: cuota_min/cuota_ideal por cliente/mes
//   - inventario_cliente: snapshot semanal con valor (MXN)
//   - v_dso_real: DSO real calculado desde estados_cuenta_detalle
//   - clientes_credito_config: plazo_dias_credito por cliente (default 90)
//   - sellout_sku: para cobertura de inventario (últimos 3 meses de sell-out)
function useResumenData() {
  const [state, setState] = useState({
    loading: true,
    ventasAgg: [],
    cuotasMensuales: [],
    inventarioCliente: [],
    dsoReal: [],
    creditoConfig: [],
    selloutSku: [],
    inversionMkt: [],
  });

  useEffect(() => {
    (async () => {
      // Inventario cliente: usamos el MISMO adapter que HomeCliente para que
      // los números sean consistentes entre Resumen y la pestaña per-cliente.
      // PCEL → lee de sellout_pcel; Digitalife → de inventario_cliente.
      const [vaRes, cmRes, invDigi, invPcel, dsoRes, ccRes, soRes, mkRes] = await Promise.all([
        supabase.from('v_ventas_mensuales_agg')
          .select('cliente, anio, mes, sell_in, sell_out')
          .gte('anio', anioActual - 1),
        supabase.from('cuotas_mensuales')
          .select('cliente, mes, anio, cuota_min, cuota_ideal')
          .eq('anio', anioActual),
        fetchInventarioCliente('digitalife'),
        fetchInventarioCliente('pcel'),
        supabase.from('v_dso_real')
          .select('cliente, fecha_corte, saldo_actual_total, saldo_vencido, dso_real, dso_erp, aging_mas90, facturas_abiertas'),
        supabase.from('clientes_credito_config')
          .select('cliente, plazo_dias_credito, linea_credito_usd'),
        supabase.from('sellout_sku')
          .select('cliente, anio, mes, piezas, monto_pesos')
          .eq('anio', anioActual),
        // Marketing: leemos de marketing_actividades (mismo lugar que la
        // pestaña Pagos → apartado Marketing usa). El campo `inversion` es
        // el monto MXN gastado por actividad.
        supabase.from('marketing_actividades')
          .select('cliente, anio, mes, inversion')
          .eq('anio', anioActual),
      ]);

      // Combina inventario de los dos clientes en una sola lista
      const invCombinado = [
        ...(invDigi || []).map((r) => ({ ...r, cliente: 'digitalife' })),
        ...(invPcel || []).map((r) => ({ ...r, cliente: 'pcel' })),
      ];

      setState({
        loading: false,
        ventasAgg:         vaRes.data  || [],
        cuotasMensuales:   cmRes.data  || [],
        inventarioCliente: invCombinado,
        dsoReal:           dsoRes.data || [],
        creditoConfig:     ccRes.data  || [],
        selloutSku:        soRes.data  || [],
        inversionMkt:      mkRes.data  || [],
      });
    })();
  }, []);

  return state;
}

// Helper de valor de inventario (idéntico al de HomeCliente.jsx _invValor)
// Cae a stock × costo_convenio cuando `valor` es null.
function invValorRow(r) {
  const v = Number(r.valor) || 0;
  if (v > 0) return v;
  return (Number(r.stock) || 0) * (Number(r.costo_convenio) || 0);
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
  const va  = data.ventasAgg.filter((r) => r.cliente === clienteKey);
  const cm  = data.cuotasMensuales.filter((r) => r.cliente === clienteKey);
  const inv = data.inventarioCliente.filter((r) => r.cliente === clienteKey);
  const dsoRow = data.dsoReal.find((r) => r.cliente === clienteKey);
  const ccRow  = data.creditoConfig.find((r) => r.cliente === clienteKey);
  const so  = data.selloutSku.filter((r) => r.cliente === clienteKey);
  const mk  = data.inversionMkt.filter((r) => r.cliente === clienteKey);

  // ── Sell-In / Sell-Out YTD ──
  const vaAnio = va.filter((r) => r.anio === anioActual);
  const siYTD = vaAnio
    .filter((r) => Number(r.mes) <= mesActual)
    .reduce((a, r) => a + Number(r.sell_in || 0), 0);
  const soYTD = vaAnio
    .filter((r) => Number(r.mes) <= mesActual)
    .reduce((a, r) => a + Number(r.sell_out || 0), 0);

  // MoM del mes actual vs mismo mes año anterior (comparación año-sobre-año)
  const rowMesActual = vaAnio.find((r) => Number(r.mes) === mesActual);
  const rowMesPrev   = va.find((r) => Number(r.mes) === mesActual && r.anio === anioActual - 1);
  const siMes     = Number(rowMesActual?.sell_in  || 0);
  const siMesPrev = Number(rowMesPrev?.sell_in    || 0);
  const soMes     = Number(rowMesActual?.sell_out || 0);
  const siYoY = siMesPrev > 0 ? ((siMes - siMesPrev) / siMesPrev) * 100 : null;

  // ── Cuota YTD y anual (mismo período vs mismo período) ──
  // Fuente principal: tabla cuotas_mensuales (cliente, anio, mes, cuota_min, cuota_ideal).
  // Fallback PCEL: constants.PCEL_REAL.cuota50M (objeto {mes:monto}).
  let cuotaYTD = cm
    .filter((r) => Number(r.mes) <= mesActual)
    .reduce((a, r) => a + Number(r.cuota_min || 0), 0);
  let cuotaAnual = cm.reduce((a, r) => a + Number(r.cuota_min || 0), 0);
  let cuotaIdealAnual = cm.reduce((a, r) => a + Number(r.cuota_ideal || 0), 0);
  if (clienteKey === 'pcel' && cuotaAnual === 0 && PCEL_REAL?.cuota50M) {
    const c = PCEL_REAL.cuota50M;
    cuotaYTD   = Object.entries(c).filter(([m]) => Number(m) <= mesActual).reduce((a, [, v]) => a + Number(v || 0), 0);
    cuotaAnual = Object.values(c).reduce((a, v) => a + Number(v || 0), 0);
    cuotaIdealAnual = cuotaAnual; // no hay "ideal" para PCEL en constants → usar el min
  }

  // IMPORTANTE: Comparar YTD vs YTD (mismo período), no YTD vs anual.
  // El "avance anual" se confunde con cumplimiento → NO lo usamos en el score.
  const cumplimientoYTD = cuotaYTD > 0 ? (siYTD / cuotaYTD) * 100 : null;

  // ── Inventario del último snapshot (valor MXN) ──
  // Filtra filas con anio/semana null (basura del uploader cuando no hay header).
  let inventarioValor = 0;
  let inventarioPiezas = 0;
  let inventarioSemana = null;
  const invValidas = inv.filter((r) => r.anio != null && r.semana != null);
  if (invValidas.length > 0) {
    // Toma la semana más reciente (mayor anio, luego mayor semana)
    const semanaMax = invValidas.reduce((max, r) => {
      const k = Number(r.anio) * 100 + Number(r.semana);
      return k > max.k ? { k, anio: Number(r.anio), semana: Number(r.semana) } : max;
    }, { k: -1, anio: 0, semana: 0 });
    const snap = invValidas.filter((r) => Number(r.anio) === semanaMax.anio && Number(r.semana) === semanaMax.semana);
    // Usa fórmula stock × costo_convenio cuando valor es null (igual a HomeCliente)
    inventarioValor  = snap.reduce((a, r) => a + invValorRow(r), 0);
    inventarioPiezas = snap.reduce((a, r) => a + Number(r.stock || 0), 0);
    inventarioSemana = `${semanaMax.anio}-${String(semanaMax.semana).padStart(2,'0')}`;
  }

  // ── Cobertura en DÍAS (alineado con HomeCliente.jsx líneas 574-587) ──
  // Últimos 3 meses de sellout_sku.monto_pesos / días reales del período = sell-out diario
  // FIX: usar días reales por mes (no asumir 30) para evitar desviación del ±5%
  const ultMes = so.length > 0 ? Math.max(...so.map((r) => Number(r.mes) || 0)) : 0;
  let coberturaDias = null;
  if (inventarioValor > 0 && ultMes > 0) {
    const desde = Math.max(1, ultMes - 2);
    const montoSO = so
      .filter((r) => Number(r.mes) >= desde && Number(r.mes) <= ultMes)
      .reduce((a, r) => a + Number(r.monto_pesos || 0), 0);
    // Calcular días reales de los meses del rango
    let dias = 0;
    for (let m = desde; m <= ultMes; m++) {
      dias += new Date(anioActual, m, 0).getDate(); // último día del mes m
    }
    const soDiario = dias > 0 ? montoSO / dias : 0;
    coberturaDias = soDiario > 0 ? Math.round(inventarioValor / soDiario) : null;
  }

  // ── DSO real + plazo de crédito ──
  const plazo = Number(ccRow?.plazo_dias_credito || 90);
  const dsoReal = dsoRow?.dso_real != null ? Number(dsoRow.dso_real) : null;
  const saldoVencido = Number(dsoRow?.saldo_vencido || 0);
  const saldoActual  = Number(dsoRow?.saldo_actual_total || 0);
  const aging90      = Number(dsoRow?.aging_mas90 || 0);
  // FIX: si hay vencido pero el saldo total es 0 (caso raro), reportar 100% para no ocultar
  const pctVencido = saldoActual > 0
    ? (saldoVencido / saldoActual) * 100
    : (saldoVencido > 0 ? 100 : 0);

  // ── Inversión marketing YTD y ROI ──
  // Lee de marketing_actividades (campo `inversion`), igual que la pestaña
  // Pagos → Marketing del cliente. mes puede venir como string (ej. "3").
  const invMktYTD = mk
    .filter((r) => Number(r.mes) <= mesActual)
    .reduce((a, r) => a + Number(r.inversion || 0), 0);
  const roiMkt = invMktYTD > 0 ? soYTD / invMktYTD : null;

  // ═════ Scores (0–100) — cada uno usa umbrales de las pestañas per-cliente ═════

  // 1) Cumplimiento cuota YTD vs YTD — 100% = 100pts (satura), 50% = 50pts
  const scoreCuota = cuotaYTD > 0 ? clamp(cumplimientoYTD, 0, 100) : null;

  // 2) Cobertura inventario — alineado con HomeCliente línea 890-891
  //    ≤90d = verde (óptimo), 90-150d = amarillo, >150d = rojo (sobreinv)
  //    Score: óptimo 60-90d = 100. Bajo 30d = 0 (riesgo stockout). Alto >180d = 0 (sobre)
  let scoreInv = null;
  if (coberturaDias != null) {
    if (coberturaDias < 30)        scoreInv = clamp((coberturaDias / 30) * 60, 0, 60);   // 0–60 en rango stockout
    else if (coberturaDias <= 90)  scoreInv = clamp(60 + ((coberturaDias - 30) / 60) * 40, 60, 100); // 60→100 en rango óptimo
    else if (coberturaDias <= 150) scoreInv = clamp(100 - ((coberturaDias - 90) / 60) * 40, 60, 100);  // 100→60
    else                           scoreInv = clamp(60 - ((coberturaDias - 150) / 60) * 60, 0, 60);    // 60→0 sobrestock
  }

  // 3) DSO real vs plazo — alineado con CreditoCobranza.jsx líneas 277-280
  //    DSO ≤ plazo = verde (100), plazo-plazo+30 = amarillo, >plazo+30 = rojo
  //    Score: ≤plazo = 100, plazo+60 = 0, lineal
  let scoreDSO = null;
  if (dsoReal != null && dsoReal > 0) {
    if (dsoReal <= plazo) scoreDSO = 100;
    else scoreDSO = clamp(100 - ((dsoReal - plazo) / 60) * 100, 0, 100);
  }

  // 4) Saldo vencido — alineado con CreditoCobranza líneas 234-251
  //    >15% = rojo, 5-15% = amarillo, <5% = verde
  //    Score: 0% = 100, 15% = 0, lineal
  const scoreVen = saldoActual > 0
    ? clamp(((15 - pctVencido) / 15) * 100, 0, 100)
    : null;

  // 5) ROI marketing: ≥10 = 100, ≤2 = 0
  const scoreMkt = roiMkt != null
    ? clamp(((roiMkt - 2) / 8) * 100, 0, 100)
    : null;

  // ═════ Pesos por cliente + penalización por datos faltantes ═════
  // Antes: si un componente no tenía datos, se EXCLUÍA del cálculo y el score
  // se normalizaba al peso disponible. Eso inflaba el score (ej. PCEL 97/100
  // con solo DSO+Vencidos activos).
  //
  // Ahora: si un componente APLICA al cliente pero no tiene datos, cuenta
  // como score 0 (penalización honesta). Si NO aplica al cliente (peso=0),
  // simplemente se omite.
  const SCORES = { cuota: scoreCuota, inventario: scoreInv, dso: scoreDSO, vencidos: scoreVen, marketing: scoreMkt };
  const componentes = ['cuota', 'inventario', 'marketing', 'dso', 'vencidos'].map((id) => {
    const peso = pesoComponente(clienteKey, id);
    const aplica = peso > 0;
    const rawScore = SCORES[id];
    let score, estado;
    if (!aplica)              { score = null; estado = 'no_aplica'; }
    else if (rawScore == null){ score = 0;    estado = 'sin_datos';  }
    else                      { score = rawScore; estado = 'ok';    }
    return { id, score, peso, aplica, estado };
  });
  const aplicables = componentes.filter((c) => c.aplica);
  const pesoTotal = aplicables.reduce((a, c) => a + c.peso, 0);
  const healthScore = pesoTotal > 0
    ? aplicables.reduce((a, c) => a + c.score * c.peso, 0) / pesoTotal
    : null;
  const componentesSinDatos = aplicables.filter((c) => c.estado === 'sin_datos').length;

  return {
    healthScore,
    componentes,
    componentesSinDatos,
    siYTD, soYTD,
    siMes, siMesPrev, siYoY,
    sparkline: (function() {
      // A1: últimos 6 meses con sell-in real y cuota de referencia
      const out = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(anioActual, mesActual - 1 - i, 1);
        const a = d.getFullYear();
        const m = d.getMonth() + 1;
        let si = 0;
        va.forEach((r) => {
          if (r.anio === a && Number(r.mes) === m) si += Number(r.sell_in || 0);
        });
        // Cuota: solo del año actual
        let cuota = 0;
        if (a === anioActual) {
          cm.forEach((r) => {
            if (Number(r.mes) === m) cuota += Number(r.cuota_min || 0);
          });
          if (clienteKey === 'pcel' && cuota === 0 && PCEL_REAL?.cuota50M) {
            cuota = Number(PCEL_REAL.cuota50M[m] || 0);
          }
        }
        out.push({ mes: m, anio: a, sell_in: si, cuota });
      }
      return out;
    })(),
    soMes,
    cuotaYTD, cumplimientoYTD,
    cuotaAnual, cuotaIdealAnual,
    saldoVencido, saldoActual, dsoReal, dsoPlazo: plazo, aging90, pctVencido,
    inventarioValor, inventarioPiezas, inventarioSemana, coberturaDias,
    invMktYTD, roiMkt,
  };
}

// ────────── Resumen especial Mercado Libre (sin score clásico) ──────────
// ML no tiene factura, ni cuota, ni inventario físico Acteck → no encaja
// con el esquema de salud comercial. Solo medimos crecimiento sell-out.
function calcularResumenMercadoLibre(data) {
  const va = data.ventasAgg.filter((r) => r.cliente === 'mercadolibre');
  const vaAnio = va.filter((r) => r.anio === anioActual);
  const soYTD = vaAnio.filter((r) => Number(r.mes) <= mesActual).reduce((a, r) => a + Number(r.sell_out || 0), 0);
  const soYTDPrev = va.filter((r) => r.anio === anioActual - 1 && Number(r.mes) <= mesActual)
    .reduce((a, r) => a + Number(r.sell_out || 0), 0);
  const soMes     = Number(vaAnio.find((r) => Number(r.mes) === mesActual)?.sell_out || 0);
  const soMesPrev = Number(va.find((r) => Number(r.mes) === mesActual && r.anio === anioActual - 1)?.sell_out || 0);
  const crecimientoYTD = soYTDPrev > 0 ? ((soYTD - soYTDPrev) / soYTDPrev) * 100 : null;
  const crecimientoMes = soMesPrev > 0 ? ((soMes - soMesPrev) / soMesPrev) * 100 : null;
  return {
    healthScore: null,         // sin score clásico
    componentes: [],           // no aplica
    componentesSinDatos: 0,
    soYTD, soYTDPrev, soMes, soMesPrev,
    crecimientoYTD, crecimientoMes,
    esMercadoLibre: true,
  };
}

// ────────── Trend consolidado 12 meses ──────────
// Trend consolidado: 12 meses del AÑO en curso (Ene-Dic), cuota vs sell-in
// real, sumando los clientes que aplican.
//   · Cuota: Digitalife (de cuotas_mensuales) + PCEL (de cuotas_mensuales o
//     fallback a PCEL_REAL.cuota50M si BD vacía). ML no maneja cuota → no suma.
//   · Sell-In: suma de los 3 clientes (v_ventas_mensuales_agg).
function calcularTrend(data) {
  // Cuota PCEL fallback (mismo patrón que pestañas per-cliente)
  const cuotaPcelFallback = (() => {
    const tienePcelEnBD = data.cuotasMensuales.some((r) => r.cliente === 'pcel');
    if (tienePcelEnBD || !PCEL_REAL?.cuota50M) return null;
    return PCEL_REAL.cuota50M; // { 1: ..., 2: ..., ..., 12: ... }
  })();

  return Array.from({ length: 12 }, (_, idx) => {
    const mes = idx + 1;
    let cuota = 0, si = 0;
    // Cuota: suma cuota_min de Digitalife y PCEL del mes
    data.cuotasMensuales.forEach((r) => {
      if (Number(r.mes) !== mes) return;
      if (r.cliente === 'mercadolibre') return;
      cuota += Number(r.cuota_min || 0);
    });
    // Si PCEL no está en BD pero hay constants, sumar el fallback
    if (cuotaPcelFallback && cuotaPcelFallback[mes] != null) {
      cuota += Number(cuotaPcelFallback[mes] || 0);
    }
    // Sell-In real del mes (suma 3 clientes)
    data.ventasAgg.forEach((r) => {
      if (Number(r.anio) !== anioActual) return;
      if (Number(r.mes) !== mes) return;
      si += Number(r.sell_in || 0);
    });
    return {
      mes,
      label: MESES_CORTO[idx],
      cuota,
      sell_in: si,
      esActual: mes === mesActual,
      esFuturo: mes > mesActual,
    };
  });
}

// ────────── Alertas cross-cliente ──────────
function calcularAlertas(resumenes) {
  const alertas = [];
  resumenes.forEach(({ cliente, resumen }) => {
    // Saldo vencido > 15% del saldo total (umbral crítico de CreditoCobranza)
    if (resumen.pctVencido > 15) {
      alertas.push({
        tipo: 'vencido',
        clienteKey: cliente.key,
        cliente: cliente.nombre,
        mensaje: `${formatMXN(resumen.saldoVencido)} vencidos (${resumen.pctVencido.toFixed(1)}% del saldo)`,
        severidad: 'alta',
      });
    }
    // DSO real > plazo + 30 días = crítico
    if (resumen.dsoReal != null && resumen.dsoReal > (resumen.dsoPlazo + 30)) {
      alertas.push({
        tipo: 'dso', clienteKey: cliente.key, cliente: cliente.nombre,
        mensaje: `DSO ${resumen.dsoReal}d (plazo ${resumen.dsoPlazo}d)`,
        severidad: 'alta',
      });
    }
    // Cumplimiento YTD < 70%
    if (resumen.cumplimientoYTD != null && resumen.cumplimientoYTD < 70) {
      alertas.push({
        tipo: 'cuota', clienteKey: cliente.key, cliente: cliente.nombre,
        mensaje: `Cumplimiento YTD ${resumen.cumplimientoYTD.toFixed(0)}%`,
        severidad: 'alta',
      });
    }
    // Cobertura crítica (<30d) o excesiva (>150d)
    if (resumen.coberturaDias != null && resumen.coberturaDias < 30) {
      alertas.push({
        tipo: 'inventario', clienteKey: cliente.key, cliente: cliente.nombre,
        mensaje: `Cobertura baja: ${resumen.coberturaDias}d (riesgo stockout)`,
        severidad: 'alta',
      });
    }
    if (resumen.coberturaDias != null && resumen.coberturaDias > 150) {
      alertas.push({
        tipo: 'inventario', clienteKey: cliente.key, cliente: cliente.nombre,
        mensaje: `Sobreinventario: ${resumen.coberturaDias}d de cobertura`,
        severidad: 'media',
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
    const arr = CLIENTES.map((c) => ({
      cliente: c,
      resumen: c.key === 'mercadolibre'
        ? calcularResumenMercadoLibre(data)
        : calcularResumen(c.key, data),
    }));
    // A4: ordenar por health score ASC (más bajo primero) — el cliente que
    // necesita más atención se ve primero. Mercado Libre (sin score) al final.
    arr.sort((a, b) => {
      const sa = a.resumen.healthScore;
      const sb = b.resumen.healthScore;
      if (sa == null && sb == null) return 0;
      if (sa == null) return 1;
      if (sb == null) return -1;
      return sa - sb;
    });
    return arr;
  }, [data]);

  const trend   = useMemo(() => data.loading ? [] : calcularTrend(data),   [data]);
  const alertasAll = useMemo(() => calcularAlertas(resumenes), [resumenes]);

  // ── B3: Marcar alertas como atendidas — persistencia local por día ──
  const alertasKey = 'alertasAtendidas-' + new Date().toISOString().slice(0, 10);
  const [alertasAtendidas, setAlertasAtendidas] = useState(() => {
    try {
      if (typeof localStorage === 'undefined') return new Set();
      const raw = localStorage.getItem(alertasKey);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });
  const marcarAlertaAtendida = (id) => {
    setAlertasAtendidas((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(alertasKey, JSON.stringify([...next]));
        }
      } catch {}
      return next;
    });
  };
  // ID estable por alerta: tipo + cliente + mensaje (hash simple)
  const alertaId = (a) => `${a.tipo}|${a.clienteKey || ''}|${a.mensaje}`;
  const alertas = useMemo(
    () => alertasAll.filter((a) => !alertasAtendidas.has(alertaId(a))),
    [alertasAll, alertasAtendidas]
  );

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

      {/* Alertas cross-cliente — clickeables, atajo al cliente */}
      {alertas.length > 0 && (
        <div className="bg-gradient-to-r from-red-50 via-amber-50 to-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="font-semibold text-red-800">
              {alertas.length} alerta{alertas.length !== 1 ? 's' : ''} requieren tu atención
            </span>
            <span className="text-xs text-red-600 ml-2 italic">(click para ir al cliente)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {alertas.map((a, i) => {
              const id = alertaId(a);
              const colorBase = a.severidad === 'alta'
                ? 'bg-red-100 border-red-300 text-red-800 hover:bg-red-200'
                : 'bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200';
              return (
                <div
                  key={id || i}
                  className={[
                    'text-xs rounded-full border font-medium transition flex items-center overflow-hidden',
                    colorBase,
                  ].join(' ')}
                >
                  <button
                    onClick={() => a.clienteKey && onDrillDown?.(a.clienteKey)}
                    className="px-2.5 py-1 cursor-pointer hover:underline"
                    title={`Ir a ${a.cliente}`}
                  >
                    <strong>{a.cliente}:</strong> {a.mensaje}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); marcarAlertaAtendida(id); }}
                    className="px-2 py-1 border-l border-black/10 hover:bg-black/5"
                    title="Marcar como atendida (vuelve a aparecer mañana)"
                  >
                    ✓
                  </button>
                </div>
              );
            })}
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

      {/* Reporte: lista maestra de SKUs (colapsable) */}
      <ReporteSection />

      {/* Trend consolidado: Cuota vs Sell-In año en curso */}
      <TrendConsolidado trend={trend} />
    </div>
  );
}

// ────────── Card por cliente ──────────
function ClienteCard({ cliente, resumen, onDrillDown }) {
  // Caso especial: Mercado Libre no tiene score clásico → tarjeta de
  // crecimiento sell-out vs año anterior.
  if (resumen?.esMercadoLibre) {
    return <ClienteCardML cliente={cliente} resumen={resumen} onDrillDown={onDrillDown} />;
  }

  const s = resumen.healthScore;
  const color = colorScore(s);
  const datosParciales = resumen.componentesSinDatos > 0;

  return (
    <div
      className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-blue-300 hover:-translate-y-0.5 transition-all cursor-pointer relative"
      style={{ borderTop: `4px solid ${cliente.color}` }}
      onClick={onDrillDown}
      title={`Click para ir al detalle de ${cliente.nombre}`}
    >
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-start justify-between">
        <div>
          <h3 className="font-bold text-gray-800 text-lg">{cliente.nombre}</h3>
          <p className="text-xs text-gray-500">{cliente.marca}</p>
        </div>
        <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
      </div>

      {/* Score grande */}
      <div className="px-5 pb-3 flex items-center gap-4">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center shrink-0 relative"
          style={{
            background: s != null
              ? `conic-gradient(${color} ${s * 3.6}deg, #E5E7EB 0deg)`
              : '#E5E7EB',  // Sin datos: ring vacío gris
          }}
          title={s == null ? 'Sin datos suficientes para calcular el score' : `Score: ${s.toFixed(1)}`}
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
          {datosParciales && (
            <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded"
              title={`${resumen.componentesSinDatos} componente(s) sin datos. El score los cuenta como 0.`}>
              <AlertTriangle className="w-2.5 h-2.5" />
              {resumen.componentesSinDatos} sin datos
            </div>
          )}
        </div>
      </div>

      {/* Breakdown de componentes (solo los que aplican al cliente) */}
      <div className="px-5 pb-3 space-y-1.5">
        {resumen.componentes.filter((c) => c.aplica).map((c) => (
          <ComponenteBar key={c.id} id={c.id} score={c.score} peso={c.peso} estado={c.estado} />
        ))}
      </div>

      {/* Sell-In YTD + Cumplimiento YTD (mismo período vs mismo período) */}
      <div className="border-t border-gray-100 px-5 py-3 space-y-2">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[10px] uppercase text-gray-500 tracking-wide">Sell-In YTD</div>
            <div className="font-bold text-gray-800 text-base">{formatMXN(resumen.siYTD)}</div>
            {resumen.cuotaYTD > 0 && (
              <div className="text-[10px] text-gray-500">
                vs cuota YTD {formatMXN(resumen.cuotaYTD)}
              </div>
            )}
          </div>
          {resumen.cumplimientoYTD != null && (
            <div className="text-right">
              <div className="text-[10px] uppercase text-gray-500 tracking-wide">Cumpl. YTD</div>
              <div className="font-bold text-lg" style={{ color: colorScore(resumen.cumplimientoYTD) }}>
                {pct(resumen.cumplimientoYTD)}
              </div>
            </div>
          )}
        </div>

        {resumen.siYoY != null && (
          <div className={[
            'text-[10px] flex items-center gap-0.5',
            resumen.siYoY >= 0 ? 'text-emerald-600' : 'text-red-600',
          ].join(' ')}>
            {resumen.siYoY >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
            {resumen.siYoY >= 0 ? '+' : ''}{resumen.siYoY.toFixed(1)}% vs mismo mes año anterior
          </div>
        )}

        {resumen.cuotaAnual > 0 && (
          <div className="text-[10px] text-gray-400 pt-1 border-t border-gray-100">
            Meta anual (referencia): {formatMXN(resumen.cuotaAnual)}
            {resumen.cuotaIdealAnual > resumen.cuotaAnual && (
              <> · Ideal {formatMXN(resumen.cuotaIdealAnual)}</>
            )}
          </div>
        )}

        {/* A1: Sparkline 6m sell-in con cuota como referencia */}
        {resumen.sparkline && resumen.sparkline.some((x) => x.sell_in > 0 || x.cuota > 0) && (
          <SparklineMini data={resumen.sparkline} color={cliente.color} />
        )}
      </div>

      {/* KPIs secundarios */}
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
          {resumen.coberturaDias != null && (
            <div
              className="text-[10px] font-medium"
              style={{ color: colorCobertura(resumen.coberturaDias) }}
              title="Días de inventario actual al ritmo de sell-out promedio últimos 3 meses"
            >
              {resumen.coberturaDias} días de venta {labelCobertura(resumen.coberturaDias)}
            </div>
          )}
        </div>
        <div>
          <div className="text-gray-500">DSO real</div>
          <div className="font-semibold" style={{ color: colorDSO(resumen.dsoReal, resumen.dsoPlazo) }}>
            {resumen.dsoReal != null ? `${resumen.dsoReal}d` : '—'}
          </div>
          <div className="text-[10px] text-gray-500">plazo {resumen.dsoPlazo}d</div>
        </div>
        <div>
          <div className="text-gray-500">Vencido</div>
          <div className={[
            'font-semibold',
            resumen.pctVencido > 15 ? 'text-red-600' :
            resumen.pctVencido > 5  ? 'text-amber-600' : 'text-gray-800',
          ].join(' ')}>
            {formatMXN(resumen.saldoVencido)}
          </div>
          {resumen.saldoActual > 0 && (
            <div className="text-[10px] text-gray-500">{resumen.pctVencido.toFixed(1)}% del saldo</div>
          )}
        </div>
      </div>
    </div>
  );
}

function colorDSO(dso, plazo) {
  if (dso == null) return '#94A3B8';
  if (dso <= plazo)           return '#10B981';  // verde
  if (dso <= plazo + 30)      return '#F59E0B';  // amarillo
  return '#EF4444';                              // rojo
}
function colorCobertura(dias) {
  if (dias == null) return '#94A3B8';
  if (dias < 30)              return '#EF4444';  // muy bajo = stockout
  if (dias <= 90)             return '#10B981';  // óptimo
  if (dias <= 150)            return '#F59E0B';  // atención
  return '#EF4444';                              // sobrestock
}
function labelCobertura(dias) {
  if (dias < 30)  return '(riesgo stockout)';
  if (dias <= 90) return '(óptimo)';
  if (dias <= 150) return '(alto)';
  return '(sobreinventario)';
}

function ComponenteBar({ id, score, peso, estado }) {
  const labels = {
    cuota:      'Cumplimiento cuota (sell-in)',
    inventario: 'Desplazamiento (sell-out)',
    marketing:  'ROI Marketing',
    dso:        'Días cobro (DSO)',
    vencidos:   'Pagos vencidos',
  };
  const icons = {
    cuota:      Target,
    inventario: Package,
    marketing:  TrendingUp,
    dso:        Clock,
    vencidos:   DollarSign,
  };
  const Icon = icons[id];
  const sinDatos = estado === 'sin_datos';
  const color = sinDatos ? '#94A3B8' : colorScore(score);
  return (
    <div className={"flex items-center gap-2 text-[11px] " + (sinDatos ? 'opacity-60' : '')}
      title={sinDatos ? 'Sin datos cargados — cuenta como 0 en el score' : undefined}>
      <Icon className="w-3 h-3 text-gray-400 shrink-0" />
      <div className="flex-1 min-w-0 truncate text-gray-600">
        {labels[id]}
        {sinDatos && <span className="ml-1 text-amber-600 text-[9px]">⚠ sin datos</span>}
      </div>
      <div className="text-[10px] text-gray-400 tabular-nums shrink-0">{peso}%</div>
      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden shrink-0">
        {score != null && (
          <div className="h-full transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
        )}
      </div>
      <div className="w-8 text-right font-semibold tabular-nums shrink-0" style={{ color }}>
        {sinDatos ? '—' : (score != null ? score.toFixed(0) : '—')}
      </div>
    </div>
  );
}

// ────────── Card especial Mercado Libre ──────────
// Solo crecimiento sell-out: ML no encaja con el esquema de salud comercial
// (sin facturación directa, sin cuota mensual, sin almacén físico).
// A1: Sparkline mini de Sell-In últimos 6 meses con cuota como referencia
function SparklineMini({ data, color = '#3B82F6' }) {
  const W = 220, H = 38;
  const padX = 2, padY = 4;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;
  const max = Math.max(1, ...data.flatMap((d) => [d.sell_in || 0, d.cuota || 0]));
  const slot = innerW / data.length;
  const xFor = (i) => padX + slot * (i + 0.5);
  const yFor = (v) => padY + innerH - (v / max) * innerH;

  // Línea sell-in (sólida)
  const pathSI = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xFor(i)},${yFor(d.sell_in || 0)}`).join(' ');
  // Línea cuota (punteada)
  const tieneCuota = data.some((d) => d.cuota > 0);
  const pathCuota = tieneCuota
    ? data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xFor(i)},${yFor(d.cuota || 0)}`).join(' ')
    : null;
  // Etiquetas mes (sólo primer y último)
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const primer = data[0];
  const ultimo = data[data.length - 1];

  return (
    <div className="pt-2 border-t border-gray-100">
      <div className="flex items-center justify-between text-[9px] text-gray-400 mb-0.5 uppercase tracking-wide">
        <span>Sell-In 6m</span>
        {tieneCuota && (
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-px border-t border-dashed border-gray-400" />
            <span>cuota</span>
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block' }}>
        {pathCuota && (
          <path d={pathCuota} fill="none" stroke="#94A3B8" strokeWidth="1" strokeDasharray="3 2" opacity="0.7" />
        )}
        <path d={pathSI} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => (
          <circle key={i} cx={xFor(i)} cy={yFor(d.sell_in || 0)} r={1.5} fill={color} />
        ))}
      </svg>
      <div className="flex items-center justify-between text-[9px] text-gray-400 mt-0.5">
        <span>{meses[primer.mes - 1]} {String(primer.anio).slice(2)}</span>
        <span>{meses[ultimo.mes - 1]} {String(ultimo.anio).slice(2)}</span>
      </div>
    </div>
  );
}

function ClienteCardML({ cliente, resumen, onDrillDown }) {
  const cYTD = resumen.crecimientoYTD;
  const cMes = resumen.crecimientoMes;
  const colorC = (c) => c == null ? '#94A3B8' : c >= 20 ? '#10B981' : c >= 0 ? '#F59E0B' : '#EF4444';
  return (
    <div
      className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-amber-300 hover:-translate-y-0.5 transition-all cursor-pointer relative"
      style={{ borderTop: `4px solid ${cliente.color}` }}
      onClick={onDrillDown}
      title={`Click para ir al detalle de ${cliente.nombre}`}
    >
      <div className="px-5 pt-4 pb-3 flex items-start justify-between">
        <div>
          <h3 className="font-bold text-gray-800 text-lg">{cliente.nombre}</h3>
          <p className="text-xs text-gray-500">{cliente.marca} · marketplace</p>
        </div>
        <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
      </div>
      <div className="px-5 pb-3 text-[11px] text-gray-500 italic">
        Sin score clásico — ML no maneja factura, cuota mensual, ni almacén físico Acteck.
      </div>
      <div className="border-t border-gray-100 px-5 py-3 space-y-2">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[10px] uppercase text-gray-500 tracking-wide">Sell-Out YTD</div>
            <div className="font-bold text-gray-800 text-base">{resumen.soYTD > 0 ? formatMXN(resumen.soYTD) : '—'}</div>
            {resumen.soYTDPrev > 0 && (
              <div className="text-[10px] text-gray-500">
                vs YTD {anioActual - 1}: {formatMXN(resumen.soYTDPrev)}
              </div>
            )}
          </div>
          {cYTD != null && (
            <div className="text-right">
              <div className="text-[10px] uppercase text-gray-500 tracking-wide">Crec. YTD</div>
              <div className="font-bold text-lg" style={{ color: colorC(cYTD) }}>
                {cYTD >= 0 ? '+' : ''}{cYTD.toFixed(1)}%
              </div>
            </div>
          )}
        </div>
        {cMes != null && (
          <div className={[
            'text-[10px] flex items-center gap-0.5',
            cMes >= 0 ? 'text-emerald-600' : 'text-red-600',
          ].join(' ')}>
            {cMes >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
            {cMes >= 0 ? '+' : ''}{cMes.toFixed(1)}% vs {MESES_CORTO[mesActual - 1]} {anioActual - 1}
          </div>
        )}
      </div>
      <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-3 grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-gray-500">Sell-Out mes ({MESES_CORTO[mesActual - 1]})</div>
          <div className="font-semibold text-gray-800">{resumen.soMes > 0 ? formatMXN(resumen.soMes) : '—'}</div>
        </div>
        <div>
          <div className="text-gray-500">Mismo mes año pasado</div>
          <div className="font-semibold text-gray-800">{resumen.soMesPrev > 0 ? formatMXN(resumen.soMesPrev) : '—'}</div>
        </div>
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

// ────────── Trend consolidado 12 meses (SVG puro) ──────────
function TrendConsolidado({ trend }) {
  const hayDatos = trend.some((r) => r.cuota > 0 || r.sell_in > 0);
  const [hoverIdx, setHoverIdx] = useState(null);

  // ── Cálculos para las tarjetas ──
  const mesesPasados = trend.filter((r) => !r.esFuturo);
  const mesesPasadosConVenta = mesesPasados.filter((r) => r.sell_in > 0);
  const totCuotaAnual = trend.reduce((a, r) => a + (r.cuota || 0), 0);
  const totCuotaYTD = mesesPasados.reduce((a, r) => a + (r.cuota || 0), 0);
  const totSI    = mesesPasados.reduce((a, r) => a + (r.sell_in || 0), 0);
  const cumplYTD = totCuotaYTD > 0 ? (totSI / totCuotaYTD) * 100 : null;

  // 1) Mejor mes (sell-in más alto en meses pasados)
  const mejorMes = mesesPasadosConVenta.length
    ? mesesPasadosConVenta.reduce((mejor, r) => r.sell_in > mejor.sell_in ? r : mejor)
    : null;

  // 2) Tendencia 3m: últimos 3 meses con venta vs 3 anteriores
  let tendencia3m = null;
  if (mesesPasadosConVenta.length >= 4) {
    const u3 = mesesPasadosConVenta.slice(-3);
    const a3 = mesesPasadosConVenta.slice(-6, -3);
    const sumU = u3.reduce((a, r) => a + r.sell_in, 0);
    const sumA = a3.reduce((a, r) => a + r.sell_in, 0);
    if (sumA > 0) {
      tendencia3m = ((sumU - sumA) / sumA) * 100;
    }
  }

  // 3) Proyección anual: ritmo mensual promedio (últimos 3 meses) × 12
  let proyeccionAnual = null;
  if (mesesPasadosConVenta.length >= 1) {
    const u3 = mesesPasadosConVenta.slice(-3);
    const promMes = u3.reduce((a, r) => a + r.sell_in, 0) / u3.length;
    proyeccionAnual = totSI + promMes * (12 - mesesPasadosConVenta.length);
  }
  const proyVsAnual = (totCuotaAnual > 0 && proyeccionAnual != null)
    ? (proyeccionAnual / totCuotaAnual) * 100
    : null;

  return (
    <div className="space-y-4">
      {/* Tarjetas pequeñas con info del trend */}
      {hayDatos && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Cumplimiento YTD */}
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Cumplimiento YTD</div>
            <div className="text-2xl font-bold tabular-nums" style={{ color: cumplYTD == null ? '#94A3B8' : cumplYTD >= 100 ? '#047857' : cumplYTD >= 70 ? '#B45309' : '#B91C1C' }}>
              {cumplYTD == null ? '—' : `${cumplYTD.toFixed(0)}%`}
            </div>
            <div className="text-[11px] text-gray-500 mt-1 leading-tight">
              {formatMXN(totSI)} de {formatMXN(totCuotaYTD)}
            </div>
          </div>

          {/* 2. Mejor mes */}
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Mejor mes</div>
            <div className="text-2xl font-bold tabular-nums text-emerald-700">
              {mejorMes ? mejorMes.label : '—'}
            </div>
            <div className="text-[11px] text-gray-500 mt-1 leading-tight">
              {mejorMes ? formatMXN(mejorMes.sell_in) : 'Sin datos aún'}
            </div>
          </div>

          {/* 3. Tendencia últimos 3 meses */}
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Tendencia 3 meses</div>
            <div className="text-2xl font-bold tabular-nums flex items-center gap-1" style={{ color: tendencia3m == null ? '#94A3B8' : tendencia3m >= 0 ? '#047857' : '#B91C1C' }}>
              {tendencia3m == null ? '—' : (
                <>
                  {tendencia3m >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                  {tendencia3m >= 0 ? '+' : ''}{tendencia3m.toFixed(0)}%
                </>
              )}
            </div>
            <div className="text-[11px] text-gray-500 mt-1 leading-tight">
              vs 3 meses anteriores
            </div>
          </div>

          {/* 4. Proyección anual */}
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Proyección anual</div>
            <div className="text-2xl font-bold tabular-nums" style={{ color: proyVsAnual == null ? '#94A3B8' : proyVsAnual >= 100 ? '#047857' : proyVsAnual >= 70 ? '#B45309' : '#B91C1C' }}>
              {proyeccionAnual == null ? '—' : formatMXN(proyeccionAnual)}
            </div>
            <div className="text-[11px] text-gray-500 mt-1 leading-tight">
              {proyVsAnual == null
                ? 'Al ritmo actual'
                : `${proyVsAnual.toFixed(0)}% de la meta anual (${formatMXN(totCuotaAnual)})`}
            </div>
          </div>
        </div>
      )}

      {/* Gráfica de líneas */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-gray-600" />
            Cuota vs Sell-In · {anioActual}
          </h3>
          <span className="text-xs text-gray-400">Digitalife + PCEL</span>
          <div className="flex-1" />
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5" style={{ backgroundColor: '#94A3B8', borderTop: '2px dashed #94A3B8', height: 0 }} />
              <span className="text-gray-600">Cuota</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5" style={{ backgroundColor: '#3B82F6' }} />
              <span className="text-gray-600">Sell-In</span>
            </span>
          </div>
        </div>
        <div className="p-4">
          {!hayDatos ? (
            <div className="h-64 flex flex-col items-center justify-center text-sm text-gray-400 gap-2">
              <BarChart3 className="w-10 h-10 text-gray-300" />
              <div className="text-center">
                <div>Sin datos para {anioActual}</div>
                <div className="text-xs mt-1">Verifica <code className="text-gray-500">cuotas_mensuales</code> y <code className="text-gray-500">sell_in_sku</code></div>
              </div>
            </div>
          ) : (
            <TrendSvg trend={trend} hoverIdx={hoverIdx} setHoverIdx={setHoverIdx} />
          )}
        </div>
      </div>
    </div>
  );
}

function TrendSvg({ trend, hoverIdx, setHoverIdx }) {
  const W = 960;
  const H = 300;
  const padL = 56, padR = 16, padT = 20, padB = 34;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const maxVal = Math.max(1, ...trend.flatMap((r) => [r.cuota || 0, r.sell_in || 0]));
  const n = trend.length;
  const slot = innerW / n;

  const yFor = (v) => padT + innerH - (v / maxVal) * innerH;
  const xFor = (i) => padL + slot * (i + 0.5);

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => (maxVal * i) / ticks);

  const fmtShort = (v) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
    return v.toFixed(0);
  };

  // Línea de cuota (12 meses, dashed gris)
  const pathCuota = trend
    .map((r, i) => `${i === 0 ? 'M' : 'L'}${xFor(i)},${yFor(r.cuota || 0)}`)
    .join(' ');

  // Línea de sell-in: solo meses con datos (no futuros)
  // Usamos una sola línea continua hasta el último mes con venta
  const trendConVenta = trend.map((r, i) => ({ ...r, _i: i }))
    .filter((r) => !r.esFuturo);
  const pathSI = trendConVenta
    .map((r, idx) => `${idx === 0 ? 'M' : 'L'}${xFor(r._i)},${yFor(r.sell_in || 0)}`)
    .join(' ');

  // Área bajo línea de Sell-In (gradiente sutil)
  const areaSI = trendConVenta.length > 0
    ? `M${xFor(trendConVenta[0]._i)},${yFor(0)} ` +
      trendConVenta.map((r) => `L${xFor(r._i)},${yFor(r.sell_in || 0)}`).join(' ') +
      ` L${xFor(trendConVenta[trendConVenta.length - 1]._i)},${yFor(0)} Z`
    : '';

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block' }}>
        <defs>
          <linearGradient id="siGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines + Y axis */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={padL} y1={yFor(v)} x2={W - padR} y2={yFor(v)} stroke="#E5E7EB" strokeDasharray="3 3" />
            <text x={padL - 6} y={yFor(v) + 4} fontSize="10" fill="#9CA3AF" textAnchor="end">
              {fmtShort(v)}
            </text>
          </g>
        ))}

        {/* Línea vertical en mes actual */}
        {trend.map((r, i) => r.esActual && (
          <line key={'now' + i}
            x1={xFor(i)} y1={padT}
            x2={xFor(i)} y2={padT + innerH}
            stroke="#1E40AF" strokeWidth="1" strokeDasharray="2 4" opacity="0.4"
          />
        ))}

        {/* Área bajo Sell-In (decorativa) */}
        {areaSI && <path d={areaSI} fill="url(#siGradient)" />}

        {/* Línea Cuota — punteada gris */}
        <path d={pathCuota} fill="none" stroke="#94A3B8" strokeWidth="2" strokeDasharray="6 4" />

        {/* Línea Sell-In */}
        <path d={pathSI} fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Puntos en cada mes — Cuota */}
        {trend.map((r, i) => (r.cuota > 0 ? (
          <circle key={'qd' + i}
            cx={xFor(i)} cy={yFor(r.cuota)}
            r={hoverIdx === i ? 4 : 2.5}
            fill="#fff" stroke="#94A3B8" strokeWidth="1.5"
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
            style={{ cursor: 'pointer' }}
          />
        ) : null))}

        {/* Puntos en cada mes — Sell-In (color por cumplimiento) */}
        {trend.map((r, i) => {
          if (r.esFuturo || (r.sell_in || 0) <= 0) return null;
          const cuota = r.cuota || 0;
          const pct = cuota > 0 ? r.sell_in / cuota : null;
          const color = pct == null ? '#3B82F6'
            : pct >= 1 ? '#10B981'
            : pct >= 0.7 ? '#F59E0B'
            : '#EF4444';
          return (
            <circle key={'sd' + i}
              cx={xFor(i)} cy={yFor(r.sell_in)}
              r={hoverIdx === i ? 6 : 4}
              fill="#fff" stroke={color} strokeWidth="2.5"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              style={{ cursor: 'pointer', transition: 'r 120ms' }}
            />
          );
        })}

        {/* Hot zone invisible para hover en cada mes */}
        {trend.map((r, i) => (
          <rect key={'hot' + i}
            x={xFor(i) - slot / 2} y={padT}
            width={slot} height={innerH}
            fill="transparent"
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
            style={{ cursor: 'pointer' }}
          />
        ))}

        {/* X axis labels */}
        {trend.map((r, i) => (
          <text
            key={'x' + i}
            x={xFor(i)}
            y={H - padB + 16}
            fontSize="10"
            fill={hoverIdx === i ? '#1F2937' : (r.esActual ? '#1E40AF' : '#6B7280')}
            textAnchor="middle"
            fontWeight={hoverIdx === i || r.esActual ? 600 : 400}
          >
            {r.label}
          </text>
        ))}
      </svg>

      {/* Tooltip */}
      {hoverIdx != null && (() => {
        const r = trend[hoverIdx];
        const cuota = r.cuota || 0;
        const si = r.sell_in || 0;
        const pct = cuota > 0 ? (si / cuota) * 100 : null;
        const falta = cuota > 0 ? Math.max(0, cuota - si) : 0;
        return (
          <div
            className="absolute pointer-events-none bg-gray-900 text-white rounded-lg px-3 py-2 text-xs shadow-lg"
            style={{
              left: `calc(${(xFor(hoverIdx) / W) * 100}% - 90px)`,
              top: 8,
              minWidth: 180,
            }}
          >
            <div className="font-semibold mb-1">
              {r.label}
              {r.esActual && <span className="ml-2 text-[10px] text-blue-300">· mes actual</span>}
              {r.esFuturo && <span className="ml-2 text-[10px] text-gray-400">· futuro</span>}
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: '#94A3B8' }} />
              Cuota: <span className="font-semibold tabular-nums ml-auto">{formatMXN(cuota)}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: '#3B82F6' }} />
              Sell-In: <span className="font-semibold tabular-nums ml-auto">{formatMXN(si)}</span>
            </div>
            {pct != null && !r.esFuturo && (
              <div className="border-t border-gray-700 mt-1 pt-1 text-[11px]">
                {pct >= 100
                  ? <span className="text-emerald-300 font-semibold">✓ Cumplida ({pct.toFixed(0)}%)</span>
                  : <span className="text-amber-300">Faltan <span className="font-semibold tabular-nums">{formatMXN(falta)}</span> ({pct.toFixed(0)}%)</span>}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
