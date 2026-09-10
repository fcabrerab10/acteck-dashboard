// Forecast › Reservas · motor de cálculo puro (sin React, sin Supabase). Se prueba y se reutiliza
// en Reservas y en la captura Forecast CRM.
//
// ── Método de cálculo (velocidad de sell-out mensual por cliente y SKU) ──
// Todas las variantes usan sólo MESES CERRADOS (el mes en curso queda fuera: está incompleto).
//   3m   → promedio simple de los últimos 3 meses cerrados.
//   6m   → promedio simple de los últimos 6 meses cerrados.
//   pond → promedio ponderado de los últimos 6 meses cerrados con pesos 6/5/4/3/2/1
//          (el más reciente pesa 6, el más viejo 1; suma 21). Se eligió la ventana de 6 y no la
//          de 3 para no perder la estacionalidad (Buen Fin / regreso a clases) y a la vez
//          reaccionar a la tendencia reciente.
// SKU nuevo: si el SKU no tiene sell-out registrado al inicio de la ventana, los meses anteriores
// al primer registro NO cuentan (no se promedia contra ceros de antes del lanzamiento). Un mes sin
// fila DESPUÉS del primer registro sí cuenta como 0 (no vendió).
import { normalizar, coincide, mesKey, N, CLIENTE_KEYS, clienteCampo } from './textos';

export const METODOS = [
  { id: '3m',   label: '3 meses',   corto: 'Prom. 3 m',  desc: 'Promedio simple · 3 meses cerrados' },
  { id: '6m',   label: '6 meses',   corto: 'Prom. 6 m',  desc: 'Promedio simple · 6 meses cerrados' },
  { id: 'pond', label: 'Ponderado', corto: 'Pond. 6 m',  desc: 'Ponderado 6/5/4/3/2/1 · 6 meses cerrados' },
];
export const METODO_DEFAULT = '6m';
export const PESOS_POND = [6, 5, 4, 3, 2, 1]; // del más reciente al más viejo
export const metodoInfo = (id) => METODOS.find((m) => m.id === id) || METODOS[1];

/** Últimos `n` meses cerrados (sin el actual), del más viejo al más reciente. */
export function ventanaCerrada(n, hoy = new Date()) {
  const out = [];
  for (let i = n; i >= 1; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    out.push({ anio: d.getFullYear(), mes: d.getMonth() + 1, key: mesKey(d.getFullYear(), d.getMonth() + 1) });
  }
  return out;
}

/** Velocidad mensual (pz/mes, sin redondear) de una serie Map(key 'YYYY-MM' → piezas). */
export function velocidad(serie, metodo, hoy = new Date()) {
  if (!serie || serie.size === 0) return 0;
  const n = metodo === '3m' ? 3 : 6;
  const ventana = ventanaCerrada(n, hoy);
  // Primer mes con registro dentro de la ventana; si el SKU vendía antes de la ventana, cuenta desde el inicio.
  const primeraKey = [...serie.keys()].sort()[0];
  let desde = 0;
  if (primeraKey > ventana[0].key) {
    desde = ventana.findIndex((m) => m.key >= primeraKey);
    if (desde < 0) return 0; // sólo tiene datos del mes en curso o futuros
  }
  let suma = 0, peso = 0;
  for (let i = desde; i < ventana.length; i++) {
    const w = metodo === 'pond' ? PESOS_POND[ventana.length - 1 - i] : 1;
    suma += w * N(serie.get(ventana[i].key));
    peso += w;
  }
  return peso > 0 ? suma / peso : 0;
}

/** ISO 8601: semana → mes del jueves de esa semana (regla ISO: la semana pertenece al mes/año de su jueves). */
export function semanaISOaMes(anio, semana) {
  const jan4 = new Date(anio, 0, 4);
  const lunesW1 = new Date(jan4); lunesW1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const jueves = new Date(lunesW1); jueves.setDate(lunesW1.getDate() + (semana - 1) * 7 + 3);
  return { anio: jueves.getFullYear(), mes: jueves.getMonth() + 1 };
}

const MES_POR_NOMBRE = { ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7, ago: 8, aug: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12 };

/**
 * sellout_pcel (semanal, con "vta_mes_1..3" = meses cerrados anteriores a la semana) → filas mensuales
 * como sellout_sku. Para cada (sku, mes) gana la semana más reciente que lo reporta.
 * Devuelve también el stock (inventario) de la última semana cargada.
 */
export function normalizarPcel(rows) {
  const ult = { anio: 0, semana: 0 };
  for (const r of rows || []) { if (r.anio > ult.anio || (r.anio === ult.anio && r.semana > ult.semana)) { ult.anio = r.anio; ult.semana = r.semana; } }
  const meses = new Map(); // `${sku}|${key}` → { anio, mes, piezas, orden }
  const stock = new Map();
  for (const r of rows || []) {
    if (!r.sku) continue;
    const orden = r.anio * 100 + r.semana;
    if (r.anio === ult.anio && r.semana === ult.semana) stock.set(r.sku, N(r.inventario));
    const { anio: aSem, mes: mSem } = semanaISOaMes(r.anio, r.semana);
    for (const i of [1, 2, 3]) {
      const nombre = String(r[`vta_mes_${i}_nombre`] || '').trim().slice(0, 3).toLowerCase();
      const mes = MES_POR_NOMBRE[nombre];
      if (!mes) continue;
      // El mes cerrado i queda i meses antes del mes de la semana; el año se infiere de ahí.
      let anio = aSem, m = mSem - i;
      while (m <= 0) { m += 12; anio -= 1; }
      if (m !== mes) { // el nombre manda; si no coincide con la cuenta, se ajusta el año por cercanía
        anio = mes > mSem ? aSem - 1 : aSem;
      }
      const k = `${r.sku}|${mesKey(anio, mes)}`;
      const prev = meses.get(k);
      if (!prev || orden > prev.orden) meses.set(k, { anio, mes, piezas: N(r[`vta_mes_${i}`]), orden });
    }
  }
  const ventas = [];
  for (const [k, v] of meses) ventas.push({ cliente: 'pcel', sku: k.split('|')[0], anio: v.anio, mes: v.mes, piezas: v.piezas });
  return { ventas, stock, meta: ult.anio ? ult : null };
}

/** Indexa filas {cliente, sku, anio, mes, piezas} → series por cliente|sku y matriz para el heatmap. */
export function indexarSellout(rows) {
  const series = new Map();  // 'cli|sku' → Map(key → pz)
  const matriz = new Map();  // sku → Map(anio → Map(cli → {mes: pz}))
  const anios = new Set();
  for (const r of rows || []) {
    if (!r.cliente || !r.sku) continue;
    const a = Number(r.anio), m = Number(r.mes);
    if (!a || !m) continue;
    const pz = N(r.piezas);
    const sk = `${r.cliente}|${r.sku}`;
    let s = series.get(sk); if (!s) { s = new Map(); series.set(sk, s); }
    const key = mesKey(a, m);
    s.set(key, (s.get(key) || 0) + pz);
    let bySku = matriz.get(r.sku); if (!bySku) { bySku = new Map(); matriz.set(r.sku, bySku); }
    let byAnio = bySku.get(a); if (!byAnio) { byAnio = new Map(); bySku.set(a, byAnio); }
    const byCli = byAnio.get(r.cliente) || {}; byCli[m] = (byCli[m] || 0) + pz; byAnio.set(r.cliente, byCli);
    anios.add(a);
  }
  return { series, matriz, anios: [...anios].sort((x, y) => y - x) };
}

/** Próximos `n` meses desde hoy (incluido) como [{ key, label }]. */
export function proxMeses(hoy = new Date(), n = 3, MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
    out.push({ key: mesKey(d.getFullYear(), d.getMonth() + 1), label: MESES[d.getMonth()], anio: d.getFullYear(), mes: d.getMonth() + 1 });
  }
  return out;
}

export const fechaEmbarque = (e) => e.arribo_almacen || e.arribo_cedis || e.eta_puerto || null;

/**
 * embarques_compras → arribos por SKU y mes (fallback de fecha: arribo_almacen → arribo_cedis → eta_puerto),
 * próximo arribo por SKU (fecha ≥ hoy), SKUs con arribo en 30 días y próximo arribo global.
 */
export function agruparArribos(embarques, hoy = new Date()) {
  const hoyISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  const lim = new Date(hoy); lim.setDate(lim.getDate() + 30);
  const limISO = `${lim.getFullYear()}-${String(lim.getMonth() + 1).padStart(2, '0')}-${String(lim.getDate()).padStart(2, '0')}`;
  const porSku = new Map(), proxArribo = new Map(), arribo30 = new Set(), pz30 = new Map();
  let proxGlobal = null, futuros = 0;
  for (const e of embarques || []) {
    if (!e.codigo) continue;
    const f = String(fechaEmbarque(e) || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) continue;
    const qty = N(e.shp_qty) || N(e.po_qty);
    const key = f.slice(0, 7);
    const cur = porSku.get(e.codigo) || {}; cur[key] = (cur[key] || 0) + qty; porSku.set(e.codigo, cur);
    if (f >= hoyISO) {
      futuros += 1;
      if (!proxGlobal || f < proxGlobal) proxGlobal = f;
      const p = proxArribo.get(e.codigo); if (!p || f < p) proxArribo.set(e.codigo, f);
      if (f <= limISO) { arribo30.add(e.codigo); pz30.set(e.codigo, (pz30.get(e.codigo) || 0) + qty); }
    }
  }
  return { porSku, proxArribo, arribo30, pz30, proxGlobal, futuros };
}

/** Días de cobertura del stock del cliente a su ritmo de sell-out mensual (null si no hay ritmo). */
export function coberturaDias(stock, velMensual) {
  if (!velMensual || velMensual <= 0) return null;
  return (N(stock) / velMensual) * 30;
}

/** Estado de la fila para el filtro Estado. */
export function estadoFila(fila, linea) {
  const est = linea?.estado;
  if (est && ['confirmado', 'parcial', 'comprado', 'arribado', 'subido_crm'].includes(est)) return 'confirmado';
  if (linea && N(linea.reservo) > 0) return 'en_propuesta';
  if (fila.recomendado > 0) return 'con_brecha';
  return 'sin_sellout';
}

/**
 * Filas de la tabla: una por SKU del roadmap (orden sort_order) con necesidad por cliente según el método.
 * `series` viene de indexarSellout; `arribos` de agruparArribos; `stockClientes` = { cli: Map(sku → stock) }.
 */
export function construirFilas({ roadmap, series, metodo, hoy, arribos, inventarioPorSku, lineas = {}, stockClientes = {}, meses }) {
  const rows = [];
  const vistos = new Set();
  const orden = (roadmap || []).slice().sort((a, b) => (a.sort_order ?? 1e9) - (b.sort_order ?? 1e9));
  for (const rm of orden) {
    if (!rm.sku || vistos.has(rm.sku)) continue;
    vistos.add(rm.sku);
    const vel = {}, nec = {};
    let recomendado = 0;
    for (const ck of CLIENTE_KEYS) {
      const v = velocidad(series.get(`${ck}|${rm.sku}`), metodo, hoy);
      vel[ck] = v; nec[ck] = Math.round(v); recomendado += nec[ck];
    }
    const arr = arribos.porSku.get(rm.sku) || {};
    const arribosPorMes = {};
    for (const m of meses) arribosPorMes[m.key] = arr[m.key] || 0;
    const stock = {};
    for (const ck of CLIENTE_KEYS) stock[ck] = stockClientes[ck]?.get(rm.sku) ?? null;
    const fila = {
      sku: rm.sku,
      descripcion: rm.descripcion || rm.sku,
      marca: rm.marca || '',
      familia: rm.familia || '',
      roadmap: String(rm.rdmp || '').toUpperCase(),
      sort_order: rm.sort_order,
      inventario: inventarioPorSku.get(rm.sku) || 0,
      velocidad: vel,
      necesidad: nec,
      necesidad_dgl: nec.digitalife, necesidad_pce: nec.pcel, necesidad_dct: nec.dicotech,
      recomendado,
      arribosPorMes,
      totalArribos: Object.values(arribosPorMes).reduce((a, b) => a + b, 0),
      proxArribo: arribos.proxArribo.get(rm.sku) || null,
      arribo30: arribos.arribo30.has(rm.sku),
      pz30: arribos.pz30.get(rm.sku) || 0,
      stockCliente: stock,
      indice: normalizar(`${rm.sku} ${rm.descripcion || ''} ${rm.marca || ''} ${rm.familia || ''} ${rm.rdmp || ''}`),
    };
    fila.estado = estadoFila(fila, lineas[rm.sku]);
    fila.conMovimiento = recomendado > 0 || !!lineas[rm.sku];
    rows.push(fila);
  }
  return rows;
}

// ── Filtros facetados (misma mecánica que inventario/filtros.js) ──
export const FILTROS_VACIOS = () => ({ tokens: [], cliente: new Set(), marca: new Set(), familia: new Set(), roadmap: new Set(), estado: new Set(), arribo30: false, soloMovimiento: true });
export const claveMarca = (r) => String(r.marca || '').trim().toLowerCase();
export const claveFamilia = (r) => String(r.familia || '').trim().toLowerCase();
export const claveRoadmap = (r) => String(r.roadmap || '').trim().toUpperCase();

export function pasaGrupo(r, f, g, lineas = {}) {
  switch (g) {
    case 'busqueda': return f.tokens.length === 0 || coincide(r.indice, f.tokens);
    case 'cliente': return f.cliente.size === 0 || [...f.cliente].some((ck) => (r.necesidad[ck] || 0) > 0 || !!lineas[r.sku]);
    case 'marca': return f.marca.size === 0 || f.marca.has(claveMarca(r));
    case 'familia': return f.familia.size === 0 || f.familia.has(claveFamilia(r));
    case 'roadmap': return f.roadmap.size === 0 || f.roadmap.has(claveRoadmap(r));
    case 'estado': return f.estado.size === 0 || f.estado.has(r.estado);
    case 'arribo30': return !f.arribo30 || r.arribo30;
    case 'movimiento': return !f.soloMovimiento || r.conMovimiento;
    default: return true;
  }
}
const GRUPOS = ['busqueda', 'cliente', 'marca', 'familia', 'roadmap', 'estado', 'arribo30', 'movimiento'];
export function pasaTodos(r, f, excluir, lineas) { for (const g of GRUPOS) if (g !== excluir && !pasaGrupo(r, f, g, lineas)) return false; return true; }
export function nActivos(f) { return f.cliente.size + f.marca.size + f.familia.size + f.roadmap.size + f.estado.size + (f.arribo30 ? 1 : 0) + (f.soloMovimiento ? 0 : 0); }

/** Conteos por grupo con los DEMÁS filtros aplicados. */
export function facetas(rows, f, lineas = {}) {
  const cliente = new Map(), marca = new Map(), familia = new Map(), roadmap = new Map(), estado = new Map();
  let arribo30 = 0, movimiento = 0;
  const suma = (m, k, label) => { if (!k) return; const it = m.get(k) || { label, n: 0 }; it.n += 1; m.set(k, it); };
  for (const r of rows) {
    if (pasaTodos(r, f, 'cliente', lineas)) for (const ck of CLIENTE_KEYS) if ((r.necesidad[ck] || 0) > 0 || lineas[r.sku]) suma(cliente, ck, ck);
    if (pasaTodos(r, f, 'marca', lineas)) suma(marca, claveMarca(r), String(r.marca || '').trim());
    if (pasaTodos(r, f, 'familia', lineas)) suma(familia, claveFamilia(r), String(r.familia || '').trim());
    if (pasaTodos(r, f, 'roadmap', lineas)) suma(roadmap, claveRoadmap(r), claveRoadmap(r));
    if (pasaTodos(r, f, 'estado', lineas)) suma(estado, r.estado, r.estado);
    if (pasaTodos(r, f, 'arribo30', lineas) && r.arribo30) arribo30 += 1;
    if (pasaTodos(r, f, 'movimiento', lineas) && r.conMovimiento) movimiento += 1;
  }
  const ordenar = (m) => [...m.entries()].map(([id, v]) => ({ id, label: v.label || id, n: v.n })).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, 'es'));
  return { cliente, marca: ordenar(marca), familia: ordenar(familia), roadmap: ordenar(roadmap), estado, arribo30, movimiento };
}

// ── Forecast CRM ──
/** Ventana de `n` meses desde 'YYYY-MM' → [{ anio, mes, key }]. */
export function ventanaCRM(mesInicio, n = 6) {
  const [a, m] = String(mesInicio).split('-').map(Number);
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(a, m - 1 + i, 1);
    out.push({ anio: d.getFullYear(), mes: d.getMonth() + 1, key: mesKey(d.getFullYear(), d.getMonth() + 1) });
  }
  return out;
}
/** Mes siguiente al actual como 'YYYY-MM' (default del selector). */
export function mesSiguiente(hoy = new Date()) {
  const d = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
  return mesKey(d.getFullYear(), d.getMonth() + 1);
}
/** Sugerencia del motor para la captura: la velocidad redondeada, igual en los 6 meses (Fernando ajusta). */
export function sugerirMeses(velMensual, ventana) {
  const v = Math.max(0, Math.round(N(velMensual)));
  const out = {};
  for (const m of ventana) out[m.key] = v > 0 ? v : null;
  return out;
}

export const MIN_JUSTIFICACION = 15;
/** Valida las filas a exportar: [{ sku, justificacion, meses:{key: n} }] con `roadmapSet`. */
export function validarCRM(filas, roadmapSet) {
  const errores = [];
  const validas = [];
  for (const f of filas) {
    const total = Object.values(f.meses || {}).reduce((a, b) => a + N(b), 0);
    const just = String(f.justificacion || '').trim();
    if (total <= 0 && !just) continue; // fila vacía: no cuenta
    const errs = [];
    if (total <= 0) errs.push('sin piezas');
    if (just.length < MIN_JUSTIFICACION) errs.push(`justificación < ${MIN_JUSTIFICACION} caracteres`);
    if (roadmapSet && !roadmapSet.has(f.sku)) errs.push('SKU fuera del roadmap');
    if (errs.length) errores.push({ sku: f.sku, errores: errs });
    else validas.push(f);
  }
  return { validas, errores };
}
export { clienteCampo };
