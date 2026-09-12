// Inventario global · constantes y formateadores compartidos (V3).

// Mapping oficial (archivo "Almacenes 2026.xlsx")
export const NOMBRES_ALMACEN = {
  1: 'VENTAS GENERAL GUADALAJARA',
  2: 'VENTAS GENERAL COLOTLAN',
  3: 'VENTAS GENERAL MEXICO',
  4: 'NO COMERCIAL',
  5: 'REFACTURACION',
  6: 'VENTAS DECME MEXICO',
  9: 'VENTAS CONSIGNACION MERCADO LIBRE',
  10: 'ACTIVO FIJO',
  11: 'NO COMERCIAL',
  12: 'VENTAS REFACCIONES',
  13: 'NO COMERCIAL',
  14: 'VENTAS PAGINA WEB DROSHIPPING',
  15: 'STOCK ROTATION TEMPORAL',
  16: 'VENTAS RETAIL GUADALAJARA',
  17: 'VENTAS RETAIL MEXICO',
  19: 'VENTAS DECME GUADALAJARA',
  20: 'NO COMERCIAL',
  25: 'VENTAS APARTADO ECOMMERCE',
  30: 'NO COMERCIAL',
  41: 'NO COMERCIAL',
  42: 'NO COMERCIAL',
  43: 'NO COMERCIAL',
  44: 'VENTAS EMPAQUE DANADO GUADALAJARA',
  50: 'ALMACEN MUESTRAS',
  62: 'NO COMERCIAL',
  63: 'NO COMERCIAL',
  64: 'VENTAS EMPAQUE DANADO MEXICO',
  70: 'NO COMERCIAL',
  71: 'VENTAS APARTADO ECOMMERCE TULTITLAN',
  90: 'NO COMERCIAL',
  97: 'ALMACEN DE REMISIONES',
  98: 'NO COMERCIAL',
  99: 'NO COMERCIAL',
  100: 'NO COMERCIAL',
};

// Clasificación funcional para agrupar
export const TIPO_ALMACEN = {
  1: 'General', 2: 'General', 3: 'General',
  16: 'Retail', 17: 'Retail',
  6: 'DECME', 19: 'DECME',
  25: 'E-commerce', 71: 'E-commerce',
  9: 'Mercado Libre',
  14: 'Página web',
  12: 'Refacciones',
  44: 'Empaque dañado', 64: 'Empaque dañado',
  15: 'Stock rotation',
  50: 'Muestras',
  97: 'Remisiones',
  10: 'Activo fijo',
  5: 'Refacturación',
};
export const tipoDe = (n) => TIPO_ALMACEN[n] || 'No comercial';

// ⚠ 2026-09-12 · Este Set YA NO decide qué entra en el inventario comercial.
// La regla oficial es la medida [Inv Actual] del director y viene resuelta
// renglón a renglón en `v_inventario_almacen_medida.en_inv_actual`
// (almacén no exclusivo de Inventario · Rama PRODUCTO · CostoInventario ≠ 0).
// El Set se conserva sólo para etiquetas y para el grid SKU × almacén.
// Ver docs/MEDIDAS_DIRECTOR.md.
export const ALM_COMERCIALES = new Set([1, 2, 3, 6, 9, 12, 14, 15, 16, 17, 19, 25, 44, 64, 71]);
export const esComercial = (n) => ALM_COMERCIALES.has(Number(n));

export const CEDIS_CORTO = {
  'ALMACENES GUADALAJARA': 'Guadalajara',
  'ALMACENES MEXICO': 'México',
  'ALMACENES COLOTLAN': 'Colotlán',
};
export const CEDIS_LISTA = Object.keys(CEDIS_CORTO);

// Almacenes comerciales fijos para el grid SKU × almacén. Coinciden con
// almacenes_config (comercial=true). El grid muestra los 8 principales; el
// resto (12, 14, 15, 25, 44, 64, 71) queda dentro de "Otros" en el drill.
export const ALMACENES_GRID = [1, 3, 2, 6, 19, 9, 16, 17];

export const CEDIS_DE_ALMACEN = {
  1: 'Guadalajara', 3: 'México', 2: 'Colotlán', 6: 'México', 19: 'Guadalajara',
  9: 'Guadalajara', 16: 'Guadalajara', 17: 'México', 14: 'Guadalajara', 25: 'Guadalajara',
  44: 'Guadalajara', 64: 'México', 71: 'México', 12: 'Guadalajara', 15: 'Guadalajara',
};

const SHORT = { 1: 'GEN GDL', 3: 'GEN MEX', 2: 'GEN COL', 6: 'DECME MEX', 19: 'DECME GDL', 9: 'ML', 16: 'RETAIL GDL', 17: 'RETAIL MEX', 14: 'RETAIL 14', 25: 'PROPIO', 44: 'EMP DAÑ GDL', 64: 'EMP DAÑ MEX', 71: 'ECOM TULT', 12: 'REFACC', 15: 'STOCK ROT' };
export const shortAlmacen = (n) => SHORT[n] || `Alm ${n}`;

// Umbrales de cobertura POR SKU (días a ritmo de piezas ERP de 3 meses cerrados).
// Ojo: la cobertura por SKU es en PIEZAS (no hay costo de venta por SKU); la
// cifra del hero es [Dias de Inv] del director, en pesos a costo. Se muestran
// las dos con su etiqueta — no son la misma medida.
export const COBERTURA_CRITICA = 30;
export const COBERTURA_SOBRESTOCK = 90;

// ── Formateadores ──
export const N = (v) => Number(v) || 0;
export const fmtCompact = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(Number(n));
  const sign = Number(n) < 0 ? '-' : '';
  if (a >= 1e6) return sign + '$' + (a / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return sign + '$' + (a / 1e3).toFixed(0) + 'K';
  return sign + '$' + Math.round(a);
};
export const fmtMoney = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(Number(n));
  return (Number(n) < 0 ? '-' : '') + '$' + a.toLocaleString('es-MX', { maximumFractionDigits: 0 });
};
export const fmtInt = (n) => (n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('es-MX'));
export const fmtPct = (n) => (n == null || isNaN(n) ? '—' : n.toFixed(1) + '%');
export const fmtDias = (d) => (d == null || !isFinite(d) ? '—' : `${Math.round(d)} d`);

const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const fmtFechaCorta = (s) => {
  if (!s) return '—';
  const d = new Date(String(s).slice(0, 10) + 'T00:00:00');
  if (isNaN(d)) return String(s);
  return `${d.getDate()} ${MESES_CORTO[d.getMonth()]}`;
};
export const diasHasta = (s) => {
  if (!s) return null;
  const d = new Date(String(s).slice(0, 10) + 'T00:00:00');
  if (isNaN(d)) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  return Math.round((d - hoy) / 86400000);
};

// Tono de la pill de cobertura (misma regla en tabla, drill y hero)
export const tonoCobertura = (dias, stock) => {
  if (!stock) return 'red';
  if (dias == null || !isFinite(dias)) return 'gray';
  if (dias < COBERTURA_CRITICA) return 'red';
  if (dias > COBERTURA_SOBRESTOCK) return 'orange';
  return 'green';
};
export const etiquetaCobertura = (dias, stock) => {
  if (!stock) return 'Agotado';
  if (dias == null || !isFinite(dias)) return 'Sin demanda';
  if (dias < COBERTURA_CRITICA) return 'Crítica';
  if (dias > COBERTURA_SOBRESTOCK) return 'Sobre-stock';
  return 'Sana';
};

// ── Búsqueda por palabras (cualquier orden, sin acentos, sin mayúsculas) ──
// 'Inalámbrico' → 'inalambrico'. Se usa tanto para indexar la fila como para la consulta.
export const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
// 'mouse inalambrico negro' → ['mouse', 'inalambrico', 'negro'] (tokens vacíos fuera).
export const tokensBusqueda = (q) => normalizar(q).split(/\s+/).filter(Boolean);
// true si TODOS los tokens aparecen (en cualquier orden) dentro del texto ya normalizado.
export const coincideTokens = (textoNormalizado, tokens) => tokens.every((t) => textoNormalizado.includes(t));
export const MONO = '"SF Mono", ui-monospace, Menlo, monospace';
