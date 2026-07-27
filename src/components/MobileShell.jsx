// MobileShell — navegación estilo Fitness/Activity de iOS para teléfono e iPad.
// Reemplaza al MobileNav clásico. Compatible con los 3 temas (Claro/Midnight/Marfil).
//
// Layout:
//   ┌─────────────────────────┐
//   │  Cliente ▾    ☰   FC   │  ← Header 62px (avatar + client switcher)
//   │  [DL][DT][PC][ML]       │  ← Carrusel horizontal de clientes
//   │                         │
//   │      contenido          │  ← children (scroll natural)
//   │                         │
//   │  ┌──── tab bar ────┐   │  ← Bottom tab bar floating con blur
//   └──┴─────────────────┴────┘
//
// Gestos:
//   • Swipe/scroll snap en carrusel de clientes
//   • Tap en nombre de cliente → sheet superior (client switcher)
//   • Tap en ☰ o long-press en tab activa → drawer con Sidebar completo
//   • Bottom sheet + button → quick actions
//   • Tab bar con blur y scale al press

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { LogOut, Plus, Menu, ChevronDown, Check, Home, ShoppingCart, ShoppingBag, Megaphone, Wallet, CreditCard, BarChart3, Calculator, Calendar, Package, Layers, ClipboardList, FileText } from 'lucide-react';
import Sidebar, { CLIENTES } from './Sidebar';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';
import { puedeVerCliente, puedeVerPestanaCliente, puedeVerPestanaGlobal } from '../lib/permisos';

// ─────────────── Constantes de layout ───────────────
export const MOBILE_SHELL_TOP_HEIGHT = 108;    // header 62 + carrusel 46
export const MOBILE_SHELL_BOTTOM_HEIGHT = 84;  // tabbar 68 + safe area buffer

// ─────────────── Mapping títulos ───────────────
const TITULOS = {
  estadoResultados: 'Estado de resultados',
  visionGeneral: 'Visión general',
  analisisClientes: 'Análisis',
  sellIn: 'Sell In',
  sellOut: 'Sell Out',
  inventarioGlobal: 'Inventario',
  cobranzaGlobal: 'Cobranza',
  forecastClientes: 'S&OP',
  resumenClientes: 'Resumen',
  propuestas: 'Propuestas',
  estrategiaPrecios: 'Precios',
  ordenesCompra: 'Tracking',
  adminInterna: 'Pendientes',
  telemetria: 'Equipo',
  axonMexico: 'Axon',
  configuracion: 'Configuración',
  home: 'Resumen',
  estrategia: 'Sell Out',
  marketing: 'Marketing',
  pagos: 'Pagos',
  cartera: 'Cartera',
};

// Colores por cliente para el chip del carrusel (light-neutral, se combinan con theme)
const CLIENTE_DOT = {
  digitalife: '#5E5CE6',
  dicotech:   '#FF9F0A',
  pcel:       '#30D158',
  mercadolibre: '#FFCC00',
};

// Iconos por pestaña (para el bottom tabbar en modo cliente)
const TAB_ICONS = {
  home: Home,
  sellIn: ShoppingCart,
  estrategia: ShoppingBag,
  marketing: Megaphone,
  pagos: Wallet,
  cartera: CreditCard,
  // globales
  resumenClientes: Home,
  estadoResultados: Calculator,
  visionGeneral: BarChart3,
  sellOut: ShoppingBag,
  inventarioGlobal: Package,
  cobranzaGlobal: Wallet,
  forecastClientes: Layers,
  ordenesCompra: ClipboardList,
  adminInterna: Calendar,
  propuestas: FileText,
  telemetria: BarChart3,
};

// Tabs globales para cuando no hay cliente activo
const TABS_GLOBAL = [
  { id: 'resumenClientes',  label: 'Resumen', permiso: 'resumen_clientes' },
  { id: 'estadoResultados', label: 'EdR',     permiso: 'estado_resultados' },
  { id: 'sellOut',          label: 'Ventas',  permiso: 'sell_out' },
  { id: 'cobranzaGlobal',   label: 'Pagos',   permiso: 'cobranza_global' },
];

// ─────────────── Componente ───────────────
export default function MobileShell({
  clienteActivo,
  paginaActiva,
  vistaActual,
  onNavegar,
  onCerrarSesion,
  perfilUsuario,
}) {
  const { theme } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const carouselRef = useRef(null);
  const isDark = theme.mode === 'dark';

  // Cerrar sheets al navegar
  useEffect(() => {
    setDrawerOpen(false);
    setSwitcherOpen(false);
    setQuickOpen(false);
  }, [clienteActivo, paginaActiva]);

  // Bloquear scroll cuando hay overlay abierto
  useEffect(() => {
    const open = drawerOpen || switcherOpen || quickOpen;
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [drawerOpen, switcherOpen, quickOpen]);

  const showToast = (msg) => {
    setToast(msg);
    if (navigator.vibrate) navigator.vibrate(10);
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => setToast(null), 1600);
  };

  // ── Clientes visibles según permisos
  const clientesVisibles = useMemo(() => {
    return Object.entries(CLIENTES)
      .filter(([id, c]) => c.activo && puedeVerCliente(perfilUsuario, id))
      .map(([id, c]) => ({ id, ...c }));
  }, [perfilUsuario]);

  // ── Tabs contextuales según cliente activo
  const tabs = useMemo(() => {
    if (clienteActivo) {
      const cli = CLIENTES[clienteActivo];
      if (!cli) return [];
      return cli.pestanas
        .filter((t) => !t.disabled && puedeVerPestanaCliente(perfilUsuario, clienteActivo, t.id))
        .slice(0, 4)
        .map((t) => ({ id: t.id, label: t.label, cliente: clienteActivo, permiso: null }));
    }
    return TABS_GLOBAL.filter((t) => !t.permiso || puedeVerPestanaGlobal(perfilUsuario, t.permiso));
  }, [clienteActivo, perfilUsuario]);

  const isActive = (tab) => {
    if (tab.cliente) return clienteActivo === tab.cliente && paginaActiva === tab.id;
    return clienteActivo === null && paginaActiva === tab.id;
  };

  const titulo = clienteActivo
    ? CLIENTES[clienteActivo]?.label || clienteActivo
    : (TITULOS[paginaActiva] || 'Global');

  const subtitulo = clienteActivo ? (TITULOS[paginaActiva] || paginaActiva) : 'Vista global';

  const iniciales = (perfilUsuario?.nombre || perfilUsuario?.email || 'FC')
    .split(/\s+|@/)[0].slice(0, 2).toUpperCase();

  const chromeSurface = isDark
    ? 'rgba(20,20,22,0.72)'
    : (theme.key === 'marfil' ? 'rgba(247,243,236,0.82)' : 'rgba(255,255,255,0.78)');

  return (
    <>
      {/* ─── HEADER (avatar + client switcher + carrusel) ─── */}
      <header
        style={{
          position: 'sticky', top: 0, zIndex: 40,
          paddingTop: 'env(safe-area-inset-top)',
          background: chromeSurface,
          backdropFilter: 'saturate(180%) blur(24px)',
          WebkitBackdropFilter: 'saturate(180%) blur(24px)',
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        {/* Row 1: avatar + título + drawer */}
        <div style={{
          display: 'grid', gridTemplateColumns: '44px 1fr 44px',
          alignItems: 'center', padding: '10px 14px', gap: 6,
          height: 62,
        }}>
          <button
            onClick={() => showToast(perfilUsuario?.nombre || 'Perfil')}
            aria-label="Perfil"
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple || theme.accentHover})`,
              color: '#fff', border: 'none', cursor: 'pointer',
              display: 'grid', placeItems: 'center',
              fontFamily: TYPO.fontDisplay, fontWeight: 700, fontSize: 13,
              letterSpacing: '.02em',
            }}
          >{iniciales}</button>

          <button
            onClick={() => setSwitcherOpen(true)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 1, minWidth: 0,
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '4px 8px', borderRadius: 12,
              transition: 'background 160ms cubic-bezier(.4,0,.2,1), transform 160ms',
            }}
            onPointerDown={(e) => e.currentTarget.style.transform = 'scale(.97)'}
            onPointerUp={(e) => e.currentTarget.style.transform = ''}
            onPointerLeave={(e) => e.currentTarget.style.transform = ''}
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, color: theme.text,
              fontFamily: TYPO.fontDisplay, fontSize: 17, fontWeight: 700,
              letterSpacing: '-.015em', maxWidth: '100%',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: clienteActivo ? (CLIENTE_DOT[clienteActivo] || theme.accent) : theme.textMuted,
                flex: '0 0 auto',
              }} />
              {titulo}
              <ChevronDown size={16} style={{ color: theme.textMuted, strokeWidth: 2.2 }} />
            </div>
            <div style={{
              color: theme.textMuted, fontFamily: TYPO.fontText,
              fontSize: 11.5, fontWeight: 500, letterSpacing: '.01em',
              maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{subtitulo}</div>
          </button>

          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Menú completo"
            style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: theme.text, display: 'grid', placeItems: 'center',
              transition: 'background 160ms',
            }}
            onPointerDown={(e) => e.currentTarget.style.background = theme.surfaceHover}
            onPointerUp={(e) => e.currentTarget.style.background = 'transparent'}
            onPointerLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <Menu size={22} strokeWidth={2} />
          </button>
        </div>

        {/* Row 2: Carrusel de clientes */}
        <div
          ref={carouselRef}
          style={{
            display: 'flex', gap: 8, overflowX: 'auto', overflowY: 'hidden',
            padding: '0 14px 10px',
            scrollSnapType: 'x mandatory',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
          className="ms-hide-scroll"
        >
          {/* chip Global */}
          <ChipCliente
            active={clienteActivo === null}
            onClick={() => onNavegar(null, 'resumenClientes')}
            theme={theme}
            dot={theme.textMuted}
          >Global</ChipCliente>
          {clientesVisibles.map((c) => (
            <ChipCliente
              key={c.id}
              active={clienteActivo === c.id}
              onClick={() => {
                const cli = CLIENTES[c.id];
                const primeraPestana = cli.pestanas.find((p) => !p.disabled && puedeVerPestanaCliente(perfilUsuario, c.id, p.id));
                onNavegar(c.id, primeraPestana?.id || 'home');
              }}
              theme={theme}
              dot={CLIENTE_DOT[c.id] || theme.accent}
            >{c.label}</ChipCliente>
          ))}
        </div>
      </header>

      {/* ─── BOTTOM TAB BAR floating ─── */}
      {tabs.length > 0 && (
        <nav
          aria-label="Navegación principal"
          style={{
            position: 'fixed',
            left: 'max(12px, env(safe-area-inset-left))',
            right: 'max(12px, env(safe-area-inset-right))',
            bottom: 'calc(env(safe-area-inset-bottom) + 12px)',
            maxWidth: 640,
            marginLeft: 'auto', marginRight: 'auto',
            height: 68,
            background: chromeSurface,
            backdropFilter: 'saturate(180%) blur(28px)',
            WebkitBackdropFilter: 'saturate(180%) blur(28px)',
            border: `1px solid ${theme.border}`,
            borderRadius: 26,
            display: 'grid',
            gridTemplateColumns: `repeat(${tabs.length + 1}, 1fr)`,
            padding: 6,
            zIndex: 39,
            boxShadow: isDark
              ? '0 20px 40px rgba(0,0,0,.5), 0 0 0 .5px rgba(255,255,255,.04)'
              : '0 14px 40px rgba(0,0,0,.10)',
          }}
        >
          {tabs.map((t) => {
            const Icon = TAB_ICONS[t.id] || Home;
            const on = isActive(t);
            return (
              <TabButton
                key={`${t.cliente || 'g'}-${t.id}`}
                active={on}
                onClick={() => onNavegar(t.cliente || null, t.id)}
                theme={theme}
                icon={<Icon size={22} strokeWidth={on ? 2.2 : 1.9} />}
                label={t.label}
              />
            );
          })}
          {/* + button (central) */}
          <button
            onClick={() => setQuickOpen(true)}
            aria-label="Acciones rápidas"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              display: 'grid', placeItems: 'center', padding: 0,
              minHeight: 44,
              transition: 'transform 160ms cubic-bezier(.34,1.56,.64,1)',
            }}
            onPointerDown={(e) => e.currentTarget.style.transform = 'scale(.9)'}
            onPointerUp={(e) => e.currentTarget.style.transform = ''}
            onPointerLeave={(e) => e.currentTarget.style.transform = ''}
          >
            <span style={{
              width: 46, height: 46, borderRadius: '50%',
              background: theme.accent, color: '#fff',
              display: 'grid', placeItems: 'center',
              boxShadow: isDark ? '0 8px 20px rgba(10,132,255,.5)' : '0 6px 18px rgba(0,122,255,.35)',
            }}>
              <Plus size={22} strokeWidth={2.4} />
            </span>
          </button>
        </nav>
      )}

      {/* ─── CLIENT SWITCHER (top sheet) ─── */}
      <TopSheet open={switcherOpen} onClose={() => setSwitcherOpen(false)} theme={theme}>
        <div style={{
          fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 700,
          letterSpacing: '-.015em', color: theme.text, marginBottom: 14,
        }}>Cambiar contexto</div>

        <SwitchRow
          theme={theme}
          swatchBg={theme.textMuted}
          label="Global"
          sub="Vista consolidada"
          checked={clienteActivo === null}
          onClick={() => { onNavegar(null, 'resumenClientes'); setSwitcherOpen(false); }}
        />
        {clientesVisibles.map((c) => (
          <SwitchRow
            key={c.id}
            theme={theme}
            swatchBg={CLIENTE_DOT[c.id] || theme.accent}
            label={c.label}
            sub={`${c.pestanas.length} pestañas`}
            checked={clienteActivo === c.id}
            onClick={() => {
              const cli = CLIENTES[c.id];
              const primeraPestana = cli.pestanas.find((p) => !p.disabled && puedeVerPestanaCliente(perfilUsuario, c.id, p.id));
              onNavegar(c.id, primeraPestana?.id || 'home');
              setSwitcherOpen(false);
            }}
          />
        ))}
      </TopSheet>

      {/* ─── QUICK ACTIONS (bottom sheet) ─── */}
      <BottomSheet open={quickOpen} onClose={() => setQuickOpen(false)} theme={theme}>
        <div style={{
          fontFamily: TYPO.fontDisplay, fontSize: 24, fontWeight: 700,
          letterSpacing: '-.02em', color: theme.text, marginBottom: 14,
        }}>Acciones rápidas</div>
        <QuickItem theme={theme} icon={<Calendar size={20} />} label="Nueva tarea o evento"
          onClick={() => { onNavegar(null, 'adminInterna'); setQuickOpen(false); }} />
        <QuickItem theme={theme} icon={<FileText size={20} />} label="Nueva propuesta"
          onClick={() => { onNavegar(null, 'propuestas'); setQuickOpen(false); }} />
        <QuickItem theme={theme} icon={<ClipboardList size={20} />} label="Ver tracking pedidos"
          onClick={() => { onNavegar(null, 'ordenesCompra'); setQuickOpen(false); }} />
        <QuickItem theme={theme} icon={<Package size={20} />} label="Inventario global"
          onClick={() => { onNavegar(null, 'inventarioGlobal'); setQuickOpen(false); }} />
        {onCerrarSesion && (
          <QuickItem theme={theme} icon={<LogOut size={20} />} label="Cerrar sesión" danger
            onClick={() => { onCerrarSesion(); setQuickOpen(false); }} />
        )}
      </BottomSheet>

      {/* ─── DRAWER completo (Sidebar) ─── */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 55,
            background: 'rgba(0,0,0,.45)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            animation: 'msFadeIn 220ms cubic-bezier(.4,0,.2,1)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '86vw', maxWidth: 360, height: '100vh',
              background: theme.sidebar,
              paddingTop: 'env(safe-area-inset-top)',
              paddingLeft: 'env(safe-area-inset-left)',
              display: 'flex', flexDirection: 'column',
              animation: 'msSlideIn 340ms cubic-bezier(.32,.72,0,1)',
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

      {/* ─── TOAST ─── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom) + 100px)',
          left: '50%', transform: 'translateX(-50%)',
          background: isDark ? 'rgba(50,50,55,.94)' : 'rgba(30,30,32,.92)',
          color: '#fff',
          backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
          padding: '12px 18px', borderRadius: 100,
          fontFamily: TYPO.fontText, fontSize: 13.5, fontWeight: 600,
          zIndex: 60, whiteSpace: 'nowrap',
          animation: 'msToast 240ms cubic-bezier(.34,1.56,.64,1)',
          boxShadow: '0 10px 30px rgba(0,0,0,.3)',
        }}>{toast}</div>
      )}

      <style>{`
        .ms-hide-scroll::-webkit-scrollbar { display: none; }
        @keyframes msFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes msSlideIn { from { transform: translateX(-100%) } to { transform: translateX(0) } }
        @keyframes msSlideDown { from { transform: translateY(-100%) } to { transform: translateY(0) } }
        @keyframes msSlideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes msToast { from { opacity: 0; transform: translate(-50%, 12px) } to { opacity: 1; transform: translate(-50%, 0) } }
      `}</style>
    </>
  );
}

// ─────────────── Sub-componentes ───────────────
function ChipCliente({ active, onClick, children, theme, dot }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: '0 0 auto', scrollSnapAlign: 'start',
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '9px 14px', borderRadius: 100,
        background: active ? theme.text : theme.surface,
        color: active ? theme.bg : theme.text,
        border: `1px solid ${active ? theme.text : theme.border}`,
        fontFamily: TYPO.fontText, fontSize: 13.5, fontWeight: 600,
        letterSpacing: '-.005em',
        cursor: 'pointer',
        transition: 'background 200ms cubic-bezier(.4,0,.2,1), color 200ms, transform 160ms',
        whiteSpace: 'nowrap',
      }}
      onPointerDown={(e) => e.currentTarget.style.transform = 'scale(.96)'}
      onPointerUp={(e) => e.currentTarget.style.transform = ''}
      onPointerLeave={(e) => e.currentTarget.style.transform = ''}
    >
      <span style={{
        width: 7, height: 7, borderRadius: '50%', background: dot, flex: '0 0 auto',
      }} />
      {children}
    </button>
  );
}

function TabButton({ active, onClick, theme, icon, label }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent', border: 'none', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 2, padding: 4, minHeight: 44,
        color: active ? theme.accent : theme.textMuted,
        borderRadius: 20,
        transition: 'color 160ms, transform 160ms cubic-bezier(.34,1.56,.64,1)',
        transform: pressed ? 'scale(.9)' : 'scale(1)',
        position: 'relative',
      }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
    >
      {icon}
      <span style={{
        fontFamily: TYPO.fontText, fontSize: 10.5, fontWeight: active ? 700 : 500,
        letterSpacing: '.01em', lineHeight: 1,
      }}>{label}</span>
      {active && (
        <span style={{
          position: 'absolute', bottom: -2,
          width: 4, height: 4, borderRadius: '50%',
          background: theme.accent,
        }} />
      )}
    </button>
  );
}

function TopSheet({ open, onClose, theme, children }) {
  if (!open) return null;
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

function BottomSheet({ open, onClose, theme, children }) {
  const sheetRef = useRef(null);
  const startY = useRef(null);
  const curY = useRef(0);
  const isDark = theme.mode === 'dark';

  if (!open) return null;

  const onPointerDown = (e) => {
    if (!e.target.closest('[data-grip]')) return;
    startY.current = e.clientY;
    curY.current = 0;
    if (sheetRef.current) sheetRef.current.style.transition = 'none';
  };
  const onPointerMove = (e) => {
    if (startY.current === null) return;
    const dy = Math.max(0, e.clientY - startY.current);
    curY.current = dy;
    if (sheetRef.current) sheetRef.current.style.transform = `translateY(${dy}px)`;
  };
  const onPointerUp = () => {
    if (startY.current === null) return;
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'transform 340ms cubic-bezier(.34,1.56,.64,1)';
      sheetRef.current.style.transform = '';
    }
    if (curY.current > 90) onClose();
    startY.current = null;
    curY.current = 0;
  };

  return (
    <div
      onClick={onClose}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(0,0,0,.4)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        animation: 'msFadeIn 220ms',
      }}
    >
      <div
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={onPointerDown}
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: isDark ? theme.bgAlt : theme.surface,
          borderRadius: '24px 24px 0 0',
          padding: '12px 20px calc(env(safe-area-inset-bottom) + 28px)',
          maxWidth: 640, marginLeft: 'auto', marginRight: 'auto',
          animation: 'msSlideUp 420ms cubic-bezier(.34,1.56,.64,1)',
          boxShadow: '0 -20px 60px rgba(0,0,0,.35)',
          touchAction: 'none',
        }}
      >
        <div data-grip style={{
          width: 40, height: 5, background: theme.divider,
          borderRadius: 3, margin: '0 auto 16px', cursor: 'grab',
        }} />
        {children}
      </div>
    </div>
  );
}

function QuickItem({ theme, icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 12px', marginTop: 8,
        background: theme.surfaceHover,
        border: 'none', borderRadius: 14,
        cursor: 'pointer', textAlign: 'left',
        color: danger ? theme.red : theme.text,
        fontFamily: TYPO.fontText, fontSize: 15.5, fontWeight: 600,
        transition: 'transform 160ms cubic-bezier(.34,1.56,.64,1), background 160ms',
      }}
      onPointerDown={(e) => e.currentTarget.style.transform = 'scale(.98)'}
      onPointerUp={(e) => e.currentTarget.style.transform = ''}
      onPointerLeave={(e) => e.currentTarget.style.transform = ''}
    >
      <span style={{
        width: 36, height: 36, borderRadius: 10,
        background: danger ? 'rgba(255,59,48,.15)' : theme.accentSoft || 'rgba(0,122,255,.12)',
        color: danger ? theme.red : theme.accent,
        display: 'grid', placeItems: 'center',
      }}>{icon}</span>
      {label}
    </button>
  );
}
