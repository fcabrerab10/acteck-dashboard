-- Forecast · Reservas por cliente
-- Tablas:
--   forecast_propuestas         — encabezado (borrador/generada/cerrada)
--   forecast_propuesta_lineas   — SKU × propuesta con necesidades, reservo, confirmado

create table if not exists public.forecast_propuestas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  estatus text not null default 'borrador'
    check (estatus in ('borrador','generada','cerrada')),
  meta_anio int,
  meta_mes int,
  metodo text default 'velocity_6m',
  creado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  generado_at timestamptz,
  cerrado_at timestamptz
);

create index if not exists forecast_propuestas_estatus_idx on public.forecast_propuestas(estatus);
create index if not exists forecast_propuestas_created_by_idx on public.forecast_propuestas(creado_por);

create table if not exists public.forecast_propuesta_lineas (
  id uuid primary key default gen_random_uuid(),
  propuesta_id uuid not null references public.forecast_propuestas(id) on delete cascade,
  sku text not null,
  descripcion text,
  marca text,
  familia text,
  roadmap text,
  necesidad_dgl numeric default 0,
  necesidad_pce numeric default 0,
  necesidad_dct numeric default 0,
  recomendado numeric default 0,
  reservo numeric default 0,
  confirmado numeric,
  estado text default 'draft'
    check (estado in ('draft','propuesta','pend_confirmar','confirmado','parcial','no_aplica')),
  arribos_snapshot jsonb default '[]'::jsonb,
  notas text,
  updated_at timestamptz not null default now(),
  unique (propuesta_id, sku)
);

create index if not exists forecast_lineas_prop_idx on public.forecast_propuesta_lineas(propuesta_id);

-- Trigger updated_at
create or replace function public._forecast_touch() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists forecast_propuestas_touch on public.forecast_propuestas;
create trigger forecast_propuestas_touch before update on public.forecast_propuestas
  for each row execute function public._forecast_touch();

drop trigger if exists forecast_lineas_touch on public.forecast_propuesta_lineas;
create trigger forecast_lineas_touch before update on public.forecast_propuesta_lineas
  for each row execute function public._forecast_touch();

-- RLS
alter table public.forecast_propuestas enable row level security;
alter table public.forecast_propuesta_lineas enable row level security;

drop policy if exists forecast_propuestas_all on public.forecast_propuestas;
create policy forecast_propuestas_all on public.forecast_propuestas
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists forecast_lineas_all on public.forecast_propuesta_lineas;
create policy forecast_lineas_all on public.forecast_propuesta_lineas
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
