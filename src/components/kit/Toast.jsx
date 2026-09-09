// Toast global · negro, sube 260 ms y se va solo. Sustituye alert() y banners.
// Uso: import { toast } from '../components/kit'; toast.ok('Pago generado'); toast.error('No se pudo guardar').
// <ToastHost /> se monta una vez en App.jsx.
import React, { useEffect, useState } from 'react';
import { Check, AlertTriangle, Info } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';

const EV = 'kit-toast';
let seq = 0;
const emit = (tipo, msg, opts = {}) => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EV, { detail: { id: ++seq, tipo, msg, ms: opts.ms ?? (tipo === 'error' ? 4200 : 2400) } })); };
export const toast = { ok: (m, o) => emit('ok', m, o), error: (m, o) => emit('error', m, o), info: (m, o) => emit('info', m, o) };

export function ToastHost() {
  const { theme } = useTheme();
  const [items, setItems] = useState([]);
  useEffect(() => {
    const on = (e) => {
      const it = { ...e.detail, show: false };
      setItems((s) => [...s.slice(-2), it]);
      requestAnimationFrame(() => setItems((s) => s.map((x) => (x.id === it.id ? { ...x, show: true } : x))));
      setTimeout(() => setItems((s) => s.map((x) => (x.id === it.id ? { ...x, show: false } : x))), it.ms);
      setTimeout(() => setItems((s) => s.filter((x) => x.id !== it.id)), it.ms + DUR.content);
    };
    window.addEventListener(EV, on); return () => window.removeEventListener(EV, on);
  }, []);
  if (!items.length) return null;
  const bg = theme.surfaceInverse || '#000', col = theme.textOnInverse || '#F5F5F7';
  const icon = { ok: <Check size={11} strokeWidth={2.5} />, error: <AlertTriangle size={11} strokeWidth={2.5} />, info: <Info size={11} strokeWidth={2.5} /> };
  const dot = { ok: theme.green || '#34C759', error: theme.red || '#FF3B30', info: theme.accent || '#007AFF' };
  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, zIndex: 9999, pointerEvents: 'none' }}>
      {items.map((t) => (
        <div key={t.id} role="status" style={{
          pointerEvents: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px 8px 10px', borderRadius: 10,
          background: bg, color: col, fontFamily: TYPO.fontText, fontSize: 12.5, fontWeight: 500, boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          transform: t.show ? 'translateY(0)' : 'translateY(24px)', opacity: t.show ? 1 : 0,
          transition: `transform ${DUR.content}ms ${EASE}, opacity ${DUR.state}ms ${EASE}`,
        }}>
          <span style={{ width: 18, height: 18, borderRadius: 999, background: dot[t.tipo], color: '#FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon[t.tipo]}</span>
          {t.msg}
        </div>
      ))}
    </div>
  );
}
