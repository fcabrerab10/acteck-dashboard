-- Compras en camino · POs colocadas al proveedor que siguen pendientes (2026-09-12)
-- ─────────────────────────────────────────────────────────────────────────────
-- `compras_oc` es el pendiente VIVO del ERP (Vw_TablaH_Compras, una fila por OC × artículo,
-- se reemplaza completa en cada carga): son las órdenes de compra COLOCADAS al proveedor.
-- `embarques_compras` (Master Embarques) es lo que YA EMBARCÓ el proveedor, y de ahí sale
-- `v_transito_sku` que el S&OP usa como "tránsito". Las dos no son lo mismo:
--
--   compras_oc          = PO puesta      → puede estar en producción, sin contenedor, sin ETA.
--   embarques_compras   = PO embarcada   → tiene contenedor, ETD, ETA a puerto y arribo a CEDIS.
--
-- Al 2026-09-12: 429 renglones · 113 POs · 39 proveedores · 585,491 pz pendientes ≈ 9.59 M USD.
-- 101 de las 113 POs también existen en el master de embarques; 128 SKUs con PO pendiente NO
-- aparecen en `v_transito_sku` (≈ 35 K pz): eso es justo lo que el planeador no veía en ninguna
-- pantalla. Estas dos vistas lo abren en S&OP (escritorio y móvil).
--
-- Nota: la única clave común entre las dos fuentes es el número de PO
-- (compras_oc.movid ↔ embarques_compras.po) + el SKU (articulo ↔ codigo).

-- @@
create or replace view public.v_compras_pendientes_sku as
with pend as (
  select
    trim(c.articulo)                                   as sku,
    nullif(trim(c.movid), '')                          as po,
    coalesce(nullif(trim(c.proveedor), ''), 'SIN PROVEEDOR') as proveedor,
    nullif(trim(c.prov_id), '')                        as prov_id,
    nullif(trim(c.descripcion), '')                    as descripcion,
    nullif(trim(c.fabricante), '')                     as marca,
    nullif(trim(c.estatus), '')                        as estatus,
    c.fecha_emision                                    as fecha_po,
    coalesce(c.cantidad_orden, 0)::numeric             as piezas_pedidas,
    coalesce(c.cantidad_pendiente, 0)::numeric         as piezas_pendientes,
    coalesce(c.costo_usd, 0)::numeric                  as costo_usd
  from public.compras_oc c
  where coalesce(c.cantidad_pendiente, 0) > 0
    and nullif(trim(c.articulo), '') is not null
),
-- Lo que de esa misma PO + SKU ya está en el Master Embarques y sigue navegando.
emb as (
  select
    e.po,
    trim(e.codigo)        as codigo,
    min(e.arribo_cedis)   as eta,
    sum(coalesce(e.shp_qty, e.po_qty, 0))::numeric as piezas_embarcadas
  from public.embarques_compras e
  where e.codigo is not null and e.po is not null
    and coalesce(e.estatus, '') not ilike '%CANCEL%'
    and coalesce(e.estatus, '') not ilike '%RECHAZ%'
    and coalesce(e.estatus, '') not ilike '%PERDID%'
  group by e.po, trim(e.codigo)
),
-- ¿El SKU está en tránsito hoy (cualquier PO)? Es el criterio que usa el S&OP.
tra as (
  select t.sku, sum(coalesce(t.cantidad, 0))::numeric as pz_transito
  from public.v_transito_sku t
  group by t.sku
)
select
  p.sku,
  p.descripcion,
  p.marca,
  p.proveedor,
  p.prov_id,
  p.po,
  p.fecha_po,
  p.estatus,
  round(p.piezas_pedidas)::bigint                          as piezas_pedidas,
  round(greatest(p.piezas_pedidas - p.piezas_pendientes, 0))::bigint as piezas_recibidas,
  round(p.piezas_pendientes)::bigint                       as piezas_pendientes,
  round(p.piezas_pendientes * p.costo_usd, 2)              as usd_pendiente,
  p.costo_usd,
  e.eta,
  round(coalesce(e.piezas_embarcadas, 0))::bigint          as piezas_embarcadas,
  (e.codigo is not null)                                   as en_master_embarques,
  (coalesce(t.pz_transito, 0) > 0)                         as sku_en_transito,
  (current_date - p.fecha_po)::int                         as dias_desde_po
from pend p
left join emb e on e.po = p.po and e.codigo = p.sku
left join tra t on t.sku = p.sku;

-- @@
comment on view public.v_compras_pendientes_sku is
  'Compras en camino por SKU: renglones de compras_oc con cantidad_pendiente > 0 (POs colocadas al proveedor), enriquecidos con la ETA del Master Embarques cuando esa PO+SKU ya embarcó y con la bandera sku_en_transito (v_transito_sku). PO colocada ≠ PO embarcada.';

-- @@
create or replace view public.v_compras_pendientes_proveedor as
select
  proveedor,
  min(prov_id)                          as prov_id,
  count(distinct po)::int               as pos,
  count(*)::int                         as renglones,
  count(distinct sku)::int              as skus,
  sum(piezas_pendientes)::bigint        as piezas_pendientes,
  round(sum(usd_pendiente), 2)          as usd_pendiente,
  min(fecha_po)                         as po_mas_antigua,
  max(fecha_po)                         as po_mas_reciente,
  max(dias_desde_po)                    as dias_po_mas_antigua,
  min(eta) filter (where eta is not null) as eta_mas_cercana,
  count(*) filter (where not en_master_embarques)::int as renglones_sin_embarque
from public.v_compras_pendientes_sku
group by proveedor;

-- @@
comment on view public.v_compras_pendientes_proveedor is
  'Compras en camino agregadas por proveedor (piezas y USD pendientes, POs, PO más antigua). Fuente: v_compras_pendientes_sku.';

-- @@
grant select on public.v_compras_pendientes_sku, public.v_compras_pendientes_proveedor
  to anon, authenticated, service_role;

-- @@
notify pgrst, 'reload schema';
