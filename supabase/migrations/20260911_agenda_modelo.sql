-- 20260911 · Agenda (pestaña nueva debajo de Inicio) · modelo agenda_*
--
-- Sustituye a Pendientes & Calendario (pendientes_equipo, minutas, minuta_acuerdos,
-- eventos_equipo y la vieja `pendientes`). NADA se borra: las tablas viejas quedan
-- intactas y sus filas se COPIAN al modelo nuevo (idempotente: cada fila migrada
-- guarda `migrado_de = {tabla, id}` y no se vuelve a copiar).
--
--   agenda_reuniones  reuniones (tipo 'reunion', con minuta y puntos) y eventos del equipo
--                     (tipo 'evento': salidas, ferias… sin puntos). Los eventos_equipo NO
--                     encajaban como reunión con minuta, pero sí caben en la misma tabla con
--                     tipo='evento' (misma línea del tiempo, mismo calendario); se decidió
--                     así en vez de una tabla `agenda_eventos` aparte.
--   agenda_items      tareas ('tarea') y puntos de reunión ('punto', con reunion_id).
--                     Etiquetas: cliente_key (#cliente) y responsables uuid[] (@persona).
--                     estado: abierta · hecha · cancelada · arrastrada (el punto se cerró en
--                     esa reunión porque se copió a la siguiente; el original queda enlazado
--                     desde la copia con arrastrado_desde).
--   alertas.para_usuario  aviso dirigido a una persona (agenda_vencida / agenda_asignado /
--                     agenda_hoy). NULL = para todos (como hasta hoy).
--
-- Permiso: `permisos.globales.agenda` ('ver' | 'edit'). Se copia del viejo `admin_interna`
-- para que quien veía Pendientes vea Agenda. Lectura: quien tenga el permiso (o super admin
-- o interno). Escritura: interno / super admin (o nivel 'edit').
-- Auditoría: trg_auditoria (fn_auditoria) en agenda_items y agenda_reuniones.

-- ─── 0. Helpers de permiso ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.agenda_puede_ver()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.user_id = auth.uid() AND p.activo = true
      AND (p.es_super_admin = true OR p.tipo = 'interno'
           OR COALESCE(p.permisos->'globales'->>'agenda', '') IN ('ver', 'edit'))
  );
$$;

CREATE OR REPLACE FUNCTION public.agenda_puede_editar()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.user_id = auth.uid() AND p.activo = true
      AND (p.es_super_admin = true OR p.tipo = 'interno'
           OR COALESCE(p.permisos->'globales'->>'agenda', '') = 'edit')
  );
$$;

-- ─── 1. Tablas ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agenda_reuniones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo            text NOT NULL DEFAULT 'reunion' CHECK (tipo IN ('reunion', 'evento')),
  titulo          text NOT NULL,
  cliente_key     text,                        -- digitalife | pcel | dicotech | interno | otro texto
  fecha           timestamptz NOT NULL,
  fecha_fin       timestamptz,                 -- eventos de varios días
  duracion_min    integer NOT NULL DEFAULT 60,
  lugar           text,                        -- 'Meet' · 'oficina' · dirección…
  asistentes      jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{ user_id?, nombre }]
  estado          text NOT NULL DEFAULT 'programada' CHECK (estado IN ('programada', 'en_curso', 'cerrada')),
  google_event_id text,
  notas           text,
  migrado_de      jsonb,
  creado_por      uuid,
  cerrada_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agenda_reuniones_fecha_idx   ON public.agenda_reuniones (fecha);
CREATE INDEX IF NOT EXISTS agenda_reuniones_cliente_idx ON public.agenda_reuniones (cliente_key, fecha);

CREATE TABLE IF NOT EXISTS public.agenda_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo             text NOT NULL DEFAULT 'tarea' CHECK (tipo IN ('tarea', 'punto')),
  titulo           text NOT NULL,
  notas            text,
  estado           text NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'hecha', 'cancelada', 'arrastrada')),
  categoria        text CHECK (categoria IS NULL OR categoria IN ('comercial', 'marketing', 'pagos', 'administracion', 'logistico')),
  prioridad        text NOT NULL DEFAULT 'media' CHECK (prioridad IN ('baja', 'media', 'alta')),
  fecha_limite     date,
  hora             time,
  cliente_key      text,
  responsables     uuid[] NOT NULL DEFAULT '{}',
  reunion_id       uuid REFERENCES public.agenda_reuniones (id) ON DELETE SET NULL,
  arrastrado_desde uuid REFERENCES public.agenda_items (id) ON DELETE SET NULL,
  origen           jsonb,                      -- { fuente:'sistema'|…, categoria_original, subtareas, responsable_texto… }
  notificar_a      uuid[] NOT NULL DEFAULT '{}',   -- pendientes de aviso (los convierte el cron en alertas agenda_asignado)
  notificar_motivo text,                       -- 'asignado' | 'cierre'
  orden            integer NOT NULL DEFAULT 0,
  resolucion       text,                       -- "en qué quedó" (nota corta al resolver un punto)
  migrado_de       jsonb,
  creado_por       uuid,
  completado_en    timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agenda_items_estado_fecha_idx ON public.agenda_items (estado, fecha_limite);
CREATE INDEX IF NOT EXISTS agenda_items_reunion_idx      ON public.agenda_items (reunion_id);
CREATE INDEX IF NOT EXISTS agenda_items_cliente_idx      ON public.agenda_items (cliente_key);
CREATE INDEX IF NOT EXISTS agenda_items_resp_idx         ON public.agenda_items USING gin (responsables);
CREATE UNIQUE INDEX IF NOT EXISTS agenda_items_migrado_uq     ON public.agenda_items ((migrado_de->>'tabla'), (migrado_de->>'id')) WHERE migrado_de IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS agenda_reuniones_migrado_uq ON public.agenda_reuniones ((migrado_de->>'tabla'), (migrado_de->>'id')) WHERE migrado_de IS NOT NULL;

-- updated_at automático
CREATE OR REPLACE FUNCTION public.agenda_touch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_agenda_touch ON public.agenda_items;
CREATE TRIGGER trg_agenda_touch BEFORE UPDATE ON public.agenda_items FOR EACH ROW EXECUTE FUNCTION public.agenda_touch();
DROP TRIGGER IF EXISTS trg_agenda_touch ON public.agenda_reuniones;
CREATE TRIGGER trg_agenda_touch BEFORE UPDATE ON public.agenda_reuniones FOR EACH ROW EXECUTE FUNCTION public.agenda_touch();

-- ─── 2. RLS ────────────────────────────────────────────────────────────────
ALTER TABLE public.agenda_reuniones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_items     ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['agenda_reuniones', 'agenda_items'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_insert ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_update ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_delete ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated USING (public.agenda_puede_ver())', t, t);
    EXECUTE format('CREATE POLICY %I_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.agenda_puede_editar())', t, t);
    EXECUTE format('CREATE POLICY %I_update ON public.%I FOR UPDATE TO authenticated USING (public.agenda_puede_editar()) WITH CHECK (public.agenda_puede_editar())', t, t);
    EXECUTE format('CREATE POLICY %I_delete ON public.%I FOR DELETE TO authenticated USING (public.agenda_puede_editar())', t, t);
  END LOOP;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_reuniones, public.agenda_items TO authenticated;

-- ─── 3. Auditoría (fn_auditoria de 20260910_auditoria_cambios.sql) ─────────
DO $$ BEGIN
  IF to_regprocedure('public.fn_auditoria()') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_auditoria ON public.agenda_items';
    EXECUTE 'CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.agenda_items FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria(''id'')';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_auditoria ON public.agenda_reuniones';
    EXECUTE 'CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.agenda_reuniones FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria(''id'')';
  END IF;
END $$;

-- ─── 4. alertas.para_usuario ───────────────────────────────────────────────
ALTER TABLE public.alertas ADD COLUMN IF NOT EXISTS para_usuario uuid;
CREATE INDEX IF NOT EXISTS alertas_para_usuario_idx ON public.alertas (para_usuario) WHERE para_usuario IS NOT NULL;

-- ─── 5. Permiso: admin_interna → agenda ─────────────────────────────────────
UPDATE public.perfiles
SET permisos = jsonb_set(COALESCE(permisos, '{}'::jsonb), '{globales,agenda}', permisos->'globales'->'admin_interna', true)
WHERE permisos->'globales' ? 'admin_interna'
  AND NOT (COALESCE(permisos->'globales', '{}'::jsonb) ? 'agenda');

-- ─── 6. Migración de datos (idempotente) ───────────────────────────────────
-- 6a. minutas → agenda_reuniones (reunión cerrada si ya pasó; contenido → notas)
INSERT INTO public.agenda_reuniones (tipo, titulo, cliente_key, fecha, duracion_min, lugar, asistentes, estado, notas, migrado_de, creado_por, cerrada_at, created_at, updated_at)
SELECT 'reunion',
       COALESCE(NULLIF(m.titulo, ''), 'Reunión ' || COALESCE(m.cliente, 'interna')),
       CASE WHEN m.cliente IN ('otro', 'interno', '') OR m.cliente IS NULL THEN 'interno' ELSE m.cliente END,
       ((m.fecha_reunion::timestamp + time '10:00') AT TIME ZONE 'America/Mexico_City'),
       60, NULL,
       COALESCE(m.asistentes, '[]'::jsonb),
       CASE WHEN m.fecha_reunion < (now() AT TIME ZONE 'America/Mexico_City')::date THEN 'cerrada' ELSE 'programada' END,
       m.contenido,
       jsonb_build_object('tabla', 'minutas', 'id', m.id::text, 'fuente', m.fuente, 'plantilla', m.plantilla),
       m.creado_por,
       CASE WHEN m.fecha_reunion < (now() AT TIME ZONE 'America/Mexico_City')::date THEN COALESCE(m.updated_at, m.created_at) END,
       COALESCE(m.created_at, now()), COALESCE(m.updated_at, now())
FROM public.minutas m
ON CONFLICT DO NOTHING;

-- 6b. eventos_equipo → agenda_reuniones tipo 'evento'
INSERT INTO public.agenda_reuniones (tipo, titulo, cliente_key, fecha, fecha_fin, duracion_min, asistentes, estado, notas, migrado_de, creado_por, created_at, updated_at)
SELECT 'evento', e.titulo, 'interno',
       ((e.fecha_ini::timestamp + time '09:00') AT TIME ZONE 'America/Mexico_City'),
       CASE WHEN e.fecha_fin IS NOT NULL THEN ((e.fecha_fin::timestamp + time '18:00') AT TIME ZONE 'America/Mexico_City') END,
       CASE WHEN e.fecha_fin IS NULL OR e.fecha_fin = e.fecha_ini THEN 540 ELSE 60 END,
       CASE WHEN e.responsable IS NOT NULL THEN jsonb_build_array(jsonb_build_object('user_id', e.responsable, 'nombre', (SELECT nombre FROM public.perfiles p WHERE p.user_id = e.responsable LIMIT 1))) ELSE '[]'::jsonb END,
       CASE WHEN COALESCE(e.fecha_fin, e.fecha_ini) < (now() AT TIME ZONE 'America/Mexico_City')::date THEN 'cerrada' ELSE 'programada' END,
       e.notas,
       jsonb_build_object('tabla', 'eventos_equipo', 'id', e.id::text, 'tipo', e.tipo),
       e.creado_por, COALESCE(e.created_at, now()), COALESCE(e.created_at, now())
FROM public.eventos_equipo e
ON CONFLICT DO NOTHING;

-- 6c. pendientes_equipo → agenda_items 'tarea'
--     categoría libre → una de las 5; el texto original queda en origen.categoria_original;
--     subtareas se anexan a las notas como lista y quedan en origen.subtareas.
INSERT INTO public.agenda_items (tipo, titulo, notas, estado, categoria, prioridad, fecha_limite, cliente_key, responsables, origen, migrado_de, creado_por, completado_en, created_at, updated_at)
SELECT 'tarea',
       COALESCE(NULLIF(p.tarea, ''), '(sin título)'),
       NULLIF(TRIM(BOTH E'\n' FROM COALESCE(p.notas, '') ||
         CASE WHEN p.subtareas IS NOT NULL AND jsonb_typeof(p.subtareas) = 'array' AND jsonb_array_length(p.subtareas) > 0
              THEN E'\n' || (SELECT string_agg(CASE WHEN COALESCE((s->>'hecha')::boolean, (s->>'done')::boolean, (s->>'completada')::boolean, false) THEN '☑ ' ELSE '☐ ' END || COALESCE(s->>'texto', s->>'titulo', s->>'text', s::text), E'\n') FROM jsonb_array_elements(p.subtareas) s)
              ELSE '' END), ''),
       CASE WHEN p.estatus = 'listo' THEN 'hecha' ELSE 'abierta' END,
       CASE
         WHEN p.categoria ILIKE '%mkt%' OR p.categoria ILIKE '%marketing%' OR p.categoria ILIKE '%campañ%' OR p.categoria ILIKE '%publicac%' OR p.categoria ILIKE '%diseñ%' OR p.categoria ILIKE '%reputaci%' OR p.categoria ILIKE '%postventa%' THEN 'marketing'
         WHEN p.categoria ILIKE '%venta%' OR p.categoria ILIKE '%comercial%' OR p.categoria ILIKE '%e-commerce%' THEN 'comercial'
         WHEN p.categoria ILIKE '%pago%' OR p.categoria ILIKE '%factura%' THEN 'pagos'
         WHEN p.categoria ILIKE '%administraci%' OR p.categoria ILIKE '%interno%' OR p.categoria ILIKE '%ferru%' THEN 'administracion'
         ELSE NULL
       END,
       CASE WHEN p.prioridad IN ('baja', 'media', 'alta') THEN p.prioridad ELSE 'media' END,
       p.fecha_limite,
       CASE WHEN p.cuenta IN ('otro', '') OR p.cuenta IS NULL THEN 'interno' ELSE p.cuenta END,
       COALESCE(NULLIF(p.responsables, '{}'::uuid[]), CASE WHEN p.responsable IS NOT NULL THEN ARRAY[p.responsable] ELSE '{}'::uuid[] END),
       jsonb_strip_nulls(jsonb_build_object('categoria_original', p.categoria, 'subtareas', p.subtareas, 'estatus_original', p.estatus, 'arrastrado_desde_fecha', p.arrastrado_desde, 'recurrente_id', p.origen_recurrente_id)),
       jsonb_build_object('tabla', 'pendientes_equipo', 'id', p.id::text),
       p.creado_por,
       CASE WHEN p.estatus = 'listo' THEN COALESCE(p.completado_en, p.updated_at) END,
       COALESCE(p.created_at, now()), COALESCE(p.updated_at, now())
FROM public.pendientes_equipo p
ON CONFLICT DO NOTHING;

-- 6d. minuta_acuerdos → agenda_items 'punto' (ligados a la reunión migrada)
INSERT INTO public.agenda_items (tipo, titulo, estado, prioridad, fecha_limite, cliente_key, responsables, reunion_id, orden, origen, migrado_de, created_at, updated_at, completado_en)
SELECT 'punto', COALESCE(NULLIF(a.descripcion, ''), '(sin título)'),
       CASE WHEN a.estado IN ('hecho', 'listo', 'completado', 'resuelto', 'cerrado') THEN 'hecha' WHEN a.estado = 'cancelado' THEN 'cancelada' ELSE 'abierta' END,
       CASE WHEN a.prioridad IN ('baja', 'media', 'alta') THEN a.prioridad ELSE 'media' END,
       a.fecha_limite,
       r.cliente_key,
       CASE WHEN a.responsable IS NOT NULL THEN ARRAY[a.responsable] ELSE '{}'::uuid[] END,
       r.id, COALESCE(a.orden, 0),
       jsonb_strip_nulls(jsonb_build_object('estado_original', a.estado, 'pendiente_id', a.pendiente_id)),
       jsonb_build_object('tabla', 'minuta_acuerdos', 'id', a.id::text),
       COALESCE(a.created_at, now()), COALESCE(a.updated_at, now()),
       CASE WHEN a.estado IN ('hecho', 'listo', 'completado', 'resuelto', 'cerrado') THEN COALESCE(a.updated_at, now()) END
FROM public.minuta_acuerdos a
JOIN public.agenda_reuniones r ON r.migrado_de->>'tabla' = 'minutas' AND r.migrado_de->>'id' = a.minuta_id::text
ON CONFLICT DO NOTHING;

-- 6e. pendientes (tabla vieja, responsable en texto) → agenda_items 'tarea'
--     El responsable se resuelve por nombre contra perfiles (ILIKE del primer nombre);
--     el texto original se conserva en origen.responsable_texto.
INSERT INTO public.agenda_items (tipo, titulo, notas, estado, categoria, fecha_limite, cliente_key, responsables, origen, migrado_de, completado_en, created_at, updated_at)
SELECT 'tarea', COALESCE(NULLIF(p.titulo, ''), '(sin título)'), p.descripcion,
       CASE WHEN p.estado IN ('completado', 'hecho', 'listo') THEN 'hecha' WHEN p.archivado THEN 'cancelada' ELSE 'abierta' END,
       CASE WHEN p.tipo IN ('comercial', 'marketing', 'pagos', 'administracion', 'logistico') THEN p.tipo ELSE NULL END,
       p.fecha_entrega,
       CASE WHEN p.cliente IN ('otro', '') OR p.cliente IS NULL THEN 'interno' ELSE p.cliente END,
       COALESCE((
         SELECT array_agg(DISTINCT pf.user_id)
         FROM public.perfiles pf
         WHERE pf.activo AND pf.tipo = 'interno' AND p.responsable IS NOT NULL
           AND (p.responsable ILIKE '%' || split_part(pf.nombre, ' ', 1) || '%'
                OR (p.responsable ILIKE '%FCB%' AND pf.es_super_admin))
       ), '{}'::uuid[]),
       jsonb_strip_nulls(jsonb_build_object('responsable_texto', p.responsable, 'tipo_original', p.tipo, 'estado_original', p.estado, 'archivado', p.archivado)),
       jsonb_build_object('tabla', 'pendientes', 'id', p.id::text),
       CASE WHEN p.estado IN ('completado', 'hecho', 'listo') THEN COALESCE(p.updated_at, now()) END,
       COALESCE(p.created_at, now()), COALESCE(p.updated_at, now())
FROM public.pendientes p
ON CONFLICT DO NOTHING;

-- ─── 7. RPCs de reuniones ──────────────────────────────────────────────────
-- Copia los puntos abiertos de reuniones CERRADAS del mismo cliente (anteriores a p_reunion)
-- hacia p_reunion: el original pasa a 'arrastrada' y la copia lleva arrastrado_desde.
-- Devuelve cuántos puntos se arrastraron. La usa agenda_cerrar_reunion y "Preparar".
CREATE OR REPLACE FUNCTION public.agenda_arrastrar_pendientes(p_reunion uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r   public.agenda_reuniones%ROWTYPE;
  it  public.agenda_items%ROWTYPE;
  n   integer := 0;
BEGIN
  IF NOT public.agenda_puede_editar() THEN RAISE EXCEPTION 'Sin permiso para editar la agenda'; END IF;
  SELECT * INTO r FROM public.agenda_reuniones WHERE id = p_reunion;
  IF r.id IS NULL OR r.tipo <> 'reunion' OR r.estado = 'cerrada' THEN RETURN 0; END IF;
  FOR it IN
    SELECT i.* FROM public.agenda_items i
    JOIN public.agenda_reuniones ra ON ra.id = i.reunion_id
    WHERE i.tipo = 'punto' AND i.estado = 'abierta' AND i.reunion_id <> p_reunion
      AND ra.tipo = 'reunion' AND ra.estado = 'cerrada'
      AND ra.cliente_key IS NOT DISTINCT FROM r.cliente_key
      AND ra.fecha < r.fecha
    ORDER BY ra.fecha, i.orden
  LOOP
    INSERT INTO public.agenda_items (tipo, titulo, notas, estado, categoria, prioridad, fecha_limite, hora, cliente_key, responsables, reunion_id, arrastrado_desde, origen, orden, creado_por)
    VALUES ('punto', it.titulo, it.notas, 'abierta', it.categoria, it.prioridad, it.fecha_limite, it.hora, r.cliente_key, it.responsables, p_reunion, it.id,
            COALESCE(it.origen, '{}'::jsonb) || jsonb_build_object('arrastres', COALESCE((it.origen->>'arrastres')::int, 0) + 1), it.orden, auth.uid());
    UPDATE public.agenda_items SET estado = 'arrastrada' WHERE id = it.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END; $$;

-- Cierra la reunión: estado 'cerrada', cada punto abierto con responsable queda marcado para
-- aviso (notificar_a; el cron lo vuelve alerta agenda_asignado) y, si ya existe la siguiente
-- reunión del mismo cliente, los puntos abiertos se arrastran a ella. Si no existe todavía,
-- se quedan abiertos en esta reunión y se arrastrarán al crear/preparar la siguiente.
-- Devuelve { cerrada, avisos, arrastrados, siguiente }.
CREATE OR REPLACE FUNCTION public.agenda_cerrar_reunion(p_reunion uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r      public.agenda_reuniones%ROWTYPE;
  sig    uuid;
  avisos integer := 0;
  arr    integer := 0;
BEGIN
  IF NOT public.agenda_puede_editar() THEN RAISE EXCEPTION 'Sin permiso para editar la agenda'; END IF;
  SELECT * INTO r FROM public.agenda_reuniones WHERE id = p_reunion;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Reunión no encontrada'; END IF;
  IF r.estado = 'cerrada' THEN RETURN jsonb_build_object('cerrada', false, 'motivo', 'ya estaba cerrada'); END IF;

  UPDATE public.agenda_items
     SET notificar_a = responsables, notificar_motivo = 'cierre'
   WHERE reunion_id = p_reunion AND tipo = 'punto' AND estado = 'abierta' AND cardinality(responsables) > 0;
  GET DIAGNOSTICS avisos = ROW_COUNT;

  UPDATE public.agenda_reuniones SET estado = 'cerrada', cerrada_at = now() WHERE id = p_reunion;

  IF r.tipo = 'reunion' THEN
    SELECT id INTO sig FROM public.agenda_reuniones
     WHERE tipo = 'reunion' AND estado <> 'cerrada' AND id <> p_reunion
       AND cliente_key IS NOT DISTINCT FROM r.cliente_key AND fecha > r.fecha
     ORDER BY fecha LIMIT 1;
    IF sig IS NOT NULL THEN arr := public.agenda_arrastrar_pendientes(sig); END IF;
  END IF;
  RETURN jsonb_build_object('cerrada', true, 'avisos', avisos, 'arrastrados', arr, 'siguiente', sig);
END; $$;

GRANT EXECUTE ON FUNCTION public.agenda_arrastrar_pendientes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agenda_cerrar_reunion(uuid)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.agenda_puede_ver()               TO authenticated;
GRANT EXECUTE ON FUNCTION public.agenda_puede_editar()            TO authenticated;
