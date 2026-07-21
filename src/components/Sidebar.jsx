import { useState, useEffect } from 'react';
import {
  ChevronRight, ChevronDown, Lock, LogOut, Eye, Settings, RefreshCw,
  Home, TrendingUp, Package, Megaphone, Wallet, CreditCard,
  BarChart3, Target, ClipboardList, FileCheck, Award, Building2, Users,
  Activity, PieChart, ShoppingCart, ShoppingBag, Boxes, HandCoins, Calculator,
} from 'lucide-react';
import {
  puedeConfigurar,
  puedeActualizarDatos,
  puedeVerCliente,
  puedeVerPestanaCliente,
  puedeVerPestanaGlobal,
} from '../lib/permisos';
import { useTheme } from '../lib/themeContext';

// Mapping entre ids del menú y ids del schema de permisos globales
// (ej: 'resumenClientes' en la UI → 'resumen_clientes' en permisos JSON).
const MENU_A_PERMISO_GLOBAL = {
  resumenClientes:  'resumen_clientes',
  estadoResultados: 'estado_resultados',
  visionGeneral:    'vision_general',
  analisisClientes: 'analisis_clientes',
  sellIn:           'sell_in',
  sellOut:          'sell_out',
  inventarioGlobal: 'inventario_global',
  cobranzaGlobal:   'cobranza_global',
  forecastClientes: 'forecast_clientes',
  estrategiaPrecios:'estrategia_precios',
  ordenesCompra:    'ordenes_compra',
  adminInterna:     'admin_interna',
  telemetria:       '__super_admin_only__', // sentinel: solo Fernando
  propuestas:       'propuestas',
  axonMexico:       'axon_mexico',
  configuracion:    'configuracion',
};

/**
 * Sidebar — navegación del dashboard
 * Props: clienteActivo, paginaActiva, onNavegar, onCerrarSesion, perfilUsuario
 */

// ────────── Datos de clientes ──────────
const CLIENTES = {
  digitalife: {
    label: 'Digitalife',
    color: '#EF4444',
    activo: true,
    pestanas: [
      { id: 'home',       label: 'Resumen',                icon: Home },
      { id: 'sellIn',     label: 'Sell In',                icon: ShoppingCart },
      { id: 'estrategia', label: 'Sell Out',               icon: ShoppingBag },
      { id: 'marketing',  label: 'Marketing',              icon: Megaphone },
      { id: 'pagos',      label: 'Pagos',                  icon: Wallet },
      { id: 'cartera',    label: 'Crédito y Cobranza',     icon: CreditCard },
    ],
  },
  pcel: {
    label: 'PCEL',
    color: '#EF4444',
    activo: true,
    pestanas: [
      { id: 'home',       label: 'Resumen',                icon: Home },
      { id: 'sellIn',     label: 'Sell In',                icon: ShoppingCart },
      { id: 'estrategia', label: 'Sell Out',               icon: ShoppingBag },
      { id: 'marketing',  label: 'Marketing',              icon: Megaphone, disabled: true, hint: 'Pronto' },
      { id: 'pagos',      label: 'Pagos',                  icon: Wallet },
      { id: 'cartera',    label: 'Crédito y Cobranza',     icon: CreditCard },
    ],
  },
  dicotech: {
    label: 'Dicotech',
    color: '#0EA5E9',
    activo: true,
    pestanas: [
      { id: 'home',       label: 'Resumen',                icon: Home },
      { id: 'sellIn',     label: 'Sell In',                icon: ShoppingCart },
      { id: 'estrategia', label: 'Sell Out',               icon: ShoppingBag },
      { id: 'marketing',  label: 'Marketing',              icon: Megaphone },
      { id: 'pagos',      label: 'Pagos',                  icon: Wallet },
      { id: 'cartera',    label: 'Crédito y Cobranza',     icon: CreditCard },
    ],
  },
  // Mercado Libre se migró a la nueva empresa "Axon de México"
  // (Administración Interna → Axon de México). Se mantiene fuera de
  // este map para que no aparezca como cliente de Acteck.
};

const MENU_CONFIG = [
  {
    id: 'direccionGeneral',
    label: 'Dirección General',
    emoji: '🏛️',
    items: [
      { id: 'estadoResultados', label: 'Estado de Resultados', icon: Calculator },
    ],
  },
  {
    id: 'direccionComercial',
    label: 'Dirección Comercial',
    emoji: '📊',
    items: [
      { id: 'visionGeneral',    label: 'Visión General',      icon: Activity },
      { id: 'analisisClientes', label: 'Análisis por Cliente', icon: PieChart },
      { id: 'sellIn',           label: 'Sell In',             icon: ShoppingCart },
      { id: 'sellOut',          label: 'Sell Out',            icon: ShoppingBag },
      { id: 'inventarioGlobal', label: 'Inventario',          icon: Boxes },
      { id: 'cobranzaGlobal',   label: 'Cobranza',            icon: HandCoins },
      { id: 'forecastClientes', label: 'S&OP',                icon: Target },
      { type: 'separator', label: 'Clientes Propios' },
      { id: 'resumenClientes',  label: 'Resumen de Clientes', icon: BarChart3 },
      { id: 'propuestas',       label: 'Propuestas',          icon: ClipboardList },
      { id: 'estrategiaPrecios',label: 'Estrategia de Precios', icon: TrendingUp },
      { id: 'ordenesCompra',    label: 'Tracking Pedidos',    icon: FileCheck },
      {
        type: 'subgrupo',
        id: 'clientesLista',
        label: 'Clientes',
        icon: Users,
        children: [
          { type: 'cliente', clienteId: 'digitalife' },
          { type: 'cliente', clienteId: 'pcel' },
          { type: 'cliente', clienteId: 'dicotech' },
        ],
      },
    ],
  },
  {
    id: 'internaGrupo',
    label: 'Administración Interna',
    emoji: '🏢',
    // Ya no usa rolesPermitidos. Cada item se filtra individualmente por
    // puedeVerPestanaGlobal() — si no hay ninguno visible, el grupo entero
    // se oculta (lógica en GrupoBloque).
    items: [
      { id: 'adminInterna', label: 'Pendientes & Calendario', icon: ClipboardList },
      { id: 'telemetria',   label: 'Actividad del equipo',       icon: Activity },
    ],
  },
  {
    id: 'axonGrupo',
    label: 'Axon de México',
    emoji: '🛒',
    items: [
      { id: 'axonMexico', label: 'Resumen', icon: Building2 },
    ],
  },
];

const ROL_LABELS = {
  super_admin: 'Super Admin',
  admin:       'Administrador',
  asistente:   'Asistente',
  cliente:     'Cliente',
  viewer:      'Viewer',
};

const LS_KEY = 'sidebar_expanded_v2';
const loadExpanded = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { direccionGeneral: true, direccionComercial: true, internaGrupo: true, axonGrupo: true, clientesLista: true, cliente_digitalife: true };
};
const saveExpanded = (obj) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(obj)); } catch {}
};

// ────────────────────────────────────────────────────────────
//  COMPONENTE PRINCIPAL
// ────────────────────────────────────────────────────────────
export default function Sidebar({ clienteActivo, paginaActiva, onNavegar, onCerrarSesion, perfilUsuario }) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(loadExpanded);
  const [modoPresent, setModoPresent] = useState(false);
  useEffect(() => { saveExpanded(expanded); }, [expanded]);

  // Al cambiar de cliente: abrir ese, cerrar los demás
  useEffect(() => {
    if (clienteActivo) {
      setExpanded((prev) => {
        const next = { ...prev, direccionComercial: true };
        Object.keys(CLIENTES).forEach((cid) => {
          next[`cliente_${cid}`] = (cid === clienteActivo);
        });
        return next;
      });
    }
  }, [clienteActivo]);

  // Toggle con auto-colapsar otros clientes
  const toggle = (id) => {
    setExpanded((prev) => {
      if (id.startsWith('cliente_') && !prev[id]) {
        const next = { ...prev };
        Object.keys(next).forEach((k) => {
          if (k.startsWith('cliente_') && k !== id) next[k] = false;
        });
        next[id] = true;
        return next;
      }
      return { ...prev, [id]: !prev[id] };
    });
  };

  const isActiveLeaf   = (cid, pid) => clienteActivo === cid && paginaActiva === pid;
  const isActiveGlobal = (pid)      => clienteActivo === null && paginaActiva === pid;

  const puedeVerConfig  = puedeConfigurar(perfilUsuario);
  const puedeActualizar = puedeActualizarDatos(perfilUsuario);

  return (
    <aside className="flex flex-col shrink-0"
      style={{
        width: 264,
        background: 'var(--t-sidebar, #FFFFFF)',
        borderRight: '1px solid var(--t-sidebarBorder, rgba(0,0,0,0.06))',
        color: 'var(--t-sidebarText, #1D1D1F)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
      }}>
      {/* ─── BRAND ─── */}
      <div style={{ padding: '22px 22px 16px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {/* Logo mark — sólido, sin gradiente. Estilo por tema. */}
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: theme.key === 'midnight' ? theme.accent : theme.text,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: theme.key === 'midnight' ? '#000' : theme.textOnDark || '#F5F5F7',
            fontWeight: 700, fontSize: 13, letterSpacing: '-0.02em',
            fontFamily: '"SF Pro Display", sans-serif',
            boxShadow: theme.key === 'midnight' ? `0 0 12px ${theme.accentGlow || 'rgba(100,210,255,0.4)'}` : 'none',
          }}>a</div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: '-apple-system, "SF Pro Display", sans-serif',
              fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em', lineHeight: 1.2,
              color: 'var(--t-sidebarText, #1D1D1F)',
            }}>Dashboard</div>
            <div style={{
              fontSize: 11, fontWeight: 500, letterSpacing: 0, lineHeight: 1.3,
              color: 'var(--t-sidebarTextMuted, #6E6E73)',
            }}>Balam Rush · Acteck</div>
          </div>
        </div>
        {modoPresent && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12,
            padding: '3px 9px', borderRadius: 999,
            background: 'rgba(52,199,89,0.12)', color: '#1F7A3D',
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: 999, background: '#34C759' }} />
            Presentación
          </div>
        )}
      </div>

      {/* ─── NAV ─── */}
      <nav className="flex-1 overflow-y-auto" style={{ padding: '4px 14px' }}>
        {MENU_CONFIG
          .filter((grupo) => {
            // Compat: legacy rolesPermitidos. Nuevos grupos se filtran sus
            // items individualmente en GrupoBloque via puedeVerPestanaGlobal.
            if (grupo.rolesPermitidos && grupo.rolesPermitidos.length > 0) {
              return perfilUsuario && grupo.rolesPermitidos.includes(perfilUsuario.rol);
            }
            return true;
          })
          .map((grupo) => (
            <GrupoBloque
              key={grupo.id}
              grupo={grupo}
              expanded={expanded}
              toggle={toggle}
              clienteActivo={clienteActivo}
              onNavegar={onNavegar}
              isActiveLeaf={isActiveLeaf}
              isActiveGlobal={isActiveGlobal}
              modoPresent={modoPresent}
              perfil={perfilUsuario}
            />
          ))}
      </nav>

      {/* ─── FOOTER estilo Apple ─── */}
      <div style={{
        borderTop: '1px solid var(--t-sidebarBorder, rgba(0,0,0,0.06))',
        padding: '10px 14px 14px',
      }}>
        {/* Acciones admin como items del sidebar */}
        {!modoPresent && (puedeVerConfig || puedeActualizar) && (
          <div style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {puedeVerConfig && (
              <SidebarButton icon={Settings} label="Configuración"
                active={isActiveGlobal('configuracion')}
                onClick={() => onNavegar(null, 'configuracion')} />
            )}
            {puedeActualizar && (
              <a href="/uploads.html" style={{ textDecoration: 'none' }}>
                <SidebarButton icon={RefreshCw} label="Actualizar datos" />
              </a>
            )}
            <SidebarButton icon={Eye}
              label={modoPresent ? 'Salir de presentación' : 'Modo presentación'}
              active={modoPresent}
              onClick={() => setModoPresent(!modoPresent)} />
          </div>
        )}

        {/* Divisor sutil */}
        {perfilUsuario?.nombre && (puedeVerConfig || puedeActualizar) && (
          <div style={{
            height: 1, background: 'var(--t-sidebarBorder, rgba(0,0,0,0.06))',
            margin: '8px 0 10px',
          }} />
        )}

        {/* Tarjeta de usuario refinada */}
        {perfilUsuario?.nombre && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 11,
            padding: '4px 8px',
          }}>
            <div style={{
              width: 34, height: 34, flexShrink: 0, borderRadius: 999,
              background: theme.key === 'midnight'
                ? (theme.accentBg || 'rgba(100,210,255,0.15)')
                : theme.accent,
              color: theme.key === 'midnight' ? theme.accent : (theme.textOnDark || 'white'),
              border: theme.key === 'midnight' ? `1px solid ${theme.accent}` : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 600, fontSize: 13.5, letterSpacing: '-0.015em',
              fontFamily: '"SF Pro Display", sans-serif',
              boxShadow: theme.key === 'midnight'
                ? `0 0 12px ${theme.accentGlow || 'rgba(100,210,255,0.3)'}`
                : 'none',
            }}>
              {(perfilUsuario.nombre || 'U').charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: 13, fontWeight: 600,
                color: 'var(--t-sidebarText, #1D1D1F)', letterSpacing: '-0.005em',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{perfilUsuario.nombre}</div>
              <div style={{
                fontSize: 11, color: 'var(--t-sidebarTextMuted, #6E6E73)',
                fontWeight: 500, marginTop: 1,
              }}>{ROL_LABELS[perfilUsuario.rol] || perfilUsuario.rol}</div>
            </div>
            {onCerrarSesion && (
              <button onClick={onCerrarSesion} title="Cerrar sesión"
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--t-sidebarTextMuted, #6E6E73)',
                  padding: 8, borderRadius: 9, display: 'flex', alignItems: 'center',
                  transition: 'background 200ms cubic-bezier(0.32, 0.72, 0, 1), color 200ms, transform 180ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,59,48,0.1)'; e.currentTarget.style.color = '#FF3B30'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--t-sidebarTextMuted, #6E6E73)'; e.currentTarget.style.transform = 'scale(1)'; }}>
                <LogOut style={{ width: 14, height: 14, strokeWidth: 2 }} />
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

// Pill button legacy — no usado desde el rediseño del footer.
// eslint-disable-next-line no-unused-vars
function ApplePillButton({ icon: Icon, label, active, onClick, as = 'button', href }) {
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);
  const Comp = as;
  const bg = active
    ? 'var(--t-sidebarActive, rgba(0,113,227,0.10))'
    : hover ? 'rgba(127,127,127,0.08)' : 'transparent';
  const color = active
    ? 'var(--t-sidebarActiveText, #0071E3)'
    : 'var(--t-sidebarText, #1D1D1F)';
  return (
    <Comp {...(as === 'a' ? { href } : { onClick })}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '8px 12px', borderRadius: 10,
        background: bg, border: 'none', cursor: 'pointer',
        color, fontSize: 13, fontWeight: active ? 600 : 500,
        fontFamily: 'inherit', textDecoration: 'none',
        transform: `scale(${pressed ? 0.97 : 1}) translateX(${hover && !active ? 2 : 0}px)`,
        transition: 'background 220ms cubic-bezier(0.32, 0.72, 0, 1), color 200ms, transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        marginBottom: 2,
      }}>
      <Icon style={{ width: 15, height: 15, strokeWidth: 2, flexShrink: 0 }} />
      <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
    </Comp>
  );
}

// ────────── Grupo ──────────
function GrupoBloque({ grupo, expanded, toggle, clienteActivo, onNavegar, isActiveLeaf, isActiveGlobal, modoPresent, perfil }) {
  const isOpen = expanded[grupo.id];
  const hasItems = grupo.items && grupo.items.length > 0;

  // Filtra hijos de cliente/global según permisos. Devuelve true si el item
  // debe mostrarse al perfil actual.
  const isItemVisible = (item) => {
    if (item.type === 'separator') return true;
    if (item.type === 'cliente') {
      if (modoPresent && item.clienteId !== clienteActivo) return false;
      return puedeVerCliente(perfil, item.clienteId);
    }
    if (item.type === 'subgrupo') {
      // Visible si al menos un hijo lo es.
      return (item.children || []).some(isItemVisible);
    }
    const permisoId = MENU_A_PERMISO_GLOBAL[item.id];
    if (permisoId === '__super_admin_only__') return !!perfil?.es_super_admin;
    if (permisoId) return puedeVerPestanaGlobal(perfil, permisoId);
    return true;
  };

  const itemsFiltrados = (grupo.items || []).filter(isItemVisible);

  // Si no quedan items visibles (aparte de separadores), ocultar grupo entero.
  const hayNoSeparador = itemsFiltrados.some(i => i.type !== 'separator');
  if (!hayNoSeparador) return null;

  return (
    <div style={{ marginBottom: 18 }}>
      <button
        onClick={() => hasItems && toggle(grupo.id)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 6,
          padding: '10px 10px 6px', background: 'transparent', border: 'none',
          fontSize: 10.5, fontWeight: 600,
          color: 'var(--t-sidebarTextMuted, #86868B)',
          textTransform: 'uppercase', letterSpacing: '0.09em',
          fontFamily: 'inherit', cursor: hasItems ? 'pointer' : 'default',
          textAlign: 'left', opacity: 0.9,
        }}
      >
        <span style={{ flex: 1 }}>{grupo.label}</span>
        {hasItems && (
          <ChevronRight style={{
            width: 11, height: 11, strokeWidth: 2.5, opacity: 0.5,
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          }} />
        )}
      </button>

      {isOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {itemsFiltrados.map((item, idx) => {
            if (item.type === 'separator') {
              return (
                <div key={`sep-${idx}`} style={{
                  padding: '10px 10px 4px', fontSize: 10.5, fontWeight: 700,
                  color: 'var(--t-sidebarTextMuted, #86868B)',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>
                  {item.label}
                </div>
              );
            }
            if (item.type === 'cliente') {
              const cfg = CLIENTES[item.clienteId];
              if (!cfg) return null;
              return (
                <ClienteBloque
                  key={item.clienteId}
                  clienteId={item.clienteId}
                  cfg={cfg}
                  expanded={expanded}
                  toggle={toggle}
                  onNavegar={onNavegar}
                  isActiveLeaf={isActiveLeaf}
                  clienteActivo={clienteActivo}
                  perfil={perfil}
                />
              );
            }
            if (item.type === 'subgrupo') {
              const hijosVisibles = (item.children || []).filter(isItemVisible);
              if (hijosVisibles.length === 0) return null;
              const subOpen = expanded[item.id];
              const Icon = item.icon;
              return (
                <div key={item.id}>
                  <SidebarButton
                    icon={Icon}
                    label={item.label}
                    onClick={() => toggle(item.id)}
                    trailing={<ChevronRight style={{
                      width: 12, height: 12, strokeWidth: 2, opacity: 0.5,
                      transform: subOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                    }} />}
                  />
                  {subOpen && (
                    <div style={{ paddingLeft: 12, marginTop: 2, marginBottom: 4, display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {hijosVisibles.map((child) => {
                        if (child.type === 'cliente') {
                          const cfg = CLIENTES[child.clienteId];
                          if (!cfg) return null;
                          return (
                            <ClienteBloque
                              key={child.clienteId}
                              clienteId={child.clienteId}
                              cfg={cfg}
                              expanded={expanded}
                              toggle={toggle}
                              onNavegar={onNavegar}
                              isActiveLeaf={isActiveLeaf}
                              clienteActivo={clienteActivo}
                              perfil={perfil}
                            />
                          );
                        }
                        return (
                          <NavItem
                            key={child.id}
                            label={child.label}
                            icon={child.icon}
                            emoji={child.emoji}
                            disabled={child.disabled}
                            active={isActiveGlobal(child.id)}
                            onClick={() => !child.disabled && onNavegar(null, child.id)}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <NavItem
                key={item.id}
                label={item.label}
                icon={item.icon}
                emoji={item.emoji}
                disabled={item.disabled}
                hint={item.hint}
                active={isActiveGlobal(item.id)}
                onClick={() => !item.disabled && onNavegar(null, item.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ────────── Cliente ──────────
function ClienteBloque({ clienteId, cfg, expanded, toggle, onNavegar, isActiveLeaf, clienteActivo, perfil }) {
  const key = `cliente_${clienteId}`;
  const isOpen = expanded[key];
  const isClienteActual = clienteActivo === clienteId;

  if (!cfg.activo) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px', fontSize: 13,
        color: 'var(--t-sidebarTextMuted, #86868B)',
      }}>
        <Lock style={{ width: 13, height: 13, strokeWidth: 2 }} />
        <span style={{ flex: 1 }}>{cfg.label}</span>
      </div>
    );
  }

  const pestanasPermitidas = (cfg.pestanas || []).filter((p) =>
    puedeVerPestanaCliente(perfil, clienteId, p.id)
  );
  if (pestanasPermitidas.length === 0) return null;

  return (
    <div>
      <SidebarButton
        onClick={() => toggle(key)}
        active={isClienteActual}
        leading={<span style={{
          width: 8, height: 8, borderRadius: 999, flexShrink: 0,
          background: cfg.color, display: 'inline-block',
          boxShadow: isClienteActual ? `0 0 0 4px ${cfg.color}22` : 'none',
          transition: 'box-shadow 260ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        }} />}
        label={cfg.label}
        trailing={<ChevronRight style={{
          width: 12, height: 12, strokeWidth: 2, opacity: 0.5,
          transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        }} />}
      />
      {isOpen && (
        <div style={{ paddingLeft: 20, marginTop: 2, marginBottom: 4, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {pestanasPermitidas.map((p) => (
            <NavItem
              key={p.id}
              label={p.label}
              icon={p.icon}
              disabled={p.disabled}
              hint={p.hint}
              active={isActiveLeaf(clienteId, p.id)}
              onClick={() => !p.disabled && onNavegar(clienteId, p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ────────── SidebarButton — pill Apple con spring + variantes por tema ──────────
function SidebarButton({ icon: Icon, leading, label, trailing, active, disabled, onClick, hint }) {
  const { theme } = useTheme();
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);

  const isMidnight = theme.key === 'midnight';
  const isMarfil = theme.key === 'marfil';

  const bg = active
    ? theme.sidebarActive
    : hover && !disabled ? (isMidnight ? 'rgba(255,255,255,0.05)' : 'rgba(127,127,127,0.08)') : 'transparent';

  // Marfil: cuando el item está activo, mantenemos el color de texto normal
  // pero cambiamos el peso; el acento va en el ícono.
  const color = active
    ? (isMarfil ? theme.sidebarText : theme.sidebarActiveText)
    : disabled ? theme.sidebarTextMuted : theme.sidebarText;

  const iconColor = active
    ? (isMarfil ? (theme.sidebarActiveIcon || theme.orange) : theme.sidebarActiveText)
    : color;

  // Apple spring bounce
  const scale = pressed ? 0.97 : 1;
  const translateX = hover && !active && !disabled ? 2 : 0;

  return (
    <button onClick={onClick} disabled={disabled}
      title={hint || label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 11,
        padding: '9px 12px', borderRadius: 9, border: 'none',
        // Midnight active: barra vertical cyan a la izquierda
        borderLeft: active && isMidnight ? `2px solid ${theme.accent}` : '2px solid transparent',
        background: bg, color,
        fontSize: 13.5, fontWeight: active ? 600 : 400,
        letterSpacing: '-0.005em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit', textAlign: 'left',
        transform: `scale(${scale}) translateX(${translateX}px)`,
        transition: 'background 220ms cubic-bezier(0.32, 0.72, 0, 1), color 200ms, transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        opacity: disabled ? 0.4 : 1,
        position: 'relative',
        // Midnight active: glow tenue del texto
        textShadow: active && isMidnight ? `0 0 8px ${theme.accentGlow || 'rgba(100,210,255,0.4)'}` : 'none',
      }}>
      {leading}
      {Icon && <Icon style={{
        width: 16, height: 16, strokeWidth: 1.75, flexShrink: 0,
        color: iconColor,
        opacity: active ? 1 : 0.8,
        transition: 'opacity 200ms, color 200ms',
      }} />}
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {hint && !active && (
        <span style={{
          fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.06em',
          color: theme.sidebarTextMuted, fontWeight: 700, opacity: 0.7,
        }}>{hint}</span>
      )}
      {trailing && (
        <span style={{
          display: 'inline-flex', transition: 'transform 240ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}>{trailing}</span>
      )}
    </button>
  );
}

// ────────── NavItem — wrapper de SidebarButton ──────────
function NavItem({ label, icon, active, disabled, hint, onClick }) {
  return (
    <SidebarButton
      icon={icon} label={label} active={active} disabled={disabled}
      hint={hint} onClick={onClick}
    />
  );
}

// Export CLIENTES para el breadcrumb
export { CLIENTES };
