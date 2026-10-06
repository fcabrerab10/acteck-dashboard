// Datos del Inventario de la empresa en el celular (3.81.0 · 2026-10-05). SOLO vía src/lib/queries.js.
// 8 consultas chicas, ninguna por SKU y día:
//   1 v_inventario_almacen_medida (en_inv_actual = true: SKU × almacén, 2.6 K filas, mismo primer viaje que la web)
//   2 v_medidas_inventario (una fila: Inv Actual, Días de Inv, vueltas, CV 3 m, costo de compra pendiente)
//   3 roadmap_sku (useRoadmap, cacheada y compartida con las demás pantallas)
//   4 v_transito_sku (1 fila por SKU con sus POs pendientes en embarques_detalle)
//   5 v_sellin_global_sku_anio (pivote sku × año: demanda de los 3 meses cerrados; 1 página, 2 si cruza de año)
//   6 v_inventario_cv_mes (una fila por mes: inventario al cierre [Inv Actual] + CV 3 m + costo de venta)
//   7 v_inventario_sku_anio (pivote sku × año del stock al cierre de cada mes: la tabla)
//   8 embarques_compras (po, codigo, unit_price de lo pendiente: precio de lo que llega cuando el SKU aún no existe)
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { fetchAll, fetchAllQ, useRoadmap, useMedidasInventario } from '../../../lib/queries';
import { N } from '../../../modules/comercial/inventario/constantes';
import { mesesCerradosDe } from './calculo';

const STALE = 5 * 60 * 1000;
const SELECT_INV = 'articulo,no_almacen,almacen_nombre,cedis,disponible,inventario,costopromedio,costodisponible,costoinventario';
const ESTATUS_PENDIENTE = ['EN PRODUCCION', 'PROXIMO A ZARPAR', 'TRANSITO MARITIMO', 'EN ESPERA DE CONSOLIDAR', 'EN RESGUARDO', 'Pendiente modular'];

/** v_transito_sku → Map(sku → { cantidad, pos:[{ po, estatus, cantidad, eta, etd, cedis, contenedor }], eta, supplier }), como useInventarioDatos. */
export function mapaTransito(rows = []) {
  const m = new Map();
  (rows || []).forEach((r) => {
    if (!r.sku) return;
    const prev = m.get(r.sku) || { cantidad: 0, pos: [], eta: null, supplier: r.supplier || '' };
    prev.cantidad += N(r.cantidad);
    const det = Array.isArray(r.embarques_detalle) ? r.embarques_detalle : [];
    det.forEach((d) => prev.pos.push({ po: d.po, estatus: d.estatus, cantidad: N(d.cantidad), eta: d.eta || null, etd: d.etd || null, cedis: d.cedis || '', contenedor: d.contenedor || '' }));
    if (r.eta_mas_cercana && (!prev.eta || r.eta_mas_cercana < prev.eta)) prev.eta = r.eta_mas_cercana;
    m.set(r.sku, prev);
  });
  m.forEach((v) => v.pos.sort((a, b) => String(a.eta || '9999').localeCompare(String(b.eta || '9999'))));
  return m;
}

export function useInventarioEmpresa(enabled = true) {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const cerrados = mesesCerradosDe(hoy);
  const aniosDemanda = [...new Set(cerrados.map((c) => c.anio))];
  const { data: roadmap = [], isLoading: lRoadmap } = useRoadmap();
  const { data: medidasRow = null } = useMedidasInventario();

  const base = useQuery({
    queryKey: ['movil', 'inventario-empresa', anio, hoy.getMonth() + 1],
    staleTime: STALE,
    enabled,
    queryFn: async () => {
      const [filas, transitoRows, demandaRows, meses, skuAnio, precioRows] = await Promise.all([
        fetchAllQ(() => supabase.from('v_inventario_almacen_medida').select(SELECT_INV).eq('en_inv_actual', true),
          { pageSize: 5000, orderCol: 'articulo', label: 'movil·inventario·almacen' }),
        fetchAll('v_transito_sku', 'sku,supplier,cantidad,eta_mas_cercana,embarques_detalle').catch(() => []),
        fetchAllQ(() => supabase.from('v_sellin_global_sku_anio').select('sku,anio,piezas').in('anio', aniosDemanda),
          { pageSize: 5000, orderCol: 'sku', label: 'movil·inventario·demanda' }).catch(() => []),
        fetchAll('v_inventario_cv_mes', 'anio,mes,fecha_cierre,inv_cierre_mes,inv_cierre_mes_piezas,cv_ultimos_3_meses,costo_venta_neta,piezas_venta_neta', (q) => q.gte('anio', anio - 2)).catch(() => []),
        fetchAllQ(() => supabase.from('v_inventario_sku_anio').select('sku,anio,piezas,valor').in('anio', [anio - 1, anio]),
          { pageSize: 5000, orderCol: 'sku', label: 'movil·inventario·sku_anio' }).catch(() => []),
        fetchAllQ(() => supabase.from('embarques_compras').select('id,po,codigo,unit_price').in('estatus', ESTATUS_PENDIENTE).not('codigo', 'is', null),
          { pageSize: 5000, orderCol: 'id', label: 'movil·inventario·precios_po' }).catch(() => []),
      ]);
      const precios = new Map();
      (precioRows || []).forEach((r) => { if (r.po && r.codigo && N(r.unit_price) > 0) precios.set(`${r.po}|${r.codigo}`, N(r.unit_price)); });
      return { filas: filas || [], transito: mapaTransito(transitoRows), demandaRows: demandaRows || [], meses: meses || [], skuAnio: skuAnio || [], precios };
    },
  });

  return { ...base.data, roadmap, medidasRow, cerrados, hoy, loading: base.isLoading || lRoadmap, error: base.error };
}
