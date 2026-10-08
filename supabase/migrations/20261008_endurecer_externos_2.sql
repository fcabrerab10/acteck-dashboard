-- 2026-10-08 · Endurecer externos · parte 2 (sigue a 20261008_endurecer_externos.sql).
--   a) RLS que estaba APAGADO en sellout_general (464 K filas de todos los mayoristas legibles por cualquiera), promos_temporada,
--      provisiones_fondo y evaluacion_extras → encendido con política es_interno() (sellout_general ya tenía la suya).
--   b) Todas las vistas con SELECT para authenticated quedan con filtro: filas sólo de los clientes visibles si la vista trae
--      cliente_key / cuenta / cliente (cliente_visible), cliente fijo si el nombre lo dice (digitalife/pcel/dicotech), y sólo
--      internos en el resto. Quedan abiertas: v_fuentes_frescura, v_sellout_cuentas, v_sku_ean, v_articulo_rama, v_fact_anios.
--   c) Las MVs de sell out / resumen que la app leía directo pasan a vistas vs_* con el mismo filtro y se revoca el SELECT de
--      anon/authenticated sobre TODAS las MVs (la app sólo lee vistas; los refrescos corren con service_role / sin JWT).

alter table public.sellout_general enable row level security;
alter table public.promos_temporada enable row level security;
alter table public.provisiones_fondo enable row level security;
alter table public.evaluacion_extras enable row level security;
drop policy if exists "promos_temporada_internos" on public.promos_temporada; create policy "promos_temporada_internos" on public.promos_temporada for all to public using (public.es_interno()) with check (public.es_interno());
drop policy if exists "provisiones_fondo_internos" on public.provisiones_fondo; create policy "provisiones_fondo_internos" on public.provisiones_fondo for all to public using (public.es_interno()) with check (public.es_interno());
drop policy if exists "evaluacion_extras_internos" on public.evaluacion_extras; create policy "evaluacion_extras_internos" on public.evaluacion_extras for all to public using (public.es_interno()) with check (public.es_interno());
create or replace view public.fondo_pcel_saldo as select * from (
 SELECT tipo_fondo,
    sum(
        CASE
            WHEN tipo_mov = ANY (ARRAY['aporte'::text, 'inicial'::text]) THEN monto
            ELSE 0::numeric
        END) AS total_entradas,
    sum(
        CASE
            WHEN tipo_mov = 'gasto'::text THEN monto
            ELSE 0::numeric
        END) AS total_gastos,
    sum(
        CASE
            WHEN tipo_mov = ANY (ARRAY['aporte'::text, 'inicial'::text]) THEN monto
            ELSE - monto
        END) AS saldo
   FROM fondo_pcel_movimientos
  GROUP BY tipo_fondo
) _v where public.es_interno() OR public.cliente_visible('pcel');
create or replace view public.precios_sku_actual as select * from (
 SELECT DISTINCT ON (sku) sku,
    precio AS precio_aaa,
    0::numeric AS descuento,
    precio AS precio_descuento,
    lista,
    moneda,
    anio,
    mes
   FROM precios_sku
  WHERE lista = 'Mayoreo AAA'::text
  ORDER BY sku, anio DESC, mes DESC
) _v where public.es_interno();
create or replace view public.sell_in_sku as select * from (
 SELECT cliente_key AS cliente,
    sku,
    anio,
    mes,
    sum(piezas)::integer AS piezas,
    sum(monto) AS monto_pesos
   FROM facturacion_clientes
  WHERE cliente_key IS NOT NULL
  GROUP BY cliente_key, sku, anio, mes
) _v where public.es_interno() OR public.cliente_visible(cliente::text);
create or replace view public.v_auditoria_cambios as select * from (
 SELECT id,
    tabla,
    operacion,
    registro_id,
    cliente_key,
    usuario_id,
    usuario_email,
    creado_at,
    COALESCE(( SELECT jsonb_object_agg(e.key,
                CASE
                    WHEN length(e.value::text) <= 2048 THEN e.value
                    WHEN a.operacion = 'UPDATE'::text THEN jsonb_build_object('de', '(contenido largo)', 'a', format('(cambió · %s KB)'::text, round(length(e.value::text)::numeric / 1024.0, 1)))
                    ELSE to_jsonb(format('(contenido largo · %s KB)'::text, round(length(e.value::text)::numeric / 1024.0, 1)))
                END) AS jsonb_object_agg
           FROM jsonb_each(a.cambios) e(key, value)), '{}'::jsonb) AS cambios,
    (EXISTS ( SELECT 1
           FROM jsonb_each(a.cambios) e(key, value)
          WHERE length(e.value::text) > 2048)) AS cambios_recortado
   FROM auditoria_cambios a
) _v where public.es_interno() OR public.cliente_visible(cliente_key::text);
create or replace view public.v_auditoria_equipo as select * from (
 SELECT id,
    tabla,
    operacion,
    registro_id,
    cliente_key,
    usuario_id,
    usuario_email,
    creado_at,
    COALESCE(( SELECT jsonb_object_agg(e.key, e.value) AS jsonb_object_agg
           FROM jsonb_each(a.cambios) e(key, value)
          WHERE e.key = ANY (ARRAY['activo'::text, 'cerrada'::text, 'cerrada_at'::text, 'completado'::text, 'comprado_at'::text, 'estado'::text, 'nombre'::text, 'pagado'::text, 'permisos'::text, 'puesto'::text, 'rol'::text, 'se_evalua'::text, 'tipo'::text])), '{}'::jsonb) AS cambios
   FROM auditoria_cambios a
) _v where public.es_interno() OR public.cliente_visible(cliente_key::text);
create or replace view public.v_bonificaciones_concepto_mes as select * from (
 SELECT anio,
    mes,
    cliente_key,
    cliente,
    cliente_nombre,
    canal,
    concepto_codigo,
    concepto,
    monto,
    renglones
   FROM mv_bonificaciones_concepto_mes
) _v where public.es_interno() OR public.cliente_visible(cliente_key::text);
create or replace view public.v_compras_pendientes_proveedor as select * from (
 SELECT proveedor,
    min(prov_id) AS prov_id,
    count(DISTINCT po)::integer AS pos,
    count(*)::integer AS renglones,
    count(DISTINCT sku)::integer AS skus,
    sum(piezas_pendientes)::bigint AS piezas_pendientes,
    round(sum(usd_pendiente), 2) AS usd_pendiente,
    min(fecha_po) AS po_mas_antigua,
    max(fecha_po) AS po_mas_reciente,
    max(dias_desde_po) AS dias_po_mas_antigua,
    min(eta) FILTER (WHERE eta IS NOT NULL) AS eta_mas_cercana,
    count(*) FILTER (WHERE NOT en_master_embarques)::integer AS renglones_sin_embarque
   FROM v_compras_pendientes_sku
  GROUP BY proveedor
) _v where public.es_interno();
create or replace view public.v_cuota_cliente_erp as select * from (
 SELECT cuota_cliente,
    cliente_erp,
    cliente_nombre,
    cuenta_sellout
   FROM ( VALUES ('ct'::text,'00183'::text,'CT INTERNACIONAL DEL NOROESTE'::text,'ct'::text), ('cva'::text,'00417'::text,'COMERCIALIZADORA DE VALOR AGREGADO'::text,'cva'::text), ('unicom'::text,'00335'::text,'GRUPO UNIDADES DE COMPUTO'::text,'guc'::text), ('ingram'::text,'00226'::text,'INGRAM MICRO MEXICO'::text,'ingram'::text), ('ingram_retail'::text,'04126'::text,'INGRAM MICRO MEXICO'::text,'ingram_retail'::text), ('arroba'::text,'01145'::text,'ARROBA COMPUTERS DISTRIBUCION'::text,'arroba'::text), ('techs_mart'::text,'00514'::text,'TECHS MART DE MEXICO'::text,'techsmart'::text), ('exel'::text,'00676'::text,'EXEL DEL NORTE'::text,'exel'::text), ('dc'::text,'00106'::text,'DC MAYORISTA'::text,'dcmayorista'::text), ('nsstore'::text,'00748'::text,'GROUP NSSTORE'::text,'nsstore'::text), ('loma'::text,'00662'::text,'GRUPO LOMA DEL NORTE'::text,'loma'::text), ('pch'::text,'00683'::text,'PCH MAYOREO'::text,'pch'::text), ('integradora_kabik'::text,'07424'::text,'INTEGRADORA KABIK'::text,'kabik'::text), ('dicotech'::text,'00708'::text,'DICOTECH MAYORISTA DE TECNOLOGIA'::text,'dicotech'::text), ('digitalife'::text,'00764'::text,'API GLOBAL'::text,'digitalife'::text), ('pcel'::text,'00473'::text,'PC ONLINE'::text,'pcel'::text), ('decme'::text,'00714'::text,'GRUPO DECME'::text,NULL::text), ('svenska'::text,'00374'::text,'GRUPO SVENSKA'::text,NULL::text), ('stuffactory'::text,'00652'::text,'STUFFACTORY'::text,NULL::text), ('amazon'::text,'00936'::text,'CLIENTE VENTA EN LINEA AMAZON'::text,NULL::text), ('mercado_libre'::text,'00970'::text,'PUBLICO GENERAL MERCADO LIBRE'::text,NULL::text), ('techsmart'::text,'00682'::text,'TECHSMART MAYOREO'::text,NULL::text), ('arrangoiz'::text,'00095'::text,'ARRANGOIZ COMPUTACION'::text,NULL::text), ('keops'::text,'02170'::text,'KEOPS COMPUTERS MEXICO'::text,NULL::text), ('mavi'::text,'00377'::text,'MAVI DE OCCIDENTE'::text,NULL::text), ('tony_tiendas'::text,'00618'::text,'TONY TIENDAS'::text,NULL::text), ('dsw'::text,'00952'::text,'GRUPO COMERCIAL DSW'::text,NULL::text), ('dist._liverpool'::text,'07264'::text,'DISTRIBUIDORA LIVERPOOL'::text,NULL::text), ('zona_digital'::text,'07398'::text,'ZONA DIGITAL 83'::text,NULL::text)) t(cuota_cliente, cliente_erp, cliente_nombre, cuenta_sellout)
) _v where public.es_interno() OR public.cliente_visible(cliente_erp::text);
create or replace view public.v_cuota_global_mensual as select * from (
 SELECT anio,
    mes,
    sum(cuota_min) AS cuota_min,
    sum(cuota_ideal) AS cuota_ideal
   FROM cuotas_mensuales
  GROUP BY anio, mes
) _v where public.es_interno();
create or replace view public.v_demanda_sku as select * from (
 WITH so AS (
         SELECT sellout_sku.cliente,
            sellout_sku.sku,
            sellout_sku.anio,
            sellout_sku.mes,
            sum(sellout_sku.piezas)::numeric AS piezas,
            sum(sellout_sku.monto_pesos) AS monto_pesos
           FROM sellout_sku
          WHERE sellout_sku.sku IS NOT NULL AND sellout_sku.piezas IS NOT NULL
          GROUP BY sellout_sku.cliente, sellout_sku.sku, sellout_sku.anio, sellout_sku.mes
        ), si AS (
         SELECT sell_in_sku_legacy.cliente,
            sell_in_sku_legacy.sku,
            sell_in_sku_legacy.anio,
            sell_in_sku_legacy.mes,
            sum(sell_in_sku_legacy.piezas)::numeric AS piezas,
            sum(sell_in_sku_legacy.monto_pesos) AS monto_pesos
           FROM sell_in_sku_legacy
          WHERE sell_in_sku_legacy.sku IS NOT NULL AND sell_in_sku_legacy.piezas IS NOT NULL
          GROUP BY sell_in_sku_legacy.cliente, sell_in_sku_legacy.sku, sell_in_sku_legacy.anio, sell_in_sku_legacy.mes
        )
 SELECT COALESCE(so.cliente, si.cliente) AS cliente,
    COALESCE(so.sku, si.sku) AS sku,
    COALESCE(so.anio, si.anio) AS anio,
    COALESCE(so.mes, si.mes) AS mes,
    COALESCE(so.piezas, si.piezas, 0::numeric) AS piezas,
    COALESCE(so.monto_pesos, si.monto_pesos, 0::numeric) AS monto_pesos,
        CASE
            WHEN so.sku IS NOT NULL THEN 'sellout'::text
            ELSE 'sell_in'::text
        END AS fuente
   FROM so
     FULL JOIN si ON si.cliente = so.cliente AND si.sku = so.sku AND si.anio = so.anio AND si.mes = so.mes
) _v where public.es_interno() OR public.cliente_visible(cliente::text);
create or replace view public.v_dso_real as select * from (
 WITH ec_latest AS (
         SELECT DISTINCT ON (estados_cuenta.cliente) estados_cuenta.id AS estado_cuenta_id,
            estados_cuenta.cliente,
            estados_cuenta.anio,
            estados_cuenta.semana,
            estados_cuenta.fecha_corte,
            estados_cuenta.saldo_actual AS saldo_actual_total,
            estados_cuenta.saldo_vencido,
            estados_cuenta.dso AS dso_erp,
            estados_cuenta.aging_mas90
           FROM estados_cuenta
          ORDER BY estados_cuenta.cliente, estados_cuenta.fecha_corte DESC NULLS LAST
        ), facturas AS (
         SELECT ec_1.cliente,
            ec_1.fecha_corte,
            d.fecha_emision,
            d.saldo_actual AS saldo
           FROM ec_latest ec_1
             JOIN estados_cuenta_detalle d ON d.estado_cuenta_id = ec_1.estado_cuenta_id
          WHERE d.saldo_actual IS NOT NULL AND d.saldo_actual > 0::numeric AND d.fecha_emision IS NOT NULL
        )
 SELECT ec.cliente,
    ec.fecha_corte,
    ec.saldo_actual_total,
    ec.saldo_vencido,
    ec.aging_mas90,
    ec.dso_erp,
        CASE
            WHEN sum(f.saldo) > 0::numeric THEN round(sum(f.saldo * (ec.fecha_corte - f.fecha_emision)::numeric) / sum(f.saldo))::integer
            ELSE NULL::integer
        END AS dso_real,
    count(f.saldo) AS facturas_abiertas
   FROM ec_latest ec
     LEFT JOIN facturas f ON f.cliente = ec.cliente
  GROUP BY ec.cliente, ec.fecha_corte, ec.saldo_actual_total, ec.saldo_vencido, ec.aging_mas90, ec.dso_erp
) _v where public.es_interno() OR public.cliente_visible(cliente::text);
create or replace view public.v_embarques_contenedor as select * from (
 SELECT contenedor,
    min(supplier) AS supplier,
    min(naviera) AS naviera,
    min(tipo_carga) AS tipo_carga,
    min(tipo_contenedor) AS tipo_contenedor,
    count(*) AS renglones,
    count(DISTINCT po) AS pos,
    sum(COALESCE(shp_qty, 0)) AS piezas,
    sum(COALESCE(total_amount, 0::numeric)) AS fob_usd,
    max(costo_flete) AS flete_usd,
    NULLIF(sum(COALESCE(cbm, 0::numeric)), 0::numeric) AS cbm,
    min(emb_fecha_ok(fecha_emision)) AS fecha_emision,
    min(emb_fecha_ok(fecha_inicio_produccion)) AS inicio_produccion,
    max(emb_fecha_ok(fin_produccion)) AS fin_produccion,
    min(emb_fecha_ok(etd)) AS etd,
    min(emb_fecha_ok(eta_puerto)) AS eta_puerto,
    max(emb_fecha_ok(arribo_cedis)) AS arribo_cedis,
    min(cedis) AS cedis,
    min(estatus) AS estatus
   FROM embarques_compras e
  WHERE contenedor IS NOT NULL AND btrim(contenedor) <> ''::text
  GROUP BY contenedor
) _v where public.es_interno();
create or replace view public.v_embarques_contenedor_tiempos as select * from (
 SELECT contenedor,
    supplier,
    naviera,
    tipo_carga,
    tipo_contenedor,
    renglones,
    pos,
    piezas,
    fob_usd,
    flete_usd,
    cbm,
    fecha_emision,
    inicio_produccion,
    fin_produccion,
    etd,
    eta_puerto,
    arribo_cedis,
    cedis,
    estatus,
    EXTRACT(year FROM COALESCE(etd, arribo_cedis, fecha_emision))::integer AS anio,
    EXTRACT(month FROM COALESCE(etd, arribo_cedis, fecha_emision))::integer AS mes,
        CASE
            WHEN fin_produccion IS NOT NULL AND inicio_produccion IS NOT NULL AND (fin_produccion - inicio_produccion) >= 0 AND (fin_produccion - inicio_produccion) <= 300 THEN fin_produccion - inicio_produccion
            ELSE NULL::integer
        END AS dias_produccion,
    arribo_cedis IS NOT NULL AND arribo_cedis <= CURRENT_DATE AS arribado,
        CASE
            WHEN arribo_cedis IS NOT NULL AND arribo_cedis <= CURRENT_DATE AND etd IS NOT NULL AND (arribo_cedis - etd) >= 1 AND (arribo_cedis - etd) <= 150 THEN arribo_cedis - etd
            ELSE NULL::integer
        END AS dias_transito,
        CASE
            WHEN arribo_cedis IS NOT NULL AND arribo_cedis <= CURRENT_DATE AND eta_puerto IS NOT NULL AND (arribo_cedis - eta_puerto) >= 0 AND (arribo_cedis - eta_puerto) <= 60 THEN arribo_cedis - eta_puerto
            ELSE NULL::integer
        END AS dias_puerto_cedis,
        CASE
            WHEN arribo_cedis IS NOT NULL AND arribo_cedis <= CURRENT_DATE AND fecha_emision IS NOT NULL AND (arribo_cedis - fecha_emision) >= 1 AND (arribo_cedis - fecha_emision) <= 400 THEN arribo_cedis - fecha_emision
            ELSE NULL::integer
        END AS dias_total
   FROM v_embarques_contenedor c
) _v where public.es_interno();
create or replace view public.v_embarques_mes as select * from (
 SELECT anio,
    mes,
    count(*) AS embarques,
    sum(pos) AS pos,
    sum(piezas)::bigint AS piezas,
    round(sum(fob_usd), 0) AS fob_usd,
    round(sum(flete_usd), 0) AS flete_usd,
    round(sum(cbm), 1) AS cbm,
    round(sum(flete_usd) FILTER (WHERE cbm IS NOT NULL AND flete_usd IS NOT NULL) / NULLIF(sum(cbm) FILTER (WHERE flete_usd IS NOT NULL), 0::numeric), 1) AS usd_por_cbm,
    round(percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (dias_transito::double precision))::numeric, 0) AS dias_transito_med
   FROM v_embarques_contenedor_tiempos t
  WHERE anio IS NOT NULL
  GROUP BY anio, mes
) _v where public.es_interno();
create or replace view public.v_embarques_naviera as select * from (
 SELECT naviera,
    anio,
    count(*) AS embarques,
    count(*) AS contenedores,
    sum(piezas)::bigint AS piezas,
    round(sum(cbm), 1) AS cbm,
    round(sum(flete_usd), 0) AS flete_usd,
    round(sum(flete_usd) FILTER (WHERE cbm IS NOT NULL AND flete_usd IS NOT NULL) / NULLIF(sum(cbm) FILTER (WHERE flete_usd IS NOT NULL), 0::numeric), 1) AS usd_por_cbm,
    round(sum(flete_usd) FILTER (WHERE cbm IS NOT NULL AND flete_usd IS NOT NULL), 0) AS flete_medido_usd,
    round(sum(cbm) FILTER (WHERE flete_usd IS NOT NULL), 1) AS cbm_medido,
    round(percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (dias_transito::double precision))::numeric, 0) AS dias_transito_med,
    round(avg(dias_transito), 0) AS dias_transito_prom,
    round(percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (dias_puerto_cedis::double precision))::numeric, 0) AS dias_puerto_med,
    count(*) FILTER (WHERE dias_transito IS NOT NULL) AS n_transito
   FROM v_embarques_contenedor_tiempos t
  WHERE naviera IS NOT NULL AND btrim(naviera) <> ''::text AND anio IS NOT NULL
  GROUP BY naviera, anio
) _v where public.es_interno();
create or replace view public.v_embarques_proveedor as select * from (
 SELECT supplier,
    anio,
    count(*) AS embarques,
    sum(pos) AS pos,
    sum(piezas)::bigint AS piezas,
    round(sum(fob_usd), 0) AS fob_usd,
    round(sum(flete_usd), 0) AS flete_usd,
    round(sum(cbm), 1) AS cbm,
    round(sum(flete_usd) FILTER (WHERE cbm IS NOT NULL AND flete_usd IS NOT NULL) / NULLIF(sum(cbm) FILTER (WHERE flete_usd IS NOT NULL), 0::numeric), 1) AS usd_por_cbm,
    round(sum(flete_usd) FILTER (WHERE cbm IS NOT NULL AND flete_usd IS NOT NULL), 0) AS flete_medido_usd,
    round(sum(cbm) FILTER (WHERE flete_usd IS NOT NULL), 1) AS cbm_medido,
    round(percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (dias_produccion::double precision))::numeric, 0) AS dias_produccion_med,
    round(avg(dias_produccion), 0) AS dias_produccion_prom,
    round(percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (dias_transito::double precision))::numeric, 0) AS dias_transito_med,
    round(avg(dias_transito), 0) AS dias_transito_prom,
    round(percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (dias_puerto_cedis::double precision))::numeric, 0) AS dias_puerto_med,
    round(percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (dias_total::double precision))::numeric, 0) AS dias_total_med,
    round(avg(dias_total), 0) AS dias_total_prom,
    count(*) FILTER (WHERE dias_transito IS NOT NULL) AS n_transito,
    count(*) FILTER (WHERE dias_produccion IS NOT NULL) AS n_produccion
   FROM v_embarques_contenedor_tiempos t
  WHERE supplier IS NOT NULL AND anio IS NOT NULL
  GROUP BY supplier, anio
) _v where public.es_interno();
create or replace view public.v_erp_facturas_oc as select * from (
 WITH r AS (
         SELECT erp_ventas.cliente_key,
            erp_ventas.folio,
            erp_ventas.referencia,
            make_date(erp_ventas.anio, erp_ventas.mes, COALESCE(erp_ventas.dia, 1)) AS fecha,
            erp_ventas.articulo,
            max(erp_ventas.descripcion) AS descripcion,
            sum(COALESCE(erp_ventas.unidades, erp_ventas.piezas, 0::numeric)) AS piezas,
            sum(COALESCE(erp_ventas.monto_venta_pesos, 0::numeric)) AS monto
           FROM erp_ventas
          WHERE erp_ventas.movimiento_venta ~~* 'Factura%'::text AND COALESCE(erp_ventas.estatus_venta, ''::text) !~~* 'CANCELAD%'::text AND (erp_ventas.cliente_key = ANY (ARRAY['digitalife'::text, 'pcel'::text, 'dicotech'::text])) AND erp_ventas.anio >= (EXTRACT(year FROM now())::integer - 1) AND make_date(erp_ventas.anio, erp_ventas.mes, COALESCE(erp_ventas.dia, 1)) >= (date_trunc('month'::text, now()) - '1 year'::interval)::date AND erp_ventas.folio IS NOT NULL
          GROUP BY erp_ventas.cliente_key, erp_ventas.folio, erp_ventas.referencia, (make_date(erp_ventas.anio, erp_ventas.mes, COALESCE(erp_ventas.dia, 1))), erp_ventas.articulo
        )
 SELECT cliente_key,
    folio,
    max(referencia) AS referencia,
    min(fecha) AS fecha,
    sum(piezas) AS piezas,
    sum(monto) AS monto,
    count(*) AS n_partidas,
    jsonb_agg(jsonb_build_object('sku', articulo, 'descripcion', descripcion, 'piezas', piezas, 'monto', monto) ORDER BY articulo) AS partidas
   FROM r
  GROUP BY cliente_key, folio
) _v where public.es_interno() OR public.cliente_visible(cliente_key::text);
create or replace view public.v_estrategia_precios_bajo as select * from (
 WITH precios_por_cliente_sku AS (
         SELECT facturacion_clientes.sku,
            facturacion_clientes.cliente_nombre,
            sum(facturacion_clientes.monto) / NULLIF(sum(facturacion_clientes.piezas), 0::numeric) AS precio_unit,
            sum(facturacion_clientes.piezas) AS piezas_total
           FROM facturacion_clientes
          WHERE facturacion_clientes.anio = EXTRACT(year FROM CURRENT_DATE)::integer AND facturacion_clientes.piezas > 0::numeric AND facturacion_clientes.monto > 0::numeric AND facturacion_clientes.cliente_nombre IS NOT NULL
          GROUP BY facturacion_clientes.sku, facturacion_clientes.cliente_nombre
         HAVING sum(facturacion_clientes.piezas) >= 50::numeric
        ), ranked AS (
         SELECT precios_por_cliente_sku.sku,
            precios_por_cliente_sku.cliente_nombre,
            precios_por_cliente_sku.precio_unit,
            precios_por_cliente_sku.piezas_total,
            row_number() OVER (PARTITION BY precios_por_cliente_sku.sku ORDER BY precios_por_cliente_sku.precio_unit) AS rn
           FROM precios_por_cliente_sku
          WHERE precios_por_cliente_sku.precio_unit > 0::numeric
        )
 SELECT sku,
    cliente_nombre AS cliente_bajo,
    round(precio_unit, 2) AS precio_bajo,
    piezas_total AS piezas_bajo
   FROM ranked
  WHERE rn = 1
) _v where public.es_interno();
create or replace view public.v_estrategia_precios_lista as select * from (
 SELECT DISTINCT ON (sku, lista) sku,
    lista,
    moneda,
    precio,
    anio,
    mes
   FROM precios_sku
  ORDER BY sku, lista, anio DESC, mes DESC
) _v where public.es_interno();
create or replace view public.v_eventos_ultimo_usuario as select * from (
 SELECT user_id,
    max(ts) AS ts
   FROM eventos_usuario
  GROUP BY user_id
) _v where public.es_interno();
create or replace view public.v_fact_cliente_mes as select * from (
 SELECT cliente_key,
    anio,
    mes,
    round(monto, 2) AS monto,
    round(piezas, 2) AS piezas,
    skus
   FROM ( SELECT mv_fact_cliente_mes.cliente_key,
            mv_fact_cliente_mes.anio,
            mv_fact_cliente_mes.mes,
            mv_fact_cliente_mes.monto,
            mv_fact_cliente_mes.piezas,
            mv_fact_cliente_mes.skus
           FROM mv_fact_cliente_mes) t
) _v where public.es_interno() OR public.cliente_visible(cliente_key::text);
create or replace view public.v_facturacion_global_mensual as select * from (
 SELECT anio,
    mes,
    piezas,
    monto
   FROM mv_facturacion_global_mensual
) _v where public.es_interno();
create or replace view public.v_facturacion_global_sku_mes as select * from (
 SELECT sku,
    anio,
    mes,
    sum(piezas) AS piezas,
    sum(monto) AS monto
   FROM facturacion_clientes
  GROUP BY sku, anio, mes
) _v where public.es_interno();
create or replace view public.v_inventario_apartado_sku as select * from (
 WITH base AS (
         SELECT m.articulo,
            m.no_almacen,
            GREATEST(m.inventario - m.disponible, 0::numeric) AS piezas_apartadas,
            GREATEST(m.costoinventario - m.costodisponible, 0::numeric) AS valor_apartado,
            m.disponible AS piezas_disp
           FROM v_inventario_almacen_medida m
          WHERE m.en_inv_actual
        ), agg AS (
         SELECT base.articulo,
            sum(base.piezas_apartadas) AS piezas_apartadas,
            sum(base.valor_apartado) AS valor_apartado,
            sum(base.piezas_disp) AS piezas_disp,
            string_agg(DISTINCT base.no_almacen::text, ' · '::text ORDER BY (base.no_almacen::text)) FILTER (WHERE base.piezas_apartadas > 0::numeric) AS almacenes
           FROM base
          GROUP BY base.articulo
        )
 SELECT a.articulo AS sku,
    COALESCE(NULLIF(r.descripcion, ''::text), c.descripcion, ''::text) AS descripcion,
    COALESCE(r.marca, ''::text) AS marca,
    a.piezas_apartadas,
    a.valor_apartado,
    a.piezas_disp,
    COALESCE(a.almacenes, ''::text) AS almacenes
   FROM agg a
     LEFT JOIN LATERAL ( SELECT rs.descripcion,
            rs.marca
           FROM roadmap_sku rs
          WHERE rs.sku = a.articulo
          ORDER BY rs.descripcion
         LIMIT 1) r ON true
     LEFT JOIN catalogo_articulos c ON c.articulo = a.articulo
  WHERE a.piezas_apartadas > 0::numeric
) _v where public.es_interno();
create or replace view public.v_inventario_apartado_total as select * from (
 SELECT COALESCE(sum(piezas_apartadas), 0::numeric) AS piezas,
    COALESCE(sum(valor_apartado), 0::numeric) AS valor,
    count(*)::integer AS skus
   FROM v_inventario_apartado_sku
) _v where public.es_interno();
create or replace view public.v_inventario_cliente_sucursal_ultimo as select * from (
 SELECT t.id,
    t.cliente,
    t.sku,
    t.sucursal,
    t.anio,
    t.semana,
    t.marca,
    t.titulo,
    t.stock,
    t.costo_convenio,
    t.valor,
    t.updated_at
   FROM inventario_cliente_sucursal t
     JOIN ( SELECT inventario_cliente_sucursal.cliente,
            max(inventario_cliente_sucursal.anio * 100 + inventario_cliente_sucursal.semana) AS k
           FROM inventario_cliente_sucursal
          WHERE inventario_cliente_sucursal.anio IS NOT NULL
          GROUP BY inventario_cliente_sucursal.cliente) u ON u.cliente = t.cliente AND (t.anio * 100 + t.semana) = u.k
) _v where public.es_interno() OR public.cliente_visible(cliente::text);
create or replace view public.v_inventario_cliente_ultimo as select * from (
 SELECT t.id,
    t.cliente,
    t.sku,
    t.marca,
    t.titulo,
    t.stock,
    t.costo_convenio,
    t.precio_venta,
    t.fecha_ultima_venta,
    t.dias_sin_venta,
    t.valor,
    t.updated_at,
    t.anio,
    t.semana
   FROM inventario_cliente t
     JOIN ( SELECT inventario_cliente.cliente,
            max(inventario_cliente.anio * 100 + inventario_cliente.semana) AS k
           FROM inventario_cliente
          WHERE inventario_cliente.anio IS NOT NULL
          GROUP BY inventario_cliente.cliente) u ON u.cliente = t.cliente AND (t.anio * 100 + t.semana) = u.k
) _v where public.es_interno() OR public.cliente_visible(cliente::text);
create or replace view public.v_inventario_fuera_venta as select * from (
 WITH base AS (
         SELECT m.no_almacen,
            m.almacen_nombre,
            m.articulo,
            m.inventario,
            m.costoinventario
           FROM v_inventario_almacen_medida m
          WHERE m.exclusivo = 'Inventario'::text
        )
 SELECT b.no_almacen AS almacen,
    COALESCE(ac.nombre, max(b.almacen_nombre)) AS nombre,
        CASE
            WHEN max(b.almacen_nombre) ~~* '%DESTRUCCION%'::text THEN 'Destrucción'::text
            WHEN max(b.almacen_nombre) ~~* '%PAQUETERIA%'::text THEN 'Paqueterías'::text
            WHEN max(b.almacen_nombre) ~~* '%REPARACION%'::text THEN 'Reparaciones'::text
            WHEN max(b.almacen_nombre) ~~* '%CENTRO DE SERVICIO%'::text THEN 'Centro de servicio'::text
            WHEN max(b.almacen_nombre) ~~* '%PRODUCCION%'::text THEN 'Producción'::text
            WHEN max(b.almacen_nombre) ~~* '%DIFERENCIA%'::text THEN 'Diferencias de inventario'::text
            WHEN max(b.almacen_nombre) ~~* '%REFACTURACION%'::text THEN 'Refacturación'::text
            WHEN max(b.almacen_nombre) ~~* '%ROBO%'::text THEN 'Robo'::text
            WHEN max(b.almacen_nombre) ~~* '%REMISION%'::text THEN 'Remisiones'::text
            WHEN max(b.almacen_nombre) ~~* '%MUESTRA%'::text THEN 'Muestras'::text
            WHEN max(b.almacen_nombre) ~~* '%DEVOLUCION%'::text THEN 'Devoluciones'::text
            WHEN max(b.almacen_nombre) ~~* '%STOCK ROTATION%'::text THEN 'Stock rotation'::text
            ELSE 'Otro'::text
        END AS motivo,
    COALESCE(sum(b.inventario), 0::numeric) AS piezas,
    COALESCE(sum(b.costoinventario), 0::numeric) AS valor,
    count(DISTINCT b.articulo) FILTER (WHERE b.inventario <> 0::numeric)::integer AS skus
   FROM base b
     LEFT JOIN almacenes_config ac ON ac.no_almacen = b.no_almacen
  GROUP BY b.no_almacen, ac.nombre
 HAVING COALESCE(sum(b.costoinventario), 0::numeric) <> 0::numeric OR COALESCE(sum(b.inventario), 0::numeric) <> 0::numeric
) _v where public.es_interno();
create or replace view public.v_inventario_historico_dia as select * from (
 SELECT fecha,
    piezas,
    disponible,
    valor,
    skus_con_stock
   FROM mv_inventario_historico_dia
) _v where public.es_interno();
create or replace view public.v_inventario_sku_anio as select * from (
 SELECT sku,
    anio,
    ARRAY[max(piezas) FILTER (WHERE mes = 1), max(piezas) FILTER (WHERE mes = 2), max(piezas) FILTER (WHERE mes = 3), max(piezas) FILTER (WHERE mes = 4), max(piezas) FILTER (WHERE mes = 5), max(piezas) FILTER (WHERE mes = 6), max(piezas) FILTER (WHERE mes = 7), max(piezas) FILTER (WHERE mes = 8), max(piezas) FILTER (WHERE mes = 9), max(piezas) FILTER (WHERE mes = 10), max(piezas) FILTER (WHERE mes = 11), max(piezas) FILTER (WHERE mes = 12)] AS piezas,
    ARRAY[max(valor) FILTER (WHERE mes = 1), max(valor) FILTER (WHERE mes = 2), max(valor) FILTER (WHERE mes = 3), max(valor) FILTER (WHERE mes = 4), max(valor) FILTER (WHERE mes = 5), max(valor) FILTER (WHERE mes = 6), max(valor) FILTER (WHERE mes = 7), max(valor) FILTER (WHERE mes = 8), max(valor) FILTER (WHERE mes = 9), max(valor) FILTER (WHERE mes = 10), max(valor) FILTER (WHERE mes = 11), max(valor) FILTER (WHERE mes = 12)] AS valor
   FROM mv_inventario_sku_mes m
  GROUP BY sku, anio
) _v where public.es_interno();
create or replace view public.v_lead_time_sku as select * from (
 SELECT codigo AS sku,
    round(avg((arribo_cedis - fecha_emision)::numeric), 1) AS dias_promedio,
    round(min((arribo_cedis - fecha_emision)::numeric), 1) AS dias_min,
    round(max((arribo_cedis - fecha_emision)::numeric), 1) AS dias_max,
    count(*)::integer AS muestras,
    max(supplier) AS supplier_principal,
    max(familia) AS familia
   FROM embarques_compras
  WHERE estatus = 'CONCLUIDO'::text AND arribo_cedis IS NOT NULL AND fecha_emision IS NOT NULL AND arribo_cedis > fecha_emision AND codigo IS NOT NULL AND codigo <> ''::text
  GROUP BY codigo
) _v where public.es_interno();
create or replace view public.v_lead_time_supplier as select * from (
 SELECT supplier,
    round(avg((arribo_cedis - fecha_emision)::numeric), 1) AS dias_promedio,
    count(*)::integer AS muestras
   FROM embarques_compras
  WHERE estatus = 'CONCLUIDO'::text AND arribo_cedis IS NOT NULL AND fecha_emision IS NOT NULL AND arribo_cedis > fecha_emision AND supplier IS NOT NULL AND supplier <> ''::text
  GROUP BY supplier
) _v where public.es_interno();
create or replace view public.v_medidas_inventario_dia as select * from (
 WITH p AS (
         SELECT param_medida('inv_rama_desconocida'::text, 0::numeric) AS rama_desc
        ), d AS (
         SELECT h.fecha,
            COALESCE(h.costoinventario, 0::numeric) AS costoinventario,
            COALESCE(h.inventario, 0::numeric) AS inventario,
            COALESCE(ac.exclusivo,
                CASE
                    WHEN ac.comercial THEN 'Ventas'::text
                    ELSE 'Inventario'::text
                END) AS exclusivo,
            r.rama
           FROM inventario_historico h
             LEFT JOIN almacenes_config ac ON ac.no_almacen = h.no_almacen
             LEFT JOIN mv_articulo_rama r ON r.articulo = h.articulo
        )
 SELECT fecha,
    sum(costoinventario) FILTER (WHERE costoinventario <> 0::numeric AND exclusivo IS DISTINCT FROM 'Inventario'::text AND (rama = 'PRODUCTO'::text OR rama IS NULL AND (( SELECT p.rama_desc
           FROM p)) = 1::numeric)) AS inv_actual,
    sum(inventario) FILTER (WHERE costoinventario <> 0::numeric AND exclusivo IS DISTINCT FROM 'Inventario'::text AND (rama = 'PRODUCTO'::text OR rama IS NULL AND (( SELECT p.rama_desc
           FROM p)) = 1::numeric)) AS inv_actual_piezas,
    sum(costoinventario) AS inv_total_todos_almacenes
   FROM d
  GROUP BY fecha
) _v where public.es_interno();
create or replace view public.v_medidas_inventario_mes as select * from (
 SELECT anio,
    mes,
    fecha_cierre,
    inv_cierre_mes,
    inv_cierre_mes_piezas,
    inv_promedio
   FROM mv_medidas_inventario_mes
) _v where public.es_interno();
create or replace view public.v_pagos_fondos_saldo as select * from (
 SELECT f.id AS fondo_id,
    f.cliente,
    f.fondo_key,
    f.nombre,
    f.regla,
    f.activo,
    COALESCE(sum(m.monto) FILTER (WHERE m.tipo = 'abono'::text), 0::numeric) AS abonos,
    COALESCE(sum(m.monto) FILTER (WHERE m.tipo = 'cargo'::text), 0::numeric) AS cargos,
    COALESCE(sum(m.monto) FILTER (WHERE m.tipo = 'abono'::text AND m.anio::numeric = EXTRACT(year FROM CURRENT_DATE)), 0::numeric) AS abonos_ytd,
    COALESCE(sum(m.monto) FILTER (WHERE m.tipo = 'cargo'::text AND m.anio::numeric = EXTRACT(year FROM CURRENT_DATE)), 0::numeric) AS cargos_ytd,
    COALESCE(sum(
        CASE
            WHEN m.tipo = 'abono'::text THEN m.monto
            ELSE - m.monto
        END), 0::numeric) AS saldo,
    max(m.fecha) AS ultimo_movimiento
   FROM pagos_fondos f
     LEFT JOIN pagos_fondos_movimientos m ON m.fondo_id = f.id
  GROUP BY f.id
) _v where public.es_interno() OR public.cliente_visible(cliente::text);
create or replace view public.v_precio_pcel_sku as select * from (
 SELECT s.sku,
    COALESCE(pp.precio, ma.precio) AS precio,
        CASE
            WHEN pp.precio IS NOT NULL THEN 'PCEL PROVISIONAL'::text
            WHEN ma.precio IS NOT NULL THEN 'Mayoreo AAA'::text
            ELSE NULL::text
        END AS lista
   FROM ( SELECT DISTINCT precios_sku.sku
           FROM precios_sku) s
     LEFT JOIN LATERAL ( SELECT p.precio
           FROM precios_sku p
          WHERE p.sku = s.sku AND p.lista = 'PCEL PROVISIONAL'::text
          ORDER BY p.anio DESC, p.mes DESC
         LIMIT 1) pp ON true
     LEFT JOIN LATERAL ( SELECT p.precio
           FROM precios_sku p
          WHERE p.sku = s.sku AND p.lista = 'Mayoreo AAA'::text
          ORDER BY p.anio DESC, p.mes DESC
         LIMIT 1) ma ON true
) _v where public.es_interno() OR public.cliente_visible('pcel');
create or replace view public.v_precio_vigente_sku_lista as select * from (
 SELECT DISTINCT ON (sku, lista) sku,
    lista,
    precio,
    moneda,
    anio,
    mes,
    make_date(anio, mes, 1) AS vigente_desde,
    count(*) OVER (PARTITION BY sku, lista) AS periodos
   FROM precios_sku p
  ORDER BY sku, lista, anio DESC, mes DESC
) _v where public.es_interno();
create or replace view public.v_precios_cambios as select * from (
 SELECT sku,
    lista,
    anio,
    mes,
    precio AS precio_nuevo,
    precio_prev AS precio_anterior,
    anio_prev,
    mes_prev,
        CASE
            WHEN precio_prev = 0::numeric THEN NULL::numeric
            ELSE round((precio - precio_prev) / precio_prev * 100::numeric, 2)
        END AS delta_pct
   FROM ( SELECT h.sku,
            h.lista,
            h.anio,
            h.mes,
            h.precio,
            lag(h.precio) OVER w AS precio_prev,
            lag(h.anio) OVER w AS anio_prev,
            lag(h.mes) OVER w AS mes_prev
           FROM precios_historico h
          WINDOW w AS (PARTITION BY h.sku, h.lista ORDER BY h.anio, h.mes)) x
  WHERE precio_prev IS NOT NULL AND precio <> precio_prev
) _v where public.es_interno();
create or replace view public.v_precios_cambios_mes as select * from (
 SELECT sku,
    lista,
    anio,
    mes,
    precio_actual,
    precio_anterior,
    anio_prev,
    mes_prev,
    delta_pct,
    tipo
   FROM mv_precios_cambios_mes
) _v where public.es_interno();
create or replace view public.v_precios_lista_por_sku as select * from (
 SELECT sku,
    jsonb_object_agg(lista, precio) AS precios,
    max(anio * 100 + mes) AS periodo
   FROM v_estrategia_precios_lista
  WHERE sku IS NOT NULL AND lista IS NOT NULL
  GROUP BY sku
) _v where public.es_interno();
create or replace view public.v_proyectos_sku_mes as select * from (
 SELECT l.sku,
    p.anio,
    p.mes,
    sum(COALESCE(l.piezas, 0)) AS piezas,
    sum(COALESCE(l.reservado, 0)) AS reservado,
    jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'cliente', p.cliente, 'probabilidad', p.probabilidad, 'piezas', COALESCE(l.piezas, 0)) ORDER BY (COALESCE(l.piezas, 0)) DESC) AS proyectos
   FROM proyecto_lineas l
     JOIN proyectos p ON p.id = l.proyecto_id
  WHERE p.probabilidad <> 'cancelado'::text
  GROUP BY l.sku, p.anio, p.mes
) _v where public.es_interno();
create or replace view public.v_sellin_cliente_dia as select * from (
 SELECT cliente,
    cliente_key,
    anio,
    mes,
    dia,
    fact_neta,
    piezas,
    facturas
   FROM mv_sellin_cliente_dia
) _v where public.es_interno() OR public.cliente_visible(cliente_key::text);
create or replace view public.v_sellin_global_sku_anio as select * from (
 SELECT sku,
    anio,
    ARRAY[round(sum(piezas[1])), round(sum(piezas[2])), round(sum(piezas[3])), round(sum(piezas[4])), round(sum(piezas[5])), round(sum(piezas[6])), round(sum(piezas[7])), round(sum(piezas[8])), round(sum(piezas[9])), round(sum(piezas[10])), round(sum(piezas[11])), round(sum(piezas[12]))] AS piezas,
    ARRAY[round(sum(monto[1])), round(sum(monto[2])), round(sum(monto[3])), round(sum(monto[4])), round(sum(monto[5])), round(sum(monto[6])), round(sum(monto[7])), round(sum(monto[8])), round(sum(monto[9])), round(sum(monto[10])), round(sum(monto[11])), round(sum(monto[12]))] AS monto
   FROM mv_sellin_global_sku_canal_anio m
  WHERE sku IS NOT NULL
  GROUP BY sku, anio
) _v where public.es_interno();
create or replace view public.v_sellin_global_sku_canal_anio as select * from (
 SELECT sku,
    canal,
    es_clave,
    anio,
    piezas,
    monto
   FROM mv_sellin_global_sku_canal_anio
) _v where public.es_interno();
create or replace view public.v_sellin_global_sku_canal_mes as select * from (
 SELECT sku,
    COALESCE(NULLIF(TRIM(BOTH FROM canal), ''::text), 'otros'::text) AS canal,
    cliente_key = ANY (ARRAY['digitalife'::text, 'pcel'::text, 'dicotech'::text]) AS es_clave,
    anio,
    mes,
    sum(piezas) AS piezas,
    sum(monto) AS monto
   FROM facturacion_clientes
  WHERE sku IS NOT NULL
  GROUP BY sku, (COALESCE(NULLIF(TRIM(BOTH FROM canal), ''::text), 'otros'::text)), (cliente_key = ANY (ARRAY['digitalife'::text, 'pcel'::text, 'dicotech'::text])), anio, mes
) _v where public.es_interno();
create or replace view public.v_sellout_base as select * from (
 SELECT COALESCE(c.cuenta, 'otros'::text) AS cuenta,
    u.canal_sellout,
    u.fuente,
    u.cliente_final,
    u.fecha,
    u.anio,
    u.mes,
        CASE
            WHEN u.canal_sellout = 'directo'::text THEN 0
            ELSE EXTRACT(day FROM u.fecha)::integer
        END AS dia,
    u.sku,
    u.importe,
    u.cantidad
   FROM mv_sellout_unificado u
     LEFT JOIN v_sellout_cuentas c ON c.fuente = u.fuente OR u.canal_sellout = 'directo'::text AND c.cuenta = 'directo'::text
) _v where public.es_interno() OR public.cliente_visible(cuenta::text);
create or replace view public.v_sellout_clientes_resumen_mes as select * from (
 WITH m AS (
         SELECT mv_sellout_cliente_final_mes.cuenta,
            mv_sellout_cliente_final_mes.anio,
            mv_sellout_cliente_final_mes.mes,
            mv_sellout_cliente_final_mes.cliente_final,
            mv_sellout_cliente_final_mes.importe,
            mv_sellout_cliente_final_mes.facturas,
            mv_sellout_cliente_final_mes.anio * 12 + mv_sellout_cliente_final_mes.mes AS idx
           FROM mv_sellout_cliente_final_mes
        ), act AS (
         SELECT c.cuenta,
            c.anio,
            c.mes,
            c.idx,
            c.importe,
            c.facturas,
            p.cliente_final IS NOT NULL AS repite
           FROM m c
             LEFT JOIN m p ON p.cuenta = c.cuenta AND p.idx = (c.idx - 1) AND p.cliente_final = c.cliente_final
        ), res AS (
         SELECT act.cuenta,
            act.anio,
            act.mes,
            act.idx,
            count(*) AS activos,
            count(*) FILTER (WHERE NOT act.repite) AS nuevos,
            count(*) FILTER (WHERE act.repite) AS repiten,
            sum(act.importe) AS importe,
            sum(act.facturas) AS facturas
           FROM act
          GROUP BY act.cuenta, act.anio, act.mes, act.idx
        ), perdidos AS (
         SELECT x.cuenta,
            x.idx + 1 AS idx,
            count(*) AS perdidos
           FROM m x
          WHERE NOT (EXISTS ( SELECT 1
                   FROM m y
                  WHERE y.cuenta = x.cuenta AND y.idx = (x.idx + 1) AND y.cliente_final = x.cliente_final))
          GROUP BY x.cuenta, (x.idx + 1)
        )
 SELECT r.cuenta,
    r.anio,
    r.mes,
    r.activos,
    r.nuevos,
    COALESCE(pd.perdidos, 0::bigint) AS perdidos,
    r.importe,
    r.facturas,
        CASE
            WHEN r.facturas > 0::numeric THEN r.importe / r.facturas
            ELSE NULL::numeric
        END AS ticket_promedio,
        CASE
            WHEN r.activos > 0 THEN 100.0 * r.repiten::numeric / r.activos::numeric
            ELSE NULL::numeric
        END AS recompra_pct
   FROM res r
     LEFT JOIN perdidos pd ON pd.cuenta = r.cuenta AND pd.idx = r.idx
) _v where public.es_interno() OR public.cliente_visible(cuenta::text);
create or replace view public.v_sellout_cuenta_mes as select * from (
 SELECT cuenta,
    nombre,
    canal_sellout,
    erp_cliente,
    propio,
    granularidad,
    anio,
    mes,
    round(importe, 2) AS importe,
    round(cantidad, 2) AS cantidad,
    round(sell_in, 2) AS sell_in,
    round(sell_in_piezas, 2) AS sell_in_piezas,
    clientes_finales,
    vendedores,
    sucursales,
    facturas,
    estados,
    round(importe_sin_estado, 2) AS importe_sin_estado,
    round(importe_sin_cliente, 2) AS importe_sin_cliente,
    round(importe_fuente, 2) AS importe_fuente,
    round(inv_valor, 2) AS inv_valor,
    round(inv_piezas, 2) AS inv_piezas,
    inv_skus,
    inv_skus_sin_venta_30,
    inv_semana,
    cf_activos,
    cf_nuevos,
    cf_perdidos,
    round(cf_recompra_pct, 2) AS cf_recompra_pct,
    round(cf_ticket, 2) AS cf_ticket,
    vend_activos,
    vend_nuevos,
    vend_perdidos,
    vend_recurrentes
   FROM ( SELECT mv_sellout_cuenta_mes.cuenta,
            mv_sellout_cuenta_mes.nombre,
            mv_sellout_cuenta_mes.canal_sellout,
            mv_sellout_cuenta_mes.erp_cliente,
            mv_sellout_cuenta_mes.propio,
            mv_sellout_cuenta_mes.granularidad,
            mv_sellout_cuenta_mes.anio,
            mv_sellout_cuenta_mes.mes,
            mv_sellout_cuenta_mes.importe,
            mv_sellout_cuenta_mes.cantidad,
            mv_sellout_cuenta_mes.sell_in,
            mv_sellout_cuenta_mes.sell_in_piezas,
            mv_sellout_cuenta_mes.clientes_finales,
            mv_sellout_cuenta_mes.vendedores,
            mv_sellout_cuenta_mes.sucursales,
            mv_sellout_cuenta_mes.facturas,
            mv_sellout_cuenta_mes.estados,
            mv_sellout_cuenta_mes.importe_sin_estado,
            mv_sellout_cuenta_mes.importe_sin_cliente,
            mv_sellout_cuenta_mes.importe_fuente,
            mv_sellout_cuenta_mes.inv_valor,
            mv_sellout_cuenta_mes.inv_piezas,
            mv_sellout_cuenta_mes.inv_skus,
            mv_sellout_cuenta_mes.inv_skus_sin_venta_30,
            mv_sellout_cuenta_mes.inv_semana,
            mv_sellout_cuenta_mes.cf_activos,
            mv_sellout_cuenta_mes.cf_nuevos,
            mv_sellout_cuenta_mes.cf_perdidos,
            mv_sellout_cuenta_mes.cf_recompra_pct,
            mv_sellout_cuenta_mes.cf_ticket,
            mv_sellout_cuenta_mes.vend_activos,
            mv_sellout_cuenta_mes.vend_nuevos,
            mv_sellout_cuenta_mes.vend_perdidos,
            mv_sellout_cuenta_mes.vend_recurrentes
           FROM mv_sellout_cuenta_mes) t
) _v where public.es_interno() OR public.cliente_visible(cuenta::text);
create or replace view public.v_sellout_detalle_sku_mes as select * from (
 SELECT cliente,
    sku,
    marca,
    anio,
    mes,
    piezas,
    monto,
    monto_bruto,
    tx,
    ultima_fecha,
    piezas_ensamble,
    monto_ensamble
   FROM mv_sellout_detalle_sku_mes
) _v where public.es_interno() OR public.cliente_visible(cliente::text);
create or replace view public.v_sellout_dicotech_marca_mes as select * from (
 SELECT r.marca,
    s.anio,
    s.mes,
    sum(s.piezas) AS piezas,
    sum(s.monto) AS monto,
    count(DISTINCT s.sku) AS skus_distintos
   FROM v_sellout_dicotech_sku_mes s
     LEFT JOIN roadmap_sku r ON r.sku = s.sku
  GROUP BY r.marca, s.anio, s.mes
) _v where public.es_interno() OR public.cliente_visible('dicotech');
create or replace view public.v_sellout_dicotech_mensual as select * from (
 WITH detalle AS (
         SELECT EXTRACT(year FROM sellout_detalle.fecha)::integer AS anio,
            EXTRACT(month FROM sellout_detalle.fecha)::integer AS mes,
            sum(sellout_detalle.cantidad) AS piezas,
            sum(COALESCE(sellout_detalle.subtotal, sellout_detalle.total, 0::numeric) - COALESCE(sellout_detalle.descuento, 0::numeric)) AS monto,
            count(*)::integer AS tx,
            count(DISTINCT sellout_detalle.no_parte)::integer AS skus_distintos
           FROM sellout_detalle
          WHERE sellout_detalle.cliente = 'dicotech'::text AND sellout_detalle.fecha IS NOT NULL
          GROUP BY (EXTRACT(year FROM sellout_detalle.fecha)::integer), (EXTRACT(month FROM sellout_detalle.fecha)::integer)
        ), general AS (
         SELECT v_sellout_general_dicotech.anio,
            v_sellout_general_dicotech.mes,
            count(DISTINCT v_sellout_general_dicotech.cliente_nombre)::integer AS clientes_distintos,
            count(DISTINCT v_sellout_general_dicotech.factura)::integer AS facturas
           FROM v_sellout_general_dicotech
          GROUP BY v_sellout_general_dicotech.anio, v_sellout_general_dicotech.mes
        )
 SELECT COALESCE(d.anio, g.anio) AS anio,
    COALESCE(d.mes, g.mes) AS mes,
    COALESCE(d.piezas, 0::numeric) AS piezas,
    COALESCE(d.monto, 0::numeric) AS monto,
    COALESCE(d.tx, 0) AS tx,
    COALESCE(d.skus_distintos, 0) AS skus_distintos,
    COALESCE(g.clientes_distintos, 0) AS clientes_distintos,
    COALESCE(g.facturas, 0) AS facturas
   FROM detalle d
     FULL JOIN general g USING (anio, mes)
) _v where public.es_interno() OR public.cliente_visible('dicotech');
create or replace view public.v_sellout_dicotech_sku_mes as select * from (
 SELECT no_parte AS sku,
    EXTRACT(year FROM fecha)::integer AS anio,
    EXTRACT(month FROM fecha)::integer AS mes,
    sum(cantidad) AS piezas,
    sum(COALESCE(subtotal, total, 0::numeric) - COALESCE(descuento, 0::numeric)) AS monto
   FROM sellout_detalle
  WHERE cliente = 'dicotech'::text AND fecha IS NOT NULL AND no_parte IS NOT NULL
  GROUP BY no_parte, (EXTRACT(year FROM fecha)::integer), (EXTRACT(month FROM fecha)::integer)
) _v where public.es_interno() OR public.cliente_visible('dicotech');
create or replace view public.v_sellout_dicotech_sucursal_mes as select * from (
 SELECT sucursal,
    anio,
    mes,
    sum(cantidad) AS piezas,
    sum(importe) AS monto,
    count(*)::integer AS tx,
    count(DISTINCT sku)::integer AS skus_distintos,
    count(DISTINCT cliente_nombre)::integer AS clientes_distintos
   FROM v_sellout_general_dicotech
  GROUP BY sucursal, anio, mes
) _v where public.es_interno() OR public.cliente_visible('dicotech');
create or replace view public.v_sellout_dicotech_vendedor_mes as select * from (
 SELECT mayorista,
    anio,
    mes,
    vendedor_nombre,
    sum(importe) AS importe,
    sum(cantidad) AS cantidad,
    count(*)::integer AS tx
   FROM mv_sellout_general_dicotech
  GROUP BY mayorista, anio, mes, vendedor_nombre
) _v where public.es_interno() OR public.cliente_visible('dicotech');
create or replace view public.v_sellout_digitalife_marca_mes as select * from (
 WITH suelto AS (
         SELECT upper(TRIM(BOTH FROM sellout_detalle.marca)) AS marca,
            EXTRACT(year FROM sellout_detalle.fecha)::integer AS anio,
            EXTRACT(month FROM sellout_detalle.fecha)::integer AS mes,
            sum(sellout_detalle.cantidad) AS piezas,
            sum(COALESCE(sellout_detalle.subtotal, sellout_detalle.total, 0::numeric) - COALESCE(sellout_detalle.descuento, 0::numeric)) AS monto,
            count(*)::integer AS tx,
            count(DISTINCT sellout_detalle.no_parte)::integer AS skus_distintos
           FROM sellout_detalle
          WHERE sellout_detalle.cliente = 'digitalife'::text AND sellout_detalle.fecha IS NOT NULL AND sellout_detalle.marca IS NOT NULL
          GROUP BY (upper(TRIM(BOTH FROM sellout_detalle.marca))), (EXTRACT(year FROM sellout_detalle.fecha)::integer), (EXTRACT(month FROM sellout_detalle.fecha)::integer)
        ), ens AS (
         SELECT upper(TRIM(BOTH FROM v_sellout_ensambles_sku_mes.marca)) AS marca,
            v_sellout_ensambles_sku_mes.anio,
            v_sellout_ensambles_sku_mes.mes,
            sum(v_sellout_ensambles_sku_mes.piezas) AS piezas,
            sum(v_sellout_ensambles_sku_mes.monto) AS monto,
            sum(v_sellout_ensambles_sku_mes.tx)::integer AS tx,
            count(DISTINCT v_sellout_ensambles_sku_mes.sku)::integer AS skus
           FROM v_sellout_ensambles_sku_mes
          WHERE v_sellout_ensambles_sku_mes.cliente = 'digitalife'::text AND v_sellout_ensambles_sku_mes.marca IS NOT NULL
          GROUP BY (upper(TRIM(BOTH FROM v_sellout_ensambles_sku_mes.marca))), v_sellout_ensambles_sku_mes.anio, v_sellout_ensambles_sku_mes.mes
        )
 SELECT COALESCE(s.marca, e.marca) AS marca,
    COALESCE(s.anio, e.anio) AS anio,
    COALESCE(s.mes, e.mes) AS mes,
    COALESCE(s.piezas, 0::numeric) + COALESCE(e.piezas, 0::numeric) AS piezas,
    COALESCE(s.monto, 0::numeric) + COALESCE(e.monto, 0::numeric) AS monto,
    COALESCE(s.tx, 0) + COALESCE(e.tx, 0) AS tx,
    GREATEST(COALESCE(s.skus_distintos, 0), COALESCE(e.skus, 0)) AS skus_distintos,
    COALESCE(e.piezas, 0::numeric) AS piezas_ensamble,
    COALESCE(e.monto, 0::numeric) AS monto_ensamble
   FROM suelto s
     FULL JOIN ens e ON e.marca = s.marca AND e.anio = s.anio AND e.mes = s.mes
) _v where public.es_interno() OR public.cliente_visible('digitalife');
create or replace view public.v_sellout_digitalife_mensual as select * from (
 WITH suelto AS (
         SELECT EXTRACT(year FROM sellout_detalle.fecha)::integer AS anio,
            EXTRACT(month FROM sellout_detalle.fecha)::integer AS mes,
            sum(sellout_detalle.cantidad) AS piezas,
            sum(COALESCE(sellout_detalle.subtotal, sellout_detalle.total, 0::numeric) - COALESCE(sellout_detalle.descuento, 0::numeric)) AS monto,
            count(*)::integer AS tx,
            count(DISTINCT sellout_detalle.no_parte)::integer AS skus_distintos,
            count(DISTINCT sellout_detalle.marca)::integer AS marcas_distintas,
            count(DISTINCT sellout_detalle.fecha)::integer AS facturas
           FROM sellout_detalle
          WHERE sellout_detalle.cliente = 'digitalife'::text AND sellout_detalle.fecha IS NOT NULL
          GROUP BY (EXTRACT(year FROM sellout_detalle.fecha)::integer), (EXTRACT(month FROM sellout_detalle.fecha)::integer)
        ), ens AS (
         SELECT v_sellout_ensambles_sku_mes.anio,
            v_sellout_ensambles_sku_mes.mes,
            sum(v_sellout_ensambles_sku_mes.piezas) AS piezas,
            sum(v_sellout_ensambles_sku_mes.monto) AS monto,
            sum(v_sellout_ensambles_sku_mes.tx)::integer AS tx,
            sum(v_sellout_ensambles_sku_mes.ensambles)::integer AS ensambles
           FROM v_sellout_ensambles_sku_mes
          WHERE v_sellout_ensambles_sku_mes.cliente = 'digitalife'::text
          GROUP BY v_sellout_ensambles_sku_mes.anio, v_sellout_ensambles_sku_mes.mes
        )
 SELECT COALESCE(s.anio, e.anio) AS anio,
    COALESCE(s.mes, e.mes) AS mes,
    COALESCE(s.piezas, 0::numeric) + COALESCE(e.piezas, 0::numeric) AS piezas,
    COALESCE(s.monto, 0::numeric) + COALESCE(e.monto, 0::numeric) AS monto,
    COALESCE(s.tx, 0) + COALESCE(e.tx, 0) AS tx,
    s.skus_distintos,
    s.marcas_distintas,
    0 AS clientes_distintos,
    s.facturas,
    COALESCE(s.piezas, 0::numeric) AS piezas_suelto,
    COALESCE(s.monto, 0::numeric) AS monto_suelto,
    COALESCE(e.piezas, 0::numeric) AS piezas_ensamble,
    COALESCE(e.monto, 0::numeric) AS monto_ensamble,
    COALESCE(e.ensambles, 0) AS ensambles
   FROM suelto s
     FULL JOIN ens e ON e.anio = s.anio AND e.mes = s.mes
) _v where public.es_interno() OR public.cliente_visible('digitalife');
create or replace view public.v_sellout_digitalife_sku_mes as select * from (
 WITH suelto AS (
         SELECT sellout_detalle.no_parte AS sku,
            EXTRACT(year FROM sellout_detalle.fecha)::integer AS anio,
            EXTRACT(month FROM sellout_detalle.fecha)::integer AS mes,
            sum(sellout_detalle.cantidad) AS piezas,
            sum(COALESCE(sellout_detalle.subtotal, sellout_detalle.total, 0::numeric) - COALESCE(sellout_detalle.descuento, 0::numeric)) AS monto,
            avg(sellout_detalle.precio) AS precio_prom
           FROM sellout_detalle
          WHERE sellout_detalle.cliente = 'digitalife'::text AND sellout_detalle.fecha IS NOT NULL AND sellout_detalle.no_parte IS NOT NULL
          GROUP BY sellout_detalle.no_parte, (EXTRACT(year FROM sellout_detalle.fecha)::integer), (EXTRACT(month FROM sellout_detalle.fecha)::integer)
        ), ens AS (
         SELECT v_sellout_ensambles_sku_mes.sku,
            v_sellout_ensambles_sku_mes.anio,
            v_sellout_ensambles_sku_mes.mes,
            v_sellout_ensambles_sku_mes.piezas,
            v_sellout_ensambles_sku_mes.monto
           FROM v_sellout_ensambles_sku_mes
          WHERE v_sellout_ensambles_sku_mes.cliente = 'digitalife'::text
        )
 SELECT COALESCE(s.sku, e.sku) AS sku,
    COALESCE(s.anio, e.anio) AS anio,
    COALESCE(s.mes, e.mes) AS mes,
    COALESCE(s.piezas, 0::numeric) + COALESCE(e.piezas, 0::numeric) AS piezas,
    COALESCE(s.monto, 0::numeric) + COALESCE(e.monto, 0::numeric) AS monto,
    s.precio_prom,
    COALESCE(s.piezas, 0::numeric) AS piezas_suelto,
    COALESCE(s.monto, 0::numeric) AS monto_suelto,
    COALESCE(e.piezas, 0::numeric) AS piezas_ensamble,
    COALESCE(e.monto, 0::numeric) AS monto_ensamble
   FROM suelto s
     FULL JOIN ens e ON e.sku = s.sku AND e.anio = s.anio AND e.mes = s.mes
) _v where public.es_interno() OR public.cliente_visible('digitalife');
create or replace view public.v_sellout_ensambles_modelo as select * from (
 SELECT e.cliente,
    COALESCE(NULLIF(TRIM(BOTH FROM e.ensamble), ''::text), '(sin modelo)'::text) AS ensamble,
    e.sku,
    max(e.descripcion) AS descripcion,
    max(e.marca) AS marca,
    sum(e.cantidad) AS piezas,
    count(DISTINCT e.folio)::integer AS ensambles,
    min(e.fecha) AS primera_fecha,
    max(e.fecha) AS ultima_fecha,
    sum(e.cantidad * COALESCE(pp.precio_prom, 0::numeric)) AS monto
   FROM sellout_ensambles e
     LEFT JOIN v_sellout_precio_prom_sku pp ON pp.cliente = e.cliente AND pp.sku = e.sku
  GROUP BY e.cliente, (COALESCE(NULLIF(TRIM(BOTH FROM e.ensamble), ''::text), '(sin modelo)'::text)), e.sku
) _v where public.es_interno() OR public.cliente_visible(cliente::text);
create or replace view public.v_sellout_ensambles_sku_mes as select * from (
 SELECT e.cliente,
    e.sku,
    max(e.marca) AS marca,
    EXTRACT(year FROM e.fecha)::integer AS anio,
    EXTRACT(month FROM e.fecha)::integer AS mes,
    sum(e.cantidad) AS piezas,
    sum(e.cantidad * COALESCE(pp.precio_prom, 0::numeric)) AS monto,
    count(*)::integer AS tx,
    count(DISTINCT e.folio)::integer AS ensambles,
    max(e.fecha) AS ultima_fecha
   FROM sellout_ensambles e
     LEFT JOIN v_sellout_precio_prom_sku pp ON pp.cliente = e.cliente AND pp.sku = e.sku
  WHERE e.fecha IS NOT NULL AND e.sku IS NOT NULL
  GROUP BY e.cliente, e.sku, (EXTRACT(year FROM e.fecha)::integer), (EXTRACT(month FROM e.fecha)::integer)
) _v where public.es_interno() OR public.cliente_visible(cliente::text);
create or replace view public.v_sellout_general_cuenta as select * from (
 SELECT c.cuenta,
    g.anio,
    g.mes,
    g.fecha,
    g.cliente_nombre,
    g.vendedor_nombre,
    g.sucursal,
    g.estado,
    g.factura,
    g.sku,
    g.importe,
    g.cantidad,
    false AS solo_dimensiones,
    COALESCE(n.estado, 'SIN ESTADO'::text) AS estado_norm
   FROM sellout_general g
     JOIN v_sellout_cuentas c ON c.fuente = g.mayorista
     LEFT JOIN mv_sellout_estado_norm n ON NOT n.estado_raw IS DISTINCT FROM g.estado
  WHERE g.mayorista <> 'DICOTECH'::text
UNION ALL
 SELECT 'dicotech'::text AS cuenta,
    g.anio,
    g.mes,
    g.fecha,
    g.cliente_nombre,
    g.vendedor_nombre,
    g.sucursal,
    g.estado,
    g.factura,
    g.sku,
    g.importe,
    g.cantidad,
    true AS solo_dimensiones,
    COALESCE(n.estado, 'SIN ESTADO'::text) AS estado_norm
   FROM v_sellout_general_dicotech g
     LEFT JOIN mv_sellout_estado_norm n ON NOT n.estado_raw IS DISTINCT FROM g.estado
) _v where public.es_interno() OR public.cliente_visible(cuenta::text);
create or replace view public.v_sellout_general_dicotech as select * from (
 SELECT id,
    idcliente,
    mayorista,
    fecha,
    anio,
    mes,
    sku,
    sku_cliente,
    descripcion,
    cliente_codigo,
    cliente_nombre,
    cliente_rfc,
    vendedor,
    vendedor_nombre,
    almacen,
    sucursal,
    cantidad,
    precio_unitario,
    importe,
    factura,
    marca,
    estado,
    linea,
    moneda,
    importe_usd,
    tipocambio,
    updated_at
   FROM mv_sellout_general_dicotech
) _v where public.es_interno() OR public.cliente_visible('dicotech');
create or replace view public.v_sellout_general_vendedor_mes as select * from (
 SELECT mayorista,
    anio,
    mes,
    vendedor_nombre,
    sum(importe) AS importe,
    sum(cantidad) AS cantidad,
    count(*)::integer AS tx
   FROM ( SELECT sellout_general.mayorista,
            sellout_general.anio,
            sellout_general.mes,
            sellout_general.vendedor_nombre,
            sellout_general.importe,
            sellout_general.cantidad
           FROM sellout_general
          WHERE sellout_general.mayorista IS DISTINCT FROM 'DICOTECH'::text
        UNION ALL
         SELECT v_sellout_general_dicotech.mayorista,
            v_sellout_general_dicotech.anio,
            v_sellout_general_dicotech.mes,
            v_sellout_general_dicotech.vendedor_nombre,
            v_sellout_general_dicotech.importe,
            v_sellout_general_dicotech.cantidad
           FROM v_sellout_general_dicotech) t
  GROUP BY mayorista, anio, mes, vendedor_nombre
) _v where public.es_interno() OR (upper(mayorista) = 'DICOTECH' AND public.cliente_visible('dicotech'));
create or replace view public.v_sellout_inventario_cuenta_mes as select * from (
 WITH sem AS (
         SELECT v_sellout_inventario_semana.cuenta,
            v_sellout_inventario_semana.anio,
            v_sellout_inventario_semana.semana,
            v_sellout_inventario_semana.stock,
            v_sellout_inventario_semana.valor,
            v_sellout_inventario_semana.dias_sin_venta,
            EXTRACT(year FROM v_sellout_inventario_semana.fecha_semana)::integer AS ay,
            EXTRACT(month FROM v_sellout_inventario_semana.fecha_semana)::integer AS am,
            max(v_sellout_inventario_semana.anio * 100 + v_sellout_inventario_semana.semana) OVER (PARTITION BY v_sellout_inventario_semana.cuenta, (date_trunc('month'::text, v_sellout_inventario_semana.fecha_semana::timestamp with time zone))) AS ult
           FROM v_sellout_inventario_semana
        )
 SELECT cuenta,
    ay AS anio,
    am AS mes,
    max(semana) AS semana,
    sum(valor) AS valor,
    sum(stock) AS piezas,
    count(*) FILTER (WHERE stock > 0::numeric) AS skus_con_stock,
    count(*) FILTER (WHERE dias_sin_venta >= 30::numeric) AS skus_sin_venta_30
   FROM sem
  WHERE (anio * 100 + semana) = ult
  GROUP BY cuenta, ay, am
) _v where public.es_interno() OR public.cliente_visible(cuenta::text);
create or replace view public.v_sellout_inventario_cuenta_sku as select * from (
 SELECT s.cuenta,
    s.anio,
    s.semana,
    s.fecha_semana,
    s.sku,
    s.marca,
    s.titulo,
    s.stock,
    s.valor,
    s.costo_convenio,
    s.precio_venta,
    s.dias_sin_venta,
    s.fecha_ultima_venta
   FROM v_sellout_inventario_semana s
     JOIN ( SELECT v_sellout_inventario_semana.cuenta,
            max(v_sellout_inventario_semana.anio * 100 + v_sellout_inventario_semana.semana) AS ult
           FROM v_sellout_inventario_semana
          GROUP BY v_sellout_inventario_semana.cuenta) u ON u.cuenta = s.cuenta AND u.ult = (s.anio * 100 + s.semana)
) _v where public.es_interno() OR public.cliente_visible(cuenta::text);
create or replace view public.v_sellout_inventario_semana as select * from (
 SELECT i.cliente AS cuenta,
    i.anio,
    i.semana,
    date_trunc('week'::text, make_date(i.anio, 1, 4)::timestamp with time zone)::date + (i.semana - 1) * 7 + 3 AS fecha_semana,
    upper(TRIM(BOTH FROM i.sku)) AS sku,
    i.marca,
    i.titulo,
    COALESCE(i.stock, 0)::numeric AS stock,
    COALESCE(NULLIF(i.valor, 0::numeric), COALESCE(i.stock, 0)::numeric * COALESCE(i.costo_convenio, 0::numeric)) AS valor,
    i.costo_convenio,
    i.precio_venta,
    i.dias_sin_venta,
    i.fecha_ultima_venta
   FROM inventario_cliente i
  WHERE i.anio IS NOT NULL AND i.semana IS NOT NULL
UNION ALL
 SELECT 'pcel'::text AS cuenta,
    p.anio,
    p.semana,
    date_trunc('week'::text, make_date(p.anio, 1, 4)::timestamp with time zone)::date + (p.semana - 1) * 7 + 3 AS fecha_semana,
    COALESCE(NULLIF(upper(TRIM(BOTH FROM p.modelo)), ''::text), m.sku_acteck, p.sku) AS sku,
    p.marca,
    p.producto AS titulo,
    COALESCE(p.inventario, 0)::numeric AS stock,
    COALESCE(p.inventario, 0)::numeric * COALESCE(pl.precio, m.costo_promedio, p.costo_promedio, 0::numeric) AS valor,
    COALESCE(m.costo_promedio, p.costo_promedio) AS costo_convenio,
    pl.precio AS precio_venta,
    NULL::numeric AS dias_sin_venta,
    NULL::date AS fecha_ultima_venta
   FROM sellout_pcel p
     LEFT JOIN pcel_sku_map m ON m.sku_pcel = p.sku
     LEFT JOIN v_precio_pcel_sku pl ON pl.sku = COALESCE(NULLIF(upper(TRIM(BOTH FROM p.modelo)), ''::text), m.sku_acteck)
  WHERE p.anio IS NOT NULL AND p.semana IS NOT NULL
) _v where public.es_interno() OR public.cliente_visible(cuenta::text);
create or replace view public.v_sellout_pcel_marca_mes as select * from (
 SELECT upper(TRIM(BOTH FROM r.marca)) AS marca,
    s.anio,
    s.mes,
    sum(s.piezas) AS piezas,
    sum(s.monto) AS monto,
    0 AS tx,
    count(DISTINCT s.sku) FILTER (WHERE s.piezas > 0::numeric)::integer AS skus_distintos
   FROM v_sellout_pcel_sku_mes s
     JOIN roadmap_sku r ON r.sku = s.sku
  WHERE r.marca IS NOT NULL
  GROUP BY (upper(TRIM(BOTH FROM r.marca))), s.anio, s.mes
) _v where public.es_interno() OR public.cliente_visible('pcel');
create or replace view public.v_sellout_pcel_mensual as select * from (
 SELECT anio,
    mes,
    sum(piezas) AS piezas,
    sum(monto) AS monto,
    0 AS tx,
    count(DISTINCT sku) FILTER (WHERE piezas > 0::numeric)::integer AS skus_distintos,
    0 AS marcas_distintas,
    0 AS clientes_distintos,
    0 AS facturas,
    count(DISTINCT sku) FILTER (WHERE NOT mapeado AND piezas > 0::numeric)::integer AS skus_sin_mapear,
    COALESCE(sum(piezas) FILTER (WHERE NOT mapeado), 0::numeric) AS piezas_sin_mapear
   FROM v_sellout_pcel_sku_mes
  GROUP BY anio, mes
) _v where public.es_interno() OR public.cliente_visible('pcel');
create or replace view public.v_sellout_pcel_semanal as select * from (
 SELECT upper(TRIM(BOTH FROM modelo)) AS sku,
    anio,
    semana,
    vta_semana::numeric AS piezas,
    inventario::numeric AS inventario,
    antiguedad::numeric AS antiguedad,
    transito::numeric AS transito,
    back_order::numeric AS backorder,
    costo_promedio AS costo,
    vta_semana::numeric * COALESCE(costo_promedio, 0::numeric) AS valor_venta,
    inventario::numeric * COALESCE(costo_promedio, 0::numeric) AS valor_inventario
   FROM sellout_pcel
  WHERE modelo IS NOT NULL AND TRIM(BOTH FROM modelo) <> ''::text AND upper(TRIM(BOTH FROM modelo)) ~ '^(AC|BR)-'::text
) _v where public.es_interno() OR public.cliente_visible('pcel');
create or replace view public.v_sellout_pcel_sin_mapear as select * from (
 SELECT m.sku AS sku_pcel,
    max(c.producto) AS producto,
    max(c.marca) AS marca,
    sum(m.piezas) AS piezas_12m,
    max(m.anio * 100 + m.mes) AS ultimo_periodo
   FROM sellout_pcel_mensual m
     LEFT JOIN pcel_sku_map psm ON psm.sku_pcel = m.sku
     LEFT JOIN catalogo_sku_pcel c ON c.sku = m.sku
  WHERE psm.sku_pcel IS NULL AND make_date(m.anio, m.mes, 1) >= (date_trunc('month'::text, CURRENT_DATE::timestamp with time zone) - '1 year'::interval)
  GROUP BY m.sku
) _v where public.es_interno() OR public.cliente_visible('pcel');
create or replace view public.v_sellout_pcel_sku_mes as select * from (
 SELECT COALESCE(psm.sku_acteck, m.sku) AS sku,
    psm.sku_acteck IS NOT NULL AS mapeado,
    m.sku AS sku_pcel,
    m.anio,
    m.mes,
    sum(m.piezas) AS piezas,
    sum(m.piezas * COALESCE(pl.precio, psm.costo_promedio, 0::numeric)) AS monto,
    max(COALESCE(pl.precio, psm.costo_promedio)) AS precio_prom
   FROM sellout_pcel_mensual m
     LEFT JOIN pcel_sku_map psm ON psm.sku_pcel = m.sku
     LEFT JOIN v_precio_pcel_sku pl ON pl.sku = psm.sku_acteck
  GROUP BY (COALESCE(psm.sku_acteck, m.sku)), (psm.sku_acteck IS NOT NULL), m.sku, m.anio, m.mes
) _v where public.es_interno() OR public.cliente_visible('pcel');
create or replace view public.v_sellout_precio_prom_sku as select * from (
 WITH reciente AS (
         SELECT sellout_detalle.cliente,
            sellout_detalle.no_parte AS sku,
            sum(COALESCE(sellout_detalle.subtotal, sellout_detalle.total, 0::numeric) - COALESCE(sellout_detalle.descuento, 0::numeric)) / NULLIF(sum(sellout_detalle.cantidad), 0::numeric) AS precio
           FROM sellout_detalle
          WHERE sellout_detalle.cantidad > 0::numeric AND sellout_detalle.fecha >= (CURRENT_DATE - 90)
          GROUP BY sellout_detalle.cliente, sellout_detalle.no_parte
        ), historico AS (
         SELECT sellout_detalle.cliente,
            sellout_detalle.no_parte AS sku,
            sum(COALESCE(sellout_detalle.subtotal, sellout_detalle.total, 0::numeric) - COALESCE(sellout_detalle.descuento, 0::numeric)) / NULLIF(sum(sellout_detalle.cantidad), 0::numeric) AS precio
           FROM sellout_detalle
          WHERE sellout_detalle.cantidad > 0::numeric
          GROUP BY sellout_detalle.cliente, sellout_detalle.no_parte
        ), factura AS (
         SELECT DISTINCT ON (erp_ventas.cliente_key, erp_ventas.articulo) erp_ventas.cliente_key AS cliente,
            erp_ventas.articulo AS sku,
            erp_ventas.precio_unidad_pesos AS precio
           FROM erp_ventas
          WHERE erp_ventas.movimiento_venta = 'Factura'::text AND (erp_ventas.cliente_key = ANY (ARRAY['digitalife'::text, 'pcel'::text, 'dicotech'::text])) AND erp_ventas.precio_unidad_pesos > 0::numeric
          ORDER BY erp_ventas.cliente_key, erp_ventas.articulo, erp_ventas.periodo DESC
        ), lista AS (
         SELECT c.cliente,
            p.sku,
            p.precio
           FROM ( VALUES ('digitalife'::text,'API PROVISIONAL'::text), ('pcel'::text,'PCEL PROVISIONAL'::text), ('dicotech'::text,'DICOTECH'::text)) c(cliente, lista)
             JOIN v_estrategia_precios_lista p ON p.lista = c.lista
        ), skus AS (
         SELECT historico.cliente,
            historico.sku
           FROM historico
        UNION
         SELECT sellout_ensambles.cliente,
            sellout_ensambles.sku
           FROM sellout_ensambles
        )
 SELECT s.cliente,
    s.sku,
    COALESCE(r.precio, h.precio, f.precio, l.precio) AS precio_prom,
        CASE
            WHEN r.precio IS NOT NULL THEN '90d'::text
            WHEN h.precio IS NOT NULL THEN 'historico'::text
            WHEN f.precio IS NOT NULL THEN 'factura'::text
            WHEN l.precio IS NOT NULL THEN 'lista'::text
            ELSE 'sin precio'::text
        END AS base
   FROM skus s
     LEFT JOIN reciente r ON r.cliente = s.cliente AND r.sku = s.sku
     LEFT JOIN historico h ON h.cliente = s.cliente AND h.sku = s.sku
     LEFT JOIN factura f ON f.cliente = s.cliente AND f.sku = s.sku
     LEFT JOIN lista l ON l.cliente = s.cliente AND l.sku = s.sku
) _v where public.es_interno() OR public.cliente_visible(cliente::text);
create or replace view public.v_sellout_sku_anio as select * from (
 SELECT sku,
    anio,
    max(marca) AS marca,
    max(categoria) AS categoria,
    count(DISTINCT cuenta) FILTER (WHERE importe <> 0::numeric) AS cuentas,
    ARRAY[round(sum(importe) FILTER (WHERE mes = 1)), round(sum(importe) FILTER (WHERE mes = 2)), round(sum(importe) FILTER (WHERE mes = 3)), round(sum(importe) FILTER (WHERE mes = 4)), round(sum(importe) FILTER (WHERE mes = 5)), round(sum(importe) FILTER (WHERE mes = 6)), round(sum(importe) FILTER (WHERE mes = 7)), round(sum(importe) FILTER (WHERE mes = 8)), round(sum(importe) FILTER (WHERE mes = 9)), round(sum(importe) FILTER (WHERE mes = 10)), round(sum(importe) FILTER (WHERE mes = 11)), round(sum(importe) FILTER (WHERE mes = 12))] AS importe,
    ARRAY[round(sum(cantidad) FILTER (WHERE mes = 1)), round(sum(cantidad) FILTER (WHERE mes = 2)), round(sum(cantidad) FILTER (WHERE mes = 3)), round(sum(cantidad) FILTER (WHERE mes = 4)), round(sum(cantidad) FILTER (WHERE mes = 5)), round(sum(cantidad) FILTER (WHERE mes = 6)), round(sum(cantidad) FILTER (WHERE mes = 7)), round(sum(cantidad) FILTER (WHERE mes = 8)), round(sum(cantidad) FILTER (WHERE mes = 9)), round(sum(cantidad) FILTER (WHERE mes = 10)), round(sum(cantidad) FILTER (WHERE mes = 11)), round(sum(cantidad) FILTER (WHERE mes = 12))] AS cantidad
   FROM mv_sellout_cuenta_sku_mes s
  WHERE sku IS NOT NULL
  GROUP BY sku, anio
) _v where public.es_interno();
create or replace view public.v_sellout_unificado as select * from (
 SELECT 'mayoreo'::text AS canal_sellout,
    g.mayorista AS fuente,
    g.cliente_nombre AS cliente_final,
    g.fecha,
    g.anio,
    g.mes,
    g.sku,
    g.importe,
    g.cantidad
   FROM sellout_general g
  WHERE (g.anio = ANY (ARRAY[2025, 2026])) AND g.importe IS NOT NULL AND g.mayorista <> 'DICOTECH'::text
UNION ALL
 SELECT 'distribuidor'::text AS canal_sellout,
    upper(d.cliente) AS fuente,
    d.cliente AS cliente_final,
    d.fecha,
    EXTRACT(year FROM d.fecha)::integer AS anio,
    EXTRACT(month FROM d.fecha)::integer AS mes,
    d.no_parte AS sku,
    COALESCE(d.subtotal, d.total, 0::numeric) - COALESCE(d.descuento, 0::numeric) AS importe,
    d.cantidad
   FROM sellout_detalle d
  WHERE d.fecha IS NOT NULL AND COALESCE(d.subtotal, d.total) IS NOT NULL
UNION ALL
 SELECT 'distribuidor'::text AS canal_sellout,
    'PCEL'::text AS fuente,
    'PCEL'::text AS cliente_final,
    date_trunc('week'::text, make_date(sp.anio, 1, 4)::timestamp with time zone)::date + (sp.semana - 1) * 7 + 3 AS fecha,
    EXTRACT(year FROM date_trunc('week'::text, make_date(sp.anio, 1, 4)::timestamp with time zone)::date + (sp.semana - 1) * 7 + 3)::integer AS anio,
    EXTRACT(month FROM date_trunc('week'::text, make_date(sp.anio, 1, 4)::timestamp with time zone)::date + (sp.semana - 1) * 7 + 3)::integer AS mes,
    COALESCE(NULLIF(upper(TRIM(BOTH FROM sp.modelo)), ''::text), psm.sku_acteck, sp.sku) AS sku,
    sp.vta_semana::numeric * COALESCE(pl.precio, psm.costo_promedio, sp.costo_promedio, 0::numeric) AS importe,
    sp.vta_semana AS cantidad
   FROM sellout_pcel sp
     LEFT JOIN pcel_sku_map psm ON psm.sku_pcel = sp.sku
     LEFT JOIN v_precio_pcel_sku pl ON pl.sku = COALESCE(NULLIF(upper(TRIM(BOTH FROM sp.modelo)), ''::text), psm.sku_acteck)
  WHERE (sp.anio = ANY (ARRAY[2025, 2026])) AND sp.vta_semana IS NOT NULL AND sp.vta_semana > 0
UNION ALL
 SELECT 'directo'::text AS canal_sellout,
        CASE
            WHEN fc.cliente_nombre ~~* '%MERCADO LIBRE%'::text THEN 'MERCADO LIBRE'::text
            WHEN fc.cliente_nombre ~~* '%AMAZON%'::text THEN 'AMAZON'::text
            WHEN fc.cliente_nombre ~~* '%CYBERPU%'::text THEN 'CYBERPUERTA'::text
            WHEN fc.cliente_nombre ~~* '%SITIO WEB%'::text THEN 'SITIO WEB'::text
            WHEN fc.canal = 'MOSTRADOR'::text THEN 'MOSTRADOR'::text
            ELSE fc.canal
        END AS fuente,
    fc.cliente_nombre AS cliente_final,
    make_date(fc.anio, fc.mes, 15) AS fecha,
    fc.anio,
    fc.mes,
    fc.sku,
    fc.monto AS importe,
    fc.piezas AS cantidad
   FROM facturacion_clientes fc
  WHERE (fc.canal = ANY (ARRAY['MOSTRADOR'::text, 'E-COMMERCE'::text])) AND (fc.anio = ANY (ARRAY[2025, 2026]))
UNION ALL
 SELECT 'distribuidor'::text AS canal_sellout,
    upper(e.cliente) AS fuente,
    e.cliente AS cliente_final,
    e.fecha,
    EXTRACT(year FROM e.fecha)::integer AS anio,
    EXTRACT(month FROM e.fecha)::integer AS mes,
    e.sku,
    e.cantidad * COALESCE(pp.precio_prom, 0::numeric) AS importe,
    e.cantidad
   FROM sellout_ensambles e
     LEFT JOIN v_sellout_precio_prom_sku pp ON pp.cliente = e.cliente AND pp.sku = e.sku
  WHERE e.fecha IS NOT NULL AND e.sku IS NOT NULL
) _v where public.es_interno();
create or replace view public.v_sellout_vendedores_resumen_mes as select * from (
 WITH m AS (
         SELECT mv_sellout_vendedor_mes.cuenta,
            mv_sellout_vendedor_mes.anio,
            mv_sellout_vendedor_mes.mes,
            mv_sellout_vendedor_mes.vendedor,
            mv_sellout_vendedor_mes.importe,
            mv_sellout_vendedor_mes.anio * 12 + mv_sellout_vendedor_mes.mes AS idx
           FROM mv_sellout_vendedor_mes
        ), act AS (
         SELECT c.cuenta,
            c.anio,
            c.mes,
            c.idx,
            c.importe,
            p1.vendedor IS NOT NULL AS repite,
            p1.vendedor IS NOT NULL AND p2.vendedor IS NOT NULL AS recurrente
           FROM m c
             LEFT JOIN m p1 ON p1.cuenta = c.cuenta AND p1.idx = (c.idx - 1) AND p1.vendedor = c.vendedor
             LEFT JOIN m p2 ON p2.cuenta = c.cuenta AND p2.idx = (c.idx - 2) AND p2.vendedor = c.vendedor
        ), res AS (
         SELECT act.cuenta,
            act.anio,
            act.mes,
            act.idx,
            count(*) AS activos,
            count(*) FILTER (WHERE NOT act.repite) AS nuevos,
            count(*) FILTER (WHERE act.recurrente) AS recurrentes,
            sum(act.importe) AS importe
           FROM act
          GROUP BY act.cuenta, act.anio, act.mes, act.idx
        ), perdidos AS (
         SELECT x.cuenta,
            x.idx + 1 AS idx,
            count(*) AS perdidos
           FROM m x
          WHERE NOT (EXISTS ( SELECT 1
                   FROM m y
                  WHERE y.cuenta = x.cuenta AND y.idx = (x.idx + 1) AND y.vendedor = x.vendedor))
          GROUP BY x.cuenta, (x.idx + 1)
        )
 SELECT r.cuenta,
    r.anio,
    r.mes,
    r.activos,
    r.nuevos,
    COALESCE(pd.perdidos, 0::bigint) AS perdidos,
    r.recurrentes,
    r.importe
   FROM res r
     LEFT JOIN perdidos pd ON pd.cuenta = r.cuenta AND pd.idx = r.idx
) _v where public.es_interno() OR public.cliente_visible(cuenta::text);
create or replace view public.v_sku_compras_historico as select * from (
 WITH compras AS (
         SELECT embarques_compras.codigo AS sku,
            embarques_compras.po,
            embarques_compras.fecha_emision,
            embarques_compras.arribo_cedis,
            embarques_compras.po_qty,
            embarques_compras.shp_qty,
            embarques_compras.cbm,
            embarques_compras.contenedor,
            embarques_compras.estatus
           FROM embarques_compras
          WHERE embarques_compras.codigo IS NOT NULL AND embarques_compras.codigo <> ''::text AND COALESCE(embarques_compras.estatus, ''::text) !~~* '%rechazada%'::text AND COALESCE(embarques_compras.estatus, ''::text) !~~* '%cancel%'::text
        ), sku_po AS (
         SELECT compras.sku,
            compras.po,
            max(compras.fecha_emision) AS fecha_emision,
            max(compras.arribo_cedis) AS arribo_cedis,
            sum(COALESCE(compras.po_qty, 0))::integer AS po_qty,
            avg(NULLIF(compras.cbm, 0::numeric)) AS cbm_avg,
            count(DISTINCT NULLIF(compras.contenedor, ''::text))::integer AS num_contenedores
           FROM compras
          GROUP BY compras.sku, compras.po
        ), contenedores_consolidacion AS (
         SELECT compras.contenedor,
            count(DISTINCT compras.sku) AS skus_distintos
           FROM compras
          WHERE compras.contenedor IS NOT NULL AND compras.contenedor <> ''::text
          GROUP BY compras.contenedor
        ), sku_consolidacion AS (
         SELECT c.sku,
            avg(cc.skus_distintos) AS skus_por_contenedor_prom
           FROM compras c
             JOIN contenedores_consolidacion cc ON cc.contenedor = c.contenedor
          WHERE c.contenedor IS NOT NULL AND c.contenedor <> ''::text
          GROUP BY c.sku
        ), ultima AS (
         SELECT DISTINCT ON (sku_po.sku) sku_po.sku,
            sku_po.fecha_emision AS ultima_fecha_emision,
            sku_po.arribo_cedis AS ultima_fecha_arribo,
            sku_po.po_qty AS ultima_po_qty,
            sku_po.num_contenedores AS ultima_num_contenedores,
            sku_po.po AS ultima_po
           FROM sku_po
          ORDER BY sku_po.sku, sku_po.fecha_emision DESC NULLS LAST, sku_po.po DESC
        )
 SELECT sp.sku,
    count(*)::integer AS num_compras,
    round(avg(sp.po_qty))::integer AS po_qty_promedio,
    avg(sp.cbm_avg) AS cbm_promedio,
    round(avg(NULLIF(sp.num_contenedores, 0)), 1) AS contenedores_promedio,
    round(avg(
        CASE
            WHEN sp.num_contenedores > 0 THEN sp.po_qty::numeric / sp.num_contenedores::numeric
            ELSE NULL::numeric
        END))::integer AS piezas_por_contenedor,
    u.ultima_po,
    u.ultima_fecha_emision,
    u.ultima_fecha_arribo,
    u.ultima_po_qty,
    u.ultima_num_contenedores,
    COALESCE(sc.skus_por_contenedor_prom, 1::numeric) AS skus_por_contenedor,
    COALESCE(avg(sp.cbm_avg), 1::numeric) < 0.05 OR COALESCE(sc.skus_por_contenedor_prom, 1::numeric) >= 5::numeric AS es_consolidado
   FROM sku_po sp
     JOIN ultima u ON u.sku = sp.sku
     LEFT JOIN sku_consolidacion sc ON sc.sku = sp.sku
  GROUP BY sp.sku, u.ultima_po, u.ultima_fecha_emision, u.ultima_fecha_arribo, u.ultima_po_qty, u.ultima_num_contenedores, sc.skus_por_contenedor_prom
) _v where public.es_interno();
create or replace view public.v_telemetria_cliente_dia as select * from (
 SELECT user_id,
    (ts AT TIME ZONE 'America/Mexico_City'::text)::date AS dia,
    cliente,
    count(*) FILTER (WHERE tipo = 10)::integer AS minutos,
    count(*) FILTER (WHERE tipo <> 10)::integer AS acciones
   FROM eventos_usuario
  WHERE cliente IS NOT NULL
  GROUP BY user_id, ((ts AT TIME ZONE 'America/Mexico_City'::text)::date), cliente
) _v where public.es_interno() OR public.cliente_visible(cliente::text);
create or replace view public.v_telemetria_dia as select * from (
 SELECT user_id,
    (ts AT TIME ZONE 'America/Mexico_City'::text)::date AS dia,
    count(*)::integer AS eventos_total,
    count(*) FILTER (WHERE tipo <> 10)::integer AS acciones,
    count(*) FILTER (WHERE tipo = 10)::integer AS heartbeats,
    round(count(*) FILTER (WHERE tipo = 10)::numeric, 0) AS minutos_activos,
    min(ts) AS primer_evento,
    max(ts) AS ultimo_evento
   FROM eventos_usuario
  GROUP BY user_id, ((ts AT TIME ZONE 'America/Mexico_City'::text)::date)
) _v where public.es_interno();
create or replace view public.v_telemetria_hora as select * from (
 SELECT user_id,
    (ts AT TIME ZONE 'America/Mexico_City'::text)::date AS dia,
    EXTRACT(dow FROM (ts AT TIME ZONE 'America/Mexico_City'::text))::integer AS dia_semana,
    EXTRACT(hour FROM (ts AT TIME ZONE 'America/Mexico_City'::text))::integer AS hora,
    count(*) FILTER (WHERE tipo = 10)::integer AS minutos
   FROM eventos_usuario
  WHERE tipo = 10
  GROUP BY user_id, ((ts AT TIME ZONE 'America/Mexico_City'::text)::date), (EXTRACT(dow FROM (ts AT TIME ZONE 'America/Mexico_City'::text))::integer), (EXTRACT(hour FROM (ts AT TIME ZONE 'America/Mexico_City'::text))::integer)
) _v where public.es_interno();
create or replace view public.v_telemetria_pagina_dia as select * from (
 SELECT user_id,
    (ts AT TIME ZONE 'America/Mexico_City'::text)::date AS dia,
    pagina,
    count(*) FILTER (WHERE tipo = 10)::integer AS minutos,
    count(*) FILTER (WHERE tipo <> 10)::integer AS acciones
   FROM eventos_usuario
  WHERE pagina IS NOT NULL
  GROUP BY user_id, ((ts AT TIME ZONE 'America/Mexico_City'::text)::date), pagina
) _v where public.es_interno();
create or replace view public.v_transito_sku as select * from (
 WITH concluido AS (
         SELECT embarques_compras.po,
            embarques_compras.codigo,
            sum(COALESCE(embarques_compras.shp_qty, embarques_compras.po_qty)) AS shp_llegado
           FROM embarques_compras
          WHERE embarques_compras.estatus = 'CONCLUIDO'::text AND embarques_compras.codigo IS NOT NULL AND embarques_compras.po IS NOT NULL
          GROUP BY embarques_compras.po, embarques_compras.codigo
        ), transito_raw AS (
         SELECT embarques_compras.po,
            embarques_compras.codigo,
            embarques_compras.supplier,
            embarques_compras.arribo_cedis,
            embarques_compras.etd,
            embarques_compras.eta_puerto,
            embarques_compras.cedis,
            embarques_compras.entrega_directa_cliente,
            embarques_compras.contenedor,
            COALESCE(embarques_compras.shp_qty, embarques_compras.po_qty) AS qty_row,
            embarques_compras.po_qty,
            embarques_compras.estatus
           FROM embarques_compras
          WHERE embarques_compras.codigo IS NOT NULL AND (embarques_compras.estatus = ANY (ARRAY['EN PRODUCCION'::text, 'PROXIMO A ZARPAR'::text, 'TRANSITO MARITIMO'::text, 'EN ESPERA DE CONSOLIDAR'::text, 'EN RESGUARDO'::text, 'Pendiente modular'::text])) AND (embarques_compras.entrega_directa_cliente IS NULL OR embarques_compras.entrega_directa_cliente = ''::text)
        ), por_po AS (
         SELECT t.po,
            t.codigo,
            max(t.supplier) AS supplier,
            max(t.po_qty) AS po_total,
            COALESCE(max(c.shp_llegado), 0::bigint) AS llegado,
            sum(t.qty_row) AS shp_reportado,
            LEAST(GREATEST(max(t.po_qty) - COALESCE(max(c.shp_llegado), 0::bigint), 0::bigint), sum(t.qty_row))::integer AS pendiente,
            min(t.arribo_cedis) AS eta_min,
            max(t.arribo_cedis) AS eta_max,
            min(t.etd) AS etd_min,
            min(t.eta_puerto) AS eta_puerto_min,
            max(t.cedis) AS cedis,
            max(t.contenedor) AS contenedor,
            max(t.entrega_directa_cliente) AS entrega_directa_cliente,
            (array_agg(t.estatus ORDER BY (
                CASE t.estatus
                    WHEN 'TRANSITO MARITIMO'::text THEN 1
                    WHEN 'PROXIMO A ZARPAR'::text THEN 2
                    WHEN 'EN RESGUARDO'::text THEN 3
                    WHEN 'EN ESPERA DE CONSOLIDAR'::text THEN 4
                    WHEN 'EN PRODUCCION'::text THEN 5
                    WHEN 'Pendiente modular'::text THEN 6
                    ELSE 9
                END)))[1] AS estatus_principal
           FROM transito_raw t
             LEFT JOIN concluido c ON c.po = t.po AND c.codigo = t.codigo
          GROUP BY t.po, t.codigo
        )
 SELECT codigo AS sku,
    max(supplier) AS supplier,
    sum(pendiente)::integer AS cantidad,
    min(eta_min) AS eta_mas_cercana,
    max(eta_max) AS eta_mas_lejana,
    count(*) FILTER (WHERE pendiente > 0)::integer AS embarques,
    COALESCE(jsonb_agg(jsonb_build_object('po', po, 'estatus', estatus_principal, 'cantidad', pendiente, 'eta', eta_min, 'etd', etd_min, 'eta_puerto', eta_puerto_min, 'cedis', cedis, 'contenedor', contenedor, 'directo_cliente', entrega_directa_cliente) ORDER BY eta_min) FILTER (WHERE pendiente > 0), '[]'::jsonb) AS embarques_detalle
   FROM por_po
  GROUP BY codigo
) _v where public.es_interno();
create or replace view public.v_ventas_mensuales_agg as select * from (
 WITH si AS (
         SELECT sell_in_sku_legacy.cliente,
            sell_in_sku_legacy.anio,
            sell_in_sku_legacy.mes,
            sum(sell_in_sku_legacy.monto_pesos) AS sell_in
           FROM sell_in_sku_legacy
          GROUP BY sell_in_sku_legacy.cliente, sell_in_sku_legacy.anio, sell_in_sku_legacy.mes
        ), so AS (
         SELECT sellout_sku.cliente,
            sellout_sku.anio,
            sellout_sku.mes,
            sum(sellout_sku.monto_pesos) AS sell_out
           FROM sellout_sku
          GROUP BY sellout_sku.cliente, sellout_sku.anio, sellout_sku.mes
        )
 SELECT COALESCE(si.cliente, so.cliente) AS cliente,
    COALESCE(si.anio, so.anio) AS anio,
    COALESCE(si.mes, so.mes) AS mes,
    COALESCE(si.sell_in, 0::numeric) AS sell_in,
    COALESCE(so.sell_out, 0::numeric) AS sell_out
   FROM si
     FULL JOIN so ON si.cliente = so.cliente AND si.anio = so.anio AND si.mes = so.mes
) _v where public.es_interno() OR public.cliente_visible(cliente::text);
create or replace view public.v_ventas_vendedor_cliente_mes as select * from (
 SELECT anio,
    mes,
    vendedor,
    cliente_key,
    cliente,
    cliente_nombre,
    fact_neta,
    piezas,
    renglones
   FROM mv_ventas_vendedor_cliente_mes
) _v where public.es_interno() OR public.cliente_visible(cliente_key::text);
create or replace view public.v_vision_camino_agotados as select * from (
 WITH inv_com AS (
         SELECT i.articulo,
            sum(i.disponible) AS stock
           FROM inventario_acteck i
             JOIN almacenes_config a_1 ON a_1.no_almacen = i.no_almacen
          WHERE a_1.comercial = true
          GROUP BY i.articulo
        ), venta_recent AS (
         SELECT DISTINCT ventas_erp.articulo
           FROM ventas_erp
          WHERE ventas_erp.periodo >= (CURRENT_DATE - '90 days'::interval) AND ventas_erp.piezas > 0::numeric
        ), agotados AS (
         SELECT i.articulo
           FROM inv_com i
          WHERE i.stock = 0::numeric AND (i.articulo IN ( SELECT venta_recent.articulo
                   FROM venta_recent))
        ), con_orden AS (
         SELECT c.articulo,
            min(c.movid) AS movid,
            min(COALESCE(e.arribo_cedis, e.eta_puerto)) AS eta_min,
            sum(c.cantidad_pendiente)::bigint AS pzs_camino
           FROM compras_oc c
             LEFT JOIN embarques_compras e ON e.po = c.movid AND e.codigo = c.articulo
          WHERE (c.articulo IN ( SELECT agotados.articulo
                   FROM agotados)) AND c.cantidad_pendiente > 0::numeric
          GROUP BY c.articulo
        )
 SELECT a.articulo,
    COALESCE(co.pzs_camino, 0::bigint) AS pzs_camino,
    co.movid,
    co.eta_min::text AS eta_estimada,
        CASE
            WHEN co.eta_min IS NULL THEN '-1'::integer
            WHEN co.eta_min <= CURRENT_DATE THEN 0
            ELSE co.eta_min - CURRENT_DATE
        END AS dias_para_llegar
   FROM agotados a
     LEFT JOIN con_orden co ON co.articulo = a.articulo
  ORDER BY co.eta_min
) _v where public.es_interno();
create or replace view public.v_vision_camino_calendario as select * from (
 SELECT date_trunc('month'::text, eta_puerto::timestamp with time zone)::date AS mes,
    count(DISTINCT movid) AS pos,
    count(DISTINCT articulo) AS skus,
    sum(piezas)::bigint AS piezas,
    round(sum(valor_mxn), 2) AS valor_mxn
   FROM v_vision_camino_lineas
  WHERE eta_puerto >= CURRENT_DATE AND (bucket_estatus <> ALL (ARRAY['concluido'::text, 'rechazado'::text, 'sin_embarque'::text]))
  GROUP BY (date_trunc('month'::text, eta_puerto::timestamp with time zone)::date)
  ORDER BY (date_trunc('month'::text, eta_puerto::timestamp with time zone)::date)
) _v where public.es_interno();
create or replace view public.v_vision_camino_compras_ytd as select * from (
 WITH base AS (
         SELECT EXTRACT(year FROM embarques_compras.fecha_emision)::integer AS anio,
            EXTRACT(month FROM embarques_compras.fecha_emision)::integer AS mes,
            embarques_compras.po,
            embarques_compras.codigo,
            embarques_compras.po_qty,
            embarques_compras.unit_price
           FROM embarques_compras
          WHERE embarques_compras.fecha_emision IS NOT NULL AND embarques_compras.po_qty > 0 AND embarques_compras.unit_price > 0::numeric
        ), max_mes_actual AS (
         SELECT EXTRACT(month FROM CURRENT_DATE)::integer AS m_actual
        )
 SELECT base.anio,
    count(DISTINCT base.po) AS pos,
    count(DISTINCT base.codigo) AS skus,
    sum(base.po_qty) AS piezas,
    round(sum(base.po_qty::numeric * base.unit_price * 17.95), 2) AS valor_mxn
   FROM base,
    max_mes_actual
  WHERE base.mes <= max_mes_actual.m_actual
  GROUP BY base.anio
  ORDER BY base.anio DESC
) _v where public.es_interno();
create or replace view public.v_vision_camino_leadtime as select * from (
 SELECT round(avg(arribo_cedis - fecha_emision), 0)::integer AS lt_total,
    round(avg(COALESCE(etd, eta_puerto) - fecha_emision), 0)::integer AS lt_produccion,
    round(avg(eta_puerto - etd), 0)::integer AS lt_transito,
    round(avg(arribo_cedis - eta_puerto), 0)::integer AS lt_aduana,
    count(*)::integer AS muestras
   FROM embarques_compras
  WHERE fecha_emision IS NOT NULL AND arribo_cedis IS NOT NULL AND etd IS NOT NULL AND eta_puerto IS NOT NULL AND arribo_cedis > fecha_emision AND fecha_emision >= '2025-01-01'::date
) _v where public.es_interno();
create or replace view public.v_vision_camino_proveedores as select * from (
 SELECT proveedor,
    count(DISTINCT movid) AS pos,
    sum(cantidad_pendiente)::bigint AS piezas,
    round(sum(cantidad_pendiente * costo_usd * tipocambio), 2) AS valor_mxn
   FROM compras_oc c
  WHERE cantidad_pendiente > 0::numeric AND proveedor IS NOT NULL
  GROUP BY proveedor
  ORDER BY (round(sum(cantidad_pendiente * costo_usd * tipocambio), 2)) DESC
) _v where public.es_interno();
create or replace view public.v_vision_camino_proximas as select * from (
 SELECT movid,
    max(proveedor) AS proveedor,
    min(eta_puerto) AS eta_puerto,
    min(arribo_cedis) AS eta_cedis,
    max(bucket_estatus) AS bucket_estatus,
    count(DISTINCT articulo) AS skus,
    sum(piezas)::bigint AS piezas,
    round(sum(valor_mxn), 2) AS valor_mxn
   FROM v_vision_camino_lineas
  WHERE bucket_estatus <> ALL (ARRAY['concluido'::text, 'rechazado'::text, 'sin_embarque'::text])
  GROUP BY movid
  ORDER BY (min(COALESCE(eta_puerto, '2099-01-01'::date)))
) _v where public.es_interno();
create or replace view public.v_vision_camino_resumen as select * from (
 SELECT bucket_estatus,
    count(DISTINCT movid) AS pos,
    sum(piezas)::bigint AS piezas,
    round(sum(valor_mxn), 2) AS valor_mxn
   FROM v_vision_camino_lineas
  GROUP BY bucket_estatus
) _v where public.es_interno();
create or replace view public.v_vision_camino_retrasadas as select * from (
 WITH ec AS (
         SELECT embarques_compras.po,
            embarques_compras.codigo,
            embarques_compras.estatus,
            embarques_compras.eta_puerto
           FROM embarques_compras
          WHERE embarques_compras.eta_puerto IS NOT NULL AND embarques_compras.eta_puerto < CURRENT_DATE AND (upper(COALESCE(embarques_compras.estatus, ''::text)) <> ALL (ARRAY['CONCLUIDO'::text, 'COMPRA RECHAZADA/COMPRA PERDIDA'::text]))
        )
 SELECT c.movid,
    max(c.proveedor) AS proveedor,
    count(DISTINCT c.articulo) AS skus,
    round(sum(c.cantidad_pendiente * c.costo_usd * c.tipocambio), 2) AS valor_mxn,
    min(ec.eta_puerto)::text AS eta_vencida,
    CURRENT_DATE - min(ec.eta_puerto) AS dias_retraso,
    CURRENT_DATE - min(c.fecha_emision) AS dias_desde_emision
   FROM compras_oc c
     JOIN ec ON ec.po = c.movid AND ec.codigo = c.articulo
  WHERE c.cantidad_pendiente > 0::numeric
  GROUP BY c.movid
  ORDER BY (CURRENT_DATE - min(ec.eta_puerto)) DESC
) _v where public.es_interno();
create or replace view public.v_vision_camino_semanal as select * from (
 SELECT date_trunc('week'::text, COALESCE(e.arribo_cedis, e.eta_puerto)::timestamp with time zone)::date AS semana,
    count(DISTINCT c.movid) AS pos,
    count(DISTINCT c.articulo) AS skus,
    sum(c.cantidad_pendiente)::bigint AS piezas,
    round(sum(c.cantidad_pendiente * c.costo_usd * c.tipocambio), 2) AS valor_mxn
   FROM compras_oc c
     JOIN embarques_compras e ON e.po = c.movid AND e.codigo = c.articulo
  WHERE c.cantidad_pendiente > 0::numeric AND COALESCE(e.arribo_cedis, e.eta_puerto) >= CURRENT_DATE AND (upper(COALESCE(e.estatus, ''::text)) <> ALL (ARRAY['CONCLUIDO'::text, 'COMPRA RECHAZADA/COMPRA PERDIDA'::text]))
  GROUP BY (date_trunc('week'::text, COALESCE(e.arribo_cedis, e.eta_puerto)::timestamp with time zone)::date)
  ORDER BY (date_trunc('week'::text, COALESCE(e.arribo_cedis, e.eta_puerto)::timestamp with time zone)::date)
) _v where public.es_interno();
create or replace view public.v_vision_canal_mensual as select * from (
 SELECT anio,
    mes,
    canal,
    COALESCE(admin_interna, canal) AS admin_interna,
    round(sum(monto_venta_pesos), 2) AS monto,
    sum(piezas)::integer AS piezas,
    count(DISTINCT cliente_nombre) AS n_clientes
   FROM ventas_erp
  WHERE canal IS NOT NULL AND canal <> 'x'::text AND anio IS NOT NULL AND mes >= 1 AND mes <= 12
  GROUP BY anio, mes, canal, admin_interna
) _v where public.es_interno();
create or replace view public.v_vision_cartera_consolidada as select * from (
 WITH ultimos AS (
         SELECT DISTINCT ON (estados_cuenta.cliente) estados_cuenta.cliente,
            estados_cuenta.anio,
            estados_cuenta.semana,
            estados_cuenta.fecha_corte,
            estados_cuenta.saldo_actual,
            estados_cuenta.saldo_vencido,
            estados_cuenta.aging_d0_30,
            estados_cuenta.aging_d31_60,
            estados_cuenta.aging_d61_90,
            estados_cuenta.aging_mas90,
            estados_cuenta.dso
           FROM estados_cuenta
          ORDER BY estados_cuenta.cliente, estados_cuenta.anio DESC, estados_cuenta.semana DESC
        )
 SELECT cliente,
    fecha_corte,
    saldo_actual,
    saldo_vencido,
    aging_d0_30,
    aging_d31_60,
    aging_d61_90,
    aging_mas90,
    dso
   FROM ultimos
) _v where public.es_interno() OR public.cliente_visible(cliente::text);
create or replace view public.v_vision_factura_canal as select * from (
 SELECT anio,
    mes,
    COALESCE(canal, 'SIN CANAL'::text) AS canal,
    round(sum(monto), 2) AS venta,
    sum(piezas)::bigint AS piezas,
    count(DISTINCT cliente_nombre) AS n_clientes
   FROM facturacion_clientes
  WHERE anio IS NOT NULL AND mes >= 1 AND mes <= 12
  GROUP BY anio, mes, canal
) _v where public.es_interno();
create or replace view public.v_vision_factura_clientes as select * from (
 SELECT anio,
    canal,
    cliente_nombre,
    venta,
    piezas,
    meses_activos
   FROM mv_vision_factura_clientes
) _v where public.es_interno();
create or replace view public.v_vision_inventario_global as select * from (
 SELECT valor_inventario,
    piezas_disponibles,
    skus_con_stock,
    skus_agotados,
    ultima_carga
   FROM mv_vision_inventario_global
) _v where public.es_interno();
create or replace view public.v_vision_inventario_marca as select * from (
 WITH sku_marca AS (
         SELECT roadmap_sku.sku AS articulo,
            roadmap_sku.marca
           FROM roadmap_sku
          WHERE roadmap_sku.marca IS NOT NULL AND roadmap_sku.marca <> ''::text
        ), inv AS (
         SELECT i_1.articulo,
            sum(i_1.disponible) AS piezas,
            sum(i_1.costodisponible) AS valor
           FROM inventario_acteck i_1
             JOIN almacenes_config a ON a.no_almacen = i_1.no_almacen
          WHERE a.comercial = true AND i_1.disponible > 0::numeric
          GROUP BY i_1.articulo
        )
 SELECT COALESCE(NULLIF(upper(TRIM(BOTH FROM s.marca)), ''::text), 'Sin marca'::text) AS marca,
    count(*)::integer AS skus,
    sum(i.piezas)::bigint AS piezas,
    round(sum(i.valor), 2) AS valor
   FROM inv i
     LEFT JOIN sku_marca s ON s.articulo = i.articulo
  GROUP BY (upper(TRIM(BOTH FROM s.marca)))
) _v where public.es_interno();
create or replace view public.v_vision_sellout_canal as select * from (
 SELECT anio,
    canal_sellout,
    importe,
    clientes_finales,
    skus
   FROM mv_vision_sellout_canal
) _v where public.es_interno();
create or replace view public.v_vision_sellout_mayoristas as select * from (
 SELECT anio,
    mayorista,
    importe,
    clientes_finales,
    skus,
    canal_sellout
   FROM mv_vision_sellout_mayoristas
) _v where public.es_interno() OR (upper(mayorista) = 'DICOTECH' AND public.cliente_visible('dicotech'));
create or replace view public.v_vision_sellout_mensual as select * from (
 SELECT anio,
    mes,
    canal_sellout,
    importe
   FROM mv_vision_sellout_mensual
) _v where public.es_interno();
create or replace view public.v_vision_sellout_promos as select * from (
 SELECT campania,
    skus_campania,
    sellout_en_promo,
    sellout_fuera_promo,
    sellout_promo_mes_prev
   FROM mv_vision_sellout_promos
) _v where public.es_interno();
create or replace view public.v_vision_sellout_promos_top_skus as select * from (
 WITH promos_activas AS (
         SELECT promos_temporada.sku,
            promos_temporada.promo_pct
           FROM promos_temporada
          WHERE promos_temporada.anio = EXTRACT(year FROM CURRENT_DATE)::integer AND promos_temporada.mes = EXTRACT(month FROM CURRENT_DATE)::integer
        )
 SELECT su.sku,
    pa.promo_pct,
    sum(su.importe) AS importe,
    sum(su.cantidad) AS piezas
   FROM v_sellout_unificado su
     JOIN promos_activas pa ON su.sku = pa.sku
  WHERE su.anio = EXTRACT(year FROM CURRENT_DATE)::integer AND su.mes = EXTRACT(month FROM CURRENT_DATE)::integer
  GROUP BY su.sku, pa.promo_pct
) _v where public.es_interno();
create or replace view public.v_vision_sellout_rotacion as select * from (
 SELECT mayorista,
    sellin_lag_90d,
    sellout_ytd,
    rotacion_pct,
    sin_rotar
   FROM mv_vision_sellout_rotacion
) _v where public.es_interno() OR (upper(mayorista) = 'DICOTECH' AND public.cliente_visible('dicotech'));
create or replace view public.v_vision_sellout_top_clientes as select * from (
 SELECT anio,
    cliente_final,
    importe,
    skus,
    mayoristas_o_canales,
    fuente_principal
   FROM mv_vision_sellout_top_clientes
) _v where public.es_interno();
create or replace view public.v_vision_sellout_top_skus as select * from (
 SELECT anio,
    sku,
    importe,
    piezas,
    clientes,
    canales
   FROM mv_vision_sellout_top_skus
) _v where public.es_interno();
create or replace view public.v_vision_top_clientes as select * from (
 SELECT anio,
    cliente_nombre,
    canal,
    COALESCE(admin_interna, canal) AS admin_interna,
    round(sum(monto_venta_pesos), 2) AS monto,
    sum(piezas)::integer AS piezas,
    count(DISTINCT mes) AS meses_activos
   FROM ventas_erp
  WHERE cliente_nombre IS NOT NULL AND canal IS NOT NULL AND canal <> 'x'::text AND anio IS NOT NULL
  GROUP BY anio, cliente_nombre, canal, admin_interna
) _v where public.es_interno();
create or replace view public.vs_sellout_cuenta_sku_mes as select * from public.mv_sellout_cuenta_sku_mes where public.es_interno() OR public.cliente_visible(cuenta::text); grant select on public.vs_sellout_cuenta_sku_mes to anon, authenticated, service_role;
create or replace view public.vs_sellout_estado_mes as select * from public.mv_sellout_estado_mes where public.es_interno() OR public.cliente_visible(cuenta::text); grant select on public.vs_sellout_estado_mes to anon, authenticated, service_role;
create or replace view public.vs_sellout_cuenta_dia as select * from public.mv_sellout_cuenta_dia where public.es_interno() OR public.cliente_visible(cuenta::text); grant select on public.vs_sellout_cuenta_dia to anon, authenticated, service_role;
create or replace view public.vs_sellout_vendedor_mes as select * from public.mv_sellout_vendedor_mes where public.es_interno() OR public.cliente_visible(cuenta::text); grant select on public.vs_sellout_vendedor_mes to anon, authenticated, service_role;
create or replace view public.vs_sellout_sucursal_mes as select * from public.mv_sellout_sucursal_mes where public.es_interno() OR public.cliente_visible(cuenta::text); grant select on public.vs_sellout_sucursal_mes to anon, authenticated, service_role;
create or replace view public.vs_sellout_cliente_final_mes as select * from public.mv_sellout_cliente_final_mes where public.es_interno() OR public.cliente_visible(cuenta::text); grant select on public.vs_sellout_cliente_final_mes to anon, authenticated, service_role;
create or replace view public.vs_resumen_top_sku_mes as select * from public.mv_resumen_top_sku_mes where public.es_interno() OR public.cliente_visible(cliente_key::text); grant select on public.vs_resumen_top_sku_mes to anon, authenticated, service_role;
create or replace view public.vs_resumen_sellout_mes as select * from public.mv_resumen_sellout_mes where public.es_interno() OR public.cliente_visible(cliente::text); grant select on public.vs_resumen_sellout_mes to anon, authenticated, service_role;
create or replace view public.vs_resumen_inventario_semana as select * from public.mv_resumen_inventario_semana where public.es_interno() OR public.cliente_visible(cliente::text); grant select on public.vs_resumen_inventario_semana to anon, authenticated, service_role;
do $$ declare r record; begin for r in select matviewname from pg_matviews where schemaname='public' loop execute format('revoke select on public.%I from anon, authenticated', r.matviewname); end loop; end $$;
