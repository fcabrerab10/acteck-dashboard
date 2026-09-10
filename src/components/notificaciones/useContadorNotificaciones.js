// useContadorNotificaciones — cifra para el badge de la campana.
// El badge cuenta PILAS (áreas) con novedades, no avisos sueltos; `criticaNueva`
// pinta el badge en rojo. React Query directo (staleTime 60 s) vía useAlertas /
// useNoLeidas / usePreferenciasNotif — nunca cachedQuery (la app escribe lecturas).
//
//   const { pilas, criticaNueva, nuevas, total, cargando } = useContadorNotificaciones();
//     pilas        → nº de áreas (no silenciadas) con al menos una alerta nueva
//     criticaNueva → true si hay una crítica sin leer
//     nuevas       → alertas nuevas (sin leer) en total
//     total        → alertas activas visibles (según preferencias)
import { useMemo } from 'react';
import {
  useAlertas, useNoLeidas, usePreferenciasNotif, agruparPorArea, areaAlerta, aplicaCliente,
} from '../../lib/alertas';

export function visiblesSegunPrefs(alertas, prefs) {
  if (!prefs) return alertas || [];
  return (alertas || []).filter((a) => prefs.areas?.[areaAlerta(a)] !== 'silencio' && aplicaCliente(a, prefs));
}

export default function useContadorNotificaciones({ enabled = true } = {}) {
  const { data: alertas = [], isLoading } = useAlertas({ enabled });
  const { data: lecturas } = useNoLeidas({ enabled });
  const { data: prefs } = usePreferenciasNotif({ enabled });
  return useMemo(() => {
    const visibles = visiblesSegunPrefs(alertas, prefs);
    const pilas = agruparPorArea(visibles, lecturas);
    const conNovedad = pilas.filter((p) => p.nuevas > 0);
    return {
      pilas: conNovedad.length,
      criticaNueva: conNovedad.some((p) => p.criticaNueva),
      nuevas: conNovedad.reduce((t, p) => t + p.nuevas, 0),
      total: visibles.length,
      cargando: isLoading,
    };
  }, [alertas, lecturas, prefs, isLoading]);
}
