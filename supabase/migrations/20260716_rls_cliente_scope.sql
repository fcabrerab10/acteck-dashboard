-- Migration: restringir SELECT en tablas de negocio al cliente(s) permitido(s)
-- del perfil autenticado. Antes: SELECT USING (true) para cualquier authenticated.
-- Ahora: sólo filas cuyo `cliente_key` (o equivalente) esté en los clientes con
-- al menos una pestaña != 'oculto' en perfiles.permisos.
--
-- Ejecutar en Supabase SQL Editor. Idempotente.

-- 1. Helper: ¿el perfil autenticado tiene acceso a este cliente?
CREATE OR REPLACE FUNCTION public.user_can_see_cliente(cliente_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  perfil_row RECORD;
  cliente_perms jsonb;
  pestana text;
BEGIN
  IF cliente_key IS NULL OR cliente_key = '' THEN RETURN true; END IF;

  SELECT es_super_admin, permisos INTO perfil_row
    FROM public.perfiles WHERE user_id = auth.uid();

  IF NOT FOUND THEN RETURN false; END IF;
  IF perfil_row.es_super_admin THEN RETURN true; END IF;

  cliente_perms := perfil_row.permisos -> 'clientes' -> lower(cliente_key);
  IF cliente_perms IS NULL THEN RETURN false; END IF;

  -- Al menos una pestaña con nivel 'ver' o 'edit'
  FOR pestana IN SELECT jsonb_object_keys(cliente_perms) LOOP
    IF cliente_perms ->> pestana IN ('ver','edit') THEN RETURN true; END IF;
  END LOOP;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_can_see_cliente(text) TO authenticated;

-- 2. Mapeo de nombres ERP legacy → cliente_key normalizado
CREATE OR REPLACE FUNCTION public.normalize_cliente(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN raw IS NULL THEN NULL
    WHEN lower(raw) IN ('digitalife','api global') THEN 'digitalife'
    WHEN lower(raw) IN ('pcel','pc online') THEN 'pcel'
    WHEN lower(raw) IN ('dicotech') THEN 'dicotech'
    WHEN lower(raw) IN ('mercadolibre','publico general ml','publico general mercado libre') THEN 'mercadolibre'
    ELSE lower(raw)
  END;
$$;

GRANT EXECUTE ON FUNCTION public.normalize_cliente(text) TO authenticated;

-- 3. Recrear policies SELECT scopeadas por cliente en cada tabla que tenga
--    columna `cliente` o `cliente_key` o `cliente_nombre`.
DO $$
DECLARE
  tbl text;
  col text;
  policy_name text;
BEGIN
  FOR tbl IN
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name IN (
        'ventas_erp','sellout_detalle','inventario_cliente','sellout_pcel',
        'sellout_pcel_mensual','estados_cuenta','estados_cuenta_detalle',
        'pagos','promociones','ventas_mensuales','facturacion_clientes',
        'sell_in_sku','sellout_sku','marketing_actividades','cuotas_mensuales',
        'inversion_marketing','sellout_general','sugeridos_compra',
        'inventario_cliente_sucursal'
      )
  LOOP
    -- Detectar la columna de cliente en esta tabla
    SELECT column_name INTO col FROM information_schema.columns
      WHERE table_schema='public' AND table_name=tbl
        AND column_name IN ('cliente_key','cliente','cliente_nombre')
      ORDER BY CASE column_name
        WHEN 'cliente_key' THEN 1
        WHEN 'cliente' THEN 2
        WHEN 'cliente_nombre' THEN 3 END
      LIMIT 1;

    IF col IS NULL THEN CONTINUE; END IF;

    -- Drop policies SELECT anteriores (open + variantes previas del scoped)
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_select', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_read', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_select_scoped', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_select_super', tbl);

    -- Nueva policy: sólo filas cuyo cliente esté en los permitidos del perfil
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.user_can_see_cliente(public.normalize_cliente(%I::text)))',
      tbl || '_select_scoped', tbl, col
    );
  END LOOP;
END $$;

-- 4. Tablas de negocio SIN columna cliente que sólo deben ver super_admin:
--    embarques_compras (multi-cliente por SKU), transito_sku, roadmap_sku,
--    precios_sku, inventario_acteck, compras_oc, estados_resultados.
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN VALUES
    ('embarques_compras'),('transito_sku'),('roadmap_sku'),('precios_sku'),
    ('inventario_acteck'),('compras_oc'),('estados_resultados')
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name=tbl) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_select', tbl);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_read', tbl);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_select_super', tbl);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_select_scoped', tbl);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.perfiles WHERE user_id = auth.uid() AND es_super_admin = true))',
        tbl || '_select_super', tbl
      );
    END IF;
  END LOOP;
END $$;

-- 5. Perfiles: la app usa perfiles para varias cosas (login, sidebar, telemetría).
--    Un subquery scoped causaría recursión en RLS. Se deja abierto a authenticated
--    y la protección está en la UI + hook de login (que sólo carga el perfil propio).
DROP POLICY IF EXISTS perfiles_select        ON public.perfiles;
DROP POLICY IF EXISTS perfiles_read          ON public.perfiles;
DROP POLICY IF EXISTS perfiles_select_scoped ON public.perfiles;
DROP POLICY IF EXISTS perfiles_select_open   ON public.perfiles;

CREATE POLICY perfiles_select_open ON public.perfiles
  FOR SELECT TO authenticated USING (true);
