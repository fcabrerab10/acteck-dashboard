-- Administración Interna — Fase 3: Minutas
-- Fecha: 2026-04-23
--
-- Amplía `minutas` con título, asistentes, plantilla y creado_por.
-- Agrega `minuta_acuerdos` (acuerdos/action items vinculados a pendientes_equipo).
-- Triggers: al cerrar un pendiente vinculado, el acuerdo queda como 'listo'.

-- ────────── 1) Ampliar `minutas` ──────────
ALTER TABLE public.minutas
  ADD COLUMN IF NOT EXISTS titulo        TEXT,
  ADD COLUMN IF NOT EXISTS asistentes    JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS plantilla     TEXT,
  ADD COLUMN IF NOT EXISTS creado_por    UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- La minuta legacy sin título toma un default visible
UPDATE public.minutas
   SET titulo = COALESCE(titulo, 'Reunión ' || cliente || ' — ' || to_char(fecha_reunion, 'DD/MM/YYYY'))
 WHERE titulo IS NULL;

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_minutas_cliente ON public.minutas(cliente);
CREATE INDEX IF NOT EXISTS idx_minutas_fecha   ON public.minutas(fecha_reunion DESC);

-- ────────── 2) `minuta_acuerdos` ──────────
CREATE TABLE IF NOT EXISTS public.minuta_acuerdos (
  id            BIGSERIAL PRIMARY KEY,
  minuta_id     UUID NOT NULL REFERENCES public.minutas(id) ON DELETE CASCADE,
  descripcion   TEXT NOT NULL,
  responsable   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  fecha_limite  DATE,
  prioridad     TEXT NOT NULL DEFAULT 'media' CHECK (prioridad IN ('alta','media','baja')),
  estado        TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','listo')),
  pendiente_id  BIGINT REFERENCES public.pendientes_equipo(id) ON DELETE SET NULL,
  orden         INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_acuerdos_minuta     ON public.minuta_acuerdos(minuta_id);
CREATE INDEX IF NOT EXISTS idx_acuerdos_pendiente  ON public.minuta_acuerdos(pendiente_id);
CREATE INDEX IF NOT EXISTS idx_acuerdos_resp       ON public.minuta_acuerdos(responsable);

-- touch updated_at
CREATE OR REPLACE FUNCTION public.tg_acuerdos_touch()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_acuerdos_touch ON public.minuta_acuerdos;
CREATE TRIGGER trg_acuerdos_touch
  BEFORE UPDATE ON public.minuta_acuerdos
  FOR EACH ROW EXECUTE FUNCTION public.tg_acuerdos_touch();

-- ────────── 3) Sincronización acuerdo ↔ pendiente ──────────
-- Si el pendiente vinculado se marca 'listo' ⇒ el acuerdo pasa a 'listo'.
-- Si vuelve a abrirse ⇒ el acuerdo regresa a 'pendiente'.
CREATE OR REPLACE FUNCTION public.tg_pendientes_sync_acuerdo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estatus IS DISTINCT FROM OLD.estatus THEN
    IF NEW.estatus = 'listo' THEN
      UPDATE public.minuta_acuerdos
         SET estado = 'listo'
       WHERE pendiente_id = NEW.id AND estado <> 'listo';
    ELSIF OLD.estatus = 'listo' THEN
      UPDATE public.minuta_acuerdos
         SET estado = 'pendiente'
       WHERE pendiente_id = NEW.id AND estado <> 'pendiente';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pendientes_sync_acuerdo ON public.pendientes_equipo;
CREATE TRIGGER trg_pendientes_sync_acuerdo
  AFTER UPDATE OF estatus ON public.pendientes_equipo
  FOR EACH ROW EXECUTE FUNCTION public.tg_pendientes_sync_acuerdo();

-- Si el acuerdo se marca 'listo' y tiene pendiente vinculado ⇒ cerrar pendiente
CREATE OR REPLACE FUNCTION public.tg_acuerdo_sync_pendiente()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado IS DISTINCT FROM OLD.estado AND NEW.pendiente_id IS NOT NULL THEN
    IF NEW.estado = 'listo' THEN
      UPDATE public.pendientes_equipo
         SET estatus = 'listo'
       WHERE id = NEW.pendiente_id AND estatus <> 'listo';
    ELSE
      UPDATE public.pendientes_equipo
         SET estatus = 'pendiente'
       WHERE id = NEW.pendiente_id AND estatus = 'listo';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_acuerdo_sync_pendiente ON public.minuta_acuerdos;
CREATE TRIGGER trg_acuerdo_sync_pendiente
  AFTER UPDATE OF estado ON public.minuta_acuerdos
  FOR EACH ROW EXECUTE FUNCTION public.tg_acuerdo_sync_pendiente();

-- ────────── 4) RLS ──────────
ALTER TABLE public.minuta_acuerdos ENABLE ROW LEVEL SECURITY;

-- Policy de minutas: solo internos / super_admin / roles legacy
DROP POLICY IF EXISTS minutas_rw ON public.minutas;
CREATE POLICY minutas_rw ON public.minutas
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

DROP POLICY IF EXISTS acuerdos_rw ON public.minuta_acuerdos;
CREATE POLICY acuerdos_rw ON public.minuta_acuerdos
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

-- Asegurar RLS habilitado en minutas
ALTER TABLE public.minutas ENABLE ROW LEVEL SECURITY;

-- ────────── 5) Comentarios ──────────
COMMENT ON TABLE  public.minuta_acuerdos IS 'Action items de una minuta. Cada acuerdo puede generar un pendiente_equipo vinculado (pendiente_id).';
COMMENT ON COLUMN public.minutas.titulo IS 'Título descriptivo de la reunión.';
COMMENT ON COLUMN public.minutas.asistentes IS 'JSONB array: [{nombre:string, user_id?:uuid}]';
COMMENT ON COLUMN public.minutas.plantilla IS 'Plantilla usada: cliente_semanal | interno | mensual | libre';
