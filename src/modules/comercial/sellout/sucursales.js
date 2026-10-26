// Sell Out de una cuenta · «Sucursales que suben, bajan y dejaron de vender» (2026-10-26). Puro, sobre
// vs_sellout_sucursal_mes (anio, mes, sucursal, importe). Compara el mes de la pestaña contra el mes anterior, en pesos.
import { idxMes, N, MESES } from './calculo.js';

const mesLbl = (m) => MESES[m - 1].toLowerCase();
const fmtM = (n) => { const a = Math.abs(n); const s = a >= 1e6 ? `$${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `$${Math.round(a / 1e3)}K` : `$${Math.round(a)}`; return (n < 0 ? '−' : '') + s; };

/**
 * { suben, bajan, sinVenta, mesLbl, mesPrevLbl, total }.
 *   suben / bajan: Δ en pesos contra el mes anterior ≥ umbral, top N, frase «$2.1M en sep · $0.9M en ago».
 *   sinVenta: vendían el mes anterior y este mes nada, con «vendía $X/mes» = promedio de los 3 meses anteriores.
 */
export function movimientoSucursales(filas = [], { anio, mes, umbral = 50000, top = 5 } = {}) {
  const act = idxMes(anio, mes), prev = act - 1;
  const m = new Map();
  for (const r of filas) {
    const k = r.sucursal; if (!k) continue;
    const i = idxMes(N(r.anio), N(r.mes));
    if (i > act || i < act - 3) continue;
    const f = m.get(k) || { sucursal: k, act: 0, prev: 0, prom3: 0 };
    if (i === act) f.act += N(r.importe);
    else { if (i === prev) f.prev += N(r.importe); f.prom3 += N(r.importe) / 3; }
    m.set(k, f);
  }
  const lista = [...m.values()].map((f) => ({ ...f, delta: f.act - f.prev }));
  const pa = (mm) => (mm < 1 ? 12 : mm);
  const lblAct = mesLbl(mes), lblPrev = mesLbl(pa(mes - 1));
  const frase = (f) => `${fmtM(f.act)} en ${lblAct} · ${fmtM(f.prev)} en ${lblPrev}`;
  const suben = lista.filter((f) => f.act > 0 && f.delta >= umbral).sort((a, b) => b.delta - a.delta).slice(0, top).map((f) => ({ ...f, frase: frase(f) }));
  const bajan = lista.filter((f) => f.act > 0 && f.delta <= -umbral).sort((a, b) => a.delta - b.delta).slice(0, top).map((f) => ({ ...f, frase: frase(f) }));
  const sinVenta = lista.filter((f) => f.prev > 0 && f.act <= 0).sort((a, b) => b.prom3 - a.prom3)
    .map((f) => ({ ...f, frase: `vendía ${fmtM(f.prom3)}/mes · ${fmtM(f.prev)} en ${lblPrev}` }));
  return { suben, bajan, sinVenta, mesLbl: lblAct, mesPrevLbl: lblPrev, total: lista.filter((f) => f.act > 0 || f.prev > 0).length };
}
export { fmtM as fmtMovSuc };
