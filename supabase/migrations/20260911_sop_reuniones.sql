-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 20260911 · S&OP · Repositorio de reuniones mensuales (sustituye al flujo de solicitudes_compra).
--
-- La reunión mensual de S&OP se captura en el CRM corporativo (externo) y sale un correo HTML
-- "ACTECK - SOLICITUD DE COMPRA · Compras S&OP {Mes} {Año} · folio SOP-AAAAMM". El dashboard guarda
-- una fila por reunión (sop_reuniones) + sus líneas (sop_reuniones_lineas) a partir de ese correo
-- pegado (parser en src/modules/comercial/forecast/reuniones/parserCorreo.js) o de captura manual.
--
-- RLS: lectura = cualquier autenticado (la pestaña S&OP ya se filtra por permisos en la app);
--      escritura = perfiles internos o super admin (mismo patrón que forecast_snapshots).
-- Auditoría: trg_auditoria (fn_auditoria) en ambas tablas si la función existe.
-- No toca solicitudes_compra / solicitudes_compra_lineas (el carrito "Mi Export" las sigue usando).
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

create table if not exists public.sop_reuniones (
  id             bigserial primary key,
  folio          text        not null unique,                 -- "SOP-202609" (o "SOP-202609-2" si se repite)
  anio           int         not null,
  mes            int         not null check (mes between 1 and 12),
  fecha_reunion  date,                                         -- fecha del pie del correo ("Generado … 1 sep 2026")
  titulo         text,                                         -- "Compras S&OP Septiembre 2026"
  solicita       text,                                         -- "David Millán"
  nota           text,                                         -- bloque "NOTA DE DAVID"
  nota_autor     text,
  siguientes     jsonb       not null default '[]'::jsonb,     -- [{ rol, accion }]
  fuente         text        not null default 'correo' check (fuente in ('correo', 'manual')),
  correo_raw     text,                                         -- texto pegado tal cual (para re-interpretar)
  total_skus     int         not null default 0,
  total_piezas   numeric     not null default 0,
  creado_por     uuid        default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table public.sop_reuniones is 'S&OP · una fila por reunión mensual de compras (correo del CRM pegado o captura manual).';

create table if not exists public.sop_reuniones_lineas (
  id           bigserial primary key,
  reunion_id   bigint  not null references public.sop_reuniones (id) on delete cascade,
  orden        int     not null default 0,
  marca        text,
  familia      text,
  sku          text    not null,
  descripcion  text,
  cantidad     numeric not null default 0,
  comentario   text
);
comment on table public.sop_reuniones_lineas is 'S&OP · líneas (SKU · cantidad · comentario) de cada reunión.';

create index if not exists sop_reuniones_anio_mes_idx on public.sop_reuniones (anio, mes);
create index if not exists sop_reuniones_lineas_reunion_idx on public.sop_reuniones_lineas (reunion_id, orden);
create index if not exists sop_reuniones_lineas_sku_idx on public.sop_reuniones_lineas (sku);

-- updated_at automático
create or replace function public.fn_sop_reuniones_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists trg_sop_reuniones_touch on public.sop_reuniones;
create trigger trg_sop_reuniones_touch before update on public.sop_reuniones
  for each row execute function public.fn_sop_reuniones_touch();

-- ─── RLS ───
alter table public.sop_reuniones enable row level security;
alter table public.sop_reuniones_lineas enable row level security;

drop policy if exists sop_reuniones_read on public.sop_reuniones;
create policy sop_reuniones_read on public.sop_reuniones for select to authenticated using (true);
drop policy if exists sop_reuniones_lineas_read on public.sop_reuniones_lineas;
create policy sop_reuniones_lineas_read on public.sop_reuniones_lineas for select to authenticated using (true);

drop policy if exists sop_reuniones_write on public.sop_reuniones;
create policy sop_reuniones_write on public.sop_reuniones for all to authenticated
  using (exists (select 1 from public.perfiles p where p.user_id = auth.uid() and (p.tipo = 'interno' or coalesce(p.es_super_admin, false))))
  with check (exists (select 1 from public.perfiles p where p.user_id = auth.uid() and (p.tipo = 'interno' or coalesce(p.es_super_admin, false))));
drop policy if exists sop_reuniones_lineas_write on public.sop_reuniones_lineas;
create policy sop_reuniones_lineas_write on public.sop_reuniones_lineas for all to authenticated
  using (exists (select 1 from public.perfiles p where p.user_id = auth.uid() and (p.tipo = 'interno' or coalesce(p.es_super_admin, false))))
  with check (exists (select 1 from public.perfiles p where p.user_id = auth.uid() and (p.tipo = 'interno' or coalesce(p.es_super_admin, false))));

grant select, insert, update, delete on public.sop_reuniones, public.sop_reuniones_lineas to authenticated;
grant usage, select on sequence public.sop_reuniones_id_seq, public.sop_reuniones_lineas_id_seq to authenticated;

-- ─── Auditoría (mismo patrón que 20260910_auditoria_cambios.sql) ───
do $$
begin
  if to_regprocedure('public.fn_auditoria()') is not null then
    execute 'drop trigger if exists trg_auditoria on public.sop_reuniones';
    execute 'create trigger trg_auditoria after insert or update or delete on public.sop_reuniones for each row execute function public.fn_auditoria(''id'')';
    execute 'drop trigger if exists trg_auditoria on public.sop_reuniones_lineas';
    execute 'create trigger trg_auditoria after insert or update or delete on public.sop_reuniones_lineas for each row execute function public.fn_auditoria(''id'')';
  else
    raise notice 'fn_auditoria() no existe: sop_reuniones sin auditoría';
  end if;
end $$;
