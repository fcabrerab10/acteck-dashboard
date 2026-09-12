// api/_pagos.js — Motor de Pagos V3 para el cron (2026-09-12)
//
// El prefijo "_" evita que Vercel lo publique como serverless function: lo importa
// api/cron.js (task `pagos-calcular`, día 2 a las 08:00 CDMX) igual que hace con _embarques.js.
//
// NO duplica fórmulas: reutiliza el MISMO motor puro que la pantalla
// (src/modules/comercial/pagosv3/motor.js), así que un cambio de porcentaje se
// refleja a la vez en el dashboard, en los tests y aquí.
//
// Exporta:
//   calcularPagosDelPeriodo({ anio, mes, sbGetAll })       → propuestas del motor
//   aplicarPagosCalculados({ propuestas, sbGetAll, sbPost }) → inserta las que faltan (idempotente por clave_calculo)
//   taskPagosCalcular({ sbGetAll, sbPost, hoy })           → lo que llama el cron
//   reglasAlertasPagos({ sbGetAll, hoy })                  → alertas de la bandeja, DIRIGIDAS por persona
//     (regla de Fernando 2026-09-12; user_id resuelto desde `perfiles` por correo, ver CORREOS_PAGOS)
//     · pago_por_solicitar      calculado y sin solicitar        → Fernando y Karolina (dos alertas)
//     · pago_sin_autorizar_5d   solicitado hace 5 días o más     → Fernando
//     · pago_sin_folio          autorizado y sin folio           → Karolina
//     · pago_vence_7d           vence en 7 días o menos          → Karolina
//     · fondo_negativo          saldo de un fondo bajo cero      → Fernando

import M from '../src/modules/comercial/pagosv3/motor.js';
import { CLIENTE_LABEL, CLIENTES } from '../src/modules/comercial/pagosv3/reglas.js';
import { diasEnEtapa, diasParaPago } from '../src/modules/comercial/pagosv3/estados.js';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const pad = (n) => String(n).padStart(2, '0');
const mxn = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-MX');

export function hoyCDMX() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  const anio = d.getFullYear(), mes = d.getMonth() + 1, dia = d.getDate();
  return { anio, mes, dia, iso: `${anio}-${pad(mes)}-${pad(dia)}` };
}

/** Mes cerrado que toca calcular el día 2: el anterior al de hoy. */
export function periodoACalcular(hoy = hoyCDMX()) {
  return hoy.mes === 1 ? { anio: hoy.anio - 1, mes: 12 } : { anio: hoy.anio, mes: hoy.mes - 1 };
}

// ───────────────────────── Datos que necesita el motor ─────────────────────────
export async function traerDatos({ anio, mes, sbGetAll }) {
  const per = `${anio}-${pad(mes)}`;
  const q = M.qDeMes(mes);
  const mesesQ = M.mesesDeQ(q);
  const desdeMes = Math.min(...mesesQ);

  // El rebate trimestral por categoría (Digitalife) sólo se necesita cuando cierra el Q.
  const cierraQ = mes % 3 === 0;

  const [reglas, fact, cuotas, sellout, vendedores, dinamica, actividades, sellInSku, categorias] = await Promise.all([
    sbGetAll('pagos_reglas?select=cliente,seccion,config,vigente_desde,vigente_hasta'),
    // Sell in sin IVA por cliente y mes (fuente canónica).
    sbGetAll(`v_fact_cliente_mes?select=cliente_key,anio,mes,monto&anio=eq.${anio}&mes=gte.${desdeMes}&mes=lte.${mes}`),
    sbGetAll(`cuotas_mensuales?select=cliente,anio,mes,cuota_min,cuota_minima_interna&anio=eq.${anio}`),
    sbGetAll(`sellout_sku?select=cliente,anio,mes,monto_pesos&anio=eq.${anio}&mes=eq.${mes}`),
    sbGetAll(`v_sellout_general_vendedor_mes?select=anio,mes,vendedor_nombre,importe&anio=eq.${anio}&mes=eq.${mes}&mayorista=ilike.*dicotech*`),
    sbGetAll(`pagos_dinamica_mes?select=cliente,anio,mes,meta,premios&anio=eq.${anio}&mes=eq.${mes}`),
    sbGetAll(`marketing_actividades?select=id,cliente,nombre,anio,mes,fecha,inversion,costo,cobro,pago_id&anio=eq.${anio}`),
    cierraQ ? sbGetAll(`sell_in_sku?select=cliente,sku,mes,monto_pesos&anio=eq.${anio}&mes=gte.${desdeMes}&mes=lte.${mes}`) : Promise.resolve([]),
    cierraQ ? sbGetAll('productos_cliente?select=cliente,sku,categoria') : Promise.resolve([]),
  ]);

  const sellInMes = {}, cuotaMes = {}, sellOutMes = {}, alcanceQ = {}, acts = {};
  for (const r of fact) {
    const k = `${r.anio}-${pad(r.mes)}`;
    (sellInMes[r.cliente_key] ||= {})[k] = Number(r.monto) || 0;
  }
  for (const r of cuotas) {
    const k = `${r.anio}-${pad(r.mes)}`;
    (cuotaMes[r.cliente] ||= {})[k] = Number(r.cuota_min) || 0;
  }
  for (const r of sellout) {
    const k = `${r.anio}-${pad(r.mes)}`;
    (sellOutMes[r.cliente] ||= {})[k] = ((sellOutMes[r.cliente] || {})[k] || 0) + (Number(r.monto_pesos) || 0);
  }
  for (const c of CLIENTES) {
    const si = mesesQ.reduce((s, m) => s + ((sellInMes[c] || {})[`${anio}-${pad(m)}`] || 0), 0);
    const cu = mesesQ.reduce((s, m) => s + ((cuotaMes[c] || {})[`${anio}-${pad(m)}`] || 0), 0);
    (alcanceQ[c] ||= {})[M.periodoQ(anio, q)] = cu > 0 ? si / cu : 0;
  }
  for (const a of actividades) (acts[a.cliente] ||= []).push(a);

  const vend = {};
  for (const v of vendedores) {
    const k = `${v.anio}-${pad(v.mes)}`;
    (vend[k] ||= []).push({ nombre: v.vendedor_nombre, importe: Number(v.importe) || 0 });
  }
  const din = {};
  for (const d of dinamica) din[`${d.anio}-${pad(d.mes)}`] = { meta: Number(d.meta) || 0, premios: d.premios || [] };

  // Sell in del Q partido por categoría (misma regla del código anterior:
  // 'monitores' y 'sillas' exactas; todo lo demás cae a accesorios).
  const catDe = {};
  for (const p of categorias) (catDe[p.cliente] ||= {})[p.sku] = String(p.categoria || '').trim().toLowerCase();
  const sellInQCategorias = {};
  for (const r of sellInSku) {
    const cat = catDe[r.cliente]?.[r.sku] || '';
    const destino = cat === 'monitores' ? 'monitores' : cat === 'sillas' ? 'sillas' : 'accesorios';
    const porQ = ((sellInQCategorias[r.cliente] ||= {})[M.periodoQ(anio, q)] ||= { monitores: 0, sillas: 0, accesorios: 0 });
    porQ[destino] += Number(r.monto_pesos) || 0;
  }

  return {
    reglasDB: reglas,
    datos: { sellInMes, cuotaMes, sellOutMes, alcanceQ, sellInQCategorias, vendedoresDicotech: vend, dinamica: din, actividades: acts },
  };
}

/** Propuestas del motor para (anio, mes). No escribe nada. */
export async function calcularPagosDelPeriodo({ anio, mes, sbGetAll }) {
  const { reglasDB, datos } = await traerDatos({ anio, mes, sbGetAll });
  return M.calcularPeriodo({ anio, mes, reglasDB, datos });
}

/** Fila de `pagos` a partir de una propuesta del motor. */
export function filaDePropuesta(p) {
  return {
    cliente: p.cliente,
    concepto: p.concepto,
    categoria: p.tipo === 'fijo' ? 'pagosFijos' : (p.tipo === 'dinamica' ? 'spiff' : p.tipo),  // compat con la columna vieja
    tipo: p.tipo,
    origen: 'auto',
    estado: 'calculado',
    estatus: 'pendiente',                       // compat con la columna vieja
    monto: p.monto,
    periodo: p.periodo,
    fecha_programada: p.fecha_programada,
    fecha_compromiso: p.fecha_programada,       // compat
    clave_calculo: p.clave,
    detalle: p.detalle || {},
    responsable: 'Motor de pagos',
    notas: p.motivo || null,
  };
}

/** Inserta las propuestas que aún no existen (idempotente por clave_calculo). */
export async function aplicarPagosCalculados({ propuestas, sbGetAll, sbPost, dryRun = false }) {
  const aplicables = propuestas.filter((p) => p.aplica && p.monto > 0);
  if (aplicables.length === 0) return { creados: 0, existentes: 0, filas: [] };
  const claves = aplicables.map((p) => p.clave);
  const yaHay = await sbGetAll(`pagos?select=id,clave_calculo&clave_calculo=in.(${claves.map((c) => `"${c}"`).join(',')})`);
  const set = new Set(yaHay.map((r) => r.clave_calculo));
  const nuevos = aplicables.filter((p) => !set.has(p.clave)).map(filaDePropuesta);
  if (nuevos.length && !dryRun) await sbPost('pagos', nuevos);
  return { creados: nuevos.length, existentes: aplicables.length - nuevos.length, filas: nuevos };
}

/** Lo que llama el cron el día 2: calcula el mes cerrado y crea los pagos faltantes. */
export async function taskPagosCalcular({ sbGetAll, sbPost, hoy = hoyCDMX(), anio, mes, dryRun = false } = {}) {
  const per = anio && mes ? { anio, mes } : periodoACalcular(hoy);
  const r = await calcularPagosDelPeriodo({ anio: per.anio, mes: per.mes, sbGetAll });
  const aplicado = await aplicarPagosCalculados({ propuestas: r.propuestas, sbGetAll, sbPost, dryRun });
  return {
    ok: true,
    periodo: `${per.anio}-${pad(per.mes)}`,
    propuestas: r.propuestas.length,
    aplicables: r.aplicables.length,
    creados: aplicado.creados,
    existentes: aplicado.existentes,
    sin_aplicar: r.propuestas.filter((p) => !p.aplica).map((p) => ({ clave: p.clave, motivo: p.motivo })),
    cargos_fondo: r.cargosFondo.length,
    abonos_fondo: r.abonos.length,
  };
}

// ───────────────────────── Alertas de la bandeja ─────────────────────────
const navegar = (clienteKey, label) => ({ tipo: 'navegar', clienteKey, pagina: 'pagos', label });

// Quién recibe cada alerta (regla de Fernando, 2026-09-12). Igual que `agenda_asignado` en api/cron.js:
// una alerta POR PERSONA con `para_usuario` y el user_id dentro de la clave (la central sólo se la muestra
// a ella y el resumen por correo también). Si el perfil no se resuelve, cae a un aviso general (sin destinatario).
export const CORREOS_PAGOS = {
  fernando: 'fernando.cabrera@acteck.com',
  karolina: 'karolina.veliz@acteck.com',
};

export async function destinatariosPagos(sbGetAll) {
  let filas = [];
  try { filas = await sbGetAll('perfiles?select=user_id,email,activo&activo=eq.true'); } catch { filas = []; }
  const por = (mail) => (filas || []).find((p) => String(p.email || '').trim().toLowerCase() === mail)?.user_id || null;
  return { fernando: por(CORREOS_PAGOS.fernando), karolina: por(CORREOS_PAGOS.karolina) };
}

/** Una alerta por destinatario (clave con el user_id). Sin destinatarios resueltos → un aviso general. */
function dirigida(base, uids = []) {
  const reales = [...new Set(uids.filter(Boolean))];
  if (!reales.length) return [base];
  return reales.map((u) => ({ ...base, para_usuario: u, clave: `${base.clave}|${u}` }));
}

/**
 * Reglas de alerta de Pagos. Devuelve filas con la forma que espera taskGenerarAlertas
 * (tipo, severidad, clave, titulo, detalle, cliente_key, area, accion, valor, meta).
 */
export async function reglasAlertasPagos({ sbGetAll, hoy = hoyCDMX() }) {
  const [pagos, fondos, quien] = await Promise.all([
    sbGetAll('pagos?select=id,cliente,concepto,monto,estado,tipo,periodo,folio,fecha_programada,solicitado_at,autorizado_at,folio_at,created_at&estado=in.(calculado,solicitado,autorizado,folio)'),
    sbGetAll('v_pagos_fondos_saldo?select=fondo_id,cliente,fondo_key,nombre,saldo,activo'),
    destinatariosPagos(sbGetAll),
  ]);
  const out = [];
  const nombre = (p) => `${p.concepto} (${CLIENTE_LABEL[p.cliente] || p.cliente})`;

  for (const p of pagos) {
    const cli = p.cliente;
    const dias = diasEnEtapa(p, hoy.iso);
    const faltan = diasParaPago(p, hoy.iso);

    if (p.estado === 'calculado' && Number(p.monto) > 0) {
      out.push(...dirigida({
        tipo: 'pago_por_solicitar', severidad: 'info',
        clave: `pago_por_solicitar|${p.id}`,
        titulo: `Pago calculado sin solicitar · ${nombre(p)}`,
        detalle: `${mxn(p.monto)} · calculado hace ${dias} día(s). Copia el correo de solicitud desde Pagos.`,
        cliente_key: cli, sku: null, area: 'pagos',
        accion: navegar(cli, 'Solicitar'), caduca_at: null,
        valor: Math.round(Number(p.monto) || 0),
        meta: { pago_id: p.id, estado: p.estado, periodo: p.periodo, dias },
      }, [quien.fernando, quien.karolina]));
    }

    if (p.estado === 'solicitado' && dias >= 5) {
      out.push(...dirigida({
        tipo: 'pago_sin_autorizar_5d', severidad: 'alta',
        clave: `pago_sin_autorizar_5d|${p.id}`,
        titulo: `Solicitud sin autorizar hace ${dias} días · ${nombre(p)}`,
        detalle: `${mxn(p.monto)} solicitado el ${String(p.solicitado_at || '').slice(0, 10) || '—'}. Sigue esperando autorización.`,
        cliente_key: cli, sku: null, area: 'pagos',
        accion: navegar(cli, 'Ver pago'), caduca_at: null,
        valor: Math.round(Number(p.monto) || 0),
        meta: { pago_id: p.id, dias, periodo: p.periodo },
      }, [quien.fernando]));
    }

    if (p.estado === 'autorizado' && !String(p.folio || '').trim()) {
      out.push(...dirigida({
        tipo: 'pago_sin_folio', severidad: dias >= 4 ? 'alta' : 'info',
        clave: `pago_sin_folio|${p.id}`,
        titulo: `Autorizado sin folio · ${nombre(p)}`,
        detalle: `${mxn(p.monto)} autorizado hace ${dias} día(s) y finanzas aún no asigna folio.`,
        cliente_key: cli, sku: null, area: 'pagos',
        accion: navegar(cli, 'Capturar folio'), caduca_at: null,
        valor: Math.round(Number(p.monto) || 0),
        meta: { pago_id: p.id, dias, periodo: p.periodo },
      }, [quien.karolina]));
    }

    if (faltan !== null && faltan <= 7) {
      const vencido = faltan < 0;
      out.push(...dirigida({
        tipo: 'pago_vence_7d', severidad: vencido ? 'critica' : 'alta',
        clave: `pago_vence_7d|${p.id}`,
        titulo: vencido
          ? `Pago vencido hace ${Math.abs(faltan)} día(s) · ${nombre(p)}`
          : `Pago programado en ${faltan} día(s) · ${nombre(p)}`,
        detalle: `${mxn(p.monto)} · fecha programada ${p.fecha_programada} · etapa "${p.estado}".`,
        cliente_key: cli, sku: null, area: 'pagos',
        accion: navegar(cli, vencido ? 'Atender' : 'Ver pago'),
        caduca_at: null,
        valor: Math.round(Number(p.monto) || 0),
        meta: { pago_id: p.id, dias_para_pago: faltan, estado: p.estado },
      }, [quien.karolina]));
    }
  }

  for (const f of fondos) {
    if (!f.activo) continue;
    const saldo = Number(f.saldo) || 0;
    if (saldo >= 0) continue;
    out.push(...dirigida({
      tipo: 'fondo_negativo', severidad: 'critica',
      clave: `fondo_negativo|${f.cliente}|${f.fondo_key}`,
      titulo: `Fondo en negativo · ${CLIENTE_LABEL[f.cliente] || f.cliente} · ${f.nombre}`,
      detalle: `Saldo ${mxn(saldo)}. Los cargos nuevos quedan bloqueados hasta autorizar.`,
      cliente_key: f.cliente, sku: null, area: 'pagos',
      accion: navegar(f.cliente, 'Ver fondo'), caduca_at: null,
      valor: Math.round(saldo),
      meta: { fondo_id: f.fondo_id, fondo_key: f.fondo_key, saldo },
    }, [quien.fernando]));
  }

  return out;
}

export default { taskPagosCalcular, calcularPagosDelPeriodo, aplicarPagosCalculados, reglasAlertasPagos, periodoACalcular, hoyCDMX, filaDePropuesta, traerDatos, destinatariosPagos, CORREOS_PAGOS };
