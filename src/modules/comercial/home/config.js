// Home V3 ("Resumen") · configuración por cliente.
// Qué bloques se muestran, en qué orden y de qué fuentes sale cada dato.
// Las fuentes se resuelven en useHomeData.js; los cálculos en calc.js.

export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const Q_MESES = { Q1: [1, 2, 3], Q2: [4, 5, 6], Q3: [7, 8, 9], Q4: [10, 11, 12], anio: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] };
export const qDe = (m) => (m <= 3 ? 'Q1' : m <= 6 ? 'Q2' : m <= 9 ? 'Q3' : 'Q4');
export const META_INV_DIAS = 45; // meta de días de inventario del cliente (misma que los Home V2)

// Sucursales Dicotech · etiqueta display y tipo (física / virtual)
const SUCURSALES_DICOTECH = {
  dicoags2: { label: 'Aguascalientes', tipo: 'fisica' }, leon2: { label: 'León', tipo: 'fisica' },
  Arboledas: { label: 'Arboledas', tipo: 'fisica' }, GDL: { label: 'Guadalajara', tipo: 'fisica' },
  ZACATECAS: { label: 'Zacatecas', tipo: 'fisica' }, santafe: { label: 'Santa Fe', tipo: 'fisica' },
  DC: { label: 'DC', tipo: 'fisica' }, AMAZON: { label: 'Amazon', tipo: 'virtual' },
  Internet: { label: 'Internet', tipo: 'virtual' }, dropship: { label: 'Dropship', tipo: 'virtual' },
};

// Orden estándar de bloques (Panel) debajo de los 4 KpiCard. El secundario va plegado.
const BLOQUES_BASE = ['siso', 'split', 'top_skus', 'inventario', 'cobranza', 'pendientes', 'marketing'];
const SECUNDARIO_BASE = ['proyeccion', 'sugerido'];

export const HOME_CONFIG = {
  digitalife: {
    nombre: 'Digitalife',
    // Sell-out: v_sellout_detalle_sku_mes (2 años, por sku/marca/mes) + sellout_detalle 90 días (piezas diarias → días de inventario)
    sellOut: 'detalle',
    diasInventario: 'diario90',
    inventario: 'inventario_cliente',   // última semana cargada
    marcaSellIn: 'productos_cliente',   // sku → marca para el split de sell-in
    split: 'marca',
    sugeridoMinimo: 11,                 // regla HomeCliente: si stock < rotación mensual, sugerir al menos 11 pzs
    bloques: BLOQUES_BASE, secundario: SECUNDARIO_BASE,
  },
  dicotech: {
    nombre: 'Dicotech',
    // Sell-out: v_sellout_dicotech_mensual (2 años) + v_sellout_dicotech_sucursal_mes (año) + sellout_sku (top SKUs)
    sellOut: 'dicotech',
    diasInventario: 'mensual3',
    inventario: 'inventario_cliente',
    marcaSellIn: 'productos_cliente',
    split: 'sucursal', sucursalMeta: SUCURSALES_DICOTECH, // SI proporcional al peso de cada sucursal en el SO
    sugeridoMinimo: 11,
    bloques: BLOQUES_BASE, secundario: SECUNDARIO_BASE,
  },
  pcel: {
    nombre: 'PCEL',
    // Sell-out: v_sellout_pcel_mensual (2 años) + v_sellout_pcel_marca_mes (2 años) + sellout_pcel_mensual (top SKUs, sólo piezas)
    sellOut: 'pcel',
    diasInventario: 'mensual3',
    inventario: 'sellout_pcel',         // snapshot de la última semana (inventario, costo_promedio, antiguedad, transito)
    marcaSellIn: 'roadmap_sku',
    split: 'marca',
    bloques: BLOQUES_BASE, secundario: SECUNDARIO_BASE,
  },
};

// Cliente sin config propia (hoy no ocurre: sólo existen los 3 de permisos.CLIENTES) → misma receta que Digitalife.
export function configDe(clienteKey, cliente) {
  const base = HOME_CONFIG[clienteKey] || { ...HOME_CONFIG.digitalife, nombre: cliente?.nombre || clienteKey };
  return { ...base, nombre: cliente?.nombre || base.nombre, color: cliente?.color };
}
