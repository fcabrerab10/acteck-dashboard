// Motor de cálculo de Pagos V3 · PURO (2026-09-12)
//
// Sin React, sin supabase, sin Date.now() implícito: todo entra por parámetros para
// que los tests (scripts/test-pagos-motor.mjs) y el cron (api/_pagos.js) usen el
// mismo código que la pantalla.
//
// Cada cálculo devuelve una PROPUESTA de pago:
//   { clave, cliente, tipo, concepto, monto, periodo, fecha_programada,
//     aplica, motivo, detalle: { base, pct, alcance, filas: [...] } }
// `clave` es el clave_calculo único en `pagos` → recalcular es idempotente.
//
// Reglas implementadas (copiadas de lineamientos_cliente, ver reglas.js):
//   · Rebate mensual Dicotech        — sell in del mes cerrado × % por nivel de alcance (>150 % → 3 %)
//   · Rebate trimestral PCEL         — sell in del Q × % por nivel
//   · Rebate trimestral Digitalife   — sell in del Q por categoría × % de cada categoría
//   · SPIFF sell in PCEL / Dicotech  — sell in del mes × %
//   · SPIFF sell out Digitalife      — paga si sell out ≥ cuota SO (= cuota SI × 90 %); monto = sell out × 0.18 %
//   · Dinámica de vendedores Dicotech— vendedores con venta ≥ meta; ranking; premios 1º…5º
//   · Pagos fijos                    — monto por mes
//   · Marketing                      — actividades del mes que paga la empresa
// Protección de precio es MANUAL: aquí sólo va el apoyo de cálculo (apoyoProteccionPrecio).

import { reglaDe } from './reglas.js';

export const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
export const periodoMes = (anio, mes) => `${anio}-${String(mes).padStart(2, '0')}`;
export const periodoQ = (anio, q) => `${anio}-Q${q}`;
export const qDeMes = (mes) => Math.ceil(mes / 3);
export const mesesDeQ = (q) => [q * 3 - 2, q * 3 - 1, q * 3];
export const redondear = (n) => Math.round(num(n) * 100) / 100;

/** Suma un mes a (anio, mes) — para "el pago se programa el mes siguiente al cerrado". */
export function mesSiguiente(anio, mes) {
  return mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 };
}

/** Fecha ISO de pago: día `dia` del mes siguiente al periodo calculado. */
export function fechaPagoDeMes(anio, mes, dia = 15) {
  const s = mesSiguiente(anio, mes);
  return `${s.anio}-${String(s.mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** Nivel (tier) aplicable a un alcance: el de mayor min_alcance que el alcance supere. */
export function nivelDe(tiers, alcance) {
  const orden = (tiers || []).slice().sort((a, b) => num(b.min_alcance) - num(a.min_alcance));
  return orden.find((t) => num(alcance) >= num(t.min_alcance)) || null;
}

/**
 * NÚCLEO ÚNICO del rebate por niveles (2026-11-20). Lo usan el cálculo del cierre (cron), el panel «Cálculo» de Pagos
 * (web y celular) y el «rebate en progreso» de la ficha del cliente: alcance = base ÷ cuota; paga el % del nivel más
 * alto alcanzado sólo si el alcance llega al mínimo (0.90 si la regla no trae uno).
 *   decimales: 2 = centavos (propuestas de pago) · 0 = pesos enteros (la ficha del cliente en el celular).
 */
export function rebatePorNiveles({ base, cuota, tiers, minimo, decimales = 2 }) {
  const alcance = num(cuota) > 0 ? num(base) / num(cuota) : 0;
  const min = num(minimo) || 0.90;
  const tier = nivelDe(tiers || [], alcance);
  const cumple = alcance >= min && !!tier;
  const pct = cumple ? num(tier.pct) : 0;
  const bruto = num(base) * pct;
  return { alcance, minimo: min, tier, cumple, pct, monto: decimales === 0 ? Math.round(bruto) : redondear(bruto) };
}

/** Alcance mínimo que pide la regla: la mensual lo guarda en `alcance_minimo_pago`, la trimestral en `requiere_alcance_minimo`. */
export const minimoDeRegla = (regla) => (regla?.frecuencia === 'mensual' ? regla?.alcance_minimo_pago : regla?.requiere_alcance_minimo);

/**
 * Qué cálculo le toca a una regla de rebate: 'mensual' | 'niveles' | 'por_categoria' | null.
 * `trimestralSinModo` decide una regla trimestral guardada SIN `modo` (las copias no coincidían y se conservó cada una):
 * el cierre y la ficha del cliente la tratan como 'niveles'; el panel «Cálculo» como 'por_categoria'.
 */
export function modoRebate(regla, { trimestralSinModo = 'niveles' } = {}) {
  if (!regla) return null;
  if (regla.frecuencia === 'mensual') return 'mensual';
  if (regla.frecuencia !== 'trimestral') return null;
  if (regla.modo === 'por_categoria' || regla.modo === 'niveles') return regla.modo;
  return trimestralSinModo;
}

/** Sell in y cuota del trimestre = suma de sus 3 meses (los que aún no llegan suman su cuota y 0 de venta). */
export function basesDelQ({ anio, q, sellInDe, cuotaDe }) {
  const meses = mesesDeQ(q);
  return { sellInQ: meses.reduce((s, m) => s + num(sellInDe(anio, m)), 0), cuotaQ: meses.reduce((s, m) => s + num(cuotaDe(anio, m)), 0) };
}

const prop = (o) => ({ aplica: false, motivo: null, monto: 0, detalle: {}, ...o });

/**
 * Propuesta de rebate de un cliente para (anio, mes) con su regla. ÚNICO enrutador (cron y paneles).
 *   soloQCerrado: true → el trimestral sólo se calcula en el mes que cierra el Q (cron); false → con el Q en curso (paneles).
 */
export function rebateDelPeriodo({ cliente, regla, anio, mes, datos = {}, soloQCerrado = true, trimestralSinModo = 'niveles' }) {
  const modo = modoRebate(regla, { trimestralSinModo });
  if (!modo) return null;
  const sellInDe = (a, m) => datos.sellInMes?.[cliente]?.[periodoMes(a, m)];
  const cuotaDe = (a, m) => datos.cuotaMes?.[cliente]?.[periodoMes(a, m)];
  if (modo === 'mensual') return rebateMensual({ cliente, anio, mes, sellIn: sellInDe(anio, mes), cuota: cuotaDe(anio, mes), regla });
  if (soloQCerrado && mes % 3 !== 0) return null;
  const q = qDeMes(mes);
  if (modo === 'por_categoria') return rebateTrimestralCategorias({ cliente, anio, q, porCategoria: datos.sellInQCategorias?.[cliente]?.[periodoQ(anio, q)], regla });
  const { sellInQ, cuotaQ } = basesDelQ({ anio, q, sellInDe, cuotaDe });
  return rebateTrimestralNiveles({ cliente, anio, q, sellInQ, cuotaQ, regla });
}

// ───────────────────────── Rebate mensual · Dicotech ─────────────────────────
// Se calcula el día 2 del mes siguiente sobre el sell in del mes cerrado (sin IVA).
export function rebateMensual({ cliente = 'dicotech', anio, mes, sellIn, cuota, regla }) {
  const r = regla || {};
  const { alcance, minimo: alcanceMin, tier, cumple, pct, monto } = rebatePorNiveles({ base: sellIn, cuota, tiers: r.tiers, minimo: r.alcance_minimo_pago });
  return prop({
    clave: `rebate:${cliente}:${periodoMes(anio, mes)}`,
    cliente, tipo: 'rebate', origen: 'auto',
    concepto: `Rebate ${MESES_LARGOS[mes - 1]} ${anio} · ${cliente}`,
    periodo: periodoMes(anio, mes),
    fecha_programada: fechaPagoDeMes(anio, mes, num(r.dia_pago) || 15),
    aplica: cumple && monto > 0,
    motivo: cumple ? null : `Alcance ${(alcance * 100).toFixed(0)} % — mínimo ${(alcanceMin * 100).toFixed(0)} %`,
    monto,
    detalle: {
      base: num(sellIn), cuota: num(cuota), alcance, pct, nivel: tier?.label || null,
      nombre_oficial: r.nombre_oficial || null,
      filas: [{ concepto: `Sell in ${MESES_CORTOS[mes - 1]} (sin IVA)`, base: num(sellIn), pct, monto }],
    },
  });
}

// ───────────────────────── Rebate trimestral por niveles · PCEL ─────────────────────────
export function rebateTrimestralNiveles({ cliente = 'pcel', anio, q, sellInQ, cuotaQ, regla }) {
  const r = regla || {};
  const { alcance, minimo, tier, cumple, pct, monto } = rebatePorNiveles({ base: sellInQ, cuota: cuotaQ, tiers: r.tiers, minimo: r.requiere_alcance_minimo });
  const ultimoMes = q * 3;
  return prop({
    clave: `rebate:${cliente}:${periodoQ(anio, q)}`,
    cliente, tipo: 'rebate', origen: 'auto',
    concepto: `Rebate Q${q} ${anio} · ${cliente}`,
    periodo: periodoQ(anio, q),
    fecha_programada: fechaPagoDeMes(anio, ultimoMes, 15),
    aplica: cumple && monto > 0,
    motivo: cumple ? null : `Alcance del trimestre ${(alcance * 100).toFixed(0)} % — mínimo ${(minimo * 100).toFixed(0)} %`,
    monto,
    detalle: {
      base: num(sellInQ), cuota: num(cuotaQ), alcance, pct, nivel: tier?.label || null,
      niveles: r.tiers || [],
      filas: [{ concepto: `Sell in Q${q} (sin IVA)`, base: num(sellInQ), pct, monto }],
    },
  });
}

// ───────────────────────── Rebate trimestral por categoría · Digitalife ─────────────────────────
// porCategoria: { monitores, sillas, accesorios } con el sell in del trimestre de cada una.
export function rebateTrimestralCategorias({ cliente = 'digitalife', anio, q, porCategoria, regla }) {
  const r = regla || {};
  const pcts = r.por_categoria || {};
  const filas = Object.keys(pcts).map((cat) => {
    const base = num(porCategoria?.[cat]);
    const pct = num(pcts[cat]);
    return { concepto: cat.charAt(0).toUpperCase() + cat.slice(1), base, pct, monto: redondear(base * pct) };
  });
  const monto = redondear(filas.reduce((s, f) => s + f.monto, 0));
  const base = filas.reduce((s, f) => s + f.base, 0);
  const ultimoMes = q * 3;
  const ddmm = (r.fechas_pago || {})[`Q${q}`];
  const sig = mesSiguiente(anio, ultimoMes);
  const fecha = ddmm ? `${q === 4 ? anio + 1 : anio}-${ddmm}` : fechaPagoDeMes(anio, ultimoMes, 15);
  return prop({
    clave: `rebate:${cliente}:${periodoQ(anio, q)}`,
    cliente, tipo: 'rebate', origen: 'auto',
    concepto: `Rebate Q${q} ${anio} · ${cliente}`,
    periodo: periodoQ(anio, q),
    fecha_programada: fecha || `${sig.anio}-${String(sig.mes).padStart(2, '0')}-15`,
    aplica: monto > 0,
    motivo: monto > 0 ? null : 'Sin sell in en el trimestre',
    monto,
    detalle: { base, filas, por_categoria: pcts },
  });
}

// ───────────────────────── SPIFF sobre sell in · PCEL y Dicotech ─────────────────────────
export function spiffSellIn({ cliente, anio, mes, sellIn, cuota, regla }) {
  const r = regla || {};
  const pct = num(r.pct_fijo) || num(r.compradora_pct) || 0;
  const minimo = num(r.requiere_alcance_minimo) || 0;   // PCEL exige 90 %; Dicotech no exige
  const alcance = num(cuota) > 0 ? num(sellIn) / num(cuota) : 0;
  const cumple = minimo === 0 || alcance >= minimo;
  const monto = cumple ? redondear(num(sellIn) * pct) : 0;
  const etiqueta = r.compradora_pct ? 'SPIFF compradora' : 'SPIFF';
  return prop({
    clave: `spiff:${cliente}:${periodoMes(anio, mes)}`,
    cliente, tipo: 'spiff', origen: 'auto',
    concepto: `${etiqueta} ${MESES_LARGOS[mes - 1]} ${anio} · ${cliente}`,
    periodo: periodoMes(anio, mes),
    fecha_programada: fechaPagoDeMes(anio, mes, num(r.dia_pago) || 15),
    aplica: cumple && monto > 0,
    motivo: cumple ? null : `Alcance ${(alcance * 100).toFixed(0)} % — mínimo ${(minimo * 100).toFixed(0)} %`,
    monto,
    detalle: {
      base: num(sellIn), cuota: num(cuota), alcance, pct,
      filas: [{ concepto: `Sell in ${MESES_CORTOS[mes - 1]} (sin IVA)`, base: num(sellIn), pct, monto }],
    },
  });
}

// ───────────────────────── SPIFF sobre sell out · Digitalife ─────────────────────────
// Cuota de sell out = cuota de sell in × cuota_so_factor (90 %).
// Paga si el alcance contra esa cuota SO llega a min_alcance (100 %); monto = sell out × flat_pct.
export function spiffSellOut({ cliente = 'digitalife', anio, mes, sellOut, cuotaSellIn, regla }) {
  const r = regla || {};
  const factor = num(r.cuota_so_factor) || 0.90;
  const flat = num(r.flat_pct) || 0;
  const minimo = num(r.min_alcance) || 1.00;
  const cuotaSO = num(cuotaSellIn) * factor;
  const alcance = cuotaSO > 0 ? num(sellOut) / cuotaSO : 0;
  const cumple = alcance >= minimo;
  const monto = cumple ? redondear(num(sellOut) * flat) : 0;
  return prop({
    clave: `spiff:${cliente}:${periodoMes(anio, mes)}`,
    cliente, tipo: 'spiff', origen: 'auto',
    concepto: `SPIFF sell out ${MESES_LARGOS[mes - 1]} ${anio} · ${cliente}`,
    periodo: periodoMes(anio, mes),
    fecha_programada: fechaPagoDeMes(anio, mes, num(r.dia_pago) || 15),
    aplica: cumple && monto > 0,
    motivo: cumple ? null : `Sell out ${(alcance * 100).toFixed(0)} % de la cuota de sell out — se paga desde ${(minimo * 100).toFixed(0)} %`,
    monto,
    detalle: {
      base: num(sellOut), cuota_sell_in: num(cuotaSellIn), cuota_sell_out: redondear(cuotaSO),
      factor_cuota_so: factor, alcance, pct: flat,
      filas: [{ concepto: `Sell out ${MESES_CORTOS[mes - 1]}`, base: num(sellOut), pct: flat, monto }],
    },
  });
}

// ───────────────────────── Dinámica de vendedores · Dicotech ─────────────────────────
// vendedores: [{ nombre, importe, sucursal? }] con importe sin IVA del mes cerrado.
// meta: venta mínima para participar · premios: [{ pos, premio, monto? }]
export function dinamicaVendedores({ cliente = 'dicotech', anio, mes, vendedores = [], meta = 0, premios = [], regla }) {
  const r = regla || {};
  const n = num(r.premiados) || (premios.length || 5);
  const participan = (vendedores || [])
    .map((v) => ({ nombre: v.nombre || v.vendedor_nombre || '(sin vendedor)', importe: num(v.importe ?? v.monto), sucursal: v.sucursal || null }))
    .filter((v) => v.importe >= num(meta) && num(meta) >= 0)
    .sort((a, b) => b.importe - a.importe);
  const ganadores = participan.slice(0, n).map((v, i) => {
    const p = premios.find((x) => num(x.pos) === i + 1) || premios[i] || {};
    return { posicion: i + 1, nombre: v.nombre, sucursal: v.sucursal, importe: v.importe, premio: p.premio || '', monto: num(p.monto) };
  });
  const monto = redondear(ganadores.reduce((s, g) => s + g.monto, 0));
  return prop({
    clave: `dinamica:${cliente}:${periodoMes(anio, mes)}`,
    cliente, tipo: 'dinamica', origen: 'auto',
    concepto: `Premios dinámica ${MESES_LARGOS[mes - 1]} ${anio} · ${cliente}`,
    periodo: periodoMes(anio, mes),
    fecha_programada: fechaPagoDeMes(anio, mes, num(r.dia_pago) || 10),
    aplica: ganadores.length > 0,
    motivo: ganadores.length ? null : (num(meta) > 0 ? `Ningún vendedor alcanzó la meta de ${meta}` : 'Falta capturar la meta del mes'),
    monto,
    detalle: {
      meta: num(meta), participantes: participan.length, sin_premio: Math.max(0, participan.length - ganadores.length),
      total_vendedores: (vendedores || []).length,
      ganadores,
      filas: ganadores.map((g) => ({ concepto: `${g.posicion}º ${g.nombre}`, base: g.importe, premio: g.premio, monto: g.monto })),
    },
  });
}

// ───────────────────────── Pagos fijos ─────────────────────────
export function pagosFijos({ cliente, anio, mes, regla }) {
  const conceptos = (regla?.conceptos || []).filter((c) => c.meses === 'todos' || (Array.isArray(c.meses) && c.meses.includes(mes)));
  return conceptos.map((c) => prop({
    clave: `fijo:${cliente}:${periodoMes(anio, mes)}:${String(c.concepto).toLowerCase().replace(/\s+/g, '-')}`,
    cliente, tipo: 'fijo', origen: 'auto',
    concepto: `${c.concepto} · ${MESES_LARGOS[mes - 1]} ${anio}`,
    periodo: periodoMes(anio, mes),
    fecha_programada: `${anio}-${String(mes).padStart(2, '0')}-${String(num(c.dia) || 1).padStart(2, '0')}`,
    aplica: num(c.monto) > 0,
    monto: redondear(c.monto),
    detalle: { filas: [{ concepto: c.concepto, monto: redondear(c.monto) }] },
  }));
}

// ───────────────────────── Marketing ─────────────────────────
// Las actividades marcadas 'fondo' descuentan del fondo del cliente y NO crean pago;
// las 'empresa' se agrupan en un pago del mes.
export function marketingDelMes({ cliente, anio, mes, actividades = [] }) {
  const delMes = (actividades || []).filter((a) => num(a.anio) === anio && mesDeActividad(a) === mes);
  const empresa = delMes.filter((a) => (a.cobro || 'empresa') === 'empresa');
  const fondo = delMes.filter((a) => a.cobro === 'fondo');
  const monto = redondear(empresa.reduce((s, a) => s + num(a.inversion ?? a.costo), 0));
  return {
    pago: prop({
      clave: `marketing:${cliente}:${periodoMes(anio, mes)}`,
      cliente, tipo: 'marketing', origen: 'auto',
      concepto: `Marketing ${MESES_LARGOS[mes - 1]} ${anio} · ${cliente}`,
      periodo: periodoMes(anio, mes),
      fecha_programada: fechaPagoDeMes(anio, mes, 15),
      aplica: monto > 0,
      motivo: monto > 0 ? null : 'Sin actividades que pague la empresa',
      monto,
      detalle: { filas: empresa.map((a) => ({ concepto: a.nombre, monto: redondear(a.inversion ?? a.costo), actividad_id: a.id })) },
    }),
    cargosFondo: fondo.map((a) => ({
      actividad_id: a.id, cliente, anio, mes,
      concepto: a.nombre, monto: redondear(a.inversion ?? a.costo),
    })),
  };
}

export function mesDeActividad(a) {
  if (a.fecha) return Number(String(a.fecha).slice(5, 7));
  const m = Number(a.mes);
  if (Number.isFinite(m) && m >= 1 && m <= 12) return m;
  const i = MESES_LARGOS.findIndex((x) => x.toLowerCase() === String(a.mes || '').toLowerCase());
  return i >= 0 ? i + 1 : 0;
}

// ───────────────────────── Protección de precio (apoyo · NO crea pago) ─────────────────────────
// Fernando la calcula. El formulario le muestra: inventario del cliente × (precio lista anterior − nuevo).
export function apoyoProteccionPrecio({ inventario = [], preciosAnteriores = {}, preciosNuevos = {} }) {
  const filas = (inventario || []).map((i) => {
    const sku = i.sku;
    const ant = num(preciosAnteriores[sku]);
    const nue = num(preciosNuevos[sku]);
    const dif = ant - nue;
    const pz = num(i.piezas ?? i.existencia ?? i.cantidad);
    return { sku, descripcion: i.descripcion || '', piezas: pz, precio_anterior: ant, precio_nuevo: nue, diferencia: dif, monto: redondear(pz * dif) };
  }).filter((f) => f.diferencia > 0 && f.piezas > 0);
  return { filas, total: redondear(filas.reduce((s, f) => s + f.monto, 0)) };
}

// ───────────────────────── Abono de fondo por regla ─────────────────────────
export function abonoFondo({ cliente, fondoKey, anio, mes, sellIn, alcanceQ, regla }) {
  const r = regla || {};
  let pct = 0;
  let nivel = null;
  if (r.tipo === 'pct_sell_in') pct = num(r.pct);
  else if (r.tipo === 'pct_sell_in_tiers') {
    const orden = (r.tiers || []).slice().sort((a, b) => num(b.min_alcance_q) - num(a.min_alcance_q));
    nivel = orden.find((t) => num(alcanceQ) >= num(t.min_alcance_q)) || null;
    pct = nivel ? num(nivel.pct) : num(r.pct_fallback_q_bajo);
  } else return null; // manual: sin abono automático
  const monto = redondear(num(sellIn) * pct);
  if (!(monto > 0)) return null;
  return {
    cliente, fondo_key: fondoKey, anio, mes, tipo: 'abono', monto, origen: 'regla',
    concepto: `Generación ${MESES_CORTOS[mes - 1]} ${anio} · ${(pct * 100).toFixed(2)} % del sell in`,
    detalle: { base: num(sellIn), pct, alcance_q: num(alcanceQ), nivel: nivel?.label || null },
  };
}

// ───────────────────────── Orquestador ─────────────────────────
// datos = {
//   sellInMes: { 'digitalife': { '2026-08': 123 }, … },  cuotaMes: igual,
//   sellInQCategorias: { digitalife: { '2026-Q3': { monitores, sillas, accesorios } } },
//   sellOutMes: { digitalife: { '2026-08': n } },
//   vendedoresDicotech: { '2026-08': [{ nombre, importe, sucursal }] },
//   dinamica: { '2026-08': { meta, premios } },
//   actividades: { cliente: [ … ] },
// }
export function calcularPeriodo({ anio, mes, clientes = ['digitalife', 'pcel', 'dicotech'], reglasDB = [], datos = {} }) {
  const per = periodoMes(anio, mes);
  const q = qDeMes(mes);
  const out = [];
  const cargosFondo = [];
  const abonos = [];

  for (const cliente of clientes) {
    const rReb = reglaDe(reglasDB, cliente, 'rebate');
    const rSpiff = reglaDe(reglasDB, cliente, 'spiff');
    const rDin = reglaDe(reglasDB, cliente, 'dinamica');
    const rFijos = reglaDe(reglasDB, cliente, 'fijos');
    const rFondo = reglaDe(reglasDB, cliente, 'fondo');

    const sellIn = datos.sellInMes?.[cliente]?.[per];
    const cuota = datos.cuotaMes?.[cliente]?.[per];

    // Rebate
    // El trimestral sólo cuando el Q cierra con este mes (se calcula el día 2 del mes siguiente).
    const rebate = rebateDelPeriodo({ cliente, regla: rReb, anio, mes, datos, soloQCerrado: true, trimestralSinModo: 'niveles' });
    if (rebate) out.push(rebate);

    // SPIFF
    if (rSpiff?.base === 'sell_out') {
      out.push(spiffSellOut({ cliente, anio, mes, sellOut: datos.sellOutMes?.[cliente]?.[per], cuotaSellIn: cuota, regla: rSpiff }));
    } else if (rSpiff) {
      out.push(spiffSellIn({ cliente, anio, mes, sellIn, cuota, regla: rSpiff }));
    }

    // Dinámica de vendedores
    if (rDin?.activa) {
      const cfg = datos.dinamica?.[per] || {};
      out.push(dinamicaVendedores({
        cliente, anio, mes, regla: rDin,
        vendedores: datos.vendedoresDicotech?.[per] || [],
        meta: cfg.meta, premios: cfg.premios || [],
      }));
    }

    // Pagos fijos
    if (rFijos) out.push(...pagosFijos({ cliente, anio, mes, regla: rFijos }));

    // Marketing
    const mk = marketingDelMes({ cliente, anio, mes, actividades: datos.actividades?.[cliente] || [] });
    out.push(mk.pago);
    cargosFondo.push(...mk.cargosFondo);

    // Abonos de fondo por regla
    for (const f of rFondo?.fondos || []) {
      const ab = abonoFondo({
        cliente, fondoKey: f.fondo_key, anio, mes, sellIn,
        alcanceQ: num(datos.alcanceQ?.[cliente]?.[periodoQ(anio, q)]),
        regla: f.regla,
      });
      if (ab) abonos.push(ab);
    }
  }

  return { periodo: per, propuestas: out, aplicables: out.filter((p) => p.aplica), cargosFondo, abonos };
}

export default {
  rebateMensual, rebateTrimestralNiveles, rebateTrimestralCategorias,
  spiffSellIn, spiffSellOut, dinamicaVendedores, pagosFijos, marketingDelMes,
  apoyoProteccionPrecio, abonoFondo, calcularPeriodo, nivelDe, fechaPagoDeMes,
  rebatePorNiveles, rebateDelPeriodo, modoRebate, minimoDeRegla, basesDelQ,
  periodoMes, periodoQ, qDeMes, mesesDeQ, mesSiguiente, redondear,
  MESES_CORTOS, MESES_LARGOS,
};
