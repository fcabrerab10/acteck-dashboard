-- =============================================================================
-- Fase 3 · Hojas adicionales del Master Embarques
-- =============================================================================
-- El archivo "Master Embarques.xlsx" trae 3 hojas adicionales a las históricas
-- de POs que hoy NO leemos:
--   · "Programación Arribos" — logística fina por contenedor (agencia, cita,
--     arribo almacén, transportista, empate, custodia, seguro, demoras, etc.)
--   · "SN"                    — números de serie generados por (PO, SKU)
--   · "Proveedores"           — catálogo maestro nombre proveedor ↔ artículo
--
-- Correr en Supabase Dashboard → SQL Editor.
-- =============================================================================

-- 1) programacion_arribos · una fila por contenedor (unique real).
CREATE TABLE IF NOT EXISTS programacion_arribos (
  contenedor           TEXT PRIMARY KEY,
  agencia              TEXT,
  terminal             TEXT,
  contenido            TEXT,
  eta_puerto           DATE,
  piso                 DATE,
  cita                 DATE,
  hora_cita            NUMERIC,      -- fracción del día 0-1 (Excel)
  arribo_almacen       DATE,
  cedis                TEXT,
  linea_transportista  TEXT,
  empate               TEXT,
  custodia             TEXT,
  seguro_poliza        TEXT,
  importacion          TEXT,
  fac                  NUMERIC,
  resguardo            TEXT,
  dias_demoras         INTEGER,
  ultimo_dia_demoras   DATE,
  reconocimiento_a     TEXT,
  profepa              TEXT,
  almacenajes          NUMERIC,
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS programacion_arribos_cedis_idx
  ON programacion_arribos (cedis);
CREATE INDEX IF NOT EXISTS programacion_arribos_arribo_idx
  ON programacion_arribos (arribo_almacen);

-- 2) series_generadas · SN por (PO, SKU). El Excel entrega 1 fila por par;
--    guardamos SN INITIAL - SN FINAL como texto porque exceden 2^31.
CREATE TABLE IF NOT EXISTS series_generadas (
  po                   TEXT NOT NULL,
  sku                  TEXT NOT NULL,
  ff                   INTEGER,
  supplier_num         INTEGER,
  supplier             TEXT,
  ean                  TEXT,
  description          TEXT,
  fecha_po             DATE,
  po_qty               INTEGER,
  sn_generada          TEXT,        -- patrón "XXX...XXXX"
  sn_initial           TEXT,        -- 12 dígitos → texto para preservarlos
  sn_final             TEXT,
  status               TEXT,
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (po, sku)
);
CREATE INDEX IF NOT EXISTS series_generadas_sku_idx
  ON series_generadas (sku);

-- 3) proveedores_master · catálogo canónico proveedor↔artículo.
--    El Excel tiene ~10K filas · unique por (codigo_intelisis, articulo)
--    porque puede haber múltiples artículos por proveedor.
CREATE TABLE IF NOT EXISTS proveedores_master (
  codigo               INTEGER NOT NULL,       -- código interno del proveedor
  articulo             TEXT NOT NULL,          -- SKU/artículo asociado
  nombre_proveedor     TEXT,
  codigo_intelisis     INTEGER,
  descripcion1         TEXT,
  isbn                 TEXT,
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (codigo, articulo)
);
CREATE INDEX IF NOT EXISTS proveedores_master_nombre_idx
  ON proveedores_master (nombre_proveedor);
CREATE INDEX IF NOT EXISTS proveedores_master_articulo_idx
  ON proveedores_master (articulo);

-- Verificación:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_name IN ('programacion_arribos','series_generadas','proveedores_master');
-- Debe devolver 3 filas.
