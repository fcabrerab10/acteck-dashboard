// NavShell · elige el modo de menú según preferencias del usuario (barra · sidebar · iphone),
// renderiza chrome + contenido y expone { onNavegar, favoritos, toggleFavorito, abrirPaleta } vía useNav().
// Atajos: ⌘K paleta · ⌘1-9 favoritos · ? hoja de atajos · Esc cierra.
import React, { Suspense, createContext, lazy, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { abrirDiferido } from '../../lib/montajeDiferido';
import { useTheme } from '../../lib/themeContext';
import { usePreferencias } from '../../lib/preferencias';
import Topbar from '../Topbar';
import { TYPO } from '../../lib/themeTokens';
import { Logotipo } from './comun';
import { construirArbol, resolverFavoritos, irANodo } from './arbol';
import BarraApple from './BarraApple';
import SidebarIpad from './SidebarIpad';
import BarraIphone, { IPHONE_PADDING_INFERIOR } from './BarraIphone';

// Flotantes y centro de avisos: perezosos (2026-09-12). Estaban montados siempre
// (con `abierto={false}`), así que sus ~20 KB viajaban en el chunk de arranque para
// algo que sólo aparece al pulsar ⌘K, «?» o la campana. Ahora se montan al abrirse
// y se quedan montados, para conservar su animación de salida. `prefetchFlotantes()`
// los pide en el ralentí, así que ⌘K sigue abriendo en el acto.
const Paleta            = lazy(() => import('./Paleta'));
const AtajosHoja        = lazy(() => import('./AtajosHoja'));
const CuerpoNotificaciones = lazy(() => import('../notificaciones/CuerpoNotificaciones'));

let flotantesPedidos = false;
export function prefetchFlotantes() {
  if (flotantesPedidos || typeof window === 'undefined') return;
  flotantesPedidos = true;
  Promise.all([import('./Paleta'), import('./AtajosHoja')]).catch(() => { flotantesPedidos = false; });
}

const NavContext = createContext({ onNavegar: () => {}, favoritos: [], toggleFavorito: () => {}, abrirPaleta: () => {}, modo: 'sidebar' });
export const useNav = () => useContext(NavContext);

const enCampoDeTexto = (el) => {
  if (!el) return false;
  const tag = (el.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
};

export default function NavShell({ clienteActivo, paginaActiva, vistaActual, onNavegar, onCerrarSesion, perfilUsuario, modoPresent, onToggleModoPresent, children }) {
  const { theme } = useTheme();
  const { menu, favoritos, toggleFavorito } = usePreferencias();
  const modo = ['barra', 'sidebar', 'iphone'].includes(menu.modo) ? menu.modo : 'sidebar';
  const [paleta, setPaleta] = useState(false);
  const [atajos, setAtajos] = useState(false);
  // Se montan la primera vez que se abren (cerrados, un frame antes de abrirse: ver
  // lib/montajeDiferido) y ya no se desmontan, para conservar también la animación de salida.
  const [montados, setMontados] = useState({ paleta: false, atajos: false });
  const montadosRef = useRef(montados);
  const abiertoRef = useRef({ paleta: false, atajos: false });
  abiertoRef.current = { paleta, atajos };
  useEffect(() => { prefetchFlotantes(); }, []);

  const mostrarPaleta = useCallback((v) => {
    if (!v) { setPaleta(false); return; }
    abrirDiferido({
      cargar: () => import('./Paleta'),
      yaMontado: montadosRef.current.paleta,
      montar: () => { montadosRef.current = { ...montadosRef.current, paleta: true }; setMontados(montadosRef.current); },
      abrir: () => setPaleta(true),
    });
  }, []);
  const mostrarAtajos = useCallback((v) => {
    if (!v) { setAtajos(false); return; }
    abrirDiferido({
      cargar: () => import('./AtajosHoja'),
      yaMontado: montadosRef.current.atajos,
      montar: () => { montadosRef.current = { ...montadosRef.current, atajos: true }; setMontados(montadosRef.current); },
      abrir: () => setAtajos(true),
    });
  }, []);

  const arbol = useMemo(() => construirArbol(perfilUsuario), [perfilUsuario]);
  const favs = useMemo(() => resolverFavoritos(arbol, favoritos), [arbol, favoritos]);
  const estado = useMemo(() => ({ clienteActivo, paginaActiva, vistaActual }), [clienteActivo, paginaActiva, vistaActual]);

  const abrirPaleta = useCallback(() => { setAtajos(false); mostrarPaleta(true); }, [mostrarPaleta]);
  const navegar = useCallback((c, p) => { setPaleta(false); setAtajos(false); onNavegar?.(c, p); }, [onNavegar]);

  // Atajos globales
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !e.shiftKey && !e.altKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); mostrarPaleta(!abiertoRef.current.paleta); return; }
      if (mod && !e.shiftKey && !e.altKey && /^[1-9]$/.test(e.key)) {
        const n = favs[Number(e.key) - 1];
        if (n) { e.preventDefault(); irANodo(n, navegar); }
        return;
      }
      if (e.key === '?' && !mod && !enCampoDeTexto(e.target)) { e.preventDefault(); setPaleta(false); mostrarAtajos(!abiertoRef.current.atajos); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [favs, navegar, mostrarPaleta, mostrarAtajos]);

  const ctx = useMemo(() => ({ onNavegar: navegar, favoritos, toggleFavorito, abrirPaleta, modo, arbol }), [navegar, favoritos, toggleFavorito, abrirPaleta, modo, arbol]);
  const chrome = { onNavegar: navegar, onCerrarSesion, perfilUsuario, modoPresent, onToggleModoPresent, onAbrirPaleta: abrirPaleta, onAbrirAtajos: () => mostrarAtajos(true) };
  const comunNav = { arbol, favoritos, toggleFavorito, estado, onNavegar: navegar, onAbrirPaleta: abrirPaleta, densidad: menu.densidad, modoPresent, perfil: perfilUsuario };

  const fondo = { background: 'var(--t-bg, #F5F5F7)', color: theme.text };
  const flotantes = (
    <Suspense fallback={null}>
      {montados.paleta && <Paleta abierto={paleta} onClose={() => setPaleta(false)} arbol={arbol} onNavegar={navegar} perfil={perfilUsuario} />}
      {montados.atajos && <AtajosHoja abierto={atajos} onClose={() => setAtajos(false)} favoritos={favs} />}
    </Suspense>
  );

  let cuerpo;
  if (modo === 'barra') {
    cuerpo = (
      <div className="font-sans" style={{ ...fondo, display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <BarraApple {...comunNav} chrome={chrome} onAbrirAtajos={() => mostrarAtajos(true)} />
        <main style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>{children}</main>
      </div>
    );
  } else if (modo === 'iphone') {
    cuerpo = (
      <div className="font-sans" style={{ ...fondo, display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <main style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingBottom: `calc(${IPHONE_PADDING_INFERIOR}px + env(safe-area-inset-bottom))` }}>
          <Topbar {...chrome} mostrarBuscar marca={<MarcaIphone theme={theme} titulo={tituloDe(arbol, estado)} />} />
          {/* Como una app de iPad: columna centrada con márgenes generosos */}
          <div style={{ maxWidth: 1040, margin: '0 auto', width: '100%' }}>{children}</div>
        </main>
        <BarraIphone {...comunNav} campana={<Suspense fallback={<div style={{ height: 220 }} />}><CuerpoNotificaciones onNavegar={navegar} maxAlto="60vh" /></Suspense>} />
      </div>
    );
  } else {
    cuerpo = (
      <div className="font-sans" style={{ ...fondo, display: 'flex', height: '100vh' }}>
        <SidebarIpad {...comunNav} />
        <main style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
          <Topbar {...chrome} />
          {children}
        </main>
      </div>
    );
  }

  return (
    <NavContext.Provider value={ctx}>
      {cuerpo}
      {flotantes}
    </NavContext.Provider>
  );
}


// ── Modo iPhone · marca + título grande de la pestaña activa (como Notas/Ajustes en iPad) ──
function tituloDe(arbol, estado) {
  try {
    const todos = (arbol || []).flatMap((g) => g.nodos || []);
    const n = todos.find((x) => (estado?.clienteActivo ? x.clienteKey === estado.clienteActivo && x.pagina === estado.paginaActiva : !x.clienteKey && x.pagina === estado?.paginaActiva));
    if (!n) return estado?.paginaActiva === 'configuracion' ? 'Administración' : '';
    const cli = estado?.clienteActivo ? (todos.find((x) => x.tipo === 'cliente' && x.clienteKey === estado.clienteActivo && x.pagina === 'home')?.label || '') : '';
    return cli && n.pagina !== 'home' ? `${n.label} · ${cli}` : (cli || n.label);
  } catch { return ''; }
}
function MarcaIphone({ theme, titulo }) {
  return (
    <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'baseline', gap: 8, marginRight: 'auto', minWidth: 0 }}>
      <Logotipo theme={theme} size={16} />
      {titulo && (
        <>
          <span style={{ fontSize: 13, color: theme.textSubtle || theme.textMuted }}>·</span>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titulo}</span>
        </>
      )}
    </div>
  );
}
