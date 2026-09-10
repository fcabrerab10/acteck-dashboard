// Siluetas de carga por pantalla (V3). Cada preset reproduce la disposición REAL de la
// pantalla (hero + sus KPIs + sus paneles) para que la carga muestre "la sombra de sus tarjetas"
// y no tarjetas genéricas. Tipos de fila: hero{stats} · kpis{n,cols} · panel{lineas,alto,chart}
// · tabla{filas,cols} · grid{cols,items} · fila{items,alto} (ver Skeleton.jsx).
// Las claves coinciden con `paginaActiva` de App.jsx; ALIAS traduce las páginas de cliente.

const hero = (stats = 3) => ({ tipo: 'hero', stats });
const kpis = (n = 4, cols) => ({ tipo: 'kpis', n, cols });
const panel = (lineas = 5, extra = {}) => ({ tipo: 'panel', lineas, ...extra });
const chart = (alto = 200, extra = {}) => ({ tipo: 'panel', chart: alto, ...extra });
const tabla = (filas = 10, cols = 6, extra = {}) => ({ tipo: 'tabla', filas, cols, ...extra });
const grid = (cols, items, extra = {}) => ({ tipo: 'grid', cols, items, ...extra });
const fila = (items = 3, alto = 30) => ({ tipo: 'fila', items, alto });

// Sell In / Sell Out de cliente comparten esqueleto: hero 3 stats · 4 KPIs · timeline + donut · tabla SKU
const sellCliente = [hero(3), kpis(4), grid('minmax(0,1.35fr) minmax(0,1fr)', [chart(240), panel(6)]), fila(4, 32), tabla(14, 8)];

export const SILUETAS = {
  default: [hero(3), kpis(4), panel(6)],

  inicio: [fila(2, 28), hero(3), kpis(4), chart(200), panel(5, { alto: 200 }), grid('repeat(3, minmax(0,1fr))', [panel(3), panel(3), panel(3)]), panel(5, { alto: 180 }), panel(5, { alto: 200 })],

  visionGeneral: [fila(3, 48), hero(4), grid('1fr 1fr', [panel(2, { alto: 76 }), panel(2, { alto: 76 })]), kpis(3), panel(6, { alto: 220 }), fila(2, 32), grid('minmax(0,1.05fr) minmax(0,1fr)', [chart(240), chart(240)]), kpis(3), grid('minmax(0,1.05fr) minmax(0,1fr)', [chart(220), chart(220)]), grid('1.2fr 1fr 1fr', [panel(6), tabla(6, 3), tabla(6, 3)])],

  sellIn: [...sellCliente.slice(0, 2), panel(6, { alto: 220 }), panel(5, { alto: 180 }), ...sellCliente.slice(2)],
  sellInGlobal: [hero(3), kpis(4), panel(5, { alto: 180 }), grid('1.5fr 1fr', [chart(200), panel(6)]), fila(4, 34), fila(6, 26), tabla(16, 10)],
  sellInDrill: [fila(3, 30), kpis(3), grid('minmax(0,1.4fr) minmax(0,1fr)', [tabla(6, 8), panel(6)]), tabla(3, 13, { alto: 110 })],
  sellOut: [hero(3), kpis(4), grid('minmax(0,1.35fr) minmax(0,1fr)', [chart(240), panel(6)]), panel(3, { alto: 160 }), tabla(14, 8)],
  sellOutDicotech: [hero(4), kpis(5), grid('minmax(0,1.35fr) minmax(0,1fr)', [chart(240), panel(6)]), grid('minmax(0,0.55fr) minmax(0,1.45fr)', [panel(5), tabla(8, 4)]), grid('1fr 1fr', [tabla(6, 3), tabla(6, 3)]), tabla(8, 8, { alto: 320 }), tabla(12, 8)],

  inventarioGlobal: [fila(3, 32), hero(3), kpis(4), fila(4, 46), tabla(16, 9), panel(1, { alto: 44 })],
  cobranza: [hero(3), kpis(4), grid('repeat(2, minmax(0,1fr))', [chart(150), panel(6)]), fila(3, 28), tabla(12, 7), panel(1, { alto: 44 })],
  cobranzaGlobal: [hero(3), kpis(4), tabla(10, 6)],
  pagos: [hero(3), kpis(4), fila(5, 32), fila(4, 26), tabla(10, 8), panel(1, { alto: 44 }), panel(1, { alto: 44 })],
  marketing: [hero(3), kpis(4), fila(6, 34), fila(8, 28), grid('minmax(0,0.9fr) minmax(0,1.4fr)', [panel(8, { alto: 320 }), [panel(7, { alto: 300 }), panel(1, { alto: 44 })]])],
  home: [hero(3), kpis(4), chart(280), tabla(6, 5, { alto: 240 }), tabla(6, 5, { alto: 220 }), panel(4, { alto: 180 }), panel(5, { alto: 200 }), panel(4, { alto: 220 }), panel(4, { alto: 180 }), panel(1, { alto: 44 })],
  analisis: [fila(2, 40), panel(4, { alto: 120 }), panel(9, { alto: 500 }), panel(8, { alto: 450 }), panel(6, { alto: 400 }), panel(5, { alto: 250 })],

  propuestas: [fila(2, 90), hero(0), fila(4, 34), fila(2, 24), grid('repeat(3, minmax(0,1fr))', [panel(4), panel(4), panel(4)])],
  forecastClientes: [hero(4), grid('minmax(0,1fr) 320px', [[fila(5, 48), panel(1, { alto: 44 }), tabla(18, 9)], [panel(8, { alto: 380 }), panel(4, { alto: 200 })]])],
  forecastReservas: [hero(4), fila(2, 34), grid('minmax(0,1fr) 320px', [[fila(3, 80), tabla(16, 10)], panel(10, { alto: 480 })])],
  estrategiaPrecios: [hero(4), fila(6, 32), fila(2, 20), tabla(18, 9)],
  analisisClientes: [fila(3, 30), hero(3), kpis(4), fila(4, 30), tabla(16, 13), grid('minmax(0,1fr) minmax(0,1.1fr)', [chart(300), tabla(10, 6)]), panel(1, { alto: 44 })],
  analisisDrill: [kpis(3), grid('minmax(0,1.4fr) minmax(0,1fr)', [chart(190), panel(6)]), tabla(6, 10)],
  resumenClientes: [fila(1, 90), grid('2fr 1fr 1fr', [hero(3), [kpis(1, '1fr'), kpis(1, '1fr')], [kpis(1, '1fr'), kpis(1, '1fr')]]), chart(300), grid('repeat(3, minmax(0,1fr))', [panel(8, { alto: 340 }), panel(8, { alto: 340 }), panel(8, { alto: 340 })])],
  ordenesCompra: [hero(4), panel(4, { alto: 220 }), grid('minmax(0,2fr) minmax(0,1fr)', [panel(5, { alto: 200 }), panel(5, { alto: 200 })]), panel(6, { alto: 220 }), tabla(12, 8)],
  adminInterna: [hero(0), fila(4, 40), grid('1fr 380px', [panel(12, { alto: 460 }), [panel(6, { alto: 220 }), panel(6, { alto: 220 })]]), panel(8, { alto: 350 })],
  historialCambios: [hero(3), panel(4, { alto: 120 }), tabla(14, 7)],
  actualizacion: [hero(4), tabla(6, 7, { alto: 300 }), tabla(9, 8, { alto: 400 }), fila(1, 28)],
  estadoResultados: [fila(3, 36), fila(1, 80), grid('repeat(4, minmax(0,1fr))', [kpis(1, '1fr'), kpis(1, '1fr'), kpis(1, '1fr'), kpis(1, '1fr')]), chart(220), fila(1, 70), tabla(20, 14), panel(6, { alto: 250 })],
  configuracion: [hero(3), fila(5, 34), grid('minmax(260px, 300px) 1fr', [[fila(1, 30), panel(3, { alto: 64 }), panel(3, { alto: 64 }), panel(3, { alto: 64 }), panel(3, { alto: 64 })], [panel(2, { alto: 64 }), panel(8, { alto: 280 }), panel(5, { alto: 200 })]])],
  telemetria: [hero(3), kpis(4), tabla(12, 6)],
  axonMexico: [hero(3), kpis(4), panel(6)],
  resumen: [panel(6, { alto: 200 }), kpis(4), tabla(10, 6)],
};

// Páginas de cliente (paginaActiva) y variantes → preset
export const ALIAS = {
  home: 'home', resumen: 'resumen', analisis: 'analisis', estrategia: 'sellOut', cartera: 'cobranza', pagos: 'pagos', marketing: 'marketing', forecast: 'forecastReservas',
  visionGeneral: 'visionGeneral', sellInGlobal: 'sellInGlobal',
};

export function resolverSilueta(pantalla) {
  if (!pantalla) return SILUETAS.default;
  return SILUETAS[pantalla] || SILUETAS[ALIAS[pantalla]] || SILUETAS.default;
}
