-- Migración: sustituir tabla sell_in_sku por vista sobre facturacion_clientes
-- Fecha: 2026-05-14
--
-- facturacion_clientes (hoja "Facturación" del ERP) es ahora la fuente
-- canónica de sell-in. Para no tener que editar 8 archivos consumidores,
-- renombramos la tabla vieja y creamos una vista con el mismo nombre y
-- mismas columnas (cliente, sku, anio, mes, piezas, monto_pesos).
--
-- La vista agrega por cliente_key (digitalife/pcel/mercadolibre) ya que
-- facturacion_clientes tiene granularidad cliente_nombre (varios nombres
-- pueden mapearse al mismo cliente_key).

-- 1) Renombrar tabla antigua (preservar datos por si acaso)
ALTER TABLE IF EXISTS public.sell_in_sku RENAME TO sell_in_sku_legacy;

-- 2) Crear vista que emula el schema de sell_in_sku
CREATE OR REPLACE VIEW public.sell_in_sku AS
SELECT
  cliente_key AS cliente,
  sku,
  anio,
  mes,
  SUM(piezas)::INTEGER AS piezas,
  SUM(monto)           AS monto_pesos
FROM public.facturacion_clientes
WHERE cliente_key IS NOT NULL
GROUP BY cliente_key, sku, anio, mes;

COMMENT ON VIEW public.sell_in_sku IS
  'VISTA derivada de facturacion_clientes — fuente canónica de sell-in desde 2026-05-14. La tabla original se conserva como sell_in_sku_legacy.';
