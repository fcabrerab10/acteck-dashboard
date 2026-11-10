-- PCEL en el consolidado: el mes es el que reporta PCEL (2026-11-10)
-- La rama PCEL de v_sellout_unificado asignaba cada semana completa al mes de su jueves: octubre 2026 sumaba
-- 5 semanas (4,335 pz) cuando el reporte mensual de PCEL dice 3,848; septiembre al revés (2,915 vs 3,164).
-- Ahora cada semana se escala para que el mes de cada SKU sume lo de sellout_pcel_mensual (si existe); los
-- meses con mensual pero sin semanas (feb–abr 2026) entran con una fila al día 15. Sin mensual, queda la semana.
create or replace view public.v_sellout_unificado as
 SELECT canal_sellout,
    fuente,
    cliente_final,
    fecha,
    anio,
    mes,
    sku,
    importe,
    cantidad
   FROM ( SELECT 'mayoreo'::text AS canal_sellout,
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
            x.fecha,
            x.anio,
            x.mes,
            x.sku,
            (x.cantidad * x.precio) AS importe,
            x.cantidad
           FROM ( SELECT s.fecha, s.anio, s.mes, s.sku_out AS sku, s.precio,
                    CASE WHEN m.piezas IS NOT NULL AND s.tot_mes > 0 THEN (s.vta)::numeric * m.piezas / s.tot_mes ELSE (s.vta)::numeric END AS cantidad
                   FROM ( SELECT sp.sku AS sku_pcel,
                            ((date_trunc('week'::text, (make_date(sp.anio, 1, 4))::timestamp with time zone))::date + ((sp.semana - 1) * 7) + 3) AS fecha,
                            (EXTRACT(year FROM ((date_trunc('week'::text, (make_date(sp.anio, 1, 4))::timestamp with time zone))::date + ((sp.semana - 1) * 7) + 3)))::integer AS anio,
                            (EXTRACT(month FROM ((date_trunc('week'::text, (make_date(sp.anio, 1, 4))::timestamp with time zone))::date + ((sp.semana - 1) * 7) + 3)))::integer AS mes,
                            sp.vta_semana AS vta,
                            COALESCE(NULLIF(upper(TRIM(BOTH FROM sp.modelo)), ''::text), psm.sku_acteck, sp.sku) AS sku_out,
                            COALESCE(pl.precio, psm.costo_promedio, sp.costo_promedio, (0)::numeric) AS precio,
                            sum(sp.vta_semana) OVER (PARTITION BY sp.sku, (EXTRACT(year FROM ((date_trunc('week'::text, (make_date(sp.anio, 1, 4))::timestamp with time zone))::date + ((sp.semana - 1) * 7) + 3))), (EXTRACT(month FROM ((date_trunc('week'::text, (make_date(sp.anio, 1, 4))::timestamp with time zone))::date + ((sp.semana - 1) * 7) + 3)))) AS tot_mes
                           FROM ((sellout_pcel sp
                             LEFT JOIN pcel_sku_map psm ON ((psm.sku_pcel = sp.sku)))
                             LEFT JOIN v_precio_pcel_sku pl ON ((pl.sku = COALESCE(NULLIF(upper(TRIM(BOTH FROM sp.modelo)), ''::text), psm.sku_acteck))))
                          WHERE ((sp.anio = ANY (ARRAY[2025, 2026])) AND (sp.vta_semana IS NOT NULL) AND (sp.vta_semana > 0))) s
                     LEFT JOIN ( SELECT anio, mes, sku, sum(piezas) AS piezas FROM sellout_pcel_mensual GROUP BY anio, mes, sku) m ON ((m.anio = s.anio) AND (m.mes = s.mes) AND (m.sku = s.sku_pcel))
                UNION ALL
                 SELECT make_date(m.anio, m.mes, 15) AS fecha, m.anio, m.mes,
                    COALESCE(psm.sku_acteck, m.sku) AS sku,
                    COALESCE(pl.precio, psm.costo_promedio, (0)::numeric) AS precio,
                    (m.piezas)::numeric AS cantidad
                   FROM ((( SELECT anio, mes, sku, sum(piezas) AS piezas FROM sellout_pcel_mensual WHERE (anio = ANY (ARRAY[2025, 2026])) GROUP BY anio, mes, sku HAVING (sum(piezas) > (0)::numeric)) m
                     LEFT JOIN pcel_sku_map psm ON ((psm.sku_pcel = m.sku)))
                     LEFT JOIN v_precio_pcel_sku pl ON ((pl.sku = psm.sku_acteck)))
                  WHERE (NOT (EXISTS ( SELECT 1 FROM sellout_pcel sp
                          WHERE ((sp.sku = m.sku) AND (sp.vta_semana > 0) AND (sp.anio = ANY (ARRAY[2025, 2026]))
                            AND ((EXTRACT(year FROM ((date_trunc('week'::text, (make_date(sp.anio, 1, 4))::timestamp with time zone))::date + ((sp.semana - 1) * 7) + 3)))::integer = m.anio) AND ((EXTRACT(month FROM ((date_trunc('week'::text, (make_date(sp.anio, 1, 4))::timestamp with time zone))::date + ((sp.semana - 1) * 7) + 3)))::integer = m.mes)))))) x
          WHERE (x.cantidad > (0)::numeric)
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
          WHERE e.fecha IS NOT NULL AND e.sku IS NOT NULL) _v
  WHERE es_interno();;
