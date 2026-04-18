import React from "react";

/**
 * CardHeader — header de tarjeta con icono + título.
 *
 * Acepta:
 *   - icono (legacy): string emoji o element ReactNode
 *   - icon: componente lucide (recomendado)
 *
 * Ejemplos:
 *   <CardHeader titulo="Ventas" icon={BarChart3} />
 *   <CardHeader titulo="Ventas" icono="📊" />  (legacy)
 */
export function CardHeader({ titulo, icono, icon: Icon }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {Icon
        ? <Icon className="w-4 h-4 text-gray-600" />
        : icono
          ? (typeof icono === "string"
              ? <span className="text-lg">{icono}</span>
              : icono)
          : null}
      <h3 className="font-bold text-gray-700 text-base">{titulo}</h3>
    </div>
  );
}
