// Producto 360 (2026-10-05) · cálculo puro: quién lo desplaza (cuentas de sell out), quién lo compra (clientes del ERP),
// quiénes dejaron de comprarlo, inventario en cuentas en semanas y serie sell in vs sell out. Sin red; pruebas en
// scripts/test-producto360.mjs. Los % y promedios se calculan al agregar, nunca se suman.
const N = (v) => Number(v) || 0;
const key = (a, m) => `${a}-${String(m).padStart(2, '0')}`;
const mesAnterior = (a, m) => (m === 1 ? [a - 1, 12] : [a, m - 1]);
const delta = (cur, prev) => (prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? null : 0);

/** Últimos `n` meses cerrados antes de (anio, mes), como llaves 'YYYY-MM'. */
export function mesesCerrados(anio, mes, n = 3) {
  const out = []; let a = anio, m = mes;
  for (let i = 0; i < n; i++) { [a, m] = mesAnterior(a, m); out.push(key(a, m)); }
  return out;
}

/**
 * Cuentas que desplazan el SKU en (anio, mes). filas = mv_sellout_cuenta_sku_mes del SKU (todas las cuentas, 13+ meses):
 * { cuenta, anio, mes, piezas, importe }. inventario = v_sellout_inventario_cuenta_sku del SKU: { cuenta, piezas, valor }.
 * Devuelve [{ cuenta, piezas, importe, deltaPz, deltaImp, share, inv: { piezas, semanas, estado } }] por piezas desc.
 */
export function quienLoDesplaza(filas, { anio, mes, inventario = [], nombres = {} } = {}) {
  const [pa, pm] = mesAnterior(anio, mes);
  const cerr = new Set(mesesCerrados(anio, mes, 3));
  const por = new Map();
  for (const f of filas) {
    const c = f.cuenta; if (!c) continue;
    const g = por.get(c) || (por.set(c, { cuenta: c, nombre: nombres[c] || c, piezas: 0, importe: 0, prevPz: 0, prevImp: 0, ritmo: 0 }), por.get(c));
    const k = key(f.anio, f.mes);
    if (N(f.anio) === anio && N(f.mes) === mes) { g.piezas += N(f.piezas); g.importe += N(f.importe); }
    else if (N(f.anio) === pa && N(f.mes) === pm) { g.prevPz += N(f.piezas); g.prevImp += N(f.importe); }
    if (cerr.has(k)) g.ritmo += N(f.piezas) / 3;
  }
  const invPor = new Map(inventario.map((i) => [i.cuenta, i]));
  for (const [c, i] of invPor) if (!por.has(c) && N(i.piezas) > 0) por.set(c, { cuenta: c, nombre: nombres[c] || c, piezas: 0, importe: 0, prevPz: 0, prevImp: 0, ritmo: 0 });
  const total = [...por.values()].reduce((s, g) => s + g.piezas, 0);
  return [...por.values()].map((g) => {
    const inv = invPor.get(g.cuenta);
    const semanas = inv && g.ritmo > 0 ? N(inv.piezas) / (g.ritmo / 4.33) : null;
    const estado = !inv ? null : N(inv.piezas) <= 0 ? 'agotado' : semanas != null && semanas < 2 ? 'riesgo' : semanas != null && semanas > 12 ? 'sobre' : 'sano';
    return { ...g, deltaPz: delta(g.piezas, g.prevPz), deltaImp: delta(g.importe, g.prevImp), share: total ? (g.piezas / total) * 100 : 0, inv: inv ? { piezas: N(inv.piezas), valor: N(inv.valor), semanas: semanas == null ? null : Math.round(semanas * 10) / 10, estado } : null };
  }).filter((g) => g.piezas > 0 || g.prevPz > 0 || g.inv).sort((a, b) => b.piezas - a.piezas || b.prevPz - a.prevPz);
}

/**
 * Clientes del ERP que compran el SKU. filas = mv_analisis_cliente_sku_mes del SKU (24 meses): { cliente, cliente_nombre, anio, mes, piezas, monto }.
 * Devuelve { compran: [{ cliente, nombre, piezas, monto, deltaPz, ultimaCompra, mesesSeguidos }], dejaron: [{ cliente, nombre, ultimaCompra, piezasUltima, piezas12m }] }.
 */
export function quienLoCompra(filas, { anio, mes, ventana = 6 } = {}) {
  const [pa, pm] = mesAnterior(anio, mes);
  const hoyK = key(anio, mes);
  const desdeK = (() => { let a = anio, m = mes; for (let i = 0; i < ventana - 1; i++) [a, m] = mesAnterior(a, m); return key(a, m); })();
  const por = new Map();
  for (const f of filas) {
    const c = f.cliente || f.cliente_nombre; if (!c) continue;
    const g = por.get(c) || (por.set(c, { cliente: c, nombre: f.cliente_nombre || c, piezas: 0, monto: 0, prevPz: 0, meses: new Map() }), por.get(c));
    const k = key(f.anio, f.mes);
    if (N(f.piezas) > 0) g.meses.set(k, (g.meses.get(k) || 0) + N(f.piezas));
    if (k === hoyK) { g.piezas += N(f.piezas); g.monto += N(f.monto); }
    else if (N(f.anio) === pa && N(f.mes) === pm) g.prevPz += N(f.piezas);
  }
  const compran = [], dejaron = [];
  for (const g of por.values()) {
    const llaves = [...g.meses.keys()].sort();
    const ultima = llaves[llaves.length - 1] || null;
    if (g.piezas > 0) {
      let seguidos = 0; let a = anio, m = mes;
      while (g.meses.has(key(a, m))) { seguidos++; [a, m] = mesAnterior(a, m); }
      compran.push({ cliente: g.cliente, nombre: g.nombre, piezas: g.piezas, monto: g.monto, deltaPz: delta(g.piezas, g.prevPz), ultimaCompra: ultima, mesesSeguidos: seguidos });
    } else if (ultima && ultima < desdeK) {
      const piezas12m = llaves.filter((k) => k > key(anio - 1, mes)).reduce((s, k) => s + g.meses.get(k), 0);
      dejaron.push({ cliente: g.cliente, nombre: g.nombre, ultimaCompra: ultima, piezasUltima: g.meses.get(ultima), piezas12m });
    }
  }
  compran.sort((a, b) => b.piezas - a.piezas);
  dejaron.sort((a, b) => b.piezas12m - a.piezas12m || b.ultimaCompra.localeCompare(a.ultimaCompra));
  return { compran, dejaron };
}

/** Serie de 12 meses (hasta anio/mes) con sell in y sell out del SKU en piezas o monto. */
export function serieSiSo(sellin, sellout, { anio, mes, campoSi = 'piezas', campoSo = 'piezas' } = {}) {
  const meses = []; let a = anio, m = mes;
  for (let i = 0; i < 12; i++) { meses.unshift({ anio: a, mes: m, key: key(a, m) }); [a, m] = mesAnterior(a, m); }
  const si = new Map(), so = new Map();
  for (const f of sellin) { const k = key(f.anio, f.mes); si.set(k, (si.get(k) || 0) + N(f[campoSi])); }
  for (const f of sellout) { const k = key(f.anio, f.mes); so.set(k, (so.get(k) || 0) + N(f[campoSo])); }
  return meses.map((x) => ({ ...x, label: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][x.mes - 1], si: si.get(x.key) || 0, so: so.get(x.key) || 0 }));
}

/** Semanas de inventario propio: piezas / ritmo (sell in mensual promedio de 3 meses cerrados). */
export const semanasDe = (piezas, ritmoMensual) => (ritmoMensual > 0 ? Math.round((N(piezas) / (ritmoMensual / 4.33)) * 10) / 10 : null);
