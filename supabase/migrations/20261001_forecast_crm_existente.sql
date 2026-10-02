-- Lo que YA está capturado en el CRM (crm-acteck.vercel.app · otra base de Supabase), copiado de la pantalla de
-- Forecast el 2026-10-01 para que el sugerido del dashboard no proponga SKUs que ya tienen forecast (Fernando:
-- «varios de esos forecast son proyectos que no he podido cargar contigo: no quiero que se duplique»).
-- Una fila por cliente (código ERP), SKU y mes. Se vuelve a cargar leyendo el CRM; no la escribe la app.
create table if not exists public.forecast_crm_existente (
  cliente_codigo text not null, cliente_nombre text, kam text, sku text not null, mes date not null,
  piezas int not null default 0, justificacion text, estado text, capturado_at timestamptz not null default now(),
  primary key (cliente_codigo, sku, mes));
alter table public.forecast_crm_existente enable row level security;
create policy forecast_crm_existente_lectura on public.forecast_crm_existente for select to authenticated using (true);
grant select on public.forecast_crm_existente to authenticated, service_role;
