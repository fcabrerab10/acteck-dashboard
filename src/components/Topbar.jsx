// Topbar · Propuesta A · trío de pills flotantes
// ─ Pill izquierdo: 4 menu-módulo (General · Comercial · Admin · Axon)
//   cada uno abre un dropdown con los items de ese grupo (sidebar entera migrada)
// ─ Pill central: search ⌘K (stub)
// ─ Pill derecho: Actualizar datos + Notif + Avatar (con menú de usuario)

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Bell, Search, Check, ChevronDown, X, RefreshCw, LogOut, Settings, Eye,
  AlertTriangle, Clock, Sparkles, Sun, Moon, Palette, Wand2, Send,
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

// ¿El módulo tiene al menos un item visible para este perfil?
// Se usa para ocultar el pill del módulo entero si no hay nada permitido.
function itemVisible(it, perfil) {
  if (!it.permiso) return true;
  if (it.permiso === '__super_admin__') return !!perfil?.es_super_admin;
  return puedeVerPestanaGlobal(perfil, it.permiso);
}
function moduloEsVisible(m, perfil) {
  if (!perfil) return false;
  const grupos = m.grupos || [{ items: m.items }];
  return grupos.some((g) => {
    if (g.clientes) return ['digitalife', 'pcel', 'dicotech'].some((cid) => puedeVerCliente(perfil, cid));
    return (g.items || []).some((it) => itemVisible(it, perfil));
  });
}

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
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [ferrutekBusy, setFerrutekBusy] = useState(false);
  const [ferrutekQuery, setFerrutekQuery] = useState('');
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
      if (e.key === 'Escape') { setSearchOpen(false); setCopilotOpen(false); setOpenMenuId(null); }
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
      <style>{`
        @keyframes ferrutekBusyRing { 0% { transform: scale(0.9); opacity: 1; } 100% { transform: scale(1.4); opacity: 0; } }
        @keyframes ferrutekThink { 0%,80%,100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1.2); } }
        @keyframes ferrutekIn { from { opacity: 0; transform: translateY(12px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
      <div
        ref={rootRef}
        style={{
          position: 'sticky', top: 0, zIndex: 40,
          padding: '10px 14px',
          maxWidth: 1600, margin: '0 auto', width: '100%',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          gap: 10,
          alignItems: 'center',
          pointerEvents: 'none',
        }}
      >
        {/* ═══ PILL IZQUIERDA · menu-módulo (filtrado por permisos) + Copilot ═══ */}
        <div
          style={{ position: 'relative', pointerEvents: 'auto', display: 'flex', gap: 8 }}
          onMouseLeave={() => scheduleClose(openMenuId)}
          onMouseEnter={() => { if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; } }}
        >
          <div style={{ ...pillStyle, padding: '0 4px', gap: 2 }}>
            {MODULOS.filter((m) => moduloEsVisible(m, perfilUsuario)).map(m => {
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

          {/* Copilot pill · hermana del pill de módulos */}
          <button
            onClick={() => setCopilotOpen(true)}
            title="Pídele ayuda a Ferruteck"
            style={{
              ...pillStyle,
              padding: '0 12px 0 10px', gap: 6, cursor: 'pointer',
              background: `
                radial-gradient(circle at 20% 30%, rgba(191,90,242,0.35) 0%, transparent 55%),
                radial-gradient(circle at 80% 70%, rgba(100,210,255,0.25) 0%, transparent 55%),
                linear-gradient(180deg, #1e1e2e 0%, #0d0d19 100%)`,
              border: '1px solid rgba(255,255,255,0.10)',
              color: '#FFF',
              boxShadow: '0 2px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            {/* Mini fantasmita en lugar del sparkle */}
            <span style={{ position: 'relative', display: 'inline-flex', width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
              <FerrutekGhost outfit={detectarOutfit()} size={20} />
              {ferrutekBusy && (
                <span aria-hidden style={{
                  position: 'absolute', inset: -3, borderRadius: 999,
                  border: `1.5px solid ${theme.accent}`,
                  animation: 'ferrutekBusyRing 1.4s cubic-bezier(0.4, 0, 0.2, 1) infinite',
                }} />
              )}
            </span>
            <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, color: '#FFF', letterSpacing: '-0.005em' }}>Ferruteck</span>
            {ferrutekBusy && (
              <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center', marginLeft: 4 }}>
                <span style={{ width: 3, height: 3, borderRadius: 999, background: theme.accent, animation: 'ferrutekThink 1.2s ease-in-out infinite' }}/>
                <span style={{ width: 3, height: 3, borderRadius: 999, background: theme.accent, animation: 'ferrutekThink 1.2s ease-in-out 0.2s infinite' }}/>
                <span style={{ width: 3, height: 3, borderRadius: 999, background: theme.accent, animation: 'ferrutekThink 1.2s ease-in-out 0.4s infinite' }}/>
              </span>
            )}
          </button>
        </div>

        {/* ═══ PILL CENTRAL · Search (con opción de escalar a Ferruteck) ═══ */}
        <button
          onClick={() => setSearchOpen(true)}
          style={{
            ...pillStyle,
            justifySelf: 'center', width: '100%', maxWidth: 460,
            padding: '0 8px 0 12px', gap: 8, cursor: 'pointer', pointerEvents: 'auto',
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = isMidnight ? 'rgba(100,210,255,0.3)' : 'rgba(0,0,0,0.12)'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = isMidnight ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
        >
          <Search size={13} style={{ color: theme.textMuted }} />
          <span style={{ flex: 1, textAlign: 'left', fontFamily: TYPO.fontText, fontSize: 11.5, color: theme.textMuted }}>
            Busca OC, SKU, cliente · o pregúntale a Ferruteck
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, paddingLeft: 4, borderLeft: `1px solid ${isMidnight ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'}` }}>
            <span style={{ display: 'inline-flex', width: 18, height: 18 }}>
              <FerrutekGhost outfit={detectarOutfit()} size={18} />
            </span>
            <span style={{
              fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9,
              color: theme.textSubtle || theme.textMuted,
              background: isMidnight ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              padding: '1px 5px', borderRadius: 4,
            }}>⌘K</span>
          </span>
        </button>

        {/* ═══ PILL DERECHA · Actualizar + Notif + Avatar ═══ */}
        <div
          style={{ position: 'relative', pointerEvents: 'auto' }}
          onMouseLeave={() => scheduleClose(openMenuId)}
          onMouseEnter={() => { if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; } }}
        >
          <div style={{ ...pillStyle, padding: '0 6px', gap: 2 }}>
            <button
              onClick={() => setOpenMenuId(openMenuId === 'update' ? null : 'update')}
              onMouseEnter={(e) => { openOnHover('update'); e.currentTarget.style.background = isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              title="Actualizar datos"
              style={miniBtnStyle}
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
              onMouseEnter={(e) => { openOnHover('notif'); e.currentTarget.style.background = isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              title="Notificaciones"
              style={miniBtnStyle}
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
              onMouseEnter={() => openOnHover('user')}
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
            <UpdatePanel
              theme={theme} isMidnight={isMidnight} onClose={closeMenu}
              onMouseEnter={() => { if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; } }}
              onMouseLeave={() => scheduleClose('update')}
            />
          )}
          {openMenuId === 'notif' && (
            <NotifPanel
              theme={theme} isMidnight={isMidnight}
              urgentes={urgentes} warns={warns} infos={infos}
              onGo={(navegarA) => { closeMenu(); navegarA(); }}
              onSilenciar={silenciar} onMarcarTodo={marcarTodo}
              onMouseEnter={() => { if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; } }}
              onMouseLeave={() => scheduleClose('notif')}
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
              onMouseEnter={() => { if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; } }}
              onMouseLeave={() => scheduleClose('user')}
            />
          )}
        </div>
      </div>

      {searchOpen && (
        <SearchOverlay
          theme={theme} isMidnight={isMidnight}
          onClose={() => setSearchOpen(false)}
          onAskFerruteck={(q) => { setSearchOpen(false); setFerrutekQuery(q); setCopilotOpen(true); }}
        />
      )}
      {copilotOpen && (
        <CopilotOverlay
          theme={theme} isMidnight={isMidnight}
          onClose={() => { setCopilotOpen(false); setFerrutekQuery(''); }}
          initialQuery={ferrutekQuery}
          onBusyChange={setFerrutekBusy}
        />
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
function UpdatePanel({ theme, isMidnight, onClose, onMouseEnter, onMouseLeave }) {
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
    position: 'absolute', top: 38, right: 0, zIndex: 41, width: 340,
    background: isMidnight ? 'rgba(40,40,45,0.90)' : 'rgba(255,255,255,0.92)',
    backdropFilter: 'saturate(180%) blur(30px)',
    WebkitBackdropFilter: 'saturate(180%) blur(30px)',
    border: `1px solid ${isMidnight ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
    borderRadius: 14,
    boxShadow: isMidnight ? '0 12px 40px rgba(0,0,0,0.5)' : '0 12px 40px rgba(0,0,0,0.12)',
    padding: 10, paddingTop: 14, marginTop: -4, fontFamily: TYPO.fontText,
  };

  return (
    <div style={cardStyle} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
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
function NotifPanel({ theme, isMidnight, urgentes, warns, infos, onGo, onSilenciar, onMarcarTodo, onMouseEnter, onMouseLeave }) {
  const total = urgentes.length + warns.length + infos.length;
  return (
    <div onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} style={{
      position: 'absolute', top: 38, right: 0, zIndex: 41, width: 360,
      background: isMidnight ? 'rgba(40,40,45,0.90)' : 'rgba(255,255,255,0.92)',
      backdropFilter: 'saturate(180%) blur(30px)',
      WebkitBackdropFilter: 'saturate(180%) blur(30px)',
      border: `1px solid ${isMidnight ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
      borderRadius: 14,
      boxShadow: isMidnight ? '0 12px 40px rgba(0,0,0,0.5)' : '0 12px 40px rgba(0,0,0,0.12)',
      padding: 10, paddingTop: 14, marginTop: -4, fontFamily: TYPO.fontText, maxHeight: '80vh', overflowY: 'auto',
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
function UserMenu({ theme, isMidnight, setThemeKey, perfil, modoPresent, onToggleModoPresent, onConfig, onUpdate, onLogout, onMouseEnter, onMouseLeave }) {
  const puedeConfig = puedeConfigurar(perfil);
  const puedeActualizar = puedeActualizarDatos(perfil);
  const iniciales = (perfil?.nombre || 'U').split(' ').filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
  const rolLabel = { super_admin: 'Super Admin', admin: 'Administrador', asistente: 'Asistente', cliente: 'Cliente', viewer: 'Viewer' }[perfil?.rol] || perfil?.rol;

  const cardStyle = {
    position: 'absolute', top: 38, right: 0, zIndex: 41, minWidth: 280,
    background: isMidnight ? 'rgba(40,40,45,0.90)' : 'rgba(255,255,255,0.92)',
    backdropFilter: 'saturate(180%) blur(30px)',
    WebkitBackdropFilter: 'saturate(180%) blur(30px)',
    border: `1px solid ${isMidnight ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
    borderRadius: 12,
    boxShadow: isMidnight ? '0 12px 40px rgba(0,0,0,0.5)' : '0 12px 40px rgba(0,0,0,0.12)',
    padding: 6, paddingTop: 10, marginTop: -4, fontFamily: TYPO.fontText,
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
    <div style={cardStyle} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
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

// ═══════════════ Search overlay · buscador normal + escalar a Ferruteck ═══════════════
function SearchOverlay({ theme, isMidnight, onClose, onAskFerruteck }) {
  const [q, setQ] = useState('');
  const outfit = detectarOutfit();
  const handleAskFerruteck = () => onAskFerruteck?.(q.trim());
  return (
    <div onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: isMidnight ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.3)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '12vh', paddingLeft: 16, paddingRight: 16,
      }}
    >
      <div onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560,
          background: isMidnight ? 'rgba(40,40,45,0.92)' : 'rgba(255,255,255,0.96)',
          backdropFilter: 'saturate(180%) blur(30px)',
          border: `1px solid ${isMidnight ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'}`,
          borderRadius: 16,
          boxShadow: isMidnight ? '0 20px 60px rgba(0,0,0,0.6)' : '0 20px 60px rgba(0,0,0,0.15)',
          padding: 8, fontFamily: TYPO.fontText,
          animation: 'ferrutekIn 300ms cubic-bezier(0.32, 0.72, 0, 1) both',
        }}
      >
        {/* Input de búsqueda */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
          <Search size={16} style={{ color: theme.textMuted }} />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handleAskFerruteck(); }
              else if (e.key === 'Escape') onClose();
            }}
            placeholder="Buscar OC, SKU, cliente…"
            style={{ flex: 1, border: 0, background: 'transparent', outline: 'none', fontFamily: TYPO.fontText, fontSize: 15, color: theme.text }}
          />
          <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10, color: theme.textMuted, background: isMidnight ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', padding: '2px 6px', borderRadius: 5 }}>ESC</span>
        </div>

        {/* Cuerpo de resultados */}
        <div style={{ borderTop: `1px solid ${isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, padding: '14px 16px 8px' }}>
          {q.trim().length === 0 ? (
            <div style={{ color: theme.textMuted, fontSize: 12, textAlign: 'center', padding: '18px 8px' }}>
              Empieza a escribir para buscar en OCs, SKUs y clientes
            </div>
          ) : (
            <div style={{ color: theme.textMuted, fontSize: 12, padding: '16px 8px 10px', textAlign: 'center' }}>
              <div style={{ marginBottom: 4 }}>Sin resultados para <strong style={{ color: theme.text }}>"{q}"</strong></div>
              <div style={{ fontSize: 11, color: theme.textSubtle || theme.textMuted }}>
                La búsqueda universal está en preparación
              </div>
            </div>
          )}
        </div>

        {/* Footer: CTA para escalar a Ferruteck */}
        <div style={{
          borderTop: `1px solid ${isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          padding: 8,
        }}>
          <button
            onClick={handleAskFerruteck}
            style={{
              width: '100%', border: 0, cursor: 'pointer',
              padding: '10px 14px', borderRadius: 12,
              background: `
                radial-gradient(circle at 20% 30%, rgba(191,90,242,0.35) 0%, transparent 55%),
                radial-gradient(circle at 80% 70%, rgba(100,210,255,0.28) 0%, transparent 55%),
                linear-gradient(180deg, #1e1e2e 0%, #0d0d19 100%)`,
              display: 'flex', alignItems: 'center', gap: 12,
              color: '#FFF',
              boxShadow: '0 2px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
              transition: 'transform 200ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
          >
            <span style={{ display: 'inline-flex', width: 22, height: 22 }}>
              <FerrutekGhost outfit={outfit} size={22} />
            </span>
            <span style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, letterSpacing: '-0.005em' }}>
                {q.trim() ? `Preguntarle a Ferruteck sobre "${q.length > 32 ? q.slice(0, 32) + '…' : q}"` : 'Pídele ayuda a Ferruteck'}
              </div>
              <div style={{ fontFamily: TYPO.fontText, fontSize: 10.5, color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>
                {q.trim() ? 'Escala a tu asistente inteligente' : 'Resúmenes, comparativas, fútbol y más'}
              </div>
            </span>
            <span style={{
              fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9,
              color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.10)',
              padding: '2px 6px', borderRadius: 5,
            }}>⌘ ↵</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════ Ferruteck · Ghostie con outfits ═══════════════

// Detecta si hoy hay partido de Chivas (Guadalajara)
// TODO: reemplazar con API real de fixtures Liga MX
function detectarOutfit() {
  const d = new Date();
  const day = d.getDay(); // 0=dom, 5=vie, 6=sab
  if (day === 5 || day === 6 || day === 0) return 'chivas'; // vie/sab/dom = modo Chivas
  return 'default';
}

// SVG del Ferruteck fantasmita — con outfits variables
function FerrutekGhost({ outfit = 'default', size = 140 }) {
  const chivas = outfit === 'chivas';
  return (
    <svg width={size} height={size * 1.07} viewBox="0 0 140 150" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="ferrutekBody" cx="35%" cy="30%">
          <stop offset="0%" stopColor="#F5E6FF"/>
          <stop offset="40%" stopColor="#D0A8F0"/>
          <stop offset="100%" stopColor="#AF52DE"/>
        </radialGradient>
        <filter id="ferrutekGlow"><feGaussianBlur stdDeviation="3"/></filter>
        <clipPath id="ferrutekBodyClip">
          <path d="M 25 40 Q 25 15 70 15 Q 115 15 115 40 L 115 100 Q 115 105 110 105 Q 105 100 100 105 Q 95 110 90 105 Q 85 100 80 105 Q 75 110 70 105 Q 65 100 60 105 Q 55 110 50 105 Q 45 100 40 105 Q 35 110 30 105 Q 25 100 25 95 Z"/>
        </clipPath>
      </defs>
      {/* Glow externo — más rojo si Chivas */}
      <ellipse cx="70" cy="75" rx="52" ry="60"
        fill={chivas ? '#EF4444' : '#AF52DE'} opacity="0.3" filter="url(#ferrutekGlow)"/>
      {/* Cuerpo con colita ondulada */}
      <path d="M 25 40 Q 25 15 70 15 Q 115 15 115 40 L 115 100 Q 115 105 110 105 Q 105 100 100 105 Q 95 110 90 105 Q 85 100 80 105 Q 75 110 70 105 Q 65 100 60 105 Q 55 110 50 105 Q 45 100 40 105 Q 35 110 30 105 Q 25 100 25 95 Z"
        fill="url(#ferrutekBody)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5"/>

      {/* JERSEY DE CHIVAS — rayas verticales rojas + blancas */}
      {chivas && (
        <g clipPath="url(#ferrutekBodyClip)">
          {/* Fondo blanco */}
          <rect x="25" y="72" width="90" height="35" fill="#FFF" opacity="0.95"/>
          {/* Rayas verticales rojas */}
          <rect x="30" y="72" width="10" height="35" fill="#DC2626"/>
          <rect x="50" y="72" width="10" height="35" fill="#DC2626"/>
          <rect x="70" y="72" width="10" height="35" fill="#DC2626"/>
          <rect x="90" y="72" width="10" height="35" fill="#DC2626"/>
          <rect x="110" y="72" width="10" height="35" fill="#DC2626"/>
          {/* Cuello del jersey */}
          <path d="M 60 72 Q 70 78 80 72 L 80 74 Q 70 80 60 74 Z" fill="#1a1a2e"/>
          {/* "C" de Chivas en el pecho */}
          <text x="70" y="93" textAnchor="middle" fontFamily="'SF Pro Display', sans-serif" fontSize="11" fontWeight="800" fill="#FFF" stroke="#1a1a2e" strokeWidth="0.3">C</text>
        </g>
      )}

      {/* Cachetitos */}
      <ellipse cx="45" cy="65" rx="8" ry="5" fill="#FFB4E0" opacity="0.6"/>
      <ellipse cx="95" cy="65" rx="8" ry="5" fill="#FFB4E0" opacity="0.6"/>
      {/* Ojo izq */}
      <ellipse cx="52" cy="50" rx="7" ry="9" fill="#1a1a2e"/>
      <ellipse cx="54" cy="47" rx="3" ry="4" fill="#FFF"/>
      <circle cx="55.5" cy="46" r="1" fill="#FFF"/>
      {/* Ojo der */}
      <ellipse cx="88" cy="50" rx="7" ry="9" fill="#1a1a2e"/>
      <ellipse cx="90" cy="47" rx="3" ry="4" fill="#FFF"/>
      <circle cx="91.5" cy="46" r="1" fill="#FFF"/>
      {/* Sonrisita */}
      <path d="M 60 72 Q 70 80 80 72" stroke="#1a1a2e" strokeWidth="2" fill="none" strokeLinecap="round"/>
    </svg>
  );
}

function CopilotOverlay({ theme, isMidnight, onClose, initialQuery = '', onBusyChange }) {
  const [msg, setMsg] = useState(initialQuery);
  const [thinking, setThinking] = useState(false);
  const [outfit] = useState(detectarOutfit);
  const chivasDay = outfit === 'chivas';

  const enviar = () => {
    if (!msg.trim() || thinking) return;
    setThinking(true);
    onBusyChange?.(true);
    // Simula procesamiento — cuando conectemos IA, reemplazar por await
    setTimeout(() => {
      setThinking(false);
      onBusyChange?.(false);
    }, 2400);
  };

  const suggestions = [
    { ico: '⚡', txt: 'Oye Ferruteck, ¿qué OCs están más atrasadas?' },
    { ico: '📊', txt: 'Dame el fill del mes por cliente' },
    { ico: '🏢', txt: 'Ferruteck, hazme un resumen de Digitalife' },
    { ico: '🏢', txt: 'Y ahora uno de PCEL' },
    { ico: '⏱', txt: '¿Cuánto tardamos de recibir a entregar?' },
    chivasDay
      ? { ico: '⚽', txt: '¿Cómo van las Chivas hoy?' }
      : { ico: '⚽', txt: 'Ferruteck, ¿qué resultado tuvieron las Chivas?' },
  ];

  const saludo = chivasDay
    ? <>¡Arriba las Chivas, mi <em>Ferru</em>! 🔴⚪ Tienes <strong>18 OCs abiertas</strong> y fill del mes en <strong>92.4%</strong>. ¿Vemos algo antes del partido?</>
    : <>Todo bajo control, <em>Ferru</em>. Tienes <strong>18 OCs abiertas</strong> y fill del mes en <strong>92.4%</strong>. ¿En qué te ayudo?</>;

  return (
    <div onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '6vh', paddingLeft: 16, paddingRight: 16,
      }}
    >
      <div onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520,
          background: 'linear-gradient(180deg, #1e1e2e 0%, #0d0d19 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 22,
          boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
          padding: '28px 24px 24px', fontFamily: TYPO.fontText,
          position: 'relative', overflow: 'hidden',
          color: '#EDEDF0',
          animation: 'ferrutekIn 400ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        }}
      >
        {/* Nebulosa + estrellas fondo */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background:
            'radial-gradient(circle at 20% 30%, rgba(191,90,242,0.18) 0%, transparent 50%),' +
            'radial-gradient(circle at 80% 70%, rgba(100,210,255,0.14) 0%, transparent 50%)',
        }}/>
        <FerrutekStars />

        {/* Close */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 14, right: 14, zIndex: 5,
          width: 28, height: 28, borderRadius: 999, border: 0,
          background: 'rgba(255,255,255,0.08)', color: '#FFF', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(10px)',
        }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.16)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
        ><X size={13} /></button>

        {/* Header */}
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 2, marginBottom: 6 }}>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', color: '#FFF' }}>
            Hola, soy{' '}
            <span style={{
              background: chivasDay
                ? 'linear-gradient(135deg, #EF4444, #FBBF24)'
                : 'linear-gradient(135deg, #BF5AF2, #64D2FF)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text', fontWeight: 700,
            }}>Ferruteck</span>{' '}
            <span style={{ display: 'inline-block' }}>{chivasDay ? '🐐' : '👋'}</span>
          </div>
          <div style={{ fontFamily: TYPO.fontText, fontSize: 11.5, color: 'rgba(237,237,240,0.55)', marginTop: 3 }}>
            {chivasDay ? 'Modo Chivas · listos para el partido' : 'Tu asistente fantasmita · dime en qué te ayudo'}
          </div>
        </div>

        {/* Fantasmita bobbing */}
        <div style={{
          position: 'relative', zIndex: 2, alignSelf: 'center',
          margin: '18px auto 16px', width: 'fit-content',
          animation: 'ferrutekBob 3s ease-in-out infinite',
        }}>
          <FerrutekGhost outfit={outfit} size={130} />
          {/* Sombra */}
          <div style={{
            position: 'absolute', bottom: -14, left: '50%',
            transform: 'translateX(-50%)', width: 78, height: 12,
            background: 'radial-gradient(ellipse, rgba(0,0,0,0.55), transparent 70%)',
            borderRadius: '50%',
            animation: 'ferrutekShadow 3s ease-in-out infinite',
          }}/>
        </div>

        {/* Speech bubble */}
        <div style={{
          position: 'relative', zIndex: 2, alignSelf: 'center', margin: '0 auto 16px', width: 'fit-content',
          maxWidth: 420,
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.14)',
          padding: '10px 16px', borderRadius: 18, borderBottomLeftRadius: 4,
          fontFamily: TYPO.fontText, fontSize: 13, color: '#FFF', backdropFilter: 'blur(10px)',
          animation: 'ferrutekSpeech 500ms cubic-bezier(0.34, 1.56, 0.64, 1) 200ms both',
        }}>
          {saludo}
        </div>

        {/* Sugerencias */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => setMsg(s.txt)}
              style={{
                width: '100%', textAlign: 'left', border: '1px solid rgba(255,255,255,0.10)',
                background: 'rgba(255,255,255,0.05)', cursor: 'pointer',
                padding: '9px 14px', borderRadius: 11,
                fontFamily: TYPO.fontText, fontSize: 12.5, color: 'rgba(237,237,240,0.92)',
                display: 'flex', alignItems: 'center', gap: 10,
                backdropFilter: 'blur(10px)', transition: 'all 200ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = chivasDay ? 'rgba(239,68,68,0.14)' : 'rgba(191,90,242,0.14)';
                e.currentTarget.style.borderColor = chivasDay ? 'rgba(239,68,68,0.35)' : 'rgba(191,90,242,0.35)';
                e.currentTarget.style.transform = 'translateX(4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)';
                e.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              <span style={{ fontSize: 13, flexShrink: 0 }}>{s.ico}</span>
              <span style={{ flex: 1 }}>{s.txt}</span>
            </button>
          ))}
        </div>

        {/* Input */}
        <div style={{
          position: 'relative', zIndex: 2,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 999,
          padding: '7px 7px 7px 18px',
          display: 'flex', alignItems: 'center', gap: 10,
          backdropFilter: 'blur(20px)',
        }}>
          <input
            autoFocus
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') enviar(); }}
            placeholder={thinking ? 'Ferruteck está pensando…' : 'Oye Ferruteck, ¿qué…?'}
            disabled={thinking}
            style={{
              flex: 1, border: 0, background: 'transparent', outline: 'none',
              fontFamily: TYPO.fontText, fontSize: 13.5, color: '#FFF',
              opacity: thinking ? 0.6 : 1,
            }}
          />
          {thinking && (
            <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center', paddingRight: 4 }}>
              <span style={{ width: 4, height: 4, borderRadius: 999, background: '#BF5AF2', animation: 'ferrutekThink 1.2s ease-in-out infinite' }}/>
              <span style={{ width: 4, height: 4, borderRadius: 999, background: '#BF5AF2', animation: 'ferrutekThink 1.2s ease-in-out 0.2s infinite' }}/>
              <span style={{ width: 4, height: 4, borderRadius: 999, background: '#BF5AF2', animation: 'ferrutekThink 1.2s ease-in-out 0.4s infinite' }}/>
            </span>
          )}
          <button
            onClick={enviar}
            disabled={!msg.trim() || thinking}
            style={{
              width: 32, height: 32, borderRadius: 999, border: 0, cursor: (!msg.trim() || thinking) ? 'default' : 'pointer',
              background: (msg.trim() && !thinking)
                ? (chivasDay ? 'linear-gradient(135deg, #EF4444, #FBBF24)' : 'linear-gradient(135deg, #AF52DE, #64D2FF)')
                : 'rgba(255,255,255,0.10)',
              color: '#FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: (msg.trim() && !thinking) ? '0 4px 12px rgba(175,82,222,0.4)' : 'none',
              transition: 'background 200ms',
            }}>
            <Send size={13} />
          </button>
        </div>

        <div style={{
          position: 'relative', zIndex: 2, marginTop: 12,
          fontFamily: TYPO.fontText, fontSize: 10.5, color: 'rgba(237,237,240,0.4)', textAlign: 'center',
        }}>
          El Ferruteck todavía está calentando motores · pronto responde en vivo
        </div>

        <style>{`
          @keyframes ferrutekIn { from { opacity: 0; transform: translateY(20px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
          @keyframes ferrutekBob { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-12px) rotate(2deg); } }
          @keyframes ferrutekShadow { 0%,100% { width: 78px; opacity: 0.5; } 50% { width: 58px; opacity: 0.3; } }
          @keyframes ferrutekSpeech { from { opacity: 0; transform: translateY(6px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
          @keyframes ferrutekTwinkle { 0%,100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.4); } }
          @keyframes ferrutekThink { 0%,80%,100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1.2); } }
        `}</style>
      </div>
    </div>
  );
}

function FerrutekStars() {
  const stars = [
    { top: '10%', left: '15%', d: 0 }, { top: '25%', left: '80%', d: 0.4 },
    { top: '40%', left: '45%', d: 0.8 }, { top: '60%', left: '20%', d: 1.2 },
    { top: '75%', left: '70%', d: 1.6 }, { top: '15%', left: '55%', d: 2.0 },
    { top: '50%', left: '90%', d: 2.4 }, { top: '80%', left: '40%', d: 2.8 },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {stars.map((s, i) => (
        <span key={i} style={{
          position: 'absolute', top: s.top, left: s.left,
          width: 2, height: 2, borderRadius: 999, background: '#FFF',
          boxShadow: '0 0 6px rgba(255,255,255,0.8)',
          animation: `ferrutekTwinkle 3s ease-in-out ${s.d}s infinite`,
        }}/>
      ))}
    </div>
  );
}
