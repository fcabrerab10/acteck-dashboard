// Estrategia de Precios del celular (3.82.0 · 2026-10-05) · cálculo puro del hero y los KPIs. Sin React ni red.
// Entra lo que ya calcula la web (precios/calculo.js#construirFilas: precios por lista, margen por lista con el
// costo promedio del director, precio bajo del año por SKU, cambios del mes) + la venta por SKU del año
// (v_sellin_global_sku_anio: monto[12]) para ponderar el margen por lo que realmente se vendió en el mes.
//   resumenPrecios({ filas, skuAnio, anio, mes, margenMinimo, lista, sensible }) → { mesUsado, margen, bajo, cambios, frase, … }
// Regla: los % nunca se promedian a secas; el margen del mes es Σ margen_sku × venta_sku / Σ venta_sku.
import { resumen as resumenWeb, filasPrecioBajo } from '../../../modules/comercial/precios/calculo';
import { moneyCompact } from '../../../lib/format.js';

const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const N = (v) => Number(v) || 0;
export const LISTA_PRINCIPAL = 'Mayoreo AAA';
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Venta del mes por SKU (Map sku → monto) a partir de v_sellin_global_sku_anio; si el mes no tiene venta, cae al anterior. */
export function ventaDelMes(skuAnio = [], anio, mes) {
  const suma = (a, m) => { const out = new Map(); for (const r of skuAnio) { if (Number(r.anio) !== a) continue; const v = N(r.monto?.[m - 1]); if (v > 0) out.set(r.sku, (out.get(r.sku) || 0) + v); } return out; };
  let a = anio, m = mes;
  let venta = suma(a, m);
  if (venta.size === 0) { m -= 1; if (m === 0) { m = 12; a -= 1; } venta = suma(a, m); }
  return { venta, anio: a, mes: m, esOtroMes: a !== anio || m !== mes };
}

export function resumenPrecios({ filas = [], skuAnio = [], anio, mes, margenMinimo = 15, lista = LISTA_PRINCIPAL, sensible = false } = {}) {
  const hoy = new Date();
  const A = anio || hoy.getFullYear(), M = mes || hoy.getMonth() + 1;
  const { venta, anio: aU, mes: mU, esOtroMes } = ventaDelMes(skuAnio, A, M);
  const r = resumenWeb(filas, { anio: A, mes: M, listaMargen: lista });

  // Margen del mes ponderado por venta (sólo SKUs con margen en la lista principal y venta en el mes).
  let num = 0, den = 0, ponderados = 0, bajoMinimo = 0, vendidosConMargen = 0, vendidos = 0;
  for (const f of filas) {
    const v = venta.get(f.sku);
    if (!(v > 0)) continue;
    vendidos += 1;
    const mg = f.margen?.[lista];
    if (mg == null) continue;
    vendidosConMargen += 1;
    num += mg * v; den += v; ponderados += 1;
    if (mg < margenMinimo) bajoMinimo += 1;
  }
  const margen = { pct: den > 0 ? num / den : null, skus: ponderados, bajoMinimo, vendidos, vendidosConMargen, lista, minimo: margenMinimo };
  const topBajo = filasPrecioBajo(filas).sort((a, b) => b.dejado - a.dejado).slice(0, 20);
  const bajo = { skus: r.nBajo, dejado: r.dejado, top: topBajo };
  const cambios = { subieron: r.subieron, bajaron: r.bajaron, total: r.subieron + r.bajaron, conPrecio: r.conPrecio, sinPrecio: r.sinPrecio, promos: r.promos };

  const mesTxt = MESES_LARGO[mU - 1];
  const bajoTxt = bajo.skus > 0
    ? `${bajo.skus} SKU${bajo.skus === 1 ? '' : 's'} se ${bajo.skus === 1 ? 'facturó' : 'facturaron'} debajo de su lista en el año (${moneyCompact(bajo.dejado)} dejados en la mesa)`
    : 'ningún SKU se facturó debajo de su lista en el año';
  let frase;
  if (sensible && margen.pct != null) {
    const bm = margen.bajoMinimo > 0 ? `${margen.bajoMinimo} de los ${margen.vendidosConMargen} vendidos quedan bajo tu mínimo de ${margenMinimo} %` : `ninguno de los ${margen.vendidosConMargen} vendidos queda bajo tu mínimo de ${margenMinimo} %`;
    frase = `${cap(mesTxt)} ${esOtroMes ? 'cerró' : 'va'} con ${margen.pct.toFixed(1)} % de margen en ${lista} ponderado por venta; ${bajoTxt} y ${bm}.`;
  } else if (sensible) {
    frase = `Sin venta en ${mesTxt} para ponderar el margen; ${bajoTxt}.`;
  } else {
    const c = cambios.total > 0 ? `En ${mesTxt} cambiaron de precio ${cambios.total} SKU${cambios.total === 1 ? '' : 's'} (${cambios.subieron} subieron, ${cambios.bajaron} bajaron)` : `En ${mesTxt} no hubo cambios de precio`;
    frase = `${c}; ${bajoTxt}.`;
  }
  return { anio: A, mes: M, mesUsado: { anio: aU, mes: mU, esOtroMes, label: `${cap(mesTxt)} ${aU}` }, margen, bajo, cambios, frase };
}

/** Línea de la propuesta a partir de un cálculo de la calculadora (forma canónica de propuestas/recientes.js). Sin costo: nunca viaja en el jsonb. */
export function lineaDesdeCalculo({ sku, descripcion = '', marca = '', familia = '', lista, precioLista, piezas, precioNeto, descuentoPct }) {
  const custom = N(descuentoPct) !== 0 || N(precioNeto) !== N(precioLista);
  const l = { sku, piezas: N(piezas), precio: N(precioNeto), lista: custom ? null : (lista || null), descripcion, marca, familia, listaBase: lista || null, precioLista: N(precioLista), descuentoPct: N(descuentoPct) };
  if (custom) l.custom = true;
  return l;
}

/** Descuento mostrado de una línea guardada: el capturado o, si no viene, el que resulte de precio vs lista. */
export function descuentoLinea(l) {
  if (l?.descuentoPct != null) return N(l.descuentoPct);
  const pl = N(l?.precioLista);
  return pl > 0 ? Math.round((1 - N(l.precio) / pl) * 1000) / 10 : 0;
}
