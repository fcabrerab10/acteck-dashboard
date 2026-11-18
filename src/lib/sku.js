// ¿Qué es un SKU de producto? (2026-11-18). Regla única para todo el dashboard y espejo de la función SQL
// `es_sku_producto()`: dos letras, guion, cinco o seis dígitos y, opcional, UNA letra al final (AC-935777, ES-05001, ES-05001E).
// Las refacciones, cajas y material del ERP (MVIS-001, RT-0102, AC-936026_1, CA-ES-05001E…) no cumplen la forma. Un SKU que SÍ está en el roadmap siempre cuenta
// como producto aunque su clave tenga otra forma. Universo consultable: vista `v_skus_producto`
// (`activo` = roadmap, o fuera del roadmap con existencia o mercancía en camino: lo que leen Propuestas, S&OP,
// Proyectos y Estrategia de Precios).
const FORMA = /^[A-Z]{2}-\d{5,6}[A-Z]?$/;
export const esSkuProducto = (sku) => FORMA.test(String(sku || '').trim().toUpperCase());
