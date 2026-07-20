// ═══════════════════════════════════════════════════════════════
// Telemetría de usuarios · captura eventos y heartbeats
// Fila mínima en `eventos_usuario` (~40 bytes con enums numéricos)
// ═══════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import { supabase } from './supabase';

// Enums (deben coincidir con los comentarios en la tabla SQL)
export const TIPO = {
  NAV_CLIENTE: 1,
  NAV_PAGINA:  2,
  DRILL:       3,
  FILTER:      4,
  EXPORT:      5,
  UPLOAD:      6,
  ACTION:      7,
  LOGIN:       8,
  LOGOUT:      9,
  HEARTBEAT:  10,
};

export const CLIENTE = {
  digitalife: 1, pcel: 2, dicotech: 3, mercadolibre: 4, global: 99,
};

export const PAGINA = {
  home: 1, analisis: 2, sellIn: 3, estrategia: 4, marketing: 5, pagos: 6, cartera: 7, forecast: 8,
  sellOut: 9, inventarioGlobal: 10, estrategiaPrecios: 11, trackingPedidos: 12, analisisClientesGlobal: 13,
  uploads: 14, telemetria: 15, evaluaciones: 16, settings: 17,
};

// Cache: userId una vez obtenido no cambia hasta logout
let _userId = null;
let _flushQueue = [];
let _flushTimer = null;
let _lastHeartbeatTs = 0;

// Contexto actual — lo que el usuario está viendo. Se actualiza en cada
// navCliente/navPagina y se usa en los heartbeats para que la telemetría
// sepa dónde pasó el tiempo, no sólo cuánto.
let _currentCliente = null;
let _currentPagina = null;

// Buffer en memoria: si emit() dispara muchos eventos rápidos, se agrupan y
// se mandan en un batch cada 5s para no saturar la DB.
function scheduleFlush() {
  if (_flushTimer) return;
  _flushTimer = setTimeout(flushNow, 5000);
}

async function flushNow() {
  _flushTimer = null;
  if (_flushQueue.length === 0) return;
  const batch = _flushQueue.splice(0, _flushQueue.length);
  try {
    const { error } = await supabase.from('eventos_usuario').insert(batch);
    if (error) console.warn('[telemetry] flush error:', error.message);
  } catch (e) {
    // Si falla la red, silenciosamente descartamos — no bloqueamos al usuario
    console.warn('[telemetry]', e);
  }
}

// Emite un evento. Se agrupa en un buffer y se envía en batch.
// tipo: número de la enum TIPO
// cliente: número de CLIENTE o null
// pagina: número de PAGINA o null
// detalle: string opcional (SKU, filtro, archivo, etc.)
export function emit(tipo, cliente = null, pagina = null, detalle = null) {
  if (!_userId) return; // sin sesión, ignora
  _flushQueue.push({
    user_id: _userId,
    tipo,
    cliente: cliente ?? null,
    pagina: pagina ?? null,
    detalle: detalle ? String(detalle).slice(0, 500) : null,
  });
  scheduleFlush();
}

// Hook global — arranca la telemetría cuando el usuario está logueado.
// Se llama una sola vez desde App.jsx (o similar).
// Captura:
//   - LOGIN al montar (si hay sesión)
//   - LOGOUT al desmontar (si hay sesión)
//   - HEARTBEAT cada 60s cuando la pestaña está visible + con foco
export function useTelemetry() {
  const heartbeatRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.user?.id) {
        _userId = session.user.id;
        emit(TIPO.LOGIN);
      }
      // Sub a cambios de auth
      const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
        if (event === 'SIGNED_IN' && sess?.user?.id && _userId !== sess.user.id) {
          _userId = sess.user.id;
          emit(TIPO.LOGIN);
        } else if (event === 'SIGNED_OUT') {
          emit(TIPO.LOGOUT);
          flushNow();
          _userId = null;
        }
      });
      // Guarda referencia al unsub
      heartbeatRef.current = { authSub: sub };
    })();

    // Heartbeat cada 60s cuando la pestaña está visible y activa
    const HB_INTERVAL_MS = 60_000;
    const tick = () => {
      if (document.visibilityState !== 'visible' || !document.hasFocus()) return;
      const now = Date.now();
      if (now - _lastHeartbeatTs < HB_INTERVAL_MS - 1000) return; // dedup
      _lastHeartbeatTs = now;
      // Heartbeat carga el contexto actual — sabemos EN QUÉ pasó el tiempo, no sólo cuánto.
      emit(TIPO.HEARTBEAT, _currentCliente, _currentPagina);
    };
    const hbId = setInterval(tick, HB_INTERVAL_MS);
    // Tick inmediato al recobrar foco
    const onVis = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', tick);

    // Flush al cerrar la pestaña / navegar
    const onBeforeUnload = () => {
      if (_flushQueue.length > 0 && _userId) {
        // sendBeacon garantiza envío incluso al cerrar
        try {
          const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/eventos_usuario`;
          const blob = new Blob([JSON.stringify(_flushQueue)], { type: 'application/json' });
          navigator.sendBeacon(url + `?apikey=${import.meta.env.VITE_SUPABASE_ANON_KEY}`, blob);
        } catch {}
        _flushQueue = [];
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      cancelled = true;
      clearInterval(hbId);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', tick);
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (heartbeatRef.current?.authSub) heartbeatRef.current.authSub.subscription?.unsubscribe();
      flushNow();
    };
  }, []);
}

// Helpers públicos para wrappers específicos.
// navCliente/navPagina también actualizan el contexto que consumen los heartbeats.
export const telemetria = {
  navCliente: (clienteKey) => {
    _currentCliente = CLIENTE[clienteKey] || null;
    emit(TIPO.NAV_CLIENTE, _currentCliente);
  },
  navPagina:  (paginaKey, clienteKey = null) => {
    _currentCliente = CLIENTE[clienteKey] || null;
    _currentPagina  = PAGINA[paginaKey]  || null;
    emit(TIPO.NAV_PAGINA, _currentCliente, _currentPagina);
  },
  drill:      (paginaKey, clienteKey, detalle) => emit(TIPO.DRILL, CLIENTE[clienteKey] || null, PAGINA[paginaKey] || null, detalle),
  filter:     (paginaKey, clienteKey, detalle) => emit(TIPO.FILTER, CLIENTE[clienteKey] || null, PAGINA[paginaKey] || null, detalle),
  export:     (paginaKey, clienteKey, detalle) => emit(TIPO.EXPORT, CLIENTE[clienteKey] || null, PAGINA[paginaKey] || null, detalle),
  upload:     (detalle) => emit(TIPO.UPLOAD, null, PAGINA.uploads, detalle),
  action:     (paginaKey, clienteKey, detalle) => emit(TIPO.ACTION, CLIENTE[clienteKey] || null, PAGINA[paginaKey] || null, detalle),
};
