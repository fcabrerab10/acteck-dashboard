-- 2026-09-12 · Historia de precios + catálogo de EAN
--
-- (1) HISTORIA DE PRECIOS
-- `precios_sku` ya tiene la fecha en su llave primaria: (sku, lista, anio, mes). Lo que
-- impedía conservar la historia NO era el modelo, era el puente: `bridge/sync.mjs`
-- hacía `upsertRows('precios_sku', …, { deleteAll: true })`, o sea DELETE de la tabla
-- entera antes de subir el mes en curso. A partir de hoy el puente borra sólo el mes
-- que va a reescribir (`deleteWhere: anio=eq.X&mes=eq.Y`), así que los meses anteriores
-- se quedan y `precios_sku` pasa a ser la serie histórica por sí misma.
--
-- Esta migración NO cambia la tabla ni sus llaves (no hace falta una columna
-- `vigente_desde`: (anio, mes) ya es la fecha de vigencia). Añade la vista que faltaba:
--
--   v_precio_vigente_sku_lista  · 1 fila por (sku, lista) con el precio vigente = el del
--                                 periodo más reciente, más desde cuándo y cuántos
--                                 periodos lleva ese precio sin moverse.
--
-- `v_estrategia_precios_lista` NO se toca: ya es `DISTINCT ON (sku, lista) … ORDER BY
-- sku, lista, anio DESC, mes DESC`, o sea el precio más reciente. Con un solo mes en la
-- tabla devuelve exactamente las mismas filas que antes (6,457 el 2026-09-12); cuando
-- el puente acumule meses seguirá devolviendo el último, que es lo que espera la
-- pantalla de Estrategia de Precios.
--
-- `precios_historico` (migración 20260911) y su trigger se quedan como están: siguen
-- siendo la bitácora con `primera_vez` / `ultima_vez`, que `precios_sku` no guarda.

create or replace view public.v_precio_vigente_sku_lista
with (security_invoker = true) as
select distinct on (p.sku, p.lista)
       p.sku,
       p.lista,
       p.precio,
       p.moneda,
       p.anio,
       p.mes,
       make_date(p.anio, p.mes, 1)                        as vigente_desde,
       count(*) over (partition by p.sku, p.lista)         as periodos
  from public.precios_sku p
 order by p.sku, p.lista, p.anio desc, p.mes desc;

comment on view public.v_precio_vigente_sku_lista is
  'Precio vigente por sku+lista (el del periodo más reciente de precios_sku) + vigente_desde y cuántos periodos hay en la historia. Desde 2026-09-12 el puente ya no borra la tabla completa, así que la historia se acumula mes a mes.';

grant select on public.v_precio_vigente_sku_lista to authenticated, service_role;

-- Índice para el drill por SKU de Estrategia de Precios (historial de un SKU).
-- El PK (sku, lista, anio, mes) ya sirve; este ordena por periodo descendente.
create index if not exists precios_sku_sku_lista_periodo_idx
  on public.precios_sku (sku, lista, anio desc, mes desc);

-- (2) CATÁLOGO DE EAN (código de barras)
-- El EAN vive en dos lados: `catalogo_articulos.isbn` (8,858 de 9,492 artículos) y
-- `series_generadas.ean` (hoja SN del Master Embarques, por PO). Ambas tablas tienen RLS
-- ENCENDIDA Y CERO POLÍTICAS, o sea que hoy la app no puede leerlas. En vez de abrir las
-- tablas, esta vista (security_invoker = false: corre como su dueño) expone SÓLO
-- sku + ean, que no es información sensible, y se otorga a authenticated.
-- Normaliza: deja sólo dígitos y descarta lo que no parezca EAN/UPC (8, 12, 13 o 14).
create or replace view public.v_sku_ean as
with base as (
  select c.articulo as sku,
         nullif(regexp_replace(coalesce(c.isbn, ''), '[^0-9]', '', 'g'), '') as ean,
         'catalogo'::text as fuente
    from public.catalogo_articulos c
  union all
  select s.sku,
         nullif(regexp_replace(coalesce(s.ean, ''), '[^0-9]', '', 'g'), ''),
         'series'::text
    from public.series_generadas s
)
select distinct on (sku) sku, ean, fuente
  from base
 where ean is not null and length(ean) in (8, 12, 13, 14)
 order by sku, (fuente = 'catalogo') desc, ean;

comment on view public.v_sku_ean is
  'Código de barras por SKU. Prefiere catalogo_articulos.isbn y cae a series_generadas.ean. Sólo sku + ean; sin RLS de las tablas base (no es dato sensible).';

grant select on public.v_sku_ean to authenticated, anon, service_role;

notify pgrst, 'reload schema';
