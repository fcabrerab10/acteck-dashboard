-- ═══════════════════════════════════════════════════════════════════════════
-- 20260911 · Actividad del equipo V3
--
-- 1. perfiles.se_evalua — sólo los usuarios marcados reciben evaluación mensual
--    y bono en "Actividad del equipo" (antes se decidía por email hardcodeado).
--    Se marca true a quien ya tiene filas en evaluaciones_mensuales.
--    Se edita desde Administración → Usuarios y permisos ("Se evalúa mensualmente").
-- 2. Auditoría de sync_solicitudes ("Pedir corrida" del importador): se cuelga
--    el trigger genérico fn_auditoria() para que aparezca como "Corrida pedida"
--    en el resumen de acciones por persona.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS se_evalua boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.perfiles.se_evalua IS
  'Recibe evaluación mensual + bono en Actividad del equipo. Se edita en Administración → Usuarios y permisos.';

UPDATE public.perfiles p
   SET se_evalua = true
 WHERE se_evalua = false
   AND EXISTS (SELECT 1 FROM public.evaluaciones_mensuales e WHERE e.user_id = p.user_id);

DO $$
BEGIN
  IF to_regclass('public.sync_solicitudes') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_auditoria ON public.sync_solicitudes';
    EXECUTE 'CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.sync_solicitudes FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria(''id'')';
  END IF;
END;
$$;
