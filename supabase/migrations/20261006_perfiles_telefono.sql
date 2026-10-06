-- 2026-10-06 · Teléfono en el perfil (3.88.2): «Mandar mensaje» de Actividad del equipo abre WhatsApp directo.
-- Cada quien lo captura en Preferencias › Yo (set_perfil_propio) o el super admin en Administración › Editar datos.
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS telefono text;
COMMENT ON COLUMN public.perfiles.telefono IS 'Celular con lada (p. ej. 52 33 1234 5678). Se normaliza a dígitos en la app para wa.me.';

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
         telefono     = CASE WHEN p ? 'telefono'     THEN NULLIF(btrim(p->>'telefono'), '') ELSE telefono END,
         genero       = CASE WHEN p ? 'genero'       THEN NULLIF(p->>'genero', '')        ELSE genero END,
         avatar_fondo = CASE WHEN p ? 'avatar_fondo' THEN NULLIF(p->>'avatar_fondo', '')  ELSE avatar_fondo END
   WHERE user_id = auth.uid()
  RETURNING * INTO v_row;
  IF v_row.user_id IS NULL THEN
    RAISE EXCEPTION 'Perfil no encontrado';
  END IF;
  RETURN jsonb_build_object(
    'nombre', v_row.nombre, 'puesto', v_row.puesto, 'telefono', v_row.telefono, 'genero', v_row.genero,
    'avatar_fondo', v_row.avatar_fondo, 'avatar_url', v_row.avatar_url, 'avatar_estado', v_row.avatar_estado
  );
END;
$$;
