// Forecast CRM · datos (React Query sobre lib/queries). 2026-10-01.
//   useVentasForecast(cliente)  → Map(sku → Map('YYYY-MM' → pz)) de ≥ 2 años: sell out si el cliente lo reporta
//                                 (digitalife/dicotech: sellout_sku · pcel: sellout_pcel normalizado), si no, sell in
//                                 por código ERP (mv_analisis_cliente_sku_mes.piezas_venta_neta).
//   useStockForecast(cliente)   → Map(sku → pz) última foto en casa del cliente (propios; pcel desde sellout_pcel).
//   useProyectosForecast(ck)    → líneas de proyectos probables/confirmados del cliente propio [{sku,key,piezas,nombre,probabilidad}].
//   useForecastExistente(cod)   → Set(sku) con forecast ya capturado en el CRM (forecast_crm_existente).
//   useClientesErp()            → clientes del ERP con venta en el año (código, nombre) para «otros clientes».
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { fetchAll, fetchAllQ, cachedQuery } from '../../../lib/queries';
import { normalizarPcel } from '../reservas/calculo';
import { CLIENTES_CRM } from '../reservas/clientesCRM';
import { mesKey } from './forecastCalc';

const STALE = 5 * 60 * 1000;
const N = (v) => Number(v) || 0;
export const PROPIOS = CLIENTES_CRM; // digitalife · pcel · dicotech → { codigo, nombre, tipo }

/** { key, codigo, nombre, propio } a partir de un cliente propio (key) o de un código del ERP. */
export function clienteForecast(sel) {
  if (CLIENTES_CRM[sel]) return { key: sel, codigo: CLIENTES_CRM[sel].codigo, nombre: CLIENTES_CRM[sel].nombre, propio: true, tipo: CLIENTES_CRM[sel].tipo };
  return { key: sel, codigo: sel, nombre: sel, propio: false, tipo: 'directa' };
}

export function useVentasForecast(cliente) {
  const anio = new Date().getFullYear();
  return useQuery({
    queryKey: ['forecast', 'ventas', cliente?.key, anio], staleTime: STALE, enabled: !!cliente?.key,
    queryFn: async () => {
      const series = new Map();
      const add = (sku, a, m, pz) => { if (!sku || !a || !m) return; let s = series.get(sku); if (!s) { s = new Map(); series.set(sku, s); } const k = mesKey(N(a), N(m)); s.set(k, (s.get(k) || 0) + N(pz)); };
      if (cliente.propio && cliente.key === 'pcel') {
        const rows = await fetchAllQ(() => supabase.from('sellout_pcel').select('anio,semana,sku,inventario,vta_mes_1,vta_mes_1_nombre,vta_mes_2,vta_mes_2_nombre,vta_mes_3,vta_mes_3_nombre').gte('anio', anio - 2), { orderCol: 'id', label: 'sellout_pcel' });
        const { ventas } = normalizarPcel(rows || []);
        ventas.forEach((v) => add(v.sku, v.anio, v.mes, v.piezas));
        return { series, fuente: 'sellout' };
      }
      if (cliente.propio) {
        const rows = await fetchAllQ(() => supabase.from('sellout_sku').select('anio,mes,sku,piezas').eq('cliente', cliente.key).gte('anio', anio - 2), { orderCol: 'id', label: 'sellout_sku' });
        (rows || []).forEach((r) => add(r.sku, r.anio, r.mes, r.piezas));
        if (series.size) return { series, fuente: 'sellout' };
      }
      const rows = await fetchAllQ(() => supabase.from('v_analisis_cliente_sku_mes').select('anio,mes,articulo,piezas_venta_neta').eq('cliente', cliente.codigo).gte('anio', anio - 2), { pageSize: 1000, orderCol: 'articulo', label: 'v_analisis_cliente_sku_mes' });
      (rows || []).forEach((r) => add(r.articulo, r.anio, r.mes, r.piezas_venta_neta));
      return { series, fuente: 'sellin' };
    },
  });
}

export function useStockForecast(cliente) {
  return useQuery({
    queryKey: ['forecast', 'stock', cliente?.key], staleTime: STALE, enabled: !!cliente?.propio,
    queryFn: async () => {
      const stock = new Map();
      if (cliente.key === 'pcel') {
        const { data: ult } = await cachedQuery(supabase.from('sellout_pcel').select('anio,semana').not('anio', 'is', null).order('anio', { ascending: false }).order('semana', { ascending: false }).limit(1));
        const u = ult?.[0]; if (!u) return stock;
        const rows = await fetchAll('sellout_pcel', 'sku,pcel_sku,inventario', (q) => q.eq('anio', u.anio).eq('semana', u.semana));
        const mapa = await fetchAll('pcel_sku_map', 'sku_pcel,sku_acteck');
        const aSku = new Map((mapa || []).map((x) => [String(x.sku_pcel), x.sku_acteck]));
        (rows || []).forEach((r) => { const sku = aSku.get(String(r.pcel_sku || r.sku)) || r.sku; if (sku) stock.set(sku, (stock.get(sku) || 0) + N(r.inventario)); });
        return stock;
      }
      const rows = await fetchAll('v_inventario_cliente_ultimo', 'sku,stock', (q) => q.eq('cliente', cliente.key));
      (rows || []).forEach((r) => { if (r.sku) stock.set(r.sku, (stock.get(r.sku) || 0) + N(r.stock)); });
      return stock;
    },
  });
}

export function useProyectosForecast(cliente) {
  return useQuery({
    queryKey: ['forecast', 'proyectos', cliente?.key], staleTime: 60 * 1000, enabled: !!cliente?.propio,
    queryFn: async () => {
      const { data: proys, error } = await supabase.from('proyectos').select('id,nombre,anio,mes,probabilidad').eq('cliente', cliente.key).in('probabilidad', ['probable', 'confirmado']);
      if (error) throw error;
      if (!proys?.length) return [];
      const { data: lineas, error: e2 } = await supabase.from('proyecto_lineas').select('proyecto_id,sku,piezas').in('proyecto_id', proys.map((p) => p.id));
      if (e2) throw e2;
      const porId = new Map(proys.map((p) => [p.id, p]));
      return (lineas || []).map((l) => { const p = porId.get(l.proyecto_id); return p && p.anio && p.mes ? { sku: l.sku, key: mesKey(p.anio, p.mes), piezas: N(l.piezas), nombre: p.nombre, probabilidad: p.probabilidad } : null; }).filter(Boolean);
    },
  });
}

export function useForecastExistente(codigo) {
  return useQuery({
    queryKey: ['forecast', 'existente', codigo], staleTime: STALE, enabled: !!codigo,
    queryFn: async () => {
      const rows = await fetchAll('forecast_crm_existente', 'sku,mes,piezas,estado,kam,capturado_at', (q) => q.eq('cliente_codigo', codigo));
      const skus = new Set((rows || []).map((r) => r.sku));
      const capturado = (rows || []).reduce((m, r) => (r.capturado_at > m ? r.capturado_at : m), '');
      return { skus, filas: rows || [], piezas: (rows || []).reduce((s, r) => s + N(r.piezas), 0), capturado };
    },
  });
}

export function useClientesErp() {
  const anio = new Date().getFullYear();
  return useQuery({
    queryKey: ['forecast', 'clientes_erp', anio], staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const rows = await fetchAll('v_analisis_cliente_mes', 'cliente,cliente_nombre,cliente_key,fact_neta', (q) => q.eq('anio', anio));
      const m = new Map();
      for (const r of rows || []) { if (!r.cliente || r.cliente_key) continue; const o = m.get(r.cliente) || { codigo: r.cliente, nombre: r.cliente_nombre || r.cliente, fact: 0 }; o.fact += N(r.fact_neta); m.set(r.cliente, o); }
      return [...m.values()].filter((c) => c.fact > 0).sort((a, b) => b.fact - a.fact);
    },
  });
}
