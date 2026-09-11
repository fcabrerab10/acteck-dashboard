-- Tracking Pedidos V3 (2026-09-11)
-- Conserva las tablas oc_* y lo capturado por Karolina (105 OCs). Añade columnas, tablas nuevas,
-- la vista de facturas del ERP y la RPC que materializa la liga factura/guía ↔ OC.
--
--   oc_clientes        + facturas text[] (folios a mano; migra numero_factura) · fuente · cotizacion_id
--   oc_cotizaciones    nueva (migra fecha_cotizacion_* de oc_clientes, sin borrarlas)
--   oc_facturas        nueva · una fila por factura ligada a una OC (UNIQUE oc_id, folio)
--   oc_factura_skus    nueva · partidas de cada factura (UNIQUE factura_id, sku)
--   oc_envios          + fuente · guia_erp_id · fecha_envio_erp · fecha_entrega_erp · fecha_elegida · persona_recibio
--   v_erp_facturas_oc  facturas de los 3 clientes con tab, últimos 12 meses, partidas en jsonb
--   oc_liga_referencia(referencia, numero_oc)  regla de liga por referencia
--   oc_sincronizar_erp()  RPC idempotente: liga facturas (v_erp_facturas_oc) y guías (guias_erp) a las OCs
--
-- Regla de liga (por AMBOS caminos; cualquiera liga, los dos = 'ambos'):
--   (a) referencia de la factura normalizada (mayúsculas, sólo [A-Z0-9], sin ceros a la izquierda)
--       = número de OC normalizado, o la referencia contiene el número de OC como token completo
--       (≥ 5 caracteres, p. ej. "MTY 537978" ↔ "537978"), y la factura cae entre −15 y +120 días
--       de la fecha en que se recibió la OC.
--   (b) folio de la factura ∈ oc_clientes.facturas (capturado a mano).
-- Guías (guias_erp): por factura (movid ∈ folios ligados o capturados) o por OC (orden_compra /
-- referencia con la misma regla). Lo manual gana: una guía del ERP se cuelga del envío manual de la
-- misma OC/factura (guia_erp_id + fechas *_erp) y la pantalla muestra el desfase; si no hay envío
-- manual, se inserta un envío fuente='erp'.

begin;

-- ─── 1. oc_clientes ───
alter table public.oc_clientes
  add column if not exists facturas       text[]  not null default '{}',
  add column if not exists fuente         text    not null default 'manual',
  add column if not exists cotizacion_id  uuid;

alter table public.oc_clientes drop constraint if exists oc_clientes_fuente_check;
alter table public.oc_clientes add constraint oc_clientes_fuente_check
  check (fuente in ('manual', 'correo', 'factura', 'cotizacion'));

-- Folios capturados a mano en el header → facturas[] (sin borrar numero_factura).
update public.oc_clientes
   set facturas = array[btrim(numero_factura)]
 where numero_factura is not null and btrim(numero_factura) <> '' and cardinality(facturas) = 0;

-- ─── 2. oc_cotizaciones ───
create table if not exists public.oc_cotizaciones (
  id               uuid primary key default gen_random_uuid(),
  cliente_key      text not null,
  folio            text,
  fecha_solicitada timestamptz,
  fecha_enviada    timestamptz,
  fecha_respuesta  timestamptz,
  estado           text not null default 'solicitada' check (estado in ('solicitada', 'enviada', 'aceptada', 'perdida')),
  motivo_perdida   text,
  monto            numeric,
  piezas           numeric,
  notas            text,
  oc_id            uuid references public.oc_clientes(id) on delete set null,
  created_by       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists oc_cotizaciones_cliente_idx on public.oc_cotizaciones (cliente_key, estado);

alter table public.oc_clientes drop constraint if exists oc_clientes_cotizacion_fkey;
alter table public.oc_clientes add constraint oc_clientes_cotizacion_fkey
  foreign key (cotizacion_id) references public.oc_cotizaciones(id) on delete set null;

-- Migra las cotizaciones que hoy viven como fechas en oc_clientes (Dicotech). Idempotente por oc_id.
insert into public.oc_cotizaciones (cliente_key, folio, fecha_solicitada, fecha_enviada, fecha_respuesta, estado, piezas, monto, oc_id, created_by, created_at)
select o.cliente_key,
       'COT-' || coalesce(o.numero_oc_cliente, left(o.id::text, 8)),
       o.fecha_cotizacion_solicitada,
       o.fecha_cotizacion_enviada,
       case when o.fecha_recibida is not null then o.fecha_recibida end,
       case when o.fecha_recibida is not null then 'aceptada'
            when o.fecha_cotizacion_enviada is not null then 'enviada'
            else 'solicitada' end,
       (select sum(s.cantidad_ordenada) from public.oc_clientes_skus s where s.oc_id = o.id),
       (select sum(s.cantidad_ordenada * coalesce(s.precio_unitario, 0)) from public.oc_clientes_skus s where s.oc_id = o.id),
       o.id, o.created_by, coalesce(o.fecha_cotizacion_solicitada, o.created_at)
  from public.oc_clientes o
 where (o.fecha_cotizacion_solicitada is not null or o.fecha_cotizacion_enviada is not null)
   and not exists (select 1 from public.oc_cotizaciones c where c.oc_id = o.id);

update public.oc_clientes o
   set cotizacion_id = c.id
  from public.oc_cotizaciones c
 where c.oc_id = o.id and o.cotizacion_id is null;

-- ─── 3. oc_facturas · oc_factura_skus ───
create table if not exists public.oc_facturas (
  id          uuid primary key default gen_random_uuid(),
  oc_id       uuid not null references public.oc_clientes(id) on delete cascade,
  folio       text not null,
  referencia  text,
  fecha       date,
  piezas      numeric not null default 0,
  monto       numeric not null default 0,
  fuente      text not null default 'erp'    check (fuente in ('erp', 'manual')),
  ligada_por  text not null default 'manual' check (ligada_por in ('referencia', 'folio', 'ambos', 'manual')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (oc_id, folio)
);
create index if not exists oc_facturas_folio_idx on public.oc_facturas (folio);
-- Cliente de la factura en el ERP (puede diferir del de la OC cuando el folio se capturó a mano en otro cliente).
alter table public.oc_facturas add column if not exists cliente_key_erp text;

create table if not exists public.oc_factura_skus (
  id          uuid primary key default gen_random_uuid(),
  factura_id  uuid not null references public.oc_facturas(id) on delete cascade,
  sku         text not null,
  descripcion text,
  piezas      numeric not null default 0,
  monto       numeric not null default 0,
  created_at  timestamptz not null default now(),
  unique (factura_id, sku)
);

-- ─── 4. oc_envios ───
alter table public.oc_envios
  add column if not exists fuente            text not null default 'manual',
  add column if not exists guia_erp_id       bigint,
  add column if not exists fecha_envio_erp   timestamptz,
  add column if not exists fecha_entrega_erp timestamptz,
  add column if not exists fecha_elegida     text,
  add column if not exists persona_recibio   text;
alter table public.oc_envios drop constraint if exists oc_envios_fuente_check;
alter table public.oc_envios add constraint oc_envios_fuente_check check (fuente in ('erp', 'manual'));
alter table public.oc_envios drop constraint if exists oc_envios_fecha_elegida_check;
alter table public.oc_envios add constraint oc_envios_fecha_elegida_check check (fecha_elegida is null or fecha_elegida in ('manual', 'erp'));
create unique index if not exists oc_envios_guia_erp_idx on public.oc_envios (guia_erp_id) where guia_erp_id is not null;
-- Los envíos que llegan del ERP no siempre traen almacén (se mapea guias_erp.almacen_envio → almacenes_config.cedis).
alter table public.oc_envios alter column almacen_origen drop not null;

-- ─── 5. RLS + auditoría (igual que las oc_* existentes) ───
alter table public.oc_cotizaciones  enable row level security;
alter table public.oc_facturas      enable row level security;
alter table public.oc_factura_skus  enable row level security;
do $$
declare t text;
begin
  foreach t in array array['oc_cotizaciones', 'oc_facturas', 'oc_factura_skus'] loop
    execute format('drop policy if exists "%s read all" on public.%I', t, t);
    execute format('create policy "%s read all" on public.%I for select using (true)', t, t);
    execute format('drop policy if exists "%s write all" on public.%I', t, t);
    execute format('create policy "%s write all" on public.%I for all using (true) with check (true)', t, t);
    execute format('drop trigger if exists trg_auditoria on public.%I', t);
    execute format('create trigger trg_auditoria after insert or update or delete on public.%I for each row execute function public.fn_auditoria(%L)', t, 'id');
  end loop;
end $$;

-- ─── 6. Vista: facturas del ERP de los clientes con tab (12 meses) ───
-- erp_ventas renglón a renglón → una fila por factura con sus partidas agregadas por SKU.
-- Excluye devoluciones, bonificaciones y notas de crédito (movimiento_venta = Factura*).
create or replace view public.v_erp_facturas_oc as
with r as (
  select cliente_key, folio, referencia, make_date(anio, mes, coalesce(dia, 1)) as fecha,
         articulo, max(descripcion) as descripcion,
         sum(coalesce(unidades, piezas, 0)) as piezas,
         sum(coalesce(monto_venta_pesos, 0)) as monto
    from public.erp_ventas
   where movimiento_venta ilike 'Factura%'
     and coalesce(estatus_venta, '') not ilike 'CANCELAD%'
     and cliente_key in ('digitalife', 'pcel', 'dicotech')
     and anio >= extract(year from now())::int - 1
     and make_date(anio, mes, coalesce(dia, 1)) >= (date_trunc('month', now()) - interval '12 months')::date
     and folio is not null
   group by 1, 2, 3, 4, 5
)
select cliente_key, folio,
       max(referencia)                       as referencia,
       min(fecha)                            as fecha,
       sum(piezas)                           as piezas,
       sum(monto)                            as monto,
       count(*)                              as n_partidas,
       jsonb_agg(jsonb_build_object('sku', articulo, 'descripcion', descripcion, 'piezas', piezas, 'monto', monto) order by articulo) as partidas
  from r
 group by cliente_key, folio;

grant select on public.v_erp_facturas_oc to anon, authenticated, service_role;

-- ─── 7. Reglas de liga ───
create or replace function public.oc_norm(t text) returns text
language sql immutable as $$
  select ltrim(regexp_replace(upper(coalesce(t, '')), '[^A-Z0-9]', '', 'g'), '0');
$$;

-- referencia (factura/guía) ↔ número de OC. Igualdad normalizada o token completo (≥ 5 caracteres).
-- En SQL (no plpgsql) para que el planificador la inyecte en el join de la RPC (≈100K evaluaciones por corrida).
create or replace function public.oc_liga_referencia(referencia text, numero_oc text) returns boolean
language sql immutable as $$
  select case
    when public.oc_norm(numero_oc) = '' or public.oc_norm(referencia) = '' then false
    when public.oc_norm(referencia) = public.oc_norm(numero_oc) then true
    when length(public.oc_norm(numero_oc)) >= 5
         and upper(coalesce(referencia, '')) ~ ('(^|[^A-Z0-9])0*' || public.oc_norm(numero_oc) || '([^A-Z0-9]|$)') then true
    else false end;
$$;

-- guias_erp.cliente_nombre → cliente_key (misma regla que facturacion_clientes).
create or replace function public.oc_cliente_key_guia(nombre text) returns text
language sql immutable as $$
  select case
    when upper(coalesce(nombre, '')) in ('API GLOBAL', 'CAJADL01') then 'digitalife'
    when upper(coalesce(nombre, '')) = 'PC ONLINE' then 'pcel'
    when upper(coalesce(nombre, '')) like 'DICOTECH%' then 'dicotech'
    else null end;
$$;

-- ─── 8. RPC: materializa la liga (idempotente; la llama la pantalla al cargar y el cron) ───
create or replace function public.oc_sincronizar_erp() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  n_fact int := 0; n_part int := 0; n_guias_lig int := 0; n_guias_new int := 0; n_guias_upd int := 0;
  g record; e_id uuid; e_num int;
begin
  -- 8a. Facturas → oc_facturas (fuente erp). Una factura liga a una sola OC (la mejor: ambos > folio > referencia).
  drop table if exists _liga;
  create temp table _liga on commit drop as
  -- (b) folio capturado a mano liga aunque el ERP tenga la factura en otro cliente (se guarda cliente_key_erp);
  -- (a) referencia sólo dentro del mismo cliente y en la ventana de fechas.
  with f as materialized (select * from public.v_erp_facturas_oc),
  cand as (
    select f.folio, f.cliente_key, f.referencia, f.fecha, f.piezas, f.monto, f.partidas, o.id as oc_id,
           (f.folio = any(coalesce(o.facturas, '{}'))) as por_folio,
           (o.cliente_key = f.cliente_key
              and (o.fecha_recibida is null or f.fecha between (o.fecha_recibida::date - 15) and (o.fecha_recibida::date + 120))
              and public.oc_liga_referencia(f.referencia, o.numero_oc_cliente)) as por_ref
      from f
      join public.oc_clientes o on (o.cliente_key = f.cliente_key or f.folio = any(coalesce(o.facturas, '{}')))
  )
  select distinct on (folio) *
    from cand
   where por_folio or por_ref
   order by folio, (por_folio and por_ref) desc, por_folio desc, oc_id;

  with ins as (
    insert into public.oc_facturas as fa (oc_id, folio, referencia, fecha, piezas, monto, fuente, ligada_por, cliente_key_erp)
    select oc_id, folio, referencia, fecha, piezas, monto, 'erp',
           case when por_folio and por_ref then 'ambos' when por_folio then 'folio' else 'referencia' end, cliente_key
      from _liga
    on conflict (oc_id, folio) do update
      set referencia = excluded.referencia, fecha = excluded.fecha, piezas = excluded.piezas, monto = excluded.monto,
          ligada_por = excluded.ligada_por, cliente_key_erp = excluded.cliente_key_erp, updated_at = now()
      where fa.fuente = 'erp'
        and (fa.referencia is distinct from excluded.referencia or fa.fecha is distinct from excluded.fecha
             or fa.piezas is distinct from excluded.piezas or fa.monto is distinct from excluded.monto
             or fa.ligada_por is distinct from excluded.ligada_por or fa.cliente_key_erp is distinct from excluded.cliente_key_erp)
    returning 1
  ) select count(*) into n_fact from ins;

  with ins as (
    insert into public.oc_factura_skus as fs (factura_id, sku, descripcion, piezas, monto)
    select fa.id, p->>'sku', p->>'descripcion', (p->>'piezas')::numeric, (p->>'monto')::numeric
      from _liga l
      join public.oc_facturas fa on fa.oc_id = l.oc_id and fa.folio = l.folio
      cross join lateral jsonb_array_elements(l.partidas) p
     where p->>'sku' is not null
    on conflict (factura_id, sku) do update
      set piezas = excluded.piezas, monto = excluded.monto, descripcion = excluded.descripcion
      where fs.piezas is distinct from excluded.piezas or fs.monto is distinct from excluded.monto
    returning 1
  ) select count(*) into n_part from ins;

  -- 8b. Guías del ERP → oc_envios. Sólo guías con fecha de envío, 12 meses, clientes con tab.
  for g in
    with gu as (
      select ge.id, ge.movid, public.oc_cliente_key_guia(ge.cliente_nombre) as ck, ge.orden_compra, ge.referencia,
             ge.forma_envio, ge.fecha_envio, ge.fecha_recepcion, ge.persona_recibio, ge.guias,
             (select case when ac.cedis ilike '%GUADALAJARA%' then 'GDL' when ac.cedis ilike '%MEXICO%' then 'CDMX' end
                from public.almacenes_config ac where ac.no_almacen::text = ge.almacen_envio limit 1) as almacen
        from public.guias_erp ge
       where ge.fecha_envio is not null
         and coalesce(ge.fecha_emision, ge.fecha_envio) >= now() - interval '12 months'
         and public.oc_cliente_key_guia(ge.cliente_nombre) is not null
    ), cand as (
      select gu.*, o.id as oc_id,
             (gu.movid = any(coalesce(o.facturas, '{}')) or exists (select 1 from public.oc_facturas f where f.oc_id = o.id and f.folio = gu.movid)) as por_factura,
             (public.oc_liga_referencia(gu.orden_compra, o.numero_oc_cliente) or public.oc_liga_referencia(gu.referencia, o.numero_oc_cliente)) as por_oc
        from gu join public.oc_clientes o on o.cliente_key = gu.ck
    )
    select distinct on (id) * from cand where por_factura or por_oc order by id, por_factura desc, oc_id
  loop
    -- ya ligada → refrescar fechas del ERP
    select id into e_id from public.oc_envios where guia_erp_id = g.id;
    if e_id is not null then
      update public.oc_envios set
        fecha_envio_erp = g.fecha_envio, fecha_entrega_erp = g.fecha_recepcion,
        guia_rastreo = coalesce(guia_rastreo, g.guias), paqueteria = coalesce(paqueteria, g.forma_envio),
        persona_recibio = coalesce(persona_recibio, g.persona_recibio), numero_factura = coalesce(numero_factura, g.movid),
        fecha_surtida   = case when fuente = 'erp' then g.fecha_envio     else fecha_surtida   end,
        fecha_entregada = case when fuente = 'erp' then g.fecha_recepcion else fecha_entregada end,
        updated_at = now()
      where id = e_id
        and (fecha_envio_erp is distinct from g.fecha_envio or fecha_entrega_erp is distinct from g.fecha_recepcion
             or (fuente = 'erp' and (fecha_surtida is distinct from g.fecha_envio or fecha_entregada is distinct from g.fecha_recepcion))
             or (guia_rastreo is null and g.guias is not null) or (persona_recibio is null and g.persona_recibio is not null));
      if found then n_guias_upd := n_guias_upd + 1; end if;
      continue;
    end if;
    -- envío manual de la misma OC sin guía ERP → colgar la guía (lo manual gana; la pantalla muestra el desfase)
    select id into e_id from public.oc_envios
     where oc_id = g.oc_id and guia_erp_id is null and fuente = 'manual'
       and (numero_factura is null or numero_factura = g.movid)
     order by (numero_factura = g.movid) desc nulls last, numero_envio
     limit 1;
    if e_id is not null then
      update public.oc_envios set
        guia_erp_id = g.id, fecha_envio_erp = g.fecha_envio, fecha_entrega_erp = g.fecha_recepcion,
        numero_factura = coalesce(numero_factura, g.movid), guia_rastreo = coalesce(guia_rastreo, g.guias),
        paqueteria = coalesce(paqueteria, g.forma_envio), persona_recibio = coalesce(persona_recibio, g.persona_recibio),
        updated_at = now()
      where id = e_id;
      n_guias_lig := n_guias_lig + 1;
      continue;
    end if;
    -- sin envío manual → envío nuevo fuente erp
    select coalesce(max(numero_envio), 0) + 1 into e_num from public.oc_envios where oc_id = g.oc_id;
    insert into public.oc_envios (oc_id, numero_envio, fuente, guia_erp_id, fecha_envio_erp, fecha_entrega_erp, almacen_origen,
                                  fecha_surtida, fecha_entregada, metodo_envio, paqueteria, guia_rastreo, numero_factura, persona_recibio)
    values (g.oc_id, e_num, 'erp', g.id, g.fecha_envio, g.fecha_recepcion, g.almacen,
            g.fecha_envio, g.fecha_recepcion, case when g.forma_envio is not null then 'paqueteria' else null end,
            g.forma_envio, g.guias, g.movid, g.persona_recibio);
    n_guias_new := n_guias_new + 1;
  end loop;

  return jsonb_build_object('facturas', n_fact, 'partidas', n_part, 'guias_ligadas', n_guias_lig, 'guias_nuevas', n_guias_new, 'guias_actualizadas', n_guias_upd, 'at', now());
end $$;

revoke all on function public.oc_sincronizar_erp() from public;
grant execute on function public.oc_sincronizar_erp() to authenticated, service_role;

commit;
