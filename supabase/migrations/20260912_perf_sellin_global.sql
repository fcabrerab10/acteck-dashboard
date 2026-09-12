-- Rendimiento · Sell In consolidado (2026-09-12)
--
-- Antes: la pantalla leía v_sellin_global_sku_canal_mes (vista viva sobre
-- facturacion_clientes) con 1 fila por sku × canal × es_clave × año × MES:
-- ~32K filas para 2 años → 4 páginas de PostgREST (10K máx.) + el count exact
-- de cada una, y cada página reejecutaba el GroupAggregate completo (≈185 ms).
-- Total ≈ 3 s de espera la primera vez.
--
-- Ahora: una MV con los 12 meses PIVOTADOS en dos arrays (piezas[12], monto[12]).
-- Mismo dato, 1 fila por sku × canal × es_clave × AÑO → 7.6K filas para 2 años,
-- una sola página por año y sin agregación en caliente. El cliente vuelve a
-- expandir los arrays a la forma fila-por-mes en useFacturacionGlobal(), así que
-- la pantalla no cambia ni una línea de su lógica de agregados.
--
-- La refresca refresh_facturacion_clientes() (es la misma fuente: facturacion_clientes).

DROP MATERIALIZED VIEW IF EXISTS public.mv_sellin_global_sku_canal_anio CASCADE;

CREATE MATERIALIZED VIEW public.mv_sellin_global_sku_canal_anio AS
SELECT
  f.sku,
  COALESCE(NULLIF(btrim(f.canal), ''), 'otros')                                    AS canal,
  (f.cliente_key = ANY (ARRAY['digitalife','pcel','dicotech']))                    AS es_clave,
  f.anio,
  -- índice 0 = enero … 11 = diciembre
  ARRAY[
    SUM(f.piezas) FILTER (WHERE f.mes = 1),  SUM(f.piezas) FILTER (WHERE f.mes = 2),
    SUM(f.piezas) FILTER (WHERE f.mes = 3),  SUM(f.piezas) FILTER (WHERE f.mes = 4),
    SUM(f.piezas) FILTER (WHERE f.mes = 5),  SUM(f.piezas) FILTER (WHERE f.mes = 6),
    SUM(f.piezas) FILTER (WHERE f.mes = 7),  SUM(f.piezas) FILTER (WHERE f.mes = 8),
    SUM(f.piezas) FILTER (WHERE f.mes = 9),  SUM(f.piezas) FILTER (WHERE f.mes = 10),
    SUM(f.piezas) FILTER (WHERE f.mes = 11), SUM(f.piezas) FILTER (WHERE f.mes = 12)
  ]::numeric[] AS piezas,
  ARRAY[
    SUM(f.monto) FILTER (WHERE f.mes = 1),  SUM(f.monto) FILTER (WHERE f.mes = 2),
    SUM(f.monto) FILTER (WHERE f.mes = 3),  SUM(f.monto) FILTER (WHERE f.mes = 4),
    SUM(f.monto) FILTER (WHERE f.mes = 5),  SUM(f.monto) FILTER (WHERE f.mes = 6),
    SUM(f.monto) FILTER (WHERE f.mes = 7),  SUM(f.monto) FILTER (WHERE f.mes = 8),
    SUM(f.monto) FILTER (WHERE f.mes = 9),  SUM(f.monto) FILTER (WHERE f.mes = 10),
    SUM(f.monto) FILTER (WHERE f.mes = 11), SUM(f.monto) FILTER (WHERE f.mes = 12)
  ]::numeric[] AS monto
FROM public.facturacion_clientes f
WHERE f.sku IS NOT NULL
GROUP BY 1, 2, 3, 4;

-- UNIQUE → permite REFRESH ... CONCURRENTLY (sin bloquear lecturas durante la carga).
CREATE UNIQUE INDEX IF NOT EXISTS mv_sellin_global_sku_canal_anio_pk
  ON public.mv_sellin_global_sku_canal_anio (anio, sku, canal, es_clave);

-- La app siempre filtra por año.
CREATE INDEX IF NOT EXISTS mv_sellin_global_sku_canal_anio_anio_idx
  ON public.mv_sellin_global_sku_canal_anio (anio);

-- Las MV no se exponen por PostgREST: se publica una vista encima (igual que
-- v_erp_medidas_cliente_mes sobre mv_erp_medidas_cliente_mes).
CREATE OR REPLACE VIEW public.v_sellin_global_sku_canal_anio AS
  SELECT sku, canal, es_clave, anio, piezas, monto
  FROM public.mv_sellin_global_sku_canal_anio;

GRANT SELECT ON public.v_sellin_global_sku_canal_anio TO anon, authenticated, service_role;

ANALYZE public.mv_sellin_global_sku_canal_anio;

-- Refresco: se engancha a refresh_facturacion_clientes() (la llama import-central
-- con finalize:'refresh_facturacion_clientes' y el puente de la Mac mini).
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

  RETURN QUERY SELECT f.anio, COUNT(*)::bigint, SUM(f.monto) FROM facturacion_clientes f WHERE f.anio = ANY (v_anios) GROUP BY f.anio ORDER BY f.anio;
END $function$;
