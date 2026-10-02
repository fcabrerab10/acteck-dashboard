-- 2026-10-02 · Rendimiento: v_inventario_historico_dia (tendencia diaria del inventario comercial en Inventario
-- global) agregaba inventario_historico completo en 5 s; el rol de la app la cancelaba a 3 s y el panel «Tendencia»
-- quedaba vacío sin avisar. Materializada; se refresca en refresh_vision_general() (foto diaria 19:30 y puente).
create materialized view if not exists public.mv_inventario_historico_dia as
 SELECT h.fecha,
    sum(h.inventario) AS piezas,
    sum(h.disponible) AS disponible,
    sum(h.costoinventario) AS valor,
    count(DISTINCT h.articulo) FILTER (WHERE h.inventario > 0::numeric) AS skus_con_stock
   FROM public.inventario_historico h
     JOIN public.almacenes_config a ON a.no_almacen = h.no_almacen AND a.comercial = true
  GROUP BY h.fecha;
create unique index if not exists mv_inventario_historico_dia_uk on public.mv_inventario_historico_dia (fecha);
create or replace view public.v_inventario_historico_dia as select * from public.mv_inventario_historico_dia;
grant select on public.mv_inventario_historico_dia to anon, authenticated;

create or replace function public.refresh_vision_general() returns void language plpgsql security definer set search_path to 'public' as $$
begin
  refresh materialized view public.mv_vision_sellout_canal;
  refresh materialized view public.mv_vision_sellout_mayoristas;
  refresh materialized view public.mv_vision_sellout_top_skus;
  refresh materialized view public.mv_vision_sellout_top_clientes;
  refresh materialized view public.mv_vision_sellout_promos;
  refresh materialized view public.mv_vision_sellout_rotacion;
  refresh materialized view public.mv_vision_sellout_mensual;
  refresh materialized view public.mv_vision_inventario_global;
  refresh materialized view concurrently public.mv_apoyos_convenio;
  refresh materialized view public.mv_medidas_inventario;                      -- 2026-10-02
  refresh materialized view concurrently public.mv_inventario_historico_dia;   -- 2026-10-02
end;
$$;
