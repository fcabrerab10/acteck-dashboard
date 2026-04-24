-- ═══════════════════════════════════════════════════════════════════════
-- Refactor de permisos: granular por (cliente, pestaña) + pestañas globales.
-- Niveles: 'oculto' | 'ver' | 'edit'
-- ═══════════════════════════════════════════════════════════════════════
--
-- Reemplaza el esquema viejo (rol/clientes/modulos/pestanas_cliente/
-- puede_editar) por uno más granular. Los campos viejos SE MANTIENEN por
-- compatibilidad (la UI los deja de usar pero siguen ahí hasta migrar todo
-- el código).

ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS tipo            TEXT CHECK (tipo IN ('interno','externo')),
  ADD COLUMN IF NOT EXISTS puesto          TEXT,
  ADD COLUMN IF NOT EXISTS es_super_admin  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS permisos        JSONB;

-- ═══ AUTO-MIGRACIÓN — CONSERVADORA (no filtra info confidencial) ═══
--
-- Fernando (super_admin): tipo=interno, es_super_admin=true
--   Tiene acceso total vía el flag, no necesita permisos explícitos pero
--   se los seteamos por consistencia.
UPDATE public.perfiles
SET
  tipo           = 'interno',
  es_super_admin = true,
  puesto         = COALESCE(puesto, 'Director General'),
  permisos       = jsonb_build_object(
    'clientes', jsonb_build_object(
      'digitalife',   jsonb_build_object('home','edit','analisis','edit','estrategia','edit','marketing','edit','pagos','edit','cartera','edit'),
      'pcel',         jsonb_build_object('home','edit','analisis','edit','estrategia','edit','marketing','edit','pagos','edit','cartera','edit'),
      'mercadolibre', jsonb_build_object('home','edit','analisis','edit','estrategia','edit','marketing','edit','pagos','edit','cartera','edit')
    ),
    'globales', jsonb_build_object(
      'resumen_clientes','edit',
      'forecast_clientes','edit',
      'admin_interna','edit',
      'configuracion','edit'
    )
  )
WHERE rol = 'super_admin';

-- Karolina (admin): tipo=interno, es_super_admin=false (solo Fernando es super).
--   Tiene TODO edit salvo Configuración (reservada a Fernando).
UPDATE public.perfiles
SET
  tipo           = 'interno',
  es_super_admin = false,
  puesto         = COALESCE(puesto, 'Administración'),
  permisos       = jsonb_build_object(
    'clientes', jsonb_build_object(
      'digitalife',   jsonb_build_object('home','edit','analisis','edit','estrategia','edit','marketing','edit','pagos','edit','cartera','edit'),
      'pcel',         jsonb_build_object('home','edit','analisis','edit','estrategia','edit','marketing','edit','pagos','edit','cartera','edit'),
      'mercadolibre', jsonb_build_object('home','edit','analisis','edit','estrategia','edit','marketing','edit','pagos','edit','cartera','edit')
    ),
    'globales', jsonb_build_object(
      'resumen_clientes','edit',
      'forecast_clientes','edit',
      'admin_interna','edit',
      'configuracion','oculto'
    )
  )
WHERE rol = 'admin';

-- Asistentes (rol legacy): tipo=interno, sin super_admin.
--   Edit si puede_editar=true, else ver. Configuración siempre oculta.
--   Admin interna permitida (equipo interno).
UPDATE public.perfiles
SET
  tipo           = 'interno',
  es_super_admin = false,
  permisos       = jsonb_build_object(
    'clientes', jsonb_build_object(
      'digitalife',   jsonb_build_object(
        'home', CASE WHEN 'digitalife' = ANY(clientes) THEN (CASE WHEN puede_editar THEN 'edit' ELSE 'ver' END) ELSE 'oculto' END,
        'analisis', CASE WHEN 'digitalife' = ANY(clientes) THEN (CASE WHEN puede_editar THEN 'edit' ELSE 'ver' END) ELSE 'oculto' END,
        'estrategia', CASE WHEN 'digitalife' = ANY(clientes) THEN (CASE WHEN puede_editar THEN 'edit' ELSE 'ver' END) ELSE 'oculto' END,
        'marketing', CASE WHEN 'digitalife' = ANY(clientes) THEN (CASE WHEN puede_editar THEN 'edit' ELSE 'ver' END) ELSE 'oculto' END,
        'pagos', CASE WHEN 'digitalife' = ANY(clientes) THEN (CASE WHEN puede_editar THEN 'edit' ELSE 'ver' END) ELSE 'oculto' END,
        'cartera', CASE WHEN 'digitalife' = ANY(clientes) THEN (CASE WHEN puede_editar THEN 'edit' ELSE 'ver' END) ELSE 'oculto' END
      ),
      'pcel', jsonb_build_object(
        'home', CASE WHEN 'pcel' = ANY(clientes) THEN (CASE WHEN puede_editar THEN 'edit' ELSE 'ver' END) ELSE 'oculto' END,
        'analisis', CASE WHEN 'pcel' = ANY(clientes) THEN (CASE WHEN puede_editar THEN 'edit' ELSE 'ver' END) ELSE 'oculto' END,
        'estrategia', CASE WHEN 'pcel' = ANY(clientes) THEN (CASE WHEN puede_editar THEN 'edit' ELSE 'ver' END) ELSE 'oculto' END,
        'marketing', CASE WHEN 'pcel' = ANY(clientes) THEN (CASE WHEN puede_editar THEN 'edit' ELSE 'ver' END) ELSE 'oculto' END,
        'pagos', CASE WHEN 'pcel' = ANY(clientes) THEN (CASE WHEN puede_editar THEN 'edit' ELSE 'ver' END) ELSE 'oculto' END,
        'cartera', CASE WHEN 'pcel' = ANY(clientes) THEN (CASE WHEN puede_editar THEN 'edit' ELSE 'ver' END) ELSE 'oculto' END
      ),
      'mercadolibre', jsonb_build_object(
        'home', CASE WHEN 'mercadolibre' = ANY(clientes) THEN (CASE WHEN puede_editar THEN 'edit' ELSE 'ver' END) ELSE 'oculto' END,
        'analisis', CASE WHEN 'mercadolibre' = ANY(clientes) THEN (CASE WHEN puede_editar THEN 'edit' ELSE 'ver' END) ELSE 'oculto' END,
        'estrategia', CASE WHEN 'mercadolibre' = ANY(clientes) THEN (CASE WHEN puede_editar THEN 'edit' ELSE 'ver' END) ELSE 'oculto' END,
        'marketing', CASE WHEN 'mercadolibre' = ANY(clientes) THEN (CASE WHEN puede_editar THEN 'edit' ELSE 'ver' END) ELSE 'oculto' END,
        'pagos', CASE WHEN 'mercadolibre' = ANY(clientes) THEN (CASE WHEN puede_editar THEN 'edit' ELSE 'ver' END) ELSE 'oculto' END,
        'cartera', CASE WHEN 'mercadolibre' = ANY(clientes) THEN (CASE WHEN puede_editar THEN 'edit' ELSE 'ver' END) ELSE 'oculto' END
      )
    ),
    'globales', jsonb_build_object(
      'resumen_clientes',  CASE WHEN puede_editar THEN 'edit' ELSE 'ver' END,
      'forecast_clientes', CASE WHEN puede_editar THEN 'edit' ELSE 'ver' END,
      'admin_interna',     CASE WHEN puede_editar THEN 'edit' ELSE 'ver' END,
      'configuracion',     'oculto'
    )
  )
WHERE rol = 'asistente';

-- Clientes externos (rol=cliente) y viewers externos:
--   tipo=externo. Solo ven pestañas que tenían en pestanas_cliente (o las
--   mínimas si no hay nada) y SIEMPRE en modo ver (nunca edit).
--   Pagos, Marketing y Cartera = OCULTAS por default (info confidencial
--   interna). Solo Home, Análisis, Estrategia se abren si están en pestanas_cliente.
--   Los clientes NO asignados quedan totalmente ocultos.
--   Pestañas globales = OCULTAS (no es personal interno).
UPDATE public.perfiles
SET
  tipo           = 'externo',
  es_super_admin = false,
  permisos       = jsonb_build_object(
    'clientes', jsonb_build_object(
      'digitalife', CASE WHEN 'digitalife' = ANY(clientes) THEN
        jsonb_build_object(
          'home',       CASE WHEN COALESCE(array_length(pestanas_cliente, 1), 0) = 0 OR 'home'       = ANY(pestanas_cliente) THEN 'ver' ELSE 'oculto' END,
          'analisis',   CASE WHEN COALESCE(array_length(pestanas_cliente, 1), 0) = 0 OR 'analisis'   = ANY(pestanas_cliente) THEN 'ver' ELSE 'oculto' END,
          'estrategia', CASE WHEN COALESCE(array_length(pestanas_cliente, 1), 0) = 0 OR 'estrategia' = ANY(pestanas_cliente) THEN 'ver' ELSE 'oculto' END,
          'marketing',  CASE WHEN 'marketing' = ANY(pestanas_cliente) THEN 'ver' ELSE 'oculto' END,
          'pagos',      CASE WHEN 'pagos'     = ANY(pestanas_cliente) THEN 'ver' ELSE 'oculto' END,
          'cartera',    CASE WHEN 'cartera'   = ANY(pestanas_cliente) THEN 'ver' ELSE 'oculto' END
        )
        ELSE jsonb_build_object('home','oculto','analisis','oculto','estrategia','oculto','marketing','oculto','pagos','oculto','cartera','oculto')
      END,
      'pcel', CASE WHEN 'pcel' = ANY(clientes) THEN
        jsonb_build_object(
          'home',       CASE WHEN COALESCE(array_length(pestanas_cliente, 1), 0) = 0 OR 'home'       = ANY(pestanas_cliente) THEN 'ver' ELSE 'oculto' END,
          'analisis',   CASE WHEN COALESCE(array_length(pestanas_cliente, 1), 0) = 0 OR 'analisis'   = ANY(pestanas_cliente) THEN 'ver' ELSE 'oculto' END,
          'estrategia', CASE WHEN COALESCE(array_length(pestanas_cliente, 1), 0) = 0 OR 'estrategia' = ANY(pestanas_cliente) THEN 'ver' ELSE 'oculto' END,
          'marketing',  CASE WHEN 'marketing' = ANY(pestanas_cliente) THEN 'ver' ELSE 'oculto' END,
          'pagos',      CASE WHEN 'pagos'     = ANY(pestanas_cliente) THEN 'ver' ELSE 'oculto' END,
          'cartera',    CASE WHEN 'cartera'   = ANY(pestanas_cliente) THEN 'ver' ELSE 'oculto' END
        )
        ELSE jsonb_build_object('home','oculto','analisis','oculto','estrategia','oculto','marketing','oculto','pagos','oculto','cartera','oculto')
      END,
      'mercadolibre', CASE WHEN 'mercadolibre' = ANY(clientes) THEN
        jsonb_build_object(
          'home',       CASE WHEN COALESCE(array_length(pestanas_cliente, 1), 0) = 0 OR 'home'       = ANY(pestanas_cliente) THEN 'ver' ELSE 'oculto' END,
          'analisis',   CASE WHEN COALESCE(array_length(pestanas_cliente, 1), 0) = 0 OR 'analisis'   = ANY(pestanas_cliente) THEN 'ver' ELSE 'oculto' END,
          'estrategia', CASE WHEN COALESCE(array_length(pestanas_cliente, 1), 0) = 0 OR 'estrategia' = ANY(pestanas_cliente) THEN 'ver' ELSE 'oculto' END,
          'marketing',  CASE WHEN 'marketing' = ANY(pestanas_cliente) THEN 'ver' ELSE 'oculto' END,
          'pagos',      CASE WHEN 'pagos'     = ANY(pestanas_cliente) THEN 'ver' ELSE 'oculto' END,
          'cartera',    CASE WHEN 'cartera'   = ANY(pestanas_cliente) THEN 'ver' ELSE 'oculto' END
        )
        ELSE jsonb_build_object('home','oculto','analisis','oculto','estrategia','oculto','marketing','oculto','pagos','oculto','cartera','oculto')
      END
    ),
    'globales', jsonb_build_object(
      'resumen_clientes','oculto',
      'forecast_clientes','oculto',
      'admin_interna','oculto',
      'configuracion','oculto'
    )
  )
WHERE rol IN ('cliente', 'viewer');

-- Invariante: solo Fernando puede ser super admin. Previene promoción
-- accidental desde la UI.
CREATE OR REPLACE FUNCTION public.tg_perfiles_enforce_super_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  super_count INT;
BEGIN
  IF NEW.es_super_admin = true THEN
    SELECT COUNT(*) INTO super_count FROM public.perfiles
    WHERE es_super_admin = true AND id != NEW.id;
    IF super_count > 0 THEN
      RAISE EXCEPTION 'Solo puede haber un super_admin en el sistema.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_perfiles_enforce_super_admin ON public.perfiles;
CREATE TRIGGER trg_perfiles_enforce_super_admin
  BEFORE INSERT OR UPDATE OF es_super_admin ON public.perfiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_perfiles_enforce_super_admin();

-- Índice para lookups rápidos
CREATE INDEX IF NOT EXISTS idx_perfiles_super_admin
  ON public.perfiles(es_super_admin)
  WHERE es_super_admin = true;
