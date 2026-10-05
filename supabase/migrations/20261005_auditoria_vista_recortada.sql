-- 2026-10-05 · Historial de cambios: 162 filas de propuestas_borradores (lineas/propuesta de hasta 42 KB) pesaban
-- 4.3 MB de los 6.4 MB de la tabla y cada lote de 1,000 filas tardaba 2–3 s. La pantalla lee esta vista: los valores
-- de más de 2 KB se sustituyen por un marcador con su tamaño y `cambios_recortado` avisa para que, al abrir la fila,
-- la pantalla pida el jsonb completo de esa sola fila a auditoria_cambios.
create or replace view public.v_auditoria_cambios with (security_invoker = true) as
select a.id, a.tabla, a.operacion, a.registro_id, a.cliente_key, a.usuario_id, a.usuario_email, a.creado_at,
       coalesce((
         select jsonb_object_agg(e.key,
           case
             when length(e.value::text) <= 2048 then e.value
             when a.operacion = 'UPDATE' then jsonb_build_object('de', '(contenido largo)', 'a', format('(cambió · %s KB)', round(length(e.value::text) / 1024.0, 1)))
             else to_jsonb(format('(contenido largo · %s KB)', round(length(e.value::text) / 1024.0, 1)))
           end)
         from jsonb_each(a.cambios) e), '{}'::jsonb) as cambios,
       exists (select 1 from jsonb_each(a.cambios) e where length(e.value::text) > 2048) as cambios_recortado
from public.auditoria_cambios a;
grant select on public.v_auditoria_cambios to authenticated;
