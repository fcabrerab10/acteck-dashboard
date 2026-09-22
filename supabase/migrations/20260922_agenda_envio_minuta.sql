-- Agenda · enviar la minuta por correo al cliente (2026-09-22, Fernando: «cuando acabe la minuta,
-- por ejemplo esta reunión es con Digitalife, se le pueda mandar la minuta por correo»).
--   agenda_contactos            contactos del cliente que reciben minutas (se recuerdan por cliente)
--   agenda_reuniones.envios     bitácora [{ at, para[], cc[], por, asunto }]
-- El envío lo hace api/google-calendar.js?action=enviar-minuta (JWT + SMTP de Vercel).

CREATE TABLE IF NOT EXISTS public.agenda_contactos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_key  text NOT NULL,
  nombre       text,
  email        text NOT NULL,
  puesto       text,
  activo       boolean NOT NULL DEFAULT true,
  creado_por   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS agenda_contactos_cliente_email_idx ON public.agenda_contactos (cliente_key, lower(email));

CREATE OR REPLACE FUNCTION public.agenda_contacto_defaults()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.creado_por IS NULL THEN NEW.creado_por := auth.uid(); END IF;
  NEW.email := lower(trim(NEW.email));
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_agenda_contacto_defaults ON public.agenda_contactos;
CREATE TRIGGER trg_agenda_contacto_defaults BEFORE INSERT OR UPDATE ON public.agenda_contactos
  FOR EACH ROW EXECUTE FUNCTION public.agenda_contacto_defaults();

ALTER TABLE public.agenda_contactos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agenda_contactos_select ON public.agenda_contactos;
DROP POLICY IF EXISTS agenda_contactos_insert ON public.agenda_contactos;
DROP POLICY IF EXISTS agenda_contactos_update ON public.agenda_contactos;
DROP POLICY IF EXISTS agenda_contactos_delete ON public.agenda_contactos;
CREATE POLICY agenda_contactos_select ON public.agenda_contactos FOR SELECT TO authenticated USING (public.agenda_puede_ver());
CREATE POLICY agenda_contactos_insert ON public.agenda_contactos FOR INSERT TO authenticated WITH CHECK (public.agenda_puede_editar());
CREATE POLICY agenda_contactos_update ON public.agenda_contactos FOR UPDATE TO authenticated USING (public.agenda_puede_editar()) WITH CHECK (public.agenda_puede_editar());
CREATE POLICY agenda_contactos_delete ON public.agenda_contactos FOR DELETE TO authenticated USING (public.agenda_puede_editar());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_contactos TO authenticated;
REVOKE ALL ON public.agenda_contactos FROM anon;

DO $$ BEGIN
  IF to_regprocedure('public.fn_auditoria()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_auditoria ON public.agenda_contactos;
    CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.agenda_contactos
      FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria('id');
  END IF;
END $$;

ALTER TABLE public.agenda_reuniones ADD COLUMN IF NOT EXISTS envios jsonb NOT NULL DEFAULT '[]'::jsonb;
