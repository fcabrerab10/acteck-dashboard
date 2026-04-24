-- Administración Interna — Fase 1
-- Fecha: 2026-04-23
-- Agrega: prioridad, subtareas (JSONB), multi-responsable (UUID[]),
-- rastreo de arrastre (arrastrado_desde, ultima_actividad), y amplía los estatus.
--
-- Mantiene compatibilidad con el schema previo (columnas existentes no se tocan).

-- ────────── 1) Ampliar estatus ──────────
-- El check original era ('pendiente','en_proceso','listo'); el código ya usa
-- 'urgente' y 'en_pausa', así que relajamos el CHECK para cubrir los 5.
ALTER TABLE public.pendientes_equipo
  DROP CONSTRAINT IF EXISTS pendientes_equipo_estatus_check;

ALTER TABLE public.pendientes_equipo
  ADD CONSTRAINT pendientes_equipo_estatus_check
  CHECK (estatus IN ('pendiente','en_proceso','urgente','en_pausa','listo'));

-- ────────── 2) Nuevas columnas ──────────
ALTER TABLE public.pendientes_equipo
  ADD COLUMN IF NOT EXISTS prioridad         TEXT NOT NULL DEFAULT 'media'
                           CHECK (prioridad IN ('alta','media','baja')),
  ADD COLUMN IF NOT EXISTS subtareas         JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS responsables      UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS arrastrado_desde  DATE,
  ADD COLUMN IF NOT EXISTS ultima_actividad  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS completado_en     TIMESTAMPTZ;

-- Migrar responsable (single) → responsables (array) para registros existentes
UPDATE public.pendientes_equipo
   SET responsables = ARRAY[responsable]
 WHERE responsable IS NOT NULL
   AND (responsables IS NULL OR array_length(responsables, 1) IS NULL);

-- ────────── 3) Índices ──────────
CREATE INDEX IF NOT EXISTS idx_pendientes_prioridad    ON public.pendientes_equipo(prioridad);
CREATE INDEX IF NOT EXISTS idx_pendientes_responsables ON public.pendientes_equipo USING gin (responsables);
CREATE INDEX IF NOT EXISTS idx_pendientes_ult_act      ON public.pendientes_equipo(ultima_actividad);

-- ────────── 4) Trigger: ultima_actividad + completado_en ──────────
CREATE OR REPLACE FUNCTION public.tg_pendientes_actividad()
RETURNS TRIGGER AS $$
BEGIN
  -- ultima_actividad se refresca en cualquier UPDATE relevante
  IF (TG_OP = 'UPDATE') THEN
    IF NEW.estatus IS DISTINCT FROM OLD.estatus
       OR NEW.tarea IS DISTINCT FROM OLD.tarea
       OR NEW.notas IS DISTINCT FROM OLD.notas
       OR NEW.subtareas IS DISTINCT FROM OLD.subtareas
       OR NEW.prioridad IS DISTINCT FROM OLD.prioridad
       OR NEW.fecha_limite IS DISTINCT FROM OLD.fecha_limite THEN
      NEW.ultima_actividad = now();
    END IF;

    -- Marcar/desmarcar completado_en al transicionar a/desde 'listo'
    IF NEW.estatus = 'listo' AND (OLD.estatus IS NULL OR OLD.estatus <> 'listo') THEN
      NEW.completado_en = now();
    ELSIF NEW.estatus <> 'listo' AND OLD.estatus = 'listo' THEN
      NEW.completado_en = NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pendientes_actividad ON public.pendientes_equipo;
CREATE TRIGGER trg_pendientes_actividad
  BEFORE UPDATE ON public.pendientes_equipo
  FOR EACH ROW EXECUTE FUNCTION public.tg_pendientes_actividad();

-- ────────── 5) RLS: mantener solo internos activos ──────────
-- Reemplazamos la policy previa (que filtraba por rol legacy) por una
-- basada en tipo=interno. Los externos NO ven administración interna.
DROP POLICY IF EXISTS pendientes_rw ON public.pendientes_equipo;
CREATE POLICY pendientes_rw ON public.pendientes_equipo
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

DROP POLICY IF EXISTS eventos_rw ON public.eventos_equipo;
CREATE POLICY eventos_rw ON public.eventos_equipo
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

-- ────────── 6) Comentarios ──────────
COMMENT ON COLUMN public.pendientes_equipo.prioridad IS 'alta|media|baja — chip de color en la tarjeta';
COMMENT ON COLUMN public.pendientes_equipo.subtareas IS 'JSONB array: [{id:string, texto:string, hecho:boolean}]';
COMMENT ON COLUMN public.pendientes_equipo.responsables IS 'UUID[] de perfiles asignados (multi-responsable). El campo legacy responsable se conserva por compat.';
COMMENT ON COLUMN public.pendientes_equipo.arrastrado_desde IS 'Si la tarea se auto-arrastró a la semana actual, guarda la fecha original.';
COMMENT ON COLUMN public.pendientes_equipo.ultima_actividad IS 'Última modificación relevante — usada para detectar tareas estancadas.';
