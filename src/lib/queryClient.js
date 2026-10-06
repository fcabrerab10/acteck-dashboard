// QueryClient central + persister IndexedDB.
// Cache SWR: 5 min stale, 6 h gc. Persistencia 1 semana en IndexedDB (buster fijo CACHE_GEN, ver version.js).
import { QueryClient } from '@tanstack/react-query';
import { get, set, del } from 'idb-keyval';

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

// Persister basado en IndexedDB (idb-keyval) — 50+ MB vs 5 MB de localStorage.
const IDB_KEY = 'acteck-react-query-cache';

export function createIDBPersister() {
  return {
    persistClient: async (client) => {
      try { await set(IDB_KEY, client); } catch (_) { /* noop */ }
    },
    restoreClient: async () => {
      try { return await get(IDB_KEY); } catch (_) { return undefined; }
    },
    removeClient: async () => {
      try { await del(IDB_KEY); } catch (_) { /* noop */ }
    },
  };
}

// Compat: el identificador de build vive en src/lib/version.js
export { BUILD_ID as APP_VERSION } from './version';
