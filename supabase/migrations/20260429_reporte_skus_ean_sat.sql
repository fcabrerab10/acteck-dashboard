-- Agrega columnas EAN13 y Código SAT al reporte de SKUs.
-- Editables desde la pestaña Resumen Clientes → Reporte (click en la celda).
-- Idempotente: si las columnas ya existen, no hace nada.

ALTER TABLE public.reporte_skus
  ADD COLUMN IF NOT EXISTS ean13      TEXT,
  ADD COLUMN IF NOT EXISTS codigo_sat TEXT;

COMMENT ON COLUMN public.reporte_skus.ean13      IS 'Código de barras EAN-13 (override manual desde el dashboard)';
COMMENT ON COLUMN public.reporte_skus.codigo_sat IS 'Código del SAT (clasificación fiscal). Override manual desde el dashboard.';
