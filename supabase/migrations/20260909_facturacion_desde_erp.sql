-- Fase 3 (2026-09-09) · facturacion_clientes se alimenta desde erp_ventas con la
-- definición OFICIAL del director (validada por Fernando):
--   monto  = Fact Neta = Factura + Factura Com.Ext33 + Devolucion Venta (Instruccion <> Nota crédito)
--   piezas = Unidades de Factura + Factura Com.Ext33 + Devolucion Venta (todas; las
--            bonificaciones no son piezas físicas)
-- Antes venía del pivot "Venta Facturación" del Excel, que restaba también los RMA's
-- (Nota crédito) y quedaba ~0.5-1 % por debajo. La tabla conserva su esquema, así que
-- las 11 vistas y ~30 pantallas que la leen cuadran solas.
-- canal / cliente_key: un cliente puede tener 2 canales en el ERP (INGRAM MICRO):
-- se toma el canal más frecuente del cliente en el año para respetar la llave única
-- (cliente_nombre, sku, anio, mes). cliente_key sigue la regla de uploads.html.

CREATE OR REPLACE FUNCTION public.refresh_facturacion_clientes(p_anios integer[] DEFAULT NULL)
RETURNS TABLE (anio integer, filas bigint, monto numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_anios integer[];
BEGIN
  v_anios := COALESCE(p_anios, (SELECT array_agg(DISTINCT e.anio) FROM erp_ventas e WHERE e.anio IS NOT NULL));
  IF v_anios IS NULL OR array_length(v_anios, 1) IS NULL THEN RETURN; END IF;

  DELETE FROM facturacion_clientes f WHERE f.anio = ANY (v_anios);

  INSERT INTO facturacion_clientes (cliente_nombre, cliente_key, sku, anio, mes, piezas, monto, canal, uploaded_at)
  WITH canal_cli AS (
    SELECT e.cliente_nombre, e.anio,
           mode() WITHIN GROUP (ORDER BY e.canal) AS canal
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

  RETURN QUERY SELECT f.anio, COUNT(*)::bigint, SUM(f.monto) FROM facturacion_clientes f WHERE f.anio = ANY (v_anios) GROUP BY f.anio ORDER BY f.anio;
END $$;

REVOKE ALL ON FUNCTION public.refresh_facturacion_clientes(integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_facturacion_clientes(integer[]) TO service_role;
NOTIFY pgrst, 'reload schema';

-- ── Materialización (2026-09-09, mismo día) ────────────────────────────────
-- Las vistas mensuales en vivo tardaban 1.3-3 s (176K filas + policies por fila) y
-- el rol anon (statement_timeout 3 s) las cancelaba. Como erp_ventas sólo cambia
-- en cada carga del ERP, se materializa el grano (anio, mes, cliente_key) y las
-- dos vistas mensuales se sirven desde ahí (<10 ms). v_erp_medidas (grano SKU)
-- sigue en vivo para drill-downs. Se refresca dentro de refresh_facturacion_clientes().
DROP VIEW IF EXISTS public.v_erp_medidas_mes;
DROP VIEW IF EXISTS public.v_erp_medidas_cliente_mes;
DROP MATERIALIZED VIEW IF EXISTS public.mv_erp_medidas_cliente_mes;
CREATE MATERIALIZED VIEW public.mv_erp_medidas_cliente_mes AS
SELECT s.*,
  (fact_bruta + devoluciones)                                                                 AS fact_neta,
  (fact_bruta + devoluciones + rmas + bonificaciones)                                         AS venta_neta,
  (costo_fact_bruta + costo_devoluciones)                                                     AS costo_fact_neta,
  (costo_fact_bruta + costo_devoluciones + costo_rmas)                                        AS costo_venta_neta,
  (fact_bruta + devoluciones) - (costo_fact_bruta + costo_devoluciones)                       AS contribucion,
  (fact_bruta - costo_fact_bruta)                                                             AS contribucion_bruta,
  (fact_bruta + devoluciones + rmas + bonificaciones) - (costo_fact_bruta + costo_devoluciones + costo_rmas) AS utilidad_comercial
FROM (
  SELECT anio, mes, cliente_key,
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
  GROUP BY anio, mes, cliente_key
) s;
CREATE UNIQUE INDEX mv_erp_medidas_cliente_mes_pk ON public.mv_erp_medidas_cliente_mes (anio, mes, cliente_key);
GRANT SELECT ON public.mv_erp_medidas_cliente_mes TO authenticated, anon, service_role;

CREATE VIEW public.v_erp_medidas_cliente_mes AS SELECT * FROM public.mv_erp_medidas_cliente_mes;

CREATE VIEW public.v_erp_medidas_mes AS
WITH m AS (
  SELECT anio, mes,
    SUM(fact_bruta) fact_bruta, SUM(devoluciones) devoluciones, SUM(rmas) rmas, SUM(bonificaciones) bonificaciones,
    SUM(fact_neta) fact_neta, SUM(venta_neta) venta_neta,
    SUM(costo_fact_bruta) costo_fact_bruta, SUM(costo_devoluciones) costo_devoluciones, SUM(costo_rmas) costo_rmas,
    SUM(costo_fact_neta) costo_fact_neta, SUM(costo_venta_neta) costo_venta_neta,
    SUM(contribucion) contribucion, SUM(contribucion_bruta) contribucion_bruta, SUM(utilidad_comercial) utilidad_comercial,
    SUM(piezas_venta_neta) piezas_venta_neta, SUM(renglones) renglones
  FROM public.mv_erp_medidas_cliente_mes GROUP BY anio, mes
)
SELECT m.*,
  SUM(costo_venta_neta) OVER (ORDER BY anio, mes ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING) AS cv_ultimos_3_meses,
  SUM(costo_venta_neta) OVER (PARTITION BY anio ORDER BY mes)                              AS ytd_costo_venta,
  CASE WHEN piezas_venta_neta <> 0 THEN venta_neta / piezas_venta_neta END                 AS ticket_promedio,
  CASE WHEN piezas_venta_neta <> 0 THEN utilidad_comercial / piezas_venta_neta END         AS utilidad_promedio,
  CASE WHEN fact_neta  <> 0 THEN contribucion / fact_neta END                              AS pct_mc,
  CASE WHEN fact_bruta <> 0 THEN contribucion_bruta / fact_bruta END                       AS pct_mc_bruta,
  CASE WHEN venta_neta <> 0 THEN utilidad_comercial / venta_neta END                       AS pct_muc,
  CASE WHEN fact_neta  <> 0 THEN bonificaciones / fact_neta END                            AS pct_lost_profit_bonif,
  CASE WHEN fact_bruta <> 0 THEN (devoluciones - costo_devoluciones) / fact_bruta END      AS pct_lost_profit_dev,
  CASE WHEN fact_neta  <> 0 THEN (rmas - costo_rmas) / fact_neta END                       AS pct_lost_profit_rma
FROM m;
GRANT SELECT ON public.v_erp_medidas_cliente_mes, public.v_erp_medidas_mes TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION public.refresh_mv_erp_medidas()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_erp_medidas_cliente_mes;
$$;
REVOKE ALL ON FUNCTION public.refresh_mv_erp_medidas() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_mv_erp_medidas() TO service_role;

-- refresh_facturacion_clientes() también refresca la MV al final.
CREATE OR REPLACE FUNCTION public.refresh_facturacion_clientes(p_anios integer[] DEFAULT NULL)
RETURNS TABLE (anio integer, filas bigint, monto numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  RETURN QUERY SELECT f.anio, COUNT(*)::bigint, SUM(f.monto) FROM facturacion_clientes f WHERE f.anio = ANY (v_anios) GROUP BY f.anio ORDER BY f.anio;
END $$;
NOTIFY pgrst, 'reload schema';
