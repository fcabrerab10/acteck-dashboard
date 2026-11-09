
-- Libro financiero mensual de los consultores (REVKO LIBRO MM-MM-AA.xlsx) · 2026-11-09
-- Formato largo: una fila por (periodo del dato, hoja, clave, columna). El libro de (libro_anio, libro_mes)
-- pisa lo que ya había: las hojas históricas (gastos por mes, cartera, ventas/utilidad 5 años, inventario,
-- personal) traen sus propios meses y el libro más reciente es la verdad.
create table if not exists public.libro_financiero (
  anio        int  not null,
  mes         int  not null,            -- 0 = dato anual
  hoja        text not null,            -- conso · gastos · gastos_acum · cartera · ventas_utilidad · inventario · personal · balance · roi
  clave       text not null,
  columna     text not null default 'valor',
  valor       numeric,
  concepto    text,
  orden       int,
  nivel       int,
  padre       text,
  libro_anio  int,
  libro_mes   int,
  updated_at  timestamptz not null default now(),
  primary key (anio, mes, hoja, clave, columna)
);
create index if not exists libro_financiero_hoja_idx on public.libro_financiero (hoja, anio, mes);
create or replace function public.libro_financiero_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists trg_libro_financiero_touch on public.libro_financiero;
create trigger trg_libro_financiero_touch before insert or update on public.libro_financiero for each row execute function public.libro_financiero_touch();
alter table public.libro_financiero enable row level security;
drop policy if exists libro_financiero_select_internos on public.libro_financiero;
create policy libro_financiero_select_internos on public.libro_financiero for select to authenticated using ((select public.es_interno()));
grant select on public.libro_financiero to authenticated;
grant all on public.libro_financiero to service_role;

-- frescura_puede_ver: nueva fuente
CREATE OR REPLACE FUNCTION public.frescura_puede_ver(fuente text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_catalog'
AS $function$
begin
  if coalesce((select rolbypassrls or rolsuper from pg_roles where rolname = current_user), false) then
    return true;
  end if;
  return case fuente
    when 'sellout_detalle'            then user_can_see_cliente('digitalife') or user_can_see_cliente('dicotech')
    when 'sellout_detalle_digitalife' then user_can_see_cliente('digitalife')
    when 'sellout_detalle_dicotech'   then user_can_see_cliente('dicotech')
    when 'sellout_ensambles'          then user_can_see_cliente('digitalife')
    when 'sellout_sku'                then auth.uid() is not null
    when 'inventario_acteck'          then current_user = 'anon' or puede_ver_global('inventario_global')
    when 'precios_sku'                then puede_ver_global('estrategia_precios')
    when 'estados_resultados'         then auth.uid() is not null
    when 'libro_financiero'           then auth.uid() is not null
    else true
  end;
end $function$
;

-- v_fuentes_frescura: fila nueva
create or replace view public.v_fuentes_frescura as
 WITH f AS (
         SELECT 'facturacion_clientes'::text AS fuente,
            'Sell In (facturación)'::text AS etiqueta,
            7 AS umbral_dias,
            ( SELECT max(facturacion_clientes.uploaded_at) AS max
                   FROM facturacion_clientes) AS ultima_carga,
            ( SELECT to_char(make_date(facturacion_clientes.anio, facturacion_clientes.mes, 1)::timestamp with time zone, 'YYYY-MM'::text) AS to_char
                   FROM facturacion_clientes
                  WHERE facturacion_clientes.anio IS NOT NULL AND facturacion_clientes.mes IS NOT NULL
                  ORDER BY facturacion_clientes.anio DESC, facturacion_clientes.mes DESC
                 LIMIT 1) AS periodo_max,
            filas_est('facturacion_clientes'::text) AS filas
        UNION ALL
         SELECT 'erp_ventas'::text,
            'Ventas ERP (Vw_TablaH_Ventas)'::text,
            7,
            ( SELECT max(erp_ventas.uploaded_at) AS max
                   FROM erp_ventas) AS max,
            ( SELECT to_char(make_date(erp_ventas.anio, erp_ventas.mes, 1)::timestamp with time zone, 'YYYY-MM'::text) AS to_char
                   FROM erp_ventas
                  WHERE erp_ventas.anio IS NOT NULL AND erp_ventas.mes IS NOT NULL
                  ORDER BY erp_ventas.anio DESC, erp_ventas.mes DESC
                 LIMIT 1) AS to_char,
            filas_est('erp_ventas'::text) AS filas_est
        UNION ALL
         SELECT 'inventario_acteck'::text,
            'Inventario Acteck'::text,
            3,
            ( SELECT max(inventario_acteck.updated_at) AS max
                   FROM inventario_acteck
                  WHERE frescura_puede_ver('inventario_acteck'::text)) AS max,
            NULL::text,
            filas_est('inventario_acteck'::text) AS filas_est
        UNION ALL
         SELECT 'sellout_general'::text,
            'Sell Out mayoristas'::text,
            7,
            ( SELECT max(sellout_general.updated_at) AS max
                   FROM sellout_general) AS max,
            ( SELECT to_char(make_date(sellout_general.anio, sellout_general.mes, 1)::timestamp with time zone, 'YYYY-MM'::text) AS to_char
                   FROM sellout_general
                  WHERE sellout_general.anio IS NOT NULL AND sellout_general.mes IS NOT NULL
                  ORDER BY sellout_general.anio DESC, sellout_general.mes DESC
                 LIMIT 1) AS to_char,
            filas_est('sellout_general'::text) AS filas_est
        UNION ALL
         SELECT 'sellout_detalle'::text,
            'Sell Out detalle (Digitalife + Dicotech)'::text,
            7,
            ( SELECT max(sellout_detalle.updated_at) AS max
                   FROM sellout_detalle
                  WHERE frescura_puede_ver('sellout_detalle'::text)) AS max,
            ( SELECT to_char(max(sellout_detalle.fecha)::timestamp with time zone, 'YYYY-MM-DD'::text) AS to_char
                   FROM sellout_detalle
                  WHERE frescura_puede_ver('sellout_detalle'::text)) AS to_char,
            filas_est('sellout_detalle'::text) AS filas_est
        UNION ALL
         SELECT 'sellout_detalle_digitalife'::text,
            'Sell Out detalle · Digitalife'::text,
            7,
            ( SELECT max(sellout_detalle.updated_at) AS max
                   FROM sellout_detalle
                  WHERE sellout_detalle.cliente = 'digitalife'::text AND frescura_puede_ver('sellout_detalle_digitalife'::text)) AS max,
            ( SELECT to_char(max(sellout_detalle.fecha)::timestamp with time zone, 'YYYY-MM-DD'::text) AS to_char
                   FROM sellout_detalle
                  WHERE sellout_detalle.cliente = 'digitalife'::text AND frescura_puede_ver('sellout_detalle_digitalife'::text)) AS to_char,
            NULL::bigint AS int8
        UNION ALL
         SELECT 'sellout_detalle_dicotech'::text,
            'Sell Out detalle · Dicotech'::text,
            7,
            ( SELECT max(sellout_detalle.updated_at) AS max
                   FROM sellout_detalle
                  WHERE sellout_detalle.cliente = 'dicotech'::text AND frescura_puede_ver('sellout_detalle_dicotech'::text)) AS max,
            ( SELECT to_char(max(sellout_detalle.fecha)::timestamp with time zone, 'YYYY-MM-DD'::text) AS to_char
                   FROM sellout_detalle
                  WHERE sellout_detalle.cliente = 'dicotech'::text AND frescura_puede_ver('sellout_detalle_dicotech'::text)) AS to_char,
            NULL::bigint AS int8
        UNION ALL
         SELECT 'sellout_ensambles'::text,
            'Ensambles · Digitalife'::text,
            10,
            ( SELECT max(sellout_ensambles.updated_at) AS max
                   FROM sellout_ensambles
                  WHERE sellout_ensambles.cliente = 'digitalife'::text AND frescura_puede_ver('sellout_ensambles'::text)) AS max,
            ( SELECT to_char(max(sellout_ensambles.fecha)::timestamp with time zone, 'YYYY-MM-DD'::text) AS to_char
                   FROM sellout_ensambles
                  WHERE sellout_ensambles.cliente = 'digitalife'::text AND frescura_puede_ver('sellout_ensambles'::text)) AS to_char,
            NULL::bigint AS int8
        UNION ALL
         SELECT 'sellout_pcel'::text,
            'Sell Out PCEL'::text,
            7,
            ( SELECT max(sellout_pcel.updated_at) AS max
                   FROM sellout_pcel) AS max,
            ( SELECT (sellout_pcel.anio::text || '-W'::text) || lpad(sellout_pcel.semana::text, 2, '0'::text)
                   FROM sellout_pcel
                  WHERE sellout_pcel.anio IS NOT NULL AND sellout_pcel.semana IS NOT NULL
                  ORDER BY sellout_pcel.anio DESC, sellout_pcel.semana DESC
                 LIMIT 1),
            filas_est('sellout_pcel'::text) AS filas_est
        UNION ALL
         SELECT 'sellout_sku'::text,
            'Sell Out por SKU (captura)'::text,
            7,
            ( SELECT GREATEST(max(sellout_sku.updated_at), max(sellout_sku.created_at)) AS "greatest"
                   FROM sellout_sku
                  WHERE frescura_puede_ver('sellout_sku'::text)) AS "greatest",
            ( SELECT to_char(make_date(sellout_sku.anio, sellout_sku.mes, 1)::timestamp with time zone, 'YYYY-MM'::text) AS to_char
                   FROM sellout_sku
                  WHERE frescura_puede_ver('sellout_sku'::text) AND sellout_sku.anio IS NOT NULL AND sellout_sku.mes IS NOT NULL
                  ORDER BY sellout_sku.anio DESC, sellout_sku.mes DESC
                 LIMIT 1) AS to_char,
            filas_est('sellout_sku'::text) AS filas_est
        UNION ALL
         SELECT 'inventario_cliente'::text,
            'Inventario en cliente'::text,
            7,
            ( SELECT max(inventario_cliente.updated_at) AS max
                   FROM inventario_cliente) AS max,
            ( SELECT (inventario_cliente.anio::text || '-W'::text) || lpad(inventario_cliente.semana::text, 2, '0'::text)
                   FROM inventario_cliente
                  WHERE inventario_cliente.anio IS NOT NULL AND inventario_cliente.semana IS NOT NULL
                  ORDER BY inventario_cliente.anio DESC, inventario_cliente.semana DESC
                 LIMIT 1),
            filas_est('inventario_cliente'::text) AS filas_est
        UNION ALL
         SELECT 'precios_sku'::text,
            'Listas de precios'::text,
            30,
            ( SELECT max(precios_sku.updated_at) AS max
                   FROM precios_sku
                  WHERE frescura_puede_ver('precios_sku'::text)) AS max,
            ( SELECT to_char(make_date(precios_sku.anio, precios_sku.mes, 1)::timestamp with time zone, 'YYYY-MM'::text) AS to_char
                   FROM precios_sku
                  WHERE frescura_puede_ver('precios_sku'::text) AND precios_sku.anio IS NOT NULL AND precios_sku.mes IS NOT NULL
                  ORDER BY precios_sku.anio DESC, precios_sku.mes DESC
                 LIMIT 1) AS to_char,
            filas_est('precios_sku'::text) AS filas_est
        UNION ALL
         SELECT 'compras_oc'::text,
            'Órdenes de compra'::text,
            7,
            ( SELECT max(compras_oc.updated_at) AS max
                   FROM compras_oc) AS max,
            ( SELECT to_char(max(compras_oc.fecha_emision)::timestamp with time zone, 'YYYY-MM-DD'::text) AS to_char
                   FROM compras_oc) AS to_char,
            filas_est('compras_oc'::text) AS filas_est
        UNION ALL
         SELECT 'embarques_compras'::text,
            'Embarques (tránsito)'::text,
            7,
            ( SELECT max(embarques_compras.updated_at) AS max
                   FROM embarques_compras) AS max,
            ( SELECT to_char(max(embarques_compras.fecha_emision)::timestamp with time zone, 'YYYY-MM-DD'::text) AS to_char
                   FROM embarques_compras) AS to_char,
            filas_est('embarques_compras'::text) AS filas_est
        UNION ALL
         SELECT 'estados_cuenta'::text,
            'Estados de cuenta'::text,
            7,
            ( SELECT max(estados_cuenta.updated_at) AS max
                   FROM estados_cuenta) AS max,
            ( SELECT to_char(max(estados_cuenta.fecha_corte)::timestamp with time zone, 'YYYY-MM-DD'::text) AS to_char
                   FROM estados_cuenta) AS to_char,
            filas_est('estados_cuenta'::text) AS filas_est
        UNION ALL
         SELECT 'cuotas_mensuales'::text,
            'Cuotas mensuales'::text,
            30,
            ( SELECT GREATEST(max(cuotas_mensuales.updated_at), max(cuotas_mensuales.created_at)) AS "greatest"
                   FROM cuotas_mensuales) AS "greatest",
            ( SELECT to_char(make_date(cuotas_mensuales.anio, cuotas_mensuales.mes, 1)::timestamp with time zone, 'YYYY-MM'::text) AS to_char
                   FROM cuotas_mensuales
                  WHERE cuotas_mensuales.anio IS NOT NULL AND cuotas_mensuales.mes IS NOT NULL
                  ORDER BY cuotas_mensuales.anio DESC, cuotas_mensuales.mes DESC
                 LIMIT 1) AS to_char,
            filas_est('cuotas_mensuales'::text) AS filas_est
        UNION ALL
         SELECT 'roadmap_sku'::text,
            'Roadmap de SKUs'::text,
            30,
            ( SELECT max(roadmap_sku.updated_at) AS max
                   FROM roadmap_sku) AS max,
            NULL::text,
            filas_est('roadmap_sku'::text) AS filas_est
        UNION ALL
         SELECT 'guias_erp'::text,
            'Guías ERP'::text,
            7,
            ( SELECT GREATEST(max(guias_erp.updated_at), max(guias_erp.created_at)) AS "greatest"
                   FROM guias_erp) AS "greatest",
            ( SELECT to_char(max(guias_erp.fecha_emision), 'YYYY-MM-DD'::text) AS to_char
                   FROM guias_erp) AS to_char,
            filas_est('guias_erp'::text) AS filas_est
        UNION ALL
         SELECT 'programacion_arribos'::text,
            'Programación de arribos'::text,
            7,
            ( SELECT max(programacion_arribos.updated_at) AS max
                   FROM programacion_arribos) AS max,
            ( SELECT to_char(max(programacion_arribos.arribo_almacen)::timestamp with time zone, 'YYYY-MM-DD'::text) AS to_char
                   FROM programacion_arribos) AS to_char,
            filas_est('programacion_arribos'::text) AS filas_est
        UNION ALL
         SELECT 'libro_financiero'::text,
            'Libro financiero (consultores)'::text,
            40,
            ( SELECT max(libro_financiero.updated_at) AS max
                   FROM libro_financiero
                  WHERE frescura_puede_ver('libro_financiero'::text)) AS max,
            ( SELECT to_char(make_date(libro_financiero.libro_anio, libro_financiero.libro_mes, 1)::timestamp with time zone, 'YYYY-MM'::text) AS to_char
                   FROM libro_financiero
                  WHERE frescura_puede_ver('libro_financiero'::text) AND libro_financiero.libro_anio IS NOT NULL AND libro_financiero.libro_mes IS NOT NULL
                  ORDER BY libro_financiero.libro_anio DESC, libro_financiero.libro_mes DESC
                 LIMIT 1) AS to_char,
            filas_est('libro_financiero'::text) AS filas_est
        UNION ALL
         SELECT 'estados_resultados'::text,
            'Estado de resultados (P&L)'::text,
            40,
            ( SELECT max(estados_resultados.updated_at) AS max
                   FROM estados_resultados
                  WHERE frescura_puede_ver('estados_resultados'::text)) AS max,
            ( SELECT to_char(make_date(estados_resultados.anio, estados_resultados.mes, 1)::timestamp with time zone, 'YYYY-MM'::text) AS to_char
                   FROM estados_resultados
                  WHERE frescura_puede_ver('estados_resultados'::text) AND estados_resultados.anio IS NOT NULL AND estados_resultados.mes IS NOT NULL
                  ORDER BY estados_resultados.anio DESC, estados_resultados.mes DESC
                 LIMIT 1) AS to_char,
            filas_est('estados_resultados'::text) AS filas_est
        )
 SELECT fuente,
    etiqueta,
    ultima_carga,
    periodo_max,
    filas,
    umbral_dias,
        CASE
            WHEN ultima_carga IS NULL THEN 'sin_datos'::text
            WHEN ultima_carga < (now() - make_interval(days => umbral_dias)) THEN 'atrasada'::text
            ELSE 'ok'::text
        END AS estado,
        CASE
            WHEN ultima_carga IS NULL THEN NULL::integer
            ELSE floor(EXTRACT(epoch FROM now() - ultima_carga) / 86400::numeric)::integer
        END AS dias
   FROM f;;
