-- Acteck PCs (2026-11-11) · proyecto de computadoras de escritorio ensambladas.
-- Canal inverso: a GRUPO DECME (cliente 00714) le vendemos gabinete, fuente y enfriamiento de nuestras marcas;
-- DECME pone el resto y la licencia, ensambla, y nosotros vendemos el equipo con SKU propio (AC-8175xx…) a mayoristas.
-- Internamente se emite una OC a DECME por cada pedido. Las ventas reales salen de erp_ventas por SKU.
-- Todo es sólo para internos (costos incluidos); la app decide quién ve margen con puedeVerSensible.

create table if not exists public.pcs_modelos (
  sku text primary key,
  nombre text,
  licencia text,
  upc text,
  procesador text,
  memoria text,
  almacenamiento text,
  notas text,
  activo boolean not null default true,
  orden int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Lista de componentes de cada modelo. `sku_propio` = clave Acteck/Balam Rush cuando el componente es nuestro.
create table if not exists public.pcs_componentes (
  id uuid primary key default gen_random_uuid(),
  sku_modelo text not null references public.pcs_modelos(sku) on delete cascade,
  tipo text not null default 'otro',
  descripcion text not null,
  sku_propio text,
  cantidad numeric not null default 1,
  orden int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists pcs_componentes_modelo on public.pcs_componentes(sku_modelo);

-- Historial de costos: cada vez que DECME actualiza lo que cobra por equipo se agrega una fila.
-- `desglose` = [{ tipo, descripcion, costo }] para ver cómo se mueve cada componente.
create table if not exists public.pcs_costos (
  id uuid primary key default gen_random_uuid(),
  sku_modelo text not null references public.pcs_modelos(sku) on delete cascade,
  vigente_desde date not null default current_date,
  costo numeric not null,
  desglose jsonb not null default '[]'::jsonb,
  nota text,
  creado_por uuid,
  created_at timestamptz not null default now()
);
create index if not exists pcs_costos_modelo on public.pcs_costos(sku_modelo, vigente_desde desc);

-- Pedido = OC interna a DECME para surtir a un cliente.
create table if not exists public.pcs_ordenes (
  id uuid primary key default gen_random_uuid(),
  folio text,
  fecha date not null default current_date,
  cliente text not null,
  cliente_erp text,
  oc_cliente text,
  estado text not null default 'recibida' check (estado in ('recibida','produccion','enviada','entregada','cancelada')),
  direct_order boolean not null default false,
  fecha_entrega date,
  guia text,
  factura_cliente text,
  factura_cliente_vence date,
  cobrado_at date,
  factura_decme text,
  factura_decme_monto numeric,
  factura_decme_vence date,
  pagado_decme_at date,
  notas text,
  creado_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pcs_orden_lineas (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references public.pcs_ordenes(id) on delete cascade,
  sku_modelo text not null references public.pcs_modelos(sku),
  equipos int not null check (equipos > 0),
  precio numeric,
  costo numeric,
  created_at timestamptz not null default now()
);
create index if not exists pcs_orden_lineas_orden on public.pcs_orden_lineas(orden_id);

do $$
declare t text;
begin
  foreach t in array array['pcs_modelos','pcs_componentes','pcs_costos','pcs_ordenes','pcs_orden_lineas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_internos', t);
    execute format('create policy %I on public.%I for all to authenticated using ((select public.es_interno())) with check ((select public.es_interno()))', t || '_internos', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop trigger if exists trg_auditoria on public.%I', t);
    execute format('create trigger trg_auditoria after insert or update or delete on public.%I for each row execute function public.fn_auditoria()', t);
  end loop;
end $$;

-- Ventas reales de las PCs (facturas, devoluciones) tal como vienen del ERP. Sólo internos.
create or replace view public.v_pcs_ventas as
select v.articulo as sku, v.cliente, v.cliente_nombre, make_date(v.anio, v.mes, v.dia) as fecha, v.folio, v.referencia,
       v.movimiento_venta, coalesce(v.unidades, v.piezas, 0) as piezas,
       v.monto_venta_pesos as monto, v.costo_venta_pesos as costo
from public.erp_ventas v
where v.articulo in (select sku from public.pcs_modelos)
  and (select public.es_interno());
grant select on public.v_pcs_ventas to authenticated;

insert into public.pcs_modelos (sku, nombre, licencia, upc, orden) values
  ('AC-817584','Computadora Escritorio ACTECK','Windows Home','718852817584',1),
  ('AC-817591','Computadora Escritorio ACTECK','Windows Home','718852817591',2),
  ('AC-817607','Computadora Escritorio ACTECK','Windows Home','718852817607',3),
  ('AC-817614','Computadora Escritorio ACTECK','Windows Home','718852817614',4),
  ('AC-817621','Computadora Escritorio ACTECK','Windows Home','718852817621',5),
  ('AC-817652','Computadora Escritorio ACTECK','Windows Pro','718852817652',6),
  ('AC-817669','Computadora Escritorio ACTECK','Windows Pro','718852817669',7),
  ('AC-817676','Computadora Escritorio ACTECK','Windows Pro','718852817676',8),
  ('AC-817683','Computadora Escritorio ACTECK','Windows Pro','718852817683',9),
  ('AC-817690','Computadora Escritorio ACTECK','Windows Pro','718852817690',10)
on conflict (sku) do nothing;
