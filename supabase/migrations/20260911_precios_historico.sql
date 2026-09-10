-- 2026-09-11 · precios_historico + v_precios_cambios_mes
--
-- Contexto: el puente SQL (bridge/sync.mjs) REEMPLAZA precios_sku cada hora con el
-- mes actual (DELETE completo + INSERT por chunks de 1000 con ON CONFLICT DO UPDATE),
-- así que precios_sku nunca conserva meses anteriores. Esta tabla acumula el precio
-- de cada (sku, lista, anio, mes) la primera vez que se ve y lo actualiza si cambia
-- dentro del mismo mes. EL HISTÓRICO ACUMULA DESDE LA FECHA DE ESTA MIGRACIÓN: la
-- semilla es lo que hay hoy en precios_sku (un solo mes).
--
-- Trigger: de STATEMENT con transition table (REFERENCING NEW TABLE), un solo
-- INSERT…SELECT por sentencia. Postgres no permite transition tables en un trigger
-- con más de un evento, por eso son dos triggers (INSERT y UPDATE) sobre la misma
-- función; con INSERT … ON CONFLICT DO UPDATE las filas insertadas caen en el de
-- INSERT y las actualizadas en el de UPDATE.
--
-- Coste medido (replace simulado de 6,457 filas en una transacción con ROLLBACK):
-- ver reporte de la sesión / docs. Sin trigger ≈ base; con trigger ≈ +1 INSERT…SELECT
-- de N filas por chunk (índice PK de precios_historico).
--
-- Lectura: RLS mismo criterio que precios_sku (puede_ver_global('estrategia_precios')).

create table if not exists public.precios_historico (
  sku         text        not null,
  lista       text        not null,
  anio        integer     not null,
  mes         integer     not null,
  precio      numeric     not null,
  moneda      text,
  primera_vez timestamptz not null default now(),
  ultima_vez  timestamptz not null default now(),
  primary key (sku, lista, anio, mes)
);
comment on table public.precios_historico is
  'Histórico de precios por sku+lista+mes. Lo llena el trigger de precios_sku (el puente reemplaza esa tabla cada hora). Acumula desde 2026-09-11.';

alter table public.precios_historico enable row level security;
drop policy if exists precios_historico_read on public.precios_historico;
create policy precios_historico_read on public.precios_historico
  for select to authenticated using (public.puede_ver_global('estrategia_precios'));
grant select on public.precios_historico to authenticated, service_role;
grant insert, update on public.precios_historico to service_role;

-- Función del trigger · SECURITY DEFINER para que la escritura no dependa de la RLS del rol que carga.
create or replace function public.fn_precios_historico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.precios_historico (sku, lista, anio, mes, precio, moneda)
  select n.sku, n.lista, n.anio, n.mes, n.precio, n.moneda
    from nuevos n
   where n.precio is not null
  on conflict (sku, lista, anio, mes) do update
     set precio     = excluded.precio,
         moneda     = excluded.moneda,
         ultima_vez = now();
  return null;
end;
$$;

drop trigger if exists trg_precios_historico_ins on public.precios_sku;
create trigger trg_precios_historico_ins
  after insert on public.precios_sku
  referencing new table as nuevos
  for each statement execute function public.fn_precios_historico();

drop trigger if exists trg_precios_historico_upd on public.precios_sku;
create trigger trg_precios_historico_upd
  after update on public.precios_sku
  referencing new table as nuevos
  for each statement execute function public.fn_precios_historico();

-- Semilla: lo que hay hoy en precios_sku (primera_vez = updated_at de la carga).
insert into public.precios_historico (sku, lista, anio, mes, precio, moneda, primera_vez, ultima_vez)
select sku, lista, anio, mes, precio, moneda, coalesce(updated_at, now()), coalesce(updated_at, now())
  from public.precios_sku
 where precio is not null
on conflict (sku, lista, anio, mes) do nothing;

-- Vista: último precio por sku+lista vs el mes anterior con dato.
-- Con un solo mes de histórico todo sale como 'nuevo' (precio_anterior null).
create or replace view public.v_precios_cambios_mes
with (security_invoker = true) as
select x.sku, x.lista, x.anio, x.mes,
       x.precio        as precio_actual,
       x.precio_prev   as precio_anterior,
       x.anio_prev, x.mes_prev,
       case when x.precio_prev is null or x.precio_prev = 0 then null
            else round((x.precio - x.precio_prev) / x.precio_prev * 100, 2) end as delta_pct,
       case when x.precio_prev is null      then 'nuevo'
            when x.precio > x.precio_prev   then 'subio'
            when x.precio < x.precio_prev   then 'bajo'
            else 'sin_cambio' end            as tipo
  from (
    select h.sku, h.lista, h.anio, h.mes, h.precio,
           lag(h.precio) over w as precio_prev,
           lag(h.anio)   over w as anio_prev,
           lag(h.mes)    over w as mes_prev,
           row_number() over (partition by h.sku, h.lista order by h.anio desc, h.mes desc) as rn
      from public.precios_historico h
    window w as (partition by h.sku, h.lista order by h.anio, h.mes)
  ) x
 where x.rn = 1;
grant select on public.v_precios_cambios_mes to authenticated, service_role;
