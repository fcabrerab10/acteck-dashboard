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
    <aside className="w-60 flex flex-col shrink-0"
      style={{
        background: 'var(--t-sidebar, #FFFFFF)',
        borderRight: '1px solid var(--t-sidebarBorder, rgba(0,0,0,0.06))',
        color: 'var(--t-sidebarText, #1D1D1F)',
      }}>
      {/* ─── BRAND ─── */}
      <div style={{ padding: '18px 20px 12px' }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--t-sidebarTextMuted, #6E6E73)', letterSpacing: 0 }}>
          Balam Rush
        </div>
        <div style={{
          fontFamily: '-apple-system, "SF Pro Display", sans-serif',
          fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.15,
          color: 'var(--t-sidebarText, #1D1D1F)', marginTop: 2,
        }}>Dashboard Acteck</div>
        {modoPresent && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10,
            padding: '3px 9px', borderRadius: 999,
            background: 'rgba(52,199,89,0.12)', color: '#1F7A3D',
            fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: '#34C759' }} />
            Presentación
          </div>
        )}
      </div>

      {/* ─── NAV ─── */}
      <nav className="flex-1 overflow-y-auto" style={{ padding: '4px 12px' }}>
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
        padding: '12px',
      }}>
        {/* Acciones admin */}
        {!modoPresent && (puedeVerConfig || puedeActualizar) && (
          <div style={{ marginBottom: 8 }}>
            {puedeVerConfig && (
              <ApplePillButton icon={Settings} label="Configuración"
                active={isActiveGlobal('configuracion')}
                onClick={() => onNavegar(null, 'configuracion')} />
            )}
            {puedeActualizar && (
              <ApplePillButton as="a" href="/uploads.html" icon={RefreshCw} label="Actualizar datos" />
            )}
          </div>
        )}

        {/* Modo Presentación */}
        <button onClick={() => setModoPresent(!modoPresent)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 12px', borderRadius: 999,
            background: modoPresent ? 'var(--t-sidebarText, #1D1D1F)' : 'transparent',
            border: `1px solid ${modoPresent ? 'transparent' : 'var(--t-sidebarBorder, rgba(0,0,0,0.1))'}`,
            color: modoPresent ? 'var(--t-sidebar, #FFF)' : 'var(--t-sidebarTextMuted, #6E6E73)',
            fontSize: 11.5, fontWeight: 500, cursor: 'pointer',
            fontFamily: 'inherit', marginBottom: 8, transition: 'all 160ms',
          }}>
          <Eye style={{ width: 13, height: 13, strokeWidth: 2 }} />
          {modoPresent ? 'Salir de presentación' : 'Modo presentación'}
        </button>

        {/* Tarjeta de usuario */}
        {perfilUsuario?.nombre && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 8px', borderRadius: 12,
            background: 'transparent',
          }}>
            <div style={{
              width: 32, height: 32, flexShrink: 0, borderRadius: 999,
              background: 'linear-gradient(135deg, #0071E3, #5856D6)',
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 600, fontSize: 13, letterSpacing: '-0.01em',
              boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
            }}>
              {(perfilUsuario.nombre || 'U').charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: 12.5, fontWeight: 600, color: 'var(--t-sidebarText, #1D1D1F)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{perfilUsuario.nombre}</div>
              <div style={{
                fontSize: 10.5, color: 'var(--t-sidebarTextMuted, #6E6E73)', fontWeight: 500,
              }}>{ROL_LABELS[perfilUsuario.rol] || perfilUsuario.rol}</div>
            </div>
            {onCerrarSesion && (
              <button onClick={onCerrarSesion} title="Cerrar sesión"
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--t-sidebarTextMuted, #6E6E73)',
                  padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center',
                  transition: 'background 160ms, color 160ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,59,48,0.1)'; e.currentTarget.style.color = '#FF3B30'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--t-sidebarTextMuted, #6E6E73)'; }}>
                <LogOut style={{ width: 14, height: 14, strokeWidth: 2 }} />
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

// Pill button reutilizable estilo Apple para el footer del sidebar
function ApplePillButton({ icon: Icon, label, active, onClick, as = 'button', href }) {
  const [hover, setHover] = React.useState(false);
  const Comp = as;
  const bg = active
    ? 'var(--t-sidebarActive, rgba(0,113,227,0.10))'
    : hover ? 'rgba(0,0,0,0.04)' : 'transparent';
  const color = active
    ? 'var(--t-sidebarActiveText, #0071E3)'
    : 'var(--t-sidebarText, #1D1D1F)';
  return (
    <Comp {...(as === 'a' ? { href } : { onClick })}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '8px 12px', borderRadius: 10,
        background: bg, border: 'none', cursor: 'pointer',
        color, fontSize: 13, fontWeight: active ? 600 : 500,
        fontFamily: 'inherit', textDecoration: 'none',
        transition: 'background 160ms, color 160ms', marginBottom: 2,
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
    <div style={{ marginBottom: 14 }}>
      <button
        onClick={() => hasItems && toggle(grupo.id)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 10px 6px', background: 'transparent', border: 'none',
          fontSize: 10.5, fontWeight: 700,
          color: 'var(--t-sidebarTextMuted, #86868B)',
          textTransform: 'uppercase', letterSpacing: '0.08em',
          fontFamily: 'inherit', cursor: hasItems ? 'pointer' : 'default',
          textAlign: 'left',
        }}
      >
        <span style={{ flex: 1 }}>{grupo.label}</span>
        {hasItems && (
          isOpen
            ? <ChevronDown style={{ width: 12, height: 12, strokeWidth: 2, opacity: 0.6 }} />
            : <ChevronRight style={{ width: 12, height: 12, strokeWidth: 2, opacity: 0.6 }} />
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
                    trailing={subOpen
                      ? <ChevronDown style={{ width: 12, height: 12, strokeWidth: 2, opacity: 0.5 }} />
                      : <ChevronRight style={{ width: 12, height: 12, strokeWidth: 2, opacity: 0.5 }} />}
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
        }} />}
        label={cfg.label}
        trailing={isOpen
          ? <ChevronDown style={{ width: 12, height: 12, strokeWidth: 2, opacity: 0.5 }} />
          : <ChevronRight style={{ width: 12, height: 12, strokeWidth: 2, opacity: 0.5 }} />}
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

// ────────── SidebarButton — pill Apple genérico ──────────
function SidebarButton({ icon: Icon, leading, label, trailing, active, disabled, onClick, hint }) {
  const [hover, setHover] = React.useState(false);
  const bg = active
    ? 'var(--t-sidebarActive, rgba(0,113,227,0.10))'
    : hover && !disabled ? 'rgba(0,0,0,0.04)' : 'transparent';
  const color = active
    ? 'var(--t-sidebarActiveText, #0071E3)'
    : disabled
    ? 'var(--t-sidebarTextMuted, #86868B)'
    : 'var(--t-sidebarText, #1D1D1F)';

  return (
    <button onClick={onClick} disabled={disabled}
      title={hint || label}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '7px 12px', borderRadius: 10, border: 'none',
        background: bg, color,
        fontSize: 13, fontWeight: active ? 600 : 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit', textAlign: 'left',
        transition: 'background 160ms, color 160ms',
        opacity: disabled ? 0.5 : 1,
      }}>
      {leading}
      {Icon && <Icon style={{ width: 15, height: 15, strokeWidth: 2, flexShrink: 0, opacity: active ? 1 : 0.75 }} />}
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {hint && !active && (
        <span style={{
          fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.05em',
          color: 'var(--t-sidebarTextMuted, #86868B)', fontWeight: 600,
        }}>{hint}</span>
      )}
      {trailing}
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
