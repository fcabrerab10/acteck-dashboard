// «Por qué N pz» (2026-10-06): explicación en palabras del sugerido del motor del S&OP (forecast/calculo.js#calcularForecast).
// Nació en el Producto 360 · Abasto del celular y ahora también la lee el drill del SKU en la web. Pura.
import { isoLocal } from '../../../lib/format';
import { diasCobertura, fechaLarga } from '../../../movil/pestanas/sop/calculo';
import { int, N } from '../../../movil/util';

/** Texto «Por qué N pz» con los datos del motor. */
export function porQue(r, { hoy = new Date() } = {}) {
  if (!r) return '';
  const ritmo = Math.round(N(r.ritmo3m));
  const seg = N(r.mesesSeguridad);
  const objetivo = Math.round(N(r.objetivo3m));
  const inv = Math.round(N(r.inv)), tra = Math.round(N(r.traCant));
  const nec = Math.round(N(r.necesidadNeta));
  const sug = Math.round(N(r.sugerido));
  const partes = [`Venta real de ${int(ritmo)} pz/mes en los 3 meses cerrados${r.crecimientoPct > 0 ? ` (+${Math.round(r.crecimientoPct * 100)} % de tendencia)` : r.tendenciaNegativa ? ' (tendencia a la baja)' : ''} × 3 meses${seg ? ` + ${seg} de seguridad${r.esCritico ? ' por ser crítico' : ''}` : ''} = ${int(objetivo)} pz necesarias.`];
  partes.push(`Tenemos ${int(inv)}${tra ? ` + ${int(tra)} en camino = ${int(inv + tra)}` : ''}.`);
  if (nec > 0) partes.push(`Faltan ${int(nec)}${sug > 0 ? ` → ${int(sug)} pz ${r.esConsolidado ? '(consolidado, piezas exactas)' : r.piezasPorContenedor > 0 ? `(${r.contenedoresSugeridos} contenedor${r.contenedoresSugeridos === 1 ? '' : 'es'} de ${int(r.piezasPorContenedor)})` : ''}` : ', menos de medio contenedor: todavía no se sugiere'}.`);
  else partes.push('No falta nada a 3 meses.');
  if (r.ltDias > 0 && sug > 0) {
    const dias = diasCobertura(r);
    const margen = dias != null ? dias - Math.round(r.ltDias) : null;
    if (margen != null && margen <= 0) partes.push(`Con el lead time de ${Math.round(r.ltDias)} días la PO ya va tarde: llegaría después de que se agote.`);
    else if (margen != null) { const d = new Date(hoy); d.setDate(d.getDate() + margen); partes.push(`Con el lead time de ${Math.round(r.ltDias)} días, la PO debe salir antes del ${fechaLarga(isoLocal(d))}.`); }
  }
  return partes.join(' ');
}

