-- ═══════════════════════════════════════════════════════════════════════════
-- 20260911 · Forecast CRM · captura mensual por cliente y SKU (pestaña Forecast → "Forecast CRM").
--
-- forecast_crm        — una fila por (cliente_key, sku, anio, mes). La justificación se repite en
--                       todas las filas del SKU (el CRM la pide "una por SKU"). estado: borrador | exportado.
-- forecast_crm_lotes  — cada exportación de la plantilla (Plantilla_Forecast_YYYY-MM.xlsx): ventana,
--                       clientes incluidos y número de filas, para re-descargar desde "Lotes exportados".
--
-- Escribe la app (Configuración no). RLS: lectura para autenticados; escritura sólo perfiles internos
-- o super admin (misma regla que forecast_snapshots).
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.forecast_crm_lotes (
  id             uuid primary key default gen_random_uuid(),
  mes_inicio     date not null,
  meses          int  not null default 6,
  clientes       text[] not null default '{}',
  filas          int  not null default 0,
  archivo_nombre text,
  creado_por     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);
comment on table public.forecast_crm_lotes is 'Forecast CRM · exportaciones de la plantilla (ventana de meses, clientes, filas) para re-descarga.';

create table if not exists public.forecast_crm (
  id             uuid primary key default gen_random_uuid(),
  cliente_key    text not null,
  cliente_codigo text,
  cliente_nombre text,
  tipo           text not null default 'directa' check (tipo in ('directa','indirecta')),
  sku            text not null,
  anio           int  not null,
  mes            int  not null check (mes between 1 and 12),
  piezas         int  not null default 0 check (piezas >= 0),
  justificacion  text,
  estado         text not null default 'borrador' check (estado in ('borrador','exportado')),
  lote_id        uuid references public.forecast_crm_lotes(id) on delete set null,
  creado_por     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (cliente_key, sku, anio, mes)
);
comment on table public.forecast_crm is 'Forecast CRM · piezas por cliente, SKU y mes capturadas para la plantilla del CRM.';

create index if not exists forecast_crm_cliente_idx on public.forecast_crm (cliente_key, anio, mes);
create index if not exists forecast_crm_lote_idx    on public.forecast_crm (lote_id);

-- updated_at (misma función que forecast_propuestas)
drop trigger if exists forecast_crm_touch on public.forecast_crm;
create trigger forecast_crm_touch before update on public.forecast_crm
  for each row execute function public._forecast_touch();

-- ─── RLS ───
alter table public.forecast_crm       enable row level security;
alter table public.forecast_crm_lotes enable row level security;

drop policy if exists forecast_crm_read on public.forecast_crm;
create policy forecast_crm_read on public.forecast_crm
  for select to authenticated using (true);

drop policy if exists forecast_crm_write on public.forecast_crm;
create policy forecast_crm_write on public.forecast_crm
  for all to authenticated
  using (exists (
    select 1 from public.perfiles p
    where p.user_id = auth.uid() and (p.tipo = 'interno' or coalesce(p.es_super_admin, false))
  ))
  with check (exists (
    select 1 from public.perfiles p
    where p.user_id = auth.uid() and (p.tipo = 'interno' or coalesce(p.es_super_admin, false))
  ));

drop policy if exists forecast_crm_lotes_read on public.forecast_crm_lotes;
create policy forecast_crm_lotes_read on public.forecast_crm_lotes
  for select to authenticated using (true);

drop policy if exists forecast_crm_lotes_write on public.forecast_crm_lotes;
create policy forecast_crm_lotes_write on public.forecast_crm_lotes
  for all to authenticated
  using (exists (
    select 1 from public.perfiles p
    where p.user_id = auth.uid() and (p.tipo = 'interno' or coalesce(p.es_super_admin, false))
  ))
  with check (exists (
    select 1 from public.perfiles p
    where p.user_id = auth.uid() and (p.tipo = 'interno' or coalesce(p.es_super_admin, false))
  ));

grant select, insert, update, delete on public.forecast_crm       to authenticated;
grant select, insert, update, delete on public.forecast_crm_lotes to authenticated;
grant all on public.forecast_crm, public.forecast_crm_lotes to service_role;
