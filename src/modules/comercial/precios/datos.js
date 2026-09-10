// Estrategia de Precios · carga de datos (SOLO vía lib/queries.js: fetchAll paralelo + cache 5 min).
// Base de la pantalla: roadmap (useRoadmap, cache compartido), v_estrategia_precios_lista (1 fila sku+lista),
// v_estrategia_precios_bajo (cliente facturado más bajo por SKU), promos del mes, v_precios_cambios_mes
// (último precio vs mes anterior con dato) y, sólo con permiso sensible, costo promedio de v_inventario_comercial.
// Drill por SKU: carga al abrir (useQuery por sku): facturación 2 años, precios_historico, promos, inventario y tránsito.
// Segundo paso del drill (bajo demanda, al abrir):
//   · useElasticidadCategoria(categoria, skus): v_precios_cambios de los SKUs de la categoría + su facturación por
//     sku/mes (v_sellin_global_sku_canal_mes) → elasticidad por categoría (calculo.js). Vacío con 1 mes de histórico.
//   · useCompetencia(sku) / useSupuesto(categoria): tablas que la app ESCRIBE → sin cachedQuery ni fetchAll
//     (supabase directo) y, tras escribir, invalidateDataCache() + invalidación de su queryKey.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { fetchAll, cachedQuery, useRoadmap, invalidateDataCache } from '../../../lib/queries';
import { cambiosPorSku, factPorSku, elasticidadPorCategoria } from './calculo';

const STALE = 5 * 60 * 1000;
const MAX_SKUS_IN = 200; // tope del .in('sku', …) por URL

export function useDatosPrecios(sensible) {
  const roadmap = useRoadmap();
  const base = useQuery({
    queryKey: ['precios', 'base', !!sensible],
    staleTime: STALE,
    queryFn: async () => {
      const hoy = new Date();
      const [precios, bajos, promos, cambios, costos, desde] = await Promise.all([
        fetchAll('v_estrategia_precios_lista', 'sku,lista,precio,anio,mes'),
        fetchAll('v_estrategia_precios_bajo', 'sku,cliente_bajo,precio_bajo,piezas_bajo'),
        fetchAll('promos_temporada', 'sku,campania,promo_pct,anio,mes,descripcion', (q) => q.eq('anio', hoy.getFullYear()).eq('mes', hoy.getMonth() + 1)),
        fetchAll('v_precios_cambios_mes', 'sku,lista,anio,mes,precio_actual,precio_anterior,anio_prev,mes_prev,delta_pct,tipo'),
        sensible ? fetchAll('v_inventario_comercial', 'sku,costo_promedio,disponible') : Promise.resolve([]),
        cachedQuery(supabase.from('precios_historico').select('primera_vez').order('primera_vez', { ascending: true }).limit(1).maybeSingle()),
      ]);
      return { precios, bajos, promos, cambios, costos, historicoDesde: desde?.data?.primera_vez || null };
    },
  });
  return {
    roadmap: roadmap.data || [],
    datos: base.data,
    loading: roadmap.isLoading || base.isLoading,
    error: roadmap.error || base.error,
  };
}

export function useDrillPrecios(sku) {
  const anio = new Date().getFullYear();
  return useQuery({
    queryKey: ['precios', 'drill', sku],
    enabled: !!sku,
    staleTime: STALE,
    queryFn: async () => {
      const [fact, historico, promosHist, inv, tr] = await Promise.all([
        fetchAll('facturacion_clientes', 'anio,mes,cliente_nombre,cliente_key,canal,piezas,monto', (q) => q.eq('sku', sku).in('anio', [anio, anio - 1])),
        fetchAll('precios_historico', 'lista,anio,mes,precio,moneda,primera_vez,ultima_vez', (q) => q.eq('sku', sku)),
        fetchAll('promos_temporada', 'anio,mes,campania,promo_pct', (q) => q.eq('sku', sku)),
        cachedQuery(supabase.from('v_inventario_comercial').select('sku,disponible,inventario,costo_promedio').eq('sku', sku).maybeSingle()),
        cachedQuery(supabase.from('v_transito_sku').select('sku,cantidad,eta_mas_cercana,embarques,embarques_detalle').eq('sku', sku).maybeSingle()),
      ]);
      return { fact: fact || [], historico: historico || [], promosHist: promosHist || [], inv: inv?.data || null, tr: tr?.data || null };
    },
  });
}

/**
 * Elasticidad de la categoría del SKU abierto: todos los cambios de precio (v_precios_cambios, pequeña: sólo
 * cambios) de los SKUs de la categoría + piezas por sku/mes de esos SKUs (sólo los que tienen cambios, ≤ 200).
 * Devuelve { data: { elasticidad, n, skus } | null } — null cuando ningún SKU de la categoría tiene ventana cerrada.
 */
export function useElasticidadCategoria(categoria, skusCategoria, lista = 'Mayoreo AAA') {
  const anio = new Date().getFullYear();
  const skusKey = (skusCategoria || []).length;
  return useQuery({
    queryKey: ['precios', 'elasticidad-cat', categoria, lista, skusKey],
    enabled: !!categoria && skusKey > 0,
    staleTime: STALE,
    queryFn: async () => {
      const set = new Set(skusCategoria);
      const cambios = (await fetchAll('v_precios_cambios', 'sku,lista,anio,mes,precio_nuevo,precio_anterior', (q) => q.eq('lista', lista))).filter((c) => set.has(c.sku));
      if (!cambios.length) return null;
      const skus = [...new Set(cambios.map((c) => c.sku))].slice(0, MAX_SKUS_IN);
      const fact = await fetchAll('v_sellin_global_sku_canal_mes', 'sku,anio,mes,piezas', (q) => q.in('sku', skus).gte('anio', anio - 2));
      const porCat = elasticidadPorCategoria({ cambiosPorSku: cambiosPorSku(cambios), factPorSku: factPorSku(fact), categoriaDe: () => categoria, lista });
      return porCat.get(categoria) || null;
    },
  });
}

// ── Competencia (tabla escrita por la app: sin cache de datos) ──
const COLS_COMP = 'id,sku,competidor,marca,modelo,especificaciones,precio,moneda,fuente,url,fecha,comentario,created_at,updated_at';

export function useCompetencia(sku) {
  return useQuery({
    queryKey: ['precios', 'competencia', sku],
    enabled: !!sku,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('precios_competencia').select(COLS_COMP).eq('sku', sku).order('fecha', { ascending: false }).order('id', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCompetenciaMutaciones(sku) {
  const qc = useQueryClient();
  const listo = async () => { await invalidateDataCache(); await qc.invalidateQueries({ queryKey: ['precios', 'competencia', sku] }); };
  return {
    async guardar(fila) {
      const payload = {
        sku, competidor: String(fila.competidor || '').trim(), marca: fila.marca?.trim() || null, modelo: fila.modelo?.trim() || null,
        especificaciones: fila.especificaciones?.trim() || null, precio: Number(fila.precio), moneda: fila.moneda || 'MXN',
        fuente: fila.fuente?.trim() || null, url: fila.url?.trim() || null, fecha: fila.fecha || new Date().toISOString().slice(0, 10), comentario: fila.comentario?.trim() || null,
      };
      const q = fila.id ? supabase.from('precios_competencia').update(payload).eq('id', fila.id) : supabase.from('precios_competencia').insert(payload);
      const { error } = await q;
      if (error) throw error;
      await listo();
    },
    async eliminar(id) {
      const { error } = await supabase.from('precios_competencia').delete().eq('id', id);
      if (error) throw error;
      await listo();
    },
  };
}

// ── Supuesto de elasticidad por categoría (tabla escrita por la app: sin cache de datos) ──
export function useSupuesto(categoria) {
  return useQuery({
    queryKey: ['precios', 'supuesto', categoria],
    enabled: !!categoria,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('elasticidad_supuestos').select('categoria,elasticidad,updated_at').eq('categoria', categoria).maybeSingle();
      if (error) throw error;
      return data || null;
    },
  });
}

export function useGuardarSupuesto(categoria) {
  const qc = useQueryClient();
  return async (elasticidad) => {
    const { error } = await supabase.from('elasticidad_supuestos').upsert({ categoria, elasticidad: Number(elasticidad), updated_at: new Date().toISOString() }, { onConflict: 'categoria' });
    if (error) throw error;
    await invalidateDataCache();
    await qc.invalidateQueries({ queryKey: ['precios', 'supuesto', categoria] });
  };
}
