-- 2026-10-02 · Actividad del equipo bajaba auditoria_cambios con el jsonb `cambios` completo (13 MB, 6 s en el celular)
-- para leer apenas una docena de llaves en los textos (equipo/textos.js: estado, pagado, tipo, cerrada_at…). Esta vista
-- devuelve `cambios` recortado a esas llaves (misma forma {campo: {de, a}}); la pantalla lee la vista.
create or replace view public.v_auditoria_equipo with (security_invoker = true) as
select a.id, a.tabla, a.operacion, a.registro_id, a.cliente_key, a.usuario_id, a.usuario_email, a.creado_at,
       coalesce((select jsonb_object_agg(e.key, e.value) from jsonb_each(a.cambios) e
                 where e.key in ('activo','cerrada','cerrada_at','completado','comprado_at','estado','nombre','pagado','permisos','puesto','rol','se_evalua','tipo')), '{}'::jsonb) as cambios
from public.auditoria_cambios a;
grant select on public.v_auditoria_equipo to anon, authenticated;
