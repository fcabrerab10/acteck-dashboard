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
  if (s >= 90) return '#10B981';  // Excelente
  if (s >= 80) return '#22C55E';  // Bien
  if (s >= 60) return '#F59E0B';  // Medio
  return '#EF4444';                // Crítico
}

function gradeScore(s) {
  if (s == null) return 'Sin datos';
  if (s >= 90) return 'Excelente';
  if (s >= 80) return 'Bien';
  if (s >= 60) return 'Medio';
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
    sellInSku: [],
    estadosCuenta: [],
    estadosCuentaDetalle: [],
    inversionMkt: [],
  });

  useEffect(() => {
    // Paginador local: supabase corta a 1000 filas por defecto.
    async function fetchAll(qFactory, pageSize = 1000) {
      const all = [];
      let from = 0;
      // bucle hasta agotar la tabla
      // (mantiene el mismo filtro/orden de qFactory en cada página)
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await qFactory().range(from, from + pageSize - 1);
        if (error || !data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return all;
    }
    (async () => {
      // Inventario cliente: usamos el MISMO adapter que HomeCliente para que
      // los números sean consistentes entre Resumen y la pestaña per-cliente.
      // PCEL → lee de sellout_pcel; Digitalife → de inventario_cliente.
      const [vaRes, cmRes, invDigi, invPcel, dsoRes, ccRes, soRows, siRows, ecRows, mkRes] = await Promise.all([
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
        fetchAll(() => supabase.from('sellout_sku')
          .select('cliente, anio, mes, sku, piezas, monto_pesos')
          .eq('anio', anioActual)),
        // sell_in_sku histórico (2 años) → cost_promedio por SKU para
        // valuar inventario y sellout de PCEL/Digitalife de manera consistente.
        fetchAll(() => supabase.from('sell_in_sku')
          .select('cliente, sku, piezas, monto_pesos')
          .gte('anio', anioActual - 1)),
        // Estados de cuenta históricos (todos) → para reconstruir cuándo
        // cada factura pasó de saldo>0 a saldo=0 y calcular días reales de
        // cobro. Limitamos a los últimos 12 meses para evitar tablas
        // gigantes.
        fetchAll(() => supabase.from('estados_cuenta')
          .select('id, cliente, fecha_corte, anio, semana')
          .order('fecha_corte', { ascending: true })),
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

      // Detalle de estados_cuenta: lo necesitamos para reconstruir cuándo
      // cada factura quedó saldada. Limitamos a los estados de los últimos
      // 12 meses para no traer histórico gigante.
      const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 12);
      const ecRecientes = (ecRows || []).filter((r) => {
        if (!r.fecha_corte) return false;
        return new Date(r.fecha_corte) >= cutoff;
      });
      const ecIds = ecRecientes.map((r) => r.id);
      let ecDetRows = [];
      if (ecIds.length > 0) {
        // Fragmentamos por chunks de 100 ids para no rebasar URL length.
        const CHUNK = 100;
        for (let i = 0; i < ecIds.length; i += CHUNK) {
          const slice = ecIds.slice(i, i + CHUNK);
          const det = await fetchAll(() => supabase.from('estados_cuenta_detalle')
            .select('estado_cuenta_id, referencia, fecha_emision, importe_factura, saldo_actual')
            .in('estado_cuenta_id', slice));
          ecDetRows.push(...det);
        }
      }

      setState({
        loading: false,
        ventasAgg:         vaRes.data  || [],
        cuotasMensuales:   cmRes.data  || [],
        inventarioCliente: invCombinado,
        dsoReal:           dsoRes.data || [],
        creditoConfig:     ccRes.data  || [],
        selloutSku:        soRows       || [],
        sellInSku:         siRows       || [],
        estadosCuenta:     ecRecientes  || [],
        estadosCuentaDetalle: ecDetRows || [],
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
// Helper: último mes con sell-in real registrado para este cliente en el
// año actual. Si el mes corriente aún no tiene datos (caso típico al inicio
// del mes), nos quedamos con el último mes que sí los tiene.
function getMesEfectivo(va) {
  const conDatos = va
    .filter((r) => Number(r.anio) === anioActual && Number(r.sell_in || 0) > 0)
    .map((r) => Number(r.mes) || 0);
  if (conDatos.length === 0) return 0;
  return Math.min(mesActual, Math.max(...conDatos));
}

function calcularResumen(clienteKey, data) {
  const va  = data.ventasAgg.filter((r) => r.cliente === clienteKey);
  const cm  = data.cuotasMensuales.filter((r) => r.cliente === clienteKey);
  // Mes efectivo: el último mes con datos reales (ignora meses corrientes vacíos)
  const mesEf = getMesEfectivo(va) || mesActual;
  const inv = data.inventarioCliente.filter((r) => r.cliente === clienteKey);
  const dsoRow = data.dsoReal.find((r) => r.cliente === clienteKey);
  const ccRow  = data.creditoConfig.find((r) => r.cliente === clienteKey);
  const so  = data.selloutSku.filter((r) => r.cliente === clienteKey);
  const si  = (data.sellInSku || []).filter((r) => r.cliente === clienteKey);
  const mk  = data.inversionMkt.filter((r) => r.cliente === clienteKey);

  // ── Costo promedio por SKU (desde sell_in_sku histórico) ──
  // Para cada SKU del cliente: sum(monto_pesos) / sum(piezas) en los últimos
  // 2 años. Esto vale el inventario y el sellout (en piezas) en MXN de
  // manera consistente entre Digitalife y PCEL — quita los efectos de
  // costo_convenio inflado o costo_promedio del cliente reportado.
  const _agg = new Map();
  si.forEach((r) => {
    const sku = (r.sku || '').toString();
    if (!sku) return;
    const cur = _agg.get(sku) || { piezas: 0, monto: 0 };
    cur.piezas += Number(r.piezas || 0);
    cur.monto  += Number(r.monto_pesos || 0);
    _agg.set(sku, cur);
  });
  const costoPromedioSku = {};
  _agg.forEach((v, k) => {
    if (v.piezas > 0 && v.monto > 0) costoPromedioSku[k] = v.monto / v.piezas;
  });

  // ── Sell-In / Sell-Out YTD ──
  // Usamos mesEf (último mes con datos reales) en lugar de mesActual para
  // no incluir el mes corriente cuando aún no tiene ventas.
  const vaAnio = va.filter((r) => r.anio === anioActual);
  const siYTD = vaAnio
    .filter((r) => Number(r.mes) <= mesEf)
    .reduce((a, r) => a + Number(r.sell_in || 0), 0);
  const soYTD = vaAnio
    .filter((r) => Number(r.mes) <= mesEf)
    .reduce((a, r) => a + Number(r.sell_out || 0), 0);

  // MoM: comparamos el último mes con datos vs el mismo mes año anterior.
  const rowMesActual = vaAnio.find((r) => Number(r.mes) === mesEf);
  const rowMesPrev   = va.find((r) => Number(r.mes) === mesEf && r.anio === anioActual - 1);
  const siMes     = Number(rowMesActual?.sell_in  || 0);
  const siMesPrev = Number(rowMesPrev?.sell_in    || 0);
  const soMes     = Number(rowMesActual?.sell_out || 0);
  const siYoY = siMesPrev > 0 ? ((siMes - siMesPrev) / siMesPrev) * 100 : null;

  // ── Cuota YTD y anual ──
  // Cuota YTD: hasta el mes efectivo (no el mes corriente sin ventas).
  let cuotaYTD = cm
    .filter((r) => Number(r.mes) <= mesEf)
    .reduce((a, r) => a + Number(r.cuota_min || 0), 0);
  let cuotaAnual = cm.reduce((a, r) => a + Number(r.cuota_min || 0), 0);
  let cuotaIdealAnual = cm.reduce((a, r) => a + Number(r.cuota_ideal || 0), 0);
  if (clienteKey === 'pcel' && cuotaAnual === 0 && PCEL_REAL?.cuota50M) {
    const c = PCEL_REAL.cuota50M;
    cuotaYTD   = Object.entries(c).filter(([m]) => Number(m) <= mesEf).reduce((a, [, v]) => a + Number(v || 0), 0);
    cuotaAnual = Object.values(c).reduce((a, v) => a + Number(v || 0), 0);
    cuotaIdealAnual = cuotaAnual;
  }

  // ── Cumplimiento dual: YTD y mes (último mes con datos) ──
  // Score de cuota: promedio de los dos cumplimientos.
  const cumplimientoYTD = cuotaYTD > 0 ? (siYTD / cuotaYTD) * 100 : null;
  // Cuota del mes efectivo y sell-in del mismo mes
  let cuotaMes = 0;
  cm.forEach((r) => { if (Number(r.mes) === mesEf) cuotaMes += Number(r.cuota_min || 0); });
  if (clienteKey === 'pcel' && cuotaMes === 0 && PCEL_REAL?.cuota50M) {
    cuotaMes = Number(PCEL_REAL.cuota50M[mesEf] || 0);
  }
  const cumplimientoMes = cuotaMes > 0 ? (siMes / cuotaMes) * 100 : null;

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
    // Valuamos cada SKU del snapshot con el costo_promedio de sell_in_sku
    // (mismo método para Digitalife y PCEL). Si un SKU no tiene historial de
    // sell-in, caemos al método anterior (valor o stock×costo_convenio) para
    // no perderlo.
    inventarioValor = snap.reduce((a, r) => {
      const sku = (r.sku || '').toString();
      const stock = Number(r.stock || 0);
      const cp = costoPromedioSku[sku];
      if (cp != null) return a + stock * cp;
      return a + invValorRow(r);
    }, 0);
    inventarioPiezas = snap.reduce((a, r) => a + Number(r.stock || 0), 0);
    inventarioSemana = `${semanaMax.anio}-${String(semanaMax.semana).padStart(2,'0')}`;
  }

  // ── Cobertura en DÍAS — mismo método para Digitalife y PCEL ──
  // sellout_MXN = sum(piezas_sellout × costo_promedio_sku) en últimos 3 meses.
  // Esto IGNORA monto_pesos del sellout_sku (Digitalife reporta a precio venta;
  // PCEL no reporta monto). Así inventario y sellout están en la MISMA escala
  // (costo) y la cobertura es comparable entre clientes.
  const ultMes = so.length > 0 ? Math.max(...so.map((r) => Number(r.mes) || 0)) : 0;
  let coberturaDias = null;
  if (inventarioValor > 0 && ultMes > 0) {
    const desde = Math.max(1, ultMes - 2);
    const montoSO = so
      .filter((r) => Number(r.mes) >= desde && Number(r.mes) <= ultMes)
      .reduce((a, r) => {
        const sku = (r.sku || '').toString();
        const piezas = Number(r.piezas || 0);
        const cp = costoPromedioSku[sku];
        if (cp != null) return a + piezas * cp;
        // Fallback: si no hay costo_promedio para este SKU, usa monto_pesos
        // reportado (puede ser 0 para PCEL — ese SKU queda sin contribución).
        return a + Number(r.monto_pesos || 0);
      }, 0);
    let dias = 0;
    for (let m = desde; m <= ultMes; m++) {
      dias += new Date(anioActual, m, 0).getDate();
    }
    const soDiario = dias > 0 ? montoSO / dias : 0;
    coberturaDias = soDiario > 0 ? Math.round(inventarioValor / soDiario) : null;
  }

  // ── Plazo de crédito ──
  const plazo = Number(ccRow?.plazo_dias_credito || 90);
  const saldoVencido = Number(dsoRow?.saldo_vencido || 0);
  const saldoActual  = Number(dsoRow?.saldo_actual_total || 0);
  const aging90      = Number(dsoRow?.aging_mas90 || 0);
  const pctVencido = saldoActual > 0
    ? (saldoVencido / saldoActual) * 100
    : (saldoVencido > 0 ? 100 : 0);

  // ── Días de cobro (reemplaza DSO) ──
  // Recorremos los estados_cuenta del cliente en orden cronológico y
  // detectamos cuándo cada factura pasó de saldo>0 a saldo=0 (= pagada).
  // dias_cobro_factura = fecha_corte_estado_pagado - fecha_emision
  // Promedio ponderado por importe_factura, considerando solo facturas
  // pagadas en los últimos 6 meses (recientes = más representativo del
  // comportamiento actual).
  const diasCobro = (() => {
    const ec = (data.estadosCuenta || [])
      .filter((r) => r.cliente === clienteKey && r.fecha_corte)
      .sort((a, b) => new Date(a.fecha_corte) - new Date(b.fecha_corte));
    if (ec.length < 2) return null;
    const idToFechaCorte = new Map(ec.map((e) => [e.id, e.fecha_corte]));
    const idIndex = new Map(ec.map((e, i) => [e.id, i]));
    const det = (data.estadosCuentaDetalle || []).filter((r) => idToFechaCorte.has(r.estado_cuenta_id));

    // Agrupar por factura (referencia + fecha_emision)
    const facturas = new Map();
    det.forEach((r) => {
      const ref = (r.referencia || '').toString();
      const fe = r.fecha_emision || '';
      if (!ref || !fe) return;
      const key = ref + '|' + fe;
      const idx = idIndex.get(r.estado_cuenta_id);
      if (idx == null) return;
      const list = facturas.get(key) || { fecha_emision: fe, importe: Number(r.importe_factura || 0), eventos: [] };
      list.importe = Math.max(list.importe, Number(r.importe_factura || 0));
      list.eventos.push({ idx, fecha_corte: idToFechaCorte.get(r.estado_cuenta_id), saldo: Number(r.saldo_actual || 0) });
      facturas.set(key, list);
    });

    const cutoffPago = new Date(); cutoffPago.setMonth(cutoffPago.getMonth() - 6);
    let num = 0, den = 0;
    facturas.forEach((f) => {
      if (f.eventos.length < 2) return;
      f.eventos.sort((a, b) => a.idx - b.idx);
      // Buscar transición saldo>0 → saldo=0
      let pagoEnIdx = -1;
      for (let i = 1; i < f.eventos.length; i++) {
        if (f.eventos[i - 1].saldo > 0 && f.eventos[i].saldo === 0) {
          pagoEnIdx = i; break;
        }
      }
      if (pagoEnIdx < 0) return;
      const fechaPago = f.eventos[pagoEnIdx].fecha_corte;
      if (new Date(fechaPago) < cutoffPago) return; // solo últimos 6 meses
      const dias = Math.round(
        (new Date(fechaPago) - new Date(f.fecha_emision)) / (1000 * 60 * 60 * 24)
      );
      if (dias < 0 || dias > 720) return; // sanidad
      const peso = Number(f.importe) || 1;
      num += dias * peso;
      den += peso;
    });
    return den > 0 ? Math.round(num / den) : null;
  })();
  // Mantenemos `dsoReal` como alias para compatibilidad con el resto del
  // código (alertas, render). Ahora apunta a "días de cobro" calculado.
  const dsoReal = diasCobro;

  // ── Inversión marketing YTD y ROI ──
  // Lee de marketing_actividades (campo `inversion`), igual que la pestaña
  // Pagos → Marketing del cliente. mes puede venir como string (ej. "3").
  const invMktYTD = mk
    .filter((r) => Number(r.mes) <= mesActual)
    .reduce((a, r) => a + Number(r.inversion || 0), 0);
  const roiMkt = invMktYTD > 0 ? soYTD / invMktYTD : null;

  // ═════ Scores (0–100) — cada uno usa umbrales de las pestañas per-cliente ═════

  // 1) Cumplimiento cuota YTD vs YTD — 100% = 100pts (satura), 50% = 50pts
  // Score de cuota: promedio del cumplimiento del mes y del YTD.
  // Si solo uno está disponible, usar ese. Si ninguno, null.
  const scoreCuota = (() => {
    const partes = [];
    if (cumplimientoYTD != null) partes.push(clamp(cumplimientoYTD, 0, 100));
    if (cumplimientoMes != null) partes.push(clamp(cumplimientoMes, 0, 100));
    if (partes.length === 0) return null;
    return partes.reduce((a, x) => a + x, 0) / partes.length;
  })();

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

  // 5) ROI marketing: ≥20x = 100pts, ≤4x = 0pts (lineal entre rangos)
  const scoreMkt = roiMkt != null
    ? clamp(((roiMkt - 4) / 16) * 100, 0, 100)
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
      // A1: últimos 6 meses con sell-in real y cuota de referencia.
      // Anclamos al último mes con datos reales (no al mes corriente vacío).
      const mesAncla = mesEf > 0 ? mesEf : mesActual;
      const out = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(anioActual, mesAncla - 1 - i, 1);
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
    cuotaMes, cumplimientoMes, mesEf,
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
  // Mes efectivo: último mes con sell_out real (ML no tiene sell_in).
  const mesesConSO = vaAnio.filter((r) => Number(r.sell_out || 0) > 0).map((r) => Number(r.mes) || 0);
  const mesEfML = mesesConSO.length > 0 ? Math.min(mesActual, Math.max(...mesesConSO)) : mesActual;
  const soYTD = vaAnio.filter((r) => Number(r.mes) <= mesEfML).reduce((a, r) => a + Number(r.sell_out || 0), 0);
  const soYTDPrev = va.filter((r) => r.anio === anioActual - 1 && Number(r.mes) <= mesEfML)
    .reduce((a, r) => a + Number(r.sell_out || 0), 0);
  const soMes     = Number(vaAnio.find((r) => Number(r.mes) === mesEfML)?.sell_out || 0);
  const soMesPrev = Number(va.find((r) => Number(r.mes) === mesEfML && r.anio === anioActual - 1)?.sell_out || 0);
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
// Trend: 12 meses del AÑO en curso. Cuota vs Sell-In real + sell-in año
// pasado como referencia (D5). Filtrable por cliente (D1).
function calcularTrend(data, clienteFiltro = 'todos') {
  const cuotaPcelFallback = (() => {
    const tienePcelEnBD = data.cuotasMensuales.some((r) => r.cliente === 'pcel');
    if (tienePcelEnBD || !PCEL_REAL?.cuota50M) return null;
    return PCEL_REAL.cuota50M;
  })();
  const aplicaCliente = (cli) => {
    if (clienteFiltro === 'todos') return cli !== 'mercadolibre';
    return cli === clienteFiltro;
  };

  // Mes efectivo del trend: último mes con sell-in real para los clientes
  // filtrados. Si el mes corriente está vacío, se considera futuro para
  // que la línea no caiga a 0 y el mes actual no engañe al ojo.
  const mesesConDatos = data.ventasAgg
    .filter((r) => Number(r.anio) === anioActual && aplicaCliente(r.cliente) && Number(r.sell_in || 0) > 0)
    .map((r) => Number(r.mes) || 0);
  const mesEfTrend = mesesConDatos.length > 0
    ? Math.min(mesActual, Math.max(...mesesConDatos))
    : mesActual;

  return Array.from({ length: 12 }, (_, idx) => {
    const mes = idx + 1;
    let cuota = 0, si = 0, siPrev = 0;
    data.cuotasMensuales.forEach((r) => {
      if (Number(r.mes) !== mes) return;
      if (!aplicaCliente(r.cliente)) return;
      cuota += Number(r.cuota_min || 0);
    });
    if (cuotaPcelFallback && cuotaPcelFallback[mes] != null) {
      const incluyePcel = clienteFiltro === 'todos' || clienteFiltro === 'pcel';
      const pcelEnBD = data.cuotasMensuales.some((r) => r.cliente === 'pcel');
      if (incluyePcel && !pcelEnBD) cuota += Number(cuotaPcelFallback[mes] || 0);
    }
    data.ventasAgg.forEach((r) => {
      if (Number(r.mes) !== mes) return;
      if (!aplicaCliente(r.cliente)) return;
      if (Number(r.anio) === anioActual) si += Number(r.sell_in || 0);
      else if (Number(r.anio) === anioActual - 1) siPrev += Number(r.sell_in || 0);
    });
    return {
      mes,
      label: MESES_CORTO[idx],
      cuota,
      sell_in: si,
      sell_in_prev: siPrev,
      esActual: mes === mesEfTrend,
      // Considerar "futuro" cualquier mes posterior al último con datos
      // reales (incluye el mes corriente si aún no hay ventas).
      esFuturo: mes > mesEfTrend,
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
        mensaje: `Días de cobro ${resumen.dsoReal}d (plazo ${resumen.dsoPlazo}d)`,
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

  // Trend: filtros (D1 cliente, D3 modo)
  const [trendCliente, setTrendCliente] = useState('todos');  // todos|digitalife|pcel
  const [trendModo, setTrendModo] = useState('mensual');       // mensual|acumulado
  const trend = useMemo(
    () => data.loading ? [] : calcularTrend(data, trendCliente),
    [data, trendCliente]
  );

  // E5: Embudo Sell-In → Sell-Out · % conversion del año
  const embudo = useMemo(() => {
    if (data.loading) return null;
    // Usamos el mismo criterio: hasta el último mes con sell-in real
    const mesesConDatosEmb = (data.ventasAgg || [])
      .filter((r) => Number(r.anio) === anioActual && Number(r.sell_in || 0) > 0)
      .map((r) => Number(r.mes) || 0);
    const mesEfEmb = mesesConDatosEmb.length > 0
      ? Math.min(mesActual, Math.max(...mesesConDatosEmb))
      : mesActual;
    let siYTD = 0, soYTD = 0;
    const porCliente = {};
    (data.ventasAgg || []).forEach((r) => {
      if (Number(r.anio) !== anioActual) return;
      if (Number(r.mes) > mesEfEmb) return;
      const si = Number(r.sell_in || 0);
      const so = Number(r.sell_out || 0);
      siYTD += si;
      soYTD += so;
      const k = r.cliente;
      if (!porCliente[k]) porCliente[k] = { si: 0, so: 0 };
      porCliente[k].si += si;
      porCliente[k].so += so;
    });
    const conv = siYTD > 0 ? (soYTD / siYTD) * 100 : null;
    return { siYTD, soYTD, conv, porCliente };
  }, [data]);

  // C4: SKUs con cobertura < 45 días en CUALQUIER cliente.
  // Cobertura = stock cliente / (sellout últimos 90d / 90).
  // Pasa al ReporteSection como prop para que haga highlight.
  const skusEnRiesgoCobertura = useMemo(() => {
    if (data.loading) return new Set();
    const UMBRAL = 45;
    // Mapa: sku → { digitalife: {stock, soDiario}, pcel: {stock, soDiario} }
    const porSku = {};
    // Inventario cliente — semana más reciente por cliente
    const invValidos = (data.inventarioCliente || []).filter(
      (r) => r.anio != null && r.semana != null
    );
    const ultimaSem = {};  // cliente → "anio-semana"
    invValidos.forEach((r) => {
      const k = r.cliente;
      const w = Number(r.anio) * 100 + Number(r.semana);
      if (!ultimaSem[k] || w > ultimaSem[k]) ultimaSem[k] = w;
    });
    invValidos.forEach((r) => {
      const w = Number(r.anio) * 100 + Number(r.semana);
      if (ultimaSem[r.cliente] !== w) return;
      const sku = (r.sku || '').toString();
      if (!sku) return;
      if (!porSku[sku]) porSku[sku] = {};
      if (!porSku[sku][r.cliente]) porSku[sku][r.cliente] = { stock: 0, soDiario: 0 };
      porSku[sku][r.cliente].stock += Number(r.stock) || 0;
    });
    // Sellout últimos 90 días (3 meses): suma piezas / 90
    const mesesUlt = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(anioActual, mesActual - 1 - i, 1);
      mesesUlt.push({ anio: d.getFullYear(), mes: d.getMonth() + 1 });
    }
    (data.selloutSku || []).forEach((r) => {
      const inWin = mesesUlt.some((m) => m.anio === Number(r.anio) && m.mes === Number(r.mes));
      if (!inWin) return;
      const sku = (r.sku || '').toString();
      if (!sku) return;
      if (!porSku[sku]) porSku[sku] = {};
      if (!porSku[sku][r.cliente]) porSku[sku][r.cliente] = { stock: 0, soDiario: 0 };
      porSku[sku][r.cliente].soDiario += (Number(r.piezas) || 0) / 90;
    });
    // Determinar SKUs en riesgo
    const set = new Set();
    Object.entries(porSku).forEach(([sku, clientes]) => {
      let minCov = Infinity;
      Object.values(clientes).forEach((c) => {
        if (c.soDiario > 0) {
          const cov = c.stock / c.soDiario;
          if (cov < minCov) minCov = cov;
        }
      });
      if (minCov < UMBRAL) set.add(sku);
    });
    return set;
  }, [data]);
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
      <ReporteSection skusEnRiesgo={skusEnRiesgoCobertura} />

      {/* Trend consolidado: Cuota vs Sell-In año en curso */}
      <TrendConsolidado
        trend={trend}
        trendCliente={trendCliente}
        setTrendCliente={setTrendCliente}
        trendModo={trendModo}
        setTrendModo={setTrendModo}
      />

      {/* E5: Embudo Sell-In → Sell-Out (% conversión del año) */}
      {embudo && (embudo.siYTD > 0 || embudo.soYTD > 0) && <EmbudoConversion embudo={embudo} />}
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
              title={`${resumen.componentesSinDatos} componente(s) pendiente(s) de cargar info. El score los cuenta como 0.`}>
              <AlertTriangle className="w-2.5 h-2.5" />
              {resumen.componentesSinDatos} pendiente{resumen.componentesSinDatos > 1 ? 's' : ''}
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

      {/* Cumplimiento Mes + YTD (los dos que componen el score de cuota) */}
      <div className="border-t border-gray-100 px-5 py-3 space-y-2">
        <div className="grid grid-cols-2 gap-3">
          {/* Mes */}
          <div className="bg-gray-50 rounded-lg p-2">
            <div className="text-[10px] uppercase text-gray-500 tracking-wide">
              Mes {resumen.mesEf ? MESES_CORTO[resumen.mesEf - 1] : ''}
            </div>
            <div className="font-bold text-base" style={{ color: resumen.cumplimientoMes != null ? colorScore(resumen.cumplimientoMes) : '#94A3B8' }}>
              {resumen.cumplimientoMes != null ? pct(resumen.cumplimientoMes) : '—'}
            </div>
            <div className="text-[10px] text-gray-500 leading-tight">
              {formatMXN(resumen.siMes || 0)} / {formatMXN(resumen.cuotaMes || 0)}
            </div>
          </div>
          {/* YTD */}
          <div className="bg-gray-50 rounded-lg p-2">
            <div className="text-[10px] uppercase text-gray-500 tracking-wide">YTD acum.</div>
            <div className="font-bold text-base" style={{ color: resumen.cumplimientoYTD != null ? colorScore(resumen.cumplimientoYTD) : '#94A3B8' }}>
              {resumen.cumplimientoYTD != null ? pct(resumen.cumplimientoYTD) : '—'}
            </div>
            <div className="text-[10px] text-gray-500 leading-tight">
              {formatMXN(resumen.siYTD || 0)} / {formatMXN(resumen.cuotaYTD || 0)}
            </div>
          </div>
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
          <div className="text-gray-500">Días de cobro</div>
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
    dso:        'Días de cobro',
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
      title={sinDatos ? 'Pendiente cargar info — cuenta como 0 en el score' : undefined}>
      <Icon className="w-3 h-3 text-gray-400 shrink-0" />
      <div className="flex-1 min-w-0 truncate text-gray-600">
        {labels[id]}
        {sinDatos && <span className="ml-1 text-amber-600 text-[9px]">⚠ Pendiente cargar info</span>}
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

// E5: Embudo Sell-In → Sell-Out (% conversion del año)
function EmbudoConversion({ embudo }) {
  const { siYTD, soYTD, conv, porCliente } = embudo;
  const max = Math.max(siYTD, soYTD, 1);
  const wSI = (siYTD / max) * 100;
  const wSO = (soYTD / max) * 100;
  // Color por % conversion: > 90% verde · 70-90% ámbar · < 70% rojo
  const colorConv = conv == null ? '#94A3B8'
    : conv >= 90 ? '#10B981'
    : conv >= 70 ? '#F59E0B'
    : '#EF4444';
  const labelConv = conv == null ? 'Sin datos'
    : conv >= 90 ? 'Excelente — el cliente está moviendo lo que le mandas'
    : conv >= 70 ? 'Aceptable — algo se está acumulando'
    : 'Baja conversión — riesgo de sobreinventario en cliente';

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-gray-600" />
          Embudo Sell-In → Sell-Out · YTD {anioActual}
        </h3>
        <span className="text-xs text-gray-400">Lo que mandas vs lo que el cliente desplaza</span>
      </div>
      <div className="p-5 space-y-4">
        {/* Barras horizontales */}
        <div className="space-y-3">
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs font-semibold text-gray-700">📤 Sell-In (lo que enviaste)</span>
              <span className="text-sm font-bold tabular-nums text-blue-700">{formatMXN(siYTD)}</span>
            </div>
            <div className="h-6 bg-gray-100 rounded-md overflow-hidden">
              <div className="h-full bg-blue-500 rounded-md transition-all" style={{ width: `${wSI}%` }} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs font-semibold text-gray-700">📦 Sell-Out (lo que el cliente vendió)</span>
              <span className="text-sm font-bold tabular-nums text-emerald-700">{formatMXN(soYTD)}</span>
            </div>
            <div className="h-6 bg-gray-100 rounded-md overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-md transition-all" style={{ width: `${wSO}%` }} />
            </div>
          </div>
        </div>

        {/* % conversion grande */}
        <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide">Conversión</div>
            <div className="text-3xl font-bold tabular-nums" style={{ color: colorConv }}>
              {conv == null ? '—' : `${conv.toFixed(0)}%`}
            </div>
          </div>
          <div className="flex-1 text-xs text-gray-600">
            <div className="font-semibold" style={{ color: colorConv }}>{labelConv}</div>
            <div className="text-gray-500 mt-1">
              {conv != null && (
                conv >= 100
                  ? `El cliente está vendiendo más de lo que le envías — está rotando inventario viejo o creciendo.`
                  : conv >= 90
                    ? `Casi todo lo que le envías se está vendiendo. Saludable.`
                    : conv >= 70
                      ? `Acumulando ~${(100 - conv).toFixed(0)}% del inventario que le envías. Ojo.`
                      : `Acumulando >${(100 - conv).toFixed(0)}% — revisar si el sugerido está calibrado.`
              )}
            </div>
          </div>
        </div>

        {/* Por cliente individual (si hay más de uno con datos) */}
        {Object.keys(porCliente).filter(k => porCliente[k].si > 0).length > 1 && (
          <div className="pt-3 border-t border-gray-100">
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Por cliente</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {Object.entries(porCliente)
                .filter(([, v]) => v.si > 0)
                .map(([cli, v]) => {
                  const pct = v.si > 0 ? (v.so / v.si) * 100 : null;
                  const c = pct == null ? '#94A3B8'
                    : pct >= 90 ? '#10B981'
                    : pct >= 70 ? '#F59E0B'
                    : '#EF4444';
                  const nombre = cli === 'digitalife' ? 'Digitalife' : cli === 'pcel' ? 'PCEL' : 'Mercado Libre';
                  return (
                    <div key={cli} className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs font-semibold text-gray-700 mb-1">{nombre}</div>
                      <div className="flex items-baseline justify-between text-[11px] text-gray-500">
                        <span>SI {formatMXN(v.si)}</span>
                        <span>SO {formatMXN(v.so)}</span>
                      </div>
                      <div className="text-xl font-bold mt-1" style={{ color: c }}>
                        {pct == null ? '—' : `${pct.toFixed(0)}%`}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
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
function TrendConsolidado({ trend, trendCliente = 'todos', setTrendCliente, trendModo = 'mensual', setTrendModo }) {
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
        <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-gray-600" />
            Cuota vs Sell-In · {anioActual}
          </h3>
          {/* D1: toggle por cliente */}
          {setTrendCliente && (
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              {[
                { v: 'todos', label: 'Todos' },
                { v: 'digitalife', label: 'Digitalife' },
                { v: 'pcel', label: 'PCEL' },
              ].map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setTrendCliente(opt.v)}
                  className={[
                    'px-2.5 py-0.5 rounded-md text-xs font-medium transition',
                    trendCliente === opt.v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
          {/* D3: toggle modo mensual/acumulado */}
          {setTrendModo && (
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              {[
                { v: 'mensual', label: 'Mensual' },
                { v: 'acumulado', label: 'Acumulado YTD' },
              ].map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setTrendModo(opt.v)}
                  className={[
                    'px-2.5 py-0.5 rounded-md text-xs font-medium transition',
                    trendModo === opt.v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 border-t-2 border-dashed border-gray-400" />
              <span className="text-gray-600">Cuota</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-0.5" style={{ backgroundColor: '#3B82F6' }} />
              <span className="text-gray-600">Sell-In</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 border-t border-dotted" style={{ borderColor: '#A78BFA' }} />
              <span className="text-gray-600">Sell-In {anioActual - 1}</span>
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
            <TrendSvg trend={trend} modo={trendModo} hoverIdx={hoverIdx} setHoverIdx={setHoverIdx} />
          )}
        </div>
      </div>
    </div>
  );
}

function TrendSvg({ trend, hoverIdx, setHoverIdx, modo = 'mensual' }) {
  // Modo acumulado: convertir cada mes en suma desde enero hasta ese mes.
  // En meses futuros, no acumular el sell-in/sell-in-prev (los dejamos en 0
  // tras el último mes con datos para que la línea no caiga).
  const trendDisplay = (() => {
    if (modo !== 'acumulado') return trend;
    let cuAcum = 0, siAcum = 0, siPrevAcum = 0;
    let lastSI = 0, lastSIP = 0;
    return trend.map((r) => {
      cuAcum += r.cuota || 0;
      if (!r.esFuturo) {
        siAcum += r.sell_in || 0;
        siPrevAcum += r.sell_in_prev || 0;
        lastSI = siAcum;
        lastSIP = siPrevAcum;
      }
      return {
        ...r,
        cuota: cuAcum,
        sell_in: r.esFuturo ? lastSI : siAcum,
        sell_in_prev: r.esFuturo ? lastSIP : siPrevAcum,
      };
    });
  })();
  const W = 960;
  const H = 300;
  const padL = 56, padR = 16, padT = 20, padB = 34;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const maxVal = Math.max(1, ...trendDisplay.flatMap((r) => [r.cuota || 0, r.sell_in || 0, r.sell_in_prev || 0]));
  const n = trendDisplay.length;
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
  const pathCuota = trendDisplay
    .map((r, i) => `${i === 0 ? 'M' : 'L'}${xFor(i)},${yFor(r.cuota || 0)}`)
    .join(' ');

  // Línea de sell-in: solo meses con datos (no futuros)
  const trendConVenta = trendDisplay.map((r, i) => ({ ...r, _i: i }))
    .filter((r) => !r.esFuturo);
  const pathSI = trendConVenta
    .map((r, idx) => `${idx === 0 ? 'M' : 'L'}${xFor(r._i)},${yFor(r.sell_in || 0)}`)
    .join(' ');

  // D5: línea fantasma sell-in año pasado (12 meses si hay datos)
  const tieneSIprev = trendDisplay.some((r) => (r.sell_in_prev || 0) > 0);
  const pathSIprev = tieneSIprev
    ? trendDisplay
        .map((r, i) => `${i === 0 ? 'M' : 'L'}${xFor(i)},${yFor(r.sell_in_prev || 0)}`)
        .join(' ')
    : null;

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
        {trendDisplay.map((r, i) => r.esActual && (
          <line key={'now' + i}
            x1={xFor(i)} y1={padT}
            x2={xFor(i)} y2={padT + innerH}
            stroke="#1E40AF" strokeWidth="1" strokeDasharray="2 4" opacity="0.4"
          />
        ))}

        {/* Área bajo Sell-In (decorativa) */}
        {areaSI && <path d={areaSI} fill="url(#siGradient)" />}

        {/* D5: Línea fantasma Sell-In año anterior */}
        {pathSIprev && (
          <path d={pathSIprev} fill="none" stroke="#A78BFA" strokeWidth="1.5" strokeDasharray="2 3" opacity="0.7" />
        )}

        {/* Línea Cuota — punteada gris */}
        <path d={pathCuota} fill="none" stroke="#94A3B8" strokeWidth="2" strokeDasharray="6 4" />

        {/* Línea Sell-In */}
        <path d={pathSI} fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Puntos en cada mes — Cuota */}
        {trendDisplay.map((r, i) => (r.cuota > 0 ? (
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
        {trendDisplay.map((r, i) => {
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
        {trendDisplay.map((r, i) => (
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
        {trendDisplay.map((r, i) => (
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
        const r = trendDisplay[hoverIdx];
        const cuota = r.cuota || 0;
        const si = r.sell_in || 0;
        const siPrev = r.sell_in_prev || 0;
        const pct = cuota > 0 ? (si / cuota) * 100 : null;
        const falta = cuota > 0 ? Math.max(0, cuota - si) : 0;
        const yoy = siPrev > 0 ? ((si - siPrev) / siPrev) * 100 : null;
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
            {siPrev > 0 && (
              <div className="flex items-center gap-2 text-[11px]">
                <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: '#A78BFA' }} />
                Sell-In {anioActual - 1}: <span className="font-semibold tabular-nums ml-auto">{formatMXN(siPrev)}</span>
              </div>
            )}
            {yoy != null && !r.esFuturo && (
              <div className={"text-[11px] " + (yoy >= 0 ? 'text-emerald-300' : 'text-red-300')}>
                {yoy >= 0 ? '+' : ''}{yoy.toFixed(0)}% vs año anterior
              </div>
            )}
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
