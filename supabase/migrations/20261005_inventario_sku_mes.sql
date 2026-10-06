-- Inventario en el celular (3.81.0 · 2026-10-05)
--
-- 1) mv_inventario_sku_mes · stock al cierre de cada mes por SKU (piezas y valor a costo) en los almacenes
--    comerciales (almacenes_config.comercial = true), construido desde inventario_historico: por mes se toma el
--    ÚLTIMO día con foto (el mes en curso = la foto más reciente). inventario_historico arranca el 2026-09-10, así
--    que hoy sólo hay sep y oct 2026; la MV se llena sola con la foto diaria (19:30) y el puente.
-- 2) v_inventario_sku_anio · pivote 1 fila por sku × año con los 12 meses en arrays (piezas int[12], valor
--    numeric[12] redondeado), misma forma que v_sellout_sku_anio (20261005_sku_anio_pivot_movil.sql): la tabla
--    «Detalle por SKU × 12 meses» del celular baja 1–2 K filas en vez de sku × mes.
-- 3) mv_medidas_inventario_mes · la vista v_medidas_inventario_mes (inventario al cierre de mes con la regla
--    [Inv Actual] del director, desde v_medidas_inventario_dia) tardaba 1.7 s; el rol de la app la cancela a 3 s.
--    Materializada con la misma definición; la vista pasa a leerla (ms). mv_medidas_inventario (que la lee para
--    inv_promedio) se refresca DESPUÉS en refresh_vision_general(). La usa el celular para «cambio contra el mes
--    pasado» (Inv Actual hoy vs inv_cierre_mes del mes anterior) y la gráfica de 12 meses.
-- 4) v_inventario_cv_mes · una fila por mes: inventario al cierre + CV 3 meses cerrados + costo de venta del mes
--    (v_medidas_ventas_mes), para que la gráfica y los días de inventario por mes salgan de UNA consulta.
-- Refresco: al final de refresh_vision_general() (foto diaria 19:30 y puente).

-- ── 1) SKU × mes ────────────────────────────────────────────────────────────────────────────────────────────
drop materialized view if exists public.mv_inventario_sku_mes;
create materialized view public.mv_inventario_sku_mes as
with ult as (
  select date_trunc('month', h.fecha)::date as periodo, max(h.fecha) as fecha
  from public.inventario_historico h
  group by 1
)
select
  h.articulo                                  as sku,
  extract(year  from u.periodo)::integer      as anio,
  extract(month from u.periodo)::integer      as mes,
  u.fecha                                     as fecha_cierre,
  round(sum(h.inventario))::integer           as piezas,
  round(sum(h.costoinventario))               as valor
from public.inventario_historico h
join ult u on u.fecha = h.fecha
join public.almacenes_config a on a.no_almacen = h.no_almacen and a.comercial = true
where h.articulo is not null
group by h.articulo, u.periodo, u.fecha
having sum(h.inventario) <> 0 or sum(h.costoinventario) <> 0;

create unique index mv_inventario_sku_mes_uk on public.mv_inventario_sku_mes (sku, anio, mes);
comment on materialized view public.mv_inventario_sku_mes is
  'Stock al cierre de cada mes por SKU (último día con foto en inventario_historico), almacenes comerciales: piezas y valor a costo. Celular 2026-10-05. Refresco en refresh_vision_general().';

-- ── 2) pivote sku × año ─────────────────────────────────────────────────────────────────────────────────────
create or replace view public.v_inventario_sku_anio as
select
  m.sku,
  m.anio,
  array[
    max(m.piezas) filter (where m.mes = 1),  max(m.piezas) filter (where m.mes = 2),
    max(m.piezas) filter (where m.mes = 3),  max(m.piezas) filter (where m.mes = 4),
    max(m.piezas) filter (where m.mes = 5),  max(m.piezas) filter (where m.mes = 6),
    max(m.piezas) filter (where m.mes = 7),  max(m.piezas) filter (where m.mes = 8),
    max(m.piezas) filter (where m.mes = 9),  max(m.piezas) filter (where m.mes = 10),
    max(m.piezas) filter (where m.mes = 11), max(m.piezas) filter (where m.mes = 12)
  ]::integer[] as piezas,
  array[
    max(m.valor) filter (where m.mes = 1),  max(m.valor) filter (where m.mes = 2),
    max(m.valor) filter (where m.mes = 3),  max(m.valor) filter (where m.mes = 4),
    max(m.valor) filter (where m.mes = 5),  max(m.valor) filter (where m.mes = 6),
    max(m.valor) filter (where m.mes = 7),  max(m.valor) filter (where m.mes = 8),
    max(m.valor) filter (where m.mes = 9),  max(m.valor) filter (where m.mes = 10),
    max(m.valor) filter (where m.mes = 11), max(m.valor) filter (where m.mes = 12)
  ]::numeric[] as valor
from public.mv_inventario_sku_mes m
group by m.sku, m.anio;

comment on view public.v_inventario_sku_anio is
  'Stock al cierre de mes por sku × año con los 12 meses pivotados (piezas[12], valor[12]; NULL = sin foto ese mes). Fuente mv_inventario_sku_mes. Celular 2026-10-05.';

-- ── 3) cierre mensual del director, materializado ───────────────────────────────────────────────────────────
drop materialized view if exists public.mv_medidas_inventario_mes;
create materialized view public.mv_medidas_inventario_mes as
with dias as (
  select d.fecha, d.inv_actual, d.inv_actual_piezas
  from public.v_medidas_inventario_dia d
), ult as (
  select distinct on (date_trunc('month', dias.fecha))
    date_trunc('month', dias.fecha)::date as periodo, dias.fecha, dias.inv_actual, dias.inv_actual_piezas
  from dias
  order by date_trunc('month', dias.fecha), dias.fecha desc
)
select
  extract(year  from u.periodo)::integer as anio,
  extract(month from u.periodo)::integer as mes,
  u.fecha                                as fecha_cierre,
  u.inv_actual                           as inv_cierre_mes,
  u.inv_actual_piezas                    as inv_cierre_mes_piezas,
  (select avg(d.inv_actual) from dias d where date_trunc('month', d.fecha) = u.periodo) as inv_promedio
from ult u;

create unique index mv_medidas_inventario_mes_uk on public.mv_medidas_inventario_mes (anio, mes);
comment on materialized view public.mv_medidas_inventario_mes is
  'v_medidas_inventario_mes materializada (la viva tardaba 1.7 s). Inventario al cierre de mes con la regla [Inv Actual]. Refresco en refresh_vision_general() antes de mv_medidas_inventario. 2026-10-05.';

-- Misma lista y tipos de columnas: mv_medidas_inventario (que la lee) no se ve afectada.
create or replace view public.v_medidas_inventario_mes as
select anio, mes, fecha_cierre, inv_cierre_mes, inv_cierre_mes_piezas, inv_promedio
from public.mv_medidas_inventario_mes;

-- ── 4) inventario + CV por mes en una consulta (celular) ────────────────────────────────────────────────────
create or replace view public.v_inventario_cv_mes as
select
  v.anio,
  v.mes,
  i.fecha_cierre,
  i.inv_cierre_mes,
  i.inv_cierre_mes_piezas,
  v.cv_ultimos_3_meses,
  v.costo_venta_neta,
  v.piezas_venta_neta
from public.v_medidas_ventas_mes v
left join public.mv_medidas_inventario_mes i on i.anio = v.anio and i.mes = v.mes;

comment on view public.v_inventario_cv_mes is
  'Una fila por mes: inventario al cierre ([Inv Actual], mv_medidas_inventario_mes) + CV 3 meses cerrados y costo de venta del mes (v_medidas_ventas_mes). Días de inventario del mes = inv_cierre_mes / cv_ultimos_3_meses × 90. Celular 2026-10-05.';

grant select on public.mv_inventario_sku_mes, public.v_inventario_sku_anio, public.mv_medidas_inventario_mes,
  public.v_medidas_inventario_mes, public.v_inventario_cv_mes to anon, authenticated, service_role;

-- ── refresco ────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.refresh_vision_general() returns void language plpgsql security definer set search_path to 'public' as $$
begin
  refresh materialized view public.mv_vision_sellout_canal;
  refresh materialized view public.mv_vision_sellout_mayoristas;
  refresh materialized view public.mv_vision_sellout_top_skus;
  refresh materialized view public.mv_vision_sellout_top_clientes;
  refresh materialized view public.mv_vision_sellout_promos;
  refresh materialized view public.mv_vision_sellout_rotacion;
  refresh materialized view public.mv_vision_sellout_mensual;
  refresh materialized view public.mv_vision_inventario_global;
  refresh materialized view concurrently public.mv_apoyos_convenio;
  refresh materialized view concurrently public.mv_medidas_inventario_mes;    -- 2026-10-05 · antes que mv_medidas_inventario (la lee)
  refresh materialized view public.mv_medidas_inventario;                      -- 2026-10-02
  refresh materialized view concurrently public.mv_inventario_historico_dia;   -- 2026-10-02
  refresh materialized view concurrently public.mv_inventario_sku_mes;         -- 2026-10-05 · celular: stock al cierre por SKU × mes
end;
$$;

notify pgrst, 'reload schema';
