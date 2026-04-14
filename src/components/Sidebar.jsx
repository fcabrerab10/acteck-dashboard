import { useState, useEffect } from 'react';

const ChevronRight = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
);
const ChevronDown = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
);
const Lock = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
);

/**
 * Sidebar â navegaciÃ³n jerÃ¡rquica de 3 niveles
 * Preserva el look & feel del dashboard actual (fondo blanco, emojis, acento azul).
 *
 * Props:
 *   clienteActivo  â 'digitalife' | 'pcel' | 'mercadolibre' | null
 *   paginaActiva   â id de la vista actual ('home', 'analisis', 'estrategia',
 *                    'marketing', 'pagos', 'cartera', 'forecast',
 *                    'resumenClientes', 'forecastClientes', 'configuracion')
 *   onNavegar      â (clienteId | null, paginaId) => void
 *   onActualizarDatos â () => void   (opcional, botÃ³n "Actualizar Datos")
 *   onCerrarSesion    â () => void
 *   perfilUsuario  â { nombre, email, rol }
 *   modoPresent    â bool (si true, oculta cosas sensibles)
 */

// PestaÃ±as por cliente â IDs idÃ©nticos al App.jsx actual
const PESTANAS_POR_CLIENTE = {
  digitalife: {
    label: 'Digitalife',
    badge: { text: 'Acteck', cls: 'bg-red-100 text-red-700' },
    activo: true,
    pestanas: [
      { id: 'home',       label: 'Resumen',                emoji: 'ð ' },
      { id: 'analisis',   label: 'AnÃ¡lisis',               emoji: 'ð' },
      { id: 'estrategia', label: 'Estrategia de Producto', emoji: 'ð¦' },
      { id: 'marketing',  label: 'Marketing',              emoji: 'ð¢' },
      { id: 'pagos',      label: 'Pagos',                  emoji: 'ð°' },
      { id: 'cartera',    label: 'CrÃ©dito y Cobranza',     emoji: 'ð' },
    ],
  },
  pcel: {
    label: 'PCEL',
    badge: { text: 'Acteck', cls: 'bg-red-100 text-red-700' },
    activo: true,
    pestanas: [
      { id: 'home',       label: 'Resumen',                emoji: 'ð ' },
      { id: 'analisis',   label: 'AnÃ¡lisis',               emoji: 'ð' },
      { id: 'estrategia', label: 'Estrategia de Producto', emoji: 'ð¦' },
      { id: 'marketing',  label: 'Marketing',              emoji: 'ð¢', disabled: true, hint: 'Pronto' },
      { id: 'pagos',      label: 'Pagos',                  emoji: 'ð°' },
      { id: 'cartera',    label: 'CrÃ©dito y Cobranza',     emoji: 'ð' },
    ],
  },
  mercadolibre: {
    label: 'Mercado Libre',
    badge: { text: 'Balam Rush', cls: 'bg-blue-100 text-blue-700' },
    activo: true,
    pestanas: [
      { id: 'home',       label: 'Resumen',                emoji: 'ð ' },
      { id: 'analisis',   label: 'AnÃ¡lisis',               emoji: 'ð' },
      { id: 'estrategia', label: 'Estrategia de Producto', emoji: 'ð¦' },
      { id: 'marketing',  label: 'Marketing',              emoji: 'ð¢' },
      { id: 'pagos',      label: 'Pagos',                  emoji: 'ð°' },
      { id: 'cartera',    label: 'CrÃ©dito y Cobranza',     emoji: 'ð' },
    ],
  },
};

// Estructura top-level
const MENU_CONFIG = [
  {
    id: 'negocio',
    label: 'Negocio',
    emoji: 'ð¼',
    items: [
      { id: 'estadoResultados', label: 'Estado de Resultados', emoji: 'ð', disabled: true, hint: 'PrÃ³ximamente' },
      { id: 'preciosMargenes',  label: 'Precios y MÃ¡rgenes',   emoji: 'ð²', disabled: true, hint: 'PrÃ³ximamente' },
      { id: 'forecastNegocio',  label: 'Forecast General',     emoji: 'ð¯', disabled: true, hint: 'PrÃ³ximamente' },
    ],
  },
  {
    id: 'direccionComercial',
    label: 'DirecciÃ³n Comercial',
    emoji: 'ð',
    items: [
      { id: 'resumenClientes',  label: 'Resumen de Clientes', emoji: 'ð' },
      { id: 'forecastClientes', label: 'Forecast Clientes',   emoji: 'ð¯' },
      { id: 'adminClientes',    label: 'AdministraciÃ³n de Clientes', emoji: 'ð¥', type: 'clientes' },
    ],
  },
];

// Estado expandido persistente
const LS_KEY = 'sidebar_expanded_v1';
const loadExpanded = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    direccionComercial: true,
    adminClientes: true,
    cliente_digitalife: true,
  };
};
const saveExpanded = (obj) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(obj)); } catch {}
};

// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
//  COMPONENTE
// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export default function Sidebar({
  clienteActivo,
  paginaActiva,
  onNavegar,
  onActualizarDatos,
  onCerrarSesion,
  perfilUsuario,
  modoPresent = false,
}) {
  const [expanded, setExpanded] = useState(loadExpanded);
  useEffect(() => { saveExpanded(expanded); }, [expanded]);

  // Asegurar que el cliente activo estÃ© expandido automÃ¡ticamente
  useEffect(() => {
    if (clienteActivo) {
      setExpanded((prev) => ({
        ...prev,
        direccionComercial: true,
        adminClientes: true,
        [`cliente_${clienteActivo}`]: true,
      }));
    }
  }, [clienteActivo]);

  const toggle = (id) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const isActiveLeaf = (clienteId, pageId) =>
    clienteActivo === clienteId && paginaActiva === pageId;
  const isActiveGlobal = (pageId) =>
    clienteActivo === null && paginaActiva === pageId;

  const esAdmin = perfilUsuario?.rol === 'admin';

  return (
    <aside className="w-60 bg-white border-r border-gray-100 flex flex-col shadow-sm shrink-0 overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-gray-100">
        {!modoPresent ? (
          <>
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">
              Dashboard
            </p>
            <div className="flex gap-2">
              <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-semibold">
                Acteck
              </span>
              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-semibold">
                Balam Rush
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
            <p className="text-xs text-green-600 font-semibold uppercase tracking-widest">
              Modo PresentaciÃ³n
            </p>
          </div>
        )}
      </div>

      {/* Nav scrollable */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {MENU_CONFIG.map((grupo) => (
          <GrupoBloque
            key={grupo.id}
            grupo={grupo}
            expanded={expanded}
            toggle={toggle}
            clienteActivo={clienteActivo}
            paginaActiva={paginaActiva}
            onNavegar={onNavegar}
            isActiveLeaf={isActiveLeaf}
            isActiveGlobal={isActiveGlobal}
          />
        ))}
      </nav>

      {/* Actualizar Datos */}
      {onActualizarDatos && esAdmin && !modoPresent && (
        <div className="px-3 pb-2">
          <button
            onClick={onActualizarDatos}
            className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold shadow hover:shadow-md transition-all flex items-center justify-center gap-2"
          >
            ð Actualizar Datos
          </button>
        </div>
      )}

      {/* ConfiguraciÃ³n */}
      {esAdmin && (
        <div className="px-3 pb-2">
          <button
            onClick={() => onNavegar(null, 'configuracion')}
            className={[
              'w-full py-2 px-3 rounded-lg text-sm font-semibold transition-all flex items-center gap-2',
              isActiveGlobal('configuracion')
                ? 'bg-black text-white'
                : 'bg-gray-900 text-white hover:bg-black',
            ].join(' ')}
          >
            âï¸ ConfiguraciÃ³n
          </button>
        </div>
      )}

      {/* Footer: usuario + cerrar sesiÃ³n */}
      <div className="border-t border-gray-100 px-3 py-2 text-xs text-gray-500">
        {perfilUsuario?.nombre && (
          <div className="font-medium text-gray-700 truncate">{perfilUsuario.nombre}</div>
        )}
        {onCerrarSesion && (
          <button
            onClick={onCerrarSesion}
            className="text-gray-500 hover:text-gray-800 transition-colors"
          >
            Cerrar sesiÃ³n
          </button>
        )}
        <div className="text-gray-400 mt-1">v1.0 Â· Abril 2026</div>
      </div>
    </aside>
  );
}

// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
//  SUBCOMPONENTES
// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function GrupoBloque({ grupo, expanded, toggle, clienteActivo, paginaActiva, onNavegar, isActiveLeaf, isActiveGlobal }) {
  const isOpen = expanded[grupo.id];
  const hasItems = grupo.items && grupo.items.length > 0;

  return (
    <div>
      <button
        onClick={() => hasItems && toggle(grupo.id)}
        className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
      >
        {hasItems && (
          isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
        <span className="text-base">{grupo.emoji}</span>
        <span className="flex-1 text-left">{grupo.label}</span>
      </button>

      {isOpen && hasItems && (
        <div className="ml-3 mt-0.5 pl-2 border-l border-gray-100 space-y-0.5">
          {grupo.items.map((item) => {
            if (item.type === 'clientes') {
              const isAdminOpen = expanded[item.id];
              return (
                <div key={item.id}>
                  <button
                    onClick={() => toggle(item.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    {isAdminOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                    <span>{item.emoji}</span>
                    <span className="flex-1 text-left">{item.label}</span>
                  </button>
                  {isAdminOpen && (
                    <div className="ml-3 mt-0.5 pl-2 border-l border-gray-100 space-y-0.5">
                      {Object.entries(PESTANAS_POR_CLIENTE).map(([cid, cfg]) => (
                        <ClienteBloque
                          key={cid}
                          clienteId={cid}
                          cfg={cfg}
                          expanded={expanded}
                          toggle={toggle}
                          onNavegar={onNavegar}
                          isActiveLeaf={isActiveLeaf}
                          clienteActivo={clienteActivo}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            // Ãtem normal dentro del grupo
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

function ClienteBloque({ clienteId, cfg, expanded, toggle, onNavegar, isActiveLeaf, clienteActivo }) {
  const key = `cliente_${clienteId}`;
  const isOpen = expanded[key];
  const isClienteActual = clienteActivo === clienteId;

  if (!cfg.activo) {
    return (
      <div className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-gray-400">
        <Lock className="w-3.5 h-3.5" />
        <span className="flex-1">{cfg.label}</span>
        {cfg.hint && <span className="text-[10px] uppercase">{cfg.hint}</span>}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => toggle(key)}
        className={[
          'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium transition-colors',
          isClienteActual ? 'text-blue-700' : 'text-gray-700 hover:bg-gray-50',
        ].join(' ')}
      >
        {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
        <span className="flex-1 text-left">{cfg.label}</span>
        {cfg.badge && (
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${cfg.badge.cls}`}>
            {cfg.badge.text}
          </span>
        )}
      </button>
      {isOpen && (
        <div className="ml-3 mt-0.5 pl-2 border-l border-gray-100 space-y-0.5">
          {cfg.pestanas.map((p) => (
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
