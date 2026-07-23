import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

/**
 * Toast system estilo Apple — pill frosted centrado con slide-down.
 *
 * Uso:
 *   import { toast } from "../lib/toast";
 *   toast.success("Guardado");
 *   toast.error("No se pudo borrar");
 *   toast.info("Mensaje informativo");
 *
 * En el árbol de la app, incluir <Toaster /> una sola vez (en App.jsx).
 * Los colores respetan los 3 temas vía CSS vars --t-*.
 */

let listeners = [];
let counter = 0;

function emit(type, message, opts = {}) {
  const id = ++counter;
  const toastObj = { id, type, message, duration: opts.duration || 3200 };
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

// Colores semánticos iOS que se leen de las CSS vars del theme (si existen)
// con fallback a los system colors light por default.
const ICON_COLOR_VAR = {
  success: 'var(--t-green, #34C759)',
  error:   'var(--t-red, #FF3B30)',
  info:    'var(--t-accent, #007AFF)',
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
    <div
      style={{
        position: 'fixed',
        top: 68, // debajo del topbar sticky (~54px + gap)
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 200,
        display: 'flex', flexDirection: 'column', gap: 8,
        pointerEvents: 'none',
        maxWidth: 'calc(100vw - 32px)',
      }}
    >
      {items.map((t) => {
        const Icon = ICONS[t.type] || Info;
        const iconColor = ICON_COLOR_VAR[t.type] || ICON_COLOR_VAR.info;
        return (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            style={{
              pointerEvents: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 14px 9px 12px',
              borderRadius: 999,
              // Frosted glass — usa CSS vars del theme
              background: 'var(--t-surface, rgba(255,255,255,0.95))',
              border: '1px solid var(--t-border, rgba(0,0,0,0.08))',
              boxShadow:
                '0 10px 40px rgba(0,0,0,0.15), 0 2px 6px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.08)',
              backdropFilter: 'saturate(180%) blur(30px)',
              WebkitBackdropFilter: 'saturate(180%) blur(30px)',
              color: 'var(--t-text, #1D1D1F)',
              fontFamily: '"SF Pro Text", -apple-system, BlinkMacSystemFont, "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif',
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: '-0.005em',
              maxWidth: 480,
              animation: 'toastPop 320ms cubic-bezier(0.32, 0.72, 0, 1.4) both',
            }}
          >
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              color: iconColor,
            }}>
              <Icon size={16} strokeWidth={2.4} />
            </span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t.message}
            </span>
            <button
              onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
              aria-label="Cerrar"
              style={{
                width: 20, height: 20, borderRadius: 999,
                border: 0, cursor: 'pointer', background: 'transparent',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--t-textMuted, #6E6E73)',
                flexShrink: 0, marginLeft: 2,
                transition: 'background 160ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--t-surfaceHover, rgba(0,0,0,0.06))'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <X size={12} strokeWidth={2.4} />
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes toastPop {
          from { opacity: 0; transform: translateY(-12px) scale(0.94); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>
    </div>
  );
}
