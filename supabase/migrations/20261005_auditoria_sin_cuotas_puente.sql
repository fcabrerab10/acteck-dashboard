-- 2026-10-05 · Historial de cambios lento e inútil: el 97 % de auditoria_cambios (91 K de 94 K filas, 46 MB) era el
-- puente SQL reescribiendo cuotas_mensuales cada día (replace por año = 1,643 DELETE + 1,643 INSERT, sin usuario).
-- La app nunca escribe cuotas_mensuales (las manuales se cargan por migración), así que esa tabla deja de auditarse
-- y se borra el ruido acumulado. El trigger de cuotas manuales (trg_cuotas_proteger_manual) no se toca.
drop trigger if exists trg_auditoria on public.cuotas_mensuales;
delete from public.auditoria_cambios where tabla = 'cuotas_mensuales' and usuario_id is null;

-- Telemetría · última actividad por usuario en UNA consulta (Administración hacía una por usuario).
create or replace view public.v_eventos_ultimo_usuario with (security_invoker = true) as
select user_id, max(ts) as ts from public.eventos_usuario group by user_id;
grant select on public.v_eventos_ultimo_usuario to authenticated;
