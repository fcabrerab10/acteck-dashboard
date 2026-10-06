// «Dónde está el movimiento» · cálculo puro (2026-10-05, Análisis por cliente en el celular).
// Mayores subidas y bajadas en pesos de un mes contra el mes anterior, mezclando varias dimensiones (SKU, categoría,
// sucursal, cliente final…) y explicando cada una en una frase corta («150 pz · lo compra por primera vez»,
// «en sep $58K · en oct nada», «el doble que en sep»). Sin React ni Supabase.
//   Pruebas: node --test scripts/test-analisis-movimiento.mjs
//
// Entrada: grupos = [{ tipo, filas, clave, valor, piezas?, etiqueta?(k, fila) }]
//   filas  → cualquier grano con { anio, mes, [clave], [valor], [piezas] } (mv_analisis_cliente_sku_mes,
//            mv_sellout_cuenta_sku_mes, mv_sellout_sucursal_mes, mv_sellout_cliente_final_mes…). Se usa TODA la
//            historia que venga: sirve para saber si algo «es la primera vez».
//   categoriaDe → opcional, { clave: categoria } para no listar una categoría que ya explica un solo SKU listado.

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const N = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v));
const idx = (a, m) => N(a) * 12 + (N(m) - 1);
const money = (n) => {
  const v = Math.abs(N(n));
  if (v >= 1e6) return `$${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M`;
  if (v >= 1e3) return `$${Math.round(v / 1e3)}K`;
  return `$${Math.round(v)}`;
};
const pz = (n) => `${Math.round(N(n)).toLocaleString('es-MX')} pz`;

/** Frase corta que explica un movimiento. Exportada para probarla sola. */
export function explicar(f, mesLbl, mesPrevLbl) {
  const { act, prev, pzAct, pzPrev, primeraVez } = f;
  if (prev <= 0 && act > 0) {
    if (primeraVez) return `${pzAct > 0 ? `${pz(pzAct)} · ` : ''}por primera vez`;
    return `en ${mesPrevLbl} nada · en ${mesLbl} ${money(act)}${pzAct > 0 ? ` (${pz(pzAct)})` : ''}`;
  }
  if (act <= 0 && prev > 0) return `en ${mesPrevLbl} ${money(prev)} · en ${mesLbl} nada`;
  if (prev > 0 && act > 0) {
    const r = act / prev;
    if (r >= 2.8 && r < 3.3) return `el triple que en ${mesPrevLbl}`;
    if (r >= 1.8 && r < 2.3) return `el doble que en ${mesPrevLbl}`;
    if (r <= 0.55 && r >= 0.45) return `la mitad que en ${mesPrevLbl}`;
    if (pzAct > 0 || pzPrev > 0) return `de ${Math.round(pzPrev).toLocaleString('es-MX')} a ${Math.round(pzAct).toLocaleString('es-MX')} pz`;
    const d = ((act - prev) / prev) * 100;
    return `${d >= 0 ? '+' : ''}${Math.round(d)} % vs ${mesPrevLbl}`;
  }
  return '';
}

/**
 * @param {object} p
 * @param {Array}  p.grupos      ver cabecera
 * @param {number} p.anio · p.mes   mes a explicar (se compara con el anterior)
 * @param {number} [p.top=6]     filas en total (subidas + bajadas, las más grandes en valor absoluto)
 * @param {number} [p.umbral=1000]  movimientos menores se ignoran
 * @param {object} [p.categoriaDe]  { claveSku: categoria } para quitar categorías que ya explica un SKU listado
 * @returns {{ filas: Array, suben: Array, bajan: Array, mesLbl, mesPrevLbl }}
 */
export function movimientos({ grupos = [], anio, mes, top = 6, umbral = 1000, categoriaDe = null }) {
  const iAct = idx(anio, mes), iPrev = iAct - 1;
  const mesLbl = MESES[mes - 1].toLowerCase();
  const mesPrevLbl = MESES[(mes + 10) % 12].toLowerCase();
  const out = [];
  for (const g of grupos) {
    const m = new Map();
    for (const r of g.filas || []) {
      const k = r[g.clave]; if (k == null || k === '') continue;
      const i = idx(r.anio, r.mes);
      let f = m.get(k);
      if (!f) { f = { tipo: g.tipo, clave: k, act: 0, prev: 0, pzAct: 0, pzPrev: 0, antes: 0, fila: r }; m.set(k, f); }
      const v = N(r[g.valor]), p = g.piezas ? N(r[g.piezas]) : 0;
      if (i === iAct) { f.act += v; f.pzAct += p; } else if (i === iPrev) { f.prev += v; f.pzPrev += p; } else if (i < iPrev && v > 0) f.antes += v;
    }
    for (const f of m.values()) {
      const delta = f.act - f.prev;
      if (Math.abs(delta) < umbral) continue;
      const primeraVez = f.prev <= 0 && f.antes <= 0 && f.act > 0;
      const etiqueta = g.etiqueta ? g.etiqueta(f.clave, f.fila) : '';
      out.push({ tipo: f.tipo, clave: f.clave, etiqueta, act: f.act, prev: f.prev, delta, pzAct: f.pzAct, pzPrev: f.pzPrev, primeraVez, explicacion: explicar({ ...f, primeraVez }, mesLbl, mesPrevLbl) });
    }
  }
  // Una categoría cuyo movimiento ya explica un SKU listado (≥ 70 % del delta) sobra.
  let filas = out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  if (categoriaDe) {
    const skus = filas.filter((f) => f.tipo === 'SKU');
    filas = filas.filter((f) => {
      if (f.tipo !== 'Categoría') return true;
      return !skus.some((s) => categoriaDe[s.clave] === f.clave && Math.sign(s.delta) === Math.sign(f.delta) && Math.abs(s.delta) >= Math.abs(f.delta) * 0.7);
    });
  }
  const suben = filas.filter((f) => f.delta > 0), bajan = filas.filter((f) => f.delta < 0);
  // Reparto: mitad y mitad si hay de los dos lados; lo que sobre lo llena el otro lado.
  const nSub = Math.min(suben.length, Math.max(Math.ceil(top / 2), top - bajan.length));
  const nBaj = Math.min(bajan.length, top - nSub);
  const sel = [...suben.slice(0, nSub), ...bajan.slice(0, nBaj)].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return { filas: sel, suben: suben.slice(0, nSub), bajan: bajan.slice(0, nBaj), mesLbl, mesPrevLbl };
}

export default { movimientos, explicar };
