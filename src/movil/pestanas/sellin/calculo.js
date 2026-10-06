// Sell In de la empresa en el celular (3.80.0 · 2026-10-05) · cálculo puro, sin React ni red.
// Mismas reglas que Inicio (modules/general/inicio/calc.js): medidas del director agregadas con agg() (los % se
// recalculan, nunca se suman), cuota = cuotas_canales TOTAL/12 o Σ cuotas_mensuales, el mes en curso se prorratea
// al mismo día contra el año anterior. Pruebas en scripts/test-sellout-sellin-movil-ssr.mjs.
import { agg } from '../../../modules/general/inicio/calc.js';
import { canalLabel } from '../../../modules/general/inicio/config.js';
import { filasSkuAnual, columnasVentana } from '../sellout/skuAnual.js';

const N = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v));
const sum = (arr, f = (x) => x) => arr.reduce((s, x) => s + N(f(x)), 0);
const pctDe = (a, b) => (b > 0 ? (a / b) * 100 : null);
const delta = (a, b) => (b ? ((a - b) / Math.abs(b)) * 100 : null);
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const money = (n) => {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const v = Number(n), a = Math.abs(v), s = v < 0 ? '-' : '';
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(a >= 1e8 ? 0 : 1)} M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(0)} K`;
  return `${s}$${Math.round(a)}`;
};

/** Cuota del año: cuotas_canales TOTAL (anual / 12) y, si no hay, Σ v_cuota_global_mensual.cuota_ideal por mes. */
export function cuotasEmpresa(cuotaCanales = [], cuotaMensual = [], anio) {
  const total = cuotaCanales.find((c) => String(c.dimension_tipo || '').toUpperCase() === 'TOTAL' && N(c.anio || anio) === anio);
  const mes = (m) => (total ? N(total.meta_facturacion) / 12 : sum(cuotaMensual.filter((c) => N(c.anio) === anio && N(c.mes) === m), (c) => c.cuota_ideal));
  const ytd = (hasta) => sum(Array.from({ length: hasta }, (_, i) => i + 1), mes);
  return { mes, ytd, anual: total ? N(total.meta_facturacion) : ytd(12), fuente: total ? 'cuotas_canales' : (cuotaMensual.length ? 'cuotas_mensuales' : null) };
}

/** Frase del hero: «Septiembre cerró al 73 % de cuota con margen del 19.1 %, 23 % abajo de sep 2025.» */
export function fraseSellIn({ anio, mes, modo, enCurso, pctCuota, mc, yoy, sensible, factNeta }) {
  const sujeto = modo === 'mes' ? MESES_LARGO[mes - 1].replace(/^./, (c) => c.toUpperCase()) : `${anio} a ${MESES_LARGO[mes - 1]}`;
  const verbo = enCurso ? 'va' : (modo === 'mes' ? 'cerró' : 'va');
  const cuota = pctCuota != null ? `al ${Math.round(pctCuota)} % de cuota` : `en ${money(factNeta)} sin cuota cargada`;
  const margen = sensible && mc != null ? ` con margen del ${mc.toFixed(1)} %` : '';
  const ref = modo === 'mes' ? `${MESES[mes - 1].toLowerCase()} ${anio - 1}` : String(anio - 1);
  const comp = yoy == null ? '' : `, ${Math.abs(yoy).toFixed(0)} % ${yoy >= 0 ? 'arriba' : 'abajo'} de ${ref}${enCurso ? ' a mismo día' : ''}`;
  return `${sujeto} ${verbo} ${cuota}${margen}${comp}.`;
}

/**
 * @param {object} d  lo de useSellInEmpresa + roadmap
 * @param {object} p  { anio, mes, modo: 'mes'|'ytd', hoy, sensible }
 */
export function resumenSellIn(d, { anio, mes, modo = 'mes', hoy = new Date(), sensible = true }) {
  const medidas = d.medidas || [];
  const enCurso = anio === hoy.getFullYear() && mes === hoy.getMonth() + 1;
  const mesesPeriodo = modo === 'mes' ? [mes] : Array.from({ length: mes }, (_, i) => i + 1);
  const mesesOtro = modo === 'mes' ? Array.from({ length: mes }, (_, i) => i + 1) : [mes];
  const en = (a, meses) => (r) => N(r.anio) === a && meses.includes(N(r.mes));
  const q = cuotasEmpresa(d.cuotaCanales, d.cuotaMensual, anio);

  // Mes en curso: el año anterior se prorratea al mismo día (MTD vs MTD).
  const diasMes = new Date(anio, mes, 0).getDate();
  const factorMes = enCurso ? Math.min(1, Math.max(1, hoy.getDate()) / diasMes) : 1;
  const proMes = (v) => v * factorMes;
  const pro = modo === 'mes' ? proMes : (v) => v, proOtro = modo === 'mes' ? (v) => v : proMes;

  const cur = agg(medidas.filter(en(anio, mesesPeriodo))), prev = agg(medidas.filter(en(anio - 1, mesesPeriodo)));
  const otro = agg(medidas.filter(en(anio, mesesOtro))), otroPrev = agg(medidas.filter(en(anio - 1, mesesOtro)));
  const cuotaPeriodo = modo === 'mes' ? q.mes(mes) : q.ytd(mes), cuotaOtro = modo === 'mes' ? q.ytd(mes) : q.mes(mes);
  const pctCuota = pctDe(cur.fact_neta, cuotaPeriodo), pctOtro = pctDe(otro.fact_neta, cuotaOtro);
  const yoy = delta(cur.fact_neta, pro(prev.fact_neta)), yoyOtro = delta(otro.fact_neta, proOtro(otroPrev.fact_neta));
  const dMc = cur.mc != null && prev.mc != null ? cur.mc - prev.mc : null;
  const yoyPiezas = delta(cur.piezas, pro(prev.piezas));

  // Clientes con compra en el período · activos en el año · nuevos (primera compra dentro del período, nada antes).
  const cl = d.clientesMes || [];
  const conCompra = new Set(cl.filter((r) => en(anio, mesesPeriodo)(r) && N(r.fact_neta) > 0).map((r) => r.cliente));
  // Activos = clientes de verdad (≥ $50K en el año); si no, el ERP mete 1,700 clientes de mostrador de una compra (2026-10-05).
  const ytdPorCliente = new Map();
  cl.forEach((r) => { if (N(r.anio) === anio) ytdPorCliente.set(r.cliente, N(ytdPorCliente.get(r.cliente)) + N(r.fact_neta)); });
  const activosAnio = new Set([...ytdPorCliente].filter(([, v]) => v >= 50000).map(([c]) => c));
  const antes = new Set(cl.filter((r) => N(r.fact_neta) > 0 && (N(r.anio) === anio - 1 || (N(r.anio) === anio && N(r.mes) < mesesPeriodo[0]))).map((r) => r.cliente));
  const nuevos = [...conCompra].filter((c) => !antes.has(c)).length;

  // Serie: 12 meses naturales con cuota punteada (null = mes sin datos todavía).
  const ultimoCon = medidas.reduce((u, r) => (N(r.anio) === anio && N(r.fact_neta) ? Math.max(u, N(r.mes)) : u), 0);
  const serie = MESES.map((label, i) => {
    const m = i + 1;
    const a = agg(medidas.filter(en(anio, [m]))), p = agg(medidas.filter(en(anio - 1, [m])));
    const cuota = q.mes(m) || null;
    const fn = m <= ultimoCon ? a.fact_neta : null;
    const esCurso = enCurso && m === mes;
    return { label, mes: m, fn, prev: p.fact_neta || null, cuota, pct: fn != null ? pctDe(fn, cuota) : null, yoy: fn != null && p.fact_neta ? delta(fn, esCurso ? proMes(p.fact_neta) : p.fact_neta) : null, enCurso: esCurso };
  });

  // Mixes del período (v_vision_factura_dimension_mes).
  const dim = d.dimMes || [];
  const mix = (nombre, etiqueta = (k) => k) => {
    const m = new Map();
    dim.filter((r) => r.dimension === nombre && en(anio, mesesPeriodo)(r)).forEach((r) => { const k = r.valor || 'Otros'; m.set(k, (m.get(k) || 0) + N(r.venta)); });
    return [...m.entries()].filter(([, v]) => v > 0).map(([k, v]) => ({ key: k, label: etiqueta(k), v })).sort((a, b) => b.v - a.v);
  };
  const mixes = { canal: mix('canal', canalLabel), marca: mix('marca'), categoria: mix('categoria') };

  // Tabla por SKU × 12 meses (ventana que termina en el mes elegido).
  const tabla = filasSkuAnual({ rows: d.skuAnio || [], anio, mes, roadmap: d.roadmap || [] });
  const columnas = columnasVentana(anio, mes);

  const periodoLbl = modo === 'mes' ? `${MESES[mes - 1]} ${anio}` : `${anio} a ${MESES[mes - 1].toLowerCase()}`;
  const frase = fraseSellIn({ anio, mes, modo, enCurso, pctCuota, mc: cur.mc, yoy, sensible, factNeta: cur.fact_neta });

  return {
    anio, mes, modo, enCurso, periodoLbl, frase,
    cur, prev, otro, cuotaPeriodo, cuotaOtro, pctCuota, pctOtro, yoy, yoyOtro, dMc, yoyPiezas, cuota: q,
    clientes: { conCompra: conCompra.size, activosAnio: activosAnio.size, nuevos },
    serie, mixes, tabla, columnas,
  };
}
