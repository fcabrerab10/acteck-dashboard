// QueryClient central + persister IndexedDB.
// Cache SWR: 5min stale, 30min gc. Persistencia 1 semana en IndexedDB.
import { QueryClient } from '@tanstack/react-query';
import { get, set, del } from 'idb-keyval';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,       // 5 min — SWR
      gcTime: 30 * 60 * 1000,          // 30 min — evict de memoria
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

export const APP_VERSION = import.meta.env.VITE_APP_VERSION || 'dev';
