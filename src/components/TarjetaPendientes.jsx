import React from "react";
import { formatFecha } from "../lib/utils";
import { CardHeader } from './CardHeader';

export function TarjetaPendientes({ pendientes }) {
  const colores = {
    "pendiente":  "bg-gray-100 text-gray-600",
    "en proceso": "bg-blue-100 text-blue-700",
    "completado": "bg-green-100 text-green-700",
  };
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <CardHeader titulo="Pendientes" icono="📋" />
      <div className="space-y-3">
        {pendientes.map(p => (
          <div key={p.id} className="flex items-start justify-between gap-3 text-sm">
            <div className="flex-1">
              <p className="text-gray-800 font-medium leading-snug">{p.tarea}</p>
              <p className="text-gray-400 text-xs mt-0.5">{p.responsable} · {formatFecha(p.fecha)}</p>
            </div>
            <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${colores[p.estado]}`}>
              {p.estado}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}


