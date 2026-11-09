// Estado de Resultados V3 · textos (frase del Hero, alertas, nota del puente). Puro, con pruebas en Node.
import { MESES_FULL, MESES_LBL } from './calculo.js';
import { moneyCompact, pct } from '../../../lib/format.js';

const signo = (n, d = 0) => (n == null || !Number.isFinite(n) ? null : `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(d)} %`);
const signoPp = (n) => (n == null || !Number.isFinite(n) ? null : `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(1)} pp`);

/** Frase narrativa del Hero. m = medidas(idx, idxPrev, mes, 'mes'); anio = año en pantalla. */
export function fraseHero(m, anio) {
  if (!m || m.ventaNeta == null) return `Sin cierre cargado para ${anio}.`;
  const mes = MESES_FULL[m.mes - 1];
  const dv = signo(m.delta.ventaNeta);
  const partes = [`${mes} ${anio} cerró con ${moneyCompact(m.ventaNeta)} de venta neta${dv ? ` (${dv} vs ${anio - 1})` : ''}`];
  if (m.pct.bruta != null) {
    const dp = signoPp(m.delta.brutaPp);
    partes.push(`margen bruto ${pct(m.pct.bruta)}${dp ? ` (${dp})` : ''}`);
  }
  if (m.uafir != null) {
    const du = signo(m.delta.uafir);
    partes.push(`UAII ${moneyCompact(m.uafir)}${du ? ` (${du})` : ''}`);
  }
  if (m.uaii != null) {
    const di = signo(m.delta.uaii);
    partes.push(`UAI ${moneyCompact(m.uaii)}${di ? ` (${di})` : ''}`);
  }
  return partes.length > 1 ? `${partes[0]}, ${partes.slice(1, -1).join(', ')}${partes.length > 2 ? ' y ' : ''}${partes.length > 2 ? partes[partes.length - 1] : partes[1]}.` : `${partes[0]}.`;
}

/** Sub del Hero: acumulado del año hasta el último mes. y = medidas(..., mesMax, 'ytd'). */
export function subHero(y, anio, mesMax) {
  if (!y || y.ventaNeta == null) return 'REVKO Technology · MXN · cifras del P&L contable.';
  const dv = signo(y.delta.ventaNeta);
  const du = signo(y.delta.uaii);
  return `Acumulado ene–${MESES_LBL[mesMax - 1].toLowerCase()} ${anio}: venta ${moneyCompact(y.ventaNeta)}${dv ? ` (${dv})` : ''}, UAI ${moneyCompact(y.uaii)}${du ? ` (${du})` : ''}. REVKO Technology · MXN.`;
}

/** Mensaje corto de una alerta (mom / yoy). */
export function mensajeAlerta(a, anio) {
  const mes = MESES_FULL[a.mes - 1];
  if (a.type === 'mom') {
    const ant = MESES_FULL[a.mes - 2] || 'mes anterior';
    return `${a.cuenta} ${a.delta > 0 ? 'subió' : 'bajó'} ${Math.abs(a.delta).toFixed(1)} % en ${mes} vs ${ant}`;
  }
  return `${a.cuenta} ${mes} ${anio}: ${a.delta > 0 ? '+' : '−'}${Math.abs(a.delta).toFixed(1)} % vs ${anio - 1}`;
}

/** Nota explicativa del puente ERP vs P&L (una frase por causa habitual). */
export const NOTA_PUENTE = [
  'La cuenta VENTA NETA del P&L (ventas a tasa general + tasa 0 % − devoluciones, descuentos y bonificaciones) ya descuenta bonificaciones: su par en el ERP es Venta Neta; la Fact. Neta del ERP (bruta − devoluciones − RMA) queda arriba justo por las bonificaciones.',
  'Las diferencias restantes suelen venir de fechas de facturación (facturas y notas de crédito que contabilidad registra en otro mes), notas de crédito y ajustes contables, otros ingresos que el ERP no factura y ajustes de estrategia del cierre.',
  'Contribución del ERP vs Utilidad bruta del P&L: el P&L resta además costo de empaque, costo e-commerce, devoluciones sobre compra y destrucción fiscal, por eso queda por debajo.',
].join(' ');

export function textoAlertaPuente(p, anio) {
  if (!p?.mesesAlerta?.length) return null;
  const meses = p.mesesAlerta.map((m) => MESES_LBL[m - 1]).join(', ');
  return `Diferencia > 2 % ERP vs P&L en ${meses} ${anio}`;
}
