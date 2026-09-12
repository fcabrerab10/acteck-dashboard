// Tests del helper del cron (api/_pagos.js) · node scripts/test-pagos-cron.mjs
// Sin red: se le inyecta un sbGetAll falso con filas de ejemplo.
import P from '../api/_pagos.js';

let fallos = 0;
const ok = (cond, msg, got) => { if (cond) console.log('  ✓', msg); else { fallos++; console.log('  ✗', msg, '→', JSON.stringify(got)?.slice(0, 300)); } };

const TABLAS = {
  pagos_reglas: [],   // sin filas → el motor cae a REGLAS_DEFAULT (copia de lineamientos_cliente)
  v_fact_cliente_mes: [
    { cliente_key: 'dicotech', anio: 2026, mes: 8, monto: 1613300 },
    { cliente_key: 'pcel', anio: 2026, mes: 8, monto: 2100000 },
    { cliente_key: 'digitalife', anio: 2026, mes: 8, monto: 3000000 },
  ],
  cuotas_mensuales: [
    { cliente: 'dicotech', anio: 2026, mes: 8, cuota_min: 1400000 },
    { cliente: 'pcel', anio: 2026, mes: 8, cuota_min: 2000000 },
    { cliente: 'digitalife', anio: 2026, mes: 8, cuota_min: 3900000 },
  ],
  sellout_sku: [{ cliente: 'digitalife', anio: 2026, mes: 8, monto_pesos: 3600000 }],
  v_sellout_general_vendedor_mes: [
    { anio: 2026, mes: 8, vendedor_nombre: 'Jorge Peña', importe: 186400 },
    { anio: 2026, mes: 8, vendedor_nombre: 'Raúl Sosa', importe: 90000 },
  ],
  pagos_dinamica_mes: [{ cliente: 'dicotech', anio: 2026, mes: 8, meta: 110000, premios: [{ pos: 1, premio: 'Amazon $2,500', monto: 2500 }] }],
  marketing_actividades: [{ id: 'a1', cliente: 'dicotech', nombre: 'ADS', anio: 2026, mes: 8, inversion: 6000, cobro: 'empresa' }],
  pagos: [{ id: 'x', clave_calculo: 'rebate:dicotech:2026-08' }],   // ya existe → no se duplica
  v_pagos_fondos_saldo: [
    { fondo_id: 1, cliente: 'pcel', fondo_key: 'mkt', nombre: 'Marketing', saldo: -15000, activo: true },
    { fondo_id: 2, cliente: 'dicotech', fondo_key: 'mkt', nombre: 'Marketing', saldo: 37600, activo: true },
  ],
};

const sbGetAll = async (path) => {
  const tabla = path.split('?')[0];
  if (tabla === 'pagos' && /estado=in/.test(path)) return TABLAS.pagos_flujo || [];
  return TABLAS[tabla] || [];
};
const enviados = [];
const sbPost = async (tabla, filas) => { enviados.push({ tabla, filas }); };

console.log('taskPagosCalcular · agosto 2026');
const r = await P.taskPagosCalcular({ sbGetAll, sbPost, anio: 2026, mes: 8 });
ok(r.periodo === '2026-08', 'periodo 2026-08', r.periodo);
ok(r.aplicables >= 5, 'al menos 5 pagos aplicables', r);
ok(r.existentes === 1, 'el rebate de Dicotech ya existía → no se duplica', r);
ok(enviados.length === 1 && enviados[0].tabla === 'pagos', 'una sola inserción a pagos', enviados.map((e) => e.tabla));
const filas = enviados[0].filas;
ok(filas.every((f) => f.estado === 'calculado' && f.origen === 'auto'), 'todas entran como calculado/auto');
ok(filas.every((f) => f.clave_calculo && f.fecha_programada), 'todas traen clave y fecha programada');
ok(filas.every((f) => f.estatus === 'pendiente' && f.categoria), 'se conservan las columnas viejas (estatus/categoria)');
ok(!filas.some((f) => f.clave_calculo === 'rebate:dicotech:2026-08'), 'no se re-crea el existente', filas.map((f) => f.clave_calculo));
ok(filas.some((f) => f.clave_calculo === 'dinamica:dicotech:2026-08'), 'incluye los premios de la dinámica', filas.map((f) => f.clave_calculo));

console.log('\nperiodoACalcular');
ok(JSON.stringify(P.periodoACalcular({ anio: 2026, mes: 9, dia: 2 })) === '{"anio":2026,"mes":8}', 'el día 2 de septiembre calcula agosto');
ok(JSON.stringify(P.periodoACalcular({ anio: 2026, mes: 1, dia: 2 })) === '{"anio":2025,"mes":12}', 'el día 2 de enero calcula diciembre del año anterior');

console.log('\nreglasAlertasPagos');
TABLAS.pagos_flujo = [
  { id: 'p1', cliente: 'dicotech', concepto: 'Rebate agosto', monto: 96800, estado: 'calculado', fecha_programada: '2026-09-30', created_at: '2026-09-02' },
  { id: 'p2', cliente: 'digitalife', concepto: 'Rebate agosto', monto: 312400, estado: 'solicitado', solicitado_at: '2026-09-03', fecha_programada: '2026-09-30' },
  { id: 'p3', cliente: 'digitalife', concepto: 'SPIFF agosto', monto: 84300, estado: 'autorizado', autorizado_at: '2026-09-08', folio: '', fecha_programada: '2026-09-25' },
  { id: 'p4', cliente: 'pcel', concepto: 'Apoyo evento', monto: 85000, estado: 'folio', folio: 'F-2288', folio_at: '2026-09-11', fecha_programada: '2026-09-15' },
  { id: 'p5', cliente: 'pcel', concepto: 'Fijo septiembre', monto: 30000, estado: 'calculado', created_at: '2026-09-01', fecha_programada: '2026-09-05' },
];
const al = await P.reglasAlertasPagos({ sbGetAll, hoy: { anio: 2026, mes: 9, dia: 12, iso: '2026-09-12' } });
const tipos = al.map((a) => a.tipo);
ok(tipos.includes('pago_por_solicitar'), 'pago_por_solicitar', tipos);
ok(tipos.includes('pago_sin_autorizar_5d'), 'pago_sin_autorizar_5d (9 días)', tipos);
ok(tipos.includes('pago_sin_folio'), 'pago_sin_folio', tipos);
ok(tipos.includes('pago_vence_7d'), 'pago_vence_7d', tipos);
ok(tipos.includes('fondo_negativo'), 'fondo_negativo (PCEL −15,000)', tipos);
ok(al.find((a) => a.tipo === 'pago_vence_7d' && a.meta.pago_id === 'p5')?.severidad === 'critica', 'el vencido es crítico');
ok(al.every((a) => a.area === 'pagos' && a.clave && a.accion?.pagina === 'pagos'), 'todas llevan área, clave y acción de navegación');
ok(new Set(al.map((a) => a.clave)).size === al.length, 'claves únicas (el cron las usa para no duplicar)');

console.log(fallos === 0 ? '\nOK · helper del cron' : `\n${fallos} fallo(s)`);
process.exit(fallos ? 1 : 0);
