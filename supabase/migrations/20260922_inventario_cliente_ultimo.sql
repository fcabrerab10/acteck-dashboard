-- Última foto semanal del inventario que reporta el cliente (2026-09-22).
-- Fernando: «esta pestaña se tarda mucho en traerme el inv digitalife». Sell Out bajaba las 22 fotos
-- de Digitalife (28,021 filas · 5.7 MB) para quedarse con la última (1,307). Estas vistas devuelven
-- sólo la (anio, semana) más reciente por cliente; el histórico sigue en las tablas para quien lo use
-- (Resumen de clientes por periodo, ficha de SKU en el celular).
CREATE OR REPLACE VIEW public.v_inventario_cliente_ultimo WITH (security_invoker = true) AS
  SELECT t.* FROM public.inventario_cliente t
  JOIN (SELECT cliente, max(anio * 100 + semana) AS k FROM public.inventario_cliente WHERE anio IS NOT NULL GROUP BY cliente) u
    ON u.cliente = t.cliente AND t.anio * 100 + t.semana = u.k;
CREATE OR REPLACE VIEW public.v_inventario_cliente_sucursal_ultimo WITH (security_invoker = true) AS
  SELECT t.* FROM public.inventario_cliente_sucursal t
  JOIN (SELECT cliente, max(anio * 100 + semana) AS k FROM public.inventario_cliente_sucursal WHERE anio IS NOT NULL GROUP BY cliente) u
    ON u.cliente = t.cliente AND t.anio * 100 + t.semana = u.k;
GRANT SELECT ON public.v_inventario_cliente_ultimo, public.v_inventario_cliente_sucursal_ultimo TO anon, authenticated;
