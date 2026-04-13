import React from "react";

export function KPICard({ label, valor, sub, color, alerta }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm p-5 border-t-4`} style={{ borderColor: color }}>
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-800">{valor}</p>
      {sub && <p className={`text-xs mt-1 ${alerta ? "text-red-500 font-semibold" : "text-gray-400"}`}>{sub}</p>}
    </div>
  );
}


