-- Administración V3 · Sistema → "Retención de auditoría".
-- purgar_auditoria(dias) sólo tiene EXECUTE para postgres/service_role. Este wrapper la expone
-- al super admin desde el dashboard (supabase.rpc) verificando es_super_admin_check().
-- Mínimo 30 días para evitar un borrado accidental de auditoría reciente.
create or replace function public.purgar_auditoria_admin(dias integer default 365)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not public.es_super_admin_check() then
    raise exception 'Solo el super admin puede purgar la auditoría' using errcode = '42501';
  end if;
  select public.purgar_auditoria(greatest(coalesce(dias, 365), 30)) into n;
  return n;
end;
$$;

revoke all on function public.purgar_auditoria_admin(integer) from public;
grant execute on function public.purgar_auditoria_admin(integer) to authenticated;
-- Supabase vuelve a conceder EXECUTE a anon por defecto: se retira explícitamente.
revoke execute on function public.purgar_auditoria_admin(integer) from anon;
