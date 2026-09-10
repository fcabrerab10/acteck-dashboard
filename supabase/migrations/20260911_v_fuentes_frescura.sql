-- 2026-09-11 · v_fuentes_frescura
-- Una fila por fuente de datos con su última carga, último periodo con datos,
-- filas, umbral (días) y estado. La usan FrescuraPill (src/lib/frescura.js) y
-- la regla `datos_sin_actualizar` de api/cron.js (una sola consulta en vez de N).
--
-- Columnas por tabla (information_schema, 2026-09-11):
--   facturacion_clientes  uploaded_at · periodo (anio, mes)       idx fact_anio_mes_idx
--   erp_ventas            uploaded_at · periodo (anio, mes)       idx erp_ventas_anio_mes_idx
--   inventario_acteck     updated_at  · sin periodo (snapshot)
--   sellout_general       updated_at  · periodo (anio, mes)       idx sellout_general_anio_mes_idx
--   sellout_detalle       updated_at  · periodo fecha
--   sellout_pcel          updated_at  · periodo (anio, semana)    idx sellout_pcel_semana_idx
--   sellout_sku           updated_at/created_at · (anio, mes)
--   inventario_cliente    updated_at  · (anio, semana)
--   precios_sku           updated_at  · (anio, mes)
--   compras_oc            updated_at  · fecha_emision
--   embarques_compras     updated_at  · fecha_emision             idx idx_embarques_fecha_emision
--   estados_cuenta        updated_at  · fecha_corte
--   cuotas_mensuales      updated_at/created_at · (anio, mes)
--   roadmap_sku           updated_at  · sin periodo
--   guias_erp             updated_at/created_at · fecha_emision   idx guias_erp_fecha_emision_idx
--   programacion_arribos  updated_at  · arribo_almacen            idx programacion_arribos_arribo_idx
--
-- Rendimiento: medido como anon, max()/count(*) sin índice tardaban 0.2-2.6 s
-- por tabla (RLS evalúa la política fila por fila: erp_ventas 1.6 s,
-- sellout_detalle 2.6 s) y la vista completa superaba los 3 s. Por eso:
--   · índices btree en las columnas de timestamp/periodo que faltaban → max()
--     es un index scan hacia atrás que toca ~1 fila;
--   · `filas` sale de pg_class.reltuples (estimación del último ANALYZE/
--     autovacuum, sin RLS) en vez de count(*), que recorre toda la tabla.
-- security_invoker: cada usuario ve la frescura de lo que sus políticas RLS
-- le dejan leer (misma regla que las pantallas).

create index if not exists facturacion_clientes_uploaded_at_idx on public.facturacion_clientes (uploaded_at);
create index if not exists erp_ventas_uploaded_at_idx          on public.erp_ventas (uploaded_at);
create index if not exists inventario_acteck_updated_at_idx    on public.inventario_acteck (updated_at);
create index if not exists sellout_general_updated_at_idx      on public.sellout_general (updated_at);
create index if not exists sellout_detalle_updated_at_idx      on public.sellout_detalle (updated_at);
create index if not exists sellout_detalle_fecha_idx           on public.sellout_detalle (fecha);
create index if not exists sellout_pcel_updated_at_idx         on public.sellout_pcel (updated_at);
create index if not exists sellout_sku_updated_at_idx          on public.sellout_sku (updated_at);
create index if not exists sellout_sku_created_at_idx          on public.sellout_sku (created_at);
create index if not exists sellout_sku_anio_mes_idx            on public.sellout_sku (anio, mes);
create index if not exists inventario_cliente_updated_at_idx   on public.inventario_cliente (updated_at);
create index if not exists inventario_cliente_anio_semana_idx  on public.inventario_cliente (anio, semana);
create index if not exists precios_sku_updated_at_idx          on public.precios_sku (updated_at);
create index if not exists precios_sku_anio_mes_idx            on public.precios_sku (anio, mes);
create index if not exists embarques_compras_updated_at_idx    on public.embarques_compras (updated_at);
create index if not exists guias_erp_updated_at_idx            on public.guias_erp (updated_at);
create index if not exists guias_erp_created_at_idx            on public.guias_erp (created_at);
create index if not exists cuotas_mensuales_updated_at_idx     on public.cuotas_mensuales (updated_at);
create index if not exists cuotas_mensuales_created_at_idx     on public.cuotas_mensuales (created_at);
create index if not exists roadmap_sku_updated_at_idx          on public.roadmap_sku (updated_at);
create index if not exists compras_oc_updated_at_idx           on public.compras_oc (updated_at);

-- Filas estimadas (pg_class.reltuples; -1 = nunca analizada). STABLE y sin RLS.
create or replace function public.filas_est(tabla text)
returns bigint language sql stable security definer set search_path = pg_catalog, public as $$
  select greatest(coalesce(reltuples, 0), 0)::bigint from pg_class
   where oid = ('public.' || quote_ident(tabla))::regclass
$$;
grant execute on function public.filas_est(text) to authenticated, anon, service_role;

-- Guard por fuente, evaluado UNA vez por consulta (One-Time Filter). Reúne:
--   · roles que saltan RLS (service_role del cron, postgres): siempre true;
--   · la condición mínima para que el usuario vea alguna fila de esa tabla,
--     como superconjunto de sus políticas SELECT (nunca oculta datos visibles).
-- Motivo: las políticas fila a fila (puede_ver_*, user_can_see_cliente) no se
-- hoistean aunque tengan argumentos constantes; si el usuario no ve ninguna
-- fila, el index scan hacia atrás recorría toda la tabla llamando la función
-- (sellout_detalle 2.6 s, sellout_sku 0.3 s, precios_sku 0.2 s × 2). Con el
-- guard falso el scan se omite. plpgsql + SECURITY INVOKER a propósito: SQL se
-- inlinea (y el subselect rompe el One-Time Filter) y con DEFINER current_user
-- sería postgres. pg_roles es legible por cualquier rol.
create or replace function public.frescura_puede_ver(fuente text)
returns boolean language plpgsql stable security invoker set search_path = public, pg_catalog as $$
begin
  if coalesce((select rolbypassrls or rolsuper from pg_roles where rolname = current_user), false) then
    return true;
  end if;
  return case fuente
    when 'sellout_detalle'   then user_can_see_cliente('digitalife') or user_can_see_cliente('dicotech')
    when 'sellout_sku'       then auth.uid() is not null
    when 'inventario_acteck' then current_user = 'anon' or puede_ver_global('inventario_global')
    when 'precios_sku'       then puede_ver_global('estrategia_precios')
    else true
  end;
end $$;
grant execute on function public.frescura_puede_ver(text) to authenticated, anon, service_role;

create or replace view public.v_fuentes_frescura
with (security_invoker = true) as
with f as (
  select 'facturacion_clientes'::text as fuente, 'Sell In (facturación)'::text as etiqueta, 7 as umbral_dias,
         (select max(uploaded_at) from facturacion_clientes) as ultima_carga,
         (select to_char(make_date(anio, mes, 1), 'YYYY-MM') from facturacion_clientes
            where anio is not null and mes is not null order by anio desc, mes desc limit 1) as periodo_max,
         filas_est('facturacion_clientes') as filas
  union all
  select 'erp_ventas', 'Ventas ERP (Vw_TablaH_Ventas)', 7,
         (select max(uploaded_at) from erp_ventas),
         (select to_char(make_date(anio, mes, 1), 'YYYY-MM') from erp_ventas
            where anio is not null and mes is not null order by anio desc, mes desc limit 1),
         filas_est('erp_ventas')
  union all
  select 'inventario_acteck', 'Inventario Acteck', 3,
         (select max(updated_at) from inventario_acteck
            where frescura_puede_ver('inventario_acteck')),
         null,
         filas_est('inventario_acteck')
  union all
  select 'sellout_general', 'Sell Out mayoristas', 7,
         (select max(updated_at) from sellout_general),
         (select to_char(make_date(anio, mes, 1), 'YYYY-MM') from sellout_general
            where anio is not null and mes is not null order by anio desc, mes desc limit 1),
         filas_est('sellout_general')
  union all
  select 'sellout_detalle', 'Sell Out detalle (Digitalife)', 7,
         -- Guard: ver frescura_puede_ver().
         (select max(updated_at) from sellout_detalle
            where frescura_puede_ver('sellout_detalle')),
         (select to_char(max(fecha), 'YYYY-MM-DD') from sellout_detalle
            where frescura_puede_ver('sellout_detalle')),
         filas_est('sellout_detalle')
  union all
  select 'sellout_pcel', 'Sell Out PCEL', 7,
         (select max(updated_at) from sellout_pcel),
         (select anio::text || '-W' || lpad(semana::text, 2, '0') from sellout_pcel
            where anio is not null and semana is not null order by anio desc, semana desc limit 1),
         filas_est('sellout_pcel')
  union all
  select 'sellout_sku', 'Sell Out por SKU (captura)', 7,
         (select greatest(max(updated_at), max(created_at)) from sellout_sku where frescura_puede_ver('sellout_sku')),
         (select to_char(make_date(anio, mes, 1), 'YYYY-MM') from sellout_sku
            where frescura_puede_ver('sellout_sku') and anio is not null and mes is not null order by anio desc, mes desc limit 1),
         filas_est('sellout_sku')
  union all
  select 'inventario_cliente', 'Inventario en cliente', 7,
         (select max(updated_at) from inventario_cliente),
         (select anio::text || '-W' || lpad(semana::text, 2, '0') from inventario_cliente
            where anio is not null and semana is not null order by anio desc, semana desc limit 1),
         filas_est('inventario_cliente')
  union all
  select 'precios_sku', 'Listas de precios', 30,
         (select max(updated_at) from precios_sku where frescura_puede_ver('precios_sku')),
         (select to_char(make_date(anio, mes, 1), 'YYYY-MM') from precios_sku
            where frescura_puede_ver('precios_sku') and anio is not null and mes is not null
            order by anio desc, mes desc limit 1),
         filas_est('precios_sku')
  union all
  select 'compras_oc', 'Órdenes de compra', 7,
         (select max(updated_at) from compras_oc),
         (select to_char(max(fecha_emision), 'YYYY-MM-DD') from compras_oc),
         filas_est('compras_oc')
  union all
  select 'embarques_compras', 'Embarques (tránsito)', 7,
         (select max(updated_at) from embarques_compras),
         (select to_char(max(fecha_emision), 'YYYY-MM-DD') from embarques_compras),
         filas_est('embarques_compras')
  union all
  select 'estados_cuenta', 'Estados de cuenta', 7,
         (select max(updated_at) from estados_cuenta),
         (select to_char(max(fecha_corte), 'YYYY-MM-DD') from estados_cuenta),
         filas_est('estados_cuenta')
  union all
  select 'cuotas_mensuales', 'Cuotas mensuales', 30,
         (select greatest(max(updated_at), max(created_at)) from cuotas_mensuales),
         (select to_char(make_date(anio, mes, 1), 'YYYY-MM') from cuotas_mensuales
            where anio is not null and mes is not null order by anio desc, mes desc limit 1),
         filas_est('cuotas_mensuales')
  union all
  select 'roadmap_sku', 'Roadmap de SKUs', 30,
         (select max(updated_at) from roadmap_sku),
         null,
         filas_est('roadmap_sku')
  union all
  select 'guias_erp', 'Guías ERP', 7,
         (select greatest(max(updated_at), max(created_at)) from guias_erp),
         (select to_char(max(fecha_emision), 'YYYY-MM-DD') from guias_erp),
         filas_est('guias_erp')
  union all
  select 'programacion_arribos', 'Programación de arribos', 7,
         (select max(updated_at) from programacion_arribos),
         (select to_char(max(arribo_almacen), 'YYYY-MM-DD') from programacion_arribos),
         filas_est('programacion_arribos')
)
select
  fuente, etiqueta, ultima_carga, periodo_max, filas, umbral_dias,
  case
    when ultima_carga is null then 'sin_datos'
    when ultima_carga < now() - make_interval(days => umbral_dias) then 'atrasada'
    else 'ok'
  end as estado,
  case when ultima_carga is null then null
       else floor(extract(epoch from (now() - ultima_carga)) / 86400)::int end as dias
from f;

comment on view public.v_fuentes_frescura is
  'Frescura por fuente de datos: última carga, último periodo, filas, umbral y estado (ok|atrasada|sin_datos). security_invoker.';

grant select on public.v_fuentes_frescura to authenticated, anon, service_role;

-- Helper intermedio de una versión anterior de esta misma migración (ya no se usa).
drop function if exists public.frescura_ve_todo();
