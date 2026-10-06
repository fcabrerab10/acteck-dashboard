-- Sell Out y Sell In de la empresa en el celular (3.80.0 · 2026-10-05)
--
-- La tabla «Detalle por SKU × 12 meses» del celular necesita sku × mes de TODAS las cuentas / clientes.
-- Bajar mv_sellout_cuenta_sku_mes (cuenta × sku × mes: 54 K filas para dos años, ~4 MB) o
-- mv_sellin_global_sku_canal_anio (sku × canal × es_clave × año: 7.9 K filas) al teléfono era demasiado.
--
-- Dos vistas VIVAS (no materializadas: leen MVs que ya refresca el puente) con los 12 meses pivotados en arrays,
-- 1 fila por sku × año, importes redondeados a entero para que pesen menos:
--   v_sellout_sku_anio  ← mv_sellout_cuenta_sku_mes  (3.0 K filas para 2 años · 65 ms)
--   v_sellin_global_sku_anio ← mv_sellin_global_sku_canal_anio (2.9 K filas para 2 años · ~10 ms)
-- Índice 0 = enero … 11 = diciembre; NULL = ese mes no tuvo fila.

CREATE OR REPLACE VIEW public.v_sellout_sku_anio AS
SELECT
  s.sku,
  s.anio,
  max(s.marca)     AS marca,
  max(s.categoria) AS categoria,
  count(DISTINCT s.cuenta) FILTER (WHERE s.importe <> 0) AS cuentas,
  ARRAY[
    round(sum(s.importe) FILTER (WHERE s.mes = 1)),  round(sum(s.importe) FILTER (WHERE s.mes = 2)),
    round(sum(s.importe) FILTER (WHERE s.mes = 3)),  round(sum(s.importe) FILTER (WHERE s.mes = 4)),
    round(sum(s.importe) FILTER (WHERE s.mes = 5)),  round(sum(s.importe) FILTER (WHERE s.mes = 6)),
    round(sum(s.importe) FILTER (WHERE s.mes = 7)),  round(sum(s.importe) FILTER (WHERE s.mes = 8)),
    round(sum(s.importe) FILTER (WHERE s.mes = 9)),  round(sum(s.importe) FILTER (WHERE s.mes = 10)),
    round(sum(s.importe) FILTER (WHERE s.mes = 11)), round(sum(s.importe) FILTER (WHERE s.mes = 12))
  ]::numeric[] AS importe,
  ARRAY[
    round(sum(s.cantidad) FILTER (WHERE s.mes = 1)),  round(sum(s.cantidad) FILTER (WHERE s.mes = 2)),
    round(sum(s.cantidad) FILTER (WHERE s.mes = 3)),  round(sum(s.cantidad) FILTER (WHERE s.mes = 4)),
    round(sum(s.cantidad) FILTER (WHERE s.mes = 5)),  round(sum(s.cantidad) FILTER (WHERE s.mes = 6)),
    round(sum(s.cantidad) FILTER (WHERE s.mes = 7)),  round(sum(s.cantidad) FILTER (WHERE s.mes = 8)),
    round(sum(s.cantidad) FILTER (WHERE s.mes = 9)),  round(sum(s.cantidad) FILTER (WHERE s.mes = 10)),
    round(sum(s.cantidad) FILTER (WHERE s.mes = 11)), round(sum(s.cantidad) FILTER (WHERE s.mes = 12))
  ]::numeric[] AS cantidad
FROM public.mv_sellout_cuenta_sku_mes s
WHERE s.sku IS NOT NULL
GROUP BY s.sku, s.anio;

COMMENT ON VIEW public.v_sellout_sku_anio IS
  'Sell out de todas las cuentas por sku × año con los 12 meses pivotados (importe[12], cantidad[12], enteros). Fuente mv_sellout_cuenta_sku_mes. Celular 2026-10-05.';

-- Los arrays de la MV vienen por sku × canal × es_clave: aquí se suman posición a posición.
CREATE OR REPLACE VIEW public.v_sellin_global_sku_anio AS
SELECT
  m.sku,
  m.anio,
  ARRAY[
    round(sum(m.piezas[1])),  round(sum(m.piezas[2])),  round(sum(m.piezas[3])),  round(sum(m.piezas[4])),
    round(sum(m.piezas[5])),  round(sum(m.piezas[6])),  round(sum(m.piezas[7])),  round(sum(m.piezas[8])),
    round(sum(m.piezas[9])),  round(sum(m.piezas[10])), round(sum(m.piezas[11])), round(sum(m.piezas[12]))
  ]::numeric[] AS piezas,
  ARRAY[
    round(sum(m.monto[1])),  round(sum(m.monto[2])),  round(sum(m.monto[3])),  round(sum(m.monto[4])),
    round(sum(m.monto[5])),  round(sum(m.monto[6])),  round(sum(m.monto[7])),  round(sum(m.monto[8])),
    round(sum(m.monto[9])),  round(sum(m.monto[10])), round(sum(m.monto[11])), round(sum(m.monto[12]))
  ]::numeric[] AS monto
FROM public.mv_sellin_global_sku_canal_anio m
WHERE m.sku IS NOT NULL
GROUP BY m.sku, m.anio;

COMMENT ON VIEW public.v_sellin_global_sku_anio IS
  'Sell in (facturacion_clientes) de todos los clientes por sku × año con los 12 meses pivotados (piezas[12], monto[12], enteros). Fuente mv_sellin_global_sku_canal_anio. Celular 2026-10-05.';

GRANT SELECT ON public.v_sellout_sku_anio, public.v_sellin_global_sku_anio TO authenticated, service_role;
