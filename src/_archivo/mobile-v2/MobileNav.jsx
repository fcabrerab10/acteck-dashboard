// MobileNav — reemplaza al Sidebar en breakpoint mobile (<768px).
// Renderiza:
//   - Top bar 56px sticky: hamburger + título pestaña + logout
//   - Bottom tab bar 60px iOS-style: 4 íconos fijos + "Más" abre drawer
//   - Drawer overlay: contiene el Sidebar completo
// Respeta safe-area-inset-top y safe-area-inset-bottom para iPhone notch/home indicator.
import React, { useState, useEffect } from 'react';
import { Menu, X, LogOut, Home, Calculator, ShoppingBag, Wallet, MoreHorizontal } from 'lucide-react';
import Sidebar from './Sidebar';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';
import { puedeVerPestanaGlobal } from '../lib/permisos';

// Título derivado de paginaActiva/clienteActivo — coincide con lo que muestra el breadcrumb
const TITULOS = {
  estadoResultados: 'Estado de resultados',
  visionGeneral: 'Visión general',
  analisisClientes: 'Análisis por cliente',
  sellIn: 'Sell In',
  sellOut: 'Sell Out',
  inventarioGlobal: 'Inventario',
  cobranzaGlobal: 'Cobranza',
  forecastClientes: 'S&OP',
  resumenClientes: 'Resumen de clientes',
  propuestas: 'Propuestas',
  estrategiaPrecios: 'Estrategia de precios',
  ordenesCompra: 'Tracking pedidos',
  adminInterna: 'Pendientes & Calendario',
  telemetria: 'Actividad del equipo',
  axonMexico: 'Axon de México',
  configuracion: 'Configuración',
  home: 'Resumen',
  estrategia: 'Sell Out',
  marketing: 'Marketing',
  pagos: 'Pagos',
  cartera: 'Crédito y Cobranza',
};

const CLIENTE_LBLS = {
  digitalife: 'Digitalife',
  pcel: 'PCEL',
  dicotech: 'Dicotech',
};

// 4 items fijos del bottom tab bar + Más. Se filtran según permisos.
const TAB_ITEMS = [
  { id: 'resumenClientes', permiso: 'resumen_clientes', icon: Home,       label: 'Home' },
  { id: 'estadoResultados', permiso: 'estado_resultados', icon: Calculator, label: 'EdR' },
  { id: 'sellOut',         permiso: 'sell_out',        icon: ShoppingBag, label: 'Ventas' },
  { id: 'cobranzaGlobal',  permiso: 'cobranza_global', icon: Wallet,      label: 'Pagos' },
];

// Constantes exportadas para que App.jsx sepa cuánto padding aplicar a <main>
export const MOBILE_NAV_TOP_HEIGHT = 56;
export const MOBILE_NAV_BOTTOM_HEIGHT = 60;

export default function MobileNav({
  clienteActivo, paginaActiva, onNavegar, onCerrarSesion, perfilUsuario,
}) {
  const { theme } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Cerrar drawer cuando cambia la pestaña
  useEffect(() => { setDrawerOpen(false); }, [clienteActivo, paginaActiva]);

  // Bloquear scroll del body cuando drawer abierto
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [drawerOpen]);

  const titulo = clienteActivo
    ? `${CLIENTE_LBLS[clienteActivo] || clienteActivo} · ${TITULOS[paginaActiva] || paginaActiva}`
    : TITULOS[paginaActiva] || 'Dashboard';

  const isDark = theme.mode === 'dark';
  const topBarBg = isDark ? theme.bgAlt : theme.bg;

  const tabsVisibles = TAB_ITEMS.filter((t) =>
    !t.permiso || puedeVerPestanaGlobal(perfilUsuario, t.permiso)
  );

  const isActiveTab = (id) => clienteActivo === null && paginaActiva === id;

  return (
    <>
      {/* ─── TOP BAR ─── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        height: 56, paddingTop: 'env(safe-area-inset-top)',
        background: topBarBg, borderBottom: `1px solid ${theme.border}`,
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 12px',
      }}>
        <button onClick={() => setDrawerOpen(true)}
          aria-label="Abrir menú"
          style={{
            width: 44, height: 44, display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none',
            color: theme.text, cursor: 'pointer', borderRadius: 10,
          }}>
          <Menu style={{ width: 22, height: 22, strokeWidth: 2 }} />
        </button>
        <div style={{
          flex: 1, textAlign: 'center', minWidth: 0, padding: '0 8px',
          ...typo({ fs: 15, w: 600, ls: '-0.01em' }),
          fontFamily: TYPO.fontDisplay, color: theme.text,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{titulo}</div>
        {onCerrarSesion && (
          <button onClick={onCerrarSesion} aria-label="Cerrar sesión"
            style={{
              width: 44, height: 44, display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none',
              color: theme.textMuted, cursor: 'pointer', borderRadius: 10,
            }}>
            <LogOut style={{ width: 18, height: 18, strokeWidth: 2 }} />
          </button>
        )}
      </header>

      {/* ─── BOTTOM TAB BAR ─── */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: topBarBg, borderTop: `1px solid ${theme.border}`,
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        display: 'grid', gridTemplateColumns: `repeat(${tabsVisibles.length + 1}, 1fr)`,
        height: 60,
      }}>
        {tabsVisibles.map((t) => {
          const active = isActiveTab(t.id);
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => onNavegar(null, t.id)}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 2,
                padding: '6px 4px', minHeight: 44,
                color: active ? theme.accent : theme.textMuted,
                fontFamily: TYPO.fontText,
              }}>
              <Icon style={{ width: 22, height: 22, strokeWidth: active ? 2.2 : 1.8 }} />
              <span style={{ fontSize: 10.5, fontWeight: active ? 600 : 500 }}>{t.label}</span>
              {theme.key === 'marfil' && active && (
                <span style={{
                  width: 4, height: 4, borderRadius: 999,
                  background: theme.accent,
                  position: 'absolute', bottom: 4,
                }} />
              )}
            </button>
          );
        })}
        <button onClick={() => setDrawerOpen(true)}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 2,
            padding: '6px 4px', minHeight: 44,
            color: theme.textMuted,
            fontFamily: TYPO.fontText,
          }}>
          <MoreHorizontal style={{ width: 22, height: 22, strokeWidth: 1.8 }} />
          <span style={{ fontSize: 10.5, fontWeight: 500 }}>Más</span>
        </button>
      </nav>

      {/* ─── DRAWER ─── */}
      {drawerOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(6px)',
          animation: 'edrFadeIn 200ms ease-out',
        }} onClick={() => setDrawerOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: '85vw', maxWidth: 320, height: '100vh',
            background: theme.sidebar,
            paddingTop: 'env(safe-area-inset-top)',
            paddingLeft: 'env(safe-area-inset-left)',
            overflowY: 'auto',
            display: 'flex', flexDirection: 'column',
            animation: 'edrSlideIn 240ms cubic-bezier(0.32, 0.72, 0, 1)',
            boxShadow: '4px 0 24px rgba(0,0,0,0.2)',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'flex-end',
              padding: '10px 12px',
            }}>
              <button onClick={() => setDrawerOpen(false)}
                aria-label="Cerrar menú"
                style={{
                  width: 40, height: 40, display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center',
                  background: 'transparent', border: 'none',
                  color: theme.textMuted, cursor: 'pointer', borderRadius: 10,
                }}>
                <X style={{ width: 20, height: 20, strokeWidth: 2 }} />
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
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
        @keyframes edrFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes edrSlideIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }
      `}</style>
    </>
  );
}

function typo(t) {
  return {
    fontFamily: TYPO.fontText,
    fontSize: t.fs, fontWeight: t.w, letterSpacing: t.ls, lineHeight: t.lh || 1.4,
  };
}
