// MobileShell v2 — Health-style. Aplica 3 temas (Claro/Midnight/Marfil).
//
// Estructura simplificada:
//   ┌────────────────────────────────┐
//   │  [Digitalife ▾]         [FC]  │  ← Header 60px
//   │                                │
//   │        contenido               │  ← página (scroll natural)
//   │                                │
//   │  ┌──── 5 tab bar ─────────┐  │  ← Bottom tab bar 5 Lucide
//   └──┴─────────────────────────┴───┘
//
// 5 tabs Lucide: Resumen · Cliente · Hoy · Buscar · Yo
// Tap cliente pill → sheet switcher
// Tap avatar → drawer con Sidebar completo (Yo redirige aquí también)

import React, { useEffect, useState, useMemo } from 'react';
import { Home, User, Calendar, Search, Settings, ChevronDown, Check, LogOut } from 'lucide-react';
import Sidebar, { CLIENTES } from './Sidebar';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';
import { puedeVerCliente, puedeVerPestanaCliente } from '../lib/permisos';

// Alto del header/tabbar — el contenido usa esto para su padding
export const MOBILE_SHELL_TOP_HEIGHT = 60;
export const MOBILE_SHELL_BOTTOM_HEIGHT = 92; // 64 tabbar + ~28 gap + safe area

// Color por cliente
const CLIENTE_DOT = {
  digitalife: '#5856D6',
  dicotech:   '#FF9500',
  pcel:       '#34C759',
  mercadolibre: '#FFCC00',
};

// 5 tabs mobile (fijos)
const TABS = [
  { id: 'resumen', label: 'Resumen', Icon: Home,     nav: (nav) => nav(null, 'resumenClientes') },
  { id: 'cliente', label: 'Cliente', Icon: User,     nav: null }, // se resuelve al vuelo
  { id: 'hoy',     label: 'Hoy',     Icon: Calendar, nav: (nav) => nav(null, 'adminInterna') },
  { id: 'buscar',  label: 'Buscar',  Icon: Search,   nav: null }, // TODO: página búsqueda
  { id: 'yo',      label: 'Yo',      Icon: Settings, nav: null }, // abre drawer
];

export default function MobileShell({
  clienteActivo,
  paginaActiva,
  vistaActual,
  onNavegar,
  onCerrarSesion,
  perfilUsuario,
}) {
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  useEffect(() => { setDrawerOpen(false); setSwitcherOpen(false); }, [clienteActivo, paginaActiva, vistaActual]);

  useEffect(() => {
    if (drawerOpen || switcherOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [drawerOpen, switcherOpen]);

  // Clientes visibles
  const clientesVisibles = useMemo(() => (
    Object.entries(CLIENTES)
      .filter(([id, c]) => c.activo && puedeVerCliente(perfilUsuario, id))
      .map(([id, c]) => ({ id, ...c }))
  ), [perfilUsuario]);

  const clienteLabel = clienteActivo ? (CLIENTES[clienteActivo]?.label || clienteActivo) : 'Global';
  const dotColor = clienteActivo ? (CLIENTE_DOT[clienteActivo] || theme.accent) : theme.textMuted;

  const iniciales = (perfilUsuario?.nombre || perfilUsuario?.email || 'FC')
    .split(/\s+|@/)[0].slice(0, 2).toUpperCase();

  // Determinar tab activa
  const activeTab = useMemo(() => {
    if (vistaActual === 'configuracion') return 'yo';
    if (paginaActiva === 'resumenClientes' && !clienteActivo) return 'resumen';
    if (paginaActiva === 'adminInterna') return 'hoy';
    if (clienteActivo) return 'cliente';
    return 'resumen';
  }, [clienteActivo, paginaActiva, vistaActual]);

  const handleTab = (tab) => {
    if (tab.id === 'yo') { setDrawerOpen(true); return; }
    if (tab.id === 'cliente') {
      // Si ya hay cliente activo, quedarse. Si no, abrir switcher.
      if (clienteActivo) {
        const cli = CLIENTES[clienteActivo];
        const primera = cli?.pestanas?.find((p) => !p.disabled && puedeVerPestanaCliente(perfilUsuario, clienteActivo, p.id));
        onNavegar(clienteActivo, primera?.id || 'home');
      } else {
        setSwitcherOpen(true);
      }
      return;
    }
    if (tab.id === 'buscar') {
      // Placeholder — abre drawer por ahora
      setDrawerOpen(true);
      return;
    }
    if (tab.nav) tab.nav(onNavegar);
  };

  const chromeSurface = isDark ? 'rgba(20,20,22,0.72)' : (theme.key === 'marfil' ? 'rgba(247,243,236,0.86)' : 'rgba(255,255,255,0.82)');

  return (
    <>
      {/* ═══ HEADER 60px ═══ */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        paddingTop: 'env(safe-area-inset-top)',
        background: chromeSurface,
        backdropFilter: 'saturate(180%) blur(24px)',
        WebkitBackdropFilter: 'saturate(180%) blur(24px)',
        borderBottom: `1px solid ${theme.border}`,
      }}>
        <div style={{
          height: MOBILE_SHELL_TOP_HEIGHT, padding: '0 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          {/* Cliente pill */}
          <button
            onClick={() => setSwitcherOpen(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '8px 14px', borderRadius: 100,
              background: theme.surface, border: `1px solid ${theme.border}`,
              color: theme.text, cursor: 'pointer',
              fontFamily: TYPO.fontText, fontSize: 14, fontWeight: 600,
              letterSpacing: '-.005em', transition: 'transform 160ms cubic-bezier(.4,0,.2,1)',
              maxWidth: '70%',
            }}
            onPointerDown={(e) => e.currentTarget.style.transform = 'scale(.97)'}
            onPointerUp={(e) => e.currentTarget.style.transform = ''}
            onPointerLeave={(e) => e.currentTarget.style.transform = ''}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flex: '0 0 auto' }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clienteLabel}</span>
            <ChevronDown size={16} strokeWidth={2.2} style={{ color: theme.textMuted, flex: '0 0 auto' }} />
          </button>

          {/* Avatar → drawer */}
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Menú"
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: `linear-gradient(135deg, ${theme.pink || theme.accent}, ${theme.orange || theme.accentHover})`,
              color: '#fff', border: 'none', cursor: 'pointer',
              display: 'grid', placeItems: 'center',
              fontFamily: TYPO.fontDisplay, fontWeight: 700, fontSize: 12.5,
              letterSpacing: '.02em', flex: '0 0 auto',
            }}
          >{iniciales}</button>
        </div>
      </header>

      {/* ═══ BOTTOM TAB BAR 5 tabs Lucide ═══ */}
      <nav
        aria-label="Navegación"
        style={{
          position: 'fixed',
          left: 'max(10px, env(safe-area-inset-left))',
          right: 'max(10px, env(safe-area-inset-right))',
          bottom: 'calc(env(safe-area-inset-bottom) + 12px)',
          maxWidth: 720, marginLeft: 'auto', marginRight: 'auto',
          height: 64,
          background: chromeSurface,
          backdropFilter: 'saturate(180%) blur(28px)',
          WebkitBackdropFilter: 'saturate(180%) blur(28px)',
          border: `1px solid ${theme.border}`,
          borderRadius: 22,
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
          padding: 4, zIndex: 39,
          boxShadow: isDark
            ? '0 20px 40px rgba(0,0,0,.5), 0 0 0 .5px rgba(255,255,255,.04)'
            : '0 10px 30px rgba(0,0,0,.10)',
        }}
      >
        {TABS.map((t) => (
          <TabButton
            key={t.id}
            active={activeTab === t.id}
            onClick={() => handleTab(t)}
            theme={theme}
            Icon={t.Icon}
            label={t.label}
          />
        ))}
      </nav>

      {/* ═══ CLIENT SWITCHER (top sheet) ═══ */}
      {switcherOpen && (
        <TopSheet onClose={() => setSwitcherOpen(false)} theme={theme}>
          <div style={{
            fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 700,
            letterSpacing: '-.015em', color: theme.text, marginBottom: 14,
          }}>Cambiar contexto</div>

          <SwitchRow
            theme={theme} swatchBg={theme.textMuted}
            label="Global" sub="Vista consolidada"
            checked={clienteActivo === null}
            onClick={() => { onNavegar(null, 'resumenClientes'); setSwitcherOpen(false); }}
          />
          {clientesVisibles.map((c) => (
            <SwitchRow
              key={c.id} theme={theme}
              swatchBg={CLIENTE_DOT[c.id] || theme.accent}
              label={c.label} sub={`${c.pestanas.length} pestañas`}
              checked={clienteActivo === c.id}
              onClick={() => {
                const cli = CLIENTES[c.id];
                const primera = cli.pestanas.find((p) => !p.disabled && puedeVerPestanaCliente(perfilUsuario, c.id, p.id));
                onNavegar(c.id, primera?.id || 'home');
                setSwitcherOpen(false);
              }}
            />
          ))}
        </TopSheet>
      )}

      {/* ═══ DRAWER (Sidebar completo · abre desde tab Yo o avatar) ═══ */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 55,
            background: 'rgba(0,0,0,.45)',
            backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
            animation: 'msFadeIn 220ms cubic-bezier(.4,0,.2,1)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute', left: 0, top: 0,
              width: '86vw', maxWidth: 360, height: '100vh',
              background: theme.sidebar,
              paddingTop: 'env(safe-area-inset-top)',
              paddingLeft: 'env(safe-area-inset-left)',
              display: 'flex', flexDirection: 'column',
              animation: 'msSlideLeft 340ms cubic-bezier(.32,.72,0,1)',
              boxShadow: '4px 0 32px rgba(0,0,0,.25)',
            }}
          >
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <Sidebar
                clienteActivo={clienteActivo}
                paginaActiva={paginaActiva}
                onNavegar={(c, p) => { onNavegar(c, p); setDrawerOpen(false); }}
                onCerrarSesion={onCerrarSesion}
                perfilUsuario={perfilUsuario}
              />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes msFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes msSlideLeft { from { transform: translateX(-100%) } to { transform: translateX(0) } }
        @keyframes msSlideDown { from { transform: translateY(-100%) } to { transform: translateY(0) } }
      `}</style>
    </>
  );
}

// ─────────────── Sub-componentes ───────────────
function TabButton({ active, onClick, theme, Icon, label }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent', border: 'none', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 3, padding: 4, minHeight: 44,
        color: active ? theme.accent : theme.textMuted,
        borderRadius: 16,
        transition: 'color 160ms, transform 160ms cubic-bezier(.34,1.56,.64,1)',
        transform: pressed ? 'scale(.9)' : 'scale(1)',
        position: 'relative',
      }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
    >
      <Icon size={22} strokeWidth={active ? 2.2 : 1.9} />
      <span style={{
        fontFamily: TYPO.fontText, fontSize: 10.5, fontWeight: active ? 700 : 500,
        letterSpacing: '.01em', lineHeight: 1,
      }}>{label}</span>
    </button>
  );
}

function TopSheet({ onClose, theme, children }) {
  const isDark = theme.mode === 'dark';
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(0,0,0,.4)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        animation: 'msFadeIn 220ms',
        display: 'flex', flexDirection: 'column',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: isDark ? theme.bgAlt : theme.surface,
          borderRadius: '0 0 28px 28px',
          padding: 'calc(env(safe-area-inset-top) + 20px) 20px 24px',
          animation: 'msSlideDown 360ms cubic-bezier(.34,1.56,.64,1)',
          borderBottom: `1px solid ${theme.border}`,
          maxWidth: 640, marginLeft: 'auto', marginRight: 'auto',
          width: '100%',
        }}
      >
        {children}
        <div style={{ height: 12 }} />
        <button
          onClick={onClose}
          style={{
            width: '100%', padding: 14, borderRadius: 14,
            background: theme.surfaceHover, color: theme.text,
            border: 'none', cursor: 'pointer',
            fontFamily: TYPO.fontText, fontSize: 15, fontWeight: 600,
          }}
        >Cerrar</button>
      </div>
    </div>
  );
}

function SwitchRow({ theme, swatchBg, label, sub, checked, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 8px', background: 'transparent', border: 'none',
        borderTop: `1px solid ${theme.divider}`,
        cursor: 'pointer', textAlign: 'left',
        transition: 'background 160ms',
      }}
      onPointerDown={(e) => e.currentTarget.style.background = theme.surfaceHover}
      onPointerUp={(e) => e.currentTarget.style.background = 'transparent'}
      onPointerLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 12,
        background: swatchBg, display: 'grid', placeItems: 'center',
        color: '#fff', fontFamily: TYPO.fontDisplay, fontWeight: 700, fontSize: 14,
      }}>{label.slice(0, 2).toUpperCase()}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: theme.text, fontFamily: TYPO.fontDisplay,
          fontSize: 16, fontWeight: 600, letterSpacing: '-.01em',
        }}>{label}</div>
        <div style={{
          color: theme.textMuted, fontFamily: TYPO.fontText,
          fontSize: 12.5, fontWeight: 500, marginTop: 1,
        }}>{sub}</div>
      </div>
      {checked && <Check size={20} style={{ color: theme.accent, strokeWidth: 2.5 }} />}
    </button>
  );
}
