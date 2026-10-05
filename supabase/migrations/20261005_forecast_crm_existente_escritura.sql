-- 2026-10-05 · forecast_crm_existente sólo tenía política de SELECT: el botón «Ya lo cargué en el CRM»
-- (reservas/datos.js#marcarLoteCargadoDB) hacía upsert como `authenticated` y RLS lo rechazaba.
-- Misma regla de escritura que forecast_crm: internos o super admin.
drop policy if exists forecast_crm_existente_escritura on public.forecast_crm_existente;
create policy forecast_crm_existente_escritura on public.forecast_crm_existente
  for all to authenticated
  using (exists (select 1 from public.perfiles p where p.user_id = auth.uid() and (p.tipo = 'interno' or coalesce(p.es_super_admin, false))))
  with check (exists (select 1 from public.perfiles p where p.user_id = auth.uid() and (p.tipo = 'interno' or coalesce(p.es_super_admin, false))));
grant select, insert, update, delete on public.forecast_crm_existente to authenticated;
