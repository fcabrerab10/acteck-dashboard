-- Las reglas nuevas del cron (Tracking, Agenda, Actividad del equipo) usan áreas que el CHECK no admitía:
-- el upsert masivo fallaba con 23514 y ninguna alerta del día se guardaba.
alter table public.alertas drop constraint if exists alertas_area_check;
alter table public.alertas add constraint alertas_area_check
  check (area is null or area = any (array['inventario','ventas','pagos','cobranza','datos','operacion','forecast','tracking','agenda','equipo']));
