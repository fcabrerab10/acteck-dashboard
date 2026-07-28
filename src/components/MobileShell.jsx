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
  Calculator, Sparkles, ChevronDown, ChevronRight, Check, Search, LogOut,
} from 'lucide-react';
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
      {
        title: 'Administración',
        items: [
          { id: 'adminInterna', label: 'Pendientes & Calendario', Icon: Calendar, permiso: 'admin_interna' },
          { id: 'telemetria',   label: 'Actividad del equipo',    Icon: Users, permiso: '__super_admin_only__' },
        ],
      },
    ],
  },
  {
    id: 'axon', label: 'Axon', color: '#FF375F', Icon: Building2,
    items: [
      { id: 'axonMexico', label: 'Axon de México', Icon: Building2, permiso: 'axon_mexico' },
    ],
  },
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

  const iniciales = (perfilUsuario?.nombre || perfilUsuario?.email || 'FC')
    .split(/\s+|@/)[0].slice(0, 2).toUpperCase();

  const cliMode = !!clienteActivo && paginaActiva !== 'resumenClientes' && vistaActual !== 'configuracion';

  // Detectar tab activo en modo cliente
  const activeCliTab = cliMode ? paginaActiva : null;

  // Detectar dominio activo en modo global (para highlight de pill)
  const activeDom = useMemo(() => {
    if (cliMode) return null;
    if (vistaActual === 'configuracion') return null;
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
          {/* Search icon */}
          <button
            onClick={() => onNavegar(null, 'buscar')}
            aria-label="Buscar"
            style={{
              width: 40, height: 40, borderRadius: 20,
              background: theme.surface, border: `1px solid ${theme.border}`,
              display: 'grid', placeItems: 'center', color: theme.text,
              cursor: 'pointer', flex: '0 0 auto',
              transition: 'transform 160ms cubic-bezier(.4,0,.2,1)',
            }}
            onPointerDown={(e) => e.currentTarget.style.transform = 'scale(.94)'}
            onPointerUp={(e) => e.currentTarget.style.transform = ''}
            onPointerLeave={(e) => e.currentTarget.style.transform = ''}
          >
            <Search size={16} strokeWidth={2} />
          </button>

          {/* Centro: cliente pill (solo si hay cliente activo) o título Dashboard */}
          {clienteActivo ? (
            <button
              onClick={() => setOpenSheet('switcher')}
              style={{
                flex: 1, minWidth: 0,
                display: 'inline-flex', alignItems: 'center', gap: 10,
                padding: '10px 18px', borderRadius: 999,
                background: theme.surface, border: `1px solid ${theme.border}`,
                color: theme.text, cursor: 'pointer',
                fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600,
                letterSpacing: '-.01em',
                justifyContent: 'center',
                transition: 'transform 160ms cubic-bezier(.4,0,.2,1)',
              }}
              onPointerDown={(e) => e.currentTarget.style.transform = 'scale(.97)'}
              onPointerUp={(e) => e.currentTarget.style.transform = ''}
              onPointerLeave={(e) => e.currentTarget.style.transform = ''}
            >
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: dotColor, flex: '0 0 auto' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clienteLabel}</span>
              <ChevronDown size={15} strokeWidth={2.2} style={{ color: theme.textMuted, flex: '0 0 auto' }} />
            </button>
          ) : (
            <div style={{
              flex: 1, textAlign: 'center', minWidth: 0,
              fontFamily: TYPO.fontDisplay, fontSize: 17, fontWeight: 700,
              letterSpacing: '-.02em', color: theme.text,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>Dashboard</div>
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

      {/* ═══ BOTTOM TAB BAR (Instagram-style shrink on scroll) ═══ */}
      <nav aria-label="Navegación" style={{
        position: 'fixed',
        left: 'max(10px, env(safe-area-inset-left))',
        right: 'max(10px, env(safe-area-inset-right))',
        bottom: 'calc(env(safe-area-inset-bottom) + 12px)',
        maxWidth: shrunk ? 380 : 780,
        marginLeft: 'auto', marginRight: 'auto',
        height: shrunk ? 52 : 60,
        background: chromeSurface,
        backdropFilter: 'saturate(180%) blur(28px)',
        WebkitBackdropFilter: 'saturate(180%) blur(28px)',
        border: `1px solid ${theme.border}`,
        borderRadius: 30,
        padding: shrunk ? '4px 6px' : '6px 8px',
        display: 'flex', alignItems: 'center', gap: shrunk ? 3 : 6,
        zIndex: 39,
        boxShadow: isDark
          ? '0 20px 40px rgba(0,0,0,.5), 0 0 0 .5px rgba(255,255,255,.04)'
          : '0 10px 30px rgba(0,0,0,.10)',
        transition: 'max-width 320ms cubic-bezier(.4,0,.2,1), height 320ms cubic-bezier(.4,0,.2,1), padding 320ms cubic-bezier(.4,0,.2,1), gap 320ms cubic-bezier(.4,0,.2,1)',
      }}>
        {/* Tabs (dominios o cliente) */}
        <div style={{ flex: 1, display: 'flex', gap: 4, overflowX: 'auto', scrollbarWidth: 'none' }} className="ms-hide">
          {cliMode ? (
            CLIENTE_TABS_ORDER
              .filter((t) => {
                const p = CLIENTES[clienteActivo]?.pestanas?.find((x) => x.id === t.id);
                return p && !p.disabled && puedeVerPestanaCliente(perfilUsuario, clienteActivo, t.id);
              })
              .map((t) => (
                <TabPill key={t.id}
                  active={activeCliTab === t.id}
                  onClick={() => onNavegar(clienteActivo, t.id)}
                  theme={theme} label={t.label} Icon={t.Icon} iconOnly
                  shrunk={shrunk}
                />
              ))
          ) : (
            <>
              <TabPill
                active={paginaActiva === 'resumenClientes'}
                onClick={() => onNavegar(null, 'resumenClientes')}
                theme={theme} label={INICIO_TAB.label} Icon={INICIO_TAB.Icon}
                shrunk={shrunk}
              />
              {DOMINIOS.map((d) => (
                <TabPill key={d.id}
                  active={activeDom === d.id || openSheet === d.id}
                  onClick={() => setOpenSheet(openSheet === d.id ? null : d.id)}
                  theme={theme} label={d.label} Icon={d.Icon}
                  shrunk={shrunk}
                />
              ))}
            </>
          )}
        </div>

        {/* Ferruteck mini pill */}
        <button
          onClick={() => setOpenSheet('ferruteck')}
          aria-label="Ferruteck"
          style={{
            width: shrunk ? 36 : 44, height: shrunk ? 36 : 44,
            borderRadius: shrunk ? 18 : 22,
            background: 'linear-gradient(135deg, #FF2D55, #FF9500)',
            color: '#fff', border: 'none', cursor: 'pointer',
            display: 'grid', placeItems: 'center',
            boxShadow: '0 6px 14px rgba(255,45,85,.35)',
            flex: '0 0 auto', position: 'relative',
            transition: 'transform 160ms cubic-bezier(.4,0,.2,1), width 320ms cubic-bezier(.4,0,.2,1), height 320ms cubic-bezier(.4,0,.2,1)',
          }}
          onPointerDown={(e) => e.currentTarget.style.transform = 'scale(.9)'}
          onPointerUp={(e) => e.currentTarget.style.transform = ''}
          onPointerLeave={(e) => e.currentTarget.style.transform = ''}
        >
          <Sparkles size={shrunk ? 15 : 18} strokeWidth={2} />
          {!shrunk && (
            <span style={{
              position: 'absolute', top: -3, right: -3,
              minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8,
              background: '#000', color: '#fff', fontSize: 9.5, fontWeight: 800,
              display: 'grid', placeItems: 'center',
              border: `1.5px solid ${chromeSurface.replace(/[\d.]+\)$/, '1)')}`,
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
function TabPill({ active, onClick, theme, label, Icon, iconOnly, shrunk }) {
  const [pressed, setPressed] = useState(false);
  // Shrunk = solo icono compacto (nunca desaparece)
  const compact = shrunk;
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        flex: compact ? '0 0 auto' : '1 0 auto', minWidth: 0,
        background: active ? theme.text : 'transparent',
        color: active ? theme.bg : theme.textMuted,
        border: 'none', cursor: 'pointer',
        borderRadius: compact ? 18 : 22,
        padding: compact ? '6px' : (iconOnly ? '6px 8px' : '9px 12px'),
        width: compact ? 36 : 'auto', height: compact ? 36 : 'auto',
        display: 'inline-flex',
        flexDirection: (iconOnly && !compact) ? 'column' : 'row',
        alignItems: 'center', justifyContent: 'center',
        gap: compact ? 0 : (iconOnly ? 2 : 0),
        fontFamily: TYPO.fontText,
        fontSize: compact ? 0 : (iconOnly ? 9.5 : 12.5),
        fontWeight: active ? 700 : 600, letterSpacing: '-.005em',
        whiteSpace: 'nowrap',
        transition: 'background 200ms cubic-bezier(.4,0,.2,1), color 200ms, transform 140ms, padding 320ms, width 320ms, height 320ms, font-size 200ms',
        transform: pressed ? 'scale(.94)' : 'scale(1)',
      }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
    >
      {Icon && <Icon size={compact ? 18 : (iconOnly ? 18 : 14)} strokeWidth={active ? 2.4 : 2} style={{ marginRight: (compact || iconOnly) ? 0 : 6 }} />}
      {!compact && label}
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
              {clientesVisibles.map((c) => {
                const expanded = expandedCli === c.id;
                return (
                  <div key={c.id}>
                    <SheetItem
                      theme={theme} Icon={Users}
                      swatchColor={CLIENTE_DOT[c.id] || theme.accent}
                      label={c.label}
                      onClick={() => setExpandedCli(expanded ? null : c.id)}
                      chevron={expanded ? 'down' : 'right'}
                    />
                    {expanded && (
                      <div style={{ paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                        {c.pestanas.filter((p) => !p.disabled && puedeVerPestanaCliente(perfilUsuario, c.id, p.id)).map((p) => (
                          <SheetItem key={p.id} theme={theme} label={p.label} small onClick={() => { onNavegar(c.id, p.id); onClose(); }} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
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
