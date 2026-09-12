-- 2026-09-12 · Capa canónica de medidas (2/4): INVENTARIO y COMPRAS.
--
-- Traducción literal de las medidas del director:
--   Inv Actual            = Σ Inventario[CostoInventario]  con CostoInventario <> 0
--                           ∧ Almacen[Exclusivo] <> "Inventario" ∧ Articulo[Rama] = "PRODUCTO"
--                         + Σ CostoInventario de los almacenes "4…"  ← 2º término, PENDIENTE
--   Costo Promedio        = AVERAGE(Inventario[costopromedio]) con CostoInventario <> 0
--   Costo de Compra TC 17 = Σ Compras[Costo Compra USD] × 17   (y TC 20 para el otro uso)
--   Inv Total (Inv+OC)    = Costo de Compra TC 17 + Inv Actual
--   Dias de Inv           = Inv Actual / CV Últimos 3 Meses × 90
--   Dias de Inv Total     = Inv Total  / CV Últimos 3 Meses × 90
--   Inv Cierre de Mes     = Σ HistAlmacenInv[CostoInventario] del último día del mes
--   Inv Promedio          = promedio del CostoInventario por día del calendario
--   Vueltas de Inv        = YTD Costo de Venta / Inv Promedio
--
-- ⚠ Notas de traducción (ver docs/MEDIDAS_DIRECTOR.md):
--   1. La captura de [Inv Actual] está cortada: el 2º término termina en
--      `Almacen[Almacen] = "4`. Queda parametrizado en
--      almacenes_config.inv_actual_extra y hoy suma 0.
--   2. Nuestras tablas no tienen Almacen[Exclusivo] ni Articulo[Rama]: se
--      deducen (nombre "VENTAS …" / mv_articulo_rama). Los SKUs sin historia de
--      venta no tienen rama; el parámetro `inv_rama_desconocida` decide si
--      cuentan (0 = estricto, default).
--   3. compras_oc.costo_usd es COSTO UNITARIO (Vw_TablaH_Compras del director ya
--      viene extendido). Aquí se multiplica por cantidad_pendiente de las OC
--      PENDIENTE — es el "por llegar", que es lo que tiene sentido sumarle al
--      inventario.

-- ── Inventario por SKU, con todas las variantes en una sola vista ─────────
-- Nota RLS: estas vistas NO son security_invoker, igual que v_inventario_comercial
-- y v_vision_inventario_global (las que ya consumían Inicio y Visión General).
-- Corren con los privilegios del dueño para que el inventario agregado se vea en
-- todas las pantallas; el control de "información sensible" se hace en la UI.
create or replace view public.v_medidas_inventario_sku as
with p as (
  select public.param_medida('inv_rama_desconocida', 0) as rama_desc
), base as (
  select i.articulo,
         i.no_almacen,
         coalesce(i.inventario, 0)      as inventario,
         coalesce(i.disponible, 0)      as disponible,
         coalesce(i.costoinventario, 0) as costoinventario,
         coalesce(i.costodisponible, 0) as costodisponible,
         i.costopromedio,
         coalesce(ac.comercial, false)  as comercial,
         coalesce(ac.exclusivo,
                  case when i.almacen_nombre ilike 'VENTAS%' then 'Ventas' else 'Inventario' end) as exclusivo,
         coalesce(ac.inv_actual_extra, false) as extra,
         r.rama
    from public.inventario_acteck i
    left join public.almacenes_config ac on ac.no_almacen = i.no_almacen
    left join public.mv_articulo_rama  r on r.articulo    = i.articulo
   where i.articulo is not null and i.articulo <> '__TEST__'
), f as (
  select b.*,
         (b.costoinventario <> 0
          and b.exclusivo is distinct from 'Inventario'
          and (b.rama = 'PRODUCTO' or (b.rama is null and (select rama_desc from p) = 1))
         ) as en_inv_actual
    from base b
)
select articulo,
  -- ── Medida oficial ──
  coalesce(sum(costoinventario) filter (where en_inv_actual), 0)
    + coalesce(sum(costoinventario) filter (where extra and costoinventario <> 0), 0) as inv_actual,
  coalesce(sum(inventario)  filter (where en_inv_actual), 0)
    + coalesce(sum(inventario)  filter (where extra and costoinventario <> 0), 0)     as inv_actual_piezas,
  coalesce(sum(disponible)  filter (where en_inv_actual), 0)                          as inv_actual_disponible,
  avg(costopromedio) filter (where costoinventario <> 0)                              as costo_promedio,
  -- ── Variantes históricas (sólo para la auditoría / comparativos) ──
  coalesce(sum(costoinventario) filter (where comercial), 0)                          as inv_config_costo_inventario,
  coalesce(sum(costodisponible) filter (where comercial), 0)                          as inv_config_costo_disponible,
  coalesce(sum(inventario)      filter (where comercial), 0)                          as inv_config_piezas,
  coalesce(sum(disponible)      filter (where comercial), 0)                          as inv_config_disponible,
  coalesce(sum(costoinventario) filter (where costoinventario <> 0 and exclusivo is distinct from 'Inventario'), 0) as inv_ventas_todas_ramas,
  count(*) filter (where inventario > 0)::int                                         as almacenes_con_stock
from f
group by articulo;

comment on view public.v_medidas_inventario_sku is
  'Medidas de inventario del director por SKU. inv_actual = medida OFICIAL. Las columnas inv_config_* son las variantes que usaban las pantallas antes del 2026-09-12 y sólo sirven para auditar.';
grant select on public.v_medidas_inventario_sku to authenticated, anon, service_role;

-- ── Compras (OC abiertas) ────────────────────────────────────────────────
create or replace view public.v_medidas_compras as
select coalesce(sum(coalesce(c.costo_usd,0) * coalesce(c.cantidad_pendiente,0)), 0) as compra_usd_pendiente,
       coalesce(sum(coalesce(c.costo_usd,0) * coalesce(c.cantidad_orden,0)), 0)     as compra_usd_orden,
       coalesce(sum(coalesce(c.cantidad_pendiente,0)), 0)                           as piezas_pendientes,
       coalesce(sum(coalesce(c.costo_usd,0) * coalesce(c.cantidad_pendiente,0)), 0)
         * public.param_medida('tc_compra_inv', 17)                                 as costo_compra_tc17,
       coalesce(sum(coalesce(c.costo_usd,0) * coalesce(c.cantidad_pendiente,0)), 0)
         * public.param_medida('tc_compra', 20)                                     as costo_compra_tc20,
       max(c.updated_at)                                                            as actualizado
  from public.compras_oc c
 where coalesce(c.estatus,'') = 'PENDIENTE';
grant select on public.v_medidas_compras to authenticated, anon, service_role;

-- ── Inventario histórico: cierre de mes, promedio ────────────────────────
-- Vw_TablaH_HistAlmacenInv del director = nuestra inventario_historico (foto
-- diaria desde el 2026-09-10). Mientras no haya ≥ 1 mes de historia, las
-- medidas de cierre/promedio/vueltas salen NULL: es correcto que salgan
-- vacías en pantalla en vez de inventar un número.
create or replace view public.v_medidas_inventario_dia as
with p as (select public.param_medida('inv_rama_desconocida', 0) as rama_desc),
d as (
  select h.fecha,
         coalesce(h.costoinventario,0) costoinventario,
         coalesce(h.inventario,0)      inventario,
         coalesce(ac.exclusivo,
                  case when ac.comercial then 'Ventas' else 'Inventario' end) as exclusivo,
         r.rama
    from public.inventario_historico h
    left join public.almacenes_config ac on ac.no_almacen = h.no_almacen
    left join public.mv_articulo_rama  r on r.articulo    = h.articulo
)
select fecha,
       sum(costoinventario) filter (where costoinventario <> 0
             and exclusivo is distinct from 'Inventario'
             and (rama = 'PRODUCTO' or (rama is null and (select rama_desc from p) = 1))) as inv_actual,
       sum(inventario) filter (where costoinventario <> 0
             and exclusivo is distinct from 'Inventario'
             and (rama = 'PRODUCTO' or (rama is null and (select rama_desc from p) = 1))) as inv_actual_piezas,
       sum(costoinventario) as inv_total_todos_almacenes
  from d group by fecha;
grant select on public.v_medidas_inventario_dia to authenticated, anon, service_role;

create or replace view public.v_medidas_inventario_mes as
with dias as (select * from public.v_medidas_inventario_dia),
ult as (
  select distinct on (date_trunc('month', fecha)) date_trunc('month', fecha)::date as periodo,
         fecha, inv_actual, inv_actual_piezas
    from dias order by date_trunc('month', fecha), fecha desc
)
select extract(year  from u.periodo)::int as anio,
       extract(month from u.periodo)::int as mes,
       u.fecha                            as fecha_cierre,
       u.inv_actual                       as inv_cierre_mes,
       u.inv_actual_piezas                as inv_cierre_mes_piezas,
       (select avg(d.inv_actual) from dias d where date_trunc('month', d.fecha) = u.periodo) as inv_promedio
  from ult u;
grant select on public.v_medidas_inventario_mes to authenticated, anon, service_role;

-- ── Resumen global: una fila con TODAS las medidas de inventario ─────────
-- Es la vista que deben leer las pantallas (Inventario global, Visión
-- General, Inicio, S&OP, móvil). Cero cálculo en JS.
create or replace view public.v_medidas_inventario as
with s as (
  select sum(inv_actual)                  as inv_actual,
         sum(inv_actual_piezas)           as inv_actual_piezas,
         sum(inv_actual_disponible)       as inv_actual_disponible,
         sum(inv_config_costo_inventario) as inv_config_costo_inventario,
         sum(inv_config_costo_disponible) as inv_config_costo_disponible,
         sum(inv_config_piezas)           as inv_config_piezas,
         sum(inv_config_disponible)       as inv_config_disponible,
         sum(inv_ventas_todas_ramas)      as inv_ventas_todas_ramas,
         count(*) filter (where inv_actual_piezas > 0)::int as skus_con_stock,
         avg(costo_promedio)              as costo_promedio
    from public.v_medidas_inventario_sku
),
c as (select * from public.v_medidas_compras),
cv as (
  -- CV Últimos 3 Meses = Costo Venta Neta de los 3 meses CERRADOS anteriores
  -- al mes en curso (el mes en curso NO cuenta: está incompleto).
  select coalesce(sum(m.costo_venta_neta), 0) as cv_3m
    from public.v_erp_medidas_mes m
   where make_date(m.anio, m.mes, 1) >= (date_trunc('month', current_date) - interval '3 months')::date
     and make_date(m.anio, m.mes, 1) <  date_trunc('month', current_date)::date
),
ytd as (
  select coalesce(sum(m.costo_venta_neta), 0) as ytd_costo_venta
    from public.v_erp_medidas_mes m
   where m.anio = extract(year from current_date)::int
),
prom as (select avg(inv_promedio) ip from public.v_medidas_inventario_mes)
select s.inv_actual, s.inv_actual_piezas, s.inv_actual_disponible,
       s.inv_config_costo_inventario, s.inv_config_costo_disponible,
       s.inv_config_piezas, s.inv_config_disponible, s.inv_ventas_todas_ramas,
       s.skus_con_stock, s.costo_promedio,
       c.costo_compra_tc17, c.costo_compra_tc20, c.compra_usd_pendiente, c.piezas_pendientes,
       (s.inv_actual + c.costo_compra_tc17)                      as inv_total,
       cv.cv_3m                                                  as cv_ultimos_3_meses,
       ytd.ytd_costo_venta,
       case when cv.cv_3m <> 0 then s.inv_actual / cv.cv_3m * public.param_medida('inv_dias_base', 90) end             as dias_inv,
       case when cv.cv_3m <> 0 then (s.inv_actual + c.costo_compra_tc17) / cv.cv_3m * public.param_medida('inv_dias_base', 90) end as dias_inv_total,
       prom.ip                                                   as inv_promedio,
       case when prom.ip is not null and prom.ip <> 0 then ytd.ytd_costo_venta / prom.ip end as vueltas_inv,
       (select max(updated_at) from public.inventario_acteck)     as actualizado
  from s, c, cv, ytd, prom;

comment on view public.v_medidas_inventario is
  'UNA fila con todas las medidas de inventario del director. Fuente única para Inventario global, Visión General, Inicio, S&OP y móvil.';
grant select on public.v_medidas_inventario to authenticated, anon, service_role;

notify pgrst, 'reload schema';

-- ── Detalle SKU × almacén con la bandera de [Inv Actual] ya resuelta ─────
-- La usa Inventario global: necesita el grano por almacén (facetas CEDIS /
-- tipo) pero tiene que sumar EXACTAMENTE lo mismo que v_medidas_inventario.
-- `en_inv_actual` es la condición del director en una sola columna, para que
-- la pantalla no vuelva a mantener su propio Set de almacenes comerciales.
create or replace view public.v_inventario_almacen_medida as
with p as (select public.param_medida('inv_rama_desconocida', 0) as rama_desc)
select i.articulo, i.no_almacen, i.almacen_nombre, i.cedis, i.no_cedis,
       coalesce(i.inventario,0)      as inventario,
       coalesce(i.disponible,0)      as disponible,
       coalesce(i.costoinventario,0) as costoinventario,
       coalesce(i.costodisponible,0) as costodisponible,
       i.costopromedio,
       coalesce(ac.comercial, false) as comercial,
       coalesce(ac.tipo, case when i.almacen_nombre ilike 'VENTAS%' then 'ventas' else 'no_comercial' end) as tipo,
       coalesce(ac.exclusivo,
                case when i.almacen_nombre ilike 'VENTAS%' then 'Ventas' else 'Inventario' end) as exclusivo,
       r.rama,
       (coalesce(i.costoinventario,0) <> 0
        and coalesce(ac.exclusivo,
              case when i.almacen_nombre ilike 'VENTAS%' then 'Ventas' else 'Inventario' end)
            is distinct from 'Inventario'
        and (r.rama = 'PRODUCTO' or (r.rama is null and (select rama_desc from p) = 1))
       ) or coalesce(ac.inv_actual_extra, false) as en_inv_actual,
       i.updated_at
  from public.inventario_acteck i
  left join public.almacenes_config ac on ac.no_almacen = i.no_almacen
  left join public.mv_articulo_rama  r on r.articulo    = i.articulo
 where i.articulo is not null and i.articulo <> '__TEST__';
grant select on public.v_inventario_almacen_medida to authenticated, anon, service_role;

notify pgrst, 'reload schema';
