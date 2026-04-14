-- =====================================================
-- Migration: Arquitectura de subidas (6 tipos + sync)
-- =====================================================

-- 1) Tabla de bitácora de sincronización (badge "última actualización")
create table if not exists public.sync_status (
  id bigserial primary key,
  fuente text not null unique,            -- 'erp_sell_in','erp_inventario','roadmap','precios','sellout_digitalife','sellout_pcel','inventario_digitalife','edc_digitalife','edc_pcel','transito'
  ultima_actualizacion timestamptz not null default now(),
  registros integer,
  meta jsonb
);

alter table public.sync_status enable row level security;
drop policy if exists sync_status_read on public.sync_status;
create policy sync_status_read on public.sync_status for select using (true);
drop policy if exists sync_status_write on public.sync_status;
create policy sync_status_write on public.sync_status for all using (true) with check (true);

-- 2) Estados de cuenta (header por cliente+semana)
create table if not exists public.estados_cuenta (
  id bigserial primary key,
  cliente text not null,                  -- 'digitalife' | 'pcel'
  anio int not null,
  semana int not null,                    -- semana ISO
  fecha_corte date,
  saldo_actual numeric,
  saldo_vencido numeric,
  notas_credito numeric,
  saldo_a_vencer numeric,
  razon_social text,
  updated_at timestamptz not null default now(),
  unique (cliente, anio, semana)
);

alter table public.estados_cuenta enable row level security;
drop policy if exists edc_all on public.estados_cuenta;
create policy edc_all on public.estados_cuenta for all using (true) with check (true);

-- 3) Detalle de facturas del EdC
create table if not exists public.estados_cuenta_detalle (
  id bigserial primary key,
  estado_cuenta_id bigint not null references public.estados_cuenta(id) on delete cascade,
  movimiento text,
  condicion text,
  referencia text,
  fecha_emision date,
  vencimiento date,
  importe_factura numeric,
  dias_moratorios int,
  saldo_actual numeric,
  aging_corriente numeric,
  aging_01_30 numeric,
  aging_31_60 numeric,
  aging_61_90 numeric,
  aging_91_180 numeric,
  aging_181_mas numeric
);

create index if not exists edc_detalle_ec_idx on public.estados_cuenta_detalle(estado_cuenta_id);

alter table public.estados_cuenta_detalle enable row level security;
drop policy if exists edc_detalle_all on public.estados_cuenta_detalle;
create policy edc_detalle_all on public.estados_cuenta_detalle for all using (true) with check (true);

-- 4) Sellout PCEL (formato propio: semana ISO embebida en columna)
create table if not exists public.sellout_pcel (
  id bigserial primary key,
  anio int not null,
  semana int not null,
  sku text not null,                      -- mapeado desde columna "Modelo"
  pcel_sku text,                          -- código interno PCEL (columna "Sku")
  marca text,
  producto text,
  familia text,
  subfamilia text,
  inventario int,
  costo_promedio numeric,
  antiguedad int,
  transito int,
  back_order int,
  vta_semana int,                         -- unidades vendidas en la semana
  vta_mes_actual int,                     -- Vta Abr/Mar/... (mes corriente)
  vta_mes_1 int,                          -- mes anterior
  vta_mes_2 int,                          -- mes anterior -2
  vta_mes_3 int,                          -- mes anterior -3
  updated_at timestamptz not null default now(),
  unique (anio, semana, sku, marca)
);

create index if not exists sellout_pcel_sku_idx on public.sellout_pcel(sku);
create index if not exists sellout_pcel_semana_idx on public.sellout_pcel(anio, semana);

alter table public.sellout_pcel enable row level security;
drop policy if exists sellout_pcel_all on public.sellout_pcel;
create policy sellout_pcel_all on public.sellout_pcel for all using (true) with check (true);

-- 5) Asegurar updated_at en tablas existentes (idempotente)
alter table if exists public.roadmap_sku add column if not exists updated_at timestamptz default now();
alter table if exists public.precios_sku add column if not exists updated_at timestamptz default now();
alter table if exists public.transito_sku add column if not exists updated_at timestamptz default now();
alter table if exists public.inventario_cliente add column if not exists updated_at timestamptz default now();
alter table if exists public.sellout_sku add column if not exists updated_at timestamptz default now();
alter table if exists public.sell_in_sku add column if not exists updated_at timestamptz default now();

-- 6) Semillas iniciales del sync_status (si no existen)
insert into public.sync_status (fuente, registros) values
  ('erp_sell_in', 0),
  ('erp_inventario', 0),
  ('roadmap', 0),
  ('precios', 0),
  ('sellout_digitalife', 0),
  ('sellout_pcel', 0),
  ('inventario_digitalife', 0),
  ('edc_digitalife', 0),
  ('edc_pcel', 0),
  ('transito', 0)
on conflict (fuente) do nothing;
