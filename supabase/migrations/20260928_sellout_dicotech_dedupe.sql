-- Sell out de Dicotech sin líneas repetidas (2026-09-28, auditoría pedida por Fernando: «que cuadre a la perfección»).
-- Hallazgo: el puente SQL vuelve a mandar líneas ya cargadas con OTRO id cuando el origen las renumera
-- (sep-2026: 1,211 líneas dobles = $671 K de más; jun-2026: 169 en el CSV manual). Como el upsert es por id,
-- se acumulaban y las dimensiones (sucursal, vendedor, cliente final) inflaban el mes: sep mostraba $1.58 M
-- contra $917 K reales. El monto canónico sigue siendo sellout_detalle; esta vista sólo aporta dimensiones.
-- Regla: por línea natural (fecha, factura, sku, cantidad, importe, sucursal, vendedor, cliente) se conserva
-- únicamente la CARGA más reciente (date(updated_at)); una línea legítimamente repetida dentro de la misma
-- carga se conserva. Después, por mes, gana el origen con más filas (puente id>0 o CSV manual id<0), como antes.
create or replace view public.v_sellout_general_dicotech as
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

comment on view public.v_sellout_general_dicotech is
  'sellout_general de DICOTECH sin doble conteo: por línea natural sólo la carga más reciente (el puente re-manda líneas con otro id) y, por mes, el origen con más filas. Sólo aporta dimensiones; el monto canónico es sellout_detalle.';
