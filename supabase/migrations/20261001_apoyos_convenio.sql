-- Apoyos vigentes por costo convenio (2026-10-01, Fernando): apoyo por pieza = lo que le facturamos (última factura
-- del SKU al cliente) − costo convenio de la última foto de inventario del cliente. Sólo Digitalife reporta convenio.
-- Incluye los SKUs sin apoyo (apoyo_pz <= 0) para poder cuadrar; la pantalla filtra.
create or replace view public.v_apoyos_convenio as
with inv as (
  select cliente, sku, titulo, stock, costo_convenio, precio_venta, anio, semana
  from public.v_inventario_cliente_ultimo where costo_convenio is not null and costo_convenio > 0
),
fact as (
  select distinct on (cliente_key, articulo) cliente_key, articulo as sku, precio_unidad_pesos as precio, periodo::date as fecha
  from public.erp_ventas
  where movimiento_venta = 'Factura' and coalesce(unidades, 0) > 0 and cliente_key in ('digitalife','pcel','dicotech')
  order by cliente_key, articulo, periodo desc
),
so as (
  select cliente, no_parte as sku, sum(cantidad) as pz90
  from public.sellout_detalle where fecha >= current_date - 90 group by 1, 2
)
select i.cliente, i.sku, i.titulo, i.anio, i.semana, i.stock, i.costo_convenio, i.precio_venta,
       f.precio as precio_factura, f.fecha as fecha_factura,
       round((f.precio - i.costo_convenio)::numeric, 2) as apoyo_pz,
       case when f.precio > 0 then round((100 * (f.precio - i.costo_convenio) / f.precio)::numeric, 1) end as apoyo_pct,
       coalesce(s.pz90, 0) as vendidas_90d,
       round(((f.precio - i.costo_convenio) * i.stock)::numeric, 2) as apoyo_inventario
from inv i
join fact f on f.cliente_key = i.cliente and f.sku = i.sku
left join so s on s.cliente = i.cliente and s.sku = i.sku;
grant select on public.v_apoyos_convenio to anon, authenticated, service_role;


-- Materializada (la vista viva tardaba 3.4 s por el DISTINCT ON sobre erp_ventas): se refresca en refresh_vision_general()
-- (06:30 con el sell out y 19:30 con la foto de inventario) y desde import-central al cargar el inventario de Digitalife.
drop materialized view if exists public.mv_apoyos_convenio;
create materialized view public.mv_apoyos_convenio as
 WITH inv AS (
         SELECT v_inventario_cliente_ultimo.cliente,
            v_inventario_cliente_ultimo.sku,
            v_inventario_cliente_ultimo.titulo,
            v_inventario_cliente_ultimo.stock,
            v_inventario_cliente_ultimo.costo_convenio,
            v_inventario_cliente_ultimo.precio_venta,
            v_inventario_cliente_ultimo.anio,
            v_inventario_cliente_ultimo.semana
           FROM v_inventario_cliente_ultimo
          WHERE v_inventario_cliente_ultimo.costo_convenio IS NOT NULL AND v_inventario_cliente_ultimo.costo_convenio > 0::numeric
        ), fact AS (
         SELECT DISTINCT ON (erp_ventas.cliente_key, erp_ventas.articulo) erp_ventas.cliente_key,
            erp_ventas.articulo AS sku,
            erp_ventas.precio_unidad_pesos AS precio,
            erp_ventas.periodo AS fecha
           FROM erp_ventas
          WHERE erp_ventas.movimiento_venta = 'Factura'::text AND COALESCE(erp_ventas.unidades, 0::numeric) > 0::numeric AND (erp_ventas.cliente_key = ANY (ARRAY['digitalife'::text, 'pcel'::text, 'dicotech'::text]))
          ORDER BY erp_ventas.cliente_key, erp_ventas.articulo, erp_ventas.periodo DESC
        ), so AS (
         SELECT sellout_detalle.cliente,
            sellout_detalle.no_parte AS sku,
            sum(sellout_detalle.cantidad) AS pz90
           FROM sellout_detalle
          WHERE sellout_detalle.fecha >= (CURRENT_DATE - 90)
          GROUP BY sellout_detalle.cliente, sellout_detalle.no_parte
        )
 SELECT i.cliente,
    i.sku,
    i.titulo,
    i.anio,
    i.semana,
    i.stock,
    i.costo_convenio,
    i.precio_venta,
    f.precio AS precio_factura,
    f.fecha AS fecha_factura,
    round(f.precio - i.costo_convenio, 2) AS apoyo_pz,
        CASE
            WHEN f.precio > 0::numeric THEN round(100::numeric * (f.precio - i.costo_convenio) / f.precio, 1)
            ELSE NULL::numeric
        END AS apoyo_pct,
    COALESCE(s.pz90, 0::numeric) AS vendidas_90d,
    round((f.precio - i.costo_convenio) * i.stock::numeric, 2) AS apoyo_inventario
   FROM inv i
     JOIN fact f ON f.cliente_key = i.cliente AND f.sku = i.sku
     LEFT JOIN so s ON s.cliente = i.cliente AND s.sku = i.sku;
create unique index mv_apoyos_convenio_pk on public.mv_apoyos_convenio (cliente, sku);
grant select on public.mv_apoyos_convenio to anon, authenticated, service_role;
create or replace view public.v_apoyos_convenio as select * from public.mv_apoyos_convenio;
create or replace function public.refresh_vision_general()
returns void language plpgsql security definer set search_path to 'public' as $$
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
end;
$$;
