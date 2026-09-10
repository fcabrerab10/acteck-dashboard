-- propuestas_borradores · vigencia de la propuesta (2026-09-11)
--
-- `vigencia date`: fecha hasta la que vale el precio propuesto. La app la propone como el último día del mes
-- objetivo (anio/mes) y Fernando puede cambiarla. Se muestra en Revisar, en el Excel y en el texto de WhatsApp.
-- El trigger fn_propuestas_sync la rellena cuando la app (o el móvil viejo) no la manda, para que ninguna fila quede sin vigencia.

ALTER TABLE public.propuestas_borradores
  ADD COLUMN IF NOT EXISTS vigencia date;

CREATE OR REPLACE FUNCTION public.fn_propuestas_sync() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  d timestamptz;
BEGIN
  -- Estado normalizado
  NEW.estado := CASE lower(COALESCE(NEW.estado, 'borrador'))
    WHEN 'exportada' THEN 'enviada'
    WHEN 'enviada'   THEN 'enviada'
    WHEN 'cerrada'   THEN 'cerrada'
    ELSE 'borrador' END;

  -- lineas ⇄ propuesta: gana lo que cambió
  IF TG_OP = 'INSERT' THEN
    IF jsonb_typeof(NEW.lineas) = 'array' AND jsonb_array_length(NEW.lineas) > 0 THEN
      NEW.propuesta := public.propuestas_mapa_desde_lineas(NEW.lineas);
    ELSE
      NEW.lineas := public.propuestas_lineas_desde_mapa(NEW.propuesta);
    END IF;
  ELSE
    IF NEW.lineas IS DISTINCT FROM OLD.lineas THEN
      NEW.propuesta := public.propuestas_mapa_desde_lineas(NEW.lineas);
    ELSIF NEW.propuesta IS DISTINCT FROM OLD.propuesta THEN
      NEW.lineas := public.propuestas_lineas_desde_mapa(NEW.propuesta);
    END IF;
  END IF;

  -- Mes objetivo: el de creación si la app no lo manda
  d := COALESCE(to_timestamp(NEW.tstamp / 1000.0), now());
  IF NEW.anio IS NULL THEN NEW.anio := EXTRACT(YEAR  FROM (d AT TIME ZONE 'America/Mexico_City'))::int; END IF;
  IF NEW.mes  IS NULL THEN NEW.mes  := EXTRACT(MONTH FROM (d AT TIME ZONE 'America/Mexico_City'))::int; END IF;

  -- Vigencia: último día del mes objetivo si nadie la fijó
  IF NEW.vigencia IS NULL THEN
    NEW.vigencia := (make_date(NEW.anio, NEW.mes, 1) + interval '1 month' - interval '1 day')::date;
  END IF;

  -- Sellos de ciclo de vida
  IF NEW.estado = 'borrador' THEN
    NEW.enviada_at := NULL;
    NEW.cerrada_at := NULL;
  ELSE
    IF NEW.enviada_at IS NULL THEN NEW.enviada_at := now(); END IF;
    IF NEW.estado = 'cerrada' AND NEW.cerrada_at IS NULL THEN NEW.cerrada_at := now(); END IF;
    IF NEW.estado = 'enviada' THEN NEW.cerrada_at := NULL; END IF;
    IF NEW.folio IS NULL THEN
      NEW.folio := 'PRP-' || to_char(now() AT TIME ZONE 'America/Mexico_City', 'YYMM') || '-' || lpad(nextval('public.propuestas_folio_seq')::text, 3, '0');
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- Backfill de las filas existentes: último día de su mes objetivo
UPDATE public.propuestas_borradores
   SET vigencia = (make_date(anio, mes, 1) + interval '1 month' - interval '1 day')::date
 WHERE vigencia IS NULL AND anio IS NOT NULL AND mes IS NOT NULL;
