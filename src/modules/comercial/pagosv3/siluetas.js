// Siluetas de carga de Pagos V3 · locales para no tocar src/components/kit/siluetas.js
// (otro agente edita ese archivo en paralelo). Se usan con <Cargando silueta={SIL_PAGOS} />.
// Los mismos presets van propuestos como diff para siluetas.js en docs/PAGOS_V3.md.

const hero = (stats = 4) => ({ tipo: 'hero', stats });
const kpis = (n = 4, cols) => ({ tipo: 'kpis', n, cols });
const panel = (lineas = 5, extra = {}) => ({ tipo: 'panel', lineas, ...extra });
const tabla = (filas = 10, cols = 6, extra = {}) => ({ tipo: 'tabla', filas, cols, ...extra });
const grid = (cols, items, extra = {}) => ({ tipo: 'grid', cols, items, ...extra });
const fila = (items = 3, alto = 30) => ({ tipo: 'fila', items, alto });

// Pantalla unificada: hero (4 stats) · 4 KPIs · flujo de 5 etapas · calendario · tabla · cálculo · fondos · reglas
export const SIL_PAGOS = [
  hero(4), kpis(4),
  fila(5, 54),                       // Flujo del mes (5 etapas)
  panel(6, { alto: 300 }),           // Calendario
  fila(4, 28), fila(8, 24),          // filtros
  tabla(12, 8),
  grid('repeat(2, minmax(0,1fr))', [panel(6, { alto: 220 }), panel(6, { alto: 220 })]),  // cálculo
  panel(5, { alto: 170 }),           // fondos
  panel(1, { alto: 44 }), panel(1, { alto: 44 }),   // reglas + historial plegables
];

// Drill de un pago (hoja lateral / fila expandida)
export const SIL_PAGOS_DRILL = [fila(5, 44), panel(5, { alto: 160 }), panel(4, { alto: 130 }), fila(4, 30)];

// Móvil: lista "Hoy" + calendario + fondos
export const SIL_MOVIL_PAGOS = [fila(2, 26), kpis(2, 'repeat(2, minmax(0,1fr))'), panel(6, { alto: 240 }), panel(4, { alto: 160 })];

export default { SIL_PAGOS, SIL_PAGOS_DRILL, SIL_MOVIL_PAGOS };
