// Resumen de Clientes · carga de datos (una sola vez; el periodo se aplica en calculo.js).
// Todo pasa por src/lib/queries.js (paginación paralela + cache 5 min). Las tablas que la app
// escribe (cuotas_mensuales, clientes_credito_config) se leen directo, sin cache.
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { fetchAllQ, cachedQuery } from '../../../lib/queries';
import { CLIENTE_KEYS, anioActual, opcionesPeriodo, finDeMes } from './calculo';

const VACIO = {
  loading: true,
  ventasMes: [],            // v_fact_cliente_mes · todos los clientes (share vs empresa + tendencia)
  facturacion: [],          // facturacion_clientes · sólo los 3 (costo por SKU + top SKUs del mes)
  cuotas: [],
  creditoConfig: [],
  selloutSku: [],
  selloutPcelMensual: [],
  selloutPcel: [],          // semanal: inventario + costo_promedio por semana (snapshot PCEL)
  inventarioCliente: [],
  estadosCuenta: [],
  estadosCuentaDetalle: [],
};

/** Por cliente y por cada uno de los 12 periodos, el corte más cercano ≤ fin de mes → ids únicos. */
function cortesNecesarios(estadosCuenta) {
  const ids = new Set();
  for (const k of CLIENTE_KEYS) {
    const ec = estadosCuenta.filter((r) => r.cliente === k && r.fecha_corte);
    for (const p of opcionesPeriodo()) {
      const fin = finDeMes(p).getTime();
      const best = ec.reduce((b, r) => (new Date(r.fecha_corte).getTime() <= fin && (!b || r.fecha_corte > b.fecha_corte) ? r : b), null);
      if (best) ids.add(best.id);
    }
  }
  return [...ids];
}

export function useResumenData() {
  const [state, setState] = useState(VACIO);

  useEffect(() => {
    let vivo = true;
    const t0 = performance.now();
    const desde = new Date(); desde.setMonth(desde.getMonth() - 14);
    const desdeIso = desde.toISOString().slice(0, 10);
    const q = (f, o) => fetchAllQ(f, { pageSize: 1000, label: 'resumen', ...o });

    (async () => {
      const [ventasMes, facturacion, cuotasRes, ccRes, selloutSku, selloutPcelMensual, selloutPcel, inventarioCliente, estadosCuenta] = await Promise.all([
        q(() => supabase.from('v_fact_cliente_mes').select('cliente_key, anio, mes, monto').gte('anio', anioActual - 2), { orderCol: 'cliente_key' }),
        q(() => supabase.from('facturacion_clientes').select('cliente_key, sku, piezas, monto, anio, mes').in('cliente_key', CLIENTE_KEYS).gte('anio', anioActual - 1)),
        supabase.from('cuotas_mensuales').select('cliente, mes, anio, cuota_min, cuota_ideal').in('cliente', CLIENTE_KEYS).gte('anio', anioActual - 2),
        supabase.from('clientes_credito_config').select('cliente, plazo_dias_credito, linea_credito_usd').in('cliente', CLIENTE_KEYS),
        q(() => supabase.from('sellout_sku').select('cliente, anio, mes, monto_pesos').in('cliente', CLIENTE_KEYS).gte('anio', anioActual - 2)),
        // PCEL: valuación ÚNICA (piezas × precio de lista PCEL PROVISIONAL) desde la vista oficial.
        q(() => supabase.from('v_sellout_pcel_sku_mes').select('sku, anio, mes, piezas, monto').gte('anio', anioActual - 1)),
        q(() => supabase.from('sellout_pcel').select('sku, anio, semana, inventario, costo_promedio').gte('anio', anioActual - 1)),
        q(() => supabase.from('inventario_cliente').select('cliente, sku, stock, valor, costo_convenio, anio, semana').in('cliente', CLIENTE_KEYS).not('anio', 'is', null)),
        q(() => supabase.from('estados_cuenta').select('id, cliente, fecha_corte, saldo_actual, saldo_vencido, dso, aging_mas90').in('cliente', CLIENTE_KEYS).gte('fecha_corte', desdeIso)),
      ]);

      // Detalle sólo de los cortes que algún periodo va a usar (≤ 36 ids).
      const ids = cortesNecesarios(estadosCuenta || []);
      const detalle = [];
      for (let i = 0; i < ids.length; i += 100) {
        const slice = ids.slice(i, i + 100);
        const det = await q(() => supabase.from('estados_cuenta_detalle')
          .select('estado_cuenta_id, fecha_emision, saldo_actual')
          .in('estado_cuenta_id', slice).gt('saldo_actual', 0));
        detalle.push(...(det || []));
      }
      if (!vivo) return;
      if (import.meta.env.DEV) console.info(`[resumen] datos en ${Math.round(performance.now() - t0)} ms`);
      setState({
        loading: false,
        ventasMes: ventasMes || [],
        facturacion: facturacion || [],
        cuotas: cuotasRes?.data || [],
        creditoConfig: ccRes?.data || [],
        selloutSku: selloutSku || [],
        selloutPcelMensual: selloutPcelMensual || [],
        selloutPcel: selloutPcel || [],
        inventarioCliente: inventarioCliente || [],
        estadosCuenta: estadosCuenta || [],
        estadosCuentaDetalle: detalle,
      });
    })().catch((e) => { console.error('[resumen] carga', e); if (vivo) setState((s) => ({ ...s, loading: false })); });
    return () => { vivo = false; };
  }, []);

  return state;
}

/** Medidas del ERP (Fact Neta · Contribución) por cliente y mes. Sólo se pide con permiso sensible;
 *  corre aparte para no bloquear la pantalla. null mientras carga o sin permiso. */
export function useMedidasSensibles(enabled) {
  const [medidas, setMedidas] = useState(null);
  useEffect(() => {
    if (!enabled) { setMedidas(null); return; }
    let vivo = true;
    cachedQuery(
      supabase.from('v_erp_medidas_cliente_mes')
        .select('anio, mes, cliente_key, fact_neta, contribucion')
        .in('cliente_key', CLIENTE_KEYS).gte('anio', anioActual - 1).limit(200),
    ).then((r) => { if (vivo) setMedidas(r?.data || []); })
      .catch((e) => { console.error('[resumen] medidas', e); if (vivo) setMedidas([]); });
    return () => { vivo = false; };
  }, [enabled]);
  return medidas;
}
