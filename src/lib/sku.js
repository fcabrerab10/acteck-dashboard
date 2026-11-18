// ¿Qué es un SKU de producto? (2026-11-18). Regla única para todo el dashboard y espejo de la función SQL
// `es_sku_producto()`: dos letras, guion y seis dígitos (AC-935777, BR-946353). Las refacciones, cajas y material
// del ERP (MVIS-001, RT-0102, ES-05001…) no cumplen la forma. Un SKU que SÍ está en el roadmap siempre cuenta
// como producto aunque su clave tenga otra forma. Universo consultable: vista `v_skus_producto`.
const FORMA = /^[A-Z]{2}-\d{6}$/;
export const esSkuProducto = (sku) => FORMA.test(String(sku || '').trim().toUpperCase());
