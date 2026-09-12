// Carga de datos de Inicio · SOLO vía src/lib/queries.js (fetchAll / cachedQuery) + supabase directo
// para las tablas que la app escribe (pagos, marketing_actividades, eventos_*, auditoria_cambios),
// que NO pasan por cachedQuery (cache 5 min por URL).
//
// Fuentes por bloque:
//   Hero / KPIs / gráfica      → v_erp_medidas_mes (2 años) · cuotas_canales (TOTAL) o cuotas_mensuales (Σ)
//   Cartera                    → estados_cuenta (último corte por cliente)
//   Inventario + tránsito      → v_medidas_inventario (medidas del director: Inv Actual, Dias de Inv)
//                                + v_inventario_comercial (SÓLO el costo por SKU, para valuar el tránsito)
//                                + v_transito_sku (agrupado por PO en calc.js)
//   Clientes                   → v_fact_cliente_mes · cuotas_mensuales · v_erp_medidas_cliente_mes ·
//                                v_sellout_digitalife_mensual / v_sellout_pcel_mensual / v_sellout_dicotech_mensual
//   Canales                    → v_erp_medidas_canal_mes (MV mv_erp_medidas_canal_mes, migración 20260911) · cuotas_canales (canal)
//   Próximos 7 días            → pagos · v_transito_sku · marketing_actividades · eventos_equipo · eventos_cliente
//   Últimos cambios            → auditoria_cambios (5) · v_fuentes_frescura (erp_ventas) vía useFrescura en el componente
//   Requiere decisión          → alertas vía useAlertas (lib/alertas.js) en el componente
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { fetchAll, cachedQuery } from '../../../lib/queries';
import { CLIENTES, DIAS_AGENDA } from './config';

const MEDIDAS = 'anio,mes,fact_bruta,devoluciones,rmas,bonificaciones,fact_neta,venta_neta,costo_venta_neta,contribucion,utilidad_comercial,piezas_venta_neta';
const KEYS = CLIENTES.map((c) => c.key);
const iso = (d) => d.toISOString().slice(0, 10);

// Lecturas opcionales (tablas que pueden no existir o no tener permiso): nunca tumban la pantalla.
async function opcional(p, vacio = []) {
  try { const r = await p; return r?.error ? vacio : (r?.data ?? vacio); } catch { return vacio; }
}

export function useInicioData(anio) {
  const [st, setSt] = useState({ loading: true, error: null, data: null });

  useEffect(() => {
    let cancel = false;
    setSt({ loading: true, error: null, data: null });
    const anios = [anio - 1, anio];
    const hoy = new Date(); const hoyISO = iso(hoy);
    const limiteISO = iso(new Date(hoy.getTime() + DIAS_AGENDA * 86400000));
    (async () => {
      try {
        const [
          medidas, medidasCli, medidasCanal, cuotasCanales, cuotasMensuales, factCli,
          soDl, soPcel, soDico, estados, medInv, inv, transito,
          pagos, marketing, eventosEquipo, eventosCliente, auditoria,
        ] = await Promise.all([
          cachedQuery(supabase.from('v_erp_medidas_mes').select(`${MEDIDAS},cv_ultimos_3_meses`).in('anio', anios).order('anio').order('mes')),
          cachedQuery(supabase.from('v_erp_medidas_cliente_mes').select(`cliente_key,${MEDIDAS}`).in('anio', anios).in('cliente_key', KEYS)),
          cachedQuery(supabase.from('v_erp_medidas_canal_mes').select(`canal,${MEDIDAS}`).in('anio', anios)),
          cachedQuery(supabase.from('cuotas_canales').select('anio,dimension_tipo,dimension_valor,meta_facturacion,meta_margen_pct').eq('anio', anio)),
          fetchAll('cuotas_mensuales', 'cliente,mes,anio,cuota_ideal,cuota_min', (q) => q.eq('anio', anio)),
          cachedQuery(supabase.from('v_fact_cliente_mes').select('cliente_key,anio,mes,monto,piezas').in('anio', anios).in('cliente_key', KEYS)),
          cachedQuery(supabase.from('v_sellout_digitalife_mensual').select('anio,mes,monto,piezas').in('anio', anios)),
          cachedQuery(supabase.from('v_sellout_pcel_mensual').select('anio,mes,monto,piezas').in('anio', anios)),
          cachedQuery(supabase.from('v_sellout_dicotech_mensual').select('anio,mes,monto,piezas').in('anio', anios)),
          cachedQuery(supabase.from('v_medidas_inventario').select('*')),
          cachedQuery(supabase.from('estados_cuenta').select('cliente,fecha_corte,saldo_actual,saldo_vencido,saldo_a_vencer,aging_mas90,dso').order('fecha_corte', { ascending: false }).limit(60)),
          fetchAll('v_inventario_comercial', 'sku,inventario,costo_promedio'),
          fetchAll('v_transito_sku', 'sku,cantidad,eta_mas_cercana,embarques_detalle'),
          opcional(supabase.from('pagos').select('id,cliente,concepto,categoria,monto,estatus,fecha_compromiso').in('estatus', ['pendiente', 'en_proceso']).gte('fecha_compromiso', hoyISO).lte('fecha_compromiso', limiteISO).order('fecha_compromiso')),
          opcional(supabase.from('marketing_actividades').select('id,cliente,nombre,tipo,estatus,fecha,inversion').gte('fecha', hoyISO).lte('fecha', limiteISO).neq('estatus', 'archivado').order('fecha')),
          opcional(supabase.from('eventos_equipo').select('id,titulo,tipo,fecha_ini,fecha_fin').gte('fecha_ini', hoyISO).lte('fecha_ini', limiteISO).order('fecha_ini')),
          opcional(supabase.from('eventos_cliente').select('id,cliente,fecha,lugar,descripcion').gte('fecha', hoyISO).lte('fecha', limiteISO).order('fecha')),
          opcional(supabase.from('auditoria_cambios').select('id,tabla,operacion,registro_id,cliente_key,usuario_email,cambios,creado_at').order('creado_at', { ascending: false }).limit(5)),
        ]);
        if (cancel) return;
        setSt({ loading: false, error: null, data: {
          medidas: medidas.data || [], medidasCli: medidasCli.data || [], medidasCanal: medidasCanal.data || [],
          cuotasCanales: cuotasCanales.data || [], cuotasMensuales, factCli: factCli.data || [],
          sellout: { digitalife: soDl.data || [], pcel: soPcel.data || [], dicotech: soDico.data || [] },
          estados: estados.data || [], medInv: (medInv.data || [])[0] || null, inv, transito,
          pagos, marketing, eventosEquipo, eventosCliente, auditoria,
        } });
      } catch (e) {
        if (!cancel) setSt({ loading: false, error: e?.message || String(e), data: null });
      }
    })();
    return () => { cancel = true; };
  }, [anio]);

  return st;
}
