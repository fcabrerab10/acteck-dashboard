import React from "react";

export function BarraCuota({ actual, objetivo, minimo }) {
  const pctObj = Math.min((actual / objetivo) * 100, 100);
  const pctMin = (minimo / objetivo) * 100;
  return (
    <div className="mt-2">
      <div className="relative h-2 bg-gray-100 rounded-full overflow-visible">
        <div className="h-full rounded-full transition-all"
          style={{ width: `${pctObj}%`, backgroundColor: pctObj >= 100 ? "#22c55e" : pctObj >= 80 ? "#eab308" : "#ef4444" }} />
        {/* línea mínimo */}
        <div className="absolute top-0 h-full w-0.5 bg-orange-400" style={{ left: `${pctMin}%` }} title="Mínimo 25M" />
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-0.5">
        <span>0</span>
        <span className="text-orange-500">Mín {Math.round(pctMin)}%</span>
        <span>Obj 100%</span>
      </div>
    </div>
  );
}

// ─── COMPONENTE: ACTUALIZAR DATOS DESDE EXCEL ───

