// Acteck Ciudad · datos. Todo se pide SÓLO cuando la pestaña está montada (enabled) y son consultas chicas:
// nada de esto viaja con el arranque ni con las demás pestañas. Mismas vistas que ya usa el dashboard.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { fetchAll, cachedQuery } from '../../lib/queries';
import { construirModelo } from './modelo';

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
      const [perfiles, inventario, contenedores, sucursales, vendedoresMayoristas, vendedoresErp, cuentas, facturas, agendaHoy, reunionesHoy, cuentaMes, clientesFinales, cartera, envios] = await Promise.all([
        seg(fetchAll('perfiles', 'user_id,nombre,email,puesto,rol,tipo,activo,avatar_url'), 'perfiles'),
        seg(cachedQuery(supabase.from('v_medidas_inventario').select('inv_actual,inv_actual_piezas,dias_inv,skus_con_stock,actualizado').limit(1)).then((r) => r.data || []), 'inventario'),
        seg(fetchAll('v_embarques_contenedor', 'contenedor,supplier,naviera,estatus,piezas,fob_usd,fecha_emision,fin_produccion,etd,eta_puerto,arribo_cedis', (q) => q.or(`arribo_cedis.is.null,arribo_cedis.gte.${hace40}`)), 'contenedores'),
        seg(fetchAll('vs_sellout_sucursal_mes', 'cuenta,anio,mes,sucursal,importe,vendedores,estado', (q) => q.gte('anio', anio - 1)), 'sucursales'),
        seg(fetchAll('vs_sellout_vendedor_mes', 'cuenta,anio,mes,vendedor,importe,sucursal', (q) => q.eq('anio', anio)), 'vendedores mayoristas'),
        seg(fetchAll('v_ventas_vendedor_cliente_mes', 'anio,vendedor,cliente_key,cliente_nombre,fact_neta', (q) => q.eq('anio', anio)), 'vendedores ERP'),
        seg(fetchAll('v_sellout_cuentas', 'cuenta,nombre,canal_sellout,erp_cliente,propio,tiene_sellout'), 'cuentas'),
        seg(fetchAll('v_erp_facturas_oc', 'cliente_key,folio,fecha,piezas,monto', (q) => q.gte('fecha', hace10)), 'facturas'),
        seg(supabase.from('agenda_items').select('propietario,responsables,estado,titulo,cuando,fecha_limite,inicio_real').or(`cuando.eq.${hoyIso},fecha_limite.eq.${hoyIso}`).then((r) => r.data || []), 'agenda'),
        seg(supabase.from('agenda_reuniones').select('titulo,fecha,duracion_min,tipo,cliente_key').gte('fecha', `${hoyIso}T00:00:00`).lte('fecha', `${hoyIso}T23:59:59`).then((r) => r.data || []), 'reuniones'),
        seg(fetchAll('v_sellout_cuenta_mes', 'cuenta,anio,mes,importe', (q) => q.gte('anio', anio - 1)), 'cuenta mes'),
        // Etapa 2: clientes finales (dos meses, por estado), cartera de los propios y envíos en tránsito del Tracking.
        seg(fetchAll('vs_sellout_cliente_final_mes', 'cuenta,anio,mes,estado,importe', (q) => q.gte('anio', anio - (mes === 1 ? 1 : 0)).in('mes', [mes, mesPrev])), 'clientes finales'),
        seg(fetchAll('v_vision_cartera_consolidada', 'cliente,fecha_corte,saldo_actual,saldo_vencido,dso'), 'cartera'),
        seg(supabase.from('oc_envios').select('fecha_surtida,fecha_entregada,fecha_envio_erp,fecha_entrega_erp,guia_rastreo,paqueteria,oc_clientes(cliente_key,numero_oc)').or(`fecha_surtida.gte.${iso(new Date(hoy.getTime() - 30 * 86400000))},fecha_envio_erp.gte.${iso(new Date(hoy.getTime() - 30 * 86400000))}`).then((r) => { if (r.error) throw r.error; return r.data || []; }), 'envíos'),
      ]);
      return construirModelo({ perfiles, inventario, contenedores, sucursales, vendedoresMayoristas, vendedoresErp, cuentas, facturas, agendaHoy, reunionesHoy, cuentaMes, clientesFinales, cartera, envios }, hoy);
    },
  });
}
