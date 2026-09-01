CREATE OR REPLACE VIEW public.v_transito_sku AS
WITH concluido AS (
  SELECT po, codigo, sum(COALESCE(shp_qty, po_qty)) AS shp_llegado
  FROM embarques_compras
  WHERE estatus = 'CONCLUIDO' AND codigo IS NOT NULL AND po IS NOT NULL
  GROUP BY po, codigo
),
transito_raw AS (
  SELECT po, codigo, supplier, arribo_cedis, etd, eta_puerto, cedis,
         entrega_directa_cliente, contenedor,
         COALESCE(shp_qty, po_qty) AS qty_row,
         po_qty, estatus
  FROM embarques_compras
  WHERE codigo IS NOT NULL
    AND estatus IN ('EN PRODUCCION','PROXIMO A ZARPAR','TRANSITO MARITIMO','EN ESPERA DE CONSOLIDAR','EN RESGUARDO','Pendiente modular')
    AND (entrega_directa_cliente IS NULL OR entrega_directa_cliente = '')
),
por_po AS (
  SELECT
    t.po,
    t.codigo,
    max(t.supplier) AS supplier,
    max(t.po_qty) AS po_total,
    COALESCE(max(c.shp_llegado), 0) AS llegado,
    sum(t.qty_row) AS shp_reportado,
    LEAST(GREATEST(max(t.po_qty) - COALESCE(max(c.shp_llegado), 0), 0), sum(t.qty_row))::integer AS pendiente,
    min(t.arribo_cedis) AS eta_min,
    max(t.arribo_cedis) AS eta_max,
    min(t.etd) AS etd_min,
    min(t.eta_puerto) AS eta_puerto_min,
    max(t.cedis) AS cedis,
    max(t.contenedor) AS contenedor,
    max(t.entrega_directa_cliente) AS entrega_directa_cliente,
    (array_agg(t.estatus ORDER BY
      CASE t.estatus
        WHEN 'TRANSITO MARITIMO' THEN 1
        WHEN 'PROXIMO A ZARPAR' THEN 2
        WHEN 'EN RESGUARDO' THEN 3
        WHEN 'EN ESPERA DE CONSOLIDAR' THEN 4
        WHEN 'EN PRODUCCION' THEN 5
        WHEN 'Pendiente modular' THEN 6
        ELSE 9
      END
    ))[1] AS estatus_principal
  FROM transito_raw t
  LEFT JOIN concluido c ON c.po = t.po AND c.codigo = t.codigo
  GROUP BY t.po, t.codigo
)
SELECT
  codigo AS sku,
  max(supplier) AS supplier,
  sum(pendiente)::integer AS cantidad,
  min(eta_min) AS eta_mas_cercana,
  max(eta_max) AS eta_mas_lejana,
  count(*) FILTER (WHERE pendiente > 0)::integer AS embarques,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'po', po,
        'estatus', estatus_principal,
        'cantidad', pendiente,
        'eta', eta_min,
        'etd', etd_min,
        'eta_puerto', eta_puerto_min,
        'cedis', cedis,
        'contenedor', contenedor,
        'directo_cliente', entrega_directa_cliente
      ) ORDER BY eta_min NULLS LAST
    ) FILTER (WHERE pendiente > 0),
    '[]'::jsonb
  ) AS embarques_detalle
FROM por_po
GROUP BY codigo;
