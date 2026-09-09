// Hooks de React Query para tablas usadas por 3+ módulos.
// Reutilizan el cliente supabase-js y la paginación manual del proyecto,
// para no cambiar la semántica de las queries existentes.
//
// Query keys estables → cambiar de módulo NO re-fetchea si otro módulo
// ya consultó lo mismo dentro del staleTime (5 min).
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { queryClient } from './queryClient';

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

// ─── Cache imperativa sobre React Query ───
// Clave = URL final de PostgREST (tabla + select + filtros + order) sin
// offset/limit. Determinista y sin necesidad de que cada módulo declare
// una queryKey. Pasa por queryClient.fetchQuery → dedupe de requests
// concurrentes, staleTime 5 min, gcTime 30 min y persistencia IndexedDB
// (misma semántica que los hooks useFacturacion/useRoadmap).
// Si la data está fresca se devuelve sin red; si está stale se refetchea
// y se espera (nunca se muestra data vieja > 5 min).
const CACHE_STALE_MS = 5 * 60 * 1000;

function cacheKeyFromBuilder(q) {
  try {
    const u = new URL(q.url.href);
    u.searchParams.delete('offset');
    u.searchParams.delete('limit');
    return u.pathname + '?' + u.searchParams.toString();
  } catch {
    return null;
  }
}

// Inyecta Prefer: count=exact en un builder ya construido (factories que
// hicieron .select() sin opciones). headers es un objeto Headers en
// supabase-js ≥ 2.90; se tolera también el shape Record antiguo.
function withExactCount(q) {
  try {
    const h = q.headers;
    if (h && typeof h.get === 'function') {
      const prev = h.get('prefer');
      if (!/count=/.test(prev || '')) h.set('prefer', [prev, 'count=exact'].filter(Boolean).join(','));
    } else if (h && typeof h === 'object') {
      const prev = h['Prefer'] || h['prefer'];
      if (!/count=/.test(prev || '')) h['Prefer'] = [prev, 'count=exact'].filter(Boolean).join(',');
    }
  } catch { /* si no se puede, fetchPaged cae a modo secuencial */ }
  return q;
}

async function fetchAll(table, select, extra = (q) => q) {
  const pageSize = HEAVY_TABLES.has(table) ? 500 : 1000;
  const orderCol = orderColFromSelect(select);
  const makePage = (from, to, withCount) => {
    let q = supabase
      .from(table)
      .select(select, withCount ? { count: 'exact' } : undefined)
      .order(orderCol, { ascending: true })
      .range(from, to);
    return extra(q);
  };
  const key = cacheKeyFromBuilder(makePage(0, pageSize - 1, false));
  const run = () => fetchPaged(makePage, { pageSize, label: table });
  if (!key) return run();
  return queryClient.fetchQuery({ queryKey: ['fetchAll', key], queryFn: run, staleTime: CACHE_STALE_MS });
}

// Variante para módulos que arman el builder ellos mismos:
//   fetchAllQ(() => supabase.from('t').select('a,b').eq('x', 1), { pageSize, orderCol })
// La factory NO debe incluir .range(). Si trae .order() se respeta; si no y
// se pasa orderCol, se añade. Paralelo + cache igual que fetchAll.
export async function fetchAllQ(qFactory, { pageSize = 1000, orderCol = null, label = 'query' } = {}) {
  const makePage = (from, to, withCount) => {
    let q = qFactory();
    if (orderCol) {
      let hasOrder = false;
      try { hasOrder = q.url.searchParams.has('order'); } catch { /* noop */ }
      if (!hasOrder) q = q.order(orderCol, { ascending: true });
    }
    q = q.range(from, to);
    return withCount ? withExactCount(q) : q;
  };
  const key = cacheKeyFromBuilder(makePage(0, pageSize - 1, false));
  const run = () => fetchPaged(makePage, { pageSize, label });
  if (!key) return run();
  return queryClient.fetchQuery({ queryKey: ['fetchAll', key], queryFn: run, staleTime: CACHE_STALE_MS });
}

// Cache para lecturas puntuales (no paginadas): .single(), .limit(), .maybeSingle()…
//   const { data } = await cachedQuery(supabase.from('t').select('*').eq('id', 1).single());
// Devuelve el mismo shape { data, error, count } que await builder, así los
// call sites no cambian. Sólo cachea GET; cualquier otro método (insert/
// update/upsert/delete/rpc POST) se ejecuta directo sin cache.
export async function cachedQuery(builder) {
  let key = null;
  try {
    if (String(builder.method || 'GET').toUpperCase() === 'GET') key = cacheKeyFromBuilder(builder) + '&' + (builder.url.searchParams.get('limit') || '') + '&' + (builder.url.searchParams.get('offset') || '');
  } catch { key = null; }
  if (!key) return builder;
  const res = await queryClient.fetchQuery({
    queryKey: ['q', key],
    staleTime: CACHE_STALE_MS,
    queryFn: async () => {
      const r = await builder;
      if (r.error) throw r.error;
      return { data: r.data, count: r.count ?? null, status: r.status, statusText: r.statusText };
    },
  });
  return { ...res, error: null };
}

// Invalidar todo lo cacheado por fetchAll/fetchAllQ/cachedQuery (p. ej.
// tras un upload). uploads.html es otra página, así que hoy basta con el
// reload; queda expuesto para uso futuro desde la app.
export function invalidateDataCache() {
  return queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'fetchAll' || q.queryKey[0] === 'q' });
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
