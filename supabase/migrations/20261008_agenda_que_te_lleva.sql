-- 2026-10-08 · Agenda «que te lleva» (V6, web y celular; mockups aaf05768 y 920c6df5 aprobados por Fernando).
--   · agenda_items.clientes: clientes adicionales de un pendiente (cliente_key sigue siendo el principal).
--   · agenda_movidas: bitácora de lo que el usuario mueve (hecha · mañana · ya no · mandada · reabierta) con el estado
--     anterior, para «Movidas hoy» y Deshacer. Nada desaparece sin rastro.
--   · agenda_registro_dia.organizado_at: cuándo organizó el día (pop-up «Organiza tu día»).
alter table public.agenda_items add column if not exists clientes text[];
alter table public.agenda_registro_dia add column if not exists organizado_at timestamptz;

create table if not exists public.agenda_movidas (
  id uuid primary key default gen_random_uuid(),
  usuario uuid not null,
  fecha date not null default current_date,
  item_id uuid,
  accion text not null,              -- hecha · manana · semana · yano · mandada · reabierta · fecha · organizada
  titulo text,
  antes jsonb,                       -- campos del ítem antes del cambio (para deshacer)
  despues jsonb,
  deshecha_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists agenda_movidas_usuario_fecha on public.agenda_movidas (usuario, fecha desc, created_at desc);
alter table public.agenda_movidas enable row level security;
drop policy if exists agenda_movidas_mias on public.agenda_movidas;
create policy agenda_movidas_mias on public.agenda_movidas for all to authenticated
  using (usuario = auth.uid() or public.es_interno()) with check (usuario = auth.uid() or public.es_interno());
grant select, insert, update, delete on public.agenda_movidas to authenticated, service_role;
