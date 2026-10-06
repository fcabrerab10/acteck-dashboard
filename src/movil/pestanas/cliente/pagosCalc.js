// Pagos del cliente propio en el celular · cálculo puro. Pruebas: scripts/test-cliente-propio-movil.mjs. 2026-10-06.
// Uso interno (Fernando y Karolina): rebates, apoyos, marketing, fondos. Las reglas y el flujo son los de pagosv3.
import { ETAPAS } from '../../../modules/comercial/pagosv3/estados';
import { nivelDe, qDeMes, mesesDeQ, periodoMes } from '../../../modules/comercial/pagosv3/motor';

const N = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v));
const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const compact = (n) => { const v = N(n); const a = Math.abs(v); if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`; if (a >= 1e3) return `$${Math.round(v / 1e3)}K`; return `$${Math.round(v)}`; };
export const fechaDe = (p) => String(p?.fecha_programada || p?.fecha_compromiso || p?.fecha_limite || '').slice(0, 10) || null;
export const abierto = (p) => !['pagado', 'cancelado', 'rechazado'].includes(p.estado) && (p.estado !== 'calculado' || N(p.monto) > 0);
export const ACCION = { calculado: 'Solicitar', solicitado: 'Autorizar', autorizado: 'Capturar folio', folio: 'Registrar pago', rechazado: 'Corregir' };
export const TONO = { calculado: 'blue', solicitado: 'purple', autorizado: 'orange', folio: 'green', pagado: 'green', rechazado: 'red', cancelado: 'gray' };

/** Resumen del mes: por pagar, vencidos, flujo por etapa y lista ordenada por fecha. */
export function resumenPagos({ pagos = [], anio, mes, hoy = new Date() } = {}) {
  const per = periodoMes(anio, mes);
  const hoyIso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  const esDelMes = (p) => (fechaDe(p) ? fechaDe(p).slice(0, 7) === per : p.periodo === per);
  const abiertos = pagos.filter(abierto);
  const delMes = pagos.filter((p) => p.estado !== 'cancelado' && esDelMes(p));
  const vencidos = abiertos.filter((p) => fechaDe(p) && fechaDe(p) < hoyIso);
  const porPagarMes = abiertos.filter((p) => esDelMes(p) || (fechaDe(p) && fechaDe(p) < hoyIso));
  const flujo = ETAPAS.map((e) => ({ id: e.id, label: e.label, n: pagos.filter((p) => p.estado === e.id && (e.id !== 'calculado' || N(p.monto) > 0) && (e.id !== 'pagado' || esDelMes(p))).length, monto: pagos.filter((p) => p.estado === e.id && (e.id !== 'pagado' || esDelMes(p))).reduce((s, p) => s + N(p.monto), 0) }));
  const lista = [...abiertos, ...pagos.filter((p) => p.estado === 'rechazado')].sort((a, b) => String(fechaDe(a) || '9999').localeCompare(String(fechaDe(b) || '9999')));
  const pagadosAnio = pagos.filter((p) => p.estado === 'pagado' && String(fechaDe(p) || p.periodo || '').startsWith(String(anio)));
  return {
    porPagar: porPagarMes.reduce((s, p) => s + N(p.monto), 0), nPorPagar: porPagarMes.length,
    vencidos: vencidos.length, montoVencido: vencidos.reduce((s, p) => s + N(p.monto), 0),
    abiertos: abiertos.length, montoAbierto: abiertos.reduce((s, p) => s + N(p.monto), 0),
    pagadoMes: delMes.filter((p) => p.estado === 'pagado').reduce((s, p) => s + N(p.monto), 0),
    pagadoAnio: pagadosAnio.reduce((s, p) => s + N(p.monto), 0), nPagadosAnio: pagadosAnio.length,
    flujo, lista, porTipo: agrupaTipo(porPagarMes),
  };
}
function agrupaTipo(pagos) { const m = new Map(); for (const p of pagos) { const t = tipoCorto(p); m.set(t, N(m.get(t)) + N(p.monto)); } return [...m].sort((a, b) => b[1] - a[1]); }
export const tipoCorto = (p) => ({ rebate: 'rebate', spiff: 'SPIFF', apoyo_producto: 'apoyos', proteccion_precio: 'protección de precio', marketing: 'marketing', fijo: 'fijos', dinamica: 'dinámica', fondo: 'fondo' }[p.tipo] || p.categoria || p.tipo || 'otros');

/**
 * Cómo va el rebate con la regla del cliente: mensual (Dicotech), trimestral por niveles (PCEL) o por categoría (Digitalife).
 *   fact: [{ anio, mes, monto }] del cliente · cuotas: [{ anio, mes, cuota_min }] · regla: config de pagos_reglas/REGLAS_DEFAULT
 */
export function rebateProgreso({ fact = [], cuotas = [], regla, anio, mes } = {}) {
  if (!regla) return null;
  const si = (a, m) => fact.filter((r) => N(r.anio) === a && N(r.mes) === m).reduce((s, r) => s + N(r.monto), 0);
  const cu = (a, m) => cuotas.filter((r) => N(r.anio) === a && N(r.mes) === m).reduce((s, r) => s + N(r.cuota_min), 0);
  if (regla.frecuencia === 'mensual') {
    const sellIn = si(anio, mes), cuota = cu(anio, mes);
    const alcance = cuota > 0 ? sellIn / cuota : 0;
    const tier = nivelDe(regla.tiers || [], alcance);
    const min = N(regla.alcance_minimo_pago) || 0.9;
    const pct = alcance >= min && tier ? N(tier.pct) : 0;
    return { periodo: MESES_LARGO[mes - 1], alcance, pct, monto: Math.round(sellIn * pct), base: sellIn, cuota, nivel: tier?.label || null, minimo: min, modo: 'mensual', nombre: regla.nombre_oficial || 'Rebate' };
  }
  const q = qDeMes(mes);
  const meses = mesesDeQ(q);
  const sellInQ = meses.reduce((s, m) => s + si(anio, m), 0);
  const cuotaQ = meses.reduce((s, m) => s + cu(anio, m), 0);
  if (regla.modo === 'por_categoria') {
    const pcts = regla.por_categoria || {};
    const lista = Object.entries(pcts).map(([c, p]) => `${c} ${(N(p) * 100).toFixed(0)} %`).join(' · ');
    return { periodo: `Q${q}`, alcance: cuotaQ > 0 ? sellInQ / cuotaQ : null, pct: null, monto: null, base: sellInQ, cuota: cuotaQ, nivel: lista, modo: 'por_categoria', nombre: 'Rebate por categoría' };
  }
  const alcance = cuotaQ > 0 ? sellInQ / cuotaQ : 0;
  const tier = nivelDe(regla.tiers || [], alcance);
  const min = N(regla.requiere_alcance_minimo) || 0.9;
  const pct = alcance >= min && tier ? N(tier.pct) : 0;
  return { periodo: `Q${q}`, alcance, pct, monto: Math.round(sellInQ * pct), base: sellInQ, cuota: cuotaQ, nivel: tier?.label || null, minimo: min, modo: 'niveles', nombre: 'Rebate' };
}

/** Pagado por mes del año (y del anterior) para la gráfica de línea. */
export function serieMensualPagos(pagos = [], anio) {
  const suma = (a, m) => pagos.filter((p) => p.estado === 'pagado' && String(fechaDe(p) || p.periodo || '').slice(0, 7) === periodoMes(a, m)).reduce((s, p) => s + N(p.monto), 0);
  return Array.from({ length: 12 }, (_, i) => ({ label: ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][i], v: suma(anio, i + 1), prev: suma(anio - 1, i + 1) }));
}

export function frasePagos({ nombre, mes, r, rebate, apoyos } = {}) {
  const m = MESES_LARGO[mes - 1];
  if (!r) return '';
  const partes = [];
  if (r.nPorPagar) partes.push(`Le debemos ${compact(r.porPagar)} en ${m}: ${r.porTipo.slice(0, 3).map(([t, v]) => `${compact(v)} de ${t}`).join(', ')}`);
  else partes.push(`Nada por pagarle en ${m}`);
  if (rebate && rebate.modo !== 'por_categoria' && rebate.alcance != null) partes.push(`el ${rebate.nombre.toLowerCase()} de ${rebate.periodo} va al ${Math.round(rebate.alcance * 100)} % ${rebate.pct ? `y generaría ${compact(rebate.monto)}` : `y no alcanza el mínimo del ${Math.round((rebate.minimo || 0.9) * 100)} %`}`);
  if (apoyos?.porRegistrar) partes.push(`${apoyos.porRegistrar} apoyo${apoyos.porRegistrar === 1 ? '' : 's'} por producto sin registrar`);
  let txt = `${partes.join('; ')}.`;
  if (r.vencidos) txt += ` ${r.vencidos} pago${r.vencidos === 1 ? '' : 's'} vencido${r.vencidos === 1 ? '' : 's'} (${compact(r.montoVencido)}).`;
  else txt += ' Nada vencido.';
  return txt;
}

/** Apoyos por costo convenio (v_apoyos_convenio) cruzados con los ya registrados (apoyosPorSku). */
export function resumenApoyos(convenio = [], registrados = new Map()) {
  const conApoyo = convenio.filter((r) => N(r.apoyo_pz) > 0 && N(r.stock) > 0);
  const porRegistrar = conApoyo.filter((r) => !registrados.has(r.sku));
  return { skus: conApoyo.length, enPiso: conApoyo.reduce((s, r) => s + N(r.apoyo_inventario), 0), porRegistrar: porRegistrar.length, montoPorRegistrar: porRegistrar.reduce((s, r) => s + N(r.apoyo_inventario), 0), lista: [...conApoyo].sort((a, b) => N(b.apoyo_inventario) - N(a.apoyo_inventario)).map((r) => ({ ...r, registrado: registrados.has(r.sku) })) };
}

export const pctIn = (v) => (v == null ? '' : String(Math.round(N(v) * 10000) / 100));
export const pctOut = (v) => Math.round(N(v) * 100) / 10000;
