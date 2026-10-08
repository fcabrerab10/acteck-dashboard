// Análisis por cliente en el celular · acceso a datos (2026-10-05). Todo por src/lib/queries.js (fetchAll /
// fetchAllQ / cachedQuery: paginación paralela y cache 5 min) + React Query. Lo que ya existe en la web se reusa
// de analisis/useAnalisisData.js y sellout/datos.js; aquí sólo viven las consultas que el celular necesita y la
// web no tiene (lista recortada a 7 columnas, cliente × mes de UN cliente, vendedor, SKUs de una sucursal…).
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { fetchAll, fetchAllQ, cachedQuery } from '../../../lib/queries';
import { N } from '../../util';

const STALE = 5 * 60 * 1000;

/** Lista: cliente × mes de los dos años (7 columnas) + cuota del año (v_cuota_erp_mes). 2 consultas. */
export function useListaAnalisis(anio) {
  return useQuery({
    queryKey: ['movil', 'analisis-lista', anio], staleTime: STALE, enabled: !!anio,
    queryFn: async () => {
      const [rows, cuotasRows] = await Promise.all([
        fetchAll('v_analisis_cliente_mes', 'cliente,cliente_nombre,cliente_key,canal,anio,mes,fact_neta', (q) => q.in('anio', [anio - 1, anio])),
        fetchAll('v_cuota_erp_mes', 'cliente_erp,anio,mes,cuota_venta', (q) => q.eq('anio', anio)),
      ]);
      return { rows, cuotasRows };
    },
  });
}

/** Código ERP del cliente a partir de su nombre (cuando la ficha se abre desde Buscar, que sólo trae el nombre). */
export function useCodigoErp(clienteNombre, anio, enabled = true) {
  return useQuery({
    queryKey: ['movil', 'analisis-codigo', clienteNombre, anio], staleTime: STALE, enabled: enabled && !!clienteNombre,
    queryFn: async () => {
      const { data } = await cachedQuery(supabase.from('v_analisis_cliente_mes').select('cliente,fact_neta').eq('cliente_nombre', clienteNombre).in('anio', [anio - 1, anio]));
      const por = new Map();
      (data || []).forEach((r) => por.set(r.cliente, (por.get(r.cliente) || 0) + N(r.fact_neta)));
      return [...por.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    },
  });
}

/** Cliente × mes de UN cliente, los dos años (24 filas): medidas completas para KPIs, serie y cuotas por Q. */
export function useClienteMes(codigo, anio) {
  return useQuery({
    queryKey: ['movil', 'analisis-cliente-mes', codigo, anio], staleTime: STALE, enabled: !!codigo,
    queryFn: async () => {
      const { data, error } = await cachedQuery(supabase.from('v_analisis_cliente_mes')
        .select('anio,mes,cliente,cliente_nombre,cliente_key,canal,fact_bruta,devoluciones,rmas,bonificaciones,fact_neta,contribucion,piezas_venta_neta')
        .eq('cliente', codigo).in('anio', [anio - 1, anio]));
      if (error) throw error;
      return data || [];
    },
  });
}

/** Vendedor del ERP que atiende al cliente este año (el de más fact. neta en v_ventas_vendedor_cliente_mes). */
export function useVendedorCliente(codigo, anio) {
  return useQuery({
    queryKey: ['movil', 'analisis-vendedor', codigo, anio], staleTime: STALE, enabled: !!codigo,
    queryFn: async () => {
      const { data } = await cachedQuery(supabase.from('v_ventas_vendedor_cliente_mes').select('vendedor,fact_neta').eq('cliente', codigo).eq('anio', anio));
      const por = new Map();
      (data || []).forEach((r) => { if (r.vendedor && r.vendedor !== 'SIN VENDEDOR') por.set(r.vendedor, (por.get(r.vendedor) || 0) + N(r.fact_neta)); });
      return [...por.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    },
  });
}

/**
 * SKUs del mes de UNA sucursal o UN vendedor de una cuenta (hoja al tocar la fila). No hay MV sucursal × SKU:
 * se lee v_sellout_general_cuenta acotada a cuenta + mes + sucursal/vendedor (pocas filas) y se agrega aquí.
 * `campo` = 'sucursal' | 'vendedor_nombre'.
 */
export function useSkusDimension(cuenta, anio, mes, campo, valor, enabled = true) {
  return useQuery({
    queryKey: ['movil', 'analisis-skus-dim', cuenta, anio, mes, campo, valor], staleTime: STALE, enabled: enabled && !!cuenta && !!valor,
    queryFn: async () => {
      const { data, error } = await cachedQuery(supabase.from('v_sellout_general_cuenta').select('sku,importe,cantidad')
        .eq('cuenta', cuenta).eq('anio', anio).eq('mes', mes).eq(campo, valor).limit(5000));
      if (error) throw error;
      const m = new Map();
      (data || []).forEach((r) => { const k = String(r.sku || '').toUpperCase(); if (!k) return; const o = m.get(k) || { sku: k, importe: 0, cantidad: 0 }; o.importe += N(r.importe); o.cantidad += N(r.cantidad); m.set(k, o); });
      return [...m.values()].sort((a, b) => b.importe - a.importe);
    },
  });
}

/** SKU × mes de varias cuentas (la propia y sus pares) en una ventana de meses (oportunidades). 1 consulta. */
export function useSkuMesCuentas(cuentas = [], meses = [], enabled = true) {
  const key = [...cuentas].sort().join(',');
  const mk = meses.map((m) => `${m.anio}-${m.mes}`).join(',');
  return useQuery({
    queryKey: ['movil', 'analisis-sku-pares', key, mk], staleTime: STALE, enabled: enabled && cuentas.length > 0 && meses.length > 0,
    queryFn: () => fetchAllQ(
      () => supabase.from('vs_sellout_cuenta_sku_mes').select('cuenta,anio,mes,sku,marca,categoria,importe,cantidad')
        .in('cuenta', cuentas).or(meses.map((m) => `and(anio.eq.${m.anio},mes.eq.${m.mes})`).join(',')),
      { pageSize: 5000, orderCol: 'sku', label: 'sku_mes_pares' },
    ),
  });
}
