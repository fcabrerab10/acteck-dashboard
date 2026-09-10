-- Preferencias de UI por usuario (menú: modo, favoritos, densidad, pestaña de inicio).
-- Estructura esperada:
--   { "menu": { "modo": "barra|sidebar|iphone", "favoritos": ["inicio", "digitalife:home", …],
--               "densidad": "comoda|compacta", "inicio": "inicio|ultima" } }
--
-- Las políticas RLS de `perfiles` sólo permiten UPDATE al super admin, así que la app
-- escribe vía RPC SECURITY DEFINER que toca únicamente la fila propia y sólo esta columna.

ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS preferencias jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.perfiles.preferencias IS
  'Preferencias de UI del usuario (menu.modo, menu.favoritos, menu.densidad, menu.inicio). Se escribe con set_preferencias().';

CREATE OR REPLACE FUNCTION public.set_preferencias(p_preferencias jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_out jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  IF p_preferencias IS NULL OR jsonb_typeof(p_preferencias) <> 'object' THEN
    RAISE EXCEPTION 'preferencias debe ser un objeto JSON';
  END IF;
  UPDATE public.perfiles
     SET preferencias = COALESCE(preferencias, '{}'::jsonb) || p_preferencias
   WHERE user_id = auth.uid()
  RETURNING preferencias INTO v_out;
  RETURN v_out;
END;
$$;

REVOKE ALL ON FUNCTION public.set_preferencias(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.set_preferencias(jsonb) TO authenticated;
