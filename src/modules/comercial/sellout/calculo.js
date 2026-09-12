// Sell Out consolidado · cálculo puro (sin React, sin layout).
// Lo usa la pantalla web (SellOutGlobal) y lo podrá usar la app móvil sin arrastrar UI.
// Pruebas: node --test src/modules/comercial/sellout/calculo.test.mjs
//
// Formas de entrada (tal como salen de Postgres, ver supabase/migrations/20260912_sellout_global_*.sql):
//   filaDia     { cuenta, anio, mes, dia, importe, cantidad }              mv_sellout_cuenta_dia
//   filaMes     { cuenta, nombre, canal_sellout, erp_cliente, propio,      v_sellout_cuenta_mes
//                 granularidad, anio, mes, importe, cantidad, sell_in,
//                 clientes_finales, vendedores, sucursales, facturas,
//                 importe_sin_estado, importe_sin_cliente,
//                 inv_valor, inv_piezas, inv_skus, inv_semana,
//                 cf_activos, cf_nuevos, cf_perdidos, cf_recompra_pct, cf_ticket,
//                 vend_activos, vend_nuevos, vend_perdidos, vend_recurrentes }
//
// Regla del MTD: `dia = 0` es el centinela de las fuentes sin detalle diario (mostrador +
// e-commerce, que vienen de facturación mensual). Esas filas SIEMPRE entran, de modo que el
// YoY compara mes completo contra mes completo para ellas y día a día para las demás.

export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export const CANALES = [
  { id: 'mayoreo', label: 'Mayoreo', tone: 'purple' },
  { id: 'distribuidor', label: 'Distribuidores', tone: 'blue' },
  { id: 'directo', label: 'Directo', tone: 'teal' },
];
export const canalLabel = (c) => CANALES.find((x) => x.id === c)?.label || 'Otros';
export const canalTone = (c) => CANALES.find((x) => x.id === c)?.tone || 'gray';

export const N = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v));
/** Índice absoluto de mes: permite restar meses sin pelear con diciembre. */
export const idxMes = (anio, mes) => anio * 12 + (mes - 1);
export const deIdx = (i) => ({ anio: Math.floor(i / 12), mes: (i % 12) + 1 });
/** % de variación; null cuando no hay base contra la cual comparar. */
export const yoy = (act, prev) => (prev ? ((act - prev) / Math.abs(prev)) * 100 : null);
export const ratio = (a, b) => (b ? (a / b) * 100 : null);

/** Últimos `n` meses terminando en (anio, mes), del más viejo al más nuevo. */
export function ultimosMeses(anio, mes, n = 12) {
  const fin = idxMes(anio, mes);
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(deIdx(fin - i));
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Acumulados desde el detalle diario
// ─────────────────────────────────────────────────────────────────────────────

/**
 * MTD por cuenta: suma de un mes hasta el día de corte (incluido).
 * @returns Map cuenta → { importe, cantidad }
 */
export function mtdPorCuenta(dias, anio, mes, corteDia = 31) {
  const out = new Map();
  for (const r of dias || []) {
    if (N(r.anio) !== anio || N(r.mes) !== mes) continue;
    const d = N(r.dia);
    if (d !== 0 && d > corteDia) continue;
    const k = r.cuenta;
    const acc = out.get(k) || { importe: 0, cantidad: 0 };
    acc.importe += N(r.importe); acc.cantidad += N(r.cantidad);
    out.set(k, acc);
  }
  return out;
}

/**
 * YTD por cuenta: enero…mes-1 completos + el mes en curso hasta el día de corte.
 * @returns Map cuenta → { importe, cantidad }
 */
export function ytdPorCuenta(dias, anio, mes, corteDia = 31) {
  const out = new Map();
  for (const r of dias || []) {
    if (N(r.anio) !== anio) continue;
    const m = N(r.mes);
    if (m > mes) continue;
    const d = N(r.dia);
    if (m === mes && d !== 0 && d > corteDia) continue;
    const k = r.cuenta;
    const acc = out.get(k) || { importe: 0, cantidad: 0 };
    acc.importe += N(r.importe); acc.cantidad += N(r.cantidad);
    out.set(k, acc);
  }
  return out;
}

/** Total de un Map de acumulados, opcionalmente acotado a un conjunto de cuentas. */
export function totalDe(mapa, cuentas = null) {
  let importe = 0, cantidad = 0;
  for (const [k, v] of mapa) {
    if (cuentas && !cuentas.has(k)) continue;
    importe += v.importe; cantidad += v.cantidad;
  }
  return { importe, cantidad };
}

/** Último día con venta en (anio, mes); 0 si no hubo. Ignora el centinela dia = 0. */
export function ultimoDiaConVenta(dias, anio, mes) {
  let max = 0;
  for (const r of dias || []) {
    if (N(r.anio) !== anio || N(r.mes) !== mes) continue;
    const d = N(r.dia);
    if (d > max) max = d;
  }
  return max;
}

/** Último (anio, mes) con sell out en los datos; null si no hay. */
export function ultimoMesConVenta(dias) {
  let mejor = null;
  for (const r of dias || []) {
    if (!N(r.importe)) continue;
    const i = idxMes(N(r.anio), N(r.mes));
    if (mejor == null || i > mejor) mejor = i;
  }
  return mejor == null ? null : deIdx(mejor);
}

// ─────────────────────────────────────────────────────────────────────────────
// Inventario y cobertura
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Semanas de inventario al ritmo del sell out de los últimos 3 meses.
 * Se calcula en PIEZAS (mezclar valor de inventario a costo con sell out a precio de
 * venta daría una cobertura falsa). 3 meses ≈ 13 semanas.
 */
export function semanasInventario(piezasInv, piezasSellOut3m) {
  const inv = N(piezasInv), ritmo = N(piezasSellOut3m) / 13;
  if (!inv || ritmo <= 0) return null;
  return inv / ritmo;
}

/**
 * Suma de un campo de `filaMes` en N meses terminando en (anio, mes).
 * `desplazar` corre la ventana hacia atrás: 1 = los N meses CERRADOS anteriores
 * (el mes en curso va incompleto y hundiría el ritmo del sell out).
 */
export function sumaUltimosMeses(mensual, cuenta, anio, mes, n = 3, campo = 'cantidad', desplazar = 0) {
  const hasta = idxMes(anio, mes) - desplazar, desde = hasta - (n - 1);
  let s = 0;
  for (const r of mensual || []) {
    if (cuenta && r.cuenta !== cuenta) continue;
    const i = idxMes(N(r.anio), N(r.mes));
    if (i >= desde && i <= hasta) s += N(r[campo]);
  }
  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// Filas de la tabla
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Una fila por cuenta con todo lo que pinta la tabla.
 *
 * @param {object}  p
 * @param {Array}   p.cuentas   v_sellout_cuentas
 * @param {Array}   p.mensual   v_sellout_cuenta_mes (los dos años)
 * @param {Array}   p.dias      mv_sellout_cuenta_dia (los dos años)
 * @param {number}  p.anio      año en curso de la pantalla
 * @param {number}  p.mes       mes seleccionado
 * @param {number}  p.corteDia  día de corte del MTD (último día con venta del mes)
 */
export function construirFilas({ cuentas = [], mensual = [], dias = [], anio, mes, corteDia = 31 }) {
  const mtdAct = mtdPorCuenta(dias, anio, mes, corteDia);
  const mtdPrev = mtdPorCuenta(dias, anio - 1, mes, corteDia);
  const ytdAct = ytdPorCuenta(dias, anio, mes, corteDia);
  const ytdPrev = ytdPorCuenta(dias, anio - 1, mes, corteDia);

  // Índices por cuenta+mes para no recorrer `mensual` N veces.
  const porCuentaMes = new Map();
  for (const r of mensual) porCuentaMes.set(`${r.cuenta}|${N(r.anio)}|${N(r.mes)}`, r);
  const pz3m = new Map();
  // Ritmo = los 3 meses CERRADOS anteriores; el mes en curso está a medias y falsearía la cobertura.
  for (const c of cuentas) pz3m.set(c.cuenta, sumaUltimosMeses(mensual, c.cuenta, anio, mes, 3, 'cantidad', 1));

  const meses6 = ultimosMeses(anio, mes, 6);
  const meses12 = ultimosMeses(anio, mes, 12);

  // Las fuentes sin detalle diario (mostrador + e-commerce, que llegan del pivot mensual del
  // ERP) traen el mes en curso INCOMPLETO. Compararlo contra el mes completo del año pasado
  // exagera la caída, así que al año anterior se le aplica la misma fracción de mes.
  const diasDelMes = new Date(anio, mes, 0).getDate();
  const fraccion = Math.min(1, Math.max(0, corteDia / diasDelMes));

  return cuentas.map((c) => {
    const fila = porCuentaMes.get(`${c.cuenta}|${anio}|${mes}`) || {};
    const a = mtdAct.get(c.cuenta) || { importe: 0, cantidad: 0 };
    const pBruto = mtdPrev.get(c.cuenta) || { importe: 0, cantidad: 0 };
    const ya = ytdAct.get(c.cuenta) || { importe: 0, cantidad: 0 };
    const ypBruto = ytdPrev.get(c.cuenta) || { importe: 0, cantidad: 0 };
    const escala = c.granularidad === 'mes' ? fraccion : 1;
    const p = escala === 1 ? pBruto : { importe: pBruto.importe * escala, cantidad: pBruto.cantidad * escala };
    // En el YTD sólo se recorta el mes en curso; los meses cerrados van completos.
    const yp = escala === 1 ? ypBruto
      : { importe: ypBruto.importe - pBruto.importe * (1 - escala), cantidad: ypBruto.cantidad - pBruto.cantidad * (1 - escala) };
    const sellIn = fila.sell_in == null ? null : N(fila.sell_in);
    const invPiezas = fila.inv_piezas == null ? null : N(fila.inv_piezas);
    const reportaInv = fila.inv_valor != null || invPiezas != null;

    return {
      cuenta: c.cuenta,
      nombre: c.nombre,
      erp: c.erp_cliente || null,
      canal: c.canal_sellout,
      propio: !!c.propio,
      granularidad: c.granularidad,
      importe: a.importe,
      cantidad: a.cantidad,
      importePrev: p.importe,
      yoy: yoy(a.importe, p.importe),
      ytd: ya.importe,
      ytdPrev: yp.importe,
      yoyYtd: yoy(ya.importe, yp.importe),
      sellIn,
      // Un sell in de cero o negativo (mes recién abierto, puras devoluciones) daría un
      // porcentaje absurdo: mejor no mostrarlo.
      soSi: c.cuenta === 'directo' ? 100 : (sellIn == null || sellIn <= 0 ? null : ratio(a.importe, sellIn)),
      invValor: reportaInv ? N(fila.inv_valor) : null,
      invPiezas: reportaInv ? invPiezas : null,
      invSkus: reportaInv ? N(fila.inv_skus) : null,
      invSemanas: reportaInv ? semanasInventario(invPiezas, pz3m.get(c.cuenta)) : null,
      sucursales: fila.sucursales == null ? null : N(fila.sucursales),
      // Estados distintos que reporta la fuente ese mes; 0 = la fuente no trae estado (CT, Ingram, Dicotech…).
      estados: fila.estados == null ? null : N(fila.estados),
      clientesFinales: fila.cf_activos == null ? null : N(fila.cf_activos),
      cfNuevos: fila.cf_nuevos == null ? null : N(fila.cf_nuevos),
      cfPerdidos: fila.cf_perdidos == null ? null : N(fila.cf_perdidos),
      cfRecompra: fila.cf_recompra_pct == null ? null : N(fila.cf_recompra_pct),
      cfTicket: fila.cf_ticket == null ? null : N(fila.cf_ticket),
      vendedores: fila.vend_activos == null ? null : N(fila.vend_activos),
      vendNuevos: fila.vend_nuevos == null ? null : N(fila.vend_nuevos),
      vendPerdidos: fila.vend_perdidos == null ? null : N(fila.vend_perdidos),
      vendRecurrentes: fila.vend_recurrentes == null ? null : N(fila.vend_recurrentes),
      sinEstado: fila.importe_sin_estado == null ? null : N(fila.importe_sin_estado),
      sinCliente: fila.importe_sin_cliente == null ? null : N(fila.importe_sin_cliente),
      tendencia: meses6.map((m) => N(porCuentaMes.get(`${c.cuenta}|${m.anio}|${m.mes}`)?.importe)),
      serie12: meses12.map((m) => ({
        x: MESES[m.mes - 1],
        anio: m.anio,
        mes: m.mes,
        importe: N(porCuentaMes.get(`${c.cuenta}|${m.anio}|${m.mes}`)?.importe),
        piezas: N(porCuentaMes.get(`${c.cuenta}|${m.anio}|${m.mes}`)?.cantidad),
        sellIn: porCuentaMes.get(`${c.cuenta}|${m.anio}|${m.mes}`)?.sell_in ?? null,
        inv: porCuentaMes.get(`${c.cuenta}|${m.anio}|${m.mes}`)?.inv_valor ?? null,
      })),
    };
  });
}

/** Totales al pie de la tabla (y del hero) a partir de las filas ya filtradas. */
export function totalesDeFilas(filas = []) {
  const t = {
    nombre: `${filas.length} cuentas`, importe: 0, cantidad: 0, importePrev: 0, ytd: 0, ytdPrev: 0,
    sellIn: 0, invValor: 0, invPiezas: 0, sucursales: 0, clientesFinales: 0, vendedores: 0,
    sinEstado: 0, mayoreoImporte: 0, conInventario: 0,
  };
  for (const f of filas) {
    t.importe += f.importe; t.cantidad += f.cantidad; t.importePrev += f.importePrev;
    t.ytd += f.ytd; t.ytdPrev += f.ytdPrev;
    t.sellIn += N(f.sellIn);
    if (f.invValor != null) { t.invValor += f.invValor; t.invPiezas += N(f.invPiezas); t.conInventario += 1; }
    t.sucursales += N(f.sucursales); t.clientesFinales += N(f.clientesFinales); t.vendedores += N(f.vendedores);
    if (f.canal === 'mayoreo') { t.mayoreoImporte += f.importe; t.sinEstado += N(f.sinEstado); }
  }
  t.yoy = yoy(t.importe, t.importePrev);
  t.yoyYtd = yoy(t.ytd, t.ytdPrev);
  t.soSi = t.sellIn > 0 ? ratio(t.importe, t.sellIn) : null;
  t.pctSinEstado = ratio(t.sinEstado, t.mayoreoImporte);
  return t;
}

/** Reparto del mes por canal, ordenado de mayor a menor. */
export function porCanal(filas = []) {
  const m = new Map();
  for (const f of filas) {
    const acc = m.get(f.canal) || { id: f.canal, label: canalLabel(f.canal), importe: 0, cantidad: 0, cuentas: 0 };
    acc.importe += f.importe; acc.cantidad += f.cantidad; acc.cuentas += 1;
    m.set(f.canal, acc);
  }
  const total = [...m.values()].reduce((s, x) => s + x.importe, 0);
  return [...m.values()].map((x) => ({ ...x, pct: ratio(x.importe, total) })).sort((a, b) => b.importe - a.importe);
}

/** Reparto del mes por una dimensión de mv_sellout_cuenta_sku_mes (marca | categoria | familia). */
export function composicion(skuMes = [], dimension = 'marca', cuentas = null, top = 8) {
  const m = new Map();
  for (const r of skuMes) {
    if (cuentas && !cuentas.has(r.cuenta)) continue;
    const k = r[dimension] || 'Sin dato';
    const acc = m.get(k) || { id: k, label: k, importe: 0, cantidad: 0 };
    acc.importe += N(r.importe); acc.cantidad += N(r.cantidad);
    m.set(k, acc);
  }
  const lista = [...m.values()].sort((a, b) => b.importe - a.importe);
  const total = lista.reduce((s, x) => s + x.importe, 0);
  const cab = lista.slice(0, top).map((x) => ({ ...x, pct: ratio(x.importe, total) }));
  const resto = lista.slice(top);
  if (resto.length) {
    const imp = resto.reduce((s, x) => s + x.importe, 0);
    cab.push({ id: '__otros__', label: `Otros (${resto.length})`, importe: imp, cantidad: resto.reduce((s, x) => s + x.cantidad, 0), pct: ratio(imp, total) });
  }
  return cab;
}

/** Serie de 12 meses del conjunto de cuentas dado: total + una línea por canal + sell in. */
export function serie12(mensual = [], anio, mes, cuentas = null) {
  const meses = ultimosMeses(anio, mes, 12);
  const base = new Map(meses.map((m) => [idxMes(m.anio, m.mes), {
    x: MESES[m.mes - 1], anio: m.anio, mes: m.mes,
    total: 0, totalPz: 0, mayoreo: 0, mayoreoPz: 0, distribuidor: 0, distribuidorPz: 0,
    directo: 0, directoPz: 0, sellIn: 0, sellInPz: 0,
  }]));
  for (const r of mensual) {
    if (cuentas && !cuentas.has(r.cuenta)) continue;
    const f = base.get(idxMes(N(r.anio), N(r.mes)));
    if (!f) continue;
    f.total += N(r.importe); f.totalPz += N(r.cantidad);
    const c = r.canal_sellout;
    if (c === 'mayoreo' || c === 'distribuidor' || c === 'directo') { f[c] += N(r.importe); f[`${c}Pz`] += N(r.cantidad); }
    f.sellIn += N(r.sell_in); f.sellInPz += N(r.sell_in_piezas);
  }
  return meses.map((m) => base.get(idxMes(m.anio, m.mes)));
}

/** Reparto por estado de mv_sellout_estado_mes para un mes (y su YoY). */
export function porEstado(estadoMes = [], anio, mes, cuentas = null) {
  const m = new Map();
  for (const r of estadoMes) {
    if (cuentas && !cuentas.has(r.cuenta)) continue;
    if (N(r.mes) !== mes) continue;
    const a = N(r.anio);
    if (a !== anio && a !== anio - 1) continue;
    const k = r.estado || 'SIN ESTADO';
    const acc = m.get(k) || { estado: k, importe: 0, importePrev: 0, cantidad: 0, clientes: 0, vendedores: 0 };
    if (a === anio) { acc.importe += N(r.importe); acc.cantidad += N(r.cantidad); acc.clientes += N(r.clientes_finales); acc.vendedores += N(r.vendedores); }
    else acc.importePrev += N(r.importe);
    m.set(k, acc);
  }
  const lista = [...m.values()].map((x) => ({ ...x, yoy: yoy(x.importe, x.importePrev) }));
  const total = lista.reduce((s, x) => s + x.importe, 0);
  return lista.map((x) => ({ ...x, pct: ratio(x.importe, total) })).sort((a, b) => b.importe - a.importe);
}

// ─────────────────────────────────────────────────────────────────────────────
// Drill de una cuenta
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SKU × 12 meses para el drill, con stock del cliente y semanas de cobertura.
 * @param skuMes  mv_sellout_cuenta_sku_mes de ESA cuenta (dos años)
 * @param inv     v_sellout_inventario_cuenta_sku de ESA cuenta (puede ir vacío)
 */
export function skusDeCuenta(skuMes = [], inv = [], anio, mes, modo = 'importe') {
  const meses = ultimosMeses(anio, mes, 12);
  const campo = modo === 'piezas' ? 'cantidad' : 'importe';
  const idxDe = new Map(meses.map((m, i) => [idxMes(m.anio, m.mes), i]));
  const stock = new Map();
  for (const r of inv) stock.set(String(r.sku || '').toUpperCase(), r);
  const filas = new Map();
  for (const r of skuMes) {
    const i = idxDe.get(idxMes(N(r.anio), N(r.mes)));
    if (i == null) continue;
    const k = String(r.sku || '').toUpperCase();
    let f = filas.get(k);
    if (!f) { f = { sku: k, marca: r.marca, categoria: r.categoria, meses: Array(12).fill(0), total: 0, piezas: 0 }; filas.set(k, f); }
    f.meses[i] += N(r[campo]);
    f.total += N(r[campo]);
    f.piezas += N(r.cantidad);
  }
  const pzUlt3 = (f) => f.meses.slice(9).reduce((s, v) => s + v, 0);
  return [...filas.values()].map((f) => {
    const s = stock.get(f.sku);
    const piezas3m = modo === 'piezas' ? pzUlt3(f) : null;
    return {
      ...f,
      prom: f.total / 12,
      mesActual: f.meses[11],
      stock: s ? N(s.stock) : null,
      valorStock: s ? N(s.valor) : null,
      diasSinVenta: s && s.dias_sin_venta != null ? N(s.dias_sin_venta) : null,
      semanas: s && piezas3m != null ? semanasInventario(N(s.stock), piezas3m) : null,
    };
  }).sort((a, b) => b.total - a.total);
}

/** Alertas del drill: SKUs sin venta 30+ días (si la fuente lo trae) y SKUs con venta sin stock. */
export function alertasDeCuenta(skus = [], hayDiasSinVenta = false) {
  const sinVenta = hayDiasSinVenta ? skus.filter((s) => s.diasSinVenta != null && s.diasSinVenta >= 30 && N(s.stock) > 0) : [];
  const sinStock = skus.filter((s) => s.stock != null && s.stock <= 0 && s.mesActual > 0);
  return {
    sinVenta30: sinVenta.length,
    sinVenta30Valor: sinVenta.reduce((s, x) => s + N(x.valorStock), 0),
    sinStockConVenta: sinStock.length,
    sinStockConVentaImporte: sinStock.reduce((s, x) => s + N(x.mesActual), 0),
  };
}

/** Proyección del mes al ritmo del MTD (regla de tres sobre los días del mes). */
export function ritmoProyectado(importeMtd, corteDia, anio, mes) {
  const diasMes = new Date(anio, mes, 0).getDate();
  if (!corteDia || corteDia <= 0) return null;
  return (importeMtd / Math.min(corteDia, diasMes)) * diasMes;
}

export default {
  MESES, MESES_LARGO, CANALES, canalLabel, canalTone, N, idxMes, deIdx, yoy, ratio, ultimosMeses,
  mtdPorCuenta, ytdPorCuenta, totalDe, ultimoDiaConVenta, ultimoMesConVenta, semanasInventario,
  sumaUltimosMeses, construirFilas, totalesDeFilas, porCanal, composicion, serie12, porEstado,
  skusDeCuenta, alertasDeCuenta, ritmoProyectado,
};
