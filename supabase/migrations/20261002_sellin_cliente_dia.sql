-- 2026-10-02 · Página por cliente: «zoom» de cómo evoluciona el sell in por día del mes (Fernando: «para mejorar cada
-- cuánto nos colocan compras y que no todo se esté yendo al cierre de mes»). Fact Neta por cliente (código del ERP)
-- y día, con la misma regla de v_erp_medidas: Factura + Factura Com.Ext33 + devoluciones sin nota de crédito.
create materialized view if not exists public.mv_sellin_cliente_dia as
select cliente, cliente_key, anio, mes, dia,
       sum(case when movimiento_venta in ('Factura','Factura Com.Ext33') then coalesce(monto_venta_pesos,0)
                when movimiento_venta = 'Devolucion Venta' and coalesce(instruccion,'') not ilike 'nota credito' then coalesce(monto_venta_pesos,0)
                else 0 end)::numeric as fact_neta,
       sum(case when movimiento_venta in ('Factura','Factura Com.Ext33') then coalesce(unidades,0)
                when movimiento_venta = 'Devolucion Venta' and coalesce(instruccion,'') not ilike 'nota credito' then coalesce(unidades,0)
                else 0 end)::numeric as piezas,
       count(distinct case when movimiento_venta in ('Factura','Factura Com.Ext33') then venta_id end)::int as facturas
from public.erp_ventas
where cliente is not null and anio is not null and mes is not null and dia is not null
group by 1,2,3,4,5;
create unique index if not exists mv_sellin_cliente_dia_uk on public.mv_sellin_cliente_dia (cliente, anio, mes, dia);
create index if not exists mv_sellin_cliente_dia_anio on public.mv_sellin_cliente_dia (anio, cliente);
create or replace view public.v_sellin_cliente_dia as select * from public.mv_sellin_cliente_dia;
grant select on public.mv_sellin_cliente_dia, public.v_sellin_cliente_dia to anon, authenticated;

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
  -- Página por cliente 2026-10-02: sell in por día
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_sellin_cliente_dia;

  RETURN QUERY SELECT f.anio, COUNT(*)::bigint, SUM(f.monto) FROM facturacion_clientes f WHERE f.anio = ANY (v_anios) GROUP BY f.anio ORDER BY f.anio;
END $function$
;
