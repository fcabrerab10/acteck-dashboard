// Comparador de periodos · datos (2026-11-18). Las mismas consultas que traía ComparadorPeriodos.jsx, ahora como hooks
// que comparten la web y el celular. Alcance = { clienteKey } (cliente propio) · { clienteNombre, clienteCodigo }
// (cliente del ERP) · {} (global).
//   useComparadorBase → filas mensuales: v_fact_cliente_mes + v_erp_medidas_cliente_mes · v_analisis_cliente_mes ·
//                       v_facturacion_global_mensual + v_erp_medidas_mes.
//   useComparadorSkus → detalle por SKU de los años pedidos (sólo con `activo`): facturacion_clientes ·
//                       v_analisis_cliente_sku_mes · v_facturacion_global_sku_mes.
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { cachedQuery, fetchAllQ } from '../../../lib/queries';
import { agregarErp } from './calculo';

export function useComparadorBase({ clienteKey = null, clienteNombre = null, clienteCodigo = null } = {}) {
  const [estado, setEstado] = useState({ fact: null, med: [] });
  useEffect(() => {
    let cancel = false;
    setEstado({ fact: null, med: [] });
    const pon = (fact, med) => { if (!cancel) setEstado({ fact, med }); };
    if (clienteNombre || clienteCodigo) {
      let q = supabase.from('v_analisis_cliente_mes').select('anio,mes,fact_neta,piezas_venta_neta,contribucion');
      q = clienteCodigo ? q.eq('cliente', clienteCodigo) : q.eq('cliente_nombre', clienteNombre);
      cachedQuery(q.order('anio').order('mes'))
        .then(({ data }) => { const rows = agregarErp(data); pon(rows, rows); })
        .catch(() => pon([], []));
      return () => { cancel = true; };
    }
    const qFact = clienteKey
      ? supabase.from('v_fact_cliente_mes').select('anio,mes,monto,piezas').eq('cliente_key', clienteKey)
      : supabase.from('v_facturacion_global_mensual').select('anio,mes,monto,piezas');
    let qMed = supabase.from(clienteKey ? 'v_erp_medidas_cliente_mes' : 'v_erp_medidas_mes').select('anio,mes,fact_neta,contribucion');
    if (clienteKey) qMed = qMed.eq('cliente_key', clienteKey);
    Promise.all([cachedQuery(qFact.order('anio').order('mes')), cachedQuery(qMed.order('anio').order('mes'))])
      .then(([f, m]) => pon(f.data || [], m.data || []))
      .catch(() => pon([], []));
    return () => { cancel = true; };
  }, [clienteKey, clienteNombre, clienteCodigo]);
  return estado;
}

/** Detalle por SKU de `yearsKey` ('2025,2026'). Devuelve { rows: [{ sku, anio, mes, piezas, monto }] | null, cargando }. */
export function useComparadorSkus({ clienteKey = null, clienteNombre = null, clienteCodigo = null } = {}, yearsKey = '', activo = false) {
  const [sku, setSku] = useState(null); // { key, rows }
  const alcance = `${clienteKey || ''}|${clienteNombre || ''}|${clienteCodigo || ''}`;
  const key = `${alcance}#${yearsKey}`;
  const listo = !!sku && sku.key === key;
  useEffect(() => {
    if (!activo || !yearsKey || listo) return undefined;
    let cancel = false;
    const years = yearsKey.split(',').map(Number);
    const erp = !!(clienteNombre || clienteCodigo);
    const q = erp
      ? () => { const b = supabase.from('v_analisis_cliente_sku_mes').select('articulo,anio,mes,piezas_venta_neta,fact_neta').in('anio', years); return clienteCodigo ? b.eq('cliente', clienteCodigo) : b.eq('cliente_nombre', clienteNombre); }
      : clienteKey
        ? () => supabase.from('facturacion_clientes').select('sku,anio,mes,piezas,monto').eq('cliente_key', clienteKey).in('anio', years)
        : () => supabase.from('v_facturacion_global_sku_mes').select('sku,anio,mes,piezas,monto').in('anio', years);
    fetchAllQ(q, { pageSize: clienteKey ? 500 : 1000, orderCol: erp ? 'articulo' : 'sku', label: 'comparador-sku' })
      .then((rows) => { if (!cancel) setSku({ key, rows: erp ? rows.map((r) => ({ sku: r.articulo, anio: r.anio, mes: r.mes, piezas: r.piezas_venta_neta, monto: r.fact_neta })) : rows }); })
      .catch(() => { if (!cancel) setSku({ key, rows: [] }); });
    return () => { cancel = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo, key, listo]);
  return { rows: listo ? sku.rows : null, cargando: activo && !!yearsKey && !listo };
}
