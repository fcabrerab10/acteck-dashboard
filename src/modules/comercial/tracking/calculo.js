// Tracking Pedidos V3 · cálculo puro (sin React, sin Supabase). Se prueba en Node: scripts/test-tracking-calculo.mjs
//
// Entrada (ver datos.js): tablas oc_* tal cual + ERP (facturas de v_erp_facturas_oc, tránsito, stock).
// Salida: OCs "calculadas" con etapa derivada, fill rate, backorder por SKU, envíos con desfase, timeline;
// y agregados de pantalla (embudo, KPIs, tiempos por cliente, backorder global, surtir hoy, facturas sin OC).
//
// Etapas derivadas: cotización (sólo si existe) → recibida (fecha capturada) → facturada (Σ piezas facturadas
// vs pedidas por SKU; parcial/total) → enviada (guía con fecha de envío, ERP o manual) → entregada (recepción
// ERP o manual en todos los envíos y fill ≥ 99.5 %). Lo manual gana sobre lo automático si difiere.
// Detenida: > DIAS_DETENIDA días en cotización, recibida o facturada (la recepción del cliente no cuenta).

import {
  ETAPAS, ETAPA_ORDEN, DIAS_DETENIDA, DESFASE_DIAS, META_ENTREGA, METAS_DIAS, VENTANA_TIEMPOS_DIAS,
  VENTANA_FACTURAS_SIN_OC_DIAS, N, dias, aFecha, normalizar, tokens, normOC, nombreCliente,
} from './textos.js';

const sum = (arr, f) => arr.reduce((s, x) => s + (N(f ? f(x) : x)), 0);
const minFecha = (arr) => { const xs = arr.map(aFecha).filter(Boolean).sort((a, b) => a - b); return xs[0] || null; };
const maxFecha = (arr) => { const xs = arr.map(aFecha).filter(Boolean).sort((a, b) => b - a); return xs[0] || null; };
const sumaDias = (fecha, n) => { const d = aFecha(fecha); return d ? new Date(d.getTime() + n * 86400000) : null; };
const agrupar = (rows, key) => { const m = new Map(); for (const r of rows || []) { const k = r[key]; if (!m.has(k)) m.set(k, []); m.get(k).push(r); } return m; };
const FILL_COMPLETO = 99.5;

/** Fecha efectiva de envío/entrega de un envío: manual gana salvo que se haya elegido 'erp'. */
export function fechasEnvio(e) {
  const esErp = e.fuente === 'erp';
  const eligeErp = e.fecha_elegida === 'erp';
  const fechaEnvio   = esErp ? (e.fecha_envio_erp || e.fecha_surtida) : (eligeErp && e.fecha_envio_erp ? e.fecha_envio_erp : (e.fecha_surtida || e.fecha_envio_erp || null));
  const fechaEntrega = esErp ? (e.fecha_entrega_erp || e.fecha_entregada) : (eligeErp && e.fecha_entrega_erp ? e.fecha_entrega_erp : (e.fecha_entregada || e.fecha_entrega_erp || null));
  const fuenteEnvio   = esErp || (eligeErp && e.fecha_envio_erp) || (!e.fecha_surtida && e.fecha_envio_erp) ? 'erp' : (fechaEnvio ? 'manual' : null);
  const fuenteEntrega = esErp || (eligeErp && e.fecha_entrega_erp) || (!e.fecha_entregada && e.fecha_entrega_erp) ? 'erp' : (fechaEntrega ? 'manual' : null);
  const dEnvio   = !esErp && e.fecha_surtida && e.fecha_envio_erp ? Math.abs(dias(e.fecha_surtida, e.fecha_envio_erp)) : null;
  const dEntrega = !esErp && e.fecha_entregada && e.fecha_entrega_erp ? Math.abs(dias(e.fecha_entregada, e.fecha_entrega_erp)) : null;
  const desfase = Math.max(dEnvio ?? 0, dEntrega ?? 0);
  const conDesfase = desfase > DESFASE_DIAS && !e.fecha_elegida;
  return { fechaEnvio, fechaEntrega, fuenteEnvio, fuenteEntrega, desfase: desfase > DESFASE_DIAS ? desfase : 0, conDesfase, tieneGuiaErp: !!e.guia_erp_id || esErp };
}

/** Una OC con todo lo que cuelga de ella → OC calculada. */
export function calcularOC({ oc, skus = [], facturas = [], facturaSkus = new Map(), envios = [], envioSkus = new Map(), cotizacion = null, transito = new Map(), stock = new Map(), roadmap = new Map(), hoy = new Date() }) {
  // ── Pedido por SKU ──
  const porSku = new Map();
  for (const s of skus) {
    const k = String(s.sku || '').trim().toUpperCase();
    if (!k) continue;
    const r = porSku.get(k) || { sku: k, descripcion: roadmap.get(k)?.descripcion || '', pedido: 0, precio: 0, facturado: 0, folios: [], ocSkuIds: [] };
    r.pedido += N(s.cantidad_ordenada); r.precio = N(s.precio_unitario) || r.precio; r.ocSkuIds.push(s.id);
    porSku.set(k, r);
  }
  // ── Facturado por SKU (ERP); si no hay facturas, surtido manual (oc_envio_skus) como respaldo ──
  const facts = facturas.map((f) => ({ ...f, skus: facturaSkus.get(f.id) || [] })).sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')));
  let fuenteFacturado = null;
  if (facts.length) {
    fuenteFacturado = facts.every((f) => f.fuente === 'erp') ? 'erp' : 'manual';
    for (const f of facts) for (const p of f.skus) {
      const k = String(p.sku || '').trim().toUpperCase();
      const r = porSku.get(k) || { sku: k, descripcion: p.descripcion || roadmap.get(k)?.descripcion || '', pedido: 0, precio: 0, facturado: 0, folios: [], ocSkuIds: [], noPedido: true };
      r.facturado += N(p.piezas); if (!r.folios.includes(f.folio)) r.folios.push(f.folio);
      if (!r.descripcion) r.descripcion = p.descripcion || '';
      porSku.set(k, r);
    }
  } else {
    const idToSku = new Map(skus.map((s) => [s.id, String(s.sku || '').trim().toUpperCase()]));
    let manual = 0;
    for (const e of envios) for (const x of (envioSkus.get(e.id) || [])) {
      const k = idToSku.get(x.oc_sku_id); const r = k && porSku.get(k);
      if (!r) continue;
      r.facturado += N(x.cantidad_surtida); manual += N(x.cantidad_surtida);
    }
    if (manual > 0) fuenteFacturado = 'manual';
  }
  const skusCalc = [...porSku.values()].map((r) => {
    const backorder = Math.max(0, r.pedido - r.facturado);
    const t = transito.get(r.sku);
    const cubre = backorder > 0 && t && N(t.cantidad) > 0 ? { po: t.po || null, eta: t.eta || null, cantidad: N(t.cantidad) } : null;
    const st = stock.get(r.sku);
    const stockHoy = st ? N(st.disponible) : 0;
    return { ...r, backorder, cubre, stock: stockHoy, conStock: backorder > 0 && stockHoy >= backorder, porAlmacen: st?.porAlmacen || null, completo: r.pedido > 0 && r.facturado >= r.pedido };
  }).sort((a, b) => b.backorder - a.backorder || b.pedido - a.pedido);
  const pedido = sum(skusCalc, (s) => s.pedido);
  const facturado = sum(skusCalc, (s) => Math.min(s.facturado, s.pedido || s.facturado));
  const backorder = sum(skusCalc, (s) => s.backorder);
  const fill = pedido > 0 ? Math.min(100, (facturado / pedido) * 100) : (facturado > 0 ? 100 : 0);
  const montoPedido = sum(skusCalc, (s) => s.pedido * s.precio);
  const montoFacturado = sum(facts, (f) => f.monto);
  const monto = montoPedido > 0 ? montoPedido : montoFacturado;
  const folioPendientes = (oc.facturas || []).filter((fo) => !facts.some((f) => f.folio === fo));

  // ── Envíos ──
  const envs = envios.map((e) => ({ ...e, ...fechasEnvio(e), skus: envioSkus.get(e.id) || [] })).sort((a, b) => N(a.numero_envio) - N(b.numero_envio));

  // ── Fechas por etapa ──
  const cot = cotizacion || ((oc.fecha_cotizacion_solicitada || oc.fecha_cotizacion_enviada)
    ? { folio: null, estado: oc.fecha_recibida ? 'aceptada' : oc.fecha_cotizacion_enviada ? 'enviada' : 'solicitada', fecha_solicitada: oc.fecha_cotizacion_solicitada, fecha_enviada: oc.fecha_cotizacion_enviada, legacy: true }
    : null);
  const fechas = {
    cotizacion: cot ? (aFecha(cot.fecha_enviada) || aFecha(cot.fecha_solicitada)) : null,
    recibida: aFecha(oc.fecha_recibida),
    facturada: facts.length ? minFecha(facts.map((f) => f.fecha)) : (fuenteFacturado === 'manual' ? minFecha(envs.map((e) => e.fecha_surtida)) : null),
    enviada: minFecha(envs.map((e) => e.fechaEnvio)),
    entregada: envs.length && envs.every((e) => e.fechaEntrega) && fill >= FILL_COMPLETO ? maxFecha(envs.map((e) => e.fechaEntrega)) : null,
  };
  const fuentes = {
    cotizacion: cot ? 'manual' : null,
    recibida: fechas.recibida ? 'manual' : null,
    facturada: fechas.facturada ? fuenteFacturado : null,
    enviada: fechas.enviada ? (envs.find((e) => e.fechaEnvio && aFecha(e.fechaEnvio).getTime() === fechas.enviada.getTime())?.fuenteEnvio || 'manual') : null,
    entregada: fechas.entregada ? (envs.every((e) => e.fuenteEntrega === 'erp') ? 'erp' : 'manual') : null,
  };
  let etapa = 'recibida';
  for (const e of ETAPAS) if (fechas[e]) etapa = e;
  if (!fechas.recibida && fechas.cotizacion) etapa = 'cotizacion';
  const fechaEtapa = fechas[etapa] || null;
  const abierta = etapa !== 'entregada';
  const diasEnEtapa = fechaEtapa ? Math.max(0, dias(fechaEtapa, hoy)) : null;
  const diasTotal = fechas.recibida ? dias(fechas.recibida, fechas.entregada || hoy) : null;
  const detenida = abierta && ['cotizacion', 'recibida', 'facturada'].includes(etapa) && diasEnEtapa != null && diasEnEtapa > DIAS_DETENIDA;
  // Tramos en días, nunca negativos (capturas fuera de orden: factura fechada antes de la OC, entrega antes del envío…).
  const tramo = (a, b) => (a && b ? Math.max(0, dias(a, b)) : null);
  const tiempos = {
    factura: tramo(fechas.recibida, fechas.facturada),
    envio: tramo(fechas.facturada, fechas.enviada),
    entrega: tramo(fechas.enviada, fechas.entregada),
    total: tramo(fechas.recibida, fechas.entregada),
  };
  const backorderSkus = skusCalc.filter((s) => s.backorder > 0);
  const surtibleHoy = abierta && ['recibida', 'facturada'].includes(etapa) && backorderSkus.length > 0 && backorderSkus.every((s) => s.stock >= s.backorder);
  const conDesfase = envs.some((e) => e.conDesfase);
  const fechaEstimada = !abierta ? null
    : etapa === 'enviada' ? sumaDias(fechas.enviada, METAS_DIAS.entrega)
    : etapa === 'facturada' ? (backorderSkus.some((s) => !s.conStock) && backorderSkus.filter((s) => !s.conStock).every((s) => s.cubre?.eta) ? sumaDias(maxFecha(backorderSkus.filter((s) => !s.conStock).map((s) => s.cubre.eta)), METAS_DIAS.envio + METAS_DIAS.entrega) : sumaDias(fechas.facturada, METAS_DIAS.envio + METAS_DIAS.entrega))
    : fechas.recibida ? sumaDias(fechas.recibida, META_ENTREGA) : null;
  const timeline = ETAPAS.filter((e) => e !== 'cotizacion' || cot).map((e) => ({
    etapa: e, fecha: fechas[e], fuente: fuentes[e],
    estado: fechas[e] ? (e === 'facturada' && fill < FILL_COMPLETO ? 'parcial' : 'hecho') : (ETAPA_ORDEN[e] < ETAPA_ORDEN[etapa] ? 'saltada' : 'pendiente'),
    nota: e === 'facturada' && fechas[e] && fill < FILL_COMPLETO ? `parcial ${Math.round(fill)} % · backorder ${Math.round(backorder)} pz` : e === 'cotizacion' && cot ? (cot.folio || 'cotización') : null,
  }));
  const almacenSurtir = surtibleHoy ? mejorAlmacen(backorderSkus) : null;
  return {
    ...oc, id: oc.id, esCotizacion: false, cotizacion: cot, skusCalc, backorderSkus, facturas: facts, folioPendientes, fuenteFacturado, envios: envs,
    pedido, facturado, backorder, fill, monto, montoPedido, montoFacturado, fechas, fuentes, etapa, fechaEtapa, fuenteEtapa: fuentes[etapa],
    abierta, diasEnEtapa, diasTotal, detenida, tiempos, surtibleHoy, almacenSurtir, conBackorder: backorder > 0, conDesfase, fechaEstimada, timeline,
    guias: envs.map((e) => e.guia_rastreo).filter(Boolean),
    ultimoCambio: maxFecha([oc.updated_at, ...envs.map((e) => e.updated_at), ...facts.map((f) => f.updated_at)]),
  };
}

/** Cedis con más stock de los SKUs pendientes (GDL/CDMX) · porAlmacen viene mapeado por datos.js. */
function mejorAlmacen(skusPend) {
  const tot = {};
  for (const s of skusPend) for (const [ced, v] of Object.entries(s.porAlmacen || {})) tot[ced] = (tot[ced] || 0) + N(v);
  const mejor = Object.entries(tot).sort((a, b) => b[1] - a[1])[0];
  return mejor ? mejor[0] : null;
}

/** Cotización sin OC → fila "pseudo-OC" para la tabla y el embudo. */
export function cotizacionComoFila(c, hoy = new Date()) {
  const fechaEtapa = aFecha(c.fecha_respuesta) || aFecha(c.fecha_enviada) || aFecha(c.fecha_solicitada) || aFecha(c.created_at);
  const perdida = c.estado === 'perdida';
  const diasEnEtapa = fechaEtapa ? Math.max(0, dias(fechaEtapa, hoy)) : null;
  return {
    id: `cot:${c.id}`, esCotizacion: true, cotizacion: c, cliente_key: c.cliente_key, numero_oc_cliente: c.folio || '—', fecha_recibida: null, facturas: [], folioPendientes: [],
    skusCalc: [], backorderSkus: [], envios: [], pedido: N(c.piezas), facturado: 0, backorder: 0, fill: 0, monto: N(c.monto),
    fechas: { cotizacion: fechaEtapa }, fuentes: { cotizacion: 'manual' }, etapa: perdida ? 'perdida' : 'cotizacion', fechaEtapa, fuenteEtapa: 'manual',
    abierta: !perdida, diasEnEtapa, diasTotal: null, detenida: !perdida && diasEnEtapa != null && diasEnEtapa > DIAS_DETENIDA && c.estado !== 'aceptada',
    tiempos: {}, surtibleHoy: false, conBackorder: false, conDesfase: false, fechaEstimada: null, notas: c.notas, fuente: 'cotizacion',
    timeline: [{ etapa: 'cotizacion', fecha: fechaEtapa, fuente: 'manual', estado: perdida ? 'perdida' : 'hecho', nota: c.estado }],
    guias: [], ultimoCambio: aFecha(c.updated_at),
  };
}

/** Todas las OCs + cotizaciones sueltas → filas calculadas. `datos` = salida de datos.js/cargarTodo. */
export function calcularTodo(datos, hoy = new Date()) {
  const skusPorOc = agrupar(datos.ocSkus, 'oc_id');
  const factPorOc = agrupar(datos.facturas, 'oc_id');
  const factSkus = agrupar(datos.facturaSkus, 'factura_id');
  const envPorOc = agrupar(datos.envios, 'oc_id');
  const envSkus = agrupar(datos.envioSkus, 'envio_id');
  const cotPorId = new Map((datos.cotizaciones || []).map((c) => [c.id, c]));
  const cotPorOc = new Map((datos.cotizaciones || []).filter((c) => c.oc_id).map((c) => [c.oc_id, c]));
  const ocs = (datos.ocs || []).map((oc) => calcularOC({
    oc, skus: skusPorOc.get(oc.id) || [], facturas: factPorOc.get(oc.id) || [], facturaSkus: factSkus, envios: envPorOc.get(oc.id) || [], envioSkus: envSkus,
    cotizacion: cotPorId.get(oc.cotizacion_id) || cotPorOc.get(oc.id) || null, transito: datos.transito, stock: datos.stock, roadmap: datos.roadmap, hoy,
  }));
  const ocIds = new Set(ocs.map((o) => o.id));
  const cotSueltas = (datos.cotizaciones || []).filter((c) => !c.oc_id || !ocIds.has(c.oc_id)).map((c) => cotizacionComoFila(c, hoy));
  return [...ocs, ...cotSueltas];
}

// ── Búsqueda y filtros ──
export function textoBusqueda(oc) {
  return normalizar([
    nombreCliente(oc.cliente_key), oc.cliente_key, oc.numero_oc_cliente, oc.numero_oc, oc.cotizacion?.folio, oc.notas,
    ...(oc.skusCalc || []).map((s) => `${s.sku} ${s.descripcion}`), ...(oc.facturas || []).map((f) => `${f.folio} ${f.referencia || ''}`), ...(oc.folioPendientes || []),
    ...(oc.envios || []).map((e) => `${e.guia_rastreo || ''} ${e.paqueteria || ''} ${e.numero_factura || ''}`),
  ].filter(Boolean).join(' '));
}
export const coincide = (hayNormalizado, toks) => toks.every((t) => hayNormalizado.includes(t));

export const FILTROS_VACIOS = () => ({ q: '', cliente: new Set(), etapa: new Set(), fuente: new Set(), detenida: false, backorder: false, desfase: false, surtible: false, segmento: 'abiertos' });

export function pasaSegmento(oc, segmento) {
  if (segmento === 'abiertos') return oc.abierta;
  if (segmento === 'entregados') return !oc.abierta && oc.etapa === 'entregada';
  return true;
}
/** Aplica todos los filtros excepto `excluir` (para contar facetas con los demás filtros aplicados). */
export function pasaFiltros(oc, f, excluir = null, toks = null) {
  if (excluir !== 'segmento' && !pasaSegmento(oc, f.segmento)) return false;
  if (excluir !== 'cliente' && f.cliente.size && !f.cliente.has(oc.cliente_key)) return false;
  if (excluir !== 'etapa' && f.etapa.size && !f.etapa.has(oc.etapa)) return false;
  if (excluir !== 'fuente' && f.fuente.size && !f.fuente.has(oc.fuente || 'manual')) return false;
  if (excluir !== 'detenida' && f.detenida && !oc.detenida) return false;
  if (excluir !== 'backorder' && f.backorder && !oc.conBackorder) return false;
  if (excluir !== 'desfase' && f.desfase && !oc.conDesfase) return false;
  if (excluir !== 'surtible' && f.surtible && !oc.surtibleHoy) return false;
  const t = toks || tokens(f.q);
  if (t.length && !coincide(oc._hay || (oc._hay = textoBusqueda(oc)), t)) return false;
  return true;
}
export function nFiltrosActivos(f) {
  return f.cliente.size + f.etapa.size + f.fuente.size + (f.detenida ? 1 : 0) + (f.backorder ? 1 : 0) + (f.desfase ? 1 : 0) + (f.surtible ? 1 : 0);
}
/** Conteos por faceta con los demás filtros aplicados. */
export function facetas(filas, f) {
  const toks = tokens(f.q);
  const cnt = (excluir, fn) => { const m = new Map(); for (const r of filas) if (pasaFiltros(r, f, excluir, toks)) { const k = fn(r); if (k != null) m.set(k, (m.get(k) || 0) + 1); } return m; };
  return {
    cliente: cnt('cliente', (r) => r.cliente_key), etapa: cnt('etapa', (r) => r.etapa), fuente: cnt('fuente', (r) => r.fuente || 'manual'),
    detenida: filas.filter((r) => r.detenida && pasaFiltros(r, f, 'detenida', toks)).length,
    backorder: filas.filter((r) => r.conBackorder && pasaFiltros(r, f, 'backorder', toks)).length,
    desfase: filas.filter((r) => r.conDesfase && pasaFiltros(r, f, 'desfase', toks)).length,
    surtible: filas.filter((r) => r.surtibleHoy && pasaFiltros(r, f, 'surtible', toks)).length,
    segmento: { abiertos: filas.filter((r) => pasaFiltros(r, { ...f, segmento: 'abiertos' }, null, toks)).length, entregados: filas.filter((r) => pasaFiltros(r, { ...f, segmento: 'entregados' }, null, toks)).length, todos: filas.filter((r) => pasaFiltros(r, { ...f, segmento: 'todos' }, null, toks)).length },
  };
}
/** Orden por defecto: detenidas primero, luego más días en etapa, luego recibida más reciente. */
export function ordenar(filas) {
  return [...filas].sort((a, b) => (b.detenida - a.detenida) || ((b.diasEnEtapa ?? -1) - (a.diasEnEtapa ?? -1)) || String(b.fecha_recibida || '').localeCompare(String(a.fecha_recibida || '')));
}

// ── Agregados ──
export function rangoPeriodo(periodo, hoy = new Date()) {
  const y = hoy.getFullYear(), m = hoy.getMonth();
  if (periodo === 'mes') return { desde: new Date(y, m, 1), hasta: new Date(y, m + 1, 1), label: 'mes' };
  if (periodo === 'anio') return { desde: new Date(y, 0, 1), hasta: new Date(y + 1, 0, 1), label: 'año' };
  const q = Math.floor(m / 3) * 3;
  return { desde: new Date(y, q, 1), hasta: new Date(y, q + 3, 1), label: 'trimestre' };
}
const enRango = (fecha, r) => { const d = aFecha(fecha); return !!d && d >= r.desde && d < r.hasta; };
const prom = (xs) => { const v = xs.filter((x) => x != null && isFinite(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };

/** Embudo de 5 etapas para el periodo (por fecha de recepción de la OC / solicitud de la cotización). */
export function embudo(filas, cotizaciones, periodo, hoy = new Date()) {
  const r = rangoPeriodo(periodo, hoy);
  const ocs = filas.filter((o) => !o.esCotizacion && enRango(o.fecha_recibida, r));
  const cots = (cotizaciones || []).filter((c) => enRango(c.fecha_solicitada || c.created_at, r));
  const alcanzo = (e) => ocs.filter((o) => o.fechas?.[e]).length;
  const conv = cots.length ? (cots.filter((c) => c.estado === 'aceptada' || c.oc_id).length / cots.length) * 100 : null;
  const porCliente = (arr) => { const m = {}; for (const o of arr) m[o.cliente_key] = (m[o.cliente_key] || 0) + 1; return m; };
  return {
    periodo: r, etapas: [
      { etapa: 'cotizacion', n: cots.length, sub: cots.length ? `${Object.keys(porCliente(cots)).map(nombreCliente).join(' · ')} · ${conv != null ? `${Math.round(conv)} % → OC` : ''}` : 'sin cotizaciones', conversion: conv },
      { etapa: 'recibida', n: ocs.length, sub: `${ocs.filter((o) => o.detenida).length} detenidas · ${fmtD(prom(ocs.map((o) => o.tiempos.factura)))}`, dias: prom(ocs.map((o) => o.tiempos.factura)) },
      { etapa: 'facturada', n: alcanzo('facturada'), sub: `${ocs.some((o) => o.fuenteFacturado === 'erp') ? 'automático ERP' : 'captura'} · ${fmtD(prom(ocs.map((o) => o.tiempos.envio)))}`, dias: prom(ocs.map((o) => o.tiempos.envio)) },
      { etapa: 'enviada', n: alcanzo('enviada'), sub: `guía ERP o manual · ${fmtD(prom(ocs.map((o) => o.tiempos.entrega)))}`, dias: prom(ocs.map((o) => o.tiempos.entrega)) },
      { etapa: 'entregada', n: alcanzo('entregada'), sub: `recepción · ${fmtD(prom(ocs.map((o) => o.tiempos.total)))} total`, dias: prom(ocs.map((o) => o.tiempos.total)) },
    ],
    base: ocs.length,
  };
}
const fmtD = (d) => (d == null ? '— d' : `${d.toFixed(1)} d`);

/** KPIs y hero. */
export function resumen(filas, hoy = new Date()) {
  const abiertas = filas.filter((o) => o.abierta && !o.esCotizacion);
  const detenidas = filas.filter((o) => o.detenida);
  const surtibles = abiertas.filter((o) => o.surtibleHoy);
  const conDesfase = abiertas.concat(filas.filter((o) => !o.abierta)).flatMap((o) => o.envios.filter((e) => e.conDesfase));
  const bo = backorderPorSku(filas);
  const ventana = sumaDias(hoy, -VENTANA_TIEMPOS_DIAS), ventanaPrev = sumaDias(hoy, -2 * VENTANA_TIEMPOS_DIAS);
  const recientes = filas.filter((o) => !o.esCotizacion && aFecha(o.fecha_recibida) && aFecha(o.fecha_recibida) >= ventana);
  const previas = filas.filter((o) => !o.esCotizacion && aFecha(o.fecha_recibida) && aFecha(o.fecha_recibida) >= ventanaPrev && aFecha(o.fecha_recibida) < ventana);
  const fillDe = (arr) => { const p = sum(arr, (o) => o.pedido); return p > 0 ? (sum(arr, (o) => o.facturado) / p) * 100 : null; };
  const diasDe = (arr) => prom(arr.filter((o) => !o.abierta).map((o) => o.tiempos.total));
  const porCliente = (arr) => { const m = {}; for (const o of arr) m[o.cliente_key] = (m[o.cliente_key] || 0) + 1; return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${nombreCliente(k)} ${n}`).join(', '); };
  const cots = filas.filter((o) => o.esCotizacion);
  const cotsRec = (filas.filter((o) => o.cotizacion)).length;
  return {
    abiertas: abiertas.length, abiertasMonto: sum(abiertas, (o) => o.monto), abiertasPz: sum(abiertas, (o) => o.pedido), abiertasPendPz: sum(abiertas, (o) => o.backorder),
    detenidas: detenidas.length, detenidasPorCliente: porCliente(detenidas),
    surtibles: surtibles.length, surtiblesPz: sum(surtibles, (o) => o.backorder),
    backorderSkus: bo.length, backorderPz: sum(bo, (b) => b.backorder), backorderConArribo: bo.filter((b) => b.cubre && b.stock < b.backorder).length, backorderConStock: bo.filter((b) => b.stock >= b.backorder).length, backorderSinPo: bo.filter((b) => !b.cubre && b.stock < b.backorder).length,
    desfases: conDesfase.length,
    fill: fillDe(recientes), fillPrev: fillDe(previas),
    diasEntrega: diasDe(recientes), diasEntregaPrev: diasDe(previas),
    cotizacionesAbiertas: cots.filter((c) => c.abierta).length, cotizacionesTotal: cots.length + cotsRec,
    conversion: (cots.length + cotsRec) ? (cotsRec / (cots.length + cotsRec)) * 100 : null,
  };
}

/** Backorder global por SKU (OCs abiertas). */
export function backorderPorSku(filas) {
  const m = new Map();
  for (const o of filas) {
    if (!o.abierta || o.esCotizacion) continue;
    for (const s of o.backorderSkus) {
      const r = m.get(s.sku) || { sku: s.sku, descripcion: s.descripcion, backorder: 0, clientes: new Set(), ocs: [], stock: s.stock, cubre: s.cubre, dias: 0 };
      r.backorder += s.backorder; r.clientes.add(o.cliente_key); r.ocs.push(o.numero_oc_cliente);
      r.dias = Math.max(r.dias, o.diasEnEtapa ?? 0);
      if (!r.descripcion && s.descripcion) r.descripcion = s.descripcion;
      m.set(s.sku, r);
    }
  }
  return [...m.values()].map((r) => ({ ...r, clientes: [...r.clientes], id: r.sku })).sort((a, b) => b.backorder - a.backorder);
}

/** OCs con stock completo, ordenadas por días en etapa. */
export function surtirHoy(filas) {
  return filas.filter((o) => o.surtibleHoy).map((o) => ({ id: o.id, cliente_key: o.cliente_key, numero_oc_cliente: o.numero_oc_cliente, pendiente: o.backorder, almacen: o.almacenSurtir, diasEnEtapa: o.diasEnEtapa, etapa: o.etapa }))
    .sort((a, b) => (b.diasEnEtapa ?? 0) - (a.diasEnEtapa ?? 0));
}

/** Tiempos promedio por cliente (últimos 90 días de recepción) vs meta. */
export function tiemposPorCliente(filas, hoy = new Date()) {
  const ventana = sumaDias(hoy, -VENTANA_TIEMPOS_DIAS);
  const rec = filas.filter((o) => !o.esCotizacion && aFecha(o.fecha_recibida) && aFecha(o.fecha_recibida) >= ventana);
  const por = agrupar(rec, 'cliente_key');
  return [...por.entries()].map(([ck, arr]) => {
    const factura = prom(arr.map((o) => o.tiempos.factura)), envio = prom(arr.map((o) => o.tiempos.envio)), entrega = prom(arr.map((o) => o.tiempos.entrega)), total = prom(arr.map((o) => o.tiempos.total));
    const estado = total == null ? 'sin datos' : total <= METAS_DIAS.total ? 'En meta' : total <= METAS_DIAS.total + 1 ? 'Justo' : 'Fuera';
    return { id: ck, cliente_key: ck, n: arr.length, entregadas: arr.filter((o) => !o.abierta).length, factura, envio, entrega, total, estado };
  }).sort((a, b) => (b.total ?? -1) - (a.total ?? -1));
}

/** Facturas del ERP (últimos N días) que no están ligadas a ninguna OC. */
export function facturasSinOC(erpFacturas, facturasLigadas, hoy = new Date()) {
  const ligadas = new Set((facturasLigadas || []).map((f) => f.folio));
  const desde = sumaDias(hoy, -VENTANA_FACTURAS_SIN_OC_DIAS);
  return (erpFacturas || []).filter((f) => !ligadas.has(f.folio) && aFecha(f.fecha) && aFecha(f.fecha) >= desde)
    .map((f) => ({ ...f, id: f.folio, piezas: N(f.piezas), monto: N(f.monto), referenciaNorm: normOC(f.referencia) }))
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
}

/** OCs candidatas para "Ligar a OC": mismo cliente, abiertas primero, referencia parecida arriba. */
export function candidatasParaFactura(factura, filas) {
  const ref = normOC(factura.referencia);
  return filas.filter((o) => !o.esCotizacion && o.cliente_key === factura.cliente_key)
    .map((o) => ({ ...o, parecido: ref && (ref === normOC(o.numero_oc_cliente) || (normOC(o.numero_oc_cliente).length >= 5 && ref.includes(normOC(o.numero_oc_cliente)))) }))
    .sort((a, b) => (b.parecido - a.parecido) || (b.abierta - a.abierta) || String(b.fecha_recibida || '').localeCompare(String(a.fecha_recibida || '')));
}

/** Frase del hero. */
export function fraseHero(res, hoy = new Date()) {
  if (!res.abiertas && !res.cotizacionesAbiertas) return 'Sin pedidos abiertos: todo entregado.';
  const partes = [`${res.abiertas} OC${res.abiertas === 1 ? '' : 's'} abierta${res.abiertas === 1 ? '' : 's'}`];
  if (res.detenidas) partes.push(`${res.detenidas} detenida${res.detenidas === 1 ? '' : 's'}`);
  let s = partes.join(', ');
  if (res.surtiblesPz > 0) s += `; ${Math.round(res.surtiblesPz).toLocaleString('es-MX')} pz se pueden surtir hoy`;
  else if (res.backorderPz > 0) s += `; ${Math.round(res.backorderPz).toLocaleString('es-MX')} pz en backorder`;
  return s + '.';
}
export function subHero(res) {
  const p = [];
  if (res.conversion != null) p.push(`Conversión de cotizaciones ${Math.round(res.conversion)} %`);
  if (res.diasEntrega != null) p.push(`entrega promedio ${res.diasEntrega.toFixed(1)} días (meta ${META_ENTREGA})`);
  if (res.fill != null) p.push(`fill rate ${Math.round(res.fill)} %`);
  return (p.length ? p.join(', ') + '. ' : '') + 'Facturas y guías llegan solas del ERP; lo capturado a mano se conserva y gana si difiere.';
}
