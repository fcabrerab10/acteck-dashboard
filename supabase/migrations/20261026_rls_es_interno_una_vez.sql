-- 2026-10-26 · Rendimiento de la seguridad de externos (3.91.0): las políticas escribían `es_interno()` a secas y Postgres la
-- evaluaba FILA POR FILA (sellout_general 2026: 6.4 s; erp_ventas por cliente: > 8 s → timeout; la pestaña Sell Out de Dicotech
-- no cargaba). Envuelta como `(select public.es_interno())` se evalúa una sola vez por consulta (0.5 s). Misma semántica.
-- También `puede_ver_cliente_pestana('x','y')` con argumentos constantes. Las vistas con `where es_interno()` se reescriben igual.
do $$
declare p record; nuevo_qual text; nuevo_check text; sql text;
begin
  for p in select schemaname, tablename, policyname, qual, with_check from pg_policies where schemaname = 'public'
           and (coalesce(qual, '') ~* '(?<!select\s)(public\.)?es_interno\(\)' or coalesce(with_check, '') ~* '(?<!select\s)(public\.)?es_interno\(\)'
                or coalesce(qual, '') ~* '(?<!select\s)(public\.)?puede_ver_cliente_pestana\(''' or coalesce(with_check, '') ~* '(?<!select\s)(public\.)?puede_ver_cliente_pestana\(''')
  loop
    nuevo_qual := p.qual; nuevo_check := p.with_check;
    if nuevo_qual is not null then
      nuevo_qual := regexp_replace(nuevo_qual, '(?<!select\s)(public\.)?es_interno\(\)', '(select public.es_interno())', 'gi');
      nuevo_qual := regexp_replace(nuevo_qual, '(?<!select\s)(public\.)?puede_ver_cliente_pestana\(([^()]*)\)', '(select public.puede_ver_cliente_pestana(\2))', 'gi');
    end if;
    if nuevo_check is not null then
      nuevo_check := regexp_replace(nuevo_check, '(?<!select\s)(public\.)?es_interno\(\)', '(select public.es_interno())', 'gi');
      nuevo_check := regexp_replace(nuevo_check, '(?<!select\s)(public\.)?puede_ver_cliente_pestana\(([^()]*)\)', '(select public.puede_ver_cliente_pestana(\2))', 'gi');
    end if;
    sql := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if nuevo_qual is not null then sql := sql || format(' using (%s)', nuevo_qual); end if;
    if nuevo_check is not null then sql := sql || format(' with check (%s)', nuevo_check); end if;
    execute sql;
  end loop;
end $$;

-- Segunda parte: en las tablas que ya tienen una política «sólo internos» (qual = (select es_interno())), las demás políticas
-- por cliente (puede_ver_cliente_pestana(cliente_key…), user_can_see_cliente(…)) se evaluaban fila por fila ANTES que la de
-- internos (Postgres arma un OR en el orden de las políticas y el InitPlan quedaba al final: erp_ventas por cliente > 10 s).
-- Se les antepone `(select public.es_interno()) or` para que corten en seco. El conjunto de filas visibles no cambia: esas
-- tablas ya daban todo a los internos por la otra política.
do $$
declare p record; sql text;
begin
  for p in
    select o.schemaname, o.tablename, o.policyname, o.qual, o.with_check
    from pg_policies o
    where o.schemaname = 'public' and o.cmd in ('SELECT', 'ALL')
      and exists (select 1 from pg_policies i where i.schemaname = o.schemaname and i.tablename = o.tablename and i.cmd in ('SELECT', 'ALL')
                  and i.permissive = 'PERMISSIVE' and regexp_replace(i.qual, '\s', '', 'g') ilike '(selectes_interno()ases_interno)')
      and o.qual is not null and regexp_replace(o.qual, '\s', '', 'g') not ilike '(selectes_interno()ases_interno)%'
      and o.qual !~* 'select (public\.)?es_interno\(\)'
  loop
    sql := format('alter policy %I on %I.%I using ((select public.es_interno()) or (%s))', p.policyname, p.schemaname, p.tablename, p.qual);
    if p.with_check is not null then sql := sql || format(' with check (%s)', p.with_check); end if;
    execute sql;
  end loop;
end $$;

-- erp_ventas no tenía índice por cliente: la ficha de precio/costo y el ritmo por cliente lo recorren por anio.
create index if not exists erp_ventas_cliente_anio_idx on public.erp_ventas (cliente, anio);
