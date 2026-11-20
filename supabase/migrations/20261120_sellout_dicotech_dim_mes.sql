-- Sell Out Dicotech (2026-11-20, rendimiento): la pantalla bajaba el detalle por renglón (≈ 49 K filas) sólo para
-- rankings de vendedores/clientes, mapa de calor y drill por sucursal, que no usan el SKU. Esta vista lo agrupa por
-- mes × cliente final × vendedor × sucursal (≈ 18 K filas angostas); el detalle con SKU se pide al abrir un drill.
create or replace view public.v_sellout_dicotech_dim_mes as
select anio, mes, cliente_nombre, vendedor_nombre, sucursal,
       sum(cantidad) as cantidad, round(sum(importe)::numeric, 2) as importe, count(*)::int as tx
from public.mv_sellout_general_dicotech
where (select public.es_interno()) or public.cliente_visible('dicotech')
group by anio, mes, cliente_nombre, vendedor_nombre, sucursal;
grant select on public.v_sellout_dicotech_dim_mes to authenticated;
