import React, { useState, useEffect, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase, DB_CONFIGURED } from '../../lib/supabase';
import { formatMXN, formatUSD, formatFecha } from '../../lib/utils';
import { CardHeader } from '../../components';

const NOMBRES_MES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

export default function CreditoCobranza({ cliente, clienteKey }) {
  const c = cliente;
  const [estado, setEstado]       = useState(null);
  const [historico, setHistorico] = useState([]);
  const [sellIn, setSellIn]       = useState(0);
  const [sellOut, setSellOut]     = useState({});
  const [cuotas, setCuotas]       = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!DB_CONFIGURED) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const anio = new Date().getFullYear();
      const [ecRes, histRes, siRes, soRes, qRes] = await Promise.all([
        supabase.from("estados_cuenta").select("*").eq("cliente", clienteKey)
          .order("anio", { ascending: false }).order("semana", { ascending: false }).limit(1),
        supabase.from("estados_cuenta").select("anio, semana, fecha_corte, saldo_actual, saldo_vencido, dso")
          .eq("cliente", clienteKey).order("anio", { ascending: true }).order("semana", { ascending: true }).limit(20),
        supabase.from("sell_in_sku").select("monto_pesos").eq("cliente", clienteKey).eq("anio", anio),
        supabase.from("sellout_sku").select("mes, monto_pesos").eq("cliente", clienteKey).eq("anio", anio),
        supabase.from("cuotas_mensuales").select("mes, cuota_min").eq("cliente", clienteKey).eq("anio", anio).order("mes"),
      ]);
      setEstado((ecRes.data && ecRes.data[0]) || null);
      setHistorico(histRes.data || []);
      setSellIn((siRes.data || []).reduce((s, r) => s + (Number(r.monto_pesos) || 0), 0));
      const byMes = {};
      (soRes.data || []).forEach(r => {
        const m = Number(r.mes); byMes[m] = (byMes[m] || 0) + (Number(r.monto_pesos) || 0);
      });
      setSellOut(byMes);
      setCuotas(qRes.data || []);
      setLoading(false);
    })();
  }, [clienteKey]);

  // Hooks antes de cualquier return
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

  // Estados tempranos
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

  // Derivados
  const saldoActual    = Number(estado.saldo_actual) || 0;
  const saldoVencido   = Number(estado.saldo_vencido) || 0;
  const saldoAVencer   = Number(estado.saldo_a_vencer) || 0;
  const notasCredito   = Math.abs(Number(estado.notas_credito) || 0);
  const lineaUSD       = Number(estado.linea_credito_usd) || 0;
  const tipoCambio     = Number(estado.tipo_cambio) || 0;
  const dso            = estado.dso != null ? Number(estado.dso) : null;
  const lineaMXN       = lineaUSD * tipoCambio;
  const usoPct         = lineaMXN > 0 ? Math.min(Math.round((saldoActual / lineaMXN) * 100), 999) : null;

  const aging = {
    d0_30:  Number(estado.aging_d0_30)  || 0,
    d31_60: Number(estado.aging_d31_60) || 0,
    d61_90: Number(estado.aging_d61_90) || 0,
    mas90:  Number(estado.aging_mas90)  || 0,
  };
  const agTotal  = aging.d0_30 + aging.d31_60 + aging.d61_90 + aging.mas90;
  const hasAging = agTotal > 0;
  const agPct    = v => agTotal > 0 ? Math.round((v / agTotal) * 100) : 0;

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

  // DSO real vs plazo 90 días
  const PLAZO = 90;
  const dsoDelta  = dso != null ? dso - PLAZO : null;
  const dsoStatus = dso == null ? null
    : dso <= PLAZO        ? { label: "Dentro del plazo", text: "text-green-700",  dot: "bg-green-500" }
    : dso <= PLAZO + 15   ? { label: "Ligeramente alto", text: "text-yellow-700", dot: "bg-yellow-500" }
    :                       { label: "Pago rezagado",    text: "text-red-700",    dot: "bg-red-500" };

  // Proyección Sell Out (tendencia + cuotas)
  const soValues   = Object.entries(sellOut).map(([m, v]) => ({ mes: Number(m), v })).sort((a, b) => a.mes - b.mes);
  const hasSellOut = soValues.length >= 2;
  const ultimos    = soValues.slice(-2);
  const tasaCrec   = hasSellOut && ultimos[0].v > 0 ? ultimos[1].v / ultimos[0].v : 1;
  const soBase     = hasSellOut ? ultimos[ultimos.length - 1].v : 0;

  // Flujo Facturación (cuota SI) vs Cobranza (venc_mes) próximos 3 meses
  const flujo3m = mesesVenc.map(v => {
    const cuotaMes = cuotas.find(q => Number(q.mes) === v.mes);
    const facturar = cuotaMes ? Number(cuotaMes.cuota_min) || 0 : 0;
    return {
      ...v,
      facturar,
      cobrar: v.monto,
      balance: v.monto - facturar,
    };
  });
  const hasFlujo = flujo3m.some(f => f.facturar > 0 || f.cobrar > 0);

  // Proyección combinada: tendencia Sell Out vs vencimiento
  const proyeccion = mesesVenc.map((v, i) => ({
    ...v,
    cobro: hasSellOut ? soBase * Math.pow(tasaCrec, i + 1) : 0,
  }));

  // Tendencia histórica (mientras solo haya 1-2 cortes, se muestra placeholder)
  const hasTendencia = historico.length >= 3;
  const tendenciaData = historico.map(h => ({
    etiqueta: `S${h.semana}`,
    Saldo:    Number(h.saldo_actual) || 0,
    Vencido:  Number(h.saldo_vencido) || 0,
    DSO:      h.dso != null ? Number(h.dso) : null,
  }));

  const fechaCorteStr = estado.fecha_corte ? formatFecha(estado.fecha_corte) : `Sem ${estado.semana}/${estado.anio}`;

  return (
    <div className="min-h-screen bg-gray-50 p-6">

      {/* HEADER */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                 style={{ backgroundColor: c.color }}>💳</div>
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
        <p className="text-5xl font-bold text-gray-800 mb-2">{formatMXN(saldoActual)}</p>
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
              <p className={`text-2xl font-bold ${dsoStatus.text}`}>{dso} <span className="text-xs font-normal text-gray-400">días</span></p>
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${dsoStatus.dot}`}></span>
                {dsoStatus.label} (plazo {PLAZO}d)
              </p>
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
          <CardHeader titulo="Saldo vs Sell In YTD" icono="📊" />
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

      {/* LÍNEA DE CRÉDITO — card propia, tamaño medio */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
        <CardHeader titulo="Línea de crédito" icono="💼" />
        {lineaStatus ? (
          <div className="mt-2">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
              <div>
                <p className="text-2xl font-bold text-gray-800">
                  {formatUSD(lineaUSD)} <span className="text-sm font-normal text-gray-400">= {formatMXN(lineaMXN)}</span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  <span className={`inline-block w-2 h-2 rounded-full ${lineaStatus.dot} mr-1`}></span>
                  <strong className={lineaStatus.text}>{usoPct}% uso</strong> · {lineaStatus.label}
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
        ) : (
          <p className="text-sm text-gray-400 mt-2 italic">
            Línea de crédito sin datos. Captura <strong>línea_credito_usd</strong> y <strong>tipo_cambio</strong> al subir el próximo corte.
          </p>
        )}
      </div>

      {/* CUÁNDO NOS PAGAN */}
      {(hasVencMes || saldoVencido > 0) && (
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
          <CardHeader titulo="Cuándo nos pagan" icono="📅" />
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

      {/* AGING */}
      {hasAging && (
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
          <CardHeader titulo="Aging de la cartera vencida" icono="⏳" />
          <div className="space-y-3 mt-1">
            {[
              { label: "1 – 30 días",  monto: aging.d0_30,  bg: "bg-green-500",  tag: "bg-green-100 text-green-700",  icono: "✓"  },
              { label: "31 – 60 días", monto: aging.d31_60, bg: "bg-blue-400",   tag: "bg-blue-100 text-blue-700",    icono: "🔵" },
              { label: "61 – 90 días", monto: aging.d61_90, bg: "bg-yellow-400", tag: "bg-yellow-100 text-yellow-700", icono: "⚠️" },
              { label: "+ 90 días",    monto: aging.mas90,  bg: "bg-red-500",    tag: "bg-red-100 text-red-700",       icono: "🔴" },
            ].map(({ label, monto, bg, tag, icono }) => (
              <div key={label}>
                <div className="flex justify-between items-center text-sm mb-1">
                  <div className="flex items-center gap-1.5">
                    <span>{icono}</span>
                    <span className="text-gray-700 font-medium">{label}</span>
                  </div>
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
        </div>
      )}

      {/* FLUJO Facturación vs Cobranza 3m */}
      {hasFlujo && (
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
          <CardHeader titulo="Flujo: Facturación vs Cobranza (3 meses)" icono="🔄" />
          <p className="text-xs text-gray-400 mb-3">
            Comparación de lo que vas a facturarle al cliente (Cuota SI mín) contra lo que ya está programado a cobrar (vencimientos).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs text-gray-400 uppercase pb-2">Mes</th>
                  <th className="text-right text-xs text-gray-400 uppercase pb-2">A Facturar (Cuota SI)</th>
                  <th className="text-right text-xs text-gray-400 uppercase pb-2">A Cobrar (Venc)</th>
                  <th className="text-right text-xs text-gray-400 uppercase pb-2">Balance Neto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {flujo3m.map(f => (
                  <tr key={f.k} className="text-sm">
                    <td className="py-3 font-semibold text-gray-700">{f.label}</td>
                    <td className="py-3 text-right text-gray-700">{f.facturar > 0 ? formatMXN(f.facturar) : "—"}</td>
                    <td className="py-3 text-right text-blue-700 font-semibold">{f.cobrar > 0 ? formatMXN(f.cobrar) : "—"}</td>
                    <td className={`py-3 text-right font-semibold ${f.balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {f.balance >= 0 ? "+" : ""}{formatMXN(f.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-3 italic">
            * Balance positivo = cobranza superior a facturación (libera línea). Balance negativo = más pedidos que cobros (consume línea).
          </p>
        </div>
      )}

      {/* PROYECCIÓN vs SELL OUT */}
      {hasSellOut && hasVencMes && (
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
          <CardHeader titulo="¿El cliente generará flujo para pagarnos?" icono="📈" />
          <p className="text-xs text-gray-400 mb-3">
            Sell Out base (último mes con dato): <strong>{formatMXN(soBase)}</strong> · Crecimiento mensual proyectado: <strong>{((tasaCrec - 1) * 100).toFixed(1)}%</strong>
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs text-gray-400 uppercase pb-2">Mes</th>
                  <th className="text-right text-xs text-gray-400 uppercase pb-2">Vencimiento</th>
                  <th className="text-right text-xs text-gray-400 uppercase pb-2">Sell Out proy.</th>
                  <th className="text-right text-xs text-gray-400 uppercase pb-2">Balance</th>
                  <th className="text-center text-xs text-gray-400 uppercase pb-2">Cobertura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {proyeccion.map(({ label, monto, cobro }) => {
                  const balance = cobro - monto;
                  const cobertura = monto > 0 ? Math.round((cobro / monto) * 100) : 0;
                  return (
                    <tr key={label} className="text-sm">
                      <td className="py-3 font-semibold text-gray-700">{label}</td>
                      <td className="py-3 text-right text-gray-700">{formatMXN(monto)}</td>
                      <td className="py-3 text-right text-blue-700 font-semibold">{formatMXN(cobro)}</td>
                      <td className={`py-3 text-right font-semibold ${balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {balance >= 0 ? "+" : ""}{formatMXN(balance)}
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
            * Proyección lineal con base en el crecimiento entre los últimos 2 meses con dato.
          </p>
        </div>
      )}

      {/* TENDENCIA HISTÓRICA */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
        <CardHeader titulo="Tendencia histórica" icono="📉" />
        {hasTendencia ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={tendenciaData} margin={{ top: 10, right: 10, bottom: 5, left: 10 }}>
              <CartesianGrid stroke="#f3f4f6" />
              <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tickFormatter={v => `$${(v/1e6).toFixed(1)}M`} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v, n) => n === "DSO" ? `${v} días` : formatMXN(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line yAxisId="left" type="monotone" dataKey="Saldo"   stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="left" type="monotone" dataKey="Vencido" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="right" type="monotone" dataKey="DSO"    stroke="#8b5cf6" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-gray-400 mt-2 italic">
            Se necesitan al menos 3 cortes para mostrar la tendencia. Hoy hay {historico.length} corte{historico.length !== 1 ? "s" : ""} cargado{historico.length !== 1 ? "s" : ""}. La gráfica cobra sentido después de 4-6 semanas de cargas.
          </p>
        )}
      </div>

    </div>
  );
}
