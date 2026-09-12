-- Rendimiento · Inicio en una sola llamada (2026-09-12)
--
-- src/modules/general/inicio/useInicioData.js disparaba 18 peticiones en paralelo
-- al abrir la pestaña por defecto: 18 conexiones, 18 planes y 18 respuestas HTTP
-- (~466 KB). inicio_datos(p_anio) devuelve todo eso en un JSON.
--
-- IMPORTANTE · p_pesados: dentro de una función plpgsql las consultas van EN SERIE.
-- Cuatro de las 18 lecturas son vistas vivas caras — v_sellout_dicotech_mensual
-- (~380 ms), v_sellout_pcel_mensual (~290 ms), v_medidas_inventario (~200 ms) y
-- v_sellout_digitalife_mensual (~30 ms) — y meterlas dentro hacía que el JSON
-- tardara MÁS (~870 ms) que las 18 peticiones en paralelo (~600 ms). Con
-- p_pesados => false la función devuelve esas cuatro como null y el hook las pide
-- en paralelo junto a la RPC: 7 peticiones simultáneas en vez de 18, y el reloj
-- lo marca la más lenta. Por el mismo motivo quedan fuera `inv` (v_inventario_comercial,
-- 3.2K filas) y `transito`: son rápidas de leer pero son el 90 % de los bytes, y
-- serializarlas a jsonb dentro de la función retrasaba TODO lo demás. Se deja el modo completo (true) para usos donde importe
-- el número de viajes y no el reloj (cron, scripts, enlaces móviles con RTT alto).
--
-- SECURITY INVOKER a propósito: corre con los permisos de quien llama, así que
-- respeta RLS igual que las consultas sueltas.
--
-- Las cinco lecturas que el hook envuelve en `opcional()` (pagos, marketing_actividades,
-- eventos_equipo, eventos_cliente, auditoria_cambios) van cada una en su propio bloque
-- con EXCEPTION: si un perfil no tiene GRANT sobre esa tabla devuelve [] en vez de
-- tumbar toda la llamada. Sin esto, un solo "permission denied" hacía fallar el JSON
-- entero y la pantalla caía al camino de las 18 consultas.

CREATE OR REPLACE FUNCTION public.inicio_datos(p_anio integer DEFAULT NULL, p_dias integer DEFAULT 7, p_pesados boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_anio   integer := COALESCE(p_anio, EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/Mexico_City'))::int);
  v_anios  integer[] := ARRAY[v_anio - 1, v_anio];
  v_keys   text[] := ARRAY['digitalife','pcel','dicotech'];
  v_hoy    date := (now() AT TIME ZONE 'America/Mexico_City')::date;
  v_lim    date := v_hoy + COALESCE(p_dias, 7);
  v_pagos      jsonb := '[]'::jsonb;
  v_marketing  jsonb := '[]'::jsonb;
  v_ev_equipo  jsonb := '[]'::jsonb;
  v_ev_cliente jsonb := '[]'::jsonb;
  v_auditoria  jsonb := '[]'::jsonb;
  v_out    jsonb;
BEGIN
  -- ── Opcionales (equivalen a opcional() en useInicioData.js) ──
  BEGIN
    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.fecha_compromiso), '[]'::jsonb) INTO v_pagos
    FROM (SELECT id, cliente, concepto, categoria, monto, estatus, fecha_compromiso FROM pagos
          WHERE estatus IN ('pendiente','en_proceso') AND fecha_compromiso BETWEEN v_hoy AND v_lim) t;
  EXCEPTION WHEN OTHERS THEN v_pagos := '[]'::jsonb; END;

  BEGIN
    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.fecha), '[]'::jsonb) INTO v_marketing
    FROM (SELECT id, cliente, nombre, tipo, estatus, fecha, inversion FROM marketing_actividades
          WHERE fecha BETWEEN v_hoy AND v_lim AND COALESCE(estatus,'') <> 'archivado') t;
  EXCEPTION WHEN OTHERS THEN v_marketing := '[]'::jsonb; END;

  BEGIN
    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.fecha_ini), '[]'::jsonb) INTO v_ev_equipo
    FROM (SELECT id, titulo, tipo, fecha_ini, fecha_fin FROM eventos_equipo
          WHERE fecha_ini BETWEEN v_hoy AND v_lim) t;
  EXCEPTION WHEN OTHERS THEN v_ev_equipo := '[]'::jsonb; END;

  BEGIN
    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.fecha), '[]'::jsonb) INTO v_ev_cliente
    FROM (SELECT id, cliente, fecha, lugar, descripcion FROM eventos_cliente
          WHERE fecha BETWEEN v_hoy AND v_lim) t;
  EXCEPTION WHEN OTHERS THEN v_ev_cliente := '[]'::jsonb; END;

  BEGIN
    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.creado_at DESC), '[]'::jsonb) INTO v_auditoria
    FROM (SELECT id, tabla, operacion, registro_id, cliente_key, usuario_email, cambios, creado_at
          FROM auditoria_cambios ORDER BY creado_at DESC LIMIT 5) t;
  EXCEPTION WHEN OTHERS THEN v_auditoria := '[]'::jsonb; END;

  SELECT jsonb_build_object(
    'anio', v_anio,
    'medidas', (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.anio, t.mes), '[]'::jsonb)
                FROM (SELECT anio, mes, fact_bruta, devoluciones, rmas, bonificaciones, fact_neta, venta_neta,
                             costo_venta_neta, contribucion, utilidad_comercial, piezas_venta_neta, cv_ultimos_3_meses
                      FROM v_erp_medidas_mes WHERE anio = ANY (v_anios)) t),
    'medidasCli', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
                FROM (SELECT cliente_key, anio, mes, fact_bruta, devoluciones, rmas, bonificaciones, fact_neta,
                             venta_neta, costo_venta_neta, contribucion, utilidad_comercial, piezas_venta_neta
                      FROM v_erp_medidas_cliente_mes WHERE anio = ANY (v_anios) AND cliente_key = ANY (v_keys)) t),
    'medidasCanal', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
                FROM (SELECT canal, anio, mes, fact_bruta, devoluciones, rmas, bonificaciones, fact_neta,
                             venta_neta, costo_venta_neta, contribucion, utilidad_comercial, piezas_venta_neta
                      FROM v_erp_medidas_canal_mes WHERE anio = ANY (v_anios)) t),
    'cuotasCanales', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
                FROM (SELECT anio, dimension_tipo, dimension_valor, meta_facturacion, meta_margen_pct
                      FROM cuotas_canales WHERE anio = v_anio) t),
    'cuotasMensuales', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
                FROM (SELECT cliente, mes, anio, cuota_ideal, cuota_min FROM cuotas_mensuales WHERE anio = v_anio) t),
    'factCli', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
                FROM (SELECT cliente_key, anio, mes, monto, piezas FROM v_fact_cliente_mes
                      WHERE anio = ANY (v_anios) AND cliente_key = ANY (v_keys)) t),
    'selloutDigitalife', CASE WHEN p_pesados THEN (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
                FROM (SELECT anio, mes, monto, piezas FROM v_sellout_digitalife_mensual WHERE anio = ANY (v_anios)) t) END,
    'selloutPcel', CASE WHEN p_pesados THEN (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
                FROM (SELECT anio, mes, monto, piezas FROM v_sellout_pcel_mensual WHERE anio = ANY (v_anios)) t) END,
    'selloutDicotech', CASE WHEN p_pesados THEN (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
                FROM (SELECT anio, mes, monto, piezas FROM v_sellout_dicotech_mensual WHERE anio = ANY (v_anios)) t) END,
    'medInv', CASE WHEN p_pesados THEN (SELECT to_jsonb(t) FROM v_medidas_inventario t LIMIT 1) END,
    'estados', (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.fecha_corte DESC), '[]'::jsonb)
                FROM (SELECT cliente, fecha_corte, saldo_actual, saldo_vencido, saldo_a_vencer, aging_mas90, dso
                      FROM estados_cuenta ORDER BY fecha_corte DESC LIMIT 60) t),
    'inv', CASE WHEN p_pesados THEN (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
                FROM (SELECT sku, inventario, costo_promedio FROM v_inventario_comercial) t) END,
    'transito', CASE WHEN p_pesados THEN (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
                FROM (SELECT sku, cantidad, eta_mas_cercana, embarques_detalle FROM v_transito_sku) t) END,
    'pagos', v_pagos,
    'marketing', v_marketing,
    'eventosEquipo', v_ev_equipo,
    'eventosCliente', v_ev_cliente,
    'auditoria', v_auditoria
  ) INTO v_out;
  RETURN v_out;
END $$;

DROP FUNCTION IF EXISTS public.inicio_datos(integer, integer);
REVOKE ALL ON FUNCTION public.inicio_datos(integer, integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inicio_datos(integer, integer, boolean) TO authenticated, service_role;

COMMENT ON FUNCTION public.inicio_datos(integer, integer, boolean) IS
  'Inicio (dirección general): las 18 lecturas de useInicioData.js en un JSON. SECURITY INVOKER → respeta RLS. p_pesados=false omite las 4 vistas vivas caras (sellout mensual x3 + v_medidas_inventario) para que el cliente las pida en paralelo.';
