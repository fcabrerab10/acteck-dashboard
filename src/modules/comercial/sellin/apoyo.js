// Apoyo comercial (bonificaciones) por concepto · cálculo puro, sin React ni theme.
// Lo comparten la web (SellInCliente, SellInClienteV2/Dicotech/Pcel, Análisis por Cliente)
// y el celular (movil/pestanas/sellin), así que aquí no puede entrar nada de layout.
//
// Fuente: v_bonificaciones_concepto_mes (erp_ventas con rama = 'SERVICIOS'). El ERP los
// guarda en NEGATIVO y la suma cuadra al peso con la medida [Bonificaciones] del director
// (2026: −$34,445,391). Aquí se devuelven en POSITIVO: en pantalla se lee "apoyo", no
// "venta negativa". Los % nunca se suman: se recalculan sobre los totales ya sumados.
import { N, pctDelta } from './textos';

const abs = (v) => Math.abs(N(v));

/** Clave/etiqueta de cada nivel según cómo se quiera ver la tabla. */
function ejes(por, hijo) {
  const concepto = {
    k: (r) => r.concepto_codigo || '—',
    label: (r) => r.concepto || r.concepto_codigo || '—',
    sub: (r) => r.concepto_codigo || '',
  };
  const cliente = {
    k: (r) => r.cliente || r.cliente_nombre || '—', // el código, no el nombre: INGRAM son dos clientes
    label: (r) => r.cliente_nombre || r.cliente || '—',
    sub: (r) => [r.cliente, r.canal].filter(Boolean).join(' · '),
  };
  const mes = { k: (r) => String(N(r.mes)), label: (r) => String(N(r.mes)), sub: () => '' };
  const por2 = por === 'cliente' ? cliente : concepto;
  const hijo2 = hijo === 'mes' ? mes : hijo === 'concepto' ? concepto : cliente;
  return { por: por2, hijo: hijo2 };
}

/**
 * Agrupa los renglones de v_bonificaciones_concepto_mes.
 * @param {Array} filas  renglones de los dos años (el actual y el anterior)
 * @param {object} opts  { anio, anioPrev, mes, por:'concepto'|'cliente', hijo:'cliente'|'concepto'|'mes' }
 * @returns {Array} [{ key, label, sub, mes, ytd, ytdPrev, delta, meses:[12], hijos:[{key,label,mes,ytd}] }]
 */
export function agruparApoyo(filas = [], opts = {}) {
  const { anio, anioPrev = anio - 1, mes = 12, por = 'concepto', hijo = 'cliente' } = opts;
  const ej = ejes(por, hijo);
  const map = new Map();
  for (const r of filas) {
    const y = N(r.anio), m = N(r.mes);
    if (m < 1 || m > 12) continue;
    if (y !== anio && y !== anioPrev) continue;
    const k = ej.por.k(r);
    let o = map.get(k);
    if (!o) { o = { key: k, label: ej.por.label(r), sub: ej.por.sub(r), mes: 0, ytd: 0, ytdPrev: 0, renglones: 0, meses: Array(12).fill(0), hijos: new Map() }; map.set(k, o); }
    const v = abs(r.monto);
    if (y === anio) {
      o.meses[m - 1] += v;
      o.renglones += N(r.renglones);
      if (m === mes) o.mes += v;
      if (m > mes) continue;
      o.ytd += v;
      const hk = ej.hijo.k(r) || '—';
      let h = o.hijos.get(hk);
      if (!h) { h = { key: hk, label: ej.hijo.label(r) || hk, sub: ej.hijo.sub(r), mes: 0, ytd: 0 }; o.hijos.set(hk, h); }
      if (m === mes) h.mes += v;
      h.ytd += v;
    } else if (m <= mes) o.ytdPrev += v;
  }
  return [...map.values()]
    .filter((o) => o.mes || o.ytd || o.ytdPrev)
    .map((o) => ({ ...o, delta: pctDelta(o.ytd, o.ytdPrev), hijos: [...o.hijos.values()].sort((a, b) => b.ytd - a.ytd) }))
    .sort((a, b) => b.ytd - a.ytd);
}

/** Totales del apoyo (mismo criterio que agruparApoyo, sin agrupar). */
export function totalesApoyo(filas = [], opts = {}) {
  const { anio, anioPrev = anio - 1, mes = 12 } = opts;
  const t = { mes: 0, ytd: 0, ytdPrev: 0, meses: Array(12).fill(0), conceptos: new Set() };
  for (const r of filas) {
    const y = N(r.anio), m = N(r.mes);
    if (m < 1 || m > 12) continue;
    const v = abs(r.monto);
    if (y === anio) {
      t.meses[m - 1] += v;
      if (m === mes) t.mes += v;
      if (m <= mes) { t.ytd += v; t.conceptos.add(r.concepto_codigo || '—'); }
    } else if (y === anioPrev && m <= mes) t.ytdPrev += v;
  }
  return { ...t, conceptos: t.conceptos.size, delta: pctDelta(t.ytd, t.ytdPrev) };
}

/**
 * Fact. bruta del periodo a partir de filas { anio, mes, fact_bruta }.
 * Es el denominador del "% de la fact. bruta" (mismo criterio que [% Lost Profit Bonif],
 * salvo que el director usa Fact Neta; aquí Fernando pidió bruta).
 */
export function factBruta(filas = [], { anio, mes = 12 } = {}) {
  let mesV = 0, ytd = 0;
  for (const r of filas) {
    if (N(r.anio) !== anio) continue;
    const m = N(r.mes), v = N(r.fact_bruta);
    if (m < 1 || m > 12) continue;
    if (m === mes) mesV += v;
    if (m <= mes) ytd += v;
  }
  return { mes: mesV, ytd };
}

/** Fact. bruta YTD por código de cliente (para el "% de su fact. bruta" por cliente). */
export function factBrutaPorCliente(filas = [], { anio, mes = 12 } = {}) {
  const m = new Map();
  for (const r of filas) {
    if (N(r.anio) !== anio || N(r.mes) > mes || N(r.mes) < 1) continue;
    const k = r.cliente || r.cliente_nombre || '—';
    m.set(k, (m.get(k) || 0) + N(r.fact_bruta));
  }
  return m;
}

/** % que representa el apoyo sobre la fact. bruta. Denominador 0 → null (pinta '—'). */
export const pctSobre = (apoyo, base) => (base ? (apoyo / base) * 100 : null);
