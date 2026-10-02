-- 2026-10-02 · v_sellout_detalle_sku_mes (Digitalife/Dicotech por SKU y mes, con ensambles) tardaba 4.1 s (10 K filas):
-- en el celular el Sell Out de Digitalife esperaba 7.7 s y el Home web de Digitalife también la lee. Materializada;
-- se refresca en refresh_mv_sellout_unificado() (puente e importador, tras cargar sellout_detalle/ensambles).
create materialized view if not exists public.mv_sellout_detalle_sku_mes as
WITH suelto AS (
         SELECT sellout_detalle.cliente,
            sellout_detalle.no_parte AS sku,
            sellout_detalle.marca,
            EXTRACT(year FROM sellout_detalle.fecha)::integer AS anio,
            EXTRACT(month FROM sellout_detalle.fecha)::integer AS mes,
            sum(sellout_detalle.cantidad) AS piezas,
            sum(COALESCE(sellout_detalle.subtotal, sellout_detalle.total, 0::numeric) - COALESCE(sellout_detalle.descuento, 0::numeric)) AS monto,
            sum(sellout_detalle.cantidad * sellout_detalle.precio) AS monto_bruto,
            count(*)::integer AS tx,
            max(sellout_detalle.fecha) AS ultima_fecha
           FROM sellout_detalle
          WHERE sellout_detalle.no_parte IS NOT NULL AND sellout_detalle.fecha IS NOT NULL
          GROUP BY sellout_detalle.cliente, sellout_detalle.no_parte, sellout_detalle.marca, (EXTRACT(year FROM sellout_detalle.fecha)::integer), (EXTRACT(month FROM sellout_detalle.fecha)::integer)
        ), ens AS (
         SELECT v_sellout_ensambles_sku_mes.cliente,
            v_sellout_ensambles_sku_mes.sku,
            v_sellout_ensambles_sku_mes.marca,
            v_sellout_ensambles_sku_mes.anio,
            v_sellout_ensambles_sku_mes.mes,
            v_sellout_ensambles_sku_mes.piezas,
            v_sellout_ensambles_sku_mes.monto,
            v_sellout_ensambles_sku_mes.tx,
            v_sellout_ensambles_sku_mes.ultima_fecha
           FROM v_sellout_ensambles_sku_mes
        )
 SELECT COALESCE(s.cliente, e.cliente) AS cliente,
    COALESCE(s.sku, e.sku) AS sku,
    COALESCE(s.marca, e.marca) AS marca,
    COALESCE(s.anio, e.anio) AS anio,
    COALESCE(s.mes, e.mes) AS mes,
    COALESCE(s.piezas, 0::numeric) + COALESCE(e.piezas, 0::numeric) AS piezas,
    COALESCE(s.monto, 0::numeric) + COALESCE(e.monto, 0::numeric) AS monto,
    s.monto_bruto,
    COALESCE(s.tx, 0) + COALESCE(e.tx, 0) AS tx,
    GREATEST(s.ultima_fecha, e.ultima_fecha) AS ultima_fecha,
    COALESCE(e.piezas, 0::numeric) AS piezas_ensamble,
    COALESCE(e.monto, 0::numeric) AS monto_ensamble
   FROM suelto s
     FULL JOIN ens e ON e.cliente = s.cliente AND e.sku = s.sku AND e.anio = s.anio AND e.mes = s.mes;
-- OJO: la vista trae (cliente, sku, anio, mes) repetidos (p. ej. dicotech BR-935982 2025-10, una fila por marca/origen):
-- índice NO único y refresco no concurrente (4 s, dentro del puente).
create index if not exists mv_sellout_detalle_sku_mes_k on public.mv_sellout_detalle_sku_mes (cliente, sku, anio, mes);
create index if not exists mv_sellout_detalle_sku_mes_cli_anio on public.mv_sellout_detalle_sku_mes (cliente, anio);
create or replace view public.v_sellout_detalle_sku_mes as select * from public.mv_sellout_detalle_sku_mes;
grant select on public.mv_sellout_detalle_sku_mes to anon, authenticated;

create or replace function public.refresh_mv_sellout_unificado() returns void language plpgsql security definer set search_path to 'public' as $$
begin
  refresh materialized view concurrently public.mv_sellout_general_dicotech;
  refresh materialized view public.mv_sellout_unificado;
  refresh materialized view public.mv_sellout_detalle_sku_mes;   -- 2026-10-02 (sin concurrently: no hay llave única)
  perform public.refresh_sellout_global();
  perform public.refresh_vision_general();
end;
$$;
