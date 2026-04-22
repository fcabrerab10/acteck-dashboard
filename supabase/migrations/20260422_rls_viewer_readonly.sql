-- ══════════════════════════════════════════════════════════════════════
-- RLS: bloquear escritura a viewers y clientes (defensa en profundidad)
-- ══════════════════════════════════════════════════════════════════════
-- Contexto:
--   Hasta ahora las políticas _write permitían `USING (true) WITH CHECK (true)`
--   a cualquier usuario autenticado (incluso role=viewer). El gate existía
--   sólo en UI, no en BD. Si alguien evitaba el UI (dev tools, curl con su
--   token) podía escribir.
--
--   Ahora la BD valida el rol del perfil en cada INSERT / UPDATE / DELETE.
--   Los SELECT siguen abiertos a todos los autenticados.
--
-- Quién puede escribir:
--   - super_admin, admin          → sí
--   - asistente con puede_editar  → sí
--   - viewer, cliente             → NO
--   - service_role (servidor)     → bypasea RLS siempre (uploads server-side)
-- ══════════════════════════════════════════════════════════════════════

-- 1. Helper function
-- STABLE + SECURITY DEFINER: se evalúa una vez por query y lee perfiles
-- aunque el caller no tenga SELECT en ella.
CREATE OR REPLACE FUNCTION public.user_can_edit()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.user_id = auth.uid()
      AND p.activo = true
      AND (
        p.rol IN ('super_admin', 'admin')
        OR (p.rol = 'asistente' AND COALESCE(p.puede_editar, false) = true)
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.user_can_edit() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.user_can_edit() TO authenticated, anon;

-- 2. Drop las políticas _write permisivas conocidas (idempotente)
DROP POLICY IF EXISTS promociones_write        ON public.promociones;
DROP POLICY IF EXISTS spm_write                ON public.sellout_pcel_mensual;
DROP POLICY IF EXISTS cat_pcel_write           ON public.catalogo_sku_pcel;
DROP POLICY IF EXISTS precio_ov_write          ON public.precio_overrides;
DROP POLICY IF EXISTS prop_compra_write        ON public.propuestas_compra;
DROP POLICY IF EXISTS pendientes_rw            ON public.pendientes_equipo;
DROP POLICY IF EXISTS eventos_rw               ON public.eventos_equipo;

-- Fallback: drop por patrón para cualquier tabla con política "_write" genérica
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname LIKE '%_write'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- 3. Recrear policies con gate por tabla
-- Tablas operativas donde el UI permite escritura (a usuarios con permiso):
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'pendientes',
    'pendientes_equipo',
    'eventos_equipo',
    'minutas',
    'metas_anuales',
    'cuotas_mensuales',
    'inversion_marketing',
    'marketing_actividades',
    'pagos',
    'promociones',
    'sugerido_overrides',
    'precio_overrides',
    'propuestas_compra',
    'catalogo_sku_pcel',
    'sellout_pcel_mensual',
    'productos_cliente',
    'ventas_mensuales',
    'ventas_erp',
    'sell_in_sku',
    'sellout_sku',
    'sellout_pcel',
    'sellout_detalle',
    'inventario_cliente',
    'inventario_acteck',
    'roadmap_sku',
    'precios_sku',
    'transito_sku',
    'estados_cuenta',
    'estados_cuenta_detalle',
    'embarques_compras'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    -- Sólo si la tabla existe (evita fallar si alguna aún no se migró)
    IF EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=tbl
    ) THEN
      -- Asegurar RLS habilitado
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

      -- Drop policies nombradas que vamos a reemplazar (idempotente)
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_insert', tbl);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_update', tbl);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_delete', tbl);

      -- INSERT: sólo si user_can_edit()
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.user_can_edit())',
        tbl || '_insert', tbl
      );

      -- UPDATE
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.user_can_edit()) WITH CHECK (public.user_can_edit())',
        tbl || '_update', tbl
      );

      -- DELETE
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.user_can_edit())',
        tbl || '_delete', tbl
      );

      -- SELECT: asegurar que exista una policy abierta (si no hay ya una _read)
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename=tbl AND cmd='SELECT'
      ) THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
          tbl || '_select', tbl
        );
      END IF;
    END IF;
  END LOOP;
END $$;

-- 4. Perfiles: tratamiento especial
--    - Todos leen (para ver nombres de compañeros).
--    - Sólo super_admin escribe (gestión de usuarios vía /admin).
DROP POLICY IF EXISTS perfiles_insert ON public.perfiles;
DROP POLICY IF EXISTS perfiles_update ON public.perfiles;
DROP POLICY IF EXISTS perfiles_delete ON public.perfiles;

CREATE POLICY perfiles_insert ON public.perfiles
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.perfiles p
            WHERE p.user_id = auth.uid() AND p.rol = 'super_admin' AND p.activo = true)
  );

CREATE POLICY perfiles_update ON public.perfiles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.perfiles p
            WHERE p.user_id = auth.uid() AND p.rol = 'super_admin' AND p.activo = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.perfiles p
            WHERE p.user_id = auth.uid() AND p.rol = 'super_admin' AND p.activo = true)
  );

CREATE POLICY perfiles_delete ON public.perfiles
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.perfiles p
            WHERE p.user_id = auth.uid() AND p.rol = 'super_admin' AND p.activo = true)
  );

-- Listo. Los uploads server-side (vía SUPABASE_SERVICE_ROLE_KEY) bypass RLS
-- y siguen funcionando sin cambios.
