-- Tabla propuestas_borradores: reemplaza el localStorage 'propuestas_recientes_v1'.
-- Cada usuario mantiene su cache local para render instantáneo, pero la fuente
-- de verdad es Supabase para que los borradores sobrevivan a limpieza de storage,
-- cambio de navegador, o clear-site-data.

create table if not exists public.propuestas_borradores (
  id                  text primary key,          -- 'prp_...' compatible con el schema existente
  cliente_key         text not null,
  cliente_label       text,
  nombre              text,
  estado              text default 'Borrador',   -- 'Borrador' | 'Exportada' | 'Enviada'
  tstamp              bigint not null,           -- timestamp en ms (compatible con Date.now())
  propuesta           jsonb not null default '{}'::jsonb,   -- { sku: {piezas, precio, listaSel} }
  resumen             jsonb default '{}'::jsonb,             -- { skus, piezas, total }
  excel_final         jsonb,                                 -- { name, size, dataUrl, tstamp } o null
  exported_filename   text,
  origen              text,
  ultima_importacion  jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists propuestas_borradores_tstamp_idx  on public.propuestas_borradores (tstamp desc);
create index if not exists propuestas_borradores_cliente_idx on public.propuestas_borradores (cliente_key);

alter table public.propuestas_borradores enable row level security;

-- Los borradores son compartidos por el equipo comercial (Fernando + Karolina).
-- Cualquier usuario autenticado puede leer, crear, actualizar y borrar.
create policy "borradores_read_authenticated"   on public.propuestas_borradores for select using (auth.role() = 'authenticated');
create policy "borradores_insert_authenticated" on public.propuestas_borradores for insert with check (auth.role() = 'authenticated');
create policy "borradores_update_authenticated" on public.propuestas_borradores for update using (auth.role() = 'authenticated');
create policy "borradores_delete_authenticated" on public.propuestas_borradores for delete using (auth.role() = 'authenticated');
