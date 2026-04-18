import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

/**
 * Toast system — minimal pub/sub, sin dependencias.
 *
 * Uso:
 *   import { toast } from "../lib/toast";
 *   toast.success("Guardado");
 *   toast.error("No se pudo borrar");
 *   toast.info("Mensaje informativo");
 *
 * En el árbol de la app, incluir <Toaster /> una sola vez (en App.jsx).
 */

let listeners = [];
let counter = 0;

function emit(type, message, opts = {}) {
  const id = ++counter;
  const toastObj = { id, type, message, duration: opts.duration || 3000 };
  listeners.forEach((l) => l(toastObj));
  return id;
}

export const toast = {
  success: (msg, opts) => emit("success", msg, opts),
  error:   (msg, opts) => emit("error",   msg, { duration: 5000, ...(opts || {}) }),
  info:    (msg, opts) => emit("info",    msg, opts),
};

const ICONS = {
  success: CheckCircle2,
  error:   AlertCircle,
  info:    Info,
};

const STYLES = {
  success: "bg-emerald-50 text-emerald-800 border-emerald-200",
  error:   "bg-red-50 text-red-800 border-red-200",
  info:    "bg-blue-50 text-blue-800 border-blue-200",
};

const ICON_COLORS = {
  success: "text-emerald-600",
  error:   "text-red-600",
  info:    "text-blue-600",
};

export function Toaster() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const listener = (t) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== t.id));
      }, t.duration);
    };
    listeners.push(listener);
    return () => { listeners = listeners.filter((l) => l !== listener); };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none max-w-sm">
      {items.map((t) => {
        const Icon = ICONS[t.type] || Info;
        return (
          <div
            key={t.id}
            className={[
              "pointer-events-auto flex items-start gap-2 px-3 py-2.5 rounded-lg border shadow-lg text-sm animate-slide-in-right",
              STYLES[t.type] || STYLES.info,
            ].join(" ")}
            style={{ animation: "slideInRight 0.2s ease-out" }}
          >
            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${ICON_COLORS[t.type] || ICON_COLORS.info}`} />
            <div className="flex-1">{t.message}</div>
            <button
              onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
              className="shrink-0 opacity-50 hover:opacity-100"
              aria-label="Cerrar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
