import React, { useState, useEffect, useMemo } from "react";
import { supabase, DB_CONFIGURED } from '../../lib/supabase';
import { formatMXN, formatUSD, formatFecha } from '../../lib/utils';
import { CardHeader } from '../../components';
import { usePerfil } from '../../lib/perfilContext';
import { puedeEditarPestanaCliente } from '../../lib/permisos';
import { BarChart3, CalendarDays, TrendingUp, CreditCard, AlertTriangle, Pencil, Check, X as XIcon } from 'lucide-react';
import { fetchSelloutSku } from '../../lib/pcelAdapter';

const NOMBRES_MES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

export default function CreditoCobranza({ cliente, clienteKey }) {
  const c = cliente;
  const perfil = usePerfil();
  // Permiso granular por (clienteKey, 'cartera').
  const canEdit = puedeEditarPestanaCliente(perfil, clienteKey, 'cartera');
  const [estado, setEstado]       = useState(null);
  const [estadoPrev, setEstadoPrev] = useState(null);  // corte anterior para delta
  const [historico, setHistorico] = useState([]);
  const [sellIn, setSellIn]       = useState(0);
  const [sellInByMes, setSellInByMes] = useState({});
  const [sellOut, setSellOut]     = useState({});
  const [cuotas, setCuotas]       = useState([]);
  const [detalle, setDetalle]     = useState([]);       // facturas del corte actual
  const [detallePrev, setDetallePrev] = useState([]);   // facturas del corte anterior
  const [config, setConfig]       = useState(null);     // línea + plazo
  const [loading, setLoading]     = useState(true);

  const cargarTodo = async () => {
    if (!DB_CONFIGURED) { setLoading(false); return; }
    setLoading(true);
    const anio = new Date().getFullYear();
    const [ecRes, histRes, siRes, soRes, qRes, cfgRes] = await Promise.all([
      // Últimos 2 cortes (para delta semanal)
      supabase.from("estados_cuenta").select("*").eq("cliente", clienteKey)
        .order("anio", { ascending: false }).order("semana", { ascending: false }).limit(2),
      supabase.from("estados_cuenta").select("anio, semana, fecha_corte, saldo_actual, saldo_vencido, dso")
        .eq("cliente", clienteKey).order("anio", { ascending: true }).order("semana", { ascending: true }).limit(20),
      supabase.from("sell_in_sku").select("mes, monto_pesos").eq("cliente", clienteKey).eq("anio", anio),
      fetchSelloutSku(clienteKey, anio),
      supabase.from("cuotas_mensuales").select("mes, cuota_min").eq("cliente", clienteKey).eq("anio", anio).order("mes"),
      supabase.from("clientes_credito_config").select("*").eq("cliente", clienteKey).maybeSingle(),
    ]);
    const ecArr = ecRes.data || [];
    const ecActual = ecArr[0] || null;
    const ecPrev = ecArr[1] || null;
    setEstado(ecActual);
    setEstadoPrev(ecPrev);
    setConfig(cfgRes.data || null);
    setHistorico(histRes.data || []);

    // Cargar detalle de ambos cortes (actual y previo) en paralelo
    if (ecActual || ecPrev) {
      const ids = [ecActual?.id, ecPrev?.id].filter(Boolean);
      const { data: det } = await supabase
        .from("estados_cuenta_detalle")
        .select("*")
        .in("estado_cuenta_id", ids);
      const detAll = det || [];
      setDetalle(detAll.filter(r => r.estado_cuenta_id === ecActual?.id));
      setDetallePrev(detAll.filter(r => r.estado_cuenta_id === ecPrev?.id));
    } else {
      setDetalle([]); setDetallePrev([]);
    }
    const siAll = siRes.data || [];
    setSellIn(siAll.reduce((s, r) => s + (Number(r.monto_pesos) || 0), 0));
    const siByMes = {};
    siAll.forEach(r => {
      const m = Number(r.mes); siByMes[m] = (siByMes[m] || 0) + (Number(r.monto_pesos) || 0);
    });
    setSellInByMes(siByMes);
    const byMes = {};
    const soArr = Array.isArray(soRes) ? soRes : (soRes.data || []);
    soArr.forEach(r => {
      const m = Number(r.mes); byMes[m] = (byMes[m] || 0) + (Number(r.monto_pesos) || 0);
    });
    setSellOut(byMes);
    setCuotas(qRes.data || []);
    setLoading(false);
  };

  useEffect(() => { cargarTodo(); }, [clienteKey]);

  // ═══ TODOS los hooks ANTES de cualquier return condicional ═══
  // (Rules of Hooks: el número y orden de hooks debe ser estable entre
  //  renders. Si ponemos useMemo después de un early return, React crashea
  //  cuando estado pasa de null → no-null → null.)
  const hoy = new Date();
  const mesesVenc = useMemo(() => {
    if (!estado) return [];
    return [
      { k: 1, monto: Number(estado.venc_mes_1) || 0 },
      { k: 2, monto: Number(estado.venc_mes_2) || 0 },
      { k: 3, monto: Number(estado.venc_mes_3) || 0 },
    ].map(x => {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() + x.k - 1, 1);
      return { ...x, label: NOMBRES_MES[d.getMonth()], mes: d.getMonth() + 1, anio: d.getFullYear() };
    });
  }, [estado]);

  // Derivados (estos NO son hooks, pueden quedar después de los returns.
  // Pero los pongo aquí para que los useMemo siguientes los puedan usar.)
  const saldoActual    = Number(estado?.saldo_actual) || 0;
  const saldoVencido   = Number(estado?.saldo_vencido) || 0;
  const saldoAVencer   = Number(estado?.saldo_a_vencer) || 0;
  const notasCredito   = Math.abs(Number(estado?.notas_credito) || 0);
  const tipoCambio     = Number(estado?.tipo_cambio) || 0;

  // Línea y plazo desde clientes_credito_config (manual, no del Excel)
  const lineaUSD       = Number(config?.linea_credito_usd) || 0;
  const PLAZO          = Number(config?.plazo_dias_credito) || 90;
  const lineaMXN       = lineaUSD * tipoCambio;
  const usoPct         = lineaMXN > 0 ? Math.min(Math.round((saldoActual / lineaMXN) * 100), 999) : null;

  // ═══ Aging calculado desde estados_cuenta_detalle (en vez de los campos
  //     agregados del corte que a veces vienen vacíos).
  //     Usa fecha_vencimiento + días desde vencimiento para clasificar.
  const hoyMs = hoy.getTime();
  const diasAtraso = (f) => {
    if (!f.vencimiento) return 0;
    const v = new Date(f.vencimiento + "T00:00:00").getTime();
    return Math.max(0, Math.floor((hoyMs - v) / (1000 * 60 * 60 * 24)));
  };
  const facturasConSaldo = useMemo(() =>
    (detalle || []).filter(f => Number(f.saldo_actual) > 0),
  [detalle]);

  const aging = useMemo(() => {
    const buckets = { d0_30: 0, d31_60: 0, d61_90: 0, d91_180: 0, mas180: 0 };
    facturasConSaldo.forEach(f => {
      const d = diasAtraso(f);
      if (d <= 0) return; // no vencida → no cuenta en aging
      const saldo = Number(f.saldo_actual) || 0;
      if (d <= 30) buckets.d0_30 += saldo;
      else if (d <= 60) buckets.d31_60 += saldo;
      else if (d <= 90) buckets.d61_90 += saldo;
      else if (d <= 180) buckets.d91_180 += saldo;
      else buckets.mas180 += saldo;
    });
    return buckets;
  }, [facturasConSaldo]);
  const agTotal  = aging.d0_30 + aging.d31_60 + aging.d61_90 + aging.d91_180 + aging.mas180;
  const hasAging = agTotal > 0;
  const agPct    = v => agTotal > 0 ? Math.round((v / agTotal) * 100) : 0;

  // ═══ DSO recalculado — edad promedio ponderada por saldo.
  //     "El tiempo real que tarda el dinero en regresar" — si plazo son
  //     90 y el cliente paga a los 105, DSO será ~105.
  //     Fórmula: Σ(saldo × días_desde_emisión) / Σ(saldo)
  const dsoReal = useMemo(() => {
    let num = 0, den = 0;
    facturasConSaldo.forEach(f => {
      if (!f.fecha_emision) return;
      const saldo = Number(f.saldo_actual) || 0;
      const dias = Math.floor((hoyMs - new Date(f.fecha_emision + "T00:00:00").getTime()) / (1000*60*60*24));
      if (dias < 0) return;
      num += saldo * dias;
      den += saldo;
    });
    return den > 0 ? Math.round(num / den) : null;
  }, [facturasConSaldo]);

  // DSO del corte anterior (recalculado igual, para delta)
  const dsoRealPrev = useMemo(() => {
    if (!detallePrev || detallePrev.length === 0) return null;
    const prev = detallePrev.filter(f => Number(f.saldo_actual) > 0);
    // Usar fecha de corte previo como "hoy" para consistencia temporal
    const refMs = estadoPrev?.fecha_corte ? new Date(estadoPrev.fecha_corte + "T00:00:00").getTime() : hoyMs;
    let num = 0, den = 0;
    prev.forEach(f => {
      if (!f.fecha_emision) return;
      const saldo = Number(f.saldo_actual) || 0;
      const dias = Math.floor((refMs - new Date(f.fecha_emision + "T00:00:00").getTime()) / (1000*60*60*24));
      if (dias < 0) return;
      num += saldo * dias;
      den += saldo;
    });
    return den > 0 ? Math.round(num / den) : null;
  }, [detallePrev, estadoPrev]);

  // Usar el recalculado si hay detalle; caer al del Excel si no.
  // Optional chaining en estado por si es null (antes del early return).
  const dso = dsoReal != null ? dsoReal : (estado?.dso != null ? Number(estado.dso) : null);

  // ═══ Métricas de cartera vencida (solo facturas con dias_atraso > 0) ═══
  const vencidasList = useMemo(() =>
    facturasConSaldo.filter(f => diasAtraso(f) > 0),
  [facturasConSaldo]);
  const diasPromAtraso = useMemo(() => {
    if (vencidasList.length === 0) return 0;
    let num = 0, den = 0;
    vencidasList.forEach(f => {
      const saldo = Number(f.saldo_actual) || 0;
      num += saldo * diasAtraso(f);
      den += saldo;
    });
    return den > 0 ? Math.round(num / den) : 0;
  }, [vencidasList]);
  const facturaMasAtrasada = useMemo(() => {
    let worst = null;
    vencidasList.forEach(f => {
      const d = diasAtraso(f);
      if (!worst || d > worst.dias) worst = { dias: d, factura: f };
    });
    return worst;
  }, [vencidasList]);

  // Notas de crédito individuales (del detalle)
  const notasCreditoList = useMemo(() =>
    (detalle || []).filter(f => Number(f.importe_factura) < 0),
  [detalle]);

  // ═══ Deltas vs corte anterior ═══
  const fmtDelta = (actual, prev) => {
    if (prev == null || prev === undefined) return null;
    const d = actual - prev;
    const pct = prev !== 0 ? Math.round((d / Math.abs(prev)) * 100) : null;
    return { d, pct, subio: d > 0 };
  };
  const deltaSaldo    = estadoPrev ? fmtDelta(saldoActual, Number(estadoPrev.saldo_actual) || 0) : null;
  const deltaVencido  = estadoPrev ? fmtDelta(saldoVencido, Number(estadoPrev.saldo_vencido) || 0) : null;
  const deltaDso      = dsoRealPrev != null && dso != null ? fmtDelta(dso, dsoRealPrev) : null;

  // ═══ Alertas ═══
  const alertas = useMemo(() => {
    const a = [];
    const pct = v => saldoActual > 0 ? (v / saldoActual) * 100 : 0;
    // 🔴 Graves
    const vencidosMas120 = facturasConSaldo.filter(f => diasAtraso(f) > 30 + PLAZO).length;
    if (vencidosMas120 > 0) {
      const monto = facturasConSaldo.filter(f => diasAtraso(f) > 30 + PLAZO).reduce((s, f) => s + (Number(f.saldo_actual) || 0), 0);
      a.push({ nivel: "grave", texto: `${vencidosMas120} factura${vencidosMas120 !== 1 ? "s" : ""} con más de ${30 + PLAZO}d de atraso · ${formatMXN(monto)}` });
    }
    if (pct(saldoVencido) > 15) {
      a.push({ nivel: "grave", texto: `Cartera vencida ${pct(saldoVencido).toFixed(1)}% del saldo total (${formatMXN(saldoVencido)})` });
    }
    if (dso != null && dso > PLAZO + 30) {
      a.push({ nivel: "grave", texto: `DSO ${dso}d — ${dso - PLAZO}d de retraso promedio vs plazo ${PLAZO}d` });
    }
    // 🟡 Malos
    const vencidos90_120 = facturasConSaldo.filter(f => { const d = diasAtraso(f); return d > PLAZO && d <= PLAZO + 30; }).length;
    if (vencidos90_120 > 0) {
      const monto = facturasConSaldo.filter(f => { const d = diasAtraso(f); return d > PLAZO && d <= PLAZO + 30; }).reduce((s, f) => s + (Number(f.saldo_actual) || 0), 0);
      a.push({ nivel: "malo", texto: `${vencidos90_120} factura${vencidos90_120 !== 1 ? "s" : ""} entre ${PLAZO+1}-${PLAZO+30}d de atraso · ${formatMXN(monto)}` });
    }
    if (dso != null && dso > PLAZO && dso <= PLAZO + 30) {
      a.push({ nivel: "malo", texto: `DSO ${dso}d — ligeramente por encima del plazo ${PLAZO}d` });
    }
    if (pct(saldoVencido) > 5 && pct(saldoVencido) <= 15) {
      a.push({ nivel: "malo", texto: `Cartera vencida ${pct(saldoVencido).toFixed(1)}% del saldo total` });
    }
    if (usoPct != null && usoPct > 85) {
      a.push({ nivel: "malo", texto: `Uso de línea de crédito al ${usoPct}% (${formatMXN(saldoActual)} de ${formatMXN(lineaMXN)})` });
    }
    return a;
  }, [facturasConSaldo, saldoVencido, saldoActual, dso, usoPct, lineaMXN, PLAZO]);

  // Línea de crédito semáforo (tono informativo, no alarmista)
  const lineaStatus = usoPct == null ? null
    : usoPct >= 90 ? { label: "Uso alto",  color: "#ef4444", text: "text-red-700",    dot: "bg-red-500" }
    : usoPct >= 70 ? { label: "Uso medio", color: "#eab308", text: "text-yellow-700", dot: "bg-yellow-500" }
    :                { label: "Saludable", color: "#22c55e", text: "text-green-700",  dot: "bg-green-500" };

  const hasVencMes = mesesVenc.some(v => v.monto > 0);
  const vencTotal  = mesesVenc.reduce((s, v) => s + v.monto, 0) + saldoVencido;
  const vencMax    = Math.max(saldoVencido, ...mesesVenc.map(v => v.monto), 1);

  // Ratio Saldo / Sell In YTD
  const ratioSaldoSellIn = sellIn > 0 ? Math.round((saldoActual / sellIn) * 100) : null;

  // DSO real vs plazo (PLAZO viene de clientes_credito_config, ya definido arriba).
  // Semáforo según reglas del negocio:
  //   - ≤ plazo        → verde (sano)
  //   - plazo+1 a +30  → amarillo (malo: retraso leve)
  //   - > plazo+30     → rojo (grave: retraso fuerte)
  const dsoDelta  = dso != null ? dso - PLAZO : null;
  const dsoStatus = dso == null ? null
    : dso <= PLAZO        ? { label: "Dentro del plazo", text: "text-green-700",  dot: "bg-green-500" }
    : dso <= PLAZO + 30   ? { label: "Retraso leve",     text: "text-yellow-700", dot: "bg-yellow-500" }
    :                       { label: "Pago muy rezagado", text: "text-red-700",    dot: "bg-red-500" };

  // Proyección Sell Out — Híbrido: max(cuota SO mes, promedio real)
  // Mes actual se anualiza (si solo llevamos parte del mes, se escala al mes completo)
  const mesHoy  = hoy.getMonth() + 1;
  const anioHoy = hoy.getFullYear();
  const diasHoy = hoy.getDate();
  const diasMesHoy = new Date(anioHoy, mesHoy, 0).getDate();
  const soValuesRaw = Object.entries(sellOut).map(([m, v]) => ({ mes: Number(m), v })).sort((a, b) => a.mes - b.mes);
  const soValues = soValuesRaw.map(x => {
    // Anualizar si es el mes en curso
    if (x.mes === mesHoy && diasHoy < diasMesHoy) {
      return { mes: x.mes, v: x.v * (diasMesHoy / diasHoy), anualizado: true };
    }
    return { ...x, anualizado: false };
  });
  const hasSellOut = soValues.length >= 1;
  const soPromedio = hasSellOut ? soValues.reduce((s, x) => s + x.v, 0) / soValues.length : 0;
  const soBase     = soPromedio;  // Base para el pie de la tabla
  const tasaCrec   = 1; // ya no se usa; se mantiene por compatibilidad de pie

  // Flujo Facturación (cuota SI) vs Cobranza (venc_mes) próximos 3 meses
  const mesHoyFlujo = hoy.getMonth() + 1;
  const flujo3m = mesesVenc.map(v => {
    const cuotaMes = cuotas.find(q => Number(q.mes) === v.mes);
    const facturar = cuotaMes ? Number(cuotaMes.cuota_min) || 0 : 0;
    const facturadoReal = sellInByMes[v.mes] || 0; // sell in real del mes
    const esMesActual = v.mes === mesHoyFlujo && v.anio === hoy.getFullYear();
    return {
      ...v,
      facturar,
      facturadoReal,
      esMesActual,
      cobrar: v.monto,
      balance: v.monto - facturar,
    };
  });
  const hasFlujo = flujo3m.some(f => f.facturar > 0 || f.cobrar > 0);

  // Acumulado histórico inicial: sell out de meses cerrados antes del mes actual,
  // menos el saldo vencido (lo que el cliente trae rezagado de pagar).
  // Representa la "capacidad de pago" pre-proyección.
  const soHistorico = soValues
    .filter(x => x.mes < mesHoy && !x.anualizado)
    .reduce((s, x) => s + x.v, 0);
  const acumInicial = soHistorico - saldoVencido;

  // Proyección híbrida: max(cuota SO mes, promedio real anualizado)
  // con acumulado que arrastra excesos/déficits mes a mes.
  let acumRun = acumInicial;
  const proyeccion = mesesVenc.map(v => {
    const cuotaMes = cuotas.find(q => Number(q.mes) === v.mes);
    const cuotaMin = cuotaMes ? Number(cuotaMes.cuota_min) || 0 : 0;
    const cobro    = hasSellOut ? Math.max(cuotaMin, soPromedio) : cuotaMin;
    const balance  = cobro - v.monto;
    acumRun += balance;
    return { ...v, cobro, cuotaMin, base: soPromedio, balance, acumulado: acumRun };
  });

  // Tendencia histórica (mientras solo haya 1-2 cortes, se muestra placeholder)
  const hasTendencia = historico.length >= 3;
  const tendenciaData = historico.map(h => ({
    etiqueta: `S${h.semana}`,
    Saldo:    Number(h.saldo_actual) || 0,
    Vencido:  Number(h.saldo_vencido) || 0,
    DSO:      h.dso != null ? Number(h.dso) : null,
  }));

  // Fallbacks con optional chaining por si estado es null (antes del early return)
  const fechaCorteStr = estado?.fecha_corte ? formatFecha(estado.fecha_corte)
                       : estado ? `Sem ${estado.semana}/${estado.anio}` : "";
  const fechaCortePrevStr = estadoPrev?.fecha_corte ? formatFecha(estadoPrev.fecha_corte)
                          : estadoPrev ? `Sem ${estadoPrev.semana}/${estadoPrev.anio}` : null;

  // Mini componente para mostrar delta semanal en los KPIs
  const DeltaBadge = ({ delta, invertido = false, sufijo = "" }) => {
    if (!delta || delta.d === 0) return null;
    // `invertido=true` para métricas donde subir es bueno (ej: saldo a cobrar no se invierte,
    // pero un "por cobrar que baja" sería bueno → default es: subir = malo para cobranza)
    const sube = delta.subio;
    const esBueno = invertido ? sube : !sube;
    const color = esBueno ? "text-green-600" : "text-red-600";
    const icono = sube ? "↑" : "↓";
    const signo = sube ? "+" : "−";
    const absD = Math.abs(delta.d);
    const montoStr = sufijo === "d" ? `${signo}${absD}d` : `${signo}${formatMXN(absD).replace("$","$")}`;
    return (
      <span className={`text-[11px] font-semibold ${color} ml-1 whitespace-nowrap`}>
        {icono} {montoStr}{delta.pct != null ? ` (${delta.pct > 0 ? "+" : ""}${delta.pct}%)` : ""}
      </span>
    );
  };

  // ═══ Early returns — ahora SÍ, después de todos los hooks ═══
  if (!DB_CONFIGURED) return <div className="p-6 text-gray-400 text-sm">Supabase no configurado.</div>;
  if (loading)        return <div className="p-6 text-gray-400 text-sm">Cargando estado de cuenta…</div>;
  if (!estado) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="bg-white rounded-2xl shadow-sm p-6 max-w-xl mx-auto text-center">
          <p className="text-4xl mb-3">📭</p>
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Sin estado de cuenta cargado</h2>
          <p className="text-sm text-gray-500">Sube el corte más reciente de <strong>{c.nombre}</strong> desde <a href="/uploads.html" className="text-blue-600 hover:underline">Actualizar datos</a>.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">

      {/* BANNER DE ALERTAS — aparece solo si hay alertas graves o malas */}
      {alertas.length > 0 && (
        <div className="mb-6 space-y-2">
          {alertas.map((a, i) => (
            <div key={i}
                 className={`rounded-xl border-l-4 p-3 flex items-start gap-3 ${
                   a.nivel === "grave"
                     ? "bg-red-50 border-red-500"
                     : "bg-yellow-50 border-yellow-500"
                 }`}>
              <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${a.nivel === "grave" ? "text-red-600" : "text-yellow-600"}`} />
              <div className="flex-1 text-sm">
                <span className={`font-semibold ${a.nivel === "grave" ? "text-red-800" : "text-yellow-800"}`}>
                  {a.nivel === "grave" ? "🔴 Grave" : "🟡 Atención"}:
                </span>{" "}
                <span className="text-gray-700">{a.texto}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* HEADER */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                 style={{ backgroundColor: c.color }}><CreditCard className="w-4 h-4 text-white" /></div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">{c.nombre} — ¿Cuánto nos deben?</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                <span className="font-medium" style={{ color: c.color }}>{c.marca}</span>
                {estado.razon_social ? <> · {estado.razon_social}</> : null}
                {" · "}Corte: {fechaCorteStr} · Sem {estado.semana}/{estado.anio}
              </p>
            </div>
          </div>
          <div className="text-right">
            {tipoCambio > 0 && (
              <span className="text-xs text-gray-400 block">TC Banxico: ${tipoCambio.toFixed(2)} MXN/USD</span>
            )}
            <span className="inline-flex items-center gap-1 text-xs text-green-700 font-semibold mt-0.5">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              Sincronizado
            </span>
          </div>
        </div>
      </div>

      {/* NÚMERO ESTELAR — tono informativo */}
      <div className="bg-white rounded-2xl shadow-sm p-8 mb-6 text-center">
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Total por cobrar</p>
        <p className="text-5xl font-bold text-gray-800 mb-2">
          {formatMXN(saldoActual)}
          <DeltaBadge delta={deltaSaldo} />
        </p>
        {deltaSaldo && fechaCortePrevStr && (
          <p className="text-[11px] text-gray-400 -mt-1 mb-1">
            vs corte {fechaCortePrevStr}
          </p>
        )}
        {saldoVencido > 0 ? (
          <p className="text-sm text-gray-600">
            de los cuales <strong className="text-orange-600">{formatMXN(saldoVencido)}</strong> están vencidos
            {dso != null && <span className="text-gray-400"> · DSO: {dso} días</span>}
          </p>
        ) : (
          <p className="text-sm text-green-700">
            <strong>Sin cartera vencida ✓</strong>
            {dso != null && <span className="text-gray-400 ml-2"> · DSO: {dso} días</span>}
          </p>
        )}
      </div>

      {/* KPI STRIP — 4 cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className={`bg-white rounded-2xl shadow-sm p-4 border-t-4 ${saldoVencido > 0 ? "border-orange-400" : "border-green-500"}`}>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Vencido</p>
          <p className={`text-2xl font-bold ${saldoVencido > 0 ? "text-orange-600" : "text-green-600"}`}>{formatMXN(saldoVencido)}</p>
          <p className="text-xs text-gray-400 mt-1">
            {saldoVencido > 0 && saldoActual > 0 ? `${Math.round((saldoVencido / saldoActual) * 100)}% del saldo` : "Sin vencidos"}
          </p>
          {deltaVencido && deltaVencido.d !== 0 && (
            <p className="text-[11px] mt-1"><DeltaBadge delta={deltaVencido} /></p>
          )}
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4 border-t-4 border-yellow-400">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">A vencer 7 días</p>
          <p className="text-2xl font-bold text-gray-800">{formatMXN(saldoAVencer)}</p>
          <p className="text-xs text-gray-400 mt-1">Próximos cobros</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4 border-t-4 border-purple-500">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Notas de crédito</p>
          <p className="text-2xl font-bold text-purple-700">{formatMXN(notasCredito)}</p>
          <p className="text-xs text-gray-400 mt-1">{notasCredito > 0 ? "A aplicar" : "Sin NC"}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4 border-t-4 border-blue-500">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">DSO real</p>
          {dso != null ? (
            <>
              <p className={`text-2xl font-bold ${dsoStatus.text}`}>
                {dso} <span className="text-xs font-normal text-gray-400">días</span>
              </p>
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${dsoStatus.dot}`}></span>
                {dsoStatus.label} (plazo {PLAZO}d)
              </p>
              {deltaDso && deltaDso.d !== 0 && (
                <p className="text-[11px] mt-1"><DeltaBadge delta={deltaDso} sufijo="d" /></p>
              )}
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-gray-300">—</p>
              <p className="text-xs text-gray-400 mt-1">Sin datos</p>
            </>
          )}
        </div>
      </div>

      {/* INDICADORES CLAVE — Ratio + DSO vs 90d */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Ratio Saldo / Sell In */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <CardHeader titulo="Saldo vs Sell In YTD" icon={BarChart3} />
          {ratioSaldoSellIn != null ? (
            <div className="mt-1">
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-gray-800">{ratioSaldoSellIn}%</p>
                <p className="text-xs text-gray-500">del Sell In {new Date().getFullYear()} sigue pendiente</p>
              </div>
              <div className="mt-3 text-xs text-gray-500 space-y-0.5">
                <div className="flex justify-between"><span>Sell In YTD:</span><strong className="text-gray-700">{formatMXN(sellIn)}</strong></div>
                <div className="flex justify-between"><span>Saldo actual:</span><strong className="text-gray-700">{formatMXN(saldoActual)}</strong></div>
              </div>
              <p className="text-xs text-gray-400 mt-2 italic">
                {ratioSaldoSellIn > 100
                  ? "Tienes más por cobrar que lo vendido este año (incluye saldo de meses previos)."
                  : ratioSaldoSellIn > 50
                  ? "Ritmo normal considerando 90 días de crédito."
                  : "Cobranza al día vs ritmo de venta."}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-400 mt-2">Sell In sin datos YTD.</p>
          )}
        </div>

        {/* DSO real vs plazo */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <CardHeader titulo="Días reales de cobro (DSO)" icono="⏱" />
          {dso != null ? (
            <div className="mt-1">
              <div className="flex items-baseline gap-2">
                <p className={`text-3xl font-bold ${dsoStatus.text}`}>{dso}d</p>
                <p className="text-xs text-gray-500">
                  vs plazo {PLAZO}d
                  {dsoDelta > 0 && <> · <span className="text-red-600 font-semibold">+{dsoDelta}d de atraso</span></>}
                  {dsoDelta < 0 && <> · <span className="text-green-700 font-semibold">{Math.abs(dsoDelta)}d anticipado</span></>}
                </p>
              </div>
              {/* Barra visual */}
              <div className="mt-3 relative h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="absolute top-0 left-0 h-full bg-green-400" style={{ width: `${Math.min((PLAZO / Math.max(dso, PLAZO)) * 100, 100)}%` }}></div>
                {dso > PLAZO && (
                  <div className="absolute top-0 h-full bg-red-400"
                       style={{ left: `${(PLAZO / dso) * 100}%`, width: `${((dso - PLAZO) / dso) * 100}%` }}></div>
                )}
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>0d</span>
                <span>Plazo {PLAZO}d</span>
                <span>{Math.max(dso, PLAZO)}d</span>
              </div>
              <p className="text-xs text-gray-400 mt-2 italic">
                {dsoStatus.label}. {dsoDelta > 0 ? "El cliente paga después del plazo acordado en promedio." : "Cobranza dentro de lo pactado."}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-400 mt-2">Sin datos de DSO.</p>
          )}
        </div>
      </div>

      {/* LÍNEA DE CRÉDITO — card propia, tamaño medio, con edición inline */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <CardHeader titulo="Línea de crédito" icono="💼" />
          <EditableLineaPlazo
            clienteKey={clienteKey}
            config={config}
            canEdit={canEdit}
            onSaved={cargarTodo}
          />
        </div>
        {lineaStatus ? (
          <div className="mt-2">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
              <div>
                <p className="text-2xl font-bold text-gray-800">
                  {formatUSD(lineaUSD)}
                  {tipoCambio > 0 && <span className="text-sm font-normal text-gray-400"> = {formatMXN(lineaMXN)}</span>}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  <span className={`inline-block w-2 h-2 rounded-full ${lineaStatus.dot} mr-1`}></span>
                  <strong className={lineaStatus.text}>{usoPct}% uso</strong> · {lineaStatus.label}
                  <span className="text-gray-400"> · Plazo {PLAZO}d</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Disponible</p>
                <p className="text-lg font-bold text-green-700">{formatMXN(Math.max(lineaMXN - saldoActual, 0))}</p>
              </div>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(usoPct, 100)}%`, backgroundColor: lineaStatus.color }}></div>
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>$0</span><span>70%</span><span>90%</span><span>{formatUSD(lineaUSD)}</span>
            </div>
          </div>
        ) : lineaUSD > 0 && tipoCambio === 0 ? (
          <p className="text-sm text-gray-400 mt-2 italic">
            Línea configurada ({formatUSD(lineaUSD)}) pero el corte actual no trae tipo de cambio — no se puede calcular el uso %.
          </p>
        ) : (
          <p className="text-sm text-gray-400 mt-2 italic">
            Línea de crédito no configurada. Click en el lápiz ✏️ arriba para capturarla.
          </p>
        )}
      </div>

      {/* CUÁNDO NOS PAGAN */}
      {(hasVencMes || saldoVencido > 0) && (
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
          <CardHeader titulo="Cuándo nos pagan" icon={CalendarDays} />
          <div className="space-y-3 mt-1">
            {saldoVencido > 0 && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-semibold text-orange-600">Vencido</span>
                  <span className="font-bold text-orange-600">{formatMXN(saldoVencido)}</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-orange-400" style={{ width: `${Math.round((saldoVencido / vencMax) * 100)}%` }}></div>
                </div>
              </div>
            )}
            {mesesVenc.map(v => (
              v.monto > 0 && (
                <div key={v.k}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-gray-700">{v.label}</span>
                    <span className="font-bold text-gray-800">{formatMXN(v.monto)}</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.round((v.monto / vencMax) * 100)}%` }}></div>
                  </div>
                </div>
              )
            ))}
          </div>
          {vencTotal > 0 && (
            <div className="mt-4 pt-3 border-t flex justify-between text-sm">
              <span className="text-gray-500">Total (vencido + próximos 3 meses)</span>
              <span className="font-bold text-gray-800">{formatMXN(vencTotal)}</span>
            </div>
          )}
        </div>
      )}

      {/* AGING — con menú desplegable de facturas y filtros */}
      {hasAging && (
        <AgingConFacturas
          aging={aging}
          agTotal={agTotal}
          agPct={agPct}
          facturas={vencidasList}
          diasAtraso={diasAtraso}
          diasPromAtraso={diasPromAtraso}
          facturaMasAtrasada={facturaMasAtrasada}
        />
      )}

      {/* FLUJO Facturación vs Cobranza 3m */}
      {hasFlujo && (
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
          <CardHeader titulo="Flujo: Facturación vs Cobranza (3 meses)" icono="🔄" />
          <p className="text-xs text-gray-400 mb-3">
            Compara lo que vas a facturarle al cliente (Cuota SI mín anual $25M con temporalidad) vs lo ya facturado real y los vencimientos por cobrar.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs text-gray-400 uppercase pb-2">Mes</th>
                  <th className="text-right text-xs text-gray-400 uppercase pb-2">A Facturar (Cuota $25M)</th>
                  <th className="text-right text-xs text-gray-400 uppercase pb-2">Facturado Real</th>
                  <th className="text-right text-xs text-gray-400 uppercase pb-2">A Cobrar (Venc)</th>
                  <th className="text-right text-xs text-gray-400 uppercase pb-2">Balance Neto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {flujo3m.map(f => {
                  const pctReal = f.facturar > 0 ? Math.round((f.facturadoReal / f.facturar) * 100) : 0;
                  return (
                    <tr key={f.k} className="text-sm">
                      <td className="py-3 font-semibold text-gray-700">
                        {f.label}
                        {f.esMesActual && <span className="ml-1 text-[10px] text-blue-500">(en curso)</span>}
                      </td>
                      <td className="py-3 text-right text-gray-700">{f.facturar > 0 ? formatMXN(f.facturar) : "—"}</td>
                      <td className="py-3 text-right">
                        {f.facturadoReal > 0 ? (
                          <div>
                            <span className="text-gray-800 font-semibold">{formatMXN(f.facturadoReal)}</span>
                            {f.facturar > 0 && (
                              <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${pctReal >= 100 ? "bg-green-100 text-green-700" : pctReal >= 70 ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"}`}>
                                {pctReal}%
                              </span>
                            )}
                          </div>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-3 text-right text-blue-700 font-semibold">{f.cobrar > 0 ? formatMXN(f.cobrar) : "—"}</td>
                      <td className={`py-3 text-right font-semibold ${f.balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {f.balance >= 0 ? "+" : ""}{formatMXN(f.balance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-3 italic">
            * "Facturado Real" viene de sell_in_sku del mes (lo que ya emitiste de factura). Balance positivo = cobranza supera facturación pendiente (libera línea).
          </p>
        </div>
      )}

      {/* PROYECCIÓN vs SELL OUT */}
      {hasVencMes && (
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
          <CardHeader titulo="¿El cliente generará flujo para pagarnos?" icon={TrendingUp} />
          <p className="text-xs text-gray-400 mb-3">
            Proyección mensual = <strong>max(Cuota Sell Out mín, Promedio real)</strong>
            {hasSellOut && (
              <> · Promedio {soValues.length} mes(es): <strong>{formatMXN(soPromedio)}</strong>
                {soValues.some(x => x.anualizado) && <> (mes en curso anualizado)</>}
              </>
            )}
          </p>
          <p className="text-xs text-gray-400 mb-3">
            <strong>Acumulado inicial</strong> = Sell Out histórico ({formatMXN(soHistorico)}) − Saldo vencido ({formatMXN(saldoVencido)}) = <strong className={acumInicial >= 0 ? "text-green-600" : "text-red-600"}>{formatMXN(acumInicial)}</strong> · Representa la capacidad de pago que el cliente trae del pasado.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs text-gray-400 uppercase pb-2">Mes</th>
                  <th className="text-right text-xs text-gray-400 uppercase pb-2">Cuota SO mín</th>
                  <th className="text-right text-xs text-gray-400 uppercase pb-2">Vencimiento</th>
                  <th className="text-right text-xs text-gray-400 uppercase pb-2">Sell Out proy.</th>
                  <th className="text-right text-xs text-gray-400 uppercase pb-2">Balance mes</th>
                  <th className="text-right text-xs text-gray-400 uppercase pb-2">Acumulado</th>
                  <th className="text-center text-xs text-gray-400 uppercase pb-2">Cobertura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {/* Fila inicial de acumulado histórico */}
                <tr className="text-sm bg-gray-50">
                  <td className="py-2 font-semibold text-gray-500 italic">Inicial (histórico)</td>
                  <td className="py-2"></td>
                  <td className="py-2"></td>
                  <td className="py-2"></td>
                  <td className="py-2"></td>
                  <td className={`py-2 text-right font-semibold ${acumInicial >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {acumInicial >= 0 ? "+" : ""}{formatMXN(acumInicial)}
                  </td>
                  <td className="py-2"></td>
                </tr>
                {proyeccion.map(({ label, monto, cobro, cuotaMin, balance, acumulado }) => {
                  const cobertura = monto > 0 ? Math.round((cobro / monto) * 100) : 0;
                  return (
                    <tr key={label} className="text-sm">
                      <td className="py-3 font-semibold text-gray-700">{label}</td>
                      <td className="py-3 text-right text-gray-500">{cuotaMin > 0 ? formatMXN(cuotaMin) : "—"}</td>
                      <td className="py-3 text-right text-gray-700">{formatMXN(monto)}</td>
                      <td className="py-3 text-right text-blue-700 font-semibold">{formatMXN(cobro)}</td>
                      <td className={`py-3 text-right font-semibold ${balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {balance >= 0 ? "+" : ""}{formatMXN(balance)}
                      </td>
                      <td className={`py-3 text-right font-bold ${acumulado >= 0 ? "text-green-700" : "text-red-700"}`}>
                        {acumulado >= 0 ? "+" : ""}{formatMXN(acumulado)}
                      </td>
                      <td className="py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cobertura >= 100 ? "bg-green-100 text-green-700" : cobertura >= 80 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                          {cobertura}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-3 italic">
            * Fórmula híbrida: asume que el cliente venderá al menos su cuota mensual mínima o su promedio real (lo que sea mayor). La columna "Acumulado" arrastra el superávit/déficit mes a mes — si el cliente generó más Sell Out que vencimientos en meses pasados, ese exceso cubre déficits futuros.
          </p>
        </div>
      )}

      {/* TENDENCIA HISTÓRICA — tabla simple hasta tener 3+ cortes */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
        <CardHeader titulo="Tendencia histórica" icono="📉" />
        {hasTendencia ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs text-gray-400 uppercase pb-2">Semana</th>
                  <th className="text-right text-xs text-gray-400 uppercase pb-2">Saldo</th>
                  <th className="text-right text-xs text-gray-400 uppercase pb-2">Vencido</th>
                  <th className="text-right text-xs text-gray-400 uppercase pb-2">DSO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tendenciaData.map((row, i) => (
                  <tr key={i}>
                    <td className="py-2 font-medium text-gray-700">S{row.etiqueta.replace('S','')}</td>
                    <td className="py-2 text-right text-gray-700">{formatMXN(row.Saldo)}</td>
                    <td className={`py-2 text-right ${row.Vencido > 0 ? "text-orange-600" : "text-gray-700"}`}>{formatMXN(row.Vencido)}</td>
                    <td className="py-2 text-right text-purple-700">{row.DSO != null ? `${row.DSO}d` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-gray-400 mt-3 italic">
              Gráfica disponible cuando tengas más de {Math.max(0, 4 - historico.length)} cortes adicionales.
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-400 mt-2 italic">
            Se necesitan al menos 3 cortes para mostrar la tendencia. Hoy hay {historico.length} corte{historico.length !== 1 ? "s" : ""} cargado{historico.length !== 1 ? "s" : ""}. La vista cobra sentido después de 4-6 semanas de cargas semanales.
          </p>
        )}
      </div>

    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AgingConFacturas — tarjeta de aging con menú desplegable de facturas
// y filtros. Muestra días promedio ponderado y factura más atrasada.
// ═══════════════════════════════════════════════════════════════════════════
function AgingConFacturas({ aging, agTotal, agPct, facturas, diasAtraso, diasPromAtraso, facturaMasAtrasada }) {
  const [abierto, setAbierto] = useState(false);
  const [filtroBucket, setFiltroBucket] = useState("todas");
  const [busqueda, setBusqueda] = useState("");
  const [sortBy, setSortBy] = useState("dias_desc");

  const buckets = [
    { key: "d0_30",   label: "1 – 30 días",   monto: aging.d0_30,    bg: "bg-green-500",  tag: "bg-green-100 text-green-700",  min: 1,   max: 30  },
    { key: "d31_60",  label: "31 – 60 días",  monto: aging.d31_60,   bg: "bg-blue-400",   tag: "bg-blue-100 text-blue-700",    min: 31,  max: 60  },
    { key: "d61_90",  label: "61 – 90 días",  monto: aging.d61_90,   bg: "bg-yellow-400", tag: "bg-yellow-100 text-yellow-700", min: 61,  max: 90  },
    { key: "d91_180", label: "91 – 180 días", monto: aging.d91_180,  bg: "bg-orange-500", tag: "bg-orange-100 text-orange-700", min: 91,  max: 180 },
    { key: "mas180",  label: "+ 180 días",    monto: aging.mas180,   bg: "bg-red-500",    tag: "bg-red-100 text-red-700",       min: 181, max: 99999 },
  ];

  const facturasFiltradas = useMemo(() => {
    let list = [...facturas];
    if (filtroBucket !== "todas") {
      const b = buckets.find(x => x.key === filtroBucket);
      if (b) list = list.filter(f => { const d = diasAtraso(f); return d >= b.min && d <= b.max; });
    }
    if (busqueda.trim()) {
      const t = busqueda.trim().toLowerCase();
      list = list.filter(f =>
        (f.movimiento || "").toLowerCase().includes(t) ||
        (f.referencia || "").toLowerCase().includes(t)
      );
    }
    const sorters = {
      dias_desc:   (a, b) => diasAtraso(b) - diasAtraso(a),
      dias_asc:    (a, b) => diasAtraso(a) - diasAtraso(b),
      monto_desc:  (a, b) => (Number(b.saldo_actual) || 0) - (Number(a.saldo_actual) || 0),
      monto_asc:   (a, b) => (Number(a.saldo_actual) || 0) - (Number(b.saldo_actual) || 0),
      fecha_asc:   (a, b) => (a.fecha_emision || "").localeCompare(b.fecha_emision || ""),
    };
    list.sort(sorters[sortBy] || sorters.dias_desc);
    return list;
  }, [facturas, filtroBucket, busqueda, sortBy, diasAtraso]);

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
      <CardHeader titulo="Aging de la cartera vencida" icono="⏳" />

      {/* Resumen de métricas de atraso */}
      <div className="grid grid-cols-2 gap-3 mt-2 mb-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-[11px] text-gray-500 uppercase tracking-wide">Atraso promedio</p>
          <p className="text-lg font-bold text-gray-800">{diasPromAtraso}<span className="text-xs font-normal text-gray-400"> días</span></p>
          <p className="text-[10px] text-gray-400">promedio ponderado por saldo</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-[11px] text-gray-500 uppercase tracking-wide">Factura más atrasada</p>
          {facturaMasAtrasada ? (
            <>
              <p className="text-lg font-bold text-red-700">{facturaMasAtrasada.dias}<span className="text-xs font-normal text-gray-400"> días</span></p>
              <p className="text-[10px] text-gray-500 truncate" title={facturaMasAtrasada.factura.movimiento}>
                {facturaMasAtrasada.factura.movimiento || "—"} · {formatMXN(Number(facturaMasAtrasada.factura.saldo_actual) || 0)}
              </p>
            </>
          ) : (
            <p className="text-lg font-bold text-gray-300">—</p>
          )}
        </div>
      </div>

      {/* Barras por bucket */}
      <div className="space-y-3 mt-1">
        {buckets.filter(b => b.monto > 0).map(({ key, label, monto, bg, tag }) => (
          <div key={key}>
            <div className="flex justify-between items-center text-sm mb-1">
              <span className="text-gray-700 font-medium">{label}</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-800">{formatMXN(monto)}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${tag}`}>{agPct(monto)}%</span>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${bg}`} style={{ width: `${agPct(monto)}%` }}></div>
            </div>
          </div>
        ))}
        <div className="border-t pt-3 flex justify-between text-sm">
          <span className="text-gray-500">Total vencido</span>
          <span className="font-bold text-gray-800">{formatMXN(agTotal)}</span>
        </div>
      </div>

      {/* Desplegable de facturas */}
      <button
        onClick={() => setAbierto(!abierto)}
        className="mt-4 w-full flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm font-semibold text-gray-700 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="text-base">{abierto ? "▾" : "▸"}</span>
          Ver facturas vencidas ({facturas.length})
        </span>
        <span className="text-xs text-gray-500">{formatMXN(facturas.reduce((s, f) => s + (Number(f.saldo_actual) || 0), 0))}</span>
      </button>

      {abierto && (
        <div className="mt-3 border-t border-gray-100 pt-3 space-y-3">
          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2">
            <select value={filtroBucket} onChange={e => setFiltroBucket(e.target.value)}
                    className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs">
              <option value="todas">Todos los buckets</option>
              {buckets.filter(b => b.monto > 0).map(b => (
                <option key={b.key} value={b.key}>{b.label}</option>
              ))}
            </select>
            <input type="text" placeholder="Buscar folio o referencia…"
                   value={busqueda} onChange={e => setBusqueda(e.target.value)}
                   className="flex-1 min-w-40 px-2 py-1.5 border border-gray-200 rounded-lg text-xs" />
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                    className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs">
              <option value="dias_desc">Más atrasadas primero</option>
              <option value="dias_asc">Menos atrasadas primero</option>
              <option value="monto_desc">Mayor monto</option>
              <option value="monto_asc">Menor monto</option>
              <option value="fecha_asc">Fecha emisión ↑</option>
            </select>
            {(filtroBucket !== "todas" || busqueda) && (
              <button onClick={() => { setFiltroBucket("todas"); setBusqueda(""); }}
                      className="text-xs text-blue-600 hover:underline">Limpiar filtros</button>
            )}
          </div>

          {/* Tabla */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  <th className="text-left py-2 pr-3 font-semibold">Movimiento</th>
                  <th className="text-left py-2 pr-3 font-semibold">Referencia</th>
                  <th className="text-left py-2 pr-3 font-semibold">F. Emisión</th>
                  <th className="text-left py-2 pr-3 font-semibold">Vencimiento</th>
                  <th className="text-right py-2 pr-3 font-semibold">Días atraso</th>
                  <th className="text-right py-2 pr-3 font-semibold">Importe</th>
                  <th className="text-right py-2 font-semibold">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {facturasFiltradas.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-6 text-gray-400 italic">
                    No hay facturas con los filtros actuales
                  </td></tr>
                ) : facturasFiltradas.map(f => {
                  const d = diasAtraso(f);
                  const colorDias = d > 120 ? "text-red-700 font-bold"
                                  : d > 90  ? "text-orange-600 font-semibold"
                                  : d > 30  ? "text-yellow-700"
                                  : "text-gray-700";
                  return (
                    <tr key={f.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="py-2 pr-3 text-gray-800 font-medium">{f.movimiento || "—"}</td>
                      <td className="py-2 pr-3 text-gray-500 font-mono text-[10px]">{f.referencia || "—"}</td>
                      <td className="py-2 pr-3 text-gray-500 whitespace-nowrap">{f.fecha_emision ? formatFecha(f.fecha_emision) : "—"}</td>
                      <td className="py-2 pr-3 text-gray-500 whitespace-nowrap">{f.vencimiento ? formatFecha(f.vencimiento) : "—"}</td>
                      <td className={`py-2 pr-3 text-right ${colorDias}`}>{d}d</td>
                      <td className="py-2 pr-3 text-right text-gray-600">{formatMXN(Number(f.importe_factura) || 0)}</td>
                      <td className="py-2 text-right text-gray-800 font-semibold">{formatMXN(Number(f.saldo_actual) || 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
              {facturasFiltradas.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td colSpan={6} className="py-2 pr-3 text-right font-semibold text-gray-700">Total mostrado</td>
                    <td className="py-2 text-right font-bold text-gray-800">
                      {formatMXN(facturasFiltradas.reduce((s, f) => s + (Number(f.saldo_actual) || 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EditableLineaPlazo — edición inline de línea de crédito (USD) + plazo (días)
// ═══════════════════════════════════════════════════════════════════════════
function EditableLineaPlazo({ clienteKey, config, canEdit, onSaved }) {
  const [abierto, setAbierto] = useState(false);
  const [lineaUSD, setLineaUSD] = useState(config?.linea_credito_usd ?? "");
  const [plazo, setPlazo]       = useState(config?.plazo_dias_credito ?? 90);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (abierto) {
      setLineaUSD(config?.linea_credito_usd ?? "");
      setPlazo(config?.plazo_dias_credito ?? 90);
    }
  }, [abierto, config]);

  if (!canEdit) return null;

  const guardar = async () => {
    setGuardando(true);
    const payload = {
      cliente: clienteKey,
      linea_credito_usd: lineaUSD === "" ? null : Number(lineaUSD),
      plazo_dias_credito: Number(plazo) || 90,
    };
    const { error } = await supabase.from("clientes_credito_config").upsert(payload, { onConflict: "cliente" });
    setGuardando(false);
    if (error) { alert("Error al guardar: " + error.message); return; }
    setAbierto(false);
    if (onSaved) await onSaved();
  };

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
              title="Editar línea y plazo">
        <Pencil className="w-3.5 h-3.5" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-gray-500 uppercase font-semibold">Línea USD</span>
        <input type="number" value={lineaUSD}
               onChange={e => setLineaUSD(e.target.value)}
               placeholder="500000"
               className="w-24 px-2 py-0.5 border border-gray-300 rounded text-xs" />
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-gray-500 uppercase font-semibold">Plazo</span>
        <input type="number" value={plazo}
               onChange={e => setPlazo(e.target.value)}
               className="w-14 px-2 py-0.5 border border-gray-300 rounded text-xs" />
        <span className="text-[10px] text-gray-500">días</span>
      </div>
      <button onClick={guardar} disabled={guardando}
              className="p-1 rounded bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white"
              title="Guardar">
        <Check className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => setAbierto(false)}
              className="p-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-700"
              title="Cancelar">
        <XIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
