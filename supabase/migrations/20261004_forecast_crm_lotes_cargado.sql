-- 2026-10-04 · Forecast CRM: cuándo se cargó cada lote en el CRM (botón «Ya lo cargué en el CRM» en Proyectos y forecast).
-- Al marcarlo, las filas del lote se copian a forecast_crm_existente (la copia del CRM) para que el sugerido no las repita.
alter table public.forecast_crm_lotes add column if not exists cargado_crm_at timestamptz;
alter table public.forecast_crm_existente add column if not exists origen text default 'crm';
create unique index if not exists forecast_crm_existente_uk on public.forecast_crm_existente (cliente_codigo, sku, mes);
