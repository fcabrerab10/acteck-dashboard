-- Inventario en cuentas materializado (2026-11-18, auditoría de rendimiento). Las tres vistas se calculaban al
-- vuelo sobre todo el histórico semanal (8.6 s · 3.4 s · 1.2 s; el rol de la app las cancela a 3 s). Ahora cada
-- vista lee su MV (ms) con el mismo filtro de visibilidad, evaluado una vez. Se refrescan al inicio de
-- refresh_vision_general() (06:30, 19:30 y al cargar inventario_cliente o sell out), antes de mv_apoyos_convenio.

drop materialized view if exists public.mv_sellout_inventario_cuenta_sku;
create materialized view public.mv_sellout_inventario_cuenta_sku as
SELECT s.cuenta,
            s.anio,
            s.semana,
            s.fecha_semana,
            s.sku,
            s.marca,
            s.titulo,
            s.stock,
            s.valor,
            s.costo_convenio,
            s.precio_venta,
            s.dias_sin_venta,
            s.fecha_ultima_venta
           FROM v_sellout_inventario_semana s
             JOIN ( SELECT v_sellout_inventario_semana.cuenta,
                    max(v_sellout_inventario_semana.anio * 100 + v_sellout_inventario_semana.semana) AS ult
                   FROM v_sellout_inventario_semana
                  GROUP BY v_sellout_inventario_semana.cuenta) u ON u.cuenta = s.cuenta AND u.ult = (s.anio * 100 + s.semana);
-- PCEL repite (cuenta, sku) cuando dos códigos suyos apuntan al mismo SKU: índice no único y refresco sin concurrently
create index mv_sellout_inventario_cuenta_sku_ix on public.mv_sellout_inventario_cuenta_sku (cuenta, sku);
revoke all on public.mv_sellout_inventario_cuenta_sku from anon, authenticated;
create or replace view public.v_sellout_inventario_cuenta_sku as
 select cuenta,
    anio,
    semana,
    fecha_semana,
    sku,
    marca,
    titulo,
    stock,
    valor,
    costo_convenio,
    precio_venta,
    dias_sin_venta,
    fecha_ultima_venta
 from public.mv_sellout_inventario_cuenta_sku
 where (select public.es_interno()) or public.cliente_visible(cuenta);

drop materialized view if exists public.mv_sellout_inventario_cuenta_mes;
create materialized view public.mv_sellout_inventario_cuenta_mes as
WITH sem AS (
                 SELECT v_sellout_inventario_semana.cuenta,
                    v_sellout_inventario_semana.anio,
                    v_sellout_inventario_semana.semana,
                    v_sellout_inventario_semana.stock,
                    v_sellout_inventario_semana.valor,
                    v_sellout_inventario_semana.dias_sin_venta,
                    EXTRACT(year FROM v_sellout_inventario_semana.fecha_semana)::integer AS ay,
                    EXTRACT(month FROM v_sellout_inventario_semana.fecha_semana)::integer AS am,
                    max(v_sellout_inventario_semana.anio * 100 + v_sellout_inventario_semana.semana) OVER (PARTITION BY v_sellout_inventario_semana.cuenta, (date_trunc('month'::text, v_sellout_inventario_semana.fecha_semana::timestamp with time zone))) AS ult
                   FROM v_sellout_inventario_semana
                )
         SELECT sem.cuenta,
            sem.ay AS anio,
            sem.am AS mes,
            max(sem.semana) AS semana,
            sum(sem.valor) AS valor,
            sum(sem.stock) AS piezas,
            count(*) FILTER (WHERE sem.stock > 0::numeric) AS skus_con_stock,
            count(*) FILTER (WHERE sem.dias_sin_venta >= 30::numeric) AS skus_sin_venta_30
           FROM sem
          WHERE (sem.anio * 100 + sem.semana) = sem.ult
          GROUP BY sem.cuenta, sem.ay, sem.am;
create unique index mv_sellout_inventario_cuenta_mes_pk on public.mv_sellout_inventario_cuenta_mes (cuenta, anio, mes);
revoke all on public.mv_sellout_inventario_cuenta_mes from anon, authenticated;
create or replace view public.v_sellout_inventario_cuenta_mes as
 select cuenta,
    anio,
    mes,
    semana,
    valor,
    piezas,
    skus_con_stock,
    skus_sin_venta_30
 from public.mv_sellout_inventario_cuenta_mes
 where (select public.es_interno()) or public.cliente_visible(cuenta);

drop materialized view if exists public.mv_inventario_cliente_ultimo;
create materialized view public.mv_inventario_cliente_ultimo as
SELECT t.id,
            t.cliente,
            t.sku,
            t.marca,
            t.titulo,
            t.stock,
            t.costo_convenio,
            t.precio_venta,
            t.fecha_ultima_venta,
            t.dias_sin_venta,
            t.valor,
            t.updated_at,
            t.anio,
            t.semana
           FROM inventario_cliente t
             JOIN ( SELECT inventario_cliente.cliente,
                    max(inventario_cliente.anio * 100 + inventario_cliente.semana) AS k
                   FROM inventario_cliente
                  WHERE inventario_cliente.anio IS NOT NULL
                  GROUP BY inventario_cliente.cliente) u ON u.cliente = t.cliente AND (t.anio * 100 + t.semana) = u.k;
create unique index mv_inventario_cliente_ultimo_pk on public.mv_inventario_cliente_ultimo (id);
revoke all on public.mv_inventario_cliente_ultimo from anon, authenticated;
create or replace view public.v_inventario_cliente_ultimo as
 select id,
    cliente,
    sku,
    marca,
    titulo,
    stock,
    costo_convenio,
    precio_venta,
    fecha_ultima_venta,
    dias_sin_venta,
    valor,
    updated_at,
    anio,
    semana
 from public.mv_inventario_cliente_ultimo
 where (select public.es_interno()) or public.cliente_visible(cliente);

CREATE OR REPLACE FUNCTION public.refresh_vision_general()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- inventario en cuentas (2026-11-18): antes que mv_apoyos_convenio, que lee la última foto
  refresh materialized view public.mv_sellout_inventario_cuenta_sku;
  refresh materialized view concurrently public.mv_sellout_inventario_cuenta_mes;
  refresh materialized view concurrently public.mv_inventario_cliente_ultimo;

  refresh materialized view public.mv_vision_sellout_canal;
  refresh materialized view public.mv_vision_sellout_mayoristas;
  refresh materialized view public.mv_vision_sellout_top_skus;
  refresh materialized view public.mv_vision_sellout_top_clientes;
  refresh materialized view public.mv_vision_sellout_promos;
  refresh materialized view public.mv_vision_sellout_rotacion;
  refresh materialized view public.mv_vision_sellout_mensual;
  refresh materialized view public.mv_vision_inventario_global;
  refresh materialized view concurrently public.mv_apoyos_convenio;
  refresh materialized view concurrently public.mv_medidas_inventario_mes;    -- 2026-10-05 · antes que mv_medidas_inventario (la lee)
  refresh materialized view public.mv_medidas_inventario;                      -- 2026-10-02
  refresh materialized view concurrently public.mv_inventario_historico_dia;   -- 2026-10-02
  refresh materialized view concurrently public.mv_inventario_sku_mes;         -- 2026-10-05 · celular: stock al cierre por SKU × mes
  refresh materialized view concurrently public.mv_skus_producto_extra; -- SKUs de producto fuera del roadmap (2026-11-18)
end;
$function$;
