-- 20260921 · Agenda V4 — "lo que dejaste / lo que tienes"
--
-- Decisión de Fernando (2026-09-21): la bandeja de la Agenda se llenaba de alertas de SKUs
-- (tabla `alertas`, áreas inventario/ventas/…) y tapaba los pendientes reales. La Agenda pasa a
-- mostrar SÓLO agenda_items + recordatorios de cuentas; las alertas del sistema se quedan en la
-- campana (central de notificaciones).
--
-- Qué añade esta migración (todo idempotente):
--   1. agenda_subtareas            checklist de un pendiente ("3/10"). El padre NO se cierra solo.
--   2. cuentas_seguimiento         cuentas que Fernando sigue como gerente de ventas (directas o
--      + cuentas_seguimiento_notas vía mayorista) con bitácora de contactos y próximo seguimiento.
--   3. agenda_reuniones.tipo       acepta 'viaje' (ausencias de varios días en el calendario).
--   4. Permiso `agenda`            deja de ser implícito para los internos: RLS y UI piden
--                                  es_super_admin o permisos.globales.agenda ∈ (ver, edit).
--                                  David Millán queda en 'oculto' (decisión de Fernando).
--   5. Semilla                     9 contactos de la convención CVA (2026-09-21) + 1 pendiente
--                                  de seguimiento por cuenta para Fernando (25 sep).

-- ═══ 1. Subtareas ═════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.agenda_subtareas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    uuid NOT NULL REFERENCES public.agenda_items (id) ON DELETE CASCADE,
  titulo     text NOT NULL,
  hecha      boolean NOT NULL DEFAULT false,
  orden      integer NOT NULL DEFAULT 0,
  creado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agenda_subtareas_item_idx ON public.agenda_subtareas (item_id, orden);

-- ═══ 2. Cuentas que sigo ══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.cuentas_seguimiento (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre              text NOT NULL,
  contacto            text,
  telefono            text,
  email               text,
  empresa             text,
  tipo                text NOT NULL DEFAULT 'directa' CHECK (tipo IN ('directa', 'mayorista')),
  mayorista           text,                       -- 'CVA', 'CT', … cuando tipo = 'mayorista'
  vendedor            text,                       -- vendedor de Acteck que la lleva ('Sarahi', …)
  cliente_erp         text,                       -- código del cliente en el ERP, si ya existe
  notas               text,
  proximo_seguimiento date,
  recordar_cada_dias  integer NOT NULL DEFAULT 14 CHECK (recordar_cada_dias BETWEEN 1 AND 365),
  ultimo_contacto     date,
  estado              text NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'pausada', 'cerrada')),
  creado_por          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cuentas_seguimiento_estado_idx  ON public.cuentas_seguimiento (estado, proximo_seguimiento);
CREATE INDEX IF NOT EXISTS cuentas_seguimiento_empresa_idx ON public.cuentas_seguimiento (empresa);
-- Semilla idempotente: una cuenta por (nombre, empresa).
CREATE UNIQUE INDEX IF NOT EXISTS cuentas_seguimiento_nombre_uq
  ON public.cuentas_seguimiento (lower(nombre), lower(COALESCE(empresa, '')));

CREATE TABLE IF NOT EXISTS public.cuentas_seguimiento_notas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cuenta_id  uuid NOT NULL REFERENCES public.cuentas_seguimiento (id) ON DELETE CASCADE,
  fecha      date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Mexico_City')::date,
  texto      text NOT NULL,
  creado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cuentas_seguimiento_notas_idx ON public.cuentas_seguimiento_notas (cuenta_id, fecha DESC);

-- ═══ 3. Viajes / ausencias en el calendario ═══════════════════════════════════
-- Un viaje es una reunión de tipo 'viaje': ya tiene fecha + fecha_fin (varios días) y se pinta
-- en el calendario sin inventar otra tabla.
DO $$ BEGIN
  ALTER TABLE public.agenda_reuniones DROP CONSTRAINT IF EXISTS agenda_reuniones_tipo_check;
  ALTER TABLE public.agenda_reuniones ADD CONSTRAINT agenda_reuniones_tipo_check
    CHECK (tipo IN ('reunion', 'evento', 'viaje'));
END $$;

-- ═══ 4. updated_at automático ═════════════════════════════════════════════════
DROP TRIGGER IF EXISTS trg_agenda_touch ON public.agenda_subtareas;
CREATE TRIGGER trg_agenda_touch BEFORE UPDATE ON public.agenda_subtareas FOR EACH ROW EXECUTE FUNCTION public.agenda_touch();
DROP TRIGGER IF EXISTS trg_agenda_touch ON public.cuentas_seguimiento;
CREATE TRIGGER trg_agenda_touch BEFORE UPDATE ON public.cuentas_seguimiento FOR EACH ROW EXECUTE FUNCTION public.agenda_touch();

-- ═══ 5. Permiso agenda: ya no es implícito para los internos ═══════════════════
-- Antes: super admin OR tipo='interno' OR permiso ∈ (ver,edit). Ahora el permiso manda,
-- para que David Millán no vea la Agenda ni por la app ni por PostgREST.
CREATE OR REPLACE FUNCTION public.agenda_puede_ver()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.user_id = auth.uid() AND p.activo = true
      AND (p.es_super_admin = true
           OR COALESCE(p.permisos->'globales'->>'agenda', '') IN ('ver', 'edit'))
  );
$$;
CREATE OR REPLACE FUNCTION public.agenda_puede_editar()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.user_id = auth.uid() AND p.activo = true
      AND (p.es_super_admin = true
           OR COALESCE(p.permisos->'globales'->>'agenda', '') = 'edit')
  );
$$;

-- Fernando es super admin; Karolina en 'edit'; David en 'oculto' (decisión 2026-09-21).
UPDATE public.perfiles SET permisos = jsonb_set(COALESCE(permisos, '{}'::jsonb), '{globales,agenda}', '"edit"'::jsonb, true)
 WHERE email = 'karolina.veliz@acteck.com';
UPDATE public.perfiles SET permisos = jsonb_set(COALESCE(permisos, '{}'::jsonb), '{globales,agenda}', '"oculto"'::jsonb, true)
 WHERE email = 'dmillan@acteck.com';

-- ═══ 6. RLS + grants de las tablas nuevas ═════════════════════════════════════
ALTER TABLE public.agenda_subtareas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cuentas_seguimiento       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cuentas_seguimiento_notas ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['agenda_subtareas', 'cuentas_seguimiento', 'cuentas_seguimiento_notas'] LOOP
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_subtareas, public.cuentas_seguimiento, public.cuentas_seguimiento_notas TO authenticated;

-- ═══ 7. Auditoría (fn_auditoria de 20260910_auditoria_cambios.sql) ════════════
DO $$ DECLARE t text; BEGIN
  IF to_regprocedure('public.fn_auditoria()') IS NOT NULL THEN
    FOREACH t IN ARRAY ARRAY['agenda_subtareas', 'cuentas_seguimiento', 'cuentas_seguimiento_notas'] LOOP
      EXECUTE format('DROP TRIGGER IF EXISTS trg_auditoria ON public.%I', t);
      EXECUTE format('CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria(''id'')', t);
    END LOOP;
  END IF;
END $$;

-- ═══ 8. Semilla · convención CVA (correo de Fernando del 2026-09-21) ══════════
-- La "acción" acordada con cada contacto va en `notas`. Todos: tipo mayorista, mayorista CVA,
-- próximo seguimiento 25-sep-2026, recordatorio cada 14 días.
INSERT INTO public.cuentas_seguimiento (nombre, contacto, telefono, empresa, tipo, mayorista, vendedor, notas, proximo_seguimiento, recordar_cada_dias, estado, creado_por)
SELECT v.nombre, v.nombre, v.telefono, v.empresa, 'mayorista', 'CVA', v.vendedor, v.notas, DATE '2026-09-25', 14, 'activa',
       (SELECT user_id FROM public.perfiles WHERE email = 'fernando.cabrera@acteck.com' LIMIT 1)
FROM (VALUES
  ('Luis De Viana',  '+52 55 1053 6205', NULL,                         '', 'Proyectos con el Tec de Monterrey y una nueva dependencia de gobierno; interés en ecommerce. Acción: dar seguimiento a los proyectos.'),
  ('Eduardo Macías', '+52 444 141 6844', 'Compu Lan',                   '', 'Servicios de cómputo y venta. Acción: entender su operación y portafolio para detectar oportunidades.'),
  ('Soco Villalobos','+52 614 247 9151', 'Estrellas de Cómputo',        '', 'Ya trabaja con nosotros y tiene buen consumo; queda pendiente el convenio de submayoreo y los rebates en especie. Acción: revisar el estatus del convenio.'),
  ('Armin Pat',      '+52 999 122 7212', 'Grupo Isi Sureste',           '', 'Buena selección de producto; falta seguimiento de rebates. Acción: revisar el esquema de rebates.'),
  ('Saul Muñoz',     '+52 444 334 8416', 'VDNET',                       '', 'Proyectos de iniciativa privada. Acción: conocer los proyectos actuales.'),
  ('Juan José',      '+52 618 237 0717', 'PSA Cómputo y Papelería',     'Sarahi', 'Ya distribuye la marca, pero no se le han presentado productos nuevos. Sarahi tiene visita el viernes. Acción: presentar los nuevos productos en esa visita.'),
  ('Mario Prior',    '+52 229 771 4179', NULL,                          '', 'Ya tuvo negocio con nosotros. Acción: retomar el contacto.'),
  ('David Castro',   '+52 33 1021 5152', 'MyCom',                       '', 'Ecommerce. MyCom hace infraestructura, redes y ecommerce. Acción: dar seguimiento por separado de Chema Pelayo.'),
  ('Chema Pelayo',   '+52 33 3201 8668', 'MyCom',                       '', 'Proyectos. MyCom hace infraestructura, redes y ecommerce. Acción: dar seguimiento por separado de David Castro.'),
  ('Victor Salas',   '+52 55 5405 0985', NULL,                          '', 'Proyectos de gobierno en educación; interés en TikTok Shop y Lives. Acción: entender el proyecto y revisar TikTok Shop.')
) AS v(nombre, telefono, empresa, vendedor, notas)
ON CONFLICT DO NOTHING;

-- Un pendiente de seguimiento por cuenta (responsable Fernando, 25 sep). Idempotente por
-- origen->>'cuenta_id': si ya existe uno abierto para esa cuenta no se crea otro.
INSERT INTO public.agenda_items (tipo, titulo, notas, estado, categoria, prioridad, fecha_limite, cliente_key, responsables, origen, creado_por)
SELECT 'tarea',
       'Seguimiento: ' || c.nombre || COALESCE(' (' || NULLIF(c.empresa, '') || ')', ''),
       c.notas, 'abierta', 'comercial', 'media', c.proximo_seguimiento, NULL,
       ARRAY[(SELECT user_id FROM public.perfiles WHERE email = 'fernando.cabrera@acteck.com' LIMIT 1)]::uuid[],
       jsonb_build_object('fuente', 'cuentas_seguimiento', 'cuenta_id', c.id::text),
       (SELECT user_id FROM public.perfiles WHERE email = 'fernando.cabrera@acteck.com' LIMIT 1)
FROM public.cuentas_seguimiento c
WHERE c.mayorista = 'CVA'
  AND NOT EXISTS (
    SELECT 1 FROM public.agenda_items i
    WHERE i.origen->>'cuenta_id' = c.id::text AND i.estado IN ('abierta', 'arrastrada')
  );

NOTIFY pgrst, 'reload schema';
