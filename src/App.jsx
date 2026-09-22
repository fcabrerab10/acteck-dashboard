import React, { useState, useEffect, lazy, Suspense } from "react";
import { supabase, DB_CONFIGURED } from './lib/supabase';
import { apiFetch } from './lib/apiFetch';
import { DIGITALIFE_REAL, PCEL_REAL, CARTERA_DIGITALIFE, ULTIMO_MES_SI, NOMBRES_MES, ML_SELLOUT_DEFAULT, clientes } from './lib/constants';
import { formatMXN, formatUSD, formatFecha, diasRestantes, calcularSalud, loadSheetJS } from './lib/utils';
import { useTelemetry, telemetria } from './lib/telemetry';
import OfflineBadge from './components/OfflineBadge'; // directo: el barrel './components' arrastra Sidebar y las 8 tarjetas legacy
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
// Las pantallas viven ahora en src/components/PaginaContenido.jsx (mismo React.lazy por pantalla),
// para que las pueda montar también el modo Paneles del monitor panorámico.
// Auth y shell: estáticos (se necesitan antes de cualquier pantalla).
import LoginPage from './modules/auth/LoginPage';
const SetPasswordPage = lazy(() => import('./modules/auth/SetPasswordPage')); // sólo en #/set-password
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
import { Cargando, prefetchGraficas } from './components/kit';
import { precargarEnCola, siguientesPantallas } from './lib/prefetch';
import { useBreakpoint, isMobile, useMobileShell } from './lib/useBreakpoint';
// Responsive por dispositivo (2026-09-21): modo por ancho+táctil, preferencias por máquina
// (densidad, sidebar, ancho máximo, paneles) y el modo Paneles del monitor panorámico.
import { useDispositivo, usePrefsDispositivo, setPrefDispositivo, aplicarDensidad, panelesEfectivos } from './lib/dispositivo';
import PaginaContenido from './components/PaginaContenido';
const Paneles = lazy(() => import('./components/nav/Paneles'));
// MobileNav y MobileShell (legacy) ya no se montan: los sustituyó MovilApp (V3).
const MovilApp = lazy(() => import('./movil/MovilApp'));
import { ToastHost, toast as toastKit } from './components/kit';


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
  forecastReservas: { label: 'Proyectos y abasto', icon: Target },
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
  // Dispositivo + preferencias de esta máquina (localStorage, por modo).
  const disp = useDispositivo();
  const prefsDisp = usePrefsDispositivo();
  // Densidad → variables CSS que leen Panel / KpiCard / TablaCompacta del kit. 'comoda' = como siempre.
  useEffect(() => { aplicarDensidad(prefsDisp.densidad); }, [prefsDisp.densidad]);

  // ── Buzón de salida ──
  // Sincroniza al volver la señal / al foco / cada 60 s, refresca la cache al subir algo
  // y deja un toast persistente si un cambio se atora (la pastilla del chrome abre el detalle).
  // Buzón de salida (visitas sin señal). Import dinámico: el módulo entra en el primer
  // ralentí, no en el chunk de arranque. Arranca la sincronización (online · foco · 60 s),
  // refresca la cache al subir algo y deja un toast persistente si un cambio se atora.
  useEffect(() => {
    let limpiar = () => {};
    let vivo = true;
    import('./lib/buzon').then(({ arrancarBuzon, suscribir, configurarAviso }) => {
      if (!vivo) return;
      configurarAviso((m) => toastKit.info(m));
      const parar = arrancarBuzon({
        onSincronizado: async (n) => {
          // Tras sincronizar el buzón, refresca TODO React Query (agenda, proyectos, pagos, marketing usan sus propias llaves),
          // no sólo fetchAll/q: si no, la lista no muestra lo recién subido hasta recargar (visto en la prueba del 22-sep).
          const { queryClient } = await import('./lib/queryClient');
          await queryClient.invalidateQueries();
          toastKit.ok(n === 1 ? 'Se sincronizó 1 cambio guardado sin conexión' : `Se sincronizaron ${n} cambios guardados sin conexión`);
        },
      });
      let anterior = null;
      const off = suscribir((st) => {
        if (st.ultimoError && st.ultimoError !== anterior) {
          toastKit.error(st.pendientes === 1 ? '1 cambio no se pudo sincronizar' : `${st.pendientes} cambios no se pudieron sincronizar`, { ms: 0 });
        }
        anterior = st.ultimoError;
      });
      limpiar = () => { parar(); off(); };
    }).catch(() => {});
    return () => { vivo = false; limpiar(); };
  }, []);
  // Ancho máximo del contenido: 1600 de toda la vida; sólo el panorámico lo puede cambiar.
  const anchoMax = disp.modo === 'panoramico' ? (Number(prefsDisp.anchoMax) || 0) : 1600;

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
    const [pagosCliente, setPagosCliente] = useState(null); // cliente preelegido al abrir Pagos desde un cliente o una alerta
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

  // ── Prefetch de pantallas vecinas en idle (src/lib/prefetch.js) ──────
  // Sólo las 2-3 pantallas más probables desde la pestaña actual, de una en una,
  // en requestIdleCallback y nunca con "ahorro de datos" ni en 2G/3G.
  React.useEffect(() => {
    if (!authUser) return undefined;
    prefetchGraficas(); // recharts en el ralentí: la primera gráfica ya lo encuentra en memoria
    return precargarEnCola(siguientesPantallas({ pagina: paginaActiva, clienteActivo, movil: mobile }));
  }, [authUser, paginaActiva, clienteActivo, mobile]);

  const [modoPresent, setModoPresent] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [clienteKey, setClienteKey] = useState(null);

  // Los datos del cliente activo (ventas_mensuales) los pide ahora PaginaContenido,
  // para que cada panel del monitor panorámico tenga los suyos.

  // Al cambiar de cliente, volver al home
  const handleClienteChange = (key) => {
    setClienteActivo(key);
    setPaginaActiva("home");
  };

  // Sidebar navigation bridge
  // `extra` viaja a la pantalla destino como prop `inicial` (hoy sólo lo usa Agenda: abrir una
  // minuta concreta desde el Resumen del cliente → "Últimas minutas y acuerdos").
  const [paginaExtra, setPaginaExtra] = React.useState(null);
  const handleNavegar = (clienteId, paginaId, extra = null) => {
    setPaginaExtra(extra);
    if (paginaId === 'adminInterna') paginaId = 'agenda'; // página vieja "Pendientes & Calendario" → Agenda
    // Pagos ya no es pestaña de cliente: cualquier enlace "cliente › Pagos" abre la pestaña global con ese cliente elegido.
    if (paginaId === 'pagos') { setPagosCliente(clienteId || null); setVistaActual(null); setClienteActivo(null); setPaginaActiva('pagos'); return; }
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
    const on = (e) => { const d = e.detail || {}; if (d.pagina) handleNavegar(d.clienteKey || null, d.pagina, d.extra || null); };
    window.addEventListener('acteck:navegar', on);
    return () => window.removeEventListener('acteck:navegar', on);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Paneles (monitor panorámico) ──────────────────────────────────────
  // La primera columna es SIEMPRE la pestaña activa; las demás salen de las preferencias
  // de esta máquina y el ancho real limita cuántas caben (900 px por columna).
  const arbolNav = React.useMemo(() => { try { return construirArbol(perfil); } catch { return []; } }, [perfil]);
  const panelesActivos = React.useMemo(() => {
    if (disp.modo !== 'panoramico' || mobile) return { disposicion: 'uno', slots: [] };
    const { disposicion, slots } = panelesEfectivos(prefsDisp.paneles, { ancho: disp.ancho, alto: disp.alto });
    if (slots.length < 2) return { disposicion: 'uno', slots: [] };
    const cols = slots.slice();
    cols[0] = { pagina: vistaActual === 'configuracion' ? 'configuracion' : paginaActiva, clienteKey: clienteActivo };
    return { disposicion, slots: cols };
  }, [disp.modo, disp.ancho, disp.alto, mobile, prefsDisp.paneles, paginaActiva, clienteActivo, vistaActual]);

  const puedeActualizar = puedeActualizarDatos(perfil);
  const puedeVerConfig  = puedeConfigurar(perfil);
  const navItems = [
    { id: "home",       label: "Resumen",               icono: "°", habilitado: true  },
    { id: "analisis",   label: "An¡lisis",                icono: "°", habilitado: true  },
    { id: "sellIn",     label: "Sell In",                icono: "°", habilitado: true  },
    { id: "estrategia", label: "Sell Out",               icono: "°", habilitado: true  },
    { id: "marketing",  label: "Marketing",              icono: "°", habilitado: true  },
    { id: "cartera",    label: "Crdito y Cobranza",     icono: "°", habilitado: true  },
    ...(puedeActualizar ? [{ id: "actualizacion", label: "Actualizaci�n de datos", icono: "=", habilitado: true, admin: true }] : []),
  ]

  
  // Ruta /#/set-password → landing de invitación (aunque el usuario ya tenga
  // sesión de invite, o si no tiene perfil aún)
  const isSetPasswordRoute = typeof window !== 'undefined'
    && (window.location.hash || '').startsWith('#/set-password');
  if (isSetPasswordRoute) return <Suspense fallback={<Cargando fullscreen label="Cargando…" />}><SetPasswordPage /></Suspense>;

  if (authLoading) return <Cargando fullscreen label="Cargando…" sub="Iniciando el dashboard" />;
  if (!authUser || !perfil) return <LoginPage onLogin={handleLogin} />;

  // Contenido de la pantalla activa. TODO pasa por <PaginaContenido>: con una columna
  // (lo normal) y con 2-4 columnas en un monitor panorámico (modo Paneles).
  const paginaHoy = vistaActual === 'configuracion' ? 'configuracion' : paginaActiva;
  const paginaProps = {
    perfil,
    authUser,
    mobile,
    onNavegar: handleNavegar,
    onCerrarSesion: handleLogout,
    pagosCliente,
    extra: paginaExtra,
  };

  const contenido = panelesActivos.slots.length > 1 && !mobile ? (
    <>
    <Suspense fallback={<Cargando pantalla={paginaHoy} />}>
    <Paneles
      disposicion={panelesActivos.disposicion}
      slots={panelesActivos.slots}
      onCambiar={(next) => setPrefDispositivo(disp.modo, 'paneles', next)}
      paginaProps={paginaProps}
      arbol={arbolNav}
      anchoMax={anchoMax}
    />
    </Suspense>
    <ToastHost />
    </>
  ) : (
          <div className="w-full" style={{
            padding: mobile ? '12px 16px' : '4px 24px 16px',
            maxWidth: mobile ? '100%' : (anchoMax > 0 ? anchoMax : '100%'),
            margin: '0 auto',
          }}>
          <PageTransition keyId={vistaActual === 'configuracion' ? 'configuracion' : `${clienteActivo || 'g'}-${paginaActiva}`}>
          <Suspense fallback={<Cargando pantalla={paginaHoy} />}>
            <PaginaContenido {...paginaProps} pagina={paginaHoy} clienteKey={clienteActivo} />
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
