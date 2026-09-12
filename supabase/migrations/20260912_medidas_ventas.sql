-- 2026-09-12 · Capa canónica de medidas (4/4): VENTAS.
--
-- v_erp_medidas / v_erp_medidas_mes / _cliente_mes / _canal_mes ya traían las
-- medidas base (Fact Bruta/Neta, Devoluciones, RMA's, Bonificaciones, Venta
-- Neta, costos, Contribución, Utilidad Comercial, Piezas). Faltaban las
-- derivadas del director. Aquí se completan SIN tocar las vistas existentes
-- (para no romper las ~30 pantallas que ya las leen): se añaden vistas
-- `v_medidas_ventas_*` que las envuelven y exponen TODO.
--
-- Medidas que se añaden:
--   Perdida x Devoluciones = Devoluciones − Costo Devoluciones
--   Perdida x RMA's        = RMA's − Costo RMA's
--   % Lost Profit Bonif    = Bonificaciones / Fact Neta
--   % Lost Profit Dev      = Perdida x Devoluciones / Fact Bruta
--   % Lost Profit RMA      = Perdida x RMA's / Fact Neta
--   % MC                   = Contribucion / Fact Neta
--   % MC Bruta             = Contribucion Bruta / Fact Bruta
--   % MUC                  = Utilidad Comercial / Venta Neta
--   Ticket Promedio        = Venta Neta / Piezas Venta Neta
--   Utilidad Promedio      = Utilidad Comercial / Piezas Venta Neta
--   CV Ultimos 3 Meses     = Costo Venta Neta de los meses −1, −2, −3
--   YTD Costo de Venta     = TOTALYTD(Costo Venta Neta)
--   Cuota Venta/Piezas/Minima/Costo/Contribucion  (join con v_medidas_cuota_*)
--   % Alcance Venta        = Fact Neta / Cuota Venta
--   % Alcance Piezas       = Piezas Venta Neta / Cuota Piezas
--   +/- $ Venta            = Fact Neta − Cuota Venta   (= Diferencia Cuota)
--   +/- Piezas             = Piezas Venta Neta − Cuota Piezas
--   Deficit Contribucion   = Contribucion − Cuota Contribucion
--
-- REGLA DE ORO: los % NUNCA se suman. Aquí van por fila para el caso de una
-- sola fila; al agregar varios meses/clientes se recalculan con
-- src/lib/medidas.js (derivadas()).

-- ── Global por mes ────────────────────────────────────────────────────────
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
       (m.piezas_venta_neta - coalesce(q.cuota_piezas, 0))       as diferencia_piezas,
       (m.contribucion - q.cuota_contribucion)                   as deficit_contribucion
  from public.v_erp_medidas_mes m
  left join public.v_medidas_cuota_mes q on q.anio = m.anio and q.mes = m.mes;
grant select on public.v_medidas_ventas_mes to authenticated, anon, service_role;

-- ── Por cliente y mes ─────────────────────────────────────────────────────
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
       (c.piezas_venta_neta - coalesce(q.cuota_piezas, 0))                                    as diferencia_piezas,
       (c.contribucion - q.cuota_contribucion)                                                as deficit_contribucion
  from c
  left join public.v_medidas_cuota_cliente_mes q
         on q.cliente_key = c.cliente_key and q.anio = c.anio and q.mes = c.mes;
grant select on public.v_medidas_ventas_cliente_mes to authenticated, anon, service_role;

-- ── Por canal y mes ───────────────────────────────────────────────────────
create or replace view public.v_medidas_ventas_canal_mes as
select m.anio, m.mes, m.canal,
       m.fact_bruta, m.devoluciones, m.rmas, m.bonificaciones,
       m.fact_neta, m.venta_neta,
       m.costo_fact_bruta, m.costo_devoluciones, m.costo_rmas,
       m.costo_fact_neta, m.costo_venta_neta,
       m.contribucion, m.contribucion_bruta, m.utilidad_comercial,
       m.piezas_venta_neta, m.renglones,
       (m.devoluciones - m.costo_devoluciones) as perdida_devoluciones,
       (m.rmas - m.costo_rmas)                 as perdida_rmas,
       sum(m.costo_venta_neta) over (partition by m.canal order by m.anio, m.mes
                                     rows between 3 preceding and 1 preceding) as cv_ultimos_3_meses,
       sum(m.costo_venta_neta) over (partition by m.canal, m.anio order by m.mes) as ytd_costo_venta,
       case when m.piezas_venta_neta <> 0 then m.venta_neta / m.piezas_venta_neta end         as ticket_promedio,
       case when m.piezas_venta_neta <> 0 then m.utilidad_comercial / m.piezas_venta_neta end as utilidad_promedio,
       case when m.fact_neta  <> 0 then m.contribucion / m.fact_neta end                      as pct_mc,
       case when m.fact_bruta <> 0 then m.contribucion_bruta / m.fact_bruta end               as pct_mc_bruta,
       case when m.venta_neta <> 0 then m.utilidad_comercial / m.venta_neta end               as pct_muc
  from public.mv_erp_medidas_canal_mes m;
grant select on public.v_medidas_ventas_canal_mes to authenticated, anon, service_role;

-- ── Por SKU (grano fino, en vivo · ~1.5 s: usar SIEMPRE con filtro) ───────
create or replace view public.v_medidas_ventas_sku
with (security_invoker = true) as
select m.*,
       case when m.piezas_venta_neta <> 0 then m.venta_neta / m.piezas_venta_neta end         as ticket_promedio,
       case when m.piezas_venta_neta <> 0 then m.utilidad_comercial / m.piezas_venta_neta end as utilidad_promedio,
       case when m.fact_neta  <> 0 then m.contribucion / m.fact_neta end                      as pct_mc,
       case when m.fact_bruta <> 0 then m.contribucion_bruta / m.fact_bruta end               as pct_mc_bruta,
       case when m.venta_neta <> 0 then m.utilidad_comercial / m.venta_neta end               as pct_muc
  from public.v_erp_medidas m;
grant select on public.v_medidas_ventas_sku to authenticated, anon, service_role;

notify pgrst, 'reload schema';
