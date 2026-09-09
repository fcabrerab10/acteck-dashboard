-- =============================================================================
-- Puente SQL (Mac mini) · límites de tiempo para las cargas automáticas
-- =============================================================================
-- Comprobado el 2026-09-09 con la carga real de ventas (63,740 filas de 2026):
--   · refresh_facturacion_clientes(2026) se cancela a los 20 s con
--     "canceling statement due to statement timeout" (57014). La función es
--     SECURITY DEFINER pero hereda el statement_timeout del rol que la llama
--     (service_role vía PostgREST).
--   · los upserts de 1000 filas en erp_ventas también tocaban el límite; el
--     puente ya manda lotes de 200 con concurrencia 2.
--
-- Correr en Supabase Dashboard → SQL Editor (una sola vez).
-- =============================================================================

-- 1) La función de rebuild corre con su propio límite (5 min), independiente
--    del rol que la invoque.
ALTER FUNCTION public.refresh_facturacion_clientes(integer[])
  SET statement_timeout = '300s';

-- 2) Margen para los upserts grandes del puente (service_role solamente; anon y
--    authenticated conservan sus límites cortos).
ALTER ROLE service_role SET statement_timeout = '120s';

NOTIFY pgrst, 'reload config';

-- Verificación: tras correrlo, en la Mac mini
--   cd ~/acteck/acteck-dashboard/bridge && ./run.sh ventas && tail -5 logs/sync-$(date +%Y-%m-%d).log
-- debe terminar con "✓ ventas: 63740 filas" y "resumen: … 0 error".
