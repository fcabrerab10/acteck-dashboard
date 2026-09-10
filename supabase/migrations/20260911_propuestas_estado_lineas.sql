-- propuestas_borradores · modelo V3 (2026-09-11)
--
-- Antes: estado libre ('Borrador' | 'Exportada' | 'Enviada'), líneas sólo en `propuesta` (mapa sku → {piezas, precio, listaSel}),
-- recientes duplicados en localStorage. Ahora:
--   estado      text ∈ borrador | enviada | cerrada (minúsculas; 'Exportada' se funde en 'enviada')
--   lineas      jsonb [] · [{ sku, piezas, precio, lista, spiff, descripcion, marca, familia }]  ← canónico para la app
--   propuesta   jsonb {} · mapa sku → { piezas, precio, listaSel, … }  ← se conserva por compatibilidad (móvil/escritorio viejos)
--   enviada_at / cerrada_at / folio / creado_por / anio / mes
-- Un trigger BEFORE mantiene `lineas` y `propuesta` sincronizados sin importar cuál escriba la app, normaliza el estado,
-- sella enviada_at / cerrada_at y asigna folio al enviar. Los borradores existentes se migran en la misma migración.

ALTER TABLE public.propuestas_borradores
  ADD COLUMN IF NOT EXISTS lineas      jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS enviada_at  timestamptz,
  ADD COLUMN IF NOT EXISTS cerrada_at  timestamptz,
  ADD COLUMN IF NOT EXISTS folio       text,
  ADD COLUMN IF NOT EXISTS creado_por  uuid,
  ADD COLUMN IF NOT EXISTS anio        int,
  ADD COLUMN IF NOT EXISTS mes         int;

CREATE SEQUENCE IF NOT EXISTS public.propuestas_folio_seq;

-- Cast numérico tolerante ('1,200' · '' · null → number | null)
CREATE OR REPLACE FUNCTION public.propuestas_num(t text) RETURNS numeric
LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(regexp_replace(COALESCE(t, ''), '[^0-9.\-]', '', 'g'), '')::numeric
$$;

-- mapa { sku → {piezas, precio, listaSel|lista, spiff, descripcion, marca, familia} } → arreglo de líneas
CREATE OR REPLACE FUNCTION public.propuestas_lineas_desde_mapa(p jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'sku',         e.key,
      'piezas',      COALESCE(public.propuestas_num(e.value->>'piezas'), 0),
      'precio',      COALESCE(public.propuestas_num(e.value->>'precio'), 0),
      'lista',       COALESCE(e.value->>'lista', e.value->>'listaSel'),
      'spiff',       public.propuestas_num(e.value->>'spiff'),
      'descripcion', e.value->>'descripcion',
      'marca',       e.value->>'marca',
      'familia',     e.value->>'familia')) ORDER BY e.key), '[]'::jsonb)
  FROM jsonb_each(CASE WHEN jsonb_typeof(p) = 'object' THEN p ELSE '{}'::jsonb END) e
  WHERE jsonb_typeof(e.value) = 'object'
$$;

-- arreglo de líneas → mapa (para el móvil / código viejo que lee `propuesta`)
CREATE OR REPLACE FUNCTION public.propuestas_mapa_desde_lineas(l jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(jsonb_object_agg(x->>'sku', jsonb_strip_nulls(jsonb_build_object(
      'piezas',      COALESCE(public.propuestas_num(x->>'piezas'), 0),
      'precio',      COALESCE(public.propuestas_num(x->>'precio'), 0),
      'listaSel',    COALESCE(x->>'lista', x->>'listaSel'),
      'spiff',       public.propuestas_num(x->>'spiff'),
      'descripcion', x->>'descripcion',
      'marca',       x->>'marca',
      'familia',     x->>'familia'))), '{}'::jsonb)
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(l) = 'array' THEN l ELSE '[]'::jsonb END) x
  WHERE COALESCE(x->>'sku', '') <> ''
$$;

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

DROP TRIGGER IF EXISTS trg_propuestas_sync ON public.propuestas_borradores;
CREATE TRIGGER trg_propuestas_sync
  BEFORE INSERT OR UPDATE ON public.propuestas_borradores
  FOR EACH ROW EXECUTE FUNCTION public.fn_propuestas_sync();

-- Migración de los borradores existentes (el trigger normaliza estado, anio/mes y sellos)
UPDATE public.propuestas_borradores
   SET lineas = public.propuestas_lineas_desde_mapa(propuesta);

ALTER TABLE public.propuestas_borradores ALTER COLUMN estado SET DEFAULT 'borrador';
ALTER TABLE public.propuestas_borradores DROP CONSTRAINT IF EXISTS propuestas_borradores_estado_chk;
ALTER TABLE public.propuestas_borradores
  ADD CONSTRAINT propuestas_borradores_estado_chk CHECK (estado IN ('borrador', 'enviada', 'cerrada'));

CREATE INDEX IF NOT EXISTS propuestas_borradores_estado_idx
  ON public.propuestas_borradores (cliente_key, estado, anio, mes);
