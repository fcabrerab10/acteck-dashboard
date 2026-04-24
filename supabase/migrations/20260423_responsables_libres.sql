-- Responsables libres (texto libre) para pendientes y plantillas recurrentes
-- Permite asignar personas que no son usuarios del dashboard.
-- Formato: ["Nombre Apellido", "Otra Persona"]

ALTER TABLE public.pendientes_equipo
  ADD COLUMN IF NOT EXISTS responsables_libres TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE public.tareas_recurrentes
  ADD COLUMN IF NOT EXISTS responsables_libres TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS idx_pendientes_resp_libres
  ON public.pendientes_equipo USING gin (responsables_libres);

COMMENT ON COLUMN public.pendientes_equipo.responsables_libres IS
  'Responsables sin cuenta en el sistema. Se muestran como etiquetas en la tarjeta y son buscables, pero no generan tab dinámico.';
