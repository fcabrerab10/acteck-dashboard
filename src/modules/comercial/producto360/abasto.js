// Producto 360 · Abasto: el S&OP de UN SKU con sus propios datos (mismo motor que la web, forecast/calculo.js#calcularForecast,
// alimentado sólo con las filas de ese SKU). Nació en src/movil/pestanas/producto/Abasto.jsx (3.83.0); 2026-11-18 se movió
// aquí para que la ficha web (producto360/Producto360Web.jsx) y la del celular compartan hook y frase.
import { useQuery } from '@tanstack/react-query';
import { fetchAll } from '../../../lib/queries';
import { calcularForecast } from '../forecast/calculo';
import { arribosPorPo, diasCobertura, fechaLarga } from '../forecast/sopCalculo';

const N = (v) => Number(v) || 0;
const int = (n) => Math.round(N(n)).toLocaleString('es-MX');
const STALE = 5 * 60 * 1000;
const opcional = (p) => p.catch(() => []);

export function useAbastoSku(sku, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['movil', 'abasto', sku], staleTime: STALE, enabled: enabled && !!sku,
    queryFn: async () => {
      const hoy = new Date();
      const m0 = new Date(hoy.getFullYear(), hoy.getMonth() - 11, 1);
      const filtro12m = m0.getFullYear() === hoy.getFullYear()
        ? `and(anio.eq.${hoy.getFullYear()},mes.gte.${m0.getMonth() + 1})`
        : `and(anio.eq.${m0.getFullYear()},mes.gte.${m0.getMonth() + 1}),and(anio.eq.${hoy.getFullYear()},mes.lte.${hoy.getMonth() + 1})`;
      const [inventario, transito, leadTimes, facturacion, embarques, roadmap, catalogoArticulos, skuConfig, comprasPendientes, contenedores] = await Promise.all([
        fetchAll('v_inventario_comercial', 'sku,disponible,inventario', (q) => q.eq('sku', sku)),
        fetchAll('v_transito_sku', 'sku,supplier,cantidad,eta_mas_cercana,embarques,embarques_detalle', (q) => q.eq('sku', sku)),
        opcional(fetchAll('v_lead_time_sku', 'sku,dias_promedio,muestras,supplier_principal,familia', (q) => q.eq('sku', sku))),
        fetchAll('facturacion_clientes', 'sku,cliente_nombre,canal,anio,mes,piezas', (q) => q.eq('sku', sku).or(filtro12m)),
        opcional(fetchAll('embarques_compras', 'po,codigo,fecha_emision,arribo_cedis,arribo_almacen,eta_puerto,po_qty,shp_qty,contenedor,estatus,supplier,familia,descripcion,unit_price,lt_dias,tipo_carga,tipo_contenedor,cbm_unitario', (q) => q.eq('codigo', sku))),
        fetchAll('v_skus_producto', 'sku,descripcion,marca,rdmp,categoria', (q) => q.eq('sku', sku)),
        opcional(fetchAll('catalogo_articulos', 'articulo,descripcion', (q) => q.eq('articulo', sku))),
        opcional(fetchAll('sku_config', 'sku,es_critico,meses_seguridad,crecimiento_override', (q) => q.eq('sku', sku))),
        opcional(fetchAll('v_compras_pendientes_sku', 'sku,descripcion,proveedor,po,fecha_po,piezas_pedidas,piezas_pendientes,usd_pendiente,eta,en_master_embarques,dias_desde_po', (q) => q.eq('sku', sku))),
        opcional(fetchAll('v_embarques_contenedor', 'contenedor,naviera')),
      ]);
      const rows = calcularForecast({ inventario, transito, leadTimes, metadata: [], demanda: [], roadmap, embarques, reporteSkus: [{ sku, orden: 1 }], facturacion, progArribos: [], catalogoArticulos, skuConfig, comprasPendientes }, 3);
      const row = rows.find((r) => r.sku === sku) || null;
      const navieraPor = new Map((contenedores || []).filter((c) => c.contenedor && c.naviera).map((c) => [c.contenedor, c.naviera]));
      const arribos = arribosPorPo({ transito, porSku: new Map(row ? [[sku, row]] : []), navieraPor, hoy });
      return { row, arribos };
    },
  });
}

export function fraseAbasto(r, arribos = []) {
  if (!r) return 'Este SKU no tiene venta, inventario ni tránsito en los últimos 12 meses.';
  const dias = diasCobertura(r);
  const inv = N(r.inv);
  const prox = arribos.find((p) => !p.vencida) || arribos[0] || null;
  const p1 = inv <= 0 ? (N(r.demMes) > 0 ? 'Está agotado con demanda' : 'Está agotado y sin demanda reciente') : dias != null ? `Se agota en ${int(dias)} días` : `Hay ${int(inv)} pz sin ritmo de venta`;
  const p2 = prox ? `la PO ${prox.po} llega el ${fechaLarga(prox.eta)} con ${int(prox.skus.find((s) => s.sku === r.sku)?.piezas || prox.piezas)} pz` : 'no hay nada en camino';
  const p3 = N(r.sugerido) > 0 ? `faltan ${int(r.necesidadNeta)} pz para 3 meses y el sugerido es ${int(r.sugerido)} pz` : N(r.necesidadNeta) > 0 ? `faltan ${int(r.necesidadNeta)} pz, menos de medio contenedor` : 'no hace falta comprar';
  return `${p1}; ${p2}, así que ${p3}.`;
}
