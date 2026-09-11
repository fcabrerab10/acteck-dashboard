// Tracking Pedidos V3 · capa de datos.
// Las tablas oc_* las escribe la app → se leen sin cachedQuery (fetchPaged directo) y tras cada escritura se llama
// invalidateDataCache() + refetch de ['tracking']. El ERP (v_erp_facturas_oc, v_transito_sku, v_inventario_comercial,
// roadmap_sku) sí va por fetchAll/fetchAllQ (cache 5 min).
// Al cargar se llama la RPC oc_sincronizar_erp() (idempotente): liga facturas y guías del ERP a las OCs.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { queryClient } from '../../../lib/queryClient';
import { fetchAll, fetchAllQ, fetchPaged, invalidateDataCache } from '../../../lib/queries';
import { isoDia } from './textos';

const KEY = ['tracking', 'datos'];
const hoyMenos = (d) => isoDia(new Date(Date.now() - d * 86400000));

/** Lectura completa de una tabla escrita por la app (sin cache). */
function leer(table, select = '*', extra = (q) => q, orderCol = 'created_at') {
  return fetchPaged((from, to, withCount) => extra(supabase.from(table).select(select, withCount ? { count: 'exact' } : undefined).order(orderCol, { ascending: true }).range(from, to)), { label: table });
}

export async function cargarTodo() {
  let sync = null;
  try { const { data, error } = await supabase.rpc('oc_sincronizar_erp'); sync = error ? { error: error.message } : data; }
  catch (e) { sync = { error: String(e?.message || e) }; }
  const [ocs, ocSkus, envios, envioSkus, cotizaciones, facturas, facturaSkus, erpFacturas, transitoRows, stockRows, roadmapRows, almacenes] = await Promise.all([
    leer('oc_clientes'),
    leer('oc_clientes_skus'),
    leer('oc_envios'),
    leer('oc_envio_skus'),
    leer('oc_cotizaciones'),
    leer('oc_facturas'),
    leer('oc_factura_skus'),
    fetchAllQ(() => supabase.from('v_erp_facturas_oc').select('cliente_key,folio,referencia,fecha,piezas,monto,n_partidas,partidas').gte('fecha', hoyMenos(60)), { orderCol: 'folio', label: 'v_erp_facturas_oc' }),
    fetchAll('v_transito_sku', 'sku,cantidad,eta_mas_cercana,embarques_detalle', (q) => q.gt('cantidad', 0)),
    fetchAll('v_inventario_comercial', 'sku,disponible,por_almacen'),
    fetchAll('roadmap_sku', 'sku,descripcion,marca,familia'),
    fetchAll('almacenes_config', 'no_almacen,cedis'),
  ]);
  const cedisDe = new Map((almacenes || []).map((a) => [String(a.no_almacen), /GUADALAJARA/i.test(a.cedis || '') ? 'GDL' : /MEXICO/i.test(a.cedis || '') ? 'CDMX' : null]));
  const transito = new Map();
  for (const t of transitoRows || []) {
    const det = Array.isArray(t.embarques_detalle) ? [...t.embarques_detalle].sort((a, b) => String(a.eta || '').localeCompare(String(b.eta || ''))) : [];
    transito.set(t.sku, { cantidad: Number(t.cantidad) || 0, eta: t.eta_mas_cercana || det[0]?.eta || null, po: det[0]?.po || null });
  }
  const stock = new Map();
  for (const s of stockRows || []) {
    const porAlmacen = {};
    for (const [alm, v] of Object.entries(s.por_almacen || {})) { const c = cedisDe.get(String(alm)); if (c) porAlmacen[c] = (porAlmacen[c] || 0) + (Number(v) || 0); }
    stock.set(s.sku, { disponible: Number(s.disponible) || 0, porAlmacen });
  }
  const roadmap = new Map((roadmapRows || []).map((r) => [r.sku, r]));
  return { sync, ocs, ocSkus, envios, envioSkus, cotizaciones, facturas, facturaSkus, erpFacturas: erpFacturas || [], transito, stock, roadmap, roadmapRows: roadmapRows || [], cargadoAt: new Date().toISOString() };
}

export function useTrackingDatos() {
  return useQuery({ queryKey: KEY, queryFn: cargarTodo, staleTime: 60 * 1000, refetchOnWindowFocus: false });
}

/** Tras escribir: invalida la cache central y recarga esta pantalla (vuelve a correr la RPC). */
export async function recargar() {
  await invalidateDataCache();
  return queryClient.invalidateQueries({ queryKey: ['tracking'] });
}

const lanzar = (r) => { if (r?.error) throw new Error(r.error.message || String(r.error)); return r?.data; };
const sinVacio = (v) => (v === '' || v === undefined ? null : v);

// ── Escrituras ──
/** Crea o actualiza una OC con sus SKUs. `oc` = { id?, cliente_key, numero_oc_cliente, fecha_recibida, facturas[], notas, fuente, cotizacion_id }, skus = [{ sku, cantidad_ordenada, precio_unitario }]. */
export async function guardarOC(oc, skus, email) {
  const fila = {
    cliente_key: oc.cliente_key, numero_oc_cliente: String(oc.numero_oc_cliente || '').trim(), fecha_recibida: sinVacio(oc.fecha_recibida),
    facturas: (oc.facturas || []).map((f) => String(f).trim()).filter(Boolean), notas: sinVacio(oc.notas), fuente: oc.fuente || 'manual', cotizacion_id: oc.cotizacion_id || null,
    numero_factura: (oc.facturas || [])[0] || null, updated_at: new Date().toISOString(),
  };
  let id = oc.id;
  if (id) lanzar(await supabase.from('oc_clientes').update(fila).eq('id', id));
  else {
    const data = lanzar(await supabase.from('oc_clientes').insert({ ...fila, created_by: email || null }).select('id').single());
    id = data.id;
  }
  // SKUs: diff por sku (conserva los ids existentes para no romper oc_envio_skus).
  const actuales = lanzar(await supabase.from('oc_clientes_skus').select('id,sku,cantidad_ordenada,precio_unitario').eq('oc_id', id)) || [];
  const porSku = new Map(actuales.map((s) => [String(s.sku).toUpperCase(), s]));
  const nuevos = new Map();
  for (const s of skus || []) {
    const k = String(s.sku || '').trim().toUpperCase();
    if (!k) continue;
    const prev = nuevos.get(k) || { sku: k, cantidad_ordenada: 0, precio_unitario: 0 };
    prev.cantidad_ordenada += Number(s.cantidad_ordenada) || 0; prev.precio_unitario = Number(s.precio_unitario) || prev.precio_unitario;
    nuevos.set(k, prev);
  }
  const inserts = [], updates = [], borrar = [];
  for (const [k, s] of nuevos) {
    const a = porSku.get(k);
    if (!a) inserts.push({ oc_id: id, ...s });
    else if (Number(a.cantidad_ordenada) !== s.cantidad_ordenada || Number(a.precio_unitario) !== s.precio_unitario) updates.push({ id: a.id, ...s });
  }
  for (const [k, a] of porSku) if (!nuevos.has(k)) borrar.push(a.id);
  if (inserts.length) lanzar(await supabase.from('oc_clientes_skus').insert(inserts));
  for (const u of updates) lanzar(await supabase.from('oc_clientes_skus').update({ cantidad_ordenada: u.cantidad_ordenada, precio_unitario: u.precio_unitario }).eq('id', u.id));
  if (borrar.length) lanzar(await supabase.from('oc_clientes_skus').delete().in('id', borrar));
  if (oc.cotizacion_id) lanzar(await supabase.from('oc_cotizaciones').update({ oc_id: id, estado: 'aceptada', fecha_respuesta: fila.fecha_recibida || new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', oc.cotizacion_id));
  await recargar();
  return id;
}

/** Añade folios de factura capturados a mano a una OC (la RPC los liga al recargar). */
export async function ligarFacturaAOC(ocId, folios, facturasActuales = []) {
  const set = new Set([...(facturasActuales || []), ...folios.map((f) => String(f).trim()).filter(Boolean)]);
  lanzar(await supabase.from('oc_clientes').update({ facturas: [...set], numero_factura: [...set][0] || null, updated_at: new Date().toISOString() }).eq('id', ocId));
  await recargar();
}

/** "Crear OC desde factura": OC con las partidas de la factura del ERP como pedido. */
export async function crearOCDesdeFactura(f, email) {
  const numero = (f.referencia && !/^sin\s+orden/i.test(f.referencia)) ? String(f.referencia).trim() : f.folio;
  const skus = (f.partidas || []).map((p) => ({ sku: p.sku, cantidad_ordenada: Number(p.piezas) || 0, precio_unitario: Number(p.piezas) ? (Number(p.monto) || 0) / Number(p.piezas) : 0 }));
  return guardarOC({ cliente_key: f.cliente_key, numero_oc_cliente: numero, fecha_recibida: f.fecha, facturas: [f.folio], fuente: 'factura', notas: `Creada desde la factura ${f.folio} (referencia ${f.referencia || '—'})` }, skus, email);
}

/** Envío manual: { id?, oc_id, almacen_origen, paqueteria, guia_rastreo, fecha_surtida, fecha_entregada, persona_recibio, numero_factura, notas }. */
export async function guardarEnvio(e) {
  const fila = {
    oc_id: e.oc_id, almacen_origen: sinVacio(e.almacen_origen), paqueteria: sinVacio(e.paqueteria), guia_rastreo: sinVacio(e.guia_rastreo),
    metodo_envio: e.paqueteria === 'Unidad propia' ? 'unidad_propia' : (e.paqueteria ? 'paqueteria' : null),
    fecha_surtida: sinVacio(e.fecha_surtida), fecha_entregada: sinVacio(e.fecha_entregada), persona_recibio: sinVacio(e.persona_recibio),
    numero_factura: sinVacio(e.numero_factura), notas: sinVacio(e.notas), updated_at: new Date().toISOString(),
  };
  if (e.id) lanzar(await supabase.from('oc_envios').update(fila).eq('id', e.id));
  else {
    const prev = lanzar(await supabase.from('oc_envios').select('numero_envio').eq('oc_id', e.oc_id).order('numero_envio', { ascending: false }).limit(1));
    const numero_envio = (Number(prev?.[0]?.numero_envio) || 0) + 1;
    lanzar(await supabase.from('oc_envios').insert({ ...fila, numero_envio, fuente: 'manual' }));
  }
  await recargar();
}

/** Desfase manual/ERP: guarda cuál fecha vale. */
export async function elegirFechaEnvio(envioId, eleccion) {
  lanzar(await supabase.from('oc_envios').update({ fecha_elegida: eleccion, updated_at: new Date().toISOString() }).eq('id', envioId));
  await recargar();
}

/** Cotización: { id?, cliente_key, folio, fecha_solicitada, fecha_enviada, fecha_respuesta, estado, motivo_perdida, monto, piezas, notas }. */
export async function guardarCotizacion(c, email) {
  const fila = {
    cliente_key: c.cliente_key, folio: sinVacio(c.folio), fecha_solicitada: sinVacio(c.fecha_solicitada), fecha_enviada: sinVacio(c.fecha_enviada), fecha_respuesta: sinVacio(c.fecha_respuesta),
    estado: c.estado || 'solicitada', motivo_perdida: c.estado === 'perdida' ? sinVacio(c.motivo_perdida) : null, monto: c.monto === '' || c.monto == null ? null : Number(c.monto),
    piezas: c.piezas === '' || c.piezas == null ? null : Number(c.piezas), notas: sinVacio(c.notas), updated_at: new Date().toISOString(),
  };
  let id = c.id;
  if (id) lanzar(await supabase.from('oc_cotizaciones').update(fila).eq('id', id));
  else { const d = lanzar(await supabase.from('oc_cotizaciones').insert({ ...fila, created_by: email || null }).select('id').single()); id = d.id; }
  await recargar();
  return id;
}
