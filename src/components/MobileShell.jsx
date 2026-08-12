// MobileShell v3 — refleja el modelo mental del sitio web de Fernando.
//
//   Global mode (sin cliente):
//     Header: [🔍]  [Cliente pill · más round]                    [FC avatar]
//     Bottom: [Dirección] [Comercial] [Interno] [Axon]     [✨ Ferruteck]
//
//   Cliente mode (con cliente activo):
//     Header: [🔍]  [Cliente pill · más round]                    [FC avatar]
//     Bottom: [Home] [SI] [SO] [Mkt] [Pagos] [Cart]      [✨ Ferruteck]
//
//   Tap domain → bottom sheet con sub-items (idéntico al dropdown web).
//   Tap avatar → sheet con Yo (perfil, tema, notif, config, cerrar sesión).
//   Tap Ferruteck → sheet con sugerencias.

import React, { useEffect, useMemo, useState } from 'react';
import {
  Home, ShoppingCart, ShoppingBag, Megaphone, Wallet, CreditCard,
  Activity, PieChart, Boxes, HandCoins, Target,
  BarChart3, ClipboardList, TrendingUp, FileCheck, Building2, Users, Calendar,
  Calculator, ChevronDown, ChevronRight, Check, Search, LogOut, ArrowLeft,
} from 'lucide-react';

// Mini fantasmita de Ferruteck — mismo diseño del Topbar web (versión compacta)
function FerrutekMini({ size = 22 }) {
  return (
    <svg width={size} height={size * 1.07} viewBox="0 0 140 150" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="frtMini" cx="35%" cy="30%">
          <stop offset="0%" stopColor="#F5E6FF" />
          <stop offset="40%" stopColor="#D0A8F0" />
          <stop offset="100%" stopColor="#AF52DE" />
        </radialGradient>
      </defs>
      <path
        d="M 25 40 Q 25 15 70 15 Q 115 15 115 40 L 115 100 Q 115 105 110 105 Q 105 100 100 105 Q 95 110 90 105 Q 85 100 80 105 Q 75 110 70 105 Q 65 100 60 105 Q 55 110 50 105 Q 45 100 40 105 Q 35 110 30 105 Q 25 100 25 95 Z"
        fill="url(#frtMini)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5"
      />
      <ellipse cx="52" cy="50" rx="7" ry="9" fill="#1a1a2e" />
      <ellipse cx="54" cy="47" rx="3" ry="4" fill="#FFF" />
      <ellipse cx="88" cy="50" rx="7" ry="9" fill="#1a1a2e" />
      <ellipse cx="90" cy="47" rx="3" ry="4" fill="#FFF" />
      <path d="M 60 72 Q 70 80 80 72" stroke="#1a1a2e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}
import Sidebar, { CLIENTES } from './Sidebar';
import MobileYo from './MobileYo';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';
import { puedeVerCliente, puedeVerPestanaCliente, puedeVerPestanaGlobal } from '../lib/permisos';

export const MOBILE_SHELL_TOP_HEIGHT = 60;
export const MOBILE_SHELL_BOTTOM_HEIGHT = 92;

const CLIENTE_DOT = { digitalife: '#5856D6', dicotech: '#FF9500', pcel: '#34C759' };

// ── 4 dominios (idénticos al web sidebar §12) ───────────────────────────
const DOMINIOS = [
  {
    id: 'direccion', label: 'Dirección', color: '#5856D6', Icon: Calculator,
    items: [
      { id: 'estadoResultados', label: 'Estado de Resultados', Icon: Calculator, permiso: 'estado_resultados' },
    ],
  },
  {
    id: 'comercial', label: 'Comercial', color: '#007AFF', Icon: Activity,
    items: [
      { id: 'visionGeneral',    label: 'Visión General',       Icon: Activity, permiso: 'vision_general' },
      { id: 'analisisClientes', label: 'Análisis por Cliente', Icon: PieChart, permiso: 'analisis_clientes' },
      { id: 'sellIn',           label: 'Sell In',              Icon: ShoppingCart, permiso: 'sell_in' },
      { id: 'sellOut',          label: 'Sell Out',             Icon: ShoppingBag, permiso: 'sell_out' },
      { id: 'inventarioGlobal', label: 'Inventario',           Icon: Boxes, permiso: 'inventario_global' },
      { id: 'cobranzaGlobal',   label: 'Cobranza',             Icon: HandCoins, permiso: 'cobranza_global' },
      { id: 'forecastClientes', label: 'S&OP',                 Icon: Target, permiso: 'forecast_clientes' },
    ],
  },
  {
    id: 'interno', label: 'Interno', color: '#FF9500', Icon: Users,
    sections: [
      {
        title: 'Clientes Propios',
        items: [
          { id: 'resumenClientes',   label: 'Resumen de Clientes',  Icon: BarChart3, permiso: 'resumen_clientes' },
          { id: 'propuestas',        label: 'Propuestas',           Icon: ClipboardList, permiso: 'propuestas' },
          { id: 'estrategiaPrecios', label: 'Estrategia de Precios', Icon: TrendingUp, permiso: 'estrategia_precios' },
          { id: 'ordenesCompra',     label: 'Tracking Pedidos',     Icon: FileCheck, permiso: 'ordenes_compra' },
        ],
      },
      { title: 'Clientes', expandableClientes: true },
    ],
  },
  {
    id: 'admin', label: 'Admin', color: '#5AC8FA', Icon: Calendar,
    items: [
      { id: 'adminInterna', label: 'Pendientes & Calendario', Icon: Calendar, permiso: 'admin_interna' },
      { id: 'telemetria',   label: 'Actividad del equipo',    Icon: Users, permiso: '__super_admin_only__' },
    ],
  },
  // Axon oculto — se puede reactivar aquí cuando se use:
  // { id: 'axon', label: 'Axon', color: '#FF375F', Icon: Building2,
  //   items: [{ id: 'axonMexico', label: 'Axon de México', Icon: Building2, permiso: 'axon_mexico' }] },
];

// Inicio · pill primaria antes de los dominios (equivale a Resumen de Clientes)
const INICIO_TAB = { id: 'inicio', label: 'Inicio', color: '#34C759', Icon: Home };

// ── 6 pestañas cliente ──────────────────────────────────────────────────
const CLIENTE_TABS_ORDER = [
  { id: 'home',       label: 'Home',     Icon: Home },
  { id: 'sellIn',     label: 'Sell In',  Icon: ShoppingCart },
  { id: 'estrategia', label: 'Sell Out', Icon: ShoppingBag },
  { id: 'marketing',  label: 'Mkt',      Icon: Megaphone },
  { id: 'pagos',      label: 'Pagos',    Icon: Wallet },
  { id: 'cartera',    label: 'Cartera',  Icon: CreditCard },
];

export default function MobileShell({
  clienteActivo, paginaActiva, vistaActual,
  onNavegar, onCerrarSesion, perfilUsuario,
}) {
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const [openSheet, setOpenSheet] = useState(null); // 'direccion'|'comercial'|'interno'|'axon'|'ferruteck'|'yo'|'switcher'|null
  const [expandedCli, setExpandedCli] = useState(null); // dentro del sheet Interno
  const [shrunk, setShrunk] = useState(false); // Instagram-style tab bar shrink on scroll down

  // Scroll direction detection · encoge tab bar al bajar, crece al subir
  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - lastY;
        if (Math.abs(dy) > 6) {
          if (dy > 0 && y > 80) setShrunk(true);
          else if (dy < 0) setShrunk(false);
          lastY = y;
        }
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setOpenSheet(null); }, [clienteActivo, paginaActiva, vistaActual]);
  useEffect(() => {
    if (openSheet) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [openSheet]);

  const clientesVisibles = useMemo(() => (
    Object.entries(CLIENTES)
      .filter(([id, c]) => c.activo && puedeVerCliente(perfilUsuario, id))
      .map(([id, c]) => ({ id, ...c }))
  ), [perfilUsuario]);

  const clienteLabel = clienteActivo ? (CLIENTES[clienteActivo]?.label || clienteActivo) : 'Global';
  const dotColor = clienteActivo ? (CLIENTE_DOT[clienteActivo] || theme.accent) : theme.textMuted;

  // Iniciales: primera letra de cada palabra del nombre (2 letras)
  const iniciales = ((perfilUsuario?.nombre || perfilUsuario?.email || '').split(/\s+|@/).filter(Boolean).map(s => s[0]).slice(0, 2).join('').toUpperCase()) || 'FC';

  const cliMode = !!clienteActivo && paginaActiva !== 'resumenClientes' && vistaActual !== 'configuracion';

  // Detectar tab activo en modo cliente
  const activeCliTab = cliMode ? paginaActiva : null;

  // Detectar dominio activo en modo global (para highlight de pill).
  // resumenClientes está listado dentro del dominio "Interno" como shortcut,
  // pero ya tiene su propio pill "Inicio" — se ignora aquí para no activar dos pills.
  const activeDom = useMemo(() => {
    if (cliMode) return null;
    if (vistaActual === 'configuracion') return null;
    if (paginaActiva === 'resumenClientes') return null;
    for (const d of DOMINIOS) {
      if (d.items?.some(i => i.id === paginaActiva)) return d.id;
      if (d.sections) {
        for (const s of d.sections) {
          if (s.items?.some(i => i.id === paginaActiva)) return d.id;
        }
      }
    }
    return null;
  }, [cliMode, paginaActiva, vistaActual]);

  const chromeSurface = isDark ? 'rgba(20,20,22,0.72)' : (theme.key === 'marfil' ? 'rgba(247,243,236,0.86)' : 'rgba(255,255,255,0.82)');

  return (
    <>
      {/* ═══ HEADER ═══ */}
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
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {/* Search bar inline — ocupa casi todo el ancho */}
          <button
            onClick={() => onNavegar(null, 'buscar')}
            aria-label="Buscar"
            style={{
              flex: 1, minWidth: 0, height: 40,
              padding: '0 14px', borderRadius: 20,
              background: theme.mode === 'dark' ? 'rgba(120,120,128,.24)' : 'rgba(120,120,128,.16)',
              border: 'none', color: theme.textMuted, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontFamily: TYPO.fontText, fontSize: 14, fontWeight: 500,
              textAlign: 'left',
              transition: 'transform 160ms cubic-bezier(.4,0,.2,1)',
            }}
            onPointerDown={(e) => e.currentTarget.style.transform = 'scale(.985)'}
            onPointerUp={(e) => e.currentTarget.style.transform = ''}
            onPointerLeave={(e) => e.currentTarget.style.transform = ''}
          >
            <Search size={16} strokeWidth={2} style={{ color: theme.textMuted, flex: '0 0 auto' }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {clienteActivo
                ? `Buscar en ${clienteLabel}…`
                : 'Buscar SKU, propuesta, minuta…'}
            </span>
          </button>

          {/* Cliente pill compacta · SOLO si hay cliente activo · para cambiar */}
          {clienteActivo && (
            <button
              onClick={() => setOpenSheet('switcher')}
              aria-label={`Cambiar cliente · ${clienteLabel}`}
              style={{
                width: 40, height: 40, borderRadius: 20,
                background: theme.surface, border: `1px solid ${theme.border}`,
                display: 'grid', placeItems: 'center', cursor: 'pointer',
                flex: '0 0 auto', position: 'relative',
                transition: 'transform 160ms cubic-bezier(.4,0,.2,1)',
              }}
              onPointerDown={(e) => e.currentTarget.style.transform = 'scale(.94)'}
              onPointerUp={(e) => e.currentTarget.style.transform = ''}
              onPointerLeave={(e) => e.currentTarget.style.transform = ''}
            >
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: dotColor }} />
            </button>
          )}

          {/* Avatar → sheet Yo */}
          <button
            onClick={() => setOpenSheet('yo')}
            aria-label="Perfil"
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: `linear-gradient(135deg, ${theme.pink || '#FF2D55'}, ${theme.orange || '#FF9500'})`,
              color: '#fff', border: 'none', cursor: 'pointer',
              display: 'grid', placeItems: 'center',
              fontFamily: TYPO.fontDisplay, fontWeight: 700, fontSize: 13,
              letterSpacing: '.02em', flex: '0 0 auto',
            }}
          >{iniciales}</button>
        </div>
      </header>

      {/* ═══ BOTTOM TAB BAR · Instagram-style · siempre icon-only ═══ */}
      <nav aria-label="Navegación" style={{
        position: 'fixed',
        left: 'max(10px, env(safe-area-inset-left))',
        right: 'max(10px, env(safe-area-inset-right))',
        bottom: 'calc(env(safe-area-inset-bottom) + 12px)',
        // Ancho auto — se acomoda al contenido, centrado
        marginLeft: 'auto', marginRight: 'auto',
        width: 'fit-content', maxWidth: 'calc(100vw - 20px)',
        height: shrunk ? 48 : 60,
        background: chromeSurface,
        backdropFilter: 'saturate(180%) blur(28px)',
        WebkitBackdropFilter: 'saturate(180%) blur(28px)',
        border: `1px solid ${theme.border}`,
        borderRadius: 999,
        padding: shrunk ? '5px 8px' : '6px 8px',
        display: 'flex', alignItems: 'center', gap: shrunk ? 3 : 4,
        zIndex: 39,
        boxShadow: isDark
          ? '0 20px 40px rgba(0,0,0,.5), 0 0 0 .5px rgba(255,255,255,.04)'
          : '0 10px 30px rgba(0,0,0,.10)',
        transition: 'height 420ms cubic-bezier(.32,.72,0,1), padding 420ms cubic-bezier(.32,.72,0,1), gap 420ms cubic-bezier(.32,.72,0,1)',
      }}>
        {/* Tabs uniformes (dominios o cliente) — todas mismo tamaño */}
        {cliMode ? (
          <>
            {/* Volver a Resumen */}
            <TabPill
              active={false}
              onClick={() => onNavegar(null, 'resumenClientes')}
              theme={theme} label="Volver a Resumen" Icon={ArrowLeft} shrunk={shrunk}
              backButton
            />
            {CLIENTE_TABS_ORDER
              .filter((t) => {
                const p = CLIENTES[clienteActivo]?.pestanas?.find((x) => x.id === t.id);
                return p && !p.disabled && puedeVerPestanaCliente(perfilUsuario, clienteActivo, t.id);
              })
              .map((t) => (
                <TabPill key={t.id}
                  active={activeCliTab === t.id}
                  onClick={() => onNavegar(clienteActivo, t.id)}
                  theme={theme} label={t.label} Icon={t.Icon} shrunk={shrunk}
                />
              ))}
          </>
        ) : (
          <>
            <TabPill
              active={paginaActiva === 'resumenClientes'}
              onClick={() => onNavegar(null, 'resumenClientes')}
              theme={theme} label={INICIO_TAB.label} Icon={INICIO_TAB.Icon} shrunk={shrunk}
            />
            {DOMINIOS.map((d) => (
              <TabPill key={d.id}
                active={activeDom === d.id || openSheet === d.id}
                onClick={() => setOpenSheet(openSheet === d.id ? null : d.id)}
                theme={theme} label={d.label} Icon={d.Icon} shrunk={shrunk}
              />
            ))}
          </>
        )}

        {/* Separador visual */}
        <div style={{
          width: 1, height: shrunk ? 22 : 26, background: theme.border,
          margin: '0 2px', flex: '0 0 auto',
          transition: 'height 420ms cubic-bezier(.32,.72,0,1)',
        }} />

        {/* Ferruteck · fantasmita real con cosmic bg (idéntico al web) */}
        <button
          onClick={() => setOpenSheet('ferruteck')}
          aria-label="Ferruteck"
          style={{
            width: shrunk ? 36 : 46, height: shrunk ? 36 : 46,
            borderRadius: '50%',
            background: `radial-gradient(circle at 20% 30%, rgba(191,90,242,0.35) 0%, transparent 55%), radial-gradient(circle at 80% 70%, rgba(100,210,255,0.25) 0%, transparent 55%), linear-gradient(180deg, #1e1e2e 0%, #0d0d19 100%)`,
            border: '1px solid rgba(255,255,255,0.10)',
            cursor: 'pointer', display: 'grid', placeItems: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
            flex: '0 0 auto', position: 'relative', padding: 0,
            transition: 'transform 200ms cubic-bezier(.34,1.56,.64,1), width 420ms cubic-bezier(.32,.72,0,1), height 420ms cubic-bezier(.32,.72,0,1)',
          }}
          onPointerDown={(e) => e.currentTarget.style.transform = 'scale(.88)'}
          onPointerUp={(e) => e.currentTarget.style.transform = ''}
          onPointerLeave={(e) => e.currentTarget.style.transform = ''}
        >
          <FerrutekMini size={shrunk ? 20 : 26} />
          {!shrunk && (
            <span style={{
              position: 'absolute', top: -2, right: -2,
              minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8,
              background: '#FF375F', color: '#fff', fontSize: 9.5, fontWeight: 800,
              display: 'grid', placeItems: 'center',
              border: `1.5px solid ${isDark ? '#000' : '#fff'}`,
            }}>3</span>
          )}
        </button>
      </nav>

      {/* ═══ DOMINIO SHEETS ═══ */}
      {DOMINIOS.map((d) => (openSheet === d.id) && (
        <DominioSheet
          key={d.id} dominio={d} theme={theme} isDark={isDark}
          perfilUsuario={perfilUsuario}
          clientesVisibles={clientesVisibles}
          expandedCli={expandedCli} setExpandedCli={setExpandedCli}
          onNavegar={onNavegar}
          onClose={() => { setOpenSheet(null); setExpandedCli(null); }}
        />
      ))}

      {/* ═══ FERRUTECK SHEET ═══ */}
      {openSheet === 'ferruteck' && (
        <BottomSheet theme={theme} onClose={() => setOpenSheet(null)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: 'linear-gradient(135deg, #FF2D55, #FF9500)',
              color: '#fff', display: 'grid', placeItems: 'center',
              boxShadow: '0 6px 14px rgba(255,45,85,.35)',
            }}>
              <Sparkles size={22} strokeWidth={2} />
            </div>
            <div>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 700, letterSpacing: '-.02em', color: theme.text }}>Ferruteck</div>
              <div style={{ fontSize: 12, color: theme.textMuted }}>3 sugerencias para cerrar el mes</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { tag: 'Top movidos', txt: '12 SKUs con inv', val: '$96K', go: () => onNavegar(null, 'propuestas') },
              { tag: 'Reposición', txt: 'Cobertura baja del cliente', val: '$45K', go: () => onNavegar(null, 'inventarioGlobal') },
              { tag: 'Oportunidad', txt: 'Precio agresivo (múltiples listas)', val: '$193K', go: () => onNavegar(null, 'estrategiaPrecios') },
            ].map((s, i) => (
              <button key={i} onClick={() => { s.go(); setOpenSheet(null); }}
                style={{
                  padding: '12px 14px', background: theme.surface, border: `1px solid ${theme.border}`,
                  borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 10, fontFamily: TYPO.fontText,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em', color: theme.textMuted, fontWeight: 700 }}>{s.tag}</div>
                  <div style={{ fontSize: 13.5, color: theme.text, fontWeight: 600, marginTop: 2 }}>{s.txt}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums' }}>{s.val}</div>
              </button>
            ))}
          </div>
        </BottomSheet>
      )}

      {/* ═══ YO SHEET (desde avatar) ═══ */}
      {openSheet === 'yo' && (
        <BottomSheet theme={theme} onClose={() => setOpenSheet(null)} tall>
          <MobileYo perfil={perfilUsuario} onCerrarSesion={() => { setOpenSheet(null); onCerrarSesion?.(); }} />
        </BottomSheet>
      )}

      {/* ═══ CLIENTE SWITCHER (desde cliente pill) ═══ */}
      {openSheet === 'switcher' && (
        <TopSheet onClose={() => setOpenSheet(null)} theme={theme}>
          <div style={{
            fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 700,
            letterSpacing: '-.015em', color: theme.text, marginBottom: 12,
          }}>Cambiar contexto</div>
          <SwitchRow
            theme={theme} swatchBg={theme.textMuted}
            label="Global" sub="Vista consolidada"
            checked={clienteActivo === null}
            onClick={() => { onNavegar(null, 'resumenClientes'); setOpenSheet(null); }}
          />
          {clientesVisibles.map((c) => (
            <SwitchRow key={c.id} theme={theme}
              swatchBg={CLIENTE_DOT[c.id] || theme.accent}
              label={c.label} sub={`${c.pestanas.length} pestañas`}
              checked={clienteActivo === c.id}
              onClick={() => {
                const cli = CLIENTES[c.id];
                const primera = cli.pestanas.find((p) => !p.disabled && puedeVerPestanaCliente(perfilUsuario, c.id, p.id));
                onNavegar(c.id, primera?.id || 'home');
                setOpenSheet(null);
              }}
            />
          ))}
        </TopSheet>
      )}

      <style>{`
        .ms-hide::-webkit-scrollbar { display: none; }
        @keyframes msFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes msSlideDown { from { transform: translateY(-100%) } to { transform: translateY(0) } }
        @keyframes msSlideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
      `}</style>
    </>
  );
}

// ─────────────── Sub-componentes ───────────────
function TabPill({ active, onClick, theme, label, Icon, shrunk, backButton }) {
  const [pressed, setPressed] = useState(false);
  const size = shrunk ? 36 : 46;
  const iconSize = shrunk ? 18 : 22;
  const bg = backButton
    ? (theme.mode === 'dark' ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.06)')
    : (active ? theme.text : 'transparent');
  const color = backButton ? theme.text : (active ? theme.bg : theme.textMuted);
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        width: size, height: size, borderRadius: '50%',
        background: bg, color,
        border: 'none', cursor: 'pointer',
        display: 'grid', placeItems: 'center', padding: 0, flex: '0 0 auto',
        transition: 'background 260ms cubic-bezier(.32,.72,0,1), color 260ms, transform 200ms cubic-bezier(.34,1.56,.64,1), width 420ms cubic-bezier(.32,.72,0,1), height 420ms cubic-bezier(.32,.72,0,1)',
        transform: pressed ? 'scale(.88)' : 'scale(1)',
      }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
    >
      {Icon && <Icon size={iconSize} strokeWidth={active ? 2.4 : 2} />}
    </button>
  );
}

function DominioSheet({ dominio, theme, isDark, perfilUsuario, clientesVisibles, expandedCli, setExpandedCli, onNavegar, onClose }) {
  const canSee = (i) => !i.permiso || i.permiso === '__super_admin_only__'
    ? perfilUsuario?.es_super_admin
    : puedeVerPestanaGlobal(perfilUsuario, i.permiso);

  return (
    <BottomSheet theme={theme} onClose={onClose} tall>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: dominio.color }} />
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', color: theme.text }}>{dominio.label}</div>
      </div>

      {/* Items simples (Dirección · Comercial · Axon) */}
      {dominio.items && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {dominio.items.filter(canSee).map((i) => (
            <SheetItem key={i.id} theme={theme} Icon={i.Icon} label={i.label} onClick={() => { onNavegar(null, i.id); onClose(); }} />
          ))}
        </div>
      )}

      {/* Secciones (Interno) */}
      {dominio.sections && dominio.sections.map((s, idx) => (
        <React.Fragment key={idx}>
          <div style={{
            padding: '14px 6px 6px', fontSize: 10.5, textTransform: 'uppercase',
            letterSpacing: '.08em', color: theme.textMuted, fontWeight: 700,
          }}>{s.title}</div>
          {s.items && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {s.items.filter(canSee).map((i) => (
                <SheetItem key={i.id} theme={theme} Icon={i.Icon} label={i.label} onClick={() => { onNavegar(null, i.id); onClose(); }} />
              ))}
            </div>
          )}
          {s.expandableClientes && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {clientesVisibles.map((c) => (
                <SheetItem
                  key={c.id}
                  theme={theme} Icon={Users}
                  swatchColor={CLIENTE_DOT[c.id] || theme.accent}
                  label={c.label}
                  onClick={() => { onNavegar(c.id, 'home'); onClose(); }}
                />
              ))}
            </div>
          )}
        </React.Fragment>
      ))}
    </BottomSheet>
  );
}

function SheetItem({ theme, Icon, swatchColor, label, onClick, chevron, small }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', padding: small ? '9px 12px' : '11px 12px',
        background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: 12,
        borderRadius: 12, fontFamily: TYPO.fontText, color: theme.text,
        transition: 'background 160ms',
      }}
      onPointerEnter={(e) => e.currentTarget.style.background = theme.surfaceHover}
      onPointerLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      {swatchColor && (
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: swatchColor, flex: '0 0 auto' }} />
      )}
      {Icon && <Icon size={16} strokeWidth={2} style={{ color: theme.textMuted, flex: '0 0 auto' }} />}
      <span style={{ flex: 1, fontSize: small ? 13 : 14.5, fontWeight: small ? 500 : 600 }}>{label}</span>
      {chevron === 'down' && <ChevronDown size={14} style={{ color: theme.textSubtle }} />}
      {(chevron === 'right' || (!chevron && !small)) && <ChevronRight size={14} style={{ color: theme.textSubtle }} />}
    </button>
  );
}

function BottomSheet({ theme, onClose, tall, children }) {
  const isDark = theme.mode === 'dark';
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(0,0,0,.42)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        animation: 'msFadeIn 220ms',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: isDark ? theme.bgAlt : theme.surface,
          borderRadius: '24px 24px 0 0',
          padding: '10px 18px calc(env(safe-area-inset-bottom) + 22px)',
          maxHeight: tall ? '86vh' : '72vh', overflowY: 'auto',
          maxWidth: 720, marginLeft: 'auto', marginRight: 'auto',
          animation: 'msSlideUp 380ms cubic-bezier(.34,1.56,.64,1)',
          boxShadow: '0 -20px 60px rgba(0,0,0,.35)',
        }}
      >
        <div style={{ width: 40, height: 5, background: theme.divider, borderRadius: 3, margin: '0 auto 14px' }} />
        {children}
      </div>
    </div>
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
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: isDark ? theme.bgAlt : theme.surface,
          borderRadius: '0 0 28px 28px',
          padding: 'calc(env(safe-area-inset-top) + 18px) 18px 20px',
          animation: 'msSlideDown 340ms cubic-bezier(.34,1.56,.64,1)',
          borderBottom: `1px solid ${theme.border}`,
          maxWidth: 640, marginLeft: 'auto', marginRight: 'auto', width: '100%',
        }}
      >
        {children}
        <button
          onClick={onClose}
          style={{
            width: '100%', marginTop: 12, padding: 12, borderRadius: 14,
            background: theme.surfaceHover, color: theme.text, border: 'none',
            cursor: 'pointer', fontFamily: TYPO.fontText, fontSize: 15, fontWeight: 600,
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
        padding: '12px 8px', background: 'transparent', border: 'none',
        borderTop: `1px solid ${theme.divider}`,
        cursor: 'pointer', textAlign: 'left',
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 12,
        background: swatchBg, display: 'grid', placeItems: 'center',
        color: '#fff', fontFamily: TYPO.fontDisplay, fontWeight: 700, fontSize: 13,
      }}>{label.slice(0, 2).toUpperCase()}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontSize: 16, fontWeight: 600, letterSpacing: '-.01em' }}>{label}</div>
        <div style={{ color: theme.textMuted, fontFamily: TYPO.fontText, fontSize: 12, fontWeight: 500, marginTop: 1 }}>{sub}</div>
      </div>
      {checked && <Check size={20} style={{ color: theme.accent, strokeWidth: 2.5 }} />}
    </button>
  );
}
