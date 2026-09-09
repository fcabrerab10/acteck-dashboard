-- ═══════════════════════════════════════════════════════════════════════════
-- 20260910 · Historial de cambios (auditoría genérica) para las tablas que la
-- app escribe.
--
-- Una sola tabla `auditoria_cambios` + una función trigger genérica
-- `fn_auditoria()` que se cuelga AFTER INSERT/UPDATE/DELETE en cada tabla.
--
--   · INSERT  → cambios = fila nueva completa (sin campos ruidosos)
--   · DELETE  → cambios = fila vieja completa (sin campos ruidosos)
--   · UPDATE  → cambios = sólo los campos que cambiaron  {campo: {de, a}}
--               (si no cambió nada real, NO se registra)
--   · usuario_id / usuario_email vienen del JWT (auth.uid(), auth.jwt()->>'email').
--     Con service role o desde SQL directo quedan NULL (fallback: perfiles.email).
--   · registro_id = PK de la fila (TG_ARGV[0] = nombre de la columna PK; default 'id').
--   · cliente_key = columna `cliente_key` o `cliente` si existe en la fila.
--
-- Decisiones de alcance (conteo de filas al 2026-09-10):
--   AUDITADAS  (transaccionales, edición manual desde la app):
--     pagos(62) pendientes(14) pendientes_equipo(416) tareas_recurrentes(12)
--     minutas(21) minuta_acuerdos(0) inversion_marketing(0) marketing_actividades(120)
--     fondos_mkt_movimientos(10) propuestas_borradores(5) propuestas_equipo(10) spiffs(127)
--     lineamientos_cliente(8) forecast_propuestas(1) forecast_propuesta_lineas(5)
--     forecast_avisos(1) sugeridos_compra(0) solicitudes_compra(3)
--     solicitudes_compra_lineas(15) oc_clientes(99) oc_clientes_skus(457) oc_envios(76)
--     oc_envio_skus(260) perfiles(5) cuotas_mensuales(743) cuotas_canales(0)
--     clientes_credito_config(4) evaluaciones(9) evaluaciones_mensuales(4)
--     evaluaciones_kpis_template(35) eventos_cliente(3) eventos_equipo(7)
--     sku_config(0) almacenes_config(15) roadmap_sku(1,146 · upserts de 1 fila
--     por el super admin, no carga masiva) ventas_mensuales(50)
--   NO AUDITADAS:
--     sellout_sku (9,945 filas · carga masiva desde Excel, > 5,000)
--     inventario_cliente (28,759 filas · carga masiva, > 5,000)
--     eventos_usuario (7,238 filas · telemetría automática, no son ediciones humanas)
--   NO EXISTEN en la BD (se pidieron pero no hay tabla):
--     pendientes_recurrentes (→ equivalente: tareas_recurrentes, sí auditada)
--     forecast_propuestas_detalle (→ forecast_propuesta_lineas, sí auditada)
--     solicitudes_compra_detalle (→ solicitudes_compra_lineas, sí auditada)
--     evaluaciones_detalle (→ evaluaciones_mensuales, sí auditada)
--     eventos_calendario (→ eventos_cliente / eventos_equipo, sí auditadas)
--     fondos_interno_movimientos (sólo existe fondos_mkt_movimientos)
--
-- Nota: `pagos` conserva su auditoría específica previa (tg_pagos_audit →
-- pagos_audit). Esta genérica convive con ella; no se toca.
--
-- Retención: `purgar_auditoria(dias int default 365)`.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Tabla ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.auditoria_cambios (
  id            bigserial PRIMARY KEY,
  tabla         text        NOT NULL,
  operacion     text        NOT NULL CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE')),
  registro_id   text,
  cliente_key   text,
  usuario_id    uuid,
  usuario_email text,
  cambios       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  creado_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.auditoria_cambios IS
  'Historial de cambios (quién / qué / cuándo) de las tablas que la app escribe. Lo llena fn_auditoria(); la app sólo lee.';

CREATE INDEX IF NOT EXISTS auditoria_cambios_creado_idx  ON public.auditoria_cambios (creado_at DESC);
CREATE INDEX IF NOT EXISTS auditoria_cambios_tabla_idx   ON public.auditoria_cambios (tabla);
CREATE INDEX IF NOT EXISTS auditoria_cambios_usuario_idx ON public.auditoria_cambios (usuario_email);
CREATE INDEX IF NOT EXISTS auditoria_cambios_cliente_idx ON public.auditoria_cambios (cliente_key);

-- ─── 2. RLS: sólo lectura para usuarios autenticados (herramienta interna) ──
ALTER TABLE public.auditoria_cambios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auditoria_cambios_select ON public.auditoria_cambios;
CREATE POLICY auditoria_cambios_select
  ON public.auditoria_cambios FOR SELECT
  TO authenticated
  USING (true);
-- Sin políticas INSERT/UPDATE/DELETE: la app no puede escribir aquí.
-- El trigger es SECURITY DEFINER (dueño = postgres), así que no pasa por RLS.

REVOKE ALL ON public.auditoria_cambios FROM anon, authenticated;
GRANT  SELECT ON public.auditoria_cambios TO authenticated;
GRANT  ALL    ON public.auditoria_cambios TO service_role;
GRANT  USAGE, SELECT ON SEQUENCE public.auditoria_cambios_id_seq TO service_role;

-- ─── 3. Función trigger genérica ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_auditoria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pk_col  text := COALESCE(NULLIF(TG_ARGV[0], ''), 'id');
  ruido   text[] := ARRAY[
    'updated_at', 'uploaded_at', 'last_seen_at', 'created_at', 'creado_at',
    'actualizado_at', 'modificado_at', 'touched_at', 'last_login_at',
    'last_active_at', 'ultima_actividad', 'updated_by'
  ];
  j_old   jsonb;
  j_new   jsonb;
  j_ref   jsonb;
  diff    jsonb := '{}'::jsonb;
  k       text;
  v       jsonb;
  uid     uuid;
  uemail  text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    j_new := to_jsonb(NEW);
    j_ref := j_new;
    diff  := j_new - ruido;
  ELSIF TG_OP = 'DELETE' THEN
    j_old := to_jsonb(OLD);
    j_ref := j_old;
    diff  := j_old - ruido;
  ELSE
    j_old := to_jsonb(OLD);
    j_new := to_jsonb(NEW);
    j_ref := j_new;
    FOR k, v IN SELECT key, value FROM jsonb_each(j_new) LOOP
      IF k = ANY (ruido) THEN CONTINUE; END IF;
      IF v IS DISTINCT FROM (j_old -> k) THEN
        diff := diff || jsonb_build_object(k, jsonb_build_object('de', j_old -> k, 'a', v));
      END IF;
    END LOOP;
    -- Update sin cambios reales (sólo ruido o idéntico): no registrar.
    IF diff = '{}'::jsonb THEN
      RETURN NULL;
    END IF;
  END IF;

  -- Usuario: del JWT. NULL con service role / SQL directo.
  BEGIN
    uid := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    uid := NULL;
  END;
  BEGIN
    uemail := NULLIF(auth.jwt() ->> 'email', '');
  EXCEPTION WHEN OTHERS THEN
    uemail := NULL;
  END;
  IF uemail IS NULL AND uid IS NOT NULL THEN
    SELECT p.email INTO uemail FROM public.perfiles p WHERE p.user_id = uid LIMIT 1;
  END IF;

  INSERT INTO public.auditoria_cambios
    (tabla, operacion, registro_id, cliente_key, usuario_id, usuario_email, cambios)
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    j_ref ->> pk_col,
    COALESCE(j_ref ->> 'cliente_key', j_ref ->> 'cliente'),
    uid,
    uemail,
    diff
  );
  RETURN NULL; -- AFTER trigger: el valor de retorno se ignora
END;
$$;

REVOKE ALL ON FUNCTION public.fn_auditoria() FROM public, anon, authenticated;

-- ─── 4. Triggers (idempotente: sólo si la tabla existe) ────────────────────
DO $$
DECLARE
  -- (tabla, columna PK)
  objetivos text[][] := ARRAY[
    ['pagos',                      'id'],
    ['pendientes',                 'id'],
    ['pendientes_equipo',          'id'],
    ['tareas_recurrentes',         'id'],
    ['minutas',                    'id'],
    ['minuta_acuerdos',            'id'],
    ['inversion_marketing',        'id'],
    ['marketing_actividades',      'id'],
    ['fondos_mkt_movimientos',     'id'],
    ['propuestas_borradores',      'id'],
    ['propuestas_equipo',          'id'],
    ['spiffs',                     'id'],
    ['lineamientos_cliente',       'id'],
    ['forecast_propuestas',        'id'],
    ['forecast_propuesta_lineas',  'id'],
    ['forecast_avisos',            'id'],
    ['sugeridos_compra',           'id'],
    ['solicitudes_compra',         'id'],
    ['solicitudes_compra_lineas',  'id'],
    ['oc_clientes',                'id'],
    ['oc_clientes_skus',           'id'],
    ['oc_envios',                  'id'],
    ['oc_envio_skus',              'id'],
    ['perfiles',                   'id'],
    ['cuotas_mensuales',           'id'],
    ['cuotas_canales',             'id'],
    ['clientes_credito_config',    'cliente'],
    ['evaluaciones',               'id'],
    ['evaluaciones_mensuales',     'id'],
    ['evaluaciones_kpis_template', 'id'],
    ['eventos_cliente',            'id'],
    ['eventos_equipo',             'id'],
    ['sku_config',                 'sku'],
    ['almacenes_config',           'no_almacen'],
    ['roadmap_sku',                'sku'],
    ['ventas_mensuales',           'id']
  ];
  i int;
  t text;
  pk text;
BEGIN
  FOR i IN 1 .. array_length(objetivos, 1) LOOP
    t  := objetivos[i][1];
    pk := objetivos[i][2];
    IF to_regclass('public.' || quote_ident(t)) IS NULL THEN
      RAISE NOTICE 'auditoria: tabla % no existe, se omite', t;
      CONTINUE;
    END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS trg_auditoria ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria(%L)',
      t, pk
    );
  END LOOP;
END;
$$;

-- ─── 5. Retención ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.purgar_auditoria(dias int DEFAULT 365)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  DELETE FROM public.auditoria_cambios
  WHERE creado_at < now() - make_interval(days => GREATEST(dias, 1));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.purgar_auditoria(int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purgar_auditoria(int) TO service_role;
