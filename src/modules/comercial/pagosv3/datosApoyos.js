// Datos para el formulario de Apoyo por producto (lecturas puntuales, todas cacheadas).
import { supabase } from '../../../lib/supabase';
import { isoLocal } from '../../../lib/format';
import { useQuery } from '@tanstack/react-query';
import { cachedQuery, fetchAll } from '../../../lib/queries';

const q = async (b) => { const { data, error } = await cachedQuery(b); if (error) throw error; return data || []; };

/** Busca SKUs en el roadmap por SKU o descripción (máx. 8). */
export async function buscarSkus(texto) {
  const t = String(texto || '').trim().replace(/[%_]/g, '');
  if (t.length < 2) return [];
  const sinGuion = t.replace(/-/g, '');
  const conGuion = /^[a-z]{2}\d/i.test(sinGuion) ? `${sinGuion.slice(0, 2)}-${sinGuion.slice(2)}` : t;
  return q(supabase.from('roadmap_sku').select('sku,descripcion,marca').or(`sku.ilike.%${conGuion}%,sku.ilike.%${t}%,descripcion.ilike.%${t}%`).limit(8));
}

/** Precio de la última factura al cliente e inventario que hoy reporta el cliente para ese SKU. */
export async function datosProducto(clienteKey, sku) {
  const [fact, inv] = await Promise.all([
    q(supabase.from('erp_ventas').select('periodo,precio_unidad_pesos,unidades').eq('cliente_key', clienteKey).eq('articulo', sku).eq('movimiento_venta', 'Factura').order('periodo', { ascending: false }).limit(1)),
    q(supabase.from('v_inventario_cliente_ultimo').select('stock,anio,semana').eq('cliente', clienteKey).eq('sku', sku).limit(1)),
  ]);
  return {
    precio_factura: fact[0] ? Number(fact[0].precio_unidad_pesos) || 0 : 0,
    factura_fecha: fact[0]?.periodo || null,
    inv_restante: inv[0] ? Number(inv[0].stock) || 0 : null,
    inv_semana: inv[0] ? `${inv[0].anio}-${String(inv[0].semana).padStart(2, '0')}` : null,
  };
}

/** Documentos de bonificación del ERP del cliente (últimos ~15 meses), uno por venta_id, monto en positivo. */
export async function bonificacionesErp(clienteKey) {
  const desde = new Date(); desde.setMonth(desde.getMonth() - 15);
  const rows = await q(supabase.from('erp_ventas').select('venta_id,folio,periodo,articulo,descripcion,monto_venta_pesos,referencia')
    .eq('cliente_key', clienteKey).eq('rama', 'SERVICIOS').eq('movimiento_venta', 'Bonificacion Venta').gte('periodo', isoLocal(desde))
    .order('periodo', { ascending: false }).limit(400));
  const m = new Map();
  for (const r of rows) {
    const k = r.venta_id;
    const cur = m.get(k) || { venta_id: k, folio: r.folio, fecha: String(r.periodo).slice(0, 10), concepto_codigo: r.articulo, concepto: r.descripcion, referencia: r.referencia, monto: 0 };
    cur.monto += Math.abs(Number(r.monto_venta_pesos) || 0);
    m.set(k, cur);
  }
  return [...m.values()].map((b) => ({ ...b, monto: Math.round(b.monto * 100) / 100 })).sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/** venta_id de las bonificaciones ya ligadas a un pago (para marcarlas en la lista). */
export function bonificacionesLigadas(pagos = []) {
  const m = new Map();
  for (const p of pagos) { const b = p?.detalle?.bonificacion; if (b?.venta_id != null) m.set(b.venta_id, p); }
  return m;
}

/** Apoyos acumulados por SKU de un cliente (pagos tipo apoyo_producto, sin cancelados): sku → { monto, piezas, n, ultimo, folios }. */
export async function apoyosPorSku(clienteKey) {
  const pagos = await fetchAll('pagos', 'id,cliente,estado,periodo,created_at,detalle', (q) => q.eq('tipo', 'apoyo_producto').eq('cliente', clienteKey).neq('estado', 'cancelado'));
  const m = new Map();
  for (const p of pagos || []) {
    const fecha = p.detalle?.bonificacion?.fecha || (p.periodo ? `${p.periodo}-01` : String(p.created_at || '').slice(0, 10));
    for (const l of p.detalle?.productos || []) {
      const c = m.get(l.sku) || { monto: 0, piezas: 0, n: 0, ultimo: null, folios: [] };
      c.monto += Number(l.monto) || 0; c.piezas += Number(l.piezas) || 0; c.n += 1;
      if (!c.ultimo || fecha > c.ultimo) c.ultimo = fecha;
      if (p.detalle?.bonificacion?.folio) c.folios.push(p.detalle.bonificacion.folio);
      m.set(l.sku, c);
    }
  }
  return m;
}
export function useApoyosPorSku(clienteKey, enabled = true) {
  return useQuery({ queryKey: ['apoyos_sku', clienteKey], queryFn: () => apoyosPorSku(clienteKey), enabled: !!clienteKey && enabled, staleTime: 5 * 60 * 1000 });
}
