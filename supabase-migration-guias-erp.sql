-- Tabla guias_erp: dump del reporte "Consulta de Guias por Factura" del ERP.
-- Alimenta el auto-relleno de Tracking Pedidos (oc_envios) haciendo match por
-- (mov, movid) ↔ (tipo_movimiento, numero_factura) o similar.

create table if not exists public.guias_erp (
  id              bigserial primary key,
  origen          text,
  origen_id       text,
  estatus         text,
  fecha_emision   timestamptz,
  agente          text,
  nombre_agente   text,
  almacen_envio   text,
  grupo_envio     text,
  cliente_codigo  text,
  cliente_nombre  text,
  sector          text,
  destino         int,
  estado          text,
  destino_estado  text,
  orden_compra    text,
  referencia      text,
  envio           text,
  envio_id        text,
  mov             text not null,
  movid           text not null,
  envio_estatus   text,
  envio_fecha     timestamptz,
  forma_envio     text,
  fecha_envio     timestamptz,
  persona_recibio text,
  fecha_recepcion timestamptz,
  guias           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint guias_erp_mov_movid_key unique (mov, movid)
);

-- Índices para los joins que hará Tracking Pedidos
create index if not exists guias_erp_movid_idx        on public.guias_erp (movid);
create index if not exists guias_erp_cliente_idx      on public.guias_erp (cliente_nombre);
create index if not exists guias_erp_orden_compra_idx on public.guias_erp (orden_compra);
create index if not exists guias_erp_fecha_emision_idx on public.guias_erp (fecha_emision desc);

-- RLS
alter table public.guias_erp enable row level security;
create policy "guias_erp_read_all" on public.guias_erp for select using (true);
-- Writes solo por service_role (importer)
