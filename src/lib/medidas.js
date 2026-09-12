// src/lib/medidas.js — MEDIDAS DEL DIRECTOR (Power BI) · fuente única en JS.
//
// Por qué existe: hasta 2026-09-11 cada pantalla calculaba su propia versión de
// "inventario comercial", "días de inventario", "% MC"… y los números no
// cuadraban entre pestañas. Este módulo traduce, una sola vez, las medidas DAX
// del modelo del director (ver docs/MEDIDAS_DIRECTOR.md) y es el ÚNICO lugar
// donde viven las fórmulas derivadas.
//
// Reglas no negociables:
//   1. Las medidas BASE (sumas) se piden ya sumadas a Postgres: v_medidas_ventas_*,
//      v_medidas_inventario, v_medidas_cuota_*. Aquí NO se re-suma renglón a renglón.
//   2. Los % NUNCA se suman ni se promedian: se recalculan al agregar con
//      `derivadas()`. Un promedio de % es siempre un bug.
//   3. Toda cifra visible lleva su nombre oficial: `ETIQUETA.pct_mc`, y el
//      tooltip `tooltip('pct_mc')` → "Medida: % MC · Contribucion / Fact Neta".
//   4. Nada de "0" por conveniencia: si el insumo falta, la medida es `null` y
//      la pantalla pinta '—'.

// ───────────────────────── utilidades ─────────────────────────

/** Número seguro. null/undefined/'' /NaN → 0. Para SUMAS. */
export const N = (v) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Número o null. Para DIVISIONES y para "no hay dato". */
export const Nn = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** DIVIDE() de DAX: denominador 0/null → `alt` (por defecto null, no 0). */
export const divide = (num, den, alt = null) => {
  const d = Nn(den);
  const n = Nn(num);
  if (d === null || d === 0 || n === null) return alt;
  return n / d;
};

/** Ratio → puntos porcentuales (0.3369 → 33.69). null → null. */
export const aPct = (r) => (r === null || r === undefined ? null : r * 100);

// ───────────────────────── medidas base ─────────────────────────
// Las que salen sumadas de las vistas. Se listan para poder agregar arrays de
// filas (meses, clientes, canales) sin olvidar ninguna ni sumar un % por error.

export const MEDIDAS_VENTAS = [
  'fact_bruta', 'devoluciones', 'rmas', 'bonificaciones',
  'fact_neta', 'venta_neta',
  'costo_fact_bruta', 'costo_devoluciones', 'costo_rmas',
  'costo_fact_neta', 'costo_venta_neta',
  'contribucion', 'contribucion_bruta', 'utilidad_comercial',
  'perdida_devoluciones', 'perdida_rmas',
  'piezas_venta_neta',
  'cuota_venta', 'cuota_minima', 'cuota_piezas', 'cuota_costo', 'cuota_contribucion',
];

export const MEDIDAS_INVENTARIO = [
  'inv_actual', 'inv_actual_piezas', 'inv_total',
  'costo_compra_tc17', 'costo_compra_tc20',
];

/**
 * Suma un array de filas de v_medidas_ventas_* sobre las medidas base.
 * NO toca los %: úsalos con `derivadas()` sobre el resultado.
 * @param {Array<object>} filas
 * @param {(fila:object)=>boolean} [filtro]
 */
export function sumar(filas, filtro) {
  const t = {};
  for (const k of MEDIDAS_VENTAS) t[k] = 0;
  let n = 0;
  for (const r of filas || []) {
    if (filtro && !filtro(r)) continue;
    n += 1;
    for (const k of MEDIDAS_VENTAS) t[k] += N(r[k]);
  }
  t.filas = n;
  // Una cuota "0 en todas las filas" casi siempre significa "no cargada":
  // se deja en null para que la pantalla pinte '—' y no un 0 % de alcance.
  for (const k of ['cuota_venta', 'cuota_minima', 'cuota_piezas', 'cuota_costo', 'cuota_contribucion']) {
    const algunaConDato = (filas || []).some((r) => (!filtro || filtro(r)) && Nn(r[k]) !== null);
    if (!algunaConDato) t[k] = null;
  }
  return t;
}

// ───────────────────────── medidas derivadas ─────────────────────────

/**
 * Todas las medidas derivadas del director sobre un agregado ya sumado.
 * Los % se devuelven en PUNTOS PORCENTUALES (33.69), listos para `pct()`.
 */
export function derivadas(t = {}) {
  const factBruta = Nn(t.fact_bruta);
  const factNeta = Nn(t.fact_neta);
  const ventaNeta = Nn(t.venta_neta);
  const piezas = Nn(t.piezas_venta_neta);
  const contribucion = Nn(t.contribucion);
  const contribucionBruta = Nn(t.contribucion_bruta);
  const utilidad = Nn(t.utilidad_comercial);
  const cuotaVenta = Nn(t.cuota_venta);
  const cuotaPiezas = Nn(t.cuota_piezas);
  const cuotaContrib = Nn(t.cuota_contribucion);

  return {
    // Rentabilidad
    pct_mc: aPct(divide(contribucion, factNeta)),
    pct_mc_bruta: aPct(divide(contribucionBruta, factBruta)),
    pct_muc: aPct(divide(utilidad, ventaNeta)),
    // Lost profit
    pct_lost_profit_bonif: aPct(divide(t.bonificaciones, factNeta)),
    pct_lost_profit_dev: aPct(divide(t.perdida_devoluciones, factBruta)),
    pct_lost_profit_rma: aPct(divide(t.perdida_rmas, factNeta)),
    // Cuota
    pct_alcance_venta: aPct(divide(factNeta, cuotaVenta)),
    pct_alcance_piezas: aPct(divide(piezas, cuotaPiezas)),
    cuota_pct_contribucion: aPct(divide(cuotaContrib, cuotaVenta)),
    diferencia_cuota: cuotaVenta === null || factNeta === null ? null : factNeta - cuotaVenta,
    diferencia_piezas: cuotaPiezas === null || piezas === null ? null : piezas - cuotaPiezas,
    deficit_contribucion: cuotaContrib === null || contribucion === null ? null : contribucion - cuotaContrib,
    // Por pieza
    ticket_promedio: divide(ventaNeta, piezas),
    utilidad_promedio: divide(utilidad, piezas),
  };
}

/** Agregado completo: base sumada + derivadas, en un solo objeto. */
export function agregar(filas, filtro) {
  const base = sumar(filas, filtro);
  return { ...base, ...derivadas(base) };
}

// ───────────────────────── inventario ─────────────────────────

/**
 * [Dias de Inv] = Inv Actual / CV Últimos 3 Meses × 90.
 * `cv3` = Costo Venta Neta de los 3 meses CERRADOS previos (el mes en curso NO
 * cuenta: está incompleto y hundiría el ritmo).
 * Ambos lados son pesos a COSTO — no mezclar con ventas a precio de venta.
 */
export function diasInventario(invActual, cv3, base = 90) {
  const r = divide(invActual, cv3);
  return r === null ? null : r * base;
}

/** [Dias de Inv Total] — igual pero con Inv Total (Inv + OC a TC 17). */
export const diasInventarioTotal = (invTotal, cv3, base = 90) => diasInventario(invTotal, cv3, base);

/** [Vueltas de Inv] = YTD Costo de Venta / Inv Promedio. */
export const vueltasInventario = (ytdCostoVenta, invPromedio) => divide(ytdCostoVenta, invPromedio);

/** [Inv Total (Inv+OC)] = Costo de Compra TC 17 + Inv Actual. */
export function invTotal(invActual, costoCompraTc17) {
  const a = Nn(invActual); const b = Nn(costoCompraTc17);
  if (a === null && b === null) return null;
  return N(a) + N(b);
}

/**
 * Normaliza la fila de `v_medidas_inventario` (1 sola fila) a números.
 * Es el único adaptador que deben usar las pantallas.
 */
export function inventarioDesdeVista(row) {
  if (!row) return null;
  const o = {};
  for (const k of [
    'inv_actual', 'inv_actual_piezas', 'inv_actual_disponible',
    'inv_config_costo_inventario', 'inv_config_costo_disponible',
    'inv_config_piezas', 'inv_config_disponible', 'inv_ventas_todas_ramas',
    'costo_promedio', 'costo_compra_tc17', 'costo_compra_tc20',
    'compra_usd_pendiente', 'piezas_pendientes', 'inv_total',
    'cv_ultimos_3_meses', 'ytd_costo_venta', 'dias_inv', 'dias_inv_total',
    'inv_promedio', 'vueltas_inv',
  ]) o[k] = Nn(row[k]);
  o.skus_con_stock = Nn(row.skus_con_stock);
  o.actualizado = row.actualizado || null;
  return o;
}

// ───────────────────────── nombres oficiales ─────────────────────────

export const ETIQUETA = {
  fact_bruta: 'Fact Bruta',
  fact_neta: 'Fact Neta',
  venta_neta: 'Venta Neta',
  devoluciones: 'Devoluciones',
  rmas: "RMA's",
  bonificaciones: 'Bonificaciones',
  perdida_devoluciones: 'Perdida x Devoluciones',
  perdida_rmas: "Perdida x RMA's",
  costo_fact_bruta: 'Costo Fact Bruta',
  costo_fact_neta: 'Costo Fact Neta',
  costo_venta_neta: 'Costo Venta Neta',
  costo_devoluciones: 'Costo Devoluciones',
  costo_rmas: "Costo RMA's",
  costo_promedio: 'Costo Promedio',
  contribucion: 'Contribucion',
  contribucion_bruta: 'Contribucion Bruta',
  utilidad_comercial: 'Utilidad Comercial',
  utilidad_promedio: 'Utilidad Promedio',
  piezas_venta_neta: 'Piezas Venta Neta',
  ticket_promedio: 'Ticket Promedio',
  pct_mc: '% MC',
  pct_mc_bruta: '% MC Bruta',
  pct_muc: '% MUC',
  pct_lost_profit_bonif: '% Lost Profit Bonif',
  pct_lost_profit_dev: '% Lost Profit Dev',
  pct_lost_profit_rma: "% Lost Profit RMA",
  cuota_venta: 'Cuota Venta',
  cuota_minima: 'Cuota Minima',
  cuota_piezas: 'Cuota Piezas',
  cuota_costo: 'Cuota Costo',
  cuota_contribucion: 'Cuota Contribucion',
  cuota_pct_contribucion: 'Cuota % Contribucion',
  pct_alcance_venta: '% Alcance Venta',
  pct_alcance_piezas: '% Alcance Piezas',
  diferencia_cuota: '+/- $ Venta',
  diferencia_piezas: '+/- Piezas',
  deficit_contribucion: 'Deficit Contribucion',
  cv_ultimos_3_meses: 'CV Ultimos 3 Meses',
  ytd_costo_venta: 'YTD Costo de Venta',
  inv_actual: 'Inv Actual',
  inv_actual_piezas: 'Inv Actual (piezas)',
  inv_total: 'Inv Total (Inv+OC)',
  inv_cierre_mes: 'Inv Cierre de Mes',
  inv_promedio: 'Inv Promedio',
  dias_inv: 'Dias de Inv',
  dias_inv_total: 'Dias de Inv Total',
  vueltas_inv: 'Vueltas de Inv',
  costo_compra_tc17: 'Costo de Compra TC 17',
  costo_compra_tc20: 'Costo de Compra TC 20',
  sell_out: 'Sell Out',
  pendiente_facturar: 'Pendiente x Facturar',
};

/** Fórmula en palabras, para el tooltip. */
export const FORMULA = {
  fact_bruta: 'Σ MontoVentaPesos de Factura y Factura Com.Ext33',
  fact_neta: 'Fact Bruta + Devoluciones',
  venta_neta: "Fact Neta + RMA's + Bonificaciones",
  devoluciones: 'Σ MontoVentaPesos de Devolucion Venta sin Nota Credito',
  rmas: 'Σ MontoVentaPesos de Devolucion Venta con Nota Credito',
  bonificaciones: 'Σ MontoVentaPesos de Bonificacion Venta',
  perdida_devoluciones: 'Devoluciones − Costo Devoluciones',
  perdida_rmas: "RMA's − Costo RMA's",
  costo_fact_neta: 'Costo Fact Bruta + Costo Devoluciones',
  costo_venta_neta: "Costo Fact Neta + Costo RMA's",
  costo_promedio: 'Promedio de costopromedio con CostoInventario ≠ 0',
  contribucion: 'Fact Neta − Costo Fact Neta',
  contribucion_bruta: 'Fact Bruta − Costo Fact Bruta',
  utilidad_comercial: 'Venta Neta − Costo Venta Neta',
  utilidad_promedio: 'Utilidad Comercial / Piezas Venta Neta',
  piezas_venta_neta: 'Σ Unidades',
  ticket_promedio: 'Venta Neta / Piezas Venta Neta',
  pct_mc: 'Contribucion / Fact Neta',
  pct_mc_bruta: 'Contribucion Bruta / Fact Bruta',
  pct_muc: 'Utilidad Comercial / Venta Neta',
  pct_lost_profit_bonif: 'Bonificaciones / Fact Neta',
  pct_lost_profit_dev: 'Perdida x Devoluciones / Fact Bruta',
  pct_lost_profit_rma: "Perdida x RMA's / Fact Neta",
  cuota_venta: 'Σ BP[IMPORTEDEVENTA]',
  cuota_minima: 'Σ BP[CUOTAMINIMA]',
  cuota_piezas: 'Σ BP[UNIDADES]',
  cuota_costo: 'Σ BP[COSTODEVENTA]',
  cuota_contribucion: 'Cuota Venta − Cuota Costo',
  cuota_pct_contribucion: 'Cuota Contribucion / Cuota Venta',
  pct_alcance_venta: 'Fact Neta / Cuota Venta',
  pct_alcance_piezas: 'Piezas Venta Neta / Cuota Piezas',
  diferencia_cuota: 'Fact Neta − Cuota Venta',
  diferencia_piezas: 'Piezas Venta Neta − Cuota Piezas',
  deficit_contribucion: 'Contribucion − Cuota Contribucion',
  cv_ultimos_3_meses: 'Costo Venta Neta de los meses −1, −2 y −3',
  ytd_costo_venta: 'Costo Venta Neta acumulado del año',
  inv_actual: 'Σ CostoInventario · Almacén no exclusivo de Inventario · Rama PRODUCTO',
  inv_total: 'Costo de Compra TC 17 + Inv Actual',
  inv_cierre_mes: 'Σ CostoInventario del último día del mes',
  inv_promedio: 'Promedio diario del CostoInventario del mes',
  dias_inv: 'Inv Actual / CV Ultimos 3 Meses × 90',
  dias_inv_total: 'Inv Total / CV Ultimos 3 Meses × 90',
  vueltas_inv: 'YTD Costo de Venta / Inv Promedio',
  costo_compra_tc17: 'Σ Compras USD pendientes × 17',
  costo_compra_tc20: 'Σ Compras USD pendientes × 20',
  sell_out: 'Σ sellout[importe]',
  pendiente_facturar: 'Σ OrdenSurtidoOS[MontoVentaPesos]',
};

/** Texto para `title=` de cualquier cifra: "Medida: % MC · Contribucion / Fact Neta". */
export function tooltip(clave, extra) {
  const e = ETIQUETA[clave];
  if (!e) return extra || undefined;
  const f = FORMULA[clave];
  return `Medida: ${e}${f ? ` · ${f}` : ''}${extra ? ` · ${extra}` : ''}`;
}

/** Nombre oficial, o la clave si no está catalogada. */
export const etiqueta = (clave) => ETIQUETA[clave] || clave;

// ───────────────────────── cuota (regla única) ─────────────────────────
// La precedencia "cuotas_canales TOTAL anual ÷ 12, si no Σ cuotas_mensuales"
// estaba reimplementada en 4 pantallas. Vive aquí.

/**
 * @param {Array} canales filas de cuotas_canales del año
 * @param {Array} mensuales filas de cuotas_mensuales del año
 * @returns {{mes:(m:number)=>number|null, hasta:(m:number)=>number|null, anual:number|null, fuente:string}}
 */
export function cuotas(canales, mensuales) {
  const total = (canales || []).find((r) => String(r.dimension_tipo || '').toUpperCase() === 'TOTAL');
  const anual = total ? Nn(total.meta_facturacion) : null;
  const porMes = new Map();
  for (const r of mensuales || []) {
    const m = Number(r.mes);
    if (!Number.isFinite(m)) continue;
    porMes.set(m, N(porMes.get(m)) + N(r.cuota_ideal ?? r.cuota_min));
  }
  const mes = (m) => {
    if (anual !== null && anual > 0) return anual / 12;
    const v = porMes.get(Number(m));
    return v === undefined ? null : v;
  };
  const hasta = (m) => {
    if (anual !== null && anual > 0) return (anual / 12) * m;
    let s = 0; let hay = false;
    for (let i = 1; i <= m; i += 1) { const v = porMes.get(i); if (v !== undefined) { s += v; hay = true; } }
    return hay ? s : null;
  };
  return { mes, hasta, anual, fuente: anual !== null && anual > 0 ? 'cuotas_canales' : 'cuotas_mensuales' };
}

// ───────────────────────── calendario ─────────────────────────

/** Los 3 meses CERRADOS anteriores a (anio, mes). Nunca incluye el mes en curso. */
export function mesesCerrados(anio, mes, n = 3) {
  const out = [];
  let a = anio; let m = mes;
  for (let i = 0; i < n; i += 1) {
    m -= 1;
    if (m < 1) { m = 12; a -= 1; }
    out.push({ anio: a, mes: m });
  }
  return out.reverse();
}
