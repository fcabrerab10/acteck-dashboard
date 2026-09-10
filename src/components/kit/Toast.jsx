// Toast global · negro, sube 260 ms y se va solo. Sustituye alert() y banners.
// Uso: import { toast } from '../components/kit'; toast.ok('Pago generado'); toast.error('No se pudo guardar').
// Opciones: { ms } duración (ms: 0 = persistente, no se cierra solo; muestra ×),
//           { accion, onAccion } botón de acción a la derecha (p. ej. 'Recargar' para la versión nueva).
// <ToastHost /> se monta una vez en App.jsx. Los toasts emitidos antes de montarlo se guardan y se muestran al montar.
import React, { useEffect, useState } from 'react';
import { Check, AlertTriangle, Info, X } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';
import { elevation } from '../../lib/elevation';

const EV = 'kit-toast';
let seq = 0;
let hostMontado = false;
const pendientes = [];
const emit = (tipo, msg, opts = {}) => {
  if (typeof window === 'undefined') return;
  const detail = { id: ++seq, tipo, msg, ms: opts.ms ?? (tipo === 'error' ? 4200 : 2400), accion: opts.accion, onAccion: opts.onAccion };
  if (!hostMontado) { pendientes.push(detail); return; }
  window.dispatchEvent(new CustomEvent(EV, { detail }));
};
export const toast = { ok: (m, o) => emit('ok', m, o), error: (m, o) => emit('error', m, o), info: (m, o) => emit('info', m, o) };

export function ToastHost() {
  const { theme } = useTheme();
  const [items, setItems] = useState([]);
  useEffect(() => {
    const timers = new Map();
    const cerrar = (id) => {
      setItems((s) => s.map((x) => (x.id === id ? { ...x, show: false } : x)));
      setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), DUR.content);
    };
    const mostrar = (d) => {
      const it = { ...d, show: false, cerrar: () => cerrar(d.id) };
      setItems((s) => [...s.slice(-2), it]);
      requestAnimationFrame(() => setItems((s) => s.map((x) => (x.id === it.id ? { ...x, show: true } : x))));
      if (it.ms > 0) timers.set(it.id, setTimeout(() => cerrar(it.id), it.ms));
    };
    const on = (e) => mostrar(e.detail);
    window.addEventListener(EV, on);
    hostMontado = true;
    while (pendientes.length) mostrar(pendientes.shift());
    return () => { window.removeEventListener(EV, on); hostMontado = false; timers.forEach(clearTimeout); };
  }, []);
  if (!items.length) return null;
  const bg = theme.surfaceInverse || '#000', col = theme.textOnInverse || '#F5F5F7';
  const icon = { ok: <Check size={11} strokeWidth={2.5} />, error: <AlertTriangle size={11} strokeWidth={2.5} />, info: <Info size={11} strokeWidth={2.5} /> };
  const dot = { ok: theme.green || '#34C759', error: theme.red || '#FF3B30', info: theme.accent || '#007AFF' };
  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, zIndex: 9999, pointerEvents: 'none' }}>
      {items.map((t) => (
        <div key={t.id} role="status" style={{
          pointerEvents: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 10px 8px 10px', borderRadius: 10,
          background: bg, color: col, fontFamily: TYPO.fontText, fontSize: 12.5, fontWeight: 500, boxShadow: elevation(theme, 'flotante'),
          transform: t.show ? 'translateY(0)' : 'translateY(24px)', opacity: t.show ? 1 : 0,
          transition: `transform ${DUR.content}ms ${EASE}, opacity ${DUR.state}ms ${EASE}`,
        }}>
          <span style={{ width: 18, height: 18, borderRadius: 999, background: dot[t.tipo], color: '#FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon[t.tipo]}</span>
          <span style={{ paddingRight: t.accion || t.ms === 0 ? 0 : 4 }}>{t.msg}</span>
          {t.accion && (
            <button type="button" onClick={() => { t.onAccion?.(); t.cerrar(); }}
              style={{ marginLeft: 4, height: 24, padding: '0 10px', borderRadius: 999, border: 0, cursor: 'pointer', background: theme.accent || '#007AFF', color: '#FFF', fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, letterSpacing: '-0.005em', whiteSpace: 'nowrap' }}>
              {t.accion}
            </button>
          )}
          {t.ms === 0 && (
            <button type="button" onClick={t.cerrar} title="Cerrar" aria-label="Cerrar"
              style={{ width: 22, height: 22, borderRadius: 999, border: 0, cursor: 'pointer', background: 'rgba(255,255,255,0.12)', color: col, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}>
              <X size={11} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
