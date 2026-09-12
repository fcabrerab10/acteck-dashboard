-- Sell Out consolidado (pantalla global) · capa agregada en Postgres · 2026-09-12
--
-- Problema: la pantalla necesita, por cuenta y por mes, sell out + YoY + YTD + dimensiones
-- (sucursales, vendedores, clientes finales, estados) y eso implicaba traer al navegador las
-- ~440 K filas de sellout_general / sellout_detalle. Aquí se agrega todo en MVs pequeñas.
--
-- Catálogo de cuentas (16):
--   12 mayoristas de sellout_general (DICOTECH se excluye ahí: su monto canónico es sellout_detalle)
--   + dicotech + digitalife + pcel (los 3 propios) + "directo" (mostrador + e-commerce de facturación).
--
-- Monto: SIEMPRE sin IVA, tal como lo entrega v_sellout_unificado / mv_sellout_unificado
-- (ver docs/CORRECCION_CLIENTES_20260912.md).

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · Catálogo de cuentas · mapeo mayorista (sellout_general) ↔ código ERP
--     El código ERP liga el sell out con el sell in (mv_analisis_cliente_mes.cliente).
-- ────────────────────────────────────────────────────────────────────────────
-- @@
create or replace view public.v_sellout_cuentas as
select * from (values
  -- cuenta        fuente (llave de mv_sellout_unificado)  nombre para pantalla                    canal            erp      propio  granularidad
  ('ct',          'CT INTERNACIONAL',          'CT INTERNACIONAL DEL NOROESTE',      'mayoreo',      '00183', false, 'dia'),
  ('cva',         'CVA',                       'COMERCIALIZADORA DE VALOR AGREGADO', 'mayoreo',      '00417', false, 'dia'),
  ('guc',         'GRUPO UNIDADES DE COMPUTO', 'GRUPO UNIDADES DE COMPUTO',          'mayoreo',      '00335', false, 'dia'),
  ('ingram',      'INGRAM MICRO',              'INGRAM MICRO MEXICO',                'mayoreo',      '00226', false, 'dia'),
  ('arroba',      'ARROBA COMPUTERS',          'ARROBA COMPUTERS DISTRIBUCION',      'mayoreo',      '01145', false, 'dia'),
  ('techsmart',   'TECHS MART',                'TECHS MART DE MEXICO',               'mayoreo',      '00514', false, 'dia'),
  ('exel',        'EXEL DEL NORTE',            'EXEL DEL NORTE',                     'mayoreo',      '00676', false, 'dia'),
  ('dcmayorista', 'DC MAYORISTA',              'DC MAYORISTA',                       'mayoreo',      '00106', false, 'dia'),
  ('nsstore',     'GROUP NSSTORE',             'GROUP NSSTORE',                      'mayoreo',      '00748', false, 'dia'),
  ('loma',        'GRUPO LOMA DEL NORTE',      'GRUPO LOMA DEL NORTE',               'mayoreo',      '00662', false, 'dia'),
  ('pch',         'PCH MAYOREO',               'PCH MAYOREO',                        'mayoreo',      '00683', false, 'dia'),
  ('kabik',       'INTEGRADORA KABIK',         'INTEGRADORA KABIK',                  'mayoreo',      '07424', false, 'dia'),
  ('dicotech',    'DICOTECH',                  'DICOTECH MAYORISTA DE TECNOLOGIA',   'distribuidor', '00708', true,  'dia'),
  ('digitalife',  'DIGITALIFE',                'DIGITALIFE (API GLOBAL)',            'distribuidor', '00764', true,  'dia'),
  ('pcel',        'PCEL',                      'PCEL (PC ONLINE)',                   'distribuidor', '00473', true,  'semana'),
  ('directo',     '__DIRECTO__',               'MOSTRADOR + E-COMMERCE (DIRECTO)',   'directo',      null,    false, 'mes')
) as t(cuenta, fuente, nombre, canal_sellout, erp_cliente, propio, granularidad);

-- @@
comment on view public.v_sellout_cuentas is
  'Catálogo de las 16 cuentas de sell out y su código de cliente en el ERP. `fuente` es la llave que trae mv_sellout_unificado (mayorista de sellout_general, o DIGITALIFE/DICOTECH/PCEL). granularidad: dia | semana (PCEL, fecha = jueves de la semana ISO) | mes (directo, sin detalle diario).';

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · Normalización de estados (sellout_general.estado viene sucio)
--     Devuelve uno de los 32 nombres en MAYÚSCULAS SIN ACENTOS, o NULL ("Sin estado").
--     Los mismos nombres que src/modules/comercial/sellout/mexico-estados.json.
-- ────────────────────────────────────────────────────────────────────────────
-- @@
create or replace function public.normalizar_estado_mx(p text)
returns text language sql immutable parallel safe as $$
  with base as (
    select upper(translate(coalesce(trim(p), ''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')) as s
  ), fix as (
    select case
      when s is null or s = '' or length(s) <= 2 then null
      when s ~ '^E3[0-9]+$' then null
      when s like '%DISTRITO FEDERAL%' or s like '%CDMX%' or s like '%CIUDAD DE MEXICO%'
        or s like '%D.F.%' or s like '%XOCHIMILCO%' or s like '%BENITO JUAREZ%' then 'CIUDAD DE MEXICO'
      when s like 'EDO%MEX%' or s like '%ESTADO DE MEXICO%' or s = 'MEXICO'
        or s like '%TULTITLAN%' or s like '%TLANEPANTLA%' or s like '%TLALNEPANTLA%'
        or s like '%ATIZAPAN%' or s like '%NAUCALPAN%' then 'ESTADO DE MEXICO'
      when s like 'BAJA CALIFORNIA SUR%' then 'BAJA CALIFORNIA SUR'
      when s like 'BAJA CALIFORNIA%' then 'BAJA CALIFORNIA'
      when s like 'VERACRUZ%' then 'VERACRUZ'
      when s like 'MICHOACAN%' then 'MICHOACAN'
      when s like 'COAHUILA%' then 'COAHUILA'
      when s like 'QUERETARO%' then 'QUERETARO'
      when s like 'NUEVO LEON%' then 'NUEVO LEON'
      when s like 'SAN LUIS POTOSI%' then 'SAN LUIS POTOSI'
      when s like 'QUINTANA ROO%' then 'QUINTANA ROO'
      when s like 'YUCATAN%' then 'YUCATAN'
      when s like '%ATOTONILCO DE TULA%' or s like '%IXMIQUILPAN%' or s like '%TEPEAPULCO%' then 'HIDALGO'
      else s
    end as s
    from base
  )
  select e.nombre
  from fix
  left join lateral (
    select n as nombre
    from unnest(array[
      'AGUASCALIENTES','BAJA CALIFORNIA','BAJA CALIFORNIA SUR','CAMPECHE','CHIAPAS','CHIHUAHUA',
      'CIUDAD DE MEXICO','COAHUILA','COLIMA','DURANGO','ESTADO DE MEXICO','GUANAJUATO','GUERRERO',
      'HIDALGO','JALISCO','MICHOACAN','MORELOS','NAYARIT','NUEVO LEON','OAXACA','PUEBLA','QUERETARO',
      'QUINTANA ROO','SAN LUIS POTOSI','SINALOA','SONORA','TABASCO','TAMAULIPAS','TLAXCALA',
      'VERACRUZ','YUCATAN','ZACATECAS']) n
    where fix.s = n or fix.s like '%' || n || '%'
    order by length(n) desc
    limit 1
  ) e on true;
$$;

-- @@
comment on function public.normalizar_estado_mx(text) is
  'sellout_general.estado → uno de los 32 estados en MAYÚSCULAS SIN ACENTOS, o NULL cuando no se puede reconocer (códigos de 2 letras, claves E30xxxxx, ciudades sueltas). NULL = "Sin estado" en la pantalla.';

-- ────────────────────────────────────────────────────────────────────────────
-- 3 · Base: cada renglón de sell out con su cuenta.
--     `dia = 0` es el centinela de las fuentes sin detalle diario (directo): el MTD
--     del navegador incluye siempre dia = 0, así el YoY compara mes completo vs mes completo.
-- ────────────────────────────────────────────────────────────────────────────
-- @@
create or replace view public.v_sellout_base as
select
  coalesce(c.cuenta, 'otros')                                                   as cuenta,
  u.canal_sellout,
  u.fuente,
  u.cliente_final,
  u.fecha,
  u.anio,
  u.mes,
  case when u.canal_sellout = 'directo' then 0 else extract(day from u.fecha)::int end as dia,
  u.sku,
  u.importe,
  u.cantidad
from public.mv_sellout_unificado u
left join public.v_sellout_cuentas c
  on c.fuente = u.fuente
  or (u.canal_sellout = 'directo' and c.cuenta = 'directo');

-- Detalle del ERP del mayorista, ya con la cuenta resuelta. Dicotech entra por su vista
-- deduplicada; su MONTO no se usa (el canónico es sellout_detalle), sólo sus dimensiones.
-- @@
create or replace view public.v_sellout_general_cuenta as
select c.cuenta, g.anio, g.mes, g.fecha, g.cliente_nombre, g.vendedor_nombre, g.sucursal,
       g.estado, g.factura, g.sku, g.importe, g.cantidad, false as solo_dimensiones
from public.sellout_general g
join public.v_sellout_cuentas c on c.fuente = g.mayorista
where g.mayorista <> 'DICOTECH'
union all
select 'dicotech', g.anio, g.mes, g.fecha, g.cliente_nombre, g.vendedor_nombre, g.sucursal,
       g.estado, g.factura, g.sku, g.importe, g.cantidad, true
from public.v_sellout_general_dicotech g;

-- @@
comment on view public.v_sellout_general_cuenta is
  'sellout_general + v_sellout_general_dicotech con la cuenta resuelta. solo_dimensiones = true (Dicotech) significa que el importe de esta fuente NO es el canónico: sólo se usan sucursal / vendedor / cliente final / estado.';

-- ────────────────────────────────────────────────────────────────────────────
-- 4 · MVs
-- ────────────────────────────────────────────────────────────────────────────

-- 4.1 · Sell out por cuenta y día (MTD a mismo día · ~10 K filas)
-- @@
drop materialized view if exists public.mv_sellout_cuenta_dia cascade;
create materialized view public.mv_sellout_cuenta_dia as
select cuenta, anio, mes, dia,
       sum(importe)::numeric  as importe,
       sum(cantidad)::numeric as cantidad
from public.v_sellout_base
group by 1, 2, 3, 4;
-- @@
create unique index mv_sellout_cuenta_dia_pk on public.mv_sellout_cuenta_dia (cuenta, anio, mes, dia);
-- @@
create index mv_sellout_cuenta_dia_anio on public.mv_sellout_cuenta_dia (anio, mes);

-- 4.2 · Sell out por cuenta, SKU y mes (~60 K filas) · marca y categoría de v_articulo_rama
-- @@
drop materialized view if exists public.mv_sellout_cuenta_sku_mes cascade;
create materialized view public.mv_sellout_cuenta_sku_mes as
select b.cuenta, b.anio, b.mes, b.sku,
       coalesce(nullif(upper(r.marca), ''), 'SIN MARCA')      as marca,
       coalesce(nullif(r.categoria, ''), 'Sin categoría')      as categoria,
       coalesce(nullif(r.familia, ''), 'Sin familia')          as familia,
       sum(b.importe)::numeric  as importe,
       sum(b.cantidad)::numeric as cantidad
from public.v_sellout_base b
left join public.mv_articulo_rama r on r.articulo = b.sku
group by 1, 2, 3, 4, 5, 6, 7;
-- @@
create unique index mv_sellout_cuenta_sku_mes_pk on public.mv_sellout_cuenta_sku_mes (cuenta, anio, mes, sku);
-- @@
create index mv_sellout_cuenta_sku_mes_cuenta on public.mv_sellout_cuenta_sku_mes (cuenta, anio);
-- @@
create index mv_sellout_cuenta_sku_mes_mes on public.mv_sellout_cuenta_sku_mes (anio, mes);

-- 4.3 · Diccionario de estados. normalizar_estado_mx() es cara (lateral sobre 32 nombres)
--        y sellout_general tiene 440 K filas: se resuelve una vez por valor distinto (~90)
--        y el resto de las MVs hace join contra este diccionario.
-- @@
drop materialized view if exists public.mv_sellout_estado_norm cascade;
create materialized view public.mv_sellout_estado_norm as
select g.estado as estado_raw,
       coalesce(public.normalizar_estado_mx(g.estado), 'SIN ESTADO') as estado
from (select distinct estado from public.sellout_general) g;
-- @@
create unique index mv_sellout_estado_norm_pk on public.mv_sellout_estado_norm (estado_raw)
  where estado_raw is not null;
-- @@
create index mv_sellout_estado_norm_raw on public.mv_sellout_estado_norm (estado_raw);

-- El detalle del mayorista ya con el estado normalizado (columna añadida al final).
-- @@
create or replace view public.v_sellout_general_cuenta as
select c.cuenta, g.anio, g.mes, g.fecha, g.cliente_nombre, g.vendedor_nombre, g.sucursal,
       g.estado, g.factura, g.sku, g.importe, g.cantidad, false as solo_dimensiones,
       coalesce(n.estado, 'SIN ESTADO') as estado_norm
from public.sellout_general g
join public.v_sellout_cuentas c on c.fuente = g.mayorista
left join public.mv_sellout_estado_norm n on n.estado_raw is not distinct from g.estado
where g.mayorista <> 'DICOTECH'
union all
select 'dicotech', g.anio, g.mes, g.fecha, g.cliente_nombre, g.vendedor_nombre, g.sucursal,
       g.estado, g.factura, g.sku, g.importe, g.cantidad, true,
       coalesce(n.estado, 'SIN ESTADO')
from public.v_sellout_general_dicotech g
left join public.mv_sellout_estado_norm n on n.estado_raw is not distinct from g.estado;

-- 4.4 · Dimensiones por cuenta y mes (sólo lo que trae el ERP del mayorista)
-- @@
drop materialized view if exists public.mv_sellout_dim_cuenta_mes cascade;
create materialized view public.mv_sellout_dim_cuenta_mes as
select cuenta, anio, mes,
       count(distinct nullif(trim(cliente_nombre), ''))  as clientes_finales,
       count(distinct nullif(trim(vendedor_nombre), '')) as vendedores,
       count(distinct nullif(trim(sucursal), ''))        as sucursales,
       count(distinct nullif(trim(factura), ''))         as facturas,
       count(distinct estado_norm) filter (where estado_norm <> 'SIN ESTADO') as estados,
       sum(importe)::numeric                             as importe_fuente,
       sum(case when estado_norm = 'SIN ESTADO' then importe else 0 end)::numeric            as importe_sin_estado,
       sum(case when nullif(trim(cliente_nombre), '') is null then importe else 0 end)::numeric as importe_sin_cliente,
       bool_or(solo_dimensiones)                         as solo_dimensiones
from public.v_sellout_general_cuenta
group by 1, 2, 3;
-- @@
create unique index mv_sellout_dim_cuenta_mes_pk on public.mv_sellout_dim_cuenta_mes (cuenta, anio, mes);

-- 4.5 · Sell out por estado (~8 K filas)
-- @@
drop materialized view if exists public.mv_sellout_estado_mes cascade;
create materialized view public.mv_sellout_estado_mes as
select cuenta, anio, mes, estado_norm as estado,
       sum(importe)::numeric  as importe,
       sum(cantidad)::numeric as cantidad,
       count(distinct nullif(trim(cliente_nombre), ''))  as clientes_finales,
       count(distinct nullif(trim(vendedor_nombre), '')) as vendedores,
       count(distinct nullif(trim(factura), ''))         as facturas
from public.v_sellout_general_cuenta
group by 1, 2, 3, 4;
-- @@
create unique index mv_sellout_estado_mes_pk on public.mv_sellout_estado_mes (cuenta, anio, mes, estado);
-- @@
create index mv_sellout_estado_mes_mes on public.mv_sellout_estado_mes (anio, mes);

-- 4.6 · Clientes finales por cuenta y mes (~71 K filas) · el drill lee sólo su cuenta
-- @@
drop materialized view if exists public.mv_sellout_cliente_final_mes cascade;
create materialized view public.mv_sellout_cliente_final_mes as
select cuenta, anio, mes,
       trim(cliente_nombre) as cliente_final,
       sum(importe)::numeric  as importe,
       sum(cantidad)::numeric as cantidad,
       count(distinct nullif(trim(factura), '')) as facturas,
       count(distinct nullif(trim(sku), ''))     as skus,
       (array_agg(estado_norm order by importe desc nulls last))[1] as estado
from public.v_sellout_general_cuenta
where nullif(trim(cliente_nombre), '') is not null
group by 1, 2, 3, 4;
-- @@
create unique index mv_sellout_cliente_final_mes_pk on public.mv_sellout_cliente_final_mes (cuenta, anio, mes, cliente_final);
-- @@
create index mv_sellout_cliente_final_mes_cuenta on public.mv_sellout_cliente_final_mes (cuenta, anio);

-- 4.7 · Vendedores por cuenta y mes (~10 K filas)
-- @@
drop materialized view if exists public.mv_sellout_vendedor_mes cascade;
create materialized view public.mv_sellout_vendedor_mes as
select cuenta, anio, mes,
       trim(vendedor_nombre) as vendedor,
       sum(importe)::numeric  as importe,
       sum(cantidad)::numeric as cantidad,
       count(distinct nullif(trim(cliente_nombre), '')) as clientes,
       count(distinct nullif(trim(sku), ''))            as skus,
       count(distinct nullif(trim(factura), ''))        as facturas,
       (array_agg(nullif(trim(sucursal), '') order by importe desc nulls last))[1] as sucursal
from public.v_sellout_general_cuenta
where nullif(trim(vendedor_nombre), '') is not null
group by 1, 2, 3, 4;
-- @@
create unique index mv_sellout_vendedor_mes_pk on public.mv_sellout_vendedor_mes (cuenta, anio, mes, vendedor);
-- @@
create index mv_sellout_vendedor_mes_cuenta on public.mv_sellout_vendedor_mes (cuenta, anio);

-- 4.8 · Sucursales por cuenta y mes (~4 K filas)
-- @@
drop materialized view if exists public.mv_sellout_sucursal_mes cascade;
create materialized view public.mv_sellout_sucursal_mes as
select cuenta, anio, mes,
       trim(sucursal) as sucursal,
       sum(importe)::numeric  as importe,
       sum(cantidad)::numeric as cantidad,
       count(distinct nullif(trim(vendedor_nombre), '')) as vendedores,
       count(distinct nullif(trim(cliente_nombre), ''))  as clientes,
       count(distinct nullif(trim(factura), ''))         as facturas,
       (array_agg(nullif(trim(vendedor_nombre), '') order by importe desc nulls last))[1] as top_vendedor,
       (array_agg(estado_norm order by importe desc nulls last))[1] as estado
from public.v_sellout_general_cuenta
where nullif(trim(sucursal), '') is not null
group by 1, 2, 3, 4;
-- @@
create unique index mv_sellout_sucursal_mes_pk on public.mv_sellout_sucursal_mes (cuenta, anio, mes, sucursal);
-- @@
create index mv_sellout_sucursal_mes_cuenta on public.mv_sellout_sucursal_mes (cuenta, anio);

-- ────────────────────────────────────────────────────────────────────────────
-- 5 · Permisos (mismo patrón que el resto de MVs del proyecto)
-- ────────────────────────────────────────────────────────────────────────────
-- @@
grant select on public.v_sellout_cuentas, public.v_sellout_base, public.v_sellout_general_cuenta,
  public.mv_sellout_cuenta_dia, public.mv_sellout_cuenta_sku_mes, public.mv_sellout_dim_cuenta_mes,
  public.mv_sellout_estado_mes, public.mv_sellout_cliente_final_mes, public.mv_sellout_vendedor_mes,
  public.mv_sellout_sucursal_mes, public.mv_sellout_estado_norm
  to anon, authenticated, service_role;
