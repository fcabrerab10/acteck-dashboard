// useForecastData — carga de datos del S&OP (escritorio). Extraído de ForecastClientesTab.jsx (V3).
// Todo pasa por src/lib/queries.js (fetchAllQ paralelo + cache 5 min). Devuelve exactamente el `data`
// que espera calcularForecast (forecast/calculo.js) más lo que usan el drill y las tarjetas secundarias.
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { fetchAllQ } from '../../../lib/queries';

const ESTADO_INICIAL = {
  loading: true,
  inventario: [],
  transito: [],
  leadTimes: [],
  metadata: [],
  demanda: [],
  sugeridosPendientes: [],
  roadmap: [],
  embarques: [],
  solicitudes: [],
  solicitudLineas: [],
  // Whitelist activa de SKUs del Reporte de Resumen Clientes — los únicos SKUs de la tabla (mismo orden).
  reporteSkus: [],
  cuotas: [],
  // Facturación por cliente (facturacion_clientes, reconstruida del ERP): 12 meses para el drill
  // (demanda real vs forecast); el motor sólo usa los últimos 6.
  facturacion: [],
  // Logística por contenedor (Master Embarques · "Programación Arribos").
  progArribos: [],
  // Catálogo maestro de artículos (fallback de descripción).
  catalogoArticulos: [],
  // Configuración por SKU (crítico, meses seguridad, %crecimiento override).
  skuConfig: [],
  // Compras en camino (v_compras_pendientes_sku / _proveedor · tabla compras_oc del ERP):
  // POs colocadas al proveedor con pendiente > 0. Informativo — no entra en el sugerido.
  comprasPendientes: [],
  comprasPendientesProveedor: [],
};

export function useForecastData() {
  const [state, setState] = useState(ESTADO_INICIAL);

  const fetchAll = (qFactory, pageSize = 1000) => fetchAllQ(qFactory, { pageSize, label: 'sop' });

  const reload = async () => {
    setState((s) => ({ ...s, loading: true }));
    const hoy = new Date();
    const anioActual = hoy.getFullYear();
    const anioCorte = new Date(hoy.getFullYear(), hoy.getMonth() - 6, 1).getFullYear();
    // Ventana de 12 meses (mes actual incluido) para la demanda real del drill.
    const ini12 = new Date(hoy.getFullYear(), hoy.getMonth() - 11, 1);
    const filtro12m = `anio.gt.${ini12.getFullYear()},and(anio.eq.${ini12.getFullYear()},mes.gte.${ini12.getMonth() + 1})`;

    const queries = await Promise.all([
      supabase.from('v_inventario_comercial').select('*'),
      supabase.from('v_transito_sku').select('*'),
      supabase.from('v_lead_time_sku').select('*'),
      supabase.from('v_sku_metadata').select('*'),
      fetchAll(() => supabase.from('v_demanda_sku').select('*').gte('anio', anioCorte)),
      supabase.from('sugeridos_compra').select('*').in('estado', ['pendiente', 'exportado']).order('created_at', { ascending: false }),
      supabase.from('roadmap_sku').select('*'),
      // Master de embarques completo (timeline tránsito + histórico de compras). La tabla no tiene `eta` ni
      // `marca`: se usa eta_puerto / arribo_almacen y la marca sale de v_sku_metadata.
      fetchAll(() => supabase.from('embarques_compras')
        .select('po, codigo, fecha_emision, arribo_cedis, arribo_almacen, eta_puerto, etd, po_qty, shp_qty, cbm, cbm_total, cbm_unitario, contenedor, estatus, supplier, familia, descripcion, unit_price, sn, lt_dias, tipo_carga, tipo_contenedor, grupo')),
      supabase.from('solicitudes_compra').select('*').eq('anio', anioActual)
        .order('fecha_creacion', { ascending: false })
        .then((r) => r, () => ({ data: [] })),
      supabase.from('solicitudes_compra_lineas').select('*')
        .order('orden', { ascending: true })
        .then((r) => r, () => ({ data: [] })),
      supabase.from('reporte_skus').select('sku, orden').eq('activo', true).order('orden'),
      supabase.from('cuotas_mensuales').select('cliente, anio, mes, cuota_min, cuota_ideal').gte('anio', anioActual - 1),
      fetchAll(() => supabase.from('facturacion_clientes')
        .select('sku, cliente_nombre, canal, anio, mes, piezas')
        .or(filtro12m)),
      supabase.from('programacion_arribos')
        .select('contenedor, terminal, cita, arribo_almacen, linea_transportista, dias_demoras, cedis, reconocimiento_a, profepa'),
      fetchAll(() => supabase.from('catalogo_articulos').select('articulo, descripcion')),
      supabase.from('sku_config').select('sku, es_critico, meses_seguridad, crecimiento_override, notas')
        .then((r) => r, () => ({ data: [] })),
      fetchAll(() => supabase.from('v_compras_pendientes_sku')
        .select('sku, descripcion, marca, proveedor, po, fecha_po, estatus, piezas_pedidas, piezas_recibidas, piezas_pendientes, usd_pendiente, eta, en_master_embarques, sku_en_transito, dias_desde_po'))
        .then((r) => r, () => []),
      supabase.from('v_compras_pendientes_proveedor').select('*').order('usd_pendiente', { ascending: false })
        .then((r) => r, () => ({ data: [] })),
    ]);

    const [invRes, traRes, ltRes, metaRes, demData, sugRes, rmRes, embData, solRes, solLinRes, rsRes, cmRes, facData, paRes, catArtData, skuCfgRes, cpData, cpProvRes] = queries;

    setState({
      loading: false,
      inventario: invRes.data || [],
      transito: traRes.data || [],
      leadTimes: ltRes.data || [],
      metadata: metaRes.data || [],
      demanda: demData || [],
      sugeridosPendientes: sugRes.data || [],
      roadmap: rmRes.data || [],
      embarques: embData || [],
      solicitudes: (solRes && solRes.data) || [],
      solicitudLineas: (solLinRes && solLinRes.data) || [],
      reporteSkus: rsRes.data || [],
      cuotas: cmRes.data || [],
      facturacion: facData || [],
      progArribos: (paRes && paRes.data) || [],
      catalogoArticulos: catArtData || [],
      skuConfig: (skuCfgRes && skuCfgRes.data) || [],
      comprasPendientes: cpData || [],
      comprasPendientesProveedor: (cpProvRes && cpProvRes.data) || [],
    });
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);
  return { ...state, reload };
}
