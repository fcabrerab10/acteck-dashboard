// Datos de Análisis por Cliente · v_analisis_cliente_mes (MV por cliente × mes) para el año
// pedido y el anterior (YoY, últimos 12 meses) y mv_analisis_cliente_sku_mes para el drill.
// Todo por lib/queries (paralelo + cache 5 min).
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { cachedQuery, fetchAllQ } from '../../../lib/queries';

const SELECT = 'anio,mes,cliente,cliente_nombre,cliente_key,canal,fact_bruta,devoluciones,rmas,bonificaciones,fact_neta,venta_neta,costo_fact_neta,costo_venta_neta,contribucion,utilidad_comercial,piezas_venta_neta';

export function useAniosDisponibles() {
  return useQuery({
    queryKey: ['analisis_clientes', 'anios'],
    queryFn: async () => {
      const { data } = await cachedQuery(supabase.from('v_erp_medidas_mes').select('anio').order('anio', { ascending: false }));
      return Array.from(new Set((data || []).map((r) => Number(r.anio)))).filter(Boolean).sort((a, b) => b - a);
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useAnalisisClientes(anio) {
  return useQuery({
    queryKey: ['analisis_clientes', 'mv', anio],
    enabled: !!anio,
    queryFn: () => fetchAllQ(
      () => supabase.from('v_analisis_cliente_mes').select(SELECT).in('anio', [anio - 1, anio]),
      { pageSize: 1000, orderCol: 'cliente', label: 'v_analisis_cliente_mes' },
    ),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Cuota de venta por cliente del ERP y mes (v_cuota_erp_mes). 29 clientes × 12 meses × 2 años.
 * Mapa en supabase/migrations/20260912_cuotas_clientes_mapa.sql.
 */
export function useCuotasClientes(anio) {
  return useQuery({
    queryKey: ['analisis_clientes', 'cuotas', anio],
    enabled: !!anio,
    queryFn: async () => {
      const { data, error } = await cachedQuery(
        supabase.from('v_cuota_erp_mes').select('cliente_erp,cuota_cliente,anio,mes,cuota_venta').in('anio', [anio - 1, anio]),
      );
      if (error) throw error;
      return data || [];
    },
    // 5 min como el resto: la app puede editar cuotas_mensuales desde Sell In.
    staleTime: 5 * 60 * 1000,
  });
}

/** Detalle SKU × mes de un cliente (mv_analisis_cliente_sku_mes, por código ERP) para el drill-down. */
export function useDetalleCliente(clienteCodigo, anio, enabled = true) {
  return useQuery({
    queryKey: ['analisis_clientes', 'detalle', clienteCodigo, anio],
    enabled: enabled && !!clienteCodigo,
    queryFn: () => fetchAllQ(
      () => supabase.from('mv_analisis_cliente_sku_mes').select('anio,mes,articulo,marca,categoria,fact_neta,contribucion,piezas_venta_neta').eq('cliente', clienteCodigo).in('anio', [anio - 1, anio]),
      { pageSize: 1000, orderCol: 'articulo', label: 'mv_analisis_cliente_sku_mes' },
    ),
    staleTime: 5 * 60 * 1000,
  });
}
