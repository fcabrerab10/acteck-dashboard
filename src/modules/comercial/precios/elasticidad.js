// Estrategia de Precios · elasticidad, simulador y precio bajo por cliente. FUNCIONES PURAS SIN IMPORTS
// (Node no resuelve los imports sin extensión de calculo.js): así `scripts/test-precios-elasticidad.mjs`
// las prueba directo. calculo.js las reexporta; la UI las usa desde ahí.
//
// Elasticidad por cambio de precio (aprobado por Fernando): por cada cambio en precios_historico
// (lista Mayoreo AAA por defecto), piezas facturadas en los 3 meses ANTERIORES al mes del cambio vs
// los 3 meses POSTERIORES (ventana cerrada: los 3 meses posteriores ya deben ser meses cerrados).
//   Δprecio% = (nuevo − anterior) / anterior · Δpz% = (prom después − prom antes) / prom antes
//   elasticidad = Δpz% / Δprecio%   (−1.2 = si subo 10 % el precio, vendo 12 % menos piezas)

export const ELASTICIDAD_DEFAULT = -1.2;
export const VENTANA_MESES = 3;
export const IVA = 0.16;

const num = (v) => (v == null || v === '' ? 0 : Number(v) || 0);
const idx = (anio, mes) => Number(anio) * 12 + (Number(mes) - 1); // índice absoluto de mes
const deIdx = (i) => ({ anio: Math.floor(i / 12), mes: (i % 12) + 1 });

/** Mapa 'anio-mes' → piezas (suma de todos los clientes) a partir de filas {anio, mes, piezas}. */
export function piezasPorMes(fact) {
  const m = new Map();
  for (const f of fact || []) { const k = idx(f.anio, f.mes); m.set(k, (m.get(k) || 0) + num(f.piezas)); }
  return m;
}

/**
 * Elasticidad de un SKU a partir de sus cambios de precio y su facturación mensual.
 *   cambios: [{ lista, anio, mes, de, a }]   (sólo se usan los de `lista`)
 *   fact:    [{ anio, mes, piezas }]          (cualquier cliente; se suman)
 *   hoy:     Date (el mes de `hoy` NO está cerrado; el último cerrado es el anterior)
 * Devuelve { filas: [...], elasticidad, n, cerrados, pendientes } donde cada fila es
 * { anio, mes, de, a, deltaPrecioPct, antes, despues, deltaPzPct, elasticidad, cerrado }.
 * Sólo las filas cerradas con antes > 0 y Δprecio ≠ 0 entran al promedio.
 */
export function elasticidadSku({ cambios, fact, lista = 'Mayoreo AAA', hoy = new Date(), ventana = VENTANA_MESES } = {}) {
  const pz = piezasPorMes(fact);
  const ultimoCerrado = idx(hoy.getFullYear(), hoy.getMonth() + 1) - 1;
  const filas = [];
  for (const c of cambios || []) {
    if (c.lista !== lista) continue;
    const de = num(c.de), a = num(c.a);
    if (!(de > 0) || a === de) continue;
    const m = idx(c.anio, c.mes);
    const cerrado = m + ventana <= ultimoCerrado;
    let antes = 0, despues = 0;
    for (let i = 1; i <= ventana; i++) { antes += pz.get(m - i) || 0; despues += pz.get(m + i) || 0; }
    antes /= ventana; despues /= ventana;
    const deltaPrecioPct = ((a - de) / de) * 100;
    const deltaPzPct = cerrado && antes > 0 ? ((despues - antes) / antes) * 100 : null;
    const el = deltaPzPct != null && deltaPrecioPct !== 0 ? deltaPzPct / deltaPrecioPct : null;
    filas.push({ anio: Number(c.anio), mes: Number(c.mes), de, a, deltaPrecioPct, antes: cerrado ? antes : null, despues: cerrado ? despues : null, deltaPzPct, elasticidad: el, cerrado });
  }
  filas.sort((x, y) => y.anio - x.anio || y.mes - x.mes);
  const validas = filas.filter((f) => f.elasticidad != null && isFinite(f.elasticidad));
  const elasticidad = validas.length ? validas.reduce((s, f) => s + f.elasticidad, 0) / validas.length : null;
  return { filas, elasticidad, n: validas.length, cerrados: filas.filter((f) => f.cerrado).length, pendientes: filas.filter((f) => !f.cerrado).length };
}

/**
 * Elasticidad por categoría a partir de TODOS los SKUs con cambios.
 *   cambiosPorSku: Map sku → [{ lista, anio, mes, de, a }]   (p. ej. de v_precios_cambios)
 *   factPorSku:    Map sku → [{ anio, mes, piezas }]
 *   categoriaDe:   (sku) → categoria
 * Devuelve Map categoria → { elasticidad (promedio simple de los SKUs con elasticidad), n (SKUs), skus: [{sku, elasticidad}] }.
 */
export function elasticidadPorCategoria({ cambiosPorSku, factPorSku, categoriaDe, lista = 'Mayoreo AAA', hoy = new Date() } = {}) {
  const out = new Map();
  for (const [sku, cambios] of cambiosPorSku || []) {
    const cat = categoriaDe(sku);
    if (!cat) continue;
    const r = elasticidadSku({ cambios, fact: factPorSku?.get(sku) || [], lista, hoy });
    if (r.elasticidad == null) continue;
    if (!out.has(cat)) out.set(cat, { elasticidad: null, n: 0, skus: [] });
    out.get(cat).skus.push({ sku, elasticidad: r.elasticidad });
  }
  for (const it of out.values()) { it.n = it.skus.length; it.elasticidad = it.skus.reduce((s, x) => s + x.elasticidad, 0) / it.n; }
  return out;
}

/** Qué elasticidad usa el simulador: la del SKU → la de su categoría → el supuesto por categoría → default. */
export function elegirElasticidad({ sku = null, categoria = null, supuesto = null } = {}) {
  const ok = (v) => v != null && isFinite(Number(v));
  if (ok(sku)) return { valor: Number(sku), origen: 'sku' };
  if (ok(categoria)) return { valor: Number(categoria), origen: 'categoria' };
  if (ok(supuesto)) return { valor: Number(supuesto), origen: 'supuesto' };
  return { valor: ELASTICIDAD_DEFAULT, origen: 'default' };
}

/** Ritmo actual = promedio de piezas/mes de los `n` meses cerrados anteriores a `hoy` (todos los clientes). */
export function ritmoMensual(fact, { hoy = new Date(), n = VENTANA_MESES } = {}) {
  const pz = piezasPorMes(fact);
  const ultimo = idx(hoy.getFullYear(), hoy.getMonth() + 1) - 1;
  let s = 0;
  for (let i = 0; i < n; i++) s += pz.get(ultimo - i) || 0;
  return s / n;
}

/**
 * Simulador "Si muevo el precio".
 *   precioActual, precioNuevo: sin IVA · costo: costo promedio (0/null = sin margen) · ritmo: pz/mes · elasticidad: número
 * Devuelve { deltaPrecioPct, conIva, margenPct, margenActualPct, piezasActual, piezasEstimadas, deltaPiezasPct,
 *            montoActual, montoEstimado, deltaMonto, deltaMontoPct }.
 * Las piezas estimadas nunca bajan de 0.
 */
export function simular({ precioActual, precioNuevo, costo = 0, ritmo = 0, elasticidad = ELASTICIDAD_DEFAULT } = {}) {
  const p0 = num(precioActual), p1 = num(precioNuevo), c = num(costo), r = Math.max(0, num(ritmo)), e = num(elasticidad);
  const deltaPrecioPct = p0 > 0 ? ((p1 - p0) / p0) * 100 : 0;
  const factor = Math.max(0, 1 + (e * deltaPrecioPct) / 100);
  const piezasEstimadas = r * factor;
  const montoActual = r * p0, montoEstimado = piezasEstimadas * p1;
  return {
    deltaPrecioPct,
    conIva: p1 * (1 + IVA),
    margenPct: c > 0 && p1 > 0 ? ((p1 - c) / p1) * 100 : null,
    margenActualPct: c > 0 && p0 > 0 ? ((p0 - c) / p0) * 100 : null,
    piezasActual: r, piezasEstimadas, deltaPiezasPct: (factor - 1) * 100,
    montoActual, montoEstimado, deltaMonto: montoEstimado - montoActual,
    deltaMontoPct: montoActual > 0 ? ((montoEstimado - montoActual) / montoActual) * 100 : null,
  };
}

/**
 * Precio bajo por cliente para UN SKU (misma regla que PanelPrecioBajo: monto/piezas < lista − 0.5 %).
 *   fact:          [{ anio, mes, cliente_nombre, cliente_key, canal, piezas, monto }]
 *   listaDe:       (fila) → nombre de lista que le corresponde
 *   precioDeLista: (lista) → precio efectivo de esa lista (null si no hay)
 *   anio:          sólo ese año · tol: tolerancia (0.995)
 * Por cliente: sólo los meses en que facturó bajo su lista → real (promedio ponderado de esos meses),
 * piezas (suma de esos meses), difPct, dejado y `desde` (primer mes del año en que ocurrió). Orden: más dejado primero.
 */
export function precioBajoPorCliente(fact, { listaDe, precioDeLista, anio, tol = 0.995 } = {}) {
  const by = new Map();
  for (const f of fact || []) {
    if (anio != null && Number(f.anio) !== Number(anio)) continue;
    const piezas = num(f.piezas), monto = num(f.monto);
    if (!(piezas > 0) || !f.cliente_nombre) continue;
    const lista = listaDe(f);
    const precioLista = precioDeLista(lista);
    if (!(precioLista > 0)) continue;
    const real = monto / piezas;
    if (real >= precioLista * tol) continue;
    const k = f.cliente_nombre;
    if (!by.has(k)) by.set(k, { cliente: k, cliente_key: f.cliente_key, lista, precioLista, piezas: 0, monto: 0, desde: null, meses: 0 });
    const it = by.get(k);
    it.piezas += piezas; it.monto += monto; it.meses += 1;
    const m = { anio: Number(f.anio), mes: Number(f.mes) };
    if (!it.desde || idx(m.anio, m.mes) < idx(it.desde.anio, it.desde.mes)) it.desde = m;
  }
  return [...by.values()].map((c) => {
    const real = c.monto / c.piezas;
    return { ...c, real, difPct: ((real - c.precioLista) / c.precioLista) * 100, dejado: (c.precioLista - real) * c.piezas };
  }).sort((a, b) => b.dejado - a.dejado);
}

export const _mesIdx = { idx, deIdx };
