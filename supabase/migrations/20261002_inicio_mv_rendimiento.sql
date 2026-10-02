-- 2026-10-02 · Rendimiento: cinco vistas que la app leía vivas (1–3 s cada una, con timeouts de 3/8 s) pasan a
-- materializadas; la vista conserva su nombre y sólo lee la MV. Medido en producción el 1-oct:
--   v_medidas_inventario 2.1 s (Inicio, Inventario global, Visión General) · v_sellout_cuenta_mes 1.9 s (Sell Out
--   consolidado, página por cliente, Inicio) · v_facturacion_global_mensual 1.6 s y v_sellin_global_sku_anio_erp
--   0.9 s (Sell In consolidado) · v_precios_cambios_mes 0.7 s × 6 páginas (Estrategia de Precios, Proyectos).
-- Refresco: sell out en refresh_sellout_global(); las demás en refresh_facturacion_clientes() (cada carga del
-- puente, horaria) y mv_medidas_inventario también en refresh_vision_general() (foto diaria 19:30).

create materialized view if not exists public.mv_sellout_cuenta_mes as
WITH p AS (
         SELECT mv_sellout_cuenta_dia.cuenta,
            mv_sellout_cuenta_dia.anio,
            mv_sellout_cuenta_dia.mes,
            sum(mv_sellout_cuenta_dia.importe) AS importe,
            sum(mv_sellout_cuenta_dia.cantidad) AS cantidad
           FROM mv_sellout_cuenta_dia
          GROUP BY mv_sellout_cuenta_dia.cuenta, mv_sellout_cuenta_dia.anio, mv_sellout_cuenta_dia.mes
        UNION ALL
         SELECT c2.cuenta,
            si2.anio,
            si2.mes,
            0::numeric AS "numeric",
            0::numeric AS "numeric"
           FROM v_sellout_cuentas c2
             JOIN mv_analisis_cliente_mes si2 ON si2.cliente = c2.erp_cliente
          WHERE c2.fuente IS NULL
        )
 SELECT c.cuenta,
    c.nombre,
    c.canal_sellout,
    c.erp_cliente,
    c.propio,
    c.granularidad,
    p.anio,
    p.mes,
    p.importe,
    p.cantidad,
    si.fact_neta AS sell_in,
    si.piezas_venta_neta AS sell_in_piezas,
    dim.clientes_finales,
    dim.vendedores,
    dim.sucursales,
    dim.facturas,
    dim.estados,
    dim.importe_sin_estado,
    dim.importe_sin_cliente,
    dim.importe_fuente,
    inv.valor AS inv_valor,
    inv.piezas AS inv_piezas,
    inv.skus_con_stock AS inv_skus,
    inv.skus_sin_venta_30 AS inv_skus_sin_venta_30,
    inv.semana AS inv_semana,
    cli.activos AS cf_activos,
    cli.nuevos AS cf_nuevos,
    cli.perdidos AS cf_perdidos,
    cli.recompra_pct AS cf_recompra_pct,
    cli.ticket_promedio AS cf_ticket,
    ven.activos AS vend_activos,
    ven.nuevos AS vend_nuevos,
    ven.perdidos AS vend_perdidos,
    ven.recurrentes AS vend_recurrentes
   FROM p
     JOIN v_sellout_cuentas c ON c.cuenta = p.cuenta
     LEFT JOIN mv_analisis_cliente_mes si ON si.cliente = c.erp_cliente AND si.anio = p.anio AND si.mes = p.mes
     LEFT JOIN mv_sellout_dim_cuenta_mes dim ON dim.cuenta = c.cuenta AND dim.anio = p.anio AND dim.mes = p.mes
     LEFT JOIN v_sellout_inventario_cuenta_mes inv ON inv.cuenta = c.cuenta AND inv.anio = p.anio AND inv.mes = p.mes
     LEFT JOIN v_sellout_clientes_resumen_mes cli ON cli.cuenta = c.cuenta AND cli.anio = p.anio AND cli.mes = p.mes
     LEFT JOIN v_sellout_vendedores_resumen_mes ven ON ven.cuenta = c.cuenta AND ven.anio = p.anio AND ven.mes = p.mes;
create unique index if not exists mv_sellout_cuenta_mes_uk on public.mv_sellout_cuenta_mes (cuenta, anio, mes);
create or replace view public.v_sellout_cuenta_mes as select * from public.mv_sellout_cuenta_mes;

create materialized view if not exists public.mv_medidas_inventario as
WITH s AS (
         SELECT sum(v_medidas_inventario_sku.inv_actual) AS inv_actual,
            sum(v_medidas_inventario_sku.inv_actual_piezas) AS inv_actual_piezas,
            sum(v_medidas_inventario_sku.inv_actual_disponible) AS inv_actual_disponible,
            sum(v_medidas_inventario_sku.inv_config_costo_inventario) AS inv_config_costo_inventario,
            sum(v_medidas_inventario_sku.inv_config_costo_disponible) AS inv_config_costo_disponible,
            sum(v_medidas_inventario_sku.inv_config_piezas) AS inv_config_piezas,
            sum(v_medidas_inventario_sku.inv_config_disponible) AS inv_config_disponible,
            sum(v_medidas_inventario_sku.inv_ventas_todas_ramas) AS inv_ventas_todas_ramas,
            count(*) FILTER (WHERE v_medidas_inventario_sku.inv_actual_piezas > 0::numeric)::integer AS skus_con_stock,
            avg(v_medidas_inventario_sku.costo_promedio) AS costo_promedio
           FROM v_medidas_inventario_sku
        ), c AS (
         SELECT v_medidas_compras.compra_usd_pendiente,
            v_medidas_compras.compra_usd_orden,
            v_medidas_compras.piezas_pendientes,
            v_medidas_compras.costo_compra_tc17,
            v_medidas_compras.costo_compra_tc20,
            v_medidas_compras.actualizado
           FROM v_medidas_compras
        ), cv AS (
         SELECT COALESCE(sum(m.costo_venta_neta), 0::numeric) AS cv_3m
           FROM v_erp_medidas_mes m
          WHERE make_date(m.anio, m.mes, 1) >= (date_trunc('month'::text, CURRENT_DATE::timestamp with time zone) - '3 mons'::interval)::date AND make_date(m.anio, m.mes, 1) < date_trunc('month'::text, CURRENT_DATE::timestamp with time zone)::date
        ), ytd AS (
         SELECT COALESCE(sum(m.costo_venta_neta), 0::numeric) AS ytd_costo_venta
           FROM v_erp_medidas_mes m
          WHERE m.anio = EXTRACT(year FROM CURRENT_DATE)::integer
        ), prom AS (
         SELECT avg(v_medidas_inventario_mes.inv_promedio) AS ip
           FROM v_medidas_inventario_mes
        )
 SELECT s.inv_actual,
    s.inv_actual_piezas,
    s.inv_actual_disponible,
    s.inv_config_costo_inventario,
    s.inv_config_costo_disponible,
    s.inv_config_piezas,
    s.inv_config_disponible,
    s.inv_ventas_todas_ramas,
    s.skus_con_stock,
    s.costo_promedio,
    c.costo_compra_tc17,
    c.costo_compra_tc20,
    c.compra_usd_pendiente,
    c.piezas_pendientes,
    s.inv_actual + c.costo_compra_tc17 AS inv_total,
    cv.cv_3m AS cv_ultimos_3_meses,
    ytd.ytd_costo_venta,
        CASE
            WHEN cv.cv_3m <> 0::numeric THEN s.inv_actual / cv.cv_3m * param_medida('inv_dias_base'::text, 90::numeric)
            ELSE NULL::numeric
        END AS dias_inv,
        CASE
            WHEN cv.cv_3m <> 0::numeric THEN (s.inv_actual + c.costo_compra_tc17) / cv.cv_3m * param_medida('inv_dias_base'::text, 90::numeric)
            ELSE NULL::numeric
        END AS dias_inv_total,
    prom.ip AS inv_promedio,
        CASE
            WHEN prom.ip IS NOT NULL AND prom.ip <> 0::numeric THEN ytd.ytd_costo_venta / prom.ip
            ELSE NULL::numeric
        END AS vueltas_inv,
    ( SELECT max(inventario_acteck.updated_at) AS max
           FROM inventario_acteck) AS actualizado
   FROM s,
    c,
    cv,
    ytd,
    prom;
create or replace view public.v_medidas_inventario as select * from public.mv_medidas_inventario;

create materialized view if not exists public.mv_sellin_global_sku_anio_erp as
SELECT articulo AS sku,
    anio,
    sum(fact_neta) AS fact_neta,
    sum(contribucion) AS contribucion,
    sum(piezas_venta_neta) AS piezas,
        CASE
            WHEN sum(fact_neta) <> 0::numeric THEN sum(contribucion) / sum(fact_neta)
            ELSE NULL::numeric
        END AS pct_mc
   FROM mv_analisis_cliente_sku_mes
  WHERE articulo IS NOT NULL AND articulo <> '—'::text
  GROUP BY articulo, anio;
create unique index if not exists mv_sellin_global_sku_anio_erp_uk on public.mv_sellin_global_sku_anio_erp (sku, anio);
create or replace view public.v_sellin_global_sku_anio_erp as select * from public.mv_sellin_global_sku_anio_erp;

create materialized view if not exists public.mv_facturacion_global_mensual as
SELECT anio,
    mes,
    sum(piezas) AS piezas,
    sum(monto) AS monto
   FROM facturacion_clientes
  GROUP BY anio, mes;
create unique index if not exists mv_facturacion_global_mensual_uk on public.mv_facturacion_global_mensual (anio, mes);
create or replace view public.v_facturacion_global_mensual as select * from public.mv_facturacion_global_mensual;

create materialized view if not exists public.mv_precios_cambios_mes as
SELECT sku,
    lista,
    anio,
    mes,
    precio AS precio_actual,
    precio_prev AS precio_anterior,
    anio_prev,
    mes_prev,
        CASE
            WHEN precio_prev IS NULL OR precio_prev = 0::numeric THEN NULL::numeric
            ELSE round((precio - precio_prev) / precio_prev * 100::numeric, 2)
        END AS delta_pct,
        CASE
            WHEN precio_prev IS NULL THEN 'nuevo'::text
            WHEN precio > precio_prev THEN 'subio'::text
            WHEN precio < precio_prev THEN 'bajo'::text
            ELSE 'sin_cambio'::text
        END AS tipo
   FROM ( SELECT h.sku,
            h.lista,
            h.anio,
            h.mes,
            h.precio,
            lag(h.precio) OVER w AS precio_prev,
            lag(h.anio) OVER w AS anio_prev,
            lag(h.mes) OVER w AS mes_prev,
            row_number() OVER (PARTITION BY h.sku, h.lista ORDER BY h.anio DESC, h.mes DESC) AS rn
           FROM precios_historico h
          WINDOW w AS (PARTITION BY h.sku, h.lista ORDER BY h.anio, h.mes)) x
  WHERE rn = 1;
create unique index if not exists mv_precios_cambios_mes_uk on public.mv_precios_cambios_mes (sku, lista, anio, mes);
create or replace view public.v_precios_cambios_mes as select * from public.mv_precios_cambios_mes;

grant select on public.mv_sellout_cuenta_mes, public.mv_medidas_inventario, public.mv_sellin_global_sku_anio_erp, public.mv_facturacion_global_mensual, public.mv_precios_cambios_mes to anon, authenticated;

create or replace function public.refresh_sellout_global() returns void language plpgsql security definer set search_path to 'public' as $$
begin
  refresh materialized view public.mv_sellout_estado_norm;
  refresh materialized view concurrently public.mv_sellout_cuenta_dia;
  refresh materialized view concurrently public.mv_sellout_cuenta_sku_mes;
  refresh materialized view concurrently public.mv_sellout_dim_cuenta_mes;
  refresh materialized view concurrently public.mv_sellout_estado_mes;
  refresh materialized view concurrently public.mv_sellout_cliente_final_mes;
  refresh materialized view concurrently public.mv_sellout_vendedor_mes;
  refresh materialized view concurrently public.mv_sellout_sucursal_mes;
  refresh materialized view concurrently public.mv_sellout_cuenta_mes;   -- 2026-10-02
end;
$$;

create or replace function public.refresh_vision_general() returns void language plpgsql security definer set search_path to 'public' as $$
begin
  refresh materialized view public.mv_vision_sellout_canal;
  refresh materialized view public.mv_vision_sellout_mayoristas;
  refresh materialized view public.mv_vision_sellout_top_skus;
  refresh materialized view public.mv_vision_sellout_top_clientes;
  refresh materialized view public.mv_vision_sellout_promos;
  refresh materialized view public.mv_vision_sellout_rotacion;
  refresh materialized view public.mv_vision_sellout_mensual;
  refresh materialized view public.mv_vision_inventario_global;
  refresh materialized view concurrently public.mv_apoyos_convenio;
  refresh materialized view public.mv_medidas_inventario;   -- 2026-10-02
end;
$$;

CREATE OR REPLACE FUNCTION public.refresh_facturacion_clientes(p_anios integer[] DEFAULT NULL::integer[])
 RETURNS TABLE(anio integer, filas bigint, monto numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '300s'
AS $function$
DECLARE v_anios integer[];
BEGIN
  v_anios := COALESCE(p_anios, (SELECT array_agg(DISTINCT e.anio) FROM erp_ventas e WHERE e.anio IS NOT NULL));
  IF v_anios IS NULL OR array_length(v_anios, 1) IS NULL THEN RETURN; END IF;

  DELETE FROM facturacion_clientes f WHERE f.anio = ANY (v_anios);

  INSERT INTO facturacion_clientes (cliente_nombre, cliente_key, sku, anio, mes, piezas, monto, canal, uploaded_at)
  WITH canal_cli AS (
    -- Por CÓDIGO de cliente: dos códigos con el mismo nombre pueden vivir en canales distintos.
    SELECT COALESCE(e.cliente, e.cliente_nombre) AS cliente, e.anio,
           mode() WITHIN GROUP (ORDER BY e.canal) AS canal
    FROM erp_ventas e WHERE e.anio = ANY (v_anios)
    GROUP BY COALESCE(e.cliente, e.cliente_nombre), e.anio
  )
  SELECT e.cliente_nombre,
         CASE
           WHEN upper(e.cliente_nombre) LIKE '%CAJADL01%' OR upper(e.cliente_nombre) LIKE '%API GLOBAL%' THEN 'digitalife'
           WHEN upper(e.cliente_nombre) LIKE '%PC ONLINE%' THEN 'pcel'
           WHEN upper(e.cliente_nombre) LIKE '%DICOTECH%'  THEN 'dicotech'
           ELSE COALESCE(NULLIF(trim(BOTH '_' FROM regexp_replace(lower(c.canal), '[^a-z0-9]+', '_', 'g')), ''), 'otros')
         END AS cliente_key,
         e.articulo AS sku, e.anio, e.mes,
         SUM(CASE WHEN e.movimiento_venta IN ('Factura','Factura Com.Ext33','Devolucion Venta') THEN COALESCE(e.unidades, e.piezas, 0) ELSE 0 END) AS piezas,
         SUM(CASE WHEN e.movimiento_venta IN ('Factura','Factura Com.Ext33')
                    OR (e.movimiento_venta = 'Devolucion Venta' AND COALESCE(e.instruccion, '') NOT ILIKE 'nota credito')
                  THEN COALESCE(e.monto_venta_pesos, 0) ELSE 0 END) AS monto,
         c.canal, now()
  FROM erp_ventas e
  JOIN canal_cli c ON c.cliente = COALESCE(e.cliente, e.cliente_nombre) AND c.anio = e.anio
  WHERE e.anio = ANY (v_anios) AND e.articulo IS NOT NULL AND e.cliente_nombre IS NOT NULL AND e.mes IS NOT NULL
  GROUP BY e.cliente_nombre, e.articulo, e.anio, e.mes, c.canal;

  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_erp_medidas_cliente_mes;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_erp_medidas_canal_mes;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_vision_factura_dimension_mes;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_vision_factura_dimension_clientes;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_analisis_cliente_mes;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_analisis_cliente_sku_mes;
  -- Rendimiento 2026-09-12: Sell In consolidado pivotado + v_fact_cliente_mes
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_sellin_global_sku_canal_anio;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_fact_cliente_mes;

  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_medidas_ventas_vendedor_mes;

  REFRESH MATERIALIZED VIEW public.mv_bonificaciones_concepto_mes;

  REFRESH MATERIALIZED VIEW public.mv_ventas_vendedor_cliente_mes;

  -- Rendimiento 2026-10-02 (Inicio del negocio): vistas que la app leía vivas en 1-3 s
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_sellin_global_sku_anio_erp;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_facturacion_global_mensual;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_precios_cambios_mes;
  REFRESH MATERIALIZED VIEW public.mv_medidas_inventario;

  RETURN QUERY SELECT f.anio, COUNT(*)::bigint, SUM(f.monto) FROM facturacion_clientes f WHERE f.anio = ANY (v_anios) GROUP BY f.anio ORDER BY f.anio;
END $function$
;
