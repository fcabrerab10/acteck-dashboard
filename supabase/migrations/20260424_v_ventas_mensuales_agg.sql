-- Vista canónica de ventas mensuales agregadas
-- Fecha: 2026-04-24
--
-- Agrega sell_in_sku + sellout_sku a nivel cliente/año/mes.
-- Esta es la MISMA fuente que usa HomeCliente.jsx para cálculos YTD,
-- así que Resumen Clientes y las pestañas per-cliente quedan alineados.

CREATE OR REPLACE VIEW public.v_ventas_mensuales_agg AS
WITH si AS (
  SELECT cliente, anio, mes, SUM(monto_pesos)::NUMERIC AS sell_in
  FROM public.sell_in_sku
  GROUP BY cliente, anio, mes
),
so AS (
  SELECT cliente, anio, mes, SUM(monto_pesos)::NUMERIC AS sell_out
  FROM public.sellout_sku
  GROUP BY cliente, anio, mes
)
SELECT
  COALESCE(si.cliente, so.cliente) AS cliente,
  COALESCE(si.anio,    so.anio)    AS anio,
  COALESCE(si.mes,     so.mes)     AS mes,
  COALESCE(si.sell_in,  0) AS sell_in,
  COALESCE(so.sell_out, 0) AS sell_out
FROM si
FULL OUTER JOIN so
  ON si.cliente = so.cliente AND si.anio = so.anio AND si.mes = so.mes;

COMMENT ON VIEW public.v_ventas_mensuales_agg IS
  'Sell-In y Sell-Out mensual por cliente (agregado desde sell_in_sku + sellout_sku).
   Fuente canónica para Resumen Clientes, alineada con HomeCliente.jsx per-cliente.';
