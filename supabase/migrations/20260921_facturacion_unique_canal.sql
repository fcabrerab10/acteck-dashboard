-- =============================================================================
-- facturacion_clientes · la llave única debe incluir el canal · 2026-09-21
-- =============================================================================
-- Desde 20260912_sellout_ingram_dos_clientes.sql, refresh_facturacion_clientes()
-- decide el canal por CÓDIGO de cliente, así que un mismo nombre puede salir en
-- dos canales: INGRAM MICRO MEXICO es 00226 (MAYOREO) y 04126 (RETAIL
-- REPRESENTADOS). La tabla seguía con UNIQUE (cliente_nombre, sku, anio, mes) y
-- el rebuild fallaba con 23505 en cada corrida del puente desde el 2026-09-11:
--   Key (cliente_nombre, sku, anio, mes)=(INGRAM MICRO MEXICO, BR-934534, 2026, 1)
--   already exists.
-- Nadie hace upsert con esa llave (import-central ya no carga esta tabla desde el
-- pivot; se reconstruye desde erp_ventas), así que basta ampliar la llave.
--
-- Correr en Supabase Dashboard → SQL Editor (una sola vez).
-- =============================================================================

ALTER TABLE public.facturacion_clientes
  DROP CONSTRAINT IF EXISTS facturacion_clientes_cliente_nombre_sku_anio_mes_key;

ALTER TABLE public.facturacion_clientes
  ADD CONSTRAINT facturacion_clientes_nombre_sku_anio_mes_canal_key
  UNIQUE (cliente_nombre, sku, anio, mes, canal);

NOTIFY pgrst, 'reload schema';

-- Verificación: en la Mac mini
--   cd ~/acteck/acteck-dashboard/bridge && ./run.sh ventas && tail -4 logs/sync-$(date +%Y-%m-%d).log
-- debe terminar con "✓ ventas" y "0 error", y la fila Ventas ERP del panel pasa a OK.
