-- 2026-09-11 · Histórico diario de inventario (foto de fin de día)
--
-- inventario_acteck es un snapshot que el puente SQL (Mac mini) reemplaza cada
-- hora (8-19 L-S y 06:30). Para ver tendencia (valor, piezas, días de
-- inventario) guardamos UNA foto por día y por (articulo, no_almacen):
--   · snapshot_inventario_diario()  INSERT … SELECT desde inventario_acteck con
--     ON CONFLICT DO UPDATE → la última corrida del día gana (= foto de cierre).
--     La fecha se toma en hora CDMX. SECURITY DEFINER; sólo service_role la
--     ejecuta (la llama bridge/sync.mjs tras cada carga de inventario, porque
--     pg_cron NO está habilitado en el proyecto — ver nota al final).
--   · v_inventario_historico_dia  fecha · piezas · valor · skus_con_stock, sólo
--     almacenes comerciales (almacenes_config.comercial = true). La lee
--     Inventario global (panel "Tendencia" + hero "vs hace 30 días").
--
-- Volumen: ~10K filas/día (4.4K SKUs × almacenes) ≈ 3.6M filas/año; la PK
-- (fecha, articulo, no_almacen) sirve al agregado por día (index scan por fecha).

create table if not exists public.inventario_historico (
  fecha            date    not null,
  articulo         text    not null,
  no_almacen       integer not null,
  inventario       numeric,
  disponible       numeric,
  costoinventario  numeric,
  primary key (fecha, articulo, no_almacen)
);

comment on table public.inventario_historico is
  'Foto diaria (fin de día CDMX) de inventario_acteck por articulo × almacén. La escribe snapshot_inventario_diario() desde el puente SQL.';

alter table public.inventario_historico enable row level security;

drop policy if exists inventario_historico_read on public.inventario_historico;
create policy inventario_historico_read on public.inventario_historico
  for select to authenticated using (true);

-- Sólo lectura para la app: nadie escribe por PostgREST salvo service_role (bypass RLS).
revoke all on public.inventario_historico from anon;
grant select on public.inventario_historico to authenticated;

-- ── Función: foto del día (idempotente; la última corrida del día sobreescribe) ──
create or replace function public.snapshot_inventario_diario()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fecha date := (now() at time zone 'America/Mexico_City')::date;
  v_n     integer;
begin
  insert into public.inventario_historico (fecha, articulo, no_almacen, inventario, disponible, costoinventario)
  select v_fecha, articulo, no_almacen,
         sum(coalesce(inventario, 0)), sum(coalesce(disponible, 0)), sum(coalesce(costoinventario, 0))
    from public.inventario_acteck
   where articulo is not null and no_almacen is not null
   group by articulo, no_almacen
  on conflict (fecha, articulo, no_almacen) do update
     set inventario      = excluded.inventario,
         disponible      = excluded.disponible,
         costoinventario = excluded.costoinventario;
  get diagnostics v_n = row_count;
  return jsonb_build_object('fecha', v_fecha, 'filas', v_n);
end;
$$;

comment on function public.snapshot_inventario_diario() is
  'Guarda/actualiza la foto de HOY (CDMX) de inventario_acteck en inventario_historico. La llama el puente SQL tras cada carga de inventario.';

revoke all on function public.snapshot_inventario_diario() from public, anon, authenticated;
grant execute on function public.snapshot_inventario_diario() to service_role;

-- ── Vista: un renglón por día, sólo almacenes comerciales ──
create or replace view public.v_inventario_historico_dia
with (security_invoker = true) as
select h.fecha,
       sum(h.inventario)::numeric                                  as piezas,
       sum(h.disponible)::numeric                                  as disponible,
       sum(h.costoinventario)::numeric                             as valor,
       count(distinct h.articulo) filter (where h.inventario > 0)  as skus_con_stock
  from public.inventario_historico h
  join public.almacenes_config a on a.no_almacen = h.no_almacen and a.comercial = true
 group by h.fecha;

comment on view public.v_inventario_historico_dia is
  'Tendencia diaria del inventario comercial (piezas, disponible, valor a costo, SKUs con stock). Fuente: inventario_historico × almacenes_config.comercial.';

grant select on public.v_inventario_historico_dia to authenticated;

-- ── Programación ──
-- pg_cron NO está instalado (pg_available_extensions lo ofrece, 1.6.4, pero no
-- se habilitó para no tocar la configuración del proyecto). La foto la dispara
-- bridge/sync.mjs (fuente `inventario`) con rpc snapshot_inventario_diario()
-- tras cada upsert; como la fecha es CDMX y el upsert es idempotente, la corrida
-- de las 19:00 deja la foto de cierre del día.
-- Alternativa si algún día se habilita pg_cron (23:30 CDMX = 05:30 UTC):
--   create extension if not exists pg_cron;
--   select cron.schedule('inventario_snapshot_diario', '30 5 * * *',
--     $$select public.snapshot_inventario_diario()$$);
--   (a las 05:30 UTC son las 23:30 CDMX del mismo día: la función guarda la
--    fecha CDMX, así que no hay que ajustar nada.)
