-- Tracking Pedidos · agrega Orden de Compra real y número de Factura
--
-- Hasta ahora `numero_oc_cliente` se usaba en la UI como "No. OC" pero en
-- realidad representa la Orden de Surtido interna. Este cambio:
--   • Agrega `numero_oc` — la Orden de Compra real que envía el cliente
--   • Agrega `numero_factura` — se llena a mano días después de surtir
--   • Mantiene `numero_oc_cliente` como la Orden de Surtido (solo cambia
--     su etiqueta en la UI, no su nombre en DB para no romper histórico).
--
-- Ejecutar en Supabase Dashboard → SQL Editor → New query.

ALTER TABLE oc_clientes
  ADD COLUMN IF NOT EXISTS numero_oc TEXT,
  ADD COLUMN IF NOT EXISTS numero_factura TEXT;

-- Índice opcional para búsqueda rápida (los IDs suelen ser cortos)
CREATE INDEX IF NOT EXISTS oc_clientes_numero_oc_idx ON oc_clientes (numero_oc);
CREATE INDEX IF NOT EXISTS oc_clientes_numero_factura_idx ON oc_clientes (numero_factura);
