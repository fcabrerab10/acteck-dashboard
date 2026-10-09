// Análisis por cliente · «Quién se mueve» y «A quién llamar hoy» (2026-10-08). Puro, sobre la vista diaria por cliente
// (v_sellin_cliente_dia: cliente, anio, mes, dia, fact_neta, piezas, facturas). Fernando eligió sólo estos dos bloques
// (en lugar del Pareto y el Comparador): quién sube y baja contra el mes anterior a mismo día, quién compró el mes pasado
// y este mes no, y la lista de llamadas: cada cuántos días compra cada cliente y cuántos lleva sin comprar.
import { MESES } from './calc';

const N = (v) => (Number.isFinite(+v) ? +v : 0);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fechaDe = (r) => new Date(r.anio, r.mes - 1, r.dia, 12);
const diasEntre = (a, b) => Math.round((b - a) / 86400000);
const mesLbl = (m) => MESES[m - 1].toLowerCase();
const mediana = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const fmtM = (n) => { const a = Math.abs(n); const s = a >= 1e6 ? `$${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `$${Math.round(a / 1e3)}K` : `$${Math.round(a)}`; return (n < 0 ? '−' : '') + s; };

/** Agrupa las filas diarias por cliente: { cliente, key, dias: [{fecha, f, piezas, facturas}] } ordenados por fecha. */
export function porClienteDia(filas = []) {
  const m = new Map();
  for (const r of filas) {
    const g = m.get(r.cliente) || { cliente: r.cliente, key: r.cliente_key || null, dias: [] };
    g.dias.push({ fecha: fechaDe(r), f: N(r.fact_neta), piezas: N(r.piezas), facturas: N(r.facturas) });
    m.set(r.cliente, g);
  }
  for (const g of m.values()) g.dias.sort((a, b) => a.fecha - b.fecha);
  return m;
}

/**
 * Quién se mueve: este mes a mismo día contra el mes anterior a mismo día. `hoy` manda el mes y el día.
 * Devuelve { suben, bajan, sinComprar, mesLbl, mesPrevLbl, dia } con frases cortas por cliente.
 */
/** Nombre para pintar: si dos códigos comparten nombre (Ingram, PCH…), se agrega el código. */
export function nombrar(nombres) {
  const cuenta = new Map();
  for (const [, v] of nombres) { const n = v?.nombre || v; cuenta.set(n, (cuenta.get(n) || 0) + 1); }
  return (k) => { const n = nombres.get(k)?.nombre || nombres.get(k) || k; return cuenta.get(n) > 1 ? `${n} · ${k}` : n; };
}
const filtrar = (filas, solo) => (solo ? filas.filter((r) => solo.has(r.cliente)) : filas);

export function quienSeMueve(filasTodas = [], { hoy = new Date(), nombres = new Map(), top = 5, umbral = 50000, solo = null } = {}) {
  const filas = filtrar(filasTodas, solo);
  const anio = hoy.getFullYear(), mes = hoy.getMonth() + 1, dia = hoy.getDate();
  const prevAnio = mes === 1 ? anio - 1 : anio, prevMes = mes === 1 ? 12 : mes - 1;
  const enMes = (r, a, m, hastaDia = 31) => r.anio === a && r.mes === m && r.dia <= hastaDia;
  const porC = new Map();
  for (const r of filas) {
    const c = porC.get(r.cliente) || { cliente: r.cliente, cur: 0, prevMismoDia: 0, prevTotal: 0, prevDias: 0, curDias: 0, primero: null, ultimoMesConVenta: null };
    const f = N(r.fact_neta);
    if (enMes(r, anio, mes)) { c.cur += f; if (f > 0) c.curDias += 1; }
    if (enMes(r, prevAnio, prevMes, dia)) c.prevMismoDia += f;
    if (enMes(r, prevAnio, prevMes)) { c.prevTotal += f; if (f > 0) c.prevDias += 1; }
    if (f > 0 && !(r.anio === anio && r.mes === mes)) { const k = r.anio * 100 + r.mes; if (!c.ultimoMesConVenta || k > c.ultimoMesConVenta) c.ultimoMesConVenta = k; }
    porC.set(r.cliente, c);
  }
  const nombre = nombrar(nombres);
  const lista = [...porC.values()].map((c) => {
    const delta = c.cur - c.prevMismoDia;
    let frase;
    if (c.cur < 0) frase = `devoluciones: ${fmtM(c.cur)} en ${mesLbl(mes)}`;
    else if (c.cur > 0 && c.prevTotal > 0 && c.cur >= c.prevTotal) frase = `${fmtM(c.cur)} · ya superó todo ${mesLbl(prevMes)}`;
    else if (c.cur > 0 && c.prevMismoDia <= 0) { const u = c.ultimoMesConVenta; frase = u && u < prevAnio * 100 + prevMes ? `${fmtM(c.cur)} · por primera vez desde ${mesLbl(u % 100)}` : `${fmtM(c.cur)} · en ${mesLbl(prevMes)} nada a mismo día`; }
    else if (c.cur === 0 && c.prevMismoDia > 0) frase = `nada en ${mesLbl(mes)} · en ${mesLbl(prevMes)} llevaba ${fmtM(c.prevMismoDia)} a mismo día`;
    else frase = `${fmtM(c.cur)} en ${mesLbl(mes)} · ${fmtM(c.prevMismoDia)} a mismo día de ${mesLbl(prevMes)}`;
    return { ...c, nombre: nombre(c.cliente), delta, frase };
  });
  const suben = lista.filter((c) => c.delta >= umbral).sort((a, b) => b.delta - a.delta).slice(0, top);
  // Los que no han comprado este mes van en su propia lista, no en «bajan».
  const bajan = lista.filter((c) => c.delta <= -umbral && !(c.curDias === 0 && c.cur === 0)).sort((a, b) => a.delta - b.delta).slice(0, top);
  const sinComprar = lista.filter((c) => c.prevTotal > 0 && c.curDias === 0).sort((a, b) => b.prevTotal - a.prevTotal);
  return { suben, bajan, sinComprar, mesLbl: mesLbl(mes), mesPrevLbl: mesLbl(prevMes), dia, total: lista.length };
}

/**
 * Ritmo de compra por cliente en los últimos `ventana` días: cada cuántos días compra (mediana de huecos entre días con
 * venta), cuántos lleva sin comprar, ticket promedio por día de compra, este mes vs el anterior a mismo día y un estado:
 * atrasado (lleva > cadencia + 2 y > cadencia × 1.5) · leToca (lleva ≥ cadencia − 1) · enfriado (compra, pero este mes
 * va < 50 % del anterior a mismo día) · alRitmo · ocasional (menos de 3 compras en la ventana). Ordenado por atraso.
 */
export function ritmoCompra(filasTodas = [], { hoy = new Date(), ventana = 180, nombres = new Map(), minCompras = 3, solo = null } = {}) {
  const filas = filtrar(filasTodas, solo);
  const desde = new Date(hoy.getTime() - ventana * 86400000);
  const mes = hoy.getMonth() + 1, anio = hoy.getFullYear(), dia = hoy.getDate();
  const prevAnio = mes === 1 ? anio - 1 : anio, prevMes = mes === 1 ? 12 : mes - 1;
  const porC = porClienteDia(filas);
  const nombre = nombrar(nombres);
  const out = [];
  for (const g of porC.values()) {
    const compras = g.dias.filter((d) => d.f > 0 && d.fecha >= desde);
    if (!compras.length) continue;
    const huecos = compras.slice(1).map((d, i) => diasEntre(compras[i].fecha, d.fecha)).filter((h) => h > 0);
    const cadencia = compras.length >= minCompras ? Math.max(1, Math.round(mediana(huecos))) : null;
    const ultima = compras.at(-1);
    const lleva = diasEntre(ultima.fecha, hoy);
    const ticket = compras.reduce((s, d) => s + d.f, 0) / compras.length;
    const cur = g.dias.filter((d) => d.fecha.getFullYear() === anio && d.fecha.getMonth() + 1 === mes).reduce((s, d) => s + d.f, 0);
    const prev = g.dias.filter((d) => d.fecha.getFullYear() === prevAnio && d.fecha.getMonth() + 1 === prevMes && d.fecha.getDate() <= dia).reduce((s, d) => s + d.f, 0);
    const vsPrev = prev > 0 ? ((cur - prev) / prev) * 100 : null;
    let estado, atraso = 0;
    if (cadencia == null) estado = 'ocasional';
    else {
      atraso = lleva - cadencia;
      if (lleva > Math.max(45, cadencia * 4)) estado = 'perdido';   // dejó de comprar hace más de 45 días: se llama, pero no es la urgencia de hoy
      else if (atraso > 2 && lleva > cadencia * 1.5) estado = 'atrasado';
      else if (lleva >= cadencia - 1) estado = 'leToca';
      else if (vsPrev != null && vsPrev < -50) estado = 'enfriado';
      else estado = 'alRitmo';
    }
    out.push({ cliente: g.cliente, key: g.key, nombre: nombre(g.cliente), cadencia, lleva, ultima: iso(ultima.fecha), ticket, compras: compras.length, cur, prev, vsPrev, estado, atraso });
  }
  const orden = { atrasado: 0, leToca: 1, enfriado: 2, perdido: 3, alRitmo: 4, ocasional: 5 };
  out.sort((a, b) => orden[a.estado] - orden[b.estado] || b.atraso - a.atraso || b.ticket - a.ticket);
  const conteo = out.reduce((m, c) => { m[c.estado] = (m[c.estado] || 0) + 1; return m; }, {});
  return { lista: out, conteo };
}

export const ESTADO_RITMO = {
  atrasado: { label: 'atrasado · llamar', tone: 'red' }, leToca: { label: 'le toca', tone: 'blue' }, enfriado: { label: 'se enfrió', tone: 'orange' },
  perdido: { label: 'dejó de comprar', tone: 'gray' }, alRitmo: { label: 'al ritmo', tone: 'green' }, ocasional: { label: 'ocasional', tone: 'gray' },
};
export const fraseEstado = (c) => {
  if (c.estado === 'atrasado') return `atrasado ${c.atraso} d`;
  if (c.estado === 'leToca') return c.lleva >= c.cadencia ? 'le toca hoy' : 'le toca mañana';
  if (c.estado === 'enfriado') return 'compra, pero menos';
  if (c.estado === 'perdido') return `sin comprar ${c.lleva} d`;
  if (c.estado === 'ocasional') return `${c.compras} compra${c.compras === 1 ? '' : 's'} en 6 meses`;
  return 'al ritmo';
};
export { fmtM };
