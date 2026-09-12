-- 2026-09-12 · PCEL: una sola valuación y el mes real.
--
-- Decisión C de Fernando:
--   · PCEL nunca manda pesos. La valuación OFICIAL es piezas × precio de lista
--     "PCEL PROVISIONAL" (respaldo "Mayoreo AAA", y como último recurso el costo
--     promedio del mapa). Antes había cinco valuaciones distintas para el mismo mes
--     (costo promedio, otro costo, precio de lista, 0 forzado y otra en Visión General).
--   · El mes de una semana es el MES ISO (el del jueves de esa semana), no
--     (semana − 1) / 4 + 1, que desplazaba el calendario ~1 semana por trimestre
--     (abril −53 %, septiembre +413 %).
--   · `v_sellout_pcel_sku_mes` pasa a LEFT JOIN con `pcel_sku_map`: los SKUs sin
--     mapeo dejan de desaparecer (3–8 % de las piezas) y se marcan `mapeado = false`.

-- ── Precio de lista de PCEL por SKU Acteck ─────────────────────────────────
create or replace view v_precio_pcel_sku as
select s.sku,
       coalesce(pp.precio, ma.precio)                       as precio,
       case when pp.precio is not null then 'PCEL PROVISIONAL'
            when ma.precio is not null then 'Mayoreo AAA' end as lista
from (select distinct sku from precios_sku) s
left join lateral (
  select p.precio from precios_sku p
  where p.sku = s.sku and p.lista = 'PCEL PROVISIONAL'
  order by p.anio desc, p.mes desc limit 1
) pp on true
left join lateral (
  select p.precio from precios_sku p
  where p.sku = s.sku and p.lista = 'Mayoreo AAA'
  order by p.anio desc, p.mes desc limit 1
) ma on true;

comment on view v_precio_pcel_sku is
  'Valuación oficial de PCEL: precio de lista PCEL PROVISIONAL, con respaldo Mayoreo AAA. Única fuente de precio para todo el sell-out de PCEL.';

-- ── Sell out mensual de PCEL por SKU (piezas oficiales del archivo) ─────────
-- Cambian las columnas (se agregan `mapeado` y `sku_pcel`), así que hay que recrear.
drop view if exists v_sellout_pcel_marca_mes;
drop view if exists v_sellout_pcel_mensual;
drop view if exists v_sellout_pcel_sku_mes;

create view v_sellout_pcel_sku_mes as
select coalesce(psm.sku_acteck, m.sku)          as sku,
       (psm.sku_acteck is not null)             as mapeado,
       m.sku                                    as sku_pcel,
       m.anio, m.mes,
       sum(m.piezas)                            as piezas,
       sum(m.piezas * coalesce(pl.precio, psm.costo_promedio, 0)) as monto,   -- estimado a lista
       max(coalesce(pl.precio, psm.costo_promedio)) as precio_prom
from sellout_pcel_mensual m
left join pcel_sku_map psm on psm.sku_pcel = m.sku
left join v_precio_pcel_sku pl on pl.sku = psm.sku_acteck
group by coalesce(psm.sku_acteck, m.sku), (psm.sku_acteck is not null), m.sku, m.anio, m.mes;

create view v_sellout_pcel_mensual as
select anio, mes,
       sum(piezas) as piezas,
       sum(monto)  as monto,
       0 as tx,
       (count(distinct sku) filter (where piezas > 0))::integer as skus_distintos,
       0 as marcas_distintas,
       0 as clientes_distintos,
       0 as facturas,
       (count(distinct sku) filter (where not mapeado and piezas > 0))::integer as skus_sin_mapear,
       coalesce(sum(piezas) filter (where not mapeado), 0) as piezas_sin_mapear
from v_sellout_pcel_sku_mes
group by anio, mes;

-- Sell out de PCEL por marca (sólo los SKUs con roadmap; los sin mapear no tienen marca).
create view v_sellout_pcel_marca_mes as
select upper(trim(r.marca)) as marca, s.anio, s.mes,
       sum(s.piezas) as piezas,
       sum(s.monto)  as monto,
       0 as tx,
       (count(distinct s.sku) filter (where s.piezas > 0))::integer as skus_distintos
from v_sellout_pcel_sku_mes s
join roadmap_sku r on r.sku = s.sku
where r.marca is not null
group by upper(trim(r.marca)), s.anio, s.mes;

-- SKUs de PCEL que todavía no tienen mapeo a SKU Acteck (aviso en pantalla).
create or replace view v_sellout_pcel_sin_mapear as
select m.sku as sku_pcel,
       max(c.producto) as producto,
       max(c.marca)    as marca,
       sum(m.piezas)   as piezas_12m,
       max(m.anio * 100 + m.mes) as ultimo_periodo
from sellout_pcel_mensual m
left join pcel_sku_map psm on psm.sku_pcel = m.sku
left join catalogo_sku_pcel c on c.sku = m.sku
where psm.sku_pcel is null
  and make_date(m.anio, m.mes, 1) >= (date_trunc('month', current_date) - interval '12 months')
group by m.sku;

-- ── Sell out unificado ─────────────────────────────────────────────────────
-- Cambios: Dicotech sólo por la rama "distribuidor"; `sellout_detalle` sin IVA;
-- PCEL por mes ISO de la semana y valuado con la lista oficial.
create or replace view v_sellout_unificado as
select 'mayoreo'::text as canal_sellout,
       g.mayorista      as fuente,
       g.cliente_nombre as cliente_final,
       g.fecha, g.anio, g.mes, g.sku, g.importe, g.cantidad
from sellout_general g
where g.anio = any (array[2025, 2026])
  and g.importe is not null
  and g.mayorista <> 'DICOTECH'     -- Dicotech entra por sellout_detalle (carga manual)

union all

select 'distribuidor'::text as canal_sellout,
       upper(d.cliente) as fuente,
       d.cliente        as cliente_final,
       d.fecha,
       (extract(year from d.fecha))::integer  as anio,
       (extract(month from d.fecha))::integer as mes,
       d.no_parte as sku,
       (coalesce(d.subtotal, d.total, 0) - coalesce(d.descuento, 0)) as importe,   -- SIN IVA
       d.cantidad
from sellout_detalle d
where d.fecha is not null
  and coalesce(d.subtotal, d.total) is not null

union all

select 'distribuidor'::text as canal_sellout,
       'PCEL'::text as fuente,
       'PCEL'::text as cliente_final,
       -- jueves de la semana ISO → el mes al que pertenece realmente esa semana
       (date_trunc('week', make_date(sp.anio, 1, 4))::date + (sp.semana - 1) * 7 + 3) as fecha,
       (extract(year  from (date_trunc('week', make_date(sp.anio, 1, 4))::date + (sp.semana - 1) * 7 + 3)))::integer as anio,
       (extract(month from (date_trunc('week', make_date(sp.anio, 1, 4))::date + (sp.semana - 1) * 7 + 3)))::integer as mes,
       coalesce(nullif(upper(trim(sp.modelo)), ''), psm.sku_acteck, sp.sku) as sku,
       (sp.vta_semana)::numeric * coalesce(pl.precio, psm.costo_promedio, sp.costo_promedio, 0) as importe,
       sp.vta_semana as cantidad
from sellout_pcel sp
left join pcel_sku_map psm on psm.sku_pcel = sp.sku
-- OJO: sellout_pcel.sku es el código numérico de PCEL; el SKU Acteck va en `modelo`.
left join v_precio_pcel_sku pl on pl.sku = coalesce(nullif(upper(trim(sp.modelo)), ''), psm.sku_acteck)
where sp.anio = any (array[2025, 2026])
  and sp.vta_semana is not null and sp.vta_semana > 0

union all

select 'directo'::text as canal_sellout,
       case
         when fc.cliente_nombre ilike '%MERCADO LIBRE%' then 'MERCADO LIBRE'
         when fc.cliente_nombre ilike '%AMAZON%'        then 'AMAZON'
         when fc.cliente_nombre ilike '%CYBERPU%'       then 'CYBERPUERTA'
         when fc.cliente_nombre ilike '%SITIO WEB%'     then 'SITIO WEB'
         when fc.canal = 'MOSTRADOR'                    then 'MOSTRADOR'
         else fc.canal
       end as fuente,
       fc.cliente_nombre as cliente_final,
       make_date(fc.anio, fc.mes, 15) as fecha,
       fc.anio, fc.mes, fc.sku, fc.monto as importe, fc.piezas as cantidad
from facturacion_clientes fc
where fc.canal = any (array['MOSTRADOR', 'E-COMMERCE'])
  and fc.anio = any (array[2025, 2026]);

refresh materialized view mv_sellout_unificado;
