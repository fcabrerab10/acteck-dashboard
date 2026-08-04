-- =============================================================================
-- Fase 1 · Fix estructural embarques_compras
-- =============================================================================
-- Problema: la unique key (po, codigo) colapsa POs partidas en varios
-- shipments/contenedores. Ejemplo: PO de 10,830 pz enviada en 3 contenedores
-- de 3,610 c/u → el Excel trae 3 filas, el upsert deja 1.
--
-- Fix: unique (po, codigo, contenedor), con contenedor NOT NULL. El uploader
-- ahora emite un placeholder determinista 'PEND-<shpqty>-<fecha>-<fecha>'
-- cuando el contenedor real aún no se asigna, así se mantienen filas separadas
-- por shipment aunque ninguno tenga contenedor confirmado.
--
-- Correr en Supabase Dashboard → SQL Editor.
-- =============================================================================

BEGIN;

-- 1) Rellenar contenedores NULL/vacíos/PENDIENTE con placeholder determinista
--    para que no colisionen dentro de la misma (po, codigo).
UPDATE embarques_compras
SET contenedor = 'PEND-'
              || COALESCE(shp_qty::text, po_qty::text, '0')
              || '-'
              || COALESCE(fecha_emision::text, 'X')
              || '-'
              || COALESCE(fin_produccion::text, 'X')
WHERE contenedor IS NULL
   OR btrim(contenedor) = ''
   OR upper(btrim(contenedor)) IN ('PENDIENTE', 'NA', 'N/A', '-');

-- 2) Bajar el unique viejo (nombre puede variar según cómo se creó — el DROP
--    IF EXISTS con ambos nombres cubre las dos formas típicas de Supabase).
ALTER TABLE embarques_compras
  DROP CONSTRAINT IF EXISTS embarques_compras_po_codigo_key;
ALTER TABLE embarques_compras
  DROP CONSTRAINT IF EXISTS embarques_compras_pkey_po_codigo;

-- 3) Poner NOT NULL con default para que futuras filas sin contenedor
--    caigan a un valor conocido (el uploader ya emite placeholder, pero
--    esto es cinturón + tirantes para inserts manuales o parciales).
ALTER TABLE embarques_compras
  ALTER COLUMN contenedor SET DEFAULT 'SIN_ASIGNAR';
ALTER TABLE embarques_compras
  ALTER COLUMN contenedor SET NOT NULL;

-- 4) Nueva unique (po, codigo, contenedor) — la clave que respeta shipments
--    separados de la misma PO/SKU.
ALTER TABLE embarques_compras
  ADD CONSTRAINT embarques_compras_po_codigo_contenedor_key
  UNIQUE (po, codigo, contenedor);

-- 5) Índice adicional para queries por (po, codigo) — muchas consultas del
--    dashboard filtran por eso sin importar contenedor. Antes lo tenía gratis
--    por ser unique; ahora hay que crearlo explícito.
CREATE INDEX IF NOT EXISTS embarques_compras_po_codigo_idx
  ON embarques_compras (po, codigo);

COMMIT;

-- =============================================================================
-- Verificación post-migración
-- =============================================================================
-- Después de correr esta migración y re-subir el Master Embarques desde
-- /uploads.html, para una PO que sepas que se partió en varios contenedores
-- (ej. la PO de AC-943253 = 10,830 pz en 3 contenedores), esta query debe
-- devolver 3 filas:
--
--   SELECT po, codigo, contenedor, shp_qty, po_qty
--   FROM embarques_compras
--   WHERE codigo = 'AC-943253'
--   ORDER BY fecha_emision DESC, contenedor;
--
-- Si aparecen las 3 filas → migración OK.
-- Si sigue apareciendo 1 sola → algún paso del upload no aplicó, avisar.
