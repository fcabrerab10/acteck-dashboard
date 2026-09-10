// Navegación de la app móvil · contexto (pestaña, pila push/pop, hoja, refresco) + <Pantalla/>.
//
// <Pantalla/> es el contenedor con scroll de cada pantalla: transición push/pop (340 ms EASE),
// gesto de volver deslizando desde el borde izquierdo (touch) y deslizar para actualizar
// (touch, con el scroll arriba del todo). El padding inferior deja sitio a la barra de pestañas.
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTheme } from '../lib/themeContext';
import { EASE, DUR, reduceMotion } from '../lib/motion';

export const NavContext = createContext(null);
export const useNav = () => useContext(NavContext);

export const ALTO_BARRA = 56;
export const PADDING_INFERIOR = `calc(${ALTO_BARRA + 34}px + env(safe-area-inset-bottom))`;

const UMBRAL_REFRESCO = 72;

export function Pantalla({ fase = 'activa', cubierta = false, puedeVolver = false, onPop, onRefrescar, children, style, id }) {
  const { theme } = useTheme();
  const ref = useRef(null);
  const scroll = useRef(null);
  const [dx, setDx] = useState(0);             // arrastre de volver
  const [arrastrando, setArrastrando] = useState(false);
  const [pull, setPull] = useState(0);         // arrastre de refresco
  const [refrescando, setRefrescando] = useState(false);
  const sinAnim = reduceMotion();
  // Los refs se actualizan en el propio handler (no al render): entre touchmove y touchend puede no haber render.
  const dxRef = useRef(0);
  const pullRef = useRef(0);
  const ponDx = (v) => { dxRef.current = v; setDx(v); };
  const ponPull = (v) => { pullRef.current = v; setPull(v); };

  // ── Volver deslizando desde el borde izquierdo ──
  useEffect(() => {
    const el = ref.current; if (!el || !puedeVolver) return undefined;
    let st = null;
    const onStart = (e) => {
      const t = e.touches[0];
      if (t.clientX > 28) return;
      st = { x: t.clientX, y: t.clientY, t0: Date.now(), ok: null };
    };
    const onMove = (e) => {
      if (!st) return;
      const t = e.touches[0]; const ddx = t.clientX - st.x, ddy = t.clientY - st.y;
      if (st.ok == null) { if (Math.abs(ddx) < 8 && Math.abs(ddy) < 8) return; st.ok = ddx > 0 && Math.abs(ddx) > Math.abs(ddy) * 1.2; if (st.ok) setArrastrando(true); }
      if (!st.ok) return;
      if (e.cancelable) e.preventDefault();
      ponDx(Math.max(0, ddx));
    };
    const onEnd = () => {
      if (!st) return;
      const ok = st.ok; const w = el.clientWidth || 390; const rapido = Date.now() - st.t0 < 300 && dxRef.current > 40;
      st = null; setArrastrando(false);
      if (ok && (dxRef.current > w / 3 || rapido)) { ponDx(w); setTimeout(() => onPop?.(), sinAnim ? 0 : DUR.exit); }
      else ponDx(0);
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => { el.removeEventListener('touchstart', onStart); el.removeEventListener('touchmove', onMove); el.removeEventListener('touchend', onEnd); el.removeEventListener('touchcancel', onEnd); };
  }, [puedeVolver, onPop, sinAnim]);

  // ── Deslizar para actualizar ──
  useEffect(() => {
    const el = scroll.current; if (!el || !onRefrescar) return undefined;
    let st = null;
    const onStart = (e) => { if (el.scrollTop > 0 || e.touches[0].clientX <= 28) { st = null; return; } st = { y: e.touches[0].clientY, ok: null }; };
    const onMove = (e) => {
      if (!st) return;
      const ddy = e.touches[0].clientY - st.y;
      if (st.ok == null) { if (Math.abs(ddy) < 8) return; st.ok = ddy > 0 && el.scrollTop <= 0; }
      if (!st.ok) return;
      if (e.cancelable) e.preventDefault();
      ponPull(Math.min(120, ddy * 0.55));
    };
    const onEnd = async () => {
      if (!st) return; const ok = st.ok; st = null;
      if (ok && pullRef.current >= UMBRAL_REFRESCO) {
        setRefrescando(true); ponPull(UMBRAL_REFRESCO * 0.7);
        try { await onRefrescar(); } finally { setRefrescando(false); ponPull(0); }
      } else ponPull(0);
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => { el.removeEventListener('touchstart', onStart); el.removeEventListener('touchmove', onMove); el.removeEventListener('touchend', onEnd); el.removeEventListener('touchcancel', onEnd); };
  }, [onRefrescar]);

  // ── Transform según fase ──
  let transform = 'translateX(0)';
  if (arrastrando) transform = `translateX(${dx}px)`;
  else if (fase === 'entrando' || fase === 'saliendo' || dx > 0) transform = 'translateX(100%)';
  else if (cubierta) transform = 'translateX(-30%)';
  const transicion = arrastrando || sinAnim ? 'none' : `transform ${fase === 'saliendo' || dx > 0 ? DUR.page : DUR.page}ms ${EASE}, filter ${DUR.page}ms ${EASE}`;

  return (
    <div ref={ref} data-pantalla={id} style={{
      position: 'absolute', inset: 0, background: theme.bg, transform, transition: transicion,
      boxShadow: puedeVolver && (arrastrando || fase !== 'activa') ? '-8px 0 24px rgba(0,0,0,0.18)' : 'none',
      filter: cubierta && !arrastrando ? 'brightness(0.92)' : 'none', willChange: 'transform',
      pointerEvents: cubierta ? 'none' : 'auto', ...style,
    }}>
      {onRefrescar && (
        <div aria-hidden style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top) + 8px)', left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 2, opacity: pull > 8 ? Math.min(1, pull / UMBRAL_REFRESCO) : 0, transform: `translateY(${Math.max(0, pull - 28)}px)`, transition: pull === 0 ? `opacity ${DUR.state}ms ${EASE}, transform ${DUR.content}ms ${EASE}` : 'none' }}>
          <span style={{ width: 30, height: 30, borderRadius: 999, background: theme.surface, border: `1px solid ${theme.border}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: pull >= UMBRAL_REFRESCO || refrescando ? theme.accent : theme.textMuted }}>
            <RefreshCw size={15} strokeWidth={2.2} style={{ transform: refrescando ? undefined : `rotate(${pull * 3}deg)`, animation: refrescando ? 'movilGiro 0.9s linear infinite' : 'none' }} />
          </span>
        </div>
      )}
      <div ref={scroll} style={{
        position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain',
        paddingTop: `calc(env(safe-area-inset-top) + 8px)`, paddingBottom: PADDING_INFERIOR, boxSizing: 'border-box',
        transform: pull > 0 ? `translateY(${pull}px)` : 'none', transition: pull === 0 ? `transform ${DUR.content}ms ${EASE}` : 'none',
      }}>
        {children}
      </div>
    </div>
  );
}
