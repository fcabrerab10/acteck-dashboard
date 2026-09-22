// PaginaContenido · qué pantalla corresponde a (pagina, clienteKey).
//
// Esto era el bloque gigante de App.jsx. Se extrajo tal cual (mismas condiciones, mismos
// permisos, mismas props) para que lo pueda montar también `nav/Paneles.jsx` y así un
// monitor panorámico muestre 2, 3 o 4 pantallas a la vez. **El caso de una sola columna
// pasa por aquí igual**, así que no hay dos caminos que se puedan desincronizar.
//
//   <PaginaContenido pagina="sellIn" clienteKey="digitalife" perfil={perfil} onNavegar={…} />
//
// No monta Suspense ni PageTransition: eso lo pone quien lo usa (App o Paneles).
import React, { Suspense, lazy } from 'react';
import { HandCoins } from 'lucide-react';
import { supabase, DB_CONFIGURED } from '../lib/supabase';
import { DIGITALIFE_REAL, NOMBRES_MES, clientes } from '../lib/constants';
import SinAcceso from './SinAcceso';
import {
  puedeConfigurar,
  puedeActualizarDatos,
  puedeVerCliente,
  puedeVerPestanaCliente,
  puedeVerPestanaGlobal,
  puedeVerPaginaGlobal,
  puedeVerInicio,
} from '../lib/permisos';

// ── Pantallas: React.lazy (cada una su chunk; ver CLAUDE.md §Rendimiento) ──
const HomeClienteV3          = lazy(() => import('../modules/comercial/HomeClienteV3'));
const CreditoCobranza        = lazy(() => import('../modules/comercial/CreditoCobranza'));
const CreditoCobranzaV2      = lazy(() => import('../modules/comercial/CreditoCobranzaV2'));
const PagosUnificados        = lazy(() => import('../modules/comercial/PagosUnificados'));
const EstrategiaProducto     = lazy(() => import('../modules/comercial/EstrategiaProducto'));
const MarketingCliente       = lazy(() => import('../modules/comercial/MarketingCliente'));
const AnalisisCliente        = lazy(() => import('../modules/comercial/AnalisisCliente'));
const AnalisisClientesGlobal = lazy(() => import('../modules/comercial/AnalisisClientesGlobal'));
const SellOutGlobal          = lazy(() => import('../modules/comercial/SellOutGlobal'));
const InventarioGlobal       = lazy(() => import('../modules/comercial/InventarioGlobal'));
const EstrategiaPrecios      = lazy(() => import('../modules/comercial/EstrategiaPrecios'));
const ForecastCliente        = lazy(() => import('../modules/comercial/ForecastCliente'));
const ProyectosAbasto        = lazy(() => import('../modules/comercial/ProyectosAbasto'));
const SellInCliente          = lazy(() => import('../modules/comercial/SellInCliente'));
const SellInClienteV2        = lazy(() => import('../modules/comercial/SellInClienteV2'));
const SellInDicotech         = lazy(() => import('../modules/comercial/SellInDicotech'));
const SellInPcel             = lazy(() => import('../modules/comercial/SellInPcel'));
const TrackingPedidos        = lazy(() => import('../modules/comercial/TrackingPedidos'));
const SellOutClienteV2       = lazy(() => import('../modules/comercial/SellOutClienteV2'));
const SellOutDicotech        = lazy(() => import('../modules/comercial/SellOutDicotech'));
const SellOutPcel            = lazy(() => import('../modules/comercial/SellOutPcel'));
const EstadoResultados       = lazy(() => import('../modules/general/EstadoResultados'));
const Inicio                 = lazy(() => import('../modules/general/Inicio'));
const VisionGeneral          = lazy(() => import('../modules/comercial/VisionGeneral'));
const ReporteTab             = lazy(() => import('../modules/comercial/ReporteTab'));
const ResumenClientesTab     = lazy(() => import('../modules/comercial/ResumenClientesTab'));
const PropuestasTab          = lazy(() => import('../modules/comercial/PropuestasTab'));
const ForecastClientesTab    = lazy(() => import('../modules/comercial/ForecastClientesTab'));
const TelemetriaPanel        = lazy(() => import('../modules/interno/TelemetriaPanel'));
const HistorialCambios       = lazy(() => import('../modules/interno/HistorialCambios'));
const AxonMexico             = lazy(() => import('../modules/interno/AxonMexico'));
const Configuracion          = lazy(() => import('../modules/configuracion/Configuracion'));
const ActualizacionDatos     = lazy(() => import('../modules/settings/ActualizacionDatos'));
const Agenda                 = lazy(() => import('../modules/agenda/Agenda'));
const BandejaAlertas         = lazy(() => import('./BandejaAlertas'));
// Pantallas mobile (sólo se descargan en iPhone/iPad).
const MobileEquipo            = lazy(() => import('./MobileEquipo'));
const MobileYo                = lazy(() => import('./MobileYo'));
const MobileSellIn            = lazy(() => import('./MobileSellIn'));
const MobileSellOut           = lazy(() => import('./MobileSellOut'));
const MobileCartera           = lazy(() => import('./MobileCartera'));
const MobileMarketing         = lazy(() => import('./MobileMarketing'));
const MobileHome              = lazy(() => import('./MobileHome'));
const MobileHomeCliente       = lazy(() => import('./MobileHomeCliente'));
const MobileBuscar            = lazy(() => import('./MobileBuscar'));
const MobileEdR               = lazy(() => import('./MobileEdR'));
const MobileVisionGeneral     = lazy(() => import('./MobileVisionGeneral'));
const MobileAnalisisClientes  = lazy(() => import('./MobileAnalisisClientes'));
const MobileSellInGlobal      = lazy(() => import('./MobileSellInGlobal'));
const MobileSellOutGlobal     = lazy(() => import('./MobileSellOutGlobal'));
const MobileInventarioGlobal  = lazy(() => import('./MobileInventarioGlobal'));
const MobileCobranzaGlobal    = lazy(() => import('./MobileCobranzaGlobal'));
const MobileSOP               = lazy(() => import('./MobileSOP'));
const MobilePropuestas        = lazy(() => import('./MobilePropuestas'));
const MobileEstrategiaPrecios = lazy(() => import('./MobileEstrategiaPrecios'));
const MobileTrackingPedidos   = lazy(() => import('./MobileTrackingPedidos'));

function ResumenCuentas() {
  return React.createElement('div', { className: 'p-8' },
    React.createElement('h2', { className: 'text-2xl font-bold mb-4' }, 'Resumen General'),
    React.createElement('p', { className: 'text-gray-500' }, 'Vista de resumen en desarrollo...')
  );
}

// Datos del cliente activo (ventas_mensuales) · igual que antes, pero por instancia:
// así dos columnas con dos clientes distintos no se pisan.
function useClienteConVentas(clienteKey) {
  const [ventasDB, setVentasDB] = React.useState(null);
  const [ver, setVer] = React.useState(0);
  React.useEffect(() => {
    if (!DB_CONFIGURED || !clienteKey) return;
    supabase.from('ventas_mensuales').select('*')
      .eq('cliente', clienteKey).eq('anio', 2026).order('mes')
      .then(({ data }) => setVentasDB(data || []));
  }, [clienteKey, ver]);

  const c = React.useMemo(() => {
    const base = clientes[clienteKey];
    if (!base) return { kpis: {}, pagos: [], promociones: [], minuta: [], pendientes: [], nombre: '', ventas: {} };
    if (!ventasDB || ventasDB.length === 0) return base;
    const sellInMap = {};
    const sellOutMap = {};
    ventasDB.forEach((r) => { sellInMap[r.mes] = r.sell_in; sellOutMap[r.mes] = r.sell_out; });
    const ultimoMes = Math.max(...ventasDB.map((r) => r.mes));
    const lastRow = ventasDB.find((r) => r.mes === ultimoMes);
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
      },
    };
  }, [clienteKey, ventasDB]);

  return { c, recargar: () => setVer((v) => v + 1) };
}

export default function PaginaContenido({
  pagina,
  clienteKey = null,
  perfil,
  authUser = null,
  mobile = false,
  onNavegar = () => {},
  onCerrarSesion,
  pagosCliente = null,
  extra = null,
}) {
  const { c, recargar } = useClienteConVentas(clienteKey);
  const puedeActualizar = puedeActualizarDatos(perfil);
  const puedeVerConfig = puedeConfigurar(perfil);
  const clientesDinamicos = clientes;

  if (pagina === 'configuracion') {
    if (!puedeVerConfig) return <SinAcceso motivo="Solo el Super Admin puede ver Administración." />;
    return mobile
      ? <MobileYo perfil={perfil} onCerrarSesion={onCerrarSesion} onOpenConfig={() => {}} />
      : <Configuracion session={{ user: authUser, perfil }} />;
  }

  return (
    <>
      {pagina === 'inicio' && !clienteKey && (
        puedeVerInicio(perfil)
          ? (mobile
              ? <MobileHome perfil={perfil} onNavegar={onNavegar} />
              : <Inicio onNavegar={onNavegar} />)
          : <SinAcceso motivo="No tienes acceso a Inicio. Pídele a Fernando que te habilite Visión General o Resumen de Clientes." />
      )}
      {pagina === 'resumen' && (
        perfil?.es_super_admin
          ? <>
              <div style={{ marginBottom: 16 }}>
                <Suspense fallback={null}><BandejaAlertas clienteKey={null} onNavegar={onNavegar} /></Suspense>
              </div>
              <ResumenCuentas />
            </>
          : <SinAcceso motivo="No tienes acceso al Resumen general." />
      )}
      {pagina === 'buscar' && mobile && (
        <MobileBuscar perfil={perfil} onNavegar={onNavegar} />
      )}
      {pagina === 'reporte' && (
        perfil?.es_super_admin
          ? <ReporteTab />
          : <SinAcceso motivo="No tienes acceso al Reporte." />
      )}
      {pagina === 'resumenClientes' && (
        puedeVerPestanaGlobal(perfil, 'resumen_clientes')
          ? (mobile
              ? <MobileHome perfil={perfil} onNavegar={onNavegar} />
              : <ResumenClientesTab onDrillDown={(k) => onNavegar(k, 'home')} />)
          : <SinAcceso motivo="No tienes acceso al Resumen de Clientes." />
      )}
      {pagina === 'propuestas' && (
        puedeVerPestanaGlobal(perfil, 'propuestas')
          ? (mobile
              ? <MobilePropuestas onBack={() => onNavegar(null, 'resumenClientes')} onNavegar={onNavegar} />
              : <PropuestasTab />)
          : <SinAcceso motivo="No tienes acceso a Propuestas." />
      )}
      {pagina === 'estadoResultados' && (
        puedeVerPestanaGlobal(perfil, 'estado_resultados')
          ? (mobile
              ? <MobileEdR onBack={() => onNavegar(null, 'resumenClientes')} onNavegar={onNavegar} />
              : <EstadoResultados />)
          : <SinAcceso motivo="No tienes acceso a Estado de Resultados." />
      )}
      {pagina === 'visionGeneral' && (
        puedeVerPestanaGlobal(perfil, 'vision_general')
          ? (mobile
              ? <MobileVisionGeneral onBack={() => onNavegar(null, 'resumenClientes')} onNavegar={onNavegar} />
              : <VisionGeneral />)
          : <SinAcceso motivo="No tienes acceso a Visión General." />
      )}
      {pagina === 'analisisClientes' && (
        puedeVerPestanaGlobal(perfil, 'analisis_clientes')
          ? (mobile
              ? <MobileAnalisisClientes onBack={() => onNavegar(null, 'resumenClientes')} onNavegar={onNavegar} />
              : <AnalisisClientesGlobal />)
          : <SinAcceso motivo="No tienes acceso a Análisis por Cliente." />
      )}
      {!clienteKey && pagina === 'sellIn' && (
        puedeVerPestanaGlobal(perfil, 'sell_in')
          ? (mobile
              ? <MobileSellInGlobal onBack={() => onNavegar(null, 'resumenClientes')} onNavegar={onNavegar} />
              : <SellInCliente clienteKey={null} />)
          : <SinAcceso motivo="No tienes acceso a Sell In." />
      )}
      {pagina === 'sellOut' && (
        puedeVerPestanaGlobal(perfil, 'sell_out')
          ? (mobile
              ? <MobileSellOutGlobal onBack={() => onNavegar(null, 'resumenClientes')} onNavegar={onNavegar} />
              : <SellOutGlobal />)
          : <SinAcceso motivo="No tienes acceso a Sell Out." />
      )}
      {pagina === 'inventarioGlobal' && (
        puedeVerPestanaGlobal(perfil, 'inventario_global')
          ? (mobile
              ? <MobileInventarioGlobal onBack={() => onNavegar(null, 'resumenClientes')} onNavegar={onNavegar} />
              : <InventarioGlobal />)
          : <SinAcceso motivo="No tienes acceso a Inventario." />
      )}
      {pagina === 'pagos' && !clienteKey && <PagosUnificados clienteKey={pagosCliente} />}
      {pagina === 'cobranzaGlobal' && (
        puedeVerPestanaGlobal(perfil, 'cobranza_global')
          ? (mobile
              ? <MobileCobranzaGlobal onBack={() => onNavegar(null, 'resumenClientes')} onNavegar={onNavegar} />
              : (
                <div className="p-12 text-center">
                  <HandCoins className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h2 className="text-xl font-semibold text-gray-700 mb-2">Cobranza</h2>
                  <p className="text-gray-500">Próximamente — esta pestaña está en construcción.</p>
                </div>
              ))
          : <SinAcceso motivo="No tienes acceso a Cobranza." />
      )}
      {pagina === 'forecastClientes' && (
        puedeVerPestanaGlobal(perfil, 'forecast_clientes')
          ? (mobile
              ? <MobileSOP onBack={() => onNavegar(null, 'resumenClientes')} onNavegar={onNavegar} />
              : <ForecastClientesTab />)
          : <SinAcceso motivo="No tienes acceso a Forecast / S&OP." />
      )}
      {pagina === 'estrategiaPrecios' && (
        puedeVerPestanaGlobal(perfil, 'estrategia_precios')
          ? (mobile
              ? <MobileEstrategiaPrecios onBack={() => onNavegar(null, 'resumenClientes')} onNavegar={onNavegar} />
              : <EstrategiaPrecios />)
          : <SinAcceso motivo="No tienes acceso a Estrategia de Precios." />
      )}
      {pagina === 'forecastReservas' && (
        puedeVerPestanaGlobal(perfil, 'forecast_reservas')
          ? <ProyectosAbasto />
          : <SinAcceso motivo="No tienes acceso a Proyectos y abasto." />
      )}
      {pagina === 'ordenesCompra' && (
        puedeVerPestanaGlobal(perfil, 'ordenes_compra')
          ? (mobile
              ? <MobileTrackingPedidos onBack={() => onNavegar(null, 'resumenClientes')} onNavegar={onNavegar} />
              : <TrackingPedidos />)
          : <SinAcceso motivo="No tienes acceso a Tracking Pedidos." />
      )}
      {pagina === 'agenda' && (
        puedeVerPaginaGlobal(perfil, 'agenda')
          ? <Agenda onNavegar={onNavegar} inicial={extra} />
          : <SinAcceso motivo="No tienes acceso a la Agenda. Pídele a Fernando que te la habilite desde Administración." />
      )}
      {pagina === 'telemetria' && (
        perfil?.es_super_admin
          ? (mobile
              ? <MobileEquipo perfil={perfil} onNavegar={onNavegar} />
              : <TelemetriaPanel />)
          : <SinAcceso motivo="Sólo el super admin puede ver la actividad del equipo." />
      )}
      {pagina === 'historialCambios' && (
        puedeVerPestanaGlobal(perfil, 'historial_cambios')
          ? <HistorialCambios />
          : <SinAcceso motivo="No tienes acceso al Historial de cambios. Pídele a Fernando que te lo habilite desde Administración." />
      )}
      {pagina === 'axonMexico' && (
        puedeVerPestanaGlobal(perfil, 'axon_mexico')
          ? <AxonMexico />
          : <SinAcceso motivo="No tienes acceso a Axon de México." />
      )}

      {clienteKey && !puedeVerCliente(perfil, clienteKey) ? (
        <SinAcceso motivo={`No tienes acceso al cliente ${clienteKey}.`} />
      ) : clienteKey && ['home', 'analisis', 'sellIn', 'estrategia', 'marketing', 'pagos', 'cartera'].includes(pagina) && !puedeVerPestanaCliente(perfil, clienteKey, pagina) ? (
        // Gate granular por (cliente, pestaña). Bloquea URL directa a una pestaña oculta.
        <SinAcceso motivo={`No tienes acceso a esta pestaña de ${clienteKey}.`} />
      ) : (
        <>
          {pagina === 'home' && (
            mobile
              ? <MobileHomeCliente clienteKey={clienteKey} onBack={() => onNavegar(null, 'resumenClientes')} onNavegar={onNavegar} />
              : <>
                  <div style={{ marginBottom: 16 }}>
                    <Suspense fallback={null}><BandejaAlertas clienteKey={clienteKey} compacto onNavegar={onNavegar} /></Suspense>
                  </div>
                  <HomeClienteV3 cliente={c} clienteKey={clienteKey} onUploadComplete={recargar} onNavegar={onNavegar} />
                </>
          )}
          {clienteKey && pagina === 'sellIn' && (
            mobile
              ? <MobileSellIn clienteKey={clienteKey} onBack={() => onNavegar(clienteKey, 'home')} onNavegar={onNavegar} />
              : clienteKey === 'digitalife'
                ? <SellInClienteV2 clienteKey={clienteKey} />
                : clienteKey === 'dicotech'
                  ? <SellInDicotech clienteKey={clienteKey} />
                  : clienteKey === 'pcel'
                    ? <SellInPcel clienteKey={clienteKey} />
                    : <SellInCliente clienteKey={clienteKey} />
          )}
          {pagina === 'cartera' && (
            mobile
              ? <MobileCartera clienteKey={clienteKey} onBack={() => onNavegar(clienteKey, 'home')} onNavegar={onNavegar} />
              : (clienteKey === 'digitalife' || clienteKey === 'dicotech' || clienteKey === 'pcel')
                ? <CreditoCobranzaV2 cliente={c?.nombre || clienteKey} clienteKey={clienteKey} />
                : <CreditoCobranza cliente={c} clienteKey={clienteKey} />
          )}
          {pagina === 'analisis' && React.createElement(AnalisisCliente, { cliente: clientesDinamicos[clienteKey] ? clientesDinamicos[clienteKey].nombre : clienteKey, clienteKey })}
          {pagina === 'estrategia' && (
            mobile
              ? <MobileSellOut clienteKey={clienteKey} onBack={() => onNavegar(clienteKey, 'home')} onNavegar={onNavegar} />
              : clienteKey === 'digitalife'
                ? <SellOutClienteV2 clienteKey={clienteKey} />
                : clienteKey === 'dicotech'
                  ? <SellOutDicotech clienteKey={clienteKey} />
                  : clienteKey === 'pcel'
                    ? <SellOutPcel clienteKey={clienteKey} />
                    : <EstrategiaProducto cliente={c.nombre} clienteKey={clienteKey} />
          )}
          {pagina === 'marketing' && (
            mobile
              ? <MobileMarketing clienteKey={clienteKey} onBack={() => onNavegar(clienteKey, 'home')} onNavegar={onNavegar} />
              : React.createElement(MarketingCliente, { cliente: clienteKey, clienteKey })
          )}
          {pagina === 'forecast' && React.createElement(ForecastCliente, { cliente: c.nombre, clienteKey })}
        </>
      )}

      {pagina === 'actualizacion' && puedeActualizar && <ActualizacionDatos perfil={perfil} />}
      {pagina === 'actualizacion' && !puedeActualizar && <SinAcceso motivo="Solo el Super Admin puede actualizar datos." />}
    </>
  );
}
