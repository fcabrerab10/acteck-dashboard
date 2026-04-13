import React, { useState, useEffect } from "react";
import { DIGITALIFE_REAL } from '../../lib/constants';
import { formatMXN, formatUSD, formatFecha } from '../../lib/utils';
import { CardHeader } from '../../components';

export default function CreditoCobranza({ cliente }) {
  const c = cliente;
  const k = c.cartera;
  if (!k) return (
    <div className="p-6 text-gray-400 text-sm">Sin datos de crédito y cobranza disponibles.</div>
  );

  const lineaMXN = k.lineaCreditoUSD * k.tipoCambio;
  const usoPct = Math.round((k.saldoActual / lineaMXN) * 100);
  const disponibleMXN = lineaMXN - k.saldoActual;
  const disponibleUSD = disponibleMXN / k.tipoCambio;

  // Semáforo línea de crédito
  const lineaColor = usoPct >= 90 ? { bar: "#ef4444", bg: "bg-red-50", border: "border-red-200", text: "text-red-700", label: "Crítico — Línea casi agotada" }
                   : usoPct >= 70 ? { bar: "#eab308", bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700", label: "Atención — Uso elevado" }
                   :                { bar: "#22c55e", bg: "bg-green-50",  border: "border-green-200",  text: "text-green-700",  label: "Saludable — Línea disponible" };

  // Aging total y porcentajes
  const ag = k.aging;
  const agTotal = ag.d0_30 + ag.d31_60 + ag.d61_90 + ag.mas90;
  const agPct = (v) => Math.round((v / agTotal) * 100);

  // Vencimientos por mes
  const mesesLabel = { "2026-04": "Abril", "2026-05": "Mayo", "2026-06": "Junio" };
  const vmEntries = Object.entries(k.vencimientosMes);
  const vmMax = Math.max(...vmEntries.map(([,v]) => v));

  // Proyección basada en tendencia de crecimiento real 2026
  const soValues = Object.values(DIGITALIFE_REAL.sellOut);
  const soUltimo = soValues[soValues.length - 1];           // Mar 2026: último mes con dato
  const soAnterior = soValues[soValues.length - 2];         // Feb 2026: mes previo
  const tasaCrecMensual = soUltimo / soAnterior;            // Tasa real mensual 2026
  const soPromedio = soValues.reduce((a, b) => a + b, 0) / soValues.length; // referencia
  const proyMeses = [
    { mes: "Abril",  monto: k.vencimientosMes["2026-04"], cobro: soUltimo * tasaCrecMensual },
    { mes: "Mayo",   monto: k.vencimientosMes["2026-05"], cobro: soUltimo * Math.pow(tasaCrecMensual, 2) },
    { mes: "Junio",  monto: k.vencimientosMes["2026-06"], cobro: soUltimo * Math.pow(tasaCrecMensual, 3) },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">

      {/* ── ENCABEZADO ── */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                 style={{ backgroundColor: c.color }}>💳</div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{c.nombre} — Crédito y Cobranza</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                <span className="font-medium" style={{ color: c.color }}>{c.marca}</span>
                {" · "}Semana {k.semana} · {k.periodo}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-gray-400 block">
              Actualizado: {formatFecha(k.ultimaActualizacion)}{k.horaActualizacion ? ` · ${k.horaActualizacion} hrs` : ""}
            </span>
            <span className="text-xs text-gray-400">TC: ${k.tipoCambio.toFixed(2)} MXN/USD</span>
          </div>
        </div>
      </div>

      {/* ── ALERTA VENCIDO ── */}
      {k.saldoVencido > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <span className="text-red-500 text-xl">â ️</span>
          <div>
            <p className="text-sm font-semibold text-red-700">Saldo Vencido — Gestión inmediata requerida</p>
            <p className="text-xs text-red-600 mt-0.5">
              <strong>{formatMXN(k.saldoVencido)}</strong> en cartera vencida
              ({" "}{formatMXN(ag.d61_90)} entre 61-90 días y{" "}
              {formatMXN(ag.mas90)} con más de 90 días).
            </p>
          </div>
        </div>
      )}

      {/* ── SEMÁFORO LÍNEA DE CRÉDITO ── */}
      <div className={`${lineaColor.bg} border ${lineaColor.border} rounded-2xl p-5 mb-6`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Línea de Crédito</p>
            <p className="text-xl font-bold text-gray-800">
              {formatUSD(k.lineaCreditoUSD)} USD
              <span className="text-sm font-normal text-gray-400 ml-2">= {formatMXN(lineaMXN)}</span>
            </p>
          </div>
          <div className="text-right">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${lineaColor.bg} ${lineaColor.text} border ${lineaColor.border}`}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: lineaColor.bar }}></span>
              {lineaColor.label}
            </span>
          </div>
        </div>
        {/* Barra de utilización */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Utilización: <strong className={lineaColor.text}>{usoPct}%</strong></span>
            <span>Disponible: <strong className="text-green-700">{formatUSD(disponibleUSD)} ({formatMXN(disponibleMXN)})</strong></span>
          </div>
          <div className="h-4 bg-white rounded-full overflow-hidden border border-gray-200 shadow-inner">
            <div className="h-full rounded-full transition-all relative"
                 style={{ width: `${Math.min(usoPct, 100)}%`, backgroundColor: lineaColor.bar }}>
            </div>
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>$0</span>
            <span className="text-yellow-500">70% · Alerta</span>
            <span className="text-red-500">90% · Crítico</span>
            <span>{formatUSD(k.lineaCreditoUSD)}</span>
          </div>
        </div>
        {/* Desglose numérico */}
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <p className="text-xs text-gray-400 mb-1">Saldo Usado</p>
            <p className="text-base font-bold text-gray-800">{formatMXN(k.saldoActual)}</p>
            <p className="text-xs text-gray-400">{formatUSD(k.saldoActual / k.tipoCambio)}</p>
          </div>
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <p className="text-xs text-gray-400 mb-1">Disponible</p>
            <p className="text-base font-bold text-green-700">{formatMXN(disponibleMXN)}</p>
            <p className="text-xs text-gray-400">{formatUSD(disponibleUSD)}</p>
          </div>
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <p className="text-xs text-gray-400 mb-1">DSO Actual</p>
            <p className="text-base font-bold text-blue-700">{k.dso} días</p>
            <p className="text-xs text-gray-400">promedio de cobro</p>
          </div>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className={`grid grid-cols-2 gap-4 mb-6 ${clienteKey === "digitalife" ? "md:grid-cols-5" : "md:grid-cols-4"}`}>
        <div className="bg-white rounded-2xl shadow-sm p-5 border-t-4 border-blue-500 flex flex-col justify-between">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Saldo Total</p>
          <p className="text-2xl font-bold text-gray-800">{formatMXN(k.saldoActual)}</p>
          <p className="text-xs text-gray-400 mt-1">{usoPct}% de la línea usada</p>
        </div>
        <div className={`bg-white rounded-2xl shadow-sm p-5 border-t-4 ${k.saldoVencido > 0 ? "border-red-500" : "border-green-500"}`}>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Saldo Vencido</p>
          <p className={`text-2xl font-bold ${k.saldoVencido > 0 ? "text-red-600" : "text-green-600"}`}>
            {formatMXN(k.saldoVencido)}
          </p>
          <p className="text-xs text-gray-400 mt-1">{k.saldoVencido > 0 ? `${Math.round((k.saldoVencido / k.saldoActual) * 100)}% del saldo total` : "Sin vencidos"}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-5 border-t-4 border-purple-500">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Notas de Crédito</p>
          <p className="text-2xl font-bold text-purple-700">{formatMXN(k.saldoNC)}</p>
          <p className="text-xs text-gray-400 mt-1">A aplicar en próximos pagos</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-5 border-t-4 border-yellow-400 flex flex-col justify-between">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">A Vencer (semana)</p>
          <p className="text-2xl font-bold text-gray-800">{formatMXN(k.saldoAVencer)}</p>
          <p className="text-xs text-gray-400 mt-1">Próximos 7 días</p>
        </div>
      </div>

      {/* ── AGING DE FACTURAS + VENCIMIENTOS POR MES ── */}
      <div className="grid grid-cols-1 gap-6 mb-6 md:grid-cols-2">

        {/* Aging */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <CardHeader titulo="Aging de Facturas" icono="📅" />
          <div className="space-y-3">
            {[
              { label: "0 – 30 días",  monto: ag.d0_30,  color: "#22c55e", bg: "bg-green-500",  tag: "bg-green-100 text-green-700",  icono: "â" },
              { label: "31 – 60 días", monto: ag.d31_60, color: "#3b82f6", bg: "bg-blue-400",   tag: "bg-blue-100 text-blue-700",    icono: "🔵" },
              { label: "61 – 90 días", monto: ag.d61_90, color: "#eab308", bg: "bg-yellow-400", tag: "bg-yellow-100 text-yellow-700", icono: "â ️" },
              { label: "+ 90 días",    monto: ag.mas90,  color: "#ef4444", bg: "bg-red-500",    tag: "bg-red-100 text-red-700",       icono: "🔴" },
            ].map(({ label, monto, color, bg, tag, icono }) => (
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
              <span className="text-gray-500">Total cartera</span>
              <span className="font-bold text-gray-800">{formatMXN(agTotal)}</span>
            </div>
          </div>
        </div>

        {/* Vencimientos por mes */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <CardHeader titulo="Vencimientos por Mes" icono="🗓️" />
          <div className="space-y-4">
            {vmEntries.map(([mes, monto]) => {
              const pct = Math.round((monto / vmMax) * 100);
              const isPast = mes < "2026-04";
              return (
                <div key={mes}>
                  <div className="flex justify-between items-center text-sm mb-1">
                    <span className="font-semibold text-gray-700">{mesesLabel[mes] || mes}</span>
                    <span className="font-bold text-gray-800">{formatMXN(monto)}</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500"
                         style={{ width: `${pct}%` }}></div>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{pct}% del mes con mayor vencimiento</p>
                </div>
              );
            })}
          </div>
          {/* Mini-resumen */}
          <div className="mt-4 border-t pt-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-gray-400">Total a vencer (3 meses)</p>
              <p className="font-bold text-gray-800">{formatMXN(Object.values(k.vencimientosMes).reduce((a,b)=>a+b,0))}</p>
            </div>
            <div>
              <p className="text-gray-400">Mes con mayor vencimiento</p>
              <p className="font-bold text-blue-700">{mesesLabel[vmEntries.reduce((a,b)=>b[1]>a[1]?b:a)[0]]}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── PROYECCIÓN DE COBRO ── */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
        <CardHeader titulo="Proyección de Cobro (basada en Sell Out)" icono="📈" />
        <p className="text-xs text-gray-400 mb-4">
          Sell out Mar 2026: <strong>{formatMXN(soUltimo)}</strong> · Crecimiento mensual: <strong>+{((tasaCrecMensual - 1) * 100).toFixed(1)}%</strong> · DSO: <strong>{k.dso} días</strong> · TC: ${k.tipoCambio.toFixed(2)} MXN/USD
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs text-gray-400 uppercase pb-2">Mes</th>
                <th className="text-right text-xs text-gray-400 uppercase pb-2">Vencimiento</th>
                <th className="text-right text-xs text-gray-400 uppercase pb-2">Venta Sell Out</th>
                <th className="text-right text-xs text-gray-400 uppercase pb-2">Balance</th>
                <th className="text-center text-xs text-gray-400 uppercase pb-2">Cobertura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {proyMeses.map(({ mes, monto, cobro }) => {
                const balance = cobro - monto;
                const cobertura = Math.round((cobro / monto) * 100);
                return (
                  <tr key={mes} className="text-sm">
                    <td className="py-3 font-semibold text-gray-700">{mes}</td>
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
          * Venta Sell Out proyectada con base en la tendencia de crecimiento mensual 2026 (Ene–Mar). No incluye facturas diferidas ni acuerdos comerciales específicos.
        </p>
      </div>

      {/* ── FUENTE DEL DATO ── */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Fuente del dato</p>
        <p className="text-sm text-gray-700 font-medium">{k.correoSemana}</p>
        <p className="text-xs text-gray-400 mt-1">
          Correo enviado cada lunes · intranet@acteck.com · Actualización automática 4pm
          {" · "}TC Banxico {formatFecha(k.ultimaActualizacion)}: ${k.tipoCambio.toFixed(2)} MXN/USD
        </p>
      </div>

    </div>
  );
}

// ——— PAGOS Y COMPROMISOS (Supabase) ———
const CATEGORIA_META = {
  promociones:    { label: "Promociones",      color: "#f59e0b" },
  marketing:      { label: "Marketing",        color: "#8b5cf6" },
  pagosFijos:     { label: "Pagos Fijos",      color: "#3b82f6" },
  pagosVariables: { label: "Pagos Variables",  color: "#10b981" },
  rebate:         { label: "Rebate",           color: "#ef4444" },
  spiff: { label: "SPIFF", color: "#9333ea" },
};

const ESTATUS_OPT = [
  { value: "pendiente",  label: "Pendiente" },
  { value: "en_proceso", label: "En Proceso" },
  { value: "pagado",     label: "Pagado" },
  { value: "vencido",    label: "Vencido" },
];

const MESES_CORTOS = {
  "01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dic",
};


