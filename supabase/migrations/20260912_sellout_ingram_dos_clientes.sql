-- Ingram son DOS clientes distintos · 2026-09-12 (Fernando)
--
-- En el ERP hay dos códigos con el MISMO nombre ("INGRAM MICRO MEXICO"):
--
--   00226  canal MAYOREO              → es el que reporta sell out por el puente
--                                       (sellout_general.mayorista = 'INGRAM MICRO')
--   04126  canal RETAIL REPRESENTADOS → sólo sell in; no manda sell out a nadie
--
-- Hasta hoy la pantalla de Sell Out consolidado sólo conocía 00226 y todo el sell in de
-- 04126 se perdía (o, peor, se sumaba al de mayoreo en facturacion_clientes). Aquí:
--
--   1 · v_sellout_cuentas gana la cuenta `ingram_retail` (04126) con `fuente = NULL`
--       (no hay fuente de sell out) y la columna `tiene_sellout` para que la pantalla
--       pinte "—" en vez de $0 en las columnas de sell out.
--   2 · v_sellout_cuenta_mes deja de exigir que la cuenta tenga sell out: las cuentas sin
--       fuente entran por los meses en que SÍ tienen sell in (mv_analisis_cliente_mes).
--   3 · refresh_facturacion_clientes() asigna el canal por CÓDIGO de cliente y no por
--       nombre, para que 00226 y 04126 no compartan canal en facturacion_clientes
--       (y por lo tanto tampoco en v_sellin_global_sku_canal_mes).
--
-- Ya estaban separados por código y no hace falta tocarlos:
--   · mv_analisis_cliente_mes / mv_analisis_cliente_sku_mes → GROUP BY COALESCE(cliente, cliente_nombre)
--   · v_sellin_global_sku_mes_erp / v_sellin_global_sku_anio_erp → grano artículo, sin cliente
--   · v_erp_medidas* → grano cliente_key + canal (mayoreo vs retail_representados)

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · Catálogo de cuentas (17): + ingram_retail, + columna tiene_sellout
-- ────────────────────────────────────────────────────────────────────────────
-- @@
create or replace view public.v_sellout_cuentas as
select cuenta, fuente, nombre, canal_sellout, erp_cliente, propio, granularidad,
       (fuente is not null) as tiene_sellout
from (values
  -- cuenta         fuente (llave de mv_sellout_unificado)  nombre para pantalla                  canal            erp      propio  granularidad
  ('ct',           'CT INTERNACIONAL',          'CT INTERNACIONAL DEL NOROESTE',      'mayoreo',      '00183', false, 'dia'),
  ('cva',          'CVA',                       'COMERCIALIZADORA DE VALOR AGREGADO', 'mayoreo',      '00417', false, 'dia'),
  ('guc',          'GRUPO UNIDADES DE COMPUTO', 'GRUPO UNIDADES DE COMPUTO',          'mayoreo',      '00335', false, 'dia'),
  ('ingram',       'INGRAM MICRO',              'INGRAM MICRO (MAYOREO)',             'mayoreo',      '00226', false, 'dia'),
  ('ingram_retail', null::text,                 'INGRAM MICRO (RETAIL REPRESENTADOS)','mayoreo',      '04126', false, 'mes'),
  ('arroba',       'ARROBA COMPUTERS',          'ARROBA COMPUTERS DISTRIBUCION',      'mayoreo',      '01145', false, 'dia'),
  ('techsmart',    'TECHS MART',                'TECHS MART DE MEXICO',               'mayoreo',      '00514', false, 'dia'),
  ('exel',         'EXEL DEL NORTE',            'EXEL DEL NORTE',                     'mayoreo',      '00676', false, 'dia'),
  ('dcmayorista',  'DC MAYORISTA',              'DC MAYORISTA',                       'mayoreo',      '00106', false, 'dia'),
  ('nsstore',      'GROUP NSSTORE',             'GROUP NSSTORE',                      'mayoreo',      '00748', false, 'dia'),
  ('loma',         'GRUPO LOMA DEL NORTE',      'GRUPO LOMA DEL NORTE',               'mayoreo',      '00662', false, 'dia'),
  ('pch',          'PCH MAYOREO',               'PCH MAYOREO',                        'mayoreo',      '00683', false, 'dia'),
  ('kabik',        'INTEGRADORA KABIK',         'INTEGRADORA KABIK',                  'mayoreo',      '07424', false, 'dia'),
  ('dicotech',     'DICOTECH',                  'DICOTECH MAYORISTA DE TECNOLOGIA',   'distribuidor', '00708', true,  'dia'),
  ('digitalife',   'DIGITALIFE',                'DIGITALIFE (API GLOBAL)',            'distribuidor', '00764', true,  'dia'),
  ('pcel',         'PCEL',                      'PCEL (PC ONLINE)',                   'distribuidor', '00473', true,  'semana'),
  ('directo',      '__DIRECTO__',               'MOSTRADOR + E-COMMERCE (DIRECTO)',   'directo',      null,    false, 'mes')
) as t(cuenta, fuente, nombre, canal_sellout, erp_cliente, propio, granularidad);

-- @@
comment on view public.v_sellout_cuentas is
  'Catálogo de las 17 cuentas de sell out y su código de cliente en el ERP. `fuente` es la llave que trae mv_sellout_unificado (mayorista de sellout_general, o DIGITALIFE/DICOTECH/PCEL); NULL = el cliente no reporta sell out a nadie (ingram_retail, 04126) y la pantalla pinta "—" en las columnas de sell out. tiene_sellout = fuente is not null. granularidad: dia | semana (PCEL, fecha = jueves de la semana ISO) | mes (directo y las cuentas sin fuente).';

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · v_sellout_cuenta_mes: las cuentas sin fuente entran por su sell in.
--     Mismo cuerpo que 20260912_sellout_global_vistas.sql salvo el CTE `p`: antes era
--     el agregado de mv_sellout_cuenta_dia unido con JOIN (interno) al catálogo, así que una
--     cuenta sin sell out no existía en la vista y su sell in no llegaba a la pantalla.
-- ────────────────────────────────────────────────────────────────────────────
-- @@
create or replace view public.v_sellout_cuenta_mes as
with p as (
  select cuenta, anio, mes, sum(importe)::numeric as importe, sum(cantidad)::numeric as cantidad
  from public.mv_sellout_cuenta_dia group by 1, 2, 3
  union all
  -- Cuentas sin fuente de sell out: entran por los meses en que tienen sell in, con importe 0.
  -- `union all` (no `union`): una cuenta con fuente NULL nunca aparece en mv_sellout_cuenta_dia
  -- (v_sellout_base une por `fuente`), así que no hay duplicados que quitar.
  select c2.cuenta, si2.anio, si2.mes, 0::numeric, 0::numeric
  from public.v_sellout_cuentas c2
  join public.mv_analisis_cliente_mes si2 on si2.cliente = c2.erp_cliente
  where c2.fuente is null
)
select c.cuenta, c.nombre, c.canal_sellout, c.erp_cliente, c.propio, c.granularidad,
       p.anio, p.mes,
       p.importe, p.cantidad,
       si.fact_neta           as sell_in,
       si.piezas_venta_neta   as sell_in_piezas,
       dim.clientes_finales, dim.vendedores, dim.sucursales, dim.facturas, dim.estados,
       dim.importe_sin_estado, dim.importe_sin_cliente, dim.importe_fuente,
       inv.valor  as inv_valor, inv.piezas as inv_piezas,
       inv.skus_con_stock as inv_skus, inv.skus_sin_venta_30 as inv_skus_sin_venta_30, inv.semana as inv_semana,
       cli.activos as cf_activos, cli.nuevos as cf_nuevos, cli.perdidos as cf_perdidos,
       cli.recompra_pct as cf_recompra_pct, cli.ticket_promedio as cf_ticket,
       ven.activos as vend_activos, ven.nuevos as vend_nuevos, ven.perdidos as vend_perdidos, ven.recurrentes as vend_recurrentes
from p
join public.v_sellout_cuentas c on c.cuenta = p.cuenta
left join public.mv_analisis_cliente_mes si
  on si.cliente = c.erp_cliente and si.anio = p.anio and si.mes = p.mes
left join public.mv_sellout_dim_cuenta_mes dim
  on dim.cuenta = c.cuenta and dim.anio = p.anio and dim.mes = p.mes
left join public.v_sellout_inventario_cuenta_mes inv
  on inv.cuenta = c.cuenta and inv.anio = p.anio and inv.mes = p.mes
left join public.v_sellout_clientes_resumen_mes cli
  on cli.cuenta = c.cuenta and cli.anio = p.anio and cli.mes = p.mes
left join public.v_sellout_vendedores_resumen_mes ven
  on ven.cuenta = c.cuenta and ven.anio = p.anio and ven.mes = p.mes;

-- @@
comment on view public.v_sellout_cuenta_mes is
  'Una fila por cuenta de sell out y mes: monto/piezas (sin IVA), sell in del ERP (fact neta del código de cliente de v_sellout_cuentas), dimensiones del mayorista, inventario en el cliente y resúmenes de clientes finales y vendedores. Las cuentas sin fuente de sell out (tiene_sellout = false) aparecen por los meses en que tienen sell in, con importe 0.';

-- @@
grant select on public.v_sellout_cuentas, public.v_sellout_cuenta_mes to anon, authenticated, service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 3 · facturacion_clientes: el canal se decide por CÓDIGO de cliente, no por nombre.
--     Antes, dos códigos con el mismo cliente_nombre (Ingram 00226 mayoreo y 04126
--     retail representados) compartían el canal más frecuente y cliente_key: los 14 M
--     de retail se contaban como mayoreo en Sell In consolidado.
--     Mismo cuerpo que 20260911_v_analisis_clientes.sql salvo el CTE canal_cli
--     (ahora por COALESCE(cliente, cliente_nombre)) y el GROUP BY del INSERT.
--     Ojo: sólo cambia a partir de la SIGUIENTE carga del ERP (el puente la llama
--     con finalize:'refresh_facturacion_clientes').
-- ────────────────────────────────────────────────────────────────────────────
-- @@
CREATE OR REPLACE FUNCTION public.refresh_facturacion_clientes(p_anios integer[] DEFAULT NULL)
RETURNS TABLE(anio integer, filas bigint, monto numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public SET statement_timeout = '300s' AS $$
DECLARE v_anios integer[];
BEGIN
  v_anios := COALESCE(p_anios, (SELECT array_agg(DISTINCT e.anio) FROM erp_ventas e WHERE e.anio IS NOT NULL));
  IF v_anios IS NULL OR array_length(v_anios, 1) IS NULL THEN RETURN; END IF;

  DELETE FROM facturacion_clientes f WHERE f.anio = ANY (v_anios);

  INSERT INTO facturacion_clientes (cliente_nombre, cliente_key, sku, anio, mes, piezas, monto, canal, uploaded_at)
  WITH canal_cli AS (
    -- Por CÓDIGO de cliente: dos códigos con el mismo nombre pueden vivir en canales distintos.
    SELECT COALESCE(e.cliente, e.cliente_nombre) AS cliente, e.anio,
           mode() WITHIN GROUP (ORDER BY e.canal) AS canal
    FROM erp_ventas e WHERE e.anio = ANY (v_anios)
    GROUP BY COALESCE(e.cliente, e.cliente_nombre), e.anio
  )
  SELECT e.cliente_nombre,
         CASE
           WHEN upper(e.cliente_nombre) LIKE '%CAJADL01%' OR upper(e.cliente_nombre) LIKE '%API GLOBAL%' THEN 'digitalife'
           WHEN upper(e.cliente_nombre) LIKE '%PC ONLINE%' THEN 'pcel'
           WHEN upper(e.cliente_nombre) LIKE '%DICOTECH%'  THEN 'dicotech'
           ELSE COALESCE(NULLIF(trim(BOTH '_' FROM regexp_replace(lower(c.canal), '[^a-z0-9]+', '_', 'g')), ''), 'otros')
         END AS cliente_key,
         e.articulo AS sku, e.anio, e.mes,
         SUM(CASE WHEN e.movimiento_venta IN ('Factura','Factura Com.Ext33','Devolucion Venta') THEN COALESCE(e.unidades, e.piezas, 0) ELSE 0 END) AS piezas,
         SUM(CASE WHEN e.movimiento_venta IN ('Factura','Factura Com.Ext33')
                    OR (e.movimiento_venta = 'Devolucion Venta' AND COALESCE(e.instruccion, '') NOT ILIKE 'nota credito')
                  THEN COALESCE(e.monto_venta_pesos, 0) ELSE 0 END) AS monto,
         c.canal, now()
  FROM erp_ventas e
  JOIN canal_cli c ON c.cliente = COALESCE(e.cliente, e.cliente_nombre) AND c.anio = e.anio
  WHERE e.anio = ANY (v_anios) AND e.articulo IS NOT NULL AND e.cliente_nombre IS NOT NULL AND e.mes IS NOT NULL
  GROUP BY e.cliente_nombre, e.articulo, e.anio, e.mes, c.canal;

  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_erp_medidas_cliente_mes;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_erp_medidas_canal_mes;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_vision_factura_dimension_mes;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_vision_factura_dimension_clientes;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_analisis_cliente_mes;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_analisis_cliente_sku_mes;

  RETURN QUERY SELECT f.anio, COUNT(*)::bigint, SUM(f.monto) FROM facturacion_clientes f WHERE f.anio = ANY (v_anios) GROUP BY f.anio ORDER BY f.anio;
END $$;

-- @@
comment on function public.refresh_facturacion_clientes(integer[]) is
  'Reconstruye facturacion_clientes desde erp_ventas (Fact Neta oficial) y refresca las MVs de medidas. Desde 2026-09-12 el canal se decide por código de cliente (antes por cliente_nombre, lo que unía Ingram 00226 mayoreo con 04126 retail representados).';
