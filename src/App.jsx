import React, { useState, useEffect } from "react";
import { supabase, DB_CONFIGURED } from './lib/supabase';
import { DIGITALIFE_REAL, PCEL_REAL, CARTERA_DIGITALIFE, ULTIMO_MES_SI, NOMBRES_MES, ML_SELLOUT_DEFAULT, clientes } from './lib/constants';
import { formatMXN, formatUSD, formatFecha, diasRestantes, calcularSalud, loadSheetJS } from './lib/utils';
import { Semaforo, KPICard, CardHeader, TarjetaPendientes, TarjetaPagos, TarjetaPromociones, TarjetaMinuta, BarraCuota, Sidebar } from './components';
import { CLIENTES as SIDEBAR_CLIENTES } from './components/Sidebar';
import { Toaster } from './lib/toast';
import {
  Home, TrendingUp, Package, Megaphone, Wallet, CreditCard,
  BarChart3, Target, ClipboardList, Settings as SettingsIcon, Building2,
} from 'lucide-react';
import { HomeCliente, CreditoCobranza, PagosCliente, EstrategiaProducto, MarketingCliente, AnalisisCliente, ForecastCliente } from './modules/comercial';
import ReporteTab from './modules/comercial/ReporteTab';
import ResumenClientesTab from './modules/comercial/ResumenClientesTab';
import ForecastClientesTab from './modules/comercial/ForecastClientesTab';
import OrdenesCompraTab from './modules/comercial/OrdenesCompraTab';
import LoginPage from './modules/auth/LoginPage';
import { Configuracion } from './modules/configuracion';
import ActualizacionDatos from './modules/settings/ActualizacionDatos';
import { AdministracionInterna } from './modules/interno';
import SinAcceso from './components/SinAcceso';
import {
  puedeConfigurar,
  puedeActualizarDatos,
  puedeVerCliente,
  puedeVerPestana,
  puedeVerPestanaCliente,
  puedeVerPestanaGlobal,
} from './lib/permisos';
import { PerfilContext } from './lib/perfilContext';


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
              React.createElement("p", { className: "text-sm font-semibold text-emerald-800" }, "Estrategia de Producto"),
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
  estrategia: { label: 'Estrategia de Producto', icon: Package },
  marketing:  { label: 'Marketing',              icon: Megaphone },
  pagos:      { label: 'Pagos',                  icon: Wallet },
  cartera:    { label: 'Crédito y Cobranza',     icon: CreditCard },
};
const GLOBAL_PAGES_INFO = {
  resumenClientes:  { label: 'Resumen de Clientes',    icon: BarChart3 },
  forecastClientes: { label: 'Forecast de Clientes',   icon: Target },
  ordenesCompra:    { label: 'Órdenes de Compra',      icon: Target },
  adminInterna:     { label: 'Administración Interna', icon: Building2 },
};
function Breadcrumb({ clienteActivo, paginaActiva, vistaActual }) {
  if (vistaActual === 'configuracion') {
    return (
      <div className="mb-4 flex items-center gap-2 text-sm">
        <SettingsIcon className="w-4 h-4 text-gray-500" />
        <span className="font-semibold text-gray-800">Configuración</span>
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
    fetch('/api/last-update').then(r => r.json()).then(setInfo).catch(() => setInfo({ error: true }));
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

  

  const [mlData, setMlData] = useState(null);
    const [mlLoading, setMlLoading] = useState(true);
    useEffect(() => {
      let cancelled = false;
      setMlLoading(true);
      fetch("/api/ml-sellout?year=2026")
        .then(r => r.json())
        .then(data => {
          if (!cancelled && data.sellOutPorMes) setMlData(data);
        })
        .catch(err => console.error("ML sellout fetch error:", err))
        .finally(() => { if (!cancelled) setMlLoading(false); });
      return () => { cancelled = true; };
    }, []);

  // Enrich ML client with live data
  const clientesDinamicos = { ...clientes };
  if (mlData) {
    const mesesArr = Object.keys(mlData.sellOutPorMes || {}).sort((a,b) => Number(a) - Number(b));
    const ultimoMes = mesesArr.length > 0 ? mesesArr[mesesArr.length - 1] : null;
    const sellOutUltimoMes = ultimoMes ? mlData.sellOutPorMes[ultimoMes] : 0;
    clientesDinamicos.mercadolibre = {
      ...clientes.mercadolibre,
      ejecutivo: "Fernando Cabrera",
      kpis: {
        ...clientes.mercadolibre.kpis,
        sellOut: sellOutUltimoMes,
        sellOutAcumulado: mlData.totalMonto || 0,
        ultimoMes: ultimoMes ? ["","Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"][Number(ultimoMes)] : "---",
      },
      tendencia: {
        ...clientes.mercadolibre.tendencia,
        sellOut: mesesArr.map(m => mlData.sellOutPorMes[m]),
      },
      sellOutMarca: mlData.sellOutPorMarca || {},
      sellOutPorMesMarca: mlData.sellOutPorMesMarca || {},
      totalOrdenes: mlData.totalOrdenes || 0,
      totalMonto: mlData.totalMonto || 0,
    };
  }

  
    // ── Navegación persistente (se guarda la pestaña al recargar) ──
    const GLOBAL_PAGES = React.useMemo(() => new Set(['resumen','reporte','resumenClientes','forecastClientes','ordenesCompra','adminInterna']), []);
    const [paginaActiva, setPaginaActiva] = useState(() => {
      try { return localStorage.getItem('nav_pagina') || 'home'; } catch { return 'home'; }
    });
    const [clienteActivo, setClienteActivo] = useState(() => {
      try {
        const pag = localStorage.getItem('nav_pagina') || 'home';
        const globals = new Set(['resumen','reporte','resumenClientes','forecastClientes','ordenesCompra','adminInterna']);
        if (globals.has(pag)) return null;
        return localStorage.getItem('nav_cliente') || 'digitalife';
      } catch { return 'digitalife'; }
    });
    const [vistaActual, setVistaActual] = useState(() => {
      try { return localStorage.getItem('nav_vista') || null; } catch { return null; }
    });
    React.useEffect(() => {
      try { localStorage.setItem('nav_pagina', paginaActiva); } catch {}
    }, [paginaActiva]);
    React.useEffect(() => {
      try {
        if (clienteActivo) localStorage.setItem('nav_cliente', clienteActivo);
        else localStorage.removeItem('nav_cliente');
      } catch {}
    }, [clienteActivo]);
    React.useEffect(() => {
      try {
        if (vistaActual) localStorage.setItem('nav_vista', vistaActual);
        else localStorage.removeItem('nav_vista');
      } catch {}
    }, [vistaActual]);

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

  const puedeActualizar = puedeActualizarDatos(perfil);
  const puedeVerConfig  = puedeConfigurar(perfil);
  const navItems = [
    { id: "home",       label: "Resumen",               icono: "°", habilitado: true  },
    { id: "analisis",   label: "An¡lisis",                icono: "°", habilitado: true  },
    { id: "estrategia", label: "Estrategia de Producto", icono: "°", habilitado: true  },
    { id: "marketing",  label: "Marketing",              icono: "°", habilitado: clienteActivo !== "pcel"  },
    { id: "pagos",      label: "Pagos",                  icono: "°°", habilitado: true  },
    { id: "cartera",    label: "Crdito y Cobranza",     icono: "°", habilitado: true  },
    ...(puedeActualizar ? [{ id: "actualizacion", label: "Actualizaci�n de datos", icono: "=", habilitado: true, admin: true }] : []),
  ]

  
  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-400">Cargando...</p></div>;
  if (!authUser || !perfil) return <LoginPage onLogin={handleLogin} />;


  return (
    <PerfilContext.Provider value={perfil}>
    <div className="flex h-screen bg-gray-50 font-sans">

      {/* SIDEBAR */}
      <Sidebar
        clienteActivo={clienteActivo}
        paginaActiva={vistaActual === 'configuracion' ? 'configuracion' : paginaActiva}
        onNavegar={handleNavegar}
        onCerrarSesion={handleLogout}
        perfilUsuario={perfil}
        modoPresent={false}
      />

      {/* CONTENIDO */}
      <main className="flex-1 overflow-y-auto">
          <div className="w-full px-6 py-4">
          <Breadcrumb clienteActivo={clienteActivo} paginaActiva={paginaActiva} vistaActual={vistaActual} />
          {vistaActual === "configuracion" ? (
            puedeVerConfig ? <Configuracion session={{user: authUser, perfil}} /> : <SinAcceso motivo="Solo el Super Admin puede ver Configuración." />
          ) : (
            <>
            {/* Banner modo presentaci³n */}
        { /* Banner removed */ }
          {paginaActiva === "resumen" && <ResumenCuentas />}
          {paginaActiva === "reporte" && <ReporteTab />}
          {paginaActiva === "resumenClientes" && (
            <ResumenClientesTab
              onDrillDown={(clienteKey) => { setClienteActivo(clienteKey); setPaginaActiva('home'); }}
            />
          )}
          {paginaActiva === "forecastClientes" && <ForecastClientesTab />}
          {paginaActiva === "ordenesCompra" && (
            puedeVerPestanaGlobal(perfil, "ordenes_compra")
              ? <OrdenesCompraTab />
              : <SinAcceso motivo="No tienes acceso a Órdenes de Compra." />
          )}
          {paginaActiva === "adminInterna" && (
            // Permiso granular: nivel 'ver' o 'edit' en permisos.globales.admin_interna
            puedeVerPestanaGlobal(perfil, "admin_interna")
              ? <AdministracionInterna />
              : <SinAcceso motivo="No tienes acceso a esta pestaña. Pídele a Fernando que te habilite 'Pendientes & Calendario' desde Configuración." />
          )}
          <>
            <>
        {clienteActivo && !puedeVerCliente(perfil, clienteActivo) ? (
          <SinAcceso motivo={`No tienes acceso al cliente ${clienteActivo}.`} />
        ) : clienteActivo && ['home','analisis','estrategia','marketing','pagos','cartera'].includes(paginaActiva) && !puedeVerPestanaCliente(perfil, clienteActivo, paginaActiva) ? (
          // Gate granular por (cliente, pestaña). Bloquea URL directa a una
          // pestaña oculta para este cliente específico.
          <SinAcceso motivo={`No tienes acceso a esta pestaña de ${clienteActivo}.`} />
        ) : (
          <>
        {paginaActiva === "home"    && <HomeCliente cliente={c} clienteKey={clienteActivo} onUploadComplete={() => setVentasVer(v => v+1)} isML={clienteActivo === "mercadolibre"} />}
        {paginaActiva === "cartera" && <CreditoCobranza cliente={c} clienteKey={clienteActivo} />}
        {paginaActiva === "pagos"   && <PagosCliente cliente={c} clienteKey={clienteActivo} />}
          {paginaActiva === "analisis" && React.createElement(AnalisisCliente, { cliente: clientesDinamicos[clienteActivo] ? clientesDinamicos[clienteActivo].nombre : clienteActivo, clienteKey: clienteActivo })}
            {paginaActiva === "estrategia" && <EstrategiaProducto cliente={clienteActivo === "digitalife" ? "Digitalife" : "{c.nombre}"}  clienteKey={clienteActivo} />}
        {paginaActiva === "marketing" && React.createElement(MarketingCliente, { cliente: clienteActivo })}
                    {paginaActiva === "forecast" && React.createElement(ForecastCliente, { cliente: c.nombre, clienteKey: clienteActivo })}
          </>
        )}
            {paginaActiva === "actualizacion" && puedeActualizar && <ActualizacionDatos perfil={perfil} />}
            {paginaActiva === "actualizacion" && !puedeActualizar && <SinAcceso motivo="Solo el Super Admin puede actualizar datos." />}
</>
          </>
            </>
          )}
        </div>
        </main>

      {showUpload && React.createElement(UploadModalX, { onClose: function() { setShowUpload(false); } })}

      <Toaster />
    </div>
    </PerfilContext.Provider>
  );
}
