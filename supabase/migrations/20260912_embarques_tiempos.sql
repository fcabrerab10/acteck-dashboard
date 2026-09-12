-- 2026-09-12 · Tiempos reales y costo de flete de importación (embarques_compras)
--
-- embarques_compras tiene grano PO × código × arribo, pero el COSTO DE FLETE y el
-- tipo de contenedor están capturados **por contenedor** (el mismo importe se repite
-- en todos los renglones del contenedor). Sumar `costo_flete` fila a fila lo infla
-- 2-3×. Por eso todo pasa antes por `v_embarques_contenedor`, que deja UNA fila por
-- contenedor:
--   · costo_flete = max() (un solo importe por contenedor)
--   · cbm, total_amount (FOB) y shp_qty = suma de sus renglones (sí son por línea:
--     cbm ≈ cbm_unitario × shp_qty; un 40' promedia 65 CBM, que cuadra)
--
-- Fechas: el Master Embarques (Google Sheet) trae capturas sueltas con años imposibles
-- (hasta el año 3800). `emb_fecha_ok()` descarta todo lo que quede fuera de 2015 →
-- hoy + 3 años, y cada duración se acota a un rango físicamente posible.
--
-- Medianas (percentile_cont) en vez de promedios: un solo embarque atorado en aduana
-- no debe mover el lead time de todo un proveedor. Se expone también el promedio.
--
-- Vistas:
--   v_embarques_contenedor  base, 1 fila por contenedor
--   v_embarques_proveedor   supplier × año: FOB, flete, CBM, USD/CBM, días de
--                           producción / tránsito / puerto→CEDIS / total
--   v_embarques_naviera     naviera × año: contenedores, CBM, flete, USD/CBM, tránsito
--   v_embarques_mes         año × mes de ETD: embarques, FOB, flete, CBM, USD/CBM

create or replace function public.emb_fecha_ok(d date)
returns date language sql immutable as $$
  select case when d between date '2015-01-01' and (current_date + interval '3 years')::date then d end;
$$;

comment on function public.emb_fecha_ok(date) is
  'Descarta fechas imposibles capturadas a mano en el Master Embarques (fuera de 2015 → hoy+3 años).';

-- Se recrean de cero (cambiar columnas de una vista existente exige DROP).
drop view if exists public.v_embarques_mes cascade;
drop view if exists public.v_embarques_naviera cascade;
drop view if exists public.v_embarques_proveedor cascade;
drop view if exists public.v_embarques_contenedor_tiempos cascade;
drop view if exists public.v_embarques_contenedor cascade;

-- ── Base: una fila por contenedor ──────────────────────────────────────────────
create or replace view public.v_embarques_contenedor
with (security_invoker = true) as
select
  e.contenedor,
  min(e.supplier)                                    as supplier,
  min(e.naviera)                                     as naviera,
  min(e.tipo_carga)                                  as tipo_carga,
  min(e.tipo_contenedor)                             as tipo_contenedor,
  count(*)                                           as renglones,
  count(distinct e.po)                               as pos,
  sum(coalesce(e.shp_qty, 0))                        as piezas,
  sum(coalesce(e.total_amount, 0))                   as fob_usd,
  max(e.costo_flete)                                 as flete_usd,
  nullif(sum(coalesce(e.cbm, 0)), 0)                 as cbm,
  min(public.emb_fecha_ok(e.fecha_emision))          as fecha_emision,
  min(public.emb_fecha_ok(e.fecha_inicio_produccion)) as inicio_produccion,
  max(public.emb_fecha_ok(e.fin_produccion))         as fin_produccion,
  min(public.emb_fecha_ok(e.etd))                    as etd,
  min(public.emb_fecha_ok(e.eta_puerto))             as eta_puerto,
  max(public.emb_fecha_ok(e.arribo_cedis))           as arribo_cedis,
  min(e.cedis)                                       as cedis,
  min(e.estatus)                                     as estatus
from public.embarques_compras e
where e.contenedor is not null and btrim(e.contenedor) <> ''
group by e.contenedor;

comment on view public.v_embarques_contenedor is
  'Una fila por contenedor del Master Embarques: flete (no se suma por renglón), CBM, FOB, piezas y fechas saneadas.';

-- ── CTE compartido como vista intermedia con las duraciones ya acotadas ────────
create or replace view public.v_embarques_contenedor_tiempos
with (security_invoker = true) as
select c.*,
  extract(year from coalesce(c.etd, c.arribo_cedis, c.fecha_emision))::int as anio,
  extract(month from coalesce(c.etd, c.arribo_cedis, c.fecha_emision))::int as mes,
  case when c.fin_produccion is not null and c.inicio_produccion is not null
         and (c.fin_produccion - c.inicio_produccion) between 0 and 300
       then (c.fin_produccion - c.inicio_produccion) end                    as dias_produccion,
  (c.arribo_cedis is not null and c.arribo_cedis <= current_date)           as arribado,
  case when c.arribo_cedis is not null and c.arribo_cedis <= current_date and c.etd is not null
         and (c.arribo_cedis - c.etd) between 1 and 150
       then (c.arribo_cedis - c.etd) end                                    as dias_transito,
  case when c.arribo_cedis is not null and c.arribo_cedis <= current_date and c.eta_puerto is not null
         and (c.arribo_cedis - c.eta_puerto) between 0 and 60
       then (c.arribo_cedis - c.eta_puerto) end                             as dias_puerto_cedis,
  case when c.arribo_cedis is not null and c.arribo_cedis <= current_date and c.fecha_emision is not null
         and (c.arribo_cedis - c.fecha_emision) between 1 and 400
       then (c.arribo_cedis - c.fecha_emision) end                          as dias_total
from public.v_embarques_contenedor c;

comment on view public.v_embarques_contenedor_tiempos is
  'v_embarques_contenedor + año/mes y las cuatro duraciones (producción, tránsito, puerto→CEDIS, total) acotadas a rangos posibles y SÓLO de contenedores ya arribados (tiempos reales, no planeados).';

-- ── Proveedor × año ────────────────────────────────────────────────────────────
create or replace view public.v_embarques_proveedor
with (security_invoker = true) as
select
  t.supplier,
  t.anio,
  count(*)                                         as embarques,
  sum(t.pos)                                       as pos,
  sum(t.piezas)::bigint                            as piezas,
  round(sum(t.fob_usd), 0)                         as fob_usd,
  round(sum(t.flete_usd), 0)                       as flete_usd,
  round(sum(t.cbm), 1)                             as cbm,
  round(sum(t.flete_usd) filter (where t.cbm is not null and t.flete_usd is not null)
        / nullif(sum(t.cbm) filter (where t.flete_usd is not null), 0), 1)      as usd_por_cbm,
  round(sum(t.flete_usd) filter (where t.cbm is not null and t.flete_usd is not null), 0) as flete_medido_usd,
  round(sum(t.cbm) filter (where t.flete_usd is not null), 1)                              as cbm_medido,
  round(percentile_cont(0.5) within group (order by t.dias_produccion)::numeric, 0) as dias_produccion_med,
  round(avg(t.dias_produccion)::numeric, 0)        as dias_produccion_prom,
  round(percentile_cont(0.5) within group (order by t.dias_transito)::numeric, 0)   as dias_transito_med,
  round(avg(t.dias_transito)::numeric, 0)          as dias_transito_prom,
  round(percentile_cont(0.5) within group (order by t.dias_puerto_cedis)::numeric, 0) as dias_puerto_med,
  round(percentile_cont(0.5) within group (order by t.dias_total)::numeric, 0)      as dias_total_med,
  round(avg(t.dias_total)::numeric, 0)             as dias_total_prom,
  count(*) filter (where t.dias_transito is not null) as n_transito,
  count(*) filter (where t.dias_produccion is not null) as n_produccion
from public.v_embarques_contenedor_tiempos t
where t.supplier is not null and t.anio is not null
group by t.supplier, t.anio;

comment on view public.v_embarques_proveedor is
  'Proveedor × año: FOB y flete en USD, CBM, USD/CBM y días de producción, tránsito, puerto→CEDIS y total (mediana y promedio).';

-- ── Naviera × año ──────────────────────────────────────────────────────────────
create or replace view public.v_embarques_naviera
with (security_invoker = true) as
select
  t.naviera,
  t.anio,
  count(*)                                         as embarques,
  count(*)                                         as contenedores,
  sum(t.piezas)::bigint                            as piezas,
  round(sum(t.cbm), 1)                             as cbm,
  round(sum(t.flete_usd), 0)                       as flete_usd,
  round(sum(t.flete_usd) filter (where t.cbm is not null and t.flete_usd is not null)
        / nullif(sum(t.cbm) filter (where t.flete_usd is not null), 0), 1)      as usd_por_cbm,
  round(sum(t.flete_usd) filter (where t.cbm is not null and t.flete_usd is not null), 0) as flete_medido_usd,
  round(sum(t.cbm) filter (where t.flete_usd is not null), 1)                              as cbm_medido,
  round(percentile_cont(0.5) within group (order by t.dias_transito)::numeric, 0) as dias_transito_med,
  round(avg(t.dias_transito)::numeric, 0)          as dias_transito_prom,
  round(percentile_cont(0.5) within group (order by t.dias_puerto_cedis)::numeric, 0) as dias_puerto_med,
  count(*) filter (where t.dias_transito is not null) as n_transito
from public.v_embarques_contenedor_tiempos t
where t.naviera is not null and btrim(t.naviera) <> '' and t.anio is not null
group by t.naviera, t.anio;

comment on view public.v_embarques_naviera is
  'Naviera × año: contenedores, CBM, flete USD, USD/CBM y días de tránsito (mediana y promedio).';

-- ── Mes de ETD ─────────────────────────────────────────────────────────────────
create or replace view public.v_embarques_mes
with (security_invoker = true) as
select
  t.anio,
  t.mes,
  count(*)                                    as embarques,
  sum(t.pos)                                  as pos,
  sum(t.piezas)::bigint                       as piezas,
  round(sum(t.fob_usd), 0)                    as fob_usd,
  round(sum(t.flete_usd), 0)                  as flete_usd,
  round(sum(t.cbm), 1)                        as cbm,
  round(sum(t.flete_usd) filter (where t.cbm is not null and t.flete_usd is not null)
        / nullif(sum(t.cbm) filter (where t.flete_usd is not null), 0), 1) as usd_por_cbm,
  round(percentile_cont(0.5) within group (order by t.dias_transito)::numeric, 0) as dias_transito_med
from public.v_embarques_contenedor_tiempos t
where t.anio is not null
group by t.anio, t.mes;

comment on view public.v_embarques_mes is
  'Año × mes de ETD: embarques, FOB, flete, CBM, USD/CBM y tránsito mediano.';

grant execute on function public.emb_fecha_ok(date) to anon, authenticated;
grant select on public.v_embarques_contenedor, public.v_embarques_contenedor_tiempos,
                public.v_embarques_proveedor, public.v_embarques_naviera, public.v_embarques_mes
  to anon, authenticated;

notify pgrst, 'reload schema';
