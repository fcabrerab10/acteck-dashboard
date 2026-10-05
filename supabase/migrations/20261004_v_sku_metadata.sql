-- 2026-10-04 · v_sku_metadata (S&OP) había desaparecido de la base: la definición original (20260424_forecast_sprint2.sql)
-- leía precios_sku.precio_aaa / precio_descuento, columnas que ya no existen (precios_sku es por lista desde 2026-09).
-- El S&OP web la pide en su carga (useForecastData) y, sin ella, fetchAll aborta y la pestaña no carga.
-- Misma forma que antes, sin las dos columnas de precio (nadie las lee en el código).
CREATE OR REPLACE VIEW public.v_sku_metadata AS
WITH embarques_recientes AS (
  SELECT DISTINCT ON (codigo)
    codigo AS sku, descripcion, supplier, familia, unit_price, fecha_emision
  FROM public.embarques_compras
  WHERE codigo IS NOT NULL AND codigo <> ''
  ORDER BY codigo, fecha_emision DESC NULLS LAST
),
inv_costo AS (
  SELECT articulo AS sku, AVG(costopromedio) AS costo_promedio_mxn
  FROM public.inventario_acteck
  WHERE articulo IS NOT NULL AND articulo <> '__TEST__' AND costopromedio > 0
  GROUP BY articulo
)
SELECT
  COALESCE(e.sku, ic.sku)  AS sku,
  e.descripcion,
  e.supplier,
  e.familia,
  e.unit_price             AS unit_price_usd_ultima,
  NULL::numeric            AS precio_aaa_mxn,
  NULL::numeric            AS precio_descuento_mxn,
  ic.costo_promedio_mxn
FROM embarques_recientes e
FULL OUTER JOIN inv_costo ic ON ic.sku = e.sku;
COMMENT ON VIEW public.v_sku_metadata IS 'Master consolidado por SKU: descripción, supplier y precio USD del último embarque, familia y costo promedio de inventario (sin precios de lista desde 2026-10-04).';
GRANT SELECT ON public.v_sku_metadata TO anon, authenticated;
