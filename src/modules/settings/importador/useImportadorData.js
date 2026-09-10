// Estado del importador: /api/status?type=sync (sync_status + eventos + puente + solicitudes)
// y ?type=upload (último periodo por fuente). Se refresca cada 60 s y a demanda.
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../../lib/apiFetch';

export function useImportadorData() {
  const [status, setStatus] = useState(null);
  const [upload, setUpload] = useState({});
  const [error, setError] = useState(null);
  const vivo = useRef(true);
  const refetch = useCallback(async () => {
    try {
      const [rs, ru] = await Promise.all([apiFetch('/api/status?type=sync'), apiFetch('/api/status?type=upload')]);
      const js = await rs.json();
      if (!rs.ok || !js.ok) throw new Error(js.error || `HTTP ${rs.status}`);
      const ju = ru.ok ? await ru.json() : {};
      if (!vivo.current) return;
      setStatus(js); setUpload(ju || {}); setError(null);
    } catch (e) { if (vivo.current) setError(e.message); }
  }, []);
  useEffect(() => {
    vivo.current = true;
    refetch();
    const t = setInterval(refetch, 60000);
    return () => { vivo.current = false; clearInterval(t); };
  }, [refetch]);
  return { status, upload, error, loading: !status && !error, refetch };
}
