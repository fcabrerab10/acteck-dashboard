// Propuestas en el celular · cálculo puro (lista, conversión, sugeridos). Pruebas: scripts/test-propuestas-movil.mjs. 2026-10-06.
import { calcularEfectividad } from '../../../modules/comercial/propuestas/efectividad';
import { sugeridoDe } from '../../../modules/comercial/propuestas/sugeridos';

const N = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v));
export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const compact = (n) => { const v = N(n); const a = Math.abs(v); if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`; if (a >= 1e3) return `$${Math.round(v / 1e3)}K`; return `$${Math.round(v)}`; };
const totalDe = (p) => (p.resumen?.total != null ? N(p.resumen.total) : (p.lineas || []).reduce((s, l) => s + N(l.piezas) * N(l.precio), 0));
const mesObj = (p) => { if (p.anio && p.mes) return { anio: N(p.anio), mes: N(p.mes) }; const d = new Date(N(p.tstamp) || Date.now()); return { anio: d.getFullYear(), mes: d.getMonth() + 1 }; };

/** Resumen de la lista: por estado del mes objetivo, conversión promedio (ventanas completas, últimos 3 meses), serie 12 m. */
export function resumenPropuestas({ propuestas = [], factMap = new Map(), anio, mes, hoy = new Date() } = {}) {
  const delMes = propuestas.filter((p) => { const m = mesObj(p); return m.anio === anio && m.mes === mes; });
  const porEstado = (e) => delMes.filter((p) => p.estado === e);
  const suma = (l) => l.reduce((s, p) => s + totalDe(p), 0);
  const efect = propuestas.map((p) => ({ p, ef: calcularEfectividad(p, factMap) })).filter((x) => x.ef);
  const cerradasInfo = new Map(efect.map((x) => [x.p.id, x.ef]));
  // Conversión promedio: propuestas con ventana completa enviadas en los últimos 3 meses (ponderada por monto propuesto).
  const lim = new Date(hoy.getFullYear(), hoy.getMonth() - 3, 1).getTime();
  const recientes = efect.filter((x) => x.ef.completa && Date.parse(x.p.enviadaAt || 0) >= lim && x.ef.montoProp > 0);
  const propTot = recientes.reduce((s, x) => s + x.ef.montoProp, 0);
  const conv = propTot > 0 ? (recientes.reduce((s, x) => s + (x.ef.pct / 100) * x.ef.montoProp, 0) / propTot) * 100 : null;
  // Serie 12 meses por mes objetivo: propuesto (enviadas + cerradas) y facturado en su ventana.
  const serie = Array.from({ length: 12 }, (_, i) => { const d = new Date(anio, mes - 1 - 11 + i, 1); const a = d.getFullYear(), m = d.getMonth() + 1; const ps = propuestas.filter((p) => { const o = mesObj(p); return o.anio === a && o.mes === m && ['enviada', 'cerrada'].includes(p.estado); }); return { label: `${MESES[m - 1]}${m === 1 ? ` ${String(a).slice(2)}` : ''}`, propuesto: Math.round(suma(ps)), facturado: Math.round(ps.reduce((s, p) => s + N(cerradasInfo.get(p.id)?.montoFact), 0)) || (ps.length ? 0 : null) }; });
  const ultima = propuestas.filter((p) => p.estado !== 'borrador' && p.enviadaAt).sort((a, b) => Date.parse(b.enviadaAt) - Date.parse(a.enviadaAt))[0] || null;
  return {
    delMes: { n: delMes.length, total: suma(delMes) },
    borradores: { n: porEstado('borrador').length, total: suma(porEstado('borrador')) },
    enviadas: { n: porEstado('enviada').length, total: suma(porEstado('enviada')) },
    cerradas: { n: porEstado('cerrada').length, total: suma(porEstado('cerrada')), skus: porEstado('cerrada').reduce((s, p) => s + N(cerradasInfo.get(p.id)?.skusConvertidos), 0), deSkus: porEstado('cerrada').reduce((s, p) => s + (p.lineas || []).length, 0) },
    conversion: conv, nConv: recientes.length, serie, ultima, efectividad: cerradasInfo,
  };
}

export function frasePropuestas(r, { mes, hoy = new Date() } = {}) {
  const m = MESES_LARGO[mes - 1];
  if (!r.delMes.n) return `Sin propuestas para ${m} todavía.${r.conversion != null ? ` Las últimas convirtieron el ${Math.round(r.conversion)} %.` : ''}`;
  const partes = [`${r.borradores.n} en borrador`, `${r.enviadas.n} enviada${r.enviadas.n === 1 ? '' : 's'} esperando OC`, `${r.cerradas.n} cerrada${r.cerradas.n === 1 ? '' : 's'}`].filter((x) => !x.startsWith('0 '));
  let txt = `Van ${r.delMes.n} propuesta${r.delMes.n === 1 ? '' : 's'} para ${m} por ${compact(r.delMes.total)}${partes.length ? `: ${partes.join(', ')}` : ''}.`;
  if (r.conversion != null) txt += ` Las últimas convirtieron el ${Math.round(r.conversion)} %.`;
  return txt;
}

export const diasDesde = (iso, hoy = new Date()) => (iso ? Math.max(0, Math.round((hoy - new Date(iso)) / 86400000)) : null);

/** Sugeridos para el armador: SKUs que el cliente vende (3 meses cerrados) y tiene agotados o < 30 días en piso, topados a nuestro stock. */
export function sugeridosArmador({ sellout3m = new Map(), stockCliente = new Map(), nuestro = new Map(), descripciones = new Map(), enLineas = new Set(), top = 10 } = {}) {
  const out = [];
  sellout3m.forEach((pz3, sku) => {
    if (enLineas.has(sku)) return;
    const s = sugeridoDe({ sku, sellout90: pz3, invCliente: N(stockCliente.get(sku)), dispActeck: N(nuestro.get(sku)) });
    if (!s) return;
    out.push({ sku, descripcion: descripciones.get(sku) || '', ...s });
  });
  out.sort((a, b) => (a.sinStock ? 1 : 0) - (b.sinStock ? 1 : 0) || b.ritmo - a.ritmo);
  return { lista: out.slice(0, top), total: out.length, aceptables: out.filter((x) => !x.sinStock).length };
}
export const lineaSugerido = (s, nombre) => [`vende ${s.ritmo} pz/mes`, s.stock > 0 ? `${s.stock} en su piso (${s.dias} d)` : `0 en ${nombre}`, s.sinStock ? 'sin stock Acteck' : `tenemos ${Math.round(s.disp).toLocaleString('es-MX')}`].join(' · ');
