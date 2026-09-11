-- 2026-09-11 · Estado de Resultados V3 · frescura del P&L
-- Agrega la fuente `estados_resultados` a v_fuentes_frescura (la usa
-- <FrescuraPill pantalla="estadoResultados"/> en el Hero de la pantalla).
-- Cadencia manual: día 10 de cada mes con tolerancia 10 (fuentes_config
-- 'estados-resultados'); umbral 40 días = un mes de cadencia + tolerancia.
-- RLS de estados_resultados: sólo super admin (estados_resultados_select_super)
-- o cualquier authenticated (authenticated_read); anon no la ve → el guard
-- frescura_puede_ver evita el scan cuando el rol no puede leerla.
-- Se recrea la vista completa (misma definición que 20260911_v_fuentes_frescura.sql
-- + la fila nueva). Aplicada a mano el 2026-09-11.

create index if not exists estados_resultados_updated_at_idx on public.estados_resultados (updated_at);
create index if not exists estados_resultados_anio_mes_idx   on public.estados_resultados (anio, mes);

create or replace function public.frescura_puede_ver(fuente text)
returns boolean language plpgsql stable security invoker set search_path = public, pg_catalog as $$
begin
  if coalesce((select rolbypassrls or rolsuper from pg_roles where rolname = current_user), false) then
    return true;
  end if;
  return case fuente
    when 'sellout_detalle'    then user_can_see_cliente('digitalife') or user_can_see_cliente('dicotech')
    when 'sellout_sku'        then auth.uid() is not null
    when 'inventario_acteck'  then current_user = 'anon' or puede_ver_global('inventario_global')
    when 'precios_sku'        then puede_ver_global('estrategia_precios')
    when 'estados_resultados' then auth.uid() is not null
    else true
  end;
end $$;

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
