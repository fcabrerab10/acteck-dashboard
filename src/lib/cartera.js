// Cartera · antigüedad (aging) y DSO. ÚNICA implementación (2026-11-20): la usan Cobranza general (web y celular),
// Crédito y Cobranza del cliente (web y celular), el Home del cliente, Inicio y el Resumen de clientes.
// Puro: sin React ni red. Pruebas: scripts/test-cartera.mjs.
//
// Reglas comunes a todas las pantallas:
//   · días de atraso = días completos entre el vencimiento y la fecha de referencia, nunca negativos; sin vencimiento = 0.
//   · tramos del vencido: 1–30 · 31–60 · 61–90 · +90 (una factura con 0 días de atraso no cae en ningún tramo).
//   · DSO real = edad de cada factura (referencia − emisión) ponderada por su saldo.
// Lo que cada pantalla decide y pasa como parámetro (diferencias que existían entre las copias y se conservaron):
//   · la fecha de referencia (hoy · fecha del corte),
//   · los ids y etiquetas de sus tramos (`tramos`; Cobranza del cliente rotula «0–30», la general «1–30»),
//   · en el DSO: cómo se leen las fechas y qué pasa con una factura emitida después de la referencia.
const N = (v) => Number(v) || 0;
export const DIA_MS = 86400000;

/** Medianoche LOCAL de una fecha 'YYYY-MM-DD' (o ISO con hora). null si no viene. */
export const msDia = (iso) => (iso ? new Date(String(iso).slice(0, 10) + 'T00:00:00').getTime() : null);
/** Lectura «tal cual» (`new Date(iso)`: una fecha sin hora se toma en UTC). Sólo la usa el Resumen de clientes. */
export const msUtc = (iso) => (iso ? new Date(iso).getTime() : null);

/** Límites y tono de los tramos del vencido. Los ids/etiquetas canónicos son los de Cobranza general. */
export const TRAMOS = [
  { id: 'd0_30', label: '1–30 días', min: 1, max: 30, tone: 'yellow' },
  { id: 'd31_60', label: '31–60 días', min: 31, max: 60, tone: 'orange' },
  { id: 'd61_90', label: '61–90 días', min: 61, max: 90, tone: 'red' },
  { id: 'mas90', label: '+90 días', min: 91, max: Infinity, tone: 'red' },
];
/** Mismos límites y tonos con otros ids/etiquetas (cada pantalla conserva los suyos). Arrays en el orden de TRAMOS. */
export function tramosCon({ ids, labels, extra } = {}) {
  return TRAMOS.map((t, i) => ({ ...t, id: ids?.[i] ?? t.id, label: labels?.[i] ?? t.label, ...(extra?.[i] || {}) }));
}

/** Id del tramo para N días de atraso; null si no está vencida. Lo que pase del último tramo cae en el último. */
export function tramoDe(dias, tramos = TRAMOS) {
  if (!(dias > 0)) return null;
  return (tramos.find((t) => dias >= t.min && dias <= t.max) || tramos[tramos.length - 1]).id;
}

/** Días de atraso de una factura a la fecha de referencia (ms). */
export function diasAtraso(f, refMs) {
  const v = msDia(f?.vencimiento);
  return v == null ? 0 : Math.max(0, Math.floor((refMs - v) / DIA_MS));
}
/** Días que faltan para que venza (negativo si ya venció); null sin vencimiento. */
export function diasParaVencer(f, refMs) {
  const v = msDia(f?.vencimiento);
  return v == null ? null : Math.floor((v - refMs) / DIA_MS);
}

/**
 * DSO real: edad ponderada por saldo. `rows` = facturas con `fecha_emision` y `saldo_actual`.
 *   opts.leer       cómo pasar la fecha a ms (default medianoche local).
 *   opts.redondeo   'floor' (default) | 'round' para los días de cada factura.
 *   opts.futuras    'omitir' (default: una factura emitida después de la referencia no cuenta) | 'cero' (cuenta con 0 días).
 * Las facturas sin saldo positivo nunca cuentan. Devuelve días enteros o null si no hay con qué.
 */
export function dsoDe(rows, refMs, { leer = msDia, redondeo = 'floor', futuras = 'omitir' } = {}) {
  let num = 0, den = 0;
  const red = redondeo === 'round' ? Math.round : Math.floor;
  for (const f of rows || []) {
    const e = leer(f.fecha_emision); if (e == null || Number.isNaN(e)) continue;
    const s = N(f.saldo_actual); if (s <= 0) continue;
    let d = red((refMs - e) / DIA_MS);
    if (d < 0) { if (futuras === 'cero') d = 0; else continue; }
    num += s * d; den += s;
  }
  return den > 0 ? Math.round(num / den) : null;
}

/** DSO de varias carteras: promedio ponderado por saldo de las que traen DSO. `filas` = [{ dso, saldo }]. */
export function dsoPonderado(filas, { soloConSaldo = false } = {}) {
  let num = 0, den = 0;
  for (const f of filas || []) { if (f.dso == null) continue; if (soloConSaldo && !(N(f.saldo) > 0)) continue; num += f.dso * N(f.saldo); den += N(f.saldo); }
  return den > 0 ? Math.round(num / den) : null;
}

/**
 * Aging de un conjunto de facturas (`vencimiento`, `saldo_actual`). Las que no tienen saldo positivo no cuentan.
 * Devuelve { aging: { [idTramo]: { monto, n, maxDias } }, porTramo: { [id]: [{ ...factura, dias, saldo }] }, total, vencido, alDia }.
 */
export function agingDe(facturas, refMs, { tramos = TRAMOS } = {}) {
  const aging = Object.fromEntries(tramos.map((t) => [t.id, { monto: 0, n: 0, maxDias: 0 }]));
  const porTramo = Object.fromEntries(tramos.map((t) => [t.id, []]));
  let total = 0, vencido = 0, alDia = 0;
  for (const f of facturas || []) {
    const saldo = N(f.saldo_actual); if (saldo <= 0) continue;
    total += saldo;
    const dias = diasAtraso(f, refMs);
    const id = tramoDe(dias, tramos);
    if (!id) { alDia += saldo; continue; }
    vencido += saldo;
    aging[id].monto += saldo; aging[id].n += 1; aging[id].maxDias = Math.max(aging[id].maxDias, dias);
    porTramo[id].push({ ...f, dias, saldo });
  }
  return { aging, porTramo, total, vencido, alDia };
}
