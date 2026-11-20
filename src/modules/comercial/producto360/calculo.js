import { estadoCobertura, PERFILES } from '../../../lib/cobertura.js';
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

// Inventario en la cuenta (semanas): regla en src/lib/cobertura.js, perfil «cuentaSemanas» (<2 riesgo · >12 sobre). Con stock y sin ritmo = sano.
const ESTADO_CUENTA = { agotado: 'agotado', critico: 'riesgo', sobre: 'sobre', sano: 'sano', justo: 'sano', sinDato: 'sano' };
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
    const estado = !inv ? null : ESTADO_CUENTA[estadoCobertura(semanas, PERFILES.cuentaSemanas, { agotado: N(inv.piezas) <= 0, soloNull: true })];
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

// ─── Resumen de la ficha (2026-11-18): lo que antes armaba la pantalla del celular en un useMemo, ahora compartido
// con la ficha web (Producto360Web.jsx). `d` = lo que devuelve producto360/datos.js#useProducto360. ───────────────
const MESES_C = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const intMx = (n) => Math.round(N(n)).toLocaleString('es-MX');

/** Mes de lectura: el mes en curso si ya van 10 días; si no, el último cerrado. */
export function mesDeLectura(hoy = new Date()) {
  const anioHoy = hoy.getFullYear(), mesHoy = hoy.getMonth() + 1;
  const pocoMes = hoy.getDate() < 10;
  const [anio, mes] = pocoMes ? mesAnterior(anioHoy, mesHoy) : [anioHoy, mesHoy];
  return { anio, mes, anioHoy, mesHoy, pocoMes };
}

export function resumenProducto(d, { hoy = new Date(), unidad = 'piezas' } = {}) {
  if (!d) return null;
  const { anio, mes, anioHoy, mesHoy } = mesDeLectura(hoy);
  const campo = unidad === 'piezas' ? 'piezas' : 'monto';
  const nombresCuenta = Object.fromEntries((d.cuentas || []).map((c) => [c.cuenta, c.nombre]));
  const desplaza = quienLoDesplaza(d.sellout.map((x) => ({ cuenta: x.cuenta, anio: x.anio, mes: x.mes, piezas: x.cantidad, importe: x.importe })), { anio, mes, inventario: d.invCuentas, nombres: nombresCuenta });
  const compra = quienLoCompra(d.sellin.map((x) => ({ cliente: x.cliente, cliente_nombre: x.cliente_nombre, anio: x.anio, mes: x.mes, piezas: x.piezas_venta_neta, monto: x.fact_neta })), { anio, mes });
  const serie = serieSiSo(d.sellin.map((x) => ({ anio: x.anio, mes: x.mes, piezas: x.piezas_venta_neta, monto: x.fact_neta })), d.sellout.map((x) => ({ anio: x.anio, mes: x.mes, piezas: x.cantidad, monto: x.importe })), { anio, mes, campoSi: campo, campoSo: campo });
  const mesK = key(anio, mes);
  const cerr = new Set(mesesCerrados(anioHoy, mesHoy, 3));
  const enCerr = (x) => cerr.has(key(x.anio, x.mes));
  const delMes = (x) => N(x.anio) === anio && N(x.mes) === mes;
  const ritmoSi = d.sellin.filter(enCerr).reduce((t, x) => t + N(x.piezas_venta_neta), 0) / 3;
  const ritmoSo = d.sellout.filter(enCerr).reduce((t, x) => t + N(x.cantidad), 0) / 3;
  const piezasSi = d.sellin.filter(delMes).reduce((t, x) => t + N(x.piezas_venta_neta), 0);
  const montoSi = d.sellin.filter(delMes).reduce((t, x) => t + N(x.fact_neta), 0);
  const piezasSo = d.sellout.filter(delMes).reduce((t, x) => t + N(x.cantidad), 0);
  const montoSo = d.sellout.filter(delMes).reduce((t, x) => t + N(x.importe), 0);
  const invPz = N(d.inv?.inv_actual_piezas), invDisp = N(d.inv?.inv_actual_disponible), invValor = N(d.inv?.inv_actual);
  const semanas = semanasDe(invPz, ritmoSi);
  const invCuentasPz = d.invCuentas.reduce((t, x) => t + x.piezas, 0), invCuentasValor = d.invCuentas.reduce((t, x) => t + x.valor, 0);
  const semCuentas = semanasDe(invCuentasPz, ritmoSo);
  const tr = d.transito;
  const proximo = Array.isArray(tr?.embarques_detalle) ? [...tr.embarques_detalle].filter((e) => e.eta).sort((a, b) => String(a.eta).localeCompare(String(b.eta)))[0] : null;
  const conPz = desplaza.filter((x) => x.piezas > 0);
  const top2 = conPz.slice(0, 2);
  const share2 = top2.reduce((t, x) => t + x.share, 0);
  const agotadas = desplaza.filter((x) => x.inv?.estado === 'agotado' && x.prevPz > 0);
  const frase = piezasSo > 0 || piezasSi > 0
    ? `${piezasSo > 0 ? `Se desplazaron ${intMx(piezasSo)} pz en ${conPz.length} cuenta${conPz.length === 1 ? '' : 's'}` : 'Sin sell out reportado'}${piezasSi > 0 && piezasSo > 0 ? `, ${(piezasSo / piezasSi).toFixed(1)} veces lo que facturamos` : piezasSi > 0 ? `; facturamos ${intMx(piezasSi)} pz` : ''}${top2.length ? `; ${top2.map((x) => x.nombre).join(' y ')} concentra${top2.length === 1 ? '' : 'n'} el ${Math.round(share2)} %` : ''}${agotadas.length ? `, y ${agotadas[0].nombre} ya se quedó sin pieza` : ''}.`
    : 'Sin movimiento en el mes.';
  const stockMeses = (() => {
    const a = (d.stockAnio || []).find((x) => N(x.anio) === anioHoy), p = (d.stockAnio || []).find((x) => N(x.anio) === anioHoy - 1);
    if (!a && !p) return null;
    const cols = [], vals = [];
    for (let i = 0; i < 12; i++) {
      const m = ((mesHoy - 12 + i) % 12 + 12) % 12; const esPrev = mesHoy - 12 + i < 0; const src = esPrev ? p : a;
      const arr = unidad === 'piezas' ? src?.piezas : src?.valor;
      cols.push(`${MESES_C[m]}${esPrev ? ` ${String(anioHoy - 1).slice(2)}` : ''}`); vals.push(N(arr?.[m]));
    }
    return { cols, vals };
  })();
  return { desplaza, compra, serie, piezasSi, montoSi, piezasSo, montoSo, ritmoSi, ritmoSo, invPz, invDisp, invValor, semanas, invCuentasPz, invCuentasValor, semCuentas, proximo, tr, frase, stockMeses, mesK, anio, mes };
}

/** Listas de precio vigentes del SKU; con `costo` (sólo con permiso sensible) agrega margen % y utilidad por pieza. */
export function preciosDeLista(precios = [], costo = null) {
  const c = N(costo);
  return (precios || []).filter((p) => N(p.precio) > 0).map((p) => {
    const precio = N(p.precio);
    return { lista: p.lista, precio, margenPct: c > 0 ? Math.round(((precio - c) / precio) * 1000) / 10 : null, utilidad: c > 0 ? Math.round((precio - c) * 100) / 100 : null };
  }).sort((a, b) => b.precio - a.precio);
}
