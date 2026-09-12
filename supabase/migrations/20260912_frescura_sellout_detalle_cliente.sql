-- Frescura de sell out por cliente · 2026-09-12
--
-- Problema (Fernando): la pill de Digitalife y Dicotech decía "sin carga". `sellout_detalle`
-- guarda los dos clientes en la MISMA tabla y v_fuentes_frescura sólo tenía UNA fila con el
-- max(updated_at) global: si uno de los dos se cargaba, el otro quedaba tapado, y en las
-- pantallas de cliente la única fila disponible no distinguía de quién era esa carga.
--
-- Aquí:
--   · dos filas nuevas, `sellout_detalle_digitalife` y `sellout_detalle_dicotech`, con el
--     max(updated_at) y el max(fecha) de ESE cliente. FrescuraPill las etiqueta
--     "Digitalife" y "Dicotech" (src/components/FrescuraPill.jsx · CORTA).
--   · la fila agregada `sellout_detalle` se queda (compatibilidad con el cron y con
--     pantallas que aún la piden) y se renombra a "Sell Out detalle (Digitalife + Dicotech)".
--   · índice (cliente, updated_at) para que cada max() sea un index scan hacia atrás de 1 fila.
--   · `filas` va NULL en las dos filas por cliente: filas_est() es una estimación de
--     pg_class por TABLA y no se puede repartir entre clientes sin un count(*) caro.
--   · frescura_puede_ver() reconoce los dos slugs nuevos con el mismo guard que el agregado.
--
-- Se recrea la vista completa (misma definición que 20260911_estado_resultados_frescura.sql
-- + las dos filas nuevas).

create index if not exists sellout_detalle_cliente_updated_at_idx
  on public.sellout_detalle (cliente, updated_at);
create index if not exists sellout_detalle_cliente_fecha_idx
  on public.sellout_detalle (cliente, fecha);

create or replace function public.frescura_puede_ver(fuente text)
returns boolean language plpgsql stable security invoker set search_path = public, pg_catalog as $$
begin
  if coalesce((select rolbypassrls or rolsuper from pg_roles where rolname = current_user), false) then
    return true;
  end if;
  return case fuente
    when 'sellout_detalle'            then user_can_see_cliente('digitalife') or user_can_see_cliente('dicotech')
    when 'sellout_detalle_digitalife' then user_can_see_cliente('digitalife')
    when 'sellout_detalle_dicotech'   then user_can_see_cliente('dicotech')
    when 'sellout_sku'                then auth.uid() is not null
    when 'inventario_acteck'          then current_user = 'anon' or puede_ver_global('inventario_global')
    when 'precios_sku'                then puede_ver_global('estrategia_precios')
    when 'estados_resultados'         then auth.uid() is not null
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
  select 'sellout_detalle', 'Sell Out detalle (Digitalife + Dicotech)', 7,
         -- Guard: ver frescura_puede_ver().
         (select max(updated_at) from sellout_detalle
            where frescura_puede_ver('sellout_detalle')),
         (select to_char(max(fecha), 'YYYY-MM-DD') from sellout_detalle
            where frescura_puede_ver('sellout_detalle')),
         filas_est('sellout_detalle')
  union all
  -- Una fila por cliente: cada uno sube su archivo por su lado y el max() global
  -- escondía al que llevaba días sin cargar. Índice (cliente, updated_at) → index scan.
  select 'sellout_detalle_digitalife', 'Sell Out detalle · Digitalife', 7,
         (select max(updated_at) from sellout_detalle
            where cliente = 'digitalife' and frescura_puede_ver('sellout_detalle_digitalife')),
         (select to_char(max(fecha), 'YYYY-MM-DD') from sellout_detalle
            where cliente = 'digitalife' and frescura_puede_ver('sellout_detalle_digitalife')),
         null::bigint
  union all
  select 'sellout_detalle_dicotech', 'Sell Out detalle · Dicotech', 7,
         (select max(updated_at) from sellout_detalle
            where cliente = 'dicotech' and frescura_puede_ver('sellout_detalle_dicotech')),
         (select to_char(max(fecha), 'YYYY-MM-DD') from sellout_detalle
            where cliente = 'dicotech' and frescura_puede_ver('sellout_detalle_dicotech')),
         null::bigint
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
  union all
  select 'estados_resultados', 'Estado de resultados (P&L)', 40,
         (select max(updated_at) from estados_resultados where frescura_puede_ver('estados_resultados')),
         (select to_char(make_date(anio, mes, 1), 'YYYY-MM') from estados_resultados
            where frescura_puede_ver('estados_resultados') and anio is not null and mes is not null
            order by anio desc, mes desc limit 1),
         filas_est('estados_resultados')
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
