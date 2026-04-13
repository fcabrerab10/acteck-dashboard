import React, { useState, useEffect } from "react";
import { supabase, DB_CONFIGURED } from './lib/supabase';
import { DIGITALIFE_REAL, PCEL_REAL, CARTERA_DIGITALIFE, ULTIMO_MES_SI, NOMBRES_MES, ML_SELLOUT_DEFAULT, clientes } from './lib/constants';
import { formatMXN, formatUSD, formatFecha, diasRestantes, calcularSalud, loadSheetJS } from './lib/utils';
import { Semaforo, KPICard, CardHeader, TarjetaPendientes, TarjetaPagos, TarjetaPromociones, TarjetaMinuta, BarraCuota } from './components';
import { HomeCliente, CreditoCobranza, PagosCliente, EstrategiaProducto, MarketingCliente, AnalisisCliente, ForecastCliente } from './modules/comercial';

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


export default function App() {
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

  
    const [clienteActivo, setClienteActivo] = useState("digitalife");
  const [modoPresent, setModoPresent] = useState(false);
  const [paginaActiva, setPaginaActiva] = useState("home");
  const [showUpdatePanel, setShowUpdatePanel] = useState(false);

  // ─── DATOS DESDE SUPABASE (ventas_mensuales) ───
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

  const navItems = [
    { id: "home",       label: "Resumen",               icono: "🏠", habilitado: true  },
    { id: "analisis",   label: "Análisis",                icono: "📈", habilitado: true  },
    { id: "estrategia", label: "Estrategia de Producto", icono: "📦", habilitado: true  },
    { id: "marketing",  label: "Marketing",              icono: "📣", habilitado: clienteActivo !== "pcel"  },
    { id: "pagos",      label: "Pagos",                  icono: "💰", habilitado: true  },
    { id: "cartera",    label: "Crédito y Cobranza",     icono: "📊", habilitado: true  },
  ]

  return (
    <div className="flex h-screen bg-gray-50 font-sans">

      {/* SIDEBAR */}
      <aside className="w-52 bg-white border-r border-gray-100 flex flex-col shadow-sm shrink-0 overflow-y-auto">

        {/* Logo + Botón Modo Presentación */}
        <div className="p-3 border-b border-gray-100">
          {!modoPresent ? (
            <>
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Administración de Clientes</p>
              <div className="flex gap-2 mb-3">
                <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-semibold">Acteck</span>
                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-semibold">Balam Rush</span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              <p className="text-xs text-green-600 font-semibold uppercase tracking-widest">Modo Presentación</p>
            </div>
          )}
          <button
            onClick={() => setModoPresent(!modoPresent)}
            className={`w-full text-xs font-semibold px-3 py-2 rounded-xl transition-all flex items-center justify-center gap-2 ${
              modoPresent
                ? "bg-gray-800 text-white hover:bg-gray-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {modoPresent ? (
              <><span>🔒</span> Salir de Presentación</>
            ) : (
              <><span>👁️</span> Modo Presentación</>
            )}
          </button>
        </div>

        {/* Botón Resumen General */}
        <div className="px-4 py-2 border-b border-gray-100">
          <button
            onClick={() => setPaginaActiva("resumen")}
            className={"w-full text-left text-sm font-medium px-3 py-2.5 rounded-xl transition-all flex items-center gap-2 " + (paginaActiva === "resumen" ? "bg-gradient-to-r from-indigo-50 to-blue-50 text-indigo-700 shadow-sm border border-indigo-100" : "text-gray-500 hover:bg-gray-50 hover:text-gray-700")}
          >
            <span>{"📊"}</span>
            <span>Resumen General</span>
          </button>
        </div>

        {/* Botón Forecast */}
          <div className="px-4 py-2 border-b border-gray-100">
            <button
              onClick={() => setPaginaActiva("forecast")}
              className={"w-full text-left text-sm font-medium px-3 py-2.5 rounded-xl transition-all flex items-center gap-2 " + (paginaActiva === "forecast" ? "bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 shadow-sm border border-emerald-100" : "text-gray-500 hover:bg-gray-50 hover:text-gray-700")}
            >
              <span>{"🔮"}</span>
              <span>Forecast</span>
            </button>
          </div>

          {/* Selector de cliente — se oculta en modo presentación */}
        {!modoPresent && (
          <div className="p-4 border-b border-gray-100">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Cliente</p>
            <div className="space-y-1">
              {Object.entries(clientesDinamicos).map(([key, cl]) => (
                <button
                  key={key}
                  onClick={() => handleClienteChange(key)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    clienteActivo === key
                      ? "bg-gray-800 text-white"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cl.color }}></span>
                    {cl.nombre}
                    <span className="ml-auto text-xs opacity-60">{cl.marca}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* En modo presentación: mostrar solo el cliente activo */}
        {modoPresent && (
          <div className="p-4 border-b border-gray-100">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Cliente</p>
            <div className="px-3 py-2.5 rounded-xl bg-gray-800 text-white text-sm font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }}></span>
              {c.nombre}
              <span className="ml-auto text-xs opacity-60">{c.marca}</span>
            </div>
          </div>
        )}

        {/* Navegación */}
        <nav className="p-4 flex-1">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Secciones</p>
          <div className="space-y-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => item.habilitado && setPaginaActiva(item.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                  !item.habilitado
                    ? "text-gray-400 hover:bg-gray-50 hover:text-gray-600 cursor-not-allowed opacity-60"
                    : paginaActiva === item.id
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                }`}
                disabled={!item.habilitado}
                title={!item.habilitado ? "Próximamente" : ""}
              >
                <span>{item.icono}</span>
                {item.label}
                {!item.habilitado && (
                  <span className="ml-auto text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">Pronto</span>
                )}
              </button>
            ))}
          </div>
        </nav>

        <div className="p-4 border-t border-gray-100">
            <button
              onClick={() => setShowUpdatePanel(true)}
              className="w-full text-sm font-semibold px-3 py-3 rounded-xl transition-all bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              {"\uD83D\uDD04"} Actualizar Datos
            </button>
          </div>
          {/* Footer */}
        <div className="p-4 border-t border-gray-100">
          <p className="text-xs text-gray-300 text-center">v1.0 · Abril 2026</p>
        </div>
      </aside>

      {/* CONTENIDO */}
      <main className="flex-1 overflow-y-auto">
        {/* Banner modo presentación */}
        { /* Banner removed */ }
          {paginaActiva === "resumen" && <ResumenCuentas />}
          <>
            <>
        {paginaActiva === "home"    && <HomeCliente cliente={c} clienteKey={clienteActivo} onUploadComplete={() => setVentasVer(v => v+1)} isML={clienteActivo === "mercadolibre"} />}
        {paginaActiva === "cartera" && <CreditoCobranza cliente={c} />}
        {paginaActiva === "pagos"   && <PagosCliente cliente={c} clienteKey={clienteActivo} />}
          {paginaActiva === "analisis" && React.createElement(AnalisisCliente, { cliente: clientesDinamicos[clienteActivo] ? clientesDinamicos[clienteActivo].nombre : clienteActivo, clienteKey: clienteActivo })}
            {paginaActiva === "estrategia" && <EstrategiaProducto cliente={clienteActivo === "digitalife" ? "Digitalife" : "{c.nombre}"}  clienteKey={clienteActivo} />}
        {paginaActiva === "marketing" && React.createElement(MarketingCliente, { cliente: clienteActivo })}
                    {paginaActiva === "forecast" && React.createElement(ForecastCliente, { cliente: c.nombre, clienteKey: clienteActivo })}
</>
          </>
</main>
      {showUpdatePanel && React.createElement(PanelActualizacion, {
        onClose: function() { setShowUpdatePanel(false); },
        cliente: clientesDinamicos[clienteActivo] ? clientesDinamicos[clienteActivo].nombre : clienteActivo,
        clienteKey: clienteActivo,
        anio: 2026,
        onVentasUpdate: function() { setVentasVer(function(v) { return v + 1; }); }
      })}


    </div>
  );
}
