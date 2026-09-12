// prefetch.js · precarga en el ralentí de las pantallas que el usuario abrirá después.
//
// Con React.lazy cada pestaña baja su chunk al hacer clic (~100-300 ms de loader). Cuando
// el navegador está libre precargamos SÓLO las 2-3 pantallas más probables desde donde
// está el usuario, no el catálogo entero: bajar 16 chunks "por si acaso" competía con la
// pantalla que se estaba abriendo y quemaba datos del móvil.
//
// Reglas:
//   · nada si el usuario pidió "ahorro de datos" (navigator.connection.saveData)
//   · nada en 2G/3G (connection.effectiveType) — ahí cada KB se nota
//   · de uno en uno, en requestIdleCallback, tras un respiro de 1.2 s
// Rollup dedupe estos import() con los de lazy(): es el mismo módulo, no baja dos veces.

/** true si conviene NO precargar nada (ahorro de datos o red lenta). */
export function redLimitada() {
  if (typeof navigator === 'undefined') return true;
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!c) return false;
  if (c.saveData) return true;
  return ['slow-2g', '2g', '3g'].includes(c.effectiveType);
}

/** Recorre los cargadores de uno en uno en el ralentí. Devuelve una función de cancelación. */
export function precargarEnCola(cargadores, { retraso = 1200 } = {}) {
  if (!cargadores?.length || redLimitada()) return () => {};
  const ric = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
  const cic = window.cancelIdleCallback || clearTimeout;
  let cancelado = false;
  let handle = null;
  const paso = (i) => {
    if (cancelado || i >= cargadores.length) return;
    handle = ric(() => {
      if (cancelado) return;
      Promise.resolve(cargadores[i]()).catch(() => {}).finally(() => paso(i + 1));
    }, { timeout: 4000 });
  };
  const t = setTimeout(() => paso(0), retraso);
  return () => { cancelado = true; clearTimeout(t); if (handle != null) cic(handle); };
}

// ── Mapa de "a dónde va después" ────────────────────────────────────────────
// Sell In / Sell Out tienen una pantalla por cliente (V2 · Dicotech · PCEL).
const SELL_IN = {
  digitalife: () => import('../modules/comercial/SellInClienteV2'),
  dicotech:   () => import('../modules/comercial/SellInDicotech'),
  pcel:       () => import('../modules/comercial/SellInPcel'),
};
const SELL_OUT = {
  digitalife: () => import('../modules/comercial/SellOutClienteV2'),
  dicotech:   () => import('../modules/comercial/SellOutDicotech'),
  pcel:       () => import('../modules/comercial/SellOutPcel'),
};
const HOME_CLIENTE = () => import('../modules/comercial/HomeClienteV3');

const GLOBALES = {
  inicio:            [() => import('../modules/comercial/VisionGeneral'), () => import('../modules/agenda/Agenda')],
  agenda:            [() => import('../modules/general/Inicio'), () => import('../modules/comercial/VisionGeneral')],
  visionGeneral:     [() => import('../modules/comercial/AnalisisClientesGlobal'), () => import('../modules/comercial/SellInCliente')],
  analisisClientes:  [() => import('../modules/comercial/VisionGeneral'), HOME_CLIENTE],
  sellIn:            [() => import('../modules/comercial/SellOutGlobal'), () => import('../modules/comercial/VisionGeneral')],
  sellOut:           [() => import('../modules/comercial/SellInCliente'), () => import('../modules/comercial/VisionGeneral')],
  inventarioGlobal:  [() => import('../modules/comercial/TrackingPedidos'), () => import('../modules/comercial/ForecastClientesTab')],
  cobranzaGlobal:    [() => import('../modules/comercial/PagosCliente')],
  forecastClientes:  [() => import('../modules/comercial/PropuestasTab'), () => import('../modules/comercial/ForecastReservas')],
  resumenClientes:   [HOME_CLIENTE, () => import('../modules/comercial/AnalisisClientesGlobal')],
  propuestas:        [() => import('../modules/comercial/ForecastClientesTab')],
  estrategiaPrecios: [() => import('../modules/comercial/EstrategiaProducto')],
  ordenesCompra:     [() => import('../modules/comercial/InventarioGlobal')],
  estadoResultados:  [() => import('../modules/comercial/VisionGeneral')],
};

const DE_CLIENTE = (pagina, cliente) => {
  const si = SELL_IN[cliente] || SELL_IN.digitalife;
  const so = SELL_OUT[cliente] || SELL_OUT.digitalife;
  switch (pagina) {
    case 'home':       return [si, so];
    case 'sellIn':     return [so, HOME_CLIENTE];
    case 'estrategia': return [si, HOME_CLIENTE];
    case 'pagos':      return [() => import('../modules/comercial/CreditoCobranzaV2')];
    case 'cartera':    return [() => import('../modules/comercial/PagosCliente')];
    case 'marketing':  return [HOME_CLIENTE];
    default:           return [HOME_CLIENTE, si];
  }
};

/** Las 2-3 pantallas más probables desde donde está el usuario. */
export function siguientesPantallas({ pagina, clienteActivo, movil }) {
  if (movil) {
    // La app móvil (src/movil/MovilApp) trae su propio enrutado; aquí sólo se adelanta
    // la pantalla de cliente, que es a donde se entra desde Inicio.
    return [() => import('../movil/MovilApp')];
  }
  if (clienteActivo) return DE_CLIENTE(pagina, clienteActivo).slice(0, 3);
  return (GLOBALES[pagina] || GLOBALES.inicio).slice(0, 3);
}
