-- Facturación canónica de clientes desde el ERP (hoja "Facturación")
-- Fecha: 2026-05-14
--
-- Esta tabla REEMPLAZA a sell_in_sku como fuente de verdad de la
-- facturación de clientes (sell-in en MXN y piezas). Viene de la hoja
-- "Facturación" del archivo Actualizaciones ERP — pivot dinámico que
-- contabilidad ya pre-filtró por MovimientoVenta válidos.
--
-- Granularidad: cliente_nombre + SKU + año + mes.
-- (No hay folio, fecha exacta, vendedor, almacén — no se necesitan
--  para el dashboard).

CREATE TABLE IF NOT EXISTS public.facturacion_clientes (
  id BIGSERIAL PRIMARY KEY,
  cliente_nombre TEXT NOT NULL,
  cliente_key TEXT,                       -- mapeo a digitalife/pcel/mercadolibre/...
  sku TEXT NOT NULL,
  anio INT NOT NULL,
  mes INT NOT NULL,
  piezas NUMERIC NOT NULL DEFAULT 0,
  monto NUMERIC NOT NULL DEFAULT 0,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cliente_nombre, sku, anio, mes)
);

CREATE INDEX IF NOT EXISTS fact_cli_idx     ON facturacion_clientes(cliente_nombre);
CREATE INDEX IF NOT EXISTS fact_key_idx     ON facturacion_clientes(cliente_key) WHERE cliente_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS fact_sku_idx     ON facturacion_clientes(sku);
CREATE INDEX IF NOT EXISTS fact_anio_mes_idx ON facturacion_clientes(anio, mes);

ALTER TABLE public.facturacion_clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fact_all ON public.facturacion_clientes;
CREATE POLICY fact_all ON public.facturacion_clientes FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE public.facturacion_clientes IS
  'Facturación agregada por cliente/SKU/mes desde hoja Facturación del ERP — fuente CANÓNICA de sell-in. Reemplaza sell_in_sku.';
