-- 2026-09-12 · Dos cosas que ya venían en erp_ventas (puente, cada hora) y el dashboard
-- no mostraba en ningún lado:
--
--   1. APOYO COMERCIAL por concepto. Los renglones con rama = 'SERVICIOS' son las
--      bonificaciones/notas: `articulo` es el código del concepto (BPRM-101 promoción
--      general de temporada, BVND-201 rebate/fondo de sell out, BVND-202 apoyo de
--      marketing, BINC-901 protección de precios…), `descripcion` es su nombre y
--      `monto_venta_pesos` viene en NEGATIVO. 2026 ≈ −$34.4 M y nunca se veía el desglose.
--      → v_bonificaciones_concepto_mes
--
--   2. EQUIPO COMERCIAL. `erp_ventas.vendedor` está lleno al 100 % (25 vendedores) y no
--      había ni una vista por vendedor.
--      → v_medidas_ventas_vendedor_mes  (mismas columnas y fórmulas que
--        v_medidas_ventas_cliente_mes, sin cuota: no hay cuota por vendedor)
--      → v_ventas_vendedor_cliente_mes  (para el drill: top clientes de un vendedor)
--
-- Convención de signo: `monto` se deja tal cual sale del ERP (negativo). Las pantallas
-- pintan el valor absoluto con la etiqueta "apoyo". Así la suma de la vista cuadra con
-- la medida [Bonificaciones] del director sin tener que invertirla.
--
-- REGLA DE ORO (src/lib/medidas.js): los % de estas vistas son válidos FILA A FILA.
-- Al agregar varios meses o vendedores hay que recalcularlos con derivadas().

-- ── 1. Apoyo comercial por concepto ───────────────────────────────────────
-- Materializada (2,166 filas): como vista viva, una consulta SIN filtro de año y CON limit
-- le hacía elegir al planner el índice de cliente_nombre y se iba a 0.3-3 s (el rol anon
-- corta a los 3 s). Materializada siempre es un seq scan de 2 K filas.
drop view if exists public.v_bonificaciones_concepto_mes;
drop materialized view if exists public.mv_bonificaciones_concepto_mes;
create materialized view public.mv_bonificaciones_concepto_mes as
select e.anio,
       e.mes,
       e.cliente_key,
       e.cliente,
       e.cliente_nombre,
       e.canal,
       e.articulo                              as concepto_codigo,
       max(e.descripcion)                      as concepto,
       sum(coalesce(e.monto_venta_pesos, 0))   as monto,
       count(*)::int                           as renglones
  from public.erp_ventas e
 where e.rama = 'SERVICIOS'
   and e.anio is not null
   and e.mes is not null
 group by e.anio, e.mes, e.cliente_key, e.cliente, e.cliente_nombre, e.canal, e.articulo;
-- Sin índice único a propósito: `cliente`/`canal` pueden venir NULL del ERP y el refresco
-- CONCURRENTLY no los sabe comparar. Son 2 K filas: se refresca en bloque (≈ 60 ms).
create index mv_bonificaciones_concepto_mes_anio_idx on public.mv_bonificaciones_concepto_mes (anio);
grant select on public.mv_bonificaciones_concepto_mes to authenticated, anon, service_role;

create view public.v_bonificaciones_concepto_mes as
select * from public.mv_bonificaciones_concepto_mes;
grant select on public.v_bonificaciones_concepto_mes to authenticated, anon, service_role;

-- ── 2. Medidas del director por VENDEDOR y mes ────────────────────────────
-- Copia literal de las expresiones de v_medidas_ventas_cliente_mes / mv_erp_medidas_cliente_mes
-- (migraciones 20260909_facturacion_desde_erp.sql y 20260912_medidas_ventas.sql), cambiando
-- el grano cliente_key → vendedor y añadiendo `clientes` = count(distinct cliente).
-- Piezas con COALESCE(unidades, piezas, 0) (migración 20260911_piezas_coalesce_unidades.sql).
--
-- Va MATERIALIZADA: el `count(distinct cliente)` obliga a un GroupAggregate con sort de
-- las 177 K filas (medido: 3.7-4.7 s, y el rol anon corta a los 3 s). Materializada son
-- 424 filas y la vista de arriba resuelve en ms. Se refresca con las demás MVs de
-- erp_ventas dentro de refresh_facturacion_clientes() (ver el DO del final).
drop view if exists public.v_medidas_ventas_vendedor_mes;
drop materialized view if exists public.mv_medidas_ventas_vendedor_mes;
create materialized view public.mv_medidas_ventas_vendedor_mes as
with base as (
  select anio, mes, coalesce(nullif(btrim(vendedor), ''), 'SIN VENDEDOR') as vendedor,
    sum(case when movimiento_venta in ('Factura','Factura Com.Ext33') then coalesce(monto_venta_pesos,0) else 0 end)                                          as fact_bruta,
    sum(case when movimiento_venta = 'Devolucion Venta' and coalesce(instruccion,'') not ilike 'nota credito' then coalesce(monto_venta_pesos,0) else 0 end) as devoluciones,
    sum(case when movimiento_venta = 'Devolucion Venta' and instruccion ilike 'nota credito' then coalesce(monto_venta_pesos,0) else 0 end)                  as rmas,
    sum(case when movimiento_venta = 'Bonificacion Venta' then coalesce(monto_venta_pesos,0) else 0 end)                                                      as bonificaciones,
    sum(case when movimiento_venta = 'Factura' then coalesce(costo_venta_pesos,0) else 0 end)                                                                 as costo_fact_bruta,
    sum(case when movimiento_venta = 'Devolucion Venta' and coalesce(instruccion,'') not ilike 'nota credito' then coalesce(costo_venta_pesos,0) else 0 end) as costo_devoluciones,
    sum(case when movimiento_venta = 'Devolucion Venta' and instruccion ilike 'nota credito' then coalesce(costo_venta_pesos,0) else 0 end)                  as costo_rmas,
    sum(coalesce(unidades, piezas, 0))                                                                                                                       as piezas_venta_neta,
    count(distinct cliente)::int                                                                                                                             as clientes,
    count(*)::int                                                                                                                                            as renglones
  from public.erp_ventas
  where anio is not null and mes is not null
  group by anio, mes, coalesce(nullif(btrim(vendedor), ''), 'SIN VENDEDOR')
)
select b.*,
    (fact_bruta + devoluciones)                                                                             as fact_neta,
    (fact_bruta + devoluciones + rmas + bonificaciones)                                                     as venta_neta,
    (costo_fact_bruta + costo_devoluciones)                                                                 as costo_fact_neta,
    (costo_fact_bruta + costo_devoluciones + costo_rmas)                                                    as costo_venta_neta,
    (fact_bruta + devoluciones) - (costo_fact_bruta + costo_devoluciones)                                   as contribucion,
    (fact_bruta - costo_fact_bruta)                                                                         as contribucion_bruta,
    (fact_bruta + devoluciones + rmas + bonificaciones) - (costo_fact_bruta + costo_devoluciones + costo_rmas) as utilidad_comercial
  from base b;
create unique index mv_medidas_ventas_vendedor_mes_pk on public.mv_medidas_ventas_vendedor_mes (anio, mes, vendedor);
grant select on public.mv_medidas_ventas_vendedor_mes to authenticated, anon, service_role;

create view public.v_medidas_ventas_vendedor_mes as
select m.anio, m.mes, m.vendedor,
       m.fact_bruta, m.devoluciones, m.rmas, m.bonificaciones,
       m.fact_neta, m.venta_neta,
       m.costo_fact_bruta, m.costo_devoluciones, m.costo_rmas,
       m.costo_fact_neta, m.costo_venta_neta,
       m.contribucion, m.contribucion_bruta, m.utilidad_comercial,
       m.piezas_venta_neta, m.clientes, m.renglones,
       (m.devoluciones - m.costo_devoluciones) as perdida_devoluciones,
       (m.rmas - m.costo_rmas)                 as perdida_rmas,
       sum(m.costo_venta_neta) over (partition by m.vendedor order by m.anio, m.mes
                                     rows between 3 preceding and 1 preceding)  as cv_ultimos_3_meses,
       sum(m.costo_venta_neta) over (partition by m.vendedor, m.anio order by m.mes) as ytd_costo_venta,
       case when m.piezas_venta_neta <> 0 then m.venta_neta / m.piezas_venta_neta end         as ticket_promedio,
       case when m.piezas_venta_neta <> 0 then m.utilidad_comercial / m.piezas_venta_neta end as utilidad_promedio,
       case when m.fact_neta  <> 0 then m.contribucion / m.fact_neta end                      as pct_mc,
       case when m.fact_bruta <> 0 then m.contribucion_bruta / m.fact_bruta end               as pct_mc_bruta,
       case when m.venta_neta <> 0 then m.utilidad_comercial / m.venta_neta end               as pct_muc,
       case when m.fact_neta  <> 0 then m.bonificaciones / m.fact_neta end                    as pct_lost_profit_bonif,
       case when m.fact_bruta <> 0 then (m.devoluciones - m.costo_devoluciones) / m.fact_bruta end as pct_lost_profit_dev,
       case when m.fact_neta  <> 0 then (m.rmas - m.costo_rmas) / m.fact_neta end             as pct_lost_profit_rma
  from public.mv_medidas_ventas_vendedor_mes m;
grant select on public.v_medidas_ventas_vendedor_mes to authenticated, anon, service_role;

-- ── 3. Vendedor × cliente × mes (drill: top clientes del vendedor) ─────────
-- Sólo lo que el drill necesita (fact neta y piezas); se consulta SIEMPRE filtrada por
-- vendedor + año, así que el group by se reduce a unas decenas de filas.
-- También materializada (7,199 filas): con LIMIT el planner elegía un plan de arranque
-- rápido sobre erp_ventas y se pasaba de los 3 s del rol anon.
drop view if exists public.v_ventas_vendedor_cliente_mes;
drop materialized view if exists public.mv_ventas_vendedor_cliente_mes;
create materialized view public.mv_ventas_vendedor_cliente_mes as
select anio, mes,
       coalesce(nullif(btrim(vendedor), ''), 'SIN VENDEDOR') as vendedor,
       cliente_key, cliente, cliente_nombre,
       sum(case when movimiento_venta in ('Factura','Factura Com.Ext33') then coalesce(monto_venta_pesos,0)
                when movimiento_venta = 'Devolucion Venta' and coalesce(instruccion,'') not ilike 'nota credito' then coalesce(monto_venta_pesos,0)
                else 0 end)                    as fact_neta,
       sum(coalesce(unidades, piezas, 0))      as piezas,
       count(*)::int                           as renglones
  from public.erp_ventas
 where anio is not null and mes is not null
 group by anio, mes, coalesce(nullif(btrim(vendedor), ''), 'SIN VENDEDOR'), cliente_key, cliente, cliente_nombre;
create index mv_ventas_vendedor_cliente_mes_idx on public.mv_ventas_vendedor_cliente_mes (vendedor, anio);
grant select on public.mv_ventas_vendedor_cliente_mes to authenticated, anon, service_role;

create view public.v_ventas_vendedor_cliente_mes as
select * from public.mv_ventas_vendedor_cliente_mes;
grant select on public.v_ventas_vendedor_cliente_mes to authenticated, anon, service_role;

-- Índices de apoyo (el resto de las medidas ya usan erp_ventas_anio_mes_idx).
create index if not exists erp_ventas_rama_idx on public.erp_ventas(rama);
-- Expresión, no columna: el filtro del drill es sobre el COALESCE(...), y un índice sobre
-- `vendedor` a secas no lo puede usar.
create index if not exists erp_ventas_vendedor_anio_idx
  on public.erp_ventas ((coalesce(nullif(btrim(vendedor), ''), 'SIN VENDEDOR')), anio);
drop index if exists public.erp_ventas_vendedor_idx;

-- ── 4. Refresco: se engancha a refresh_facturacion_clientes() ─────────────
-- Esa función es el finalize de cada carga de erp_ventas (puente y api/import-central)
-- y ya refresca las otras 8 MVs. En vez de reescribirla entera (otras migraciones del
-- mismo día también la tocan), se le inserta la línea del REFRESH sobre su definición
-- viva. Idempotente: si ya la trae, no hace nada.
do $do$
declare def text; marca text; linea text;
begin
  foreach marca in array array['mv_medidas_ventas_vendedor_mes', 'mv_bonificaciones_concepto_mes', 'mv_ventas_vendedor_cliente_mes'] loop
    linea := case marca
      when 'mv_medidas_ventas_vendedor_mes' then '  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_medidas_ventas_vendedor_mes;'
      when 'mv_bonificaciones_concepto_mes' then '  REFRESH MATERIALIZED VIEW public.mv_bonificaciones_concepto_mes;'
      else '  REFRESH MATERIALIZED VIEW public.mv_ventas_vendedor_cliente_mes;'
    end;
    select pg_get_functiondef('public.refresh_facturacion_clientes(integer[])'::regprocedure) into def;
    if def is null then
      raise notice 'refresh_facturacion_clientes no existe: refresca % a mano', marca;
    elsif position(marca in def) > 0 then
      raise notice 'refresh_facturacion_clientes ya refresca %', marca;
    elsif position('RETURN QUERY SELECT f.anio' in def) = 0 then
      raise warning 'no encontré el RETURN QUERY de refresh_facturacion_clientes: añade el REFRESH de % a mano', marca;
    else
      def := replace(def, '  RETURN QUERY SELECT f.anio', linea || E'\n\n  RETURN QUERY SELECT f.anio');
      execute def;
    end if;
  end loop;
end
$do$;

refresh materialized view public.mv_medidas_ventas_vendedor_mes;
refresh materialized view public.mv_bonificaciones_concepto_mes;
refresh materialized view public.mv_ventas_vendedor_cliente_mes;

notify pgrst, 'reload schema';
