-- 20260911 · Pestaña Inicio (dirección general): medidas del director por CANAL y mes.
--
-- Por qué una MV nueva: el panel "Canales · periodo vs cuota" de Inicio necesita
-- Fact Neta / Contribución / MC por canal. Agregar v_erp_medidas (grano SKU, en
-- vivo sobre erp_ventas, 176K filas + policies) por canal tarda 1.4 s como
-- authenticated y el rol anon (statement_timeout 3 s) la cancela. La MV
-- existente mv_erp_medidas_cliente_mes no tiene canal, así que se materializa
-- un grano hermano (anio, mes, canal): ~200 filas, <5 ms.
--
-- Misma definición de medidas que mv_erp_medidas_cliente_mes (migración
-- 20260909_facturacion_desde_erp.sql). `canal` sale renglón a renglón de
-- erp_ventas.canal (no del modo por cliente que usa facturacion_clientes.canal),
-- por eso puede diferir ligeramente de v_vision_factura_canal.
--
-- Se refresca junto con la MV de clientes: refresh_facturacion_clientes() y
-- refresh_mv_erp_medidas() quedan redefinidas abajo.

DROP VIEW IF EXISTS public.v_erp_medidas_canal_mes;
DROP MATERIALIZED VIEW IF EXISTS public.mv_erp_medidas_canal_mes;
CREATE MATERIALIZED VIEW public.mv_erp_medidas_canal_mes AS
SELECT s.*,
  (fact_bruta + devoluciones)                                                                 AS fact_neta,
  (fact_bruta + devoluciones + rmas + bonificaciones)                                         AS venta_neta,
  (costo_fact_bruta + costo_devoluciones)                                                     AS costo_fact_neta,
  (costo_fact_bruta + costo_devoluciones + costo_rmas)                                        AS costo_venta_neta,
  (fact_bruta + devoluciones) - (costo_fact_bruta + costo_devoluciones)                       AS contribucion,
  (fact_bruta - costo_fact_bruta)                                                             AS contribucion_bruta,
  (fact_bruta + devoluciones + rmas + bonificaciones) - (costo_fact_bruta + costo_devoluciones + costo_rmas) AS utilidad_comercial
FROM (
  SELECT anio, mes, COALESCE(NULLIF(trim(canal), ''), 'otros') AS canal,
    SUM(CASE WHEN movimiento_venta IN ('Factura','Factura Com.Ext33') THEN COALESCE(monto_venta_pesos,0) ELSE 0 END)                                          AS fact_bruta,
    SUM(CASE WHEN movimiento_venta = 'Devolucion Venta' AND COALESCE(instruccion,'') NOT ILIKE 'nota credito' THEN COALESCE(monto_venta_pesos,0) ELSE 0 END) AS devoluciones,
    SUM(CASE WHEN movimiento_venta = 'Devolucion Venta' AND instruccion ILIKE 'nota credito' THEN COALESCE(monto_venta_pesos,0) ELSE 0 END)                  AS rmas,
    SUM(CASE WHEN movimiento_venta = 'Bonificacion Venta' THEN COALESCE(monto_venta_pesos,0) ELSE 0 END)                                                      AS bonificaciones,
    SUM(CASE WHEN movimiento_venta = 'Factura' THEN COALESCE(costo_venta_pesos,0) ELSE 0 END)                                                                 AS costo_fact_bruta,
    SUM(CASE WHEN movimiento_venta = 'Devolucion Venta' AND COALESCE(instruccion,'') NOT ILIKE 'nota credito' THEN COALESCE(costo_venta_pesos,0) ELSE 0 END) AS costo_devoluciones,
    SUM(CASE WHEN movimiento_venta = 'Devolucion Venta' AND instruccion ILIKE 'nota credito' THEN COALESCE(costo_venta_pesos,0) ELSE 0 END)                  AS costo_rmas,
    SUM(COALESCE(unidades, 0))                                                                                                                    AS piezas_venta_neta,
    COUNT(*)::int                                                                                                                                 AS renglones
  FROM public.erp_ventas
  WHERE anio IS NOT NULL AND mes IS NOT NULL
  GROUP BY anio, mes, COALESCE(NULLIF(trim(canal), ''), 'otros')
) s;
CREATE UNIQUE INDEX mv_erp_medidas_canal_mes_pk ON public.mv_erp_medidas_canal_mes (anio, mes, canal);
GRANT SELECT ON public.mv_erp_medidas_canal_mes TO authenticated, anon, service_role;

-- Vista de consumo (PostgREST) con los % ya calculados por fila. Los % nunca se
-- suman: al agregar varios meses se recalculan desde contribucion / fact_neta.
CREATE VIEW public.v_erp_medidas_canal_mes AS
SELECT m.*,
  CASE WHEN fact_neta  <> 0 THEN contribucion / fact_neta END        AS pct_mc,
  CASE WHEN venta_neta <> 0 THEN utilidad_comercial / venta_neta END AS pct_muc
FROM public.mv_erp_medidas_canal_mes m;
GRANT SELECT ON public.v_erp_medidas_canal_mes TO authenticated, anon, service_role;

-- Refresco: ambas MVs juntas.
CREATE OR REPLACE FUNCTION public.refresh_mv_erp_medidas()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_erp_medidas_cliente_mes;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_erp_medidas_canal_mes;
$$;
REVOKE ALL ON FUNCTION public.refresh_mv_erp_medidas() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_mv_erp_medidas() TO service_role;

-- refresh_facturacion_clientes(): idéntica a 20260909_facturacion_desde_erp.sql,
-- sólo se añade el REFRESH de mv_erp_medidas_canal_mes al final.
CREATE OR REPLACE FUNCTION public.refresh_facturacion_clientes(p_anios integer[] DEFAULT NULL)
RETURNS TABLE(anio integer, filas bigint, monto numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public SET statement_timeout = '300s' AS $$
DECLARE v_anios integer[];
BEGIN
  v_anios := COALESCE(p_anios, (SELECT array_agg(DISTINCT e.anio) FROM erp_ventas e WHERE e.anio IS NOT NULL));
  IF v_anios IS NULL OR array_length(v_anios, 1) IS NULL THEN RETURN; END IF;

  DELETE FROM facturacion_clientes f WHERE f.anio = ANY (v_anios);

  INSERT INTO facturacion_clientes (cliente_nombre, cliente_key, sku, anio, mes, piezas, monto, canal, uploaded_at)
  WITH canal_cli AS (
    SELECT e.cliente_nombre, e.anio, mode() WITHIN GROUP (ORDER BY e.canal) AS canal
    FROM erp_ventas e WHERE e.anio = ANY (v_anios)
    GROUP BY e.cliente_nombre, e.anio
  )
  SELECT e.cliente_nombre,
         CASE
           WHEN upper(e.cliente_nombre) LIKE '%CAJADL01%' OR upper(e.cliente_nombre) LIKE '%API GLOBAL%' THEN 'digitalife'
           WHEN upper(e.cliente_nombre) LIKE '%PC ONLINE%' THEN 'pcel'
           WHEN upper(e.cliente_nombre) LIKE '%DICOTECH%'  THEN 'dicotech'
           ELSE COALESCE(NULLIF(trim(BOTH '_' FROM regexp_replace(lower(c.canal), '[^a-z0-9]+', '_', 'g')), ''), 'otros')
         END AS cliente_key,
         e.articulo AS sku, e.anio, e.mes,
         SUM(CASE WHEN e.movimiento_venta IN ('Factura','Factura Com.Ext33','Devolucion Venta') THEN COALESCE(e.unidades, 0) ELSE 0 END) AS piezas,
         SUM(CASE WHEN e.movimiento_venta IN ('Factura','Factura Com.Ext33')
                    OR (e.movimiento_venta = 'Devolucion Venta' AND COALESCE(e.instruccion, '') NOT ILIKE 'nota credito')
                  THEN COALESCE(e.monto_venta_pesos, 0) ELSE 0 END) AS monto,
         c.canal, now()
  FROM erp_ventas e
  JOIN canal_cli c ON c.cliente_nombre = e.cliente_nombre AND c.anio = e.anio
  WHERE e.anio = ANY (v_anios) AND e.articulo IS NOT NULL AND e.cliente_nombre IS NOT NULL AND e.mes IS NOT NULL
  GROUP BY e.cliente_nombre, e.articulo, e.anio, e.mes, c.canal;

  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_erp_medidas_cliente_mes;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_erp_medidas_canal_mes;

  RETURN QUERY SELECT f.anio, COUNT(*)::bigint, SUM(f.monto) FROM facturacion_clientes f WHERE f.anio = ANY (v_anios) GROUP BY f.anio ORDER BY f.anio;
END $$;
