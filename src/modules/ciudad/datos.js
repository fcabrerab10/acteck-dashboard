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
      const [perfiles, inventario, contenedores, sucursales, vendedoresMayoristas, vendedoresErp, cuentas, facturas, agendaHoy, reunionesHoy, cuentaMes] = await Promise.all([
        fetchAll('perfiles', 'user_id,nombre,email,puesto,rol,tipo,activo,avatar_url'),
        cachedQuery(supabase.from('v_medidas_inventario').select('inv_actual,inv_actual_piezas,dias_inv,skus_con_stock,actualizado').limit(1)).then((r) => r.data || []),
        fetchAll('v_embarques_contenedor', 'contenedor,supplier,naviera,estatus,piezas,fob_usd,fecha_emision,fin_produccion,etd,eta_puerto,arribo_cedis', (q) => q.or(`arribo_cedis.is.null,arribo_cedis.gte.${hace40}`)),
        fetchAll('mv_sellout_sucursal_mes', 'cuenta,anio,mes,sucursal,importe,vendedores,estado', (q) => q.gte('anio', anio - 1)),
        fetchAll('mv_sellout_vendedor_mes', 'cuenta,anio,mes,vendedor,importe,sucursal', (q) => q.eq('anio', anio)),
        fetchAll('v_ventas_vendedor_cliente_mes', 'anio,vendedor,cliente_key,cliente_nombre,fact_neta', (q) => q.eq('anio', anio)),
        fetchAll('v_sellout_cuentas', 'cuenta,nombre,canal_sellout,erp_cliente,propio,tiene_sellout'),
        fetchAll('v_erp_facturas_oc', 'cliente_key,folio,fecha,piezas,monto', (q) => q.gte('fecha', hace10)),
        supabase.from('agenda_items').select('propietario,responsables,estado,titulo,cuando,fecha_limite,inicio_real').or(`cuando.eq.${hoyIso},fecha_limite.eq.${hoyIso}`).then((r) => r.data || []),
        supabase.from('agenda_reuniones').select('titulo,fecha,duracion_min,tipo,cliente_key').gte('fecha', `${hoyIso}T00:00:00`).lte('fecha', `${hoyIso}T23:59:59`).then((r) => r.data || []),
        fetchAll('v_sellout_cuenta_mes', 'cuenta,anio,mes,importe', (q) => q.gte('anio', anio - 1)),
      ]);
      return construirModelo({ perfiles, inventario, contenedores, sucursales, vendedoresMayoristas, vendedoresErp, cuentas, facturas, agendaHoy, reunionesHoy, cuentaMes }, hoy);
    },
  });
}
