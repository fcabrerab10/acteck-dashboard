-- Solicitudes de compra: división en envíos parciales + agrupación por contenedor
-- Fecha: 2026-05-06
--
-- Agrega:
--   · envios (JSONB) — array [{cantidad, fecha_estimada}] cuando una línea
--     se divide en N envíos parciales. Si es null, la línea es un solo
--     envío con la cantidad/fecha original.
--   · grupo_contenedor (TEXT) — etiqueta para asociar varias líneas (SKUs
--     distintos) que comparten un contenedor (caso "diferentes colores").

ALTER TABLE solicitudes_compra_lineas ADD COLUMN IF NOT EXISTS envios JSONB;
ALTER TABLE solicitudes_compra_lineas ADD COLUMN IF NOT EXISTS grupo_contenedor TEXT;
CREATE INDEX IF NOT EXISTS solcom_lin_grupo_idx
  ON solicitudes_compra_lineas(grupo_contenedor)
  WHERE grupo_contenedor IS NOT NULL;
