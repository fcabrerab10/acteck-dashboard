-- 2026-09-12 · Cuota Piezas y Cuota Costo llegan por el puente (RevkoBi dbo.BP).
--
-- Complementa a 20260912_medidas_cuota.sql (que creó las columnas) ahora que
-- bridge/sync.mjs + bridge/lib/mappers.mjs mapean:
--     BP[UNIDADES]     → cuotas_mensuales.cuota_piezas
--     BP[COSTODEVENTA] → cuotas_mensuales.cuota_costo
--
-- Regla de esta migración: mientras esas columnas estén vacías, TODA medida que
-- dependa de ellas sale NULL (en pantalla "—"), nunca 0. Afecta a
-- [Cuota Piezas], [Cuota Costo], [Cuota Contribucion], [Cuota % Contribucion],
-- [% Alcance Piezas], [+/- Piezas] y [Deficit Contribucion].
--
-- Requiere `git pull` + reinicio de agentes en la Mac mini (ver docs/SYNC_SQL_BRIDGE.md §Cuotas).

-- ── 1 · Cuota por cliente y mes ───────────────────────────────────────────
-- sum() ya ignora NULLs y devuelve NULL si TODAS las filas del grupo lo son,
-- así que cuota_piezas/cuota_costo quedan NULL mientras el puente no los traiga.
-- Se añade cuota_pct_contribucion para no recalcularlo en cada consumidor.
create or replace view public.v_medidas_cuota_cliente_mes as
select q.cliente                                   as cliente_key,
       q.anio, q.mes,
       sum(coalesce(q.cuota_ideal, q.cuota_min, 0)) as cuota_venta,
       sum(coalesce(q.cuota_min, 0))                as cuota_minima,
       sum(q.cuota_piezas)                          as cuota_piezas,
       sum(q.cuota_costo)                           as cuota_costo,
       sum(coalesce(q.cuota_ideal, q.cuota_min, 0)) - sum(q.cuota_costo) as cuota_contribucion,
       case when sum(coalesce(q.cuota_ideal, q.cuota_min, 0)) <> 0
            then (sum(coalesce(q.cuota_ideal, q.cuota_min, 0)) - sum(q.cuota_costo))
                 / sum(coalesce(q.cuota_ideal, q.cuota_min, 0)) end as cuota_pct_contribucion
  from public.cuotas_mensuales q
 where q.anio is not null and q.mes between 1 and 12
 group by q.cliente, q.anio, q.mes;
grant select on public.v_medidas_cuota_cliente_mes to authenticated, anon, service_role;

-- ── 2 · Cuota global por mes ──────────────────────────────────────────────
-- Precedencia sin cambios: cuotas_canales (dimension_tipo='TOTAL', meta anual /12)
-- si existe para el año; si no, la suma de cuotas_mensuales.
create or replace view public.v_medidas_cuota_mes as
with anual as (
  select anio,
         sum(meta_facturacion) as meta_anual,
         sum(meta_piezas)      as meta_piezas_anual
    from public.cuotas_canales
   where upper(coalesce(dimension_tipo,'')) = 'TOTAL'
   group by anio
),
porcliente as (
  select anio, mes, sum(cuota_venta) cuota_venta, sum(cuota_minima) cuota_minima,
         sum(cuota_piezas) cuota_piezas, sum(cuota_costo) cuota_costo
    from public.v_medidas_cuota_cliente_mes group by anio, mes
),
base as (
  select anio, mes from porcliente
  union
  select a.anio, g.mes from anual a cross join generate_series(1,12) g(mes)
)
select b.anio, b.mes,
       coalesce(a.meta_anual / 12.0, p.cuota_venta)                   as cuota_venta,
       p.cuota_minima                                                 as cuota_minima,
       coalesce(a.meta_piezas_anual / 12.0, p.cuota_piezas)           as cuota_piezas,
       p.cuota_costo                                                  as cuota_costo,
       coalesce(a.meta_anual / 12.0, p.cuota_venta) - p.cuota_costo   as cuota_contribucion,
       (a.anio is not null)                                           as desde_cuotas_canales,
       case when coalesce(a.meta_anual / 12.0, p.cuota_venta) <> 0
            then (coalesce(a.meta_anual / 12.0, p.cuota_venta) - p.cuota_costo)
                 / coalesce(a.meta_anual / 12.0, p.cuota_venta) end   as cuota_pct_contribucion
  from base b
  left join porcliente p on p.anio = b.anio and p.mes = b.mes
  left join anual a      on a.anio = b.anio;
grant select on public.v_medidas_cuota_mes to authenticated, anon, service_role;

-- ── 3 · [+/- Piezas] deja de devolver las piezas cuando no hay cuota ──────
-- Antes: piezas_venta_neta - coalesce(cuota_piezas, 0) → el déficit "parecía"
-- superávit total. Ahora NULL mientras no haya Cuota Piezas.
create or replace view public.v_medidas_ventas_mes as
select m.anio, m.mes,
       m.fact_bruta, m.devoluciones, m.rmas, m.bonificaciones,
       m.fact_neta, m.venta_neta,
       m.costo_fact_bruta, m.costo_devoluciones, m.costo_rmas,
       m.costo_fact_neta, m.costo_venta_neta,
       m.contribucion, m.contribucion_bruta, m.utilidad_comercial,
       m.piezas_venta_neta, m.renglones,
       (m.devoluciones - m.costo_devoluciones) as perdida_devoluciones,
       (m.rmas - m.costo_rmas)                 as perdida_rmas,
       m.cv_ultimos_3_meses, m.ytd_costo_venta,
       m.ticket_promedio, m.utilidad_promedio,
       m.pct_mc, m.pct_mc_bruta, m.pct_muc,
       m.pct_lost_profit_bonif, m.pct_lost_profit_dev, m.pct_lost_profit_rma,
       q.cuota_venta, q.cuota_minima, q.cuota_piezas, q.cuota_costo, q.cuota_contribucion,
       case when q.cuota_venta  <> 0 then m.fact_neta / q.cuota_venta  end  as pct_alcance_venta,
       case when q.cuota_piezas <> 0 then m.piezas_venta_neta / q.cuota_piezas end as pct_alcance_piezas,
       case when q.cuota_venta  <> 0 then q.cuota_contribucion / q.cuota_venta end as cuota_pct_contribucion,
       (m.fact_neta - coalesce(q.cuota_venta, 0))                as diferencia_cuota,
       (m.piezas_venta_neta - q.cuota_piezas)                    as diferencia_piezas,
       (m.contribucion - q.cuota_contribucion)                   as deficit_contribucion
  from public.v_erp_medidas_mes m
  left join public.v_medidas_cuota_mes q on q.anio = m.anio and q.mes = m.mes;
grant select on public.v_medidas_ventas_mes to authenticated, anon, service_role;

create or replace view public.v_medidas_ventas_cliente_mes as
with c as (
  select m.*,
         sum(m.costo_venta_neta) over (partition by m.cliente_key order by m.anio, m.mes
                                       rows between 3 preceding and 1 preceding) as cv_ultimos_3_meses,
         sum(m.costo_venta_neta) over (partition by m.cliente_key, m.anio order by m.mes) as ytd_costo_venta
    from public.mv_erp_medidas_cliente_mes m
)
select c.anio, c.mes, c.cliente_key,
       c.fact_bruta, c.devoluciones, c.rmas, c.bonificaciones,
       c.fact_neta, c.venta_neta,
       c.costo_fact_bruta, c.costo_devoluciones, c.costo_rmas,
       c.costo_fact_neta, c.costo_venta_neta,
       c.contribucion, c.contribucion_bruta, c.utilidad_comercial,
       c.piezas_venta_neta, c.renglones,
       (c.devoluciones - c.costo_devoluciones) as perdida_devoluciones,
       (c.rmas - c.costo_rmas)                 as perdida_rmas,
       c.cv_ultimos_3_meses, c.ytd_costo_venta,
       case when c.piezas_venta_neta <> 0 then c.venta_neta / c.piezas_venta_neta end         as ticket_promedio,
       case when c.piezas_venta_neta <> 0 then c.utilidad_comercial / c.piezas_venta_neta end as utilidad_promedio,
       case when c.fact_neta  <> 0 then c.contribucion / c.fact_neta end                      as pct_mc,
       case when c.fact_bruta <> 0 then c.contribucion_bruta / c.fact_bruta end               as pct_mc_bruta,
       case when c.venta_neta <> 0 then c.utilidad_comercial / c.venta_neta end               as pct_muc,
       case when c.fact_neta  <> 0 then c.bonificaciones / c.fact_neta end                    as pct_lost_profit_bonif,
       case when c.fact_bruta <> 0 then (c.devoluciones - c.costo_devoluciones) / c.fact_bruta end as pct_lost_profit_dev,
       case when c.fact_neta  <> 0 then (c.rmas - c.costo_rmas) / c.fact_neta end             as pct_lost_profit_rma,
       q.cuota_venta, q.cuota_minima, q.cuota_piezas, q.cuota_costo, q.cuota_contribucion,
       case when q.cuota_venta  <> 0 then c.fact_neta / q.cuota_venta end                     as pct_alcance_venta,
       case when q.cuota_piezas <> 0 then c.piezas_venta_neta / q.cuota_piezas end            as pct_alcance_piezas,
       (c.fact_neta - coalesce(q.cuota_venta, 0))                                             as diferencia_cuota,
       (c.piezas_venta_neta - q.cuota_piezas)                                                 as diferencia_piezas,
       (c.contribucion - q.cuota_contribucion)                                                as deficit_contribucion,
       q.cuota_pct_contribucion
  from c
  left join public.v_medidas_cuota_cliente_mes q
         on q.cliente_key = c.cliente_key and q.anio = c.anio and q.mes = c.mes;
grant select on public.v_medidas_ventas_cliente_mes to authenticated, anon, service_role;

notify pgrst, 'reload schema';
