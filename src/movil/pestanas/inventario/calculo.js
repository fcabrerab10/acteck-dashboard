// Inventario de la empresa en el celular (3.81.0 · 2026-10-05) · cálculo PURO, sin React ni red.
// Lo prueba scripts/test-inventario-movil-ssr.mjs. Las cifras oficiales (Inv Actual, Días de Inv, vueltas) vienen de
// v_medidas_inventario (medidas del director) ya normalizadas con lib/medidas.js#inventarioDesdeVista; aquí sólo se
// derivan las lecturas de la pantalla: frase del hero, cambio contra el cierre del mes pasado, qué llega este mes,
// serie de 12 meses (inventario al cierre vs venta promedio de 3 meses) y mixes por categoría · marca · almacén.
import { divide, diasInventario } from '../../../lib/medidas.js';
import { marcaDeSku, normalizarMarca } from '../../../lib/marcas.js';
import { ultimosMeses } from '../../../modules/comercial/sellout/calculo.js';
import { filasSkuAnual } from '../sellout/skuAnual.js';

const N = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v));
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const TC_RESPALDO = 17; // [Costo de Compra TC 17] del director, si la medida no trae con qué deducirlo

export const fmtPz = (n) => (n == null || !Number.isFinite(Number(n)) ? '—' : Math.round(Number(n)).toLocaleString('es-MX'));
export const fmtDinero = (n) => {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const a = Math.abs(Number(n)); const s = Number(n) < 0 ? '-' : '';
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}K`;
  return `${s}$${Math.round(a)}`;
};
const plural = (n, uno, varios) => (n === 1 ? uno : varios);

/** Mes anterior a (anio, mes). */
export const mesAnterior = (anio, mes) => (mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 });
const isoMes = (anio, mes) => `${anio}-${String(mes).padStart(2, '0')}`;

/** 3 meses cerrados anteriores a `hoy` (regla de la casa). */
export function mesesCerradosDe(hoy = new Date()) {
  return [1, 2, 3].map((i) => { const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1); return { anio: d.getFullYear(), mes: d.getMonth() + 1 }; });
}

/** Demanda mensual por SKU (pz/mes) desde las filas pivotadas de v_sellin_global_sku_anio y los meses cerrados. */
export function demandaDesdePivot(rows = [], cerrados = []) {
  const m = new Map();
  for (const r of rows) {
    const sku = String(r.sku || '').toUpperCase(); if (!sku) continue;
    const pz = r.piezas || [];
    let s = 0;
    cerrados.forEach((c) => { if (N(r.anio) === c.anio) s += N(pz[c.mes - 1]); });
    if (s) m.set(sku, (m.get(sku) || 0) + s);
  }
  m.forEach((v, k) => m.set(k, v / Math.max(1, cerrados.length)));
  return m;
}

/** Tipo de cambio que usa el director en [Costo de Compra TC 17], deducido de la medida; 17 si no se puede. */
export const tcDe = (medidas) => divide(medidas?.costo_compra_tc17, medidas?.compra_usd_pendiente) || TC_RESPALDO;

/**
 * Qué llega este mes y qué viene en total, por PO (pos = inventario/arribos.js#agruparPorPO).
 * $ = piezas × costo promedio del SKU en nuestro inventario; si el SKU aún no existe (Audive, nuevos),
 * unit_price de embarques_compras (USD) × TC del director. `precios` = Map('PO|SKU' → unit_price USD).
 */
export function llegadas({ pos = [], porSku = new Map(), precios = new Map(), tc = TC_RESPALDO, hoy = new Date() } = {}) {
  const mesHoy = isoMes(hoy.getFullYear(), hoy.getMonth() + 1);
  const vacio = () => ({ piezas: 0, valor: 0, pos: 0, sinPrecio: 0, proximaEta: null });
  const out = { mes: vacio(), total: vacio(), mesLabel: MESES_LARGO[hoy.getMonth()] };
  const suma = (acc, p) => {
    acc.pos += 1;
    if (p.eta && (!acc.proximaEta || p.eta < acc.proximaEta)) acc.proximaEta = p.eta;
    for (const s of p.skus || []) {
      const pz = N(s.piezas); if (!pz) continue;
      acc.piezas += pz;
      const costo = N(porSku.get(s.sku)?.costo);
      const usd = N(precios.get(`${p.po}|${s.sku}`));
      const unit = costo > 0 ? costo : usd > 0 ? usd * tc : 0;
      if (unit > 0) acc.valor += pz * unit; else acc.sinPrecio += pz;
    }
  };
  for (const p of pos) {
    if (!(p.piezas > 0)) continue;
    suma(out.total, p);
    if (p.eta && String(p.eta).slice(0, 7) === mesHoy) suma(out.mes, p);
  }
  return out;
}

/** Cambio de Inv Actual hoy contra el cierre del mes anterior (v_inventario_cv_mes). */
export function cambioMesPasado({ medidas, meses = [], hoy = new Date(), sensible = true } = {}) {
  const ant = mesAnterior(hoy.getFullYear(), hoy.getMonth() + 1);
  const fila = meses.find((m) => N(m.anio) === ant.anio && N(m.mes) === ant.mes);
  const hoyV = sensible ? medidas?.inv_actual : medidas?.inv_actual_piezas;
  const cierre = fila ? (sensible ? fila.inv_cierre_mes : fila.inv_cierre_mes_piezas) : null;
  if (hoyV == null || cierre == null) return { valor: null, pct: null, mesLabel: MESES[ant.mes - 1], fechaCierre: fila?.fecha_cierre || null };
  const valor = N(hoyV) - N(cierre);
  const r = divide(valor, Math.abs(N(cierre)));
  return { valor, pct: r == null ? null : r * 100, mesLabel: MESES[ant.mes - 1], fechaCierre: fila?.fecha_cierre || null };
}

/**
 * Serie de 12 meses para GraficaScrub: inventario al cierre (inv) vs venta promedio mensual de los 3 meses cerrados
 * (cv = CV 3 meses / 3; en piezas si no es sensible). dias = inv / CV3 × 90 (medida del director por mes).
 */
export function serieInventario({ meses = [], hoy = new Date(), sensible = true } = {}) {
  const ventana = ultimosMeses(hoy.getFullYear(), hoy.getMonth() + 1, 12);
  const por = new Map(meses.map((m) => [isoMes(N(m.anio), N(m.mes)), m]));
  const pzVendidas3 = (anio, mes) => {
    let s = 0, n = 0;
    for (let i = 1; i <= 3; i++) { const a = mesAnterior(anio, mes - i + 1); const f = por.get(isoMes(a.anio, a.mes)); if (f && f.piezas_venta_neta != null) { s += N(f.piezas_venta_neta); n += 1; } }
    return n ? s : null;
  };
  return ventana.map((v) => {
    const f = por.get(isoMes(v.anio, v.mes));
    const inv$ = f?.inv_cierre_mes == null ? null : N(f.inv_cierre_mes);
    const invPz = f?.inv_cierre_mes_piezas == null ? null : N(f.inv_cierre_mes_piezas);
    const cv3 = f?.cv_ultimos_3_meses == null ? null : N(f.cv_ultimos_3_meses);
    const pz3 = pzVendidas3(v.anio, v.mes);
    return {
      label: MESES[v.mes - 1], anio: v.anio, mes: v.mes,
      inv: sensible ? inv$ : invPz,
      cv: sensible ? (cv3 == null ? null : cv3 / 3) : (pz3 == null ? null : pz3 / 3),
      dias: inv$ != null && cv3 ? diasInventario(inv$, cv3) : null,
    };
  });
}

/** Mixes del inventario actual por categoría · marca · almacén desde las filas SKU × almacén (en_inv_actual). */
export function mixesInventario(filas = [], roadmap = new Map(), { sensible = true } = {}) {
  const acc = { categoria: new Map(), marca: new Map(), almacen: new Map() };
  const add = (dim, key, v) => { if (!v) return; acc[dim].set(key, (acc[dim].get(key) || 0) + v); };
  for (const r of filas) {
    const v = sensible ? N(r.costoinventario) : N(r.inventario);
    if (v <= 0) continue;
    const d = roadmap.get(r.articulo) || {};
    add('categoria', d.categoria || 'Sin categoría', v);
    add('marca', normalizarMarca(d.marca) || marcaDeSku(r.articulo) || 'Otras', v);
    add('almacen', r.almacen_nombre || (r.no_almacen != null ? `Almacén ${r.no_almacen}` : 'Sin almacén'), v);
  }
  const lista = (m) => [...m.entries()].map(([label, v]) => ({ key: label, label, v })).sort((a, b) => b.v - a.v);
  return { categoria: lista(acc.categoria), marca: lista(acc.marca), almacen: lista(acc.almacen) };
}

/** Frase del hero (sensible: dinero; si no, piezas). */
export function fraseInventario({ res, llega, sensible = true } = {}) {
  const piso = sensible && res?.valor != null ? `${fmtDinero(res.valor)} en piso` : `${fmtPz(res?.piezas)} pz en piso`;
  let s = piso;
  if (res?.diasInv != null) s += `, ${fmtPz(res.diasInv)} días al ritmo de los 3 meses cerrados`;
  const partes = [];
  if (res?.agotados) partes.push(`${fmtPz(res.agotados)} ${plural(res.agotados, 'SKU agotado', 'SKUs agotados')} con demanda`);
  if (llega?.mes?.piezas > 0) partes.push(`${sensible && llega.mes.valor > 0 ? fmtDinero(llega.mes.valor) : `${fmtPz(llega.mes.piezas)} pz`} llegan en ${llega.mesLabel}`);
  else if (llega?.total?.piezas > 0) partes.push(`nada llega en ${llega.mesLabel} (${sensible && llega.total.valor > 0 ? fmtDinero(llega.total.valor) : `${fmtPz(llega.total.piezas)} pz`} en camino)`);
  if (partes.length) s += `; ${partes.join(' y ')}`;
  return `${s}.`;
}

/**
 * Filas de la tabla «Detalle por SKU × 12 meses» (stock al cierre) desde v_inventario_sku_anio, con la forma que pinta
 * DetalleSkuAnual (reusa skuAnual.js#filasSkuAnual) y ordenadas por el último mes con foto, no por la suma.
 */
export function filasStockAnual({ rows = [], hoy = new Date(), roadmap = [] } = {}) {
  const anio = hoy.getFullYear(), mes = hoy.getMonth() + 1;
  const norm = rows.map((r) => ({ sku: r.sku, anio: N(r.anio), monto: r.valor || [], piezas: r.piezas || [] }));
  const filas = filasSkuAnual({ rows: norm, anio, mes, roadmap });
  const ultimo = (arr) => { for (let i = arr.length - 1; i >= 0; i--) if (arr[i]) return arr[i]; return 0; };
  return filas.sort((a, b) => ultimo(b.monto) - ultimo(a.monto) || ultimo(b.piezas) - ultimo(a.piezas));
}

/** Todo lo que pinta la vista, en una llamada (lo usa la pantalla y la prueba). */
export function resumenInventarioM({ res, medidas, meses = [], pos = [], porSku = new Map(), precios = new Map(), filas = [], roadmapMap = new Map(), skuAnio = [], roadmap = [], skuRows = [], hoy = new Date(), sensible = true } = {}) {
  const llega = llegadas({ pos, porSku, precios, tc: tcDe(medidas), hoy });
  const cambio = cambioMesPasado({ medidas, meses, hoy, sensible });
  const serie = serieInventario({ meses, hoy, sensible });
  const mixes = mixesInventario(filas, roadmapMap, { sensible });
  const agotados = skuRows.filter((r) => r.agotado).sort((a, b) => b.demandaMes - a.demandaMes);
  const tabla = filasStockAnual({ rows: skuAnio, hoy, roadmap });
  return {
    hoy, sensible, res, medidas, llega, cambio, serie, mixes, agotados, tabla,
    frase: fraseInventario({ res, llega, sensible }),
    vueltas: medidas?.vueltas_inv ?? null,
    mesLabel: MESES[hoy.getMonth()],
  };
}
