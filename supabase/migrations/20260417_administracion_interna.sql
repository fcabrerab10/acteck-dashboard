-- Administración Interna — tablas para pendientes del equipo y eventos/calendario
-- Fecha: 2026-04-17
-- Sólo super_admin y asistente tienen acceso (enforcement en UI; RLS permite authenticated con filtros suaves).

-- ─────────────────────────────────────────────────────────────
-- 1) pendientes_equipo
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pendientes_equipo (
  id            BIGSERIAL PRIMARY KEY,
  cuenta        TEXT NOT NULL CHECK (cuenta IN ('mercadolibre','digitalife','pcel','otro')),
  tarea         TEXT NOT NULL,
  categoria     TEXT,
  fecha_limite  DATE,
  estatus       TEXT NOT NULL DEFAULT 'pendiente'
                CHECK (estatus IN ('pendiente','en_proceso','listo')),
  notas         TEXT,
  responsable   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  creado_por    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pendientes_fecha     ON public.pendientes_equipo(fecha_limite);
CREATE INDEX IF NOT EXISTS idx_pendientes_estatus   ON public.pendientes_equipo(estatus);
CREATE INDEX IF NOT EXISTS idx_pendientes_cuenta    ON public.pendientes_equipo(cuenta);
CREATE INDEX IF NOT EXISTS idx_pendientes_resp      ON public.pendientes_equipo(responsable);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_pendientes_touch()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pendientes_touch ON public.pendientes_equipo;
CREATE TRIGGER trg_pendientes_touch
  BEFORE UPDATE ON public.pendientes_equipo
  FOR EACH ROW EXECUTE FUNCTION public.tg_pendientes_touch();

-- ─────────────────────────────────────────────────────────────
-- 2) eventos_equipo (vacaciones, salidas, home office, reuniones)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.eventos_equipo (
  id            BIGSERIAL PRIMARY KEY,
  titulo        TEXT NOT NULL,
  tipo          TEXT NOT NULL CHECK (tipo IN (
                  'salida_trabajo','vacaciones','permiso','home_office','feriado','reunion'
                )),
  fecha_ini     DATE NOT NULL,
  fecha_fin     DATE NOT NULL,
  responsable   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notas         TEXT,
  creado_por    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_fechas_validas CHECK (fecha_fin >= fecha_ini)
);

CREATE INDEX IF NOT EXISTS idx_eventos_ini  ON public.eventos_equipo(fecha_ini);
CREATE INDEX IF NOT EXISTS idx_eventos_resp ON public.eventos_equipo(responsable);
CREATE INDEX IF NOT EXISTS idx_eventos_tipo ON public.eventos_equipo(tipo);

-- ─────────────────────────────────────────────────────────────
-- 3) RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.pendientes_equipo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos_equipo    ENABLE ROW LEVEL SECURITY;

-- Sólo usuarios autenticados con rol super_admin o asistente pueden leer/escribir
DROP POLICY IF EXISTS pendientes_rw ON public.pendientes_equipo;
CREATE POLICY pendientes_rw ON public.pendientes_equipo
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.user_id = auth.uid()
        AND p.activo = true
        AND p.rol IN ('super_admin','asistente')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.user_id = auth.uid()
        AND p.activo = true
        AND p.rol IN ('super_admin','asistente')
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
        AND p.rol IN ('super_admin','asistente')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.user_id = auth.uid()
        AND p.activo = true
        AND p.rol IN ('super_admin','asistente')
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 4) Realtime (opcional — para que los cambios se vean en vivo)
-- ─────────────────────────────────────────────────────────────
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.pendientes_equipo;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.eventos_equipo;
