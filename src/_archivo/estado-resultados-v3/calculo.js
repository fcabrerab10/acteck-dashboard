// Estado de Resultados V3 · lógica pura (sin React, sin Supabase).
// Pruebas: node scripts/test-resultados-calculo.mjs
//
// Convenciones de estados_resultados: una fila por (anio, mes, cuenta_norm) con `valor`;
// `es_subtotal` marca VENTA NETA, UTILIDAD BRUTA, UAFIR…, y `nota` es texto libre por celda.
// Cuentas en % (Alcance % Gasto vs Venta N.) vienen como fracción (0.23 = 23 %).
//
// Nombres del P&L de REVKO y cómo los llama la pantalla:
//   uafir_sin_proyectos          → "UAII" (utilidad de operación: UB − total gastos, antes de financieros)
//   uaii_contable_sin_proyectos  → "UAI"  (después de gastos/productos financieros, antes de impuestos)

export const MESES_LBL = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const MESES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export const SLUG = {
  ventaNeta: 'venta_neta',
  ventasGeneral: 'ventas_y_servicios_a_tasa_general',
  ventasTasa0: 'ventas_y_servicios_a_tasa_0',
  devoluciones: 'devol_desctos_o_bonif_sobre_ingresos',
  costoVenta: 'total_costo_de_venta',
  utilBruta: 'utilidad_bruta',
  totalGastos: 'total_gastos',
  uafir: 'uafir_sin_proyectos',        // UAII
  uaii: 'uaii_contable_sin_proyectos', // UAI
};

// Grupos de la tabla formal (mismo contenido que la pantalla anterior).
export const GRUPOS_TABLA = [
  { id: 'ingresos', label: 'Ingresos', dotKey: 'green', defaultOpen: true,
    cuentas: ['ventas_y_servicios_a_tasa_general', 'ventas_y_servicios_a_tasa_0', 'devol_desctos_o_bonif_sobre_ingresos'],
    subtotal: 'venta_neta' },
  { id: 'costos', label: 'Costo de ventas', dotKey: 'orange', defaultOpen: true,
    cuentas: ['costo_de_ventas', 'costo_de_venta_empaque', 'costo_ecommerce', 'dev_desc_o_bonificacion_s_compra', 'destruccion_fiscal_2025', 'total_costo_de_venta'],
    subtotal: 'utilidad_bruta' },
  { id: 'gastos', label: 'Gastos operativos', dotKey: 'red', defaultOpen: true,
    cuentas: ['gastos_generales', 'nomina', 'distribucion', 'arrendamiento', 'arrendamiento_estrategia', 'viaticos_com', 'otros_gastos', 'proyectos', 'total_gastos_proyectos', 'total_gastos'],
    subtotal: 'uafir_sin_proyectos',
    extra: 'uafir_con_proyectos' },
  { id: 'indicadores_gasto', label: 'Indicadores de gasto', dotKey: 'purple', defaultOpen: false,
    cuentas: ['alcance_gasto_vs_venta_n', 'alcance_gasto_vs_venta_n_presupuesto'],
    formato: 'pct' },
  { id: 'otros', label: 'Otros ingresos', dotKey: 'accent', defaultOpen: false,
    cuentas: ['otros_ingresos', 'comision_proyectos'] },
  { id: 'financieros', label: 'Gastos y productos financieros', dotKey: 'pink', defaultOpen: false,
    cuentas: [
      'gastos_financieros', 'comisiones_cartas_de_credito', 'comisiones_y_sit_bancarias',
      'intereses_a_cargo_nacional', 'intereses_cartas_de_credito', 'intereses_prestamo_ing_jcr',
      'perdida_cambiaria', 'perdida_revaluaciones', 'objetivo_anual_2',
      'productos_financieros', 'intereses_a_favor_bancarios_nacional', 'utilidad_cambiaria', 'utilidad_revaluaciones',
      'total_productos_financieros',
    ] },
  { id: 'utilidad', label: 'Utilidad final', dotKey: 'orange', defaultOpen: true,
    cuentas: ['uaii_contable_con_proyecctos', 'uaii_contable_sin_proyectos'] },
];

export const INFO_SLUGS = ['t_c_dof', 'colaboradores', 'vta_colaborador', 'uti_colaborador', 'interes_ing_jcr_mxn'];
export const INFO_ENTEROS = new Set(['t_c_dof', 'colaboradores']);

export const CUENTAS_CLAVE_ALERTAS = ['venta_neta', 'utilidad_bruta', 'uafir_sin_proyectos', 'total_gastos', 'nomina', 'distribucion', 'arrendamiento', 'proyectos', 'gastos_generales', 'gastos_financieros'];

// Umbral del puente ERP vs P&L (en %). Por encima se marca alerta.
export const UMBRAL_PUENTE_PCT = 2;

const N = (v) => (v == null || v === '' ? null : Number(v));
const esNum = (v) => typeof v === 'number' && Number.isFinite(v);
export const esSubcuenta = (cuenta) => /^\s*\*/.test(cuenta || '');

// ─── Índice por cuenta ───
export function indexar(rows) {
  const m = new Map();
  (rows || []).forEach((r) => {
    const k = r.cuenta_norm;
    if (!k) return;
    if (!m.has(k)) m.set(k, { cuenta_norm: k, cuenta: r.cuenta, orden: r.orden ?? 999, es_subtotal: !!r.es_subtotal, valores: {}, notas: {}, notaGeneral: null });
    const c = m.get(k);
    const mes = Number(r.mes);
    const v = N(r.valor);
    if (esNum(v)) c.valores[mes] = v;
    if (r.nota) c.notas[mes] = r.nota;
  });
  for (const c of m.values()) {
    const entries = Object.values(c.notas);
    const uniq = Array.from(new Set(entries));
    c.notaGeneral = uniq.length === 1 && entries.length >= 3 ? uniq[0] : null;
  }
  return m;
}

export function mesMaxDe(rows) {
  let m = 0;
  (rows || []).forEach((r) => { const x = Number(r.mes); if (x > m) m = x; });
  return m;
}

/** Valor de una cuenta en un mes (null si no está cargado). */
export function valorDe(idx, slug, mes) {
  const v = idx?.get(slug)?.valores?.[mes];
  return esNum(v) ? v : null;
}

/** Acumulado ene..hasta (null si ningún mes tiene valor). */
export function ytdDe(idx, slug, hasta) {
  const c = idx?.get(slug);
  if (!c) return null;
  let s = 0, hay = false;
  for (let i = 1; i <= hasta; i++) { const v = c.valores[i]; if (esNum(v)) { s += v; hay = true; } }
  return hay ? s : null;
}

/** Variación % vs previo. null si falta alguno o el previo es ~0. Base |previo| para cuentas negativas. */
export function deltaPct(actual, previo) {
  if (!esNum(actual) || !esNum(previo) || Math.abs(previo) < 1e-9) return null;
  return ((actual - previo) / Math.abs(previo)) * 100;
}

/** num/den·100, null si den ≤ 0. */
export function margen(num, den) {
  if (!esNum(num) || !esNum(den) || den <= 0) return null;
  return (num / den) * 100;
}

const dif = (a, b) => (esNum(a) && esNum(b) ? a - b : null);

// ─── Medidas del periodo (Mes o YTD) para Hero/KPIs ───
// modo 'mes' → valor del mes `mes`; modo 'ytd' → acumulado ene..mes. prev = mismo periodo del año anterior.
export function medidas(idx, idxPrev, mes, modo = 'mes') {
  const get = (i, slug) => (modo === 'ytd' ? ytdDe(i, slug, mes) : valorDe(i, slug, mes));
  const a = {
    ventaNeta: get(idx, SLUG.ventaNeta), utilBruta: get(idx, SLUG.utilBruta),
    totalGastos: get(idx, SLUG.totalGastos), uafir: get(idx, SLUG.uafir), uaii: get(idx, SLUG.uaii),
  };
  const p = {
    ventaNeta: get(idxPrev, SLUG.ventaNeta), utilBruta: get(idxPrev, SLUG.utilBruta),
    totalGastos: get(idxPrev, SLUG.totalGastos), uafir: get(idxPrev, SLUG.uafir), uaii: get(idxPrev, SLUG.uaii),
  };
  const pct = (o) => ({
    bruta: margen(o.utilBruta, o.ventaNeta), uafir: margen(o.uafir, o.ventaNeta), uaii: margen(o.uaii, o.ventaNeta),
    gasto: margen(o.totalGastos, o.ventaNeta),
  });
  const pa = pct(a), pp = pct(p);
  return {
    modo, mes, ...a, pct: pa, prev: { ...p, pct: pp },
    delta: {
      ventaNeta: deltaPct(a.ventaNeta, p.ventaNeta), utilBruta: deltaPct(a.utilBruta, p.utilBruta),
      totalGastos: deltaPct(a.totalGastos, p.totalGastos), uafir: deltaPct(a.uafir, p.uafir), uaii: deltaPct(a.uaii, p.uaii),
      brutaPp: dif(pa.bruta, pp.bruta), uafirPp: dif(pa.uafir, pp.uafir), uaiiPp: dif(pa.uaii, pp.uaii), gastoPp: dif(pa.gasto, pp.gasto),
    },
  };
}

// ─── Serie mensual (12 puntos) para la tendencia ───
export function serieMensual(idx, idxPrev, mesMax) {
  return MESES_LBL.map((lbl, i) => {
    const m = i + 1;
    const vn = m <= mesMax ? valorDe(idx, SLUG.ventaNeta, m) : null;
    const ub = m <= mesMax ? valorDe(idx, SLUG.utilBruta, m) : null;
    const uf = m <= mesMax ? valorDe(idx, SLUG.uafir, m) : null;
    const ui = m <= mesMax ? valorDe(idx, SLUG.uaii, m) : null;
    const vnP = valorDe(idxPrev, SLUG.ventaNeta, m);
    const ubP = valorDe(idxPrev, SLUG.utilBruta, m);
    const ufP = valorDe(idxPrev, SLUG.uafir, m);
    return {
      mes: m, lbl,
      ventaNeta: vn, utilBruta: ub, uafir: uf, uaii: ui,
      ventaNetaPrev: vnP, utilBrutaPrev: ubP, uafirPrev: ufP,
      margenBrutoPct: margen(ub, vn), margenBrutoPctPrev: margen(ubP, vnP),
      uafirPct: margen(uf, vn),
    };
  });
}

// ─── Evolución 24 meses de una cuenta (año anterior + año actual) ───
export function evolucion24(idx, idxPrev, slug, anio) {
  const out = [];
  const yy = (a) => String(a).slice(-2);
  for (let m = 1; m <= 12; m++) out.push({ k: `${MESES_LBL[m - 1]} ${yy(anio - 1)}`, mes: m, anio: anio - 1, valor: valorDe(idxPrev, slug, m) });
  for (let m = 1; m <= 12; m++) out.push({ k: `${MESES_LBL[m - 1]} ${yy(anio)}`, mes: m, anio, valor: valorDe(idx, slug, m) });
  return out;
}

// ─── Alertas (MoM ≥ 25 % · YoY ≥ 40 % en cuentas clave del último mes) ───
export function alertasDe(idx, idxPrev, mesMax, anio) {
  const items = [];
  if (!mesMax) return items;
  CUENTAS_CLAVE_ALERTAS.forEach((slug) => {
    const c = idx.get(slug);
    if (!c) return;
    const v = valorDe(idx, slug, mesMax);
    if (mesMax >= 2) {
      const vPrev = valorDe(idx, slug, mesMax - 1);
      if (v != null && vPrev != null && Math.abs(vPrev) > 1000) {
        const delta = deltaPct(v, vPrev);
        if (Math.abs(delta) >= 25) items.push({ id: `${anio}-mom-${slug}-${mesMax}`, type: 'mom', cuenta: c.cuenta, slug, mes: mesMax, delta, valor: v, valorPrev: vPrev });
      }
    }
    const vPrevY = valorDe(idxPrev, slug, mesMax);
    if (v != null && vPrevY != null && Math.abs(vPrevY) > 1000) {
      const delta = deltaPct(v, vPrevY);
      if (Math.abs(delta) >= 40) items.push({ id: `${anio}-yoy-${slug}-${mesMax}`, type: 'yoy', cuenta: c.cuenta, slug, mes: mesMax, delta, valor: v, valorPrev: vPrevY });
    }
  });
  return items;
}

// ─── Ficha del mes (hoja lateral) ───
export function fichaMes(idx, idxPrev, mes, { top = 5, umbralAbs = 50000 } = {}) {
  if (!mes) return null;
  const m = medidas(idx, idxPrev, mes, 'mes');
  const variaciones = (fuentePrev) => {
    const out = [];
    idx.forEach((c) => {
      if (c.es_subtotal) return;
      const v = c.valores[mes];
      const vPrev = fuentePrev(c);
      if (!esNum(v) || !esNum(vPrev) || Math.abs(vPrev) <= 1000) return;
      const deltaAbs = v - vPrev;
      if (Math.abs(deltaAbs) > umbralAbs) out.push({ cuenta: c.cuenta, slug: c.cuenta_norm, deltaAbs, deltaPct: deltaPct(v, vPrev), valor: v, valorPrev: vPrev });
    });
    out.sort((a, b) => Math.abs(b.deltaAbs) - Math.abs(a.deltaAbs));
    return out.slice(0, top);
  };
  return {
    mes,
    ventaNeta: m.ventaNeta, utilBruta: m.utilBruta, uafir: m.uafir, uaii: m.uaii,
    ventaPrev: m.prev.ventaNeta, utilPrev: m.prev.utilBruta, uafirPrev: m.prev.uafir, uaiiPrev: m.prev.uaii,
    pctBruta: m.pct.bruta, pctUafir: m.pct.uafir, pctUaii: m.pct.uaii,
    deltaVenta: m.delta.ventaNeta, deltaUtil: m.delta.utilBruta, deltaUafir: m.delta.uafir, deltaUaii: m.delta.uaii,
    varsMoM: mes >= 2 ? variaciones((c) => c.valores[mes - 1]) : [],
    varsYoY: variaciones((c) => idxPrev?.get(c.cuenta_norm)?.valores?.[mes]),
    notas: Array.from(idx.values()).filter((c) => c.notas[mes]).map((c) => ({ cuenta: c.cuenta, nota: c.notas[mes] })),
  };
}

// ─── Filas de la tabla formal ───
// Devuelve filas planas: grupo · cuenta · subtotal. `mesSel` = mes comparado (Mes vs mismo mes AA),
// `mesMax` = último mes cargado (YTD). Cada fila trae valores por mes del año y del anterior.
export function filasTabla(grupos, idx, idxPrev, mesSel, mesMax) {
  const filas = [];
  const filaCuenta = (c, g, tipo) => {
    const pct = g.formato === 'pct';
    const prev = idxPrev?.get(c.cuenta_norm);
    const valores = {}, prevValores = {};
    for (let m = 1; m <= 12; m++) { valores[m] = valorDe(idx, c.cuenta_norm, m); prevValores[m] = prev ? valorDe(idxPrev, c.cuenta_norm, m) : null; }
    const mesVal = valores[mesSel] ?? null, mesPrev = prevValores[mesSel] ?? null;
    const ytd = pct ? null : ytdDe(idx, c.cuenta_norm, mesMax);
    const ytdPrev = pct ? null : ytdDe(idxPrev, c.cuenta_norm, mesMax);
    return {
      id: c.cuenta_norm, tipo, grupoId: g.id, grupo: g.label, dotKey: g.dotKey, formato: g.formato || 'money',
      label: c.cuenta, esSubcuenta: esSubcuenta(c.cuenta), orden: c.orden, notas: c.notas, notaGeneral: c.notaGeneral,
      valores, prevValores, mesVal, mesPrev,
      deltaMes: pct ? dif(mesVal, mesPrev) : deltaPct(mesVal, mesPrev),
      ytd, ytdPrev, deltaYtd: pct ? null : deltaPct(ytd, ytdPrev),
    };
  };
  for (const g of grupos) {
    const cuentas = g.cuentas.map((s) => idx.get(s)).filter(Boolean).sort((a, b) => a.orden - b.orden);
    if (g.extra && idx.get(g.extra)) cuentas.push(idx.get(g.extra));
    const sub = g.subtotal ? idx.get(g.subtotal) : null;
    if (!cuentas.length && !sub) continue;
    filas.push({ id: `grupo:${g.id}`, tipo: 'grupo', grupoId: g.id, grupo: g.label, label: g.label, dotKey: g.dotKey, n: cuentas.length + (sub ? 1 : 0) });
    cuentas.forEach((c) => filas.push(filaCuenta(c, g, 'cuenta')));
    if (sub) filas.push(filaCuenta(sub, g, 'subtotal'));
  }
  return filas;
}

// ─── Puente ventas ERP vs P&L ───
// erpRows: filas de v_erp_medidas_mes del mismo año (mes, fact_bruta, fact_neta, venta_neta, contribucion…).
// P&L: venta_neta = ventas tasa general + tasa 0 + (devol/desc/bonif, negativo). Esa cuenta ya descuenta
// bonificaciones, así que su par natural en el ERP es Venta Neta (fact_neta + bonificaciones); Fact Neta
// se muestra también porque es la cifra oficial del director y la diferencia entre ambas son las
// bonificaciones. La alerta usa la comparación con Venta Neta del ERP.
export function puente(idx, erpRows, mesMax) {
  const erpBy = new Map((erpRows || []).map((r) => [Number(r.mes), r]));
  const mesErpMax = Math.max(0, ...Array.from(erpBy.keys()));
  const hasta = Math.max(mesMax || 0, mesErpMax);
  const filas = [];
  for (let m = 1; m <= hasta; m++) {
    const e = erpBy.get(m);
    const plVenta = valorDe(idx, SLUG.ventaNeta, m);
    const plBruta = esNum(valorDe(idx, SLUG.ventasGeneral, m)) ? (valorDe(idx, SLUG.ventasGeneral, m) || 0) + (valorDe(idx, SLUG.ventasTasa0, m) || 0) : null;
    const plUB = valorDe(idx, SLUG.utilBruta, m);
    const erpFB = e ? N(e.fact_bruta) : null, erpFN = e ? N(e.fact_neta) : null, erpVN = e ? N(e.venta_neta) : null, erpC = e ? N(e.contribucion) : null;
    const f = {
      mes: m, lbl: MESES_LBL[m - 1],
      plVentaNeta: plVenta, plVentasBrutas: plBruta, plUtilBruta: plUB,
      erpFactBruta: erpFB, erpFactNeta: erpFN, erpVentaNeta: erpVN, erpContribucion: erpC,
      difFactNeta: dif(erpFN, plVenta), difFactNetaPct: deltaPct(erpFN, plVenta),
      difVentaNeta: dif(erpVN, plVenta), difVentaNetaPct: deltaPct(erpVN, plVenta),
      difBrutas: dif(erpFB, plBruta), difBrutasPct: deltaPct(erpFB, plBruta),
      difContrib: dif(erpC, plUB), difContribPct: deltaPct(erpC, plUB),
      soloErp: plVenta == null && erpFN != null,
      soloPl: plVenta != null && erpFN == null,
    };
    f.alerta = f.difVentaNetaPct != null && Math.abs(f.difVentaNetaPct) > UMBRAL_PUENTE_PCT;
    filas.push(f);
  }
  const comunes = filas.filter((f) => !f.soloErp && !f.soloPl && f.plVentaNeta != null);
  const sum = (k) => comunes.reduce((s, f) => s + (f[k] || 0), 0);
  const t = {
    meses: comunes.length,
    plVentaNeta: sum('plVentaNeta'), plVentasBrutas: sum('plVentasBrutas'), plUtilBruta: sum('plUtilBruta'),
    erpFactBruta: sum('erpFactBruta'), erpFactNeta: sum('erpFactNeta'), erpVentaNeta: sum('erpVentaNeta'), erpContribucion: sum('erpContribucion'),
  };
  t.difFactNeta = t.erpFactNeta - t.plVentaNeta; t.difFactNetaPct = deltaPct(t.erpFactNeta, t.plVentaNeta);
  t.difVentaNeta = t.erpVentaNeta - t.plVentaNeta; t.difVentaNetaPct = deltaPct(t.erpVentaNeta, t.plVentaNeta);
  t.difBrutas = t.erpFactBruta - t.plVentasBrutas; t.difBrutasPct = deltaPct(t.erpFactBruta, t.plVentasBrutas);
  t.difContrib = t.erpContribucion - t.plUtilBruta; t.difContribPct = deltaPct(t.erpContribucion, t.plUtilBruta);
  t.alerta = t.difVentaNetaPct != null && Math.abs(t.difVentaNetaPct) > UMBRAL_PUENTE_PCT;
  const mesesAlerta = comunes.filter((f) => f.alerta).map((f) => f.mes);
  return { filas, totales: comunes.length ? t : null, mesesAlerta };
}

// ─── Información general (T.C., colaboradores…) ───
export function infoGeneral(idx, idxPrev, mes) {
  return INFO_SLUGS.map((slug) => {
    const c = idx.get(slug);
    if (!c) return null;
    const val = valorDe(idx, slug, mes);
    const valPrev = valorDe(idxPrev, slug, mes);
    return { slug, label: c.cuenta, valor: val, valorPrev: valPrev, delta: deltaPct(val, valPrev), entero: INFO_ENTEROS.has(slug) };
  }).filter(Boolean);
}
