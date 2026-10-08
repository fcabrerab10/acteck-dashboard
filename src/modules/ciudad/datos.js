// Acteck Ciudad · datos. Todo se pide SÓLO cuando la pestaña está montada (enabled) y son consultas chicas:
// nada de esto viaja con el arranque ni con las demás pestañas. Mismas vistas que ya usa el dashboard.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { fetchAll, cachedQuery } from '../../lib/queries';
import { construirModelo, ponerPosEnPuerto, topSkus, cuotasPorCuenta } from './modelo';
import { venceEn, estaVencido } from '../comercial/pagosv3/estados'; // banco: mismas reglas de vencimiento que la bandeja de Pagos

const STALE = 5 * 60 * 1000;
const iso = (d) => d.toISOString().slice(0, 10);

export function useCiudadData(enabled = true) {
  return useQuery({
    queryKey: ['ciudad', 'datos', iso(new Date())], staleTime: STALE, enabled,
    queryFn: async () => {
      const hoy = new Date();
      const anio = hoy.getFullYear();
      const hoyIso = iso(hoy);
      const hace10 = iso(new Date(hoy.getTime() - 10 * 86400000));
      const hace40 = iso(new Date(hoy.getTime() - 40 * 86400000));
      // Si una capa falla (vista sin permiso, timeout) la ciudad se dibuja sin ella en vez de no dibujarse.
      const seg = (p, nombre) => Promise.resolve(p).catch((e) => { console.warn(`[ciudad] ${nombre}:`, e?.message || e); return []; });
      const mes = hoy.getMonth() + 1; const mesPrev = mes === 1 ? 12 : mes - 1;
      const [perfiles, inventario, contenedores, sucursales, vendedoresMayoristas, vendedoresErp, cuentas, facturas, agendaHoy, reunionesHoy, viajesHoy, alertasOc, cuentaMes, clientesFinales, cartera, envios, pagos, forecast, avisosForecast, inventarioSku, marcasSku, demandaSku, cuotaMes, ventaMes, pagosHechos, syncUlt] = await Promise.all([
        seg(fetchAll('perfiles', 'user_id,nombre,email,puesto,rol,tipo,activo,avatar_url'), 'perfiles'),
        seg(cachedQuery(supabase.from('v_medidas_inventario').select('inv_actual,inv_actual_piezas,dias_inv,skus_con_stock,actualizado').limit(1)).then((r) => r.data || []), 'inventario'),
        seg(fetchAll('v_embarques_contenedor', 'contenedor,supplier,naviera,estatus,piezas,pos,fob_usd,fecha_emision,fin_produccion,etd,eta_puerto,arribo_cedis', (q) => q.or(`arribo_cedis.is.null,arribo_cedis.gte.${hace40}`)), 'contenedores'),
        seg(fetchAll('vs_sellout_sucursal_mes', 'cuenta,anio,mes,sucursal,importe,vendedores,estado', (q) => q.gte('anio', anio - 1)), 'sucursales'),
        seg(fetchAll('vs_sellout_vendedor_mes', 'cuenta,anio,mes,vendedor,importe,sucursal', (q) => q.eq('anio', anio)), 'vendedores mayoristas'),
        seg(fetchAll('v_ventas_vendedor_cliente_mes', 'anio,mes,vendedor,cliente_key,cliente_nombre,fact_neta', (q) => q.eq('anio', anio)), 'vendedores ERP'),
        seg(fetchAll('v_sellout_cuentas', 'cuenta,nombre,canal_sellout,erp_cliente,propio,tiene_sellout'), 'cuentas'),
        seg(fetchAll('v_erp_facturas_oc', 'cliente_key,folio,fecha,piezas,monto', (q) => q.gte('fecha', hace10)), 'facturas'),
        seg(supabase.from('agenda_items').select('propietario,responsables,estado,titulo,cuando,fecha_limite,inicio_real').or(`cuando.eq.${hoyIso},fecha_limite.eq.${hoyIso}`).then((r) => r.data || []), 'agenda'),
        seg(supabase.from('agenda_reuniones').select('id,titulo,fecha,duracion_min,tipo,cliente_key,asistentes,creado_por').gte('fecha', `${hoyIso}T00:00:00`).lte('fecha', `${hoyIso}T23:59:59`).then((r) => r.data || []), 'reuniones'),
        // Presencia (3.90.40): viajes que empezaron antes y siguen hoy (tipo 'viaje' con fecha_fin).
        seg(supabase.from('agenda_reuniones').select('id,titulo,fecha,fecha_fin,tipo,asistentes,creado_por').eq('tipo', 'viaje').lt('fecha', `${hoyIso}T00:00:00`).gte('fecha_fin', `${hoyIso}T00:00:00`).then((r) => { if (r.error) throw r.error; return r.data || []; }), 'viajes'),
        // Burbujas (3.90.45): pedidos de cliente detenidos (alerta `oc_detenida`, la misma de la campana; sin snooze ni destinatario).
        seg(supabase.from('alertas').select('tipo,titulo,cliente_key').eq('tipo', 'oc_detenida').is('resuelta_at', null).is('para_usuario', null).or(`snooze_hasta.is.null,snooze_hasta.lt.${hoy.toISOString()}`).limit(200).then((r) => { if (r.error) throw r.error; return r.data || []; }), 'alertas OC'),
        seg(fetchAll('v_sellout_cuenta_mes', 'cuenta,anio,mes,importe', (q) => q.gte('anio', anio - 1)), 'cuenta mes'),
        // Etapa 2: clientes finales (dos meses, por estado), cartera de los propios y envíos en tránsito del Tracking.
        seg(fetchAll('vs_sellout_cliente_final_mes', 'cuenta,anio,mes,estado,importe', (q) => q.gte('anio', anio - (mes === 1 ? 1 : 0)).in('mes', [mes, mesPrev])), 'clientes finales'),
        seg(fetchAll('v_vision_cartera_consolidada', 'cliente,fecha_corte,saldo_actual,saldo_vencido,dso'), 'cartera'),
        seg(supabase.from('oc_envios').select('fecha_surtida,fecha_entregada,fecha_envio_erp,fecha_entrega_erp,guia_rastreo,paqueteria,oc_clientes(cliente_key,numero_oc)').or(`fecha_surtida.gte.${iso(new Date(hoy.getTime() - 30 * 86400000))},fecha_envio_erp.gte.${iso(new Date(hoy.getTime() - 30 * 86400000))}`).then((r) => { if (r.error) throw r.error; return r.data || []; }), 'envíos'),
        // Etapa 3: banco/tesorería · pagos abiertos de Pagos V3 (sólo lo necesario para «vence en 7 días» y «vencidos»).
        seg(supabase.from('pagos').select('estado,monto,fecha_programada,fecha_compromiso').not('estado', 'in', '(pagado,cancelado,rechazado)').then((r) => { if (r.error) throw r.error; return r.data || []; }), 'pagos'),
        // Torre de pronóstico: propuestas (sin borradores) con sus líneas y avisos de arribo de ayer a 7 días (como Proyectos y forecast).
        seg(supabase.from('forecast_propuestas').select('id,estatus,cerrado_at,forecast_propuesta_lineas(confirmado,comprado_at)').neq('estatus', 'borrador').then((r) => { if (r.error) throw r.error; return r.data || []; }), 'forecast'),
        seg(supabase.from('forecast_avisos').select('propuesta_id,tipo,fecha_arribo,piezas_a_reservar').gte('fecha_arribo', iso(new Date(hoy.getTime() - 86400000))).lte('fecha_arribo', iso(new Date(hoy.getTime() + 7 * 86400000))).then((r) => { if (r.error) throw r.error; return r.data || []; }), 'avisos forecast'),
        // Interior del CEDIS: inventario por SKU (sólo [Inv Actual], como Inventario) y la marca de cada SKU (roadmap_sku) → racks por marca.
        seg(fetchAll('v_inventario_almacen_medida', 'articulo,inventario,costoinventario', (q) => q.eq('en_inv_actual', true).gt('inventario', 0)), 'inventario por SKU'),
        seg(fetchAll('roadmap_sku', 'sku,marca'), 'marcas'),
        // Días de inventario por marca: demanda de los 3 meses cerrados del pivote de sell in (como Inventario en el celular).
        seg(fetchAll('v_sellin_global_sku_anio', 'sku,anio,piezas', (q) => q.in('anio', [...new Set([1, 2, 3].map((i) => new Date(anio, hoy.getMonth() - i, 1).getFullYear()))])), 'demanda por SKU'),
        // Capa «Cuota» (3.90.49): cuota del mes por cliente ERP con su cuenta de sell out y la venta del mes, como Análisis.
        seg(fetchAll('v_cuota_erp_mes', 'cliente_erp,cuenta_sellout,cuota_venta', (q) => q.eq('anio', anio).eq('mes', mes)), 'cuotas del mes'),
        seg(fetchAll('v_analisis_cliente_mes', 'cliente,fact_neta', (q) => q.eq('anio', anio).eq('mes', mes)), 'venta del mes por cliente'),
        // Bitácora (3.90.51): pagos registrados de los últimos 3 días (Pagos V3) y la última sincronización del puente (como Configuración).
        seg(supabase.from('pagos').select('id,cliente,concepto,monto,pagado_at').eq('estado', 'pagado').gte('pagado_at', iso(new Date(hoy.getTime() - 3 * 86400000))).order('pagado_at', { ascending: false }).limit(20).then((r) => { if (r.error) throw r.error; return r.data || []; }), 'pagos registrados'),
        seg(supabase.from('sync_events').select('status, created_at').order('created_at', { ascending: false }).limit(1).then((r) => { if (r.error) throw r.error; return r.data || []; }), 'última sincronización'),
      ]);
      const crudos = { perfiles, inventario, contenedores, sucursales, vendedoresMayoristas, vendedoresErp, cuentas, facturas, agendaHoy, reunionesHoy, viajesHoy, alertasOc, cuentaMes, clientesFinales, cartera, envios, pagos, reglasPagos: { venceEn, estaVencido }, forecast, avisosForecast, inventarioSku, demandaSku, marcasSku: new Map(marcasSku.map((r) => [r.sku, r.marca])) };
      const modelo = construirModelo(crudos, hoy);
      modelo.crudos = crudos; // barra de tiempo: la ciudad se rearma con datosEnFecha(crudos, fecha)
      modelo.pagosHechos = pagosHechos; modelo.ultimaSync = syncUlt[0] || null; // bitácora: si fallan, quedan vacíos
      try { modelo.cuotas = cuotasPorCuenta(cuotaMes, ventaMes); } catch (e) { console.warn('[ciudad] cuotas', e); } // capa «Cuota»: falla sola
      // Números de PO de los contenedores dibujados (tarjeta del barco). Consulta chica; si falla, la tarjeta muestra sólo el conteo.
      const ids = [...(modelo.puerto?.barcos || []), ...(modelo.puerto?.tarimas || [])].map((b) => b.id).filter(Boolean);
      if (ids.length) ponerPosEnPuerto(modelo.puerto, await seg(fetchAll('embarques_compras', 'contenedor,po', (q) => q.in('contenedor', ids)), 'POs por contenedor'));
      return modelo;
    },
  });
}

// Tienda visitable (3.90.41): top 5 SKUs de UNA sucursal, sólo cuando se toca la tienda (misma consulta que Análisis en el celular).
// Si en el mes aún no hay venta, toma el mes anterior y lo dice.
export function useTopSkusTienda(cuenta, sucursal, enabled = true) {
  const hoy = new Date(); const anio = hoy.getFullYear(), mes = hoy.getMonth() + 1;
  return useQuery({
    queryKey: ['ciudad', 'tienda-skus', cuenta, sucursal, anio, mes], staleTime: STALE, enabled: enabled && !!cuenta && !!sucursal,
    queryFn: async () => {
      const pedir = async (a, m) => { const { data, error } = await supabase.from('v_sellout_general_cuenta').select('sku,importe,cantidad').eq('cuenta', cuenta).eq('anio', a).eq('mes', m).eq('sucursal', sucursal).limit(5000); if (error) throw error; return topSkus(data, 5); };
      const lista = await pedir(anio, mes);
      if (lista.length) return { lista, periodo: 'este mes' };
      return { lista: await pedir(mes === 1 ? anio - 1 : anio, mes === 1 ? 12 : mes - 1), periodo: 'mes anterior' };
    },
  });
}
