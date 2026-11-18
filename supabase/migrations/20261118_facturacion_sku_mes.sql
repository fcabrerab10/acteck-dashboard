-- S&OP (2026-11-18, rendimiento): el drill del SKU sólo necesita la demanda total por mes de 12 meses; la
-- facturación por cliente (30 K filas) ahora se baja sólo de los 6 meses que usa el motor y el total mensual
-- sale de esta vista (≈ 9 K filas angostas). Sólo internos.
create or replace view public.v_facturacion_sku_mes as
select sku, anio, mes, sum(piezas)::int as piezas
from public.facturacion_clientes
where (select public.es_interno())
group by sku, anio, mes;
grant select on public.v_facturacion_sku_mes to authenticated;
