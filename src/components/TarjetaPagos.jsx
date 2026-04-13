import React from "react";
import { formatMXN, formatFecha, diasRestantes } from "../lib/utils";

export function TarjetaPagos({ pagos }) {
  const colores = {
    "vencida":    { bg: "bg-red-100",    text: "text-red-700",    icon: "â ️" },
    "por vencer": { bg: "bg-yellow-100", text: "text-yellow-700", icon: "🕐" },
    "vigente":    { bg: "bg-green-100",  text: "text-green-700",  icon: "â" },
  };
  const total = pagos.reduce((s, p) => s + p.monto, 0);
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <CardHeader titulo="Pagos Pendientes" icono="💳" />
      <div className="space-y-3 mb-4">
        {pagos.map(p => {
          const c = colores[p.estado];
          const dias = diasRestantes(p.vencimiento);
          return (
            <div key={p.id} className="flex items-center justify-between text-sm">
              <div>
                <p className="text-gray-700 font-medium">{p.factura}</p>
                <p className="text-gray-400 text-xs">Vence: {formatFecha(p.vencimiento)}
                  {p.estado === "vencida" ? <span className="text-red-500 font-semibold"> · Vencida hace {Math.abs(dias)} días</span>
                  : p.estado === "por vencer" ? <span className="text-yellow-600 font-semibold"> · {dias} días</span>
                  : null}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-800">{formatMXN(p.monto)}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>{c.icon} {p.estado}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t pt-3 flex justify-between items-center">
        <span className="text-sm text-gray-500">Total adeudo</span>
        <span className="font-bold text-gray-800 text-base">{formatMXN(total)}</span>
      </div>
    </div>
  );
}


