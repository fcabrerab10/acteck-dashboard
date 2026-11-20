// Rebate «en progreso» de un cliente: cómo va el período con su regla y cuánto generaría (puro: sin React ni red).
// Vive aquí (y no en src/movil) desde 2026-11-20: usa el MISMO núcleo que el cierre y el panel «Cálculo»
// (motor.js#rebatePorNiveles · modoRebate · basesDelQ). Pruebas: scripts/test-pagos-rebate.mjs y test-cliente-propio-movil.mjs.
// Particularidades de esta vista (se conservaron tal cual): el monto va en pesos enteros, el trimestral se calcula con el
// Q en curso contra la cuota del Q completo, y «por categoría» no da monto (no baja el sell in por categoría).
import { rebatePorNiveles, modoRebate, minimoDeRegla, basesDelQ, qDeMes } from './motor.js';

const N = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v));
const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/**
 * Cómo va el rebate con la regla del cliente: mensual (Dicotech), trimestral por niveles (PCEL) o por categoría (Digitalife).
 *   fact: [{ anio, mes, monto }] del cliente · cuotas: [{ anio, mes, cuota_min }] · regla: config de pagos_reglas/REGLAS_DEFAULT
 */
export function rebateProgreso({ fact = [], cuotas = [], regla, anio, mes } = {}) {
  if (!regla) return null;
  const si = (a, m) => fact.filter((r) => N(r.anio) === a && N(r.mes) === m).reduce((s, r) => s + N(r.monto), 0);
  const cu = (a, m) => cuotas.filter((r) => N(r.anio) === a && N(r.mes) === m).reduce((s, r) => s + N(r.cuota_min), 0);
  // Esta vista nunca devolvió null con regla: lo que no es mensual se trata como trimestral.
  const comoRegla = { ...regla, frecuencia: regla.frecuencia === 'mensual' ? 'mensual' : 'trimestral' };
  const modo = modoRebate(comoRegla, { trimestralSinModo: 'niveles' });
  const minimo = minimoDeRegla(comoRegla);
  if (modo === 'mensual') {
    const sellIn = si(anio, mes), cuota = cu(anio, mes);
    const r = rebatePorNiveles({ base: sellIn, cuota, tiers: regla.tiers, minimo, decimales: 0 });
    return { periodo: MESES_LARGO[mes - 1], alcance: r.alcance, pct: r.pct, monto: r.monto, base: sellIn, cuota, nivel: r.tier?.label || null, minimo: r.minimo, modo: 'mensual', nombre: regla.nombre_oficial || 'Rebate' };
  }
  const q = qDeMes(mes);
  const { sellInQ, cuotaQ } = basesDelQ({ anio, q, sellInDe: si, cuotaDe: cu });
  if (modo === 'por_categoria') {
    const pcts = regla.por_categoria || {};
    const lista = Object.entries(pcts).map(([c, p]) => `${c} ${(N(p) * 100).toFixed(0)} %`).join(' · ');
    return { periodo: `Q${q}`, alcance: cuotaQ > 0 ? sellInQ / cuotaQ : null, pct: null, monto: null, base: sellInQ, cuota: cuotaQ, nivel: lista, modo: 'por_categoria', nombre: 'Rebate por categoría' };
  }
  const r = rebatePorNiveles({ base: sellInQ, cuota: cuotaQ, tiers: regla.tiers, minimo, decimales: 0 });
  return { periodo: `Q${q}`, alcance: r.alcance, pct: r.pct, monto: r.monto, base: sellInQ, cuota: cuotaQ, nivel: r.tier?.label || null, minimo: r.minimo, modo: 'niveles', nombre: 'Rebate' };
}
