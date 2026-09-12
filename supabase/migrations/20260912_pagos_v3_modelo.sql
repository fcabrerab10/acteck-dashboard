-- Pagos V3 · modelo unificado (2026-09-12)
-- Una sola pantalla para Digitalife, PCEL y Dicotech. Flujo único:
--   calculado → solicitado → autorizado → folio → pagado   (+ rechazado, + cancelado/"no aplica")
-- NADA se borra: la tabla `pagos` conserva todas sus columnas viejas (estatus, categoria…)
-- y se le agregan las nuevas. La migración de datos va en 20260912_pagos_v3_migracion.sql.

-- ───────────────────────── pagos · columnas nuevas ─────────────────────────
alter table public.pagos
  add column if not exists estado            text,
  add column if not exists origen            text,          -- auto | manual
  add column if not exists tipo              text,          -- rebate | spiff | dinamica | marketing | fijo | proteccion_precio | promocion | bonificacion | otro
  add column if not exists periodo           text,          -- 'YYYY-MM' | 'YYYY-Qn'
  add column if not exists fecha_programada  date,          -- fecha de pago programada (eje del calendario)
  add column if not exists clave_calculo     text,          -- idempotencia del motor: 'rebate:dicotech:2026-08'
  add column if not exists detalle           jsonb default '{}'::jsonb,  -- evidencia del cálculo (filas, %, base)
  add column if not exists solicitado_at     timestamptz,
  add column if not exists solicitado_por    text,
  add column if not exists autorizado_at     timestamptz,
  add column if not exists autorizado_por    text,
  add column if not exists folio_at          timestamptz,
  add column if not exists folio_por         text,
  add column if not exists pagado_at         timestamptz,
  add column if not exists pagado_por        text,
  add column if not exists motivo_rechazo    text,
  -- Nota de crédito (se paga por NC; los campos salen del PDF y los confirma Fernando)
  add column if not exists nc_folio          text,
  add column if not exists nc_uuid           text,
  add column if not exists nc_fecha          date,
  add column if not exists nc_factura        text,          -- factura a la que se aplicó
  add column if not exists nc_importe        numeric,
  add column if not exists nc_iva            numeric,
  add column if not exists nc_total          numeric,
  add column if not exists nc_razon_social   text,
  add column if not exists nc_rfc            text,
  add column if not exists nc_concepto       text,
  add column if not exists nc_servicio_tipo  text,          -- campo del correo de finanzas
  add column if not exists nc_referencia     text,          -- "referencia de bonificación"
  add column if not exists nc_observaciones  text,
  add column if not exists nc_pdf_path       text;          -- ruta en el bucket pagos-nc

do $$ begin
  alter table public.pagos add constraint pagos_estado_chk
    check (estado is null or estado in ('calculado','solicitado','autorizado','folio','pagado','rechazado','cancelado'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.pagos add constraint pagos_origen_chk
    check (origen is null or origen in ('auto','manual'));
exception when duplicate_object then null; end $$;

create unique index if not exists pagos_clave_calculo_uniq
  on public.pagos (clave_calculo) where clave_calculo is not null;
create index if not exists pagos_estado_idx     on public.pagos (estado);
create index if not exists pagos_programada_idx on public.pagos (fecha_programada);
create index if not exists pagos_cliente_periodo_idx on public.pagos (cliente, periodo);

-- ───────────────────────── pagos_reglas (con candado y vigencia) ─────────────────────────
-- Una fila por (cliente, seccion) vigente; al editar se cierra la anterior (vigente_hasta)
-- y se abre una nueva. Los cálculos usan la regla vigente en el periodo.
create table if not exists public.pagos_reglas (
  id             bigserial primary key,
  cliente        text not null,                 -- digitalife | pcel | dicotech | '_global'
  seccion        text not null,                 -- rebate | spiff | dinamica | fondo | fijos | destinatarios | proteccion
  config         jsonb not null default '{}'::jsonb,
  vigente_desde  date not null default current_date,
  vigente_hasta  date,                          -- null = vigente
  nota           text,
  creado_por     text,
  creado_at      timestamptz not null default now()
);
create index if not exists pagos_reglas_lookup on public.pagos_reglas (cliente, seccion, vigente_desde desc);
create unique index if not exists pagos_reglas_vigente_uniq
  on public.pagos_reglas (cliente, seccion) where vigente_hasta is null;

create table if not exists public.pagos_reglas_historial (
  id              bigserial primary key,
  regla_id        bigint,
  cliente         text not null,
  seccion         text not null,
  config_anterior jsonb,
  config_nueva    jsonb,
  cambiado_por    text,
  cambiado_at     timestamptz not null default now(),
  nota            text
);
create index if not exists pagos_reglas_hist_idx on public.pagos_reglas_historial (cliente, seccion, cambiado_at desc);

-- Cambia una regla cerrando la vigente y abriendo la nueva + bitácora. Es la ÚNICA
-- vía de escritura que usa la pantalla (botón "Desbloquear para editar").
create or replace function public.pagos_guardar_regla(
  p_cliente text, p_seccion text, p_config jsonb, p_por text default null, p_nota text default null
) returns public.pagos_reglas
language plpgsql security definer set search_path = public as $$
declare v_ant public.pagos_reglas; v_new public.pagos_reglas;
begin
  select * into v_ant from public.pagos_reglas
   where cliente = p_cliente and seccion = p_seccion and vigente_hasta is null
   limit 1;
  if found then
    update public.pagos_reglas set vigente_hasta = current_date where id = v_ant.id;
  end if;
  insert into public.pagos_reglas (cliente, seccion, config, vigente_desde, creado_por, nota)
  values (p_cliente, p_seccion, coalesce(p_config, '{}'::jsonb), current_date, p_por, p_nota)
  returning * into v_new;
  insert into public.pagos_reglas_historial (regla_id, cliente, seccion, config_anterior, config_nueva, cambiado_por, nota)
  values (v_new.id, p_cliente, p_seccion, v_ant.config, v_new.config, p_por, p_nota);
  return v_new;
end $$;

-- ───────────────────────── dinámica de vendedores (Dicotech) ─────────────────────────
-- Meta mensual sin IVA + lista de premios (1º…5º) que se capturan cada mes.
create table if not exists public.pagos_dinamica_mes (
  id          bigserial primary key,
  cliente     text not null default 'dicotech',
  anio        int  not null,
  mes         int  not null check (mes between 1 and 12),
  meta        numeric not null default 0,        -- venta mínima sin IVA para participar
  premios     jsonb not null default '[]'::jsonb, -- [{ pos, premio, monto }]
  nota        text,
  creado_por  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (cliente, anio, mes)
);

-- ───────────────────────── bitácora de flujo ─────────────────────────
create table if not exists public.pagos_bitacora (
  id              bigserial primary key,
  pago_id         uuid not null references public.pagos(id) on delete cascade,
  estado_anterior text,
  estado_nuevo    text,
  usuario         text,
  nota            text,
  meta            jsonb default '{}'::jsonb,
  at              timestamptz not null default now()
);
create index if not exists pagos_bitacora_pago_idx on public.pagos_bitacora (pago_id, at desc);

-- ───────────────────────── fondos por cliente ─────────────────────────
-- Saldo = abonos − cargos. Abonos por regla (p. ej. % del sell in) o manuales.
-- Cargos: actividades de marketing marcadas 'fondo' y pagos ligados.
create table if not exists public.pagos_fondos (
  id          bigserial primary key,
  cliente     text not null,
  fondo_key   text not null,                    -- mkt | interno | proteccion | directo
  nombre      text not null,
  regla       jsonb not null default '{}'::jsonb, -- { tipo:'pct_sell_in', pct:0.01 } | { tipo:'manual' }
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (cliente, fondo_key)
);

create table if not exists public.pagos_fondos_movimientos (
  id           bigserial primary key,
  fondo_id     bigint not null references public.pagos_fondos(id) on delete cascade,
  cliente      text not null,
  fecha        date not null default current_date,
  anio         int,
  mes          int,
  tipo         text not null check (tipo in ('abono','cargo')),
  monto        numeric not null,                -- siempre positivo; el signo lo da `tipo`
  concepto     text not null,
  pago_id      uuid references public.pagos(id) on delete set null,
  actividad_id uuid,                            -- marketing_actividades.id
  origen       text,                            -- regla | manual | marketing | pago | migracion
  notas        text,
  creado_por   text,
  created_at   timestamptz not null default now()
);
create index if not exists pagos_fondos_mov_idx on public.pagos_fondos_movimientos (fondo_id, fecha);
create index if not exists pagos_fondos_mov_cli on public.pagos_fondos_movimientos (cliente, anio, mes);

create or replace view public.v_pagos_fondos_saldo as
select f.id as fondo_id, f.cliente, f.fondo_key, f.nombre, f.regla, f.activo,
       coalesce(sum(m.monto) filter (where m.tipo = 'abono'), 0)                                as abonos,
       coalesce(sum(m.monto) filter (where m.tipo = 'cargo'), 0)                                as cargos,
       coalesce(sum(m.monto) filter (where m.tipo = 'abono' and m.anio = extract(year from current_date)), 0) as abonos_ytd,
       coalesce(sum(m.monto) filter (where m.tipo = 'cargo' and m.anio = extract(year from current_date)), 0) as cargos_ytd,
       coalesce(sum(case when m.tipo = 'abono' then m.monto else -m.monto end), 0)              as saldo,
       max(m.fecha)                                                                             as ultimo_movimiento
  from public.pagos_fondos f
  left join public.pagos_fondos_movimientos m on m.fondo_id = f.id
 group by f.id;

-- ───────────────────────── marketing · cargo a fondo o paga la empresa ─────────────────────────
alter table public.marketing_actividades
  add column if not exists cobro text not null default 'empresa';
do $$ begin
  alter table public.marketing_actividades add constraint marketing_cobro_chk
    check (cobro in ('fondo','empresa'));
exception when duplicate_object then null; end $$;
-- El histórico con fuente='fondo_mkt' ya era cargo a fondo.
update public.marketing_actividades set cobro = 'fondo' where fuente = 'fondo_mkt' and cobro <> 'fondo';

-- ───────────────────────── RLS (mismo patrón que `pagos`) ─────────────────────────
alter table public.pagos_reglas             enable row level security;
alter table public.pagos_reglas_historial   enable row level security;
alter table public.pagos_dinamica_mes       enable row level security;
alter table public.pagos_bitacora           enable row level security;
alter table public.pagos_fondos             enable row level security;
alter table public.pagos_fondos_movimientos enable row level security;

do $$ begin
  create policy pagos_reglas_read  on public.pagos_reglas  for select using (public.puede_ver_cliente_pestana(cliente, 'pagos'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy pagos_reglas_write on public.pagos_reglas  for all    using (public.puede_editar_cliente_pestana(cliente, 'pagos')) with check (public.puede_editar_cliente_pestana(cliente, 'pagos'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy pagos_reglas_hist_read on public.pagos_reglas_historial for select using (public.puede_ver_cliente_pestana(cliente, 'pagos'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy pagos_reglas_hist_write on public.pagos_reglas_historial for all using (public.puede_editar_cliente_pestana(cliente, 'pagos')) with check (public.puede_editar_cliente_pestana(cliente, 'pagos'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy pagos_dinamica_read  on public.pagos_dinamica_mes for select using (public.puede_ver_cliente_pestana(cliente, 'pagos'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy pagos_dinamica_write on public.pagos_dinamica_mes for all using (public.puede_editar_cliente_pestana(cliente, 'pagos')) with check (public.puede_editar_cliente_pestana(cliente, 'pagos'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy pagos_bitacora_read  on public.pagos_bitacora for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy pagos_bitacora_write on public.pagos_bitacora for all using (public.user_can_edit()) with check (public.user_can_edit());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy pagos_fondos_read  on public.pagos_fondos for select using (public.puede_ver_cliente_pestana(cliente, 'pagos'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy pagos_fondos_write on public.pagos_fondos for all using (public.puede_editar_cliente_pestana(cliente, 'pagos')) with check (public.puede_editar_cliente_pestana(cliente, 'pagos'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy pagos_fondos_mov_read  on public.pagos_fondos_movimientos for select using (public.puede_ver_cliente_pestana(cliente, 'pagos'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy pagos_fondos_mov_write on public.pagos_fondos_movimientos for all using (public.puede_editar_cliente_pestana(cliente, 'pagos')) with check (public.puede_editar_cliente_pestana(cliente, 'pagos'));
exception when duplicate_object then null; end $$;

-- La vista respeta el RLS de quien consulta (si no, expondría fondos de clientes
-- sobre los que el perfil no tiene permiso de la pestaña Pagos).
alter view public.v_pagos_fondos_saldo set (security_invoker = true);
grant select on public.v_pagos_fondos_saldo to anon, authenticated;

-- ───────────────────────── Storage: bucket pagos-nc (PDFs de notas de crédito) ─────────────────────────
insert into storage.buckets (id, name, public)
values ('pagos-nc', 'pagos-nc', false)
on conflict (id) do nothing;

do $$ begin
  create policy pagos_nc_read on storage.objects for select
    to authenticated using (bucket_id = 'pagos-nc');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy pagos_nc_insert on storage.objects for insert
    to authenticated with check (bucket_id = 'pagos-nc' and public.user_can_edit());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy pagos_nc_update on storage.objects for update
    to authenticated using (bucket_id = 'pagos-nc' and public.user_can_edit());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy pagos_nc_delete on storage.objects for delete
    to authenticated using (bucket_id = 'pagos-nc' and public.user_can_edit());
exception when duplicate_object then null; end $$;
