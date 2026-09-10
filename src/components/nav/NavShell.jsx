// NavShell · elige el modo de menú según preferencias del usuario (barra · sidebar · iphone),
// renderiza chrome + contenido y expone { onNavegar, favoritos, toggleFavorito, abrirPaleta } vía useNav().
// Atajos: ⌘K paleta · ⌘1-9 favoritos · ? hoja de atajos · Esc cierra.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../lib/themeContext';
import { usePreferencias } from '../../lib/preferencias';
import Topbar from '../Topbar';
import { TYPO } from '../../lib/themeTokens';
import CentroNotificaciones from '../notificaciones';
import { construirArbol, resolverFavoritos, irANodo } from './arbol';
import BarraApple from './BarraApple';
import SidebarIpad from './SidebarIpad';
import BarraIphone, { IPHONE_PADDING_INFERIOR } from './BarraIphone';
import Paleta from './Paleta';
import AtajosHoja from './AtajosHoja';

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

  const arbol = useMemo(() => construirArbol(perfilUsuario), [perfilUsuario]);
  const favs = useMemo(() => resolverFavoritos(arbol, favoritos), [arbol, favoritos]);
  const estado = useMemo(() => ({ clienteActivo, paginaActiva, vistaActual }), [clienteActivo, paginaActiva, vistaActual]);

  const abrirPaleta = useCallback(() => { setAtajos(false); setPaleta(true); }, []);
  const navegar = useCallback((c, p) => { setPaleta(false); setAtajos(false); onNavegar?.(c, p); }, [onNavegar]);

  // Atajos globales
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !e.shiftKey && !e.altKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); setPaleta((v) => !v); return; }
      if (mod && !e.shiftKey && !e.altKey && /^[1-9]$/.test(e.key)) {
        const n = favs[Number(e.key) - 1];
        if (n) { e.preventDefault(); irANodo(n, navegar); }
        return;
      }
      if (e.key === '?' && !mod && !enCampoDeTexto(e.target)) { e.preventDefault(); setPaleta(false); setAtajos((v) => !v); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [favs, navegar]);

  const ctx = useMemo(() => ({ onNavegar: navegar, favoritos, toggleFavorito, abrirPaleta, modo, arbol }), [navegar, favoritos, toggleFavorito, abrirPaleta, modo, arbol]);
  const chrome = { onNavegar: navegar, onCerrarSesion, perfilUsuario, modoPresent, onToggleModoPresent, onAbrirPaleta: abrirPaleta, onAbrirAtajos: () => setAtajos(true) };
  const comunNav = { arbol, favoritos, toggleFavorito, estado, onNavegar: navegar, onAbrirPaleta: abrirPaleta, densidad: menu.densidad, modoPresent };

  const fondo = { background: 'var(--t-bg, #F5F5F7)', color: theme.text };
  const flotantes = (
    <>
      <Paleta abierto={paleta} onClose={() => setPaleta(false)} arbol={arbol} onNavegar={navegar} perfil={perfilUsuario} />
      <AtajosHoja abierto={atajos} onClose={() => setAtajos(false)} favoritos={favs} />
    </>
  );

  let cuerpo;
  if (modo === 'barra') {
    cuerpo = (
      <div className="font-sans" style={{ ...fondo, display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <BarraApple {...comunNav} chrome={chrome} onAbrirAtajos={() => setAtajos(true)} />
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
        <BarraIphone {...comunNav} campana={<CentroNotificaciones onNavegar={navegar} />} />
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
    if (!n) return estado?.paginaActiva === 'configuracion' ? 'Configuración' : '';
    const cli = estado?.clienteActivo ? (todos.find((x) => x.tipo === 'cliente' && x.clienteKey === estado.clienteActivo && x.pagina === 'home')?.label || '') : '';
    return cli && n.pagina !== 'home' ? `${n.label} · ${cli}` : (cli || n.label);
  } catch { return ''; }
}
function MarcaIphone({ theme, titulo }) {
  return (
    <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 10, marginRight: 'auto' }}>
      <span style={{ width: 28, height: 28, borderRadius: 8, background: theme.key === 'midnight' ? theme.accent : theme.text, color: theme.key === 'midnight' ? '#000' : '#FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: TYPO.fontDisplay, fontWeight: 700, fontSize: 13 }}>a</span>
      <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text }}>{titulo || 'Acteck'}</span>
    </div>
  );
}
