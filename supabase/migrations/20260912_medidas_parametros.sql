-- 2026-09-12 · Capa canónica de medidas (1/4): parámetros y dimensiones.
--
-- Problema que resuelve: cada pantalla calculaba "su" versión de cada cifra
-- (inventario comercial con costodisponible en Visión General, costoinventario
-- en Inventario global, etc.). A partir de aquí TODAS las medidas se definen
-- una sola vez, traducidas literal del modelo DAX del director (Power BI).
--
-- Este archivo crea:
--   · parametros_medidas   — constantes editables (tipos de cambio, banderas)
--   · almacenes_config.exclusivo / .inv_actual_extra — atributos de la dimensión
--     Almacén que el modelo del director usa en [Inv Actual]
--   · mv_articulo_rama     — Articulo[Rama] reconstruido desde erp_ventas
--                            (catalogo_articulos NO trae rama)

-- ── Parámetros ────────────────────────────────────────────────────────────
create table if not exists public.parametros_medidas (
  clave       text primary key,
  valor_num   numeric,
  valor_txt   text,
  descripcion text,
  updated_at  timestamptz default now(),
  updated_by  text
);

comment on table public.parametros_medidas is
  'Constantes de las medidas del director. Editables sin tocar código ni vistas.';

insert into public.parametros_medidas (clave, valor_num, descripcion) values
  ('tc_compra',       20, 'TC de [Costo de Compra TC 20] — Compras USD × 20'),
  ('tc_compra_inv',   17, 'TC de [Costo de Compra TC 17], el que entra en [Inv Total (Inv+OC)]'),
  ('inv_dias_base',   90, 'Días del denominador de [Dias de Inv]: Inv / CV 3 meses × 90'),
  ('inv_rama_desconocida', 0, '1 = los SKUs sin Rama conocida cuentan como PRODUCTO en [Inv Actual]; 0 = se excluyen (estricto, default)')
on conflict (clave) do nothing;

alter table public.parametros_medidas enable row level security;
drop policy if exists parametros_medidas_read  on public.parametros_medidas;
drop policy if exists parametros_medidas_write on public.parametros_medidas;
create policy parametros_medidas_read  on public.parametros_medidas for select to authenticated, anon using (true);
create policy parametros_medidas_write on public.parametros_medidas for all to authenticated
  using (es_super_admin_check()) with check (es_super_admin_check());
grant select on public.parametros_medidas to authenticated, anon;
grant all    on public.parametros_medidas to service_role;

create or replace function public.param_medida(p_clave text, p_default numeric default null)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select valor_num from public.parametros_medidas where clave = p_clave), p_default);
$$;
grant execute on function public.param_medida(text, numeric) to authenticated, anon, service_role;

-- ── Dimensión Almacén ─────────────────────────────────────────────────────
-- El DAX del director filtra Almacen[Exclusivo] <> "Inventario". Nuestra
-- almacenes_config sólo tenía la bandera `comercial` (15 almacenes, todos
-- true). Se añaden dos columnas SIN tocar los datos existentes:
--   exclusivo         — atributo replicado del modelo; NULL ⇒ se deduce del
--                       nombre del almacén ("VENTAS …" = 'Ventas', el resto
--                       'Inventario'). Comprobado: esa deducción reproduce
--                       almacenes_config.comercial salvo el almacén 15
--                       (STOCK ROTATION TEMPORAL, $11.7K).
--   inv_actual_extra  — segundo término de [Inv Actual] (los almacenes "4…"
--                       que el director vuelve a sumar). NINGUNO viene marcado
--                       por default: la captura de la fórmula está cortada y
--                       hace falta que Fernando confirme cuál almacén es.
alter table public.almacenes_config add column if not exists exclusivo        text;
alter table public.almacenes_config add column if not exists inv_actual_extra boolean not null default false;
comment on column public.almacenes_config.exclusivo is
  'Almacen[Exclusivo] del modelo del director. "Inventario" = NO entra en [Inv Actual]. NULL = se deduce del nombre (VENTAS…).';
comment on column public.almacenes_config.inv_actual_extra is
  'true = el almacén se vuelve a sumar en el 2º término de [Inv Actual] (los "4…"). PENDIENTE de confirmar con Fernando.';

-- ── Dimensión Artículo · Rama ─────────────────────────────────────────────
-- catalogo_articulos no trae Rama; erp_ventas sí (renglón a renglón). Se
-- materializa el modo por artículo. Los SKUs que nunca se han vendido quedan
-- sin rama: los cubre el parámetro inv_rama_desconocida.
drop materialized view if exists public.mv_articulo_rama cascade;
create materialized view public.mv_articulo_rama as
select articulo,
       mode() within group (order by rama)   as rama,
       mode() within group (order by marca)  as marca,
       mode() within group (order by familia) as familia,
       mode() within group (order by categoria) as categoria
  from public.erp_ventas
 where articulo is not null and rama is not null
 group by articulo;
create unique index mv_articulo_rama_pk on public.mv_articulo_rama (articulo);
grant select on public.mv_articulo_rama to authenticated, anon, service_role;

create or replace view public.v_articulo_rama with (security_invoker = true) as
  select * from public.mv_articulo_rama;
grant select on public.v_articulo_rama to authenticated, anon, service_role;

notify pgrst, 'reload schema';
