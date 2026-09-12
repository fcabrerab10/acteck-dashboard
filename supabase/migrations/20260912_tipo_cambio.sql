-- Tipo de cambio oficial (FIX publicado en el DOF, serie SF43718 de Banxico). Lo carga el cron
-- (task generar-alertas, paso tipo-cambio) con BANXICO_TOKEN; historial completo desde 2025.
create table if not exists public.tipo_cambio (
  fecha date primary key,
  valor numeric(10,4) not null,
  fuente text not null default 'banxico_fix_dof',
  created_at timestamptz not null default now()
);
alter table public.tipo_cambio enable row level security;
drop policy if exists tipo_cambio_lectura on public.tipo_cambio;
create policy tipo_cambio_lectura on public.tipo_cambio for select to authenticated using (true);
grant select on public.tipo_cambio to authenticated;
grant all on public.tipo_cambio to service_role;

-- TC vigente a una fecha: el último FIX publicado en o antes de esa fecha.
create or replace function public.tc_vigente(p_fecha date default current_date)
returns numeric language sql stable as $$
  select valor from public.tipo_cambio where fecha <= p_fecha order by fecha desc limit 1
$$;
grant execute on function public.tc_vigente(date) to authenticated, service_role;
comment on table public.tipo_cambio is 'FIX Banxico/DOF por día (pesos por dólar). Fuente única del tipo de cambio en el dashboard.';
