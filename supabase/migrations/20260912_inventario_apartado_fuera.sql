-- 2026-09-12 · Inventario comprometido (apartado) e inventario fuera de venta.
--
-- Dos cifras que ya estaban en `inventario_acteck` y no se veían en ninguna pantalla
-- (docs/DATOS_SIN_APROVECHAR.md §2):
--
--   1. APARTADO = inventario − disponible. Producto que está físicamente en el almacén
--      pero ya está comprometido a una orden en curso: no se puede vender otra vez.
--      Se mide EXACTAMENTE sobre el universo de la medida [Inv Actual] del director
--      (costoinventario <> 0 ∧ almacén no exclusivo de "Inventario" ∧ Rama = PRODUCTO),
--      reusando la bandera `en_inv_actual` de `v_inventario_almacen_medida` para NO
--      inventar una tercera definición de inventario comercial.
--      Valuado como costoinventario − costodisponible (idéntico a (inv−disp) × costo
--      promedio; verificado al peso: $7,320,870 en las dos formas).
--
--   2. FUERA DE VENTA = los almacenes que [Inv Actual] deja fuera por ser exclusivos de
--      "Inventario" (destrucción, paqueterías, reparaciones, centro de servicio,
--      producción, refacturación, robo, remisiones, muestras…). Misma deducción que usa
--      la medida: `almacenes_config.exclusivo`, y si está NULL, `almacen_nombre ILIKE
--      'VENTAS%'` ⇒ 'Ventas', el resto ⇒ 'Inventario'. Ver docs/MEDIDAS_DIRECTOR.md §3.
--      NO se filtra por Rama: aquí interesa TODO lo que hay parado, sea producto,
--      refacción o materia prima.
--
-- Las dos son dinero dormido identificable SKU por SKU. No tocan ninguna medida
-- existente: [Inv Actual] sigue valiendo lo mismo.

-- ── 1. Apartado por SKU ──────────────────────────────────────────────────
create or replace view public.v_inventario_apartado_sku as
with base as (
  select m.articulo,
         m.no_almacen,
         greatest(m.inventario - m.disponible, 0)           as piezas_apartadas,
         greatest(m.costoinventario - m.costodisponible, 0) as valor_apartado,
         m.disponible                                       as piezas_disp
    from public.v_inventario_almacen_medida m
   where m.en_inv_actual
), agg as (
  select articulo,
         sum(piezas_apartadas)                              as piezas_apartadas,
         sum(valor_apartado)                                as valor_apartado,
         sum(piezas_disp)                                   as piezas_disp,
         string_agg(distinct no_almacen::text, ' · ' order by no_almacen::text)
           filter (where piezas_apartadas > 0)              as almacenes
    from base
   group by articulo
)
select a.articulo                                           as sku,
       coalesce(nullif(r.descripcion, ''), c.descripcion, '') as descripcion,
       coalesce(r.marca, '')                                as marca,
       a.piezas_apartadas,
       a.valor_apartado,
       a.piezas_disp,
       coalesce(a.almacenes, '')                            as almacenes
  from agg a
  left join lateral (
    select rs.descripcion, rs.marca from public.roadmap_sku rs
     where rs.sku = a.articulo order by rs.descripcion nulls last limit 1
  ) r on true
  left join public.catalogo_articulos c on c.articulo = a.articulo
 where a.piezas_apartadas > 0;

comment on view public.v_inventario_apartado_sku is
  'Inventario comprometido (apartado = inventario − disponible) por SKU, sobre el universo de la medida [Inv Actual]. `almacenes` = números de almacén con apartado, separados por " · ".';
grant select on public.v_inventario_apartado_sku to authenticated, anon, service_role;

-- ── 2. Total de apartado (una fila, para el Hero) ────────────────────────
create or replace view public.v_inventario_apartado_total as
select coalesce(sum(piezas_apartadas), 0) as piezas,
       coalesce(sum(valor_apartado), 0)   as valor,
       count(*)::int                      as skus
  from public.v_inventario_apartado_sku;

comment on view public.v_inventario_apartado_total is
  'UNA fila: piezas, valor y SKUs con inventario apartado (comprometido) dentro de [Inv Actual].';
grant select on public.v_inventario_apartado_total to authenticated, anon, service_role;

-- ── 3. Inventario fuera de venta, por almacén ───────────────────────────
-- El "motivo" se deduce del nombre del almacén del ERP (almacenes_config sólo tiene
-- dados de alta los 15 comerciales, así que el nombre es la única fuente).
create or replace view public.v_inventario_fuera_venta as
with base as (
  select m.no_almacen,
         m.almacen_nombre,
         m.articulo,
         m.inventario,
         m.costoinventario
    from public.v_inventario_almacen_medida m
   where m.exclusivo = 'Inventario'
)
select b.no_almacen                                as almacen,
       coalesce(ac.nombre, max(b.almacen_nombre))  as nombre,
       case
         when max(b.almacen_nombre) ilike '%DESTRUCCION%'    then 'Destrucción'
         when max(b.almacen_nombre) ilike '%PAQUETERIA%'     then 'Paqueterías'
         when max(b.almacen_nombre) ilike '%REPARACION%'     then 'Reparaciones'
         when max(b.almacen_nombre) ilike '%CENTRO DE SERVICIO%' then 'Centro de servicio'
         when max(b.almacen_nombre) ilike '%PRODUCCION%'     then 'Producción'
         when max(b.almacen_nombre) ilike '%DIFERENCIA%'     then 'Diferencias de inventario'
         when max(b.almacen_nombre) ilike '%REFACTURACION%'  then 'Refacturación'
         when max(b.almacen_nombre) ilike '%ROBO%'           then 'Robo'
         when max(b.almacen_nombre) ilike '%REMISION%'       then 'Remisiones'
         when max(b.almacen_nombre) ilike '%MUESTRA%'        then 'Muestras'
         when max(b.almacen_nombre) ilike '%DEVOLUCION%'     then 'Devoluciones'
         when max(b.almacen_nombre) ilike '%STOCK ROTATION%' then 'Stock rotation'
         else 'Otro'
       end                                         as motivo,
       coalesce(sum(b.inventario), 0)              as piezas,
       coalesce(sum(b.costoinventario), 0)         as valor,
       count(distinct b.articulo) filter (where b.inventario <> 0)::int as skus
  from base b
  left join public.almacenes_config ac on ac.no_almacen = b.no_almacen
 group by b.no_almacen, ac.nombre
having coalesce(sum(b.costoinventario), 0) <> 0 or coalesce(sum(b.inventario), 0) <> 0;

comment on view public.v_inventario_fuera_venta is
  'Inventario en almacenes exclusivos de "Inventario" (los que [Inv Actual] deja fuera): destrucción, paqueterías, reparaciones, producción… Una fila por almacén, con el motivo deducido del nombre del ERP.';
grant select on public.v_inventario_fuera_venta to authenticated, anon, service_role;

notify pgrst, 'reload schema';
