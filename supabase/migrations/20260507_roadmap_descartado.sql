-- Roadmap: descarte de SKUs detectados como "nuevos" pero que Fernando no
-- quiere manejar (no son productos válidos / errores de captura / etc.).
-- Fecha: 2026-05-06
--
-- Implementación: una fila en roadmap_sku con sku + descartado_en.
-- El rdmp queda null mientras esté descartado. Al recuperar se borra el row.

ALTER TABLE roadmap_sku ADD COLUMN IF NOT EXISTS descartado_en TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS roadmap_sku_descartado_idx
  ON roadmap_sku(descartado_en)
  WHERE descartado_en IS NOT NULL;
