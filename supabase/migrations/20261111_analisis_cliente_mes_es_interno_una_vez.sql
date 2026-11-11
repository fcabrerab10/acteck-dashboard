-- v_analisis_cliente_mes: es_interno() se evaluaba por fila en 11 columnas de costo (2.1 s por 2 años).
-- Con (select …) Postgres lo resuelve una vez por consulta (2026-11-11). Misma definición y mismas columnas.
create or replace view public.v_analisis_cliente_mes as
 SELECT anio,
    mes,
    cliente,
    cliente_nombre,
    cliente_key,
    canal,
    fact_bruta,
    devoluciones,
    rmas,
    bonificaciones,
        CASE
            WHEN (SELECT public.es_interno()) THEN costo_fact_bruta
            ELSE NULL::numeric
        END AS costo_fact_bruta,
        CASE
            WHEN (SELECT public.es_interno()) THEN costo_devoluciones
            ELSE NULL::numeric
        END AS costo_devoluciones,
        CASE
            WHEN (SELECT public.es_interno()) THEN costo_rmas
            ELSE NULL::numeric
        END AS costo_rmas,
    piezas_venta_neta,
    renglones,
    fact_neta,
    venta_neta,
        CASE
            WHEN (SELECT public.es_interno()) THEN costo_fact_neta
            ELSE NULL::numeric
        END AS costo_fact_neta,
        CASE
            WHEN (SELECT public.es_interno()) THEN costo_venta_neta
            ELSE NULL::numeric
        END AS costo_venta_neta,
        CASE
            WHEN (SELECT public.es_interno()) THEN contribucion
            ELSE NULL::numeric
        END AS contribucion,
        CASE
            WHEN (SELECT public.es_interno()) THEN contribucion_bruta
            ELSE NULL::numeric
        END AS contribucion_bruta,
        CASE
            WHEN (SELECT public.es_interno()) THEN utilidad_comercial
            ELSE NULL::numeric
        END AS utilidad_comercial,
        CASE
            WHEN (SELECT public.es_interno()) THEN pct_mc
            ELSE NULL::numeric
        END AS pct_mc,
        CASE
            WHEN (SELECT public.es_interno()) THEN pct_muc
            ELSE NULL::numeric
        END AS pct_muc,
    pct_ajustes
   FROM ( SELECT t.anio,
            t.mes,
            t.cliente,
            t.cliente_nombre,
            t.cliente_key,
            t.canal,
            round(t.fact_bruta, 2) AS fact_bruta,
            round(t.devoluciones, 2) AS devoluciones,
            round(t.rmas, 2) AS rmas,
            round(t.bonificaciones, 2) AS bonificaciones,
            round(t.costo_fact_bruta, 2) AS costo_fact_bruta,
            round(t.costo_devoluciones, 2) AS costo_devoluciones,
            round(t.costo_rmas, 2) AS costo_rmas,
            round(t.piezas_venta_neta, 2) AS piezas_venta_neta,
            t.renglones,
            round(t.fact_neta, 2) AS fact_neta,
            round(t.venta_neta, 2) AS venta_neta,
            round(t.costo_fact_neta, 2) AS costo_fact_neta,
            round(t.costo_venta_neta, 2) AS costo_venta_neta,
            round(t.contribucion, 2) AS contribucion,
            round(t.contribucion_bruta, 2) AS contribucion_bruta,
            round(t.utilidad_comercial, 2) AS utilidad_comercial,
            round(t.pct_mc, 2) AS pct_mc,
            round(t.pct_muc, 2) AS pct_muc,
            round(t.pct_ajustes, 2) AS pct_ajustes
           FROM ( SELECT m.anio,
                    m.mes,
                    m.cliente,
                    m.cliente_nombre,
                    m.cliente_key,
                    m.canal,
                    m.fact_bruta,
                    m.devoluciones,
                    m.rmas,
                    m.bonificaciones,
                    m.costo_fact_bruta,
                    m.costo_devoluciones,
                    m.costo_rmas,
                    m.piezas_venta_neta,
                    m.renglones,
                    m.fact_neta,
                    m.venta_neta,
                    m.costo_fact_neta,
                    m.costo_venta_neta,
                    m.contribucion,
                    m.contribucion_bruta,
                    m.utilidad_comercial,
                        CASE
                            WHEN (m.fact_neta <> (0)::numeric) THEN (m.contribucion / m.fact_neta)
                            ELSE NULL::numeric
                        END AS pct_mc,
                        CASE
                            WHEN (m.venta_neta <> (0)::numeric) THEN (m.utilidad_comercial / m.venta_neta)
                            ELSE NULL::numeric
                        END AS pct_muc,
                        CASE
                            WHEN (m.fact_bruta <> (0)::numeric) THEN (((m.devoluciones + m.rmas) + m.bonificaciones) / m.fact_bruta)
                            ELSE NULL::numeric
                        END AS pct_ajustes
                   FROM mv_analisis_cliente_mes m) t) _v
  WHERE (es_interno() OR cliente_visible(cliente_key));
