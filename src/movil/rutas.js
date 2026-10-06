// Rutas de la app móvil · ÚNICO lugar que traduce un nodo del árbol web (src/components/nav/arbol.js) a una
// pantalla del celular. `destino({ pagina, clienteKey, label })` devuelve:
//   { tipo: 'tab',  tab, extra? }     → pestaña raíz con su propia pila (inicio · agenda · clientes · alertas · buscar)
//   { tipo: 'push', key, el }         → pantalla empujada sobre la pila de la pestaña activa
//   { tipo: 'proximamente', label }   → hoja "Próximamente · edita desde la computadora"
// `extra` (opcional) llega desde nav.navegar({ pagina, extra }) y lo reciben las páginas globales (p. ej. Agenda).
// Las pantallas empujadas son React.lazy: sólo se descarga la que se abre. (Archivo .js: sin JSX, createElement.)
import { createElement as h, lazy } from 'react';
import { CLIENTES_NAV } from '../components/nav/arbol';

const FichaCliente  = lazy(() => import('./pestanas/FichaCliente'));
const SellInCliente = lazy(() => import('./pestanas/SellInCliente'));
const Historial     = lazy(() => import('./pestanas/Historial'));
const Fuentes       = lazy(() => import('./pestanas/Fuentes'));
const VisionGeneral    = lazy(() => import('./pestanas/VisionGeneral'));
const AnalisisClientes = lazy(() => import('./pestanas/AnalisisClientes'));
const SellOutCliente   = lazy(() => import('./pestanas/SellOutCliente'));
const MarketingCliente = lazy(() => import('./pestanas/MarketingCliente'));
const CobranzaCliente  = lazy(() => import('./pestanas/CobranzaCliente'));
const SopM             = lazy(() => import('./pestanas/sop/SopM'));         // S&OP (3.83.0 · 2026-10-05)
const Propuestas       = lazy(() => import('./pestanas/Propuestas'));
const SellInGlobal     = lazy(() => import('./pestanas/sellin/SellInGlobal'));
const SellOutGlobal    = lazy(() => import('./pestanas/selloutGlobal/SellOutGlobal'));
const Equipo           = lazy(() => import('./pestanas/equipo/Equipo'));
const Admin            = lazy(() => import('./pestanas/admin/Admin'));
const TrackingM        = lazy(() => import('./pestanas/tracking/TrackingM'));   // 2026-10-05 · V2 compacta (consulta)
const CobranzaGlobalM  = lazy(() => import('./pestanas/cobranza/CobranzaGlobalM')); // 2026-10-04
const FichaOC          = lazy(() => import('./pestanas/tracking/FichaOC'));
const PagosMovil       = lazy(() => import('./pestanas/pagos/Pagos'));
const Proyectos        = lazy(() => import('./pestanas/Proyectos'));
const ForecastM        = lazy(() => import('./pestanas/forecast/ForecastM')); // Proyectos y forecast (3.83.0 · 2026-10-05)
const InventarioM      = lazy(() => import('./pestanas/inventario/InventarioM')); // 2026-10-05 · Inventario global
const EstrategiaPreciosM = lazy(() => import('./pestanas/precios/EstrategiaPreciosM')); // 2026-10-05 · calculadora de margen y propuesta

/** Pestañas raíz del shell (cada una con pila push/pop propia). Sólo `inicio` y `agenda` son nodos del árbol. */
export const TABS_RAIZ = ['inicio', 'agenda', 'clientes', 'alertas', 'buscar'];

const tab = (t, extra) => ({ tipo: 'tab', tab: t, extra: extra || null });

// Páginas globales (nodo.clienteKey == null) → pantalla móvil.
const GLOBALES = {
  // Pagos V3 · bandeja por acción (por solicitar · autorizar · sin folio · por registrar · vence · rechazados),
  // calendario, fondos e historial. `extra` viene de una alerta: { pagoId } abre ese pago · { fondoId } abre Fondos.
  pagos:             (extra) => ({ tipo: 'push', key: 'pagos', el: h(PagosMovil, { inicial: extra || null }) }),
  inicio:            () => tab('inicio'),
  resumenClientes:   () => tab('clientes'),           // "Resumen de Clientes" = pestaña Clientes (propios · canales ERP)
  alertas:           () => tab('alertas'),            // no son nodos del árbol: los usan la barra superior y Buscar
  buscar:            () => tab('buscar'),
  inventarioGlobal:  () => ({ tipo: 'push', key: 'inventario', el: h(InventarioM) }), // Inventario global (la Ficha de producto se abre desde la lista)
  // Estrategia de precios (3.82.0): calculadora de margen/descuento + propuesta real; `extra.sku` abre la calculadora con ese SKU.
  // La Ficha de producto («Compartir disponibilidad») se abre desde la calculadora.
  estrategiaPrecios: (extra) => ({ tipo: 'push', key: 'precios', el: h(EstrategiaPreciosM, { inicial: extra || null }) }),
  historialCambios:  () => ({ tipo: 'push', key: 'historial', el: h(Historial) }),
  telemetria:        () => ({ tipo: 'push', key: 'equipo', el: h(Equipo) }),   // Actividad del equipo (sólo super admin)
  actualizacion:     () => ({ tipo: 'push', key: 'fuentes', el: h(Fuentes) }), // Importador (sólo lectura)
  configuracion:     () => ({ tipo: 'push', key: 'admin', el: h(Admin) }),     // Administración (sólo super admin)
  visionGeneral:     () => ({ tipo: 'push', key: 'vision', el: h(VisionGeneral) }),
  sellIn:            () => ({ tipo: 'push', key: 'sellin-global', el: h(SellInGlobal) }), // Sell In consolidado (sin clienteKey)
  sellOut:           () => ({ tipo: 'push', key: 'sellout-global', el: h(SellOutGlobal) }), // Sell Out consolidado (sin clienteKey)
  analisisClientes:  () => ({ tipo: 'push', key: 'analisis', el: h(AnalisisClientes) }),
  cobranzaGlobal:    () => ({ tipo: 'push', key: 'cobranza-global', el: h(CobranzaGlobalM) }), // Cobranza general (2026-10-04)
  forecastClientes:  (extra) => ({ tipo: 'push', key: 'sop', el: h(SopM, { inicial: extra || null }) }),
  // `extra.skus` (+ `extra.clienteKey`) precarga una propuesta nueva con esos SKUs (desde «<Cuenta> frente al resto», 2026-10-05).
  propuestas:        (extra) => ({ tipo: 'push', key: 'propuestas', el: h(Propuestas, { inicial: extra || null }) }),
  // Tracking de pedidos (OCs de clientes). `extra.ocId` (alerta de tracking) abre la ficha de la OC.
  ordenesCompra:     (extra) => (extra?.ocId
    ? { tipo: 'push', key: `oc-${extra.ocId}`, el: h(FichaOC, { ocId: extra.ocId }) }
    : { tipo: 'push', key: 'tracking', el: h(TrackingM) }),
  // Proyectos y abasto (V3 · 2026-09-21): sustituye al Forecast de reservas en el celular.
  // 2026-10-05: la pestaña abre Proyectos y forecast (ForecastM); una alerta de arribo con proyectoId abre directo el proyecto.
  forecastReservas:  (extra) => (extra?.proyectoId
    ? { tipo: 'push', key: `proyectos-${extra.proyectoId}`, el: h(Proyectos, { inicial: extra }) }
    : { tipo: 'push', key: 'forecast', el: h(ForecastM, { inicial: extra || null }) }),
  // Agenda V4 · pestaña RAÍZ del shell (2026-09-22), con su propia pila: ya no se empuja sobre otra pestaña.
  // `extra` viene de una notificación: { itemId } abre el ítem o su minuta; { vista } elige la vista inicial;
  // MovilApp se lo pasa a la pantalla raíz. adminInterna (página vieja) cae aquí también.
  agenda:            (extra) => tab('agenda', extra),
  adminInterna:      (extra) => tab('agenda', extra),
};

// Pestañas de cliente propio (nodo.clienteKey = digitalife | pcel | dicotech).
const CLIENTE = {
  home:   (ck) => ({ tipo: 'push', key: `cliente-${ck}`, el: h(FichaCliente, { clienteKey: ck }) }),
  // Pagos ya no es pestaña de cliente (diseño B): el cliente sólo queda preelegido en la pantalla global.
  pagos:  (ck, extra) => ({ tipo: 'push', key: 'pagos', el: h(PagosMovil, { inicial: { ...(extra || {}), cliente: ck } }) }),
  sellIn: (ck) => ({ tipo: 'push', key: `sellin-${ck}`, el: h(SellInCliente, { clienteKey: ck, nombre: CLIENTES_NAV[ck]?.label }) }),
  estrategia: (ck) => ({ tipo: 'push', key: `sellout-${ck}`, el: h(SellOutCliente, { clienteKey: ck, nombre: CLIENTES_NAV[ck]?.label }) }),
  sellOut:    (ck) => ({ tipo: 'push', key: `sellout-${ck}`, el: h(SellOutCliente, { clienteKey: ck, nombre: CLIENTES_NAV[ck]?.label }) }),
  marketing:  (ck) => ({ tipo: 'push', key: `marketing-${ck}`, el: h(MarketingCliente, { clienteKey: ck, nombre: CLIENTES_NAV[ck]?.label }) }),
  cartera:    (ck) => ({ tipo: 'push', key: `cartera-${ck}`, el: h(CobranzaCliente, { clienteKey: ck, nombre: CLIENTES_NAV[ck]?.label }) }),
};

export function destino({ pagina, clienteKey, label, extra } = {}) {
  if (clienteKey) {
    const f = CLIENTE[pagina];
    if (f) return f(clienteKey, extra);
    return { tipo: 'proximamente', label: `${CLIENTES_NAV[clienteKey]?.label || clienteKey} · ${label || pagina}` };
  }
  const f = GLOBALES[pagina];
  if (f) return f(extra);
  return { tipo: 'proximamente', label: label || pagina };
}

/** ¿El nodo ya tiene pantalla en el celular? (para atenuar/etiquetar en los menús). */
export const tieneVersionMovil = (nodo) => destino(nodo).tipo !== 'proximamente';
