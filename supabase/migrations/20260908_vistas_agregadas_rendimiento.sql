-- Vistas agregadas para rendimiento (2026-09-08).
-- Sustituyen descargas de filas crudas + agregación en JS por agregación en
-- Postgres. security_invoker=true → respetan la RLS de la tabla base.
--   sellout_detalle 23K filas (Digitalife 2a) → 5.8K por sku+mes
--   sellout_general 20K filas (Dicotech 1a)  → 225 por vendedor+mes
--   facturacion_clientes 19K filas (1a)      → 80 por cliente+mes
--   facturacion_clientes 54K filas           → ~4 (años distintos)

CREATE OR REPLACE VIEW public.v_sellout_detalle_sku_mes
WITH (security_invoker = true) AS
SELECT
  cliente,
  no_parte                              AS sku,
  marca,
  EXTRACT(YEAR  FROM fecha)::int        AS anio,
  EXTRACT(MONTH FROM fecha)::int        AS mes,
  SUM(cantidad)::numeric                AS piezas,
  SUM(total)::numeric                   AS monto,        -- neto (columna total)
  SUM(cantidad * precio)::numeric       AS monto_bruto,  -- cantidad × precio unitario
  COUNT(*)::int                         AS tx,
  MAX(fecha)                            AS ultima_fecha
FROM public.sellout_detalle
WHERE no_parte IS NOT NULL AND fecha IS NOT NULL
GROUP BY cliente, no_parte, marca, EXTRACT(YEAR FROM fecha), EXTRACT(MONTH FROM fecha);

CREATE OR REPLACE VIEW public.v_sellout_general_vendedor_mes
WITH (security_invoker = true) AS
SELECT
  mayorista, anio, mes, vendedor_nombre,
  SUM(importe)::numeric  AS importe,
  SUM(cantidad)::numeric AS cantidad,
  COUNT(*)::int          AS tx
FROM public.sellout_general
GROUP BY mayorista, anio, mes, vendedor_nombre;

CREATE OR REPLACE VIEW public.v_fact_cliente_mes
WITH (security_invoker = true) AS
SELECT
  cliente_key, anio, mes,
  SUM(monto)::numeric        AS monto,
  SUM(piezas)::numeric       AS piezas,
  COUNT(DISTINCT sku)::int   AS skus
FROM public.facturacion_clientes
GROUP BY cliente_key, anio, mes;

CREATE OR REPLACE VIEW public.v_fact_anios
WITH (security_invoker = true) AS
SELECT DISTINCT anio FROM public.facturacion_clientes WHERE anio IS NOT NULL ORDER BY anio;

GRANT SELECT ON public.v_sellout_detalle_sku_mes, public.v_sellout_general_vendedor_mes,
               public.v_fact_cliente_mes, public.v_fact_anios TO authenticated, anon, service_role;

NOTIFY pgrst, 'reload schema';
