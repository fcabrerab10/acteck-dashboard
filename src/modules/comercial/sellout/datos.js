// Sell Out consolidado · acceso a datos (React Query sobre las MVs de
// supabase/migrations/20260912_sellout_global_*.sql). Sin dependencias de layout:
// la app móvil puede usar exactamente estos hooks.
//
// Lo que carga la pantalla al abrir (todo pequeño, ~9 K filas en total):
//   v_sellout_cuentas            17
//   mv_sellout_cuenta_dia     ~5.6 K   (MTD y YTD a mismo día)
//   v_sellout_cuenta_mes        264    (tabla: sell in, dimensiones, inventario)
//   mv_sellout_cuenta_sku_mes   ~3 K   (sólo el mes elegido y el del año anterior, para la composición)
//   mv_sellout_estado_mes       ~170   (sólo el mes elegido y el del año anterior, para el mapa)
//
// El drill pide lo suyo bajo demanda y sólo de su cuenta.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { cachedQuery, fetchAllQ } from '../../../lib/queries';

const STALE = 5 * 60 * 1000;
const q = (key, fn, extra = {}) => ({ queryKey: key, queryFn: fn, staleTime: STALE, ...extra });

/** Catálogo de las 17 cuentas + su código de cliente en el ERP (incluye las que no reportan sell out). */
export function useCuentas() {
  return useQuery(q(['sellout_global', 'cuentas'], async () => {
    const { data, error } = await cachedQuery(supabase.from('v_sellout_cuentas').select('*'));
    if (error) throw error;
    return data || [];
  }, { staleTime: 30 * 60 * 1000 }));
}

/** Años con sell out (para el selector multi-año). */
export function useAnios() {
  return useQuery(q(['sellout_global', 'anios'], async () => {
    const { data, error } = await cachedQuery(supabase.from('mv_sellout_cuenta_dia').select('anio'));
    if (error) throw error;
    return Array.from(new Set((data || []).map((r) => Number(r.anio)))).filter(Boolean).sort((a, b) => b - a);
  }, { staleTime: 30 * 60 * 1000 }));
}

/** Detalle diario por cuenta de los dos años (MTD / YTD "a mismo día"). */
export function useDias(anio) {
  return useQuery(q(['sellout_global', 'dias', anio], () => fetchAllQ(
    () => supabase.from('mv_sellout_cuenta_dia').select('cuenta,anio,mes,dia,importe,cantidad').in('anio', [anio - 1, anio]),
    { pageSize: 1000, orderCol: 'cuenta', label: 'mv_sellout_cuenta_dia' },
  ), { enabled: !!anio }));
}

const SELECT_MES = 'cuenta,nombre,canal_sellout,erp_cliente,propio,granularidad,anio,mes,importe,cantidad,'
  + 'sell_in,sell_in_piezas,clientes_finales,vendedores,sucursales,facturas,estados,importe_sin_estado,importe_sin_cliente,'
  + 'inv_valor,inv_piezas,inv_skus,inv_skus_sin_venta_30,inv_semana,'
  + 'cf_activos,cf_nuevos,cf_perdidos,cf_recompra_pct,cf_ticket,'
  + 'vend_activos,vend_nuevos,vend_perdidos,vend_recurrentes';

/** Una fila por cuenta y mes de los dos años: monto, sell in, dimensiones e inventario. */
export function useMensual(anio) {
  return useQuery(q(['sellout_global', 'mensual', anio], () => fetchAllQ(
    () => supabase.from('v_sellout_cuenta_mes').select(SELECT_MES).in('anio', [anio - 1, anio]),
    { pageSize: 1000, orderCol: 'cuenta', label: 'v_sellout_cuenta_mes' },
  ), { enabled: !!anio }));
}

/**
 * Cuota de sell in por cuenta y mes (v_cuota_erp_mes, mapa de
 * supabase/migrations/20260912_cuotas_clientes_mapa.sql). ~700 filas para dos años.
 */
export function useCuotas(anio) {
  return useQuery(q(['sellout_global', 'cuotas', anio], async () => {
    const { data, error } = await cachedQuery(
      supabase.from('v_cuota_erp_mes').select('cuota_cliente,cliente_erp,cuenta_sellout,anio,mes,cuota_venta,cuota_piezas')
        .in('anio', [anio - 1, anio]),
    );
    if (error) throw error;
    return data || [];
    // 5 min como el resto: la app puede editar cuotas_mensuales desde Sell In.
  }, { enabled: !!anio }));
}

/** SKU × cuenta del mes elegido y del mismo mes del año anterior (composición por marca / categoría). */
export function useSkuMes(anio, mes) {
  return useQuery(q(['sellout_global', 'sku_mes', anio, mes], () => fetchAllQ(
    () => supabase.from('mv_sellout_cuenta_sku_mes').select('cuenta,anio,mes,sku,marca,categoria,familia,importe,cantidad')
      .in('anio', [anio - 1, anio]).eq('mes', mes),
    { pageSize: 1000, orderCol: 'cuenta', label: 'mv_sellout_cuenta_sku_mes' },
  ), { enabled: !!anio && !!mes }));
}

/** Sell out por estado (mapa) del mes elegido y del mismo mes del año anterior. */
export function useEstadoMes(anio, mes) {
  return useQuery(q(['sellout_global', 'estado_mes', anio, mes], () => fetchAllQ(
    () => supabase.from('mv_sellout_estado_mes').select('cuenta,anio,mes,estado,importe,cantidad,clientes_finales,vendedores,facturas')
      .in('anio', [anio - 1, anio]).eq('mes', mes),
    { pageSize: 1000, orderCol: 'cuenta', label: 'mv_sellout_estado_mes' },
  ), { enabled: !!anio && !!mes }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Drill · una cuenta a la vez, bajo demanda
// ─────────────────────────────────────────────────────────────────────────────

/** SKU × mes de UNA cuenta, los dos años (pestañas Resumen y SKUs). */
export function useDrillSkus(cuenta, anio, enabled = true) {
  return useQuery(q(['sellout_global', 'drill_skus', cuenta, anio], () => fetchAllQ(
    () => supabase.from('mv_sellout_cuenta_sku_mes').select('anio,mes,sku,marca,categoria,familia,importe,cantidad').eq('cuenta', cuenta).in('anio', [anio - 1, anio]),
    { pageSize: 1000, orderCol: 'sku', label: 'drill_skus' },
  ), { enabled: enabled && !!cuenta && !!anio }));
}

/** Última foto del inventario en casa del cliente, por SKU (sólo digitalife, pcel y dicotech). */
export function useDrillInventario(cuenta, enabled = true) {
  return useQuery(q(['sellout_global', 'drill_inv', cuenta], () => fetchAllQ(
    () => supabase.from('v_sellout_inventario_cuenta_sku').select('cuenta,anio,semana,sku,marca,titulo,stock,valor,costo_convenio,precio_venta,dias_sin_venta,fecha_ultima_venta').eq('cuenta', cuenta),
    { pageSize: 1000, orderCol: 'sku', label: 'inv_cuenta_sku' },
  ), { enabled: enabled && !!cuenta }));
}

/** Stock al cierre de cada mes (pestaña Inventario del drill). */
export function useDrillInventarioMes(cuenta, enabled = true) {
  return useQuery(q(['sellout_global', 'drill_inv_mes', cuenta], async () => {
    const { data, error } = await cachedQuery(
      supabase.from('v_sellout_inventario_cuenta_mes').select('cuenta,anio,mes,semana,valor,piezas,skus_con_stock,skus_sin_venta_30').eq('cuenta', cuenta),
    );
    if (error) throw error;
    return data || [];
  }, { enabled: enabled && !!cuenta }));
}

/** Sucursales × mes de una cuenta. */
export function useDrillSucursales(cuenta, anio, enabled = true) {
  return useQuery(q(['sellout_global', 'drill_suc', cuenta, anio], () => fetchAllQ(
    () => supabase.from('mv_sellout_sucursal_mes').select('anio,mes,sucursal,importe,cantidad,vendedores,clientes,facturas,top_vendedor,estado').eq('cuenta', cuenta).in('anio', [anio - 1, anio]),
    { pageSize: 1000, orderCol: 'sucursal', label: 'sucursal_mes' },
  ), { enabled: enabled && !!cuenta && !!anio }));
}

/** Vendedores × mes de una cuenta. */
export function useDrillVendedores(cuenta, anio, enabled = true) {
  return useQuery(q(['sellout_global', 'drill_vend', cuenta, anio], () => fetchAllQ(
    () => supabase.from('mv_sellout_vendedor_mes').select('anio,mes,vendedor,importe,cantidad,clientes,skus,facturas,sucursal').eq('cuenta', cuenta).in('anio', [anio - 1, anio]),
    { pageSize: 1000, orderCol: 'vendedor', label: 'vendedor_mes' },
  ), { enabled: enabled && !!cuenta && !!anio }));
}

/** Clientes finales × mes de una cuenta (el mes elegido y el anterior; nuevos / perdidos). */
export function useDrillClientesFinales(cuenta, anio, mes, enabled = true) {
  return useQuery(q(['sellout_global', 'drill_cf', cuenta, anio, mes], async () => {
    const prev = mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 };
    return fetchAllQ(
      () => supabase.from('mv_sellout_cliente_final_mes').select('anio,mes,cliente_final,importe,cantidad,facturas,skus,estado')
        .eq('cuenta', cuenta).or(`and(anio.eq.${anio},mes.eq.${mes}),and(anio.eq.${prev.anio},mes.eq.${prev.mes}),and(anio.eq.${anio - 1},mes.eq.${mes})`),
      { pageSize: 1000, orderCol: 'cliente_final', label: 'cliente_final_mes' },
    );
  }, { enabled: enabled && !!cuenta && !!anio && !!mes }));
}

/** Estados de UNA cuenta (pestaña Mapa del drill). */
export function useDrillEstados(cuenta, anio, mes, enabled = true) {
  return useQuery(q(['sellout_global', 'drill_edo', cuenta, anio, mes], () => fetchAllQ(
    () => supabase.from('mv_sellout_estado_mes').select('cuenta,anio,mes,estado,importe,cantidad,clientes_finales,vendedores,facturas')
      .eq('cuenta', cuenta).in('anio', [anio - 1, anio]).eq('mes', mes),
    { pageSize: 1000, orderCol: 'estado', label: 'estado_mes_cuenta' },
  ), { enabled: enabled && !!cuenta && !!anio && !!mes }));
}

/**
 * Todo lo que necesita el bloque "Sell out" reutilizable (drill de Sell Out y
 * Análisis por Cliente): serie mensual, SKUs, inventario por SKU.
 */
export function useResumenCuenta(cuenta, anio, enabled = true) {
  const mensual = useMensual(enabled && cuenta ? anio : null);
  const skus = useDrillSkus(cuenta, anio, enabled);
  const inv = useDrillInventario(cuenta, enabled);
  return {
    mensual: (mensual.data || []).filter((r) => r.cuenta === cuenta),
    skus: skus.data || [],
    inventario: inv.data || [],
    cargando: mensual.isLoading || skus.isLoading || inv.isLoading,
  };
}

/** cliente_key del dashboard → cuenta de sell out (para Análisis por Cliente). */
export const CUENTA_POR_CLIENTE = { digitalife: 'digitalife', pcel: 'pcel', dicotech: 'dicotech' };
/** Código de cliente del ERP → cuenta de sell out. Mismo mapeo que v_sellout_cuentas. */
export const CUENTA_POR_ERP = {
  '00183': 'ct', '00417': 'cva', '00335': 'guc', '00226': 'ingram', '04126': 'ingram_retail', '01145': 'arroba', '00514': 'techsmart',
  '00676': 'exel', '00106': 'dcmayorista', '00748': 'nsstore', '00662': 'loma', '00683': 'pch', '07424': 'kabik',
  '00708': 'dicotech', '00764': 'digitalife', '00473': 'pcel',
};
