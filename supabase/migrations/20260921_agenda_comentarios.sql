-- 20260921 · Agenda · seguimiento por punto (comentarios) + traer puntos de UNA reunión anterior
--
-- Petición de Fernando (2026-09-21): «como seguimiento de una reunión dentro de agenda, que se
-- pueda abrir una reunión anterior o los puntos que se verán en una reunión próxima, y abajo de
-- cada punto ir poniendo los comentarios (seguimiento o mejora) para que no se pierda nada».
--
-- Qué añade (todo idempotente):
--   1. agenda_item_comentarios     hilo por punto: seguimiento · mejora · acuerdo. `reunion_id` guarda
--                                  la reunión EN LA QUE se comentó (por omisión la del punto), para que
--                                  el hilo se pueda leer "por reunión" aunque el punto se arrastre.
--   2. agenda_traer_puntos()       copia los puntos ABIERTOS de UNA reunión anterior a otra, con la
--                                  misma semántica que agenda_arrastrar_pendientes (copia 'abierta',
--                                  original 'arrastrada'), pero eligiendo la reunión origen a mano y
--                                  sin exigir que esté cerrada. Deja origen.item_anterior /
--                                  origen.reunion_anterior para poder pintar "viene de la reunión del …".
--   3. Semilla                     reunión «Reunión Digitalife · puntos del martes» (22-sep-2026 10:00)
--                                  con sus 12 puntos en orden y enlace a la pantalla del dashboard,
--                                  + 2 proyectos de abasto (bocinas y gabinetes Batauro).

-- ═══ 1. Comentarios por punto ═════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.agenda_item_comentarios (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    uuid NOT NULL REFERENCES public.agenda_items (id) ON DELETE CASCADE,
  reunion_id uuid REFERENCES public.agenda_reuniones (id) ON DELETE SET NULL,
  tipo       text NOT NULL DEFAULT 'seguimiento' CHECK (tipo IN ('seguimiento', 'mejora', 'acuerdo')),
  texto      text NOT NULL,
  autor      uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agenda_item_comentarios_item_idx    ON public.agenda_item_comentarios (item_id, created_at);
CREATE INDEX IF NOT EXISTS agenda_item_comentarios_reunion_idx ON public.agenda_item_comentarios (reunion_id, created_at);

-- Rellena autor (auth.uid()) y reunion_id (la del punto) cuando la app no los manda.
CREATE OR REPLACE FUNCTION public.agenda_comentario_defaults()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.autor IS NULL THEN NEW.autor := auth.uid(); END IF;
  IF NEW.reunion_id IS NULL THEN
    SELECT i.reunion_id INTO NEW.reunion_id FROM public.agenda_items i WHERE i.id = NEW.item_id;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_agenda_comentario_defaults ON public.agenda_item_comentarios;
CREATE TRIGGER trg_agenda_comentario_defaults BEFORE INSERT ON public.agenda_item_comentarios
  FOR EACH ROW EXECUTE FUNCTION public.agenda_comentario_defaults();

-- RLS: mismo predicado que agenda_items (agenda_puede_ver / agenda_puede_editar).
ALTER TABLE public.agenda_item_comentarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agenda_item_comentarios_select ON public.agenda_item_comentarios;
DROP POLICY IF EXISTS agenda_item_comentarios_insert ON public.agenda_item_comentarios;
DROP POLICY IF EXISTS agenda_item_comentarios_update ON public.agenda_item_comentarios;
DROP POLICY IF EXISTS agenda_item_comentarios_delete ON public.agenda_item_comentarios;
CREATE POLICY agenda_item_comentarios_select ON public.agenda_item_comentarios FOR SELECT TO authenticated USING (public.agenda_puede_ver());
CREATE POLICY agenda_item_comentarios_insert ON public.agenda_item_comentarios FOR INSERT TO authenticated WITH CHECK (public.agenda_puede_editar());
CREATE POLICY agenda_item_comentarios_update ON public.agenda_item_comentarios FOR UPDATE TO authenticated USING (public.agenda_puede_editar()) WITH CHECK (public.agenda_puede_editar());
CREATE POLICY agenda_item_comentarios_delete ON public.agenda_item_comentarios FOR DELETE TO authenticated USING (public.agenda_puede_editar());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_item_comentarios TO authenticated;
REVOKE ALL ON public.agenda_item_comentarios FROM anon;

-- Auditoría (fn_auditoria de 20260910_auditoria_cambios.sql)
DO $$ BEGIN
  IF to_regprocedure('public.fn_auditoria()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_auditoria ON public.agenda_item_comentarios;
    CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.agenda_item_comentarios
      FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria('id');
  END IF;
END $$;

-- ═══ 2. Traer los puntos abiertos de UNA reunión anterior ═════════════════════
-- agenda_arrastrar_pendientes(p_reunion) barre TODAS las reuniones cerradas anteriores del mismo
-- cliente. Esta elige una sola (el botón «Traer puntos abiertos» del panel «Reunión anterior»),
-- no exige que esté cerrada y anota de dónde viene cada copia.
CREATE OR REPLACE FUNCTION public.agenda_traer_puntos(p_reunion uuid, p_desde uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r   public.agenda_reuniones%ROWTYPE;
  ra  public.agenda_reuniones%ROWTYPE;
  it  public.agenda_items%ROWTYPE;
  n   integer := 0;
BEGIN
  IF NOT public.agenda_puede_editar() THEN RAISE EXCEPTION 'Sin permiso para editar la agenda'; END IF;
  SELECT * INTO r  FROM public.agenda_reuniones WHERE id = p_reunion;
  SELECT * INTO ra FROM public.agenda_reuniones WHERE id = p_desde;
  IF r.id IS NULL OR ra.id IS NULL OR r.id = ra.id THEN RETURN 0; END IF;
  IF r.tipo <> 'reunion' OR r.estado = 'cerrada' THEN RETURN 0; END IF;
  FOR it IN
    SELECT i.* FROM public.agenda_items i
    WHERE i.tipo = 'punto' AND i.estado = 'abierta' AND i.reunion_id = p_desde
    ORDER BY i.orden, i.created_at
  LOOP
    -- Ya se trajo antes: no duplicar.
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.agenda_items x WHERE x.reunion_id = p_reunion AND x.arrastrado_desde = it.id);
    INSERT INTO public.agenda_items (tipo, titulo, notas, estado, categoria, prioridad, fecha_limite, hora, cliente_key, responsables, reunion_id, arrastrado_desde, origen, orden, creado_por)
    VALUES ('punto', it.titulo, it.notas, 'abierta', it.categoria, it.prioridad, it.fecha_limite, it.hora, r.cliente_key, it.responsables, p_reunion, it.id,
            COALESCE(it.origen, '{}'::jsonb) || jsonb_build_object(
              'arrastres', COALESCE((it.origen->>'arrastres')::int, 0) + 1,
              'item_anterior', it.id::text,
              'reunion_anterior', p_desde::text),
            COALESCE((SELECT MAX(x.orden) FROM public.agenda_items x WHERE x.reunion_id = p_reunion), -1) + 1 + n,
            auth.uid());
    UPDATE public.agenda_items SET estado = 'arrastrada' WHERE id = it.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END; $$;
GRANT EXECUTE ON FUNCTION public.agenda_traer_puntos(uuid, uuid) TO authenticated;

-- ═══ 3. Semilla · reunión Digitalife del martes 22-sep-2026 ═══════════════════
-- Los 12 puntos del correo de Fernando, en orden, con `origen.enlace` para el botón
-- «Ver en dashboard» de la minuta (web: acteck:navegar · móvil: nav.navegar).
DO $$
DECLARE
  v_fer  uuid := (SELECT user_id FROM public.perfiles WHERE email = 'fernando.cabrera@acteck.com' LIMIT 1);
  v_reu  uuid;
  v_i    integer := 0;
  v_p    record;
BEGIN
  SELECT id INTO v_reu FROM public.agenda_reuniones
   WHERE cliente_key = 'digitalife' AND titulo = 'Reunión Digitalife · puntos del martes'
     AND fecha::date = DATE '2026-09-22' LIMIT 1;
  IF v_reu IS NULL THEN
    INSERT INTO public.agenda_reuniones (tipo, titulo, cliente_key, fecha, duracion_min, estado, notas, asistentes, creado_por)
    VALUES ('reunion', 'Reunión Digitalife · puntos del martes', 'digitalife',
            TIMESTAMPTZ '2026-09-22 10:00:00-06', 60, 'programada', '', '[]'::jsonb, v_fer)   -- 'abierta' en la UI = 'programada' en el CHECK
    RETURNING id INTO v_reu;
  END IF;

  FOR v_p IN
    SELECT * FROM (VALUES
      ( 1, 'Alcance de compra Q3',                     'sellIn',            'digitalife'),
      ( 2, 'Órdenes de compra pendientes Acteck, Balam y Audive', 'ordenesCompra', NULL),
      ( 3, 'Notas de crédito',                         'pagos',             'digitalife'),
      ( 4, 'Camisas',                                  'marketing',         'digitalife'),
      ( 5, 'Forecast de Q4 y cierre de año',           'forecastReservas',  NULL),
      ( 6, 'Necesitamos 1,000 bocinas más de las que ya tenemos pendientes del proyecto (500 adicionales de las que llegan: cuántas les llegan y la fecha están pendientes de confirmar)', 'forecastReservas', NULL),
      ( 7, 'Revisión de la ODC de los cables pendiente','ordenesCompra',    NULL),
      ( 8, 'Publicidad de banner en paredes',          'marketing',         'digitalife'),
      ( 9, 'Revisión de precios monitores',            'estrategiaPrecios', NULL),
      (10, 'Gabinetes proyecto Batauro',               'forecastReservas',  NULL),
      (11, 'Comida el martes en Campomar',             NULL,                NULL),
      (12, 'Fin de Q3',                                'sellIn',            'digitalife')
    ) AS t(orden, titulo, pagina, cliente)
    ORDER BY 1
  LOOP
    v_i := v_i + 1;
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.agenda_items i WHERE i.reunion_id = v_reu AND i.titulo = v_p.titulo);
    INSERT INTO public.agenda_items (tipo, titulo, estado, prioridad, cliente_key, responsables, reunion_id, orden, origen, creado_por)
    VALUES ('punto', v_p.titulo, 'abierta', 'media', 'digitalife', ARRAY[v_fer]::uuid[], v_reu, v_p.orden - 1,
            jsonb_build_object('fuente', 'correo', 'enlace',
              CASE WHEN v_p.pagina IS NULL THEN NULL
                   ELSE jsonb_strip_nulls(jsonb_build_object('pagina', v_p.pagina, 'clienteKey', v_p.cliente)) END),
            v_fer);
  END LOOP;
END $$;

-- Dos proyectos de abasto (sin líneas: Fernando agrega los SKUs).
INSERT INTO public.proyectos (nombre, cliente, anio, mes, probabilidad, responsable, notas, creado_por)
SELECT v.nombre, 'digitalife', 2026, 10, 'probable', 'Fernando', v.notas, 'fernando.cabrera@acteck.com'
FROM (VALUES
  ('Bocinas Digitalife (1,000 + 500 por confirmar)', '500 adicionales de las que llegan; cantidad y fecha pendientes de confirmar'),
  ('Gabinetes proyecto Batauro', NULL)
) AS v(nombre, notas)
WHERE NOT EXISTS (SELECT 1 FROM public.proyectos p WHERE p.nombre = v.nombre AND p.cliente = 'digitalife');

NOTIFY pgrst, 'reload schema';
