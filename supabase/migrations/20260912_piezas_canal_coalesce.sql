-- 2026-09-12 · Piezas por canal salían en 0: faltaban dos lugares del
-- COALESCE(unidades, piezas, 0) de la migración 20260911_piezas_coalesce_unidades.sql.
--
-- La carga del ERP trae `Unidades` vacía desde el 2026-09-10, así que
--   · mv_erp_medidas_canal_mes.piezas_venta_neta  (sum(COALESCE(unidades, 0)))
--   · v_erp_medidas.piezas_fact_bruta             (idem)
-- devolvían 0 para TODOS los meses (verificado: 2026-01..09 = 0 piezas por canal,
-- con 107,854 piezas reales en agosto). El resto de las vistas y MVs de medidas ya
-- usaba el COALESCE de tres términos.
--
-- Se arrastraba a v_erp_medidas_canal_mes, v_medidas_ventas_canal_mes y a la
-- columna `piezas` de v_vision_margen_canal.
--
-- La MV no admite CREATE OR REPLACE: se recrea con su índice único y sus dos
-- vistas dependientes (definiciones idénticas a las actuales, sólo cambia el COALESCE).
-- Revertir = volver a ejecutar este archivo con el COALESCE de dos términos
-- (la definición anterior está al pie).

drop materialized view if exists public.mv_erp_medidas_canal_mes cascade;

create materialized view public.mv_erp_medidas_canal_mes as
SELECT anio,
    mes,
    canal,
    fact_bruta,
    devoluciones,
    rmas,
    bonificaciones,
    costo_fact_bruta,
    costo_devoluciones,
    costo_rmas,
    piezas_venta_neta,
    renglones,
    fact_bruta + devoluciones AS fact_neta,
    fact_bruta + devoluciones + rmas + bonificaciones AS venta_neta,
    costo_fact_bruta + costo_devoluciones AS costo_fact_neta,
    costo_fact_bruta + costo_devoluciones + costo_rmas AS costo_venta_neta,
    fact_bruta + devoluciones - (costo_fact_bruta + costo_devoluciones) AS contribucion,
    fact_bruta - costo_fact_bruta AS contribucion_bruta,
    fact_bruta + devoluciones + rmas + bonificaciones - (costo_fact_bruta + costo_devoluciones + costo_rmas) AS utilidad_comercial
   FROM ( SELECT erp_ventas.anio,
            erp_ventas.mes,
            COALESCE(NULLIF(TRIM(BOTH FROM erp_ventas.canal), ''::text), 'otros'::text) AS canal,
            sum(
                CASE
                    WHEN erp_ventas.movimiento_venta = ANY (ARRAY['Factura'::text, 'Factura Com.Ext33'::text]) THEN COALESCE(erp_ventas.monto_venta_pesos, 0::numeric)
                    ELSE 0::numeric
                END) AS fact_bruta,
            sum(
                CASE
                    WHEN erp_ventas.movimiento_venta = 'Devolucion Venta'::text AND COALESCE(erp_ventas.instruccion, ''::text) !~~* 'nota credito'::text THEN COALESCE(erp_ventas.monto_venta_pesos, 0::numeric)
                    ELSE 0::numeric
                END) AS devoluciones,
            sum(
                CASE
                    WHEN erp_ventas.movimiento_venta = 'Devolucion Venta'::text AND erp_ventas.instruccion ~~* 'nota credito'::text THEN COALESCE(erp_ventas.monto_venta_pesos, 0::numeric)
                    ELSE 0::numeric
                END) AS rmas,
            sum(
                CASE
                    WHEN erp_ventas.movimiento_venta = 'Bonificacion Venta'::text THEN COALESCE(erp_ventas.monto_venta_pesos, 0::numeric)
                    ELSE 0::numeric
                END) AS bonificaciones,
            sum(
                CASE
                    WHEN erp_ventas.movimiento_venta = 'Factura'::text THEN COALESCE(erp_ventas.costo_venta_pesos, 0::numeric)
                    ELSE 0::numeric
                END) AS costo_fact_bruta,
            sum(
                CASE
                    WHEN erp_ventas.movimiento_venta = 'Devolucion Venta'::text AND COALESCE(erp_ventas.instruccion, ''::text) !~~* 'nota credito'::text THEN COALESCE(erp_ventas.costo_venta_pesos, 0::numeric)
                    ELSE 0::numeric
                END) AS costo_devoluciones,
            sum(
                CASE
                    WHEN erp_ventas.movimiento_venta = 'Devolucion Venta'::text AND erp_ventas.instruccion ~~* 'nota credito'::text THEN COALESCE(erp_ventas.costo_venta_pesos, 0::numeric)
                    ELSE 0::numeric
                END) AS costo_rmas,
            sum(COALESCE(erp_ventas.unidades, erp_ventas.piezas, 0::numeric)) AS piezas_venta_neta,
            count(*)::integer AS renglones
           FROM erp_ventas
          WHERE erp_ventas.anio IS NOT NULL AND erp_ventas.mes IS NOT NULL
          GROUP BY erp_ventas.anio, erp_ventas.mes, (COALESCE(NULLIF(TRIM(BOTH FROM erp_ventas.canal), ''::text), 'otros'::text))) s;

create unique index mv_erp_medidas_canal_mes_pk
    on public.mv_erp_medidas_canal_mes using btree (anio, mes, canal);

grant select on public.mv_erp_medidas_canal_mes to authenticated, anon, service_role;

create or replace view public.v_erp_medidas_canal_mes as
SELECT anio,
    mes,
    canal,
    fact_bruta,
    devoluciones,
    rmas,
    bonificaciones,
    costo_fact_bruta,
    costo_devoluciones,
    costo_rmas,
    piezas_venta_neta,
    renglones,
    fact_neta,
    venta_neta,
    costo_fact_neta,
    costo_venta_neta,
    contribucion,
    contribucion_bruta,
    utilidad_comercial,
        CASE
            WHEN fact_neta <> 0::numeric THEN contribucion / fact_neta
            ELSE NULL::numeric
        END AS pct_mc,
        CASE
            WHEN venta_neta <> 0::numeric THEN utilidad_comercial / venta_neta
            ELSE NULL::numeric
        END AS pct_muc
   FROM mv_erp_medidas_canal_mes m;
grant select on public.v_erp_medidas_canal_mes to authenticated, anon, service_role;

create or replace view public.v_medidas_ventas_canal_mes as
SELECT anio,
    mes,
    canal,
    fact_bruta,
    devoluciones,
    rmas,
    bonificaciones,
    fact_neta,
    venta_neta,
    costo_fact_bruta,
    costo_devoluciones,
    costo_rmas,
    costo_fact_neta,
    costo_venta_neta,
    contribucion,
    contribucion_bruta,
    utilidad_comercial,
    piezas_venta_neta,
    renglones,
    devoluciones - costo_devoluciones AS perdida_devoluciones,
    rmas - costo_rmas AS perdida_rmas,
    sum(costo_venta_neta) OVER (PARTITION BY canal ORDER BY anio, mes ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING) AS cv_ultimos_3_meses,
    sum(costo_venta_neta) OVER (PARTITION BY canal, anio ORDER BY mes) AS ytd_costo_venta,
        CASE
            WHEN piezas_venta_neta <> 0::numeric THEN venta_neta / piezas_venta_neta
            ELSE NULL::numeric
        END AS ticket_promedio,
        CASE
            WHEN piezas_venta_neta <> 0::numeric THEN utilidad_comercial / piezas_venta_neta
            ELSE NULL::numeric
        END AS utilidad_promedio,
        CASE
            WHEN fact_neta <> 0::numeric THEN contribucion / fact_neta
            ELSE NULL::numeric
        END AS pct_mc,
        CASE
            WHEN fact_bruta <> 0::numeric THEN contribucion_bruta / fact_bruta
            ELSE NULL::numeric
        END AS pct_mc_bruta,
        CASE
            WHEN venta_neta <> 0::numeric THEN utilidad_comercial / venta_neta
            ELSE NULL::numeric
        END AS pct_muc
   FROM mv_erp_medidas_canal_mes m;
grant select on public.v_medidas_ventas_canal_mes to authenticated, anon, service_role;

-- v_vision_margen_canal se cayó con el CASCADE: se recrea igual que en
-- 20260912_vision_margen_canal_erp.sql.
create or replace view public.v_vision_margen_canal as
select m.anio,
       m.mes,
       m.canal,
       m.canal                                as admin_interna,
       round(m.venta_neta, 2)                 as venta,
       round(m.costo_venta_neta, 2)           as costo,
       round(m.utilidad_comercial, 2)         as margen_bruto,
       m.piezas_venta_neta::integer           as piezas
  from public.v_medidas_ventas_canal_mes m
 where m.canal is not null
   and m.canal <> 'x'
   and m.anio is not null
   and m.mes between 1 and 12;
comment on view public.v_vision_margen_canal is
  'Margen por canal y mes. Desde 2026-09-12 sale de v_medidas_ventas_canal_mes (erp_ventas), no de la tabla vieja ventas_erp. admin_interna = canal porque erp_ventas no trae esa dimension.';
grant select on public.v_vision_margen_canal to authenticated, anon, service_role;

-- v_erp_medidas (vista viva por SKU): misma corrección en piezas_fact_bruta.
create or replace view public.v_erp_medidas as
SELECT anio,
    mes,
    cliente_key,
    cliente_nombre,
    canal,
    articulo,
    marca,
    fact_bruta,
    devoluciones,
    rmas,
    bonificaciones,
    costo_fact_bruta,
    costo_devoluciones,
    costo_rmas,
    piezas_venta_neta,
    piezas_fact_bruta,
    renglones,
    fact_bruta + devoluciones AS fact_neta,
    fact_bruta + devoluciones + rmas + bonificaciones AS venta_neta,
    costo_fact_bruta + costo_devoluciones AS costo_fact_neta,
    costo_fact_bruta + costo_devoluciones + costo_rmas AS costo_venta_neta,
    fact_bruta + devoluciones - (costo_fact_bruta + costo_devoluciones) AS contribucion,
    fact_bruta - costo_fact_bruta AS contribucion_bruta,
    fact_bruta + devoluciones + rmas + bonificaciones - (costo_fact_bruta + costo_devoluciones + costo_rmas) AS utilidad_comercial,
    devoluciones - costo_devoluciones AS perdida_devoluciones,
    rmas - costo_rmas AS perdida_rmas
   FROM ( SELECT erp_ventas.anio,
            erp_ventas.mes,
            erp_ventas.cliente_key,
            erp_ventas.cliente_nombre,
            erp_ventas.canal,
            erp_ventas.articulo,
            erp_ventas.marca,
            sum(
                CASE
                    WHEN erp_ventas.movimiento_venta = ANY (ARRAY['Factura'::text, 'Factura Com.Ext33'::text]) THEN COALESCE(erp_ventas.monto_venta_pesos, 0::numeric)
                    ELSE 0::numeric
                END) AS fact_bruta,
            sum(
                CASE
                    WHEN erp_ventas.movimiento_venta = 'Devolucion Venta'::text AND COALESCE(erp_ventas.instruccion, ''::text) !~~* 'nota credito'::text THEN COALESCE(erp_ventas.monto_venta_pesos, 0::numeric)
                    ELSE 0::numeric
                END) AS devoluciones,
            sum(
                CASE
                    WHEN erp_ventas.movimiento_venta = 'Devolucion Venta'::text AND erp_ventas.instruccion ~~* 'nota credito'::text THEN COALESCE(erp_ventas.monto_venta_pesos, 0::numeric)
                    ELSE 0::numeric
                END) AS rmas,
            sum(
                CASE
                    WHEN erp_ventas.movimiento_venta = 'Bonificacion Venta'::text THEN COALESCE(erp_ventas.monto_venta_pesos, 0::numeric)
                    ELSE 0::numeric
                END) AS bonificaciones,
            sum(
                CASE
                    WHEN erp_ventas.movimiento_venta = 'Factura'::text THEN COALESCE(erp_ventas.costo_venta_pesos, 0::numeric)
                    ELSE 0::numeric
                END) AS costo_fact_bruta,
            sum(
                CASE
                    WHEN erp_ventas.movimiento_venta = 'Devolucion Venta'::text AND COALESCE(erp_ventas.instruccion, ''::text) !~~* 'nota credito'::text THEN COALESCE(erp_ventas.costo_venta_pesos, 0::numeric)
                    ELSE 0::numeric
                END) AS costo_devoluciones,
            sum(
                CASE
                    WHEN erp_ventas.movimiento_venta = 'Devolucion Venta'::text AND erp_ventas.instruccion ~~* 'nota credito'::text THEN COALESCE(erp_ventas.costo_venta_pesos, 0::numeric)
                    ELSE 0::numeric
                END) AS costo_rmas,
            sum(COALESCE(erp_ventas.unidades, erp_ventas.piezas, 0::numeric)) AS piezas_venta_neta,
            sum(
                CASE
                    WHEN erp_ventas.movimiento_venta = ANY (ARRAY['Factura'::text, 'Factura Com.Ext33'::text]) THEN COALESCE(erp_ventas.unidades, erp_ventas.piezas, 0::numeric)
                    ELSE 0::numeric
                END) AS piezas_fact_bruta,
            count(*)::integer AS renglones
           FROM erp_ventas
          GROUP BY erp_ventas.anio, erp_ventas.mes, erp_ventas.cliente_key, erp_ventas.cliente_nombre, erp_ventas.canal, erp_ventas.articulo, erp_ventas.marca) s;
grant select on public.v_erp_medidas to authenticated, anon, service_role;

notify pgrst, 'reload schema';

-- ── Definición anterior de la MV (para revertir) ──────────────────────────
-- SELECT anio,
--     mes,
--     canal,
--     fact_bruta,
--     devoluciones,
--     rmas,
--     bonificaciones,
--     costo_fact_bruta,
--     costo_devoluciones,
--     costo_rmas,
--     piezas_venta_neta,
--     renglones,
--     fact_bruta + devoluciones AS fact_neta,
--     fact_bruta + devoluciones + rmas + bonificaciones AS venta_neta,
--     costo_fact_bruta + costo_devoluciones AS costo_fact_neta,
--     costo_fact_bruta + costo_devoluciones + costo_rmas AS costo_venta_neta,
--     fact_bruta + devoluciones - (costo_fact_bruta + costo_devoluciones) AS contribucion,
--     fact_bruta - costo_fact_bruta AS contribucion_bruta,
--     fact_bruta + devoluciones + rmas + bonificaciones - (costo_fact_bruta + costo_devoluciones + costo_rmas) AS utilidad_comercial
--    FROM ( SELECT erp_ventas.anio,
--             erp_ventas.mes,
--             COALESCE(NULLIF(TRIM(BOTH FROM erp_ventas.canal), ''::text), 'otros'::text) AS canal,
--             sum(
--                 CASE
--                     WHEN erp_ventas.movimiento_venta = ANY (ARRAY['Factura'::text, 'Factura Com.Ext33'::text]) THEN COALESCE(erp_ventas.monto_venta_pesos, 0::numeric)
--                     ELSE 0::numeric
--                 END) AS fact_bruta,
--             sum(
--                 CASE
--                     WHEN erp_ventas.movimiento_venta = 'Devolucion Venta'::text AND COALESCE(erp_ventas.instruccion, ''::text) !~~* 'nota credito'::text THEN COALESCE(erp_ventas.monto_venta_pesos, 0::numeric)
--                     ELSE 0::numeric
--                 END) AS devoluciones,
--             sum(
--                 CASE
--                     WHEN erp_ventas.movimiento_venta = 'Devolucion Venta'::text AND erp_ventas.instruccion ~~* 'nota credito'::text THEN COALESCE(erp_ventas.monto_venta_pesos, 0::numeric)
--                     ELSE 0::numeric
--                 END) AS rmas,
--             sum(
--                 CASE
--                     WHEN erp_ventas.movimiento_venta = 'Bonificacion Venta'::text THEN COALESCE(erp_ventas.monto_venta_pesos, 0::numeric)
--                     ELSE 0::numeric
--                 END) AS bonificaciones,
--             sum(
--                 CASE
--                     WHEN erp_ventas.movimiento_venta = 'Factura'::text THEN COALESCE(erp_ventas.costo_venta_pesos, 0::numeric)
--                     ELSE 0::numeric
--                 END) AS costo_fact_bruta,
--             sum(
--                 CASE
--                     WHEN erp_ventas.movimiento_venta = 'Devolucion Venta'::text AND COALESCE(erp_ventas.instruccion, ''::text) !~~* 'nota credito'::text THEN COALESCE(erp_ventas.costo_venta_pesos, 0::numeric)
--                     ELSE 0::numeric
--                 END) AS costo_devoluciones,
--             sum(
--                 CASE
--                     WHEN erp_ventas.movimiento_venta = 'Devolucion Venta'::text AND erp_ventas.instruccion ~~* 'nota credito'::text THEN COALESCE(erp_ventas.costo_venta_pesos, 0::numeric)
--                     ELSE 0::numeric
--                 END) AS costo_rmas,
--             sum(COALESCE(erp_ventas.unidades, 0::numeric)) AS piezas_venta_neta,
--             count(*)::integer AS renglones
--            FROM erp_ventas
--           WHERE erp_ventas.anio IS NOT NULL AND erp_ventas.mes IS NOT NULL
--           GROUP BY erp_ventas.anio, erp_ventas.mes, (COALESCE(NULLIF(TRIM(BOTH FROM erp_ventas.canal), ''::text), 'otros'::text))) s
