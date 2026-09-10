-- Perfil con foto ilustrada (avatar) + datos propios editables (2026-09-11).
--
-- 1) Columnas nuevas en perfiles: avatar_url / avatar_estado / avatar_fondo / genero / preferencias.
-- 2) Buckets de Storage:
--      avatares          → público de lectura. Contiene `{user_id}.png` (la ilustración final).
--      avatares-privado  → privado. Contiene `selfies/{user_id}.jpg` (la selfie original).
--    Ningún bucket tiene policies de escritura para `authenticated`: sólo escribe el service role
--    desde `api/avatar.js`. (Un bucket público sirve /object/public/... sin RLS, por eso la selfie
--    vive en un bucket aparte y no en un prefijo del público.)
-- 3) RPC set_perfil_propio(jsonb): las policies de perfiles sólo dejan UPDATE al super admin, así
--    que la app guarda nombre / puesto / genero / avatar_fondo de su propia fila vía SECURITY DEFINER.

ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS avatar_url    text,
  ADD COLUMN IF NOT EXISTS avatar_estado text,
  ADD COLUMN IF NOT EXISTS avatar_fondo  text,
  ADD COLUMN IF NOT EXISTS genero        text,
  ADD COLUMN IF NOT EXISTS preferencias  jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'perfiles_avatar_estado_chk') THEN
    ALTER TABLE public.perfiles ADD CONSTRAINT perfiles_avatar_estado_chk
      CHECK (avatar_estado IS NULL OR avatar_estado IN ('pendiente', 'listo', 'error'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'perfiles_avatar_fondo_chk') THEN
    ALTER TABLE public.perfiles ADD CONSTRAINT perfiles_avatar_fondo_chk
      CHECK (avatar_fondo IS NULL OR avatar_fondo IN ('noche', 'dia'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'perfiles_genero_chk') THEN
    ALTER TABLE public.perfiles ADD CONSTRAINT perfiles_genero_chk
      CHECK (genero IS NULL OR genero IN ('masculino', 'femenino', 'otro'));
  END IF;
END $$;

COMMENT ON COLUMN public.perfiles.avatar_url    IS 'URL pública de la ilustración (bucket avatares/{user_id}.png?v=ts). La escribe api/avatar.js.';
COMMENT ON COLUMN public.perfiles.avatar_estado IS 'pendiente | listo | error — estado de la última generación.';
COMMENT ON COLUMN public.perfiles.avatar_fondo  IS 'noche | dia — fondo elegido para la ilustración.';
COMMENT ON COLUMN public.perfiles.genero        IS 'masculino | femenino | otro — sólo si el usuario lo eligió; preselecciona el fondo.';

-- ─── Storage ───
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatares', 'avatares', true, 4194304, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatares-privado', 'avatares-privado', false, 3145728, ARRAY['image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Lectura autenticada del bucket público vía API (la URL /object/public/ no la necesita, pero
-- permite listar/descargar con el cliente si algún día hace falta). Sin policies de escritura.
DROP POLICY IF EXISTS "avatares lectura" ON storage.objects;
CREATE POLICY "avatares lectura" ON storage.objects
  FOR SELECT TO authenticated, anon
  USING (bucket_id = 'avatares');

-- ─── RPC: editar la fila propia (campos acotados) ───
CREATE OR REPLACE FUNCTION public.set_perfil_propio(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.perfiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN
    RAISE EXCEPTION 'p debe ser un objeto JSON';
  END IF;
  UPDATE public.perfiles
     SET nombre       = CASE WHEN p ? 'nombre'       THEN NULLIF(btrim(p->>'nombre'), '') ELSE nombre END,
         puesto       = CASE WHEN p ? 'puesto'       THEN NULLIF(btrim(p->>'puesto'), '') ELSE puesto END,
         genero       = CASE WHEN p ? 'genero'       THEN NULLIF(p->>'genero', '')        ELSE genero END,
         avatar_fondo = CASE WHEN p ? 'avatar_fondo' THEN NULLIF(p->>'avatar_fondo', '')  ELSE avatar_fondo END
   WHERE user_id = auth.uid()
  RETURNING * INTO v_row;
  IF v_row.user_id IS NULL THEN
    RAISE EXCEPTION 'Perfil no encontrado';
  END IF;
  RETURN jsonb_build_object(
    'nombre', v_row.nombre, 'puesto', v_row.puesto, 'genero', v_row.genero,
    'avatar_fondo', v_row.avatar_fondo, 'avatar_url', v_row.avatar_url, 'avatar_estado', v_row.avatar_estado
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_perfil_propio(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.set_perfil_propio(jsonb) TO authenticated;

-- ─── tema_ui: el CHECK viejo sólo admitía airy/puro/hibrida, así que ThemeProvider nunca lograba
-- persistir claro/midnight/marfil (el update fallaba en silencio). Se amplía e incluye 'auto'
-- (= seguir prefers-color-scheme del sistema).
ALTER TABLE public.perfiles DROP CONSTRAINT IF EXISTS perfiles_tema_ui_check;
ALTER TABLE public.perfiles ADD CONSTRAINT perfiles_tema_ui_check
  CHECK (tema_ui IS NULL OR tema_ui IN ('airy', 'puro', 'hibrida', 'claro', 'midnight', 'marfil', 'auto'));
