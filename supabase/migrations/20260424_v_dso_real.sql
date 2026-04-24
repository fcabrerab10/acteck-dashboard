-- Vista: DSO real por cliente desde estados_cuenta_detalle
-- Fecha: 2026-04-24
--
-- Alineada con CreditoCobranza.jsx líneas 150-161.
-- Fórmula: Σ(saldo × días desde emisión) / Σ(saldo)
-- Solo considera el estado de cuenta más reciente por cliente.

CREATE OR REPLACE VIEW public.v_dso_real AS
WITH ec_latest AS (
  SELECT DISTINCT ON (cliente)
    id AS estado_cuenta_id, cliente, anio, semana, fecha_corte,
    saldo_actual AS saldo_actual_total,
    saldo_vencido, dso AS dso_erp, aging_mas90
  FROM public.estados_cuenta
  ORDER BY cliente, fecha_corte DESC NULLS LAST
),
facturas AS (
  SELECT
    ec.cliente,
    ec.fecha_corte,
    d.fecha_emision,
    d.saldo_actual AS saldo
  FROM ec_latest ec
  JOIN public.estados_cuenta_detalle d ON d.estado_cuenta_id = ec.estado_cuenta_id
  WHERE d.saldo_actual IS NOT NULL AND d.saldo_actual > 0
    AND d.fecha_emision IS NOT NULL
)
SELECT
  ec.cliente,
  ec.fecha_corte,
  ec.saldo_actual_total,
  ec.saldo_vencido,
  ec.aging_mas90,
  ec.dso_erp,
  CASE
    WHEN SUM(f.saldo) > 0 THEN
      ROUND( SUM(f.saldo * (ec.fecha_corte - f.fecha_emision)) / SUM(f.saldo) )::INTEGER
    ELSE NULL
  END AS dso_real,
  COUNT(f.saldo) AS facturas_abiertas
FROM ec_latest ec
LEFT JOIN facturas f ON f.cliente = ec.cliente
GROUP BY ec.cliente, ec.fecha_corte, ec.saldo_actual_total, ec.saldo_vencido, ec.aging_mas90, ec.dso_erp;

COMMENT ON VIEW public.v_dso_real IS
  'DSO real calculado desde estados_cuenta_detalle del corte más reciente por cliente. Alineado con CreditoCobranza.jsx.';
