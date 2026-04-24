-- Forecast Clientes Sprint 2 — vistas y funciones auxiliares
-- Fecha: 2026-04-24

-- Vista: Lead time promedio por SKU (solo embarques CONCLUIDOS con fechas válidas)
CREATE OR REPLACE VIEW public.v_lead_time_sku AS
SELECT
  codigo                                                  AS sku,
  ROUND(AVG((arribo_cedis - fecha_emision)::NUMERIC), 1)  AS dias_promedio,
  ROUND(MIN((arribo_cedis - fecha_emision)::NUMERIC), 1)  AS dias_min,
  ROUND(MAX((arribo_cedis - fecha_emision)::NUMERIC), 1)  AS dias_max,
  COUNT(*)::INTEGER                                       AS muestras,
  MAX(supplier)                                           AS supplier_principal,
  MAX(familia)                                            AS familia
FROM public.embarques_compras
WHERE estatus = 'CONCLUIDO'
  AND arribo_cedis IS NOT NULL
  AND fecha_emision IS NOT NULL
  AND arribo_cedis > fecha_emision
  AND codigo IS NOT NULL
  AND codigo <> ''
GROUP BY codigo;

COMMENT ON VIEW public.v_lead_time_sku IS
  'Lead time (días de fecha_emisión a arribo_cedis) promedio por SKU de los embarques concluidos. Usar como referencia de planeación.';

-- Vista: Lead time por proveedor (fallback cuando un SKU no tiene historial)
CREATE OR REPLACE VIEW public.v_lead_time_supplier AS
SELECT
  supplier,
  ROUND(AVG((arribo_cedis - fecha_emision)::NUMERIC), 1)  AS dias_promedio,
  COUNT(*)::INTEGER                                       AS muestras
FROM public.embarques_compras
WHERE estatus = 'CONCLUIDO'
  AND arribo_cedis IS NOT NULL
  AND fecha_emision IS NOT NULL
  AND arribo_cedis > fecha_emision
  AND supplier IS NOT NULL
  AND supplier <> ''
GROUP BY supplier;

-- Vista: Metadata de SKU consolidada (descripción, supplier más reciente, familia, costo)
CREATE OR REPLACE VIEW public.v_sku_metadata AS
WITH embarques_recientes AS (
  SELECT DISTINCT ON (codigo)
    codigo AS sku,
    descripcion,
    supplier,
    familia,
    unit_price,
    fecha_emision
  FROM public.embarques_compras
  WHERE codigo IS NOT NULL AND codigo <> ''
  ORDER BY codigo, fecha_emision DESC NULLS LAST
),
precios AS (
  SELECT sku, precio_aaa, precio_descuento FROM public.precios_sku
),
inv_costo AS (
  SELECT articulo AS sku, AVG(costopromedio) AS costo_promedio_mxn
  FROM public.inventario_acteck
  WHERE articulo IS NOT NULL AND articulo <> '__TEST__' AND costopromedio > 0
  GROUP BY articulo
)
SELECT
  COALESCE(e.sku, p.sku, ic.sku)   AS sku,
  e.descripcion,
  e.supplier,
  e.familia,
  e.unit_price                     AS unit_price_usd_ultima,
  p.precio_aaa                     AS precio_aaa_mxn,
  p.precio_descuento               AS precio_descuento_mxn,
  ic.costo_promedio_mxn
FROM embarques_recientes e
FULL OUTER JOIN precios p   ON p.sku  = e.sku
FULL OUTER JOIN inv_costo ic ON ic.sku = COALESCE(e.sku, p.sku);

COMMENT ON VIEW public.v_sku_metadata IS
  'Master consolidado por SKU: descripción, supplier del último embarque, familia, precios y costo promedio de inventario.';

-- Vista: Demanda por cliente/SKU/mes (unifica sellout_sku y sell_in_sku).
-- Convención: se prefiere sellout_sku cuando existe; si el SKU no tiene sellout para ese
-- cliente/periodo, se usa sell_in_sku como fallback. Esto refleja cómo cada cliente
-- realmente consume inventario.
CREATE OR REPLACE VIEW public.v_demanda_sku AS
WITH so AS (
  SELECT cliente, sku, anio, mes,
         SUM(piezas)::NUMERIC       AS piezas,
         SUM(monto_pesos)::NUMERIC  AS monto_pesos
  FROM public.sellout_sku
  WHERE sku IS NOT NULL AND piezas IS NOT NULL
  GROUP BY cliente, sku, anio, mes
),
si AS (
  SELECT cliente, sku, anio, mes,
         SUM(piezas)::NUMERIC       AS piezas,
         SUM(monto_pesos)::NUMERIC  AS monto_pesos
  FROM public.sell_in_sku
  WHERE sku IS NOT NULL AND piezas IS NOT NULL
  GROUP BY cliente, sku, anio, mes
)
SELECT
  COALESCE(so.cliente, si.cliente)  AS cliente,
  COALESCE(so.sku,     si.sku)      AS sku,
  COALESCE(so.anio,    si.anio)     AS anio,
  COALESCE(so.mes,     si.mes)      AS mes,
  COALESCE(so.piezas,      si.piezas,      0)      AS piezas,
  COALESCE(so.monto_pesos, si.monto_pesos, 0)      AS monto_pesos,
  CASE WHEN so.sku IS NOT NULL THEN 'sellout' ELSE 'sell_in' END AS fuente
FROM so
FULL OUTER JOIN si
  ON si.cliente = so.cliente
 AND si.sku     = so.sku
 AND si.anio    = so.anio
 AND si.mes     = so.mes;

COMMENT ON VIEW public.v_demanda_sku IS
  'Demanda mensual por cliente/SKU. Prefiere sellout; fallback a sell-in si no hay sellout para ese periodo. Fuente visible en columna "fuente".';

-- Función: resumen de demanda últimos N meses por SKU
-- Retorna promedio mensual por cliente (útil para forecast)
CREATE OR REPLACE FUNCTION public.demanda_promedio_mensual(
  p_sku TEXT,
  p_meses INTEGER DEFAULT 3
) RETURNS TABLE (
  cliente TEXT,
  piezas_promedio NUMERIC,
  meses_con_datos INTEGER
) AS $$
DECLARE
  fecha_corte DATE := (CURRENT_DATE - (p_meses * INTERVAL '1 month'))::DATE;
  anio_corte INTEGER := EXTRACT(YEAR FROM fecha_corte)::INTEGER;
  mes_corte  INTEGER := EXTRACT(MONTH FROM fecha_corte)::INTEGER;
BEGIN
  RETURN QUERY
  SELECT
    d.cliente,
    ROUND(AVG(d.piezas), 2) AS piezas_promedio,
    COUNT(DISTINCT (d.anio, d.mes))::INTEGER AS meses_con_datos
  FROM public.v_demanda_sku d
  WHERE d.sku = p_sku
    AND (d.anio > anio_corte
      OR (d.anio = anio_corte AND d.mes >= mes_corte))
  GROUP BY d.cliente;
END;
$$ LANGUAGE plpgsql;
