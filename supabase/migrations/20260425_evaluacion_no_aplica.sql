-- Evaluaciones — botón "No aplica" por KPI
-- Fecha: 2026-04-25
--
-- Permite marcar un KPI como N/A en una evaluación específica.
-- El score_base se prorratea sobre los pesos que SÍ aplican
-- (regla de 3 sobre 100). Ej. si un KPI de peso 4 se marca N/A,
-- el resto se evalúa sobre 96 pts y se escala a 100.

-- 1) Columna no_aplica
ALTER TABLE public.evaluacion_lineas
  ADD COLUMN IF NOT EXISTS no_aplica BOOLEAN NOT NULL DEFAULT false;

-- 2) Reemplazar columna generada `puntaje` para que respete no_aplica.
-- (DROP solo si existe la columna generada con el cálculo viejo)
ALTER TABLE public.evaluacion_lineas DROP COLUMN IF EXISTS puntaje;
ALTER TABLE public.evaluacion_lineas
  ADD COLUMN puntaje NUMERIC GENERATED ALWAYS AS (
    CASE
      WHEN no_aplica THEN 0
      ELSE COALESCE((calificacion::numeric / 5.0) * peso_aplicado, 0)
    END
  ) STORED;

-- 3) Recalcular evaluación con prorrateo sobre lo que sí aplica
CREATE OR REPLACE FUNCTION public.recalcular_evaluacion(p_eval_id BIGINT)
RETURNS VOID AS $$
DECLARE
  v_pesos_aplicables NUMERIC;
  v_puntaje_obtenido NUMERIC;
  v_base    NUMERIC;
  v_bonus   NUMERIC;
BEGIN
  SELECT
    COALESCE(SUM(peso_aplicado) FILTER (WHERE NOT no_aplica), 0),
    COALESCE(SUM(puntaje)        FILTER (WHERE NOT no_aplica), 0)
    INTO v_pesos_aplicables, v_puntaje_obtenido
  FROM public.evaluacion_lineas WHERE evaluacion_id = p_eval_id;

  IF v_pesos_aplicables > 0 THEN
    v_base := (v_puntaje_obtenido / v_pesos_aplicables) * 100;
  ELSE
    v_base := 0;
  END IF;

  SELECT
    COALESCE((SELECT SUM(bonus_pts) FROM public.eventos_cliente WHERE evaluacion_id = p_eval_id), 0) +
    COALESCE((SELECT SUM(bonus_pts_aplicado) FROM public.propuestas_equipo WHERE evaluacion_id = p_eval_id), 0) +
    COALESCE((SELECT SUM(puntos) FROM public.evaluacion_bonus WHERE evaluacion_id = p_eval_id), 0)
    INTO v_bonus;

  UPDATE public.evaluaciones
     SET score_base = v_base, bonus_pts = v_bonus, updated_at = now()
   WHERE id = p_eval_id;
END;
$$ LANGUAGE plpgsql;

-- 4) Recalcular todas las evaluaciones existentes con la nueva fórmula
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT evaluacion_id FROM public.evaluacion_lineas LOOP
    PERFORM public.recalcular_evaluacion(r.evaluacion_id);
  END LOOP;
END $$;

COMMENT ON COLUMN public.evaluacion_lineas.no_aplica IS
  'Si true, el KPI no se evalúa esta semana y su peso se excluye del cálculo del score_base (que se prorratea sobre lo que sí aplica).';
