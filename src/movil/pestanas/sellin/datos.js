// Datos de la pantalla móvil "Sell In" (consolidado de la empresa). SOLO vía src/lib/queries.js.
//
//   useSellInGlobal(anio)   → sku × canal × es_clave × mes del año en curso y del anterior
//                             (v_sellin_global_sku_canal_mes, 1 petición por año, páginas de 10K en paralelo)
//                             + cuota total mensual (v_cuota_global_mensual = Σ cuotas_mensuales.cuota_ideal)
//                             + cuotas por canal (cuotas_canales, dimension_tipo='canal'; hoy 2026 viene vacía → se usa YoY)
//   useClientesSku(sku, …)  → clientes que compran ESE sku, por mes (facturacion_clientes, índice por sku: ~9 ms)
//
// El mes elegido en la pantalla se filtra en memoria: no hay una petición por mes.
// Nada sensible: estas consultas no traen costo, contribución ni margen.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { fetchAll, fetchAllQ, cachedQuery } from '../../../lib/queries';

const STALE = 5 * 60 * 1000;

export function useSellInGlobal(anio) {
  const anios = [anio - 1, anio];
  return useQuery({
    queryKey: ['movil', 'sellin-global', anio],
    staleTime: STALE,
    queryFn: async () => {
      const [partes, cuotaMensual, cuotaCanales] = await Promise.all([
        Promise.all(anios.map((y) => fetchAllQ(
          () => supabase.from('v_sellin_global_sku_canal_mes').select('sku,canal,es_clave,anio,mes,piezas,monto').eq('anio', y),
          { pageSize: 10000, orderCol: 'sku', label: `movil·sellin_global·${y}` },
        ))),
        fetchAll('v_cuota_global_mensual', 'anio,mes,cuota_min,cuota_ideal', (q) => q.in('anio', anios)),
        cachedQuery(supabase.from('cuotas_canales').select('dimension_tipo,dimension_valor,meta_facturacion').eq('anio', anio))
          .then((r) => r.data || []).catch(() => []),
      ]);
      return { rows: partes.flat(), cuotaMensual: cuotaMensual || [], cuotaCanales };
    },
  });
}

/** Renglones de facturación de UN sku en los años que cubren los últimos meses mostrados. */
export function useClientesSku(sku, anios) {
  const lista = [...new Set(anios)].sort();
  return useQuery({
    queryKey: ['movil', 'sellin-sku-clientes', sku, lista],
    staleTime: STALE,
    enabled: !!sku && lista.length > 0,
    queryFn: () => fetchAll('facturacion_clientes', 'cliente_nombre,cliente_key,canal,anio,mes,piezas,monto', (q) => q.eq('sku', sku).in('anio', lista)),
  });
}
