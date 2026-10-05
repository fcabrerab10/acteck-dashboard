// Cobranza general · datos (2026-10-04): estados_cuenta de los tres clientes propios (últimos 14 cortes cada uno), el
// detalle del ÚLTIMO corte de cada uno y la configuración de crédito. estados_cuenta* se cargan por el importador (no las
// escribe la app) → cachedQuery; clientes_credito_config sí la escribe la app → directo.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { cachedQuery } from '../../../lib/queries';
import { CLIENTES, resumirCliente, consolidar } from './calculo';

export function useCobranzaGlobal(enabled = true) {
  return useQuery({
    queryKey: ['cobranza_global'], staleTime: 5 * 60 * 1000, enabled,
    queryFn: async () => {
      const [ec, cfg] = await Promise.all([
        cachedQuery(supabase.from('estados_cuenta').select('id,cliente,anio,semana,fecha_corte,saldo_actual,saldo_vencido,saldo_a_vencer,dso,tipo_cambio,linea_credito_usd,aging_d0_30,aging_d31_60,aging_d61_90,aging_mas90').in('cliente', CLIENTES).order('fecha_corte', { ascending: false }).limit(60)),
        supabase.from('clientes_credito_config').select('cliente,plazo_dias_credito,linea_credito_usd,linea_credito_mxn_pagare,aseguradora').in('cliente', CLIENTES),
      ]);
      if (ec.error) throw ec.error;
      const cortesPor = Object.fromEntries(CLIENTES.map((k) => [k, (ec.data || []).filter((r) => r.cliente === k).sort((a, b) => String(b.fecha_corte).localeCompare(String(a.fecha_corte))).slice(0, 14)]));
      const ultimos = CLIENTES.map((k) => cortesPor[k][0]?.id).filter(Boolean);
      const det = ultimos.length ? await cachedQuery(supabase.from('estados_cuenta_detalle').select('estado_cuenta_id,movimiento,referencia,fecha_emision,vencimiento,importe_factura,saldo_actual,dias_moratorios').in('estado_cuenta_id', ultimos).gt('saldo_actual', 0)) : { data: [] };
      const config = Object.fromEntries((cfg.data || []).map((c) => [c.cliente, c]));
      const clientes = CLIENTES.map((k) => resumirCliente(k, cortesPor[k], (det.data || []).filter((d) => d.estado_cuenta_id === cortesPor[k][0]?.id), config[k]));
      return { clientes, total: consolidar(clientes) };
    },
  });
}
