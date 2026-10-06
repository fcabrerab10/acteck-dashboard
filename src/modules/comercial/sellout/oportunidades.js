// «<Cuenta> frente al resto» · cálculo puro (2026-10-05, Análisis por cliente en el celular, pantalla
// «Abrir sell out completo»). Sin React ni Supabase.
//   · paresDe(cuentas, cuenta)             → cuentas del mismo canal_sellout que sí reportan sell out
//   · oportunidades({...})                 → SKUs que mueven ≥ 2 pares y esta cuenta no vende ni tiene en inventario
//   · ranking(filas, cuenta)               → posición por sell out del mes entre las cuentas con fuente
//   · pesoEnCanal(filas, cuenta)           → % del canal (mes) y Δ pp contra el año anterior, SO/SI del canal
//   · clientesNuevosPerdidos(cf, anio, mes)→ nuevos (sin compra en los `ventana` meses anteriores) y perdidos
// Pruebas: node --test scripts/test-sellout-oportunidades.mjs

const N = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v));
const idx = (a, m) => N(a) * 12 + (N(m) - 1);
const ratio = (a, b) => (b ? (a / b) * 100 : null);

/** Cuentas pares: mismo canal, con fuente de sell out, sin la propia ni el «directo» (que agrupa varios clientes). */
export function paresDe(cuentas = [], cuenta) {
  const yo = cuentas.find((c) => c.cuenta === cuenta);
  if (!yo) return [];
  return cuentas.filter((c) => c.cuenta !== cuenta && c.canal_sellout === yo.canal_sellout && c.tiene_sellout !== false && c.cuenta !== 'directo').map((c) => c.cuenta);
}

/**
 * @param {object} p
 * @param {Array}  p.skuMes      mv_sellout_cuenta_sku_mes de la cuenta y sus pares (sólo los meses de la ventana)
 * @param {string} p.cuenta
 * @param {Array}  p.pares       ids de cuentas pares (paresDe)
 * @param {Array}  p.meses       [{ anio, mes }] ventana (3 meses cerrados)
 * @param {Array}  [p.inventario] v_sellout_inventario_cuenta_sku de la cuenta (stock por sku)
 * @param {number} [p.minPares=2]
 * @param {number} [p.top=15]
 * @returns {{ lista, total, importeMes, pzMes }}  lista ordenada por pz/mes en los pares
 */
export function oportunidades({ skuMes = [], cuenta, pares = [], meses = [], inventario = [], minPares = 2, top = 15 }) {
  const enVentana = new Set(meses.map((m) => idx(m.anio, m.mes)));
  const nMeses = Math.max(1, meses.length);
  const setPares = new Set(pares);
  const stock = new Map();
  for (const r of inventario) { const k = String(r.sku || '').toUpperCase(); stock.set(k, N(stock.get(k)) + N(r.stock)); }
  const porSku = new Map();
  const vendeYo = new Set();
  for (const r of skuMes) {
    if (!enVentana.has(idx(r.anio, r.mes))) continue;
    const k = String(r.sku || '').toUpperCase(); if (!k) continue;
    if (r.cuenta === cuenta) { if (N(r.cantidad) > 0 || N(r.importe) > 0) vendeYo.add(k); continue; }
    if (!setPares.has(r.cuenta)) continue;
    let f = porSku.get(k);
    if (!f) { f = { sku: k, marca: r.marca || '', categoria: r.categoria || '', pz: 0, importe: 0, cuentas: new Set() }; porSku.set(k, f); }
    f.pz += N(r.cantidad); f.importe += N(r.importe);
    if (N(r.cantidad) > 0 || N(r.importe) > 0) f.cuentas.add(r.cuenta);
  }
  const todas = [...porSku.values()]
    .filter((f) => f.cuentas.size >= minPares && !vendeYo.has(f.sku) && !(N(stock.get(f.sku)) > 0))
    .map((f) => ({ sku: f.sku, marca: f.marca, categoria: f.categoria, pzMes: f.pz / nMeses, importeMes: f.importe / nMeses, nPares: f.cuentas.size, dePares: pares.length }))
    .sort((a, b) => b.pzMes - a.pzMes || b.importeMes - a.importeMes);
  return {
    lista: todas.slice(0, top),
    total: todas.length,
    importeMes: todas.reduce((s, f) => s + f.importeMes, 0),
    pzMes: todas.reduce((s, f) => s + f.pzMes, 0),
  };
}

/** Posición de la cuenta por sell out del mes (filas de construirFilas), sólo entre las que reportan. */
export function ranking(filas = [], cuenta) {
  const con = filas.filter((f) => !f.sinFuente).sort((a, b) => N(b.importe) - N(a.importe));
  const pos = con.findIndex((f) => f.cuenta === cuenta);
  return { pos: pos < 0 ? null : pos + 1, de: con.length };
}

/** Peso de la cuenta en su canal este mes y el mismo mes del año anterior (pp), y SO/SI del canal sin ella. */
export function pesoEnCanal(filas = [], cuenta) {
  const yo = filas.find((f) => f.cuenta === cuenta);
  if (!yo) return { canal: null, pct: null, pctPrev: null, deltaPp: null, soSiCanal: null, soSi: null, cuentasCanal: 0 };
  const canal = filas.filter((f) => f.canal === yo.canal && !f.sinFuente);
  const tot = canal.reduce((s, f) => s + N(f.importe), 0), totPrev = canal.reduce((s, f) => s + N(f.importePrev), 0);
  const pct = ratio(N(yo.importe), tot), pctPrev = ratio(N(yo.importePrev), totPrev);
  const otras = canal.filter((f) => f.cuenta !== cuenta && f.sellIn != null && f.sellIn > 0);
  const soSiCanal = otras.length ? ratio(otras.reduce((s, f) => s + N(f.importe), 0), otras.reduce((s, f) => s + N(f.sellIn), 0)) : null;
  return { canal: yo.canal, pct, pctPrev, deltaPp: pct != null && pctPrev != null ? pct - pctPrev : null, soSiCanal, soSi: yo.soSi ?? null, cuentasCanal: canal.length };
}

/**
 * Clientes finales nuevos y perdidos del mes.
 *   nuevos   = compraron este mes y en ninguno de los `ventana` meses anteriores que vengan en `cf`
 *   perdidos = compraron el mes anterior y no este
 * `cf` = mv_sellout_cliente_final_mes de la cuenta (los meses que haya: con sólo mes y anterior, «nuevo» = vs anterior).
 */
export function clientesNuevosPerdidos(cf = [], anio, mes, ventana = 6) {
  const iAct = idx(anio, mes);
  const porCliente = new Map();
  for (const r of cf) {
    const k = r.cliente_final; if (!k) continue;
    const i = idx(r.anio, r.mes);
    let c = porCliente.get(k);
    if (!c) { c = { cliente: k, act: 0, prev: 0, antes: false }; porCliente.set(k, c); }
    if (i === iAct) c.act += N(r.importe);
    else if (i === iAct - 1) { c.prev += N(r.importe); if (N(r.importe) > 0) c.antes = true; }
    else if (i < iAct && i >= iAct - ventana && N(r.importe) > 0) c.antes = true;
  }
  const nuevos = [], perdidos = [];
  for (const c of porCliente.values()) {
    if (c.act > 0 && !c.antes) nuevos.push({ cliente: c.cliente, importe: c.act });
    if (c.act <= 0 && c.prev > 0) perdidos.push({ cliente: c.cliente, importe: c.prev });
  }
  nuevos.sort((a, b) => b.importe - a.importe); perdidos.sort((a, b) => b.importe - a.importe);
  return { nuevos, perdidos, nuevosImporte: nuevos.reduce((s, x) => s + x.importe, 0), perdidosImporte: perdidos.reduce((s, x) => s + x.importe, 0) };
}

export default { paresDe, oportunidades, ranking, pesoEnCanal, clientesNuevosPerdidos };
