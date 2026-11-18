-- Arreglo de rendimiento (2026-11-18): la rama de computadoras facturadas de mv_skus_producto_extra corría
-- clasificar_sku() (≈ 60 expresiones regulares) sobre cada renglón de erp_ventas y refresh_vision_general() pasaba
-- de 2 minutos (statement timeout). Ahora primero filtra por texto (computadora… / all in one), agrupa por SKU y
-- sólo entonces clasifica. Misma definición en lo demás.
drop view if exists public.v_skus_producto;
drop materialized view if exists public.mv_skus_producto_extra;
create materialized view public.mv_skus_producto_extra as
with pref as (
  select distinct on (left(upper(sku), 2)) left(upper(sku), 2) p, marca
  from (select sku, marca, count(*) over (partition by left(upper(sku), 2), marca) n from public.roadmap_sku where marca is not null and public.es_sku_producto(sku)) z
  order by left(upper(sku), 2), n desc
)
select d.sku, d.descripcion,
       coalesce(case when left(d.sku, 2) = 'FA' then 'XTREME PC' end, pref.marca,
                case left(d.sku, 2) when 'AC' then 'ACTECK' when 'ES' then 'ACTECK' when 'BR' then 'BALAM RUSH' when 'AV' then 'AUDIVE' end) as marca,
       d.activo,
       nullif(split_part(public.clasificar_sku(d.descripcion), '|', 1), '') as categoria,
       nullif(split_part(public.clasificar_sku(d.descripcion), '|', 2), '') as familia
from (
  select x.sku, coalesce(c.descripcion, e.descripcion, x.d) as descripcion, (x.pz > 0 or x.tr > 0 or x.directo) as activo
  from (
    select sku, sum(pz) pz, sum(tr) tr, bool_or(directo) directo, max(d) d from (
      select upper(trim(articulo)) as sku, coalesce(inv_actual_piezas, 0) pz, 0::numeric tr, false directo, null::text d from public.v_medidas_inventario_sku where public.es_sku_producto(articulo)
      union all
      select upper(trim(sku)), 0, coalesce(cantidad, 0), false, null from public.v_transito_sku where public.es_sku_producto(sku)
      union all
      select upper(trim(sku)), 0, 0, true, nombre || coalesce(' · ' || licencia, '') from public.pcs_modelos where public.es_sku_producto(sku)
      union all
      select sku, 0, 0, true, d from (
        select upper(trim(articulo)) sku, max(descripcion) d from public.erp_ventas
        where anio >= extract(year from current_date)::int - 1 and rama = 'PRODUCTO'
          and (descripcion ilike 'computadora%' or descripcion ilike '%all in one%')
        group by 1) pc
      where public.es_sku_producto(sku) and public.clasificar_sku(d) like 'Computadoras|%'
    ) u group by sku
  ) x
  left join (select upper(trim(articulo)) sku, max(descripcion) descripcion from public.catalogo_articulos group by 1) c on c.sku = x.sku
  left join (select upper(trim(codigo)) sku, max(descripcion) descripcion from public.embarques_compras group by 1) e on e.sku = x.sku
) d
left join pref on pref.p = left(d.sku, 2);
create unique index mv_skus_producto_extra_sku on public.mv_skus_producto_extra(sku);
revoke all on public.mv_skus_producto_extra from anon, authenticated;

create view public.v_skus_producto as
select r.sku, r.descripcion, r.marca, r.categoria, r.familia, r.rdmp, true as en_roadmap, true as activo, r.sort_order
from public.roadmap_sku r
union all
select x.sku, x.descripcion, x.marca, x.categoria, x.familia, null::text, false, x.activo, null
from public.mv_skus_producto_extra x
where not exists (select 1 from public.roadmap_sku r where upper(r.sku) = x.sku)
  and (select public.es_interno());
grant select on public.v_skus_producto to authenticated;
