// Forecast › Reservas · capa de datos (React Query + helpers de lib/queries.js).
//
// Datos base (roadmap, sell-out, arribos, inventarios): fetchAll/fetchAllQ con cache central 5 min.
// Propuestas, líneas y forecast_crm los ESCRIBE la app → se leen con supabase directo dentro de
// useQuery con staleTime corto y se invalidan tras cada escritura (regla de CLAUDE.md · Rendimiento).
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { fetchAll, fetchAllQ, cachedQuery } from '../../../lib/queries';
import { queryClient } from '../../../lib/queryClient';
import { indexarSellout, normalizarPcel, agruparArribos } from './calculo';

const SELECT_LINEA = 'id, propuesta_id, sku, descripcion, marca, familia, roadmap, necesidad_dgl, necesidad_pce, necesidad_dct, recomendado, reservo, confirmado, estado, arribos_snapshot, notas, updated_at, crm_subido_at, crm_subido_por, comprado_at, comprado_por, fecha_arribo_estimada, piezas_a_reservar_arribo';

// ─── Stock del cliente (inventario_cliente: última semana cargada por cliente) ───
async function stockCliente(ck) {
  const { data: ult } = await cachedQuery(
    supabase.from('inventario_cliente').select('anio,semana').eq('cliente', ck).not('anio', 'is', null)
      .order('anio', { ascending: false }).order('semana', { ascending: false }).limit(1),
  );
  const u = ult?.[0];
  if (!u) return { map: new Map(), meta: null };
  const rows = await fetchAllQ(() => supabase.from('inventario_cliente').select('sku,stock').eq('cliente', ck).eq('anio', u.anio).eq('semana', u.semana), { orderCol: 'sku', label: 'inventario_cliente' });
  const map = new Map();
  for (const r of rows || []) if (r.sku) map.set(r.sku, (map.get(r.sku) || 0) + (Number(r.stock) || 0));
  return { map, meta: { anio: u.anio, semana: u.semana } };
}

/** Datos base de la pantalla (un solo useQuery; cada fuente tolera fallo). */
export function useBaseReservas(hoy) {
  const anio = hoy.getFullYear();
  return useQuery({
    queryKey: ['reservas', 'base', anio],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const anioMin = anio - 2;
      const tolerante = (p, nombre) => p.catch((e) => { console.error(`${nombre}:`, e); return []; });
      const [roadmap, soRows, pcelRows, embRows, invRows, stDgl, stDct] = await Promise.all([
        fetchAll('roadmap_sku', 'sku,descripcion,marca,familia,rdmp,sort_order'),
        tolerante(fetchAllQ(() => supabase.from('sellout_sku').select('cliente,anio,mes,sku,piezas').gte('anio', anioMin), { orderCol: 'id', label: 'sellout_sku' }), 'sellout_sku'),
        tolerante(fetchAllQ(() => supabase.from('sellout_pcel').select('anio,semana,sku,inventario,vta_mes_1,vta_mes_1_nombre,vta_mes_2,vta_mes_2_nombre,vta_mes_3,vta_mes_3_nombre').gte('anio', anio - 1), { orderCol: 'id', label: 'sellout_pcel' }), 'sellout_pcel'),
        tolerante(fetchAllQ(() => supabase.from('embarques_compras').select('codigo,po,arribo_almacen,arribo_cedis,eta_puerto,po_qty,shp_qty,contenedor,estatus'), { orderCol: 'id', label: 'embarques_compras' }), 'embarques_compras'),
        tolerante(fetchAllQ(() => supabase.from('inventario_acteck').select('articulo,inventario'), { orderCol: 'articulo', label: 'inventario_acteck' }), 'inventario_acteck'),
        stockCliente('digitalife').catch(() => ({ map: new Map(), meta: null })),
        stockCliente('dicotech').catch(() => ({ map: new Map(), meta: null })),
      ]);
      const pcel = normalizarPcel(pcelRows);
      const sellout = indexarSellout([...(soRows || []), ...pcel.ventas]);
      const inventarioPorSku = new Map();
      for (const r of invRows || []) if (r.articulo) inventarioPorSku.set(r.articulo, (inventarioPorSku.get(r.articulo) || 0) + (Number(r.inventario) || 0));
      return {
        roadmap: roadmap || [],
        sellout,
        embarques: embRows || [],
        arribos: agruparArribos(embRows || [], hoy),
        inventarioPorSku,
        stockClientes: { digitalife: stDgl.map, dicotech: stDct.map, pcel: pcel.stock },
        stockMeta: { digitalife: stDgl.meta, dicotech: stDct.meta, pcel: pcel.meta },
      };
    },
  });
}

// ─── Propuesta activa (borrador del usuario) + líneas ───
export function usePropuestaActiva(yoId) {
  return useQuery({
    queryKey: ['reservas', 'propuesta', yoId],
    enabled: !!yoId,
    staleTime: 0,
    queryFn: async () => {
      const { data: p, error } = await supabase.from('forecast_propuestas').select('*')
        .eq('creado_por', yoId).eq('estatus', 'borrador').order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      if (!p) return { propuesta: null, lineas: {} };
      const { data: lin, error: e2 } = await supabase.from('forecast_propuesta_lineas').select(SELECT_LINEA).eq('propuesta_id', p.id);
      if (e2) throw e2;
      const lineas = {};
      for (const l of lin || []) lineas[l.sku] = l;
      return { propuesta: p, lineas };
    },
  });
}
export const invalidarPropuesta = () => queryClient.invalidateQueries({ queryKey: ['reservas', 'propuesta'] });
export const invalidarLanding = () => queryClient.invalidateQueries({ queryKey: ['reservas', 'landing'] });
export const invalidarDrill = (sku) => queryClient.invalidateQueries({ queryKey: ['reservas', 'drill', sku] });

/** Propuestas generadas/cerradas con sus líneas (landing). */
export function useLanding() {
  return useQuery({
    queryKey: ['reservas', 'landing'],
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('forecast_propuestas')
        .select(`*, forecast_propuesta_lineas(${SELECT_LINEA})`)
        .neq('estatus', 'borrador')
        .order('generado_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data || [];
    },
  });
}

// ─── Escrituras de la propuesta ───
export async function crearPropuesta({ nombre, anio, mes, yoId }) {
  const { data, error } = await supabase.from('forecast_propuestas')
    .insert({ nombre, estatus: 'borrador', meta_anio: anio, meta_mes: mes, creado_por: yoId }).select().single();
  if (error) throw error;
  return data;
}
export async function upsertLineaDB(payload) {
  const { data, error } = await supabase.from('forecast_propuesta_lineas').upsert(payload, { onConflict: 'propuesta_id,sku' }).select(SELECT_LINEA).single();
  if (error) throw error;
  return data;
}
export async function eliminarLineaDB(id) {
  const { error } = await supabase.from('forecast_propuesta_lineas').delete().eq('id', id);
  if (error) throw error;
}
export async function actualizarPropuestaDB(id, patch) {
  const { error } = await supabase.from('forecast_propuestas').update(patch).eq('id', id);
  if (error) throw error;
}
export async function actualizarLineasDB(propuestaId, filtro, patch) {
  let q = supabase.from('forecast_propuesta_lineas').update(patch).eq('propuesta_id', propuestaId);
  if (filtro?.estado) q = q.eq('estado', filtro.estado);
  const { error } = await q;
  if (error) throw error;
}
export async function actualizarLineaDB(id, patch) {
  const { error } = await supabase.from('forecast_propuesta_lineas').update(patch).eq('id', id);
  if (error) throw error;
}
export async function vaciarLineasDB(propuestaId) {
  const { error } = await supabase.from('forecast_propuesta_lineas').delete().eq('propuesta_id', propuestaId);
  if (error) throw error;
}
export async function eliminarPropuestaDB(id) {
  const { error } = await supabase.from('forecast_propuestas').delete().eq('id', id);
  if (error) throw error;
}

// ─── Drill del SKU (carga sólo al abrir) ───
export function useDrillSku(sku) {
  return useQuery({
    queryKey: ['reservas', 'drill', sku],
    enabled: !!sku,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const [tr, lin] = await Promise.all([
        cachedQuery(supabase.from('v_transito_sku').select('sku,cantidad,eta_mas_cercana,eta_mas_lejana,embarques,embarques_detalle').eq('sku', sku).maybeSingle()),
        supabase.from('forecast_propuesta_lineas')
          .select('id,propuesta_id,reservo,confirmado,estado,comprado_at,fecha_arribo_estimada,piezas_a_reservar_arribo,updated_at,forecast_propuestas(nombre,estatus,generado_at,created_at)')
          .eq('sku', sku).order('updated_at', { ascending: false }).limit(30),
      ]);
      return { transito: tr.data || null, reservas: lin.data || [] };
    },
  });
}

// ─── Forecast CRM ───
export function useForecastCrm(clienteKey) {
  return useQuery({
    queryKey: ['forecast_crm', clienteKey],
    enabled: !!clienteKey,
    staleTime: 0,
    queryFn: async () => {
      const rows = await fetchAllQ(() => supabase.from('forecast_crm').select('id,cliente_key,cliente_codigo,cliente_nombre,tipo,sku,anio,mes,piezas,justificacion,estado,lote_id,updated_at').eq('cliente_key', clienteKey), { orderCol: 'id', label: 'forecast_crm' });
      return rows || [];
    },
  });
}
export const invalidarCrm = (ck) => queryClient.invalidateQueries({ queryKey: ck ? ['forecast_crm', ck] : ['forecast_crm'] });
export const invalidarLotes = () => queryClient.invalidateQueries({ queryKey: ['forecast_crm_lotes'] });

export async function upsertCrmDB(rows) {
  if (!rows.length) return;
  const { error } = await supabase.from('forecast_crm').upsert(rows, { onConflict: 'cliente_key,sku,anio,mes' });
  if (error) throw error;
}
export async function borrarCrmDB(ids) {
  if (!ids.length) return;
  const { error } = await supabase.from('forecast_crm').delete().in('id', ids);
  if (error) throw error;
}
export async function crearLoteDB({ mesInicio, meses, clientes, filas, archivoNombre, yoId }) {
  const { data, error } = await supabase.from('forecast_crm_lotes')
    .insert({ mes_inicio: `${mesInicio}-01`, meses, clientes, filas, archivo_nombre: archivoNombre, creado_por: yoId }).select().single();
  if (error) throw error;
  return data;
}
export async function marcarExportadoDB(ids, loteId, extra = {}) {
  if (!ids.length) return;
  const { error } = await supabase.from('forecast_crm').update({ ...extra, estado: 'exportado', lote_id: loteId }).in('id', ids);
  if (error) throw error;
}
export function useLotesCrm() {
  return useQuery({
    queryKey: ['forecast_crm_lotes'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('forecast_crm_lotes').select('*').order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data || [];
    },
  });
}
export async function filasDeLoteDB(loteId) {
  const rows = await fetchAllQ(() => supabase.from('forecast_crm').select('cliente_key,cliente_codigo,cliente_nombre,tipo,sku,anio,mes,piezas,justificacion').eq('lote_id', loteId), { orderCol: 'id', label: 'forecast_crm' });
  return rows || [];
}
