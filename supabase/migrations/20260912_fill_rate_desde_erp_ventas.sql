-- 2026-09-12 · El cruce de fill rate de OCs deja de leer la tabla vieja `ventas_erp`.
--
-- `ventas_erp` no se carga desde el 2026-07-06 (la sustituyó `erp_ventas`, que el
-- puente SQL de la Mac mini actualiza cada hora). `actualizar_fill_rate_oc()` —que
-- llama `api/cron.js?task=actualizar-fill-rates` vía `actualizar_fill_rate_todas()`—
-- seguía cruzando contra la tabla congelada, así que ninguna OC facturada después
-- de julio subía su `cantidad_surtida`.
--
-- Mapeo de columnas ventas_erp → erp_ventas (mismo significado, mismo origen ERP):
--   cliente_nombre   → cliente_nombre    (idénticos: 'PC ONLINE', 'API GLOBAL', …)
--   referencia       → referencia
--   articulo         → articulo
--   movimiento_venta → movimiento_venta
--   piezas           → COALESCE(unidades, piezas, 0)   ← regla de 20260911_piezas_coalesce_unidades.sql
--                       (la carga del ERP trae `Unidades` vacía desde el 2026-09-10)
--
-- Sin cambios: la firma, el regex de word boundary, el LEAST() ni el trigger de fill_rate.
-- Revertir = volver a poner `public.ventas_erp v` y `COALESCE(v.piezas, 0)`
-- (definición íntegra en supabase/migrations/20260424_oc_cruce_erp.sql).

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
      SUM(COALESCE(v.unidades, v.piezas, 0))::NUMERIC AS piezas_total
    FROM public.erp_ventas v
    WHERE v.cliente_nombre = v_erp_nombre
      AND v.referencia ~* ('\m' || v_oc_numero || '\M')  -- word boundary match
      AND COALESCE(v.movimiento_venta, 'Factura') = 'Factura'
      AND COALESCE(v.unidades, v.piezas, 0) > 0
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

COMMENT ON FUNCTION public.actualizar_fill_rate_oc IS
  'Cruza una OC con erp_ventas (desde 2026-09-12; antes ventas_erp, congelada en julio): busca facturas con cliente_nombre equivalente y referencia que contenga el oc_numero (regex). Actualiza cantidad_surtida, lo que dispara el recálculo de fill_rate y estado vía trigger.';

GRANT EXECUTE ON FUNCTION public.actualizar_fill_rate_oc(BIGINT) TO authenticated;

notify pgrst, 'reload schema';
