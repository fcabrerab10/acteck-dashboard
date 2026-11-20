// Tránsito (v_transito_sku) · ÚNICA implementación de «agrupar por PO» y «próximo arribo de un SKU» (2026-11-20).
// Puro: sin React ni red. Pruebas: scripts/test-transito.mjs.
//
// La usan: Inventario › Próximos arribos (web y celular), S&OP › Lo que viene / ficha de la PO / Producto 360 · Abasto,
// Inicio (arribos de 7 días y «En camino»), y el «próximo arribo» de la ficha de producto, drill de Sell In,
// Estrategia de Precios, Compartir de Inventario y el armador de Propuestas.
//
// Regla común: una PO = sus embarques pendientes; ETA de la PO = la más temprana de sus renglones; piezas = suma;
// «vencida» = ETA anterior a hoy (fecha local); orden por ETA con lo que no tiene fecha al final.
// Lo que difería entre copias y se conservó como opción (ver cada llamada): si se exigen PO y piezas > 0, de qué
// renglón salen estatus/CEDIS, y el desempate del orden.
const N = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v));

/** 'YYYY-MM-DD' en hora local. Acepta Date o un ISO ya hecho. */
export const isoDia = (d) => (typeof d === 'string' ? d.slice(0, 10) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
const SIN_FECHA = '9999';
const porEta = (a, b) => String(a.eta || SIN_FECHA).localeCompare(String(b.eta || SIN_FECHA));

/** Días de calendario de `hoyIso` a `etaIso` (negativo = ya pasó); null sin fecha. */
export function diasA(etaIso, hoyIso) {
  if (!etaIso) return null;
  const d = Math.round((Date.parse(`${String(etaIso).slice(0, 10)}T12:00:00`) - Date.parse(`${hoyIso}T12:00:00`)) / 86400000);
  return Number.isNaN(d) ? null : d;
}

/**
 * Recorre los embarques pendientes en el orden en que vienen. `transito` puede ser:
 *   · las filas de v_transito_sku: [{ sku, embarques_detalle: [{ po, eta, etd, cantidad, estatus, cedis, contenedor }] }]
 *   · o el Map(sku → { pos: [...] }) que arman Inventario web y celular (mapaTransito).
 */
export function cadaEmbarque(transito, fn) {
  if (transito instanceof Map) { transito.forEach((t, sku) => (t?.pos || []).forEach((e) => fn(e, sku, t))); return; }
  for (const t of transito || []) for (const e of (Array.isArray(t?.embarques_detalle) ? t.embarques_detalle : [])) fn(e, t.sku, t);
}

/** v_transito_sku → Map(sku → { cantidad, pos:[…ordenados por ETA], eta, supplier }). Forma que usa Inventario (web y celular). */
export function mapaTransito(rows = []) {
  const m = new Map();
  (rows || []).forEach((r) => {
    if (!r.sku) return;
    const prev = m.get(r.sku) || { cantidad: 0, pos: [], eta: null, supplier: r.supplier || '' };
    prev.cantidad += N(r.cantidad);
    const det = Array.isArray(r.embarques_detalle) ? r.embarques_detalle : [];
    det.forEach((d) => prev.pos.push({ po: d.po, estatus: d.estatus, cantidad: N(d.cantidad), eta: d.eta || null, etd: d.etd || null, cedis: d.cedis || '', contenedor: d.contenedor || '' }));
    if (r.eta_mas_cercana && (!prev.eta || r.eta_mas_cercana < prev.eta)) prev.eta = r.eta_mas_cercana;
    m.set(r.sku, prev);
  });
  m.forEach((v) => v.pos.sort(porEta));
  return m;
}

/**
 * Agrupa los embarques pendientes por PO.
 *   opts.hoy             Date o ISO: contra qué se decide `vencida` y `dias`.
 *   opts.exigirPo        true (default) descarta renglones sin PO; false los junta bajo `opts.sinPo` ('sin PO').
 *   opts.exigirCantidad  true (default) descarta renglones con piezas ≤ 0.
 *   opts.cabecera        de qué renglón salen estatus y CEDIS: 'primeraConDato' (default) | 'primera' (el primero, aunque venga vacío).
 *   opts.desempate       'piezas' (default: misma ETA → más piezas primero) | null (misma ETA → orden de llegada).
 *   opts.alCrear(e, sku, t)            → campos extra con que nace la PO (p. ej. supplier, usd: 0).
 *   opts.porRenglon(po, { e, sku, t, piezas })  → acumula lo propio de cada pantalla (líneas por SKU, valor…).
 * Devuelve [{ po, eta, etd, cedis, estatus, contenedor, piezas, renglones, skusDistintos, vencida, dias, …extra }].
 */
export function agruparTransitoPorPO(transito, { hoy = new Date(), exigirPo = true, exigirCantidad = true, sinPo = 'sin PO', cabecera = 'primeraConDato', desempate = 'piezas', alCrear, porRenglon } = {}) {
  const hoyIso = isoDia(hoy);
  const m = new Map();
  const vistos = new Map();
  cadaEmbarque(transito, (e, sku, t) => {
    if (!e) return;
    const piezas = N(e.cantidad);
    if (exigirPo && !e.po) return;
    if (exigirCantidad && !(piezas > 0)) return;
    const k = e.po || sinPo;
    let o = m.get(k);
    if (!o) {
      o = { po: k, eta: null, etd: null, cedis: cabecera === 'primera' ? (e.cedis || '') : '', estatus: cabecera === 'primera' ? (e.estatus || '') : '', contenedor: '', piezas: 0, renglones: 0, ...(alCrear ? alCrear(e, sku, t) : null) };
      m.set(k, o); vistos.set(k, new Set());
    }
    if (e.eta && (!o.eta || e.eta < o.eta)) o.eta = e.eta;
    if (e.etd && (!o.etd || e.etd < o.etd)) o.etd = e.etd;
    if (cabecera !== 'primera') { if (!o.cedis && e.cedis) o.cedis = e.cedis; if (!o.estatus && e.estatus) o.estatus = e.estatus; }
    if (!o.contenedor && e.contenedor) o.contenedor = e.contenedor;
    o.piezas += piezas; o.renglones += 1; vistos.get(k).add(sku);
    if (porRenglon) porRenglon(o, { e, sku, t, piezas });
  });
  return [...m.values()].map((o) => ({ ...o, skusDistintos: vistos.get(o.po).size, vencida: !!o.eta && o.eta < hoyIso, dias: diasA(o.eta, hoyIso) }))
    .sort((a, b) => porEta(a, b) || (desempate === 'piezas' ? b.piezas - a.piezas : 0));
}

/** Embarques pendientes de UN SKU ordenados por ETA (sin fecha al final). `detalle` = embarques_detalle o `pos`. */
export function embarquesPendientes(detalle, { exigirCantidad = true } = {}) {
  return (Array.isArray(detalle) ? detalle : []).filter((e) => e && (!exigirCantidad || N(e.cantidad) > 0)).sort(porEta);
}

/**
 * Próximo arribo de UN SKU: el embarque con la ETA más cercana de hoy en adelante; si todos ya pasaron, el primero con
 * fecha (aunque esté vencido). null si ninguno trae fecha.
 *   opts.exigirCantidad  true (default). El armador de Propuestas pasa false (también cuenta renglones sin piezas).
 */
export function proximoEmbarque(detalle, hoy = new Date(), opts) {
  const hoyIso = isoDia(hoy);
  const det = embarquesPendientes(detalle, opts);
  return det.find((e) => e.eta && String(e.eta) >= hoyIso) || det.find((e) => e.eta) || null;
}

/** Llegadas planas [{ sku, po, eta, cantidad }] (con PO y piezas > 0) para los motores del S&OP. */
export function llegadasDe(transito = []) {
  const out = [];
  cadaEmbarque(transito, (e, sku) => { if (e?.po && N(e.cantidad) > 0) out.push({ sku, po: e.po, eta: e.eta || null, cantidad: N(e.cantidad) }); });
  return out;
}
