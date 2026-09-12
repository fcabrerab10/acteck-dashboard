-- Cuotas por cliente · mapa cuota ↔ cliente del ERP ↔ cuenta de Sell Out (2026-09-12)
--
-- `cuotas_mensuales.cliente` trae 29 slugs que pone el puente al leer RevkoBi (dbo.BP).
-- Hasta hoy sólo se usaban tres (digitalife, pcel, dicotech) y la suma global; el resto
-- llegaba todos los días y nadie lo veía (docs/DATOS_SIN_APROVECHAR.md §3).
--
-- Este mapa amarra cada slug con su CÓDIGO de cliente del ERP (erp_ventas.cliente,
-- mv_analisis_cliente_mes.cliente, v_sellout_cuentas.erp_cliente). Se amarra por código
-- y NO por nombre porque hay dos clientes con el mismo cliente_nombre ("INGRAM MICRO
-- MEXICO": 00226 mayoreo y 04126 retail representados) y dos nombres casi iguales
-- ("TECHS MART DE MEXICO" 00514 y "TECHSMART MAYOREO" 00682).
--
-- Notas del mapeo (verificado contra erp_ventas 2025-2026 el 2026-09-12):
--   · unicom → 00335 GRUPO UNIDADES DE COMPUTO. Es el único slug que NO coincide por
--     nombre: "Unicom" es el nombre comercial de Grupo Unidades de Cómputo (GUC), que es
--     además la cuenta de sell out `guc`. Si algún día RevkoBi cambia el nombre, corregir aquí.
--   · techs_mart → 00514 (cuota 2026 $18.4 M, venta 2026 $8.5 M) y techsmart → 00682
--     (cuota $2.8 M, venta $1.7 M): son DOS clientes distintos, no un duplicado.
--   · ingram → 00226 (mayoreo, el que reporta sell out) e ingram_retail → 04126
--     (retail representados, sólo sell in).
--   · Sin cuenta de sell out (cuenta_sellout = NULL): decme, svenska, stuffactory,
--     amazon, mercado_libre, techsmart, arrangoiz, keops, mavi, tony_tiendas, dsw,
--     dist._liverpool, zona_digital. Todos existen como cliente del ERP y salen en
--     Análisis por Cliente; simplemente no son una de las 17 cuentas de Sell Out.
--     `directo` (mostrador + e-commerce) se queda sin cuota a propósito: agrupa varios
--     clientes (Mercado Libre, Amazon, Cyberpuerta, mostrador…) y mezclar sus cuotas
--     daría un % de alcance falso.
--   · Los 29 slugs con cuota 2026 quedaron mapeados; ninguno sin cliente del ERP.
--   · Quedan FUERA del mapa 24 slugs históricos que sólo tuvieron cuota en 2023-2025 y
--     ya no se cargan: mlm_cliente_venta, amazon_vendor, le_tech, ventrotec, tecnomundo,
--     hastech, kmx, toconsa, dimatec, nona, bodesa, omicron, delta, sitio_web,
--     carmen_najera, ddtech, erick_vallejo, ilifi, ferrer, albose, mgss, soft_&hard,
--     lap_booster, maxmel. Si alguno vuelve a tener cuota, agregarlo aquí con su código.

-- @@
create or replace view public.v_cuota_cliente_erp as
select cuota_cliente, cliente_erp, cliente_nombre, cuenta_sellout
from (values
  ('ct',                '00183', 'CT INTERNACIONAL DEL NOROESTE',      'ct'),
  ('cva',               '00417', 'COMERCIALIZADORA DE VALOR AGREGADO', 'cva'),
  ('unicom',            '00335', 'GRUPO UNIDADES DE COMPUTO',          'guc'),
  ('ingram',            '00226', 'INGRAM MICRO MEXICO',                'ingram'),
  ('ingram_retail',     '04126', 'INGRAM MICRO MEXICO',                'ingram_retail'),
  ('arroba',            '01145', 'ARROBA COMPUTERS DISTRIBUCION',      'arroba'),
  ('techs_mart',        '00514', 'TECHS MART DE MEXICO',               'techsmart'),
  ('exel',              '00676', 'EXEL DEL NORTE',                     'exel'),
  ('dc',                '00106', 'DC MAYORISTA',                       'dcmayorista'),
  ('nsstore',           '00748', 'GROUP NSSTORE',                      'nsstore'),
  ('loma',              '00662', 'GRUPO LOMA DEL NORTE',               'loma'),
  ('pch',               '00683', 'PCH MAYOREO',                        'pch'),
  ('integradora_kabik', '07424', 'INTEGRADORA KABIK',                  'kabik'),
  ('dicotech',          '00708', 'DICOTECH MAYORISTA DE TECNOLOGIA',   'dicotech'),
  ('digitalife',        '00764', 'API GLOBAL',                         'digitalife'),
  ('pcel',              '00473', 'PC ONLINE',                          'pcel'),
  ('decme',             '00714', 'GRUPO DECME',                        null),
  ('svenska',           '00374', 'GRUPO SVENSKA',                      null),
  ('stuffactory',       '00652', 'STUFFACTORY',                        null),
  ('amazon',            '00936', 'CLIENTE VENTA EN LINEA AMAZON',      null),
  ('mercado_libre',     '00970', 'PUBLICO GENERAL MERCADO LIBRE',      null),
  ('techsmart',         '00682', 'TECHSMART MAYOREO',                  null),
  ('arrangoiz',         '00095', 'ARRANGOIZ COMPUTACION',              null),
  ('keops',             '02170', 'KEOPS COMPUTERS MEXICO',             null),
  ('mavi',              '00377', 'MAVI DE OCCIDENTE',                  null),
  ('tony_tiendas',      '00618', 'TONY TIENDAS',                       null),
  ('dsw',               '00952', 'GRUPO COMERCIAL DSW',                null),
  ('dist._liverpool',   '07264', 'DISTRIBUIDORA LIVERPOOL',            null),
  ('zona_digital',      '07398', 'ZONA DIGITAL 83',                    null)
) t(cuota_cliente, cliente_erp, cliente_nombre, cuenta_sellout);

-- @@
comment on view public.v_cuota_cliente_erp is
  'Mapa cuotas_mensuales.cliente → código de cliente del ERP → cuenta de v_sellout_cuentas. Se liga por código, nunca por nombre (Ingram 00226/04126 comparten cliente_nombre). unicom = 00335 Grupo Unidades de Cómputo (cuenta de sell out guc).';

-- @@
-- Cuota del mes ya traducida a código de cliente y a cuenta de sell out. Es lo que leen
-- la pantalla de Sell Out consolidado, Análisis por Cliente y sus versiones de celular.
create or replace view public.v_cuota_erp_mes as
select
  m.cuota_cliente,
  m.cliente_erp,
  m.cliente_nombre,
  m.cuenta_sellout,
  q.anio,
  q.mes,
  q.cuota_venta,
  q.cuota_minima,
  q.cuota_piezas,
  q.cuota_costo,
  q.cuota_contribucion
from public.v_cuota_cliente_erp m
join public.v_medidas_cuota_cliente_mes q on q.cliente_key = m.cuota_cliente;

-- @@
comment on view public.v_cuota_erp_mes is
  'v_medidas_cuota_cliente_mes + v_cuota_cliente_erp: cuota mensual por código de cliente del ERP y por cuenta de sell out. Los % de alcance se calculan al agregar (src/lib/medidas.js), nunca se suman.';

-- @@
grant select on public.v_cuota_cliente_erp to anon, authenticated;
-- @@
grant select on public.v_cuota_erp_mes to anon, authenticated;
-- @@
notify pgrst, 'reload schema';
