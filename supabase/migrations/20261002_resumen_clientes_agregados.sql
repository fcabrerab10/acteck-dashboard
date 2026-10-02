-- 2026-10-02 · Rendimiento de Resumen de Clientes: la pantalla bajaba facturacion_clientes, inventario_cliente y
-- sellout_pcel por SKU y semana (90 consultas, 7 MB) para sacar cuatro agregados. Ahora Postgres los devuelve ya
-- calculados, con EXACTAMENTE las reglas de src/modules/comercial/resumen/calculo.js (ver comentarios):
--   mv_resumen_costo_sku            costo promedio por (cliente, sku) = Σmonto/Σpiezas del año actual y anterior,
--                                   sólo si Σpiezas > 0 y Σmonto > 0 (los demás quedan ausentes → fallback).
--   mv_resumen_top_sku_mes          top 5 SKUs por piezas de cada (cliente, anio, mes) (texto de avance de WhatsApp).
--   mv_resumen_inventario_semana    inventario valuado por (cliente, anio, semana): digitalife/dicotech sin dedupe
--                                   (stock × costo promedio; si no hay, valor > 0; si no, stock × costo_convenio);
--                                   pcel con dedupe por sku (primera fila) y stock × costo_promedio de PCEL
--                                   (fallback al costo promedio por el sku crudo, que casi nunca empata: se replica).
--   mv_resumen_sellout_mes          sell out por (cliente, anio, mes): sellout_sku (digitalife/dicotech, 3 años) y
--                                   v_sellout_pcel_sku_mes (pcel, 2 años, estimado).
-- La regla «última semana cuyo lunes ≤ fin de mes» sigue en JS (calculo.js#ultimaSemanaHasta) sobre estas filas
-- (cientos, no decenas de miles), con el reloj del navegador como siempre. Refresco: refresh_resumen_clientes(),
-- llamada desde refresh_facturacion_clientes() (horaria) y refresh_vision_general() (foto diaria e importador).
create or replace function public.lunes_semana_iso(p_anio int, p_semana int) returns date language sql immutable parallel safe as $$
  select date_trunc('week', make_date(p_anio, 1, 4))::date + ((p_semana - 1) * 7)
$$;

create materialized view if not exists public.mv_resumen_costo_sku as
select fc.cliente_key, fc.sku, sum(fc.piezas)::numeric as piezas, sum(fc.monto)::numeric as monto, (sum(fc.monto) / sum(fc.piezas))::numeric as costo_promedio
from public.facturacion_clientes fc
where fc.cliente_key in ('digitalife', 'pcel', 'dicotech')
  and fc.anio >= (extract(year from current_date))::int - 1
  and nullif(trim(fc.sku), '') is not null
group by fc.cliente_key, fc.sku
having sum(fc.piezas) > 0 and sum(fc.monto) > 0;
create unique index if not exists mv_resumen_costo_sku_uk on public.mv_resumen_costo_sku (cliente_key, sku);

create materialized view if not exists public.mv_resumen_top_sku_mes as
select cliente_key, anio, mes, sku, piezas, rn as posicion
from (
  select fc.cliente_key, fc.anio, fc.mes, fc.sku, sum(fc.piezas)::numeric as piezas,
         row_number() over (partition by fc.cliente_key, fc.anio, fc.mes order by sum(fc.piezas) desc, fc.sku) as rn
  from public.facturacion_clientes fc
  where fc.cliente_key in ('digitalife', 'pcel', 'dicotech')
    and fc.anio >= (extract(year from current_date))::int - 1
    and nullif(trim(fc.sku), '') is not null
  group by fc.cliente_key, fc.anio, fc.mes, fc.sku
  having sum(fc.piezas) > 0
) t where rn <= 5;
create unique index if not exists mv_resumen_top_sku_mes_uk on public.mv_resumen_top_sku_mes (cliente_key, anio, mes, posicion);

create materialized view if not exists public.mv_resumen_inventario_semana as
select i.cliente, i.anio, i.semana, public.lunes_semana_iso(i.anio, i.semana) as lunes,
       sum(coalesce(i.stock, 0))::numeric as piezas,
       sum(case when c.costo_promedio is not null then coalesce(i.stock, 0) * c.costo_promedio
                when coalesce(i.valor, 0) > 0 then i.valor
                else coalesce(i.stock, 0) * coalesce(i.costo_convenio, 0) end)::numeric as valor
from public.inventario_cliente i
left join public.mv_resumen_costo_sku c on c.cliente_key = i.cliente and c.sku = coalesce(i.sku, '')
where i.cliente in ('digitalife', 'dicotech') and i.anio is not null and i.semana is not null
  and i.anio >= (extract(year from current_date))::int - 1
group by i.cliente, i.anio, i.semana
union all
select 'pcel'::text, d.anio, d.semana, public.lunes_semana_iso(d.anio, d.semana),
       sum(d.inventario)::numeric,
       sum(d.inventario * coalesce(nullif(d.costo_promedio, 0), c.costo_promedio, 0))::numeric
from (
  select distinct on (sp.anio, sp.semana, sp.sku) sp.anio, sp.semana, sp.sku, coalesce(sp.inventario, 0) as inventario, coalesce(sp.costo_promedio, 0) as costo_promedio
  from public.sellout_pcel sp
  where sp.anio is not null and sp.semana is not null and nullif(trim(sp.sku), '') is not null
    and sp.anio >= (extract(year from current_date))::int - 1
  order by sp.anio, sp.semana, sp.sku, sp.costo_promedio desc nulls last
) d
left join public.mv_resumen_costo_sku c on c.cliente_key = 'pcel' and c.sku = d.sku
group by d.anio, d.semana;
create unique index if not exists mv_resumen_inventario_semana_uk on public.mv_resumen_inventario_semana (cliente, anio, semana);

create materialized view if not exists public.mv_resumen_sellout_mes as
select s.cliente, s.anio, s.mes, sum(s.monto_pesos)::numeric as monto, false as estimado
from public.sellout_sku s
where s.cliente in ('digitalife', 'dicotech') and s.anio >= (extract(year from current_date))::int - 2
group by s.cliente, s.anio, s.mes
union all
select 'pcel'::text, v.anio, v.mes, sum(v.monto)::numeric, true
from public.v_sellout_pcel_sku_mes v
where v.anio >= (extract(year from current_date))::int - 1
group by v.anio, v.mes;
create unique index if not exists mv_resumen_sellout_mes_uk on public.mv_resumen_sellout_mes (cliente, anio, mes);

grant select on public.mv_resumen_costo_sku, public.mv_resumen_top_sku_mes, public.mv_resumen_inventario_semana, public.mv_resumen_sellout_mes to anon, authenticated;

create or replace function public.refresh_resumen_clientes() returns void language plpgsql security definer set search_path to 'public' as $$
begin
  refresh materialized view concurrently public.mv_resumen_costo_sku;
  refresh materialized view concurrently public.mv_resumen_top_sku_mes;
  refresh materialized view concurrently public.mv_resumen_inventario_semana;
  refresh materialized view concurrently public.mv_resumen_sellout_mes;
end;
$$;
