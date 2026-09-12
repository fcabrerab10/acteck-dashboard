-- Pagos V3 · migración de los datos existentes al modelo nuevo (2026-09-12)
-- NO se borra ni se reescribe nada: se hace un respaldo completo de `pagos` y
-- se rellenan las columnas nuevas (estado/origen/tipo/periodo/fecha_programada).
-- Las columnas viejas (estatus, categoria, fecha_compromiso…) se conservan intactas.

-- ───── Respaldo completo antes de tocar nada ─────
create table if not exists public._respaldo_pagos_20260912 as
  select *, now() as respaldado_at from public.pagos;

create table if not exists public._respaldo_fondos_mkt_20260912 as
  select *, now() as respaldado_at from public.fondos_mkt_movimientos;

create table if not exists public._respaldo_fondo_pcel_20260912 as
  select *, now() as respaldado_at from public.fondo_pcel_movimientos;

-- ───── pagos: cliente nulo = Digitalife (la columna se agregó después) ─────
update public.pagos set cliente = 'digitalife' where cliente is null;

-- ───── estado ← estatus ─────
--   pendiente / vencido → calculado (aún no se solicita)
--   en_proceso          → solicitado
--   pagado              → pagado
--   cancelado / no_aplica → cancelado ("No aplica"; no es un rechazo del flujo)
update public.pagos set estado = case
    when estatus = 'pagado'                      then 'pagado'
    when estatus = 'en_proceso'                  then 'solicitado'
    when estatus in ('cancelado','no_aplica')    then 'cancelado'
    else 'calculado'
  end
where estado is null;

-- ───── tipo ← categoria ─────
update public.pagos set tipo = case categoria
    when 'rebate'         then 'rebate'
    when 'spiff'          then 'spiff'
    when 'marketing'      then 'marketing'
    when 'fondoMkt'       then 'marketing'
    when 'pagosFijos'     then 'fijo'
    when 'promociones'    then 'promocion'
    when 'pagosVariables' then 'otro'
    else 'otro'
  end
where tipo is null;

-- ───── origen: lo que calcula el motor es auto; lo capturado a mano, manual ─────
update public.pagos set origen = case
    when categoria in ('rebate','spiff','pagosFijos','marketing','fondoMkt') then 'auto'
    else 'manual'
  end
where origen is null;

-- ───── fecha programada del calendario ─────
update public.pagos
   set fecha_programada = coalesce(fecha_compromiso, fecha_pago_real)
 where fecha_programada is null;

-- ───── periodo 'YYYY-MM' (de mes_fijo/anio_fijo, del sellout o de la fecha) ─────
update public.pagos set periodo = coalesce(
    case when anio_fijo is not null and mes_fijo is not null
         then anio_fijo || '-' || lpad(mes_fijo::text, 2, '0') end,
    case when anio_sellout is not null and mes_sellout is not null
         then anio_sellout || '-' || lpad(mes_sellout::text, 2, '0') end,
    to_char(coalesce(fecha_compromiso, fecha_pago_real, created_at::date), 'YYYY-MM'))
where periodo is null;

-- ───── sellos de flujo a partir de lo que ya se sabe ─────
update public.pagos
   set pagado_at = coalesce(pagado_at, (coalesce(fecha_pago_real, fecha_compromiso))::timestamptz)
 where estado = 'pagado' and pagado_at is null;

-- ───── Bitácora: una entrada de origen por cada pago migrado ─────
insert into public.pagos_bitacora (pago_id, estado_anterior, estado_nuevo, usuario, nota, at)
select p.id, null, p.estado, 'migración V3',
       'Migrado del modelo anterior (categoria=' || p.categoria || ', estatus=' || coalesce(p.estatus,'—') || ')',
       coalesce(p.created_at, now())
  from public.pagos p
 where not exists (select 1 from public.pagos_bitacora b where b.pago_id = p.id);

-- ───── Fondos: los movimientos existentes se conservan y se replican al ledger nuevo ─────
-- Dicotech (fondos_mkt_movimientos): generacion → abono, aplicacion → cargo.
insert into public.pagos_fondos_movimientos (fondo_id, cliente, fecha, anio, mes, tipo, monto, concepto, pago_id, origen, notas, creado_por)
select f.id, m.cliente,
       make_date(m.anio, m.mes, 1), m.anio, m.mes,
       case when m.tipo_movimiento = 'generacion' then 'abono' else 'cargo' end,
       abs(m.monto),
       coalesce(m.notas, case when m.tipo_movimiento = 'generacion' then 'Generación del fondo' else 'Aplicación al fondo' end),
       m.pago_id, 'migracion', 'fondos_mkt_movimientos.id=' || m.id, 'migración V3'
  from public.fondos_mkt_movimientos m
  join public.pagos_fondos f
    on f.cliente = m.cliente
   and f.fondo_key = case when m.tipo_fondo = 'mkt_cliente' then 'mkt' else m.tipo_fondo end
 where not exists (
   select 1 from public.pagos_fondos_movimientos x
    where x.notas = 'fondos_mkt_movimientos.id=' || m.id);

-- PCEL (fondo_pcel_movimientos): gasto → cargo, aporte/otro → abono.
insert into public.pagos_fondos_movimientos (fondo_id, cliente, fecha, anio, mes, tipo, monto, concepto, pago_id, actividad_id, origen, notas, creado_por)
select f.id, 'pcel', m.fecha, m.anio, extract(month from m.fecha)::int,
       case when m.tipo_mov = 'gasto' then 'cargo' else 'abono' end,
       abs(m.monto), m.concepto, m.pago_id, m.actividad_id, 'migracion',
       'fondo_pcel_movimientos.id=' || m.id, coalesce(m.creado_por, 'migración V3')
  from public.fondo_pcel_movimientos m
  join public.pagos_fondos f on f.cliente = 'pcel' and f.fondo_key = m.tipo_fondo
 where not exists (
   select 1 from public.pagos_fondos_movimientos x
    where x.notas = 'fondo_pcel_movimientos.id=' || m.id);

-- ───── Marketing: las actividades ligadas a un pago con fuente fondo_mkt son cargo a fondo ─────
update public.marketing_actividades set cobro = 'fondo'
 where cobro <> 'fondo'
   and pago_id in (select id from public.pagos where fuente = 'fondo_mkt');
