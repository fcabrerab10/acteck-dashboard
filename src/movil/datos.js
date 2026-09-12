// Datos de la app móvil · SOLO vía src/lib/queries.js (fetchAll / cachedQuery) + React Query.
// Las tablas que la app escribe (pagos, pendientes, minutas, eventos_*, marketing_actividades,
// auditoria_cambios) se leen con supabase directo bajo useQuery (sin cachedQuery).
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { fetchAll, cachedQuery } from '../lib/queries';
import { mesesCerrados } from '../modules/comercial/inventario/useInventarioDatos';
import { CLIENTES_NAV, CLIENTES_ORDEN } from '../components/nav/arbol';
import { NOMBRE_CLIENTE } from '../lib/alertas';
import { N, hoyISO } from './util';

const STALE = 5 * 60 * 1000;
const opcional = async (p, vacio = []) => { try { const r = await p; return r?.error ? vacio : (r?.data ?? vacio); } catch { return vacio; } };

export const PROPIOS = CLIENTES_ORDEN;
export const nombreCliente = (k) => CLIENTES_NAV[k]?.label || NOMBRE_CLIENTE[k] || String(k || '').replace(/_/g, ' ');
export const colorCliente = (k, theme) => CLIENTES_NAV[k]?.color || theme?.indigo || theme?.accent;

// ── Clientes (pestaña) · v_fact_cliente_mes 2 años (todos los cliente_key) + cuotas + canales ERP
export function useClientesMes(anio) {
  return useQuery({
    queryKey: ['movil', 'clientes', anio], staleTime: STALE,
    queryFn: async () => {
      const anios = [anio - 1, anio];
      const [fact, cuotas, canales] = await Promise.all([
        cachedQuery(supabase.from('v_fact_cliente_mes').select('cliente_key,anio,mes,monto,piezas').in('anio', anios)),
        fetchAll('cuotas_mensuales', 'cliente,mes,anio,cuota_ideal,cuota_min', (q) => q.eq('anio', anio)),
        cachedQuery(supabase.from('v_erp_medidas_canal_mes').select('anio,mes,canal,fact_neta,contribucion,piezas_venta_neta').in('anio', anios)),
      ]);
      return { fact: fact.data || [], cuotas: cuotas || [], canales: canales.data || [] };
    },
  });
}

// ── Sell-out mensual del cliente propio (vistas por cliente)
const VISTA_SO = { digitalife: 'v_sellout_digitalife_mensual', pcel: 'v_sellout_pcel_mensual', dicotech: 'v_sellout_dicotech_mensual' };
export function useSelloutMensual(ck, anio) {
  return useQuery({
    queryKey: ['movil', 'sellout', ck, anio], staleTime: STALE, enabled: !!VISTA_SO[ck],
    queryFn: async () => (await cachedQuery(supabase.from(VISTA_SO[ck]).select('anio,mes,monto,piezas').in('anio', [anio - 1, anio]))).data || [],
  });
}

// ── Sell In del cliente: SKUs del mes (y del mes anterior por si el actual va vacío), 2 años para YoY
export function useSellInSkus(ck, anio, mes) {
  const mesPrev = mes === 1 ? 12 : mes - 1;
  const anioPrev = mes === 1 ? anio - 1 : anio;
  return useQuery({
    queryKey: ['movil', 'sellin', ck, anio, mes], staleTime: STALE, enabled: !!ck,
    queryFn: async () => {
      const anios = [...new Set([anio - 1, anio, anioPrev - 1, anioPrev])];
      const rows = await fetchAll('facturacion_clientes', 'sku,anio,mes,piezas,monto', (q) => q.eq('cliente_key', ck).in('anio', anios).in('mes', [mes, mesPrev]));
      const skus = [...new Set(rows.map((r) => r.sku).filter(Boolean))];
      const desc = await descripciones(skus);
      return { rows, desc };
    },
  });
}

// ── Descripciones · roadmap_sku (cachedQuery, como pide la búsqueda móvil) con respaldo catalogo_articulos
export async function descripciones(skus) {
  const m = new Map();
  if (!skus.length) return m;
  const chunks = Array.from({ length: Math.ceil(skus.length / 200) }, (_, i) => skus.slice(i * 200, (i + 1) * 200));
  for (const ch of chunks) {
    const { data } = await cachedQuery(supabase.from('roadmap_sku').select('sku,descripcion,marca').in('sku', ch));
    (data || []).forEach((r) => { if (!m.has(r.sku)) m.set(r.sku, { descripcion: r.descripcion || '', marca: r.marca || '' }); });
    const faltan = ch.filter((s) => !m.has(s));
    if (faltan.length) {
      const { data: cat } = await cachedQuery(supabase.from('catalogo_articulos').select('articulo,descripcion').in('articulo', faltan));
      (cat || []).forEach((r) => m.set(r.articulo, { descripcion: r.descripcion || '', marca: '' }));
    }
  }
  return m;
}

// ── Búsqueda: catálogo completo (roadmap_sku) + disponible comercial
export function useCatalogoBusqueda(enabled = true) {
  return useQuery({
    queryKey: ['movil', 'catalogo'], staleTime: STALE, enabled,
    queryFn: async () => {
      const [rm, inv] = await Promise.all([
        cachedQuery(supabase.from('roadmap_sku').select('sku,descripcion,marca,categoria').order('sku').limit(5000)),
        // Inventario = medida [Inv Actual] del director (v_medidas_inventario_sku),
        // la misma que Inventario global, Visión General e Inicio. Antes:
        // v_inventario_comercial (almacenes_config, sin filtro de Rama).
        fetchAll('v_medidas_inventario_sku', 'articulo,inv_actual_disponible,inv_actual_piezas'),
      ]);
      const disp = new Map((inv || []).map((r) => [r.articulo, { disponible: N(r.inv_actual_disponible), inventario: N(r.inv_actual_piezas) }]));
      const skus = (rm.data || []).map((r) => ({ sku: r.sku, descripcion: r.descripcion || '', marca: r.marca || '', categoria: r.categoria || '', ...(disp.get(r.sku) || { disponible: 0, inventario: 0 }) }));
      const vistos = new Set(skus.map((s) => s.sku));
      disp.forEach((v, sku) => { if (!vistos.has(sku) && (v.inventario > 0)) skus.push({ sku, descripcion: '', marca: '', categoria: '', ...v }); });
      return skus;
    },
  });
}

// ── Ficha de producto · por SKU: descripción, inventario comercial, tránsito, precios por lista, demanda 3 meses
export function useFichaProducto(skus) {
  const lista = [...skus].sort();
  return useQuery({
    queryKey: ['movil', 'ficha', lista], staleTime: STALE, enabled: lista.length > 0,
    queryFn: async () => {
      const meses = mesesCerrados();
      const porAnio = new Map();
      meses.forEach((m) => porAnio.set(m.anio, [...(porAnio.get(m.anio) || []), m.mes]));
      const clave = new Set(meses.map((m) => m.key));
      const [desc, inv, tr, pr, ...fact] = await Promise.all([
        descripciones(lista),
        cachedQuery(supabase.from('v_medidas_inventario_sku').select('articulo,inv_actual_disponible,inv_actual_piezas,inv_actual,costo_promedio').in('articulo', lista)),
        cachedQuery(supabase.from('v_transito_sku').select('sku,cantidad,eta_mas_cercana,embarques,embarques_detalle').in('sku', lista)),
        cachedQuery(supabase.from('v_estrategia_precios_lista').select('sku,lista,moneda,precio,anio,mes').in('sku', lista)),
        ...Array.from(porAnio.entries()).map(([a, ms]) => fetchAll('facturacion_clientes', 'sku,anio,mes,piezas', (q) => q.in('sku', lista).eq('anio', a).in('mes', ms))),
      ]);
      const hoy = hoyISO();
      const demanda = new Map();
      fact.flat().forEach((r) => { if (clave.has(`${r.anio}-${Number(r.mes)}`)) demanda.set(r.sku, (demanda.get(r.sku) || 0) + N(r.piezas)); });
      const invBy = new Map((inv.data || []).map((r) => [r.articulo, { inventario: r.inv_actual_piezas, disponible: r.inv_actual_disponible, valor: r.inv_actual, costo_promedio: r.costo_promedio }]));
      const trBy = new Map((tr.data || []).map((r) => [r.sku, r]));
      const precios = new Map(); // sku → { lista → { precio, moneda, anio, mes } }
      (pr.data || []).forEach((r) => { if (!precios.has(r.sku)) precios.set(r.sku, {}); precios.get(r.sku)[r.lista] = { precio: N(r.precio), moneda: r.moneda, anio: r.anio, mes: r.mes }; });
      const listas = [...new Set((pr.data || []).map((r) => r.lista))].sort();
      const items = lista.map((sku) => {
        const d = desc.get(sku) || {};
        const i = invBy.get(sku) || {};
        const t = trBy.get(sku);
        const det = (Array.isArray(t?.embarques_detalle) ? t.embarques_detalle : []).filter((e) => N(e.cantidad) > 0).sort((a, b) => String(a.eta || '9999').localeCompare(String(b.eta || '9999')));
        const proximo = det.find((e) => e.eta && e.eta >= hoy) || det.find((e) => e.eta) || null;
        const inventario = N(i.inventario), disponible = N(i.disponible);
        const demMes = (demanda.get(sku) || 0) / meses.length;
        // Cobertura POR SKU en piezas, con los 3 meses CERRADOS (mesesCerrados()).
        // No es [Dias de Inv] del director (esa es global, en pesos a costo).
        const cobertura = demMes > 0 ? inventario / (demMes / 30) : null;
        return {
          sku, descripcion: d.descripcion || '', marca: d.marca || '', inventario, disponible, reservado: Math.max(0, inventario - disponible),
          enCamino: N(t?.cantidad), embarques: det.length,
          proximoArribo: proximo ? { fecha: proximo.eta, piezas: N(proximo.cantidad), po: proximo.po, estatus: proximo.estatus, cedis: proximo.cedis } : null,
          demandaMes: demMes, cobertura, valor: N(i.valor), costoPromedio: i.costo_promedio != null ? N(i.costo_promedio) : null,
          precios: precios.get(sku) || {},
        };
      });
      return { items, listas, mesesRef: meses };
    },
  });
}

// ── "Hoy" (Inicio) · pagos vencidos/hoy, pendientes con entrega hoy o vencida, minutas de hoy
export function useHoyExtra() {
  const hoy = hoyISO();
  return useQuery({
    queryKey: ['movil', 'hoy', hoy], staleTime: 60 * 1000,
    queryFn: async () => {
      const [pagos, pendientes, minutas] = await Promise.all([
        opcional(supabase.from('pagos').select('id,cliente,concepto,categoria,monto,estatus,fecha_compromiso').in('estatus', ['pendiente', 'en_proceso']).lte('fecha_compromiso', hoy).order('fecha_compromiso').limit(30)),
        opcional(supabase.from('pendientes').select('id,cliente,titulo,responsable,fecha_entrega,estado,tipo').eq('archivado', false).neq('estado', 'completado').lte('fecha_entrega', hoy).order('fecha_entrega').limit(30)),
        opcional(supabase.from('minutas').select('id,cliente,titulo,fecha_reunion').eq('fecha_reunion', hoy).limit(10)),
      ]);
      return { pagos, pendientes, minutas };
    },
  });
}

// ── Historial (Más) · últimos cambios que la app escribió
export function useHistorial(enabled) {
  return useQuery({
    queryKey: ['movil', 'historial'], staleTime: 60 * 1000, enabled,
    queryFn: () => opcional(supabase.from('auditoria_cambios').select('id,tabla,operacion,registro_id,cliente_key,usuario_email,cambios,creado_at').order('creado_at', { ascending: false }).limit(40)),
  });
}
