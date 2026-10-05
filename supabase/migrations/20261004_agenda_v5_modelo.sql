-- 2026-10-04 · Agenda V5 (rehecha desde cero sobre apps de gestión del día; ver docs/AGENDA_V5.md).
-- Conserva agenda_items / agenda_reuniones / agenda_subtareas / cuentas_seguimiento y añade:
--   agenda_items: propietario (de quién es la agenda), tipo amplía a idea · acuerdo · nota; cuando (fecha en que se ve
--                 en Hoy, distinta de fecha_limite = vence), duracion_min (estimado), min_real (cronómetro),
--                 inicio_real/fin_real, area_id, proyecto_id, bandeja (capturado sin clasificar), snooze_hasta,
--                 promovido_a (idea → tarea/proyecto), orden_dia.
--   agenda_areas (Digitalife, PCEL, Dicotech, Equipo, Dirección, Personal…) y agenda_proyectos (terminan; revisar cada N días).
--   agenda_registro_dia (cierre del día: resumen, reflexión, energía, planeado vs real, «mañana empiezo con»).
--   agenda_checkins (equipo: ¿qué hiciste hoy? · ¿qué vas a trabajar esta semana?).
--   agenda_objetivos_semana (revisión semanal).
-- RLS: las mismas agenda_puede_ver() / agenda_puede_editar() que el resto de la Agenda (David Millán queda fuera).
alter table public.agenda_items
  add column if not exists propietario uuid references auth.users(id) on delete set null,
  add column if not exists cuando date,
  add column if not exists duracion_min integer,
  add column if not exists min_real integer,
  add column if not exists inicio_real timestamptz,
  add column if not exists fin_real timestamptz,
  add column if not exists area_id uuid,
  add column if not exists proyecto_id uuid,
  add column if not exists bandeja boolean not null default false,
  add column if not exists snooze_hasta date,
  add column if not exists promovido_a uuid,
  add column if not exists orden_dia integer;
update public.agenda_items set propietario = coalesce(propietario, (case when array_length(responsables, 1) = 1 then responsables[1] else creado_por end)) where propietario is null;
create index if not exists agenda_items_prop_cuando on public.agenda_items (propietario, cuando);
create index if not exists agenda_items_bandeja on public.agenda_items (propietario) where bandeja;

create table if not exists public.agenda_areas (
  id uuid primary key default gen_random_uuid(), propietario uuid references auth.users(id) on delete cascade,
  nombre text not null, color text, orden integer default 0, cliente_key text, archivada boolean not null default false,
  created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.agenda_proyectos (
  id uuid primary key default gen_random_uuid(), propietario uuid references auth.users(id) on delete cascade,
  area_id uuid references public.agenda_areas(id) on delete set null, nombre text not null, notas text,
  estado text not null default 'activo', revisar_cada_dias integer default 7, ultima_revision date, orden integer default 0,
  created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.agenda_registro_dia (
  id uuid primary key default gen_random_uuid(), usuario uuid not null references auth.users(id) on delete cascade, fecha date not null,
  resumen text, reflexion text, energia smallint, min_planeados integer, min_reales integer, manana_empiezo text, cerrado_at timestamptz,
  created_at timestamptz default now(), updated_at timestamptz default now(), unique (usuario, fecha));
create table if not exists public.agenda_checkins (
  id uuid primary key default gen_random_uuid(), usuario uuid not null references auth.users(id) on delete cascade, fecha date not null,
  tipo text not null default 'dia', respuesta text, created_at timestamptz default now(), updated_at timestamptz default now(), unique (usuario, fecha, tipo));
create table if not exists public.agenda_objetivos_semana (
  id uuid primary key default gen_random_uuid(), usuario uuid not null references auth.users(id) on delete cascade, semana date not null,
  texto text not null, area_id uuid references public.agenda_areas(id) on delete set null, cumplido boolean not null default false, orden integer default 0,
  created_at timestamptz default now(), updated_at timestamptz default now());
alter table public.agenda_items add constraint agenda_items_area_fk foreign key (area_id) references public.agenda_areas(id) on delete set null not valid;
alter table public.agenda_items add constraint agenda_items_proyecto_fk foreign key (proyecto_id) references public.agenda_proyectos(id) on delete set null not valid;

do $$ declare t text; begin
  foreach t in array array['agenda_areas','agenda_proyectos','agenda_registro_dia','agenda_checkins','agenda_objetivos_semana'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format('drop policy if exists %I_delete on public.%I', t, t);
    execute format('create policy %I_select on public.%I for select using (public.agenda_puede_ver())', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (public.agenda_puede_editar())', t, t);
    execute format('create policy %I_update on public.%I for update using (public.agenda_puede_editar()) with check (public.agenda_puede_editar())', t, t);
    execute format('create policy %I_delete on public.%I for delete using (public.agenda_puede_editar())', t, t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop trigger if exists %I_auditoria on public.%I', t, t);
    execute format('create trigger %I_auditoria after insert or update or delete on public.%I for each row execute function public.fn_auditoria()', t, t);
  end loop; end $$;

-- Áreas iniciales de Fernando (las puede renombrar); Karolina las crea desde la pestaña.
insert into public.agenda_areas (propietario, nombre, color, orden, cliente_key)
select (select user_id from public.perfiles where email = 'fernando.cabrera@acteck.com' limit 1), n, c, o, ck from (values
  ('Digitalife','#0A84FF',1,'digitalife'),('PCEL','#30D158',2,'pcel'),('Dicotech','#BF5AF2',3,'dicotech'),
  ('Mayoreo y cuentas','#FF9F0A',4,null),('Equipo','#FF375F',5,null),('Dirección','#5E5CE6',6,null),('Personal','#8E8E93',7,null)) as v(n,c,o,ck)
where not exists (select 1 from public.agenda_areas where propietario = (select user_id from public.perfiles where email = 'fernando.cabrera@acteck.com' limit 1));
