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

  inventarioGlobal: [fila(2, 32), hero(3), kpis(4), fila(3, 30), fila(6, 24), fila(8, 24), tabla(16, 11), panel(4, { alto: 200 }), grid('1fr 1fr', [chart(150), chart(150)]), panel(1, { alto: 44 })],
  inventarioDrill: [fila(5, 22), grid('minmax(0,1.2fr) minmax(0,1fr)', [tabla(8, 4, { alto: 220 }), panel(5, { alto: 220 })])],
  cobranza: [hero(3), kpis(4), grid('repeat(2, minmax(0,1fr))', [chart(150), panel(6)]), fila(3, 28), tabla(12, 7), panel(1, { alto: 44 })],
  cobranzaGlobal: [hero(3), kpis(4), tabla(10, 6)],
  pagos: [hero(3), kpis(4), fila(5, 32), fila(4, 26), tabla(10, 8), panel(1, { alto: 44 }), panel(1, { alto: 44 })],
  marketing: [hero(3), kpis(4), fila(6, 34), fila(8, 28), grid('minmax(0,0.9fr) minmax(0,1.4fr)', [panel(8, { alto: 320 }), [panel(7, { alto: 300 }), panel(1, { alto: 44 })]])],
  home: [hero(3), kpis(4), chart(280), tabla(6, 5, { alto: 240 }), tabla(6, 5, { alto: 220 }), panel(4, { alto: 180 }), panel(5, { alto: 200 }), panel(4, { alto: 220 }), panel(4, { alto: 180 }), panel(1, { alto: 44 })],
  analisis: [fila(2, 40), panel(4, { alto: 120 }), panel(9, { alto: 500 }), panel(8, { alto: 450 }), panel(6, { alto: 400 }), panel(5, { alto: 250 })],

  // Propuestas V3 (landing): hero 3 stats + fila de acciones · 3 tarjetas de cliente · 4 KPIs · segmented + buscador · paneles por mes con tarjetas en 3 columnas
  propuestas: [hero(3), grid('repeat(3, minmax(0,1fr))', [panel(5, { alto: 210 }), panel(5, { alto: 210 }), panel(5, { alto: 210 })]), kpis(4), fila(3, 30), grid('repeat(3, minmax(0,1fr))', [panel(4, { alto: 150 }), panel(4, { alto: 150 }), panel(4, { alto: 150 })])],
  // S&OP V3: hero 4 stats · 4 KPIs · panel buscador+filtros (3 filas de pills) · tabla · 2 paneles plegables (Últimas compras, Calendario)
  forecastClientes: [hero(4), kpis(4), panel(3, { alto: 112 }), tabla(18, 9), panel(1, { alto: 44 }), panel(1, { alto: 44 })],
  // S&OP · Reuniones: segmented · hero (última reunión, 3 stats) · 4 KPIs · tarjetas por mes (3 por fila) · "Exports anteriores" plegable
  sopReuniones: [fila(1, 30), hero(3), kpis(4), fila(1, 18), grid('repeat(3, minmax(0,1fr))', [panel(3, { alto: 84 }), panel(3, { alto: 84 }), panel(3, { alto: 84 })]), panel(1, { alto: 44 })],
  // Drill del SKU en S&OP: cabecera de pills · KPI strip · simulador · gráfica 12 m + cobertura proyectada · tabla clientes
  sopDrill: [fila(6, 22), kpis(6), fila(1, 70), grid('minmax(0,1.4fr) minmax(0,1fr)', [chart(170), panel(6, { alto: 190 })]), tabla(6, 10)],
  // Forecast › Reservas V3: hero 4 stats + fila de segmented · 4 KPIs · panel buscador+filtros · tabla a todo el ancho (la reserva vive en la hoja lateral)
  forecastReservas: [hero(4), kpis(4), panel(3, { alto: 130 }), tabla(18, 13)],
  // Drill del SKU en Reservas: cabecera de pills · heatmap 3 clientes × 12 meses + reservas anteriores · arribos por PO + stock/cobertura
  forecastDrill: [fila(6, 22), grid('minmax(0,1.35fr) minmax(0,1fr)', [[tabla(4, 14, { alto: 150 }), tabla(4, 7, { alto: 130 })], [tabla(4, 4, { alto: 130 }), tabla(3, 4, { alto: 110 })]])],
  // Forecast CRM (captura): 4 KPIs · panel de cliente/mes/tipo · tabla con 6 meses editables · "Lotes exportados" plegable
  forecastCaptura: [kpis(4), panel(1, { alto: 60 }), tabla(16, 13), panel(1, { alto: 44 })],
  // Estrategia de Precios V3: hero 3 stats · 4 KPIs · panel buscador+filtros (3 filas de pills) · tabla SKU × listas · panel Precio bajo plegable
  estrategiaPrecios: [hero(3), kpis(4), panel(3, { alto: 112 }), tabla(18, 9), panel(1, { alto: 44 })],
  // Drill del SKU en Precios: cabecera de pills · 4 KPIs · izquierda (listas, evolución por lista, evolución año, elasticidad) · derecha (compartir, simulador, clientes, precio bajo, competencia, plegables)
  preciosDrill: [fila(5, 22), kpis(4), grid('minmax(0,1.3fr) minmax(0,1fr)', [[panel(5, { alto: 150 }), chart(150), chart(130), tabla(3, 8, { alto: 120 })], [panel(2, { alto: 80 }), panel(3, { alto: 120 }), tabla(5, 6, { alto: 180 }), tabla(3, 7, { alto: 120 }), panel(1, { alto: 44 }), panel(1, { alto: 44 })]])],
  analisisClientes: [fila(3, 30), hero(3), kpis(4), fila(4, 30), tabla(16, 13), grid('minmax(0,1fr) minmax(0,1.1fr)', [chart(300), tabla(10, 6)]), panel(1, { alto: 44 })],
  analisisDrill: [kpis(3), grid('minmax(0,1.4fr) minmax(0,1fr)', [chart(190), panel(6)]), tabla(6, 10)],
  resumenClientes: [fila(2, 90), grid('minmax(0,2fr) minmax(0,1fr) minmax(0,1fr)', [hero(3), [kpis(1, '1fr'), kpis(1, '1fr')], [kpis(1, '1fr'), kpis(1, '1fr')]]), fila(4, 28), chart(240), grid('repeat(3, minmax(0,1fr))', [panel(10, { alto: 430 }), panel(10, { alto: 430 }), panel(10, { alto: 430 })])],
  ordenesCompra: [hero(3), grid('repeat(5, minmax(0,1fr))', [panel(2, { alto: 96 }), panel(2, { alto: 96 }), panel(2, { alto: 96 }), panel(2, { alto: 96 }), panel(2, { alto: 96 })]), kpis(4), fila(3, 30), fila(6, 24), tabla(12, 10), grid('minmax(0,1.2fr) minmax(0,1fr)', [tabla(6, 7, { alto: 220 }), tabla(6, 6, { alto: 220 })]), grid('minmax(0,1fr) minmax(0,1.2fr)', [tabla(3, 6, { alto: 150 }), tabla(4, 6, { alto: 150 })])],
  trackingDrill: [fila(5, 44), fila(1, 34), fila(3, 28), tabla(4, 8, { alto: 150 }), tabla(2, 8, { alto: 90 })],
  // Agenda V3 · A Bandeja: segmented · hero 3 stats · 4 KPIs · lista Hoy + (Semana, Equipo) · Reuniones (línea del tiempo)
  agenda: [fila(1, 30), hero(3), kpis(4), grid('minmax(0,1.35fr) minmax(300px,1fr)', [panel(12, { alto: 460 }), [panel(6, { alto: 240 }), panel(3, { alto: 140 })]]), panel(8, { alto: 360 })],
  // Agenda V3 · C Tablero: segmented · hero 2 stats · 4 KPIs · tablero 4 columnas · tira de reuniones · Semana + Equipo
  agendaTablero: [fila(1, 30), hero(2), kpis(4), panel(2, { alto: 60 }), grid('repeat(4, minmax(0,1fr))', [panel(6, { alto: 300 }), panel(5, { alto: 260 }), panel(5, { alto: 260 }), panel(3, { alto: 180 })]), fila(6, 90), grid('1fr 1fr', [panel(6, { alto: 240 }), panel(3, { alto: 140 })])],
  // Agenda V3 · Minuta (hoja lateral): pills · asistentes · editor de puntos · notas
  agendaMinuta: [fila(4, 26), fila(4, 30), panel(8, { alto: 300 }), panel(4, { alto: 140 })],
  // Móvil · Agenda A (hero 3 stats · segmented · lista), C tablero (segmented · una columna) y Minuta (título · hero · puntos · pie)
  movilAgenda: [hero(3), fila(1, 34), panel(6, { alto: 250 }), panel(4, { alto: 170 })],
  movilAgendaTablero: [fila(1, 34), panel(8, { alto: 420 }), fila(1, 16)],
  // Móvil · Sell In consolidado: hero (3 stats + barra + pills) · 4 KPIs en 2×2 · lista de canales · buscador · composición · Top 10
  movilSellInGlobal: [hero(3), kpis(4, 'repeat(2, minmax(0,1fr))'), panel(7, { alto: 320 }), fila(1, 38), panel(6, { alto: 240 }), panel(10, { alto: 420 })],
  movilMinuta: [fila(1, 44), hero(3), panel(3, { alto: 110 }), panel(6, { alto: 240 }), fila(1, 48)],
  adminInterna: [fila(1, 30), hero(3), kpis(4), grid('minmax(0,1.35fr) minmax(300px,1fr)', [panel(12, { alto: 460 }), [panel(6, { alto: 240 }), panel(3, { alto: 140 })]]), panel(8, { alto: 360 })],
  historialCambios: [hero(3), panel(4, { alto: 120 }), tabla(14, 7)],
  actualizacion: [hero(4), tabla(6, 7, { alto: 300 }), tabla(9, 8, { alto: 400 }), fila(1, 28)],
  estadoResultados: [hero(3), fila(4, 30), kpis(4), chart(220), tabla(10, 11), tabla(22, 19), panel(3, { alto: 90 })],
  configuracion: [hero(3), fila(5, 34), grid('minmax(260px, 300px) 1fr', [[fila(1, 30), panel(3, { alto: 64 }), panel(3, { alto: 64 }), panel(3, { alto: 64 }), panel(3, { alto: 64 })], [panel(2, { alto: 64 }), panel(8, { alto: 280 }), panel(5, { alto: 200 })]])],
  // Actividad del equipo V3: hero 4 stats · 4 KPIs · fila umbral · panel Internos con tarjetas de persona (3 por fila) · Externos plegable
  telemetria: [hero(4), kpis(4), fila(3, 30), panel(1, { alto: 40 }), grid('repeat(3, minmax(0,1fr))', [panel(6, { alto: 236 }), panel(6, { alto: 236 }), panel(6, { alto: 236 })]), panel(1, { alto: 44 })],
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
