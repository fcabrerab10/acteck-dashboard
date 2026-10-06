-- 2026-10-05 · Agenda «que te lleva» (Fernando aprobó la propuesta A completa): la Agenda arma el día sola con lo que
-- el negocio sabe (pagos, cuentas de seguimiento, propuestas enviadas, acuerdos, forecast, importador, viajes) y lo
-- ordena en cuatro hilos: Mis clientes · Área de ventas · Internos · Personales. Ritmo de Fernando: armar 9:00,
-- pausa 15:00, retomar 17:00, cierre 22:00 (preferencias.agenda.horas).
alter table public.agenda_areas add column if not exists hilo text check (hilo in ('clientes','ventas','internos','personales'));
update public.agenda_areas set hilo = case
  when nombre in ('Digitalife','PCEL','Dicotech') or cliente_key in ('digitalife','pcel','dicotech') then 'clientes'
  when nombre in ('Mayoreo y cuentas','Equipo') then 'ventas'
  when nombre in ('Personal','Personales') then 'personales'
  else 'internos' end
where hilo is null;

-- Decisiones sobre las propuestas del día (para que lo descartado no vuelva y lo de mañana salga mañana).
create table if not exists public.agenda_dia_decisiones (
  id uuid primary key default gen_random_uuid(),
  usuario uuid not null,
  fecha date not null,
  fuente text not null,
  ref text not null,
  decision text not null check (decision in ('aceptada','manana','descartada')),
  item_id uuid references public.agenda_items(id) on delete set null,
  hasta date,
  created_at timestamptz not null default now(),
  unique (usuario, fecha, fuente, ref)
);
alter table public.agenda_dia_decisiones enable row level security;
drop policy if exists agenda_dia_decisiones_propias on public.agenda_dia_decisiones;
create policy agenda_dia_decisiones_propias on public.agenda_dia_decisiones for all to authenticated
  using (usuario = auth.uid() or coalesce((select es_super_admin from public.perfiles p where p.user_id = auth.uid()), false))
  with check (usuario = auth.uid() or coalesce((select es_super_admin from public.perfiles p where p.user_id = auth.uid()), false));
grant select, insert, update, delete on public.agenda_dia_decisiones to authenticated;
grant all on public.agenda_dia_decisiones to service_role;

update public.perfiles set preferencias = jsonb_set(coalesce(preferencias, '{}'::jsonb), '{agenda,horas}', '{"armar":"09:00","pausa":"15:00","retomar":"17:00","cierre":"22:00"}'::jsonb, true)
where email = 'fernando.cabrera@acteck.com';
