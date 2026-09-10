// recientes.js — acceso a `propuestas_borradores` (fuente única desde V3; ya no hay localStorage).
// La tabla la escribe la app → lectura directa con supabase (sin cachedQuery / fetchAll).
//
// Modelo en la app (camelCase):
//   { id, clienteKey, clienteLabel, nombre, estado, tstamp, anio, mes, vigencia ('YYYY-MM-DD'), lineas: [{ sku, piezas,
//     precio, lista, spiff, descripcion, marca, familia }], resumen: { skus, piezas, total }, excelFinal, exportedFilename,
//     origen, ultimaImportacion, enviadaAt, cerradaAt, folio, creadoPor, updatedAt }
// `nombre` lo escribe Fernando (puede ir vacío en un borrador; obligatorio para enviar). Si la app no manda `vigencia`,
// el trigger pone el último día del mes objetivo (migración 20260911_propuestas_vigencia.sql).
// En la base `lineas` (arreglo) es el canónico; el trigger fn_propuestas_sync mantiene `propuesta` (mapa) para el
// código viejo. Aquí escribimos SÓLO `lineas`.
import { supabase } from '../../../lib/supabase';
import { normalizarEstado, nuevaPropuestaId } from './constantes';

export const N = (v) => Number(v) || 0;
export const SELECT_PROPUESTA = 'id,cliente_key,cliente_label,nombre,estado,tstamp,anio,mes,vigencia,lineas,resumen,excel_final,exported_filename,origen,ultima_importacion,enviada_at,cerrada_at,folio,creado_por,updated_at';

const STORAGE_KEY_LEGACY = 'propuestas_recientes_v1';

// ── Conversión de líneas ──
/** Mapa de edición { sku → { piezas, precio, listaSel } } + catálogo → líneas persistibles. */
export function lineasDesdeMapa(mapa, catalogo = new Map()) {
  return Object.entries(mapa || {}).map(([sku, v]) => {
    const c = catalogo.get(sku) || {};
    const lista = v.listaSel === '__custom' ? null : (v.listaSel || v.lista || null);
    const l = {
      sku,
      piezas: N(v.piezas),
      precio: N(v.precio),
      lista,
      spiff: N(v.spiff ?? c.spiff) || null,
      descripcion: v.descripcion || c.descripcion || '',
      marca: v.marca || c.marca || '',
      familia: v.familia || c.familia || '',
    };
    if (v.listaSel === '__custom') l.custom = true;
    return l;
  }).filter((l) => l.sku);
}
/** Líneas persistidas → mapa de edición. */
export function mapaDesdeLineas(lineas) {
  const m = {};
  for (const l of lineas || []) {
    if (!l?.sku) continue;
    m[l.sku] = {
      piezas: N(l.piezas), precio: N(l.precio),
      listaSel: l.custom ? '__custom' : (l.lista || l.listaSel || ''),
      spiff: N(l.spiff), descripcion: l.descripcion || '', marca: l.marca || '', familia: l.familia || '',
    };
  }
  return m;
}
export function resumenDe(lineas) {
  const arr = lineas || [];
  return {
    skus: arr.length,
    piezas: arr.reduce((s, l) => s + N(l.piezas), 0),
    total: arr.reduce((s, l) => s + N(l.piezas) * N(l.precio), 0),
  };
}

// ── Fila ⇄ modelo ──
export function filaAModelo(r) {
  const lineas = Array.isArray(r.lineas) && r.lineas.length
    ? r.lineas
    : lineasDesdeMapa(r.propuesta || {});
  return {
    id: r.id,
    clienteKey: r.cliente_key,
    clienteLabel: r.cliente_label,
    nombre: (r.nombre || '').trim(),
    estado: normalizarEstado(r.estado),
    tstamp: N(r.tstamp) || Date.parse(r.updated_at) || Date.now(),
    anio: r.anio || null,
    mes: r.mes || null,
    vigencia: r.vigencia ? String(r.vigencia).slice(0, 10) : null,
    lineas,
    resumen: r.resumen && r.resumen.skus != null ? r.resumen : resumenDe(lineas),
    excelFinal: r.excel_final || null,
    exportedFilename: r.exported_filename || null,
    origen: r.origen || null,
    ultimaImportacion: r.ultima_importacion || null,
    enviadaAt: r.enviada_at || null,
    cerradaAt: r.cerrada_at || null,
    folio: r.folio || null,
    creadoPor: r.creado_por || null,
    updatedAt: r.updated_at || null,
  };
}
export function modeloAFila(m) {
  const lineas = m.lineas || [];
  const fila = {
    id: m.id || nuevaPropuestaId(),
    cliente_key: m.clienteKey,
    cliente_label: m.clienteLabel || null,
    nombre: (m.nombre || '').trim(),
    estado: normalizarEstado(m.estado),
    tstamp: m.tstamp || Date.now(),
    anio: m.anio || null,
    mes: m.mes || null,
    vigencia: m.vigencia || null,
    lineas,
    resumen: { ...resumenDe(lineas), ...(m.resumen?.mes ? { mes: m.resumen.mes } : {}) },
    excel_final: m.excelFinal || null,
    exported_filename: m.exportedFilename || null,
    origen: m.origen || null,
    ultima_importacion: m.ultimaImportacion || null,
    updated_at: new Date().toISOString(),
  };
  if (m.enviadaAt) fila.enviada_at = m.enviadaAt;
  if (m.cerradaAt) fila.cerrada_at = m.cerradaAt;
  if (m.folio) fila.folio = m.folio;
  if (m.creadoPor) fila.creado_por = m.creadoPor;
  return fila;
}

// ── Lecturas / escrituras ──
export async function listarPropuestas({ limit = 200, clienteKey = null } = {}) {
  let q = supabase.from('propuestas_borradores').select(SELECT_PROPUESTA).order('tstamp', { ascending: false }).limit(limit);
  if (clienteKey) q = q.eq('cliente_key', clienteKey);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(filaAModelo);
}
export async function obtenerPropuesta(id) {
  const { data, error } = await supabase.from('propuestas_borradores').select(SELECT_PROPUESTA).eq('id', id).single();
  if (error) throw error;
  return filaAModelo(data);
}
/** Upsert completo del modelo. Devuelve el modelo tal como quedó en la base (con folio/sellos del trigger). */
export async function guardarPropuesta(modelo) {
  const fila = modeloAFila(modelo);
  const { data, error } = await supabase.from('propuestas_borradores').upsert(fila, { onConflict: 'id' }).select(SELECT_PROPUESTA).single();
  if (error) throw error;
  return filaAModelo(data);
}
/** Update parcial (patch en snake_case). */
export async function actualizarPropuesta(id, patch) {
  const { data, error } = await supabase.from('propuestas_borradores').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select(SELECT_PROPUESTA).single();
  if (error) throw error;
  return filaAModelo(data);
}
export async function eliminarPropuesta(id) {
  const { error } = await supabase.from('propuestas_borradores').delete().eq('id', id);
  if (error) throw error;
}
/** Marca enviada (si estaba en borrador). Idempotente: una cerrada no regresa a enviada. */
export async function marcarEnviada(modelo, extra = {}) {
  if (modelo.estado === 'cerrada') return extra.exported_filename ? actualizarPropuesta(modelo.id, extra) : modelo;
  return actualizarPropuesta(modelo.id, { estado: 'enviada', ...extra });
}

// ── Migración única de los recientes que vivían en localStorage (formato pre-V3) ──
// Se ejecuta al primer arranque de la landing: sube a la base lo que no exista allá y borra la llave local.
export async function migrarRecientesLocales(remotos) {
  let locales = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LEGACY);
    if (!raw) return { migrados: 0 };
    const arr = JSON.parse(raw);
    locales = Array.isArray(arr) ? arr : [];
  } catch { return { migrados: 0 }; }
  const ids = new Set((remotos || []).map((r) => r.id));
  const pendientes = locales.filter((r) => r?.id && r.clienteKey && !ids.has(r.id));
  let migrados = 0;
  for (const r of pendientes) {
    try {
      const lineas = lineasDesdeMapa(r.propuesta || {});
      await guardarPropuesta({
        id: r.id, clienteKey: r.clienteKey, clienteLabel: r.clienteLabel, nombre: r.nombre, estado: normalizarEstado(r.estado),
        tstamp: r.tstamp, lineas, excelFinal: r.excelFinal || null, exportedFilename: r.exportedFilename || null,
        origen: r.origen || 'recientes locales', ultimaImportacion: r.ultimaImportacion || null,
      });
      migrados += 1;
    } catch (e) { console.warn('[Propuestas] no se pudo migrar reciente local', r.id, e); }
  }
  try { localStorage.removeItem(STORAGE_KEY_LEGACY); } catch {}
  return { migrados };
}
