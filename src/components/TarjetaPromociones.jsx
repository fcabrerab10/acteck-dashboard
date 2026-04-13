import React from "react";
import { formatMXN } from "../lib/utils";
import { CardHeader } from './CardHeader';

export function TarjetaPromociones({ promos }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <CardHeader titulo="Promociones Activas" icono="🎯" />
      <div className="space-y-4">
        {promos.map(p => {
          const total = p.aportacionActeck + p.aportacionCliente;
          const pctActeck = Math.round((p.aportacionActeck / total) * 100);
          return (
            <div key={p.id} className="text-sm">
              <div className="flex justify-between items-start mb-1">
                <p className="font-semibold text-gray-800">{p.nombre}</p>
                <span className="text-xs text-gray-400">{p.vigencia}</span>
              </div>
              <div className="flex gap-4 text-xs mb-2">
                <span className="text-blue-700">Nuestra aportación: <b>{formatMXN(p.aportacionActeck)}</b></span>
                <span className="text-purple-700">Cliente aporta: <b>{formatMXN(p.aportacionCliente)}</b></span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pctActeck}%` }}></div>
              </div>
              <p className="text-xs text-gray-400 mt-1">Inversión total: {formatMXN(total)} · Nosotros {pctActeck}% / Cliente {100 - pctActeck}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}


