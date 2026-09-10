// cruce.js — cruce PURO de una reunión S&OP con el estado de hoy (sin React, sin Supabase).
//
//   · pedido (cantidad de la reunión) vs sugerido del motor HOY (rows de calcularForecast que ya tiene la pantalla)
//   · stock disponible y tránsito hoy (v_inventario_comercial, v_transito_sku — ya cargados por useForecastData)
//   · PO / arribo: POs del SKU en embarques_compras EMITIDAS a partir de la fecha de la reunión
//     (fecha_reunion del pie del correo; si no hay, el día 1 del mes de la reunión).
//
// Regla de cumplimiento de la reunión = Σ min(pedido, piezas con PO) / Σ pedido.
// Una línea "cumple" cuando lo que se colocó en PO (po_qty) cubre lo pedido; las piezas sobrantes de una PO
// no compensan a otro SKU (por eso el min por línea).

const CONCLUIDOS = /CONCLUIDO|ENTREGAD|RECIBID|CERRAD/i;
const CANCELADOS = /rechazada|perdida|cancelad/i;

export const fechaBaseReunion = (r) => r?.fecha_reunion || (r?.anio && r?.mes ? `${r.anio}-${String(r.mes).padStart(2, '0')}-01` : null);

/** Índices por SKU para cruzar rápido. */
export function indicesCruce({ rows = [], inventario = [], transito = [], embarques = [] } = {}) {
  const rowsBySku = Object.fromEntries(rows.map((r) => [r.sku, r]));
  const invBySku = Object.fromEntries(inventario.map((r) => [r.sku, r]));
  const traBySku = Object.fromEntries(transito.map((r) => [r.sku, r]));
  const embBySku = {};
  for (const e of embarques) { const k = String(e.codigo || '').toUpperCase(); if (!k) continue; (embBySku[k] ||= []).push(e); }
  return { rowsBySku, invBySku, traBySku, embBySku };
}

/** POs de un SKU emitidas desde `desde` (YYYY-MM-DD), agrupadas por PO. */
export function posDesde(embBySku, sku, desde) {
  const filas = (embBySku[String(sku || '').toUpperCase()] || []).filter((e) => e.fecha_emision && (!desde || e.fecha_emision >= desde) && !CANCELADOS.test(e.estatus || ''));
  const porPo = {};
  for (const e of filas) {
    const p = (porPo[e.po] ||= { po: e.po, qty: 0, shp: 0, llegado: 0, arribo: null, estatus: e.estatus || '', emision: e.fecha_emision, concluido: true });
    // po_qty se repite por embarque parcial del mismo código: la PO vale el máximo; los shp_qty se suman.
    p.qty = Math.max(p.qty, Number(e.po_qty || 0));
    p.shp += Number(e.shp_qty || 0);
    const llego = !!e.arribo_almacen || CONCLUIDOS.test(e.estatus || '');
    if (llego) p.llegado += Number(e.shp_qty || 0); else p.concluido = false;
    const arr = e.arribo_cedis || e.eta_puerto || null;
    if (!llego && arr && (!p.arribo || arr < p.arribo)) p.arribo = arr;
    if (!llego) p.estatus = e.estatus || p.estatus;
  }
  return Object.values(porPo).map((p) => ({ ...p, qty: p.qty || p.shp })).sort((a, b) => (a.emision < b.emision ? -1 : 1));
}

/** Cruza una línea. Devuelve la línea + campos de hoy. */
export function cruzarLinea(linea, idx, desde) {
  const sku = String(linea.sku || '').toUpperCase();
  const row = idx.rowsBySku[sku];
  const inv = idx.invBySku[sku];
  const tra = idx.traBySku[sku];
  const pos = posDesde(idx.embBySku, sku, desde);
  const poPz = pos.reduce((a, p) => a + p.qty, 0);
  const llegadoPz = pos.reduce((a, p) => a + p.llegado, 0);
  const pedido = Number(linea.cantidad || 0);
  const cubierto = Math.min(pedido, poPz);
  let estado = 'sin_po';
  if (pos.length) estado = pos.every((p) => p.concluido) ? 'llego' : llegadoPz > 0 ? 'parcial' : 'po';
  const abiertas = pos.filter((p) => !p.concluido);
  const proximoArribo = abiertas.map((p) => p.arribo).filter(Boolean).sort()[0] || null;
  return {
    ...linea, sku, pedido,
    sugeridoHoy: row ? Number(row.sugerido || 0) : null, enReporte: !!row,
    stock: inv ? Number(inv.disponible ?? inv.inventario ?? 0) : (row ? Number(row.inv || 0) : null),
    transito: tra ? Number(tra.cantidad || 0) : (row ? Number(row.traCant || 0) : null),
    pos, poPz, llegadoPz, cubierto, estado, proximoArribo, cumple: pedido > 0 ? cubierto / pedido : 0,
  };
}

/** Cruza todas las líneas de una reunión y calcula el cumplimiento. */
export function cruzarReunion(reunion, lineas, idx) {
  const desde = fechaBaseReunion(reunion);
  const cruzadas = lineas.map((l) => cruzarLinea(l, idx, desde));
  const pedido = cruzadas.reduce((a, l) => a + l.pedido, 0);
  const cubierto = cruzadas.reduce((a, l) => a + l.cubierto, 0);
  const conPo = cruzadas.filter((l) => l.pos.length).length;
  const llegadas = cruzadas.filter((l) => l.estado === 'llego').length;
  return { lineas: cruzadas, pedido, cubierto, conPo, llegadas, cumplimiento: pedido > 0 ? (cubierto / pedido) * 100 : 0 };
}

/** Sólo el % de cumplimiento (para la lista y los KPIs; misma regla). */
export function cumplimientoDe(reunion, lineas, idx) {
  return cruzarReunion(reunion, lineas, idx).cumplimiento;
}

export const tonoCumplimiento = (pct) => (pct == null ? 'gray' : pct >= 90 ? 'green' : pct >= 50 ? 'blue' : pct > 0 ? 'orange' : 'red');
