// Datos de Sell In que no venían de facturacion_clientes: apoyo comercial (bonificaciones
// por concepto) y equipo comercial (vendedor). Todo por lib/queries (cache 5 min) y todo
// sobre vistas de sólo lectura, así que no hay que invalidar nada al escribir.
//
//   v_bonificaciones_concepto_mes   erp_ventas · rama = 'SERVICIOS' (migración 20260912_bonificaciones_concepto)
//   v_medidas_ventas_vendedor_mes   medidas del director por vendedor (MV, ms)
//   v_ventas_vendedor_cliente_mes   vendedor × cliente × mes (sólo para el drill, filtrada)
//   v_medidas_ventas_mes / _cliente_mes / mv_analisis_cliente_mes → fact. bruta (denominador del %)
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { fetchAllQ, cachedQuery } from '../../../lib/queries';

const COLS_APOYO = 'anio,mes,cliente_key,cliente,cliente_nombre,canal,concepto_codigo,concepto,monto,renglones';
const COLS_VEND = 'anio,mes,vendedor,fact_bruta,devoluciones,rmas,bonificaciones,fact_neta,venta_neta,costo_fact_bruta,costo_devoluciones,costo_rmas,costo_fact_neta,costo_venta_neta,contribucion,contribucion_bruta,utilidad_comercial,piezas_venta_neta,clientes,renglones,perdida_devoluciones,perdida_rmas';

/**
 * Apoyo comercial del año y del anterior + la fact. bruta que sirve de denominador.
 * `clienteKey` null = consolidado (todos los clientes y canales).
 */
export function useApoyoComercial(anio, clienteKey = null) {
  const anios = [anio - 1, anio];
  return useQuery({
    queryKey: ['sellin', 'apoyo', anios, clienteKey],
    queryFn: async () => {
      const filas = await fetchAllQ(
        () => { const q = supabase.from('v_bonificaciones_concepto_mes').select(COLS_APOYO).in('anio', anios); return clienteKey ? q.eq('cliente_key', clienteKey) : q; },
        { pageSize: 5000, orderCol: 'anio', label: 'v_bonificaciones_concepto_mes' },
      );
      // Denominador: la fact. bruta del mismo universo (global o del cliente).
      const fbQ = clienteKey
        ? supabase.from('v_medidas_ventas_cliente_mes').select('anio,mes,fact_bruta').in('anio', anios).eq('cliente_key', clienteKey)
        : supabase.from('v_medidas_ventas_mes').select('anio,mes,fact_bruta').in('anio', anios);
      const { data: fb } = await cachedQuery(fbQ);
      // Y la fact. bruta por CÓDIGO de cliente, sólo de los que tuvieron apoyo (unas decenas).
      const codigos = [...new Set(filas.map((r) => r.cliente).filter(Boolean))];
      let fbCliente = [];
      if (!clienteKey && codigos.length) {
        const { data } = await cachedQuery(supabase.from('mv_analisis_cliente_mes').select('cliente,anio,mes,fact_bruta').in('anio', anios).in('cliente', codigos.slice(0, 300)));
        fbCliente = data || [];
      }
      return { filas, fb: fb || [], fbCliente };
    },
  });
}

/**
 * Apoyo comercial de UN cliente por CÓDIGO del ERP (el drill de Análisis por Cliente
 * trabaja por código: INGRAM son dos clientes con el mismo nombre).
 */
export function useApoyoCliente(codigo, anio, enabled = true) {
  return useQuery({
    queryKey: ['sellin', 'apoyo-cliente', codigo, anio],
    enabled: !!codigo && !!enabled,
    queryFn: async () => {
      const [filas, fb] = await Promise.all([
        fetchAllQ(
          () => supabase.from('v_bonificaciones_concepto_mes').select(COLS_APOYO).eq('cliente', codigo).eq('anio', anio),
          { pageSize: 2000, orderCol: 'anio', label: 'v_bonificaciones_concepto_mes·cliente' },
        ),
        cachedQuery(supabase.from('mv_analisis_cliente_mes').select('anio,mes,fact_bruta').eq('cliente', codigo).eq('anio', anio)).then((r) => r.data || []),
      ]);
      return { filas, fb };
    },
  });
}

/** Medidas del director por vendedor, año en curso y anterior. */
export function useVendedores(anio) {
  const anios = [anio - 1, anio];
  return useQuery({
    queryKey: ['sellin', 'vendedores', anios],
    queryFn: () => fetchAllQ(
      () => supabase.from('v_medidas_ventas_vendedor_mes').select(COLS_VEND).in('anio', anios),
      { pageSize: 2000, orderCol: 'anio', label: 'v_medidas_ventas_vendedor_mes' },
    ),
  });
}

/** Clientes de UN vendedor en el año (drill). Se pide sólo al abrir la fila. */
export function useVendedorClientes(vendedor, anio, enabled = true) {
  return useQuery({
    queryKey: ['sellin', 'vendedor-clientes', vendedor, anio],
    enabled: !!vendedor && !!enabled,
    queryFn: () => fetchAllQ(
      () => supabase.from('v_ventas_vendedor_cliente_mes').select('anio,mes,cliente,cliente_nombre,cliente_key,fact_neta,piezas').eq('vendedor', vendedor).eq('anio', anio),
      { pageSize: 5000, orderCol: 'anio', label: 'v_ventas_vendedor_cliente_mes' },
    ),
  });
}
