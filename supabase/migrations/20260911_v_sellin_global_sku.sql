-- Sell In consolidado (Dirección Comercial) · 2026-09-11
-- Vistas para la pantalla global de Sell In (src/modules/comercial/SellInCliente.jsx → SellInGlobal).
--
--   v_sellin_global_sku_canal_mes : facturacion_clientes agregada a sku × canal × es_clave × año × mes
--                                   (~16K filas/año, 183 ms los 2 años). La tabla por SKU filtra por canal y
--                                   por "clientes clave" (digitalife / pcel / dicotech) sin bajar las 54K filas.
--   v_sellin_global_sku_mes_erp   : medidas del director por artículo × año × mes directo de erp_ventas
--                                   (mismas reglas que v_erp_medidas; sin pasar por su GROUP BY de 7 llaves,
--                                   que tardaba 11 s). Filtrada por artículo usa erp_ventas_articulo_idx (ms).
--   v_sellin_global_sku_anio_erp  : artículo × año con pct_mc = contribucion / fact_neta (~1.5K filas/año) sobre
--                                   mv_analisis_cliente_sku_mes. En la app sólo la pide quien tiene permiso `sensible`.
--
-- Las tres son de DEFINER (sin security_invoker), como v_facturacion_global_sku_mes: las políticas RLS por
-- cliente (puede_ver_cliente_pestana) multiplican ×7 el tiempo del agregado global y estas vistas sólo
-- exponen agregados por SKU. El acceso lo decide la app (permiso global sell_in / sensible).

create or replace view public.v_sellin_global_sku_canal_mes as
select
  sku,
  coalesce(nullif(trim(canal), ''), 'otros')                          as canal,
  (cliente_key in ('digitalife', 'pcel', 'dicotech'))                  as es_clave,
  anio,
  mes,
  sum(piezas)                                                          as piezas,
  sum(monto)                                                           as monto
from public.facturacion_clientes
where sku is not null
group by sku, coalesce(nullif(trim(canal), ''), 'otros'), (cliente_key in ('digitalife', 'pcel', 'dicotech')), anio, mes;

comment on view public.v_sellin_global_sku_canal_mes is
  'Sell In global por sku × canal × es_clave (digitalife/pcel/dicotech) × año × mes. Fuente facturacion_clientes.';

create or replace view public.v_sellin_global_sku_mes_erp as
with s as (
  select
    articulo as sku, anio, mes,
    sum(case when movimiento_venta in ('Factura', 'Factura Com.Ext33') then coalesce(monto_venta_pesos, 0) else 0 end) as fact_bruta,
    sum(case when movimiento_venta = 'Devolucion Venta' and coalesce(instruccion, '') not ilike 'nota credito' then coalesce(monto_venta_pesos, 0) else 0 end) as devoluciones,
    sum(case when movimiento_venta = 'Devolucion Venta' and instruccion ilike 'nota credito' then coalesce(monto_venta_pesos, 0) else 0 end) as rmas,
    sum(case when movimiento_venta = 'Bonificacion Venta' then coalesce(monto_venta_pesos, 0) else 0 end) as bonificaciones,
    sum(case when movimiento_venta = 'Factura' then coalesce(costo_venta_pesos, 0) else 0 end) as costo_fact_bruta,
    sum(case when movimiento_venta = 'Devolucion Venta' and coalesce(instruccion, '') not ilike 'nota credito' then coalesce(costo_venta_pesos, 0) else 0 end) as costo_devoluciones,
    sum(coalesce(unidades, piezas, 0)) as piezas
  from public.erp_ventas
  where articulo is not null and anio is not null and mes is not null
  group by articulo, anio, mes
)
select
  sku, anio, mes, fact_bruta, devoluciones, rmas, bonificaciones, piezas,
  fact_bruta + devoluciones                                             as fact_neta,
  fact_bruta + devoluciones + rmas + bonificaciones                     as venta_neta,
  fact_bruta + devoluciones - (costo_fact_bruta + costo_devoluciones)   as contribucion
from s;

comment on view public.v_sellin_global_sku_mes_erp is
  'Medidas del director por artículo × año × mes (fact_neta, venta_neta, contribucion, devoluciones, rmas, bonificaciones). Fuente erp_ventas, reglas de v_erp_medidas.';

-- Por artículo × año: sale de mv_analisis_cliente_sku_mes (MV de Análisis por cliente, refrescada en
-- refresh_facturacion_clientes) porque agregar erp_ventas en vivo tardaba 7-9 s; sobre la MV son ~50 ms.
drop view if exists public.v_sellin_global_sku_anio_erp;
create view public.v_sellin_global_sku_anio_erp as
select
  articulo                as sku,
  anio,
  sum(fact_neta)          as fact_neta,
  sum(contribucion)       as contribucion,
  sum(piezas_venta_neta)  as piezas,
  case when sum(fact_neta) <> 0 then sum(contribucion) / sum(fact_neta) else null end as pct_mc
from public.mv_analisis_cliente_sku_mes
where articulo is not null and articulo <> '—'
group by articulo, anio;

comment on view public.v_sellin_global_sku_anio_erp is
  'Medidas del director por artículo × año (pct_mc = contribucion / fact_neta). Fuente mv_analisis_cliente_sku_mes.';

grant select on public.v_sellin_global_sku_canal_mes, public.v_sellin_global_sku_mes_erp, public.v_sellin_global_sku_anio_erp to authenticated, service_role;
