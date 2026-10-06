-- 2026-10-05 · Rendimiento: Estrategia de Precios, Proyectos, Propuestas y modo visita bajaban v_estrategia_precios_lista
-- completa (9,653 filas × {sku, lista, precio} ≈ 800 KB en 2 páginas). Esta vista entrega UNA fila por SKU con sus listas
-- en jsonb (≈ 2,200 filas); queries.js#fetchPreciosLista la aplana a {sku, lista, precio} para que nadie cambie su lógica.
create or replace view public.v_precios_lista_por_sku as
select sku, jsonb_object_agg(lista, precio) as precios, max(anio * 100 + mes) as periodo
from public.v_estrategia_precios_lista
where sku is not null and lista is not null
group by sku;
grant select on public.v_precios_lista_por_sku to anon, authenticated;
