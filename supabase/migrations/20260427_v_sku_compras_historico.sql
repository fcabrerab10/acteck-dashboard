-- Vista: histórico de compras por SKU para sugerido de compra inteligente
-- Saca de embarques_compras (excluyendo cancelados):
--   - Promedio histórico de PO_QTY (todas las compras)
--   - Última cantidad comprada y fecha de emisión
--   - Última fecha de arribo a CEDIS
--   - Promedio CBM por unidad
--   - # contenedores promedio por PO
--   - Piezas por contenedor (calculado)
--   - Flag de "consolidado" si CBM bajo o si el contenedor lleva muchos SKUs

CREATE OR REPLACE VIEW public.v_sku_compras_historico AS
WITH compras AS (
  -- Una compra = una combinación (po, codigo). Una PO puede tener varios SKUs y varios contenedores.
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
-- Cantidad por SKU dentro de una PO (sumando posibles renglones repetidos)
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
-- Cuántos SKUs distintos comparten un contenedor (medida de consolidación)
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
ultima AS (
  SELECT DISTINCT ON (sku)
    sku,
    fecha_emision      AS ultima_fecha_emision,
    arribo_cedis       AS ultima_fecha_arribo,
    po_qty             AS ultima_po_qty,
    num_contenedores   AS ultima_num_contenedores,
    po                 AS ultima_po
  FROM sku_po
  ORDER BY sku, fecha_emision DESC NULLS LAST, po DESC
)
SELECT
  sp.sku,
  COUNT(*)::INTEGER                                AS num_compras,
  ROUND(AVG(sp.po_qty))::INTEGER                   AS po_qty_promedio,
  AVG(sp.cbm_avg)                                  AS cbm_promedio,
  ROUND(AVG(NULLIF(sp.num_contenedores, 0)), 1)    AS contenedores_promedio,
  -- Piezas por contenedor: promedio del cociente cuando hay >0 contenedores
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
  COALESCE(sc.skus_por_contenedor_prom, 1)         AS skus_por_contenedor,
  -- Flag consolidado: CBM bajo (<0.05) o típicamente comparte contenedor con 5+ SKUs
  (COALESCE(AVG(sp.cbm_avg), 1) < 0.05
    OR COALESCE(sc.skus_por_contenedor_prom, 1) >= 5)  AS es_consolidado
FROM sku_po sp
JOIN ultima u             ON u.sku = sp.sku
LEFT JOIN sku_consolidacion sc ON sc.sku = sp.sku
GROUP BY sp.sku, u.ultima_po, u.ultima_fecha_emision, u.ultima_fecha_arribo,
         u.ultima_po_qty, u.ultima_num_contenedores, sc.skus_por_contenedor_prom;

COMMENT ON VIEW public.v_sku_compras_historico IS
  'Histórico de compras por SKU para sugerido inteligente: promedio, última compra/arribo, contenedores, consolidado.';
