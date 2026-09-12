-- Sell Out consolidado · vistas derivadas sobre las MVs de 20260912_sellout_global_base.sql
-- Todas son baratas (leen MVs de miles de filas, no las tablas de 440 K).
-- Cada sentencia va separada por `-- @@` porque la Management API corta a los 2 min.

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · Inventario en el cliente · foto por SKU y resumen por mes
--     Sólo los 3 propios reportan inventario: digitalife y dicotech en
--     inventario_cliente (anio + semana ISO), PCEL en sellout_pcel.inventario.
--     El mes de una semana ISO es el mes de su jueves.
-- ────────────────────────────────────────────────────────────────────────────
-- @@
create or replace view public.v_sellout_inventario_semana as
select i.cliente as cuenta, i.anio, i.semana,
       (date_trunc('week', make_date(i.anio, 1, 4))::date + (i.semana - 1) * 7 + 3) as fecha_semana,
       upper(trim(i.sku)) as sku, i.marca, i.titulo,
       coalesce(i.stock, 0)::numeric as stock,
       coalesce(nullif(i.valor, 0), coalesce(i.stock, 0) * coalesce(i.costo_convenio, 0))::numeric as valor,
       i.costo_convenio, i.precio_venta, i.dias_sin_venta, i.fecha_ultima_venta
from public.inventario_cliente i
where i.anio is not null and i.semana is not null
union all
select 'pcel', p.anio, p.semana,
       (date_trunc('week', make_date(p.anio, 1, 4))::date + (p.semana - 1) * 7 + 3),
       coalesce(nullif(upper(trim(p.modelo)), ''), m.sku_acteck, p.sku),
       p.marca, p.producto,
       coalesce(p.inventario, 0)::numeric,
       (coalesce(p.inventario, 0) * coalesce(pl.precio, m.costo_promedio, p.costo_promedio, 0))::numeric,
       coalesce(m.costo_promedio, p.costo_promedio), pl.precio, null::numeric, null::date
from public.sellout_pcel p
left join public.pcel_sku_map m on m.sku_pcel = p.sku
left join public.v_precio_pcel_sku pl on pl.sku = coalesce(nullif(upper(trim(p.modelo)), ''), m.sku_acteck)
where p.anio is not null and p.semana is not null;

-- @@
comment on view public.v_sellout_inventario_semana is
  'Inventario en casa del cliente, por cuenta / semana ISO / SKU. digitalife y dicotech de inventario_cliente (valor = valor, o stock × costo_convenio); PCEL de sellout_pcel.inventario valuado a lista (v_precio_pcel_sku), igual que su sell out.';

-- @@
create or replace view public.v_sellout_inventario_cuenta_sku as
select s.*
from public.v_sellout_inventario_semana s
join (
  select cuenta, max(anio * 100 + semana) as ult
  from public.v_sellout_inventario_semana group by 1
) u on u.cuenta = s.cuenta and u.ult = s.anio * 100 + s.semana;

-- @@
comment on view public.v_sellout_inventario_cuenta_sku is
  'Última foto de inventario en el cliente, por SKU. Una fila por cuenta × SKU.';

-- @@
create or replace view public.v_sellout_inventario_cuenta_mes as
with sem as (
  select cuenta, anio, semana, stock, valor, dias_sin_venta,
         extract(year  from fecha_semana)::int as ay,
         extract(month from fecha_semana)::int as am,
         max(anio * 100 + semana) over (partition by cuenta, date_trunc('month', fecha_semana)) as ult
  from public.v_sellout_inventario_semana
)
select cuenta, ay as anio, am as mes, max(semana) as semana,
       sum(valor)::numeric as valor,
       sum(stock)::numeric as piezas,
       count(*) filter (where stock > 0)            as skus_con_stock,
       count(*) filter (where dias_sin_venta >= 30) as skus_sin_venta_30
from sem
where anio * 100 + semana = ult
group by 1, 2, 3;

-- @@
comment on view public.v_sellout_inventario_cuenta_mes is
  'Inventario en el cliente al cierre de cada mes (última semana ISO cuyo jueves cae en ese mes).';

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · Clientes finales: activos, nuevos, perdidos, recompra, ticket
-- ────────────────────────────────────────────────────────────────────────────
-- @@
create or replace view public.v_sellout_clientes_resumen_mes as
with m as (
  select cuenta, anio, mes, cliente_final, importe, facturas, (anio * 12 + mes) as idx
  from public.mv_sellout_cliente_final_mes
),
act as (
  select c.cuenta, c.anio, c.mes, c.idx, c.importe, c.facturas,
         (p.cliente_final is not null) as repite
  from m c
  left join m p on p.cuenta = c.cuenta and p.idx = c.idx - 1 and p.cliente_final = c.cliente_final
),
res as (
  select cuenta, anio, mes, idx,
         count(*)                          as activos,
         count(*) filter (where not repite) as nuevos,
         count(*) filter (where repite)     as repiten,
         sum(importe)::numeric              as importe,
         sum(facturas)                      as facturas
  from act group by 1, 2, 3, 4
),
perdidos as (
  -- compraron en el mes anterior y no en éste
  select x.cuenta, x.idx + 1 as idx, count(*) as perdidos
  from m x
  where not exists (select 1 from m y where y.cuenta = x.cuenta and y.idx = x.idx + 1 and y.cliente_final = x.cliente_final)
  group by 1, 2
)
select r.cuenta, r.anio, r.mes,
       r.activos, r.nuevos, coalesce(pd.perdidos, 0) as perdidos,
       r.importe, r.facturas,
       case when r.facturas > 0 then (r.importe / r.facturas)::numeric end as ticket_promedio,
       case when r.activos > 0 then (100.0 * r.repiten / r.activos)::numeric end as recompra_pct
from res r
left join perdidos pd on pd.cuenta = r.cuenta and pd.idx = r.idx;

-- @@
comment on view public.v_sellout_clientes_resumen_mes is
  'Clientes finales por cuenta y mes: activos, nuevos (no compraron el mes anterior), perdidos (compraron el mes anterior y no éste), % de recompra y ticket promedio por factura.';

-- ────────────────────────────────────────────────────────────────────────────
-- 3 · Vendedores: activos, recurrentes (los 3 últimos meses), nuevos, perdidos
-- ────────────────────────────────────────────────────────────────────────────
-- @@
create or replace view public.v_sellout_vendedores_resumen_mes as
with m as (
  select cuenta, anio, mes, vendedor, importe, (anio * 12 + mes) as idx
  from public.mv_sellout_vendedor_mes
),
act as (
  select c.cuenta, c.anio, c.mes, c.idx, c.importe,
         (p1.vendedor is not null) as repite,
         (p1.vendedor is not null and p2.vendedor is not null) as recurrente
  from m c
  left join m p1 on p1.cuenta = c.cuenta and p1.idx = c.idx - 1 and p1.vendedor = c.vendedor
  left join m p2 on p2.cuenta = c.cuenta and p2.idx = c.idx - 2 and p2.vendedor = c.vendedor
),
res as (
  select cuenta, anio, mes, idx,
         count(*)                             as activos,
         count(*) filter (where not repite)    as nuevos,
         count(*) filter (where recurrente)    as recurrentes,
         sum(importe)::numeric                 as importe
  from act group by 1, 2, 3, 4
),
perdidos as (
  select x.cuenta, x.idx + 1 as idx, count(*) as perdidos
  from m x
  where not exists (select 1 from m y where y.cuenta = x.cuenta and y.idx = x.idx + 1 and y.vendedor = x.vendedor)
  group by 1, 2
)
select r.cuenta, r.anio, r.mes, r.activos, r.nuevos, coalesce(pd.perdidos, 0) as perdidos, r.recurrentes, r.importe
from res r
left join perdidos pd on pd.cuenta = r.cuenta and pd.idx = r.idx;

-- @@
comment on view public.v_sellout_vendedores_resumen_mes is
  'Vendedores del mayorista por cuenta y mes: activos, nuevos, perdidos y recurrentes (con venta también en los dos meses anteriores).';

-- ────────────────────────────────────────────────────────────────────────────
-- 4 · La vista que lee la tabla: una fila por cuenta y mes con todo junto.
--     El MTD "a mismo día" NO sale de aquí: eso lo arma el navegador con
--     mv_sellout_cuenta_dia (unas 10 K filas).
-- ────────────────────────────────────────────────────────────────────────────
-- @@
create or replace view public.v_sellout_cuenta_mes as
select c.cuenta, c.nombre, c.canal_sellout, c.erp_cliente, c.propio, c.granularidad,
       d.anio, d.mes,
       d.importe, d.cantidad,
       si.fact_neta      as sell_in,
       si.piezas_venta_neta as sell_in_piezas,
       dim.clientes_finales, dim.vendedores, dim.sucursales, dim.facturas, dim.estados,
       dim.importe_sin_estado, dim.importe_sin_cliente, dim.importe_fuente,
       inv.valor  as inv_valor, inv.piezas as inv_piezas,
       inv.skus_con_stock as inv_skus, inv.skus_sin_venta_30 as inv_skus_sin_venta_30, inv.semana as inv_semana,
       cli.activos as cf_activos, cli.nuevos as cf_nuevos, cli.perdidos as cf_perdidos,
       cli.recompra_pct as cf_recompra_pct, cli.ticket_promedio as cf_ticket,
       ven.activos as vend_activos, ven.nuevos as vend_nuevos, ven.perdidos as vend_perdidos, ven.recurrentes as vend_recurrentes
from public.v_sellout_cuentas c
join (
  select cuenta, anio, mes, sum(importe)::numeric importe, sum(cantidad)::numeric cantidad
  from public.mv_sellout_cuenta_dia group by 1, 2, 3
) d on d.cuenta = c.cuenta
left join public.mv_analisis_cliente_mes si
  on si.cliente = c.erp_cliente and si.anio = d.anio and si.mes = d.mes
left join public.mv_sellout_dim_cuenta_mes dim
  on dim.cuenta = c.cuenta and dim.anio = d.anio and dim.mes = d.mes
left join public.v_sellout_inventario_cuenta_mes inv
  on inv.cuenta = c.cuenta and inv.anio = d.anio and inv.mes = d.mes
left join public.v_sellout_clientes_resumen_mes cli
  on cli.cuenta = c.cuenta and cli.anio = d.anio and cli.mes = d.mes
left join public.v_sellout_vendedores_resumen_mes ven
  on ven.cuenta = c.cuenta and ven.anio = d.anio and ven.mes = d.mes;

-- @@
comment on view public.v_sellout_cuenta_mes is
  'Una fila por cuenta de sell out y mes: monto/piezas (sin IVA), sell in del ERP (fact neta del código de cliente de v_sellout_cuentas), dimensiones del mayorista, inventario en el cliente y resúmenes de clientes finales y vendedores.';

-- ────────────────────────────────────────────────────────────────────────────
-- 5 · Refresco · lo llama el puente / import-central junto con el resto.
-- ────────────────────────────────────────────────────────────────────────────
-- @@
create or replace function public.refresh_sellout_global()
returns void language plpgsql security definer set search_path = public as $$
begin
  refresh materialized view public.mv_sellout_estado_norm;
  refresh materialized view concurrently public.mv_sellout_cuenta_dia;
  refresh materialized view concurrently public.mv_sellout_cuenta_sku_mes;
  refresh materialized view concurrently public.mv_sellout_dim_cuenta_mes;
  refresh materialized view concurrently public.mv_sellout_estado_mes;
  refresh materialized view concurrently public.mv_sellout_cliente_final_mes;
  refresh materialized view concurrently public.mv_sellout_vendedor_mes;
  refresh materialized view concurrently public.mv_sellout_sucursal_mes;
end;
$$;

-- @@
-- Todo lo de Sell Out cuelga de mv_sellout_unificado, así que el refresco que ya llaman el
-- puente (bridge/lib/api.mjs) y api/import-central.js arrastra también las MVs nuevas.
-- Así no hay un segundo sitio del que acordarse al cargar sell out.
create or replace function public.refresh_mv_sellout_unificado()
returns void language plpgsql security definer set search_path = public as $$
begin
  refresh materialized view public.mv_sellout_unificado;
  perform public.refresh_sellout_global();
end;
$$;

-- @@
comment on function public.refresh_sellout_global() is
  'Refresca las MVs de la pantalla Sell Out consolidado. Llamarla después de cargar sellout_general / sellout_detalle / sellout_pcel (puente SQL o importador central).';

-- @@
grant select on public.v_sellout_inventario_semana, public.v_sellout_inventario_cuenta_sku,
  public.v_sellout_inventario_cuenta_mes, public.v_sellout_clientes_resumen_mes,
  public.v_sellout_vendedores_resumen_mes, public.v_sellout_cuenta_mes
  to anon, authenticated, service_role;

-- @@
grant execute on function public.refresh_sellout_global() to service_role, authenticated;

-- @@
grant execute on function public.refresh_mv_sellout_unificado() to service_role, authenticated;
