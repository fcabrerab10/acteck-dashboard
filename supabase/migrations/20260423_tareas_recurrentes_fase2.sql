-- Administración Interna — Fase 2: Tareas recurrentes
-- Fecha: 2026-04-23
--
-- Plantillas de tareas que se generan automáticamente (diaria/semanal/mensual).
-- Se expone una función generar_pendientes_recurrentes() que el cliente llama
-- al entrar a la pestaña — idempotente: no duplica si ya se generó hoy.

-- ────────── 1) Tabla ──────────
CREATE TABLE IF NOT EXISTS public.tareas_recurrentes (
  id                   BIGSERIAL PRIMARY KEY,
  tarea                TEXT NOT NULL,
  cuenta               TEXT NOT NULL CHECK (cuenta IN ('mercadolibre','digitalife','pcel','otro')),
  categoria            TEXT,
  responsable          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  responsables         UUID[] NOT NULL DEFAULT '{}',
  prioridad            TEXT NOT NULL DEFAULT 'media' CHECK (prioridad IN ('alta','media','baja')),
  subtareas_plantilla  JSONB NOT NULL DEFAULT '[]'::jsonb,
  notas                TEXT,

  -- Frecuencia
  frecuencia           TEXT NOT NULL CHECK (frecuencia IN ('diaria','semanal','mensual')),
  -- Para 'semanal': array de días (1=lunes .. 7=domingo). Puede ser varios.
  dias_semana          SMALLINT[] NOT NULL DEFAULT '{}',
  -- Para 'mensual': día del mes (1..31). -1 = último día del mes.
  dia_mes              SMALLINT,
  -- Si la tarea debe estar lista N días ANTES del evento real. Ejemplo:
  -- "preparar reunión de martes" se crea el lunes con fecha_limite = lunes.
  -- offset_dias = 0 por default (fecha_limite = día de generación).
  offset_dias          SMALLINT NOT NULL DEFAULT 0,

  activa               BOOLEAN NOT NULL DEFAULT true,
  ultima_generacion    DATE,
  creado_por           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tareas_rec_activa ON public.tareas_recurrentes(activa);
CREATE INDEX IF NOT EXISTS idx_tareas_rec_freq   ON public.tareas_recurrentes(frecuencia);

-- touch updated_at
CREATE OR REPLACE FUNCTION public.tg_tareas_rec_touch()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tareas_rec_touch ON public.tareas_recurrentes;
CREATE TRIGGER trg_tareas_rec_touch
  BEFORE UPDATE ON public.tareas_recurrentes
  FOR EACH ROW EXECUTE FUNCTION public.tg_tareas_rec_touch();

-- ────────── 2) Enlace en pendientes_equipo ──────────
ALTER TABLE public.pendientes_equipo
  ADD COLUMN IF NOT EXISTS origen_recurrente_id BIGINT REFERENCES public.tareas_recurrentes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fecha_generado       DATE;

CREATE INDEX IF NOT EXISTS idx_pendientes_origen ON public.pendientes_equipo(origen_recurrente_id, fecha_generado);

-- ────────── 3) Función generadora ──────────
-- Corre por CADA plantilla activa. Para hoy (o la fecha que pases):
-- - Decide si aplica (según frecuencia)
-- - Verifica que no exista un pendiente ya generado hoy para esta plantilla
-- - Inserta el pendiente y actualiza ultima_generacion
-- Retorna: cuántos pendientes se insertaron.
CREATE OR REPLACE FUNCTION public.generar_pendientes_recurrentes(target_date DATE DEFAULT CURRENT_DATE)
RETURNS INTEGER AS $$
DECLARE
  r             public.tareas_recurrentes%ROWTYPE;
  aplica        BOOLEAN;
  dow           SMALLINT;         -- 1=Lunes .. 7=Domingo
  dom           SMALLINT;         -- día del mes
  ultimo_dia    SMALLINT;
  existe        BIGINT;
  nuevo_id      BIGINT;
  insertados    INTEGER := 0;
  fecha_target  DATE;
BEGIN
  dow        := CASE EXTRACT(ISODOW FROM target_date)::SMALLINT WHEN 0 THEN 7 ELSE EXTRACT(ISODOW FROM target_date)::SMALLINT END;
  dom        := EXTRACT(DAY FROM target_date)::SMALLINT;
  ultimo_dia := EXTRACT(DAY FROM (date_trunc('month', target_date) + INTERVAL '1 month - 1 day'))::SMALLINT;

  FOR r IN SELECT * FROM public.tareas_recurrentes WHERE activa = true LOOP
    aplica := false;

    IF r.frecuencia = 'diaria' THEN
      aplica := true;
    ELSIF r.frecuencia = 'semanal' THEN
      aplica := dow = ANY(r.dias_semana);
    ELSIF r.frecuencia = 'mensual' THEN
      IF r.dia_mes IS NOT NULL THEN
        IF r.dia_mes = -1 THEN
          aplica := dom = ultimo_dia;
        ELSE
          aplica := dom = r.dia_mes OR (r.dia_mes > ultimo_dia AND dom = ultimo_dia);
        END IF;
      END IF;
    END IF;

    IF aplica THEN
      -- Dedupe: verificar si ya existe un pendiente de esta plantilla para hoy
      SELECT id INTO existe
        FROM public.pendientes_equipo
       WHERE origen_recurrente_id = r.id
         AND fecha_generado = target_date
       LIMIT 1;

      IF existe IS NULL THEN
        fecha_target := target_date + (r.offset_dias || ' days')::INTERVAL;

        INSERT INTO public.pendientes_equipo (
          cuenta, tarea, categoria, fecha_limite, estatus, prioridad,
          notas, responsable, responsables, subtareas,
          origen_recurrente_id, fecha_generado, creado_por, ultima_actividad
        ) VALUES (
          r.cuenta,
          r.tarea,
          COALESCE(r.categoria, 'Recurrente'),
          fecha_target,
          'pendiente',
          r.prioridad,
          r.notas,
          r.responsable,
          r.responsables,
          r.subtareas_plantilla,
          r.id,
          target_date,
          r.creado_por,
          now()
        ) RETURNING id INTO nuevo_id;

        UPDATE public.tareas_recurrentes
           SET ultima_generacion = target_date
         WHERE id = r.id;

        insertados := insertados + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN insertados;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permiso de ejecución para authenticated
GRANT EXECUTE ON FUNCTION public.generar_pendientes_recurrentes(DATE) TO authenticated;

-- ────────── 4) RLS ──────────
ALTER TABLE public.tareas_recurrentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tareas_rec_rw ON public.tareas_recurrentes;
CREATE POLICY tareas_rec_rw ON public.tareas_recurrentes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.user_id = auth.uid()
        AND p.activo = true
        AND (p.tipo = 'interno' OR p.es_super_admin = true OR p.rol IN ('super_admin','asistente','admin'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.user_id = auth.uid()
        AND p.activo = true
        AND (p.tipo = 'interno' OR p.es_super_admin = true OR p.rol IN ('super_admin','asistente','admin'))
    )
  );

COMMENT ON TABLE public.tareas_recurrentes IS 'Plantillas de tareas que se replican automáticamente con cadencia diaria/semanal/mensual.';
COMMENT ON COLUMN public.tareas_recurrentes.dias_semana IS 'Array 1..7 (ISO: 1=Lun, 7=Dom). Solo aplica si frecuencia=semanal.';
COMMENT ON COLUMN public.tareas_recurrentes.dia_mes IS 'Día del mes 1..31, o -1 para "último día del mes". Solo aplica si frecuencia=mensual.';
COMMENT ON COLUMN public.tareas_recurrentes.offset_dias IS 'Días de desfase entre la fecha de generación y la fecha_limite del pendiente.';
