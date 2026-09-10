-- 2026-09-11 · Análisis por Cliente (web) · grano cliente (código ERP) × mes.
-- La pantalla necesita todas las medidas del director por cliente y mes (fact bruta,
-- devoluciones, notas de crédito/RMA, bonificaciones, fact neta, venta neta, costos,
-- contribución, piezas) y el NÚMERO de cliente del ERP (`erp_ventas.cliente`), que ninguna
-- MV anterior conserva (mv_erp_medidas_cliente_mes agrupa por cliente_key y colapsa
-- e-commerce/mostrador). Como erp_ventas sólo cambia con cada carga del ERP, se
-- materializa y se refresca en refresh_facturacion_clientes() (junto a las otras 4 MVs).
--
-- Reglas:
--   · grano (anio, mes, cliente). `cliente` = código del ERP; si viene NULL se usa el nombre.
--   · cliente_nombre, cliente_key y canal = el más frecuente (mode) del cliente en el año
--     (un cliente con dos canales toma el más frecuente, igual que el puente de
--     facturacion_clientes).
--   · medidas idénticas a v_erp_medidas (COALESCE(unidades, piezas, 0) para piezas).

DROP VIEW IF EXISTS public.v_analisis_cliente_mes;
DROP MATERIALIZED VIEW IF EXISTS public.mv_analisis_cliente_mes;

CREATE MATERIALIZED VIEW public.mv_analisis_cliente_mes AS
WITH dim AS (
  SELECT e.anio, COALESCE(e.cliente, e.cliente_nombre) AS cliente,
         mode() WITHIN GROUP (ORDER BY e.cliente_nombre) AS cliente_nombre,
         mode() WITHIN GROUP (ORDER BY e.cliente_key)    AS cliente_key,
         mode() WITHIN GROUP (ORDER BY e.canal)          AS canal
  FROM public.erp_ventas e
  WHERE e.anio IS NOT NULL AND COALESCE(e.cliente, e.cliente_nombre) IS NOT NULL
  GROUP BY e.anio, COALESCE(e.cliente, e.cliente_nombre)
), s AS (
  SELECT e.anio, e.mes, COALESCE(e.cliente, e.cliente_nombre) AS cliente,
    SUM(CASE WHEN movimiento_venta IN ('Factura','Factura Com.Ext33') THEN COALESCE(monto_venta_pesos,0) ELSE 0 END)                                          AS fact_bruta,
    SUM(CASE WHEN movimiento_venta = 'Devolucion Venta' AND COALESCE(instruccion,'') NOT ILIKE 'nota credito' THEN COALESCE(monto_venta_pesos,0) ELSE 0 END) AS devoluciones,
    SUM(CASE WHEN movimiento_venta = 'Devolucion Venta' AND instruccion ILIKE 'nota credito' THEN COALESCE(monto_venta_pesos,0) ELSE 0 END)                  AS rmas,
    SUM(CASE WHEN movimiento_venta = 'Bonificacion Venta' THEN COALESCE(monto_venta_pesos,0) ELSE 0 END)                                                      AS bonificaciones,
    SUM(CASE WHEN movimiento_venta = 'Factura' THEN COALESCE(costo_venta_pesos,0) ELSE 0 END)                                                                 AS costo_fact_bruta,
    SUM(CASE WHEN movimiento_venta = 'Devolucion Venta' AND COALESCE(instruccion,'') NOT ILIKE 'nota credito' THEN COALESCE(costo_venta_pesos,0) ELSE 0 END) AS costo_devoluciones,
    SUM(CASE WHEN movimiento_venta = 'Devolucion Venta' AND instruccion ILIKE 'nota credito' THEN COALESCE(costo_venta_pesos,0) ELSE 0 END)                  AS costo_rmas,
    SUM(COALESCE(unidades, piezas, 0))                                                                                                                    AS piezas_venta_neta,
    COUNT(*)::int                                                                                                                                 AS renglones
  FROM public.erp_ventas e
  WHERE e.anio IS NOT NULL AND e.mes IS NOT NULL AND COALESCE(e.cliente, e.cliente_nombre) IS NOT NULL
  GROUP BY e.anio, e.mes, COALESCE(e.cliente, e.cliente_nombre)
)
SELECT s.anio, s.mes, s.cliente, d.cliente_nombre, d.cliente_key, d.canal,
  s.fact_bruta, s.devoluciones, s.rmas, s.bonificaciones,
  s.costo_fact_bruta, s.costo_devoluciones, s.costo_rmas, s.piezas_venta_neta, s.renglones,
  (s.fact_bruta + s.devoluciones)                                                                     AS fact_neta,
  (s.fact_bruta + s.devoluciones + s.rmas + s.bonificaciones)                                         AS venta_neta,
  (s.costo_fact_bruta + s.costo_devoluciones)                                                         AS costo_fact_neta,
  (s.costo_fact_bruta + s.costo_devoluciones + s.costo_rmas)                                          AS costo_venta_neta,
  (s.fact_bruta + s.devoluciones) - (s.costo_fact_bruta + s.costo_devoluciones)                       AS contribucion,
  (s.fact_bruta - s.costo_fact_bruta)                                                                 AS contribucion_bruta,
  (s.fact_bruta + s.devoluciones + s.rmas + s.bonificaciones) - (s.costo_fact_bruta + s.costo_devoluciones + s.costo_rmas) AS utilidad_comercial
FROM s JOIN dim d ON d.anio = s.anio AND d.cliente = s.cliente;

CREATE UNIQUE INDEX mv_analisis_cliente_mes_pk ON public.mv_analisis_cliente_mes (anio, mes, cliente);
CREATE INDEX mv_analisis_cliente_mes_anio ON public.mv_analisis_cliente_mes (anio);
GRANT SELECT ON public.mv_analisis_cliente_mes TO authenticated, anon, service_role;

-- Vista de consumo (la app lee ésta): añade los % que se calculan al agregar.
CREATE VIEW public.v_analisis_cliente_mes AS
SELECT m.*,
  CASE WHEN fact_neta  <> 0 THEN contribucion / fact_neta END                     AS pct_mc,
  CASE WHEN venta_neta <> 0 THEN utilidad_comercial / venta_neta END              AS pct_muc,
  CASE WHEN fact_bruta <> 0 THEN (devoluciones + rmas + bonificaciones) / fact_bruta END AS pct_ajustes
FROM public.mv_analisis_cliente_mes m;
GRANT SELECT ON public.v_analisis_cliente_mes TO authenticated, anon, service_role;

-- ── Grano cliente × SKU × mes (drill-down y movers del comparador) ─────────────
-- v_erp_medidas en vivo filtrada por un cliente tarda 8 s como authenticated (las
-- policies de erp_ventas se evalúan por renglón: 30K filas para CT). Se materializa
-- el grano SKU por cliente (~80K filas) y el drill lee de aquí (<20 ms).
DROP MATERIALIZED VIEW IF EXISTS public.mv_analisis_cliente_sku_mes;
CREATE MATERIALIZED VIEW public.mv_analisis_cliente_sku_mes AS
SELECT e.anio, e.mes, COALESCE(e.cliente, e.cliente_nombre) AS cliente,
  COALESCE(e.articulo, '—') AS articulo,
  mode() WITHIN GROUP (ORDER BY e.marca) AS marca,
  mode() WITHIN GROUP (ORDER BY e.categoria) AS categoria,
  SUM(CASE WHEN movimiento_venta IN ('Factura','Factura Com.Ext33') THEN COALESCE(monto_venta_pesos,0) ELSE 0 END)
    + SUM(CASE WHEN movimiento_venta = 'Devolucion Venta' AND COALESCE(instruccion,'') NOT ILIKE 'nota credito' THEN COALESCE(monto_venta_pesos,0) ELSE 0 END) AS fact_neta,
  SUM(CASE WHEN movimiento_venta IN ('Factura','Factura Com.Ext33') THEN COALESCE(monto_venta_pesos,0) ELSE 0 END)
    + SUM(CASE WHEN movimiento_venta = 'Devolucion Venta' AND COALESCE(instruccion,'') NOT ILIKE 'nota credito' THEN COALESCE(monto_venta_pesos,0) ELSE 0 END)
    - SUM(CASE WHEN movimiento_venta = 'Factura' THEN COALESCE(costo_venta_pesos,0) ELSE 0 END)
    - SUM(CASE WHEN movimiento_venta = 'Devolucion Venta' AND COALESCE(instruccion,'') NOT ILIKE 'nota credito' THEN COALESCE(costo_venta_pesos,0) ELSE 0 END) AS contribucion,
  SUM(COALESCE(unidades, piezas, 0)) AS piezas_venta_neta
FROM public.erp_ventas e
WHERE e.anio IS NOT NULL AND e.mes IS NOT NULL AND COALESCE(e.cliente, e.cliente_nombre) IS NOT NULL
GROUP BY e.anio, e.mes, COALESCE(e.cliente, e.cliente_nombre), COALESCE(e.articulo, '—');
CREATE UNIQUE INDEX mv_analisis_cliente_sku_mes_pk ON public.mv_analisis_cliente_sku_mes (anio, mes, cliente, articulo);
CREATE INDEX mv_analisis_cliente_sku_mes_cliente ON public.mv_analisis_cliente_sku_mes (cliente, anio);
GRANT SELECT ON public.mv_analisis_cliente_sku_mes TO authenticated, anon, service_role;

-- refresh_mv_erp_medidas(): las 4 MVs previas + las 2 nuevas.
CREATE OR REPLACE FUNCTION public.refresh_mv_erp_medidas()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_erp_medidas_cliente_mes;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_erp_medidas_canal_mes;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_vision_factura_dimension_mes;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_vision_factura_dimension_clientes;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_analisis_cliente_mes;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_analisis_cliente_sku_mes;
$$;
REVOKE ALL ON FUNCTION public.refresh_mv_erp_medidas() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_mv_erp_medidas() TO service_role;

-- refresh_facturacion_clientes(): cuerpo de 20260911_vision_mix_marca_categoria.sql
-- + REFRESH de mv_analisis_cliente_mes y mv_analisis_cliente_sku_mes al final.
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
         SUM(CASE WHEN e.movimiento_venta IN ('Factura','Factura Com.Ext33','Devolucion Venta') THEN COALESCE(e.unidades, e.piezas, 0) ELSE 0 END) AS piezas,
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
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_vision_factura_dimension_mes;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_vision_factura_dimension_clientes;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_analisis_cliente_mes;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_analisis_cliente_sku_mes;

  RETURN QUERY SELECT f.anio, COUNT(*)::bigint, SUM(f.monto) FROM facturacion_clientes f WHERE f.anio = ANY (v_anios) GROUP BY f.anio ORDER BY f.anio;
END $$;
