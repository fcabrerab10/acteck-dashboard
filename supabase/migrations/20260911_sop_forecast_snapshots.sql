-- S&OP · foto mensual del forecast (2026-09-11).
-- La pantalla de S&OP (ForecastClientesTab) guarda, sin UI, una fila por SKU del mes en curso con lo que
-- el motor (forecast/calculo.js) calculó ese día: demanda mensual ERP, stock comercial, tránsito, sugerido y
-- cobertura en días. Se hace un upsert como máximo una vez al día por usuario (localStorage sop_snapshot_YYYY-MM-DD)
-- y sólo si el perfil es interno. Sirve para medir después la precisión del forecast (pantalla pendiente).

create table if not exists public.forecast_snapshots (
  anio            int         not null,
  mes             int         not null check (mes between 1 and 12),
  sku             text        not null,
  demanda_mes     numeric,
  stock           numeric,
  transito        numeric,
  sugerido        numeric,
  cobertura_dias  numeric,
  tomado_at       timestamptz not null default now(),
  primary key (anio, mes, sku)
);

comment on table public.forecast_snapshots is 'S&OP · foto mensual por SKU de demanda/stock/tránsito/sugerido/cobertura calculados por el motor (upsert diario silencioso desde la pantalla).';

alter table public.forecast_snapshots enable row level security;

-- Lectura: cualquier usuario autenticado.
drop policy if exists forecast_snapshots_read on public.forecast_snapshots;
create policy forecast_snapshots_read on public.forecast_snapshots
  for select to authenticated using (true);

-- Escritura (insert/update para el upsert): sólo perfiles internos o super admin.
drop policy if exists forecast_snapshots_insert on public.forecast_snapshots;
create policy forecast_snapshots_insert on public.forecast_snapshots
  for insert to authenticated
  with check (exists (
    select 1 from public.perfiles p
    where p.user_id = auth.uid() and (p.tipo = 'interno' or coalesce(p.es_super_admin, false))
  ));

drop policy if exists forecast_snapshots_update on public.forecast_snapshots;
create policy forecast_snapshots_update on public.forecast_snapshots
  for update to authenticated
  using (exists (
    select 1 from public.perfiles p
    where p.user_id = auth.uid() and (p.tipo = 'interno' or coalesce(p.es_super_admin, false))
  ))
  with check (exists (
    select 1 from public.perfiles p
    where p.user_id = auth.uid() and (p.tipo = 'interno' or coalesce(p.es_super_admin, false))
  ));

grant select, insert, update on public.forecast_snapshots to authenticated;
grant select on public.forecast_snapshots to anon;

create index if not exists forecast_snapshots_sku_idx on public.forecast_snapshots (sku, anio, mes);
