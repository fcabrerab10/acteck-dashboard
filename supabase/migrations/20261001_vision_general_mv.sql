-- Visión General en milisegundos (2026-10-01). Las vistas de sell out e inventario de Visión General tardaban 1.3–4.9 s

-- cada una (12 consultas en paralelo → varias superaban el statement_timeout de 8 s del rol authenticated y la pantalla

-- se quedaba en esqueleto). Ahora cada una vive en una materializada (misma definición) y la vista sólo la lee; se

-- refrescan al final de refresh_mv_sellout_unificado() (puente 06:30 e import-central) y en la foto diaria de inventario.

drop materialized view if exists public.mv_vision_sellout_canal;
create materialized view public.mv_vision_sellout_canal as
 SELECT anio,
    canal_sellout,
    sum(importe) AS importe,
    count(DISTINCT cliente_final) AS clientes_finales,
    count(DISTINCT sku) AS skus
   FROM mv_sellout_unificado
  GROUP BY anio, canal_sellout;
grant select on public.mv_vision_sellout_canal to anon, authenticated, service_role;
create or replace view public.v_vision_sellout_canal as select * from public.mv_vision_sellout_canal;

drop materialized view if exists public.mv_vision_sellout_mayoristas;
create materialized view public.mv_vision_sellout_mayoristas as
 SELECT anio,
    fuente AS mayorista,
    sum(importe) AS importe,
    count(DISTINCT cliente_final) AS clientes_finales,
    count(DISTINCT sku) AS skus,
    'mayoreo'::text AS canal_sellout
   FROM mv_sellout_unificado
  WHERE canal_sellout = 'mayoreo'::text
  GROUP BY anio, fuente;
grant select on public.mv_vision_sellout_mayoristas to anon, authenticated, service_role;
create or replace view public.v_vision_sellout_mayoristas as select * from public.mv_vision_sellout_mayoristas;

drop materialized view if exists public.mv_vision_sellout_top_skus;
create materialized view public.mv_vision_sellout_top_skus as
 SELECT anio,
    sku,
    sum(importe) AS importe,
    sum(cantidad) AS piezas,
    count(DISTINCT cliente_final) AS clientes,
    count(DISTINCT fuente) AS canales
   FROM mv_sellout_unificado
  GROUP BY anio, sku;
grant select on public.mv_vision_sellout_top_skus to anon, authenticated, service_role;
create or replace view public.v_vision_sellout_top_skus as select * from public.mv_vision_sellout_top_skus;

drop materialized view if exists public.mv_vision_sellout_top_clientes;
create materialized view public.mv_vision_sellout_top_clientes as
 SELECT anio,
    cliente_final,
    sum(importe) AS importe,
    count(DISTINCT sku) AS skus,
    count(DISTINCT fuente) AS mayoristas_o_canales,
    mode() WITHIN GROUP (ORDER BY fuente) AS fuente_principal
   FROM mv_sellout_unificado
  WHERE cliente_final IS NOT NULL AND cliente_final <> ''::text
  GROUP BY anio, cliente_final;
grant select on public.mv_vision_sellout_top_clientes to anon, authenticated, service_role;
create or replace view public.v_vision_sellout_top_clientes as select * from public.mv_vision_sellout_top_clientes;

drop materialized view if exists public.mv_vision_sellout_promos;
create materialized view public.mv_vision_sellout_promos as
 WITH promos_activas AS (
         SELECT promos_temporada.sku,
            promos_temporada.anio,
            promos_temporada.mes,
            promos_temporada.campania,
            promos_temporada.promo_pct,
            promos_temporada.descripcion,
            promos_temporada.sort_order,
            promos_temporada.updated_at
           FROM promos_temporada
          WHERE promos_temporada.anio = EXTRACT(year FROM CURRENT_DATE)::integer AND promos_temporada.mes = EXTRACT(month FROM CURRENT_DATE)::integer
        ), sellout_mes AS (
         SELECT v_sellout_unificado.sku,
            v_sellout_unificado.importe,
            v_sellout_unificado.cantidad
           FROM v_sellout_unificado
          WHERE v_sellout_unificado.anio = EXTRACT(year FROM CURRENT_DATE)::integer AND v_sellout_unificado.mes = EXTRACT(month FROM CURRENT_DATE)::integer
        ), sellout_mes_prev AS (
         SELECT v_sellout_unificado.sku,
            v_sellout_unificado.importe
           FROM v_sellout_unificado
          WHERE v_sellout_unificado.anio = EXTRACT(year FROM CURRENT_DATE - '1 mon'::interval)::integer AND v_sellout_unificado.mes = EXTRACT(month FROM CURRENT_DATE - '1 mon'::interval)::integer
        )
 SELECT ( SELECT max(promos_activas.campania) AS max
           FROM promos_activas) AS campania,
    ( SELECT count(DISTINCT promos_activas.sku) AS count
           FROM promos_activas) AS skus_campania,
    COALESCE(sum(
        CASE
            WHEN pa.sku IS NOT NULL THEN sm.importe
            ELSE 0::numeric
        END), 0::numeric) AS sellout_en_promo,
    COALESCE(sum(
        CASE
            WHEN pa.sku IS NULL THEN sm.importe
            ELSE 0::numeric
        END), 0::numeric) AS sellout_fuera_promo,
    ( SELECT COALESCE(sum(sp.importe), 0::numeric) AS "coalesce"
           FROM sellout_mes_prev sp
             JOIN promos_activas pa2 ON sp.sku = pa2.sku) AS sellout_promo_mes_prev
   FROM sellout_mes sm
     LEFT JOIN promos_activas pa ON sm.sku = pa.sku;
grant select on public.mv_vision_sellout_promos to anon, authenticated, service_role;
create or replace view public.v_vision_sellout_promos as select * from public.mv_vision_sellout_promos;

drop materialized view if exists public.mv_vision_sellout_rotacion;
create materialized view public.mv_vision_sellout_rotacion as
 WITH mapeo_mayorista_a_cliente AS (
         SELECT t.mayorista,
            t.cliente_facturacion
           FROM ( VALUES ('CT INTERNACIONAL'::text,'CT INTERNACIONAL DEL NOROESTE'::text), ('CVA'::text,'COMERCIALIZADORA DE VALOR AGREGADO'::text), ('DICOTECH'::text,'DICOTECH MAYORISTA DE TECNOLOGIA'::text), ('INGRAM MICRO'::text,'INGRAM MICRO MEXICO'::text), ('ARROBA COMPUTERS'::text,'ARROBA COMPUTERS DISTRIBUCION'::text), ('TECHS MART'::text,'TECHS MART DE MEXICO'::text), ('GRUPO UNIDADES DE COMPUTO'::text,'GRUPO UNIDADES DE COMPUTO'::text), ('DC MAYORISTA'::text,'DC MAYORISTA'::text), ('EXEL DEL NORTE'::text,'EXEL DEL NORTE'::text), ('GROUP NSSTORE'::text,'GROUP NSSTORE'::text), ('GRUPO LOMA DEL NORTE'::text,'GRUPO LOMA DEL NORTE'::text), ('PCH MAYOREO'::text,'PCH MAYOREO'::text), ('INTEGRADORA KABIK'::text,'INTEGRADORA KABIK'::text)) t(mayorista, cliente_facturacion)
        ), sellin_lag AS (
         SELECT m.mayorista,
            sum(fc.monto) AS sellin_hasta_lag
           FROM facturacion_clientes fc
             JOIN mapeo_mayorista_a_cliente m ON upper(fc.cliente_nombre) = upper(m.cliente_facturacion)
          WHERE make_date(fc.anio, fc.mes, 15) <= (CURRENT_DATE - '90 days'::interval) AND make_date(fc.anio, fc.mes, 15) >= date_trunc('year'::text, CURRENT_DATE::timestamp with time zone)
          GROUP BY m.mayorista
        ), sellout_ytd AS (
         SELECT sellout_general.mayorista AS fuente,
            sum(sellout_general.importe) AS sellout_ytd
           FROM sellout_general
          WHERE sellout_general.anio = EXTRACT(year FROM CURRENT_DATE)::integer
          GROUP BY sellout_general.mayorista
        )
 SELECT COALESCE(sl.mayorista, so.fuente) AS mayorista,
    COALESCE(sl.sellin_hasta_lag, 0::numeric) AS sellin_lag_90d,
    COALESCE(so.sellout_ytd, 0::numeric) AS sellout_ytd,
        CASE
            WHEN COALESCE(sl.sellin_hasta_lag, 0::numeric) > 0::numeric THEN COALESCE(so.sellout_ytd, 0::numeric) / sl.sellin_hasta_lag * 100::numeric
            ELSE NULL::numeric
        END AS rotacion_pct,
    GREATEST(0::numeric, COALESCE(sl.sellin_hasta_lag, 0::numeric) - COALESCE(so.sellout_ytd, 0::numeric)) AS sin_rotar
   FROM sellin_lag sl
     FULL JOIN sellout_ytd so ON sl.mayorista = so.fuente;
grant select on public.mv_vision_sellout_rotacion to anon, authenticated, service_role;
create or replace view public.v_vision_sellout_rotacion as select * from public.mv_vision_sellout_rotacion;

drop materialized view if exists public.mv_vision_inventario_global;
create materialized view public.mv_vision_inventario_global as
 WITH inv_com AS (
         SELECT i.articulo,
            sum(i.disponible) AS stock,
            sum(i.costodisponible) AS valor
           FROM inventario_acteck i
             JOIN almacenes_config a ON a.no_almacen = i.no_almacen
          WHERE a.comercial = true
          GROUP BY i.articulo
        ), con_stock AS (
         SELECT inv_com.articulo,
            inv_com.valor,
            inv_com.stock
           FROM inv_com
          WHERE inv_com.stock > 0::numeric
        ), demanda_reciente AS (
         SELECT DISTINCT facturacion_clientes.sku AS articulo
           FROM facturacion_clientes
          WHERE make_date(facturacion_clientes.anio, facturacion_clientes.mes, 15) >= (CURRENT_DATE - '90 days'::interval) AND facturacion_clientes.piezas > 0::numeric
        ), agotados AS (
         SELECT count(*)::integer AS n
           FROM inv_com i
          WHERE i.stock = 0::numeric AND (i.articulo IN ( SELECT demanda_reciente.articulo
                   FROM demanda_reciente))
        )
 SELECT round(sum(valor), 2) AS valor_inventario,
    sum(stock)::bigint AS piezas_disponibles,
    count(*)::integer AS skus_con_stock,
    ( SELECT agotados.n
           FROM agotados) AS skus_agotados,
    ( SELECT max(inventario_acteck.updated_at) AS max
           FROM inventario_acteck) AS ultima_carga
   FROM con_stock;
grant select on public.mv_vision_inventario_global to anon, authenticated, service_role;
create or replace view public.v_vision_inventario_global as select * from public.mv_vision_inventario_global;

drop materialized view if exists public.mv_vision_sellout_mensual;
create materialized view public.mv_vision_sellout_mensual as
 SELECT anio,
    mes,
    canal_sellout,
    sum(importe) AS importe
   FROM mv_sellout_unificado
  GROUP BY anio, mes, canal_sellout;
grant select on public.mv_vision_sellout_mensual to anon, authenticated, service_role;
create or replace view public.v_vision_sellout_mensual as select * from public.mv_vision_sellout_mensual;

create or replace function public.refresh_vision_general()
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  refresh materialized view public.mv_vision_sellout_canal;
  refresh materialized view public.mv_vision_sellout_mayoristas;
  refresh materialized view public.mv_vision_sellout_top_skus;
  refresh materialized view public.mv_vision_sellout_top_clientes;
  refresh materialized view public.mv_vision_sellout_promos;
  refresh materialized view public.mv_vision_sellout_rotacion;
  refresh materialized view public.mv_vision_sellout_mensual;
  refresh materialized view public.mv_vision_inventario_global;
end;
$$;
grant execute on function public.refresh_vision_general() to service_role;
create or replace function public.refresh_mv_sellout_unificado()
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  refresh materialized view concurrently public.mv_sellout_general_dicotech;
  refresh materialized view public.mv_sellout_unificado;
  perform public.refresh_sellout_global();
  perform public.refresh_vision_general();
end;
$$;
