import React from "react";

export export function Semaforo({ estado }) {
  const config = {
    verde:    { bg: "bg-green-100",  text: "text-green-700",  dot: "bg-green-500",  label: "Saludable" },
    amarillo: { bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-400", label: "AtenciÃ³n" },
    rojo:     { bg: "bg-red-100",    text: "text-red-700",    dot: "bg-red-500",    label: "CrÃ­tico" },
  };
  const c = config[estado];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${c.bg} ${c.text}`}>
      <span className={`w-2 h-2 rounded-full ${c.dot}`}></span>
      {c.label}
    </span>
  );
}


