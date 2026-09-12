-- 2026-09-12 · Sell-out de clientes: una sola base (SIN IVA) y una sola fuente por cliente.
--
-- Decisiones de Fernando (ver docs/AUDITORIA_CARGAS_CLIENTES.md):
--   A) Dicotech se sigue cargando a mano: la VENTA sale sólo de `sellout_detalle`.
--      `sellout_general` (puente SQL) queda como fuente de vendedores, sucursales y
--      clientes finales. En `v_sellout_unificado` Dicotech entra sólo por la rama
--      "distribuidor" (se excluye mayorista='DICOTECH' de la rama mayoreo) para que
--      no se cuente dos veces.
--   B) TODO el sell-out va SIN IVA. El monto canónico de `sellout_detalle` es
--      (subtotal − descuento):
--        · Digitalife  → `total` viene CON IVA y `subtotal` sin descuento aplicado;
--                        (subtotal − descuento) = total / 1.16.
--        · Dicotech    → `subtotal` ya viene sin IVA y `descuento` es 0.
--      Así desaparece el salto artificial de +16 % entre abril y mayo de Dicotech y
--      el septiembre en $0 (venía de la columna `total_venta` que el CSV dejó de traer).
--
-- Además: `sellout_general` de DICOTECH tiene dos orígenes mezclados — ids positivos del
-- puente SQL e ids negativos (hash) de las cargas manuales del CSV de Revko — y en
-- may–ago 2026 la misma venta está en los dos. `v_sellout_general_dicotech` se queda, mes a
-- mes, con el origen que trae más filas, para que los rankings no salgan inflados.

-- ── Dicotech: sellout_general sin doble origen ──────────────────────────────
create or replace view v_sellout_general_dicotech as
with cobertura as (
  -- Por mes: cuántas filas aportó cada origen (id > 0 = puente SQL, id < 0 = hash del CSV manual).
  select anio, mes,
         count(*) filter (where id > 0) as n_puente,
         count(*) filter (where id < 0) as n_manual
  from sellout_general where mayorista = 'DICOTECH'
  group by anio, mes
)
select g.*
from sellout_general g
join cobertura c on c.anio = g.anio and c.mes = g.mes
where g.mayorista = 'DICOTECH'
  -- En los meses con los dos orígenes gana el que trae más filas (es el corte completo).
  and ((g.id > 0 and c.n_puente >= c.n_manual) or (g.id < 0 and c.n_manual > c.n_puente));

comment on view v_sellout_general_dicotech is
  'sellout_general de DICOTECH sin doble conteo: en may-ago 2026 la misma venta entró por el puente SQL (id>0) y por la carga manual del CSV de Revko (id<0); por mes se conserva sólo el origen con más filas.';

-- ── Sell out por cliente/SKU/mes (Digitalife y cualquier cliente de sellout_detalle) ──
create or replace view v_sellout_detalle_sku_mes as
select cliente,
       no_parte as sku,
       marca,
       (extract(year from fecha))::integer  as anio,
       (extract(month from fecha))::integer as mes,
       sum(cantidad)                                                as piezas,
       sum(coalesce(subtotal, total, 0) - coalesce(descuento, 0))   as monto,   -- SIN IVA
       sum(cantidad * precio)                                       as monto_bruto,
       (count(*))::integer                                          as tx,
       max(fecha)                                                   as ultima_fecha
from sellout_detalle
where no_parte is not null and fecha is not null
group by cliente, no_parte, marca, (extract(year from fecha)), (extract(month from fecha));

create or replace view v_sellout_digitalife_sku_mes as
select no_parte as sku,
       (extract(year from fecha))::integer  as anio,
       (extract(month from fecha))::integer as mes,
       sum(cantidad) as piezas,
       sum(coalesce(subtotal, total, 0) - coalesce(descuento, 0)) as monto,
       avg(precio) as precio_prom
from sellout_detalle
where cliente = 'digitalife' and fecha is not null and no_parte is not null
group by no_parte, (extract(year from fecha))::integer, (extract(month from fecha))::integer;

create or replace view v_sellout_digitalife_marca_mes as
select upper(trim(marca)) as marca,
       (extract(year from fecha))::integer  as anio,
       (extract(month from fecha))::integer as mes,
       sum(cantidad) as piezas,
       sum(coalesce(subtotal, total, 0) - coalesce(descuento, 0)) as monto,
       (count(*))::integer as tx,
       (count(distinct no_parte))::integer as skus_distintos
from sellout_detalle
where cliente = 'digitalife' and fecha is not null and marca is not null
group by upper(trim(marca)), (extract(year from fecha))::integer, (extract(month from fecha))::integer;

create or replace view v_sellout_digitalife_mensual as
select (extract(year from fecha))::integer  as anio,
       (extract(month from fecha))::integer as mes,
       sum(cantidad) as piezas,
       sum(coalesce(subtotal, total, 0) - coalesce(descuento, 0)) as monto,
       (count(*))::integer as tx,
       (count(distinct no_parte))::integer as skus_distintos,
       (count(distinct marca))::integer as marcas_distintas,
       0 as clientes_distintos,
       (count(distinct fecha))::integer as facturas   -- en realidad días con venta (Digitalife no manda folio)
from sellout_detalle
where cliente = 'digitalife' and fecha is not null
group by (extract(year from fecha))::integer, (extract(month from fecha))::integer;

-- ── Dicotech: venta desde sellout_detalle; sucursal/cliente/vendedor desde el puente ──
create or replace view v_sellout_dicotech_sku_mes as
select no_parte as sku,
       (extract(year from fecha))::integer  as anio,
       (extract(month from fecha))::integer as mes,
       sum(cantidad) as piezas,
       sum(coalesce(subtotal, total, 0) - coalesce(descuento, 0)) as monto
from sellout_detalle
where cliente = 'dicotech' and fecha is not null and no_parte is not null
group by no_parte, (extract(year from fecha))::integer, (extract(month from fecha))::integer;

create or replace view v_sellout_dicotech_mensual as
with detalle as (
  select (extract(year from fecha))::integer  as anio,
         (extract(month from fecha))::integer as mes,
         sum(cantidad) as piezas,
         sum(coalesce(subtotal, total, 0) - coalesce(descuento, 0)) as monto,
         (count(*))::integer as tx,
         (count(distinct no_parte))::integer as skus_distintos
  from sellout_detalle
  where cliente = 'dicotech' and fecha is not null
  group by 1, 2
), general as (
  select anio, mes,
         (count(distinct cliente_nombre))::integer as clientes_distintos,
         (count(distinct factura))::integer        as facturas   -- antes: count(distinct sucursal) → 11-12
  from v_sellout_general_dicotech
  group by anio, mes
)
select coalesce(d.anio, g.anio) as anio,
       coalesce(d.mes, g.mes)   as mes,
       coalesce(d.piezas, 0)          as piezas,
       coalesce(d.monto, 0)           as monto,
       coalesce(d.tx, 0)              as tx,
       coalesce(d.skus_distintos, 0)  as skus_distintos,
       coalesce(g.clientes_distintos, 0) as clientes_distintos,
       coalesce(g.facturas, 0)        as facturas
from detalle d full join general g using (anio, mes);

create or replace view v_sellout_dicotech_sucursal_mes as
select sucursal, anio, mes,
       sum(cantidad) as piezas,
       sum(importe)  as monto,
       (count(*))::integer as tx,
       (count(distinct sku))::integer as skus_distintos,
       (count(distinct cliente_nombre))::integer as clientes_distintos
from v_sellout_general_dicotech
group by sucursal, anio, mes;

create or replace view v_sellout_general_vendedor_mes as
select mayorista, anio, mes, vendedor_nombre,
       sum(importe)  as importe,
       sum(cantidad) as cantidad,
       (count(*))::integer as tx
from (
  select mayorista, anio, mes, vendedor_nombre, importe, cantidad from sellout_general where mayorista is distinct from 'DICOTECH'
  union all
  select mayorista, anio, mes, vendedor_nombre, importe, cantidad from v_sellout_general_dicotech
) t
group by mayorista, anio, mes, vendedor_nombre;
