-- Categoría y familia para los SKUs de producto fuera del roadmap (2026-11-18). Fernando: «los que no tienen ni
-- categoría ni familia, ¿los puedes categorizar tú?». `clasificar_sku(descripcion)` devuelve 'Categoria|Familia' con
-- el vocabulario del roadmap, por palabras de la descripción (primero al inicio, luego en cualquier parte). Probada
-- contra el propio roadmap: acierta la familia en ~94 % de sus 1,124 SKUs. Lo que no encaja en ninguna familia
-- (vasos, muñecos, smartwatch, computadoras) se queda sin categoría. La marca sale de la marca más común del
-- roadmap para ese prefijo (EV → EVOROK, EY → ENERGY SISTEM…). Un SKU que entra al roadmap usa lo del roadmap.
create or replace function public.clasificar_sku(d text) returns text
language sql immutable as $$
  select case
    when x ~ 'cargador powerbank' then 'Componentes|Power Bank'
    when x ~ '^\s*enfriamiento de aire' then 'Componentes|Enfriamiento'
    when x ~ '^\s*hub para ventiladores' then 'Componentes|Enfriamiento'
    when x ~ '^\s*kit.{0,25}teclado' then 'Control|Combo'
    when x ~ '^\s*auricular' then 'Audio|Audifonos'
    when x ~ '^\s*cable riser' then 'Componentes|Gabinete'
    when x ~ '^\s*combo' then 'Control|Combo'
    when x ~ '^\s*(alfombrilla|mouse ?pad|reposamunecas)' then 'Espacio de Trabajo|Alfombrillas y Almoadillas'
    when x ~ '^\s*base enfriadora' then 'Espacio de Trabajo|Enfriamiento'
    when x ~ '^\s*(base cargadora|gamepad|control gamer|control inalambrico|volante)' then 'Control|Gamepads y Controles'
    when x ~ '^\s*(camara|banda|bateria).{0,40}(accion|action)' then 'Video|Action Cam'
    when x ~ '^\s*(camara web|webcam|camara)' then 'Video|Camaras Web'
    when x ~ '^\s*(dvr|nvr)' then 'Video|Swann'
    when x ~ '^\s*(power ?bank|bateria portatil)' then 'Movilidad|Power Bank'
    when x ~ '^\s*(soporte|base |brazo|bandeja)' then 'Espacio de Trabajo|Bases y Soportes'
    when x ~ '^\s*(lampara|aro de luz|tira led)' then 'Espacio de Trabajo|Luces'
    when x ~ '^\s*(silla|mesa |escritorio)' then 'Furniture|Sillas y Mesas'
    when x ~ '^\s*(mochila|backpack|funda|maletin|banda de brazo|banda deportiva|cinturon)' then 'Movilidad|Fundas y Mochilas'
    when x ~ '^\s*(enfriamiento liquido)' then 'Componentes|Enfriamiento Liquido'
    when x ~ '^\s*(ventilador|disipador|pasta termica)' then 'Componentes|Enfriamiento'
    when x ~ '^\s*fuente de poder' then 'Componentes|Fuente de Poder'
    when x ~ '^\s*gabinete' then 'Componentes|Gabinete'
    when x ~ '^\s*monitor' then 'Componentes|Monitor'
    when x ~ '^\s*(regulador|no ?break)' then 'Componentes|Regulador'
    when x ~ '^\s*memoria usb' then 'Almacenamiento|Memorias USB'
    when x ~ '^\s*(barra de sonido|bocina)' then 'Audio|Bocinas'
    when x ~ '^\s*(audifono|headphone|earphone|headset|diadema)' then 'Audio|Audifonos'
    when x ~ '^\s*microfono' then 'Audio|Microfono'
    when x ~ '^\s*teclado' then 'Control|Teclado'
    when x ~ '^\s*mouse' then 'Control|Mouse'
    when x ~ '^\s*(hub|adaptador|docking|lector|convertidor)' then 'Conectividad|Hubs y Adaptadores'
    when x ~ '^\s*(cable|cargador)' then 'Conectividad|Cables y Cargadores'
    when x ~ '\menfriamiento de aire' then 'Componentes|Enfriamiento'
    when x ~ '\mhub para ventiladores' then 'Componentes|Enfriamiento'
    when x ~ '\mkit.{0,25}teclado' then 'Control|Combo'
    when x ~ '\mauricular' then 'Audio|Audifonos'
    when x ~ '\mcable riser' then 'Componentes|Gabinete'
    when x ~ '\mcombo' then 'Control|Combo'
    when x ~ '\m(alfombrilla|mouse ?pad|reposamunecas)' then 'Espacio de Trabajo|Alfombrillas y Almoadillas'
    when x ~ '\mbase enfriadora' then 'Espacio de Trabajo|Enfriamiento'
    when x ~ '\m(base cargadora|gamepad|control gamer|control inalambrico|volante)' then 'Control|Gamepads y Controles'
    when x ~ '\m(camara|banda|bateria).{0,40}(accion|action)' then 'Video|Action Cam'
    when x ~ '\m(camara web|webcam|camara)' then 'Video|Camaras Web'
    when x ~ '\m(dvr|nvr)' then 'Video|Swann'
    when x ~ '\m(power ?bank|bateria portatil)' then 'Movilidad|Power Bank'
    when x ~ '\m(soporte|base |brazo|bandeja)' then 'Espacio de Trabajo|Bases y Soportes'
    when x ~ '\m(lampara|aro de luz|tira led)' then 'Espacio de Trabajo|Luces'
    when x ~ '\m(silla|mesa |escritorio)' then 'Furniture|Sillas y Mesas'
    when x ~ '\m(mochila|backpack|funda|maletin|banda de brazo|banda deportiva|cinturon)' then 'Movilidad|Fundas y Mochilas'
    when x ~ '\m(enfriamiento liquido)' then 'Componentes|Enfriamiento Liquido'
    when x ~ '\m(ventilador|disipador|pasta termica)' then 'Componentes|Enfriamiento'
    when x ~ '\mfuente de poder' then 'Componentes|Fuente de Poder'
    when x ~ '\mgabinete' then 'Componentes|Gabinete'
    when x ~ '\mmonitor' then 'Componentes|Monitor'
    when x ~ '\m(regulador|no ?break)' then 'Componentes|Regulador'
    when x ~ '\mmemoria usb' then 'Almacenamiento|Memorias USB'
    when x ~ '\m(barra de sonido|bocina)' then 'Audio|Bocinas'
    when x ~ '\m(audifono|headphone|earphone|headset|diadema)' then 'Audio|Audifonos'
    when x ~ '\mmicrofono' then 'Audio|Microfono'
    when x ~ '\mteclado' then 'Control|Teclado'
    when x ~ '\mmouse' then 'Control|Mouse'
    when x ~ '\m(hub|adaptador|docking|lector|convertidor)' then 'Conectividad|Hubs y Adaptadores'
    when x ~ '\m(cable|cargador)' then 'Conectividad|Cables y Cargadores'
  end from (select translate(lower(coalesce(d, '')), 'áéíóúñü', 'aeiounu') as x) t
$$;

drop view if exists public.v_skus_producto;
drop materialized view if exists public.mv_skus_producto_extra;
create materialized view public.mv_skus_producto_extra as
with pref as (
  select distinct on (left(upper(sku), 2)) left(upper(sku), 2) p, marca
  from (select sku, marca, count(*) over (partition by left(upper(sku), 2), marca) n from public.roadmap_sku where marca is not null and public.es_sku_producto(sku)) z
  order by left(upper(sku), 2), n desc
)
select d.sku, d.descripcion,
       coalesce(pref.marca, case left(d.sku, 2) when 'AC' then 'ACTECK' when 'ES' then 'ACTECK' when 'BR' then 'BALAM RUSH' when 'AV' then 'AUDIVE' end) as marca,
       d.activo,
       nullif(split_part(public.clasificar_sku(d.descripcion), '|', 1), '') as categoria,
       nullif(split_part(public.clasificar_sku(d.descripcion), '|', 2), '') as familia
from (
  select x.sku, coalesce(c.descripcion, e.descripcion) as descripcion, (x.pz > 0 or x.tr > 0) as activo
  from (
    select sku, sum(pz) pz, sum(tr) tr from (
      select upper(trim(articulo)) as sku, coalesce(inv_actual_piezas, 0) pz, 0::numeric tr from public.v_medidas_inventario_sku where public.es_sku_producto(articulo)
      union all
      select upper(trim(sku)), 0, coalesce(cantidad, 0) from public.v_transito_sku where public.es_sku_producto(sku)
    ) u group by sku
  ) x
  left join (select upper(trim(articulo)) sku, max(descripcion) descripcion from public.catalogo_articulos group by 1) c on c.sku = x.sku
  left join (select upper(trim(codigo)) sku, max(descripcion) descripcion from public.embarques_compras group by 1) e on e.sku = x.sku
) d
left join pref on pref.p = left(d.sku, 2);
create unique index mv_skus_producto_extra_sku on public.mv_skus_producto_extra(sku);
revoke all on public.mv_skus_producto_extra from anon, authenticated;

create view public.v_skus_producto as
select r.sku, r.descripcion, r.marca, r.categoria, r.familia, r.rdmp, true as en_roadmap, true as activo, r.sort_order
from public.roadmap_sku r
union all
select x.sku, x.descripcion, x.marca, x.categoria, x.familia, null::text, false, x.activo, null
from public.mv_skus_producto_extra x
where not exists (select 1 from public.roadmap_sku r where upper(r.sku) = x.sku)
  and (select public.es_interno());
grant select on public.v_skus_producto to authenticated;
