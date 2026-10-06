// Producto 360 · datos (2026-10-05). Todo lo de UN SKU en consultas chicas: sell in por cliente y mes (24 m), sell out
// por cuenta y mes (24 m), inventario en cuentas (última semana), inventario propio por almacén, tránsito, precios por
// lista y roadmap. ≤ 9 consultas, todas con filtro por SKU.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { fetchAll, cachedQuery } from '../../../lib/queries';

const STALE = 5 * 60 * 1000;
const seg = (p, nombre) => Promise.resolve(p).then((r) => { if (r?.error) throw r.error; return r?.data ?? r ?? []; }).catch((e) => { console.warn(`[producto360] ${nombre}:`, e?.message || e); return []; });

export function useProducto360(sku, { enabled = true, hoy = new Date() } = {}) {
  const s = String(sku || '').trim().toUpperCase();
  return useQuery({
    queryKey: ['movil', 'producto360', s], enabled: !!s && enabled, staleTime: STALE,
    queryFn: async () => {
      const anio = hoy.getFullYear();
      const [roadmap, sellin, clientes, sellout, cuentas, invCuentas, invSku, almacenes, transito, precios, stockAnio] = await Promise.all([
        seg(cachedQuery(supabase.from('roadmap_sku').select('sku,descripcion,marca,categoria,familia').eq('sku', s).maybeSingle()).then((r) => r.data), 'roadmap'),
        seg(fetchAll('mv_analisis_cliente_sku_mes', 'cliente,anio,mes,fact_neta,piezas_venta_neta', (q) => q.eq('articulo', s).gte('anio', anio - 2)), 'sell in'),
        seg(fetchAll('mv_analisis_cliente_mes', 'cliente,cliente_nombre,canal', (q) => q.eq('anio', anio).eq('mes', hoy.getMonth() + 1)), 'clientes'),
        seg(fetchAll('mv_sellout_cuenta_sku_mes', 'cuenta,anio,mes,cantidad,importe', (q) => q.eq('sku', s).gte('anio', anio - 2)), 'sell out'),
        seg(fetchAll('v_sellout_cuentas', 'cuenta,nombre,canal_sellout,erp_cliente,propio'), 'cuentas'),
        seg(fetchAll('v_sellout_inventario_cuenta_sku', 'cuenta,anio,semana,stock,valor', (q) => q.eq('sku', s).gte('anio', anio - 1)), 'inventario cuentas'),
        seg(cachedQuery(supabase.from('v_medidas_inventario_sku').select('inv_actual,inv_actual_piezas,inv_actual_disponible,costo_promedio,almacenes_con_stock').eq('articulo', s).maybeSingle()).then((r) => r.data), 'inventario'),
        seg(fetchAll('v_inventario_almacen_medida', 'no_almacen,almacen_nombre,inventario,disponible,en_inv_actual', (q) => q.eq('articulo', s).gt('inventario', 0)), 'almacenes'),
        seg(cachedQuery(supabase.from('v_transito_sku').select('cantidad,eta_mas_cercana,embarques,embarques_detalle').eq('sku', s).maybeSingle()).then((r) => r.data), 'tránsito'),
        seg(fetchAll('v_estrategia_precios_lista', 'lista,precio', (q) => q.eq('sku', s)), 'precios'),
        seg(fetchAll('v_inventario_sku_anio', 'anio,piezas,valor', (q) => q.eq('sku', s)), 'stock por mes'),
      ]);
      // Clientes: nombre por código (si el cliente no compró este mes, se busca en el año).
      let nombres = new Map(clientes.map((c) => [c.cliente, c]));
      const faltan = [...new Set(sellin.map((r) => r.cliente))].filter((c) => !nombres.has(c));
      if (faltan.length) {
        const extra = await seg(fetchAll('mv_analisis_cliente_mes', 'cliente,cliente_nombre,canal', (q) => q.in('cliente', faltan.slice(0, 200)).gte('anio', anio - 1)), 'clientes extra');
        extra.forEach((c) => { if (!nombres.has(c.cliente)) nombres.set(c.cliente, c); });
      }
      // Inventario en cuentas: última semana con foto por cuenta.
      const ultimaInv = new Map();
      invCuentas.forEach((r) => { const k = r.cuenta; const o = ultimaInv.get(k); const idx = Number(r.anio) * 100 + Number(r.semana); if (!o || idx > o.idx) ultimaInv.set(k, { cuenta: k, piezas: Number(r.stock) || 0, valor: Number(r.valor) || 0, idx, semana: r.semana, anio: r.anio }); });
      return { sku: s, roadmap: roadmap || null, sellin: sellin.map((r) => ({ ...r, cliente_nombre: nombres.get(r.cliente)?.cliente_nombre || r.cliente, canal: nombres.get(r.cliente)?.canal || null })),
        sellout, cuentas, invCuentas: [...ultimaInv.values()], inv: invSku || null, almacenes, transito: transito || null, precios, stockAnio };
    },
  });
}
