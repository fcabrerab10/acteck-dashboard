-- Tabla spiffs: incentivos por SKU con vigencia definida por el usuario.
-- Formato del Excel: Articulo · Descripcion · Situación · Valor Spiff x Unidad MXN · Spiff Total · Inv Total · Transito
-- El upload reemplaza toda la tabla (replace strategy).

create table if not exists public.spiffs (
  id                bigserial primary key,
  sku               text not null,
  descripcion       text,
  monto             numeric not null,
  vigencia_inicio   date not null,
  vigencia_fin      date not null,
  situacion         text,        -- valor tal cual del Excel ("Spiff" siempre por ahora)
  fuente            text,        -- nombre del archivo que se subió
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint spiffs_sku_key unique (sku)
);

create index if not exists spiffs_sku_idx        on public.spiffs (sku);
create index if not exists spiffs_vigencia_idx   on public.spiffs (vigencia_fin desc);

alter table public.spiffs enable row level security;
create policy "spiffs_read_all"  on public.spiffs for select using (true);
-- Writes solo desde service_role (endpoint import-central)
