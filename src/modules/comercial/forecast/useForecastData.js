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
  facturacionMes: [],
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

  // 2026-10-02: 5000 por página (facturacion_clientes eran 28 páginas de 1000 = 28 peticiones + count).
  const fetchAll = (qFactory, pageSize = 5000) => fetchAllQ(qFactory, { pageSize, label: 'sop' });

  const reload = async () => {
    setState((s) => ({ ...s, loading: true }));
    const hoy = new Date();
    const anioActual = hoy.getFullYear();
    const anioCorte = new Date(hoy.getFullYear(), hoy.getMonth() - 6, 1).getFullYear();
    // Ventana de 12 meses (mes actual incluido) para la demanda real del drill.
    const ini12 = new Date(hoy.getFullYear(), hoy.getMonth() - 11, 1);
    const filtro12m = `anio.gt.${ini12.getFullYear()},and(anio.eq.${ini12.getFullYear()},mes.gte.${ini12.getMonth() + 1})`;
    // 2026-11-18 (rendimiento): por cliente sólo los 6 meses que usa el motor; el total mensual de 12 meses del
    // drill sale de v_facturacion_sku_mes (≈ 9 K filas angostas en vez de 30 K con nombre de cliente).
    const ini6 = new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1);
    const filtro6m = `anio.gt.${ini6.getFullYear()},and(anio.eq.${ini6.getFullYear()},mes.gte.${ini6.getMonth() + 1})`;

    // 2026-10-02 (rendimiento, auditoría campo por campo): sólo las columnas que leen calculo.js y los paneles;
    // v_demanda_sku sólo digitalife/pcel (los demás se descartaban en calculo.js:264); embarques_compras acotado a
    // 36 meses de emisión (piezasPorContenedor sale de la última PO confirmada) o arribo reciente; sin las
    // consultas que nadie consumía (sugeridos_compra, solicitudes_compra*, cuotas_mensuales).
    const hace36m = new Date(hoy.getFullYear(), hoy.getMonth() - 36, 1).toISOString().slice(0, 10);
    const hace1m = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1).toISOString().slice(0, 10);
    const vacio = Promise.resolve({ data: [] });
    const queries = await Promise.all([
      fetchAll(() => supabase.from('v_inventario_comercial').select('sku,inventario,disponible'), 5000).then((d) => ({ data: d })),
      fetchAll(() => supabase.from('v_transito_sku').select('sku,cantidad,eta_mas_cercana,embarques_detalle'), 5000).then((d) => ({ data: d })),
      supabase.from('v_lead_time_sku').select('sku,dias_promedio,muestras,supplier_principal,familia'),
      fetchAll(() => supabase.from('v_sku_metadata').select('sku,descripcion,supplier,familia,unit_price_usd_ultima,costo_promedio_mxn'), 5000).then((d) => ({ data: d })),
      fetchAll(() => supabase.from('v_demanda_sku').select('sku,anio,mes,cliente,piezas').gte('anio', anioCorte).in('cliente', ['digitalife', 'pcel'])),
      vacio,
      fetchAll(() => supabase.from('v_skus_producto').select('sku,descripcion,rdmp,marca,familia,en_roadmap').eq('activo', true), 5000).then((d) => ({ data: d })),
      // Master de embarques completo (timeline tránsito + histórico de compras). La tabla no tiene `eta` ni
      // `marca`: se usa eta_puerto / arribo_almacen y la marca sale de v_sku_metadata.
      // OJO: en supabase-js `.or()` va DESPUÉS de `.select()` (from() no tiene .or: tiraba «.or is not a function» y el S&OP no cargaba).
      fetchAll(() => supabase.from('embarques_compras')
        .select('po, codigo, fecha_emision, arribo_cedis, arribo_almacen, eta_puerto, po_qty, shp_qty, cbm, cbm_unitario, contenedor, estatus, supplier, familia, descripcion, unit_price, lt_dias, tipo_carga, tipo_contenedor, grupo')
        .or(`fecha_emision.gte.${hace36m},arribo_cedis.gte.${hace1m},arribo_almacen.gte.${hace1m},eta_puerto.gte.${hace1m}`)),
      vacio, // solicitudes_compra: las lee useSolicitudes (la copia de aquí no se usaba)
      vacio, // solicitudes_compra_lineas: ídem
      supabase.from('reporte_skus').select('sku, orden').eq('activo', true).order('orden'),
      vacio, // cuotas_mensuales: sólo las leía NecesidadCard (sin uso)
      fetchAll(() => supabase.from('facturacion_clientes')
        .select('sku, cliente_nombre, canal, anio, mes, piezas')
        .or(filtro6m)),
      supabase.from('programacion_arribos')
        .select('contenedor, terminal, cita, arribo_almacen, linea_transportista, dias_demoras'),
      fetchAll(() => supabase.from('catalogo_articulos').select('articulo, descripcion')),
      supabase.from('sku_config').select('sku, es_critico, meses_seguridad, crecimiento_override')
        .then((r) => r, () => ({ data: [] })),
      fetchAll(() => supabase.from('v_compras_pendientes_sku')
        .select('sku, descripcion, proveedor, po, fecha_po, piezas_pedidas, piezas_pendientes, usd_pendiente, eta, en_master_embarques, dias_desde_po'))
        .then((r) => r, () => []),
      supabase.from('v_compras_pendientes_proveedor').select('proveedor,pos,skus,piezas_pendientes,usd_pendiente,po_mas_antigua,dias_po_mas_antigua,eta_mas_cercana,renglones_sin_embarque').order('usd_pendiente', { ascending: false })
        .then((r) => r, () => ({ data: [] })),
      fetchAll(() => supabase.from('v_facturacion_sku_mes').select('sku, anio, mes, piezas').or(filtro12m)).then((r) => r, () => []),
    ]);

    const [invRes, traRes, ltRes, metaRes, demData, sugRes, rmRes, embData, solRes, solLinRes, rsRes, cmRes, facData, paRes, catArtData, skuCfgRes, cpData, cpProvRes, facMesData] = queries;

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
      facturacionMes: facMesData || [],
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
