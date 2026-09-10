// Análisis por Cliente · cálculo puro sobre v_analisis_cliente_mes (grano cliente × mes).
// Sin React ni Supabase: todo lo que se prueba a mano vive aquí.

export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const PROPIOS = new Set(['digitalife', 'pcel', 'dicotech']);
export const OTROS_KEY = '__otros_ocasional';

// Regla "compra ocasional" (Fernando, 2026-09-11): menos de MIN_MESES meses con compra en
// los últimos VENTANA meses, o venta YTD por debajo de PCT_MIN del total YTD. Ajustable aquí.
export const OCASIONAL = { MIN_MESES: 6, VENTANA: 12, PCT_MIN: 0.002 };

export const N = (v) => Number(v) || 0;
export const MEDIDAS = ['fact_bruta', 'devoluciones', 'rmas', 'bonificaciones', 'fact_neta', 'venta_neta', 'costo_fact_neta', 'costo_venta_neta', 'contribucion', 'utilidad_comercial', 'piezas_venta_neta'];

export const vacio = () => Object.fromEntries(MEDIDAS.map((k) => [k, 0]));
export function acumular(acc, r) { for (const k of MEDIDAS) acc[k] += N(r[k]); return acc; }
export const idxMes = (anio, mes) => N(anio) * 12 + (N(mes) - 1);
export const pctDe = (a, b) => (b ? (a / b) * 100 : null);
export const yoyDe = (cur, prev) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);
export const mcDe = (a) => (a.fact_neta ? (a.contribucion / a.fact_neta) * 100 : null);
export const ajustesDe = (a) => (a.fact_bruta ? ((a.devoluciones + a.rmas + a.bonificaciones) / a.fact_bruta) * -100 : null);

export const enPeriodo = (r, anio, mesMax, modo) => N(r.anio) === anio && (modo === 'mes' ? N(r.mes) === mesMax : N(r.mes) <= mesMax);

/** Último mes con fact_neta > 0 del año pedido (o null). */
export function ultimoMesConVenta(rows, anio) {
  let m = 0;
  for (const r of rows) if (N(r.anio) === anio && N(r.fact_neta) > 0 && N(r.mes) > m) m = N(r.mes);
  return m || null;
}

/** Totales globales por (anio, mes) → Map idx → agg. */
export function totalesMensuales(rows) {
  const m = new Map();
  for (const r of rows) {
    const k = idxMes(r.anio, r.mes);
    if (!m.has(k)) m.set(k, vacio());
    acumular(m.get(k), r);
  }
  return m;
}

export function sumarPeriodo(rows, anio, mesMax, modo) {
  const a = vacio();
  for (const r of rows) if (enPeriodo(r, anio, mesMax, modo)) acumular(a, r);
  return a;
}

/**
 * Agrega las filas (dos años) por cliente. Devuelve:
 *   { clientes: [...], soloPrev: [...], totales: { cur, prev, ytd, ytdPrev }, activosMes, concentracion10 }
 * Cada cliente: { cliente, nombre, key, canal, propio, cur, prev, ytd, ytdPrev, yoy, mc,
 *   mesesCompra12, ocasional, ultimaCompra:{anio,mes}, mensual: Map idx→agg }
 */
export function agregarClientes(rows, anio, mesMax, modo) {
  const idxFin = idxMes(anio, mesMax), idxIni = idxFin - (OCASIONAL.VENTANA - 1);
  const by = new Map();
  for (const r of rows) {
    const id = String(r.cliente ?? r.cliente_nombre ?? '');
    if (!id) continue;
    let c = by.get(id);
    if (!c) {
      c = { cliente: id, nombre: r.cliente_nombre || id, key: r.cliente_key || 'otros', canal: r.canal || 'otros', propio: PROPIOS.has(r.cliente_key), cur: vacio(), prev: vacio(), ytd: vacio(), ytdPrev: vacio(), mensual: new Map(), ultimaCompra: null, mesesCompra12: 0 };
      by.set(id, c);
    }
    // Dimensiones: manda el año consultado (mode por año en la MV); el año anterior sólo si no hay dato del actual
    if (N(r.anio) === anio && r.cliente_nombre) { c.nombre = r.cliente_nombre; c.key = r.cliente_key || c.key; c.canal = r.canal || c.canal; c.propio = PROPIOS.has(r.cliente_key); }
    const k = idxMes(r.anio, r.mes);
    if (!c.mensual.has(k)) c.mensual.set(k, vacio());
    acumular(c.mensual.get(k), r);
    if (enPeriodo(r, anio, mesMax, modo)) acumular(c.cur, r);
    if (enPeriodo(r, anio - 1, mesMax, modo)) acumular(c.prev, r);
    if (enPeriodo(r, anio, mesMax, 'ytd')) acumular(c.ytd, r);
    if (enPeriodo(r, anio - 1, mesMax, 'ytd')) acumular(c.ytdPrev, r);
  }
  const totales = { cur: vacio(), prev: vacio(), ytd: vacio(), ytdPrev: vacio() };
  const clientes = [];
  for (const c of by.values()) {
    let meses12 = 0, ult = null;
    for (const [k, a] of c.mensual) {
      if (a.fact_neta <= 0) continue;
      if (k >= idxIni && k <= idxFin) meses12 += 1;
      if (ult == null || k > ult) ult = k;
    }
    c.mesesCompra12 = meses12;
    c.ultimaCompra = ult == null ? null : { anio: Math.floor(ult / 12), mes: (ult % 12) + 1 };
    c.yoy = yoyDe(c.cur.fact_neta, c.prev.fact_neta);
    c.mc = mcDe(c.cur);
    for (const t of ['cur', 'prev', 'ytd', 'ytdPrev']) acumular(totales[t], c[t]);
    clientes.push(c);
  }
  const umbral = OCASIONAL.PCT_MIN * totales.ytd.fact_neta;
  for (const c of clientes) c.ocasional = c.mesesCompra12 < OCASIONAL.MIN_MESES || c.ytd.fact_neta < umbral;
  // Sólo cuentan en la pantalla los clientes con algún movimiento en el periodo o el año (los del año anterior nada más alimentan YoY)
  const visibles = clientes.filter((c) => c.ytd.fact_neta !== 0 || c.cur.fact_neta !== 0 || Object.values(c.ytd).some((v) => v !== 0));
  // Clientes con venta sólo en el año anterior ("perdidos"): no salen en la tabla, pero su
  // venta previa sí cuenta en el YoY de los totales para que cuadre con el YoY global.
  const setVis = new Set(visibles);
  const soloPrev = clientes.filter((c) => !setVis.has(c));
  const activosMes = clientes.filter((c) => (c.mensual.get(idxFin)?.fact_neta || 0) > 0).length;
  const top = visibles.map((c) => c.cur.fact_neta).filter((v) => v > 0).sort((a, b) => b - a);
  const top10 = top.slice(0, 10).reduce((s, v) => s + v, 0);
  const concentracion10 = pctDe(top10, top.reduce((s, v) => s + v, 0));
  return { clientes: visibles, soloPrev, totales, activosMes, concentracion10 };
}

/** Fila-grupo "Otros · compra ocasional" a partir de sus clientes. */
export function filaOtros(hijos) {
  const g = { cliente: OTROS_KEY, nombre: `Otros · compra ocasional (${hijos.length} clientes)`, key: 'otros', canal: '—', propio: false, esGrupo: true, hijos, cur: vacio(), prev: vacio(), ytd: vacio(), ytdPrev: vacio(), mesesCompra12: null, ultimaCompra: null };
  for (const h of hijos) for (const t of ['cur', 'prev', 'ytd', 'ytdPrev']) acumular(g[t], h[t]);
  g.yoy = yoyDe(g.cur.fact_neta, g.prev.fact_neta);
  g.mc = mcDe(g.cur);
  return g;
}

/** Aplana un cliente a la forma que consume TablaCompacta (sum:true por columna). */
export function aplanar(c) {
  const a = c.cur;
  return { ...c, id: c.cliente, fact_bruta: a.fact_bruta, devoluciones: a.devoluciones, rmas: a.rmas, bonificaciones: a.bonificaciones, fact_neta: a.fact_neta, venta_neta: a.venta_neta, piezas: a.piezas_venta_neta, contribucion: a.contribucion };
}

/** Pareto sobre fact_neta del periodo: orden desc, % acumulado y corte 80 %. */
export function pareto(filas, corte = 80) {
  const ord = filas.filter((f) => f.fact_neta > 0).sort((a, b) => b.fact_neta - a.fact_neta);
  const total = ord.reduce((s, f) => s + f.fact_neta, 0);
  let acum = 0, nCorte = 0;
  const lista = ord.map((f, i) => {
    acum += f.fact_neta;
    const pctAcum = pctDe(acum, total) || 0;
    if (!nCorte && pctAcum >= corte) nCorte = i + 1;
    return { ...f, rank: i + 1, pct: pctDe(f.fact_neta, total) || 0, pctAcum };
  });
  if (!nCorte) nCorte = lista.length;
  return { lista, total, nCorte };
}

/** Serie de los últimos 12 meses (terminando en anio/mesMax) con la línea del año anterior. */
export function serie12(mensual, anio, mesMax) {
  const fin = idxMes(anio, mesMax);
  return Array.from({ length: 12 }, (_, i) => {
    const k = fin - 11 + i, a = mensual.get(k), p = mensual.get(k - 12);
    const y = Math.floor(k / 12), m = (k % 12) + 1;
    return { k, anio: y, mes: m, label: `${MESES[m - 1]}${m === 1 || i === 0 ? ` ${String(y).slice(2)}` : ''}`, fact_neta: a?.fact_neta ?? 0, contribucion: a?.contribucion ?? 0, anterior: p?.fact_neta ?? null };
  });
}
