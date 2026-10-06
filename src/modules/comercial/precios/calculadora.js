// Calculadora de precio y margen (celular · Estrategia de Precios, 2026-10-05). Pura, sin React ni red.
//
//   calcular({ precioLista, costo, descuentoPct | precio, piezas, margenMinimo, precioFacturado, facturadoFecha, clienteLabel })
//     → { precioNeto, descuentoPct, margenPct, utilidad, monto, piezas, tono, avisos: [{ tipo, texto }] }
//
// Las dos formas de capturar son consistentes: si viene `precio` manda el precio y el descuento se deduce
// (1 − precio / lista); si no, manda `descuentoPct` y el precio se deduce (lista × (1 − d)). Todo a 2 decimales.
// Margen = (neto − costo) / neto (misma fórmula que precios/calculo.js#margenDe). Sin costo → margen y utilidad null.
// Avisos: margen por debajo del mínimo (naranja; rojo si se vende con pérdida) y precio neto por debajo de lo que ya
// se le facturó a ese cliente. Prueba: node --test scripts/test-precios-calculadora.mjs
export const MARGEN_MINIMO_DEFAULT = 15;
export const DESCUENTO_MAX = 40;

const N = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v));
export const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const fmtMoney = (n) => '$' + N(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fmtPct = (n, d = 1) => `${N(n).toFixed(d)} %`;
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fechaCorta = (iso) => { const m = /^(\d{4})-(\d{2})/.exec(String(iso || '')); return m ? `${MESES[Number(m[2]) - 1]} ${m[1].slice(2)}` : ''; };

/** Precio neto a partir del descuento (o viceversa) sobre el precio de lista. */
export function precioDesdeDescuento(precioLista, descuentoPct) {
  return r2(N(precioLista) * (1 - N(descuentoPct) / 100));
}
export function descuentoDesdePrecio(precioLista, precio) {
  const l = N(precioLista);
  if (!(l > 0)) return 0;
  return r2((1 - N(precio) / l) * 100);
}

/** Tono del margen: verde ≥ mínimo · naranja entre 0 y mínimo · rojo < 0 · gris sin dato. */
export function tonoMargen(margenPct, margenMinimo = MARGEN_MINIMO_DEFAULT) {
  if (margenPct == null || !Number.isFinite(margenPct)) return 'gray';
  if (margenPct < 0) return 'red';
  if (margenPct < N(margenMinimo)) return 'orange';
  return 'green';
}

export function calcular({ precioLista, costo, descuentoPct, precio, piezas = 1, margenMinimo = MARGEN_MINIMO_DEFAULT, precioFacturado, facturadoFecha, clienteLabel } = {}) {
  const lista = N(precioLista);
  const pz = Math.max(0, Math.round(N(piezas)));
  let neto, d;
  if (precio != null && precio !== '') { neto = r2(N(precio)); d = descuentoDesdePrecio(lista, neto); }
  else { d = r2(N(descuentoPct)); neto = precioDesdeDescuento(lista, d); }
  if (neto < 0) neto = 0;
  const c = N(costo);
  const conCosto = c > 0 && neto > 0;
  const margenPct = conCosto ? r2(((neto - c) / neto) * 100) : null;
  const utilidad = conCosto ? r2((neto - c) * pz) : null;
  const monto = r2(neto * pz);
  const min = N(margenMinimo);
  const avisos = [];
  if (margenPct != null && margenPct < min) {
    const conDesc = d > 0 ? `Con ${fmtPct(d, d % 1 ? 1 : 0)} de descuento quedas` : 'Quedas';
    avisos.push(margenPct < 0
      ? { tipo: 'perdida', texto: `${conDesc} en ${fmtPct(margenPct)}: vendes por debajo del costo (${fmtMoney(c)}).` }
      : { tipo: 'margen', texto: `${conDesc} en ${fmtPct(margenPct)} de margen, debajo de tu mínimo de ${fmtPct(min, 0)}.` });
  }
  const fact = N(precioFacturado);
  if (fact > 0 && neto > 0 && neto < fact - 0.005) {
    const quien = clienteLabel ? `a ${clienteLabel}` : 'a este cliente';
    const cuando = facturadoFecha ? ` en ${fechaCorta(facturadoFecha)}` : '';
    avisos.push({ tipo: 'facturado', texto: `Ojo: ${quien} ya le facturaste a ${fmtMoney(fact)}${cuando}; con este precio quedas ${fmtMoney(fact - neto)} abajo.` });
  }
  return { precioNeto: neto, descuentoPct: d, margenPct, utilidad, monto, piezas: pz, tono: tonoMargen(margenPct, min), avisos };
}

/** Margen total de varias líneas [{ piezas, precio, costo }] → { monto, utilidad, margenPct (null sin costos), sinCosto }. */
export function margenLineas(lineas = []) {
  let monto = 0, utilidad = 0, montoConCosto = 0, sinCosto = 0;
  for (const l of lineas) {
    const m = N(l.piezas) * N(l.precio);
    monto += m;
    if (N(l.costo) > 0) { utilidad += (N(l.precio) - N(l.costo)) * N(l.piezas); montoConCosto += m; }
    else sinCosto += 1;
  }
  return { monto: r2(monto), utilidad: r2(utilidad), margenPct: montoConCosto > 0 ? r2((utilidad / montoConCosto) * 100) : null, sinCosto };
}
