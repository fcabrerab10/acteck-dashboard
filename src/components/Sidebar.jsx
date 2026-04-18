import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Lock, LogOut, Eye, Settings, RefreshCw } from 'lucide-react';
import { puedeConfigurar, puedeActualizarDatos, puedeVerCliente, puedeVerPestana } from '../lib/permisos';

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
      { id: 'home',       label: 'Resumen',                emoji: '🏠' },
      { id: 'analisis',   label: 'Análisis',               emoji: '📈' },
      { id: 'estrategia', label: 'Estrategia de Producto', emoji: '📦' },
      { id: 'marketing',  label: 'Marketing',              emoji: '📢' },
      { id: 'pagos',      label: 'Pagos',                  emoji: '💰' },
      { id: 'cartera',    label: 'Crédito y Cobranza',     emoji: '📊' },
    ],
  },
  pcel: {
    label: 'PCEL',
    color: '#EF4444',
    activo: true,
    pestanas: [
      { id: 'home',       label: 'Resumen',                emoji: '🏠' },
      { id: 'analisis',   label: 'Análisis',               emoji: '📈' },
      { id: 'estrategia', label: 'Estrategia de Producto', emoji: '📦' },
      { id: 'marketing',  label: 'Marketing',              emoji: '📢', disabled: true, hint: 'Pronto' },
      { id: 'pagos',      label: 'Pagos',                  emoji: '💰' },
      { id: 'cartera',    label: 'Crédito y Cobranza',     emoji: '📊' },
    ],
  },
  mercadolibre: {
    label: 'Mercado Libre',
    color: '#3B82F6',
    activo: true,
    pestanas: [
      { id: 'home',       label: 'Resumen',                emoji: '🏠' },
      { id: 'analisis',   label: 'Análisis',               emoji: '📈' },
      { id: 'estrategia', label: 'Estrategia de Producto', emoji: '📦' },
      { id: 'marketing',  label: 'Marketing',              emoji: '📢' },
      { id: 'pagos',      label: 'Pagos',                  emoji: '💰' },
      { id: 'cartera',    label: 'Crédito y Cobranza',     emoji: '📊' },
    ],
  },
};

const MENU_CONFIG = [
  {
    id: 'direccionComercial',
    label: 'Dirección Comercial',
    emoji: '📊',
    items: [
      { id: 'resumenClientes',  label: 'Resumen de Clientes', emoji: '📈' },
      { id: 'forecastClientes', label: 'Forecast Clientes',   emoji: '🎯' },
      { type: 'separator', label: 'Clientes' },
      { type: 'cliente', clienteId: 'digitalife' },
      { type: 'cliente', clienteId: 'pcel' },
      { type: 'cliente', clienteId: 'mercadolibre' },
    ],
  },
  {
    id: 'internaGrupo',
    label: 'Administración Interna',
    emoji: '🏢',
    rolesPermitidos: ['super_admin', 'asistente'],
    items: [
      { id: 'adminInterna', label: 'Pendientes & Calendario', emoji: '📋' },
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
  return { direccionComercial: true, internaGrupo: true, cliente_digitalife: true };
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
    <aside className="w-60 bg-white border-r border-gray-100 flex flex-col shrink-0">
      {/* ─── HEADER ─── */}
      <div className="px-4 py-3 border-b border-gray-100">
        {!modoPresent ? (
          <p className="text-sm font-bold text-gray-800">Dashboard</p>
        ) : (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
            <p className="text-xs text-green-600 font-semibold uppercase tracking-widest">
              Modo Presentación
            </p>
          </div>
        )}
      </div>

      {/* ─── NAV ─── */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {MENU_CONFIG
          .filter((grupo) => {
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

      {/* ─── FOOTER ─── */}
      <div className="border-t border-gray-100">
        {/* Tarjeta de usuario */}
        {perfilUsuario?.nombre && (
          <div className="px-3 py-3 border-b border-gray-100 flex items-center gap-2">
            <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center font-bold text-sm">
              {(perfilUsuario.nombre || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-gray-800 truncate">
                {perfilUsuario.nombre}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">
                {ROL_LABELS[perfilUsuario.rol] || perfilUsuario.rol}
              </div>
            </div>
          </div>
        )}

        {/* Modo Presentación */}
        <div className="px-3 pt-2">
          <button
            onClick={() => setModoPresent(!modoPresent)}
            className={[
              'w-full text-xs font-medium px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5',
              modoPresent
                ? 'bg-gray-800 text-white hover:bg-gray-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            ].join(' ')}
          >
            <Eye className="w-3.5 h-3.5" />
            {modoPresent ? 'Salir de Presentación' : 'Modo Presentación'}
          </button>
        </div>

        {/* Acciones admin */}
        {!modoPresent && (puedeVerConfig || puedeActualizar) && (
          <div className="px-3 py-2 space-y-0.5">
            {puedeVerConfig && (
              <button
                onClick={() => onNavegar(null, 'configuracion')}
                className={[
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors',
                  isActiveGlobal('configuracion')
                    ? 'bg-gray-100 text-gray-800 font-semibold'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800',
                ].join(' ')}
              >
                <Settings className="w-3.5 h-3.5" />
                Configuración
              </button>
            )}
            {puedeActualizar && (
              <a
                href="/uploads.html"
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Actualizar Datos
              </a>
            )}
          </div>
        )}

        {/* Cerrar sesión */}
        {onCerrarSesion && (
          <div className="border-t border-gray-100 px-3 py-2">
            <button
              onClick={onCerrarSesion}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Cerrar sesión
            </button>
          </div>
        )}

        <div className="px-3 py-1.5 text-[10px] text-gray-400 text-center border-t border-gray-100">
          v1.0 · Abril 2026
        </div>
      </div>
    </aside>
  );
}

// ────────── Grupo ──────────
function GrupoBloque({ grupo, expanded, toggle, clienteActivo, onNavegar, isActiveLeaf, isActiveGlobal, modoPresent, perfil }) {
  const isOpen = expanded[grupo.id];
  const hasItems = grupo.items && grupo.items.length > 0;

  const itemsFiltrados = (grupo.items || []).filter((item) => {
    if (item.type === 'separator') return true;
    if (item.type === 'cliente') {
      if (modoPresent && item.clienteId !== clienteActivo) return false;
      return puedeVerCliente(perfil, item.clienteId);
    }
    return true;
  });

  if (itemsFiltrados.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => hasItems && toggle(grupo.id)}
        className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
      >
        {hasItems && (
          isOpen
            ? <ChevronDown className="w-4 h-4 text-gray-400" />
            : <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
        <span className="text-base">{grupo.emoji}</span>
        <span className="flex-1 text-left">{grupo.label}</span>
      </button>

      {isOpen && (
        <div className="ml-3 mt-0.5 pl-2 border-l border-gray-100 space-y-0.5">
          {itemsFiltrados.map((item, idx) => {
            if (item.type === 'separator') {
              return (
                <div
                  key={`sep-${idx}`}
                  className="mt-2 mb-1 px-2 text-[10px] uppercase tracking-widest font-semibold text-gray-400"
                >
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
            return (
              <NavItem
                key={item.id}
                label={item.label}
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
      <div className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-gray-400">
        <Lock className="w-3.5 h-3.5" />
        <span className="flex-1">{cfg.label}</span>
      </div>
    );
  }

  const pestanasPermitidas = (cfg.pestanas || []).filter((p) => puedeVerPestana(perfil, p.id));
  if (pestanasPermitidas.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => toggle(key)}
        className={[
          'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium transition-colors',
          isClienteActual ? 'text-blue-700 bg-blue-50/40' : 'text-gray-700 hover:bg-gray-50',
        ].join(' ')}
      >
        {isOpen
          ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: cfg.color }}
        />
        <span className="flex-1 text-left">{cfg.label}</span>
      </button>
      {isOpen && (
        <div className="ml-3 mt-0.5 pl-2 border-l border-gray-100 space-y-0.5">
          {pestanasPermitidas.map((p) => (
            <NavItem
              key={p.id}
              label={p.label}
              emoji={p.emoji}
              disabled={p.disabled}
              hint={p.hint}
              active={isActiveLeaf(clienteId, p.id)}
              onClick={() => !p.disabled && onNavegar(clienteId, p.id)}
              small
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ────────── NavItem ──────────
function NavItem({ label, emoji, active, disabled, hint, onClick, small = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={hint || label}
      className={[
        'w-full flex items-center gap-2 px-2 rounded-md text-left transition-colors',
        small ? 'py-1 text-[13px]' : 'py-1.5 text-sm',
        active
          ? 'bg-blue-50 text-blue-600 font-semibold'
          : disabled
          ? 'text-gray-400 cursor-not-allowed'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
      ].join(' ')}
    >
      {emoji && <span className="shrink-0">{emoji}</span>}
      <span className="flex-1 truncate">{label}</span>
      {hint && !active && (
        <span className="text-[9px] text-gray-400 uppercase">{hint}</span>
      )}
    </button>
  );
}

// Export CLIENTES para el breadcrumb
export { CLIENTES };
