-- Rendimiento · v_fact_cliente_mes sobre MV (2026-09-12)
--
-- Era una vista viva: GROUP BY cliente_key, anio, mes sobre facturacion_clientes
-- (~90K filas) con un count(DISTINCT sku) → 890 ms cada vez, para devolver 192 filas.
-- La leen Inicio, el Comparador de periodos y las fichas de cliente.
--
-- facturacion_clientes sólo la reescribe refresh_facturacion_clientes(), que es
-- donde ya se refrescan las otras 6 MV de la misma fuente: mismo contrato de
-- frescura que mv_erp_medidas_cliente_mes.
-- El nombre y las columnas de la vista NO cambian: ninguna pantalla se toca.

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_fact_cliente_mes AS
SELECT cliente_key,
       anio,
       mes,
       sum(monto)                  AS monto,
       sum(piezas)                 AS piezas,
       count(DISTINCT sku)::integer AS skus
FROM public.facturacion_clientes
GROUP BY cliente_key, anio, mes;

CREATE UNIQUE INDEX IF NOT EXISTS mv_fact_cliente_mes_pk
  ON public.mv_fact_cliente_mes (cliente_key, anio, mes);
CREATE INDEX IF NOT EXISTS mv_fact_cliente_mes_anio_idx
  ON public.mv_fact_cliente_mes (anio);

CREATE OR REPLACE VIEW public.v_fact_cliente_mes AS
  SELECT cliente_key, anio, mes, monto, piezas, skus FROM public.mv_fact_cliente_mes;

GRANT SELECT ON public.v_fact_cliente_mes TO anon, authenticated, service_role;

ANALYZE public.mv_fact_cliente_mes;
