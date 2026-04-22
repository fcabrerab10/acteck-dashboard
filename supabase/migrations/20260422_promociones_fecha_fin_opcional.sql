-- promociones: fecha_fin ahora es opcional (null = indefinida)
-- Caso de uso: promociones que empiezan en una fecha pero no tienen un fin
-- definido hasta que se cierran manualmente.

ALTER TABLE public.promociones
  ALTER COLUMN fecha_fin DROP NOT NULL;

-- El check constraint antiguo fallaba cuando fecha_fin era NULL. Lo reemplazamos
-- por uno que sólo valida si ambas fechas están presentes.
ALTER TABLE public.promociones
  DROP CONSTRAINT IF EXISTS chk_fechas_validas;

ALTER TABLE public.promociones
  ADD CONSTRAINT chk_fechas_validas
  CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio);
