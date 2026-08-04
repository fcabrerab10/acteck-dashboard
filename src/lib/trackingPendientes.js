// Hook y utils para detectar OCs de tracking sin actualizar > 24h.
// Se usa en el Sidebar (badge rojo) y en App.jsx (toast al login).
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { toast } from './toast';

const CUTOFF_HORAS = 24;
const SESSION_KEY = 'tracking_pendientes_toast_v1'; // se muestra 1 vez por sesión

export async function fetchTrackingPendientes() {
  const cutoff = new Date(Date.now() - CUTOFF_HORAS * 3600 * 1000).toISOString();
  const { data: ocs, error } = await supabase
    .from('oc_clientes')
    .select('id, cliente_key, numero_oc, updated_at, monto_total')
    .lt('updated_at', cutoff)
    .order('updated_at', { ascending: true });
  if (error) return { count: 0, ocs: [] };
  const ids = (ocs || []).map((o) => o.id);
  if (ids.length === 0) return { count: 0, ocs: [] };

  const { data: envios } = await supabase
    .from('oc_envios').select('oc_id, fecha_entregada').in('oc_id', ids);
  const envPorOc = {};
  for (const e of (envios || [])) {
    (envPorOc[e.oc_id] = envPorOc[e.oc_id] || []).push(e);
  }
  const pendientes = (ocs || []).filter((oc) => {
    const evs = envPorOc[oc.id] || [];
    if (evs.length === 0) return true;
    return evs.some((e) => !e.fecha_entregada);
  });
  return { count: pendientes.length, ocs: pendientes };
}

export function useTrackingPendientes({ enabled = true } = {}) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancel = false;
    const cargar = async () => {
      setLoading(true);
      const r = await fetchTrackingPendientes();
      if (!cancel) { setCount(r.count); setLoading(false); }
    };
    cargar();
    const iv = setInterval(cargar, 5 * 60 * 1000); // refetch cada 5 min
    return () => { cancel = true; clearInterval(iv); };
  }, [enabled]);

  return { count, loading };
}

// Dispara un toast una vez por sesión si hay pendientes.
// Idempotente — se puede llamar en cada render sin miedo.
export function useTrackingToastAviso({ enabled = true } = {}) {
  const { count } = useTrackingPendientes({ enabled });
  useEffect(() => {
    if (!enabled || count === 0) return;
    let shown = false;
    try { shown = sessionStorage.getItem(SESSION_KEY) === '1'; } catch {}
    if (shown) return;
    const t = setTimeout(() => {
      toast.info(`⏰ ${count} OC${count === 1 ? '' : 's'} de tracking sin actualizar hace +1 día. Revisa Tracking Pedidos.`);
      try { sessionStorage.setItem(SESSION_KEY, '1'); } catch {}
    }, 1500);
    return () => clearTimeout(t);
  }, [enabled, count]);
}
