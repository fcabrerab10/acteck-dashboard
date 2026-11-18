-- SKUs de producto · segunda vuelta (2026-11-18). Fernando: «que también aparezcan en Propuestas, S&OP, Proyectos y
-- precios; hay pocos SKUs que al final tienen una sola letra sin guion, ¿puedes detectarlos también?».
-- Forma de producto = dos letras, guion, CINCO o seis dígitos y, opcional, UNA letra al final (AC-935777, ES-05001,
-- ES-05001E, TB-05003E). Los de cinco dígitos son la numeración vieja (fuentes Blazar, Evorok): son producto.
-- La vista gana `activo` (roadmap, o fuera del roadmap con existencia o mercancía en camino), `marca` por prefijo
-- para los de fuera del roadmap y `sort_order`. Propuestas, S&OP, Proyectos y Estrategia de Precios leen `activo`.
create or replace function public.es_sku_producto(s text) returns boolean
language sql immutable as $$ select upper(trim(coalesce(s, ''))) ~ '^[A-Z]{2}-[0-9]{5,6}[A-Z]?$' $$;

drop view if exists public.v_skus_producto;
drop materialized view if exists public.mv_skus_producto_extra;
create materialized view public.mv_skus_producto_extra as
select x.sku, coalesce(c.descripcion, e.descripcion) as descripcion,
       case left(x.sku, 2) when 'AC' then 'ACTECK' when 'ES' then 'ACTECK' when 'BR' then 'BALAM RUSH' when 'AV' then 'AUDIVE' end as marca,
       (x.pz > 0 or x.tr > 0) as activo
from (
  select sku, sum(pz) pz, sum(tr) tr from (
    select upper(trim(articulo)) as sku, coalesce(inv_actual_piezas, 0) pz, 0::numeric tr from public.v_medidas_inventario_sku where public.es_sku_producto(articulo)
    union all
    select upper(trim(sku)), 0, coalesce(cantidad, 0) from public.v_transito_sku where public.es_sku_producto(sku)
  ) u group by sku
) x
left join (select upper(trim(articulo)) sku, max(descripcion) descripcion from public.catalogo_articulos group by 1) c on c.sku = x.sku
left join (select upper(trim(codigo)) sku, max(descripcion) descripcion from public.embarques_compras group by 1) e on e.sku = x.sku;
create unique index mv_skus_producto_extra_sku on public.mv_skus_producto_extra(sku);
revoke all on public.mv_skus_producto_extra from anon, authenticated;

create view public.v_skus_producto as
select r.sku, r.descripcion, r.marca, r.categoria, r.familia, r.rdmp, true as en_roadmap, true as activo, r.sort_order
from public.roadmap_sku r
union all
select x.sku, x.descripcion, x.marca, null::text, null::text, null::text, false, x.activo, null
from public.mv_skus_producto_extra x
where not exists (select 1 from public.roadmap_sku r where upper(r.sku) = x.sku)
  and (select public.es_interno());
grant select on public.v_skus_producto to authenticated;
