-- 2026-09-12 · Capa canónica de medidas (3/4): CUOTA (tabla BP del director).
--
--   Cuota Venta       = SUM(BP[IMPORTEDEVENTA])   → cuotas_mensuales.cuota_ideal
--   Cuota Minima      = SUM(BP[CUOTAMINIMA])      → cuotas_mensuales.cuota_min
--   Cuota Piezas      = SUM(BP[UNIDADES])         → cuotas_mensuales.cuota_piezas  ← NUEVA
--   Cuota Costo       = SUM(BP[COSTODEVENTA])     → cuotas_mensuales.cuota_costo   ← NUEVA
--   Cuota Contribucion    = Cuota Venta − Cuota Costo
--   Cuota % Contribucion  = Cuota Contribucion / Cuota Venta
--
-- ⚠ El puente (bridge/lib/mappers.mjs · cuotasDesdeBP) hoy sólo trae CUOTAMINIMA
-- e IMPORTEDEVENTA. Las dos columnas nuevas quedan NULL hasta que se añadan
-- UNIDADES y COSTODEVENTA a CUOTAS_COLS en la Mac mini. Mientras tanto
-- [Cuota Piezas], [Cuota Costo] y [Cuota Contribucion] salen NULL en pantalla
-- (correcto: vacío en vez de un número inventado).

alter table public.cuotas_mensuales add column if not exists cuota_piezas numeric;
alter table public.cuotas_mensuales add column if not exists cuota_costo  numeric;
comment on column public.cuotas_mensuales.cuota_ideal  is 'Cuota Venta = SUM(BP[IMPORTEDEVENTA]). Es la meta oficial del dashboard.';
comment on column public.cuotas_mensuales.cuota_min    is 'Cuota Minima = SUM(BP[CUOTAMINIMA]).';
comment on column public.cuotas_mensuales.cuota_piezas is 'Cuota Piezas = SUM(BP[UNIDADES]). Pendiente de cargar por el puente.';
comment on column public.cuotas_mensuales.cuota_costo  is 'Cuota Costo = SUM(BP[COSTODEVENTA]). Pendiente de cargar por el puente.';

-- Cuota por cliente y mes con las 6 medidas ya resueltas.
create or replace view public.v_medidas_cuota_cliente_mes as
select q.cliente                                   as cliente_key,
       q.anio, q.mes,
       sum(coalesce(q.cuota_ideal, q.cuota_min, 0)) as cuota_venta,
       sum(coalesce(q.cuota_min, 0))                as cuota_minima,
       sum(q.cuota_piezas)                          as cuota_piezas,
       sum(q.cuota_costo)                           as cuota_costo,
       sum(coalesce(q.cuota_ideal, q.cuota_min, 0)) - sum(q.cuota_costo) as cuota_contribucion
  from public.cuotas_mensuales q
 where q.anio is not null and q.mes between 1 and 12
 group by q.cliente, q.anio, q.mes;
grant select on public.v_medidas_cuota_cliente_mes to authenticated, anon, service_role;

-- Cuota global por mes. Prioridad: cuotas_canales (dimension_tipo='TOTAL', meta
-- anual /12) si existe para el año; si no, la suma de cuotas_mensuales.
create or replace view public.v_medidas_cuota_mes as
with anual as (
  select anio,
         sum(meta_facturacion) as meta_anual,
         sum(meta_piezas)      as meta_piezas_anual
    from public.cuotas_canales
   where upper(coalesce(dimension_tipo,'')) = 'TOTAL'
   group by anio
),
porcliente as (
  select anio, mes, sum(cuota_venta) cuota_venta, sum(cuota_minima) cuota_minima,
         sum(cuota_piezas) cuota_piezas, sum(cuota_costo) cuota_costo
    from public.v_medidas_cuota_cliente_mes group by anio, mes
),
base as (
  select anio, mes from porcliente
  union
  select a.anio, g.mes from anual a cross join generate_series(1,12) g(mes)
)
select b.anio, b.mes,
       coalesce(a.meta_anual / 12.0, p.cuota_venta)                   as cuota_venta,
       p.cuota_minima                                                 as cuota_minima,
       coalesce(a.meta_piezas_anual / 12.0, p.cuota_piezas)           as cuota_piezas,
       p.cuota_costo                                                  as cuota_costo,
       coalesce(a.meta_anual / 12.0, p.cuota_venta) - p.cuota_costo   as cuota_contribucion,
       (a.anio is not null)                                           as desde_cuotas_canales
  from base b
  left join porcliente p on p.anio = b.anio and p.mes = b.mes
  left join anual a      on a.anio = b.anio;
grant select on public.v_medidas_cuota_mes to authenticated, anon, service_role;

notify pgrst, 'reload schema';
