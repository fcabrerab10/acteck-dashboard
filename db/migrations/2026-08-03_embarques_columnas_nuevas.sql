-- =============================================================================
-- Fase 2 · Columnas nuevas capturadas del Master Embarques
-- =============================================================================
-- El Excel del Master trae 5 datos que hoy no capturamos:
--   · SN            (col 18 hoja 2026)  — número de serie generado para la PO
--   · CBM TOTAL     (col 3)             — CBM total del shipment
--   · CBM UNITARIO  (col 4)             — CBM por pieza (antes se llamaba "CBM POR PIEZA")
--   · LT (días)     (col 30)            — lead time real declarado en la PO
--   · TIPO DE CARGA (col 21)            — FCL / LCL (parser ya lo envía)
--
-- El parser masterEmbarques ya envía tipo_carga y tipo_contenedor. Este
-- ALTER agrega las nuevas columnas y asegura que las existentes tengan
-- el tipo correcto.
--
-- Correr en Supabase Dashboard → SQL Editor.
-- =============================================================================

ALTER TABLE embarques_compras
  ADD COLUMN IF NOT EXISTS sn           TEXT,
  ADD COLUMN IF NOT EXISTS cbm_total    NUMERIC,
  ADD COLUMN IF NOT EXISTS cbm_unitario NUMERIC,
  ADD COLUMN IF NOT EXISTS lt_dias      INTEGER;

-- Verificación:
--   SELECT column_name, data_type
--   FROM information_schema.columns
--   WHERE table_name = 'embarques_compras'
--     AND column_name IN ('sn','cbm_total','cbm_unitario','lt_dias');
--
-- Debe devolver las 4 filas.
