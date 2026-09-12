// Carga de datos y escrituras de Pagos V3 (2026-09-12)
//
// Reglas de rendimiento del proyecto:
//   · `pagos`, `pagos_*`, `pagos_fondos*`, `pagos_dinamica_mes` las ESCRIBE la app →
//     nunca se envuelven con cachedQuery; tras cada escritura se invalida el cache.
//   · Las vistas de sólo lectura (v_fact_cliente_mes, v_sellout_general_vendedor_mes…)
//     sí pasan por cachedQuery / fetchAllQ.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, DB_CONFIGURED } from '../../../lib/supabase';
import { cachedQuery, invalidateDataCache } from '../../../lib/queries';
import { puedeVerPestanaCliente, puedeEditarPestanaCliente } from '../../../lib/permisos';
import { CLIENTES } from './reglas';
import M from './motor';

const pad = (n) => String(n).padStart(2, '0');
export const periodoDe = (anio, mes) => `${anio}-${pad(mes)}`;

/** Clientes que este perfil puede ver en la pantalla de pagos. */
export function clientesVisibles(perfil) {
  return CLIENTES.filter((k) => puedeVerPestanaCliente(perfil, k, 'pagos'));
}
export const puedeEditarPagos = (perfil, clienteKey) => puedeEditarPestanaCliente(perfil, clienteKey, 'pagos');

// ───────────────────────── Carga principal ─────────────────────────
export function useDatosPagos({ perfil, anio, mes }) {
  const visibles = useMemo(() => clientesVisibles(perfil), [perfil]);
  const clave = visibles.join(',');
  const [estado, setEstado] = useState({ cargando: true, error: null });
  const [pagos, setPagos] = useState([]);
  const [reglas, setReglas] = useState([]);
  const [fondos, setFondos] = useState([]);
  const [movFondos, setMovFondos] = useState([]);
  const [dinamica, setDinamica] = useState([]);
  const [sellIn, setSellIn] = useState([]);
  const [cuotas, setCuotas] = useState([]);
  const [sellOut, setSellOut] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [actividades, setActividades] = useState([]);
  const [sellInSku, setSellInSku] = useState([]);      // rebate por categoría (Digitalife)
  const [categorias, setCategorias] = useState([]);    // sku → categoría
  const vivo = useRef(true);

  const cargar = useCallback(async () => {
    if (!DB_CONFIGURED || visibles.length === 0) { setEstado({ cargando: false, error: null }); return; }
    setEstado((e) => ({ ...e, cargando: true }));
    try {
      const [rPagos, rReglas, rFondos, rMov, rDin, rSi, rCuo, rSo, rVen, rAct, rSku, rCat] = await Promise.all([
        supabase.from('pagos').select('*').in('cliente', visibles).order('fecha_programada', { ascending: true }),
        supabase.from('pagos_reglas').select('*').order('vigente_desde', { ascending: false }),
        supabase.from('v_pagos_fondos_saldo').select('*'),
        supabase.from('pagos_fondos_movimientos').select('*').in('cliente', visibles).order('fecha', { ascending: false }).limit(500),
        supabase.from('pagos_dinamica_mes').select('*').eq('anio', anio),
        cachedQuery(supabase.from('v_fact_cliente_mes').select('cliente_key,anio,mes,monto').eq('anio', anio).in('cliente_key', visibles)),
        supabase.from('cuotas_mensuales').select('cliente,anio,mes,cuota_min,cuota_minima_interna').eq('anio', anio).in('cliente', visibles),
        supabase.from('sellout_sku').select('cliente,anio,mes,monto_pesos').eq('anio', anio).in('cliente', visibles),
        visibles.includes('dicotech')
          ? cachedQuery(supabase.from('v_sellout_general_vendedor_mes').select('anio,mes,vendedor_nombre,importe').eq('anio', anio).ilike('mayorista', '%dicotech%'))
          : Promise.resolve({ data: [] }),
        supabase.from('marketing_actividades').select('id,cliente,nombre,anio,mes,fecha,inversion,costo,cobro,pago_id,estatus').eq('anio', anio).in('cliente', visibles),
        // Rebate por categoría (Digitalife): sell in por SKU + categoría del SKU.
        cachedQuery(supabase.from('sell_in_sku').select('cliente,sku,mes,monto_pesos').eq('anio', anio).in('cliente', visibles)),
        cachedQuery(supabase.from('productos_cliente').select('cliente,sku,categoria').in('cliente', visibles)),
      ]);
      if (!vivo.current) return;
      setPagos(rPagos.data || []);
      setReglas(rReglas.data || []);
      setFondos(rFondos.data || []);
      setMovFondos(rMov.data || []);
      setDinamica(rDin.data || []);
      setSellIn(rSi.data || []);
      setCuotas(rCuo.data || []);
      setSellOut(rSo.data || []);
      setVendedores(rVen.data || []);
      setActividades(rAct.data || []);
      setSellInSku(rSku.data || []);
      setCategorias(rCat.data || []);
      setEstado({ cargando: false, error: null });
    } catch (e) {
      if (vivo.current) setEstado({ cargando: false, error: e.message || String(e) });
    }
  }, [clave, anio]);

  useEffect(() => { vivo.current = true; cargar(); return () => { vivo.current = false; }; }, [cargar]);

  // Mapas con la forma que espera el motor.
  const datosMotor = useMemo(() => {
    const sellInMes = {}, cuotaMes = {}, sellOutMes = {}, alcanceQ = {}, acts = {}, vend = {}, din = {};
    for (const r of sellIn) (sellInMes[r.cliente_key] ||= {})[periodoDe(r.anio, r.mes)] = Number(r.monto) || 0;
    for (const r of cuotas) (cuotaMes[r.cliente] ||= {})[periodoDe(r.anio, r.mes)] = Number(r.cuota_min) || 0;
    for (const r of sellOut) {
      const k = periodoDe(r.anio, r.mes);
      (sellOutMes[r.cliente] ||= {})[k] = ((sellOutMes[r.cliente] || {})[k] || 0) + (Number(r.monto_pesos) || 0);
    }
    for (const c of visibles) {
      for (let q = 1; q <= 4; q++) {
        const ms = M.mesesDeQ(q);
        const si = ms.reduce((s, m) => s + ((sellInMes[c] || {})[periodoDe(anio, m)] || 0), 0);
        const cu = ms.reduce((s, m) => s + ((cuotaMes[c] || {})[periodoDe(anio, m)] || 0), 0);
        (alcanceQ[c] ||= {})[M.periodoQ(anio, q)] = cu > 0 ? si / cu : 0;
      }
    }
    for (const a of actividades) (acts[a.cliente] ||= []).push(a);
    for (const v of vendedores) (vend[periodoDe(v.anio, v.mes)] ||= []).push({ nombre: v.vendedor_nombre, importe: Number(v.importe) || 0 });
    for (const d of dinamica) din[periodoDe(d.anio, d.mes)] = { meta: Number(d.meta) || 0, premios: d.premios || [] };

    // Sell in del trimestre partido por categoría (rebate trimestral de Digitalife).
    // Misma regla que el código anterior: 'monitores' y 'sillas' son coincidencia
    // EXACTA de categoría; todo lo demás cae a accesorios.
    const catDe = {};
    for (const p of categorias) (catDe[p.cliente] ||= {})[p.sku] = String(p.categoria || '').trim().toLowerCase();
    const sellInQCategorias = {};
    for (const r of sellInSku) {
      const q = M.qDeMes(Number(r.mes));
      if (!(q >= 1 && q <= 4)) continue;
      const cat = catDe[r.cliente]?.[r.sku] || '';
      const destino = cat === 'monitores' ? 'monitores' : cat === 'sillas' ? 'sillas' : 'accesorios';
      const porQ = ((sellInQCategorias[r.cliente] ||= {})[M.periodoQ(anio, q)] ||= { monitores: 0, sillas: 0, accesorios: 0 });
      porQ[destino] += Number(r.monto_pesos) || 0;
    }

    return { sellInMes, cuotaMes, sellOutMes, alcanceQ, sellInQCategorias, actividades: acts, vendedoresDicotech: vend, dinamica: din };
  }, [sellIn, cuotas, sellOut, actividades, vendedores, dinamica, sellInSku, categorias, visibles, anio]);

  return {
    ...estado, recargar: cargar, visibles,
    pagos, setPagos, reglas, setReglas, fondos, movFondos, dinamica, setDinamica, actividades,
    datosMotor,
  };
}

// ───────────────────────── Escrituras ─────────────────────────
const ahora = () => new Date().toISOString();
const nombreDe = (perfil) => perfil?.nombre || perfil?.email || 'Sistema';

async function bitacora(pagoId, anterior, nuevo, perfil, nota, meta) {
  await supabase.from('pagos_bitacora').insert({
    pago_id: pagoId, estado_anterior: anterior, estado_nuevo: nuevo,
    usuario: nombreDe(perfil), nota: nota || null, meta: meta || {},
  });
}

/** Avanza (o rechaza/cancela) un pago y deja rastro en la bitácora. */
export async function cambiarEstado({ pago, hacia, perfil, extra = {}, nota }) {
  const parche = { estado: hacia, updated_at: ahora(), ...extra };
  const quien = nombreDe(perfil);
  if (hacia === 'solicitado') { parche.solicitado_at = ahora(); parche.solicitado_por = quien; parche.estatus = 'en_proceso'; }
  if (hacia === 'autorizado') { parche.autorizado_at = ahora(); parche.autorizado_por = quien; }
  if (hacia === 'folio') { parche.folio_at = ahora(); parche.folio_por = quien; }
  if (hacia === 'pagado') {
    parche.pagado_at = ahora(); parche.pagado_por = quien; parche.estatus = 'pagado';
    parche.fecha_pago_real = parche.fecha_pago_real || (extra.nc_fecha || ahora().slice(0, 10));
  }
  if (hacia === 'rechazado') { parche.estatus = 'pendiente'; }
  if (hacia === 'cancelado') { parche.estatus = 'cancelado'; parche.monto = 0; }
  const { data, error } = await supabase.from('pagos').update(parche).eq('id', pago.id).select().single();
  if (error) throw error;
  await bitacora(pago.id, pago.estado, hacia, perfil, nota, extra.meta);
  invalidateDataCache();
  return data;
}

/** Devuelve un pago rechazado al inicio del flujo. */
export async function reabrir({ pago, perfil, motivo }) {
  return cambiarEstado({ pago, hacia: 'calculado', perfil, nota: motivo, extra: { motivo_rechazo: motivo || null, solicitado_at: null, autorizado_at: null } });
}

/** Crea (o actualiza) los pagos calculados por el motor. Idempotente por clave_calculo. */
export async function guardarPropuestas({ propuestas, perfil }) {
  const aplicables = propuestas.filter((p) => p.aplica && p.monto > 0);
  if (aplicables.length === 0) return { creados: 0, actualizados: 0 };
  const claves = aplicables.map((p) => p.clave);
  const { data: existentes } = await supabase.from('pagos').select('id,clave_calculo,estado,monto').in('clave_calculo', claves);
  const porClave = new Map((existentes || []).map((r) => [r.clave_calculo, r]));
  const nuevos = [];
  let actualizados = 0;
  for (const p of aplicables) {
    const ex = porClave.get(p.clave);
    if (!ex) {
      nuevos.push({
        cliente: p.cliente, concepto: p.concepto,
        categoria: p.tipo === 'fijo' ? 'pagosFijos' : (p.tipo === 'dinamica' ? 'spiff' : p.tipo),
        tipo: p.tipo, origen: 'auto', estado: 'calculado', estatus: 'pendiente',
        monto: p.monto, periodo: p.periodo,
        fecha_programada: p.fecha_programada, fecha_compromiso: p.fecha_programada,
        clave_calculo: p.clave, detalle: p.detalle || {},
        responsable: 'Motor de pagos', notas: p.motivo || null,
      });
    } else if (ex.estado === 'calculado' && Number(ex.monto) !== Number(p.monto)) {
      // Aún no se solicita: se actualiza al monto recalculado.
      await supabase.from('pagos').update({ monto: p.monto, detalle: p.detalle || {}, updated_at: ahora() }).eq('id', ex.id);
      actualizados++;
    }
  }
  if (nuevos.length) {
    const { data, error } = await supabase.from('pagos').insert(nuevos).select();
    if (error) throw error;
    for (const d of data || []) await bitacora(d.id, null, 'calculado', perfil, 'Creado por el motor de pagos');
  }
  invalidateDataCache();
  return { creados: nuevos.length, actualizados };
}

/** Pago capturado a mano (protección de precio, bonificación, apoyo…). */
export async function crearPagoManual({ datos, perfil }) {
  const fila = {
    cliente: datos.cliente,
    concepto: datos.concepto,
    tipo: datos.tipo || 'otro',
    categoria: datos.tipo === 'fijo' ? 'pagosFijos' : (datos.tipo === 'proteccion_precio' ? 'promociones' : (datos.tipo || 'otro')),
    origen: 'manual', estado: 'calculado', estatus: 'pendiente',
    monto: Number(datos.monto) || 0,
    periodo: datos.periodo || null,
    fecha_programada: datos.fecha_programada || null,
    fecha_compromiso: datos.fecha_programada || null,
    detalle: datos.detalle || {},
    responsable: nombreDe(perfil),
    notas: datos.notas || null,
  };
  const { data, error } = await supabase.from('pagos').insert(fila).select().single();
  if (error) throw error;
  await bitacora(data.id, null, 'calculado', perfil, 'Capturado a mano');
  invalidateDataCache();
  return data;
}

export async function borrarPago({ pago }) {
  const { error } = await supabase.from('pagos').delete().eq('id', pago.id);
  if (error) throw error;
  invalidateDataCache();
}

/** Guarda una regla con vigencia e historial (RPC pagos_guardar_regla). */
export async function guardarRegla({ cliente, seccion, config, perfil, nota }) {
  const { data, error } = await supabase.rpc('pagos_guardar_regla', {
    p_cliente: cliente, p_seccion: seccion, p_config: config, p_por: nombreDe(perfil), p_nota: nota || null,
  });
  if (error) throw error;
  invalidateDataCache();
  return data;
}

/** Meta y premios de la dinámica del mes. */
export async function guardarDinamica({ cliente = 'dicotech', anio, mes, meta, premios, perfil }) {
  const { data, error } = await supabase.from('pagos_dinamica_mes')
    .upsert({ cliente, anio, mes, meta: Number(meta) || 0, premios: premios || [], creado_por: nombreDe(perfil), updated_at: ahora() }, { onConflict: 'cliente,anio,mes' })
    .select().single();
  if (error) throw error;
  invalidateDataCache();
  return data;
}

/** Movimiento de fondo. Un cargo sobre un fondo en negativo se bloquea. */
export async function movimientoFondo({ fondo, tipo, monto, concepto, fecha, pagoId, actividadId, perfil, forzar = false }) {
  if (tipo === 'cargo' && Number(fondo.saldo) < 0 && !forzar) {
    throw new Error(`El fondo "${fondo.nombre}" está en negativo (${fondo.saldo}). Autoriza el sobregiro antes de cargarle más.`);
  }
  const f = fecha || ahora().slice(0, 10);
  const { data, error } = await supabase.from('pagos_fondos_movimientos').insert({
    fondo_id: fondo.fondo_id ?? fondo.id, cliente: fondo.cliente,
    fecha: f, anio: Number(f.slice(0, 4)), mes: Number(f.slice(5, 7)),
    tipo, monto: Math.abs(Number(monto) || 0), concepto,
    pago_id: pagoId || null, actividad_id: actividadId || null,
    origen: 'manual', creado_por: nombreDe(perfil),
  }).select().single();
  if (error) throw error;
  invalidateDataCache();
  return data;
}

/** Sube el PDF de la nota de crédito al bucket pagos-nc y devuelve su ruta. */
export async function subirPdfNotaCredito({ pago, archivo }) {
  const limpio = String(archivo.name || 'nota.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
  const ruta = `${pago.cliente}/${pago.id}/${Date.now()}-${limpio}`;
  const { error } = await supabase.storage.from('pagos-nc').upload(ruta, archivo, { contentType: 'application/pdf', upsert: false });
  if (error) throw error;
  return ruta;
}

export async function urlPdfNotaCredito(ruta) {
  if (!ruta) return null;
  const { data } = await supabase.storage.from('pagos-nc').createSignedUrl(ruta, 60 * 10);
  return data?.signedUrl || null;
}

export async function leerBitacora(pagoId) {
  const { data } = await supabase.from('pagos_bitacora').select('*').eq('pago_id', pagoId).order('at', { ascending: true });
  return data || [];
}

export async function historialRegla(cliente, seccion) {
  const { data } = await supabase.from('pagos_reglas_historial').select('*')
    .eq('cliente', cliente).eq('seccion', seccion).order('cambiado_at', { ascending: false }).limit(20);
  return data || [];
}

export default {
  useDatosPagos, clientesVisibles, puedeEditarPagos, cambiarEstado, reabrir, guardarPropuestas,
  crearPagoManual, borrarPago, guardarRegla, guardarDinamica, movimientoFondo,
  subirPdfNotaCredito, urlPdfNotaCredito, leerBitacora, historialRegla,
};
