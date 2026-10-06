// Cliente propio en el celular · datos chicos del Resumen (React Query). 2026-10-06.
// Lo grande (sell in mensual y por SKU, sell out de la cuenta, inventario en su piso) viene de los hooks que ya usan
// Análisis por cliente y Sell Out: analisis/datos.js, analisis/useAnalisisData.js y sellout/datos.js.
import { useQuery } from '@tanstack/react-query';
import { supabase, DB_CONFIGURED } from '../../../lib/supabase';
import { cachedQuery } from '../../../lib/queries';

const STALE = 5 * 60 * 1000;
const lanzar = ({ data, error }) => { if (error) throw error; return data || []; };

/** Último corte del estado de cuenta + su detalle (para el próximo vencimiento). Tablas cargadas por el importador → cachedQuery. */
export function useCobranzaResumen(ck, enabled = true) {
  return useQuery({
    queryKey: ['movil', 'cliente', 'cobranza', ck], staleTime: STALE, enabled: !!ck && enabled && DB_CONFIGURED,
    queryFn: async () => {
      const cortes = lanzar(await cachedQuery(supabase.from('estados_cuenta').select('id,cliente,anio,semana,fecha_corte,saldo_actual,saldo_vencido,saldo_a_vencer,dso').eq('cliente', ck).order('anio', { ascending: false }).order('semana', { ascending: false }).limit(8)));
      const c = cortes[0];
      const detalle = c ? lanzar(await cachedQuery(supabase.from('estados_cuenta_detalle').select('vencimiento,saldo_actual').eq('estado_cuenta_id', c.id))) : [];
      return { cortes, detalle };
    },
  });
}

/** Pagos y rebates del cliente (la app los escribe → supabase directo, sin cachedQuery). */
export function usePagosCliente(ck, enabled = true) {
  return useQuery({
    queryKey: ['movil', 'cliente', 'pagos', ck], staleTime: 60 * 1000, enabled: !!ck && enabled && DB_CONFIGURED,
    queryFn: async () => lanzar(await supabase.from('pagos').select('id,cliente,tipo,concepto,descripcion,monto,estado,fecha_programada,fecha_limite,periodo,folio').eq('cliente', ck).order('fecha_programada', { ascending: true }).limit(200)),
  });
}

/** Acuerdos y pendientes abiertos con #cliente en la Agenda (la app los escribe). */
export function useAcuerdosCliente(ck, enabled = true) {
  return useQuery({
    queryKey: ['movil', 'cliente', 'acuerdos', ck], staleTime: 60 * 1000, enabled: !!ck && enabled && DB_CONFIGURED,
    queryFn: async () => { try { return lanzar(await supabase.from('agenda_items').select('id,titulo,estado,cliente_key,cuando,tipo').eq('cliente_key', ck).eq('estado', 'abierta').order('cuando', { ascending: true, nullsFirst: false }).limit(50)); } catch { return []; } },
  });
}

/** Actividades de marketing del año (la app las escribe). */
export function useMarketingCliente(ck, anio, enabled = true) {
  return useQuery({
    queryKey: ['movil', 'cliente', 'marketing', ck, anio], staleTime: 60 * 1000, enabled: !!ck && enabled && DB_CONFIGURED,
    queryFn: async () => { try { return lanzar(await supabase.from('marketing_actividades').select('id,nombre,tipo,fecha,inversion,estado,completada').eq('cliente', ck).eq('anio', anio)); } catch { return []; } },
  });
}

/** Nuestro disponible para una lista de SKUs (para topar «Qué le falta» a lo que tenemos). */
export function useNuestroStock(skus = [], enabled = true) {
  const lista = [...new Set(skus.filter(Boolean))].sort();
  return useQuery({
    queryKey: ['movil', 'cliente', 'nuestro', lista.join(',')], staleTime: STALE, enabled: enabled && lista.length > 0 && DB_CONFIGURED,
    queryFn: async () => {
      const m = new Map();
      for (let i = 0; i < lista.length; i += 200) {
        const rows = lanzar(await cachedQuery(supabase.from('v_inventario_comercial').select('sku,disponible').in('sku', lista.slice(i, i + 200))));
        for (const r of rows) m.set(r.sku, (m.get(r.sku) || 0) + (Number(r.disponible) || 0));
      }
      return m;
    },
  });
}

/** Ensambles por modelo (sólo Digitalife): PCs armadas con nuestros componentes. */
export function useEnsamblesModelo(ck, enabled = true) {
  return useQuery({
    queryKey: ['movil', 'cliente', 'ensambles', ck], staleTime: STALE, enabled: ck === 'digitalife' && enabled && DB_CONFIGURED,
    queryFn: async () => { try { return lanzar(await cachedQuery(supabase.from('v_sellout_ensambles_modelo').select('ensamble,sku,descripcion,marca,piezas,ensambles,primera_fecha,ultima_fecha,monto').eq('cliente', ck))); } catch { return []; } },
  });
}

/** Pagos del cliente propio: pagos (la app los escribe), fondos y reglas vigentes. */
export function usePagosPropio(ck, enabled = true) {
  return useQuery({
    queryKey: ['movil', 'cliente', 'pagos-propio', ck], staleTime: 60 * 1000, enabled: !!ck && enabled && DB_CONFIGURED,
    queryFn: async () => {
      const [pagos, fondos, reglas] = await Promise.all([
        supabase.from('pagos').select('*').eq('cliente', ck).order('fecha_programada', { ascending: true }),
        supabase.from('v_pagos_fondos_saldo').select('*').eq('cliente', ck),
        supabase.from('pagos_reglas').select('id,cliente,seccion,config,vigente_desde,vigente_hasta').is('vigente_hasta', null),
      ]);
      if (pagos.error) throw pagos.error;
      return { pagos: pagos.data || [], fondos: fondos.data || [], reglas: reglas.data || [] };
    },
  });
}
