// Rutas de la app móvil · ÚNICO lugar que traduce un nodo del árbol web (src/components/nav/arbol.js) a una
// pantalla del celular. `destino({ pagina, clienteKey, label })` devuelve:
//   { tipo: 'tab',  tab }             → pestaña raíz con su propia pila (inicio · clientes · alertas · buscar)
//   { tipo: 'push', key, el }         → pantalla empujada sobre la pila de la pestaña activa
//   { tipo: 'proximamente', label }   → hoja "Próximamente · edita desde la computadora"
// `extra` (opcional) llega desde nav.navegar({ pagina, extra }) y lo reciben las páginas globales (p. ej. Agenda).
// Las pantallas empujadas son React.lazy: sólo se descarga la que se abre. (Archivo .js: sin JSX, createElement.)
import { createElement as h, lazy } from 'react';
import { CLIENTES_NAV } from '../components/nav/arbol';

const FichaCliente  = lazy(() => import('./pestanas/FichaCliente'));
const SellInCliente = lazy(() => import('./pestanas/SellInCliente'));
const FichaProducto = lazy(() => import('./FichaProducto'));
const Historial     = lazy(() => import('./pestanas/Historial'));
const Fuentes       = lazy(() => import('./pestanas/Fuentes'));
const VisionGeneral    = lazy(() => import('./pestanas/VisionGeneral'));
const AnalisisClientes = lazy(() => import('./pestanas/AnalisisClientes'));
const SellOutCliente   = lazy(() => import('./pestanas/SellOutCliente'));
const MarketingCliente = lazy(() => import('./pestanas/MarketingCliente'));
const CobranzaCliente  = lazy(() => import('./pestanas/CobranzaCliente'));
const ForecastCliente  = lazy(() => import('./pestanas/ForecastCliente'));
const SOP              = lazy(() => import('./pestanas/SOP'));
const Propuestas       = lazy(() => import('./pestanas/Propuestas'));
const Agenda           = lazy(() => import('./pestanas/agenda/Agenda'));
const SellInGlobal     = lazy(() => import('./pestanas/sellin/SellInGlobal'));
const SellOutGlobal    = lazy(() => import('./pestanas/selloutGlobal/SellOutGlobal'));
const Equipo           = lazy(() => import('./pestanas/equipo/Equipo'));
const Admin            = lazy(() => import('./pestanas/admin/Admin'));
const Tracking         = lazy(() => import('./pestanas/tracking/Tracking'));
const FichaOC          = lazy(() => import('./pestanas/tracking/FichaOC'));
const PagosMovil       = lazy(() => import('./pestanas/pagos/Pagos'));

/** Pestañas raíz del shell (cada una con pila push/pop propia). Ninguna aparece como nodo salvo `inicio`. */
export const TABS_RAIZ = ['inicio', 'clientes', 'alertas', 'buscar'];

const tab = (t) => ({ tipo: 'tab', tab: t });
const ficha = () => ({ tipo: 'push', key: 'ficha', el: h(FichaProducto) });

// Páginas globales (nodo.clienteKey == null) → pantalla móvil.
const GLOBALES = {
  // Pagos V3 · Hoy (por solicitar · autorizar · sin folio · vence), calendario y fondos.
  pagos:             () => ({ tipo: 'push', key: 'pagos', el: h(PagosMovil) }),
  inicio:            () => tab('inicio'),
  resumenClientes:   () => tab('clientes'),           // "Resumen de Clientes" = pestaña Clientes (propios · canales ERP)
  alertas:           () => tab('alertas'),            // no son nodos del árbol: los usan la barra superior y Buscar
  buscar:            () => tab('buscar'),
  inventarioGlobal:  ficha,                           // Inventario → Ficha de producto (canasta de SKUs)
  estrategiaPrecios: ficha,                           // Estrategia de precios → Ficha de producto (precio por lista)
  historialCambios:  () => ({ tipo: 'push', key: 'historial', el: h(Historial) }),
  telemetria:        () => ({ tipo: 'push', key: 'equipo', el: h(Equipo) }),   // Actividad del equipo (sólo super admin)
  actualizacion:     () => ({ tipo: 'push', key: 'fuentes', el: h(Fuentes) }), // Importador (sólo lectura)
  configuracion:     () => ({ tipo: 'push', key: 'admin', el: h(Admin) }),     // Administración (sólo super admin)
  visionGeneral:     () => ({ tipo: 'push', key: 'vision', el: h(VisionGeneral) }),
  sellIn:            () => ({ tipo: 'push', key: 'sellin-global', el: h(SellInGlobal) }), // Sell In consolidado (sin clienteKey)
  sellOut:           () => ({ tipo: 'push', key: 'sellout-global', el: h(SellOutGlobal) }), // Sell Out consolidado (sin clienteKey)
  analisisClientes:  () => ({ tipo: 'push', key: 'analisis', el: h(AnalisisClientes) }),
  forecastClientes:  () => ({ tipo: 'push', key: 'sop', el: h(SOP) }),
  propuestas:        () => ({ tipo: 'push', key: 'propuestas', el: h(Propuestas) }),
  // Tracking de pedidos (OCs de clientes). `extra.ocId` (alerta de tracking) abre la ficha de la OC.
  ordenesCompra:     (extra) => (extra?.ocId
    ? { tipo: 'push', key: `oc-${extra.ocId}`, el: h(FichaOC, { ocId: extra.ocId }) }
    : { tipo: 'push', key: 'tracking', el: h(Tracking) }),
  forecastReservas:  () => ({ tipo: 'push', key: 'forecast', el: h(ForecastCliente) }),
  // Agenda V3 (tareas, reuniones con minuta, semana, clientes). `extra` viene de una notificación: { itemId } abre el ítem
  // o su minuta; { vista } elige la pestaña inicial. adminInterna (página vieja) cae aquí también.
  agenda:            (extra) => ({ tipo: 'push', key: 'agenda', el: h(Agenda, { inicial: extra || null }) }),
  adminInterna:      (extra) => ({ tipo: 'push', key: 'agenda', el: h(Agenda, { inicial: extra || null }) }),
};

// Pestañas de cliente propio (nodo.clienteKey = digitalife | pcel | dicotech).
const CLIENTE = {
  home:   (ck) => ({ tipo: 'push', key: `cliente-${ck}`, el: h(FichaCliente, { clienteKey: ck }) }),
  pagos:  (ck) => ({ tipo: 'push', key: `pagos-${ck}`, el: h(PagosMovil, { clienteKey: ck }) }),
  sellIn: (ck) => ({ tipo: 'push', key: `sellin-${ck}`, el: h(SellInCliente, { clienteKey: ck, nombre: CLIENTES_NAV[ck]?.label }) }),
  estrategia: (ck) => ({ tipo: 'push', key: `sellout-${ck}`, el: h(SellOutCliente, { clienteKey: ck, nombre: CLIENTES_NAV[ck]?.label }) }),
  sellOut:    (ck) => ({ tipo: 'push', key: `sellout-${ck}`, el: h(SellOutCliente, { clienteKey: ck, nombre: CLIENTES_NAV[ck]?.label }) }),
  marketing:  (ck) => ({ tipo: 'push', key: `marketing-${ck}`, el: h(MarketingCliente, { clienteKey: ck, nombre: CLIENTES_NAV[ck]?.label }) }),
  cartera:    (ck) => ({ tipo: 'push', key: `cartera-${ck}`, el: h(CobranzaCliente, { clienteKey: ck, nombre: CLIENTES_NAV[ck]?.label }) }),
};

export function destino({ pagina, clienteKey, label, extra } = {}) {
  if (clienteKey) {
    const f = CLIENTE[pagina];
    if (f) return f(clienteKey);
    return { tipo: 'proximamente', label: `${CLIENTES_NAV[clienteKey]?.label || clienteKey} · ${label || pagina}` };
  }
  const f = GLOBALES[pagina];
  if (f) return f(extra);
  return { tipo: 'proximamente', label: label || pagina };
}

/** ¿El nodo ya tiene pantalla en el celular? (para atenuar/etiquetar en los menús). */
export const tieneVersionMovil = (nodo) => destino(nodo).tipo !== 'proximamente';
