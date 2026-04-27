-- v2: vista de histórico de compras por SKU
--   - Promedio histórico de PO_QTY (TODAS las compras, sin filtro de año)
--   - Rango histórico: primera_fecha_emision .. ultima_fecha_emision
--   - ultimo_arribo_real = último arribo_cedis con fecha <= hoy (ya llegó)
--   - ultima_fecha_arribo = último arribo absoluto (puede estar en futuro)
--   - Última cantidad / PO / # contenedores
--   - CBM, piezas por contenedor, flag consolidado

CREATE OR REPLACE VIEW public.v_sku_compras_historico AS
WITH compras AS (
  SELECT
    codigo                       AS sku,
    po,
    fecha_emision,
    arribo_cedis,
    po_qty,
    shp_qty,
    cbm,
    contenedor,
    estatus
  FROM public.embarques_compras
  WHERE codigo IS NOT NULL
    AND codigo <> ''
    AND COALESCE(estatus, '') NOT ILIKE '%rechazada%'
    AND COALESCE(estatus, '') NOT ILIKE '%cancel%'
),
sku_po AS (
  SELECT
    sku,
    po,
    MAX(fecha_emision) AS fecha_emision,
    MAX(arribo_cedis)  AS arribo_cedis,
    SUM(COALESCE(po_qty, 0))::INTEGER AS po_qty,
    AVG(NULLIF(cbm, 0))  AS cbm_avg,
    COUNT(DISTINCT NULLIF(contenedor, ''))::INTEGER AS num_contenedores
  FROM compras
  GROUP BY sku, po
),
contenedores_consolidacion AS (
  SELECT
    contenedor,
    COUNT(DISTINCT sku) AS skus_distintos
  FROM compras
  WHERE contenedor IS NOT NULL AND contenedor <> ''
  GROUP BY contenedor
),
sku_consolidacion AS (
  SELECT
    c.sku AS sku,
    AVG(cc.skus_distintos)::NUMERIC AS skus_por_contenedor_prom
  FROM compras c
  JOIN contenedores_consolidacion cc ON cc.contenedor = c.contenedor
  WHERE c.contenedor IS NOT NULL AND c.contenedor <> ''
  GROUP BY c.sku
),
ultima_po AS (
  SELECT DISTINCT ON (sku)
    sku,
    fecha_emision      AS ultima_fecha_emision,
    arribo_cedis       AS ultima_fecha_arribo,
    po_qty             AS ultima_po_qty,
    num_contenedores   AS ultima_num_contenedores,
    po                 AS ultima_po
  FROM sku_po
  ORDER BY sku, fecha_emision DESC NULLS LAST, po DESC
),
-- Último arribo que YA llegó (arribo_cedis <= hoy)
ultimo_arribado AS (
  SELECT DISTINCT ON (sku)
    sku,
    arribo_cedis AS ultimo_arribo_real,
    po           AS ultima_po_arribada,
    po_qty       AS ultima_po_qty_arribada
  FROM sku_po
  WHERE arribo_cedis IS NOT NULL
    AND arribo_cedis <= CURRENT_DATE
  ORDER BY sku, arribo_cedis DESC, po DESC
)
SELECT
  sp.sku,
  COUNT(*)::INTEGER                                AS num_compras,
  MIN(sp.fecha_emision)                            AS primera_fecha_emision,
  MAX(sp.fecha_emision)                            AS ultima_fecha_emision_total,
  ROUND(AVG(sp.po_qty))::INTEGER                   AS po_qty_promedio,
  AVG(sp.cbm_avg)                                  AS cbm_promedio,
  ROUND(AVG(NULLIF(sp.num_contenedores, 0)), 1)    AS contenedores_promedio,
  ROUND(AVG(
    CASE WHEN sp.num_contenedores > 0
         THEN sp.po_qty::NUMERIC / sp.num_contenedores
         ELSE NULL
    END
  ))::INTEGER                                      AS piezas_por_contenedor,
  u.ultima_po,
  u.ultima_fecha_emision,
  u.ultima_fecha_arribo,
  u.ultima_po_qty,
  u.ultima_num_contenedores,
  ua.ultimo_arribo_real,
  ua.ultima_po_arribada,
  ua.ultima_po_qty_arribada,
  COALESCE(sc.skus_por_contenedor_prom, 1)         AS skus_por_contenedor,
  (COALESCE(AVG(sp.cbm_avg), 1) < 0.05
    OR COALESCE(sc.skus_por_contenedor_prom, 1) >= 5)  AS es_consolidado
FROM sku_po sp
JOIN ultima_po u             ON u.sku = sp.sku
LEFT JOIN ultimo_arribado ua ON ua.sku = sp.sku
LEFT JOIN sku_consolidacion sc ON sc.sku = sp.sku
GROUP BY sp.sku, u.ultima_po, u.ultima_fecha_emision, u.ultima_fecha_arribo,
         u.ultima_po_qty, u.ultima_num_contenedores,
         ua.ultimo_arribo_real, ua.ultima_po_arribada, ua.ultima_po_qty_arribada,
         sc.skus_por_contenedor_prom;

COMMENT ON VIEW public.v_sku_compras_historico IS
  'Histórico de compras por SKU (todas las fechas). Incluye último arribo real (ya pasado) vs último arribo programado.';
