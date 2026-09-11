-- 20260911 · Agenda · conexión de Google Calendar por usuario (api/google-calendar.js)
--
-- `refresh_token` sólo lo lee/escribe el service role (Vercel): no hay policy de INSERT/UPDATE
-- para authenticated y la columna está fuera del GRANT SELECT, así que desde la app sólo se ve
-- si el usuario está conectado (user_id, email, calendar_id, conectado_at, ultima_sync) y sólo
-- su propia fila. El usuario puede desconectarse (DELETE de su fila) desde la app.
-- No lleva trg_auditoria a propósito: fn_auditoria copiaría el refresh_token a auditoria_cambios.

CREATE TABLE IF NOT EXISTS public.agenda_google (
  user_id       uuid PRIMARY KEY,
  email         text,
  refresh_token text NOT NULL,
  calendar_id   text NOT NULL DEFAULT 'primary',
  scope         text,
  conectado_at  timestamptz NOT NULL DEFAULT now(),
  ultima_sync   timestamptz,
  ultimo_error  text
);
ALTER TABLE public.agenda_google ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agenda_google_select ON public.agenda_google;
DROP POLICY IF EXISTS agenda_google_delete ON public.agenda_google;
CREATE POLICY agenda_google_select ON public.agenda_google FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY agenda_google_delete ON public.agenda_google FOR DELETE TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.agenda_google FROM authenticated, anon;
GRANT SELECT (user_id, email, calendar_id, scope, conectado_at, ultima_sync, ultimo_error), DELETE ON public.agenda_google TO authenticated;
