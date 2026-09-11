import React, { useState, useEffect, lazy, Suspense } from "react";
import { supabase, DB_CONFIGURED } from './lib/supabase';
import { apiFetch } from './lib/apiFetch';
import { DIGITALIFE_REAL, PCEL_REAL, CARTERA_DIGITALIFE, ULTIMO_MES_SI, NOMBRES_MES, ML_SELLOUT_DEFAULT, clientes } from './lib/constants';
import { formatMXN, formatUSD, formatFecha, diasRestantes, calcularSalud, loadSheetJS } from './lib/utils';
import { useTelemetry, telemetria } from './lib/telemetry';
import { Semaforo, KPICard, CardHeader, TarjetaPendientes, TarjetaPagos, TarjetaPromociones, TarjetaMinuta, BarraCuota, OfflineBadge } from './components';
// Navegación V3: NavShell elige el modo (barra · sidebar · iphone) según perfiles.preferencias.
import NavShell from './components/nav/NavShell';
import { CLIENTES_NAV as SIDEBAR_CLIENTES, construirArbol, nodosPlanos } from './components/nav/arbol';
import { hidratarPreferencias, getPreferencias } from './lib/preferencias';
import { Toaster } from './lib/toast';
import {
  Home, TrendingUp, Package, Megaphone, Wallet, CreditCard,
  BarChart3, Target, ClipboardList, Settings as SettingsIcon, Building2,
  Activity, PieChart, ShoppingCart, ShoppingBag, Boxes, HandCoins, Calculator,
} from 'lucide-react';
// ── Pantallas: React.lazy ──────────────────────────────────────────────
// Cada pantalla es su propio chunk. Antes todas viajaban en index.js
// (2.2 MB / 527 KB gz) aunque el usuario usara 2 o 3. El shell (Topbar,
// MobileShell, Login, loaders) sigue estático porque se necesita siempre.
const HomeClienteV3          = lazy(() => import('./modules/comercial/HomeClienteV3')); // V3: un solo Resumen por cliente (config en home/config.js)
const CreditoCobranza        = lazy(() => import('./modules/comercial/CreditoCobranza'));
const CreditoCobranzaV2      = lazy(() => import('./modules/comercial/CreditoCobranzaV2'));
const PagosCliente           = lazy(() => import('./modules/comercial/PagosCliente'));
const EstrategiaProducto     = lazy(() => import('./modules/comercial/EstrategiaProducto'));
const MarketingCliente       = lazy(() => import('./modules/comercial/MarketingCliente'));
const AnalisisCliente        = lazy(() => import('./modules/comercial/AnalisisCliente'));
const AnalisisClientesGlobal = lazy(() => import('./modules/comercial/AnalisisClientesGlobal'));
const InventarioGlobal       = lazy(() => import('./modules/comercial/InventarioGlobal'));
const EstrategiaPrecios      = lazy(() => import('./modules/comercial/EstrategiaPrecios'));
const ForecastCliente        = lazy(() => import('./modules/comercial/ForecastCliente'));
const ForecastReservas       = lazy(() => import('./modules/comercial/ForecastReservas'));
const SellInCliente          = lazy(() => import('./modules/comercial/SellInCliente'));
const SellInClienteV2        = lazy(() => import('./modules/comercial/SellInClienteV2'));
const SellInDicotech         = lazy(() => import('./modules/comercial/SellInDicotech'));
const SellInPcel             = lazy(() => import('./modules/comercial/SellInPcel'));
const TrackingPedidos        = lazy(() => import('./modules/comercial/TrackingPedidos'));
const SellOutCliente         = lazy(() => import('./modules/comercial/SellOutCliente'));
const SellOutClienteV2       = lazy(() => import('./modules/comercial/SellOutClienteV2'));
const SellOutDicotech        = lazy(() => import('./modules/comercial/SellOutDicotech'));
const SellOutPcel            = lazy(() => import('./modules/comercial/SellOutPcel'));
const EstadoResultados       = lazy(() => import('./modules/general/EstadoResultados'));
const Inicio                 = lazy(() => import('./modules/general/Inicio')); // pestaña por defecto (V3 · 2026-09-11)
const VisionGeneral          = lazy(() => import('./modules/comercial/VisionGeneral'));
const ReporteTab             = lazy(() => import('./modules/comercial/ReporteTab'));
const ResumenClientesTab     = lazy(() => import('./modules/comercial/ResumenClientesTab'));
const PropuestasTab          = lazy(() => import('./modules/comercial/PropuestasTab'));
const ForecastClientesTab    = lazy(() => import('./modules/comercial/ForecastClientesTab'));
const TelemetriaPanel        = lazy(() => import('./modules/interno/TelemetriaPanel'));
const HistorialCambios       = lazy(() => import('./modules/interno/HistorialCambios'));
const AxonMexico             = lazy(() => import('./modules/interno/AxonMexico'));
const Configuracion          = lazy(() => import('./modules/configuracion/Configuracion'));
const ActualizacionDatos     = lazy(() => import('./modules/settings/ActualizacionDatos'));
const Agenda                 = lazy(() => import('./modules/agenda/Agenda')); // Agenda (V3 · 2026-09-11): sustituye a Pendientes & Calendario (adminInterna → agenda)
// Auth y shell: estáticos (se necesitan antes de cualquier pantalla).
import LoginPage from './modules/auth/LoginPage';
import SetPasswordPage from './modules/auth/SetPasswordPage';
import SinAcceso from './components/SinAcceso';
import {
  puedeConfigurar,
  puedeActualizarDatos,
  puedeVerCliente,
  puedeVerPestana,
  puedeVerPestanaCliente,
  puedeVerPestanaGlobal,
  puedeVerPaginaGlobal,
  puedeVerInicio,
} from './lib/permisos';
import { PerfilContext } from './lib/perfilContext';
import { ThemeProvider } from './lib/themeContext';
import { PageTransition } from './components/apple/AppleLoader';
import { Cargando } from './components/kit';
import { useBreakpoint, isMobile, useMobileShell } from './lib/useBreakpoint';
import MobileNav from './components/MobileNav';
import MobileShell from './components/MobileShell'; // legacy: sustituido por MovilApp (V3); se retira en la siguiente limpieza
const MovilApp = lazy(() => import('./movil/MovilApp'));
import BandejaAlertas from './components/BandejaAlertas';
import { ToastHost } from './components/kit';
// Pantallas mobile: lazy (sólo se descargan en iPhone/iPad, y sólo la que se abre).
const MobileHome              = lazy(() => import('./components/MobileHome'));
const MobileEquipo            = lazy(() => import('./components/MobileEquipo'));
const MobileYo                = lazy(() => import('./components/MobileYo'));
const MobileSellIn            = lazy(() => import('./components/MobileSellIn'));
const MobileSellOut           = lazy(() => import('./components/MobileSellOut'));
const MobileCartera           = lazy(() => import('./components/MobileCartera'));
const MobileMarketing         = lazy(() => import('./components/MobileMarketing'));
const MobileHomeCliente       = lazy(() => import('./components/MobileHomeCliente'));
const MobileBuscar            = lazy(() => import('./components/MobileBuscar'));
const MobileEdR               = lazy(() => import('./components/MobileEdR'));
const MobileVisionGeneral     = lazy(() => import('./components/MobileVisionGeneral'));
const MobileAnalisisClientes  = lazy(() => import('./components/MobileAnalisisClientes'));
const MobileSellInGlobal      = lazy(() => import('./components/MobileSellInGlobal'));
const MobileSellOutGlobal     = lazy(() => import('./components/MobileSellOutGlobal'));
const MobileInventarioGlobal  = lazy(() => import('./components/MobileInventarioGlobal'));
const MobileCobranzaGlobal    = lazy(() => import('./components/MobileCobranzaGlobal'));
const MobileSOP               = lazy(() => import('./components/MobileSOP'));
const MobilePropuestas        = lazy(() => import('./components/MobilePropuestas'));
const MobileEstrategiaPrecios = lazy(() => import('./components/MobileEstrategiaPrecios'));
const MobileTrackingPedidos   = lazy(() => import('./components/MobileTrackingPedidos'));


function ActualizarDatosExcel({ cliente, anio, onComplete }) {
  const [cargando, setCargando] = React.useState(false);
  const [resultado, setResultado] = React.useState(null);
  const fileRef = React.useRef(null);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setCargando(true);
    setResultado(null);
    loadSheetJS().then(XLSX => {
      const reader = new FileReader();
      reader.onload = evt => {
        try {
          const wb = XLSX.read(evt.target.result, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(ws);
          if (onComplete) onComplete(data);
          setResultado({ ok: true, rows: data.length });
        } catch (err) {
          setResultado({ ok: false, error: err.message });
        }
        setCargando(false);
      };
      reader.readAsArrayBuffer(file);
    });
  }

  return React.createElement("div", null,
    React.createElement("input", { ref: fileRef, type: "file", accept: ".xlsx,.xls,.csv", onChange: handleFile, className: "hidden" }),
    React.createElement("button", {
      onClick: () => fileRef.current?.click(),
      disabled: cargando,
      className: "w-full py-2.5 rounded-lg text-sm font-medium transition-all " + (cargando ? "bg-gray-200 text-gray-500" : "bg-blue-600 text-white hover:bg-blue-700")
    }, cargando ? "Procesando..." : "Subir Excel"),
    resultado && React.createElement("p", { className: "text-xs mt-2 " + (resultado.ok ? "text-green-600" : "text-red-500") },
      resultado.ok ? resultado.rows + " registros cargados" : "Error: " + resultado.error
    )
  );
}

function PanelActualizacion({ onClose, cliente, clienteKey, anio, onVentasUpdate, onGoToSection }) {
  return React.createElement("div", {
    className: "fixed inset-0 z-50 flex",
    onClick: function(e) { if (e.target === e.currentTarget) onClose(); }
  },
    React.createElement("div", { className: "absolute inset-0 bg-black bg-opacity-40" }),
    React.createElement("div", {
      className: "relative ml-auto w-full max-w-md bg-white shadow-2xl flex flex-col h-full",
      style: { animation: "slideInRight 0.3s ease-out" }
    },
      React.createElement("div", { className: "flex items-center justify-between p-5 border-b border-gray-100" },
        React.createElement("div", null,
          React.createElement("h2", { className: "text-lg font-bold text-gray-800" }, "\uD83D\uDD04 Central de Actualizaci\u00F3n"),
          React.createElement("p", { className: "text-xs text-gray-400 mt-0.5" }, "Actualiza todos los datos desde un solo lugar")
        ),
        React.createElement("button", {
          onClick: onClose,
          className: "w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        }, "\u2715")
      ),
      React.createElement("div", { className: "flex-1 overflow-y-auto p-5 space-y-5" },
        React.createElement("div", { className: "bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200" },
          React.createElement("div", { className: "flex items-center gap-2 mb-3" },
            React.createElement("span", { className: "text-lg" }, "\uD83D\uDCCA"),
            React.createElement("div", null,
              React.createElement("p", { className: "text-sm font-semibold text-blue-800" }, "Ventas Mensuales"),
              React.createElement("p", { className: "text-xs text-blue-500" }, "Excel Central de Ventas")
            )
          ),
          React.createElement(ActualizarDatosExcel, { cliente: clienteKey, anio: anio, onComplete: onVentasUpdate })
        ),
        React.createElement("div", { className: "bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 border border-emerald-200 cursor-pointer hover:shadow-md transition-shadow", onClick: function() { if (onGoToSection) { onGoToSection("estrategia"); onClose(); } } },
          React.createElement("div", { className: "flex items-center gap-2" },
            React.createElement("span", { className: "text-lg" }, "\uD83D\uDCE6"),
            React.createElement("div", { className: "flex-1" },
              React.createElement("p", { className: "text-sm font-semibold text-emerald-800" }, "Sell Out"),
              React.createElement("p", { className: "text-xs text-emerald-500" }, "Reporte Acteck + Resumen Cliente")
            ),
            React.createElement("span", { className: "text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full font-medium" }, "Activo")
          )
        ),
        React.createElement("div", { className: "bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 border border-amber-200 opacity-60" },
          React.createElement("div", { className: "flex items-center gap-2" },
            React.createElement("span", { className: "text-lg" }, "\uD83D\uDCE7"),
            React.createElement("div", { className: "flex-1" },
              React.createElement("p", { className: "text-sm font-semibold text-amber-800" }, "Correos y Reportes"),
              React.createElement("p", { className: "text-xs text-amber-500" }, "Descarga autom\u00E1tica de reportes por email")
            ),
            React.createElement("span", { className: "text-xs bg-amber-200 text-amber-700 px-2 py-0.5 rounded-full font-medium" }, "Pronto")
          )
        ),
        React.createElement("div", { className: "bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200 opacity-60" },
          React.createElement("div", { className: "flex items-center gap-2" },
            React.createElement("span", { className: "text-lg" }, "\uD83D\uDCE3"),
            React.createElement("div", { className: "flex-1" },
              React.createElement("p", { className: "text-sm font-semibold text-purple-800" }, "Marketing"),
              React.createElement("p", { className: "text-xs text-purple-500" }, "Importar campa\u00F1as y m\u00E9tricas")
            ),
            React.createElement("span", { className: "text-xs bg-purple-200 text-purple-700 px-2 py-0.5 rounded-full font-medium" }, "Pronto")
          )
        )
      ),
      React.createElement("div", { className: "p-4 border-t border-gray-100 bg-gray-50" },
        React.createElement("p", { className: "text-xs text-gray-400 text-center" },
          "Cliente: ", React.createElement("span", { className: "font-semibold text-gray-600" }, cliente),
          " \u00B7 A\u00F1o: ", React.createElement("span", { className: "font-semibold text-gray-600" }, anio)
        )
      )
    )
  );
}


function ResumenCuentas() {
  return React.createElement("div", { className: "p-8" },
    React.createElement("h2", { className: "text-2xl font-bold mb-4" }, "Resumen General"),
    React.createElement("p", { className: "text-gray-500" }, "Vista de resumen en desarrollo...")
  );
}

function UploadModalX({ onClose }) {
  return (
    React.createElement('div', { className: 'fixed inset-0 z-50 flex items-center justify-center p-4', style: { backgroundColor: 'rgba(0,0,0,0.6)' } },
      React.createElement('div', { className: 'bg-white rounded-lg shadow-2xl w-full flex flex-col overflow-hidden', style: { maxWidth: '1100px', height: '90vh' } },
        React.createElement('div', { className: 'flex items-center justify-between px-4 py-3 bg-gray-800 text-white' },
          React.createElement('div', { className: 'font-semibold' }, '📤 Subir Excel central — Importador de tablas'),
          React.createElement('button', { onClick: onClose, className: 'px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm' }, 'Cerrar ✕')
        ),
        React.createElement('iframe', { src: '/import.html', className: 'flex-1 w-full', style: { border: 0 }, title: 'Importador Excel' })
      )
    )
  );
}

// ── Breadcrumb arriba del contenido ──
const PESTANAS_INFO = {
  home:       { label: 'Resumen',                icon: Home },
  analisis:   { label: 'Análisis',               icon: TrendingUp },
  sellIn:     { label: 'Sell In',                icon: ShoppingCart },
  estrategia: { label: 'Sell Out',               icon: ShoppingBag },
  marketing:  { label: 'Marketing',              icon: Megaphone },
  pagos:      { label: 'Pagos',                  icon: Wallet },
  cartera:    { label: 'Crédito y Cobranza',     icon: CreditCard },
};
const GLOBAL_PAGES_INFO = {
  resumenClientes:  { label: 'Resumen de Clientes',    icon: BarChart3 },
  estadoResultados: { label: 'Estado de Resultados',   icon: Calculator },
  visionGeneral:    { label: 'Visión General',         icon: Activity },
  analisisClientes: { label: 'Análisis por Cliente',   icon: PieChart },
  sellIn:           { label: 'Sell In',                icon: ShoppingCart },
  sellOut:          { label: 'Sell Out',               icon: ShoppingBag },
  inventarioGlobal: { label: 'Inventario',             icon: Boxes },
  cobranzaGlobal:   { label: 'Cobranza',               icon: HandCoins },
  forecastClientes: { label: 'S&OP',                   icon: Target },
  estrategiaPrecios:{ label: 'Estrategia de Precios',  icon: TrendingUp },
  forecastReservas: { label: 'Forecast',    icon: Target },
  ordenesCompra:    { label: 'Tracking Pedidos',        icon: Target },
  agenda:           { label: 'Agenda',                 icon: ClipboardList },
  axonMexico:       { label: 'Axon de México',          icon: Building2 },
};
function Breadcrumb({ clienteActivo, paginaActiva, vistaActual }) {
  if (vistaActual === 'configuracion') {
    return (
      <div className="mb-4 flex items-center gap-2 text-sm">
        <SettingsIcon className="w-4 h-4 text-gray-500" />
        <span className="font-semibold text-gray-800">Administración</span>
      </div>
    );
  }
  if (clienteActivo && PESTANAS_INFO[paginaActiva]) {
    const cli = SIDEBAR_CLIENTES[clienteActivo];
    const pag = PESTANAS_INFO[paginaActiva];
    const PagIcon = pag.icon;
    return (
      <div className="mb-4 flex items-center gap-2 text-sm">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cli?.color || '#999' }} />
        <span className="font-semibold text-gray-800">{cli?.label || clienteActivo}</span>
        <span className="text-gray-300">›</span>
        <span className="flex items-center gap-1.5 text-gray-600">
          {PagIcon && <PagIcon className="w-3.5 h-3.5" />}
          {pag.label}
        </span>
      </div>
    );
  }
  if (GLOBAL_PAGES_INFO[paginaActiva]) {
    const p = GLOBAL_PAGES_INFO[paginaActiva];
    const Icon = p.icon;
    return (
      <div className="mb-4 flex items-center gap-2 text-sm">
        {Icon && <Icon className="w-4 h-4 text-gray-600" />}
        <span className="font-semibold text-gray-800">{p.label}</span>
      </div>
    );
  }
  return null;
}

function UpdatedAtBadgeX() {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    apiFetch('/api/status?type=last').then(r => r.json()).then(setInfo).catch(() => setInfo({ error: true }));
  }, []);
  if (!info) return React.createElement('span', { className: 'text-xs text-gray-400' }, 'cargando…');
  if (info.error || !info.last_update) return React.createElement('span', { className: 'text-xs text-gray-400' }, 'sin datos');
  const d = new Date(info.last_update);
  const txt = d.toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  return React.createElement('span', { className: 'text-xs text-gray-600', title: info.last_update }, '🕒 Últ. actualización: ' + txt);
}

export default function App() {
  //  AUTH STATE
  const [authUser, setAuthUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const bp = useBreakpoint();
  const mobile = useMobileShell();

  useEffect(() => {
    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        supabase.from("perfiles").select("*").eq("user_id", session.user.id).single()
          .then(({ data: p }) => {
            if (p && p.activo) { setAuthUser(session.user); setPerfil(p); }
            setAuthLoading(false);
          });
      } else {
        setAuthLoading(false);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') { setAuthUser(null); setPerfil(null); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = ({ user, perfil: p }) => { setAuthUser(user); setPerfil(p); };
  const handleLogout = async () => { await supabase.auth.signOut(); setAuthUser(null); setPerfil(null); };

  

  // Mercado Libre se migró a la nueva empresa "Axon de México" (módulo
  // Administración Interna). Ya no aparece como cliente del dashboard
  // comercial — no se fetchea ml-sellout ni se enriquece su entrada.
  const clientesDinamicos = clientes;

  
    // ── Navegación persistente (se guarda la pestaña al recargar) ──
    const GLOBAL_PAGES = React.useMemo(() => new Set(['inicio','resumen','reporte','resumenClientes','propuestas','forecastClientes','forecastReservas','ordenesCompra','agenda','adminInterna','telemetria','historialCambios','axonMexico','buscar','actualizacion']), []);
    const [paginaActiva, setPaginaActiva] = useState(() => {
      try { const p = localStorage.getItem('nav_pagina') || 'inicio'; return p === 'adminInterna' ? 'agenda' : p; } catch { return 'inicio'; }
    });
    const [clienteActivo, setClienteActivo] = useState(() => {
      try {
        const pag = localStorage.getItem('nav_pagina') || 'inicio';
        const globals = new Set(['inicio','resumen','reporte','resumenClientes','propuestas','forecastClientes','forecastReservas','ordenesCompra','agenda','adminInterna','telemetria','historialCambios','axonMexico','buscar','actualizacion']);
        if (globals.has(pag)) return null;
        return localStorage.getItem('nav_cliente') || 'digitalife';
      } catch { return 'digitalife'; }
    });
    const [vistaActual, setVistaActual] = useState(() => {
      try { return localStorage.getItem('nav_vista') || null; } catch { return null; }
    });
    // Pestaña al entrar: preferencia menu.inicio ('inicio' | 'ultima'). Se aplica una vez por login.
    // Si el perfil no puede ver Inicio, cae a la primera pestaña visible de su árbol.
    const arranqueAplicado = React.useRef(null);
    React.useEffect(() => {
      if (!perfil?.user_id || arranqueAplicado.current === perfil.user_id) return;
      arranqueAplicado.current = perfil.user_id;
      hidratarPreferencias(perfil);
      const abrirEn = getPreferencias()?.menu?.inicio || 'inicio';
      const irA = (c, p) => { setVistaActual(null); setClienteActivo(c); setPaginaActiva(p); };
      if (abrirEn === 'inicio') {
        if (puedeVerInicio(perfil)) irA(null, 'inicio');
        else { const n = nodosPlanos(construirArbol(perfil)).find((x) => x.tipo !== 'enlace'); if (n) irA(n.clienteKey || null, n.pagina); }
      } else if (paginaActiva === 'inicio' && !puedeVerInicio(perfil)) {
        const n = nodosPlanos(construirArbol(perfil)).find((x) => x.tipo !== 'enlace'); if (n) irA(n.clienteKey || null, n.pagina);
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [perfil?.user_id]);
    // Telemetría global: login/logout + heartbeats cada 60s
    useTelemetry();
    React.useEffect(() => {
      try { localStorage.setItem('nav_pagina', paginaActiva); } catch {}
      // Emit navegación de pestaña (con cliente activo si aplica)
      telemetria.navPagina(paginaActiva, clienteActivo);
    }, [paginaActiva, clienteActivo]);
    React.useEffect(() => {
      try {
        if (clienteActivo) localStorage.setItem('nav_cliente', clienteActivo);
        else localStorage.removeItem('nav_cliente');
      } catch {}
      if (clienteActivo) telemetria.navCliente(clienteActivo);
    }, [clienteActivo]);
    React.useEffect(() => {
      try {
        if (vistaActual) localStorage.setItem('nav_vista', vistaActual);
        else localStorage.removeItem('nav_vista');
      } catch {}
    }, [vistaActual]);

  // ── Prefetch de pantallas vecinas en idle ──────────────────────────
  // Con React.lazy cada pestaña baja su chunk al hacer clic (~100-300 ms de
  // loader). Cuando el navegador está libre, precargamos los chunks de las
  // pestañas del cliente activo (o de las globales más usadas) para que el
  // siguiente clic sea instantáneo. Rollup dedupe estos import() con los de
  // lazy(): es el mismo módulo, no se descarga dos veces. Se respeta
  // "ahorro de datos" y se hace de uno en uno para no competir con la
  // carga de la pantalla actual.
  React.useEffect(() => {
    if (!authUser) return;
    if (typeof navigator !== 'undefined' && navigator.connection?.saveData) return;
    const porCliente = {
      digitalife: [
        () => import('./modules/comercial/HomeClienteV3'), () => import('./modules/comercial/SellInClienteV2'),
        () => import('./modules/comercial/SellOutClienteV2'), () => import('./modules/comercial/PagosCliente'),
        () => import('./modules/comercial/CreditoCobranzaV2'), () => import('./modules/comercial/MarketingCliente'),
        () => import('./modules/comercial/AnalisisCliente'),
      ],
      dicotech: [
        () => import('./modules/comercial/HomeClienteV3'), () => import('./modules/comercial/SellInDicotech'),
        () => import('./modules/comercial/SellOutDicotech'), () => import('./modules/comercial/PagosCliente'),
        () => import('./modules/comercial/CreditoCobranzaV2'), () => import('./modules/comercial/MarketingCliente'),
        () => import('./modules/comercial/AnalisisCliente'),
      ],
      pcel: [
        () => import('./modules/comercial/HomeClienteV3'), () => import('./modules/comercial/SellInPcel'),
        () => import('./modules/comercial/SellOutPcel'), () => import('./modules/comercial/PagosCliente'),
        () => import('./modules/comercial/CreditoCobranzaV2'), () => import('./modules/comercial/MarketingCliente'),
        () => import('./modules/comercial/AnalisisCliente'),
      ],
    };
    const globales = [
      () => import('./modules/comercial/ResumenClientesTab'), () => import('./modules/comercial/VisionGeneral'),
      () => import('./modules/comercial/ForecastClientesTab'), () => import('./modules/comercial/PropuestasTab'),
      () => import('./modules/comercial/EstrategiaPrecios'), () => import('./modules/comercial/InventarioGlobal'),
      () => import('./modules/comercial/TrackingPedidos'), () => import('./modules/comercial/ForecastReservas'),
      () => import('./modules/agenda/Agenda'),
    ];
    const moviles = [
      () => import('./components/MobileHome'),
      () => import('./components/MobileHomeCliente'), () => import('./components/MobileSellIn'),
      () => import('./components/MobileSellOut'), () => import('./components/MobileCartera'),
    ];
    const cola = mobile
      ? moviles
      : [...(clienteActivo ? (porCliente[clienteActivo] || []) : []), ...globales];

    let cancelado = false;
    const ric = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
    const cic = window.cancelIdleCallback || clearTimeout;
    let handle = null;
    const paso = (i) => {
      if (cancelado || i >= cola.length) return;
      handle = ric(() => {
        if (cancelado) return;
        Promise.resolve(cola[i]()).catch(() => {}).finally(() => paso(i + 1));
      }, { timeout: 4000 });
    };
    // Empezar tras un respiro para no competir con la pantalla que se está abriendo.
    const t = setTimeout(() => paso(0), 1200);
    return () => { cancelado = true; clearTimeout(t); if (handle != null) cic(handle); };
  }, [authUser, clienteActivo, mobile]);

  const [modoPresent, setModoPresent] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [clienteKey, setClienteKey] = useState(null);

  //  DATOS DESDE SUPABASE (ventas_mensuales) 
  const [ventasDB, setVentasDB] = React.useState(null);
  const [ventasVer, setVentasVer] = React.useState(0);

  React.useEffect(() => {
    if (!DB_CONFIGURED) return;
    supabase.from("ventas_mensuales").select("*")
      .eq("cliente", clienteActivo).eq("anio", 2026).order("mes")
      .then(({ data }) => setVentasDB(data || []));
  }, [clienteActivo, ventasVer]);

  const c = React.useMemo(() => {
    const base = clientesDinamicos[clienteActivo];
    if (!base) return { kpis: {}, pagos: [], promociones: [], minuta: [], pendientes: [], nombre: '', ventas: {} };
    if (!ventasDB || ventasDB.length === 0) return base;
    const sellInMap = {};
    const sellOutMap = {};
    ventasDB.forEach(r => { sellInMap[r.mes] = r.sell_in; sellOutMap[r.mes] = r.sell_out; });
    const ultimoMes = Math.max(...ventasDB.map(r => r.mes));
    const lastRow = ventasDB.find(r => r.mes === ultimoMes);
    const cuotaAcum = Object.entries(DIGITALIFE_REAL.cuota30M)
      .filter(([m]) => parseInt(m) <= ultimoMes)
      .reduce((a, [, v]) => a + v, 0);
    return {
      ...base,
      kpis: {
        ...base.kpis,
        sellInMes: sellInMap[ultimoMes] || base.kpis.sellInMes,
        sellOut: sellOutMap[ultimoMes] || base.kpis.sellOut,
        sellInAcumulado: Object.values(sellInMap).reduce((a, b) => a + b, 0),
        sellOutAcumulado: Object.values(sellOutMap).reduce((a, b) => a + b, 0),
        cuotaAcumulada: cuotaAcum || base.kpis.cuotaAcumulada,
        cuotaMes: DIGITALIFE_REAL.cuota30M[ultimoMes] || base.kpis.cuotaMes,
        cuotaMes25M: DIGITALIFE_REAL.cuota25M[ultimoMes] || base.kpis.cuotaMes25M,
        diasInventario: lastRow?.inventario_dias ?? base.kpis.diasInventario,
        inventarioValor: lastRow?.inventario_valor ?? base.kpis.inventarioValor,
        ultimoMes: NOMBRES_MES[ultimoMes] || base.kpis.ultimoMes,
      }
    };
  }, [clienteActivo, ventasDB]);

  // Al cambiar de cliente, volver al home
  const handleClienteChange = (key) => {
    setClienteActivo(key);
    setPaginaActiva("home");
  };

  // Sidebar navigation bridge
  const handleNavegar = (clienteId, paginaId) => {
    if (paginaId === 'adminInterna') paginaId = 'agenda'; // página vieja "Pendientes & Calendario" → Agenda
    if (paginaId === 'configuracion') { setVistaActual('configuracion'); return; }
    setVistaActual(null);
    if (clienteId) {
      handleClienteChange(clienteId);
      setPaginaActiva(paginaId);
    } else {
      setClienteActivo(null);
      setPaginaActiva(paginaId);
    }
  };

  // Navegación desde componentes sin acceso a handleNavegar (FrescuraPill, móvil): evento global.
  React.useEffect(() => {
    const on = (e) => { const d = e.detail || {}; if (d.pagina) handleNavegar(d.clienteKey || null, d.pagina); };
    window.addEventListener('acteck:navegar', on);
    return () => window.removeEventListener('acteck:navegar', on);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const puedeActualizar = puedeActualizarDatos(perfil);
  const puedeVerConfig  = puedeConfigurar(perfil);
  const navItems = [
    { id: "home",       label: "Resumen",               icono: "°", habilitado: true  },
    { id: "analisis",   label: "An¡lisis",                icono: "°", habilitado: true  },
    { id: "sellIn",     label: "Sell In",                icono: "°", habilitado: true  },
    { id: "estrategia", label: "Sell Out",               icono: "°", habilitado: true  },
    { id: "marketing",  label: "Marketing",              icono: "°", habilitado: true  },
    { id: "pagos",      label: "Pagos",                  icono: "°°", habilitado: true  },
    { id: "cartera",    label: "Crdito y Cobranza",     icono: "°", habilitado: true  },
    ...(puedeActualizar ? [{ id: "actualizacion", label: "Actualizaci�n de datos", icono: "=", habilitado: true, admin: true }] : []),
  ]

  
  // Ruta /#/set-password → landing de invitación (aunque el usuario ya tenga
  // sesión de invite, o si no tiene perfil aún)
  const isSetPasswordRoute = typeof window !== 'undefined'
    && (window.location.hash || '').startsWith('#/set-password');
  if (isSetPasswordRoute) return <SetPasswordPage />;

  if (authLoading) return <Cargando fullscreen label="Cargando…" sub="Iniciando el dashboard" />;
  if (!authUser || !perfil) return <LoginPage onLogin={handleLogin} />;

  // Contenido de la pantalla activa (mismo bloque para móvil y desktop; el chrome lo pone MobileShell o NavShell).
  const contenido = (
          <div className="w-full" style={{
            padding: mobile ? '12px 16px' : '4px 24px 16px',
            maxWidth: mobile ? '100%' : 1600,
            margin: '0 auto',
          }}>
          <PageTransition keyId={vistaActual === 'configuracion' ? 'configuracion' : `${clienteActivo || 'g'}-${paginaActiva}`}>
          <Suspense fallback={<Cargando pantalla={vistaActual === 'configuracion' ? 'configuracion' : paginaActiva} />}>
          {vistaActual === "configuracion" ? (
            puedeVerConfig
              ? (mobile
                  ? <MobileYo perfil={perfil} onCerrarSesion={handleLogout} onOpenConfig={() => { /* placeholder: quedará en la misma vista si necesita ir al detalle */ }} />
                  : <Configuracion session={{user: authUser, perfil}} />)
              : <SinAcceso motivo="Solo el Super Admin puede ver Administración." />
          ) : (
            <>
            {/* Banner modo presentaci³n */}
        { /* Banner removed */ }
          {paginaActiva === "inicio" && !clienteActivo && (
            puedeVerInicio(perfil)
              ? (mobile
                  ? <MobileHome perfil={perfil} onNavegar={handleNavegar} />
                  : <Inicio onNavegar={handleNavegar} />)
              : <SinAcceso motivo="No tienes acceso a Inicio. Pídele a Fernando que te habilite Visión General o Resumen de Clientes." />
          )}
          {paginaActiva === "resumen" && (
            perfil?.es_super_admin
              ? <>
                  <div style={{ marginBottom: 16 }}>
                    <BandejaAlertas clienteKey={null} onNavegar={handleNavegar} />
                  </div>
                  <ResumenCuentas />
                </>
              : <SinAcceso motivo="No tienes acceso al Resumen general." />
          )}
          {paginaActiva === "buscar" && mobile && (
            <MobileBuscar perfil={perfil} onNavegar={handleNavegar} />
          )}
          {paginaActiva === "reporte" && (
            perfil?.es_super_admin
              ? <ReporteTab />
              : <SinAcceso motivo="No tienes acceso al Reporte." />
          )}
          {paginaActiva === "resumenClientes" && (
            puedeVerPestanaGlobal(perfil, "resumen_clientes")
              ? (mobile
                  ? <MobileHome perfil={perfil} onNavegar={handleNavegar} />
                  : <ResumenClientesTab
                      onDrillDown={(clienteKey) => { setClienteActivo(clienteKey); setPaginaActiva('home'); }}
                    />)
              : <SinAcceso motivo="No tienes acceso al Resumen de Clientes." />
          )}
          {paginaActiva === "propuestas" && (
            puedeVerPestanaGlobal(perfil, "propuestas")
              ? (mobile
                  ? <MobilePropuestas onBack={() => handleNavegar(null, 'resumenClientes')} onNavegar={handleNavegar} />
                  : <PropuestasTab />)
              : <SinAcceso motivo="No tienes acceso a Propuestas." />
          )}
          {paginaActiva === "estadoResultados" && (
            puedeVerPestanaGlobal(perfil, "estado_resultados")
              ? (mobile
                  ? <MobileEdR onBack={() => handleNavegar(null, 'resumenClientes')} onNavegar={handleNavegar} />
                  : <EstadoResultados />)
              : <SinAcceso motivo="No tienes acceso a Estado de Resultados." />
          )}
          {paginaActiva === "visionGeneral" && (
            puedeVerPestanaGlobal(perfil, "vision_general")
              ? (mobile
                  ? <MobileVisionGeneral onBack={() => handleNavegar(null, 'resumenClientes')} onNavegar={handleNavegar} />
                  : <VisionGeneral />)
              : <SinAcceso motivo="No tienes acceso a Visión General." />
          )}
          {paginaActiva === "analisisClientes" && (
            puedeVerPestanaGlobal(perfil, "analisis_clientes")
              ? (mobile
                  ? <MobileAnalisisClientes onBack={() => handleNavegar(null, 'resumenClientes')} onNavegar={handleNavegar} />
                  : <AnalisisClientesGlobal />)
              : <SinAcceso motivo="No tienes acceso a Análisis por Cliente." />
          )}
          {!clienteActivo && paginaActiva === "sellIn" && (
            puedeVerPestanaGlobal(perfil, "sell_in")
              ? (mobile
                  ? <MobileSellInGlobal onBack={() => handleNavegar(null, 'resumenClientes')} onNavegar={handleNavegar} />
                  : <SellInCliente clienteKey={null} />)
              : <SinAcceso motivo="No tienes acceso a Sell In." />
          )}
          {paginaActiva === "sellOut" && (
            puedeVerPestanaGlobal(perfil, "sell_out")
              ? (mobile
                  ? <MobileSellOutGlobal onBack={() => handleNavegar(null, 'resumenClientes')} onNavegar={handleNavegar} />
                  : (
                    <div className="p-12 text-center">
                      <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <h2 className="text-xl font-semibold text-gray-700 mb-2">Sell Out</h2>
                      <p className="text-gray-500">Próximamente — esta pestaña está en construcción.</p>
                    </div>
                  ))
              : <SinAcceso motivo="No tienes acceso a Sell Out." />
          )}
          {paginaActiva === "inventarioGlobal" && (
            puedeVerPestanaGlobal(perfil, "inventario_global")
              ? (mobile
                  ? <MobileInventarioGlobal onBack={() => handleNavegar(null, 'resumenClientes')} onNavegar={handleNavegar} />
                  : <InventarioGlobal />)
              : <SinAcceso motivo="No tienes acceso a Inventario." />
          )}
          {paginaActiva === "cobranzaGlobal" && (
            puedeVerPestanaGlobal(perfil, "cobranza_global")
              ? (mobile
                  ? <MobileCobranzaGlobal onBack={() => handleNavegar(null, 'resumenClientes')} onNavegar={handleNavegar} />
                  : (
                    <div className="p-12 text-center">
                      <HandCoins className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <h2 className="text-xl font-semibold text-gray-700 mb-2">Cobranza</h2>
                      <p className="text-gray-500">Próximamente — esta pestaña está en construcción.</p>
                    </div>
                  ))
              : <SinAcceso motivo="No tienes acceso a Cobranza." />
          )}
          {paginaActiva === "forecastClientes" && (
            puedeVerPestanaGlobal(perfil, "forecast_clientes")
              ? (mobile
                  ? <MobileSOP onBack={() => handleNavegar(null, 'resumenClientes')} onNavegar={handleNavegar} />
                  : <ForecastClientesTab />)
              : <SinAcceso motivo="No tienes acceso a Forecast / S&OP." />
          )}
          {paginaActiva === "estrategiaPrecios" && (
            puedeVerPestanaGlobal(perfil, "estrategia_precios")
              ? (mobile
                  ? <MobileEstrategiaPrecios onBack={() => handleNavegar(null, 'resumenClientes')} onNavegar={handleNavegar} />
                  : <EstrategiaPrecios />)
              : <SinAcceso motivo="No tienes acceso a Estrategia de Precios." />
          )}
          {paginaActiva === "forecastReservas" && (
            puedeVerPestanaGlobal(perfil, "forecast_reservas")
              ? <ForecastReservas />
              : <SinAcceso motivo="No tienes acceso a Forecast · Reservas." />
          )}
          {paginaActiva === "ordenesCompra" && (
            puedeVerPestanaGlobal(perfil, "ordenes_compra")
              ? (mobile
                  ? <MobileTrackingPedidos onBack={() => handleNavegar(null, 'resumenClientes')} onNavegar={handleNavegar} />
                  : <TrackingPedidos />)
              : <SinAcceso motivo="No tienes acceso a Tracking Pedidos." />
          )}
          {paginaActiva === "agenda" && (
            // Agenda (V3): permiso global `agenda` (migrado de admin_interna); internos y super admin siempre.
            puedeVerPaginaGlobal(perfil, "agenda")
              ? <Agenda onNavegar={handleNavegar} />
              : <SinAcceso motivo="No tienes acceso a la Agenda. Pídele a Fernando que te la habilite desde Administración." />
          )}
          {paginaActiva === "telemetria" && (
            perfil?.es_super_admin
              ? (mobile
                  ? <MobileEquipo perfil={perfil} onNavegar={handleNavegar} />
                  : <TelemetriaPanel />)
              : <SinAcceso motivo="Sólo el super admin puede ver la actividad del equipo." />
          )}
          {paginaActiva === "historialCambios" && (
            puedeVerPestanaGlobal(perfil, "historial_cambios")
              ? <HistorialCambios />
              : <SinAcceso motivo="No tienes acceso al Historial de cambios. Pídele a Fernando que te lo habilite desde Administración." />
          )}
          {paginaActiva === "axonMexico" && (
            puedeVerPestanaGlobal(perfil, "axon_mexico")
              ? <AxonMexico />
              : <SinAcceso motivo="No tienes acceso a Axon de México." />
          )}
          <>
            <>
        {clienteActivo && !puedeVerCliente(perfil, clienteActivo) ? (
          <SinAcceso motivo={`No tienes acceso al cliente ${clienteActivo}.`} />
        ) : clienteActivo && ['home','analisis','sellIn','estrategia','marketing','pagos','cartera'].includes(paginaActiva) && !puedeVerPestanaCliente(perfil, clienteActivo, paginaActiva) ? (
          // Gate granular por (cliente, pestaña). Bloquea URL directa a una
          // pestaña oculta para este cliente específico.
          <SinAcceso motivo={`No tienes acceso a esta pestaña de ${clienteActivo}.`} />
        ) : (
          <>
        {paginaActiva === "home" && (
          mobile
            ? <MobileHomeCliente clienteKey={clienteActivo} onBack={() => { setClienteActivo(null); setPaginaActiva('resumenClientes'); }} onNavegar={handleNavegar} />
            : <>
                <div style={{ marginBottom: 16 }}>
                  <BandejaAlertas clienteKey={clienteActivo} compacto onNavegar={handleNavegar} />
                </div>
                <HomeClienteV3 cliente={c} clienteKey={clienteActivo} onUploadComplete={() => setVentasVer(v => v+1)} onNavegar={handleNavegar} />
              </>
        )}
        {clienteActivo && paginaActiva === "sellIn"  && (
          mobile
            ? <MobileSellIn clienteKey={clienteActivo} onBack={() => setPaginaActiva('home')} onNavegar={handleNavegar} />
            : clienteActivo === 'digitalife'
              ? <SellInClienteV2 clienteKey={clienteActivo} />
              : clienteActivo === 'dicotech'
                ? <SellInDicotech clienteKey={clienteActivo} />
                : clienteActivo === 'pcel'
                  ? <SellInPcel clienteKey={clienteActivo} />
                  : <SellInCliente clienteKey={clienteActivo} />
        )}
        {paginaActiva === "cartera" && (
          mobile
            ? <MobileCartera clienteKey={clienteActivo} onBack={() => setPaginaActiva('home')} onNavegar={handleNavegar} />
            : (clienteActivo === 'digitalife' || clienteActivo === 'dicotech' || clienteActivo === 'pcel')
              ? <CreditoCobranzaV2 cliente={c?.nombre || clienteActivo} clienteKey={clienteActivo} />
              : <CreditoCobranza cliente={c} clienteKey={clienteActivo} />
        )}
        {paginaActiva === "pagos"   && <PagosCliente cliente={c} clienteKey={clienteActivo} />}
          {paginaActiva === "analisis" && React.createElement(AnalisisCliente, { cliente: clientesDinamicos[clienteActivo] ? clientesDinamicos[clienteActivo].nombre : clienteActivo, clienteKey: clienteActivo })}
            {paginaActiva === "estrategia" && (
              mobile
                ? <MobileSellOut clienteKey={clienteActivo} onBack={() => setPaginaActiva('home')} onNavegar={handleNavegar} />
                : clienteActivo === 'digitalife'
                  ? <SellOutClienteV2 clienteKey={clienteActivo} />
                  : clienteActivo === 'dicotech'
                    ? <SellOutDicotech clienteKey={clienteActivo} />
                    : clienteActivo === 'pcel'
                      ? <SellOutPcel clienteKey={clienteActivo} />
                      : <EstrategiaProducto cliente={c.nombre} clienteKey={clienteActivo} />
            )}
        {paginaActiva === "marketing" && (
          mobile
            ? <MobileMarketing clienteKey={clienteActivo} onBack={() => setPaginaActiva('home')} onNavegar={handleNavegar} />
            : React.createElement(
                // V3 (2026-09-10): MarketingCliente rediseñado con el kit es la única versión;
                // MarketingClienteV2 queda como respaldo hasta que Fernando valide en producción.
                MarketingCliente,
                { cliente: clienteActivo, clienteKey: clienteActivo }
              )
        )}
                    {paginaActiva === "forecast" && React.createElement(ForecastCliente, { cliente: c.nombre, clienteKey: clienteActivo })}
          </>
        )}
            {paginaActiva === "actualizacion" && puedeActualizar && <ActualizacionDatos perfil={perfil} />}
            {paginaActiva === "actualizacion" && !puedeActualizar && <SinAcceso motivo="Solo el Super Admin puede actualizar datos." />}
</>
          </>
            </>
          )}
          </Suspense>
          </PageTransition>
          <ToastHost />
        </div>
  );


  return (
    <PerfilContext.Provider value={perfil}>
    <ThemeProvider perfil={perfil}>
    <div className="font-sans" style={{
      background: 'var(--t-bg, #F5F5F7)',
      display: 'block',
      height: '100vh',
    }}>

      {/* MÓVIL · app V3 desde cero (src/movil) · Inicio · Clientes · Alertas · Buscar · Más */}
      {mobile ? (
        <Suspense fallback={<Cargando fullscreen label="Cargando…" />}>
          <MovilApp perfil={perfil} onCerrarSesion={handleLogout} />
          <ToastHost />
        </Suspense>
      ) : (
        <NavShell
          clienteActivo={clienteActivo}
          paginaActiva={paginaActiva}
          vistaActual={vistaActual}
          onNavegar={handleNavegar}
          onCerrarSesion={handleLogout}
          perfilUsuario={perfil}
          modoPresent={modoPresent}
          onToggleModoPresent={() => setModoPresent(v => !v)}
        >
          {contenido}
        </NavShell>
      )}

      {showUpload && React.createElement(UploadModalX, { onClose: function() { setShowUpload(false); } })}

      <Toaster />
      <OfflineBadge />
    </div>
    </ThemeProvider>
    </PerfilContext.Provider>
  );
}
