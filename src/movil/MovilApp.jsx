// App móvil V3 · shell con cinco pestañas (Inicio · Clientes · Alertas · Buscar · Más), pila de
// navegación propia por pestaña (push/pop 340 ms EASE, volver deslizando desde el borde), hoja
// global desde abajo (HojaM), deslizar para actualizar (React Query + invalidateDataCache) y la
// canasta de la Ficha de producto. No depende de `paginaActiva` de App.jsx.
//
//   <MovilApp perfil={perfil} onCerrarSesion={handleLogout} />   (App monta <ToastHost/> aparte)
//
// Las pestañas son React.lazy: sólo se descarga la que se abre.
import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutGrid, Users, Bell, Search, Grid2x2 } from 'lucide-react';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';
import { EASE, DUR, reduceMotion } from '../lib/motion';
import { elevation, bordeFlotante } from '../lib/elevation';
import { queryClient } from '../lib/queryClient';
import { invalidateDataCache } from '../lib/queries';
import useContadorNotificaciones from '../components/notificaciones/useContadorNotificaciones';
import { NavContext, Pantalla, ALTO_BARRA } from './nav';
import { HojaM, Skeleton, Proximamente } from './piezas';
import { leerLS, guardarLS } from './util';

const Inicio   = lazy(() => import('./pestanas/Inicio'));
const Clientes = lazy(() => import('./pestanas/Clientes'));
const Alertas  = lazy(() => import('./pestanas/Alertas'));
const Buscar   = lazy(() => import('./pestanas/Buscar'));
const Mas      = lazy(() => import('./pestanas/Mas'));

const TABS = [
  { id: 'inicio',   label: 'Inicio',   icon: LayoutGrid, Comp: Inicio },
  { id: 'clientes', label: 'Clientes', icon: Users,      Comp: Clientes },
  { id: 'alertas',  label: 'Alertas',  icon: Bell,       Comp: Alertas },
  { id: 'buscar',   label: 'Buscar',   icon: Search,     Comp: Buscar },
  { id: 'mas',      label: 'Más',      icon: Grid2x2,    Comp: Mas },
];
const LS_CANASTA = 'movil_canasta_v1';

function Cargando() {
  return (
    <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Skeleton w="55%" h={26} r={8} />
      <Skeleton w="35%" h={12} />
      <Skeleton h={120} r={12} style={{ marginTop: 8 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><Skeleton h={80} r={12} /><Skeleton h={80} r={12} /></div>
      <Skeleton h={160} r={12} />
    </div>
  );
}

let seq = 0;

export default function MovilApp({ perfil, onCerrarSesion }) {
  const { theme } = useTheme();
  const [tab, setTab] = useState('inicio');
  const [visitadas, setVisitadas] = useState(() => new Set(['inicio']));
  const [pilas, setPilas] = useState(() => Object.fromEntries(TABS.map((t) => [t.id, []]))); // tab → [{ key, el, fase }]
  const [hoja, setHoja] = useState(null);       // { titulo, sub, alto, contenido, acciones }
  const [hojaAbierta, setHojaAbierta] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [canasta, setCanasta] = useState(() => leerLS(LS_CANASTA, []).filter((s) => typeof s === 'string').slice(0, 12));
  const contador = useContadorNotificaciones();
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => { guardarLS(LS_CANASTA, canasta); }, [canasta]);

  // Fondo de la página = tema (edge-to-edge en Midnight).
  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = theme.bg;
    return () => { document.body.style.background = prev; };
  }, [theme.bg]);

  const luego = (fn, ms) => { const t = setTimeout(fn, reduceMotion() ? 0 : ms); timers.current.push(t); };

  // ── Pila ──
  const push = useCallback((el, key) => {
    const k = `${key || 'p'}-${++seq}`;
    setPilas((p) => ({ ...p, [tab]: [...p[tab], { key: k, el, fase: 'entrando' }] }));
    luego(() => setPilas((p) => ({ ...p, [tab]: p[tab].map((e) => (e.key === k ? { ...e, fase: 'activa' } : e)) })), 20);
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  const pop = useCallback(() => {
    setPilas((p) => {
      const pila = p[tab]; if (!pila.length) return p;
      const top = pila[pila.length - 1];
      if (top.fase === 'saliendo') return p;
      luego(() => setPilas((q) => ({ ...q, [tab]: q[tab].filter((e) => e.key !== top.key) })), DUR.page);
      return { ...p, [tab]: pila.map((e) => (e.key === top.key ? { ...e, fase: 'saliendo' } : e)) };
    });
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  const popTodo = useCallback((t = tab) => setPilas((p) => ({ ...p, [t]: [] })), [tab]);

  const tabRef = useRef(tab); tabRef.current = tab;
  const irATab = useCallback((id) => {
    setVisitadas((v) => (v.has(id) ? v : new Set(v).add(id)));
    if (tabRef.current === id) {
      // Tocar la pestaña activa = volver a su raíz y subir al inicio (como iOS).
      popTodo(id);
      document.querySelector(`[data-tab="${id}"] [data-pantalla="raiz"] > div`)?.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setTab(id);
  }, [popTodo]);

  // ── Hoja ──
  const abrirHoja = useCallback((opts) => { setHoja(opts); setHojaAbierta(true); }, []);
  const cerrarHoja = useCallback(() => { setHojaAbierta(false); luego(() => setHoja(null), DUR.page); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const abrirProximamente = useCallback((que) => abrirHoja({ titulo: que || 'Próximamente', alto: '46vh', contenido: <Proximamente que={que} /> }), [abrirHoja]);

  // ── Refresco ──
  const refrescar = useCallback(async () => {
    try { await invalidateDataCache(); await queryClient.invalidateQueries(); } catch { /* sin red */ }
    setRefreshKey((k) => k + 1);
    await new Promise((r) => setTimeout(r, 350));
  }, []);

  // ── Canasta de la ficha de producto ──
  const agregarSku = useCallback((sku) => { const s = String(sku || '').trim().toUpperCase(); if (!s) return; setCanasta((c) => (c.includes(s) ? c : [...c, s].slice(-12))); }, []);
  const quitarSku = useCallback((sku) => setCanasta((c) => c.filter((x) => x !== sku)), []);
  const limpiarCanasta = useCallback(() => setCanasta([]), []);

  const ctx = useMemo(() => ({
    perfil, onCerrarSesion, tab, irATab, push, pop, abrirHoja, cerrarHoja, abrirProximamente, refrescar, refreshKey,
    canasta, agregarSku, quitarSku, limpiarCanasta,
  }), [perfil, onCerrarSesion, tab, irATab, push, pop, abrirHoja, cerrarHoja, abrirProximamente, refrescar, refreshKey, canasta, agregarSku, quitarSku, limpiarCanasta]);

  const dark = theme.mode === 'dark';
  const badge = contador.pilas;

  return (
    <NavContext.Provider value={ctx}>
      <style>{`@keyframes movilGiro{to{transform:rotate(360deg)}} [data-movil] button{-webkit-tap-highlight-color:transparent} [data-movil]{-webkit-text-size-adjust:100%}`}</style>
      <div data-movil style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: theme.bg, color: theme.text, fontFamily: TYPO.fontText }}>
        {TABS.map(({ id, Comp }) => {
          if (!visitadas.has(id)) return null;
          const pila = pilas[id];
          const activa = id === tab;
          const topIdx = pila.length - 1;
          return (
            <div key={id} data-tab={id} style={{ position: 'absolute', inset: 0, display: activa ? 'block' : 'none' }}>
              <Pantalla id="raiz" cubierta={pila.some((e) => e.fase !== 'saliendo')} onRefrescar={refrescar}>
                <Suspense fallback={<Cargando />}>
                  <Comp key={refreshKey} />
                </Suspense>
              </Pantalla>
              {pila.map((e, i) => (
                <Pantalla key={e.key} id={e.key} fase={e.fase} puedeVolver onPop={pop} onRefrescar={refrescar}
                  cubierta={i < topIdx && pila.slice(i + 1).some((x) => x.fase !== 'saliendo')}>
                  <Suspense fallback={<Cargando />}>{e.el}</Suspense>
                </Pantalla>
              ))}
            </div>
          );
        })}

        <BarraTabs tab={tab} onTab={irATab} badge={badge} badgeCritica={contador.criticaNueva} theme={theme} dark={dark} />

        <HojaM abierto={hojaAbierta && !!hoja} onClose={cerrarHoja} titulo={hoja?.titulo} sub={hoja?.sub} alto={hoja?.alto || '78vh'} acciones={hoja?.acciones}>
          {hoja?.contenido}
        </HojaM>
      </div>
    </NavContext.Provider>
  );
}

function BarraTabs({ tab, onTab, badge, badgeCritica, theme, dark }) {
  const marfil = theme.key === 'marfil';
  return (
    <nav aria-label="Pestañas" style={{
      position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 'calc(12px + env(safe-area-inset-bottom))', zIndex: 60,
      width: 'min(calc(100% - 24px), 440px)', height: ALTO_BARRA, padding: '0 6px', borderRadius: 999, boxSizing: 'border-box',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2,
      background: dark ? 'rgba(28,28,30,0.82)' : marfil ? 'rgba(255,251,244,0.86)' : 'rgba(255,255,255,0.84)',
      backdropFilter: 'saturate(180%) blur(24px)', WebkitBackdropFilter: 'saturate(180%) blur(24px)',
      border: bordeFlotante(theme), boxShadow: elevation(theme, 'flotante'), fontFamily: TYPO.fontText,
    }}>
      {TABS.map(({ id, label, icon: Icon }) => {
        const on = tab === id;
        return (
          <button key={id} type="button" onClick={() => onTab(id)} aria-current={on ? 'page' : undefined} aria-label={label}
            style={{
              position: 'relative', flex: 1, height: 44, minWidth: 0, padding: '0 4px', border: 0, borderRadius: 999, cursor: 'pointer',
              display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
              background: on ? (theme.surfaceInverse || theme.surfaceDark) : 'transparent', color: on ? (theme.textOnInverse || theme.textOnDark) : theme.textMuted,
              transition: `background ${DUR.state}ms ${EASE}, color ${DUR.state}ms ${EASE}`,
            }}>
            <Icon size={20} strokeWidth={on ? 2.2 : 1.9} />
            <span style={{ fontSize: 10, fontWeight: on ? 600 : 500, letterSpacing: '0.01em', fontFamily: TYPO.fontDisplay, whiteSpace: 'nowrap' }}>{label}</span>
            {id === 'alertas' && badge > 0 && (
              <span aria-label={`${badge} con novedades`} style={{
                position: 'absolute', top: 4, left: 'calc(50% + 6px)', minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, boxSizing: 'border-box',
                background: badgeCritica ? theme.red : theme.accent, color: theme.textOnDark || '#FFF', fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 700, lineHeight: '16px', textAlign: 'center', fontVariantNumeric: 'tabular-nums',
              }}>{badge > 9 ? '9+' : badge}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
