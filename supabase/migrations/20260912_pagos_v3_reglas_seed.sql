-- Pagos V3 · reglas iniciales por cliente (2026-09-12)
-- Los porcentajes se COPIAN TAL CUAL de `lineamientos_cliente` (fuente viva que usa
-- PagosCliente.jsx hoy). Nada aquí es inventado: si un valor no existía, la regla
-- queda en modo manual con nota. `lineamientos_cliente` NO se borra.

-- Idempotente: sólo siembra si la sección aún no tiene regla vigente.
create or replace function public.pagos_seed_regla(p_cliente text, p_seccion text, p_config jsonb, p_nota text)
returns void language plpgsql as $$
begin
  if not exists (select 1 from public.pagos_reglas where cliente = p_cliente and seccion = p_seccion and vigente_hasta is null) then
    insert into public.pagos_reglas (cliente, seccion, config, vigente_desde, creado_por, nota)
    values (p_cliente, p_seccion, p_config, date '2026-01-01', 'migración V3', p_nota);
  end if;
end $$;

-- ═══════════════ DIGITALIFE ═══════════════
select public.pagos_seed_regla('digitalife', 'rebate', jsonb_build_object(
  'frecuencia', 'trimestral',
  'base', 'sell_in_sku',
  'modo', 'por_categoria',
  'por_categoria', jsonb_build_object('monitores', 0.02, 'sillas', 0.02, 'accesorios', 0.03),
  'fechas_pago', jsonb_build_object('Q1','04-15','Q2','07-15','Q3','10-15','Q4','01-15'),
  'dia_calculo', 2
), 'Copiado de lineamientos_cliente(digitalife, rebate). Categoría que no sea monitores/sillas cae a accesorios (3 %).');

select public.pagos_seed_regla('digitalife', 'spiff', jsonb_build_object(
  'modo', 'flat_v2',
  'base', 'sell_out',
  'frecuencia', 'mensual',
  'flat_pct', 0.0018,
  'cuota_so_factor', 0.90,
  'min_alcance', 1.00,
  'tope_mensual', 4000,
  'cuota_anual', 23000000,
  'split_h1_h2', jsonb_build_array(0.40, 0.60),
  'dia_calculo', 2,
  'dia_pago', 15,
  'tiers_legacy', jsonb_build_array(
    jsonb_build_object('min_alcance', 0.90, 'pct', 0.0025),
    jsonb_build_object('min_alcance', 1.00, 'pct', 0.0030),
    jsonb_build_object('min_alcance', 1.20, 'pct', 0.0040))
), 'Copiado de lineamientos_cliente(digitalife, spiff). Cuota SO = cuota SI × 0.90; paga si alcance ≥ 100 % de esa cuota SO, monto = sell out × 0.18 %. tiers_legacy se conserva sin uso (modo flat_v2).');

select public.pagos_seed_regla('digitalife', 'fondo', jsonb_build_object(
  'fondos', jsonb_build_array(jsonb_build_object('fondo_key','mkt','nombre','Marketing','regla', jsonb_build_object('tipo','manual')))
), 'Digitalife no tiene regla de abono automático en el código actual: el fondo arranca en modo manual.');

select public.pagos_seed_regla('digitalife', 'fijos', jsonb_build_object(
  'conceptos', jsonb_build_array(jsonb_build_object('concepto','Stand Sucursal Chapalita','monto',10000,'dia',1,'meses','todos'))
), 'Tomado de los pagos fijos ya cargados en la tabla pagos (categoria=pagosFijos).');

-- ═══════════════ PCEL ═══════════════
select public.pagos_seed_regla('pcel', 'rebate', jsonb_build_object(
  'frecuencia', 'trimestral',
  'base', 'sell_in',
  'modo', 'niveles',
  'requiere_alcance_minimo', 0.90,
  'dia_calculo', 2,
  'tiers', jsonb_build_array(
    jsonb_build_object('min_alcance', 0.90, 'pct', 0.010, 'label', '90-105.99%'),
    jsonb_build_object('min_alcance', 1.06, 'pct', 0.015, 'label', '106-119.99%'),
    jsonb_build_object('min_alcance', 1.20, 'pct', 0.020, 'label', '≥120%'))
), 'Copiado de lineamientos_cliente(pcel, rebate).');

select public.pagos_seed_regla('pcel', 'spiff', jsonb_build_object(
  'modo', 'pct_fijo',
  'base', 'sell_in',
  'frecuencia', 'mensual',
  'pct_fijo', 0.0021,
  'requiere_alcance_minimo', 0.90,
  'dia_calculo', 2,
  'dia_pago', 15
), 'Copiado de lineamientos_cliente(pcel, spiff).');

select public.pagos_seed_regla('pcel', 'fondo', jsonb_build_object(
  'fondos', jsonb_build_array(jsonb_build_object('fondo_key','mkt','nombre','Marketing','regla', jsonb_build_object(
    'tipo','pct_sell_in','pct',0.01,'frecuencia','trimestral','alcance_minimo_pct',100,'acumula_multianio',true))),
  'tiers_legacy', jsonb_build_array(
    jsonb_build_object('max_alcance', 1.0599, 'pct', 0.0100, 'label', 'Hasta 105.99%'),
    jsonb_build_object('max_alcance', 1.1999, 'pct', 0.0125, 'label', 'Hasta 119.99%'),
    jsonb_build_object('max_alcance', 99, 'pct', 0.0150, 'label', '120% en adelante'))
), 'Copiado de lineamientos_cliente(pcel, fondo_mkt). tiers_legacy = PCEL_REAL.fondoMktTiers de constants.js (fallback del código viejo).');

-- ═══════════════ DICOTECH ═══════════════
select public.pagos_seed_regla('dicotech', 'rebate', jsonb_build_object(
  'nombre_oficial', 'Fondo para Generación Sell Out',
  'frecuencia', 'mensual',
  'base', 'sell_in',
  'modo', 'niveles',
  'alcance_minimo_pago', 0.90,
  'permite_pago_manual', true,
  'dia_calculo', 2,
  'dia_pago', 15,
  'tiers', jsonb_build_array(
    jsonb_build_object('min_alcance', 0.90, 'pct', 0.02, 'label', '90% a 114.99%'),
    jsonb_build_object('min_alcance', 1.15, 'pct', 0.02, 'label', '115% a 129.99%'),
    jsonb_build_object('min_alcance', 1.30, 'pct', 0.02, 'label', '130% a 149.99%'),
    jsonb_build_object('min_alcance', 1.50, 'pct', 0.03, 'label', '150% en adelante'))
), 'Copiado de lineamientos_cliente(dicotech, rebate). Regla especial confirmada por Fernando: alcance > 150 % paga 3 %.');

select public.pagos_seed_regla('dicotech', 'spiff', jsonb_build_object(
  'modo', 'flat_v2',
  'base', 'sell_in',
  'frecuencia', 'mensual',
  'compradora_pct', 0.003,
  'dia_calculo', 2,
  'dia_pago', 15
), 'Copiado de lineamientos_cliente(dicotech, spiff): SPIFF compradora = 0.30 % del sell in del mes.');

select public.pagos_seed_regla('dicotech', 'dinamica', jsonb_build_object(
  'activa', true,
  'base', 'v_sellout_general_dicotech',
  'premiados', 5,
  'dia_calculo', 2,
  'nota', 'Meta y premios se capturan cada mes en pagos_dinamica_mes.'
), 'Migrado de lineamientos_cliente(dicotech, spiff).vendedores_meses. Agosto 2026: meta $110,000 sin IVA y 5 premios.');

select public.pagos_seed_regla('dicotech', 'fondo', jsonb_build_object(
  'fondos', jsonb_build_array(
    jsonb_build_object('fondo_key','mkt','nombre','Marketing (cliente)','regla', jsonb_build_object(
      'tipo','pct_sell_in_tiers','base_alcance','cuota_minima_interna','alcance_referencia','q_acumulado',
      'pct_fallback_q_bajo', 0.0075,
      'tiers', jsonb_build_array(
        jsonb_build_object('min_alcance_q', 0.90, 'pct', 0.0075, 'label', '90% a 114.99%'),
        jsonb_build_object('min_alcance_q', 1.15, 'pct', 0.0100, 'label', '115% a 129.99%'),
        jsonb_build_object('min_alcance_q', 1.30, 'pct', 0.0125, 'label', '130% en adelante')))),
    jsonb_build_object('fondo_key','interno','nombre','Fondo interno (no visible al cliente)','regla', jsonb_build_object(
      'tipo','pct_sell_in','pct',0.01,'visible_para_cliente',false))),
  'plan_mkt_contratado', jsonb_build_object('monto_mensual', 14007.14, 'orden_descuento', jsonb_build_array('mkt','interno'))
), 'Copiado de lineamientos_cliente(dicotech, fondo_mkt).');

-- ═══════════════ Destinatarios de correo (global) ═══════════════
-- Se usan para pre-llenar Para/CC del texto que genera "Copiar correo".
select public.pagos_seed_regla('_global', 'destinatarios', jsonb_build_object(
  'firmas', jsonb_build_object(
    'fernando', jsonb_build_object('nombre','Fernando','correo','fernando.cabrera@acteck.com'),
    'karolina', jsonb_build_object('nombre','Karolina','correo',null)),
  'copia_siempre', jsonb_build_array(
    jsonb_build_object('nombre','David Millán','correo','david.millan@acteck.com'),
    jsonb_build_object('nombre','Karolina','correo',null)),
  'por_tipo', jsonb_build_object(
    'spiff',      jsonb_build_object('saludo','Hola Lucy buenos días','para', jsonb_build_array(jsonb_build_object('nombre','Lucía','correo',null))),
    'dinamica',   jsonb_build_object('saludo','Hola Lucy buenos días','para', jsonb_build_array(jsonb_build_object('nombre','Lucía','correo',null))),
    'rebate',     jsonb_build_object('saludo','Hola equipo buenos días','para', jsonb_build_array(
                     jsonb_build_object('nombre','Luis Fernando Sánchez','correo',null),
                     jsonb_build_object('nombre','Crédito y Cobranza','correo','credito.cobranza@acteck.com'))),
    'marketing',  jsonb_build_object('saludo','Hola Luis Fer, buen día','para', jsonb_build_array(
                     jsonb_build_object('nombre','Luis Fernando Sánchez','correo',null))),
    'default',    jsonb_build_object('saludo','Buen día','para', jsonb_build_array(
                     jsonb_build_object('nombre','Luis Fernando Sánchez','correo',null),
                     jsonb_build_object('nombre','Crédito y Cobranza','correo','credito.cobranza@acteck.com'))))
), 'Destinatarios sugeridos por tipo de pago. Los correos que aún no conozco quedan en null: se capturan desde Reglas por cliente.');

-- ═══════════════ Fondos por cliente (tabla operativa) ═══════════════
insert into public.pagos_fondos (cliente, fondo_key, nombre, regla) values
  ('digitalife','mkt','Marketing', '{"tipo":"manual"}'::jsonb),
  ('pcel','mkt','Marketing', '{"tipo":"pct_sell_in","pct":0.01,"frecuencia":"trimestral","alcance_minimo_pct":100}'::jsonb),
  ('pcel','directo','Fondo directo', '{"tipo":"manual"}'::jsonb),
  ('dicotech','mkt','Marketing (cliente)', '{"tipo":"pct_sell_in_tiers","pct_fallback_q_bajo":0.0075}'::jsonb),
  ('dicotech','interno','Fondo interno', '{"tipo":"pct_sell_in","pct":0.01,"visible_para_cliente":false}'::jsonb)
on conflict (cliente, fondo_key) do nothing;

-- ═══════════════ Dinámica de vendedores ya capturada (agosto 2026) ═══════════════
insert into public.pagos_dinamica_mes (cliente, anio, mes, meta, premios, nota, creado_por)
select 'dicotech', 2026, 8, 110000,
  jsonb_build_array(
    jsonb_build_object('pos',1,'premio','Tarjeta Amazon $2,500'),
    jsonb_build_object('pos',2,'premio','Tarjeta Amazon $1,500'),
    jsonb_build_object('pos',3,'premio','Tarjeta Amazon $1,000'),
    jsonb_build_object('pos',4,'premio','Tarjeta Amazon $500'),
    jsonb_build_object('pos',5,'premio','Power Bank')),
  'Migrado de lineamientos_cliente(dicotech, spiff).vendedores_meses["2026-08"]', 'migración V3'
on conflict (cliente, anio, mes) do nothing;

drop function if exists public.pagos_seed_regla(text, text, jsonb, text);
