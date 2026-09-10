// Rutas de la app móvil · ÚNICO lugar que traduce un nodo del árbol web (src/components/nav/arbol.js) a una
// pantalla del celular. `destino({ pagina, clienteKey, label })` devuelve:
//   { tipo: 'tab',  tab }             → pestaña raíz con su propia pila (inicio · clientes · alertas · buscar)
//   { tipo: 'push', key, el }         → pantalla empujada sobre la pila de la pestaña activa
//   { tipo: 'proximamente', label }   → hoja "Próximamente · edita desde la computadora"
// Las pantallas empujadas son React.lazy: sólo se descarga la que se abre. (Archivo .js: sin JSX, createElement.)
import { createElement as h, lazy } from 'react';
import { CLIENTES_NAV } from '../components/nav/arbol';

const FichaCliente  = lazy(() => import('./pestanas/FichaCliente'));
const SellInCliente = lazy(() => import('./pestanas/SellInCliente'));
const FichaProducto = lazy(() => import('./FichaProducto'));
const Historial     = lazy(() => import('./pestanas/Historial'));
const Fuentes       = lazy(() => import('./pestanas/Fuentes'));

/** Pestañas raíz del shell (cada una con pila push/pop propia). Ninguna aparece como nodo salvo `inicio`. */
export const TABS_RAIZ = ['inicio', 'clientes', 'alertas', 'buscar'];

const tab = (t) => ({ tipo: 'tab', tab: t });
const ficha = () => ({ tipo: 'push', key: 'ficha', el: h(FichaProducto) });

// Páginas globales (nodo.clienteKey == null) → pantalla móvil.
const GLOBALES = {
  inicio:            () => tab('inicio'),
  resumenClientes:   () => tab('clientes'),           // "Resumen de Clientes" = pestaña Clientes (propios · canales ERP)
  alertas:           () => tab('alertas'),            // no son nodos del árbol: los usan la barra superior y Buscar
  buscar:            () => tab('buscar'),
  inventarioGlobal:  ficha,                           // Inventario → Ficha de producto (canasta de SKUs)
  estrategiaPrecios: ficha,                           // Estrategia de precios → Ficha de producto (precio por lista)
  historialCambios:  () => ({ tipo: 'push', key: 'historial', el: h(Historial) }),
  actualizacion:     () => ({ tipo: 'push', key: 'fuentes', el: h(Fuentes) }), // Importador (sólo lectura)
};

// Pestañas de cliente propio (nodo.clienteKey = digitalife | pcel | dicotech).
const CLIENTE = {
  home:   (ck) => ({ tipo: 'push', key: `cliente-${ck}`, el: h(FichaCliente, { clienteKey: ck }) }),
  sellIn: (ck) => ({ tipo: 'push', key: `sellin-${ck}`, el: h(SellInCliente, { clienteKey: ck, nombre: CLIENTES_NAV[ck]?.label }) }),
};

export function destino({ pagina, clienteKey, label } = {}) {
  if (clienteKey) {
    const f = CLIENTE[pagina];
    if (f) return f(clienteKey);
    return { tipo: 'proximamente', label: `${CLIENTES_NAV[clienteKey]?.label || clienteKey} · ${label || pagina}` };
  }
  const f = GLOBALES[pagina];
  if (f) return f();
  return { tipo: 'proximamente', label: label || pagina };
}

/** ¿El nodo ya tiene pantalla en el celular? (para atenuar/etiquetar en los menús). */
export const tieneVersionMovil = (nodo) => destino(nodo).tipo !== 'proximamente';
