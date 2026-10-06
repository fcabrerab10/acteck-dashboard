// S&OP del celular · datos (React Query sobre lib/queries). 2026-10-05.
//   useSopEmpresa(enabled) → { rows (calcularForecast, idéntico a la web), transito, navieraPor, descripciones, comprasProveedores }
//   useSopClientes(enabled) → forecast capturado + copia del CRM + stock de cada cliente propio (forecastDatos / reservas/datos),
//                             listo para calcularMisClientes (el inventario y el tránsito vienen de useSopEmpresa).
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAll } from '../../../lib/queries';
import { calcularForecast } from '../../../modules/comercial/forecast/calculo';
import { useVentasForecast, useStockForecast, useProyectosForecast, useForecastExistente, clienteForecast, PROPIOS } from '../../../modules/comercial/proyectos/forecastDatos';
import { useForecastCrm } from '../../../modules/comercial/reservas/datos';
import { CLIENTES } from '../../../modules/comercial/proyectos/calculo';

const STALE = 5 * 60 * 1000;
const N = (v) => Number(v) || 0;
const opcional = (p) => p.catch(() => []);

export function useSopEmpresa(enabled = true) {
  return useQuery({
    queryKey: ['movil', 'sop', 'empresa'], staleTime: STALE, enabled,
    queryFn: async () => {
      const hoy = new Date();
      // 12 meses exactos de facturación (lo que lee el motor para demanda y cobertura).
      const m0 = new Date(hoy.getFullYear(), hoy.getMonth() - 11, 1);
      const filtro12m = m0.getFullYear() === hoy.getFullYear()
        ? `and(anio.eq.${hoy.getFullYear()},mes.gte.${m0.getMonth() + 1})`
        : `and(anio.eq.${m0.getFullYear()},mes.gte.${m0.getMonth() + 1}),and(anio.eq.${hoy.getFullYear()},mes.lte.${hoy.getMonth() + 1})`;
      const [inventario, transito, leadTimes, facturacion, embarques, reporteSkus, roadmap, catalogoArticulos, skuConfig, comprasPendientes, comprasProv, contenedores] = await Promise.all([
        fetchAll('v_inventario_comercial', 'sku,disponible,inventario'),
        fetchAll('v_transito_sku', 'sku,supplier,cantidad,eta_mas_cercana,embarques,embarques_detalle'),
        fetchAll('v_lead_time_sku', 'sku,dias_promedio,muestras,supplier_principal,familia'),
        fetchAll('facturacion_clientes', 'sku,cliente_nombre,canal,anio,mes,piezas', (q) => q.or(filtro12m)),
        fetchAll('embarques_compras', 'po,codigo,fecha_emision,arribo_cedis,arribo_almacen,eta_puerto,po_qty,shp_qty,contenedor,estatus,supplier,familia,descripcion,unit_price,lt_dias,tipo_carga,tipo_contenedor,cbm_unitario'),
        opcional(fetchAll('reporte_skus', 'sku,orden', (q) => q.eq('activo', true))),
        fetchAll('roadmap_sku', 'sku,descripcion,marca,rdmp,categoria'),
        opcional(fetchAll('catalogo_articulos', 'articulo,descripcion')),
        opcional(fetchAll('sku_config', 'sku,es_critico,meses_seguridad,crecimiento_override')),
        opcional(fetchAll('v_compras_pendientes_sku', 'sku,descripcion,proveedor,po,fecha_po,piezas_pedidas,piezas_pendientes,usd_pendiente,eta,en_master_embarques,dias_desde_po')),
        opcional(fetchAll('v_compras_pendientes_proveedor', 'proveedor,pos,skus,piezas_pendientes,usd_pendiente,po_mas_antigua,dias_po_mas_antigua,eta_mas_cercana,renglones_sin_embarque')),
        opcional(fetchAll('v_embarques_contenedor', 'contenedor,naviera')),
      ]);
      const rows = calcularForecast({ inventario, transito, leadTimes, metadata: [], demanda: [], roadmap, embarques, reporteSkus, facturacion, progArribos: [], catalogoArticulos, skuConfig, comprasPendientes }, 3);
      const descripciones = new Map();
      for (const c of catalogoArticulos || []) if (c.articulo) descripciones.set(c.articulo, c.descripcion || '');
      for (const r of roadmap || []) if (r.sku && r.descripcion) descripciones.set(r.sku, r.descripcion);
      const navieraPor = new Map();
      for (const c of contenedores || []) if (c.contenedor && c.naviera) navieraPor.set(c.contenedor, c.naviera);
      const llegadas = [];
      for (const t of transito || []) for (const e of Array.isArray(t.embarques_detalle) ? t.embarques_detalle : []) if (e?.po && N(e.cantidad) > 0) llegadas.push({ sku: t.sku, po: e.po, eta: e.eta || null, cantidad: N(e.cantidad) });
      const inventarioMap = new Map();
      for (const r of inventario || []) if (r.sku) inventarioMap.set(r.sku, (inventarioMap.get(r.sku) || 0) + N(r.disponible ?? r.inventario));
      return {
        rows, transito, llegadas, inventarioMap, navieraPor, descripciones, roadmap: roadmap || [],
        universoReporte: (reporteSkus || []).length > 0,
        comprasPendientes: comprasPendientes || [],
        comprasProveedores: (comprasProv || []).slice().sort((a, b) => N(b.usd_pendiente) - N(a.usd_pendiente)),
      };
    },
  });
}

/** Forecast de un cliente propio para el S&OP: capturado (forecast_crm) + copia del CRM (existente) + stock en su piso. */
function useClienteSop(key, enabled) {
  const cliente = useMemo(() => clienteForecast(key), [key]);
  const { data: crm = [], isLoading: l1 } = useForecastCrm(enabled ? cliente.key : null);
  const { data: existente, isLoading: l2 } = useForecastExistente(enabled ? cliente.codigo : null);
  const { data: stock, isLoading: l3 } = useStockForecast(enabled ? cliente : null);
  const { data: proyectos = [] } = useProyectosForecast(enabled ? cliente : null);
  const forecast = useMemo(() => {
    // Lo capturado manda sobre la copia del CRM para el mismo SKU y mes.
    const m = new Map();
    for (const r of existente?.filas || []) if (r.sku && N(r.piezas) > 0) m.set(`${r.sku}|${String(r.mes).slice(0, 7)}`, { sku: r.sku, key: String(r.mes).slice(0, 7), piezas: N(r.piezas) });
    for (const r of crm) if (r.sku && N(r.piezas) > 0) m.set(`${r.sku}|${r.anio}-${String(r.mes).padStart(2, '0')}`, { sku: r.sku, key: `${r.anio}-${String(r.mes).padStart(2, '0')}`, piezas: N(r.piezas) });
    // Proyectos probables/confirmados sólo cuando ese SKU y mes no tiene forecast (para no contar dos veces).
    for (const p of proyectos) { const k = `${p.sku}|${p.key}`; if (!m.has(k) && N(p.piezas) > 0) m.set(k, { sku: p.sku, key: p.key, piezas: N(p.piezas), proyecto: p.nombre }); }
    return [...m.values()];
  }, [crm, existente, proyectos]);
  return { key, label: PROPIOS[key]?.nombre ? (CLIENTES.find((c) => c.key === key)?.label || key) : key, forecast, stock: stock || new Map(), loading: l1 || l2 || l3 };
}

export function useSopClientes(enabled = true) {
  const a = useClienteSop('digitalife', enabled);
  const b = useClienteSop('pcel', enabled);
  const c = useClienteSop('dicotech', enabled);
  return { clientes: [a, b, c], loading: a.loading || b.loading || c.loading };
}
