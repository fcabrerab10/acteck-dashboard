-- Órdenes de Compra — cruce con ventas_erp para calcular fill rate
-- Fecha: 2026-04-24
--
-- Lógica:
-- 1) Mapeo cliente → cliente_nombre en ERP:
--    pcel       → 'PC ONLINE'
--    digitalife → 'API GLOBAL'
--    mercadolibre → (no aplica, ML no manda OC)
-- 2) Match por SKU + cliente_nombre + referencia que contenga el oc_numero (regex).
-- 3) Actualiza cantidad_surtida en ordenes_compra_detalle, lo que dispara
--    el trigger de recálculo de fill_rate/estado en el header.

-- Mapeo estándar (podría ir a tabla pero mantener simple)
CREATE OR REPLACE FUNCTION public.cliente_to_erp_name(p_cliente TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE LOWER(p_cliente)
    WHEN 'pcel'         THEN 'PC ONLINE'
    WHEN 'digitalife'   THEN 'API GLOBAL'
    WHEN 'mercadolibre' THEN 'MERCADO LIBRE'
    ELSE p_cliente
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Actualiza fill rate de UNA OC específica
CREATE OR REPLACE FUNCTION public.actualizar_fill_rate_oc(p_oc_id BIGINT)
RETURNS TABLE(sku TEXT, facturado NUMERIC) AS $$
DECLARE
  v_cliente       TEXT;
  v_oc_numero     TEXT;
  v_erp_nombre    TEXT;
BEGIN
  SELECT cliente, oc_numero INTO v_cliente, v_oc_numero
  FROM public.ordenes_compra WHERE id = p_oc_id;

  IF v_cliente IS NULL THEN
    RAISE EXCEPTION 'OC % no encontrada', p_oc_id;
  END IF;

  v_erp_nombre := public.cliente_to_erp_name(v_cliente);

  RETURN QUERY
  WITH facturado_por_sku AS (
    SELECT
      v.articulo AS sku,
      SUM(COALESCE(v.piezas, 0))::NUMERIC AS piezas_total
    FROM public.ventas_erp v
    WHERE v.cliente_nombre = v_erp_nombre
      AND v.referencia ~* ('\m' || v_oc_numero || '\M')  -- word boundary match
      AND COALESCE(v.movimiento_venta, 'Factura') = 'Factura'
      AND COALESCE(v.piezas, 0) > 0
    GROUP BY v.articulo
  ),
  actualizados AS (
    UPDATE public.ordenes_compra_detalle d
       SET cantidad_surtida = LEAST(f.piezas_total::INTEGER, d.cantidad)
      FROM facturado_por_sku f
     WHERE d.oc_id = p_oc_id AND d.sku = f.sku
     RETURNING d.sku, f.piezas_total AS facturado
  )
  SELECT a.sku, a.facturado FROM actualizados a;
END;
$$ LANGUAGE plpgsql;

-- Actualiza fill rate de TODAS las OCs no canceladas y no completas
-- Uso: SELECT * FROM actualizar_fill_rate_todas();
CREATE OR REPLACE FUNCTION public.actualizar_fill_rate_todas()
RETURNS TABLE(oc_id BIGINT, cliente TEXT, oc_numero TEXT, skus_actualizados INTEGER) AS $$
DECLARE
  r RECORD;
  n INTEGER;
BEGIN
  FOR r IN
    SELECT id, cliente, oc_numero
    FROM public.ordenes_compra
    WHERE estado NOT IN ('completa','cancelada')
    ORDER BY fecha_oc DESC
  LOOP
    SELECT COUNT(*) INTO n FROM public.actualizar_fill_rate_oc(r.id);
    oc_id := r.id;
    cliente := r.cliente;
    oc_numero := r.oc_numero;
    skus_actualizados := n;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.cliente_to_erp_name(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.actualizar_fill_rate_oc(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.actualizar_fill_rate_todas() TO authenticated;

COMMENT ON FUNCTION public.actualizar_fill_rate_oc IS
  'Cruza una OC con ventas_erp: busca facturas con cliente_nombre equivalente y referencia que contenga el oc_numero (regex). Actualiza cantidad_surtida, lo que dispara el recálculo de fill_rate y estado vía trigger.';
