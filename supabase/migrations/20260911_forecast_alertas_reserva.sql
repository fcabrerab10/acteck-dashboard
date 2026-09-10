-- ═══════════════════════════════════════════════════════════════════════════
-- 20260911 · Avisos de reserva en el centro de notificaciones.
--
-- Los avisos "3 días antes" y "el día del arribo" de las líneas compradas de
-- Forecast › Reservas dejan de vivir en forecast_avisos (tabla que queda sin uso,
-- no se borra) y pasan a ser filas de `alertas` con area 'forecast'
-- (tipo reserva_3dias / reserva_dia). Las genera el cron generar-alertas
-- (regla reglaReservasArribo en api/cron.js): la tabla no admite INSERT desde la
-- app (grant sólo select + update de 3 columnas), así que el cron es la única vía.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.alertas drop constraint if exists alertas_area_check;
alter table public.alertas add constraint alertas_area_check
  check (area is null or area in ('inventario','ventas','pagos','cobranza','datos','operacion','forecast'));

comment on column public.alertas.area is 'Pila del centro de notificaciones: inventario | ventas | pagos | cobranza | datos | operacion | forecast';
comment on table public.forecast_avisos is 'SIN USO desde 2026-09-11: los avisos de arribo se generan como alertas (area forecast) por el cron generar-alertas.';
