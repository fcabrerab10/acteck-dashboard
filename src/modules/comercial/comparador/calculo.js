// Comparador de periodos · motor puro (2026-11-18). Salió de ComparadorPeriodos.jsx para que la web y el celular
// (src/movil/pestanas/comparador/ComparadorM.jsx) compartan una sola regla. Sin React ni red.
//   periodosPreset() → periodos A/B(/C) anclados al último mes con datos · sumar() → totales de un periodo ·
//   moversDe() → SKUs que más suben y bajan entre A y B · serieComparada() → meses lado a lado por posición ·
//   textoResumen() → las 3 líneas de «Copiar resumen». Los % (MC, ticket) se recalculan, nunca se suman.

export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const PRESETS = [
  { k: 'ytd', l: 'YTD vs YTD ant.', corto: 'YTD' },
  { k: 'qvq', l: 'Trimestre vs trim. ant.', corto: 'Trim. vs anterior' },
  { k: 'qyoy', l: 'Trimestre vs mismo trim. año ant.', corto: 'Trim. vs año ant.' },
  { k: 'm3', l: 'Mes vs mismo mes (3 años)', corto: 'Mes · 3 años' },
  { k: 'libre', l: 'Libre', corto: 'Libre' },
];
export const N = (v) => Number(v) || 0;
export const deltaPct = (a, b) => (b ? ((a - b) / Math.abs(b)) * 100 : null);
export const labelPeriodo = (p) => (p.desde === p.hasta ? `${MESES[p.desde - 1]} ${p.anio}` : `${MESES[p.desde - 1]}–${MESES[p.hasta - 1]} ${p.anio}`);
export const enPeriodo = (r, p) => N(r.anio) === p.anio && N(r.mes) >= p.desde && N(r.mes) <= p.hasta;

/** Suma filas mensuales dentro de un periodo. Devuelve totales + serie por posición. */
export function sumar(fact, med, p) {
  const t = { monto: 0, piezas: 0, factNeta: 0, contribucion: 0, meses: [] };
  for (let m = p.desde; m <= p.hasta; m++) {
    const f = fact.find((r) => N(r.anio) === p.anio && N(r.mes) === m);
    t.meses.push({ mes: m, monto: N(f?.monto), piezas: N(f?.piezas) });
    t.monto += N(f?.monto); t.piezas += N(f?.piezas);
  }
  med.forEach((r) => { if (enPeriodo(r, p)) { t.factNeta += N(r.fact_neta); t.contribucion += N(r.contribucion); } });
  t.ticket = t.piezas ? t.monto / t.piezas : null;
  t.mc = t.factNeta ? (t.contribucion / t.factNeta) * 100 : null;
  t.hayMedidas = t.factNeta !== 0;
  return t;
}

/** Periodos según preset, anclados al último mes con datos (anio, mes). */
export function periodosPreset(preset, anio, mes, libre) {
  const q0 = Math.floor((mes - 1) / 3) * 3 + 1; // primer mes del trimestre
  const len = mes - q0 + 1;
  switch (preset) {
    case 'ytd': return [{ id: 'A', anio, desde: 1, hasta: mes }, { id: 'B', anio: anio - 1, desde: 1, hasta: mes }];
    case 'qvq': {
      const pq = q0 === 1 ? { anio: anio - 1, desde: 10 } : { anio, desde: q0 - 3 };
      return [{ id: 'A', anio, desde: q0, hasta: mes }, { id: 'B', anio: pq.anio, desde: pq.desde, hasta: pq.desde + len - 1 }];
    }
    case 'qyoy': return [{ id: 'A', anio, desde: q0, hasta: mes }, { id: 'B', anio: anio - 1, desde: q0, hasta: mes }];
    case 'm3': return [0, 1, 2].map((i) => ({ id: 'ABC'[i], anio: anio - i, desde: mes, hasta: mes }));
    default: return [{ id: 'A', ...libre.A }, { id: 'B', ...libre.B }];
  }
}

/** Último (anio, mes) con monto > 0; null si no hay. */
export function ultimoConDatos(fact) {
  let best = null;
  (fact || []).forEach((r) => { if (N(r.monto) > 0 && (!best || N(r.anio) > best.anio || (N(r.anio) === best.anio && N(r.mes) > best.mes))) best = { anio: N(r.anio), mes: N(r.mes) }; });
  return best;
}
export const aniosDe = (fact) => Array.from(new Set((fact || []).map((r) => N(r.anio)))).sort((a, b) => b - a);
/** Periodo libre inicial: YTD del último año con datos contra el anterior. */
export const libreInicial = (ultimo) => ({ A: { anio: ultimo.anio, desde: 1, hasta: ultimo.mes }, B: { anio: ultimo.anio - 1, desde: 1, hasta: ultimo.mes } });
/** Cambia un extremo del periodo libre sin dejar `hasta` antes de `desde`. */
export function ajustarLibre(libre, id, patch) {
  const p = { ...libre[id], ...patch };
  if (p.hasta < p.desde) p[patch.desde != null ? 'hasta' : 'desde'] = patch.desde ?? patch.hasta;
  return { ...libre, [id]: p };
}
/** ¿Alguno de los periodos termina en el mes en curso (parcial)? */
export const esMesParcial = (ultimo, periodos, hoy = new Date()) => !!ultimo && ultimo.anio === hoy.getFullYear() && ultimo.mes === hoy.getMonth() + 1 && periodos.some((p) => p.anio === ultimo.anio && p.hasta === ultimo.mes);

/** Cliente del ERP (v_analisis_cliente_mes): se agrega por (anio, mes) por si el nombre tiene dos códigos. */
export function agregarErp(data) {
  const by = new Map();
  (data || []).forEach((r) => { const k = `${r.anio}-${r.mes}`; const a = by.get(k) || { anio: N(r.anio), mes: N(r.mes), monto: 0, piezas: 0, fact_neta: 0, contribucion: 0 }; a.monto += N(r.fact_neta); a.fact_neta += N(r.fact_neta); a.piezas += N(r.piezas_venta_neta); a.contribucion += N(r.contribucion); by.set(k, a); });
  return Array.from(by.values());
}

/** Todo lo que pintan web y celular a partir de las filas mensuales. `libre` null = YTD del último año con datos. */
export function comparar({ fact, med, preset = 'ytd', libre = null, hoy = new Date() }) {
  const ultimo = ultimoConDatos(fact);
  const lib = libre || (ultimo ? libreInicial(ultimo) : null);
  const periodos = ultimo && lib ? periodosPreset(preset, ultimo.anio, ultimo.mes, lib) : [];
  const totales = periodos.map((p) => sumar(fact || [], med || [], p));
  return { ultimo, libre: lib, periodos, totales, anios: aniosDe(fact), mesParcial: esMesParcial(ultimo, periodos, hoy), sinDatos: !!fact && (!fact.length || !ultimo) };
}

/** SKUs que más mueven la diferencia A − B (por monto). rows: [{ sku, anio, mes, piezas, monto }]. */
export function moversDe(rows, periodos, top = 8) {
  if (!rows || !periodos || periodos.length < 2) return null;
  const pA = periodos[0], pB = periodos[1];
  const by = new Map();
  rows.forEach((r) => {
    const inA = enPeriodo(r, pA), inB = enPeriodo(r, pB);
    if (!inA && !inB) return;
    const s = by.get(r.sku) || { sku: r.sku, mA: 0, pA: 0, mB: 0, pB: 0 };
    if (inA) { s.mA += N(r.monto); s.pA += N(r.piezas); }
    if (inB) { s.mB += N(r.monto); s.pB += N(r.piezas); }
    by.set(r.sku, s);
  });
  const all = Array.from(by.values()).map((s) => ({ ...s, d: s.mA - s.mB })).filter((s) => s.d !== 0);
  all.sort((a, b) => b.d - a.d);
  return { up: all.filter((s) => s.d > 0).slice(0, top), down: all.filter((s) => s.d < 0).reverse().slice(0, top) };
}

/** Meses de cada periodo lado a lado por posición (1er mes de A con 1er mes de B…). */
export function serieComparada(totales, periodos) {
  const len = Math.max(0, ...totales.map((t) => t.meses.length));
  return Array.from({ length: len }, (_, i) => {
    const row = { pos: i };
    totales.forEach((t, k) => { const m = t.meses[i]; row[periodos[k].id] = m?.monto ?? null; row[`${periodos[k].id}_lbl`] = m ? `${MESES[m.mes - 1]} ${periodos[k].anio}` : ''; });
    row.label = row.A_lbl ? row.A_lbl.split(' ')[0] : '';
    return row;
  });
}

const pctTxt = (n, d = 1) => (n == null || isNaN(n) ? '—' : `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(d)}%`);
const entero = (n) => (n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('es-MX'));
const pesos = (n) => `$${entero(n)}`;

/** Las 3 líneas de «Copiar resumen» (sin contribución si `ocultarSensible`). `fmt` = formato de moneda (default $ entero). */
export function textoResumen({ nombre = 'Global', periodos, totales, ocultarSensible = false, fmt = pesos }) {
  const A = totales[0], B = totales[1];
  if (!A || !B) return '';
  const l1 = `Sell In ${nombre} · ${labelPeriodo(periodos[0])} vs ${labelPeriodo(periodos[1])}${periodos[2] ? ` vs ${labelPeriodo(periodos[2])}` : ''}`;
  const l2 = `Facturación ${fmt(A.monto)} vs ${fmt(B.monto)} (${pctTxt(deltaPct(A.monto, B.monto))}) · Piezas ${entero(A.piezas)} vs ${entero(B.piezas)} (${pctTxt(deltaPct(A.piezas, B.piezas))})`;
  const l3 = `Ticket promedio ${fmt(A.ticket || 0)} vs ${fmt(B.ticket || 0)}${!ocultarSensible && A.hayMedidas && B.hayMedidas ? ` · Contribución ${fmt(A.contribucion)} vs ${fmt(B.contribucion)} (MC ${A.mc?.toFixed(1)}% vs ${B.mc?.toFixed(1)}%)` : ''}`;
  return [l1, l2, l3].join('\n');
}
