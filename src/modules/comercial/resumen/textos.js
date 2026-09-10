// Resumen de Clientes · textos: narrativa del hero y de cada tarjeta + texto de WhatsApp.
// El texto compartible sale de textoAvance (src/lib/whatsapp.js): nunca lleva cartera, márgenes ni costos.
import { textoAvance } from '../../../lib/whatsapp';
import { moneyCompact, int } from '../../../lib/format';
import { labelPeriodo, MESES_CORTO } from './calculo';

export const fmtCompact = moneyCompact;
export const fmtInt = int;
export const fmtPct = (n, d = 0) => (Number.isFinite(n) ? `${n.toFixed(d)}%` : '—');

/** "58 % de la mínima · 51 % de la ideal" · "58 % de la cuota" · null sin cuota. */
export function textoCumplimiento(r) {
  if (r.dosCuotas) return `${fmtPct(r.cumplMin)} de la mínima · ${fmtPct(r.cumplIdeal)} de la ideal`;
  const c = r.cumplIdeal ?? r.cumplMin;
  return c == null ? null : `${fmtPct(c)} de la cuota`;
}

/** Frase del hero consolidado. */
export function narrativaHero(consolidado, resumenes, periodo) {
  if (consolidado.cumplIdeal == null) return `Sin cuota registrada para ${labelPeriodo(periodo)}.`;
  const brecha = consolidado.cuotaIdeal - consolidado.siMes;
  const orden = [...resumenes].sort((a, b) => (b.resumen.cumplIdeal || 0) - (a.resumen.cumplIdeal || 0));
  const lider = orden[0]?.cliente.nombre, rezaga = orden[orden.length - 1]?.cliente.nombre;
  const dobles = consolidado.algunaDoble && consolidado.cumplMin != null ? ` (${fmtPct(consolidado.cumplMin)} de la mínima)` : '';
  if (brecha > 0) return `${fmtPct(consolidado.cumplIdeal)} de la cuota ideal${dobles}. Faltan ${fmtCompact(brecha)}; ${lider} lidera y ${rezaga} se rezaga.`;
  return `${fmtPct(consolidado.cumplIdeal)} de la cuota ideal${dobles}. Meta superada por ${fmtCompact(-brecha)}; ${lider} lidera.`;
}

/** Párrafo narrativo de la tarjeta (partes para que la UI coloree). */
export function narrativaCliente(r) {
  if (r.siYTD === 0 && r.siMes === 0) return { sinDatos: true };
  return {
    sinDatos: false,
    sellIn: fmtCompact(r.siMes),
    cumplimiento: textoCumplimiento(r),
    yoy: r.siYoY,
    cobranza: r.saldoVencido > 0
      ? `Vencidos ${fmtCompact(r.saldoVencido)}${r.facturasAbiertas > 0 ? ` en ${fmtInt(r.facturasAbiertas)} facturas abiertas` : ''}.`
      : (r.corteFecha ? 'Cobranza al día.' : 'Sin estado de cuenta en el periodo.'),
  };
}

/** Texto de WhatsApp del avance (sin nada sensible). */
export function textoAvanceCliente(cliente, r) {
  return textoAvance({
    cliente: cliente.nombre, mes: r.periodo.mes, anio: r.periodo.anio,
    mtd: r.siMes, cuota: r.cuotaIdeal ?? r.cuotaMin ?? null, ytd: r.siYTD,
    top: r.topSkus,
  });
}

export const labelMesCorto = (p) => `${MESES_CORTO[p.mes - 1]} ${p.anio}`;
