-- 2026-10-02 · Rendimiento: las vistas que la app baja en bloque devolvían numéricos con 15-20 decimales
-- ("15963963.0780499999884"); medido en producción, Análisis por cliente bajaba 3 MB. Se envuelven con round(x, 2):
-- mismas columnas, mismos nombres y tipos (numeric), la mitad de bytes. La definición interior es la que había.

-- v_analisis_cliente_mes · 18 numéricas
create or replace view public.v_analisis_cliente_mes as
select
  t.anio,
  t.mes,
  t.cliente,
  t.cliente_nombre,
  t.cliente_key,
  t.canal,
  round(t.fact_bruta, 2) as fact_bruta,
  round(t.devoluciones, 2) as devoluciones,
  round(t.rmas, 2) as rmas,
  round(t.bonificaciones, 2) as bonificaciones,
  round(t.costo_fact_bruta, 2) as costo_fact_bruta,
  round(t.costo_devoluciones, 2) as costo_devoluciones,
  round(t.costo_rmas, 2) as costo_rmas,
  round(t.piezas_venta_neta, 2) as piezas_venta_neta,
  t.renglones,
  round(t.fact_neta, 2) as fact_neta,
  round(t.venta_neta, 2) as venta_neta,
  round(t.costo_fact_neta, 2) as costo_fact_neta,
  round(t.costo_venta_neta, 2) as costo_venta_neta,
  round(t.contribucion, 2) as contribucion,
  round(t.contribucion_bruta, 2) as contribucion_bruta,
  round(t.utilidad_comercial, 2) as utilidad_comercial,
  round(t.pct_mc, 2) as pct_mc,
  round(t.pct_muc, 2) as pct_muc,
  round(t.pct_ajustes, 2) as pct_ajustes
from (
SELECT anio,
    mes,
    cliente,
    cliente_nombre,
    cliente_key,
    canal,
    fact_bruta,
    devoluciones,
    rmas,
    bonificaciones,
    costo_fact_bruta,
    costo_devoluciones,
    costo_rmas,
    piezas_venta_neta,
    renglones,
    fact_neta,
    venta_neta,
    costo_fact_neta,
    costo_venta_neta,
    contribucion,
    contribucion_bruta,
    utilidad_comercial,
        CASE
            WHEN fact_neta <> 0::numeric THEN contribucion / fact_neta
            ELSE NULL::numeric
        END AS pct_mc,
        CASE
            WHEN venta_neta <> 0::numeric THEN utilidad_comercial / venta_neta
            ELSE NULL::numeric
        END AS pct_muc,
        CASE
            WHEN fact_bruta <> 0::numeric THEN (devoluciones + rmas + bonificaciones) / fact_bruta
            ELSE NULL::numeric
        END AS pct_ajustes
   FROM mv_analisis_cliente_mes m
) t;

-- v_sellout_cuenta_mes · 11 numéricas
create or replace view public.v_sellout_cuenta_mes as
select
  t.cuenta,
  t.nombre,
  t.canal_sellout,
  t.erp_cliente,
  t.propio,
  t.granularidad,
  t.anio,
  t.mes,
  round(t.importe, 2) as importe,
  round(t.cantidad, 2) as cantidad,
  round(t.sell_in, 2) as sell_in,
  round(t.sell_in_piezas, 2) as sell_in_piezas,
  t.clientes_finales,
  t.vendedores,
  t.sucursales,
  t.facturas,
  t.estados,
  round(t.importe_sin_estado, 2) as importe_sin_estado,
  round(t.importe_sin_cliente, 2) as importe_sin_cliente,
  round(t.importe_fuente, 2) as importe_fuente,
  round(t.inv_valor, 2) as inv_valor,
  round(t.inv_piezas, 2) as inv_piezas,
  t.inv_skus,
  t.inv_skus_sin_venta_30,
  t.inv_semana,
  t.cf_activos,
  t.cf_nuevos,
  t.cf_perdidos,
  round(t.cf_recompra_pct, 2) as cf_recompra_pct,
  round(t.cf_ticket, 2) as cf_ticket,
  t.vend_activos,
  t.vend_nuevos,
  t.vend_perdidos,
  t.vend_recurrentes
from (
SELECT cuenta,
    nombre,
    canal_sellout,
    erp_cliente,
    propio,
    granularidad,
    anio,
    mes,
    importe,
    cantidad,
    sell_in,
    sell_in_piezas,
    clientes_finales,
    vendedores,
    sucursales,
    facturas,
    estados,
    importe_sin_estado,
    importe_sin_cliente,
    importe_fuente,
    inv_valor,
    inv_piezas,
    inv_skus,
    inv_skus_sin_venta_30,
    inv_semana,
    cf_activos,
    cf_nuevos,
    cf_perdidos,
    cf_recompra_pct,
    cf_ticket,
    vend_activos,
    vend_nuevos,
    vend_perdidos,
    vend_recurrentes
   FROM mv_sellout_cuenta_mes
) t;

-- v_fact_cliente_mes · 2 numéricas
create or replace view public.v_fact_cliente_mes as
select
  t.cliente_key,
  t.anio,
  t.mes,
  round(t.monto, 2) as monto,
  round(t.piezas, 2) as piezas,
  t.skus
from (
SELECT cliente_key,
    anio,
    mes,
    monto,
    piezas,
    skus
   FROM mv_fact_cliente_mes
) t;

-- v_erp_medidas_mes NO se toca: es la capa canónica de medidas y tiene dependientes (mv_medidas_inventario, v_medidas_ventas_mes).

-- v_erp_medidas_cliente_mes · 15 numéricas
create or replace view public.v_erp_medidas_cliente_mes as
select
  t.anio,
  t.mes,
  t.cliente_key,
  round(t.fact_bruta, 2) as fact_bruta,
  round(t.devoluciones, 2) as devoluciones,
  round(t.rmas, 2) as rmas,
  round(t.bonificaciones, 2) as bonificaciones,
  round(t.costo_fact_bruta, 2) as costo_fact_bruta,
  round(t.costo_devoluciones, 2) as costo_devoluciones,
  round(t.costo_rmas, 2) as costo_rmas,
  round(t.piezas_venta_neta, 2) as piezas_venta_neta,
  t.renglones,
  round(t.fact_neta, 2) as fact_neta,
  round(t.venta_neta, 2) as venta_neta,
  round(t.costo_fact_neta, 2) as costo_fact_neta,
  round(t.costo_venta_neta, 2) as costo_venta_neta,
  round(t.contribucion, 2) as contribucion,
  round(t.contribucion_bruta, 2) as contribucion_bruta,
  round(t.utilidad_comercial, 2) as utilidad_comercial
from (
SELECT anio,
    mes,
    cliente_key,
    fact_bruta,
    devoluciones,
    rmas,
    bonificaciones,
    costo_fact_bruta,
    costo_devoluciones,
    costo_rmas,
    piezas_venta_neta,
    renglones,
    fact_neta,
    venta_neta,
    costo_fact_neta,
    costo_venta_neta,
    contribucion,
    contribucion_bruta,
    utilidad_comercial
   FROM mv_erp_medidas_cliente_mes
) t;

-- v_erp_medidas_canal_mes · 17 numéricas
create or replace view public.v_erp_medidas_canal_mes as
select
  t.anio,
  t.mes,
  t.canal,
  round(t.fact_bruta, 2) as fact_bruta,
  round(t.devoluciones, 2) as devoluciones,
  round(t.rmas, 2) as rmas,
  round(t.bonificaciones, 2) as bonificaciones,
  round(t.costo_fact_bruta, 2) as costo_fact_bruta,
  round(t.costo_devoluciones, 2) as costo_devoluciones,
  round(t.costo_rmas, 2) as costo_rmas,
  round(t.piezas_venta_neta, 2) as piezas_venta_neta,
  t.renglones,
  round(t.fact_neta, 2) as fact_neta,
  round(t.venta_neta, 2) as venta_neta,
  round(t.costo_fact_neta, 2) as costo_fact_neta,
  round(t.costo_venta_neta, 2) as costo_venta_neta,
  round(t.contribucion, 2) as contribucion,
  round(t.contribucion_bruta, 2) as contribucion_bruta,
  round(t.utilidad_comercial, 2) as utilidad_comercial,
  round(t.pct_mc, 2) as pct_mc,
  round(t.pct_muc, 2) as pct_muc
from (
SELECT anio,
    mes,
    canal,
    fact_bruta,
    devoluciones,
    rmas,
    bonificaciones,
    costo_fact_bruta,
    costo_devoluciones,
    costo_rmas,
    piezas_venta_neta,
    renglones,
    fact_neta,
    venta_neta,
    costo_fact_neta,
    costo_venta_neta,
    contribucion,
    contribucion_bruta,
    utilidad_comercial,
        CASE
            WHEN fact_neta <> 0::numeric THEN contribucion / fact_neta
            ELSE NULL::numeric
        END AS pct_mc,
        CASE
            WHEN venta_neta <> 0::numeric THEN utilidad_comercial / venta_neta
            ELSE NULL::numeric
        END AS pct_muc
   FROM mv_erp_medidas_canal_mes m
) t;

