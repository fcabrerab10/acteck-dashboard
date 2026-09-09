-- ═══════════════════════════════════════════════════════════════════════════
-- 20260910 · Bandeja de alertas "qué cambió / qué atender hoy".
--
-- La tabla la escribe SOLO el cron (`api/cron.js?task=generar-alertas`, service
-- role). Los usuarios autenticados únicamente leen y pueden resolver/posponer
-- (columnas resuelta_at, resuelta_por, snooze_hasta).
--
-- `clave` = hash estable (tipo + cliente + sku + periodo) para que cada corrida
-- haga upsert y no duplique. El cron resuelve solo (resuelta_por='sistema') las
-- alertas activas cuyo tipo ya no aparece en la corrida.
--
-- Tipos actuales: stock_vs_transito · cuota_en_riesgo · devoluciones_anormales
--                 · rebate_por_generar · datos_sin_actualizar
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.alertas (
  id             bigserial primary key,
  tipo           text        not null,
  severidad      text        not null check (severidad in ('critica','alta','media','info')),
  titulo         text        not null,
  detalle        text,
  cliente_key    text,
  sku            text,
  valor          numeric,
  meta           jsonb       not null default '{}'::jsonb,
  clave          text        not null unique,
  generada_at    timestamptz not null default now(),
  actualizada_at timestamptz not null default now(),
  resuelta_at    timestamptz,
  resuelta_por   text,
  snooze_hasta   timestamptz
);

comment on table public.alertas is 'Alertas generadas por el cron generar-alertas. Usuarios sólo resuelven/posponen.';

create index if not exists alertas_activas_sev_idx on public.alertas (resuelta_at, severidad);
create index if not exists alertas_cliente_idx     on public.alertas (cliente_key);
create index if not exists alertas_tipo_activas_idx on public.alertas (tipo) where resuelta_at is null;

-- ─── RLS ───
alter table public.alertas enable row level security;

drop policy if exists alertas_select on public.alertas;
create policy alertas_select on public.alertas
  for select to authenticated
  using (true);

-- UPDATE: cualquier autenticado puede resolver/posponer. Las columnas
-- permitidas se acotan con GRANT a nivel columna (RLS no filtra columnas);
-- WITH CHECK impide "revivir" filas de otro modo que no sea via las 3 columnas.
drop policy if exists alertas_update on public.alertas;
create policy alertas_update on public.alertas
  for update to authenticated
  using (true)
  with check (auth.role() = 'authenticated');

-- Privilegios: Supabase concede ALL por default a anon/authenticated. Los
-- recortamos: anon nada; authenticated SELECT + UPDATE sólo de 3 columnas.
revoke all on public.alertas from anon;
revoke all on public.alertas from authenticated;
grant select on public.alertas to authenticated;
grant update (resuelta_at, resuelta_por, snooze_hasta) on public.alertas to authenticated;
grant all on public.alertas to service_role;
grant usage, select on sequence public.alertas_id_seq to service_role;

-- Cinturón extra: aunque alguien tuviera UPDATE total, un autenticado (no
-- service role) no puede tocar el contenido de la alerta.
create or replace function public.fn_alertas_guard_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'authenticated' then
    if new.tipo        is distinct from old.tipo
    or new.severidad   is distinct from old.severidad
    or new.titulo      is distinct from old.titulo
    or new.detalle     is distinct from old.detalle
    or new.cliente_key is distinct from old.cliente_key
    or new.sku         is distinct from old.sku
    or new.valor       is distinct from old.valor
    or new.meta        is distinct from old.meta
    or new.clave       is distinct from old.clave
    or new.generada_at is distinct from old.generada_at
    or new.actualizada_at is distinct from old.actualizada_at then
      raise exception 'alertas: sólo se pueden modificar resuelta_at, resuelta_por y snooze_hasta';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_alertas_guard_update on public.alertas;
create trigger trg_alertas_guard_update
  before update on public.alertas
  for each row execute function public.fn_alertas_guard_update();
