-- 2026-10-08 · Endurecer el acceso de usuarios EXTERNOS (Fernando en junta con Digitalife: «que Camilo sólo vea lo suyo y
-- nunca nuestro margen»). Hallazgo: la interfaz ya oculta margen/costo, pero por la API (misma anon key + su JWT) un externo
-- podía leer erp_ventas de todos los clientes, estados de resultados, pagos, costos promedio y las vistas de medidas.
--   1) es_interno(): super admin o perfil activo con tipo <> 'externo'; service_role y sesiones sin JWT (refrescos, cron) → true.
--   2) cliente_visible(ck): el cliente tiene alguna pestaña en 'ver'/'edit' para este usuario (o es interno).
--   3) Políticas abiertas (qual = true / auth.role() = 'authenticated') → es_interno() o alcance por cliente.
--   4) Vistas internas (medidas, visión, inventario a costo, S&OP) → WHERE es_interno(); vistas que el cliente sí usa →
--      columnas de costo/contribución en NULL para externos (CASE) y filas sólo de sus clientes.
--   5) Las MVs con costo/contribución ya no se leen con anon/authenticated (la app las lee por sus vistas; mv_analisis_* pasan
--      a v_analisis_cliente_mes / v_analisis_cliente_sku_mes).
-- El puente y el cron usan service_role (ignoran RLS y pasan es_interno()). Verificado simulando a Camilo, Karolina y David.

create or replace function public.es_interno() returns boolean language sql stable security definer set search_path = public as $$
  select case
    when coalesce(current_setting('request.jwt.claims', true), '') = '' then true                     -- sin JWT: psql, refrescos, cron dentro de la base
    when (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role' then true   -- puente / cron de Vercel
    when auth.uid() is null then false                                                                -- anon
    else exists (select 1 from public.perfiles p where p.user_id = auth.uid() and p.activo = true and coalesce(p.estado,'activo') <> 'suspendido'
                 and (p.es_super_admin = true or coalesce(p.tipo, 'interno') <> 'externo'))
  end;
$$;
revoke all on function public.es_interno() from public; grant execute on function public.es_interno() to anon, authenticated, service_role;

create or replace function public.cliente_visible(ck text) returns boolean language sql stable security definer set search_path = public as $$
  select public.es_interno() or (ck is not null and exists (
    select 1 from public.perfiles p, jsonb_each_text(coalesce(p.permisos->'clientes'->lower(ck), '{}'::jsonb)) e
    where p.user_id = auth.uid() and p.activo = true and e.value in ('ver','edit')));
$$;
revoke all on function public.cliente_visible(text) from public; grant execute on function public.cliente_visible(text) to anon, authenticated, service_role;

-- user_can_see_cliente devolvía TRUE con cliente nulo o vacío (sellout_general entero, filas sin cliente): ahora sólo internos.
create or replace function public.user_can_see_cliente(cliente_key text) returns boolean language plpgsql stable security definer as $$
declare perfil_row record; cliente_perms jsonb; pestana text;
begin
  if cliente_key is null or cliente_key = '' then return public.es_interno(); end if;
  select es_super_admin, permisos, tipo, activo into perfil_row from public.perfiles where user_id = auth.uid();
  if not found then return public.es_interno(); end if;
  if perfil_row.es_super_admin then return true; end if;
  if coalesce(perfil_row.tipo,'interno') <> 'externo' and perfil_row.activo then return true; end if;
  cliente_perms := perfil_row.permisos -> 'clientes' -> lower(cliente_key);
  if cliente_perms is null then return false; end if;
  for pestana in select jsonb_object_keys(cliente_perms) loop
    if cliente_perms ->> pestana in ('ver','edit') then return true; end if;
  end loop;
  return false;
end; $$;

drop policy if exists "erp_ventas_all" on public.erp_ventas;
create policy "erp_ventas_all" on public.erp_ventas for ALL to public using (public.es_interno()) with check (public.es_interno());
drop policy if exists "fact_all" on public.facturacion_clientes;
create policy "fact_all" on public.facturacion_clientes for ALL to public using (public.es_interno()) with check (public.es_interno());
drop policy if exists "edc_all" on public.estados_cuenta;
create policy "edc_all" on public.estados_cuenta for ALL to public using (public.es_interno()) with check (public.es_interno());
drop policy if exists "edc_detalle_all" on public.estados_cuenta_detalle;
create policy "edc_detalle_all" on public.estados_cuenta_detalle for ALL to public using (public.es_interno()) with check (public.es_interno());
drop policy if exists "sellout_pcel_all" on public.sellout_pcel;
create policy "sellout_pcel_all" on public.sellout_pcel for ALL to public using (public.es_interno()) with check (public.es_interno());
drop policy if exists "fondo_pcel_all" on public.fondo_pcel_movimientos;
create policy "fondo_pcel_all" on public.fondo_pcel_movimientos for ALL to public using (public.es_interno()) with check (public.es_interno());
drop policy if exists "forecast_avisos_all" on public.forecast_avisos;
create policy "forecast_avisos_all" on public.forecast_avisos for ALL to public using (public.es_interno()) with check (public.es_interno());
drop policy if exists "forecast_lineas_all" on public.forecast_propuesta_lineas;
create policy "forecast_lineas_all" on public.forecast_propuesta_lineas for ALL to public using (public.es_interno()) with check (public.es_interno());
drop policy if exists "forecast_propuestas_all" on public.forecast_propuestas;
create policy "forecast_propuestas_all" on public.forecast_propuestas for ALL to public using (public.es_interno()) with check (public.es_interno());
drop policy if exists "solcom_all" on public.solicitudes_compra;
create policy "solcom_all" on public.solicitudes_compra for ALL to public using (public.es_interno()) with check (public.es_interno());
drop policy if exists "solcom_lin_all" on public.solicitudes_compra_lineas;
create policy "solcom_lin_all" on public.solicitudes_compra_lineas for ALL to public using (public.es_interno()) with check (public.es_interno());
drop policy if exists "sync_status_write" on public.sync_status;
create policy "sync_status_write" on public.sync_status for ALL to public using (public.es_interno()) with check (public.es_interno());
drop policy if exists "inv_cli_suc write all" on public.inventario_cliente_sucursal;
create policy "inv_cli_suc write all" on public.inventario_cliente_sucursal for ALL to public using (public.es_interno()) with check (public.es_interno());
drop policy if exists "oc_clientes write all" on public.oc_clientes;
create policy "oc_clientes write all" on public.oc_clientes for ALL to public using (public.es_interno()) with check (public.es_interno());
drop policy if exists "oc_clientes read all" on public.oc_clientes;
create policy "oc_clientes read all" on public.oc_clientes for SELECT to public using (public.es_interno());
drop policy if exists "oc_clientes_skus write all" on public.oc_clientes_skus;
create policy "oc_clientes_skus write all" on public.oc_clientes_skus for ALL to public using (public.es_interno()) with check (public.es_interno());
drop policy if exists "oc_clientes_skus read all" on public.oc_clientes_skus;
create policy "oc_clientes_skus read all" on public.oc_clientes_skus for SELECT to public using (public.es_interno());
drop policy if exists "oc_cotizaciones write all" on public.oc_cotizaciones;
create policy "oc_cotizaciones write all" on public.oc_cotizaciones for ALL to public using (public.es_interno()) with check (public.es_interno());
drop policy if exists "oc_cotizaciones read all" on public.oc_cotizaciones;
create policy "oc_cotizaciones read all" on public.oc_cotizaciones for SELECT to public using (public.es_interno());
drop policy if exists "oc_envio_skus write all" on public.oc_envio_skus;
create policy "oc_envio_skus write all" on public.oc_envio_skus for ALL to public using (public.es_interno()) with check (public.es_interno());
drop policy if exists "oc_envio_skus read all" on public.oc_envio_skus;
create policy "oc_envio_skus read all" on public.oc_envio_skus for SELECT to public using (public.es_interno());
drop policy if exists "oc_envios write all" on public.oc_envios;
create policy "oc_envios write all" on public.oc_envios for ALL to public using (public.es_interno()) with check (public.es_interno());
drop policy if exists "oc_envios read all" on public.oc_envios;
create policy "oc_envios read all" on public.oc_envios for SELECT to public using (public.es_interno());
drop policy if exists "oc_factura_skus write all" on public.oc_factura_skus;
create policy "oc_factura_skus write all" on public.oc_factura_skus for ALL to public using (public.es_interno()) with check (public.es_interno());
drop policy if exists "oc_factura_skus read all" on public.oc_factura_skus;
create policy "oc_factura_skus read all" on public.oc_factura_skus for SELECT to public using (public.es_interno());
drop policy if exists "oc_facturas write all" on public.oc_facturas;
create policy "oc_facturas write all" on public.oc_facturas for ALL to public using (public.es_interno()) with check (public.es_interno());
drop policy if exists "oc_facturas read all" on public.oc_facturas;
create policy "oc_facturas read all" on public.oc_facturas for SELECT to public using (public.es_interno());
drop policy if exists "lc_all" on public.lineamientos_cliente;
create policy "lc_all" on public.lineamientos_cliente for ALL to public using (public.es_interno() OR public.cliente_visible(cliente)) with check (public.es_interno());
drop policy if exists "sellout_pcel_select" on public.sellout_pcel;
create policy "sellout_pcel_select" on public.sellout_pcel for SELECT to authenticated using (public.es_interno());
drop policy if exists "authenticated_read" on public.estados_resultados;
create policy "authenticated_read" on public.estados_resultados for SELECT to authenticated using (public.es_interno());
drop policy if exists "compras_oc anon select" on public.compras_oc;
create policy "compras_oc anon select" on public.compras_oc for SELECT to public using (public.es_interno());
drop policy if exists "compras_oc_auth" on public.compras_oc;
create policy "compras_oc_auth" on public.compras_oc for SELECT to authenticated using (public.es_interno());
drop policy if exists "embarques_read" on public.embarques_compras;
create policy "embarques_read" on public.embarques_compras for SELECT to public using (public.es_interno());
drop policy if exists "guias_erp_read_all" on public.guias_erp;
create policy "guias_erp_read_all" on public.guias_erp for SELECT to public using (public.es_interno());
drop policy if exists "Anon read inventario_acteck" on public.inventario_acteck;
create policy "Anon read inventario_acteck" on public.inventario_acteck for SELECT to anon using (public.es_interno());
drop policy if exists "inventario_historico_read" on public.inventario_historico;
create policy "inventario_historico_read" on public.inventario_historico for SELECT to authenticated using (public.es_interno());
drop policy if exists "inventario_cliente read all" on public.inventario_cliente;
create policy "inventario_cliente read all" on public.inventario_cliente for SELECT to public using (public.es_interno());
drop policy if exists "pagos_bitacora_read" on public.pagos_bitacora;
create policy "pagos_bitacora_read" on public.pagos_bitacora for SELECT to public using (public.es_interno());
drop policy if exists "pagos_audit_select" on public.pagos_audit;
create policy "pagos_audit_select" on public.pagos_audit for SELECT to authenticated using (public.es_interno());
drop policy if exists "spiffs_read_all" on public.spiffs;
create policy "spiffs_read_all" on public.spiffs for SELECT to public using (public.es_interno());
drop policy if exists "prop_compra_read" on public.propuestas_compra;
create policy "prop_compra_read" on public.propuestas_compra for SELECT to anon,authenticated using (public.es_interno());
drop policy if exists "proyectos_read" on public.proyectos;
create policy "proyectos_read" on public.proyectos for SELECT to public using (public.es_interno());
drop policy if exists "proyecto_lineas_read" on public.proyecto_lineas;
create policy "proyecto_lineas_read" on public.proyecto_lineas for SELECT to public using (public.es_interno());
drop policy if exists "forecast_crm_read" on public.forecast_crm;
create policy "forecast_crm_read" on public.forecast_crm for SELECT to authenticated using (public.es_interno());
drop policy if exists "forecast_crm_existente_lectura" on public.forecast_crm_existente;
create policy "forecast_crm_existente_lectura" on public.forecast_crm_existente for SELECT to authenticated using (public.es_interno());
drop policy if exists "forecast_crm_lotes_read" on public.forecast_crm_lotes;
create policy "forecast_crm_lotes_read" on public.forecast_crm_lotes for SELECT to authenticated using (public.es_interno());
drop policy if exists "forecast_snapshots_read" on public.forecast_snapshots;
create policy "forecast_snapshots_read" on public.forecast_snapshots for SELECT to authenticated using (public.es_interno());
drop policy if exists "cuotas_canales_auth" on public.cuotas_canales;
create policy "cuotas_canales_auth" on public.cuotas_canales for SELECT to authenticated using (public.es_interno());
drop policy if exists "allow_anon_select" on public.dashboard_data;
create policy "allow_anon_select" on public.dashboard_data for SELECT to anon using (public.es_interno());
drop policy if exists "cat_pcel_read" on public.catalogo_sku_pcel;
create policy "cat_pcel_read" on public.catalogo_sku_pcel for SELECT to authenticated using (public.es_interno());
drop policy if exists "productos_select" on public.productos;
create policy "productos_select" on public.productos for SELECT to authenticated using (public.es_interno());
drop policy if exists "pendientes_equipo_select" on public.pendientes_equipo;
create policy "pendientes_equipo_select" on public.pendientes_equipo for SELECT to authenticated using (public.es_interno());
drop policy if exists "eventos_equipo_select" on public.eventos_equipo;
create policy "eventos_equipo_select" on public.eventos_equipo for SELECT to authenticated using (public.es_interno());
drop policy if exists "sync_events_read" on public.sync_events;
create policy "sync_events_read" on public.sync_events for SELECT to public using (public.es_interno());
drop policy if exists "sync_status_read" on public.sync_status;
create policy "sync_status_read" on public.sync_status for SELECT to public using (public.es_interno());
drop policy if exists "auditoria_cambios_select" on public.auditoria_cambios;
create policy "auditoria_cambios_select" on public.auditoria_cambios for SELECT to authenticated using (public.es_interno());
drop policy if exists "elasticidad_supuestos_read" on public.elasticidad_supuestos;
create policy "elasticidad_supuestos_read" on public.elasticidad_supuestos for SELECT to authenticated using (public.es_interno());
drop policy if exists "precios_competencia_read" on public.precios_competencia;
create policy "precios_competencia_read" on public.precios_competencia for SELECT to authenticated using (public.es_interno());
drop policy if exists "sop_reuniones_read" on public.sop_reuniones;
create policy "sop_reuniones_read" on public.sop_reuniones for SELECT to authenticated using (public.es_interno());
drop policy if exists "sop_reuniones_lineas_read" on public.sop_reuniones_lineas;
create policy "sop_reuniones_lineas_read" on public.sop_reuniones_lineas for SELECT to authenticated using (public.es_interno());
drop policy if exists "tipo_cambio_lectura" on public.tipo_cambio;
create policy "tipo_cambio_lectura" on public.tipo_cambio for SELECT to authenticated using (public.es_interno());
drop policy if exists "parametros_medidas_read" on public.parametros_medidas;
create policy "parametros_medidas_read" on public.parametros_medidas for SELECT to anon,authenticated using (public.es_interno());
drop policy if exists "fuentes_config_select" on public.fuentes_config;
create policy "fuentes_config_select" on public.fuentes_config for SELECT to authenticated using (public.es_interno());
drop policy if exists "Allow read sell_in_sku" on public.sell_in_sku_legacy;
create policy "Allow read sell_in_sku" on public.sell_in_sku_legacy for SELECT to authenticated using (public.es_interno());
drop policy if exists "spm_read" on public.sellout_pcel_mensual;
create policy "spm_read" on public.sellout_pcel_mensual for SELECT to authenticated using (public.es_interno());
drop policy if exists "allow_authenticated_read" on public.cuotas_mensuales;
create policy "allow_authenticated_read" on public.cuotas_mensuales for SELECT to authenticated using (public.es_interno() OR public.cliente_visible(cliente));
drop policy if exists "inv_cli_suc read all" on public.inventario_cliente_sucursal;
create policy "inv_cli_suc read all" on public.inventario_cliente_sucursal for SELECT to public using (public.es_interno() OR public.cliente_visible(cliente));
drop policy if exists "inventario_en_camino_select" on public.inventario_en_camino;
create policy "inventario_en_camino_select" on public.inventario_en_camino for SELECT to authenticated using (public.es_interno() OR public.cliente_visible(cliente));
drop policy if exists "metas_anuales_select" on public.metas_anuales;
create policy "metas_anuales_select" on public.metas_anuales for SELECT to authenticated using (public.es_interno() OR public.cliente_visible(cliente));
drop policy if exists "productos_cliente_select" on public.productos_cliente;
create policy "productos_cliente_select" on public.productos_cliente for SELECT to authenticated using (public.es_interno() OR public.cliente_visible(cliente));
drop policy if exists "Allow read sellout_sku" on public.sellout_sku;
create policy "Allow read sellout_sku" on public.sellout_sku for SELECT to authenticated using (public.es_interno() OR public.cliente_visible(cliente));
drop policy if exists "Allow read ventas_mensuales" on public.ventas_mensuales;
create policy "Allow read ventas_mensuales" on public.ventas_mensuales for SELECT to authenticated using (public.es_interno() OR public.cliente_visible(cliente));
drop policy if exists "minutas_select" on public.minutas;
create policy "minutas_select" on public.minutas for SELECT to authenticated using (public.es_interno() OR public.cliente_visible(cliente));
drop policy if exists "pendientes_select" on public.pendientes;
create policy "pendientes_select" on public.pendientes for SELECT to authenticated using (public.es_interno() OR public.cliente_visible(cliente));
drop policy if exists "clientes_credito_config_select" on public.clientes_credito_config;
create policy "clientes_credito_config_select" on public.clientes_credito_config for SELECT to authenticated using (public.es_interno() OR public.cliente_visible(cliente));
drop policy if exists "precio_ov_read" on public.precio_overrides;
create policy "precio_ov_read" on public.precio_overrides for SELECT to anon,authenticated using (public.es_interno() OR public.cliente_visible(cliente));
drop policy if exists "sugerido_overrides_select" on public.sugerido_overrides;
create policy "sugerido_overrides_select" on public.sugerido_overrides for SELECT to authenticated using (public.es_interno() OR public.cliente_visible(cliente));
drop policy if exists "Allow anon read" on public.cuotas_mensuales;
create policy "Allow anon read" on public.cuotas_mensuales for SELECT to anon using (public.es_interno());
drop policy if exists "estados_cuenta_detalle_select" on public.estados_cuenta_detalle;
create policy "estados_cuenta_detalle_select" on public.estados_cuenta_detalle for SELECT to authenticated using (public.es_interno() OR estado_cuenta_id in (select id from public.estados_cuenta ec where public.cliente_visible(ec.cliente)));
drop policy if exists "alertas_select" on public.alertas;
create policy "alertas_select" on public.alertas for SELECT to authenticated using (public.es_interno() OR para_usuario = auth.uid() OR public.cliente_visible(cliente_key));
drop policy if exists "perfiles_select_open" on public.perfiles;
create policy "perfiles_select_open" on public.perfiles for SELECT to authenticated using (public.es_interno() OR user_id = auth.uid());
drop policy if exists "perfiles_read" on public.perfiles;
create policy "perfiles_read" on public.perfiles for SELECT to public using (public.es_interno() OR user_id = auth.uid());
drop policy if exists "pagos_select_scoped" on public.pagos;
create policy "pagos_select_scoped" on public.pagos for SELECT to authenticated using (public.es_interno() OR public.puede_ver_cliente_pestana(cliente, 'pagos'));
drop policy if exists "inversion_marketing_select_scoped" on public.inversion_marketing;
create policy "inversion_marketing_select_scoped" on public.inversion_marketing for SELECT to authenticated using (public.es_interno() OR public.puede_ver_cliente_pestana(cliente, 'pagos'));
drop policy if exists "sellout_general_select_scoped" on public.sellout_general;
create policy "sellout_general_select_scoped" on public.sellout_general for SELECT to authenticated using (public.es_interno() OR (upper(mayorista) = 'DICOTECH' AND public.puede_ver_cliente_pestana('dicotech', 'estrategia')));
drop policy if exists "borradores_read_authenticated" on public.propuestas_borradores;
create policy "borradores_read_authenticated" on public.propuestas_borradores for SELECT to public using (public.es_interno());
drop policy if exists "borradores_update_authenticated" on public.propuestas_borradores;
create policy "borradores_update_authenticated" on public.propuestas_borradores for UPDATE to public using (public.es_interno());
drop policy if exists "borradores_delete_authenticated" on public.propuestas_borradores;
create policy "borradores_delete_authenticated" on public.propuestas_borradores for DELETE to public using (public.es_interno());
drop policy if exists "borradores_insert_authenticated" on public.propuestas_borradores;
create policy "borradores_insert_authenticated" on public.propuestas_borradores for INSERT to public with check (public.es_interno());
create or replace view public.v_erp_medidas as select * from (
 SELECT anio,
    mes,
    cliente_key,
    cliente_nombre,
    canal,
    articulo,
    marca,
    fact_bruta,
    devoluciones,
    rmas,
    bonificaciones,
    costo_fact_bruta,
    costo_devoluciones,
    costo_rmas,
    piezas_venta_neta,
    piezas_fact_bruta,
    renglones,
    fact_bruta + devoluciones AS fact_neta,
    fact_bruta + devoluciones + rmas + bonificaciones AS venta_neta,
    costo_fact_bruta + costo_devoluciones AS costo_fact_neta,
    costo_fact_bruta + costo_devoluciones + costo_rmas AS costo_venta_neta,
    fact_bruta + devoluciones - (costo_fact_bruta + costo_devoluciones) AS contribucion,
    fact_bruta - costo_fact_bruta AS contribucion_bruta,
    fact_bruta + devoluciones + rmas + bonificaciones - (costo_fact_bruta + costo_devoluciones + costo_rmas) AS utilidad_comercial,
    devoluciones - costo_devoluciones AS perdida_devoluciones,
    rmas - costo_rmas AS perdida_rmas
   FROM ( SELECT erp_ventas.anio,
            erp_ventas.mes,
            erp_ventas.cliente_key,
            erp_ventas.cliente_nombre,
            erp_ventas.canal,
            erp_ventas.articulo,
            erp_ventas.marca,
            sum(
                CASE
                    WHEN erp_ventas.movimiento_venta = ANY (ARRAY['Factura'::text, 'Factura Com.Ext33'::text]) THEN COALESCE(erp_ventas.monto_venta_pesos, 0::numeric)
                    ELSE 0::numeric
                END) AS fact_bruta,
            sum(
                CASE
                    WHEN erp_ventas.movimiento_venta = 'Devolucion Venta'::text AND COALESCE(erp_ventas.instruccion, ''::text) !~~* 'nota credito'::text THEN COALESCE(erp_ventas.monto_venta_pesos, 0::numeric)
                    ELSE 0::numeric
                END) AS devoluciones,
            sum(
                CASE
                    WHEN erp_ventas.movimiento_venta = 'Devolucion Venta'::text AND erp_ventas.instruccion ~~* 'nota credito'::text THEN COALESCE(erp_ventas.monto_venta_pesos, 0::numeric)
                    ELSE 0::numeric
                END) AS rmas,
            sum(
                CASE
                    WHEN erp_ventas.movimiento_venta = 'Bonificacion Venta'::text THEN COALESCE(erp_ventas.monto_venta_pesos, 0::numeric)
                    ELSE 0::numeric
                END) AS bonificaciones,
            sum(
                CASE
                    WHEN erp_ventas.movimiento_venta = 'Factura'::text THEN COALESCE(erp_ventas.costo_venta_pesos, 0::numeric)
                    ELSE 0::numeric
                END) AS costo_fact_bruta,
            sum(
                CASE
                    WHEN erp_ventas.movimiento_venta = 'Devolucion Venta'::text AND COALESCE(erp_ventas.instruccion, ''::text) !~~* 'nota credito'::text THEN COALESCE(erp_ventas.costo_venta_pesos, 0::numeric)
                    ELSE 0::numeric
                END) AS costo_devoluciones,
            sum(
                CASE
                    WHEN erp_ventas.movimiento_venta = 'Devolucion Venta'::text AND erp_ventas.instruccion ~~* 'nota credito'::text THEN COALESCE(erp_ventas.costo_venta_pesos, 0::numeric)
                    ELSE 0::numeric
                END) AS costo_rmas,
            sum(COALESCE(erp_ventas.unidades, erp_ventas.piezas, 0::numeric)) AS piezas_venta_neta,
            sum(
                CASE
                    WHEN erp_ventas.movimiento_venta = ANY (ARRAY['Factura'::text, 'Factura Com.Ext33'::text]) THEN COALESCE(erp_ventas.unidades, erp_ventas.piezas, 0::numeric)
                    ELSE 0::numeric
                END) AS piezas_fact_bruta,
            count(*)::integer AS renglones
           FROM erp_ventas
          GROUP BY erp_ventas.anio, erp_ventas.mes, erp_ventas.cliente_key, erp_ventas.cliente_nombre, erp_ventas.canal, erp_ventas.articulo, erp_ventas.marca) s
) _v where public.es_interno();
create or replace view public.v_erp_medidas_canal_mes as select * from (
 SELECT anio,
    mes,
    canal,
    round(fact_bruta, 2) AS fact_bruta,
    round(devoluciones, 2) AS devoluciones,
    round(rmas, 2) AS rmas,
    round(bonificaciones, 2) AS bonificaciones,
    round(costo_fact_bruta, 2) AS costo_fact_bruta,
    round(costo_devoluciones, 2) AS costo_devoluciones,
    round(costo_rmas, 2) AS costo_rmas,
    round(piezas_venta_neta, 2) AS piezas_venta_neta,
    renglones,
    round(fact_neta, 2) AS fact_neta,
    round(venta_neta, 2) AS venta_neta,
    round(costo_fact_neta, 2) AS costo_fact_neta,
    round(costo_venta_neta, 2) AS costo_venta_neta,
    round(contribucion, 2) AS contribucion,
    round(contribucion_bruta, 2) AS contribucion_bruta,
    round(utilidad_comercial, 2) AS utilidad_comercial,
    round(pct_mc, 2) AS pct_mc,
    round(pct_muc, 2) AS pct_muc
   FROM ( SELECT m.anio,
            m.mes,
            m.canal,
            m.fact_bruta,
            m.devoluciones,
            m.rmas,
            m.bonificaciones,
            m.costo_fact_bruta,
            m.costo_devoluciones,
            m.costo_rmas,
            m.piezas_venta_neta,
            m.renglones,
            m.fact_neta,
            m.venta_neta,
            m.costo_fact_neta,
            m.costo_venta_neta,
            m.contribucion,
            m.contribucion_bruta,
            m.utilidad_comercial,
                CASE
                    WHEN m.fact_neta <> 0::numeric THEN m.contribucion / m.fact_neta
                    ELSE NULL::numeric
                END AS pct_mc,
                CASE
                    WHEN m.venta_neta <> 0::numeric THEN m.utilidad_comercial / m.venta_neta
                    ELSE NULL::numeric
                END AS pct_muc
           FROM mv_erp_medidas_canal_mes m) t
) _v where public.es_interno();
create or replace view public.v_erp_medidas_cliente_mes as select * from (
 SELECT anio,
    mes,
    cliente_key,
    round(fact_bruta, 2) AS fact_bruta,
    round(devoluciones, 2) AS devoluciones,
    round(rmas, 2) AS rmas,
    round(bonificaciones, 2) AS bonificaciones,
    round(costo_fact_bruta, 2) AS costo_fact_bruta,
    round(costo_devoluciones, 2) AS costo_devoluciones,
    round(costo_rmas, 2) AS costo_rmas,
    round(piezas_venta_neta, 2) AS piezas_venta_neta,
    renglones,
    round(fact_neta, 2) AS fact_neta,
    round(venta_neta, 2) AS venta_neta,
    round(costo_fact_neta, 2) AS costo_fact_neta,
    round(costo_venta_neta, 2) AS costo_venta_neta,
    round(contribucion, 2) AS contribucion,
    round(contribucion_bruta, 2) AS contribucion_bruta,
    round(utilidad_comercial, 2) AS utilidad_comercial
   FROM ( SELECT mv_erp_medidas_cliente_mes.anio,
            mv_erp_medidas_cliente_mes.mes,
            mv_erp_medidas_cliente_mes.cliente_key,
            mv_erp_medidas_cliente_mes.fact_bruta,
            mv_erp_medidas_cliente_mes.devoluciones,
            mv_erp_medidas_cliente_mes.rmas,
            mv_erp_medidas_cliente_mes.bonificaciones,
            mv_erp_medidas_cliente_mes.costo_fact_bruta,
            mv_erp_medidas_cliente_mes.costo_devoluciones,
            mv_erp_medidas_cliente_mes.costo_rmas,
            mv_erp_medidas_cliente_mes.piezas_venta_neta,
            mv_erp_medidas_cliente_mes.renglones,
            mv_erp_medidas_cliente_mes.fact_neta,
            mv_erp_medidas_cliente_mes.venta_neta,
            mv_erp_medidas_cliente_mes.costo_fact_neta,
            mv_erp_medidas_cliente_mes.costo_venta_neta,
            mv_erp_medidas_cliente_mes.contribucion,
            mv_erp_medidas_cliente_mes.contribucion_bruta,
            mv_erp_medidas_cliente_mes.utilidad_comercial
           FROM mv_erp_medidas_cliente_mes) t
) _v where public.es_interno();
create or replace view public.v_erp_medidas_mes as select * from (
 WITH m AS (
         SELECT mv_erp_medidas_cliente_mes.anio,
            mv_erp_medidas_cliente_mes.mes,
            sum(mv_erp_medidas_cliente_mes.fact_bruta) AS fact_bruta,
            sum(mv_erp_medidas_cliente_mes.devoluciones) AS devoluciones,
            sum(mv_erp_medidas_cliente_mes.rmas) AS rmas,
            sum(mv_erp_medidas_cliente_mes.bonificaciones) AS bonificaciones,
            sum(mv_erp_medidas_cliente_mes.fact_neta) AS fact_neta,
            sum(mv_erp_medidas_cliente_mes.venta_neta) AS venta_neta,
            sum(mv_erp_medidas_cliente_mes.costo_fact_bruta) AS costo_fact_bruta,
            sum(mv_erp_medidas_cliente_mes.costo_devoluciones) AS costo_devoluciones,
            sum(mv_erp_medidas_cliente_mes.costo_rmas) AS costo_rmas,
            sum(mv_erp_medidas_cliente_mes.costo_fact_neta) AS costo_fact_neta,
            sum(mv_erp_medidas_cliente_mes.costo_venta_neta) AS costo_venta_neta,
            sum(mv_erp_medidas_cliente_mes.contribucion) AS contribucion,
            sum(mv_erp_medidas_cliente_mes.contribucion_bruta) AS contribucion_bruta,
            sum(mv_erp_medidas_cliente_mes.utilidad_comercial) AS utilidad_comercial,
            sum(mv_erp_medidas_cliente_mes.piezas_venta_neta) AS piezas_venta_neta,
            sum(mv_erp_medidas_cliente_mes.renglones) AS renglones
           FROM mv_erp_medidas_cliente_mes
          GROUP BY mv_erp_medidas_cliente_mes.anio, mv_erp_medidas_cliente_mes.mes
        )
 SELECT anio,
    mes,
    fact_bruta,
    devoluciones,
    rmas,
    bonificaciones,
    fact_neta,
    venta_neta,
    costo_fact_bruta,
    costo_devoluciones,
    costo_rmas,
    costo_fact_neta,
    costo_venta_neta,
    contribucion,
    contribucion_bruta,
    utilidad_comercial,
    piezas_venta_neta,
    renglones,
    sum(costo_venta_neta) OVER (ORDER BY anio, mes ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING) AS cv_ultimos_3_meses,
    sum(costo_venta_neta) OVER (PARTITION BY anio ORDER BY mes) AS ytd_costo_venta,
        CASE
            WHEN piezas_venta_neta <> 0::numeric THEN venta_neta / piezas_venta_neta
            ELSE NULL::numeric
        END AS ticket_promedio,
        CASE
            WHEN piezas_venta_neta <> 0::numeric THEN utilidad_comercial / piezas_venta_neta
            ELSE NULL::numeric
        END AS utilidad_promedio,
        CASE
            WHEN fact_neta <> 0::numeric THEN contribucion / fact_neta
            ELSE NULL::numeric
        END AS pct_mc,
        CASE
            WHEN fact_bruta <> 0::numeric THEN contribucion_bruta / fact_bruta
            ELSE NULL::numeric
        END AS pct_mc_bruta,
        CASE
            WHEN venta_neta <> 0::numeric THEN utilidad_comercial / venta_neta
            ELSE NULL::numeric
        END AS pct_muc,
        CASE
            WHEN fact_neta <> 0::numeric THEN bonificaciones / fact_neta
            ELSE NULL::numeric
        END AS pct_lost_profit_bonif,
        CASE
            WHEN fact_bruta <> 0::numeric THEN (devoluciones - costo_devoluciones) / fact_bruta
            ELSE NULL::numeric
        END AS pct_lost_profit_dev,
        CASE
            WHEN fact_neta <> 0::numeric THEN (rmas - costo_rmas) / fact_neta
            ELSE NULL::numeric
        END AS pct_lost_profit_rma
   FROM m
) _v where public.es_interno();
create or replace view public.v_medidas_compras as select * from (
 SELECT COALESCE(sum(COALESCE(costo_usd, 0::numeric) * COALESCE(cantidad_pendiente, 0::numeric)), 0::numeric) AS compra_usd_pendiente,
    COALESCE(sum(COALESCE(costo_usd, 0::numeric) * COALESCE(cantidad_orden, 0::numeric)), 0::numeric) AS compra_usd_orden,
    COALESCE(sum(COALESCE(cantidad_pendiente, 0::numeric)), 0::numeric) AS piezas_pendientes,
    COALESCE(sum(COALESCE(costo_usd, 0::numeric) * COALESCE(cantidad_pendiente, 0::numeric)), 0::numeric) * param_medida('tc_compra_inv'::text, 17::numeric) AS costo_compra_tc17,
    COALESCE(sum(COALESCE(costo_usd, 0::numeric) * COALESCE(cantidad_pendiente, 0::numeric)), 0::numeric) * param_medida('tc_compra'::text, 20::numeric) AS costo_compra_tc20,
    max(updated_at) AS actualizado
   FROM compras_oc c
  WHERE COALESCE(estatus, ''::text) = 'PENDIENTE'::text
) _v where public.es_interno();
create or replace view public.v_medidas_cuota_cliente_mes as select * from (
 SELECT cliente AS cliente_key,
    anio,
    mes,
    sum(COALESCE(cuota_ideal, cuota_min, 0::numeric)) AS cuota_venta,
    sum(COALESCE(cuota_min, 0::numeric)) AS cuota_minima,
    sum(cuota_piezas) AS cuota_piezas,
    sum(cuota_costo) AS cuota_costo,
    sum(COALESCE(cuota_ideal, cuota_min, 0::numeric)) - sum(cuota_costo) AS cuota_contribucion,
        CASE
            WHEN sum(COALESCE(cuota_ideal, cuota_min, 0::numeric)) <> 0::numeric THEN (sum(COALESCE(cuota_ideal, cuota_min, 0::numeric)) - sum(cuota_costo)) / sum(COALESCE(cuota_ideal, cuota_min, 0::numeric))
            ELSE NULL::numeric
        END AS cuota_pct_contribucion
   FROM cuotas_mensuales q
  WHERE anio IS NOT NULL AND mes >= 1 AND mes <= 12
  GROUP BY cliente, anio, mes
) _v where public.es_interno();
create or replace view public.v_medidas_cuota_mes as select * from (
 WITH anual AS (
         SELECT cuotas_canales.anio,
            sum(cuotas_canales.meta_facturacion) AS meta_anual,
            sum(cuotas_canales.meta_piezas) AS meta_piezas_anual
           FROM cuotas_canales
          WHERE upper(COALESCE(cuotas_canales.dimension_tipo, ''::text)) = 'TOTAL'::text
          GROUP BY cuotas_canales.anio
        ), porcliente AS (
         SELECT v_medidas_cuota_cliente_mes.anio,
            v_medidas_cuota_cliente_mes.mes,
            sum(v_medidas_cuota_cliente_mes.cuota_venta) AS cuota_venta,
            sum(v_medidas_cuota_cliente_mes.cuota_minima) AS cuota_minima,
            sum(v_medidas_cuota_cliente_mes.cuota_piezas) AS cuota_piezas,
            sum(v_medidas_cuota_cliente_mes.cuota_costo) AS cuota_costo
           FROM v_medidas_cuota_cliente_mes
          GROUP BY v_medidas_cuota_cliente_mes.anio, v_medidas_cuota_cliente_mes.mes
        ), base AS (
         SELECT porcliente.anio,
            porcliente.mes
           FROM porcliente
        UNION
         SELECT a_1.anio,
            g.mes
           FROM anual a_1
             CROSS JOIN generate_series(1, 12) g(mes)
        )
 SELECT b.anio,
    b.mes,
    COALESCE(a.meta_anual / 12.0, p.cuota_venta) AS cuota_venta,
    p.cuota_minima,
    COALESCE(a.meta_piezas_anual / 12.0, p.cuota_piezas) AS cuota_piezas,
    p.cuota_costo,
    COALESCE(a.meta_anual / 12.0, p.cuota_venta) - p.cuota_costo AS cuota_contribucion,
    a.anio IS NOT NULL AS desde_cuotas_canales,
        CASE
            WHEN COALESCE(a.meta_anual / 12.0, p.cuota_venta) <> 0::numeric THEN (COALESCE(a.meta_anual / 12.0, p.cuota_venta) - p.cuota_costo) / COALESCE(a.meta_anual / 12.0, p.cuota_venta)
            ELSE NULL::numeric
        END AS cuota_pct_contribucion
   FROM base b
     LEFT JOIN porcliente p ON p.anio = b.anio AND p.mes = b.mes
     LEFT JOIN anual a ON a.anio = b.anio
) _v where public.es_interno();
create or replace view public.v_medidas_inventario as select * from (
 SELECT inv_actual,
    inv_actual_piezas,
    inv_actual_disponible,
    inv_config_costo_inventario,
    inv_config_costo_disponible,
    inv_config_piezas,
    inv_config_disponible,
    inv_ventas_todas_ramas,
    skus_con_stock,
    costo_promedio,
    costo_compra_tc17,
    costo_compra_tc20,
    compra_usd_pendiente,
    piezas_pendientes,
    inv_total,
    cv_ultimos_3_meses,
    ytd_costo_venta,
    dias_inv,
    dias_inv_total,
    inv_promedio,
    vueltas_inv,
    actualizado
   FROM mv_medidas_inventario
) _v where public.es_interno();
create or replace view public.v_medidas_inventario_sku as select * from (
 WITH p AS (
         SELECT param_medida('inv_rama_desconocida'::text, 0::numeric) AS rama_desc
        ), base AS (
         SELECT i.articulo,
            i.no_almacen,
            COALESCE(i.inventario, 0::numeric) AS inventario,
            COALESCE(i.disponible, 0::numeric) AS disponible,
            COALESCE(i.costoinventario, 0::numeric) AS costoinventario,
            COALESCE(i.costodisponible, 0::numeric) AS costodisponible,
            i.costopromedio,
            COALESCE(ac.comercial, false) AS comercial,
            COALESCE(ac.exclusivo,
                CASE
                    WHEN i.almacen_nombre ~~* 'VENTAS%'::text THEN 'Ventas'::text
                    ELSE 'Inventario'::text
                END) AS exclusivo,
            COALESCE(ac.inv_actual_extra, false) AS extra,
            r.rama
           FROM inventario_acteck i
             LEFT JOIN almacenes_config ac ON ac.no_almacen = i.no_almacen
             LEFT JOIN mv_articulo_rama r ON r.articulo = i.articulo
          WHERE i.articulo IS NOT NULL AND i.articulo <> '__TEST__'::text
        ), f AS (
         SELECT b.articulo,
            b.no_almacen,
            b.inventario,
            b.disponible,
            b.costoinventario,
            b.costodisponible,
            b.costopromedio,
            b.comercial,
            b.exclusivo,
            b.extra,
            b.rama,
            b.costoinventario <> 0::numeric AND b.exclusivo IS DISTINCT FROM 'Inventario'::text AND (b.rama = 'PRODUCTO'::text OR b.rama IS NULL AND (( SELECT p.rama_desc
                   FROM p)) = 1::numeric) AS en_inv_actual
           FROM base b
        )
 SELECT articulo,
    COALESCE(sum(costoinventario) FILTER (WHERE en_inv_actual), 0::numeric) + COALESCE(sum(costoinventario) FILTER (WHERE extra AND costoinventario <> 0::numeric), 0::numeric) AS inv_actual,
    COALESCE(sum(inventario) FILTER (WHERE en_inv_actual), 0::numeric) + COALESCE(sum(inventario) FILTER (WHERE extra AND costoinventario <> 0::numeric), 0::numeric) AS inv_actual_piezas,
    COALESCE(sum(disponible) FILTER (WHERE en_inv_actual), 0::numeric) AS inv_actual_disponible,
    avg(costopromedio) FILTER (WHERE costoinventario <> 0::numeric) AS costo_promedio,
    COALESCE(sum(costoinventario) FILTER (WHERE comercial), 0::numeric) AS inv_config_costo_inventario,
    COALESCE(sum(costodisponible) FILTER (WHERE comercial), 0::numeric) AS inv_config_costo_disponible,
    COALESCE(sum(inventario) FILTER (WHERE comercial), 0::numeric) AS inv_config_piezas,
    COALESCE(sum(disponible) FILTER (WHERE comercial), 0::numeric) AS inv_config_disponible,
    COALESCE(sum(costoinventario) FILTER (WHERE costoinventario <> 0::numeric AND exclusivo IS DISTINCT FROM 'Inventario'::text), 0::numeric) AS inv_ventas_todas_ramas,
    count(*) FILTER (WHERE inventario > 0::numeric)::integer AS almacenes_con_stock
   FROM f
  GROUP BY articulo
) _v where public.es_interno();
create or replace view public.v_medidas_ventas_canal_mes as select * from (
 SELECT anio,
    mes,
    canal,
    fact_bruta,
    devoluciones,
    rmas,
    bonificaciones,
    fact_neta,
    venta_neta,
    costo_fact_bruta,
    costo_devoluciones,
    costo_rmas,
    costo_fact_neta,
    costo_venta_neta,
    contribucion,
    contribucion_bruta,
    utilidad_comercial,
    piezas_venta_neta,
    renglones,
    devoluciones - costo_devoluciones AS perdida_devoluciones,
    rmas - costo_rmas AS perdida_rmas,
    sum(costo_venta_neta) OVER (PARTITION BY canal ORDER BY anio, mes ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING) AS cv_ultimos_3_meses,
    sum(costo_venta_neta) OVER (PARTITION BY canal, anio ORDER BY mes) AS ytd_costo_venta,
        CASE
            WHEN piezas_venta_neta <> 0::numeric THEN venta_neta / piezas_venta_neta
            ELSE NULL::numeric
        END AS ticket_promedio,
        CASE
            WHEN piezas_venta_neta <> 0::numeric THEN utilidad_comercial / piezas_venta_neta
            ELSE NULL::numeric
        END AS utilidad_promedio,
        CASE
            WHEN fact_neta <> 0::numeric THEN contribucion / fact_neta
            ELSE NULL::numeric
        END AS pct_mc,
        CASE
            WHEN fact_bruta <> 0::numeric THEN contribucion_bruta / fact_bruta
            ELSE NULL::numeric
        END AS pct_mc_bruta,
        CASE
            WHEN venta_neta <> 0::numeric THEN utilidad_comercial / venta_neta
            ELSE NULL::numeric
        END AS pct_muc
   FROM mv_erp_medidas_canal_mes m
) _v where public.es_interno();
create or replace view public.v_medidas_ventas_cliente_mes as select * from (
 WITH c AS (
         SELECT m.anio,
            m.mes,
            m.cliente_key,
            m.fact_bruta,
            m.devoluciones,
            m.rmas,
            m.bonificaciones,
            m.costo_fact_bruta,
            m.costo_devoluciones,
            m.costo_rmas,
            m.piezas_venta_neta,
            m.renglones,
            m.fact_neta,
            m.venta_neta,
            m.costo_fact_neta,
            m.costo_venta_neta,
            m.contribucion,
            m.contribucion_bruta,
            m.utilidad_comercial,
            sum(m.costo_venta_neta) OVER (PARTITION BY m.cliente_key ORDER BY m.anio, m.mes ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING) AS cv_ultimos_3_meses,
            sum(m.costo_venta_neta) OVER (PARTITION BY m.cliente_key, m.anio ORDER BY m.mes) AS ytd_costo_venta
           FROM mv_erp_medidas_cliente_mes m
        )
 SELECT c.anio,
    c.mes,
    c.cliente_key,
    c.fact_bruta,
    c.devoluciones,
    c.rmas,
    c.bonificaciones,
    c.fact_neta,
    c.venta_neta,
    c.costo_fact_bruta,
    c.costo_devoluciones,
    c.costo_rmas,
    c.costo_fact_neta,
    c.costo_venta_neta,
    c.contribucion,
    c.contribucion_bruta,
    c.utilidad_comercial,
    c.piezas_venta_neta,
    c.renglones,
    c.devoluciones - c.costo_devoluciones AS perdida_devoluciones,
    c.rmas - c.costo_rmas AS perdida_rmas,
    c.cv_ultimos_3_meses,
    c.ytd_costo_venta,
        CASE
            WHEN c.piezas_venta_neta <> 0::numeric THEN c.venta_neta / c.piezas_venta_neta
            ELSE NULL::numeric
        END AS ticket_promedio,
        CASE
            WHEN c.piezas_venta_neta <> 0::numeric THEN c.utilidad_comercial / c.piezas_venta_neta
            ELSE NULL::numeric
        END AS utilidad_promedio,
        CASE
            WHEN c.fact_neta <> 0::numeric THEN c.contribucion / c.fact_neta
            ELSE NULL::numeric
        END AS pct_mc,
        CASE
            WHEN c.fact_bruta <> 0::numeric THEN c.contribucion_bruta / c.fact_bruta
            ELSE NULL::numeric
        END AS pct_mc_bruta,
        CASE
            WHEN c.venta_neta <> 0::numeric THEN c.utilidad_comercial / c.venta_neta
            ELSE NULL::numeric
        END AS pct_muc,
        CASE
            WHEN c.fact_neta <> 0::numeric THEN c.bonificaciones / c.fact_neta
            ELSE NULL::numeric
        END AS pct_lost_profit_bonif,
        CASE
            WHEN c.fact_bruta <> 0::numeric THEN (c.devoluciones - c.costo_devoluciones) / c.fact_bruta
            ELSE NULL::numeric
        END AS pct_lost_profit_dev,
        CASE
            WHEN c.fact_neta <> 0::numeric THEN (c.rmas - c.costo_rmas) / c.fact_neta
            ELSE NULL::numeric
        END AS pct_lost_profit_rma,
    q.cuota_venta,
    q.cuota_minima,
    q.cuota_piezas,
    q.cuota_costo,
    q.cuota_contribucion,
        CASE
            WHEN q.cuota_venta <> 0::numeric THEN c.fact_neta / q.cuota_venta
            ELSE NULL::numeric
        END AS pct_alcance_venta,
        CASE
            WHEN q.cuota_piezas <> 0::numeric THEN c.piezas_venta_neta / q.cuota_piezas
            ELSE NULL::numeric
        END AS pct_alcance_piezas,
    c.fact_neta - COALESCE(q.cuota_venta, 0::numeric) AS diferencia_cuota,
    c.piezas_venta_neta - q.cuota_piezas AS diferencia_piezas,
    c.contribucion - q.cuota_contribucion AS deficit_contribucion,
    q.cuota_pct_contribucion
   FROM c
     LEFT JOIN v_medidas_cuota_cliente_mes q ON q.cliente_key = c.cliente_key AND q.anio = c.anio AND q.mes = c.mes
) _v where public.es_interno();
create or replace view public.v_medidas_ventas_mes as select * from (
 SELECT m.anio,
    m.mes,
    m.fact_bruta,
    m.devoluciones,
    m.rmas,
    m.bonificaciones,
    m.fact_neta,
    m.venta_neta,
    m.costo_fact_bruta,
    m.costo_devoluciones,
    m.costo_rmas,
    m.costo_fact_neta,
    m.costo_venta_neta,
    m.contribucion,
    m.contribucion_bruta,
    m.utilidad_comercial,
    m.piezas_venta_neta,
    m.renglones,
    m.devoluciones - m.costo_devoluciones AS perdida_devoluciones,
    m.rmas - m.costo_rmas AS perdida_rmas,
    m.cv_ultimos_3_meses,
    m.ytd_costo_venta,
    m.ticket_promedio,
    m.utilidad_promedio,
    m.pct_mc,
    m.pct_mc_bruta,
    m.pct_muc,
    m.pct_lost_profit_bonif,
    m.pct_lost_profit_dev,
    m.pct_lost_profit_rma,
    q.cuota_venta,
    q.cuota_minima,
    q.cuota_piezas,
    q.cuota_costo,
    q.cuota_contribucion,
        CASE
            WHEN q.cuota_venta <> 0::numeric THEN m.fact_neta / q.cuota_venta
            ELSE NULL::numeric
        END AS pct_alcance_venta,
        CASE
            WHEN q.cuota_piezas <> 0::numeric THEN m.piezas_venta_neta / q.cuota_piezas
            ELSE NULL::numeric
        END AS pct_alcance_piezas,
        CASE
            WHEN q.cuota_venta <> 0::numeric THEN q.cuota_contribucion / q.cuota_venta
            ELSE NULL::numeric
        END AS cuota_pct_contribucion,
    m.fact_neta - COALESCE(q.cuota_venta, 0::numeric) AS diferencia_cuota,
    m.piezas_venta_neta - q.cuota_piezas AS diferencia_piezas,
    m.contribucion - q.cuota_contribucion AS deficit_contribucion
   FROM v_erp_medidas_mes m
     LEFT JOIN v_medidas_cuota_mes q ON q.anio = m.anio AND q.mes = m.mes
) _v where public.es_interno();
create or replace view public.v_medidas_ventas_sku as select * from (
 SELECT anio,
    mes,
    cliente_key,
    cliente_nombre,
    canal,
    articulo,
    marca,
    fact_bruta,
    devoluciones,
    rmas,
    bonificaciones,
    costo_fact_bruta,
    costo_devoluciones,
    costo_rmas,
    piezas_venta_neta,
    piezas_fact_bruta,
    renglones,
    fact_neta,
    venta_neta,
    costo_fact_neta,
    costo_venta_neta,
    contribucion,
    contribucion_bruta,
    utilidad_comercial,
    perdida_devoluciones,
    perdida_rmas,
        CASE
            WHEN piezas_venta_neta <> 0::numeric THEN venta_neta / piezas_venta_neta
            ELSE NULL::numeric
        END AS ticket_promedio,
        CASE
            WHEN piezas_venta_neta <> 0::numeric THEN utilidad_comercial / piezas_venta_neta
            ELSE NULL::numeric
        END AS utilidad_promedio,
        CASE
            WHEN fact_neta <> 0::numeric THEN contribucion / fact_neta
            ELSE NULL::numeric
        END AS pct_mc,
        CASE
            WHEN fact_bruta <> 0::numeric THEN contribucion_bruta / fact_bruta
            ELSE NULL::numeric
        END AS pct_mc_bruta,
        CASE
            WHEN venta_neta <> 0::numeric THEN utilidad_comercial / venta_neta
            ELSE NULL::numeric
        END AS pct_muc
   FROM v_erp_medidas m
) _v where public.es_interno();
create or replace view public.v_medidas_ventas_vendedor_mes as select * from (
 SELECT anio,
    mes,
    vendedor,
    fact_bruta,
    devoluciones,
    rmas,
    bonificaciones,
    fact_neta,
    venta_neta,
    costo_fact_bruta,
    costo_devoluciones,
    costo_rmas,
    costo_fact_neta,
    costo_venta_neta,
    contribucion,
    contribucion_bruta,
    utilidad_comercial,
    piezas_venta_neta,
    clientes,
    renglones,
    devoluciones - costo_devoluciones AS perdida_devoluciones,
    rmas - costo_rmas AS perdida_rmas,
    sum(costo_venta_neta) OVER (PARTITION BY vendedor ORDER BY anio, mes ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING) AS cv_ultimos_3_meses,
    sum(costo_venta_neta) OVER (PARTITION BY vendedor, anio ORDER BY mes) AS ytd_costo_venta,
        CASE
            WHEN piezas_venta_neta <> 0::numeric THEN venta_neta / piezas_venta_neta
            ELSE NULL::numeric
        END AS ticket_promedio,
        CASE
            WHEN piezas_venta_neta <> 0::numeric THEN utilidad_comercial / piezas_venta_neta
            ELSE NULL::numeric
        END AS utilidad_promedio,
        CASE
            WHEN fact_neta <> 0::numeric THEN contribucion / fact_neta
            ELSE NULL::numeric
        END AS pct_mc,
        CASE
            WHEN fact_bruta <> 0::numeric THEN contribucion_bruta / fact_bruta
            ELSE NULL::numeric
        END AS pct_mc_bruta,
        CASE
            WHEN venta_neta <> 0::numeric THEN utilidad_comercial / venta_neta
            ELSE NULL::numeric
        END AS pct_muc,
        CASE
            WHEN fact_neta <> 0::numeric THEN bonificaciones / fact_neta
            ELSE NULL::numeric
        END AS pct_lost_profit_bonif,
        CASE
            WHEN fact_bruta <> 0::numeric THEN (devoluciones - costo_devoluciones) / fact_bruta
            ELSE NULL::numeric
        END AS pct_lost_profit_dev,
        CASE
            WHEN fact_neta <> 0::numeric THEN (rmas - costo_rmas) / fact_neta
            ELSE NULL::numeric
        END AS pct_lost_profit_rma
   FROM mv_medidas_ventas_vendedor_mes m
) _v where public.es_interno();
create or replace view public.v_inventario_almacen_medida as select * from (
 WITH p AS (
         SELECT param_medida('inv_rama_desconocida'::text, 0::numeric) AS rama_desc
        )
 SELECT i.articulo,
    i.no_almacen,
    i.almacen_nombre,
    i.cedis,
    i.no_cedis,
    COALESCE(i.inventario, 0::numeric) AS inventario,
    COALESCE(i.disponible, 0::numeric) AS disponible,
    COALESCE(i.costoinventario, 0::numeric) AS costoinventario,
    COALESCE(i.costodisponible, 0::numeric) AS costodisponible,
    i.costopromedio,
    COALESCE(ac.comercial, false) AS comercial,
    COALESCE(ac.tipo,
        CASE
            WHEN i.almacen_nombre ~~* 'VENTAS%'::text THEN 'ventas'::text
            ELSE 'no_comercial'::text
        END) AS tipo,
    COALESCE(ac.exclusivo,
        CASE
            WHEN i.almacen_nombre ~~* 'VENTAS%'::text THEN 'Ventas'::text
            ELSE 'Inventario'::text
        END) AS exclusivo,
    r.rama,
    COALESCE(i.costoinventario, 0::numeric) <> 0::numeric AND COALESCE(ac.exclusivo,
        CASE
            WHEN i.almacen_nombre ~~* 'VENTAS%'::text THEN 'Ventas'::text
            ELSE 'Inventario'::text
        END) IS DISTINCT FROM 'Inventario'::text AND (r.rama = 'PRODUCTO'::text OR r.rama IS NULL AND (( SELECT p.rama_desc
           FROM p)) = 1::numeric) OR COALESCE(ac.inv_actual_extra, false) AS en_inv_actual,
    i.updated_at
   FROM inventario_acteck i
     LEFT JOIN almacenes_config ac ON ac.no_almacen = i.no_almacen
     LEFT JOIN mv_articulo_rama r ON r.articulo = i.articulo
  WHERE i.articulo IS NOT NULL AND i.articulo <> '__TEST__'::text
) _v where public.es_interno();
create or replace view public.v_inventario_cv_mes as select * from (
 SELECT v.anio,
    v.mes,
    i.fecha_cierre,
    i.inv_cierre_mes,
    i.inv_cierre_mes_piezas,
    v.cv_ultimos_3_meses,
    v.costo_venta_neta,
    v.piezas_venta_neta
   FROM v_medidas_ventas_mes v
     LEFT JOIN mv_medidas_inventario_mes i ON i.anio = v.anio AND i.mes = v.mes
) _v where public.es_interno();
create or replace view public.v_compras_pendientes_sku as select * from (
 WITH pend AS (
         SELECT TRIM(BOTH FROM c.articulo) AS sku,
            NULLIF(TRIM(BOTH FROM c.movid), ''::text) AS po,
            COALESCE(NULLIF(TRIM(BOTH FROM c.proveedor), ''::text), 'SIN PROVEEDOR'::text) AS proveedor,
            NULLIF(TRIM(BOTH FROM c.prov_id), ''::text) AS prov_id,
            NULLIF(TRIM(BOTH FROM c.descripcion), ''::text) AS descripcion,
            NULLIF(TRIM(BOTH FROM c.fabricante), ''::text) AS marca,
            NULLIF(TRIM(BOTH FROM c.estatus), ''::text) AS estatus,
            c.fecha_emision AS fecha_po,
            COALESCE(c.cantidad_orden, 0::numeric) AS piezas_pedidas,
            COALESCE(c.cantidad_pendiente, 0::numeric) AS piezas_pendientes,
            COALESCE(c.costo_usd, 0::numeric) AS costo_usd
           FROM compras_oc c
          WHERE COALESCE(c.cantidad_pendiente, 0::numeric) > 0::numeric AND NULLIF(TRIM(BOTH FROM c.articulo), ''::text) IS NOT NULL
        ), emb AS (
         SELECT e_1.po,
            TRIM(BOTH FROM e_1.codigo) AS codigo,
            min(e_1.arribo_cedis) AS eta,
            sum(COALESCE(e_1.shp_qty, e_1.po_qty, 0))::numeric AS piezas_embarcadas
           FROM embarques_compras e_1
          WHERE e_1.codigo IS NOT NULL AND e_1.po IS NOT NULL AND COALESCE(e_1.estatus, ''::text) !~~* '%CANCEL%'::text AND COALESCE(e_1.estatus, ''::text) !~~* '%RECHAZ%'::text AND COALESCE(e_1.estatus, ''::text) !~~* '%PERDID%'::text
          GROUP BY e_1.po, (TRIM(BOTH FROM e_1.codigo))
        ), tra AS (
         SELECT t_1.sku,
            sum(COALESCE(t_1.cantidad, 0))::numeric AS pz_transito
           FROM v_transito_sku t_1
          GROUP BY t_1.sku
        )
 SELECT p.sku,
    p.descripcion,
    p.marca,
    p.proveedor,
    p.prov_id,
    p.po,
    p.fecha_po,
    p.estatus,
    round(p.piezas_pedidas)::bigint AS piezas_pedidas,
    round(GREATEST(p.piezas_pedidas - p.piezas_pendientes, 0::numeric))::bigint AS piezas_recibidas,
    round(p.piezas_pendientes)::bigint AS piezas_pendientes,
    round(p.piezas_pendientes * p.costo_usd, 2) AS usd_pendiente,
    p.costo_usd,
    e.eta,
    round(COALESCE(e.piezas_embarcadas, 0::numeric))::bigint AS piezas_embarcadas,
    e.codigo IS NOT NULL AS en_master_embarques,
    COALESCE(t.pz_transito, 0::numeric) > 0::numeric AS sku_en_transito,
    CURRENT_DATE - p.fecha_po AS dias_desde_po
   FROM pend p
     LEFT JOIN emb e ON e.po = p.po AND e.codigo = p.sku
     LEFT JOIN tra t ON t.sku = p.sku
) _v where public.es_interno();
create or replace view public.v_sku_metadata as select * from (
 WITH embarques_recientes AS (
         SELECT DISTINCT ON (embarques_compras.codigo) embarques_compras.codigo AS sku,
            embarques_compras.descripcion,
            embarques_compras.supplier,
            embarques_compras.familia,
            embarques_compras.unit_price,
            embarques_compras.fecha_emision
           FROM embarques_compras
          WHERE embarques_compras.codigo IS NOT NULL AND embarques_compras.codigo <> ''::text
          ORDER BY embarques_compras.codigo, embarques_compras.fecha_emision DESC NULLS LAST
        ), inv_costo AS (
         SELECT inventario_acteck.articulo AS sku,
            avg(inventario_acteck.costopromedio) AS costo_promedio_mxn
           FROM inventario_acteck
          WHERE inventario_acteck.articulo IS NOT NULL AND inventario_acteck.articulo <> '__TEST__'::text AND inventario_acteck.costopromedio > 0::numeric
          GROUP BY inventario_acteck.articulo
        )
 SELECT COALESCE(e.sku, ic.sku) AS sku,
    e.descripcion,
    e.supplier,
    e.familia,
    e.unit_price AS unit_price_usd_ultima,
    NULL::numeric AS precio_aaa_mxn,
    NULL::numeric AS precio_descuento_mxn,
    ic.costo_promedio_mxn
   FROM embarques_recientes e
     FULL JOIN inv_costo ic ON ic.sku = e.sku
) _v where public.es_interno();
create or replace view public.v_vision_camino_lineas as select * from (
 SELECT c.movid,
    c.articulo,
    c.proveedor,
    c.descripcion,
    c.cantidad_pendiente AS piezas,
    c.costo_usd,
    c.tipocambio,
    round(c.cantidad_pendiente * c.costo_usd * c.tipocambio, 2) AS valor_mxn,
    c.fecha_emision,
    e.estatus AS estatus_embarque,
    e.eta_puerto,
    e.arribo_cedis,
    e.cedis,
    e.naviera,
        CASE
            WHEN e.po IS NULL THEN 'sin_embarque'::text
            WHEN upper(e.estatus) ~~ '%CONCLUI%'::text THEN 'concluido'::text
            WHEN upper(e.estatus) ~~ '%RECHAZ%'::text OR upper(e.estatus) ~~ '%PERDID%'::text THEN 'rechazado'::text
            WHEN upper(e.estatus) ~~ '%PRODUCC%'::text THEN 'produccion'::text
            WHEN upper(e.estatus) ~~ '%PROXIMO A ZARPAR%'::text OR upper(e.estatus) ~~ '%POR ZARPAR%'::text THEN 'por_zarpar'::text
            WHEN upper(e.estatus) ~~ '%TRANSITO%'::text OR upper(e.estatus) ~~ '%MARITIMO%'::text THEN 'transito'::text
            WHEN upper(e.estatus) ~~ '%MODULAR%'::text THEN 'pendiente_modular'::text
            WHEN upper(e.estatus) ~~ '%CONSOLIDAR%'::text THEN 'por_consolidar'::text
            ELSE 'otro'::text
        END AS bucket_estatus
   FROM compras_oc c
     LEFT JOIN embarques_compras e ON e.po = c.movid AND e.codigo = c.articulo
  WHERE c.cantidad_pendiente > 0::numeric
) _v where public.es_interno();
create or replace view public.v_vision_clientes_canal as select * from (
 SELECT anio,
    canal,
    COALESCE(admin_interna, canal) AS admin_interna,
        CASE
            WHEN canal = 'E-COMMERCE'::text THEN COALESCE(admin_interna, 'E-COMMERCE'::text)
            ELSE COALESCE(NULLIF(TRIM(BOTH FROM cliente_nombre), ''::text), 'Sin nombre'::text)
        END AS cliente_label,
    round(sum(monto_venta_pesos), 2) AS venta,
    round(sum(monto_venta_pesos) - sum(costo_venta_pesos), 2) AS margen_bruto,
    sum(piezas)::integer AS piezas
   FROM ventas_erp
  WHERE canal IS NOT NULL AND canal <> 'x'::text AND anio IS NOT NULL
  GROUP BY anio, canal, admin_interna, (
        CASE
            WHEN canal = 'E-COMMERCE'::text THEN COALESCE(admin_interna, 'E-COMMERCE'::text)
            ELSE COALESCE(NULLIF(TRIM(BOTH FROM cliente_nombre), ''::text), 'Sin nombre'::text)
        END)
) _v where public.es_interno();
create or replace view public.v_vision_factura_dimension_clientes as select * from (
 SELECT anio,
    dimension,
    valor,
    cliente_nombre,
    cliente_key,
    venta,
    contribucion,
    piezas,
    meses_activos
   FROM mv_vision_factura_dimension_clientes
) _v where public.es_interno();
create or replace view public.v_vision_factura_dimension_mes as select * from (
 SELECT anio,
    mes,
    dimension,
    valor,
    venta,
    costo,
    contribucion,
    piezas,
    n_clientes
   FROM mv_vision_factura_dimension_mes
) _v where public.es_interno();
create or replace view public.v_vision_margen_canal as select * from (
 SELECT anio,
    mes,
    canal,
    canal AS admin_interna,
    round(venta_neta, 2) AS venta,
    round(costo_venta_neta, 2) AS costo,
    round(utilidad_comercial, 2) AS margen_bruto,
    piezas_venta_neta::integer AS piezas
   FROM v_medidas_ventas_canal_mes m
  WHERE canal IS NOT NULL AND canal <> 'x'::text AND anio IS NOT NULL AND mes >= 1 AND mes <= 12
) _v where public.es_interno();
create or replace view public.v_vision_margen_categoria as select * from (
 SELECT anio,
    mes,
    COALESCE(NULLIF(TRIM(BOTH FROM familia), ''::text), 'Sin categoría'::text) AS categoria,
    round(sum(monto_venta_pesos), 2) AS venta,
    round(sum(monto_venta_pesos) FILTER (WHERE costo_venta_pesos IS NOT NULL) - sum(costo_venta_pesos) FILTER (WHERE costo_venta_pesos IS NOT NULL), 2) AS margen_bruto,
    sum(piezas)::integer AS piezas
   FROM ventas_erp
  WHERE familia IS NOT NULL AND anio IS NOT NULL AND mes >= 1 AND mes <= 12
  GROUP BY anio, mes, familia
) _v where public.es_interno();
create or replace view public.v_vision_margen_marca as select * from (
 SELECT anio,
    mes,
    COALESCE(NULLIF(TRIM(BOTH FROM marca), ''::text), 'Sin marca'::text) AS marca,
    round(sum(monto_venta_pesos), 2) AS venta,
    round(sum(monto_venta_pesos) FILTER (WHERE costo_venta_pesos IS NOT NULL) - sum(costo_venta_pesos) FILTER (WHERE costo_venta_pesos IS NOT NULL), 2) AS margen_bruto,
    sum(piezas)::integer AS piezas
   FROM ventas_erp
  WHERE marca IS NOT NULL AND anio IS NOT NULL AND mes >= 1 AND mes <= 12
  GROUP BY anio, mes, marca
) _v where public.es_interno();
create or replace view public.v_sellin_global_sku_anio_erp as select * from (
 SELECT sku,
    anio,
    fact_neta,
    contribucion,
    piezas,
    pct_mc
   FROM mv_sellin_global_sku_anio_erp
) _v where public.es_interno();
create or replace view public.v_sellin_global_sku_mes_erp as select * from (
 WITH s AS (
         SELECT erp_ventas.articulo AS sku,
            erp_ventas.anio,
            erp_ventas.mes,
            sum(
                CASE
                    WHEN erp_ventas.movimiento_venta = ANY (ARRAY['Factura'::text, 'Factura Com.Ext33'::text]) THEN COALESCE(erp_ventas.monto_venta_pesos, 0::numeric)
                    ELSE 0::numeric
                END) AS fact_bruta,
            sum(
                CASE
                    WHEN erp_ventas.movimiento_venta = 'Devolucion Venta'::text AND COALESCE(erp_ventas.instruccion, ''::text) !~~* 'nota credito'::text THEN COALESCE(erp_ventas.monto_venta_pesos, 0::numeric)
                    ELSE 0::numeric
                END) AS devoluciones,
            sum(
                CASE
                    WHEN erp_ventas.movimiento_venta = 'Devolucion Venta'::text AND erp_ventas.instruccion ~~* 'nota credito'::text THEN COALESCE(erp_ventas.monto_venta_pesos, 0::numeric)
                    ELSE 0::numeric
                END) AS rmas,
            sum(
                CASE
                    WHEN erp_ventas.movimiento_venta = 'Bonificacion Venta'::text THEN COALESCE(erp_ventas.monto_venta_pesos, 0::numeric)
                    ELSE 0::numeric
                END) AS bonificaciones,
            sum(
                CASE
                    WHEN erp_ventas.movimiento_venta = 'Factura'::text THEN COALESCE(erp_ventas.costo_venta_pesos, 0::numeric)
                    ELSE 0::numeric
                END) AS costo_fact_bruta,
            sum(
                CASE
                    WHEN erp_ventas.movimiento_venta = 'Devolucion Venta'::text AND COALESCE(erp_ventas.instruccion, ''::text) !~~* 'nota credito'::text THEN COALESCE(erp_ventas.costo_venta_pesos, 0::numeric)
                    ELSE 0::numeric
                END) AS costo_devoluciones,
            sum(COALESCE(erp_ventas.unidades, erp_ventas.piezas, 0::numeric)) AS piezas
           FROM erp_ventas
          WHERE erp_ventas.articulo IS NOT NULL AND erp_ventas.anio IS NOT NULL AND erp_ventas.mes IS NOT NULL
          GROUP BY erp_ventas.articulo, erp_ventas.anio, erp_ventas.mes
        )
 SELECT sku,
    anio,
    mes,
    fact_bruta,
    devoluciones,
    rmas,
    bonificaciones,
    piezas,
    fact_bruta + devoluciones AS fact_neta,
    fact_bruta + devoluciones + rmas + bonificaciones AS venta_neta,
    fact_bruta + devoluciones - (costo_fact_bruta + costo_devoluciones) AS contribucion
   FROM s
) _v where public.es_interno();
create or replace view public.v_apoyos_convenio as select * from (
 SELECT cliente,
    sku,
    titulo,
    anio,
    semana,
    stock,
    costo_convenio,
    precio_venta,
    precio_factura,
    fecha_factura,
    apoyo_pz,
    apoyo_pct,
    vendidas_90d,
    apoyo_inventario
   FROM mv_apoyos_convenio
) _v where public.es_interno();
create or replace view public.v_analisis_cliente_mes as select anio, mes, cliente, cliente_nombre, cliente_key, canal, fact_bruta, devoluciones, rmas, bonificaciones, case when public.es_interno() then costo_fact_bruta end as costo_fact_bruta, case when public.es_interno() then costo_devoluciones end as costo_devoluciones, case when public.es_interno() then costo_rmas end as costo_rmas, piezas_venta_neta, renglones, fact_neta, venta_neta, case when public.es_interno() then costo_fact_neta end as costo_fact_neta, case when public.es_interno() then costo_venta_neta end as costo_venta_neta, case when public.es_interno() then contribucion end as contribucion, case when public.es_interno() then contribucion_bruta end as contribucion_bruta, case when public.es_interno() then utilidad_comercial end as utilidad_comercial, case when public.es_interno() then pct_mc end as pct_mc, case when public.es_interno() then pct_muc end as pct_muc, pct_ajustes from (
 SELECT anio,
    mes,
    cliente,
    cliente_nombre,
    cliente_key,
    canal,
    round(fact_bruta, 2) AS fact_bruta,
    round(devoluciones, 2) AS devoluciones,
    round(rmas, 2) AS rmas,
    round(bonificaciones, 2) AS bonificaciones,
    round(costo_fact_bruta, 2) AS costo_fact_bruta,
    round(costo_devoluciones, 2) AS costo_devoluciones,
    round(costo_rmas, 2) AS costo_rmas,
    round(piezas_venta_neta, 2) AS piezas_venta_neta,
    renglones,
    round(fact_neta, 2) AS fact_neta,
    round(venta_neta, 2) AS venta_neta,
    round(costo_fact_neta, 2) AS costo_fact_neta,
    round(costo_venta_neta, 2) AS costo_venta_neta,
    round(contribucion, 2) AS contribucion,
    round(contribucion_bruta, 2) AS contribucion_bruta,
    round(utilidad_comercial, 2) AS utilidad_comercial,
    round(pct_mc, 2) AS pct_mc,
    round(pct_muc, 2) AS pct_muc,
    round(pct_ajustes, 2) AS pct_ajustes
   FROM ( SELECT m.anio,
            m.mes,
            m.cliente,
            m.cliente_nombre,
            m.cliente_key,
            m.canal,
            m.fact_bruta,
            m.devoluciones,
            m.rmas,
            m.bonificaciones,
            m.costo_fact_bruta,
            m.costo_devoluciones,
            m.costo_rmas,
            m.piezas_venta_neta,
            m.renglones,
            m.fact_neta,
            m.venta_neta,
            m.costo_fact_neta,
            m.costo_venta_neta,
            m.contribucion,
            m.contribucion_bruta,
            m.utilidad_comercial,
                CASE
                    WHEN m.fact_neta <> 0::numeric THEN m.contribucion / m.fact_neta
                    ELSE NULL::numeric
                END AS pct_mc,
                CASE
                    WHEN m.venta_neta <> 0::numeric THEN m.utilidad_comercial / m.venta_neta
                    ELSE NULL::numeric
                END AS pct_muc,
                CASE
                    WHEN m.fact_bruta <> 0::numeric THEN (m.devoluciones + m.rmas + m.bonificaciones) / m.fact_bruta
                    ELSE NULL::numeric
                END AS pct_ajustes
           FROM mv_analisis_cliente_mes m) t
) _v where public.es_interno() OR public.cliente_visible(cliente_key);
create or replace view public.v_inventario_comercial as select sku, disponible, inventario, case when public.es_interno() then costo_promedio end as costo_promedio, case when public.es_interno() then costo_disponible end as costo_disponible, almacenes_con_stock, por_almacen from (
 SELECT ia.articulo AS sku,
    sum(ia.disponible) AS disponible,
    sum(ia.inventario) AS inventario,
    avg(ia.costopromedio) AS costo_promedio,
    sum(ia.costodisponible) AS costo_disponible,
    count(DISTINCT ia.no_almacen) AS almacenes_con_stock,
    jsonb_object_agg(ia.no_almacen, ia.disponible) FILTER (WHERE ia.disponible > 0::numeric) AS por_almacen
   FROM inventario_acteck ia
     JOIN almacenes_config ac ON ac.no_almacen = ia.no_almacen AND ac.comercial = true
  WHERE ia.articulo IS NOT NULL AND ia.articulo <> '__TEST__'::text
  GROUP BY ia.articulo
) _v;
create or replace view public.v_cuota_erp_mes as select cuota_cliente, cliente_erp, cliente_nombre, cuenta_sellout, anio, mes, cuota_venta, cuota_minima, cuota_piezas, case when public.es_interno() then cuota_costo end as cuota_costo, case when public.es_interno() then cuota_contribucion end as cuota_contribucion from (
 SELECT m.cuota_cliente,
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
   FROM v_cuota_cliente_erp m
     JOIN v_medidas_cuota_cliente_mes q ON q.cliente_key = m.cuota_cliente
) _v;
create or replace view public.pcel_sku_map as select sku_pcel, sku_acteck, case when public.es_interno() then costo_promedio end as costo_promedio from (
 SELECT DISTINCT ON (sku) sku AS sku_pcel,
    upper(TRIM(BOTH FROM modelo)) AS sku_acteck,
    costo_promedio
   FROM sellout_pcel sp
  WHERE modelo IS NOT NULL AND TRIM(BOTH FROM modelo) <> ''::text AND upper(TRIM(BOTH FROM modelo)) ~ '^(AC|BR)-'::text
  ORDER BY sku, anio DESC, semana DESC
) _v;
create or replace view public.v_analisis_cliente_sku_mes as
select anio, mes, cliente, articulo, marca, categoria, fact_neta, case when public.es_interno() then contribucion end as contribucion, piezas_venta_neta
from public.mv_analisis_cliente_sku_mes m where public.es_interno() or m.cliente in (select x.cliente from public.mv_analisis_cliente_mes x where public.cliente_visible(x.cliente_key));
grant select on public.v_analisis_cliente_sku_mes to anon, authenticated, service_role;
revoke select on public.mv_analisis_cliente_mes from anon, authenticated;
revoke select on public.mv_analisis_cliente_sku_mes from anon, authenticated;
revoke select on public.mv_apoyos_convenio from anon, authenticated;
revoke select on public.mv_erp_medidas_canal_mes from anon, authenticated;
revoke select on public.mv_erp_medidas_cliente_mes from anon, authenticated;
revoke select on public.mv_medidas_inventario from anon, authenticated;
revoke select on public.mv_medidas_ventas_vendedor_mes from anon, authenticated;
revoke select on public.mv_resumen_costo_sku from anon, authenticated;
revoke select on public.mv_sellin_global_sku_anio_erp from anon, authenticated;
revoke select on public.mv_vision_factura_dimension_clientes from anon, authenticated;
revoke select on public.mv_vision_factura_dimension_mes from anon, authenticated;
