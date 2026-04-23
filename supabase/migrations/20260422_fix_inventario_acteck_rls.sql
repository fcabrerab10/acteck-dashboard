-- Fix: inventario_acteck solo tenía policy SELECT para 'anon', no para
-- 'authenticated'. El frontend (logueado con JWT) caía al rol authenticated
-- y la policy SELECT no lo cubría → PostgREST devolvía 0 filas silenciosamente.
-- Consecuencia: la columna 'Inv Acteck' en Estrategia de Producto salía en 0
-- para todos los SKUs.
--
-- Fix: crear policy SELECT explícita para authenticated.

DROP POLICY IF EXISTS inventario_acteck_select ON public.inventario_acteck;
CREATE POLICY inventario_acteck_select ON public.inventario_acteck
  FOR SELECT TO authenticated USING (true);
