// HomeDigitalife V2 · rediseño Apple con timeline lineal y Ferruteck cósmico
// ─ Hero editorial compacto
// ─ 4 KPI cards compactas (Sell In · Sell Out · Inventario · Cobranza)
// ─ 3 tarjetas secundarias (Marketing/Pagos próximamente · Cobranza aging)
// ─ Timeline lineal: año anterior + este año + cuota + filtros Q1..Q4/Año + sums
// ─ Sell In vs Sell Out temporal + Ferruteck cósmico (side-by-side)
// ─ Sell In vs Sell Out por marca (barras paralelas)

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useFacturacion, useCuotasMensuales, useInventarioCliente } from '../../lib/queries';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { FerrutekLoader } from '../../components';
import SinAcceso from '../../components/SinAcceso';
import { usePerfil } from '../../lib/perfilContext';
import { puedeVerPestanaCliente } from '../../lib/permisos';
import { ChevronRight, Sparkles, AlertTriangle, Clock, TrendingUp } from 'lucide-react';

const NOMBRES_MES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MES_INICIAL = ['E','F','M','A','M','J','J','A','S','O','N','D'];
const Q_MESES = { Q1: [1,2,3], Q2: [4,5,6], Q3: [7,8,9], Q4: [10,11,12], anio: [1,2,3,4,5,6,7,8,9,10,11,12] };

function paletteFromTheme(theme) {
  return {
    accent: theme.accent || '#007AFF',
    green:  theme.green  || '#34C759',
    orange: theme.orange || '#FF9500',
    red:    theme.red    || '#FF3B30',
    purple: theme.purple || '#AF52DE',
    indigo: theme.indigo || '#5856D6',
    teal:   theme.teal   || '#5AC8FA',
  };
}

const fmtMoney = (n) => {
  if (n == null || !isFinite(n)) return '—';
  const a = Math.abs(Number(n));
  if (a >= 1e6) return `$${(n / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n)}`;
};
const fmtPct = (n) => (n == null || !isFinite(n) ? '—' : `${Math.round(n)}%`);

export default function HomeDicotech({ cliente, clienteKey }) {
  const perfil = usePerfil();
  if (!puedeVerPestanaCliente(perfil, clienteKey || 'dicotech', 'home')) {
    return <SinAcceso motivo={`No tienes acceso al Resumen de ${clienteKey || 'dicotech'}.`} />;
  }
  const { theme } = useTheme();
  const P = paletteFromTheme(theme);
  const isDark = theme.mode === 'dark';

  const anio = new Date().getFullYear();
  const mesActual = new Date().getMonth() + 1;

  // Datos compartidos via React Query (cache 5min entre módulos)
  const { data: facturacion = [] } = useFacturacion(clienteKey, [anio - 1, anio], 'sku,anio,mes,piezas,monto');
  const { data: cuotasMes = [] } = useCuotasMensuales(clienteKey, anio);
  const { data: inventario = [] } = useInventarioCliente(clienteKey);

  const [loading, setLoading] = useState(true);
  const [aging, setAging] = useState(null);
  const [sellInSku, setSellInSku] = useState([]);
  const [selloutMensualDico, setSelloutMensualDico] = useState([]); // v_sellout_dicotech_mensual (año actual + anterior)
  const [selloutSucursalMes, setSelloutSucursalMes] = useState([]); // v_sellout_dicotech_sucursal_mes
  const [config, setConfig] = useState(null);               // clientes_credito_config (plazo, líneas USD/MXN)
  const [cortesHist, setCortesHist] = useState([]);         // estados_cuenta históricos para cobranza
  const [rango, setRango] = useState(() => new Set([getCurrentQ(mesActual)]));
  const [sucRango, setSucRango] = useState(getCurrentQ(mesActual)); // rango para "por sucursal"

  function getCurrentQ(m) {
    if (m <= 3) return 'Q1';
    if (m <= 6) return 'Q2';
    if (m <= 9) return 'Q3';
    return 'Q4';
  }

  // Meses seleccionados a partir del Set de rangos (soporta Set o string por compat)
  const mesesRango = useMemo(() => {
    if (!rango) return Q_MESES.anio;
    if (typeof rango === 'string') return Q_MESES[rango] || Q_MESES.anio;
    if (rango.size === 0) return Q_MESES.anio;
    const set = new Set();
    for (const q of rango) (Q_MESES[q] || []).forEach(m => set.add(m));
    return Array.from(set).sort((a, b) => a - b);
  }, [rango]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const anioAntIni = `${anio - 1}-01-01`;

      // Helper: paginación (Supabase limita a 1000 por default; sellout_detalle tiene 20K+ rows)
      const fetchAll = async (table, select, applyFilter) => {
        const PAGE = 1000; let acc = [], from = 0;
        while (true) {
          let q = supabase.from(table).select(select).range(from, from + PAGE - 1);
          q = applyFilter(q);
          const { data, error } = await q;
          if (error || !data || data.length === 0) break;
          acc = acc.concat(data);
          if (data.length < PAGE) break;
          from += PAGE;
        }
        return acc;
      };

      const [ecHistR, siR, cfgR, soMesR, soSucR] = await Promise.all([
        supabase.from('estados_cuenta').select('id,anio,semana,fecha_corte,saldo_actual,saldo_vencido,dso').eq('cliente', clienteKey).order('fecha_corte', { ascending: true }),
        supabase.from('facturacion_clientes').select('sku, mes, monto, piezas').eq('cliente_key', clienteKey).eq('anio', anio),
        supabase.from('clientes_credito_config').select('*').eq('cliente', clienteKey).maybeSingle(),
        // Sell out mensual precalculado (vista dedicada Dicotech)
        supabase.from('v_sellout_dicotech_mensual').select('anio,mes,piezas,monto,tx,skus_distintos,clientes_distintos,facturas').in('anio', [anio - 1, anio]),
        // Sell out por sucursal + mes (para split por sucursal)
        supabase.from('v_sellout_dicotech_sucursal_mes').select('sucursal,anio,mes,piezas,monto,tx,skus_distintos,clientes_distintos').eq('anio', anio),
      ]);
      if (cancel) return;
      setCortesHist(ecHistR.data || []);
      setSellInSku(siR.data || []);
      setConfig(cfgR.data || null);
      setSelloutMensualDico(soMesR.data || []);
      setSelloutSucursalMes(soSucR.data || []);
      const ecActualId = (ecHistR.data || []).slice(-1)[0]?.id;

      // Aging (mismo cálculo que antes, buckets sólo vencidos)
      if (ecActualId) {
        const { data: det } = await supabase
          .from('estados_cuenta_detalle')
          .select('*')
          .eq('estado_cuenta_id', ecActualId);
        if (cancel) return;
        const now = Date.now();
        const buckets = { d1_30: [], d31_60: [], d61_90: [], mas90: [] };
        let total = 0, vencido = 0, alDia = 0;
        (det || []).forEach(f => {
          const saldo = Number(f.saldo_actual) || 0;
          if (saldo <= 0) return;
          total += saldo;
          if (!f.vencimiento) { alDia += saldo; return; }
          const v = new Date(f.vencimiento + 'T00:00:00').getTime();
          const dias = Math.floor((now - v) / 86400000);
          if (dias <= 0) alDia += saldo;
          else if (dias <= 30) { vencido += saldo; buckets.d1_30.push({ ...f, dias, saldo }); }
          else if (dias <= 60) { vencido += saldo; buckets.d31_60.push({ ...f, dias, saldo }); }
          else if (dias <= 90) { vencido += saldo; buckets.d61_90.push({ ...f, dias, saldo }); }
          else { vencido += saldo; buckets.mas90.push({ ...f, dias, saldo }); }
        });
        setAging({ total, vencido, alDia, buckets });
      } else {
        setAging({ total: 0, vencido: 0, alDia: 0, buckets: { d1_30: [], d31_60: [], d61_90: [], mas90: [] } });
      }
      if (!cancel) setLoading(false);
    })();
    return () => { cancel = true; };
  }, [clienteKey, anio]);

  // ═════ Sell In real: agregado por mes desde facturacion_clientes ═════
  // Reconstruye la forma [{mes, sell_in, sell_out}] que usa el resto del componente
  const ventasActual = useMemo(() => {
    const mp = new Map();
    facturacion.forEach(r => {
      if (Number(r.anio) !== anio) return;
      const m = Number(r.mes);
      mp.set(m, (mp.get(m) || 0) + (Number(r.monto) || 0));
    });
    return Array.from(mp.entries()).map(([mes, sell_in]) => ({ mes, sell_in, sell_out: 0 }));
  }, [facturacion, anio]);
  const ventasAnt = useMemo(() => {
    const mp = new Map();
    facturacion.forEach(r => {
      if (Number(r.anio) !== anio - 1) return;
      const m = Number(r.mes);
      mp.set(m, (mp.get(m) || 0) + (Number(r.monto) || 0));
    });
    return Array.from(mp.entries()).map(([mes, sell_in]) => ({ mes, sell_in, sell_out: 0 }));
  }, [facturacion, anio]);

  // ═════ Sell Out por mes desde v_sellout_dicotech_mensual (movido arriba para TDZ) ═════
  const sellOutByMes = useMemo(() => {
    const cur = new Map(), prev = new Map();
    (selloutMensualDico || []).forEach(r => {
      const y = Number(r.anio); const m = Number(r.mes);
      const monto = Number(r.monto) || 0;
      if (y === anio) cur.set(m, (cur.get(m) || 0) + monto);
      else if (y === anio - 1) prev.set(m, (prev.get(m) || 0) + monto);
    });
    return { cur, prev };
  }, [selloutMensualDico, anio]);
  const sellOutByMesRaw = sellOutByMes.cur;
  const sellOutPiezasByMes = useMemo(() => {
    const cur = new Map();
    (selloutMensualDico || []).forEach(r => {
      if (Number(r.anio) !== anio) return;
      cur.set(Number(r.mes), (cur.get(Number(r.mes)) || 0) + (Number(r.piezas) || 0));
    });
    return cur;
  }, [selloutMensualDico, anio]);

  // ═════ Inventario real: snapshot más reciente por SKU ═════
  const invSnapshot = useMemo(() => {
    const bySku = new Map();
    inventario.forEach(r => {
      const key = (Number(r.anio) || 0) * 100 + (Number(r.semana) || 0);
      const prev = bySku.get(r.sku);
      if (!prev || key > prev._key) {
        bySku.set(r.sku, {
          stock: Number(r.stock) || 0,
          valor: Number(r.valor) || 0,
          precio_venta: Number(r.precio_venta) || 0,
          costo_convenio: Number(r.costo_convenio) || 0,
          _key: key,
        });
      }
    });
    let stockTot = 0, valorTot = 0;
    for (const [, v] of bySku) {
      stockTot += v.stock;
      // Fallback: si valor viene 0, usar stock × costo_convenio (o precio_venta)
      const val = v.valor > 0 ? v.valor : v.stock * (v.costo_convenio || v.precio_venta || 0);
      valorTot += val;
    }
    // Última semana snapshot (para saber cuán fresco es el dato)
    let lastKey = 0, lastAnio = null, lastSemana = null;
    inventario.forEach(r => {
      const k = (Number(r.anio) || 0) * 100 + (Number(r.semana) || 0);
      if (k > lastKey) { lastKey = k; lastAnio = r.anio; lastSemana = r.semana; }
    });
    return { stock: stockTot, valor: valorTot, skus: bySku.size, anio: lastAnio, semana: lastSemana };
  }, [inventario]);

  // Días de inventario = stock / demanda diaria promedio (últimos 3 meses de sell out)
  const diasInventarioReal = useMemo(() => {
    // Suma piezas de últimos 3 meses completos disponibles (mesActual-1, -2, -3)
    let piezasSO = 0, mesesUsados = 0;
    for (let off = 1; off <= 3; off++) {
      const m = mesActual - off;
      if (m < 1) continue;
      const pz = sellOutPiezasByMes.get(m) || 0;
      if (pz > 0) { piezasSO += pz; mesesUsados++; }
    }
    if (mesesUsados === 0) return null;
    const demandaDiaria = piezasSO / (mesesUsados * 30);
    if (demandaDiaria <= 0) return null;
    return Math.round(invSnapshot.stock / demandaDiaria);
  }, [sellOutPiezasByMes, invSnapshot.stock, mesActual]);

  // ═════ Cobranza mensual real: derivada de estados_cuenta históricos ═════
  // Cobranza mes N = facturación acumulada hasta N + saldo_actual(N-1) − saldo_actual(N)
  // Simplificación práctica: usamos delta de saldo entre cortes de mismo mes
  // y facturación del mes desde facturacion_clientes.
  const cobranzaByMes = useMemo(() => {
    // Toma el último corte de cada mes del año actual
    const ultimoPorMes = new Map();
    cortesHist.forEach(c => {
      if (!c.fecha_corte) return;
      const d = new Date(c.fecha_corte + 'T00:00:00');
      if (d.getFullYear() !== anio) return;
      const m = d.getMonth() + 1;
      const prev = ultimoPorMes.get(m);
      if (!prev || new Date(prev.fecha_corte).getTime() < d.getTime()) ultimoPorMes.set(m, c);
    });
    // Facturación mensual (año actual) desde el useMemo anterior
    const facByMes = new Map();
    ventasActual.forEach(v => facByMes.set(Number(v.mes), Number(v.sell_in) || 0));
    // Cobranza[m] = fac[m] + saldo[m-1] − saldo[m]
    const map = new Map();
    for (let m = 1; m <= 12; m++) {
      const cM = ultimoPorMes.get(m);
      if (!cM) continue;
      const cMprev = ultimoPorMes.get(m - 1);
      const fac = facByMes.get(m) || 0;
      const saldoM = Number(cM.saldo_actual) || 0;
      const saldoMprev = cMprev ? (Number(cMprev.saldo_actual) || 0) : saldoM; // si no hay previo, delta 0
      const cobranza = fac + saldoMprev - saldoM;
      map.set(m, cobranza > 0 ? cobranza : 0);
    }
    return map;
  }, [cortesHist, ventasActual, anio]);
  const cobranzaMesActual = cobranzaByMes.get(mesActual) || 0;
  const cobranzaMesAnt = cobranzaByMes.get(mesActual - 1) || 0;
  const deltaCobranza = cobranzaMesAnt > 0 ? ((cobranzaMesActual - cobranzaMesAnt) / cobranzaMesAnt * 100) : null;

  // (sellOutByMes + sellOutPiezasByMes ya definidos arriba antes de invSnapshot para evitar TDZ)

  // ═════ KPIs ═════
  const sellInMes = Number(ventasActual.find(v => Number(v.mes) === mesActual)?.sell_in) || cliente?.kpis?.sellInMes || 0;
  const sellOutMesDetalle = sellOutByMesRaw.get(mesActual) || 0;
  const sellOutMesVentas = Number(ventasActual.find(v => Number(v.mes) === mesActual)?.sell_out) || 0;
  const sellOutMes = sellOutMesDetalle > 0 ? sellOutMesDetalle : (sellOutMesVentas || cliente?.kpis?.sellOut || 0);
  const cuotaMesActual = cuotasMes.find(c => Number(c.mes) === mesActual);
  const cuotaIdeal = Number(cuotaMesActual?.cuota_ideal) || cliente?.kpis?.cuotaMes || 0;
  const cuotaMin = Number(cuotaMesActual?.cuota_min) || 0;
  const pctCuota = cuotaIdeal > 0 ? (sellInMes / cuotaIdeal * 100) : 0;
  const pctCuotaMin = cuotaMin > 0 ? (sellInMes / cuotaMin * 100) : 0;
  const sellInMesAnt = Number(ventasActual.find(v => Number(v.mes) === mesActual - 1)?.sell_in) || 0;
  const deltaSellIn = sellInMesAnt > 0 ? ((sellInMes - sellInMesAnt) / sellInMesAnt * 100) : null;
  const sellOutMesAntDet = sellOutByMesRaw.get(mesActual - 1) || 0;
  const sellOutMesAntVen = Number(ventasActual.find(v => Number(v.mes) === mesActual - 1)?.sell_out) || 0;
  const sellOutMesAnt = sellOutMesAntDet > 0 ? sellOutMesAntDet : sellOutMesAntVen;
  const deltaSellOut = sellOutMesAnt > 0 ? ((sellOutMes - sellOutMesAnt) / sellOutMesAnt * 100) : null;
  // Inventario real desde inventario_cliente
  const inventarioDias = diasInventarioReal != null ? diasInventarioReal : (Number(cliente?.kpis?.diasInventario) || 0);
  const inventarioValor = invSnapshot.valor > 0 ? invSnapshot.valor : (Number(cliente?.kpis?.inventarioValor) || 0);
  const metaInvDias = 45;

  // Mini series (últimos 7 meses) · sell in, sell out, inventario snapshot, cobranza real
  const mini = useMemo(() => {
    const arr = { si: [], so: [], inv: [], cb: [] };
    for (let i = 6; i >= 0; i--) {
      const m = mesActual - i;
      const v = m >= 1 ? ventasActual.find(x => Number(x.mes) === m) : null;
      arr.si.push(Number(v?.sell_in) || 0);
      arr.so.push(sellOutByMesRaw.get(m) || 0);
      arr.inv.push(invSnapshot.stock); // días son puntuales; el sparkline muestra tendencia de stock
      arr.cb.push(cobranzaByMes.get(m) || 0); // cobranza real
    }
    return arr;
  }, [ventasActual, mesActual, sellOutByMesRaw, invSnapshot.stock, cobranzaByMes]);

  // ═════ Timeline lineal ═════
  const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const timelineMeses = useMemo(() => {
    return mesesRango.map(m => {
      const cuotaRow = cuotasMes.find(c => Number(c.mes) === m);
      return {
        mes: m,
        label: MESES_CORTOS[m - 1],
        sellIn: Number(ventasActual.find(v => Number(v.mes) === m)?.sell_in) || 0,
        sellInPrev: Number(ventasAnt.find(v => Number(v.mes) === m)?.sell_in) || 0,
        cuota: Number(cuotaRow?.cuota_ideal) || 0,
        cuotaMin: Number(cuotaRow?.cuota_min) || 0,
        actual: m === mesActual,
        futuro: m > mesActual,
      };
    });
  }, [ventasActual, ventasAnt, cuotasMes, mesesRango, mesActual]);

  const timelineSums = useMemo(() => {
    let s2026 = 0, s2025 = 0, cuota = 0, cuotaMin = 0;
    mesesRango.forEach(m => {
      s2026 += Number(ventasActual.find(v => Number(v.mes) === m)?.sell_in) || 0;
      s2025 += Number(ventasAnt.find(v => Number(v.mes) === m)?.sell_in) || 0;
      const cuotaRow = cuotasMes.find(c => Number(c.mes) === m);
      cuota += Number(cuotaRow?.cuota_ideal) || 0;
      cuotaMin += Number(cuotaRow?.cuota_min) || 0;
    });
    const deltaYoY = s2025 > 0 ? ((s2026 - s2025) / s2025 * 100) : null;
    const deltaCuota = cuota > 0 ? ((s2026 - cuota) / cuota * 100) : null;
    const deltaCuotaMin = cuotaMin > 0 ? ((s2026 - cuotaMin) / cuotaMin * 100) : null;
    return { s2026, s2025, cuota, cuotaMin, deltaYoY, deltaCuota, deltaCuotaMin };
  }, [ventasActual, ventasAnt, cuotasMes, mesesRango]);

  // ═════ Sell In vs Sell Out global (todos los meses del año) ═════
  const sivsoTemporal = useMemo(() => {
    const arr = [];
    for (let m = 1; m <= 12; m++) {
      const v = ventasActual.find(x => Number(x.mes) === m);
      // Prioriza sell out desde sellout_detalle (más granular), fallback a ventas_mensuales
      const soDetalle = sellOutByMes.cur.get(m) || 0;
      const soVentas = Number(v?.sell_out) || 0;
      arr.push({
        mes: m,
        sellIn: Number(v?.sell_in) || 0,
        sellOut: soDetalle > 0 ? soDetalle : soVentas,
        futuro: m > mesActual,
      });
    }
    return arr;
  }, [ventasActual, sellOutByMes, mesActual]);

  const ratioGlobal = useMemo(() => {
    // Ratio SO/SI año actual: SI de ventas_mensuales, SO de sellout_detalle (fallback ventas_mensuales)
    const totSI = ventasActual
      .filter(v => Number(v.mes) <= mesActual)
      .reduce((s, v) => s + (Number(v.sell_in) || 0), 0);
    let totSO = 0;
    sellOutByMes.cur.forEach((val, m) => { if (m <= mesActual) totSO += val; });
    if (totSO === 0) {
      totSO = ventasActual.filter(v => Number(v.mes) <= mesActual)
        .reduce((s, v) => s + (Number(v.sell_out) || 0), 0);
    }
    const totSIAnt = ventasAnt.reduce((s, v) => s + (Number(v.sell_in) || 0), 0);
    let totSOAnt = 0;
    sellOutByMes.prev.forEach(val => { totSOAnt += val; });
    if (totSOAnt === 0) {
      totSOAnt = ventasAnt.reduce((s, v) => s + (Number(v.sell_out) || 0), 0);
    }
    const ratio = totSI > 0 ? (totSO / totSI * 100) : null;
    const ratioAnt = totSIAnt > 0 ? (totSOAnt / totSIAnt * 100) : null;
    return { ratio, ratioAnt, deltaPP: ratio != null && ratioAnt != null ? ratio - ratioAnt : null };
  }, [ventasActual, ventasAnt, sellOutByMes, mesActual]);

  // ═════ Sell In vs Sell Out por SUCURSAL (Dicotech) ═════
  // Meta de sucursales — display label y tipo (física/virtual)
  const SUCURSAL_META = {
    'dicoags2':  { label: 'Aguascalientes', tipo: 'fisica' },
    'leon2':     { label: 'León',           tipo: 'fisica' },
    'Arboledas': { label: 'Arboledas',      tipo: 'fisica' },
    'GDL':       { label: 'Guadalajara',    tipo: 'fisica' },
    'ZACATECAS': { label: 'Zacatecas',      tipo: 'fisica' },
    'santafe':   { label: 'Santa Fe',       tipo: 'fisica' },
    'DC':        { label: 'DC',             tipo: 'fisica' },
    'AMAZON':    { label: 'Amazon',         tipo: 'virtual' },
    'Internet':  { label: 'Internet',       tipo: 'virtual' },
    'dropship':  { label: 'Dropship',       tipo: 'virtual' },
  };
  const sucursalMetaOf = (name) => SUCURSAL_META[name] || { label: name || 'Sin sucursal', tipo: 'virtual' };

  const sucursalesSIvsSO = useMemo(() => {
    const meses = Q_MESES[sucRango] || Q_MESES.anio;
    // Sell In del cliente completo por rango (no split por sucursal en Dicotech)
    let siTotal = 0;
    ventasActual.forEach(v => {
      if (meses.includes(Number(v.mes))) siTotal += Number(v.sell_in) || 0;
    });
    // Sell Out por sucursal en el rango (v_sellout_dicotech_sucursal_mes)
    const soBySuc = {};
    (selloutSucursalMes || []).forEach(r => {
      if (Number(r.anio) !== anio) return;
      if (!meses.includes(Number(r.mes))) return;
      const key = r.sucursal || '(sin sucursal)';
      soBySuc[key] = (soBySuc[key] || 0) + (Number(r.monto) || 0);
    });
    const totalSO = Object.values(soBySuc).reduce((s, v) => s + v, 0);
    const arr = Object.entries(soBySuc)
      .map(([name, so]) => {
        const meta = sucursalMetaOf(name);
        // "SI proporcional" a la sucursal según su peso en el SO total (aproximación)
        const siProp = totalSO > 0 ? siTotal * (so / totalSO) : 0;
        return { sucursal: name, label: meta.label, tipo: meta.tipo, si: siProp, so, ratio: siProp > 0 ? (so / siProp * 100) : null };
      })
      .sort((a, b) => b.so - a.so);
    return arr;
  }, [ventasActual, selloutSucursalMes, sucRango, anio]);

  // ═════ Copilot recos ═════
  const copilotRecos = useMemo(() => {
    const arr = [];
    if (inventarioDias > metaInvDias + 15) {
      arr.push({
        sev: 'warn',
        title: `Inventario alto · ${Math.round(inventarioDias)}d`,
        sub: `Meta ${metaInvDias}d · valor ${fmtMoney(inventarioValor)}. Cabe una promo para rotar.`,
      });
    }
    if (aging && aging.vencido > 0) {
      const riesgo = (aging.buckets.d61_90 || []).reduce((s, f) => s + f.saldo, 0) + (aging.buckets.mas90 || []).reduce((s, f) => s + f.saldo, 0);
      arr.push({
        sev: aging.vencido > (aging.total || 0) * 0.15 ? 'urgente' : 'warn',
        title: `${fmtMoney(aging.vencido)} vencido en cartera`,
        sub: riesgo > 0 ? `${fmtMoney(riesgo)} > 60d en riesgo` : 'Revisa antes de que envejezca',
      });
    }
    if (pctCuota >= 100) {
      arr.push({
        sev: 'info',
        title: `Digitalife ${(pctCuota - 100).toFixed(1)}% arriba de cuota`,
        sub: 'Sube meta trimestral para mantener incentivo',
      });
    } else if (pctCuota > 0 && pctCuota < 85) {
      arr.push({
        sev: 'warn',
        title: `Sell In al ${Math.round(pctCuota)}% de cuota`,
        sub: `Falta ${fmtMoney(cuotaIdeal - sellInMes)} para meta`,
      });
    }
    return arr.slice(0, 3);
  }, [inventarioDias, inventarioValor, aging, pctCuota, cuotaIdeal, sellInMes]);

  // ═════ Estilos ═════
  // Hero usa el token semántico del tema (respeta las 3 identidades):
  // Claro: negro #000, Midnight: negro OLED, Marfil: cobalto #0055B5
  const heroBg = theme.heroCardBg || theme.surfaceInverse || '#1C1C1E';

  if (loading) {
    return <FerrutekLoader label="Cargando Digitalife…" sub="Trayendo Sell In, Sell Out, cobranza y marcas" minHeight={480} />;
  }

  return (
    <div style={{ fontFamily: TYPO.fontText, color: theme.text, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Hero compacto */}
      <div style={{
        background: heroBg, color: '#FFF', borderRadius: 12, padding: '14px 18px',
        display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 20, alignItems: 'center',
      }}>
        <div>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(255,255,255,0.55)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: '#EF4444' }} />
            Digitalife · {NOMBRES_MES[mesActual - 1]} {anio}
          </span>
          <h2 style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 600, margin: '3px 0 2px', color: '#FFF', letterSpacing: '-0.025em' }}>
            {narrativa(pctCuota)}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11.5, maxWidth: 380, lineHeight: 1.4, margin: 0 }}>
            {subnarrativa(sellInMes, cuotaIdeal, sucursalesSIvsSO[0])}
          </p>
        </div>
        <HeroStat k="Sell In mes" v={fmtMoney(sellInMes)} sub={cuotaIdeal > 0 ? `${Math.round(pctCuota)}% cuota` : ''} />
        <HeroStat k="Sell Out mes" v={fmtMoney(sellOutMes)} sub={deltaSellOut != null ? `${deltaSellOut >= 0 ? '+' : ''}${deltaSellOut.toFixed(0)}% vs ${NOMBRES_MES[mesActual - 2] || ''}` : ''} />
      </div>

      {/* Fila 1: 4 KPIs compactas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
        <KpiCard theme={theme} P={P} eyebrow={`Sell In · ${NOMBRES_MES[mesActual - 1]}`} title="vs cuota mensual"
          big={fmtMoney(sellInMes)}
          bigColor={pctCuota >= 100 ? P.green : pctCuota >= 85 ? theme.text : P.orange}
          sub={<>
            <strong style={{ color: pctCuota >= 100 ? P.green : P.orange, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{pctCuota > 0 ? fmtPct(pctCuota) : '—'}</strong> ideal
            {cuotaMin > 0 && (<> · <strong style={{ color: pctCuotaMin >= 100 ? P.green : pctCuotaMin >= 85 ? theme.text : P.orange, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{fmtPct(pctCuotaMin)}</strong> mín</>)}
            <br />
            <span style={{ color: theme.textMuted }}>{cuotaMin > 0 ? `${fmtMoney(cuotaMin)} mín · ` : ''}{fmtMoney(cuotaIdeal)} ideal</span>
          </>}
          series={mini.si} baseColor={P.accent} highlightColor={P.green}
        />
        <KpiCard theme={theme} P={P} eyebrow="Sell Out" title="últimos 30 días"
          big={fmtMoney(sellOutMes)}
          sub={<>{deltaSellOut != null && (<><strong style={{ color: deltaSellOut >= 0 ? P.green : P.red, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{deltaSellOut >= 0 ? '+' : ''}{Math.round(deltaSellOut)}%</strong> vs mes ant.</>)}</>}
          series={mini.so} baseColor={P.green} highlightColor={P.green}
        />
        <KpiCard theme={theme} P={P} eyebrow="Inventario" title="días de inventario"
          big={inventarioDias > 0 ? `${Math.round(inventarioDias)}d` : '—'}
          bigColor={inventarioDias > metaInvDias ? P.orange : P.green}
          sub={<>{fmtMoney(inventarioValor)} · meta <strong style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{metaInvDias}d</strong>{inventarioDias > metaInvDias && (<> · <strong style={{ color: P.orange, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>▲{Math.round(inventarioDias - metaInvDias)}d</strong></>)}</>}
          series={mini.inv} baseColor={P.orange} highlightColor={P.orange}
        />
        <KpiCard theme={theme} P={P} eyebrow="Cobranza global" title="cartera al día"
          big={fmtMoney(aging?.alDia || 0)}
          bigColor={P.green}
          sub={aging?.vencido > 0 ? <><strong style={{ color: P.red, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{fmtMoney(aging.vencido)}</strong> vencido</> : 'sin vencido'}
          series={mini.cb} baseColor={P.green} highlightColor={P.green}
        />
      </div>

      {/* Fila 2: Marketing · Pagos · Cobranza detalle */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
        <SoonCard theme={theme} P={P} eyebrow="Marketing" title="campañas activas" />
        <SoonCard theme={theme} P={P} eyebrow="Pagos" title="rebates & spiffs" />
        <CobranzaCard theme={theme} P={P} aging={aging} />
      </div>

      {/* Fila: Timeline lineal (más compacto) + Ferruteck cósmico */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 10 }}>
        <TimelineLineal
          theme={theme} P={P}
          data={timelineMeses}
          sums={timelineSums}
          rango={rango}
          onChangeRango={setRango}
        />
        <FerruteckCosmicCard recos={copilotRecos} />
      </div>

      {/* Sell In vs Sell Out: por marca + temporal lado a lado */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)', gap: 10, alignItems: 'stretch' }}>
        <SucursalesSIvsSOCard theme={theme} P={P} sucursales={sucursalesSIvsSO} rango={sucRango} onChangeRango={setSucRango} />
        <SIvsSOTemporal theme={theme} P={P} data={sivsoTemporal} ratioGlobal={ratioGlobal} mesActual={mesActual} />
      </div>
    </div>
  );
}

function narrativa(pct) {
  if (!pct || pct <= 0) return 'Aún sin datos de sell in para este mes';
  if (pct >= 100) return `Vamos ${(pct - 100).toFixed(1)}% arriba de la cuota mensual`;
  if (pct >= 85) return `Vamos al ${Math.round(pct)}% de la cuota mensual`;
  return 'Falta un empujón para la cuota del mes';
}
function subnarrativa(sellIn, cuota, top) {
  const parts = [];
  if (sellIn > 0) parts.push(`Sell In ${fmtMoney(sellIn)}`);
  if (cuota > 0) parts.push(`${Math.round((sellIn / cuota) * 100)}% de la cuota ideal`);
  if (top) parts.push(`${top.label || top.marca} lideró`);
  return parts.length > 0 ? parts.join(' · ') : 'Carga los datos del mes para ver el resumen aquí.';
}

function HeroStat({ k, v, sub }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{k}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 600, letterSpacing: '-0.025em', color: '#FFF', marginTop: 2 }}>{v}</div>
      {sub && <div style={{ fontFamily: TYPO.fontText, fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

// ═══════════════ KPI card compacta ═══════════════
function KpiCard({ theme, P, eyebrow, title, big, bigColor, sub, series, baseColor, highlightColor }) {
  const [hover, setHover] = useState(false);
  const max = Math.max(1, ...(series || []));
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: theme.surface, border: `1px solid ${theme.border}`,
        borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
        transition: 'transform 200ms, box-shadow 200ms',
        transform: hover ? 'translateY(-1px)' : 'none',
        boxShadow: hover ? '0 4px 12px rgba(0,0,0,0.06)' : 'none',
        position: 'relative',
      }}
    >
      <ChevronRight size={13} style={{ position: 'absolute', top: 10, right: 12, color: theme.textSubtle || theme.textMuted }} />
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600, marginBottom: 2 }}>{eyebrow}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, letterSpacing: '-0.005em', margin: '0 0 8px', color: theme.text }}>{title}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 24, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1, color: bigColor || theme.text }}>{big}</div>
      {sub && <div style={{ fontFamily: TYPO.fontText, fontSize: 10.5, color: theme.textMuted, marginTop: 4 }}>{sub}</div>}
      {series && series.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 22, marginTop: 8 }}>
          {series.map((v, i) => {
            const isLast = i === series.length - 1;
            return (
              <div key={i} style={{
                flex: 1,
                background: isLast ? (highlightColor || baseColor) : baseColor,
                borderRadius: '2px 2px 0 0',
                height: `${Math.max(4, (v / max) * 100)}%`,
                minHeight: 3,
                opacity: v > 0 ? (isLast ? 1 : 0.5) : 0.15,
              }} />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════ Soon card ═══════════════
function SoonCard({ theme, P, eyebrow, title }) {
  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`,
      borderRadius: 12, padding: '12px 14px', opacity: 0.7, position: 'relative',
    }}>
      <ChevronRight size={13} style={{ position: 'absolute', top: 10, right: 12, color: theme.textSubtle || theme.textMuted }} />
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600, marginBottom: 2 }}>{eyebrow}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, margin: '0 0 6px', color: theme.text }}>{title}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 24, fontWeight: 600, color: theme.textMuted, lineHeight: 1, margin: '0 0 6px' }}>—</div>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 8px', borderRadius: 999,
        background: `${P.accent}1E`, color: P.accent,
        fontFamily: TYPO.fontDisplay, fontSize: 8.5, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.08em',
      }}>
        <Sparkles size={9} /> Próximamente
      </div>
    </div>
  );
}

// ═══════════════ Cobranza card (compact) ═══════════════
function CobranzaCard({ theme, P, aging }) {
  const [expanded, setExpanded] = useState(null);
  const total = aging?.total || 0;
  const alDia = aging?.alDia || 0;
  const vencido = aging?.vencido || 0;
  const buckets = aging?.buckets || { d1_30: [], d31_60: [], d61_90: [], mas90: [] };
  const sum = (arr) => (arr || []).reduce((s, f) => s + (f.saldo || 0), 0);
  const s1 = sum(buckets.d1_30), s2 = sum(buckets.d31_60), s3 = sum(buckets.d61_90), s4 = sum(buckets.mas90);
  const maxB = Math.max(1, s1, s2, s3, s4);
  const exp = expanded ? buckets[expanded] || [] : [];
  const expTop = [...exp].sort((a, b) => b.saldo - a.saldo).slice(0, 3);

  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`,
      borderRadius: 12, padding: '12px 14px', position: 'relative',
      gridColumn: 'span 2', cursor: 'pointer',
    }}>
      <ChevronRight size={13} style={{ position: 'absolute', top: 10, right: 12, color: theme.textSubtle || theme.textMuted }} />
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600, marginBottom: 2 }}>Crédito & Cobranza</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, margin: '0 0 8px', color: theme.text }}>aging de la cartera</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16, alignItems: 'start' }}>
        <div>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 600, letterSpacing: '-0.025em', color: P.green, lineHeight: 1 }}>{fmtMoney(total)}</div>
          <div style={{ fontFamily: TYPO.fontText, fontSize: 10, color: theme.textMuted, marginTop: 3, maxWidth: 220, lineHeight: 1.35 }}>
            Total · <strong style={{ color: P.green, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{fmtMoney(alDia)} al día</strong>
            {vencido > 0 && <> · <strong style={{ color: P.red, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{fmtMoney(vencido)} vencido</strong></>}
          </div>
        </div>
        <div>
          <AgingMini theme={theme} label="1-30 d" val={s1} count={buckets.d1_30.length} pct={s1 / maxB * 100} color={P.orange} active={expanded === 'd1_30'} onClick={(e) => { e.stopPropagation(); setExpanded(expanded === 'd1_30' ? null : 'd1_30'); }} />
          <AgingMini theme={theme} label="31-60 d" val={s2} count={buckets.d31_60.length} pct={s2 / maxB * 100} color={P.orange} active={expanded === 'd31_60'} onClick={(e) => { e.stopPropagation(); setExpanded(expanded === 'd31_60' ? null : 'd31_60'); }} />
          <AgingMini theme={theme} label="61-90 d" val={s3} count={buckets.d61_90.length} pct={s3 / maxB * 100} color={P.red} active={expanded === 'd61_90'} onClick={(e) => { e.stopPropagation(); setExpanded(expanded === 'd61_90' ? null : 'd61_90'); }} />
          <AgingMini theme={theme} label="+ 90 d" val={s4} count={buckets.mas90.length} pct={s4 / maxB * 100} color={P.red} active={expanded === 'mas90'} onClick={(e) => { e.stopPropagation(); setExpanded(expanded === 'mas90' ? null : 'mas90'); }} />
        </div>
      </div>
      {expanded && expTop.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${theme.divider || theme.border}` }}>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600, marginBottom: 4 }}>Top 3 en este bucket</div>
          {expTop.map((f, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, padding: '3px 0', fontSize: 10.5, alignItems: 'center' }}>
              <span style={{ fontFamily: TYPO.fontText, color: theme.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.factura || f.folio || 'Factura'}</span>
              <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9.5, color: theme.textMuted }}>{f.dias}d</span>
              <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10, color: theme.text, fontWeight: 600 }}>{fmtMoney(f.saldo)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AgingMini({ theme, label, val, count, pct, color, active, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'grid', gridTemplateColumns: '55px 1fr 22px 55px', gap: 6, alignItems: 'center',
        padding: '3px 6px', margin: '1px -6px', borderRadius: 6,
        fontSize: 10.5, cursor: 'pointer',
        background: active ? `${color}14` : hover ? `${theme.text}06` : 'transparent',
      }}
    >
      <span style={{ fontFamily: TYPO.fontText, color: theme.textMuted, fontWeight: 500 }}>{label}</span>
      <span style={{ height: 4, background: `${theme.text}0F`, borderRadius: 999, overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', background: color, borderRadius: 999, width: `${Math.min(100, pct)}%`, transition: 'width 400ms' }} />
      </span>
      <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9.5, color: theme.textMuted, textAlign: 'right' }}>{count > 0 ? count : '—'}</span>
      <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10, textAlign: 'right', color: theme.text, fontWeight: 600 }}>{fmtMoney(val)}</span>
    </div>
  );
}

// ═══════════════ Timeline lineal · área + labels + Y ticks + tooltip + multi-Q + cuota min+ideal ═══════════════
function TimelineLineal({ theme, P, data, sums, rango, onChangeRango }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const isDark = theme.mode === 'dark';
  const anio = new Date().getFullYear();
  const anioPrev = anio - 1;

  const W = 700, H = 260;
  const padL = 46, padR = 20, padT = 32, padB = 28;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const maxRaw = Math.max(1, ...data.map(d => Math.max(d.sellIn, d.sellInPrev, d.cuota, d.cuotaMin || 0)));
  const niceStep = (v) => {
    const pow = Math.pow(10, Math.floor(Math.log10(v)));
    const norm = v / pow;
    const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
    return nice * pow;
  };
  const maxV = niceStep(maxRaw * 1.15);
  const xOf = (i) => padL + (i / Math.max(1, data.length - 1)) * chartW;
  const yOf = (v) => padT + chartH - (v / maxV) * chartH;
  const idxActual = data.findIndex(d => d.actual);
  const cerrados = data.filter(d => !d.futuro);
  const area2026 = cerrados.length > 0
    ? `M ${xOf(0)},${yOf(cerrados[0].sellIn)} ${cerrados.map((d, i) => `L ${xOf(i)},${yOf(d.sellIn)}`).join(' ')} L ${xOf(cerrados.length - 1)},${padT + chartH} L ${xOf(0)},${padT + chartH} Z`
    : '';
  const line2026 = cerrados.map((d, i) => `${xOf(i)},${yOf(d.sellIn)}`).join(' ');
  const line2025 = data.map((d, i) => `${xOf(i)},${yOf(d.sellInPrev)}`).join(' ');
  const lineCuota = data.map((d, i) => `${xOf(i)},${yOf(d.cuota)}`).join(' ');
  const lineCuotaMin = data.map((d, i) => `${xOf(i)},${yOf(d.cuotaMin || 0)}`).join(' ');
  const hovered = hoverIdx != null ? data[hoverIdx] : null;
  const currentDatum = idxActual >= 0 ? data[idxActual] : null;
  const yTicks = [0, 0.25, 0.50, 0.75, 1].map(f => ({ v: maxV * f, y: padT + chartH * (1 - f) }));
  const gradId = `siAreaHome-${anio}`;

  // rango puede ser Set (multi-select) o string (compat)
  const isSet = rango && typeof rango.has === 'function';
  const isActiveQ = (q) => isSet ? rango.has(q) : rango === q;
  const isActiveAnio = isSet ? rango.size === 4 || rango.size === 0 : rango === 'anio';
  const toggleQ = (q) => {
    if (!isSet) { onChangeRango(new Set([q])); return; }
    const next = new Set(rango);
    if (next.has(q)) next.delete(q); else next.add(q);
    onChangeRango(next);
  };
  const setAnio = () => onChangeRango(new Set(['Q1', 'Q2', 'Q3', 'Q4']));
  const filtros = [{ k: 'Q1', l: 'Q1' }, { k: 'Q2', l: 'Q2' }, { k: 'Q3', l: 'Q3' }, { k: 'Q4', l: 'Q4' }];

  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
        <h5 style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>
          Evolución mensual · Sell In
          <span style={{ fontFamily: TYPO.fontText, fontSize: 10, color: theme.textSubtle || theme.textMuted, fontWeight: 500, fontStyle: 'italic', marginLeft: 8 }}>
            Combina trimestres para sumar
          </span>
        </h5>
        <div style={{ display: 'inline-flex', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderRadius: 8, padding: 2 }}>
          {filtros.map(f => (
            <button key={f.k} onClick={() => toggleQ(f.k)}
              style={{
                border: 0, background: isActiveQ(f.k) ? theme.surface : 'transparent',
                padding: '4px 10px', borderRadius: 6,
                fontFamily: isActiveQ(f.k) ? TYPO.fontDisplay : TYPO.fontText,
                fontSize: 10.5, color: isActiveQ(f.k) ? theme.text : theme.textMuted,
                fontWeight: isActiveQ(f.k) ? 600 : 500, cursor: 'pointer',
                boxShadow: isActiveQ(f.k) ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                borderWidth: 1, borderStyle: 'solid', borderColor: isActiveQ(f.k) ? theme.border : 'transparent',
              }}>{f.l}</button>
          ))}
          <button onClick={setAnio}
            style={{
              border: 0, background: isActiveAnio ? theme.surface : 'transparent',
              padding: '4px 10px', borderRadius: 6,
              fontFamily: isActiveAnio ? TYPO.fontDisplay : TYPO.fontText,
              fontSize: 10.5, color: isActiveAnio ? theme.text : theme.textMuted,
              fontWeight: isActiveAnio ? 600 : 500, cursor: 'pointer',
              boxShadow: isActiveAnio ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              borderWidth: 1, borderStyle: 'solid', borderColor: isActiveAnio ? theme.border : 'transparent',
            }}>Año</button>
        </div>
      </div>

      {/* Sums row */}
      <div style={{ display: 'flex', gap: 14, padding: '6px 0 8px', flexWrap: 'wrap', borderBottom: `1px solid ${theme.divider || theme.border}`, marginBottom: 6 }}>
        <SumStat theme={theme} k={<><Dot color={theme.textMuted} />SI {anioPrev}</>} v={fmtMoney(sums.s2025)} vColor={theme.textMuted} />
        <SumStat theme={theme} k={<><Dot color={P.accent} />SI {anio}</>} v={fmtMoney(sums.s2026)} vColor={theme.text} />
        <SumStat theme={theme} k={<><Dot color={P.orange} dashed />Cuota mín</>} v={fmtMoney(sums.cuotaMin)} vColor={theme.text} />
        <SumStat theme={theme} k={<><Dot color={P.orange} dashed />Cuota ideal</>} v={fmtMoney(sums.cuota)} vColor={theme.text} />
        {sums.deltaYoY != null && (
          <SumStat theme={theme} k="Δ YoY" v={`${sums.deltaYoY >= 0 ? '+' : ''}${sums.deltaYoY.toFixed(1)}%`} vColor={sums.deltaYoY >= 0 ? P.green : P.red} />
        )}
        {sums.deltaCuotaMin != null && (
          <SumStat theme={theme} k="Δ vs mín" v={`${sums.deltaCuotaMin >= 0 ? '+' : ''}${sums.deltaCuotaMin.toFixed(1)}%`} vColor={sums.deltaCuotaMin >= 0 ? P.green : P.red} />
        )}
        {sums.deltaCuota != null && (
          <SumStat theme={theme} k="Δ vs ideal" v={`${sums.deltaCuota >= 0 ? '+' : ''}${sums.deltaCuota.toFixed(1)}%`} vColor={sums.deltaCuota >= 0 ? P.green : P.red} />
        )}
      </div>

      {/* Chart */}
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 260, display: 'block' }}>
          <defs>
            <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={P.accent} stopOpacity="0.28" />
              <stop offset="100%" stopColor={P.accent} stopOpacity="0" />
            </linearGradient>
          </defs>
          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={padL} y1={t.y} x2={W - padR} y2={t.y}
                stroke={i === 0 ? (theme.divider || theme.border) : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')}
                strokeDasharray={i === 0 ? undefined : '3 4'} />
              <text x={padL - 8} y={t.y + 3} textAnchor="end"
                fontFamily='"SF Mono", ui-monospace, monospace' fontSize="9" fill={theme.textMuted}>
                {fmtMoney(t.v)}
              </text>
            </g>
          ))}
          {area2026 && <path d={area2026} fill={`url(#${gradId})`} />}
          <polyline points={line2025} fill="none" stroke={theme.textMuted} strokeWidth="2" opacity="0.55" />
          <polyline points={lineCuotaMin} fill="none" stroke={P.orange} strokeWidth="1.5" strokeDasharray="2 4" opacity="0.55" />
          <polyline points={lineCuota} fill="none" stroke={P.orange} strokeWidth="2" strokeDasharray="5 4" opacity="0.85" />
          <polyline points={line2026} fill="none" stroke={P.accent} strokeWidth="3" />
          {cerrados.map((d, i) => {
            const cx = xOf(i), cy = yOf(d.sellIn);
            return (
              <g key={`p-${i}`}>
                <circle cx={cx} cy={cy} r={d.actual ? 6 : 4}
                  fill={d.actual ? P.green : P.accent}
                  stroke={theme.surface} strokeWidth={d.actual ? 2.5 : 2} />
                {!d.actual && (
                  <text x={cx} y={cy - 10} textAnchor="middle"
                    fontFamily={TYPO.fontDisplay} fontSize="10" fontWeight="600" fill={theme.text}>
                    {fmtMoney(d.sellIn)}
                  </text>
                )}
              </g>
            );
          })}
          {data.map((d, i) => (
            <rect key={`h-${i}`}
              x={xOf(i) - chartW / (data.length * 2)}
              y={padT}
              width={chartW / data.length}
              height={chartH}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              style={{ cursor: 'pointer' }}
            />
          ))}
          {hoverIdx != null && (
            <line x1={xOf(hoverIdx)} y1={padT} x2={xOf(hoverIdx)} y2={H - padB}
              stroke={theme.textMuted} strokeWidth="1" strokeDasharray="2 3" opacity="0.4" />
          )}
          {data.map((d, i) => (
            <text key={`x-${i}`} x={xOf(i)} y={H - 8} textAnchor="middle"
              fontFamily='"SF Mono", ui-monospace, monospace' fontSize="9"
              fill={d.actual ? P.green : theme.textMuted}
              fontWeight={d.actual ? 700 : 500}
              opacity={d.futuro ? 0.4 : 1}>
              {d.label}
            </text>
          ))}
          {currentDatum && idxActual >= 0 && hoverIdx == null && (() => {
            const cx = xOf(idxActual);
            const cy = yOf(currentDatum.sellIn);
            const yoyPct = currentDatum.sellInPrev > 0 ? ((currentDatum.sellIn - currentDatum.sellInPrev) / currentDatum.sellInPrev * 100) : null;
            const boxW = 130;
            const boxX = Math.max(padL, Math.min(W - padR - boxW, cx - boxW / 2));
            const boxY = Math.max(4, cy - 44);
            return (
              <g pointerEvents="none">
                <line x1={cx} y1={cy - 8} x2={cx} y2={boxY + 32} stroke={theme.text} strokeWidth="1" opacity="0.15" />
                <rect x={boxX} y={boxY} width={boxW} height={32} rx="6" fill="#0A0A0C" />
                <text x={boxX + boxW / 2} y={boxY + 13} textAnchor="middle"
                  fontFamily={TYPO.fontDisplay} fontSize="10.5" fontWeight="600" fill="#FFF">
                  {currentDatum.label} · {fmtMoney(currentDatum.sellIn)}
                </text>
                <text x={boxX + boxW / 2} y={boxY + 25} textAnchor="middle"
                  fontFamily='"SF Mono", ui-monospace, monospace' fontSize="9" fill="rgba(255,255,255,0.65)">
                  {yoyPct != null ? `${yoyPct >= 0 ? '+' : ''}${yoyPct.toFixed(1)}% YoY` : 'sin comparativo'}
                </text>
              </g>
            );
          })()}
        </svg>
        {hovered && !hovered.futuro && (
          <TimelineTooltip theme={theme} P={P} data={hovered} anio={anio}
            xPct={((hoverIdx * chartW / Math.max(1, data.length - 1)) + padL) / W * 100} />
        )}
      </div>
    </div>
  );
}

function Dot({ color, dashed }) {
  return (
    <span style={{ display: 'inline-block', width: 8, height: dashed ? 0 : 2, borderRadius: 1, background: dashed ? 'transparent' : color, borderTop: dashed ? `2px dashed ${color}` : 'none', marginRight: 4 }} />
  );
}
function SumStat({ theme, k, v, vColor }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>{k}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', color: vColor || theme.text, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
    </div>
  );
}

function TimelineTooltip({ theme, P, data, anio, xPct }) {
  const anioPrev = anio - 1;
  const delta = data.sellInPrev > 0 ? ((data.sellIn - data.sellInPrev) / data.sellInPrev * 100) : null;
  return (
    <div style={{
      position: 'absolute', top: 8, left: `${xPct}%`, transform: 'translateX(-50%)',
      background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8,
      padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', pointerEvents: 'none',
      zIndex: 5, minWidth: 150, maxWidth: 220,
    }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, color: theme.text, letterSpacing: '-0.005em' }}>{data.label} · {anio}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginTop: 3 }}>
        <span style={{ color: theme.textMuted }}>SI {anio}</span>
        <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', color: theme.text, fontWeight: 600 }}>{fmtMoney(data.sellIn)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginTop: 2 }}>
        <span style={{ color: theme.textMuted }}>SI {anioPrev}</span>
        <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', color: theme.text, fontWeight: 600 }}>{fmtMoney(data.sellInPrev)}</span>
      </div>
      {data.cuotaMin > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginTop: 2 }}>
          <span style={{ color: theme.textMuted }}>Cuota mín</span>
          <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', color: theme.text, fontWeight: 600 }}>{fmtMoney(data.cuotaMin)}</span>
        </div>
      )}
      {data.cuota > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginTop: 2 }}>
          <span style={{ color: theme.textMuted }}>Cuota ideal</span>
          <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', color: theme.text, fontWeight: 600 }}>{fmtMoney(data.cuota)}</span>
        </div>
      )}
      {delta != null && (
        <div style={{ marginTop: 4, paddingTop: 4, borderTop: `1px dashed ${theme.divider || theme.border}`, display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
          <span style={{ color: theme.textMuted }}>Δ YoY</span>
          <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontWeight: 700, color: delta >= 0 ? P.green : P.red }}>
            {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
}

// ═══════════════ Sell In vs Sell Out temporal · área + labels + Y ticks + tooltip ═══════════════
function SIvsSOTemporal({ theme, P, data, ratioGlobal, mesActual }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const isDark = theme.mode === 'dark';
  const anio = new Date().getFullYear();
  const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  const W = 700, H = 260;
  const padL = 46, padR = 20, padT = 32, padB = 28;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const maxRaw = Math.max(1, ...data.map(d => Math.max(d.sellIn, d.sellOut)));
  const niceStep = (v) => {
    const pow = Math.pow(10, Math.floor(Math.log10(v)));
    const norm = v / pow;
    const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
    return nice * pow;
  };
  const maxV = niceStep(maxRaw * 1.15);
  const xOf = (i) => padL + (i / Math.max(1, data.length - 1)) * chartW;
  const yOf = (v) => padT + chartH - (v / maxV) * chartH;
  const idxActual = data.findIndex(d => d.mes === mesActual);
  const cerrados = data.filter(d => !d.futuro);
  const areaSI = cerrados.length > 0
    ? `M ${xOf(0)},${yOf(cerrados[0].sellIn)} ${cerrados.map((d, i) => `L ${xOf(i)},${yOf(d.sellIn)}`).join(' ')} L ${xOf(cerrados.length - 1)},${padT + chartH} L ${xOf(0)},${padT + chartH} Z`
    : '';
  const lineSI = cerrados.map((d, i) => `${xOf(i)},${yOf(d.sellIn)}`).join(' ');
  const lineSO = cerrados.map((d, i) => `${xOf(i)},${yOf(d.sellOut)}`).join(' ');
  const hovered = hoverIdx != null ? data[hoverIdx] : null;
  const currentDatum = idxActual >= 0 ? data[idxActual] : null;
  const yTicks = [0, 0.25, 0.50, 0.75, 1].map(f => ({ v: maxV * f, y: padT + chartH * (1 - f) }));
  const gradId = `sivsoArea-${anio}`;

  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
        <h5 style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>
          Sell In vs Sell Out · {anio}
        </h5>
        {ratioGlobal.ratio != null && (
          <div style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10.5, color: theme.textMuted }}>
            Ratio SO/SI: <strong style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{fmtPct(ratioGlobal.ratio)}</strong>
            {ratioGlobal.deltaPP != null && (
              <> · <strong style={{ color: ratioGlobal.deltaPP >= 0 ? P.green : P.red, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{ratioGlobal.deltaPP >= 0 ? '+' : ''}{ratioGlobal.deltaPP.toFixed(1)}pp</strong> vs {anio - 1}</>
            )}
          </div>
        )}
      </div>
      {/* Leyenda */}
      <div style={{ display: 'flex', gap: 14, padding: '6px 0 8px', flexWrap: 'wrap', borderBottom: `1px solid ${theme.divider || theme.border}`, marginBottom: 6 }}>
        <SumStat theme={theme} k={<><Dot color={P.accent} />Sell In</>} v={fmtMoney(cerrados.reduce((s, d) => s + d.sellIn, 0))} vColor={theme.text} />
        <SumStat theme={theme} k={<><Dot color={P.green} />Sell Out</>} v={fmtMoney(cerrados.reduce((s, d) => s + d.sellOut, 0))} vColor={theme.text} />
        <SumStat theme={theme} k="Meses" v={String(cerrados.length)} vColor={theme.text} />
      </div>

      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 260, display: 'block' }}>
          <defs>
            <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={P.accent} stopOpacity="0.22" />
              <stop offset="100%" stopColor={P.accent} stopOpacity="0" />
            </linearGradient>
          </defs>
          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={padL} y1={t.y} x2={W - padR} y2={t.y}
                stroke={i === 0 ? (theme.divider || theme.border) : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')}
                strokeDasharray={i === 0 ? undefined : '3 4'} />
              <text x={padL - 8} y={t.y + 3} textAnchor="end"
                fontFamily='"SF Mono", ui-monospace, monospace' fontSize="9" fill={theme.textMuted}>
                {fmtMoney(t.v)}
              </text>
            </g>
          ))}
          {areaSI && <path d={areaSI} fill={`url(#${gradId})`} />}
          <polyline points={lineSO} fill="none" stroke={P.green} strokeWidth="2.5" />
          <polyline points={lineSI} fill="none" stroke={P.accent} strokeWidth="3" />
          {cerrados.map((d, i) => {
            const isActual = d.mes === mesActual;
            const cxP = xOf(i);
            return (
              <g key={`p-${i}`}>
                <circle cx={cxP} cy={yOf(d.sellIn)} r={isActual ? 6 : 4} fill={isActual ? P.green : P.accent} stroke={theme.surface} strokeWidth={isActual ? 2.5 : 2} />
                <circle cx={cxP} cy={yOf(d.sellOut)} r={isActual ? 5 : 3.5} fill={P.green} stroke={theme.surface} strokeWidth={isActual ? 2 : 1.5} />
                {!isActual && (
                  <text x={cxP} y={yOf(d.sellIn) - 10} textAnchor="middle"
                    fontFamily={TYPO.fontDisplay} fontSize="10" fontWeight="600" fill={theme.text}>
                    {fmtMoney(d.sellIn)}
                  </text>
                )}
              </g>
            );
          })}
          {data.map((d, i) => (
            <rect key={`h-${i}`}
              x={xOf(i) - chartW / (data.length * 2)}
              y={padT}
              width={chartW / data.length}
              height={chartH}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              style={{ cursor: 'pointer' }}
            />
          ))}
          {hoverIdx != null && (
            <line x1={xOf(hoverIdx)} y1={padT} x2={xOf(hoverIdx)} y2={H - padB}
              stroke={theme.textMuted} strokeWidth="1" strokeDasharray="2 3" opacity="0.4" />
          )}
          {data.map((d, i) => (
            <text key={`x-${i}`} x={xOf(i)} y={H - 8} textAnchor="middle"
              fontFamily='"SF Mono", ui-monospace, monospace' fontSize="9"
              fill={d.mes === mesActual ? P.green : theme.textMuted}
              fontWeight={d.mes === mesActual ? 700 : 500}
              opacity={d.futuro ? 0.4 : 1}>
              {MESES_CORTOS[d.mes - 1]}
            </text>
          ))}
          {currentDatum && idxActual >= 0 && hoverIdx == null && (() => {
            const cx = xOf(idxActual);
            const cy = yOf(currentDatum.sellIn);
            const ratio = currentDatum.sellIn > 0 ? (currentDatum.sellOut / currentDatum.sellIn * 100) : null;
            const boxW = 148;
            const boxX = Math.max(padL, Math.min(W - padR - boxW, cx - boxW / 2));
            const boxY = Math.max(4, cy - 44);
            return (
              <g pointerEvents="none">
                <line x1={cx} y1={cy - 8} x2={cx} y2={boxY + 32} stroke={theme.text} strokeWidth="1" opacity="0.15" />
                <rect x={boxX} y={boxY} width={boxW} height={32} rx="6" fill="#0A0A0C" />
                <text x={boxX + boxW / 2} y={boxY + 13} textAnchor="middle"
                  fontFamily={TYPO.fontDisplay} fontSize="10.5" fontWeight="600" fill="#FFF">
                  SI {fmtMoney(currentDatum.sellIn)} · SO {fmtMoney(currentDatum.sellOut)}
                </text>
                <text x={boxX + boxW / 2} y={boxY + 25} textAnchor="middle"
                  fontFamily='"SF Mono", ui-monospace, monospace' fontSize="9" fill="rgba(255,255,255,0.65)">
                  {ratio != null ? `SO/SI ${ratio.toFixed(1)}%` : 'sin SI'}
                </text>
              </g>
            );
          })()}
        </svg>
        {hovered && !hovered.futuro && (
          <div style={{
            position: 'absolute',
            top: 8,
            left: `${((hoverIdx * chartW / Math.max(1, data.length - 1)) + padL) / W * 100}%`,
            transform: 'translateX(-50%)',
            background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8,
            padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', pointerEvents: 'none',
            zIndex: 5, minWidth: 150, maxWidth: 220,
          }}>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, color: theme.text, letterSpacing: '-0.005em' }}>{NOMBRES_MES[hovered.mes - 1]} · {anio}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginTop: 3 }}>
              <span style={{ color: P.accent }}>Sell In</span>
              <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', color: theme.text, fontWeight: 600 }}>{fmtMoney(hovered.sellIn)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginTop: 2 }}>
              <span style={{ color: P.green }}>Sell Out</span>
              <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', color: theme.text, fontWeight: 600 }}>{fmtMoney(hovered.sellOut)}</span>
            </div>
            {hovered.sellIn > 0 && (
              <div style={{ marginTop: 4, paddingTop: 4, borderTop: `1px dashed ${theme.divider || theme.border}`, display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                <span style={{ color: theme.textMuted }}>Ratio SO/SI</span>
                <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontWeight: 700, color: theme.text }}>{fmtPct(hovered.sellOut / hovered.sellIn * 100)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════ Ferruteck Cosmic Card ═══════════════
function FerruteckCosmicCard({ recos }) {
  return (
    <div style={{
      borderRadius: 12, padding: '14px 16px',
      background: `
        radial-gradient(circle at 20% 30%, rgba(191,90,242,0.35) 0%, transparent 60%),
        radial-gradient(circle at 80% 80%, rgba(100,210,255,0.25) 0%, transparent 60%),
        linear-gradient(180deg, #1e1e2e 0%, #0d0d19 100%)`,
      color: '#FFF',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 2px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Estrellitas */}
      <FerruteckStars />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, position: 'relative' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 8px 3px 6px', borderRadius: 999,
          background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(191,90,242,0.3)',
          color: '#FFF', fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          <FerruMini size={12} />
          Ferruteck
        </span>
        <h5 style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, margin: 0, color: '#FFF' }}>Recomendaciones</h5>
      </div>
      {recos.length === 0 && (
        <div style={{ padding: '14px 4px', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 11, position: 'relative' }}>
          Todo bajo control · sin recomendaciones activas
        </div>
      )}
      {recos.map((r, i) => (
        <FerruReco key={i} r={r} first={i === 0} />
      ))}
    </div>
  );
}

function FerruReco({ r, first }) {
  const bg = r.sev === 'urgente' ? '#FF453A' : r.sev === 'warn' ? '#FF9F0A' : '#64D2FF';
  const iconColor = r.sev === 'info' ? '#000' : '#FFF';
  const Icon = r.sev === 'urgente' ? AlertTriangle : r.sev === 'warn' ? Clock : TrendingUp;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: 8,
      padding: '7px 0', borderTop: first ? 'none' : '1px solid rgba(255,255,255,0.08)',
      alignItems: 'center', position: 'relative',
    }}>
      <span style={{ width: 24, height: 24, borderRadius: 6, background: bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: iconColor }}>
        <Icon size={13} strokeWidth={2.4} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, color: '#FFF' }}>{r.title}</div>
        <div style={{ fontFamily: TYPO.fontText, fontSize: 9.5, color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>{r.sub}</div>
      </div>
      <button style={{ background: 'transparent', border: 0, color: '#64D2FF', fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 600, cursor: 'pointer', padding: '3px 6px', borderRadius: 6 }}>Ver ›</button>
    </div>
  );
}

function FerruteckStars() {
  const stars = [
    { top: '10%', left: '18%', d: 0 }, { top: '25%', left: '82%', d: 0.4 },
    { top: '55%', left: '10%', d: 0.9 }, { top: '80%', left: '65%', d: 1.4 },
    { top: '15%', left: '55%', d: 1.9 }, { top: '45%', left: '90%', d: 2.4 },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <style>{`@keyframes fCosmicTwinkle { 0%,100% { opacity:0.3; transform:scale(0.8); } 50% { opacity:1; transform:scale(1.4); } }`}</style>
      {stars.map((s, i) => (
        <span key={i} style={{
          position: 'absolute', top: s.top, left: s.left,
          width: 2, height: 2, borderRadius: 999, background: '#FFF',
          boxShadow: '0 0 6px rgba(255,255,255,0.8)',
          animation: `fCosmicTwinkle 3s ease-in-out ${s.d}s infinite`,
        }} />
      ))}
    </div>
  );
}

function FerruMini({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 140 150" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="ferruMiniBody" cx="35%" cy="30%">
          <stop offset="0%" stopColor="#F5E6FF" />
          <stop offset="40%" stopColor="#D0A8F0" />
          <stop offset="100%" stopColor="#AF52DE" />
        </radialGradient>
      </defs>
      <path d="M 25 40 Q 25 15 70 15 Q 115 15 115 40 L 115 100 Q 115 105 110 105 Q 105 100 100 105 Q 95 110 90 105 Q 85 100 80 105 Q 75 110 70 105 Q 65 100 60 105 Q 55 110 50 105 Q 45 100 40 105 Q 35 110 30 105 Q 25 100 25 95 Z"
        fill="url(#ferruMiniBody)" />
      <ellipse cx="52" cy="50" rx="7" ry="9" fill="#1a1a2e" />
      <ellipse cx="88" cy="50" rx="7" ry="9" fill="#1a1a2e" />
      <path d="M 60 72 Q 70 80 80 72" stroke="#1a1a2e" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// ═══════════════ Sell In vs Sell Out por SUCURSAL (Dicotech) ═══════════════
function SucursalesSIvsSOCard({ theme, P, sucursales, rango, onChangeRango }) {
  const maxSI = Math.max(1, ...sucursales.map(s => s.si));
  const maxSO = Math.max(1, ...sucursales.map(s => s.so));
  const isDark = theme.mode === 'dark';

  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h5 style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>
          Sell In vs Sell Out por sucursal
        </h5>
        <div style={{ display: 'inline-flex', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderRadius: 6, padding: 2 }}>
          {[{ k: 'Q1', l: 'Q1' }, { k: 'Q2', l: 'Q2' }, { k: 'Q3', l: 'Q3' }, { k: 'Q4', l: 'Q4' }, { k: 'anio', l: 'YTD' }].map(op => (
            <button key={op.k} onClick={() => onChangeRango(op.k)}
              style={{
                border: 0, background: rango === op.k ? theme.surface : 'transparent',
                padding: '3px 8px', borderRadius: 4,
                fontFamily: rango === op.k ? TYPO.fontDisplay : TYPO.fontText,
                fontSize: 10, color: rango === op.k ? theme.text : theme.textMuted,
                fontWeight: rango === op.k ? 600 : 500, cursor: 'pointer',
                borderWidth: 1, borderStyle: 'solid', borderColor: rango === op.k ? theme.border : 'transparent',
              }}>{op.l}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, fontSize: 10, color: theme.textMuted, marginBottom: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ display: 'inline-block', width: 14, height: 2, background: P.accent, borderRadius: 1 }} /> Sell In prop.
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ display: 'inline-block', width: 14, height: 2, background: P.green, borderRadius: 1 }} /> Sell Out
        </span>
        <span style={{ color: theme.textSubtle || theme.textMuted }}>· ratio SO/SI</span>
      </div>

      {sucursales.length === 0 && (
        <div style={{ padding: '20px 4px', textAlign: 'center', color: theme.textMuted, fontSize: 11 }}>
          Sin datos de sell out por sucursal para este rango
        </div>
      )}
      {sucursales.map((s) => {
        const ratio = s.ratio;
        const ratioColor = ratio == null ? theme.textMuted : ratio >= 80 ? P.green : ratio >= 60 ? P.orange : P.red;
        return (
          <div key={s.sucursal} style={{
            display: 'grid', gridTemplateColumns: '110px 1fr 1fr 70px', gap: 10, alignItems: 'center',
            padding: '6px 0', fontSize: 11, borderTop: `1px solid ${theme.divider || theme.border}`,
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden' }}>
              <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
              <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 8.5, fontWeight: 700, padding: '1px 5px', borderRadius: 999, background: `${theme.text}10`, color: theme.textMuted, textTransform: 'capitalize' }}>{s.tipo === 'fisica' ? 'Física' : 'Virtual'}</span>
            </span>
            <MarcaBar val={s.si} max={maxSI} color={P.accent} theme={theme} />
            <MarcaBar val={s.so} max={maxSO} color={P.green} theme={theme} />
            <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10.5, textAlign: 'right', color: ratioColor, fontWeight: 700 }}>
              {ratio != null ? fmtPct(ratio) : '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MarcaBar({ val, max, color, theme }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ flex: 1, height: 12, background: `${theme.text}0A`, borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
        <span style={{ display: 'block', height: '100%', background: color, borderRadius: 3, width: `${Math.min(100, (val / max) * 100)}%`, transition: 'width 500ms' }} />
      </span>
      <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9.5, color: theme.textMuted, minWidth: 42, textAlign: 'right', fontWeight: 600 }}>{fmtMoney(val)}</span>
    </div>
  );
}
