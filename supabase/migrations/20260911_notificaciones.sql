-- ═══════════════════════════════════════════════════════════════════════════
-- 20260911 · Centro de notificaciones ("Centro iOS", propuesta A).
--
-- Una sola cola (`alertas`) con pilas por área, resumen programado por correo
-- (cron `resumen-programado`, 13:00 CDMX) y preferencias por usuario.
--
--   alertas.area       → 'inventario' | 'ventas' | 'pagos' | 'cobranza' | 'datos' | 'operacion'
--   alertas.accion     → { tipo:'navegar', clienteKey, pagina, label } | { tipo:'url', url, label }
--   alertas.caduca_at  → cuándo deja de tener sentido (el cron la resuelve como 'sistema')
--   notificaciones_lectura (usuario_id, alerta_id, leida_at) → "nuevo desde tu última visita"
--   perfiles.preferencias jsonb → preferencias.notif = {
--       areas: { inventario:'inmediato'|'resumen'|'silencio', … },
--       clientes: ['digitalife', …] | null,
--       resumen: { hora:'13:00', correo:true },
--       criticas_correo: true }
--   Se escribe con set_preferencias('{"notif": …}') (20260911_perfiles_preferencias.sql).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. alertas: area / accion / caduca_at ───
alter table public.alertas add column if not exists area      text;
alter table public.alertas add column if not exists accion    jsonb;
alter table public.alertas add column if not exists caduca_at timestamptz;

alter table public.alertas drop constraint if exists alertas_area_check;
alter table public.alertas add constraint alertas_area_check
  check (area is null or area in ('inventario','ventas','pagos','cobranza','datos','operacion'));

comment on column public.alertas.area      is 'Pila del centro de notificaciones: inventario | ventas | pagos | cobranza | datos | operacion';
comment on column public.alertas.accion    is 'Acción directa: {tipo:navegar, clienteKey, pagina, label} | {tipo:url, url, label}';
comment on column public.alertas.caduca_at is 'Fecha a partir de la cual la alerta ya no aplica; el cron la resuelve como sistema';

-- Backfill por tipo (las corridas nuevas del cron ya escriben area/accion).
update public.alertas set area = case tipo
  when 'stock_vs_transito'      then 'inventario'
  when 'cuota_en_riesgo'        then 'ventas'
  when 'devoluciones_anormales' then 'ventas'
  when 'rebate_por_generar'     then 'pagos'
  when 'datos_sin_actualizar'   then 'datos'
  when 'oc_sin_actualizar'      then 'operacion'
  else area end
where area is null;

create index if not exists alertas_area_activas_idx on public.alertas (area) where resuelta_at is null;
create index if not exists alertas_caduca_idx on public.alertas (caduca_at) where resuelta_at is null and caduca_at is not null;

-- El guard de UPDATE de 20260910 protege el contenido; extendemos a las 3 columnas nuevas.
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
    or new.area        is distinct from old.area
    or new.accion      is distinct from old.accion
    or new.caduca_at   is distinct from old.caduca_at
    or new.generada_at is distinct from old.generada_at
    or new.actualizada_at is distinct from old.actualizada_at then
      raise exception 'alertas: sólo se pueden modificar resuelta_at, resuelta_por y snooze_hasta';
    end if;
  end if;
  return new;
end $$;

-- ─── 2. notificaciones_lectura: qué ya vio cada usuario ───
create table if not exists public.notificaciones_lectura (
  usuario_id uuid        not null references auth.users (id) on delete cascade,
  alerta_id  bigint      not null references public.alertas (id) on delete cascade,
  leida_at   timestamptz not null default now(),
  primary key (usuario_id, alerta_id)
);
comment on table public.notificaciones_lectura is 'Marca de lectura por usuario y alerta. Una alerta es "nueva" si no tiene fila o si generada_at > leida_at (generada_at se reasigna al reabrir).';

alter table public.notificaciones_lectura enable row level security;

drop policy if exists notif_lectura_select on public.notificaciones_lectura;
create policy notif_lectura_select on public.notificaciones_lectura
  for select to authenticated using (usuario_id = auth.uid());

drop policy if exists notif_lectura_insert on public.notificaciones_lectura;
create policy notif_lectura_insert on public.notificaciones_lectura
  for insert to authenticated with check (usuario_id = auth.uid());

drop policy if exists notif_lectura_update on public.notificaciones_lectura;
create policy notif_lectura_update on public.notificaciones_lectura
  for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists notif_lectura_delete on public.notificaciones_lectura;
create policy notif_lectura_delete on public.notificaciones_lectura
  for delete to authenticated using (usuario_id = auth.uid());

revoke all on public.notificaciones_lectura from anon;
grant select, insert, update, delete on public.notificaciones_lectura to authenticated;
grant all on public.notificaciones_lectura to service_role;

-- ─── 3. perfiles.preferencias (idempotente: 20260911_perfiles_preferencias.sql puede crearla también) ───
alter table public.perfiles add column if not exists preferencias jsonb not null default '{}'::jsonb;
comment on column public.perfiles.preferencias is 'Preferencias de UI por usuario. `notif` = centro de notificaciones (areas, clientes, resumen, criticas_correo).';

-- Escritura: la app usa la RPC set_preferencias(jsonb) de 20260911_perfiles_preferencias.sql
-- (SECURITY DEFINER, fila propia, merge de primer nivel), con la llave `notif`.
