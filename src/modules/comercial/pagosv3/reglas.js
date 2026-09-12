// Reglas por cliente · Pagos V3 (2026-09-12)
//
// Los valores de REGLAS_DEFAULT son COPIA EXACTA de lo que hoy usa PagosCliente.jsx
// (tabla `lineamientos_cliente`, sembrada en pagos_reglas por la migración
// 20260912_pagos_v3_reglas_seed.sql). No hay porcentajes inventados: si el modelo viejo
// no tenía una regla, aquí queda en modo manual.
//
// En caliente la pantalla lee `pagos_reglas` (regla vigente por cliente+sección);
// estos defaults son sólo el respaldo cuando la tabla aún no tiene fila.
// Archivo PURO: sin React ni supabase — lo usan el motor, los tests y api/_pagos.js.

export const CLIENTES = ['digitalife', 'pcel', 'dicotech'];

export const CLIENTE_LABEL = { digitalife: 'Digitalife', pcel: 'PCEL', dicotech: 'Dicotech' };
export const CLIENTE_COLOR = { digitalife: '#FF3B30', pcel: '#FF9500', dicotech: '#0EA5E9' };

export const SECCIONES = [
  { id: 'rebate',        label: 'Rebate' },
  { id: 'spiff',         label: 'SPIFF' },
  { id: 'dinamica',      label: 'Dinámica de vendedores' },
  { id: 'fondo',         label: 'Fondos' },
  { id: 'fijos',         label: 'Pagos fijos' },
  { id: 'destinatarios', label: 'Destinatarios de correo' },
];

export const REGLAS_DEFAULT = {
  digitalife: {
    rebate: {
      frecuencia: 'trimestral',
      base: 'sell_in_sku',
      modo: 'por_categoria',
      por_categoria: { monitores: 0.02, sillas: 0.02, accesorios: 0.03 },
      fechas_pago: { Q1: '04-15', Q2: '07-15', Q3: '10-15', Q4: '01-15' },
      dia_calculo: 2,
    },
    spiff: {
      modo: 'flat_v2',
      base: 'sell_out',
      frecuencia: 'mensual',
      flat_pct: 0.0018,
      cuota_so_factor: 0.90,   // cuota sell out = 90 % de la cuota sell in
      min_alcance: 1.00,       // paga si sell out ≥ 100 % de esa cuota sell out
      tope_mensual: 4000,
      cuota_anual: 23000000,
      split_h1_h2: [0.40, 0.60],
      dia_calculo: 2,
      dia_pago: 15,
    },
    fondo: { fondos: [{ fondo_key: 'mkt', nombre: 'Marketing', regla: { tipo: 'manual' } }] },
    fijos: { conceptos: [{ concepto: 'Stand Sucursal Chapalita', monto: 10000, dia: 1, meses: 'todos' }] },
  },

  pcel: {
    rebate: {
      frecuencia: 'trimestral',
      base: 'sell_in',
      modo: 'niveles',
      requiere_alcance_minimo: 0.90,
      dia_calculo: 2,
      tiers: [
        { min_alcance: 0.90, pct: 0.010, label: '90-105.99%' },
        { min_alcance: 1.06, pct: 0.015, label: '106-119.99%' },
        { min_alcance: 1.20, pct: 0.020, label: '≥120%' },
      ],
    },
    spiff: {
      modo: 'pct_fijo',
      base: 'sell_in',
      frecuencia: 'mensual',
      pct_fijo: 0.0021,
      requiere_alcance_minimo: 0.90,
      dia_calculo: 2,
      dia_pago: 15,
    },
    fondo: {
      fondos: [{
        fondo_key: 'mkt', nombre: 'Marketing',
        regla: { tipo: 'pct_sell_in', pct: 0.01, frecuencia: 'trimestral', alcance_minimo_pct: 100, acumula_multianio: true },
      }],
    },
  },

  dicotech: {
    rebate: {
      nombre_oficial: 'Fondo para Generación Sell Out',
      frecuencia: 'mensual',
      base: 'sell_in',
      modo: 'niveles',
      alcance_minimo_pago: 0.90,
      permite_pago_manual: true,
      dia_calculo: 2,
      dia_pago: 15,
      tiers: [
        { min_alcance: 0.90, pct: 0.02, label: '90% a 114.99%' },
        { min_alcance: 1.15, pct: 0.02, label: '115% a 129.99%' },
        { min_alcance: 1.30, pct: 0.02, label: '130% a 149.99%' },
        { min_alcance: 1.50, pct: 0.03, label: '150% en adelante' },
      ],
    },
    spiff: { modo: 'flat_v2', base: 'sell_in', frecuencia: 'mensual', compradora_pct: 0.003, dia_calculo: 2, dia_pago: 15 },
    dinamica: { activa: true, base: 'v_sellout_general_dicotech', premiados: 5, dia_calculo: 2 },
    fondo: {
      fondos: [
        {
          fondo_key: 'mkt', nombre: 'Marketing (cliente)',
          regla: {
            tipo: 'pct_sell_in_tiers', base_alcance: 'cuota_minima_interna', alcance_referencia: 'q_acumulado',
            pct_fallback_q_bajo: 0.0075,
            tiers: [
              { min_alcance_q: 0.90, pct: 0.0075, label: '90% a 114.99%' },
              { min_alcance_q: 1.15, pct: 0.0100, label: '115% a 129.99%' },
              { min_alcance_q: 1.30, pct: 0.0125, label: '130% en adelante' },
            ],
          },
        },
        { fondo_key: 'interno', nombre: 'Fondo interno (no visible al cliente)', regla: { tipo: 'pct_sell_in', pct: 0.01, visible_para_cliente: false } },
      ],
      plan_mkt_contratado: { monto_mensual: 14007.14, orden_descuento: ['mkt', 'interno'] },
    },
  },

  _global: {
    destinatarios: {
      firmas: {
        fernando: { nombre: 'Fernando', correo: 'fernando.cabrera@acteck.com' },
        karolina: { nombre: 'Karolina', correo: null },
      },
      copia_siempre: [
        { nombre: 'David Millán', correo: 'david.millan@acteck.com' },
        { nombre: 'Karolina', correo: null },
      ],
      por_tipo: {
        spiff:     { saludo: 'Hola Lucy buenos días',   para: [{ nombre: 'Lucía', correo: null }] },
        dinamica:  { saludo: 'Hola Lucy buenos días',   para: [{ nombre: 'Lucía', correo: null }] },
        rebate:    { saludo: 'Hola equipo buenos días', para: [{ nombre: 'Luis Fernando Sánchez', correo: null }, { nombre: 'Crédito y Cobranza', correo: 'credito.cobranza@acteck.com' }] },
        marketing: { saludo: 'Hola Luis Fer, buen día', para: [{ nombre: 'Luis Fernando Sánchez', correo: null }] },
        default:   { saludo: 'Buen día',                para: [{ nombre: 'Luis Fernando Sánchez', correo: null }, { nombre: 'Crédito y Cobranza', correo: 'credito.cobranza@acteck.com' }] },
      },
    },
  },
};

/** Regla vigente de (cliente, sección): la fila de `pagos_reglas` o el default. */
export function reglaDe(reglasDB, cliente, seccion) {
  const fila = (reglasDB || []).find((r) => r.cliente === cliente && r.seccion === seccion && !r.vigente_hasta);
  if (fila?.config) return fila.config;
  return REGLAS_DEFAULT[cliente]?.[seccion] || null;
}

/** Regla vigente en una fecha dada (para recalcular periodos viejos con la regla de entonces). */
export function reglaVigenteEn(reglasDB, cliente, seccion, fechaISO) {
  const f = String(fechaISO || '').slice(0, 10);
  const cand = (reglasDB || [])
    .filter((r) => r.cliente === cliente && r.seccion === seccion)
    .filter((r) => (!r.vigente_desde || r.vigente_desde <= f) && (!r.vigente_hasta || r.vigente_hasta > f))
    .sort((a, b) => String(b.vigente_desde).localeCompare(String(a.vigente_desde)));
  return cand[0]?.config || REGLAS_DEFAULT[cliente]?.[seccion] || null;
}

/** Resumen de una línea por cliente para el panel "Reglas por cliente". */
export function resumenReglas(reglasDB, cliente) {
  const reb = reglaDe(reglasDB, cliente, 'rebate');
  const sp = reglaDe(reglasDB, cliente, 'spiff');
  const fon = reglaDe(reglasDB, cliente, 'fondo');
  const partes = [];
  if (reb) {
    if (reb.modo === 'por_categoria') {
      const pc = reb.por_categoria || {};
      partes.push(`rebate ${reb.frecuencia} por categoría (${Object.entries(pc).map(([k, v]) => `${k} ${(v * 100).toFixed(1).replace(/\.0$/, '')} %`).join(' · ')})`);
    } else if (reb.modo === 'niveles') {
      const t = (reb.tiers || []).map((x) => `${(x.pct * 100).toFixed(1).replace(/\.0$/, '')} %`).join(' / ');
      partes.push(`rebate ${reb.frecuencia} por niveles (${t})`);
    }
  }
  if (sp) {
    if (sp.pct_fijo) partes.push(`SPIFF ${(sp.pct_fijo * 100).toFixed(2)} % sell in`);
    else if (sp.compradora_pct) partes.push(`SPIFF compradora ${(sp.compradora_pct * 100).toFixed(2)} % sell in`);
    else if (sp.flat_pct) partes.push(`SPIFF ${(sp.flat_pct * 100).toFixed(2)} % sell out (cuota SO = ${(sp.cuota_so_factor * 100).toFixed(0)} % de la SI)`);
  }
  if (reglaDe(reglasDB, cliente, 'dinamica')) partes.push('dinámica de vendedores');
  if (fon?.fondos?.length) partes.push(`fondos: ${fon.fondos.map((f) => f.nombre).join(' · ')}`);
  return partes.join(' · ') || 'Sin reglas configuradas';
}

export default { REGLAS_DEFAULT, reglaDe, reglaVigenteEn, resumenReglas, CLIENTES, CLIENTE_LABEL, CLIENTE_COLOR, SECCIONES };
