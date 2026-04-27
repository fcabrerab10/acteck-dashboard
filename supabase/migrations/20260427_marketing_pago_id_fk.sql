-- Fix: marketing_actividades.pago_id no tenía FK a pagos.
-- Resultado: si se borraba un pago, las actividades quedaban con pago_id
-- huérfano (apuntando a un pago inexistente) y el frontend creía que seguían
-- "pagadas", impidiendo que el botón "Cerrar mes" volviera a aparecer.

-- 1) Limpiar pago_id huérfanos
UPDATE public.marketing_actividades
   SET pago_id = NULL
 WHERE pago_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.pagos p WHERE p.id = marketing_actividades.pago_id);

-- 2) Agregar FK con ON DELETE SET NULL (al borrar pago, actividad queda libre)
ALTER TABLE public.marketing_actividades
  DROP CONSTRAINT IF EXISTS marketing_actividades_pago_id_fkey;
ALTER TABLE public.marketing_actividades
  ADD CONSTRAINT marketing_actividades_pago_id_fkey
  FOREIGN KEY (pago_id) REFERENCES public.pagos(id) ON DELETE SET NULL;
