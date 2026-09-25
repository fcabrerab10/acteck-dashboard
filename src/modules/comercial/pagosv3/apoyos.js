// Apoyos por producto (2026-09-24 · diseño B elegido por Fernando). PURO, sin dependencias.
// Cuando un producto que ya le vendimos al cliente se alenta en su sell out, se le da un apoyo
// económico a ESE producto. El ERP lo bonifica en un solo documento (p. ej. BPRM-102 «Promoción
// general por lento desplazamiento»), sin detalle por producto. Aquí vive el detalle:
//   producto = { sku, descripcion, piezas (inventario apoyado/protegido), precio_factura,
//                apoyo_pz, inv_restante (inventario en el cliente al capturar) }
//   línea calculada: nuevo_costo = precio_factura − apoyo_pz · monto = piezas × apoyo_pz
// Regla: Σ monto de los productos debe cuadrar con el monto de la bonificación del ERP.
// Pruebas: node --test scripts/test-pagos-apoyos.mjs
const N = (v) => (v == null || v === '' ? 0 : Number(v) || 0);
const r2 = (n) => Math.round(n * 100) / 100;

export const TOLERANCIA_CUADRE = 1; // pesos

export function lineaApoyo(p) {
  const piezas = N(p.piezas), precio = N(p.precio_factura), apoyo = N(p.apoyo_pz);
  return { ...p, piezas, precio_factura: precio, apoyo_pz: apoyo, nuevo_costo: r2(Math.max(0, precio - apoyo)), monto: r2(piezas * apoyo), inv_restante: p.inv_restante == null ? null : N(p.inv_restante) };
}

/** calcularApoyo(productos, bonificacion?) → { lineas, total, piezas, cuadre } */
export function calcularApoyo(productos = [], bonificacion = null) {
  const lineas = (productos || []).filter((p) => p && p.sku).map(lineaApoyo);
  const total = r2(lineas.reduce((s, l) => s + l.monto, 0));
  const piezas = lineas.reduce((s, l) => s + l.piezas, 0);
  return { lineas, total, piezas, cuadre: cuadreCon(total, bonificacion) };
}

/** Estado del cuadre contra la bonificación del ERP. monto de la bonificación siempre en positivo. */
export function cuadreCon(total, bonificacion) {
  if (!bonificacion || !(Math.abs(N(bonificacion.monto)) > 0)) return { estado: 'sin_bonificacion', diferencia: null, label: 'sin bonificación', tone: 'orange' };
  const b = Math.abs(N(bonificacion.monto));
  const dif = r2(N(total) - b);
  if (Math.abs(dif) <= TOLERANCIA_CUADRE) return { estado: 'cuadra', diferencia: 0, label: 'cuadra con el ERP', tone: 'green' };
  return { estado: 'difiere', diferencia: dif, label: dif > 0 ? `sobran ${fmt(dif)}` : `faltan ${fmt(-dif)}`, tone: 'red' };
}
const fmt = (n) => '$' + Math.round(Math.abs(n)).toLocaleString('es-MX');

/** Concepto automático para la fila de Pagos. */
export function conceptoApoyo(productos = [], bonificacion = null) {
  const n = (productos || []).filter((p) => p?.sku).length;
  const base = bonificacion?.concepto ? capital(bonificacion.concepto) : 'Apoyo por producto';
  return `${base} · ${n === 1 ? (productos[0].sku) : `${n} productos`}`;
}
const capital = (s) => { const t = String(s || '').trim().toLowerCase(); return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''; };

/** Filas compatibles con TablaEvidencia (detalle.filas) para el drill viejo, el móvil y el Excel. */
export function filasEvidencia(lineas = []) {
  return lineas.map((l) => ({ concepto: `${l.sku} · ${l.piezas} pz × ${fmt(l.apoyo_pz)}`, base: l.piezas, monto: l.monto }));
}

/** detalle jsonb que se guarda en pagos.detalle. */
export function detalleApoyo(productos, bonificacion) {
  const c = calcularApoyo(productos, bonificacion);
  return {
    kind: 'apoyo_producto',
    productos: c.lineas,
    bonificacion: bonificacion ? { venta_id: bonificacion.venta_id ?? null, folio: bonificacion.folio ?? null, fecha: bonificacion.fecha ?? null, concepto_codigo: bonificacion.concepto_codigo ?? null, concepto: bonificacion.concepto ?? null, monto: Math.abs(N(bonificacion.monto)) } : null,
    total: c.total, piezas: c.piezas, cuadre: c.cuadre.estado,
    filas: filasEvidencia(c.lineas),
  };
}

/** Historial de apoyos de un SKU para un cliente a partir de los pagos cargados: [{ fecha, folio, piezas, apoyo_pz, monto, estado }]. */
export function historialSku(pagos = [], clienteKey, sku) {
  const out = [];
  for (const p of pagos || []) {
    if (p?.cliente !== clienteKey || p?.detalle?.kind !== 'apoyo_producto' || p.estado === 'cancelado') continue;
    for (const l of p.detalle.productos || []) if (l.sku === sku) out.push({ fecha: p.detalle.bonificacion?.fecha || p.periodo || String(p.created_at || '').slice(0, 10), folio: p.detalle.bonificacion?.folio || null, piezas: N(l.piezas), apoyo_pz: N(l.apoyo_pz), monto: N(l.monto), estado: p.estado, pago_id: p.id });
  }
  return out.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
}
