-- Evaluaciones de desempeño semanales
-- Fecha: 2026-04-25
--
-- Modelo:
-- - Eval semanal (lunes-viernes) sobre 100 pts (7 secciones)
-- - Score final = (eval_base × 0.8) + bonus_extras  → meta $3,000 al 80% (eval base 100% sin bonus)
-- - Bono mensual = mapping del score final mensual (promedio 4 semanas + bonus del mes)

-- ════════ 1) Plantilla de KPIs ════════
CREATE TABLE IF NOT EXISTS public.evaluaciones_kpis_template (
  id           BIGSERIAL PRIMARY KEY,
  seccion      TEXT NOT NULL,                 -- mercadolibre, marketing, recurrentes, digitalife, pcel, softskills, propuestas
  kpi_codigo   TEXT NOT NULL UNIQUE,
  descripcion  TEXT NOT NULL,
  peso         INTEGER NOT NULL,              -- pts máximos del KPI dentro de los 100
  orden        INTEGER NOT NULL DEFAULT 0,
  auto_calc    BOOLEAN NOT NULL DEFAULT false,
  activo       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed (los 7+6+1+3+3+5+1 = 26 KPIs y un slot de propuestas)
INSERT INTO public.evaluaciones_kpis_template (seccion, kpi_codigo, descripcion, peso, orden, auto_calc) VALUES
  -- I. Mercado Libre operativo (30 pts, 7 KPIs, manual)
  ('mercadolibre', 'ml_mensajes_postventa',  'Mensajes sin respuesta al cierre del día',                5, 1, false),
  ('mercadolibre', 'ml_tiempo_respuesta',    'Tiempo promedio de respuesta a preguntas (<1h)',          4, 2, false),
  ('mercadolibre', 'ml_reclamos_24h',        'Reclamos gestionados en menos de 24h',                    4, 3, false),
  ('mercadolibre', 'ml_reputacion',          'Reputación verde oscuro sostenida',                       5, 4, false),
  ('mercadolibre', 'ml_publicaciones',       'Publicaciones sin alertas activas',                       4, 5, false),
  ('mercadolibre', 'ml_productos',           'Productos actualizados en plazo',                         4, 6, false),
  ('mercadolibre', 'ml_promociones',         'Promociones activas correctas (master e-commerce)',       4, 7, false),

  -- II. Plan de Marketing DGL+PCEL (20 pts, 6 KPIs, manual)
  ('marketing', 'mkt_conoce_plan',           'Conoce y revisó el plan de marketing activo',             4, 1, false),
  ('marketing', 'mkt_seguimiento',           'Seguimiento puntual a actividades del plan',              4, 2, false),
  ('marketing', 'mkt_presupuesto',           'Cuidó el presupuesto y reportó excesos a tiempo',         3, 3, false),
  ('marketing', 'mkt_errores',               'Detectó y reportó errores/inconsistencias en el plan',    3, 4, false),
  ('marketing', 'mkt_peticiones',            'Atendió peticiones de las marcas (<48h hábiles)',         3, 5, false),
  ('marketing', 'mkt_visibilidad',           'Verificó cumplimiento de compromisos de visibilidad',     3, 6, false),

  -- III. Cumplimiento tareas recurrentes (10 pts, 1 KPI, AUTO)
  ('recurrentes', 'rec_cumplimiento',        '% de tareas recurrentes ejecutadas a tiempo en la semana', 10, 1, true),

  -- IV. Digitalife operativo (8 pts, 3 KPIs, manual)
  ('digitalife', 'dgl_exhibicion',           'Mejora de exhibición del producto en sucursales',         3, 1, false),
  ('digitalife', 'dgl_visibilidad',          'Compromisos de visibilidad cumplidos',                    3, 2, false),
  ('digitalife', 'dgl_diseno',               'Solicitudes de diseño atendidas (adelante 1 mes)',        2, 3, false),

  -- V. PCEL operativo (8 pts, 3 KPIs, manual)
  ('pcel', 'pcel_exhibicion',                'Mejora de exhibición del producto en sucursales',         3, 1, false),
  ('pcel', 'pcel_visibilidad',               'Compromisos de visibilidad cumplidos',                    3, 2, false),
  ('pcel', 'pcel_diseno',                    'Solicitudes de diseño atendidas (adelante 1 mes)',        2, 3, false),

  -- VI. Soft skills (9 pts, 5 KPIs, manual semanal)
  ('softskills', 'ss_comunicacion',          'Comunicación efectiva (claridad, escucha activa)',        2, 1, false),
  ('softskills', 'ss_equipo',                'Trabajo en equipo (colaboración interna y marcas)',       2, 2, false),
  ('softskills', 'ss_adaptabilidad',         'Adaptabilidad ante cambios de prioridad',                 2, 3, false),
  ('softskills', 'ss_profesionalismo',       'Profesionalismo (responsabilidad, ética)',                2, 4, false),
  ('softskills', 'ss_aprendizaje',           'Aprendizaje continuo (cursos, feedback)',                 1, 5, false),

  -- VII. Propuestas de mejora (15 pts, 1 KPI agregado, manual basado en lista)
  ('propuestas', 'prop_calidad',             'Calidad e impacto de propuestas registradas en la semana',15, 1, false)
ON CONFLICT (kpi_codigo) DO UPDATE SET
  seccion = EXCLUDED.seccion,
  descripcion = EXCLUDED.descripcion,
  peso = EXCLUDED.peso,
  orden = EXCLUDED.orden,
  auto_calc = EXCLUDED.auto_calc;

-- ════════ 2) Evaluaciones semanales ════════
CREATE TABLE IF NOT EXISTS public.evaluaciones (
  id              BIGSERIAL PRIMARY KEY,
  persona_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  semana_inicio   DATE NOT NULL,        -- lunes
  semana_fin      DATE NOT NULL,        -- viernes
  anio            INTEGER NOT NULL,
  mes             INTEGER NOT NULL,
  semana_iso      INTEGER NOT NULL,
  estado          TEXT NOT NULL DEFAULT 'draft' CHECK (estado IN ('draft','cerrada')),

  -- Calculados
  score_base      NUMERIC NOT NULL DEFAULT 0,    -- 0-100 suma de KPIs
  bonus_pts       NUMERIC NOT NULL DEFAULT 0,    -- suma de eventos + propuestas + cursos + etc.
  score_final     NUMERIC GENERATED ALWAYS AS (score_base * 0.8 + bonus_pts) STORED,
  bono_mxn        NUMERIC,                       -- calculado al cerrar

  notas_kam       TEXT,
  fortalezas      TEXT,
  oportunidades   TEXT,
  plan_accion     TEXT,

  cerrado_en      TIMESTAMPTZ,
  creado_por      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (persona_user_id, semana_inicio)
);

CREATE INDEX IF NOT EXISTS idx_eval_persona_semana ON public.evaluaciones(persona_user_id, semana_inicio DESC);
CREATE INDEX IF NOT EXISTS idx_eval_estado         ON public.evaluaciones(estado);
CREATE INDEX IF NOT EXISTS idx_eval_anio_mes       ON public.evaluaciones(anio, mes);

-- ════════ 3) Líneas calificadas ════════
CREATE TABLE IF NOT EXISTS public.evaluacion_lineas (
  id              BIGSERIAL PRIMARY KEY,
  evaluacion_id   BIGINT NOT NULL REFERENCES public.evaluaciones(id) ON DELETE CASCADE,
  kpi_id          BIGINT NOT NULL REFERENCES public.evaluaciones_kpis_template(id),
  calificacion    INTEGER CHECK (calificacion IS NULL OR calificacion BETWEEN 1 AND 5),
  puntaje         NUMERIC GENERATED ALWAYS AS (
    COALESCE((calificacion::numeric / 5.0) * peso_aplicado, 0)
  ) STORED,
  peso_aplicado   INTEGER NOT NULL,             -- snapshot del peso al momento (por si cambia el template)
  comentarios     TEXT,
  auto_sugerido   NUMERIC,                       -- si es auto_calc, valor sugerido por sistema
  UNIQUE (evaluacion_id, kpi_id)
);

CREATE INDEX IF NOT EXISTS idx_eval_lineas_eval ON public.evaluacion_lineas(evaluacion_id);

-- ════════ 4) Propuestas de mejora (persistente) ════════
CREATE TABLE IF NOT EXISTS public.propuestas_equipo (
  id                  BIGSERIAL PRIMARY KEY,
  persona_user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fecha_propuesta     DATE NOT NULL DEFAULT CURRENT_DATE,
  descripcion         TEXT NOT NULL,
  area_impacto        TEXT,
  beneficio_esperado  TEXT,
  cuenta              TEXT CHECK (cuenta IS NULL OR cuenta IN ('digitalife','pcel','mercadolibre','interno','general')),
  estatus             TEXT NOT NULL DEFAULT 'propuesta'
                      CHECK (estatus IN ('propuesta','en_revision','aprobada','rechazada','implementada')),
  fecha_implementacion DATE,
  resultado_avance    TEXT,
  calificacion_kam    INTEGER CHECK (calificacion_kam IS NULL OR calificacion_kam BETWEEN 1 AND 5),
  bonus_pts_aplicado  NUMERIC DEFAULT 0,        -- al implementarse, KAM puede otorgar bonus extra
  evaluacion_id       BIGINT REFERENCES public.evaluaciones(id) ON DELETE SET NULL,
  notas_kam           TEXT,
  creado_por          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prop_persona ON public.propuestas_equipo(persona_user_id, fecha_propuesta DESC);
CREATE INDEX IF NOT EXISTS idx_prop_estatus ON public.propuestas_equipo(estatus);

-- ════════ 5) Eventos de cliente ════════
CREATE TABLE IF NOT EXISTS public.eventos_cliente (
  id              BIGSERIAL PRIMARY KEY,
  persona_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fecha           DATE NOT NULL,
  cliente         TEXT,                          -- digitalife, pcel, mercadolibre, otro
  lugar           TEXT,
  descripcion     TEXT NOT NULL,

  -- 4 criterios 1-5 cada uno (max 20)
  preparacion     INTEGER CHECK (preparacion IS NULL OR preparacion BETWEEN 1 AND 5),
  cobertura       INTEGER CHECK (cobertura IS NULL OR cobertura BETWEEN 1 AND 5),
  reporte         INTEGER CHECK (reporte IS NULL OR reporte BETWEEN 1 AND 5),
  resultados      INTEGER CHECK (resultados IS NULL OR resultados BETWEEN 1 AND 5),

  -- Bonus aplicado por evento
  bonus_pts       NUMERIC NOT NULL DEFAULT 0,
  evaluacion_id   BIGINT REFERENCES public.evaluaciones(id) ON DELETE SET NULL,

  notas_kam       TEXT,
  creado_por      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eventos_persona_fecha ON public.eventos_cliente(persona_user_id, fecha DESC);

-- ════════ 6) Bonus extras genéricos (cursos, reconocimientos, iniciativas) ════════
CREATE TABLE IF NOT EXISTS public.evaluacion_bonus (
  id              BIGSERIAL PRIMARY KEY,
  evaluacion_id   BIGINT NOT NULL REFERENCES public.evaluaciones(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL CHECK (tipo IN ('curso','reconocimiento','iniciativa','otro')),
  descripcion     TEXT NOT NULL,
  puntos          NUMERIC NOT NULL DEFAULT 0,
  creado_por      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eval_bonus_eval ON public.evaluacion_bonus(evaluacion_id);

-- ════════ 7) Triggers ════════
CREATE OR REPLACE FUNCTION public.tg_eval_touch()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_eval_touch ON public.evaluaciones;
CREATE TRIGGER trg_eval_touch BEFORE UPDATE ON public.evaluaciones
  FOR EACH ROW EXECUTE FUNCTION public.tg_eval_touch();

DROP TRIGGER IF EXISTS trg_prop_touch ON public.propuestas_equipo;
CREATE TRIGGER trg_prop_touch BEFORE UPDATE ON public.propuestas_equipo
  FOR EACH ROW EXECUTE FUNCTION public.tg_eval_touch();

DROP TRIGGER IF EXISTS trg_evt_touch ON public.eventos_cliente;
CREATE TRIGGER trg_evt_touch BEFORE UPDATE ON public.eventos_cliente
  FOR EACH ROW EXECUTE FUNCTION public.tg_eval_touch();

-- Recalc score_base + bonus_pts cuando cambian líneas, eventos, propuestas, bonus
CREATE OR REPLACE FUNCTION public.recalcular_evaluacion(p_eval_id BIGINT)
RETURNS VOID AS $$
DECLARE
  v_base    NUMERIC;
  v_bonus   NUMERIC;
BEGIN
  -- Score base = suma de puntajes de líneas
  SELECT COALESCE(SUM(puntaje), 0) INTO v_base
  FROM public.evaluacion_lineas WHERE evaluacion_id = p_eval_id;

  -- Bonus = eventos vinculados + propuestas vinculadas + bonus extras
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

CREATE OR REPLACE FUNCTION public.tg_recalc_eval()
RETURNS TRIGGER AS $$
DECLARE v_id BIGINT;
BEGIN
  v_id := COALESCE(NEW.evaluacion_id, OLD.evaluacion_id);
  IF v_id IS NOT NULL THEN PERFORM public.recalcular_evaluacion(v_id); END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalc_lineas ON public.evaluacion_lineas;
CREATE TRIGGER trg_recalc_lineas AFTER INSERT OR UPDATE OR DELETE ON public.evaluacion_lineas
  FOR EACH ROW EXECUTE FUNCTION public.tg_recalc_eval();

DROP TRIGGER IF EXISTS trg_recalc_eventos ON public.eventos_cliente;
CREATE TRIGGER trg_recalc_eventos AFTER INSERT OR UPDATE OR DELETE ON public.eventos_cliente
  FOR EACH ROW EXECUTE FUNCTION public.tg_recalc_eval();

DROP TRIGGER IF EXISTS trg_recalc_props ON public.propuestas_equipo;
CREATE TRIGGER trg_recalc_props AFTER INSERT OR UPDATE OR DELETE ON public.propuestas_equipo
  FOR EACH ROW EXECUTE FUNCTION public.tg_recalc_eval();

DROP TRIGGER IF EXISTS trg_recalc_bonus ON public.evaluacion_bonus;
CREATE TRIGGER trg_recalc_bonus AFTER INSERT OR UPDATE OR DELETE ON public.evaluacion_bonus
  FOR EACH ROW EXECUTE FUNCTION public.tg_recalc_eval();

-- ════════ 8) Función: cumplimiento de tareas recurrentes en una semana ════════
-- Devuelve % de tareas recurrentes esperadas vs cumplidas en el rango.
CREATE OR REPLACE FUNCTION public.cumplimiento_recurrentes(
  p_user_id UUID,
  p_inicio  DATE,
  p_fin     DATE
) RETURNS TABLE (esperadas INTEGER, cumplidas INTEGER, pct NUMERIC) AS $$
BEGIN
  RETURN QUERY
  WITH gen AS (
    -- Pendientes generados desde recurrentes en el rango, asignados al user
    SELECT pe.id, pe.estatus, pe.fecha_limite
    FROM public.pendientes_equipo pe
    WHERE pe.origen_recurrente_id IS NOT NULL
      AND pe.fecha_generado IS NOT NULL
      AND pe.fecha_generado BETWEEN p_inicio AND p_fin
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
  FROM gen;
END;
$$ LANGUAGE plpgsql;

-- ════════ 9) Función: cálculo del bono mensual ════════
-- Mapping:
--   <80% : proporcional ($37.50 por punto, así 80% = $3,000)
--   ≥80% : $3,000 + $50 por cada punto adicional
--   tope sugerido: 120% = $5,000
CREATE OR REPLACE FUNCTION public.calcular_bono_mensual(p_score NUMERIC)
RETURNS NUMERIC AS $$
BEGIN
  IF p_score IS NULL OR p_score <= 0 THEN RETURN 0; END IF;
  IF p_score < 80 THEN
    RETURN ROUND(p_score * 37.5, 2);
  ELSE
    RETURN ROUND(3000 + (p_score - 80) * 50, 2);
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ════════ 10) RLS ════════
ALTER TABLE public.evaluaciones_kpis_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluaciones               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluacion_lineas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.propuestas_equipo          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos_cliente            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluacion_bonus           ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier interno puede leer
DROP POLICY IF EXISTS eval_kpi_read ON public.evaluaciones_kpis_template;
CREATE POLICY eval_kpi_read ON public.evaluaciones_kpis_template
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.perfiles p
      WHERE p.user_id = auth.uid() AND p.activo = true
      AND (p.tipo = 'interno' OR p.es_super_admin = true OR p.rol IN ('super_admin','asistente','admin')))
  );

-- Escritura template: solo super_admin
DROP POLICY IF EXISTS eval_kpi_write ON public.evaluaciones_kpis_template;
CREATE POLICY eval_kpi_write ON public.evaluaciones_kpis_template
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = auth.uid() AND p.es_super_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = auth.uid() AND p.es_super_admin = true));

-- Helper: usuario es super_admin?
-- Lectura: super_admin ve todo, persona evaluada solo ve la suya
DROP POLICY IF EXISTS eval_read ON public.evaluaciones;
CREATE POLICY eval_read ON public.evaluaciones
  FOR SELECT TO authenticated
  USING (
    persona_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = auth.uid() AND p.es_super_admin = true)
  );

-- Escritura: solo super_admin
DROP POLICY IF EXISTS eval_write ON public.evaluaciones;
CREATE POLICY eval_write ON public.evaluaciones
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = auth.uid() AND p.es_super_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = auth.uid() AND p.es_super_admin = true));

-- Lo mismo para sub-tablas
DROP POLICY IF EXISTS eval_lineas_read ON public.evaluacion_lineas;
CREATE POLICY eval_lineas_read ON public.evaluacion_lineas
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.evaluaciones e
            WHERE e.id = evaluacion_id
              AND (e.persona_user_id = auth.uid()
                OR EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = auth.uid() AND p.es_super_admin = true)))
  );
DROP POLICY IF EXISTS eval_lineas_write ON public.evaluacion_lineas;
CREATE POLICY eval_lineas_write ON public.evaluacion_lineas
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = auth.uid() AND p.es_super_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = auth.uid() AND p.es_super_admin = true));

-- Propuestas: persona ve las suyas, super_admin todas. Persona puede crear/editar las suyas; super_admin puede todo.
DROP POLICY IF EXISTS prop_read ON public.propuestas_equipo;
CREATE POLICY prop_read ON public.propuestas_equipo
  FOR SELECT TO authenticated
  USING (
    persona_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = auth.uid() AND p.es_super_admin = true)
  );

DROP POLICY IF EXISTS prop_insert ON public.propuestas_equipo;
CREATE POLICY prop_insert ON public.propuestas_equipo
  FOR INSERT TO authenticated
  WITH CHECK (
    persona_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = auth.uid() AND p.es_super_admin = true)
  );

DROP POLICY IF EXISTS prop_update ON public.propuestas_equipo;
CREATE POLICY prop_update ON public.propuestas_equipo
  FOR UPDATE TO authenticated
  USING (
    persona_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = auth.uid() AND p.es_super_admin = true)
  )
  WITH CHECK (
    persona_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = auth.uid() AND p.es_super_admin = true)
  );

DROP POLICY IF EXISTS prop_delete ON public.propuestas_equipo;
CREATE POLICY prop_delete ON public.propuestas_equipo
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = auth.uid() AND p.es_super_admin = true));

-- Eventos cliente: igual que evaluaciones
DROP POLICY IF EXISTS evt_read ON public.eventos_cliente;
CREATE POLICY evt_read ON public.eventos_cliente
  FOR SELECT TO authenticated
  USING (
    persona_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = auth.uid() AND p.es_super_admin = true)
  );
DROP POLICY IF EXISTS evt_write ON public.eventos_cliente;
CREATE POLICY evt_write ON public.eventos_cliente
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = auth.uid() AND p.es_super_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = auth.uid() AND p.es_super_admin = true));

-- Bonus: igual
DROP POLICY IF EXISTS eval_bonus_read ON public.evaluacion_bonus;
CREATE POLICY eval_bonus_read ON public.evaluacion_bonus
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.evaluaciones e
            WHERE e.id = evaluacion_id
              AND (e.persona_user_id = auth.uid()
                OR EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = auth.uid() AND p.es_super_admin = true)))
  );
DROP POLICY IF EXISTS eval_bonus_write ON public.evaluacion_bonus;
CREATE POLICY eval_bonus_write ON public.evaluacion_bonus
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = auth.uid() AND p.es_super_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = auth.uid() AND p.es_super_admin = true));

GRANT EXECUTE ON FUNCTION public.cumplimiento_recurrentes(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calcular_bono_mensual(NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalcular_evaluacion(BIGINT) TO authenticated;

-- ════════ Comentarios ════════
COMMENT ON TABLE  public.evaluaciones IS
  'Evaluaciones semanales de desempeño. score_final = score_base × 0.8 + bonus_pts. Bono = mapping de score_final.';
COMMENT ON COLUMN public.evaluaciones.score_final IS
  'Score final ya ponderado al 80%: 100% en eval base = 80 pts en score_final. Para 100+ score se requieren bonus extras.';
