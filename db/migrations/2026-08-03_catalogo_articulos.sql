-- =============================================================================
-- Catálogo maestro de artículos (Master Embarques · hoja "Proveedores" · rows 59+)
-- =============================================================================
-- La hoja "Proveedores" tiene 2 formatos mezclados:
--   · Rows 1-58 (58 filas): proveedores con código + intelisis + artículo
--     asociado — van a proveedores_master.
--   · Rows 59-10,402 (~10,343 filas): catálogo maestro de artículos con
--     SKU + descripción (sin código de proveedor asociado).
--
-- Esta tabla guarda los artículos como catálogo canónico de descripciones
-- para completar/validar SKUs contra un master único.
-- =============================================================================

CREATE TABLE IF NOT EXISTS catalogo_articulos (
  articulo     TEXT PRIMARY KEY,   -- SKU / código de artículo (ej. "AC-01001", "58", "84111506")
  descripcion  TEXT,
  isbn         TEXT,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Índice simple por articulo (ya está por PK). Si necesitas búsqueda por
-- texto en descripción con % y ranking, agregar pg_trgm después.

-- Verificación:
--   SELECT count(*) FROM catalogo_articulos;
-- Después de re-subir el Master debe devolver ~10,343.
