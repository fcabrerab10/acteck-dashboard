import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatMXN } from '../../lib/utils';
import { PCEL_REAL } from '../../lib/constants';
import { fetchInventarioCliente } from '../../lib/pcelAdapter';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { TrendingUp, AlertTriangle, Target, Package } from 'lucide-react';

/**
 * Resumen Clientes v3 — Apple Bento editorial
 * ─────────────────────────────────────────────
 * - Hero card negra con facturación consolidada de los 3 clientes
 * - 4 insight cards Apple Fitness (Cuota · Cobranza · Sell-Out · Cobertura)
 * - Share vs empresa como KPI destacado en el hero
 * - Trend 12 meses estilo Apple Health
 * - Alertas cross-cliente en chips
 * - 3 cards clientes (Digitalife · PCEL · Dicotech) con narrativa
 */

const CLIENTES = [
  { key: 'digitalife', nombre: 'Digitalife', marca: 'Acteck · Balam Rush', color: '#007AFF', letter: 'D' },
  { key: 'pcel',       nombre: 'PCEL',       marca: 'Acteck',              color: '#FF3B30', letter: 'P' },
  { key: 'dicotech',   nombre: 'Dicotech',   marca: 'Acteck · Balam Rush', color: '#AF52DE', letter: 'Di' },
];

const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const hoy = new Date();
const anioActual = hoy.getFullYear();
const mesActual  = hoy.getMonth() + 1;

// ────────── Helpers de formato ──────────
function fmtCompact(n) {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(v >= 10_000_000 ? 1 : 2)}M`;
  if (abs >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}
function fmtPct(n) { return Number.isFinite(n) ? `${n.toFixed(0)}%` : '—'; }
function fmtInt(n) { return new Intl.NumberFormat('es-MX').format(Number(n) || 0); }

function invValorRow(r) {
  const v = Number(r.valor) || 0;
  if (v > 0) return v;
  return (Number(r.stock) || 0) * (Number(r.costo_convenio) || 0);
}

// ────────── Hook: data loader ──────────
function useResumenData() {
  const [state, setState] = useState({
    loading: true,
    ventasAgg: [],           // TODOS los clientes (para share vs empresa)
    cuotasMensuales: [],
    inventarioCliente: [],
    dsoReal: [],
    creditoConfig: [],
    selloutSku: [],
    selloutPcelSemanal: [],
    selloutPcelMensual: [],
    sellInSku: [],
    estadosCuenta: [],
    estadosCuentaDetalle: [],
  });

  useEffect(() => {
    async function fetchAll(qFactory, pageSize = 1000) {
      const all = []; let from = 0;
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
      const [vaRes, cmRes, invDigi, invPcel, invDico, dsoRes, ccRes, soRows, soPcelRows, soPcelMenRows, siRows, ecRows] = await Promise.all([
        supabase.from('v_ventas_mensuales_agg')
          .select('cliente, anio, mes, sell_in, sell_out')
          .gte('anio', anioActual - 1),
        supabase.from('cuotas_mensuales')
          .select('cliente, mes, anio, cuota_min, cuota_ideal')
          .eq('anio', anioActual),
        fetchInventarioCliente('digitalife'),
        fetchInventarioCliente('pcel'),
        fetchInventarioCliente('dicotech').catch(() => []),
        supabase.from('v_dso_real')
          .select('cliente, fecha_corte, saldo_actual_total, saldo_vencido, dso_real, dso_erp, aging_mas90, facturas_abiertas'),
        supabase.from('clientes_credito_config')
          .select('cliente, plazo_dias_credito, linea_credito_usd'),
        fetchAll(() => supabase.from('sellout_sku')
          .select('cliente, anio, mes, sku, piezas, monto_pesos')
          .eq('anio', anioActual)),
        fetchAll(() => supabase.from('sellout_pcel')
          .select('sku, anio, semana, vta_semana, costo_promedio')
          .eq('anio', anioActual)),
        fetchAll(() => supabase.from('sellout_pcel_mensual')
          .select('sku, anio, mes, piezas')
          .eq('anio', anioActual)),
        fetchAll(() => supabase.from('sell_in_sku')
          .select('cliente, sku, piezas, monto_pesos')
          .gte('anio', anioActual - 1)),
        fetchAll(() => supabase.from('estados_cuenta')
          .select('id, cliente, fecha_corte, anio, semana')
          .order('fecha_corte', { ascending: true })),
      ]);

      const invCombinado = [
        ...(invDigi || []).map((r) => ({ ...r, cliente: 'digitalife' })),
        ...(invPcel || []).map((r) => ({ ...r, cliente: 'pcel' })),
        ...(invDico || []).map((r) => ({ ...r, cliente: 'dicotech' })),
      ];

      const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 12);
      const ecRecientes = (ecRows || []).filter((r) => r.fecha_corte && new Date(r.fecha_corte) >= cutoff);
      const ecIds = ecRecientes.map((r) => r.id);
      let ecDetRows = [];
      if (ecIds.length > 0) {
        const CHUNK = 100;
        for (let i = 0; i < ecIds.length; i += CHUNK) {
          const slice = ecIds.slice(i, i + CHUNK);
          const det = await fetchAll(() => supabase.from('estados_cuenta_detalle')
            .select('estado_cuenta_id, referencia, fecha_emision, importe_factura, saldo_actual, dias_moratorios')
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
        selloutSku:        soRows      || [],
        selloutPcelSemanal:  soPcelRows    || [],
        selloutPcelMensual:  soPcelMenRows || [],
        sellInSku:         siRows      || [],
        estadosCuenta:     ecRecientes || [],
        estadosCuentaDetalle: ecDetRows || [],
      });
    })();
  }, []);

  return state;
}

// ────────── Cálculo por cliente (sin scores) ──────────
function getMesEfectivo(va) {
  const conDatos = va
    .filter((r) => Number(r.anio) === anioActual && Number(r.sell_in || 0) > 0)
    .map((r) => Number(r.mes) || 0);
  if (conDatos.length === 0) return 0;
  return Math.min(mesActual, Math.max(...conDatos));
}

function calcularResumen(clienteKey, data) {
  const va = data.ventasAgg.filter((r) => r.cliente === clienteKey);
  const cm = data.cuotasMensuales.filter((r) => r.cliente === clienteKey);
  const mesEf = getMesEfectivo(va) || mesActual;
  const inv = data.inventarioCliente.filter((r) => r.cliente === clienteKey);
  const dsoRow = data.dsoReal.find((r) => r.cliente === clienteKey);
  const ccRow  = data.creditoConfig.find((r) => r.cliente === clienteKey);
  const so = data.selloutSku.filter((r) => r.cliente === clienteKey);
  const si = (data.sellInSku || []).filter((r) => r.cliente === clienteKey);

  // Costo promedio por SKU
  const _agg = new Map();
  si.forEach((r) => {
    const sku = (r.sku || '').toString(); if (!sku) return;
    const cur = _agg.get(sku) || { piezas: 0, monto: 0 };
    cur.piezas += Number(r.piezas || 0);
    cur.monto  += Number(r.monto_pesos || 0);
    _agg.set(sku, cur);
  });
  const costoPromedioSku = {};
  _agg.forEach((v, k) => { if (v.piezas > 0 && v.monto > 0) costoPromedioSku[k] = v.monto / v.piezas; });

  // Sell-In YTD / mes
  const vaAnio = va.filter((r) => r.anio === anioActual);
  const siYTD = vaAnio.filter((r) => Number(r.mes) <= mesEf).reduce((a, r) => a + Number(r.sell_in || 0), 0);
  const rowMesActual = vaAnio.find((r) => Number(r.mes) === mesEf);
  const rowMesPrev   = vaAnio.find((r) => Number(r.mes) === mesEf - 1);
  const siMes     = Number(rowMesActual?.sell_in || 0);
  const siMesPrev = Number(rowMesPrev?.sell_in   || 0);
  const siMoM = siMesPrev > 0 ? ((siMes - siMesPrev) / siMesPrev) * 100 : null;

  // Sell-Out YTD / mes (Digitalife = precio venta · PCEL = a costo)
  let soYTD = 0, soMes = 0, selloutACosto = false;
  if (clienteKey === 'pcel') {
    selloutACosto = true;
    const costoFromInvPcel = {};
    inv.forEach((r) => {
      const k = (r.sku || '').toString(); const c = Number(r.costo_convenio || 0);
      if (k && c > 0 && !costoFromInvPcel[k]) costoFromInvPcel[k] = c;
    });
    const costoPorSku = (sku) => costoFromInvPcel[sku] || costoPromedioSku[sku] || 0;
    (data.selloutPcelMensual || []).forEach((r) => {
      const sku = (r.sku || '').toString();
      const piezas = Number(r.piezas || 0);
      const costo = costoPorSku(sku);
      if (piezas <= 0 || costo <= 0) return;
      const monto = piezas * costo;
      if (Number(r.mes) <= mesEf) soYTD += monto;
      if (Number(r.mes) === mesEf) soMes += monto;
    });
    if (soYTD === 0) {
      (data.selloutPcelSemanal || []).forEach((r) => {
        const piezas = Number(r.vta_semana || 0);
        const costo = Number(r.costo_promedio || 0);
        if (piezas <= 0 || costo <= 0) return;
        soYTD += piezas * costo;
      });
    }
  } else {
    so.forEach((r) => {
      const monto = Number(r.monto_pesos || 0);
      if (Number(r.mes) <= mesEf) soYTD += monto;
      if (Number(r.mes) === mesEf) soMes += monto;
    });
  }

  // Cuota YTD / mes / anual
  let cuotaYTD = 0, cuotaMes = 0, cuotaAnual = 0;
  cm.forEach((r) => {
    const c = Number(r.cuota_min || 0);
    cuotaAnual += c;
    if (Number(r.mes) <= mesEf) cuotaYTD += c;
    if (Number(r.mes) === mesEf) cuotaMes = c;
  });
  if (clienteKey === 'pcel' && cuotaAnual === 0 && PCEL_REAL?.cuota50M) {
    for (let m = 1; m <= 12; m++) cuotaAnual += Number(PCEL_REAL.cuota50M[m] || 0);
    for (let m = 1; m <= mesEf; m++) cuotaYTD += Number(PCEL_REAL.cuota50M[m] || 0);
    cuotaMes = Number(PCEL_REAL.cuota50M[mesEf] || 0);
  }
  const cumplimientoYTD = cuotaYTD > 0 ? (siYTD / cuotaYTD) * 100 : null;
  const cumplimientoMes = cuotaMes > 0 ? (siMes / cuotaMes) * 100 : null;

  // Inventario snapshot
  let inventarioValor = 0, inventarioPiezas = 0, inventarioSemana = null;
  const invValidas = inv.filter((r) => r.anio != null && r.semana != null);
  if (invValidas.length > 0) {
    const semanaMax = invValidas.reduce((max, r) => {
      const k = Number(r.anio) * 100 + Number(r.semana);
      return k > max.k ? { k, anio: Number(r.anio), semana: Number(r.semana) } : max;
    }, { k: -1, anio: 0, semana: 0 });
    const snap = invValidas.filter((r) => Number(r.anio) === semanaMax.anio && Number(r.semana) === semanaMax.semana);
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

  // Cobertura (aprox. últimos 3 meses de sell-out ÷ inventario)
  let coberturaDias = null;
  if (inventarioValor > 0 && soYTD > 0 && mesEf > 0) {
    const soDiario = soYTD / (mesEf * 30);
    coberturaDias = soDiario > 0 ? Math.round(inventarioValor / soDiario) : null;
  }

  // Crédito / DSO / vencidos
  const plazo = Number(ccRow?.plazo_dias_credito || 90);
  const saldoVencido = Number(dsoRow?.saldo_vencido || 0);
  const saldoActual  = Number(dsoRow?.saldo_actual_total || 0);
  const pctVencido = saldoActual > 0 ? (saldoVencido / saldoActual) * 100 : (saldoVencido > 0 ? 100 : 0);

  const diasCobro = (() => {
    const ec = (data.estadosCuenta || [])
      .filter((r) => r.cliente === clienteKey && r.fecha_corte)
      .sort((a, b) => new Date(a.fecha_corte) - new Date(b.fecha_corte));
    if (ec.length === 0) return null;
    const ultimoEC = ec[ec.length - 1];
    const det = (data.estadosCuentaDetalle || []).filter((r) => r.estado_cuenta_id === ultimoEC.id);
    let num = 0, den = 0;
    det.forEach((r) => {
      const importe = Number(r.importe_factura || 0);
      const saldo   = Number(r.saldo_actual || 0);
      if (importe <= 0 || saldo <= 0) return;
      const mora = Math.max(0, Number(r.dias_moratorios || 0));
      num += (plazo + mora) * importe;
      den += importe;
    });
    return den > 0 ? Math.round(num / den) : null;
  })();

  const facturasAbiertas = Number(dsoRow?.facturas_abiertas || 0);

  return {
    mesEf,
    siYTD, siMes, siMesPrev, siMoM, selloutACosto,
    soYTD, soMes,
    cuotaYTD, cuotaMes, cuotaAnual,
    cumplimientoYTD, cumplimientoMes,
    inventarioValor, inventarioPiezas, inventarioSemana, coberturaDias,
    dsoPlazo: plazo, dsoReal: diasCobro,
    saldoVencido, saldoActual, pctVencido, facturasAbiertas,
  };
}

// ────────── Consolidados (3 clientes juntos) ──────────
function calcularConsolidado(resumenes) {
  return resumenes.reduce((acc, { resumen }) => ({
    siYTD:  acc.siYTD  + resumen.siYTD,
    siMes:  acc.siMes  + resumen.siMes,
    soYTD:  acc.soYTD  + resumen.soYTD,
    soMes:  acc.soMes  + resumen.soMes,
    cuotaYTD:  acc.cuotaYTD  + resumen.cuotaYTD,
    cuotaMes:  acc.cuotaMes  + resumen.cuotaMes,
    cuotaAnual:acc.cuotaAnual+ resumen.cuotaAnual,
    inventarioValor: acc.inventarioValor + resumen.inventarioValor,
    saldoVencido: acc.saldoVencido + resumen.saldoVencido,
    saldoActual:  acc.saldoActual  + resumen.saldoActual,
    facturasAbiertas: acc.facturasAbiertas + resumen.facturasAbiertas,
    coberturaSum: acc.coberturaSum + (resumen.coberturaDias || 0),
    coberturaN:   acc.coberturaN   + (resumen.coberturaDias != null ? 1 : 0),
  }), {
    siYTD:0, siMes:0, soYTD:0, soMes:0, cuotaYTD:0, cuotaMes:0, cuotaAnual:0,
    inventarioValor:0, saldoVencido:0, saldoActual:0, facturasAbiertas:0,
    coberturaSum:0, coberturaN:0,
  });
}

function calcularShareEmpresa(data, misClientes) {
  const setMios = new Set(misClientes);
  let siEmpresaMes = 0, siMios = 0, siEmpresaYTD = 0, siMiosYTD = 0;
  data.ventasAgg.filter((r) => Number(r.anio) === anioActual).forEach((r) => {
    const monto = Number(r.sell_in || 0);
    if (Number(r.mes) === mesActual) {
      siEmpresaMes += monto;
      if (setMios.has(r.cliente)) siMios += monto;
    }
    if (Number(r.mes) <= mesActual) {
      siEmpresaYTD += monto;
      if (setMios.has(r.cliente)) siMiosYTD += monto;
    }
  });
  return {
    empresaMes: siEmpresaMes,
    misMes: siMios,
    shareMes: siEmpresaMes > 0 ? (siMios / siEmpresaMes) * 100 : null,
    empresaYTD: siEmpresaYTD,
    misYTD: siMiosYTD,
    shareYTD: siEmpresaYTD > 0 ? (siMiosYTD / siEmpresaYTD) * 100 : null,
  };
}

// ────────── Trend 12 meses ──────────
function calcularTrend(data, clienteFiltro = 'todos') {
  const cuotaPcelFallback = (() => {
    const enBD = data.cuotasMensuales.some((r) => r.cliente === 'pcel');
    return enBD || !PCEL_REAL?.cuota50M ? null : PCEL_REAL.cuota50M;
  })();
  const aplicaCliente = (cli) =>
    clienteFiltro === 'todos'
      ? (cli === 'digitalife' || cli === 'pcel' || cli === 'dicotech')
      : cli === clienteFiltro;

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
      if (Number(r.mes) !== mes || !aplicaCliente(r.cliente)) return;
      if (Number(r.anio) === anioActual) si += Number(r.sell_in || 0);
      else if (Number(r.anio) === anioActual - 1) siPrev += Number(r.sell_in || 0);
    });
    return {
      mes, label: MESES_CORTO[idx], cuota, sell_in: si, sell_in_prev: siPrev,
      esActual: mes === mesEfTrend,
      esFuturo: mes > mesEfTrend,
    };
  });
}

// ────────── Alertas cross-cliente ──────────
function calcularAlertas(resumenes) {
  const alertas = [];
  resumenes.forEach(({ cliente, resumen }) => {
    if (resumen.pctVencido > 15) {
      alertas.push({ tipo: 'vencido', clienteKey: cliente.key, cliente: cliente.nombre,
        mensaje: `${formatMXN(resumen.saldoVencido)} vencidos (${resumen.pctVencido.toFixed(1)}% del saldo)`,
        severidad: 'alta' });
    }
    if (resumen.dsoReal != null && resumen.dsoReal > (resumen.dsoPlazo + 30)) {
      alertas.push({ tipo: 'dso', clienteKey: cliente.key, cliente: cliente.nombre,
        mensaje: `Días de cobro ${resumen.dsoReal}d (plazo ${resumen.dsoPlazo}d)`, severidad: 'alta' });
    }
    if (resumen.cumplimientoYTD != null && resumen.cumplimientoYTD < 70) {
      alertas.push({ tipo: 'cuota', clienteKey: cliente.key, cliente: cliente.nombre,
        mensaje: `Cumplimiento YTD ${resumen.cumplimientoYTD.toFixed(0)}%`, severidad: 'alta' });
    } else if (resumen.cumplimientoMes != null && resumen.cumplimientoMes < 80) {
      alertas.push({ tipo: 'cuota', clienteKey: cliente.key, cliente: cliente.nombre,
        mensaje: `Cumplimiento mes ${resumen.cumplimientoMes.toFixed(0)}%`, severidad: 'media' });
    }
    if (resumen.coberturaDias != null && resumen.coberturaDias < 30) {
      alertas.push({ tipo: 'inventario', clienteKey: cliente.key, cliente: cliente.nombre,
        mensaje: `Cobertura baja: ${resumen.coberturaDias}d (riesgo stockout)`, severidad: 'alta' });
    } else if (resumen.coberturaDias != null && resumen.coberturaDias > 150) {
      alertas.push({ tipo: 'inventario', clienteKey: cliente.key, cliente: cliente.nombre,
        mensaje: `Sobreinventario: ${resumen.coberturaDias}d de cobertura`, severidad: 'media' });
    }
  });
  return alertas;
}

// ────────── Estatus derivado (verde/amarillo/rojo) para la card ──────────
function estatusCliente(resumen) {
  const c = resumen.cumplimientoMes ?? resumen.cumplimientoYTD;
  const venc = resumen.pctVencido || 0;
  const cob = resumen.coberturaDias;
  if (venc > 15 || (c != null && c < 70) || (cob != null && cob < 15)) return { key: 'bad', label: 'Requiere atención', color: '#FF3B30' };
  if ((c != null && c < 90) || (cob != null && cob < 30) || (venc > 5)) return { key: 'warn', label: 'Vigilar', color: '#FF9500' };
  if (resumen.siYTD === 0) return { key: 'neutral', label: 'Sin datos aún', color: '#8E8E93' };
  return { key: 'good', label: 'Al día', color: '#34C759' };
}

// ════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════════════
export default function ResumenClientesTab({ onDrillDown }) {
  const { theme } = useTheme();
  const data = useResumenData();

  const resumenes = useMemo(() => {
    if (data.loading) return [];
    return CLIENTES.map((c) => ({ cliente: c, resumen: calcularResumen(c.key, data) }));
  }, [data]);

  const consolidado = useMemo(() => calcularConsolidado(resumenes), [resumenes]);
  const share = useMemo(() => calcularShareEmpresa(data, CLIENTES.map((c) => c.key)), [data]);
  const cumplimientoConsol = consolidado.cuotaMes > 0 ? (consolidado.siMes / consolidado.cuotaMes) * 100 : null;
  const cumplimientoConsolYTD = consolidado.cuotaYTD > 0 ? (consolidado.siYTD / consolidado.cuotaYTD) * 100 : null;
  const coberturaProm = consolidado.coberturaN > 0 ? Math.round(consolidado.coberturaSum / consolidado.coberturaN) : null;

  const alertasAll = useMemo(() => calcularAlertas(resumenes), [resumenes]);
  const [alertasAtendidas, setAlertasAtendidas] = useState(() => {
    try {
      const raw = localStorage.getItem('resumen_alertas_atendidas');
      if (!raw) return new Set();
      const p = JSON.parse(raw);
      if (p?.fecha === hoy.toISOString().slice(0,10) && Array.isArray(p.ids)) return new Set(p.ids);
    } catch {}
    return new Set();
  });
  const marcarAtendida = (id) => {
    const nuevo = new Set(alertasAtendidas); nuevo.add(id);
    setAlertasAtendidas(nuevo);
    try { localStorage.setItem('resumen_alertas_atendidas', JSON.stringify({ fecha: hoy.toISOString().slice(0,10), ids: Array.from(nuevo) })); } catch {}
  };
  const alertaId = (a) => `${a.tipo}|${a.clienteKey || ''}|${a.mensaje}`;
  const alertas = alertasAll.filter((a) => !alertasAtendidas.has(alertaId(a)));

  const [trendCliente, setTrendCliente] = useState('todos');
  const trend = useMemo(() => data.loading ? [] : calcularTrend(data, trendCliente), [data, trendCliente]);

  if (data.loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: theme.textMuted, fontFamily: TYPO.fontText }}>
        Cargando resumen…
      </div>
    );
  }

  const isDark = theme.mode === 'dark';
  const BLUE = '#007AFF', GREEN = '#34C759', ORANGE = '#FF9500', RED = '#FF3B30', PURPLE = '#AF52DE', TEAL = '#5AC8FA';

  return (
    <div style={{ padding: '10px 6px', background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100%' }} className="space-y-3">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, padding: '0 4px', marginBottom: 4, flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: theme.textMuted, marginBottom: 4, fontFamily: TYPO.fontText, fontWeight: 500 }}>
            Dirección Comercial · Portafolio propio
          </p>
          <h2 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em', fontFamily: TYPO.fontDisplay, color: theme.text, margin: 0, lineHeight: 1.1 }}>
            Resumen de Clientes.
          </h2>
          <p style={{ fontSize: 13, color: theme.textMuted, marginTop: 4, fontFamily: TYPO.fontText, fontVariantNumeric: 'tabular-nums' }}>
            <strong style={{ color: theme.text, fontWeight: 500 }}>{CLIENTES.length} clientes activos</strong> · actualizado {hoy.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* ═══════════ Bento: hero + 4 insight cards ═══════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gridTemplateRows: 'auto auto', gap: 8 }}>
        {/* HERO negro */}
        <div style={{
          gridColumn: 1, gridRow: '1 / span 2',
          background: '#1D1D1F', color: '#FFFFFF', borderRadius: 16, padding: 20,
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 20,
          fontFamily: TYPO.fontText,
        }}>
          <div>
            <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.5)', fontWeight: 500, margin: 0 }}>
              Facturación consolidada · {MESES_CORTO[mesActual - 1]} {anioActual}
            </p>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 42, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1, margin: '14px 0 6px', fontVariantNumeric: 'tabular-nums' }}>
              {fmtCompact(consolidado.siMes)}
            </div>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, lineHeight: 1.5, margin: 0, maxWidth: 520 }}>
              {cumplimientoConsol != null ? (
                <>
                  <strong style={{ color: '#fff', fontWeight: 500 }}>{cumplimientoConsol.toFixed(0)}% de la cuota mensual.</strong>
                  {' '}
                  {(() => {
                    const brecha = consolidado.cuotaMes - consolidado.siMes;
                    const lider = [...resumenes].sort((a, b) => (b.resumen.cumplimientoMes || 0) - (a.resumen.cumplimientoMes || 0))[0];
                    const rezaga = [...resumenes].sort((a, b) => (a.resumen.cumplimientoMes || 0) - (b.resumen.cumplimientoMes || 0))[0];
                    if (brecha > 0) return `Brecha de ${fmtCompact(brecha)} vs meta. ${lider.cliente.nombre} lidera; ${rezaga.cliente.nombre} se rezaga.`;
                    return `Meta superada por ${fmtCompact(-brecha)}. ${lider.cliente.nombre} lidera.`;
                  })()}
                </>
              ) : (
                <>Sin cuota registrada para este mes.</>
              )}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>YTD acumulado</div>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600, color: '#fff', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{fmtCompact(consolidado.siYTD)}</div>
            </div>
            {cumplimientoConsolYTD != null && (
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>Cuota YTD</div>
                <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600, color: cumplimientoConsolYTD >= 90 ? GREEN : cumplimientoConsolYTD >= 80 ? ORANGE : RED, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{cumplimientoConsolYTD.toFixed(0)}%</div>
              </div>
            )}
            {share.shareMes != null && (
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>Share vs empresa</div>
                <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600, color: TEAL, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{share.shareMes.toFixed(0)}%</div>
              </div>
            )}
          </div>
        </div>

        {/* KPI Cuota */}
        <KpiFitness theme={theme} Icon={Target} iconColor={GREEN} chip="Cuota"
          value={cumplimientoConsol != null ? `${cumplimientoConsol.toFixed(0)}%` : '—'}
          valueColor={cumplimientoConsol == null ? theme.text : cumplimientoConsol >= 90 ? GREEN : cumplimientoConsol >= 80 ? ORANGE : RED}
          note={<><strong style={{ color: theme.text }}>{fmtCompact(consolidado.siMes)}</strong> / {fmtCompact(consolidado.cuotaMes)} meta.</>}
        />

        {/* KPI Cobranza */}
        <KpiFitness theme={theme} Icon={AlertTriangle} iconColor={RED} chip="Cobranza"
          value={fmtCompact(consolidado.saldoVencido)}
          valueColor={consolidado.saldoVencido > 100000 ? RED : theme.text}
          note={<><strong style={{ color: theme.text }}>{fmtInt(consolidado.facturasAbiertas)} facturas</strong> abiertas · {consolidado.saldoActual > 0 ? `${((consolidado.saldoVencido / consolidado.saldoActual) * 100).toFixed(1)}% vencido` : 'saldo al día'}.</>}
        />

        {/* KPI Sell-Out */}
        <KpiFitness theme={theme} Icon={TrendingUp} iconColor={PURPLE} chip="Sell-Out mes"
          value={fmtCompact(consolidado.soMes)}
          note={consolidado.siMes > 0 ? <><strong style={{ color: theme.text }}>{((consolidado.soMes / consolidado.siMes) * 100).toFixed(0)}%</strong> del sell-in mensual.</> : <>Sin sell-out registrado aún.</>}
        />

        {/* KPI Cobertura */}
        <KpiFitness theme={theme} Icon={Package} iconColor={TEAL} chip="Cobertura"
          value={coberturaProm != null ? `${coberturaProm}d` : '—'}
          note={<>Promedio de <strong style={{ color: theme.text }}>{resumenes.filter(r => r.resumen.coberturaDias != null).length} clientes</strong> · inventario {fmtCompact(consolidado.inventarioValor)}.</>}
        />
      </div>

      {/* ═══════════ Alertas chips ═══════════ */}
      {alertas.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          {alertas.map((a) => {
            const id = alertaId(a);
            const isAlta = a.severidad === 'alta';
            return (
              <div key={id} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 4px 5px 12px',
                borderRadius: 999, fontSize: 11, fontWeight: 500,
                background: isAlta ? 'rgba(255,59,48,0.10)' : 'rgba(255,149,0,0.14)',
                color: isAlta ? '#B00020' : '#8B4E00',
                fontFamily: TYPO.fontText,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: isAlta ? RED : ORANGE }} />
                <button onClick={() => a.clienteKey && onDrillDown?.(a.clienteKey)}
                  style={{ border: 0, background: 'transparent', padding: 0, color: 'inherit', font: 'inherit', cursor: 'pointer' }}>
                  <strong>{a.cliente}:</strong> {a.mensaje}
                </button>
                <button onClick={() => marcarAtendida(id)}
                  title="Marcar como atendida (vuelve mañana)"
                  style={{ marginLeft: 4, padding: '2px 8px', border: 0, borderLeft: `1px solid rgba(0,0,0,0.15)`, background: 'transparent', color: 'inherit', cursor: 'pointer', opacity: 0.5, fontSize: 10, borderRadius: '0 999px 999px 0' }}>
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════ Trend 12 meses ═══════════ */}
      <TrendCard theme={theme} trend={trend} clienteFiltro={trendCliente} setClienteFiltro={setTrendCliente} isDark={isDark} />

      {/* ═══════════ 3 cards clientes ═══════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 4 }}>
        {resumenes.map(({ cliente, resumen }) => (
          <ClienteCard key={cliente.key} theme={theme} cliente={cliente} resumen={resumen}
            onDrillDown={() => onDrillDown?.(cliente.key)}
            isDark={isDark} />
        ))}
      </div>
    </div>
  );
}

// ────────── KPI Apple Fitness ──────────
function KpiFitness({ theme, Icon, iconColor, chip, value, valueColor, note }) {
  const isDark = theme.mode === 'dark';
  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14,
      padding: '12px 14px', minHeight: 108,
      display: 'flex', flexDirection: 'column', gap: 4, fontFamily: TYPO.fontText,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, background: `${iconColor}22`, color: iconColor,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon style={{ width: 14, height: 14 }} strokeWidth={1.8} />
        </div>
        {chip && (
          <span style={{
            fontSize: 9, padding: '2px 7px', borderRadius: 999,
            background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
            color: theme.textMuted, fontWeight: 500,
          }}>{chip}</span>
        )}
      </div>
      <div style={{
        fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em',
        color: valueColor || theme.text, fontVariantNumeric: 'tabular-nums', marginTop: 6, lineHeight: 1,
      }}>{value}</div>
      <div style={{ fontSize: 11, color: theme.textMuted, lineHeight: 1.35, marginTop: 'auto' }}>{note}</div>
    </div>
  );
}

// ────────── Trend chart Apple Health ──────────
function TrendCard({ theme, trend, clienteFiltro, setClienteFiltro, isDark }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const activeIdx = hoverIdx != null ? hoverIdx : trend.findIndex((d) => d.esActual);
  const activePoint = activeIdx >= 0 ? trend[activeIdx] : null;

  const W = 800, H = 200, PAD_L = 20, PAD_R = 20, PAD_T = 20, PAD_B = 26;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const maxVal = Math.max(1, ...trend.flatMap((d) => [d.cuota, d.sell_in, d.sell_in_prev]));
  const x = (i) => PAD_L + (i / 11) * innerW;
  const y = (v) => PAD_T + innerH - (v / maxVal) * innerH;

  // Line path for sell-in year actual (skip futuros)
  const siPoints = trend.map((d, i) => (d.esFuturo || d.sell_in === 0) && !d.esActual ? null : [x(i), y(d.sell_in)]).filter(Boolean);
  const siPath = siPoints.map(([xx, yy], i) => `${i === 0 ? 'M' : 'L'}${xx.toFixed(1)},${yy.toFixed(1)}`).join(' ');
  const siFillPath = siPoints.length > 0
    ? `${siPath} L${siPoints[siPoints.length - 1][0].toFixed(1)},${(PAD_T + innerH).toFixed(1)} L${siPoints[0][0].toFixed(1)},${(PAD_T + innerH).toFixed(1)} Z`
    : '';

  const cuotaPath = trend.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.cuota).toFixed(1)}`).join(' ');
  const prevPath = trend.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.sell_in_prev).toFixed(1)}`).join(' ');

  const BLUE = '#007AFF', GREEN = '#34C759', MUTED = theme.textMuted;

  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '12px 16px', fontFamily: TYPO.fontText, marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h4 style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>
            Trend 12 meses · Sell-In vs Cuota
          </h4>
          {activePoint && (
            <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
              <strong style={{ color: theme.text, fontWeight: 500 }}>{activePoint.label}:</strong>{' '}
              Sell-In {fmtCompact(activePoint.sell_in)} · Cuota {fmtCompact(activePoint.cuota)}
              {activePoint.sell_in_prev > 0 && <> · {anioActual - 1}: {fmtCompact(activePoint.sell_in_prev)}</>}
              {activePoint.cuota > 0 && activePoint.sell_in > 0 && <> · <span style={{ color: (activePoint.sell_in / activePoint.cuota) >= 0.9 ? GREEN : (activePoint.sell_in / activePoint.cuota) >= 0.8 ? '#FF9500' : '#FF3B30' }}>{((activePoint.sell_in / activePoint.cuota) * 100).toFixed(0)}%</span></>}
            </div>
          )}
        </div>
        <div style={{ display: 'inline-flex', gap: 1, padding: 2, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', borderRadius: 999 }}>
          {[
            { k: 'todos', l: 'Todos' },
            { k: 'digitalife', l: 'Digitalife' },
            { k: 'pcel', l: 'PCEL' },
            { k: 'dicotech', l: 'Dicotech' },
          ].map((op) => (
            <button key={op.k} onClick={() => setClienteFiltro(op.k)}
              style={{
                padding: '5px 11px', borderRadius: 999,
                background: clienteFiltro === op.k ? theme.surface : 'transparent',
                color: clienteFiltro === op.k ? theme.text : theme.textMuted,
                fontWeight: clienteFiltro === op.k ? 600 : 500, border: 0, fontFamily: 'inherit',
                fontSize: 11, cursor: 'pointer',
                boxShadow: clienteFiltro === op.k ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              }}>{op.l}</button>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 200, display: 'block' }}
        onMouseLeave={() => setHoverIdx(null)}>
        <defs>
          <linearGradient id="siFillGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={BLUE} stopOpacity="0.20" />
            <stop offset="1" stopColor={BLUE} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Grid horizontal */}
        {[0, 0.5, 1].map((r) => (
          <line key={r} x1={PAD_L} x2={W - PAD_R} y1={PAD_T + innerH * (1 - r)} y2={PAD_T + innerH * (1 - r)}
            stroke={theme.border} strokeDasharray="2 4" strokeWidth="1" />
        ))}
        {/* Fill sell-in */}
        {siFillPath && <path d={siFillPath} fill="url(#siFillGrad)" />}
        {/* Cuota (verde) */}
        <path d={cuotaPath} fill="none" stroke={GREEN} strokeWidth="2" strokeDasharray="4 4" opacity="0.85" />
        {/* Prev year (gris) */}
        <path d={prevPath} fill="none" stroke={MUTED} strokeWidth="1.5" strokeDasharray="2 3" opacity="0.5" />
        {/* Sell-in año actual (azul) */}
        {siPath && <path d={siPath} fill="none" stroke={BLUE} strokeWidth="2.5" />}
        {/* Puntos + hitboxes */}
        {trend.map((d, i) => (
          <g key={i}>
            {!d.esFuturo && d.sell_in > 0 && (
              <circle cx={x(i)} cy={y(d.sell_in)} r={i === activeIdx ? 4.5 : 3} fill={theme.surface} stroke={BLUE} strokeWidth="2" />
            )}
            {/* hitbox */}
            <rect x={x(i) - innerW / 24} y={PAD_T} width={innerW / 12} height={innerH}
              fill="transparent" style={{ cursor: 'crosshair' }}
              onMouseEnter={() => setHoverIdx(i)} />
            {/* Label mes */}
            <text x={x(i)} y={H - 6} textAnchor="middle"
              fontSize="10" fill={i === activeIdx ? theme.text : theme.textMuted}
              fontWeight={i === activeIdx ? 600 : 500} fontFamily={TYPO.fontText}>
              {d.label}
            </text>
          </g>
        ))}
        {/* Vertical hover line */}
        {hoverIdx != null && (
          <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={PAD_T} y2={PAD_T + innerH}
            stroke={theme.border} strokeWidth="1" strokeDasharray="2 2" />
        )}
      </svg>
      <div style={{ display: 'flex', gap: 16, fontSize: 10, color: theme.textMuted, padding: '2px 4px 0' }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 2, background: BLUE, verticalAlign: 'middle', marginRight: 5 }} />Sell-In {anioActual}</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 2, background: GREEN, verticalAlign: 'middle', marginRight: 5, borderBottom: `1px dashed ${GREEN}` }} />Cuota</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 2, background: MUTED, verticalAlign: 'middle', marginRight: 5, opacity: 0.5 }} />{anioActual - 1}</span>
      </div>
    </div>
  );
}

// ────────── Cliente card ──────────
function ClienteCard({ theme, cliente, resumen, onDrillDown, isDark }) {
  const status = estatusCliente(resumen);
  const cumpl = resumen.cumplimientoMes ?? resumen.cumplimientoYTD;
  const cumplColor = cumpl == null ? theme.textMuted : cumpl >= 90 ? '#34C759' : cumpl >= 80 ? '#FF9500' : '#FF3B30';

  const GREEN = '#34C759', RED = '#FF3B30', ORANGE = '#FF9500', BLUE = '#007AFF';

  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16,
      borderLeft: `4px solid ${cliente.color}`,
      overflow: 'hidden', fontFamily: TYPO.fontText,
      cursor: 'pointer', transition: 'transform 120ms, box-shadow 120ms',
    }}
    onClick={onDrillDown}
    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{
        padding: '14px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${theme.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: cliente.color, color: '#FFFFFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 14, letterSpacing: '-0.02em',
          }}>{cliente.letter}</div>
          <div>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text }}>{cliente.nombre}.</div>
            <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 1 }}>{cliente.marca}</div>
          </div>
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '4px 10px', borderRadius: 999, fontSize: 10, fontWeight: 500,
          background: `${status.color}1F`, color: status.color,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: 999, background: status.color }} />
          {status.label}
        </span>
      </div>

      <div style={{ padding: '14px 16px' }}>
        {/* Párrafo narrativo */}
        <p style={{ fontSize: 11, color: theme.textMuted, margin: '0 0 12px', lineHeight: 1.5, fontFamily: TYPO.fontText }}>
          {resumen.siYTD === 0 ? (
            <>Cliente sin datos históricos en el ERP todavía. Se activa una vez que se cargue el primer sell-in.</>
          ) : (
            <>
              Sell-in del mes en <strong style={{ color: theme.text }}>{fmtCompact(resumen.siMes)}</strong>
              {cumpl != null && <> (<span style={{ color: cumplColor }}>{cumpl.toFixed(0)}% cuota</span>)</>}
              {resumen.siMoM != null && (
                <> · MoM {resumen.siMoM >= 0 ? <span style={{ color: GREEN }}>▲ {resumen.siMoM.toFixed(0)}%</span> : <span style={{ color: RED }}>▼ {Math.abs(resumen.siMoM).toFixed(0)}%</span>}</>
              )}
              . {resumen.saldoVencido > 0
                ? <>Vencidos: <strong style={{ color: RED }}>{fmtCompact(resumen.saldoVencido)}</strong>{resumen.facturasAbiertas > 0 && <> en {fmtInt(resumen.facturasAbiertas)} facturas</>}.</>
                : <>Cobranza al día.</>}
            </>
          )}
        </p>

        {/* KPIs mini */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 4 }}>
          <MiniKpi theme={theme} label="Sell-In" value={fmtCompact(resumen.siMes)}
            sub={resumen.siMoM != null ? (resumen.siMoM >= 0 ? `▲ ${resumen.siMoM.toFixed(0)}% MoM` : `▼ ${Math.abs(resumen.siMoM).toFixed(0)}% MoM`) : `YTD ${fmtCompact(resumen.siYTD)}`}
            subColor={resumen.siMoM != null ? (resumen.siMoM >= 0 ? GREEN : RED) : theme.textMuted} />
          <MiniKpi theme={theme} label="Sell-Out" value={fmtCompact(resumen.soMes)}
            sub={resumen.selloutACosto ? 'a costo' : 'precio venta'} />
          <MiniKpi theme={theme} label="Días de cobro"
            value={resumen.dsoReal != null ? `${resumen.dsoReal}d` : '—'}
            sub={`plazo ${resumen.dsoPlazo}d`}
            valueColor={resumen.dsoReal == null ? theme.text : resumen.dsoReal <= resumen.dsoPlazo ? theme.text : resumen.dsoReal <= resumen.dsoPlazo + 30 ? ORANGE : RED} />
          <MiniKpi theme={theme} label="Vencidos"
            value={fmtCompact(resumen.saldoVencido)}
            sub={resumen.facturasAbiertas > 0 ? `${fmtInt(resumen.facturasAbiertas)} facturas` : 'al día'}
            valueColor={resumen.saldoVencido > 100000 ? RED : resumen.saldoVencido > 0 ? ORANGE : GREEN} />
        </div>

        {/* Cobertura + Inventario abajo */}
        {resumen.inventarioValor > 0 && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${theme.border}`, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>
            <span>Inventario · <strong style={{ color: theme.text }}>{fmtCompact(resumen.inventarioValor)}</strong> ({fmtInt(resumen.inventarioPiezas)} pz)</span>
            {resumen.coberturaDias != null && (
              <span>Cobertura · <strong style={{ color: resumen.coberturaDias < 30 ? RED : resumen.coberturaDias < 60 ? ORANGE : theme.text }}>{resumen.coberturaDias}d</strong></span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniKpi({ theme, label, value, sub, subColor, valueColor }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600 }}>{label}</span>
      <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em', color: valueColor || theme.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 10, color: subColor || theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{sub}</span>
    </div>
  );
}
