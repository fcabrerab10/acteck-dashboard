// App móvil V3 · shell con el MISMO árbol y orden que el menú web (construirArbol) y dos modos elegibles por el
// usuario (perfiles.preferencias → menu.modoMovil, cambio instantáneo):
//   · "cajon" (default): barra superior "☰ Menú · lupa · campana · avatar"; ☰ o deslizar desde el borde izquierdo
//     abre un cajón lateral que replica el sidebar iPad (perfil, FAVORITOS, grupos, clientes con punto). Sin barra inferior.
//   · "barra": barra inferior flotante Inicio · General · Comercial · Clientes · Interno · avatar; cada grupo abre una
//     hoja desde abajo con sus pestañas (HojaGrupo). Lupa y campana en la barra superior.
// Cuatro pestañas raíz con pila propia (inicio · clientes · alertas · buscar; push/pop 340 ms EASE, volver deslizando),
// hoja global desde abajo (HojaM), deslizar para actualizar y la canasta de la Ficha de producto.
// Nodo → pantalla: SOLO en src/movil/rutas.js (nav.navegar(nodo)).
//
//   <MovilApp perfil={perfil} onCerrarSesion={handleLogout} />   (App monta <ToastHost/> aparte)
import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';
import { DUR, reduceMotion } from '../lib/motion';
import { queryClient } from '../lib/queryClient';
import { invalidateDataCache } from '../lib/queries';
import { usePreferencias } from '../lib/preferencias';
import { construirArbol, buscarNodo, idNodo } from '../components/nav/arbol';
import useContadorNotificaciones from '../components/notificaciones/useContadorNotificaciones';
import { NavContext, Pantalla } from './nav';
import { HojaM, Skeleton, Proximamente } from './piezas';
import { leerLS, guardarLS } from './util';
import { destino, TABS_RAIZ } from './rutas';
import BarraSuperior from './menu/BarraSuperior';
import BarraGrupos from './menu/BarraGrupos';
import Cajon, { anchoCajon } from './menu/Cajon';
import HojaGrupo from './menu/HojaGrupo';

const Inicio   = lazy(() => import('./pestanas/Inicio'));
const Clientes = lazy(() => import('./pestanas/Clientes'));
const Alertas  = lazy(() => import('./pestanas/Alertas'));
const Buscar   = lazy(() => import('./pestanas/Buscar'));
const PreferenciasHoja = lazy(() => import('../components/perfil/PreferenciasHoja'));

const RAIZ = { inicio: Inicio, clientes: Clientes, alertas: Alertas, buscar: Buscar };
const TAB_A_NODO = { inicio: 'inicio', clientes: 'resumenClientes' };
const LS_CANASTA = 'movil_canasta_v1';
const BORDE = 24; // px desde el borde izquierdo que abren el cajón

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
  const { menu } = usePreferencias();
  const modo = menu.modoMovil === 'barra' ? 'barra' : 'cajon';
  const arbol = useMemo(() => { try { return construirArbol(perfil, { movil: true }); } catch { return []; } }, [perfil]);

  const [tab, setTab] = useState('inicio');
  const [visitadas, setVisitadas] = useState(() => new Set(['inicio']));
  const [pilas, setPilas] = useState(() => Object.fromEntries(TABS_RAIZ.map((t) => [t, []]))); // tab → [{ key, el, fase }]
  const [activoId, setActivoId] = useState('inicio');   // nodo del árbol resaltado en los menús
  const [hoja, setHoja] = useState(null);               // { titulo, sub, alto, contenido, acciones, grupo? }
  const [hojaAbierta, setHojaAbierta] = useState(false);
  const [perfilAbierto, setPerfilAbierto] = useState(false);
  const [cajonAbierto, setCajonAbierto] = useState(false);
  const [arrastreCajon, setArrastreCajon] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [canasta, setCanasta] = useState(() => leerLS(LS_CANASTA, []).filter((s) => typeof s === 'string').slice(0, 12));
  const contador = useContadorNotificaciones();
  const timers = useRef([]);
  const raiz = useRef(null);
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
  const tabPrev = useRef('inicio');
  const irATab = useCallback((id) => {
    if (!RAIZ[id]) return;
    setVisitadas((v) => (v.has(id) ? v : new Set(v).add(id)));
    if (tabRef.current === id) {
      // Tocar la pestaña activa = volver a su raíz y subir al inicio (como iOS).
      popTodo(id);
      document.querySelector(`[data-tab="${id}"] [data-pantalla="raiz"] > div`)?.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (TAB_A_NODO[tabRef.current]) tabPrev.current = tabRef.current; // desde alertas/buscar no se pisa la anterior
    if (TAB_A_NODO[id]) setActivoId(TAB_A_NODO[id]);
    setTab(id);
  }, [popTodo]);
  // Lupa / campana: tocarlas con su pestaña al frente vuelve a la pestaña anterior.
  const alternarTab = useCallback((id) => { if (tabRef.current === id) irATab(tabPrev.current || 'inicio'); else irATab(id); }, [irATab]);

  // ── Hoja ──
  const abrirHoja = useCallback((opts) => { setHoja(opts); setHojaAbierta(true); }, []);
  const cerrarHoja = useCallback(() => { setHojaAbierta(false); luego(() => setHoja(null), DUR.page); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const abrirProximamente = useCallback((que) => abrirHoja({ titulo: que || 'Próximamente', alto: '46vh', contenido: <Proximamente que={que} /> }), [abrirHoja]);

  // ── Nodo del árbol → pantalla (src/movil/rutas.js) ──
  const navegar = useCallback((nodo) => {
    if (!nodo || nodo.disabled) return;
    const id = nodo.id || idNodo(nodo.clienteKey || null, nodo.pagina);
    const label = nodo.label || buscarNodo(arbol, id)?.label;
    const d = destino({ pagina: nodo.pagina, clienteKey: nodo.clienteKey || null, label, extra: nodo.extra });
    if (d.tipo === 'tab') { irATab(d.tab); return; }
    if (d.tipo === 'push') { setActivoId(id); push(d.el, nodo.extra ? `${d.key}-${Date.now()}` : d.key); return; }
    abrirProximamente(d.label);
  }, [arbol, irATab, push, abrirProximamente]);

  const abrirGrupo = useCallback((id) => {
    const g = arbol.find((x) => x.id === id);
    abrirHoja({ titulo: id === 'clientesPropios' ? 'Clientes' : g?.label || 'Menú', grupo: id, contenido: <HojaGrupo entrada={id} /> });
  }, [arbol, abrirHoja]);
  const onEntradaBarra = useCallback((id) => {
    if (id === 'inicio') { irATab('inicio'); return; }
    if (id === 'perfil') { setPerfilAbierto(true); return; }
    abrirGrupo(id);
  }, [irATab, abrirGrupo]);

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

  // ── Cajón: abrir deslizando desde el borde izquierdo (sólo en la raíz de la pestaña; sobre una pantalla
  //    empujada ese gesto es "volver", lo maneja <Pantalla/>) ──
  const pilasRef = useRef(pilas); pilasRef.current = pilas;
  const modoRef = useRef(modo); modoRef.current = modo;
  const cajonRef = useRef(cajonAbierto); cajonRef.current = cajonAbierto;
  useEffect(() => {
    const el = raiz.current; if (!el) return undefined;
    let st = null; let dx = 0;
    const onStart = (e) => {
      const t = e.touches[0];
      if (modoRef.current !== 'cajon' || cajonRef.current || t.clientX > BORDE || pilasRef.current[tabRef.current]?.length) { st = null; return; }
      st = { x: t.clientX, y: t.clientY, t0: Date.now(), ok: null }; dx = 0;
    };
    const onMove = (e) => {
      if (!st) return;
      const t = e.touches[0]; const ddx = t.clientX - st.x, ddy = t.clientY - st.y;
      if (st.ok == null) { if (Math.abs(ddx) < 8 && Math.abs(ddy) < 8) return; st.ok = ddx > 0 && Math.abs(ddx) > Math.abs(ddy) * 1.2; }
      if (!st.ok) return;
      if (e.cancelable) e.preventDefault();
      dx = Math.max(0, Math.min(anchoCajon(), ddx)); setArrastreCajon(dx);
    };
    const onEnd = () => {
      if (!st) return;
      const ok = st.ok; const rapido = Date.now() - st.t0 < 300 && dx > 30; st = null;
      if (ok && (dx > anchoCajon() / 3 || rapido)) setCajonAbierto(true);
      setArrastreCajon(null);
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => { el.removeEventListener('touchstart', onStart); el.removeEventListener('touchmove', onMove); el.removeEventListener('touchend', onEnd); el.removeEventListener('touchcancel', onEnd); };
  }, []);

  // Al cambiar de modo se cierra lo que sea propio del otro (cajón / hoja de grupo).
  useEffect(() => { setCajonAbierto(false); if (hoja?.grupo) cerrarHoja(); }, [modo]); // eslint-disable-line react-hooks/exhaustive-deps

  const ctx = useMemo(() => ({
    perfil, onCerrarSesion, arbol, modo, tab, activoId, irATab, push, pop, navegar, abrirHoja, cerrarHoja, abrirProximamente, abrirPerfil: () => setPerfilAbierto(true),
    refrescar, refreshKey, canasta, agregarSku, quitarSku, limpiarCanasta,
  }), [perfil, onCerrarSesion, arbol, modo, tab, activoId, irATab, push, pop, navegar, abrirHoja, cerrarHoja, abrirProximamente, refrescar, refreshKey, canasta, agregarSku, quitarSku, limpiarCanasta]);

  const sinBarra = modo === 'cajon';
  const activoBarra = perfilAbierto ? 'perfil' : hojaAbierta && hoja?.grupo ? hoja.grupo : tab === 'inicio' ? 'inicio' : tab === 'clientes' ? 'clientesPropios' : null;

  return (
    <NavContext.Provider value={ctx}>
      <style>{`@keyframes movilGiro{to{transform:rotate(360deg)}} [data-movil] button{-webkit-tap-highlight-color:transparent} [data-movil]{-webkit-text-size-adjust:100%}`}</style>
      <div ref={raiz} data-movil data-modo={modo} style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: theme.bg, color: theme.text, fontFamily: TYPO.fontText }}>
        {TABS_RAIZ.map((id) => {
          if (!visitadas.has(id)) return null;
          const Comp = RAIZ[id];
          const pila = pilas[id];
          const activa = id === tab;
          const topIdx = pila.length - 1;
          return (
            <div key={id} data-tab={id} style={{ position: 'absolute', inset: 0, display: activa ? 'block' : 'none' }}>
              <Pantalla id="raiz" cubierta={pila.some((e) => e.fase !== 'saliendo')} onRefrescar={refrescar} sinBarraInferior={sinBarra}>
                <Suspense fallback={<Cargando />}>
                  <Comp key={refreshKey} />
                </Suspense>
              </Pantalla>
              {pila.map((e, i) => (
                <Pantalla key={e.key} id={e.key} fase={e.fase} puedeVolver onPop={pop} onRefrescar={refrescar} sinBarraInferior={sinBarra}
                  cubierta={i < topIdx && pila.slice(i + 1).some((x) => x.fase !== 'saliendo')}>
                  <Suspense fallback={<Cargando />}>{e.el}</Suspense>
                </Pantalla>
              ))}
            </div>
          );
        })}

        <BarraSuperior modo={modo} tab={tab} badge={contador.pilas} badgeCritica={contador.criticaNueva} perfil={perfil}
          onMenu={() => setCajonAbierto(true)} onBuscar={() => alternarTab('buscar')} onAlertas={() => alternarTab('alertas')} onAvatar={() => setPerfilAbierto(true)} />

        {modo === 'barra' && <BarraGrupos arbol={arbol} activo={activoBarra} onEntrada={onEntradaBarra} perfil={perfil} />}
        {modo === 'cajon' && <Cajon abierto={cajonAbierto} arrastre={arrastreCajon} onClose={() => setCajonAbierto(false)} onAbrirPerfil={() => setPerfilAbierto(true)} />}

        <HojaM abierto={hojaAbierta && !!hoja} onClose={cerrarHoja} titulo={hoja?.titulo} sub={hoja?.sub} alto={hoja?.alto || '78vh'} acciones={hoja?.acciones}>
          {hoja?.contenido}
        </HojaM>

        {perfilAbierto && (
          <Suspense fallback={null}>
            <PreferenciasHoja abierto={perfilAbierto} onClose={() => setPerfilAbierto(false)} perfil={perfil} onCerrarSesion={onCerrarSesion}
              onNavegar={(ck, pagina) => navegar({ clienteKey: ck, pagina })} />
          </Suspense>
        )}
      </div>
    </NavContext.Provider>
  );
}
