-- Evaluaciones v2 — ajuste de KPIs
-- Fecha: 2026-04-25
--
-- Cambios solicitados por Fernando:
--   - Quitar Digitalife operativo (8 pts) y PCEL operativo (8 pts)
--   - Reemplazar "Plan de Marketing" manual por dos auto-calc por cliente
--   - Agregar "Tareas día a día" (no recurrentes) auto-calc
--   - Actualizar descripciones de ML
--   - Auto-aplicar todos los KPIs auto al cargar la eval

-- ════════ 1) Limpiar template y reseed ════════
-- Borrar líneas viejas (irían a quedar huérfanas)
DELETE FROM public.evaluacion_lineas;
DELETE FROM public.evaluaciones_kpis_template;

-- Reseed con la nueva estructura
INSERT INTO public.evaluaciones_kpis_template (seccion, kpi_codigo, descripcion, peso, orden, auto_calc) VALUES
  -- I. Mercado Libre operativo (30 pts, 7 KPIs, manual)
  ('mercadolibre', 'ml_preguntas_contestadas', 'Todas las preguntas contestadas al cierre del día',     5, 1, false),
  ('mercadolibre', 'ml_tiempo_respuesta',      'Tiempo promedio de respuesta menor a 3 horas',          4, 2, false),
  ('mercadolibre', 'ml_reclamos_24h',          'Reclamos gestionados en menos de 24h',                  4, 3, false),
  ('mercadolibre', 'ml_reputacion',            'Reputación general en verde oscuro',                    5, 4, false),
  ('mercadolibre', 'ml_productos_sin_demora',  'Productos sin demora',                                  4, 5, false),
  ('mercadolibre', 'ml_publicaciones',         'Publicaciones sin alertas activas',                     4, 6, false),
  ('mercadolibre', 'ml_promociones',           'Promociones activas correctas',                         4, 7, false),

  -- II. Plan Marketing Digitalife (15 pts, 1 KPI, AUTO)
  ('marketing_dgl', 'mkt_dgl_cumplimiento',
   '% de actividades de marketing Digitalife completadas vs planeadas en el mes',
   15, 1, true),

  -- III. Plan Marketing PCEL (15 pts, 1 KPI, AUTO)
  ('marketing_pcel', 'mkt_pcel_cumplimiento',
   '% de actividades de marketing PCEL completadas vs planeadas en el mes',
   15, 1, true),

  -- IV. Cumplimiento tareas recurrentes (8 pts, 1 KPI, AUTO)
  ('recurrentes', 'rec_cumplimiento',
   '% de tareas recurrentes ejecutadas a tiempo en la semana',
   8, 1, true),

  -- V. Tareas día a día (7 pts, 1 KPI, AUTO) — NUEVO
  ('tareas_dia', 'tareas_dia_cumplimiento',
   '% de pendientes regulares (no recurrentes) cerrados a tiempo en la semana',
   7, 1, true),

  -- VI. Soft skills (10 pts, 5 KPIs, manual)
  ('softskills', 'ss_comunicacion',     'Comunicación efectiva (claridad, escucha activa)',       2, 1, false),
  ('softskills', 'ss_equipo',           'Trabajo en equipo (colaboración interna y marcas)',      2, 2, false),
  ('softskills', 'ss_adaptabilidad',    'Adaptabilidad ante cambios de prioridad',                2, 3, false),
  ('softskills', 'ss_profesionalismo',  'Profesionalismo (responsabilidad, ética)',               2, 4, false),
  ('softskills', 'ss_aprendizaje',      'Aprendizaje continuo (cursos, feedback)',                2, 5, false),

  -- VII. Propuestas de mejora (15 pts, 1 KPI, manual)
  ('propuestas', 'prop_calidad',        'Calidad e impacto de propuestas registradas en la semana', 15, 1, false);

-- Recrear líneas para evaluaciones existentes que estén en draft
INSERT INTO public.evaluacion_lineas (evaluacion_id, kpi_id, peso_aplicado)
SELECT e.id, t.id, t.peso
FROM public.evaluaciones e
CROSS JOIN public.evaluaciones_kpis_template t
WHERE t.activo = true AND e.estado = 'draft';

-- ════════ 2) Función: cumplimiento de actividades de marketing por cliente ════════
-- % de actividades del cliente con fecha <= fin_periodo, completadas vs total
-- Toma todo el MES hasta el viernes evaluado (vista acumulativa).
CREATE OR REPLACE FUNCTION public.cumplimiento_marketing_cliente(
  p_cliente TEXT,
  p_inicio  DATE,   -- lunes de la semana evaluada
  p_fin     DATE    -- viernes
) RETURNS TABLE (
  totales INTEGER,
  completadas INTEGER,
  pct NUMERIC
) AS $$
DECLARE
  v_anio INTEGER := EXTRACT(YEAR FROM p_fin)::INTEGER;
  v_mes  INTEGER := EXTRACT(MONTH FROM p_fin)::INTEGER;
  v_inicio_mes DATE := DATE_TRUNC('month', p_fin)::DATE;
BEGIN
  RETURN QUERY
  WITH actividades AS (
    SELECT estatus
    FROM public.marketing_actividades
    WHERE cliente = p_cliente
      AND fecha IS NOT NULL
      AND fecha >= v_inicio_mes
      AND fecha <= p_fin
  )
  SELECT
    COUNT(*)::INTEGER AS totales,
    COUNT(*) FILTER (WHERE estatus = 'completado')::INTEGER AS completadas,
    CASE WHEN COUNT(*) > 0
      THEN ROUND( (COUNT(*) FILTER (WHERE estatus = 'completado')::NUMERIC / COUNT(*)) * 100, 1)
      ELSE NULL
    END AS pct
  FROM actividades;
END;
$$ LANGUAGE plpgsql;

-- ════════ 3) Función: cumplimiento de pendientes regulares (no recurrentes) ════════
-- % de pendientes del usuario sin origen_recurrente_id, con fecha_limite en la semana,
-- que están en estatus 'listo'.
CREATE OR REPLACE FUNCTION public.cumplimiento_pendientes_regulares(
  p_user_id UUID,
  p_inicio  DATE,
  p_fin     DATE
) RETURNS TABLE (
  esperadas INTEGER,
  cumplidas INTEGER,
  pct NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH tareas AS (
    SELECT pe.id, pe.estatus
    FROM public.pendientes_equipo pe
    WHERE pe.origen_recurrente_id IS NULL
      AND pe.fecha_limite IS NOT NULL
      AND pe.fecha_limite::DATE BETWEEN p_inicio AND p_fin
      AND (
        pe.responsable = p_user_id
        OR p_user_id = ANY(pe.responsables)
      )
  )
  SELECT
    COUNT(*)::INTEGER AS esperadas,
    COUNT(*) FILTER (WHERE estatus = 'listo')::INTEGER AS cumplidas,
    CASE WHEN COUNT(*) > 0
      THEN ROUND( (COUNT(*) FILTER (WHERE estatus = 'listo')::NUMERIC / COUNT(*)) * 100, 1)
      ELSE NULL
    END AS pct
  FROM tareas;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.cumplimiento_marketing_cliente(TEXT, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cumplimiento_pendientes_regulares(UUID, DATE, DATE) TO authenticated;

COMMENT ON FUNCTION public.cumplimiento_marketing_cliente IS
  'Auto-calc para evaluaciones: % actividades del cliente completadas vs planeadas en el mes hasta p_fin.';
COMMENT ON FUNCTION public.cumplimiento_pendientes_regulares IS
  'Auto-calc para evaluaciones: % de pendientes NO recurrentes del usuario, cerrados a tiempo en el rango.';
