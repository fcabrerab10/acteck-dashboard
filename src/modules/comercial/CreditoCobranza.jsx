import React, { useState, useEffect, useMemo } from "react";
import { supabase, DB_CONFIGURED } from '../../lib/supabase';
import { formatMXN, formatUSD, formatFecha } from '../../lib/utils';
import { CardHeader } from '../../components';

const NOMBRES_MES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

export default function CreditoCobranza({ cliente, clienteKey }) {
  const c = cliente;
  const [estado, setEstado]     = useState(null);
  const [sellOut, setSellOut]   = useState({});
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!DB_CONFIGURED) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const anio = new Date().getFullYear();
      const [ecRes, soRes] = await Promise.all([
        supabase.from("estados_cuenta")
          .select("*")
          .eq("cliente", clienteKey)
          .order("anio", { ascending: false })
          .order("semana", { ascending: false })
          .limit(1),
        supabase.from("sellout_sku")
          .select("mes, monto_pesos")
          .eq("cliente", clienteKey)
          .eq("anio", anio),
      ]);
      const byMes = {};
      (soRes.data || []).forEach(r => {
        const m = Number(r.mes);
        byMes[m] = (byMes[m] || 0) + (Number(r.monto_pesos) || 0);
      });
      setSellOut(byMes);
      setEstado((ecRes.data && ecRes.data[0]) || null);
      setLoading(false);
    })();
  }, [clienteKey]);

  // Vencimientos por mes (hooks antes del primer return)
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

  // Estados: sin DB / cargando / sin datos
  if (!DB_CONFIGURED) {
    return <div className="p-6 text-gray-400 text-sm">Supabase no configurado.</div>;
  }
  if (loading) {
    return <div className="p-6 text-gray-400 text-sm">Cargando estado de cuenta…</div>;
  }
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
  const saldoActual     = Number(estado.saldo_actual) || 0;
  const saldoVencido    = Number(estado.saldo_vencido) || 0;
  const saldoAVencer    = Number(estado.saldo_a_vencer) || 0;
  const notasCredito    = Math.abs(Number(estado.notas_credito) || 0);
  const lineaUSD        = Number(estado.linea_credito_usd) || 0;
  const tipoCambio      = Number(estado.tipo_cambio) || 0;
  const dso             = estado.dso != null ? Number(estado.dso) : null;
  const lineaMXN        = lineaUSD * tipoCambio;
  const usoPct          = lineaMXN > 0 ? Math.min(Math.round((saldoActual / lineaMXN) * 100), 999) : null;

  const aging = {
    d0_30:  Number(estado.aging_d0_30)  || 0,
    d31_60: Number(estado.aging_d31_60) || 0,
    d61_90: Number(estado.aging_d61_90) || 0,
    mas90:  Number(estado.aging_mas90)  || 0,
  };
  const agTotal  = aging.d0_30 + aging.d31_60 + aging.d61_90 + aging.mas90;
  const hasAging = agTotal > 0;
  const agPct    = (v) => agTotal > 0 ? Math.round((v / agTotal) * 100) : 0;

  const lineaStatus = usoPct == null ? null
    : usoPct >= 90 ? { label: "Crítico",   color: "#ef4444", text: "text-red-700",    emoji: "🔴" }
    : usoPct >= 70 ? { label: "Atención",  color: "#eab308", text: "text-yellow-700", emoji: "🟡" }
    :                { label: "Saludable", color: "#22c55e", text: "text-green-700",  emoji: "🟢" };

  const hasVencMes = mesesVenc.some(v => v.monto > 0);
  const vencTotal  = mesesVenc.reduce((s, v) => s + v.monto, 0) + saldoVencido;
  const vencMax    = Math.max(saldoVencido, ...mesesVenc.map(v => v.monto), 1);

  // Proyección
  const soValues   = Object.entries(sellOut).map(([m, v]) => ({ mes: Number(m), v })).sort((a, b) => a.mes - b.mes);
  const hasSellOut = soValues.length >= 2;
  const ultimos    = soValues.slice(-2);
  const tasaCrec   = hasSellOut && ultimos[0].v > 0 ? ultimos[1].v / ultimos[0].v : 1;
  const soBase     = hasSellOut ? ultimos[ultimos.length - 1].v : 0;
  const proyeccion = mesesVenc.map((v, i) => ({
    ...v,
    cobro: hasSellOut ? soBase * Math.pow(tasaCrec, i + 1) : 0,
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
                {" · "}Corte: {fechaCorteStr}
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

      {/* NÚMERO ESTELAR */}
      <div className="bg-white rounded-2xl shadow-sm p-8 mb-6 text-center">
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Total por cobrar</p>
        <p className="text-5xl font-bold text-gray-800 mb-2">{formatMXN(saldoActual)}</p>
        {saldoVencido > 0 ? (
          <p className="text-sm text-gray-600">
            de los cuales <strong className="text-red-600">{formatMXN(saldoVencido)}</strong> están
            <span className="ml-1 text-red-600 font-semibold">VENCIDOS 🔴</span>
            {dso != null && <span className="text-gray-400"> · DSO: {dso} días</span>}
          </p>
        ) : (
          <p className="text-sm text-green-700">
            <strong>Sin cartera vencida ✓</strong>
            {dso != null && <span className="text-gray-400 ml-2"> · DSO: {dso} días</span>}
          </p>
        )}
      </div>

      {/* KPI STRIP */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className={`bg-white rounded-2xl shadow-sm p-4 border-t-4 ${saldoVencido > 0 ? "border-red-500" : "border-green-500"}`}>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Vencido</p>
          <p className={`text-2xl font-bold ${saldoVencido > 0 ? "text-red-600" : "text-green-600"}`}>{formatMXN(saldoVencido)}</p>
          <p className="text-xs text-gray-400 mt-1">
            {saldoVencido > 0 && saldoActual > 0 ? `${Math.round((saldoVencido / saldoActual) * 100)}% del saldo total` : "Sin vencidos"}
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
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Línea de crédito</p>
          {lineaStatus ? (
            <>
              <p className={`text-2xl font-bold ${lineaStatus.text}`}>{usoPct}% <span className="text-xs font-normal text-gray-400">uso</span></p>
              <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.min(usoPct, 100)}%`, backgroundColor: lineaStatus.color }}></div>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {lineaStatus.emoji} {lineaStatus.label} · {formatUSD(lineaUSD)}
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

      {/* CUÁNDO NOS PAGAN */}
      {(hasVencMes || saldoVencido > 0) && (
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
          <CardHeader titulo="Cuándo nos pagan" icono="📅" />
          <div className="space-y-3 mt-1">
            {saldoVencido > 0 && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-semibold text-red-600">⚠️ Vencido (cobrar YA)</span>
                  <span className="font-bold text-red-600">{formatMXN(saldoVencido)}</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-red-500" style={{ width: `${Math.round((saldoVencido / vencMax) * 100)}%` }}></div>
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
            {!hasVencMes && (
              <p className="text-xs text-gray-400 italic">
                Vencimientos por mes sin datos. Súbelos desde el uploader cuando estén disponibles.
              </p>
            )}
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
          <CardHeader titulo="Aging de la cartera" icono="⏳" />
          <div className="space-y-3 mt-1">
            {[
              { label: "0 – 30 días",  monto: aging.d0_30,  bg: "bg-green-500",  tag: "bg-green-100 text-green-700",  icono: "✓"  },
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
              <span className="text-gray-500">Total cartera con aging</span>
              <span className="font-bold text-gray-800">{formatMXN(agTotal)}</span>
            </div>
          </div>
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
            * Proyección lineal con base en el crecimiento entre los últimos 2 meses con dato. No considera estacionalidad ni acuerdos comerciales específicos.
          </p>
        </div>
      )}

    </div>
  );
}
