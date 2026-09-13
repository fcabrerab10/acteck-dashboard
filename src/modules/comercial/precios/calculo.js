// Estrategia de Precios · cálculo puro (sin React): filas SKU × listas, filtros facetados,
// precio bajo accionable, margen por lista (sensible), cambios del mes y análisis del drill.
// Elasticidad / simulador / precio bajo por SKU: ./elasticidad.js (sin imports, con test en scripts/test-precios-elasticidad.mjs).
import { LISTAS, MAX_COLUMNAS_LISTA, ordenarListas, listaDeCliente, normalizar, tokens as tokenizar, coincide, N, mesesCerrados } from './textos';
import { precioBajoPorCliente as _precioBajoPorCliente } from './elasticidad';

// ── Filtros ──
// f = { q, tokens, marca:Set, categoria:Set, roadmap:Set, listas:Set (columnas visibles; vacío = todas), conPromo, precioBajo, sinPrecio }
export const FILTROS_VACIOS = () => ({ q: '', tokens: [], marca: new Set(), categoria: new Set(), roadmap: new Set(), listas: new Set(), conPromo: false, precioBajo: false, sinPrecio: false });
export const conBusqueda = (f, q) => ({ ...f, q, tokens: tokenizar(q) });
export const nActivos = (f) => f.marca.size + f.categoria.size + f.roadmap.size + f.listas.size + (f.conPromo ? 1 : 0) + (f.precioBajo ? 1 : 0) + (f.sinPrecio ? 1 : 0);

/**
 * Listas que realmente vienen en los datos (precios_sku → v_estrategia_precios_lista), en el orden
 * del catálogo y con las desconocidas al final. Desde 2026-09-12 el puente carga 10 listas en vez de 5:
 * la pantalla NO las trae en duro, se descubren aquí.
 */
export const listasDeDatos = (precios) => ordenarListas((precios || []).map((p) => p.lista));

/**
 * Columnas de lista visibles en la tabla. Sin filtro se muestran las primeras MAX_COLUMNAS_LISTA
 * (regla de ancho: la tabla tiene que caber en la tarjeta sin scroll horizontal); con el filtro
 * "Listas" se ve exactamente lo que el usuario marque. El drill y el Excel siempre llevan todas.
 */
export const listasVisibles = (f, listas = LISTAS) => (f.listas.size ? listas.filter((l) => f.listas.has(l)) : listas.slice(0, MAX_COLUMNAS_LISTA));

const GRUPOS = ['busqueda', 'marca', 'categoria', 'roadmap', 'conPromo', 'precioBajo', 'sinPrecio'];
export function pasaGrupo(r, f, g) {
  switch (g) {
    case 'busqueda': return f.tokens.length === 0 || coincide(r.indice, f.tokens);
    case 'marca': return f.marca.size === 0 || f.marca.has(r.marca || '');
    case 'categoria': return f.categoria.size === 0 || f.categoria.has(r.categoria || '');
    case 'roadmap': return f.roadmap.size === 0 || f.roadmap.has(r.rdmp || '');
    case 'conPromo': return !f.conPromo || !!r.promo;
    case 'precioBajo': return !f.precioBajo || !!r.bajo;
    case 'sinPrecio': return !f.sinPrecio || r.sinPrecio;
    default: return true;
  }
}
export function pasaTodos(r, f, excluir) {
  for (const g of GRUPOS) if (g !== excluir && !pasaGrupo(r, f, g)) return false;
  return true;
}
/** Conteos con los DEMÁS filtros aplicados ("si además marco esto, quedan N"). `listas` cuenta SKUs con precio en esa lista. */
export function facetas(rows, f, todasLasListas = LISTAS) {
  const marca = new Map(), categoria = new Map(), roadmap = new Map(), listas = new Map(todasLasListas.map((l) => [l, 0]));
  let conPromo = 0, precioBajo = 0, sinPrecio = 0;
  const suma = (m, k) => { if (!k) return; m.set(k, (m.get(k) || 0) + 1); };
  for (const r of rows) {
    if (pasaTodos(r, f, 'marca')) suma(marca, r.marca);
    if (pasaTodos(r, f, 'categoria')) suma(categoria, r.categoria);
    if (pasaTodos(r, f, 'roadmap')) suma(roadmap, r.rdmp);
    if (pasaTodos(r, f, 'conPromo') && r.promo) conPromo += 1;
    if (pasaTodos(r, f, 'precioBajo') && r.bajo) precioBajo += 1;
    if (pasaTodos(r, f, 'sinPrecio') && r.sinPrecio) sinPrecio += 1;
    if (pasaTodos(r, f, null)) for (const l of todasLasListas) if (r.precios[l] != null) listas.set(l, listas.get(l) + 1);
  }
  const ordenar = (m) => [...m.entries()].map(([id, n]) => ({ id, label: id, n })).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, 'es'));
  return { marca: ordenar(marca), categoria: ordenar(categoria), roadmap: ordenar(roadmap), listas, conPromo, precioBajo, sinPrecio };
}

// ── Filas ──
const TOL_BAJO = 0.995; // 0.5 % de tolerancia: precio_bajo viene redondeado a 2 decimales

/** Precio efectivo de una lista: Mayoreo AAA neto de promo (las demás listas ya vienen con promo aplicada, según Fernando). */
export function precioEfectivo(precios, promo, lista) {
  const p = precios?.[lista];
  if (p == null) return null;
  return lista === 'Mayoreo AAA' && promo ? p * (1 - N(promo.promo_pct)) : p;
}

/** Combina promos activas del mes por SKU (multiplicativo: (1-p1)(1-p2)). */
export function mapaPromos(promos) {
  const m = new Map();
  for (const p of promos || []) {
    if (!m.has(p.sku)) m.set(p.sku, { promos: [], factor: 1 });
    const it = m.get(p.sku); it.promos.push(p); it.factor *= 1 - N(p.promo_pct);
  }
  for (const it of m.values()) {
    it.promo_pct = 1 - it.factor;
    it.campania = it.promos.length === 1 ? it.promos[0].campania : `${it.promos.length} promos activas`;
  }
  return m;
}

/**
 * Filas de la tabla a partir de roadmap + precios + bajo + promos + costos (sensible) + cambios del mes.
 * Precio bajo = el cliente más bajo del año (v_estrategia_precios_bajo, ≥ 50 pz) facturó por debajo de
 * la lista que le corresponde (con 0.5 % de tolerancia). "Dejado en la mesa" = (lista − real) × piezas.
 */
export function construirFilas({ roadmap, precios, bajos, promos, costos, cambios, listas }) {
  const LS = listas?.length ? listas : listasDeDatos(precios);
  const preciosMap = new Map();
  for (const p of precios || []) { if (!preciosMap.has(p.sku)) preciosMap.set(p.sku, {}); preciosMap.get(p.sku)[p.lista] = N(p.precio); }
  const bajoMap = new Map((bajos || []).map((b) => [b.sku, b]));
  const promoMap = mapaPromos(promos);
  // [Costo Promedio] del director, 1 fila por SKU (v_medidas_inventario_sku).
  const costoMap = new Map((costos || []).map((c) => [c.articulo ?? c.sku, N(c.costo_promedio)]));
  const cambioMap = new Map();
  for (const c of cambios || []) { if (!cambioMap.has(c.sku)) cambioMap.set(c.sku, {}); cambioMap.get(c.sku)[c.lista] = c; }

  return (roadmap || []).map((r) => {
    const pr = preciosMap.get(r.sku) || {};
    const promo = promoMap.get(r.sku) || null;
    const costo = costoMap.get(r.sku) || 0;
    const margen = {};
    if (costo > 0) for (const l of LS) { const p = precioEfectivo(pr, promo, l); if (p > 0) margen[l] = ((p - costo) / p) * 100; }
    let bajo = null;
    const b = bajoMap.get(r.sku);
    if (b && N(b.precio_bajo) > 0) {
      const lista = listaDeCliente({ cliente_nombre: b.cliente_bajo });
      const precioLista = precioEfectivo(pr, promo, lista);
      if (precioLista > 0 && N(b.precio_bajo) < precioLista * TOL_BAJO) {
        const real = N(b.precio_bajo), piezas = N(b.piezas_bajo);
        bajo = { cliente: b.cliente_bajo, lista, real, precioLista, piezas, difPct: ((real - precioLista) / precioLista) * 100, dejado: (precioLista - real) * piezas };
      }
    }
    const nListas = LS.filter((l) => pr[l] != null).length;
    return {
      ...r,
      indice: normalizar([r.sku, r.descripcion, r.marca, r.categoria, r.familia, r.rdmp].filter(Boolean).join(' ')),
      precios: pr, promo, costo, margen, bajo, cambios: cambioMap.get(r.sku) || {},
      nListas, sinPrecio: nListas < LS.length, conPrecio: nListas > 0,
    };
  });
}

/** KPIs de la pantalla sobre las filas visibles. */
export function resumen(filas, { anio, mes } = {}) {
  let conPrecio = 0, nBajo = 0, dejado = 0, subieron = 0, bajaron = 0, sinPrecio = 0, promos = 0, mSum = 0, mN = 0;
  for (const r of filas) {
    if (r.conPrecio) conPrecio += 1;
    if (r.sinPrecio) sinPrecio += 1;
    if (r.promo) promos += 1;
    if (r.bajo) { nBajo += 1; dejado += r.bajo.dejado; }
    if (r.margen['Mayoreo AAA'] != null) { mSum += r.margen['Mayoreo AAA']; mN += 1; }
    for (const c of Object.values(r.cambios)) {
      if (anio && (c.anio !== anio || c.mes !== mes)) continue;
      if (c.tipo === 'subio') subieron += 1; else if (c.tipo === 'bajo') bajaron += 1;
    }
  }
  return { conPrecio, sinPrecio, promos, nBajo, dejado, subieron, bajaron, margenAAA: mN ? mSum / mN : null, margenN: mN };
}

/** Filas del panel "Precio bajo accionable". */
export const filasPrecioBajo = (filas) => filas.filter((r) => r.bajo).map((r) => ({
  sku: r.sku, descripcion: r.descripcion, marca: r.marca, cliente: r.bajo.cliente, lista: r.bajo.lista,
  real: r.bajo.real, precioLista: r.bajo.precioLista, difPct: r.bajo.difPct, piezas: r.bajo.piezas, dejado: r.bajo.dejado,
}));

/** Orden por columna (null → orden del roadmap). */
export function ordenar(filas, orden) {
  if (!orden?.col) return filas;
  const { col, dir } = orden;
  const val = (r) => (col.startsWith('p:') ? r.precios[col.slice(2)] : col === 'bajo' ? r.bajo?.real : col === 'margenAAA' ? r.margen['Mayoreo AAA'] : r[col]);
  const s = dir === 'asc' ? 1 : -1;
  return [...filas].sort((a, b) => {
    const va = val(a), vb = val(b);
    if (va == null && vb == null) return 0; if (va == null) return 1; if (vb == null) return -1;
    return (typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'es')) * s;
  });
}

// ── Drill ──
/** Precio real promedio facturado por cliente en los 3 meses cerrados vs la lista que le corresponde. */
export function precioRealPorCliente(fact, precios, promo) {
  const cerrados = mesesCerrados(3); const setC = new Set(cerrados.map((m) => m.key));
  const by = new Map();
  for (const f of fact || []) {
    if (!setC.has(`${f.anio}-${Number(f.mes)}`) || !f.cliente_nombre) continue;
    const k = f.cliente_nombre;
    if (!by.has(k)) by.set(k, { cliente: k, cliente_key: f.cliente_key, canal: f.canal, piezas: 0, monto: 0 });
    const it = by.get(k); it.piezas += N(f.piezas); it.monto += N(f.monto);
  }
  return [...by.values()].filter((c) => c.piezas > 0).map((c) => {
    const lista = listaDeCliente(c);
    const precioLista = precioEfectivo(precios, promo, lista);
    const real = c.monto / c.piezas;
    return { ...c, lista, real, precioLista, difPct: precioLista > 0 ? ((real - precioLista) / precioLista) * 100 : null };
  }).sort((a, b) => b.piezas - a.piezas);
}

/** Serie mensual para el LineChart (una clave por lista) + lista de cambios detectados + desde cuándo hay histórico. */
export function serieHistorico(historico, listas) {
  const porPeriodo = new Map();
  let desde = null;
  for (const h of historico || []) {
    const key = `${h.anio}-${String(h.mes).padStart(2, '0')}`;
    if (!porPeriodo.has(key)) porPeriodo.set(key, { key, anio: Number(h.anio), mes: Number(h.mes) });
    porPeriodo.get(key)[h.lista] = N(h.precio);
    if (h.primera_vez && (!desde || h.primera_vez < desde)) desde = h.primera_vez;
  }
  const serie = [...porPeriodo.values()].sort((a, b) => a.key.localeCompare(b.key));
  const cambios = [];
  // Las listas salen del propio histórico (no de un arreglo en duro): así aparecen las que sume el puente.
  for (const l of (listas?.length ? listas : ordenarListas((historico || []).map((h) => h.lista)))) {
    let prev = null;
    for (const p of serie) {
      const v = p[l]; if (v == null) continue;
      if (prev && prev.v !== v) cambios.push({ lista: l, anio: p.anio, mes: p.mes, de: prev.v, a: v, deltaPct: prev.v ? ((v - prev.v) / prev.v) * 100 : null });
      prev = { v, key: p.key };
    }
  }
  cambios.sort((a, b) => b.anio - a.anio || b.mes - a.mes);
  return { serie, cambios, desde, meses: serie.length };
}

/** Disponibilidad hoy: disponible + próximo arribo (v_transito_sku.embarques_detalle). */
export function disponibilidad(inv, tr, hoyISO = new Date().toISOString().slice(0, 10)) {
  const det = (Array.isArray(tr?.embarques_detalle) ? tr.embarques_detalle : []).filter((e) => N(e.cantidad) > 0).sort((a, b) => String(a.eta || '9999').localeCompare(String(b.eta || '9999')));
  const proximo = det.find((e) => e.eta && e.eta >= hoyISO) || det.find((e) => e.eta) || null;
  return {
    disponible: N(inv?.disponible), inventario: N(inv?.inventario), enCamino: N(tr?.cantidad),
    proximoArribo: proximo ? { fecha: proximo.eta, piezas: N(proximo.cantidad), po: proximo.po } : null,
  };
}

// ── Elasticidad · simulador · precio bajo por SKU (funciones puras en ./elasticidad.js, probadas en Node) ──
export { elasticidadSku, elasticidadPorCategoria, elegirElasticidad, ritmoMensual, simular, ELASTICIDAD_DEFAULT, VENTANA_MESES } from './elasticidad';

/** Cambios de v_precios_cambios ({sku, lista, anio, mes, precio_anterior, precio_nuevo}) → Map sku → [{lista, anio, mes, de, a}]. */
export function cambiosPorSku(cambios) {
  const m = new Map();
  for (const c of cambios || []) {
    if (!m.has(c.sku)) m.set(c.sku, []);
    m.get(c.sku).push({ lista: c.lista, anio: Number(c.anio), mes: Number(c.mes), de: N(c.precio_anterior), a: N(c.precio_nuevo) });
  }
  return m;
}

/** Facturación por sku/mes ({sku, anio, mes, piezas}) → Map sku → [{anio, mes, piezas}]. */
export function factPorSku(filas) {
  const m = new Map();
  for (const f of filas || []) { if (!m.has(f.sku)) m.set(f.sku, []); m.get(f.sku).push({ anio: f.anio, mes: f.mes, piezas: f.piezas }); }
  return m;
}

/** Precio bajo por cliente del SKU abierto (misma regla que PanelPrecioBajo: real < lista − 0.5 %), año en curso. */
export function precioBajoSku(fact, precios, promo, anio) {
  return _precioBajoPorCliente(fact, { listaDe: listaDeCliente, precioDeLista: (l) => precioEfectivo(precios, promo, l), anio, tol: TOL_BAJO });
}
