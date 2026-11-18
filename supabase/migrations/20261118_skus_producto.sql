-- SKUs de producto (2026-11-18). Fernando: «busco SKUs nuevos que no tengo en el roadmap y no me deja ver su
-- inventario; pero no quiero ver refacciones, cajas, etc.: sólo los que tienen forma de SKU de producto».
-- Universo = roadmap_sku ∪ claves con forma de producto (dos letras, guion, seis dígitos: AC-935777) que tengan
-- inventario o mercancía en camino. Lo de fuera del roadmap sólo lo ven internos. Descripción: catálogo del ERP →
-- descripción del embarque. La parte de fuera del roadmap va materializada (viva tardaba 4.5 s) y se refresca con
-- refresh_vision_general() (06:30 y foto diaria de inventario).
create or replace function public.es_sku_producto(s text) returns boolean
language sql immutable as $$ select upper(coalesce(s, '')) ~ '^[A-Z]{2}-[0-9]{6}$' $$;

drop view if exists public.v_skus_producto;
drop materialized view if exists public.mv_skus_producto_extra;
create materialized view public.mv_skus_producto_extra as
select x.sku, coalesce(c.descripcion, e.descripcion) as descripcion
from (
  select distinct upper(articulo) as sku from public.v_medidas_inventario_sku where public.es_sku_producto(articulo)
  union
  select distinct upper(sku) from public.v_transito_sku where public.es_sku_producto(sku)
) x
left join (select upper(articulo) sku, max(descripcion) descripcion from public.catalogo_articulos group by 1) c on c.sku = x.sku
left join (select upper(codigo) sku, max(descripcion) descripcion from public.embarques_compras group by 1) e on e.sku = x.sku;
create unique index mv_skus_producto_extra_sku on public.mv_skus_producto_extra(sku);
revoke all on public.mv_skus_producto_extra from anon, authenticated;

create view public.v_skus_producto as
select r.sku, r.descripcion, r.marca, r.categoria, r.familia, r.rdmp, true as en_roadmap
from public.roadmap_sku r
union all
select x.sku, x.descripcion, null::text, null::text, null::text, null::text, false
from public.mv_skus_producto_extra x
where not exists (select 1 from public.roadmap_sku r where upper(r.sku) = x.sku)
  and (select public.es_interno());
grant select on public.v_skus_producto to authenticated;

CREATE OR REPLACE FUNCTION public.refresh_vision_general()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  refresh materialized view concurrently public.mv_skus_producto_extra; -- SKUs de producto fuera del roadmap (2026-11-18)
end;
$function$;
