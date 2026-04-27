-- Eventos cliente: agregar duración en días y si es fuera de ciudad
-- para que el bonus refleje mejor el esfuerzo (tiempo libre + viaje).

ALTER TABLE public.eventos_cliente
  ADD COLUMN IF NOT EXISTS dias_duracion INTEGER NOT NULL DEFAULT 1 CHECK (dias_duracion >= 1),
  ADD COLUMN IF NOT EXISTS fuera_ciudad  BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.eventos_cliente.dias_duracion IS
  'Días que duró el evento. Aplica multiplicador al bonus base por tiempo extra invertido.';
COMMENT ON COLUMN public.eventos_cliente.fuera_ciudad IS
  'true si el evento fue fuera de su ciudad de residencia. Suma bonus extra fijo.';
