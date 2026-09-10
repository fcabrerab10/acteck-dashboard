// Hoja móvil desde abajo · asa, 340 ms EASE, cierra deslizando hacia abajo (touch) o tocando el fondo.
//   <HojaM abierto onClose titulo alto="78vh" acciones>{contenido}</HojaM>
// El contenido hace scroll dentro; el arrastre para cerrar sólo se activa con el scroll arriba del todo.
import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR, reduceMotion } from '../../lib/motion';
import { elevation, bordeFlotante } from '../../lib/elevation';

export default function HojaM({ abierto, onClose, titulo, sub, alto = '78vh', acciones, children, zIndex = 70, sinCerrar = false }) {
  const { theme } = useTheme();
  const [montado, setMontado] = useState(abierto);
  const [visible, setVisible] = useState(false);
  const [dy, setDy] = useState(0);
  const [anim, setAnim] = useState(true);
  const cuerpo = useRef(null);
  const drag = useRef(null);
  const dyRef = useRef(0);
  const ponDy = (v) => { dyRef.current = v; setDy(v); };
  const dark = theme.mode === 'dark';

  useEffect(() => {
    if (abierto) { setMontado(true); const t = setTimeout(() => setVisible(true), 16); return () => clearTimeout(t); }
    setVisible(false);
    const t = setTimeout(() => { setMontado(false); ponDy(0); }, reduceMotion() ? 0 : DUR.page);
    return () => clearTimeout(t);
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [abierto, onClose]);

  const onStart = (e, desdeAsa = false) => {
    const t = e.touches[0];
    drag.current = { y: t.clientY, t0: Date.now(), activo: desdeAsa || (cuerpo.current?.scrollTop ?? 0) <= 0, desdeAsa };
    setAnim(false);
  };
  const onMove = (e) => {
    const d = drag.current; if (!d || !d.activo) return;
    const ddy = e.touches[0].clientY - d.y;
    if (ddy <= 0) { ponDy(0); return; }
    if (!d.desdeAsa && (cuerpo.current?.scrollTop ?? 0) > 0) { d.activo = false; ponDy(0); return; }
    ponDy(ddy);
  };
  const onEnd = () => {
    const d = drag.current; drag.current = null; setAnim(true);
    if (!d) return;
    const v = dyRef.current;
    const rapido = v > 40 && Date.now() - d.t0 < 260;
    if (v > 110 || rapido) { onClose?.(); } else ponDy(0);
  };

  if (!montado) return null;
  const alturaMax = typeof alto === 'number' ? `${alto}px` : alto;
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{ position: 'fixed', inset: 0, zIndex, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: visible ? 'rgba(0,0,0,0.36)' : 'rgba(0,0,0,0)', transition: `background ${DUR.page}ms ${EASE}` }}>
      <div role="dialog" aria-modal="true" aria-label={titulo}
        style={{
          width: '100%', maxHeight: alturaMax, display: 'flex', flexDirection: 'column',
          background: dark ? 'rgba(28,28,30,0.97)' : theme.bg, color: theme.text, fontFamily: TYPO.fontText,
          borderRadius: '18px 18px 0 0', border: bordeFlotante(theme), borderBottom: 0, boxShadow: elevation(theme, 'flotante'),
          transform: visible ? `translateY(${dy}px)` : 'translateY(100%)',
          transition: anim ? `transform ${DUR.page}ms ${EASE}` : 'none',
          paddingBottom: 'env(safe-area-inset-bottom)', boxSizing: 'border-box', overscrollBehavior: 'contain',
        }}>
        <div onTouchStart={(e) => onStart(e, true)} onTouchMove={onMove} onTouchEnd={onEnd} onTouchCancel={onEnd} style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
            <span style={{ width: 36, height: 5, borderRadius: 999, background: dark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)' }} />
          </div>
          {(titulo || acciones || !sinCerrar) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '4px 16px 10px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 600, letterSpacing: '-0.025em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titulo}</div>
                {sub && <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 1 }}>{sub}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {acciones}
                {!sinCerrar && (
                  <button type="button" onClick={onClose} aria-label="Cerrar" style={{ width: 30, height: 30, borderRadius: 999, border: 0, cursor: 'pointer', background: dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)', color: theme.textMuted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                    <X size={15} strokeWidth={2.4} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        <div ref={cuerpo} onTouchStart={(e) => onStart(e, false)} onTouchMove={onMove} onTouchEnd={onEnd} onTouchCancel={onEnd}
          style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '0 0 16px', flex: 1, minHeight: 0, overscrollBehavior: 'contain' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
