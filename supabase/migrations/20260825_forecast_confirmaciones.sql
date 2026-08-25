-- Forecast · Confirmaciones en 2 pasos + avisos de arribo
-- Fase 1: campos en forecast_propuesta_lineas + tabla forecast_avisos

alter table public.forecast_propuesta_lineas
  add column if not exists crm_subido_at timestamptz,
  add column if not exists crm_subido_por uuid references auth.users(id) on delete set null,
  add column if not exists comprado_at timestamptz,
  add column if not exists comprado_por uuid references auth.users(id) on delete set null,
  add column if not exists fecha_arribo_estimada date,
  add column if not exists piezas_a_reservar_arribo numeric;

-- Ampliar valores permitidos de 'estado' para incluir el nuevo flujo
alter table public.forecast_propuesta_lineas
  drop constraint if exists forecast_propuesta_lineas_estado_check;
alter table public.forecast_propuesta_lineas
  add constraint forecast_propuesta_lineas_estado_check
  check (estado in ('draft','propuesta','pend_confirmar','confirmado','parcial','no_aplica','subido_crm','comprado','arribado'));

-- Avisos: se disparan 3 días antes del arribo y el día del arribo
create table if not exists public.forecast_avisos (
  id uuid primary key default gen_random_uuid(),
  linea_id uuid not null references public.forecast_propuesta_lineas(id) on delete cascade,
  propuesta_id uuid not null references public.forecast_propuestas(id) on delete cascade,
  tipo text not null check (tipo in ('3dias','dia')),
  fecha_disparo date not null,
  fecha_arribo date not null,
  piezas_a_reservar numeric,
  email_enviado_at timestamptz,
  visto_por jsonb default '[]'::jsonb, -- array de user_id que ya lo vieron
  created_at timestamptz not null default now(),
  unique (linea_id, tipo)
);

create index if not exists forecast_avisos_disparo_idx on public.forecast_avisos(fecha_disparo);
create index if not exists forecast_avisos_linea_idx on public.forecast_avisos(linea_id);

alter table public.forecast_avisos enable row level security;
drop policy if exists forecast_avisos_all on public.forecast_avisos;
create policy forecast_avisos_all on public.forecast_avisos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
