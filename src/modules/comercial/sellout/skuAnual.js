// Detalle por SKU × 12 meses de la EMPRESA (celular, 2026-10-05) · puro, sin React ni red.
// Entrada: filas «sku × año con los 12 meses pivotados» (v_sellout_sku_anio o v_sellin_global_sku_anio,
// ya normalizadas por el hook a { sku, anio, marca?, categoria?, monto:[12], piezas:[12] }) + roadmap.
// Salida: una fila por SKU con los últimos 12 meses que terminan en (anio, mes) y los mismos 12 del año
// anterior (columna Δ de TablaAnual), descripción · marca · categoría del roadmap (si no está, de la fuente).
import { ultimosMeses } from '../../../modules/comercial/sellout/calculo.js';
import { marcaDeSku, normalizarMarca } from '../../../lib/marcas.js';

const N = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v));
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** Etiquetas de las 12 columnas («Oct 25 … Sep 26»; sólo el mes si la ventana es un año natural). */
export function columnasVentana(anio, mes) {
  const v = ultimosMeses(anio, mes, 12);
  const unAnio = v[0].mes === 1;
  return v.map((m) => (unAnio ? MESES[m.mes - 1] : `${MESES[m.mes - 1]} ${String(m.anio).slice(2)}`));
}

/**
 * @param {object} p
 * @param {Array}  p.rows     filas sku × año normalizadas (monto[12], piezas[12])
 * @param {number} p.anio     último mes de la ventana
 * @param {number} p.mes
 * @param {Array}  p.roadmap  roadmap_sku (sku, descripcion, marca, categoria)
 * @returns {Array} [{ sku, descripcion, marca, categoria, monto, piezas, montoPrev, piezasPrev, total, totalPz }] por monto desc
 */
export function filasSkuAnual({ rows = [], anio, mes, roadmap = [] }) {
  const ventana = ultimosMeses(anio, mes, 12);
  const rd = new Map(roadmap.map((r) => [String(r.sku || '').toUpperCase(), r]));
  const porSku = new Map();
  for (const r of rows) {
    const k = String(r.sku || '').toUpperCase();
    if (!k) continue;
    let o = porSku.get(k);
    if (!o) { o = { sku: k, anios: new Map(), marca: r.marca, categoria: r.categoria }; porSku.set(k, o); }
    o.anios.set(N(r.anio), r);
  }
  const celda = (o, a, m, campo) => { const r = o.anios.get(a); const v = r?.[campo]?.[m - 1]; return v == null ? null : N(v); };
  const tieneAnio = (o, a) => o.anios.has(a);
  const out = [];
  for (const o of porSku.values()) {
    const monto = ventana.map((v) => celda(o, v.anio, v.mes, 'monto') ?? 0);
    const piezas = ventana.map((v) => celda(o, v.anio, v.mes, 'piezas') ?? 0);
    const total = monto.reduce((s, v) => s + v, 0), totalPz = piezas.reduce((s, v) => s + v, 0);
    if (!total && !totalPz) continue;
    // Año anterior: sólo si hay datos cargados de TODOS los años que toca la ventana previa; si no, sin Δ.
    const aniosPrev = [...new Set(ventana.map((v) => v.anio - 1))];
    const hayPrev = aniosPrev.some((a) => tieneAnio(o, a));
    const montoPrev = hayPrev ? ventana.map((v) => celda(o, v.anio - 1, v.mes, 'monto') ?? 0) : null;
    const piezasPrev = hayPrev ? ventana.map((v) => celda(o, v.anio - 1, v.mes, 'piezas') ?? 0) : null;
    const r = rd.get(o.sku);
    out.push({
      sku: o.sku,
      descripcion: r?.descripcion || '',
      marca: normalizarMarca(r?.marca || o.marca) || marcaDeSku(o.sku) || '',
      categoria: r?.categoria || o.categoria || '',
      enRoadmap: !!r,
      monto, piezas, montoPrev, piezasPrev, total, totalPz,
    });
  }
  return out.sort((a, b) => b.total - a.total);
}

/** Categorías distintas del roadmap (para que el buscador las reconozca). */
export const categoriasDe = (roadmap = []) => [...new Set(roadmap.map((r) => String(r.categoria || '').trim()).filter(Boolean))].sort();

/** Σ de los meses de un período dentro de un array pivotado (meses 1..12). */
export const sumaMeses = (arr, meses) => (meses || []).reduce((s, m) => s + N(arr?.[m - 1]), 0);
