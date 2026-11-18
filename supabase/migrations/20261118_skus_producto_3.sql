-- SKUs de producto: también los que terminan en DOS letras (ES-05001EW). Fernando, 2026-11-18.
create or replace function public.es_sku_producto(s text) returns boolean
language sql immutable as $$ select upper(trim(coalesce(s, ''))) ~ '^[A-Z]{2}-[0-9]{5,6}[A-Z]{0,2}$' $$;
refresh materialized view public.mv_skus_producto_extra;
