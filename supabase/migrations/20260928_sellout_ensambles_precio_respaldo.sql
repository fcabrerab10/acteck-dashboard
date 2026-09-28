-- Precio de respaldo para el monto estimado de ensambles (2026-09-28): los SKUs que el cliente sólo mueve dentro
-- de PCs (AC-944571, AC-944588…) nunca se vendieron sueltos y salían en $0. Cascada: sell out suelto 90 d →
-- histórico → última factura de Acteck a ese cliente (erp_ventas) → lista natural del cliente (API PROVISIONAL /
-- PCEL PROVISIONAL / DICOTECH en v_estrategia_precios_lista). `base` dice de dónde salió.
create or replace view public.v_sellout_precio_prom_sku as
with reciente as (
  select cliente, no_parte as sku,
         sum(coalesce(subtotal, total, 0) - coalesce(descuento, 0)) / nullif(sum(cantidad), 0) as precio
  from sellout_detalle where cantidad > 0 and fecha >= current_date - 90 group by 1, 2
), historico as (
  select cliente, no_parte as sku,
         sum(coalesce(subtotal, total, 0) - coalesce(descuento, 0)) / nullif(sum(cantidad), 0) as precio
  from sellout_detalle where cantidad > 0 group by 1, 2
), factura as (
  select distinct on (cliente_key, articulo) cliente_key as cliente, articulo as sku, precio_unidad_pesos as precio
  from erp_ventas where movimiento_venta = 'Factura' and cliente_key in ('digitalife', 'pcel', 'dicotech') and precio_unidad_pesos > 0
  order by cliente_key, articulo, periodo desc
), lista as (
  select c.cliente, p.sku, p.precio
  from (values ('digitalife', 'API PROVISIONAL'), ('pcel', 'PCEL PROVISIONAL'), ('dicotech', 'DICOTECH')) as c(cliente, lista)
  join v_estrategia_precios_lista p on p.lista = c.lista
), skus as (
  select cliente, sku from historico
  union select cliente, sku from sellout_ensambles
)
select s.cliente, s.sku,
       coalesce(r.precio, h.precio, f.precio, l.precio) as precio_prom,
       case when r.precio is not null then '90d' when h.precio is not null then 'historico' when f.precio is not null then 'factura' when l.precio is not null then 'lista' else 'sin precio' end as base
from skus s
left join reciente r  on r.cliente = s.cliente and r.sku = s.sku
left join historico h on h.cliente = s.cliente and h.sku = s.sku
left join factura f   on f.cliente = s.cliente and f.sku = s.sku
left join lista l     on l.cliente = s.cliente and l.sku = s.sku;
grant select on public.v_sellout_precio_prom_sku to anon, authenticated;
