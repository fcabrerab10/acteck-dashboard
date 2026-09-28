-- Ensambles de Digitalife (2026-09-28). Fernando: «la venta en piezas se une al sell out; el monto sácalo como
-- el promedio al que se vende normalmente el producto; y en el drill que se separe el ensamble».
-- Digitalife arma PCs ("PC BASICS 5600GT V2"…) con gabinetes, monitores y fuentes nuestros; esa salida NO viene en
-- su reporte de sell out (los componentes tampoco aparecen sueltos). Este archivo semanal trae fecha, folio, modelo
-- del ensamble, marca, número de parte, descripción y cantidad, sin precio.
--   sellout_ensambles          líneas del archivo (dedup por hash)
--   v_sellout_precio_prom_sku  precio promedio suelto por cliente+SKU (últimos 90 d; si no, histórico)
--   v_sellout_ensambles_sku_mes / v_sellout_ensambles_modelo  agregados para pantalla
--   v_sellout_digitalife_{sku_mes,mensual,marca_mes} y v_sellout_detalle_sku_mes suman ensambles y exponen
--   piezas_suelto/monto_suelto/piezas_ensamble/monto_ensamble; v_sellout_unificado (consolidado) gana una rama.

create table if not exists public.sellout_ensambles (
  id          uuid primary key default gen_random_uuid(),
  cliente     text not null default 'digitalife',
  fecha       date not null,
  folio       text,
  ensamble    text,
  marca       text,
  sku         text not null,
  descripcion text,
  cantidad    numeric not null default 0,
  row_hash    text not null,
  updated_at  timestamptz not null default now(),
  unique (cliente, fecha, folio, sku, row_hash)
);
create index if not exists sellout_ensambles_cliente_fecha_idx on public.sellout_ensambles (cliente, fecha);
create index if not exists sellout_ensambles_sku_idx on public.sellout_ensambles (cliente, sku);

alter table public.sellout_ensambles enable row level security;
drop policy if exists sellout_ensambles_select on public.sellout_ensambles;
drop policy if exists sellout_ensambles_write on public.sellout_ensambles;
create policy sellout_ensambles_select on public.sellout_ensambles for select to authenticated using (user_can_see_cliente(normalize_cliente(cliente)));
create policy sellout_ensambles_write  on public.sellout_ensambles for all to authenticated using (user_can_edit()) with check (user_can_edit());
grant select, insert, update, delete on public.sellout_ensambles to authenticated;
grant select on public.sellout_ensambles to anon;

-- Precio promedio al que se vende suelto cada SKU (Σ monto sin IVA / Σ piezas): 90 días; si no hay, histórico.
create or replace view public.v_sellout_precio_prom_sku as
with reciente as (
  select cliente, no_parte as sku,
         sum(coalesce(subtotal, total, 0) - coalesce(descuento, 0)) / nullif(sum(cantidad), 0) as precio
  from sellout_detalle
  where cantidad > 0 and fecha >= current_date - 90
  group by 1, 2
), historico as (
  select cliente, no_parte as sku,
         sum(coalesce(subtotal, total, 0) - coalesce(descuento, 0)) / nullif(sum(cantidad), 0) as precio
  from sellout_detalle
  where cantidad > 0
  group by 1, 2
)
select h.cliente, h.sku, coalesce(r.precio, h.precio) as precio_prom,
       case when r.precio is not null then '90d' else 'historico' end as base
from historico h
left join reciente r on r.cliente = h.cliente and r.sku = h.sku;
grant select on public.v_sellout_precio_prom_sku to anon, authenticated;

create or replace view public.v_sellout_ensambles_sku_mes as
select e.cliente, e.sku, max(e.marca) as marca,
       (extract(year from e.fecha))::integer  as anio,
       (extract(month from e.fecha))::integer as mes,
       sum(e.cantidad) as piezas,
       sum(e.cantidad * coalesce(pp.precio_prom, 0)) as monto,
       (count(*))::integer as tx,
       (count(distinct e.folio))::integer as ensambles,
       max(e.fecha) as ultima_fecha
from sellout_ensambles e
left join v_sellout_precio_prom_sku pp on pp.cliente = e.cliente and pp.sku = e.sku
where e.fecha is not null and e.sku is not null
group by e.cliente, e.sku, (extract(year from e.fecha))::integer, (extract(month from e.fecha))::integer;
grant select on public.v_sellout_ensambles_sku_mes to anon, authenticated;

-- Panel «Ensambles»: qué modelos de PC arma el cliente y qué componentes nuestros lleva cada uno.
create or replace view public.v_sellout_ensambles_modelo as
select e.cliente, coalesce(nullif(trim(e.ensamble), ''), '(sin modelo)') as ensamble, e.sku, max(e.descripcion) as descripcion, max(e.marca) as marca,
       sum(e.cantidad) as piezas, (count(distinct e.folio))::integer as ensambles,
       min(e.fecha) as primera_fecha, max(e.fecha) as ultima_fecha,
       sum(e.cantidad * coalesce(pp.precio_prom, 0)) as monto
from sellout_ensambles e
left join v_sellout_precio_prom_sku pp on pp.cliente = e.cliente and pp.sku = e.sku
group by e.cliente, coalesce(nullif(trim(e.ensamble), ''), '(sin modelo)'), e.sku;
grant select on public.v_sellout_ensambles_modelo to anon, authenticated;

-- ── Vistas de Digitalife: suelto + ensambles, con las dos partes expuestas ──
create or replace view public.v_sellout_digitalife_sku_mes as
with suelto as (
  select no_parte as sku, (extract(year from fecha))::integer as anio, (extract(month from fecha))::integer as mes,
         sum(cantidad) as piezas, sum(coalesce(subtotal, total, 0) - coalesce(descuento, 0)) as monto, avg(precio) as precio_prom
  from sellout_detalle where cliente = 'digitalife' and fecha is not null and no_parte is not null
  group by 1, 2, 3
), ens as (
  select sku, anio, mes, piezas, monto from v_sellout_ensambles_sku_mes where cliente = 'digitalife'
)
select coalesce(s.sku, e.sku) as sku, coalesce(s.anio, e.anio) as anio, coalesce(s.mes, e.mes) as mes,
       coalesce(s.piezas, 0) + coalesce(e.piezas, 0) as piezas,
       coalesce(s.monto, 0) + coalesce(e.monto, 0)   as monto,
       s.precio_prom,
       coalesce(s.piezas, 0) as piezas_suelto, coalesce(s.monto, 0) as monto_suelto,
       coalesce(e.piezas, 0) as piezas_ensamble, coalesce(e.monto, 0) as monto_ensamble
from suelto s
full join ens e on e.sku = s.sku and e.anio = s.anio and e.mes = s.mes;

create or replace view public.v_sellout_digitalife_mensual as
with suelto as (
  select (extract(year from fecha))::integer as anio, (extract(month from fecha))::integer as mes,
         sum(cantidad) as piezas, sum(coalesce(subtotal, total, 0) - coalesce(descuento, 0)) as monto,
         (count(*))::integer as tx, (count(distinct no_parte))::integer as skus_distintos, (count(distinct marca))::integer as marcas_distintas,
         (count(distinct fecha))::integer as facturas
  from sellout_detalle where cliente = 'digitalife' and fecha is not null
  group by 1, 2
), ens as (
  select anio, mes, sum(piezas) as piezas, sum(monto) as monto, sum(tx)::integer as tx, sum(ensambles)::integer as ensambles
  from v_sellout_ensambles_sku_mes where cliente = 'digitalife' group by 1, 2
)
select coalesce(s.anio, e.anio) as anio, coalesce(s.mes, e.mes) as mes,
       coalesce(s.piezas, 0) + coalesce(e.piezas, 0) as piezas,
       coalesce(s.monto, 0) + coalesce(e.monto, 0)   as monto,
       coalesce(s.tx, 0) + coalesce(e.tx, 0)         as tx,
       s.skus_distintos, s.marcas_distintas, 0 as clientes_distintos, s.facturas,
       coalesce(s.piezas, 0) as piezas_suelto, coalesce(s.monto, 0) as monto_suelto,
       coalesce(e.piezas, 0) as piezas_ensamble, coalesce(e.monto, 0) as monto_ensamble, coalesce(e.ensambles, 0) as ensambles
from suelto s
full join ens e on e.anio = s.anio and e.mes = s.mes;

create or replace view public.v_sellout_digitalife_marca_mes as
with suelto as (
  select upper(trim(marca)) as marca, (extract(year from fecha))::integer as anio, (extract(month from fecha))::integer as mes,
         sum(cantidad) as piezas, sum(coalesce(subtotal, total, 0) - coalesce(descuento, 0)) as monto,
         (count(*))::integer as tx, (count(distinct no_parte))::integer as skus_distintos
  from sellout_detalle where cliente = 'digitalife' and fecha is not null and marca is not null
  group by 1, 2, 3
), ens as (
  select upper(trim(marca)) as marca, anio, mes, sum(piezas) as piezas, sum(monto) as monto, sum(tx)::integer as tx, count(distinct sku)::integer as skus
  from v_sellout_ensambles_sku_mes where cliente = 'digitalife' and marca is not null group by 1, 2, 3
)
select coalesce(s.marca, e.marca) as marca, coalesce(s.anio, e.anio) as anio, coalesce(s.mes, e.mes) as mes,
       coalesce(s.piezas, 0) + coalesce(e.piezas, 0) as piezas,
       coalesce(s.monto, 0) + coalesce(e.monto, 0)   as monto,
       coalesce(s.tx, 0) + coalesce(e.tx, 0)         as tx,
       greatest(coalesce(s.skus_distintos, 0), coalesce(e.skus, 0)) as skus_distintos,
       coalesce(e.piezas, 0) as piezas_ensamble, coalesce(e.monto, 0) as monto_ensamble
from suelto s
full join ens e on e.marca = s.marca and e.anio = s.anio and e.mes = s.mes;

-- Vista multicliente (celular y Análisis): sólo Digitalife tiene ensambles hoy; el resto queda igual.
create or replace view public.v_sellout_detalle_sku_mes as
with suelto as (
  select cliente, no_parte as sku, marca, (extract(year from fecha))::integer as anio, (extract(month from fecha))::integer as mes,
         sum(cantidad) as piezas, sum(coalesce(subtotal, total, 0) - coalesce(descuento, 0)) as monto, sum(cantidad * precio) as monto_bruto,
         (count(*))::integer as tx, max(fecha) as ultima_fecha
  from sellout_detalle where no_parte is not null and fecha is not null
  group by 1, 2, 3, 4, 5
), ens as (
  select cliente, sku, marca, anio, mes, piezas, monto, tx, ultima_fecha from v_sellout_ensambles_sku_mes
)
select coalesce(s.cliente, e.cliente) as cliente, coalesce(s.sku, e.sku) as sku, coalesce(s.marca, e.marca) as marca,
       coalesce(s.anio, e.anio) as anio, coalesce(s.mes, e.mes) as mes,
       coalesce(s.piezas, 0) + coalesce(e.piezas, 0) as piezas,
       coalesce(s.monto, 0) + coalesce(e.monto, 0)   as monto,
       s.monto_bruto,
       coalesce(s.tx, 0) + coalesce(e.tx, 0) as tx,
       greatest(s.ultima_fecha, e.ultima_fecha) as ultima_fecha,
       coalesce(e.piezas, 0) as piezas_ensamble, coalesce(e.monto, 0) as monto_ensamble
from suelto s
full join ens e on e.cliente = s.cliente and e.sku = s.sku and e.anio = s.anio and e.mes = s.mes;

-- ── Consolidado: rama nueva en v_sellout_unificado (misma definición de 20260912 + ensambles) ──
create or replace view v_sellout_unificado as
select 'mayoreo'::text as canal_sellout,
       g.mayorista      as fuente,
       g.cliente_nombre as cliente_final,
       g.fecha, g.anio, g.mes, g.sku, g.importe, g.cantidad
from sellout_general g
where g.anio = any (array[2025, 2026])
  and g.importe is not null
  and g.mayorista <> 'DICOTECH'     -- Dicotech entra por sellout_detalle (carga manual)

union all

select 'distribuidor'::text as canal_sellout,
       upper(d.cliente) as fuente,
       d.cliente        as cliente_final,
       d.fecha,
       (extract(year from d.fecha))::integer  as anio,
       (extract(month from d.fecha))::integer as mes,
       d.no_parte as sku,
       (coalesce(d.subtotal, d.total, 0) - coalesce(d.descuento, 0)) as importe,   -- SIN IVA
       d.cantidad
from sellout_detalle d
where d.fecha is not null
  and coalesce(d.subtotal, d.total) is not null

union all

select 'distribuidor'::text as canal_sellout,
       'PCEL'::text as fuente,
       'PCEL'::text as cliente_final,
       -- jueves de la semana ISO → el mes al que pertenece realmente esa semana
       (date_trunc('week', make_date(sp.anio, 1, 4))::date + (sp.semana - 1) * 7 + 3) as fecha,
       (extract(year  from (date_trunc('week', make_date(sp.anio, 1, 4))::date + (sp.semana - 1) * 7 + 3)))::integer as anio,
       (extract(month from (date_trunc('week', make_date(sp.anio, 1, 4))::date + (sp.semana - 1) * 7 + 3)))::integer as mes,
       coalesce(nullif(upper(trim(sp.modelo)), ''), psm.sku_acteck, sp.sku) as sku,
       (sp.vta_semana)::numeric * coalesce(pl.precio, psm.costo_promedio, sp.costo_promedio, 0) as importe,
       sp.vta_semana as cantidad
from sellout_pcel sp
left join pcel_sku_map psm on psm.sku_pcel = sp.sku
-- OJO: sellout_pcel.sku es el código numérico de PCEL; el SKU Acteck va en `modelo`.
left join v_precio_pcel_sku pl on pl.sku = coalesce(nullif(upper(trim(sp.modelo)), ''), psm.sku_acteck)
where sp.anio = any (array[2025, 2026])
  and sp.vta_semana is not null and sp.vta_semana > 0

union all

select 'directo'::text as canal_sellout,
       case
         when fc.cliente_nombre ilike '%MERCADO LIBRE%' then 'MERCADO LIBRE'
         when fc.cliente_nombre ilike '%AMAZON%'        then 'AMAZON'
         when fc.cliente_nombre ilike '%CYBERPU%'       then 'CYBERPUERTA'
         when fc.cliente_nombre ilike '%SITIO WEB%'     then 'SITIO WEB'
         when fc.canal = 'MOSTRADOR'                    then 'MOSTRADOR'
         else fc.canal
       end as fuente,
       fc.cliente_nombre as cliente_final,
       make_date(fc.anio, fc.mes, 15) as fecha,
       fc.anio, fc.mes, fc.sku, fc.monto as importe, fc.piezas as cantidad
from facturacion_clientes fc
where fc.canal = any (array['MOSTRADOR', 'E-COMMERCE'])
  and fc.anio = any (array[2025, 2026])
union all

-- Ensambles de Digitalife (2026-09-28): componentes nuestros que salen dentro de PCs armadas por el cliente.
-- Piezas reales; el importe es ESTIMADO al precio promedio al que ese SKU se vende suelto (v_sellout_precio_prom_sku).
select 'distribuidor'::text as canal_sellout,
       upper(e.cliente) as fuente,
       e.cliente        as cliente_final,
       e.fecha,
       (extract(year from e.fecha))::integer  as anio,
       (extract(month from e.fecha))::integer as mes,
       e.sku,
       (e.cantidad * coalesce(pp.precio_prom, 0)) as importe,
       e.cantidad
from sellout_ensambles e
left join v_sellout_precio_prom_sku pp on pp.cliente = e.cliente and pp.sku = e.sku
where e.fecha is not null and e.sku is not null;

refresh materialized view mv_sellout_unificado;
