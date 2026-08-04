-- =============================================================================
-- Configuración por SKU · sugerido de compra
-- =============================================================================
-- Overrides manuales del cálculo de sugerido:
--   · es_critico: SKUs que "nunca pueden faltar" — activa meses de seguridad
--     y muestra ⭐ en la tabla.
--   · meses_seguridad: colchón adicional al objetivo de 3 meses (0 default).
--     Sólo aplica cuando es_critico = true.
--   · crecimiento_override: si viene, se usa en vez del calculado dinámicamente.
--     null → auto-calculado desde tendencia (últ 3m vs 3m anteriores, cap 40%).
--   · notas: texto libre del planificador.
--
-- Correr en Supabase Dashboard → SQL Editor.
-- =============================================================================

CREATE TABLE IF NOT EXISTS sku_config (
  sku                   TEXT PRIMARY KEY,
  es_critico            BOOLEAN NOT NULL DEFAULT false,
  meses_seguridad       INTEGER NOT NULL DEFAULT 0 CHECK (meses_seguridad >= 0 AND meses_seguridad <= 12),
  crecimiento_override  NUMERIC CHECK (crecimiento_override IS NULL OR (crecimiento_override >= -0.50 AND crecimiento_override <= 1.00)),
  notas                 TEXT,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by            UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS sku_config_critico_idx ON sku_config (es_critico) WHERE es_critico = true;

-- Verificación:
--   SELECT count(*) FROM sku_config WHERE es_critico = true;
-- Inicial debe ser 0. Se pobla desde la UI del dashboard.
