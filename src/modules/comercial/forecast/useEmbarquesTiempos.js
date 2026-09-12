// Tiempos reales y costo de flete de importación (embarques_compras → vistas agregadas en Postgres).
// Lo comparten S&OP (Panel "Proveedores y navieras") e Inventario global (Próximos arribos).
//
// Reglas que ya resuelve Postgres (migración 20260912_embarques_tiempos.sql) y aquí NO se repiten:
//   · el flete está capturado por CONTENEDOR (no por renglón): las vistas lo deduplican;
//   · las fechas imposibles del Master Embarques se descartan;
//   · los días de tránsito/total sólo cuentan contenedores YA arribados (tiempo real, no planeado);
//   · mediana (percentile_cont) además del promedio.
// Aquí sólo se baja el año pedido (~50 filas) y se arma el resumen para la cabecera.
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { cachedQuery } from '../../../lib/queries';

const N = (v) => (v == null ? null : Number(v));
// cachedQuery lanza si PostgREST responde error (vista no desplegada todavía): aquí nunca rompe la pantalla.
const seguro = (b) => cachedQuery(b).catch((e) => { console.warn('[embarques-tiempos]', e?.message || e); return { data: [] }; });

/** Nombre corto de proveedor: quita sufijos legales para que quepa en una tabla o fila del móvil. */
export function nombreProveedor(s) {
  return String(s || '')
    .replace(/\b(CO\.?,?\s*LTD\.?|CO\.?,?\s*LIMITED|LIMITED|LTD\.?|S\.?A\.?\s*DE\s*C\.?V\.?|INC\.?|CORPORATION|COORPORATION|TECHNOLOGY|TECHONOLOGY|INDUSTRIAL|TRADING)\b/gi, ' ')
    .replace(/[.,]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Resumen de una lista de filas de v_embarques_proveedor / v_embarques_naviera. */
export function resumen(filas) {
  if (!filas?.length) return { embarques: 0, cbm: 0, fleteUsd: 0, usdPorCbm: null, fobUsd: 0, transitoMed: null, totalMed: null };
  const suma = (k) => filas.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  const fleteMedido = suma('flete_medido_usd');
  const cbmMedido = suma('cbm_medido');
  // Mediana ponderada por muestras: se aproxima con el promedio de las medianas pesado por n_transito.
  const pond = (col, peso) => {
    const conDato = filas.filter((r) => r[col] != null && Number(r[peso]) > 0);
    const w = conDato.reduce((a, r) => a + Number(r[peso]), 0);
    return w ? conDato.reduce((a, r) => a + Number(r[col]) * Number(r[peso]), 0) / w : null;
  };
  return {
    embarques: suma('embarques'),
    cbm: suma('cbm'),
    fobUsd: suma('fob_usd'),
    fleteUsd: suma('flete_usd'),
    usdPorCbm: cbmMedido > 0 ? fleteMedido / cbmMedido : null,
    transitoMed: pond('dias_transito_med', 'n_transito'),
    totalMed: pond('dias_total_med', 'n_transito'),
  };
}

/**
 * @param {number} anio  año de ETD a consultar (default: el actual)
 * @param {boolean} activo  false = no consulta (paneles plegados)
 */
export function useEmbarquesTiempos(anio = new Date().getFullYear(), activo = true) {
  const [state, setState] = useState({ loading: activo, proveedores: [], navieras: [], meses: [] });

  useEffect(() => {
    if (!activo) return undefined;
    let vivo = true;
    (async () => {
      setState((s) => ({ ...s, loading: true }));
      const [prov, nav, mes] = await Promise.all([
        seguro(supabase.from('v_embarques_proveedor')
          .select('supplier, anio, embarques, pos, piezas, fob_usd, flete_usd, cbm, usd_por_cbm, flete_medido_usd, cbm_medido, dias_produccion_med, dias_transito_med, dias_puerto_med, dias_total_med, n_transito, n_produccion')
          .eq('anio', anio).order('fob_usd', { ascending: false })),
        seguro(supabase.from('v_embarques_naviera')
          .select('naviera, anio, contenedores, piezas, cbm, flete_usd, usd_por_cbm, flete_medido_usd, cbm_medido, dias_transito_med, dias_puerto_med, n_transito')
          .eq('anio', anio).order('contenedores', { ascending: false })),
        seguro(supabase.from('v_embarques_mes')
          .select('anio, mes, embarques, fob_usd, flete_usd, cbm, usd_por_cbm, dias_transito_med')
          .eq('anio', anio).order('mes')),
      ]);
      if (!vivo) return;
      setState({
        loading: false,
        proveedores: (prov?.data || []).map((r) => ({ ...r, fob_usd: N(r.fob_usd), flete_usd: N(r.flete_usd), cbm: N(r.cbm) })),
        navieras: nav?.data || [],
        meses: mes?.data || [],
      });
    })();
    return () => { vivo = false; };
  }, [anio, activo]);

  return state;
}

/**
 * Mapa contenedor → naviera (v_embarques_contenedor, ~1.3 K filas).
 * Lo usa Inventario global para etiquetar la naviera de cada PO en camino.
 */
export function useNavieraPorContenedor(activo = true) {
  const [mapa, setMapa] = useState(() => new Map());
  useEffect(() => {
    if (!activo) return undefined;
    let vivo = true;
    seguro(supabase.from('v_embarques_contenedor').select('contenedor, naviera, etd, tipo_contenedor').not('naviera', 'is', null))
      .then((r) => {
        if (!vivo) return;
        setMapa(new Map((r?.data || []).map((x) => [x.contenedor, x.naviera])));
      });
    return () => { vivo = false; };
  }, [activo]);
  return mapa;
}
