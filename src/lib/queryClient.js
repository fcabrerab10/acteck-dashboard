// QueryClient central + persister IndexedDB (una entrada por consulta).
// Cache SWR: 5 min stale, 6 h gc. Persistencia 1 semana en IndexedDB (buster fijo CACHE_GEN, ver version.js).
import { QueryClient } from '@tanstack/react-query';
import { set, del, delMany, entries, clear, createStore } from 'idb-keyval';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,       // 5 min — SWR
      gcTime: 6 * 60 * 60 * 1000,      // 6 h (3.89.0; era 30 min: al volver a una pestaña tras media hora todo iba a la red)
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
});

// Persister en IndexedDB, UNA ENTRADA POR CONSULTA (4.12.0 · 2026-11-23).
// Antes toda la caché era un solo valor y se reescribía completa en cada evento de React Query: con 50 MB guardados
// eran ~30 escrituras de 50 MB por cambio de pestaña (3 s de hilo principal en una Mac; en el teléfono la interfaz
// se trababa y Safari llegaba a matar la pestaña). Ahora: se espera a que la carga se calme (2.5 s), se escribe sólo
// la consulta cuyo dato cambió, de una en una, y al arrancar sólo se recupera lo de las últimas 12 h.
const IDB_VIEJA = 'acteck-react-query-cache';
const ALMACEN = createStore('acteck-rq', 'consultas');
const META = '__meta';
const ESPERA_MS = 2500;
const EDAD_MAX_MS = 12 * 60 * 60 * 1000;
const FILAS_MAX = 40000; // una consulta más grande no se guarda en disco (se vuelve a pedir)

const guardado = new Map(); // queryHash → dataUpdatedAt ya escrito
let pendiente = null;
let reloj = null;
let escribiendo = false;

const filasDe = (d) => (Array.isArray(d) ? d.length : Array.isArray(d?.data) ? d.data.length : 0);
const ceder = () => new Promise((r) => setTimeout(r, 0));

async function vaciar() {
  reloj = null;
  if (escribiendo || !pendiente) return;
  escribiendo = true;
  const cliente = pendiente; pendiente = null;
  try {
    const vivos = new Set();
    for (const q of cliente.clientState?.queries || []) {
      const h = q.queryHash; const t = q.state?.dataUpdatedAt || 0;
      vivos.add(h);
      if (guardado.get(h) === t) continue;
      if (filasDe(q.state?.data) > FILAS_MAX) continue;
      await set(h, q, ALMACEN);
      guardado.set(h, t);
      await ceder();
    }
    const sobran = [...guardado.keys()].filter((h) => !vivos.has(h));
    if (sobran.length) { await delMany(sobran, ALMACEN); sobran.forEach((h) => guardado.delete(h)); }
    await set(META, { timestamp: Date.now(), buster: cliente.buster }, ALMACEN);
  } catch (_) { /* disco lleno o modo privado: la app sigue con la caché en memoria */ }
  escribiendo = false;
  if (pendiente && !reloj) reloj = setTimeout(vaciar, ESPERA_MS);
}

// Al esconder la pestaña (cambiar de app, cerrar el teléfono) se guarda lo que falte sin esperar.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && pendiente) { clearTimeout(reloj); vaciar(); }
  });
}

export function createIDBPersister() {
  return {
    // React Query llama aquí en CADA evento de la caché: sólo se anota y se pospone.
    persistClient: (cliente) => {
      pendiente = cliente;
      clearTimeout(reloj);
      reloj = setTimeout(vaciar, ESPERA_MS);
    },
    restoreClient: async () => {
      try {
        del(IDB_VIEJA).catch(() => {});
        const todo = await entries(ALMACEN);
        let meta = null; const queries = []; const viejas = [];
        const corte = Date.now() - EDAD_MAX_MS;
        for (const [k, v] of todo) {
          if (k === META) { meta = v; continue; }
          if (!v?.state || (v.state.dataUpdatedAt || 0) < corte) { viejas.push(k); continue; }
          queries.push(v); guardado.set(k, v.state.dataUpdatedAt || 0);
        }
        if (viejas.length) delMany(viejas, ALMACEN).catch(() => {});
        if (!meta) return undefined;
        return { timestamp: meta.timestamp, buster: meta.buster, clientState: { mutations: [], queries } };
      } catch (_) { return undefined; }
    },
    removeClient: async () => {
      try { guardado.clear(); await clear(ALMACEN); } catch (_) { /* noop */ }
    },
  };
}

// Compat: el identificador de build vive en src/lib/version.js
export { BUILD_ID as APP_VERSION } from './version';
