-- Dedupe de Dicotech materializado (2026-09-29). La vista v_sellout_general_dicotech (dedupe por línea natural,
-- 2026-09-28) tardaba ~1.1 s sola y ~2.2 s dentro de v_sellout_general_vendedor_mes (UNION con los 440 K de
-- sellout_general): Pagos la consulta al cargar y el rol de la app la cancelaba (statement_timeout 3 s / 8 s →
-- 500) y la pestaña se quedaba en «Cargando Pagos…» hasta agotar reintentos. Ahora el cálculo vive en una
-- materializada que se refresca junto con las demás del sell out (refresh_mv_sellout_unificado, que llaman el
-- puente e import-central) y la vista sólo la lee. Misma definición, mismas columnas.
drop materialized view if exists public.mv_sellout_general_dicotech;
create materialized view public.mv_sellout_general_dicotech as
with base as (
  select g.*, date(g.updated_at) as carga
  from public.sellout_general g
  where g.mayorista = 'DICOTECH'
),
ultima_carga as (
  select fecha, factura, sku, cantidad, importe,
         coalesce(sucursal, '') as s, coalesce(vendedor_nombre, '') as v, coalesce(cliente_nombre, '') as c,
         max(carga) as carga
  from base
  group by 1, 2, 3, 4, 5, 6, 7, 8
),
limpio as (
  select b.*
  from base b
  join ultima_carga u
    on u.fecha = b.fecha and u.factura is not distinct from b.factura and u.sku = b.sku
   and u.cantidad is not distinct from b.cantidad and u.importe is not distinct from b.importe
   and u.s = coalesce(b.sucursal, '') and u.v = coalesce(b.vendedor_nombre, '') and u.c = coalesce(b.cliente_nombre, '')
   and u.carga = b.carga
),
cobertura as (
  select anio, mes,
         count(*) filter (where id > 0) as n_puente,
         count(*) filter (where id < 0) as n_manual
  from limpio
  group by anio, mes
)
-- Nombres homogéneos: desde 2026 el origen manda la misma sucursal en dos grafías (GDL/gdl, ZACATECAS/Zacatecas,
-- AMAZON/amazon) y el mismo cliente final con mayúsculas distintas; sin esto la pantalla los mostraba como dos.
select l.id, l.idcliente, l.mayorista, l.fecha, l.anio, l.mes, l.sku, l.sku_cliente, l.descripcion, l.cliente_codigo,
       nullif(initcap(lower(trim(l.cliente_nombre))), '') as cliente_nombre,
       l.cliente_rfc, l.vendedor, l.vendedor_nombre, l.almacen, nullif(upper(trim(l.sucursal)), '') as sucursal, l.cantidad, l.precio_unitario, l.importe, l.factura, l.marca,
       l.estado, l.linea, l.moneda, l.importe_usd, l.tipocambio, l.updated_at
from limpio l
join cobertura c on c.anio = l.anio and c.mes = l.mes
where (l.id > 0 and c.n_puente >= c.n_manual) or (l.id < 0 and c.n_manual > c.n_puente);
create unique index mv_sellout_general_dicotech_id on public.mv_sellout_general_dicotech (id);
create index mv_sellout_general_dicotech_mes on public.mv_sellout_general_dicotech (anio, mes);
grant select on public.mv_sellout_general_dicotech to anon, authenticated, service_role;

create or replace view public.v_sellout_general_dicotech as
select * from public.mv_sellout_general_dicotech;
comment on view public.v_sellout_general_dicotech is
  'sellout_general de DICOTECH sin doble conteo (lee mv_sellout_general_dicotech; se refresca con refresh_mv_sellout_unificado). Sólo aporta dimensiones; el monto canónico es sellout_detalle.';

create or replace function public.refresh_mv_sellout_unificado()
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  refresh materialized view concurrently public.mv_sellout_general_dicotech;
  refresh materialized view public.mv_sellout_unificado;
  perform public.refresh_sellout_global();
end;
$$;

-- Vendedores de Dicotech por mes, sólo desde la materializada (Pagos › cálculo por vendedor). v_sellout_general_vendedor_mes
-- une los 440 K renglones de sellout_general y tarda 3 s aunque se filtre a Dicotech.
create or replace view public.v_sellout_dicotech_vendedor_mes as
select mayorista, anio, mes, vendedor_nombre, sum(importe) as importe, sum(cantidad) as cantidad, count(*)::integer as tx
from public.mv_sellout_general_dicotech
group by mayorista, anio, mes, vendedor_nombre;
grant select on public.v_sellout_dicotech_vendedor_mes to anon, authenticated, service_role;
