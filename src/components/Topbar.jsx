// Topbar · Propuesta A · trío de pills flotantes
// ─ Pill izquierdo: 4 menu-módulo (General · Comercial · Admin · Axon)
//   cada uno abre un dropdown con los items de ese grupo (sidebar entera migrada)
// ─ Pill central: search ⌘K (stub)
// ─ Pill derecho: Actualizar datos + Notif + Avatar (con menú de usuario)

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Bell, Search, Check, ChevronDown, X, RefreshCw, LogOut, Settings, Eye,
  AlertTriangle, Clock, Sparkles, Sun, Moon, Palette,
  Home, TrendingUp, Megaphone, Wallet, CreditCard,
  BarChart3, Target, ClipboardList, FileCheck, Calculator, Building2,
  Activity, PieChart, ShoppingCart, ShoppingBag, Boxes, HandCoins,
} from 'lucide-react';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';
import { supabase, DB_CONFIGURED } from '../lib/supabase';
import { CLIENTES as SIDEBAR_CLIENTES } from './Sidebar';
import {
  puedeConfigurar,
  puedeActualizarDatos,
  puedeVerCliente,
  puedeVerPestanaCliente,
  puedeVerPestanaGlobal,
} from '../lib/permisos';

// ═════════ Config de módulos (migrado del Sidebar) ═════════
const MODULOS = [
  {
    id: 'direccion', label: 'Dirección',
    items: [
      { id: 'estadoResultados', label: 'Estado de Resultados', icon: Calculator, permiso: 'estado_resultados' },
    ],
  },
  {
    id: 'comercial', label: 'Comercial',
    items: [
      { id: 'visionGeneral',    label: 'Visión General',       icon: Activity,     permiso: 'vision_general' },
      { id: 'analisisClientes', label: 'Análisis por Cliente', icon: PieChart,     permiso: 'analisis_clientes' },
      { id: 'sellIn',           label: 'Sell In',              icon: ShoppingCart, permiso: 'sell_in' },
      { id: 'sellOut',          label: 'Sell Out',             icon: ShoppingBag,  permiso: 'sell_out' },
      { id: 'inventarioGlobal', label: 'Inventario',           icon: Boxes,        permiso: 'inventario_global' },
      { id: 'cobranzaGlobal',   label: 'Cobranza',             icon: HandCoins,    permiso: 'cobranza_global' },
      { id: 'forecastClientes', label: 'S&OP',                 icon: Target,       permiso: 'forecast_clientes' },
    ],
  },
  {
    id: 'interno', label: 'Interno',
    grupos: [
      {
        label: 'Clientes Propios',
        items: [
          { id: 'resumenClientes',   label: 'Resumen de Clientes',   icon: BarChart3,     permiso: 'resumen_clientes' },
          { id: 'propuestas',        label: 'Propuestas',            icon: ClipboardList, permiso: 'propuestas' },
          { id: 'estrategiaPrecios', label: 'Estrategia de Precios', icon: TrendingUp,    permiso: 'estrategia_precios' },
          { id: 'ordenesCompra',     label: 'Tracking Pedidos',      icon: FileCheck,     permiso: 'ordenes_compra' },
        ],
      },
      { label: 'Clientes', clientes: true },
      {
        label: 'Administración',
        items: [
          { id: 'adminInterna', label: 'Pendientes & Calendario', icon: ClipboardList, permiso: 'admin_interna' },
          { id: 'telemetria',   label: 'Actividad del equipo',    icon: Activity,      permiso: '__super_admin__' },
        ],
      },
    ],
  },
  {
    id: 'axon', label: 'Axon',
    items: [
      { id: 'axonMexico', label: 'Resumen Axon', icon: Building2, permiso: 'axon_mexico' },
    ],
  },
];

// Cliente pestañas (mismo layout que Sidebar)
const CLIENTE_PESTANAS = [
  { id: 'home',       label: 'Resumen',            icon: Home },
  { id: 'sellIn',     label: 'Sell In',            icon: ShoppingCart },
  { id: 'estrategia', label: 'Sell Out',           icon: ShoppingBag },
  { id: 'marketing',  label: 'Marketing',          icon: Megaphone },
  { id: 'pagos',      label: 'Pagos',              icon: Wallet },
  { id: 'cartera',    label: 'Crédito y Cobranza', icon: CreditCard },
];

// Etiquetas legibles del breadcrumb
const PAGINA_LABEL = {
  home: 'Resumen', analisis: 'Análisis', sellIn: 'Sell In', estrategia: 'Sell Out',
  marketing: 'Marketing', pagos: 'Pagos', cartera: 'Crédito y Cobranza',
  resumenClientes: 'Resumen de Clientes', estadoResultados: 'Estado de Resultados',
  visionGeneral: 'Visión General', analisisClientes: 'Análisis por Cliente',
  sellOut: 'Sell Out', inventarioGlobal: 'Inventario', cobranzaGlobal: 'Cobranza',
  forecastClientes: 'S&OP', estrategiaPrecios: 'Estrategia de Precios',
  ordenesCompra: 'Tracking Pedidos', propuestas: 'Propuestas',
  adminInterna: 'Pendientes & Calendario', telemetria: 'Actividad del equipo',
  axonMexico: 'Axon de México', configuracion: 'Configuración', actualizacion: 'Actualización de datos',
};

// Cuál módulo pertenece a cada página (para marcar el activo en la pill izquierda)
const PAGINA_A_MODULO = {
  estadoResultados: 'direccion',
  visionGeneral: 'comercial', analisisClientes: 'comercial', sellIn: 'comercial', sellOut: 'comercial',
  inventarioGlobal: 'comercial', cobranzaGlobal: 'comercial', forecastClientes: 'comercial',
  resumenClientes: 'interno', propuestas: 'interno', estrategiaPrecios: 'interno', ordenesCompra: 'interno',
  adminInterna: 'interno', telemetria: 'interno',
  axonMexico: 'axon',
  home: 'interno', analisis: 'interno', marketing: 'interno', pagos: 'interno', cartera: 'interno',
  estrategia: 'interno',
};

const UMBRAL_DIAS_ALERTA = 3;
const ETAPAS_BASE = ['recibida', 'procesada', 'surtida', 'entregada'];
const ETAPAS_DICOTECH = ['cotizacion_solicitada', 'cotizacion_enviada', 'recibida', 'procesada', 'surtida', 'entregada'];
const CAMPO_ETAPA = {
  cotizacion_solicitada: 'fecha_cotizacion_solicitada',
  cotizacion_enviada:    'fecha_cotizacion_enviada',
  recibida:              'fecha_recibida',
  procesada:             'fecha_procesada',
  surtida:               'fecha_surtida',
  entregada:             'fecha_entregada',
};
function analizarOc(oc) {
  const etapas = oc.cliente_key === 'dicotech' ? ETAPAS_DICOTECH : ETAPAS_BASE;
  let ultima = null, fechaUltima = null;
  for (const e of etapas) { const f = oc[CAMPO_ETAPA[e]]; if (f) { ultima = e; fechaUltima = f; } }
  if (!ultima || ultima === 'entregada') return null;
  const dias = Math.floor((Date.now() - new Date(fechaUltima).getTime()) / 86400000);
  return { etapaActual: ultima, dias, fechaUltima };
}

// ═════════ Componente principal ═════════
export default function Topbar({ clienteActivo, paginaActiva, vistaActual, onNavegar, onCerrarSesion, perfilUsuario, modoPresent, onToggleModoPresent }) {
  const { theme, setThemeKey } = useTheme();
  const [openMenuId, setOpenMenuId] = useState(null); // null · 'general' · 'comercial' · 'admin' · 'axon' · 'update' · 'notif' · 'user'
  const [clienteExpanded, setClienteExpanded] = useState(null); // cliente expandido dentro del menu comercial
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [silenciadas, setSilenciadas] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('notif_silenciadas') || '[]')); }
    catch { return new Set(); }
  });

  const isMidnight = theme.key === 'midnight';
  const isMarfil = theme.key === 'marfil';

  const moduloActivo = PAGINA_A_MODULO[paginaActiva] || (clienteActivo ? 'comercial' : null);

  // ─ Fetch notifs (OCs atrasadas) ─
  useEffect(() => {
    if (!DB_CONFIGURED) return;
    let cancel = false;
    (async () => {
      const [{ data: ocs = [] }, { data: envios = [] }] = await Promise.all([
        supabase.from('oc_clientes').select('*'),
        supabase.from('oc_envios').select('*'),
      ]);
      if (cancel) return;
      const enviosPorOc = new Map();
      envios.forEach(e => { const arr = enviosPorOc.get(e.oc_id) || []; arr.push(e); enviosPorOc.set(e.oc_id, arr); });

      const alertas = [];
      ocs.forEach(oc => {
        const enviosDeEsta = enviosPorOc.get(oc.id) || [];
        const entregadosTodos = enviosDeEsta.length > 0 && enviosDeEsta.every(e => e.fecha_entregada);
        if (entregadosTodos) return;
        const info = analizarOc(oc);
        if (!info) return;
        if (info.dias >= UMBRAL_DIAS_ALERTA) {
          const clienteLabel = SIDEBAR_CLIENTES[oc.cliente_key]?.label || oc.cliente_key;
          const etapaLegible = ({
            cotizacion_solicitada: 'Cotización solicitada', cotizacion_enviada: 'Cotización enviada',
            recibida: 'Recibida', procesada: 'Procesada', surtida: 'Surtida',
          })[info.etapaActual] || info.etapaActual;
          alertas.push({
            id: `oc-${oc.id}`,
            severidad: info.dias >= 7 ? 'urgente' : 'warn',
            titulo: `${clienteLabel} · OC ${oc.numero_oc_cliente} · ${info.dias}d en ${etapaLegible}`,
            subtitulo: 'Tracking Pedidos',
            navegarA: () => onNavegar(null, 'ordenesCompra'),
            tiempo: `hace ${info.dias}d`,
          });
        }
      });

      const listas = ocs.filter(oc => {
        const enviosDeEsta = enviosPorOc.get(oc.id) || [];
        if (enviosDeEsta.length === 0) return false;
        return enviosDeEsta.every(e => e.fecha_surtida) && enviosDeEsta.some(e => !e.fecha_entregada);
      });
      if (listas.length >= 2) {
        alertas.push({
          id: 'copilot-cerrar', severidad: 'info',
          titulo: `${listas.length} OCs listas para marcar como Entregadas`,
          subtitulo: 'Copilot Operaciones', navegarA: () => onNavegar(null, 'ordenesCompra'), tiempo: 'ahora',
        });
      }
      alertas.sort((a, b) => (a.severidad === 'urgente' ? -1 : 1));
      setNotifs(alertas);
    })();
    return () => { cancel = true; };
  }, [onNavegar]);

  // ─ Shortcuts ─
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(v => !v); }
      if (e.key === 'Escape') { setSearchOpen(false); setOpenMenuId(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ─ Cerrar popovers al click afuera ─
  const rootRef = useRef(null);
  useEffect(() => {
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpenMenuId(null);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // ─ Hover-to-open (estilo apple.com) — con delay al cerrar ─
  const closeTimerRef = useRef(null);
  const openOnHover = (id) => {
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
    setOpenMenuId(id);
  };
  const scheduleClose = (id) => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setOpenMenuId(cur => (cur === id ? null : cur));
      closeTimerRef.current = null;
    }, 220);
  };

  const silenciar = (id) => {
    setSilenciadas(prev => {
      const next = new Set(prev); next.add(id);
      try { localStorage.setItem('notif_silenciadas', JSON.stringify([...next])); } catch {}
      return next;
    });
  };
  const marcarTodo = () => {
    setSilenciadas(prev => {
      const next = new Set(prev); notifs.forEach(n => next.add(n.id));
      try { localStorage.setItem('notif_silenciadas', JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const notifsVisibles = notifs.filter(n => !silenciadas.has(n.id));
  const urgentes = notifsVisibles.filter(n => n.severidad === 'urgente');
  const warns    = notifsVisibles.filter(n => n.severidad === 'warn');
  const infos    = notifsVisibles.filter(n => n.severidad === 'info');

  const iniciales = (perfilUsuario?.nombre || 'U').split(' ').filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');

  // ─ Estilos base ─
  const pillStyle = {
    height: 34,
    background: isMidnight ? 'rgba(30,30,32,0.72)' : isMarfil ? 'rgba(255,251,244,0.78)' : 'rgba(255,255,255,0.78)',
    backdropFilter: 'saturate(180%) blur(24px)',
    WebkitBackdropFilter: 'saturate(180%) blur(24px)',
    border: `1px solid ${isMidnight ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
    borderRadius: 999,
    boxShadow: isMidnight ? '0 2px 10px rgba(0,0,0,0.3)' : '0 2px 10px rgba(0,0,0,0.06)',
    display: 'inline-flex', alignItems: 'center',
    color: theme.text, fontFamily: TYPO.fontText,
  };
  const miniBtnStyle = {
    width: 26, height: 26, padding: 0, border: 0, background: 'transparent',
    borderRadius: 6, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    color: theme.text, position: 'relative',
  };

  const closeMenu = () => setOpenMenuId(null);

  const handleSelect = (pagina) => {
    closeMenu();
    onNavegar(null, pagina);
  };
  const handleSelectCliente = (clienteKey, pestanaId) => {
    closeMenu();
    onNavegar(clienteKey, pestanaId);
  };

  return (
    <>
      <div
        ref={rootRef}
        style={{
          position: 'sticky', top: 0, zIndex: 40,
          padding: '10px 14px',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          gap: 10,
          alignItems: 'center',
          pointerEvents: 'none',
        }}
      >
        {/* ═══ PILL IZQUIERDA · 4 menu-módulo ═══ */}
        <div
          style={{ position: 'relative', pointerEvents: 'auto' }}
          onMouseLeave={() => scheduleClose(openMenuId)}
          onMouseEnter={() => { if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; } }}
        >
          <div style={{ ...pillStyle, padding: '0 4px', gap: 2 }}>
            {MODULOS.map(m => {
              const active = moduloActivo === m.id;
              const isOpen = openMenuId === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setOpenMenuId(isOpen ? null : m.id)}
                  onMouseEnter={(e) => {
                    openOnHover(m.id);
                    if (!active) { e.currentTarget.style.background = isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'; e.currentTarget.style.color = theme.text; }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = theme.textMuted; }
                  }}
                  style={{
                    border: 0, background: active ? theme.text : 'transparent',
                    padding: '5px 10px', borderRadius: 999, cursor: 'pointer',
                    fontFamily: active ? TYPO.fontDisplay : TYPO.fontText,
                    fontSize: 11.5, fontWeight: active ? 600 : 500,
                    color: active ? (theme.textOnDark || '#FFF') : theme.textMuted,
                    letterSpacing: '-0.005em',
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}
                >
                  {m.label}
                  <ChevronDown size={9} style={{ opacity: 0.6, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }} />
                </button>
              );
            })}
          </div>

          {openMenuId && MODULOS.find(m => m.id === openMenuId) && (
            <ModuloDropdown
              modulo={MODULOS.find(m => m.id === openMenuId)}
              theme={theme} isMidnight={isMidnight}
              perfil={perfilUsuario}
              paginaActiva={paginaActiva}
              clienteActivo={clienteActivo}
              clienteExpanded={clienteExpanded}
              onExpandCliente={setClienteExpanded}
              onSelect={handleSelect}
              onSelectCliente={handleSelectCliente}
              onMouseEnter={() => { if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; } }}
              onMouseLeave={() => scheduleClose(openMenuId)}
            />
          )}
        </div>

        {/* ═══ PILL CENTRAL · Search ═══ */}
        <button
          onClick={() => setSearchOpen(true)}
          style={{
            ...pillStyle,
            justifySelf: 'center', width: '100%', maxWidth: 460,
            padding: '0 12px', gap: 8, cursor: 'pointer', pointerEvents: 'auto',
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = isMidnight ? 'rgba(100,210,255,0.3)' : 'rgba(0,0,0,0.12)'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = isMidnight ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
        >
          <Search size={13} style={{ color: theme.textMuted }} />
          <span style={{ flex: 1, textAlign: 'left', fontFamily: TYPO.fontText, fontSize: 11.5, color: theme.textMuted }}>
            Buscar OC, SKU, cliente…
          </span>
          <span style={{
            fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9,
            color: theme.textSubtle || theme.textMuted,
            background: isMidnight ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            padding: '1px 5px', borderRadius: 4,
          }}>⌘K</span>
        </button>

        {/* ═══ PILL DERECHA · Actualizar + Notif + Avatar ═══ */}
        <div style={{ position: 'relative', pointerEvents: 'auto' }}>
          <div style={{ ...pillStyle, padding: '0 6px', gap: 2 }}>
            <button
              onClick={() => setOpenMenuId(openMenuId === 'update' ? null : 'update')}
              title="Actualizar datos"
              style={miniBtnStyle}
              onMouseEnter={(e) => e.currentTarget.style.background = isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <RefreshCw size={13} />
              <span style={{
                position: 'absolute', top: 3, right: 3,
                width: 6, height: 6, borderRadius: 999,
                background: theme.green || '#34C759',
                boxShadow: `0 0 6px ${theme.green || '#34C759'}88`,
              }} />
            </button>
            <button
              onClick={() => setOpenMenuId(openMenuId === 'notif' ? null : 'notif')}
              title="Notificaciones"
              style={miniBtnStyle}
              onMouseEnter={(e) => e.currentTarget.style.background = isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <Bell size={13} />
              {notifsVisibles.length > 0 && (
                <span style={{
                  position: 'absolute', top: -1, right: -1,
                  background: theme.red || '#FF3B30', color: '#FFF',
                  fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 8,
                  minWidth: 12, height: 12, padding: '0 3px', borderRadius: 999,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                  boxShadow: `0 1px 2px ${theme.red || '#FF3B30'}66`,
                }}>{notifsVisibles.length > 9 ? '9+' : notifsVisibles.length}</span>
              )}
            </button>
            <button
              onClick={() => setOpenMenuId(openMenuId === 'user' ? null : 'user')}
              title={perfilUsuario?.nombre || 'Usuario'}
              style={{
                width: 22, height: 22, borderRadius: 999, marginLeft: 4, border: 0, padding: 0,
                background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple || '#AF52DE'})`,
                color: '#FFF', fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 9.5,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}
            >{iniciales}</button>
          </div>

          {openMenuId === 'update' && (
            <UpdatePanel theme={theme} isMidnight={isMidnight} onClose={closeMenu} />
          )}
          {openMenuId === 'notif' && (
            <NotifPanel
              theme={theme} isMidnight={isMidnight}
              urgentes={urgentes} warns={warns} infos={infos}
              onGo={(navegarA) => { closeMenu(); navegarA(); }}
              onSilenciar={silenciar} onMarcarTodo={marcarTodo}
            />
          )}
          {openMenuId === 'user' && (
            <UserMenu
              theme={theme} isMidnight={isMidnight}
              setThemeKey={setThemeKey}
              perfil={perfilUsuario}
              modoPresent={modoPresent}
              onToggleModoPresent={onToggleModoPresent}
              onConfig={() => { closeMenu(); onNavegar(null, 'configuracion'); }}
              onUpdate={() => { closeMenu(); setOpenMenuId('update'); }}
              onLogout={() => { closeMenu(); onCerrarSesion?.(); }}
            />
          )}
        </div>
      </div>

      {searchOpen && (
        <SearchOverlay theme={theme} isMidnight={isMidnight} onClose={() => setSearchOpen(false)} />
      )}
    </>
  );
}

// ═══════════════ Dropdown de módulo ═══════════════
function ModuloDropdown({ modulo, theme, isMidnight, perfil, paginaActiva, clienteActivo, clienteExpanded, onExpandCliente, onSelect, onSelectCliente, onMouseEnter, onMouseLeave }) {
  const permitido = (it) => {
    if (!it.permiso) return true;
    if (it.permiso === '__super_admin__') return !!perfil?.es_super_admin;
    return puedeVerPestanaGlobal(perfil, it.permiso);
  };

  const cardStyle = {
    position: 'absolute', top: 38, left: 0, zIndex: 41, minWidth: 260, maxWidth: 320,
    background: isMidnight ? 'rgba(40,40,45,0.90)' : 'rgba(255,255,255,0.92)',
    backdropFilter: 'saturate(180%) blur(30px)',
    WebkitBackdropFilter: 'saturate(180%) blur(30px)',
    border: `1px solid ${isMidnight ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
    borderRadius: 12,
    boxShadow: isMidnight ? '0 12px 40px rgba(0,0,0,0.5)' : '0 12px 40px rgba(0,0,0,0.12)',
    padding: 6, fontFamily: TYPO.fontText,
    // Invisible top bridge para que el hover no se rompa al cruzar
    paddingTop: 10, marginTop: -4,
  };

  const grupos = modulo.grupos || [{ items: modulo.items }];
  return (
    <div style={cardStyle} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      {grupos.map((g, gi) => (
        <div key={gi} style={{ marginBottom: gi < grupos.length - 1 ? 6 : 0 }}>
          {g.label && (
            <div style={{
              padding: '6px 10px 4px', fontFamily: TYPO.fontDisplay, fontSize: 9.5,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              color: theme.textMuted, fontWeight: 600,
            }}>{g.label}</div>
          )}

          {g.clientes && (
            <ClientesList
              perfil={perfil} theme={theme} isMidnight={isMidnight}
              clienteActivo={clienteActivo} paginaActiva={paginaActiva}
              clienteExpanded={clienteExpanded} onExpandCliente={onExpandCliente}
              onSelectCliente={onSelectCliente}
            />
          )}

          {g.items && g.items.filter(permitido).map(it => {
            const Icon = it.icon;
            const active = !clienteActivo && paginaActiva === it.id;
            return (
              <button
                key={it.id}
                onClick={() => onSelect(it.id)}
                style={dropdownRowStyle(theme, isMidnight, active)}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,113,227,0.08)'; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                {Icon && <Icon size={14} style={{ color: active ? theme.accent : theme.textMuted, flexShrink: 0 }} />}
                <span style={{ flex: 1, textAlign: 'left' }}>{it.label}</span>
                {active && <Check size={13} style={{ color: theme.accent }} />}
              </button>
            );
          })}
          {gi < grupos.length - 1 && (
            <div style={{ height: 1, background: isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', margin: '4px 4px 0' }} />
          )}
        </div>
      ))}
    </div>
  );
}

function dropdownRowStyle(theme, isMidnight, active) {
  return {
    display: 'flex', alignItems: 'center', gap: 8,
    width: '100%', padding: '6px 10px', borderRadius: 7, border: 0, cursor: 'pointer',
    background: active ? (isMidnight ? 'rgba(100,210,255,0.12)' : 'rgba(0,113,227,0.10)') : 'transparent',
    color: active ? theme.accent : theme.text,
    fontFamily: active ? TYPO.fontDisplay : TYPO.fontText,
    fontSize: 12.5, fontWeight: active ? 600 : 500, letterSpacing: '-0.005em',
    textAlign: 'left',
  };
}

// ═══════════════ Lista de clientes con submenu expandible ═══════════════
function ClientesList({ perfil, theme, isMidnight, clienteActivo, paginaActiva, clienteExpanded, onExpandCliente, onSelectCliente }) {
  const clientesIds = ['digitalife', 'pcel', 'dicotech'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {clientesIds.map(cid => {
        const cfg = SIDEBAR_CLIENTES[cid];
        if (!cfg || !puedeVerCliente(perfil, cid)) return null;
        const isExpanded = clienteExpanded === cid;
        const isActive = clienteActivo === cid;
        return (
          <div key={cid}>
            <button
              onClick={() => onExpandCliente(isExpanded ? null : cid)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '6px 10px', borderRadius: 7, border: 0, cursor: 'pointer',
                background: isActive ? (isMidnight ? 'rgba(100,210,255,0.10)' : 'rgba(0,113,227,0.08)') : 'transparent',
                color: theme.text, fontFamily: TYPO.fontText, fontSize: 12.5, fontWeight: isActive ? 600 : 500, textAlign: 'left',
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 999, background: cfg.color, flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{cfg.label}</span>
              <ChevronDown size={10} style={{ color: theme.textMuted, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }} />
            </button>
            {isExpanded && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, paddingLeft: 22, marginTop: 2, marginBottom: 4 }}>
                {CLIENTE_PESTANAS.filter(p => puedeVerPestanaCliente(perfil, cid, p.id)).map(p => {
                  const active = isActive && paginaActiva === p.id;
                  const Icon = p.icon;
                  const disabled = cid === 'pcel' && p.id === 'marketing';
                  return (
                    <button
                      key={p.id}
                      disabled={disabled}
                      onClick={() => !disabled && onSelectCliente(cid, p.id)}
                      style={{
                        ...dropdownRowStyle(theme, isMidnight, active),
                        padding: '5px 10px', fontSize: 12,
                        opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer',
                      }}
                      onMouseEnter={(e) => { if (!active && !disabled) e.currentTarget.style.background = isMidnight ? 'rgba(255,255,255,0.05)' : 'rgba(0,113,227,0.06)'; }}
                      onMouseLeave={(e) => { if (!active && !disabled) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {Icon && <Icon size={13} style={{ color: active ? theme.accent : theme.textMuted, flexShrink: 0 }} />}
                      <span style={{ flex: 1, textAlign: 'left' }}>{p.label}</span>
                      {active && <Check size={12} style={{ color: theme.accent }} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════ Panel Actualizar datos ═══════════════
function UpdatePanel({ theme, isMidnight, onClose }) {
  const [fuentes, setFuentes] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    // Cargar estado de fuentes conocidas — hardcoded por ahora, luego API
    (async () => {
      try {
        const r = await fetch('/api/last-update').then(r => r.json());
        if (r?.last_update) setLastUpdate(r.last_update);
      } catch {}
    })();
    setFuentes([
      { id: 'sellout-pcel',       label: 'Sell Out PCEL',      status: 'ok',      when: 'semana 15' },
      { id: 'ventas-erp',         label: 'ERP · Ventas',        status: 'pending', when: 'nunca' },
      { id: 'sellout-digitalife', label: 'Sell Out Digitalife', status: 'pending', when: 'nunca' },
      { id: 'estados-cuenta',     label: 'Estados de cuenta',   status: 'ok',      when: 'reciente' },
      { id: 'inventario-acteck',  label: 'Inventario Acteck',   status: 'ok',      when: 'reciente' },
    ]);
  }, []);

  const cardStyle = {
    position: 'absolute', top: 42, right: 0, zIndex: 41, width: 340,
    background: isMidnight ? 'rgba(40,40,45,0.90)' : 'rgba(255,255,255,0.92)',
    backdropFilter: 'saturate(180%) blur(30px)',
    WebkitBackdropFilter: 'saturate(180%) blur(30px)',
    border: `1px solid ${isMidnight ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
    borderRadius: 14,
    boxShadow: isMidnight ? '0 12px 40px rgba(0,0,0,0.5)' : '0 12px 40px rgba(0,0,0,0.12)',
    padding: 10, fontFamily: TYPO.fontText,
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 8px 8px' }}>
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, color: theme.text, letterSpacing: '-0.02em' }}>Actualizar datos</div>
        {lastUpdate && (
          <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10, color: theme.textMuted }}>
            {new Date(lastUpdate).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {fuentes.map(f => {
          const grad = f.status === 'ok' ? 'linear-gradient(135deg, #34C759, #248A3D)'
            : f.status === 'warn' ? 'linear-gradient(135deg, #FF9500, #C56E00)'
            : 'linear-gradient(135deg, #86868B, #6E6E73)';
          const StatusIco = f.status === 'ok' ? Check : f.status === 'warn' ? AlertTriangle : Clock;
          const statusColor = f.status === 'ok' ? '#34C759' : f.status === 'warn' ? '#FF9500' : '#86868B';
          const statusLabel = f.status === 'ok' ? 'al día' : f.status === 'warn' ? 'atrasada' : 'pendiente';
          return (
            <div key={f.id} style={{
              display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: 10, alignItems: 'center',
              padding: '8px 10px', borderRadius: 8,
            }}>
              <span style={{ width: 24, height: 24, borderRadius: 6, background: grad, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#FFF' }}>
                <StatusIco size={12} strokeWidth={2.5} />
              </span>
              <div>
                <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, color: theme.text, letterSpacing: '-0.005em' }}>{f.label}</div>
                <div style={{ fontFamily: TYPO.fontText, fontSize: 10.5, color: theme.textMuted, marginTop: 1 }}>{f.when}</div>
              </div>
              <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10, color: statusColor, fontWeight: 600 }}>{statusLabel}</span>
            </div>
          );
        })}
      </div>
      <div style={{ height: 1, background: isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', margin: '4px 4px' }} />
      <a
        href="/uploads.html"
        style={{
          display: 'block', margin: '4px 4px 2px', padding: '9px 12px', borderRadius: 10,
          background: theme.accent, color: '#FFF',
          fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600,
          textAlign: 'center', textDecoration: 'none', letterSpacing: '-0.005em',
        }}
      >Ir al importador central →</a>
    </div>
  );
}

// ═══════════════ Notification Center ═══════════════
function NotifPanel({ theme, isMidnight, urgentes, warns, infos, onGo, onSilenciar, onMarcarTodo }) {
  const total = urgentes.length + warns.length + infos.length;
  return (
    <div style={{
      position: 'absolute', top: 42, right: 0, zIndex: 41, width: 360,
      background: isMidnight ? 'rgba(40,40,45,0.90)' : 'rgba(255,255,255,0.92)',
      backdropFilter: 'saturate(180%) blur(30px)',
      WebkitBackdropFilter: 'saturate(180%) blur(30px)',
      border: `1px solid ${isMidnight ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
      borderRadius: 14,
      boxShadow: isMidnight ? '0 12px 40px rgba(0,0,0,0.5)' : '0 12px 40px rgba(0,0,0,0.12)',
      padding: 10, fontFamily: TYPO.fontText, maxHeight: '80vh', overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px 8px' }}>
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, color: theme.text, letterSpacing: '-0.02em' }}>Notificaciones</div>
        {total > 0 && (
          <button onClick={onMarcarTodo}
            style={{ background: 'transparent', border: 0, color: theme.accent, fontFamily: TYPO.fontText, fontSize: 11, fontWeight: 500, cursor: 'pointer', padding: '3px 6px', borderRadius: 5 }}
          >Marcar todo</button>
        )}
      </div>

      {total === 0 && (
        <div style={{ padding: '24px 12px', textAlign: 'center', color: theme.textMuted, fontSize: 12 }}>
          Todo bajo control · sin alertas
        </div>
      )}

      <NotifSection label="Urgentes" count={urgentes.length} theme={theme}>
        {urgentes.map(n => <NotifItem key={n.id} n={n} theme={theme} isMidnight={isMidnight} onGo={onGo} onSilenciar={onSilenciar} />)}
      </NotifSection>
      <NotifSection label="Advertencias" count={warns.length} theme={theme}>
        {warns.map(n => <NotifItem key={n.id} n={n} theme={theme} isMidnight={isMidnight} onGo={onGo} onSilenciar={onSilenciar} />)}
      </NotifSection>
      <NotifSection label="Copilot" count={infos.length} theme={theme}>
        {infos.map(n => <NotifItem key={n.id} n={n} theme={theme} isMidnight={isMidnight} onGo={onGo} onSilenciar={onSilenciar} />)}
      </NotifSection>
    </div>
  );
}

function NotifSection({ label, count, theme, children }) {
  if (count === 0) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', padding: '4px 8px',
        fontFamily: TYPO.fontText, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em',
        color: theme.textMuted, fontWeight: 600,
      }}>
        <span>{label}</span>
        <span style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{count}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{children}</div>
    </div>
  );
}

function NotifItem({ n, theme, isMidnight, onGo, onSilenciar }) {
  const grad = n.severidad === 'urgente' ? 'linear-gradient(135deg, #FF3B30, #C22B22)'
    : n.severidad === 'warn' ? 'linear-gradient(135deg, #FF9500, #C56E00)'
    : `linear-gradient(135deg, ${theme.accent}, ${theme.accentHover || theme.accent})`;
  const Icon = n.severidad === 'urgente' ? AlertTriangle : n.severidad === 'warn' ? Clock : Sparkles;
  return (
    <div
      onClick={() => onGo(n.navegarA)}
      style={{
        background: isMidnight ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)',
        border: `1px solid ${isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
        borderRadius: 10, padding: '9px 10px',
        display: 'grid', gridTemplateColumns: '26px 1fr auto', gap: 10, alignItems: 'center',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = theme.accent}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}
    >
      <span style={{ width: 26, height: 26, borderRadius: 7, background: grad, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#FFF' }}>
        <Icon size={13} strokeWidth={2.5} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, color: theme.text, letterSpacing: '-0.005em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.titulo}</div>
        <div style={{ fontFamily: TYPO.fontText, fontSize: 10, color: theme.textMuted, marginTop: 1 }}>{n.subtitulo} · {n.tiempo}</div>
      </div>
      <button onClick={(e) => { e.stopPropagation(); onSilenciar(n.id); }} title="Silenciar"
        style={{ width: 20, height: 20, padding: 0, border: 0, background: 'transparent', borderRadius: 999, cursor: 'pointer', color: theme.textMuted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        onMouseEnter={(e) => e.currentTarget.style.background = isMidnight ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ═══════════════ Menú de usuario ═══════════════
function UserMenu({ theme, isMidnight, setThemeKey, perfil, modoPresent, onToggleModoPresent, onConfig, onUpdate, onLogout }) {
  const puedeConfig = puedeConfigurar(perfil);
  const puedeActualizar = puedeActualizarDatos(perfil);
  const iniciales = (perfil?.nombre || 'U').split(' ').filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
  const rolLabel = { super_admin: 'Super Admin', admin: 'Administrador', asistente: 'Asistente', cliente: 'Cliente', viewer: 'Viewer' }[perfil?.rol] || perfil?.rol;

  const cardStyle = {
    position: 'absolute', top: 42, right: 0, zIndex: 41, minWidth: 280,
    background: isMidnight ? 'rgba(40,40,45,0.90)' : 'rgba(255,255,255,0.92)',
    backdropFilter: 'saturate(180%) blur(30px)',
    WebkitBackdropFilter: 'saturate(180%) blur(30px)',
    border: `1px solid ${isMidnight ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
    borderRadius: 12,
    boxShadow: isMidnight ? '0 12px 40px rgba(0,0,0,0.5)' : '0 12px 40px rgba(0,0,0,0.12)',
    padding: 6, fontFamily: TYPO.fontText,
  };
  const rowStyle = (danger) => ({
    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
    padding: '7px 10px', borderRadius: 7, border: 0, cursor: 'pointer',
    background: 'transparent',
    color: danger ? (theme.red || '#FF3B30') : theme.text,
    fontFamily: TYPO.fontText, fontSize: 12.5, fontWeight: 500,
    letterSpacing: '-0.005em', textAlign: 'left',
  });
  const swatchSize = 18;
  const swatchDot = (key, bg) => ({
    width: swatchSize, height: swatchSize, borderRadius: 999, cursor: 'pointer',
    background: bg,
    border: theme.key === key ? `1.5px solid ${theme.accent}` : `1px solid ${isMidnight ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)'}`,
    boxShadow: theme.key === key ? `0 0 0 2px ${theme.accent}22` : 'none',
    padding: 0,
  });

  return (
    <div style={cardStyle}>
      {/* Header con perfil */}
      {perfil?.nombre && (
        <div style={{
          padding: '10px 12px 12px', display: 'flex', alignItems: 'center', gap: 10,
          borderBottom: `1px solid ${isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          marginBottom: 6,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 999,
            background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple || '#AF52DE'})`,
            color: '#FFF', fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 14,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>{iniciales}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, color: theme.text, letterSpacing: '-0.005em' }}>{perfil.nombre}</div>
            {rolLabel && <div style={{ fontFamily: TYPO.fontText, fontSize: 11, color: theme.textMuted, marginTop: 1 }}>{rolLabel}</div>}
            {perfil.email && <div style={{ fontFamily: TYPO.fontText, fontSize: 10.5, color: theme.textSubtle || theme.textMuted, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{perfil.email}</div>}
          </div>
        </div>
      )}

      {puedeConfig && (
        <button style={rowStyle(false)} onClick={onConfig}
          onMouseEnter={(e) => e.currentTarget.style.background = isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,113,227,0.06)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <Settings size={14} style={{ color: theme.textMuted }} />
          <span style={{ flex: 1 }}>Configuración</span>
          <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9.5, color: theme.textMuted, background: isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', padding: '1px 5px', borderRadius: 4 }}>⌘,</span>
        </button>
      )}
      {puedeActualizar && (
        <button style={rowStyle(false)} onClick={onUpdate}
          onMouseEnter={(e) => e.currentTarget.style.background = isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,113,227,0.06)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <RefreshCw size={14} style={{ color: theme.textMuted }} />
          <span style={{ flex: 1 }}>Actualizar datos</span>
        </button>
      )}
      <button style={{ ...rowStyle(false), justifyContent: 'space-between' }} onClick={onToggleModoPresent}
        onMouseEnter={(e) => e.currentTarget.style.background = isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,113,227,0.06)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Eye size={14} style={{ color: theme.textMuted }} />
          Modo presentación
        </span>
        {/* Toggle iOS */}
        <span style={{
          width: 30, height: 18, borderRadius: 999,
          background: modoPresent ? theme.green : (isMidnight ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'),
          position: 'relative', transition: 'background 220ms', display: 'inline-block',
        }}>
          <span style={{
            position: 'absolute', top: 1, left: modoPresent ? 13 : 1,
            width: 16, height: 16, borderRadius: 999, background: '#FFF',
            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
            transition: 'left 220ms cubic-bezier(0.32, 0.72, 0, 1)',
          }} />
        </span>
      </button>

      {/* Tema */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px' }}>
        <Palette size={14} style={{ color: theme.textMuted }} />
        <span style={{ flex: 1, fontFamily: TYPO.fontText, fontSize: 12.5, color: theme.text }}>Tema</span>
        <div style={{
          display: 'inline-flex', padding: 2, gap: 3,
          background: isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
          borderRadius: 999,
        }}>
          <button title="Claro" onClick={() => setThemeKey('claro')} style={swatchDot('claro', 'linear-gradient(135deg, #FFF, #E5E5EA)')} />
          <button title="Midnight" onClick={() => setThemeKey('midnight')} style={swatchDot('midnight', 'linear-gradient(135deg, #0F0F11, #1D1D1F)')} />
          <button title="Marfil" onClick={() => setThemeKey('marfil')} style={swatchDot('marfil', 'linear-gradient(135deg, #FFFBF3, #EEE7DA)')} />
        </div>
      </div>

      {onLogout && (
        <>
          <div style={{ height: 1, background: isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', margin: '4px 4px' }} />
          <button style={rowStyle(true)} onClick={onLogout}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,59,48,0.08)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <LogOut size={14} />
            <span>Cerrar sesión</span>
          </button>
        </>
      )}
    </div>
  );
}

// ═══════════════ Search overlay ═══════════════
function SearchOverlay({ theme, isMidnight, onClose }) {
  return (
    <div onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: isMidnight ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.25)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '15vh', paddingLeft: 16, paddingRight: 16,
      }}
    >
      <div onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560,
          background: isMidnight ? 'rgba(40,40,45,0.92)' : 'rgba(255,255,255,0.95)',
          backdropFilter: 'saturate(180%) blur(30px)',
          border: `1px solid ${isMidnight ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          borderRadius: 16,
          boxShadow: isMidnight ? '0 20px 60px rgba(0,0,0,0.6)' : '0 20px 60px rgba(0,0,0,0.15)',
          padding: 8, fontFamily: TYPO.fontText,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
          <Search size={16} style={{ color: theme.textMuted }} />
          <input autoFocus placeholder="Buscar OC, SKU, cliente…"
            style={{ flex: 1, border: 0, background: 'transparent', outline: 'none', fontFamily: TYPO.fontText, fontSize: 15, color: theme.text }}
          />
          <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10, color: theme.textMuted, background: isMidnight ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', padding: '2px 6px', borderRadius: 5 }}>ESC</span>
        </div>
        <div style={{ borderTop: `1px solid ${isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, padding: '14px 16px', color: theme.textMuted, fontSize: 12 }}>
          Búsqueda universal próximamente
        </div>
      </div>
    </div>
  );
}
