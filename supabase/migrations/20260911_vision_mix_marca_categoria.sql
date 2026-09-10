-- 2026-09-11 · Visión General: "Ver mix por" Canal · Marca · Categoría.
--
-- Fuente única del mix por dimensión: erp_ventas renglón a renglón con la regla oficial
-- de Fact Neta (Factura + Factura Com.Ext33 + Devolución Venta sin nota de crédito) y el
-- costo de la contribución como v_erp_medidas (costo de Factura + costo de devoluciones
-- sin NC). `canal` y `marca` salen del renglón; `categoria` usa erp_ventas.categoria y cae
-- a roadmap_sku.categoria sólo si viene vacía (2025: 4 renglones vacíos; 2026: 0). Todo en
-- MAYÚSCULAS: el ERP mezcla 'Componentes'/'COMPONENTES' y 'Acteck'/'ACTECK'.
--
-- Por qué materializadas: la vista en vivo sobre erp_ventas (176K filas × 3 dimensiones)
-- tarda 4.2 s para un solo año como postgres; como authenticated (RLS) peor. Las MVs
-- quedan en ~1K filas (mes) y ~10K filas (clientes) y responden en ms. Se refrescan con
-- refresh_facturacion_clientes() (puente del ERP) y refresh_mv_erp_medidas().
--
-- NOTA: 20260911_piezas_coalesce_unidades.sql redefinió refresh_facturacion_clientes()
-- sin el REFRESH de mv_erp_medidas_canal_mes (regresión respecto a
-- 20260911_v_inicio_canal_mes.sql). Aquí se restaura junto con las dos MVs nuevas.

DROP VIEW IF EXISTS public.v_vision_factura_dimension_mes;
DROP VIEW IF EXISTS public.v_vision_factura_dimension_clientes;
DROP MATERIALIZED VIEW IF EXISTS public.mv_vision_factura_dimension_mes;
DROP MATERIALIZED VIEW IF EXISTS public.mv_vision_factura_dimension_clientes;

-- ── Grano (anio, mes, dimension, valor) ─────────────────────────────────────────────
CREATE MATERIALIZED VIEW public.mv_vision_factura_dimension_mes AS
WITH base AS (
  SELECT e.anio, e.mes, e.cliente_nombre,
    COALESCE(NULLIF(upper(trim(e.canal)), ''), 'SIN CANAL')                                               AS canal,
    COALESCE(NULLIF(upper(trim(e.marca)), ''), 'SIN MARCA')                                               AS marca,
    COALESCE(NULLIF(upper(trim(e.categoria)), ''), NULLIF(upper(trim(r.categoria)), ''), 'SIN CATEGORÍA') AS categoria,
    CASE WHEN e.movimiento_venta IN ('Factura','Factura Com.Ext33')
           OR (e.movimiento_venta = 'Devolucion Venta' AND COALESCE(e.instruccion,'') NOT ILIKE 'nota credito')
         THEN COALESCE(e.monto_venta_pesos, 0) ELSE 0 END                                   AS venta,
    CASE WHEN e.movimiento_venta = 'Factura'
           OR (e.movimiento_venta = 'Devolucion Venta' AND COALESCE(e.instruccion,'') NOT ILIKE 'nota credito')
         THEN COALESCE(e.costo_venta_pesos, 0) ELSE 0 END                                   AS costo,
    CASE WHEN e.movimiento_venta IN ('Factura','Factura Com.Ext33','Devolucion Venta')
         THEN COALESCE(e.unidades, e.piezas, 0) ELSE 0 END                                  AS piezas
  FROM public.erp_ventas e
  LEFT JOIN public.roadmap_sku r ON r.sku = e.articulo
  WHERE e.anio IS NOT NULL AND e.mes BETWEEN 1 AND 12
)
SELECT b.anio, b.mes, d.dimension, d.valor,
  round(SUM(b.venta), 2)                 AS venta,
  round(SUM(b.costo), 2)                 AS costo,
  round(SUM(b.venta) - SUM(b.costo), 2)  AS contribucion,
  SUM(b.piezas)::bigint                  AS piezas,
  COUNT(DISTINCT b.cliente_nombre)::int  AS n_clientes
FROM base b
CROSS JOIN LATERAL (VALUES ('canal', b.canal), ('marca', b.marca), ('categoria', b.categoria)) AS d(dimension, valor)
GROUP BY b.anio, b.mes, d.dimension, d.valor;
CREATE UNIQUE INDEX mv_vision_factura_dimension_mes_pk ON public.mv_vision_factura_dimension_mes (anio, mes, dimension, valor);
GRANT SELECT ON public.mv_vision_factura_dimension_mes TO authenticated, anon, service_role;

CREATE VIEW public.v_vision_factura_dimension_mes AS
SELECT * FROM public.mv_vision_factura_dimension_mes;
GRANT SELECT ON public.v_vision_factura_dimension_mes TO authenticated, anon, service_role;

-- ── Grano (anio, dimension, valor, cliente) · drill de clientes que compran esa marca/categoría/canal ──
CREATE MATERIALIZED VIEW public.mv_vision_factura_dimension_clientes AS
WITH base AS (
  SELECT e.anio, e.mes, e.cliente_nombre, e.cliente_key,
    COALESCE(NULLIF(upper(trim(e.canal)), ''), 'SIN CANAL')                                               AS canal,
    COALESCE(NULLIF(upper(trim(e.marca)), ''), 'SIN MARCA')                                               AS marca,
    COALESCE(NULLIF(upper(trim(e.categoria)), ''), NULLIF(upper(trim(r.categoria)), ''), 'SIN CATEGORÍA') AS categoria,
    CASE WHEN e.movimiento_venta IN ('Factura','Factura Com.Ext33')
           OR (e.movimiento_venta = 'Devolucion Venta' AND COALESCE(e.instruccion,'') NOT ILIKE 'nota credito')
         THEN COALESCE(e.monto_venta_pesos, 0) ELSE 0 END                                   AS venta,
    CASE WHEN e.movimiento_venta = 'Factura'
           OR (e.movimiento_venta = 'Devolucion Venta' AND COALESCE(e.instruccion,'') NOT ILIKE 'nota credito')
         THEN COALESCE(e.costo_venta_pesos, 0) ELSE 0 END                                   AS costo,
    CASE WHEN e.movimiento_venta IN ('Factura','Factura Com.Ext33','Devolucion Venta')
         THEN COALESCE(e.unidades, e.piezas, 0) ELSE 0 END                                  AS piezas
  FROM public.erp_ventas e
  LEFT JOIN public.roadmap_sku r ON r.sku = e.articulo
  WHERE e.anio IS NOT NULL AND e.mes BETWEEN 1 AND 12 AND e.cliente_nombre IS NOT NULL
)
SELECT b.anio, d.dimension, d.valor, b.cliente_nombre, MIN(b.cliente_key) AS cliente_key,
  round(SUM(b.venta), 2)                 AS venta,
  round(SUM(b.venta) - SUM(b.costo), 2)  AS contribucion,
  SUM(b.piezas)::bigint                  AS piezas,
  COUNT(DISTINCT b.mes)::int             AS meses_activos
FROM base b
CROSS JOIN LATERAL (VALUES ('canal', b.canal), ('marca', b.marca), ('categoria', b.categoria)) AS d(dimension, valor)
GROUP BY b.anio, d.dimension, d.valor, b.cliente_nombre;
CREATE UNIQUE INDEX mv_vision_factura_dimension_clientes_pk ON public.mv_vision_factura_dimension_clientes (anio, dimension, valor, cliente_nombre);
GRANT SELECT ON public.mv_vision_factura_dimension_clientes TO authenticated, anon, service_role;

CREATE VIEW public.v_vision_factura_dimension_clientes AS
SELECT * FROM public.mv_vision_factura_dimension_clientes;
GRANT SELECT ON public.v_vision_factura_dimension_clientes TO authenticated, anon, service_role;

-- ── Refrescos ───────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_mv_erp_medidas()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_erp_medidas_cliente_mes;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_erp_medidas_canal_mes;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_vision_factura_dimension_mes;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_vision_factura_dimension_clientes;
$$;
REVOKE ALL ON FUNCTION public.refresh_mv_erp_medidas() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_mv_erp_medidas() TO service_role;

-- refresh_facturacion_clientes(): cuerpo de 20260911_piezas_coalesce_unidades.sql
-- (COALESCE(unidades, piezas, 0)) + REFRESH de las 4 MVs.
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

  RETURN QUERY SELECT f.anio, COUNT(*)::bigint, SUM(f.monto) FROM facturacion_clientes f WHERE f.anio = ANY (v_anios) GROUP BY f.anio ORDER BY f.anio;
END $$;
