// Hooks de React Query para tablas usadas por 3+ módulos.
// Reutilizan el cliente supabase-js y la paginación manual del proyecto,
// para no cambiar la semántica de las queries existentes.
//
// Query keys estables → cambiar de módulo NO re-fetchea si otro módulo
// ya consultó lo mismo dentro del staleTime (5 min).
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

// ─── Paginación estándar (misma lógica que los módulos ya usan) ───
const PAGE = 1000;
async function fetchAll(table, select, extra = (q) => q) {
  const all = [];
  const firstCol = (select || 'id').split(',')[0].trim();
  const orderCol = /(^|,)\s*id\s*(,|$)/i.test(select) ? 'id' : firstCol;
  let from = 0;
  while (true) {
    let lastErr = null; let data = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      let q = supabase.from(table).select(select).order(orderCol, { ascending: true }).range(from, from + PAGE - 1);
      q = extra(q);
      const res = await q;
      if (!res.error) { data = res.data || []; break; }
      lastErr = res.error;
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
    }
    if (data == null) throw lastErr;
    if (data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// ─── Roadmap SKU ───
export function useRoadmap() {
  return useQuery({
    queryKey: ['roadmap_sku'],
    queryFn: () =>
      fetchAll(
        'roadmap_sku',
        'sku,marca,categoria,familia,rdmp,descripcion,sort_order',
        (q) => q.order('sort_order', { ascending: true, nullsFirst: false })
      ),
  });
}

// ─── Precios SKU ───
export function usePrecios() {
  return useQuery({
    queryKey: ['precios_sku'],
    queryFn: () => fetchAll('precios_sku', '*'),
  });
}

// ─── Facturación clientes ───
// anios: array de años (ej [2025, 2026]) o null para todo
// select: por default '*' — se puede pasar un select más chico para reducir payload.
export function useFacturacion(clienteKey, anios = null, select = '*') {
  return useQuery({
    queryKey: ['facturacion_clientes', clienteKey, anios, select],
    enabled: !!clienteKey,
    queryFn: () =>
      fetchAll('facturacion_clientes', select, (q) => {
        // La tabla usa `cliente_key`, NO `cliente`.
        let x = q.eq('cliente_key', clienteKey);
        if (Array.isArray(anios) && anios.length) x = x.in('anio', anios);
        return x;
      }),
  });
}

// ─── Cuotas mensuales ───
export function useCuotasMensuales(clienteKey, anio) {
  return useQuery({
    queryKey: ['cuotas_mensuales', clienteKey, anio],
    enabled: !!clienteKey && !!anio,
    queryFn: () =>
      fetchAll('cuotas_mensuales', '*', (q) =>
        q.eq('cliente', clienteKey).eq('anio', anio)
      ),
  });
}

// ─── Sellout SKU ───
export function useSelloutSku(clienteKey, anios = null) {
  return useQuery({
    queryKey: ['sellout_sku', clienteKey, anios],
    enabled: !!clienteKey,
    queryFn: () =>
      fetchAll('sellout_sku', '*', (q) => {
        let x = q.eq('cliente', clienteKey);
        if (Array.isArray(anios) && anios.length) x = x.in('anio', anios);
        return x;
      }),
  });
}

// ─── Lineamientos cliente ───
export function useLineamientos(clienteKey) {
  return useQuery({
    queryKey: ['lineamientos_cliente', clienteKey],
    enabled: !!clienteKey,
    queryFn: () =>
      fetchAll('lineamientos_cliente', '*', (q) => q.eq('cliente', clienteKey)),
  });
}

// ─── Inventario cliente ───
export function useInventarioCliente(clienteKey) {
  return useQuery({
    queryKey: ['inventario_cliente', clienteKey],
    enabled: !!clienteKey,
    queryFn: () =>
      fetchAll('inventario_cliente', '*', (q) => q.eq('cliente', clienteKey)),
  });
}

// Helper: exportar el fetchAll para módulos que quieran migrar
// query fns puntuales sin escribir un hook dedicado.
export { fetchAll };
