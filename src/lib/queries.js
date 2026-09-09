// Hooks de React Query para tablas usadas por 3+ módulos.
// Reutilizan el cliente supabase-js y la paginación manual del proyecto,
// para no cambiar la semántica de las queries existentes.
//
// Query keys estables → cambiar de módulo NO re-fetchea si otro módulo
// ya consultó lo mismo dentro del staleTime (5 min).
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

// ─── Paginación estándar · PARALELA ───
// Antes: while-loop secuencial → facturacion_clientes 2 años (54K filas en
// chunks de 500) = ~108 round-trips uno tras otro ≈ 15-20 s. Ahora: la 1ª
// página pide count:'exact', y el resto de páginas se disparan en paralelo
// con concurrencia limitada (CONCURRENCY). Mismo orden estable (order +
// range), mismos retries/backoff por página, misma semántica de throw si
// una página falla definitivamente (nunca data parcial).
//
// sellout_general devuelve HTTP 500 intermitente con ilike+range+order
// (índice no cubre bien el filtro). Usamos chunks de 500 para tablas de
// transacciones y de 1000 para el resto. Retries a 6 porque en producción
// se observaron rachas de 3 500s consecutivos.
const HEAVY_TABLES = new Set(['sellout_general', 'sellout_detalle', 'facturacion_clientes']);
const MAX_RETRIES = 6;
const BACKOFF = [500, 1000, 2000, 4000, 8000, 16000];
const CONCURRENCY = 5;

async function withRetry(makeReq, label) {
  let lastErr = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await makeReq();
    if (!res.error) return res;
    lastErr = res.error;
    if (attempt < MAX_RETRIES - 1) {
      console.warn(`[fetchAll] ${label} attempt ${attempt + 1} falló (retry en ${BACKOFF[attempt]}ms):`, lastErr?.message || lastErr);
      await new Promise((r) => setTimeout(r, BACKOFF[attempt]));
    }
  }
  // Falló definitivamente. Throw para que la UI muestre error visible en
  // vez de renderizar data parcial (causaba discrepancias entre usuarios).
  console.error(`[fetchAll] ${label} falló tras ${MAX_RETRIES} intentos. DATA INCOMPLETA — abortando para no mostrar números incorrectos.`);
  throw new Error(`No se pudo cargar ${label}. Refresca la página. Detalle: ${lastErr?.message || 'error desconocido'}`);
}

// Ejecuta tasks (funciones que devuelven promesas) con a lo más `limit`
// en vuelo. Devuelve resultados en el mismo orden que tasks.
async function runLimited(tasks, limit) {
  const results = new Array(tasks.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= tasks.length) return;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

// Motor común. makePage(from, to, withCount) devuelve un builder listo
// para await. withCount=true sólo en la primera página (count:'exact').
export async function fetchPaged(makePage, { pageSize = 1000, label = 'query' } = {}) {
  const first = await withRetry(() => makePage(0, pageSize - 1, true), `${label} chunk 0`);
  const acc = [...(first.data || [])];
  if (acc.length < pageSize) return acc; // cabía en una página
  const total = typeof first.count === 'number' ? first.count : null;

  if (total == null) {
    // Sin count (algunas vistas no lo soportan) → secuencial clásico.
    let from = pageSize;
    for (;;) {
      const res = await withRetry(() => makePage(from, from + pageSize - 1, false), `${label} chunk ${from}`);
      const data = res.data || [];
      if (!data.length) break;
      acc.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }
    return acc;
  }

  // Resto de páginas en paralelo, orden preservado por runLimited.
  const starts = [];
  for (let from = pageSize; from < total; from += pageSize) starts.push(from);
  const pages = await runLimited(
    starts.map((from) => () =>
      withRetry(() => makePage(from, from + pageSize - 1, false), `${label} chunk ${from}`)
        .then((r) => r.data || [])),
    CONCURRENCY,
  );
  for (const p of pages) acc.push(...p);

  // Cola de seguridad: si entraron filas después del count (upload en
  // curso), la última página viene llena → seguimos secuencial hasta vaciar.
  let last = pages.length ? pages[pages.length - 1] : acc;
  let from = pageSize * (starts.length + 1);
  while (last.length === pageSize) {
    const res = await withRetry(() => makePage(from, from + pageSize - 1, false), `${label} chunk ${from}`);
    last = res.data || [];
    if (!last.length) break;
    acc.push(...last);
    from += pageSize;
  }
  return acc;
}

// BUG-FIX histórico: cuando select === '*' o el primer campo es '*', se
// ejecutaba .order('*') → HTTP 400 → data:[] silenciosa (cuotas en $0).
export function orderColFromSelect(select) {
  if (!select || select === '*') return 'id';
  if (/(^|,)\s*id\s*(,|$)/i.test(select)) return 'id';
  const first = select.split(',')[0].trim();
  return first === '*' ? 'id' : first;
}

async function fetchAll(table, select, extra = (q) => q) {
  const pageSize = HEAVY_TABLES.has(table) ? 500 : 1000;
  const orderCol = orderColFromSelect(select);
  return fetchPaged((from, to, withCount) => {
    let q = supabase
      .from(table)
      .select(select, withCount ? { count: 'exact' } : undefined)
      .order(orderCol, { ascending: true })
      .range(from, to);
    return extra(q);
  }, { pageSize, label: table });
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

// Versión consolidada: NO filtra por cliente_key, trae toda la
// facturación de los años especificados. Útil para la vista "todos los
// canales" en Sell In cuando queremos ver un SKU que se vende a
// clientes que no tienen tab dedicado (ARROBA, CVA, PCH, Amazon, ML…).
export function useFacturacionAll(anios = null, select = '*', enabled = true) {
  return useQuery({
    queryKey: ['facturacion_clientes', '__ALL__', anios, select],
    enabled,
    queryFn: () =>
      fetchAll('facturacion_clientes', select, (q) => {
        if (Array.isArray(anios) && anios.length) return q.in('anio', anios);
        return q;
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
