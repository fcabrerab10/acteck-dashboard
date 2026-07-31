# Migración — `sync_events` (historial compartido de cargas)

Hasta ahora el uploader (`public/uploads.html`) guardaba el historial de cargas en `localStorage`. Consecuencia: cada navegador tenía su propio historial. Karolina no veía lo que subía Fernando y viceversa.

Esta migración crea una tabla compartida en Supabase para que todos los usuarios autenticados vean el mismo historial (quién subió qué, cuándo, con qué resultado).

## Aplicar en Supabase

Copiar y ejecutar en el SQL editor de Supabase (Project: `hrhccvuhnedahznewgaj`):

```sql
CREATE TABLE IF NOT EXISTS sync_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  src_id       TEXT NOT NULL,           -- id de la tarjeta del uploader (ej: 'roadmap', 'sellout-general')
  status_key   TEXT,                    -- statusKey de la tarjeta (opcional, para joins con sync_status)
  status       TEXT NOT NULL,           -- 'success' | 'error' | 'warning'
  filas        INTEGER,                 -- filas procesadas (nullable)
  filename     TEXT,                    -- nombre del archivo subido
  duracion_ms  INTEGER,                 -- tiempo total de proceso (nullable)
  detalles     JSONB,                   -- info extra: { tipo, mensaje, slot, ... }
  user_id      UUID REFERENCES auth.users(id),
  user_nombre  TEXT,                    -- snapshot del nombre (por si el user se borra)
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_events_src     ON sync_events(src_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_events_created ON sync_events(created_at DESC);

-- RLS: cualquier usuario autenticado puede leer (historial transparente);
-- solo puede insertar sus propios eventos. El service_role bypasea todo.
ALTER TABLE sync_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sync_events_read   ON sync_events;
DROP POLICY IF EXISTS sync_events_insert ON sync_events;

CREATE POLICY sync_events_read ON sync_events FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY sync_events_insert ON sync_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

## Endpoints que usan la tabla

- `POST /api/admin/log-sync-event` — registra un evento. Auth: cualquier usuario autenticado.
  Body: `{ src_id, status_key?, status, filas?, filename?, duracion_ms?, detalles? }`.
- `GET  /api/admin/sync-history?src_id=X&limit=10` — lista eventos. Auth: cualquier autenticado.
  Sin `src_id`, retorna eventos cross-cards (últimos N globales). `limit` máx 50, default 10.

Ambos endpoints usan `SUPABASE_SERVICE_ROLE_KEY` para escribir/leer y hacen su propio gate de autenticación con `requireAuth()` — el token JWT del usuario logueado se envía por el wrapper de `fetch()` del uploader (inyecta `Authorization: Bearer <access_token>` a todo `/api/*`).

## (Opcional) Migración del historial local existente

Cada navegador tiene una llave `uploads_history_v1` en localStorage. Si Fernando quiere subir su historial local al server, puede pegar esto en la consola del navegador (una sola vez, desde `/uploads.html` ya logueado):

```js
(async () => {
  const raw = JSON.parse(localStorage.getItem('uploads_history_v1') || '{}');
  const entries = [];
  for (const [src_id, arr] of Object.entries(raw)) {
    for (const it of (arr || [])) {
      entries.push({
        src_id,
        status: it.estado === 'error' ? 'error' : 'success',
        filas: it.filas || null,
        filename: it.archivo || null,
        detalles: {
          tipo: it.tipo || 'upload',
          ...(it.mensaje ? { mensaje: it.mensaje } : {}),
          ...(it.slot ? { slot: it.slot } : {}),
          ...(it.fecha ? { fecha_original: it.fecha } : {}),
          origen_migracion: 'localStorage',
        },
      });
    }
  }
  console.log('Subiendo', entries.length, 'eventos...');
  for (const ev of entries) {
    await fetch('/api/admin/log-sync-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ev),
    });
  }
  console.log('Listo.');
})();
```

Nota: los eventos se registrarán con `created_at = ahora()` (no la fecha original). La fecha original queda en `detalles.fecha_original` por si algún día se quiere reconstruir. Para la mayoría de casos, esto no vale la pena y basta con partir desde cero.

## Verificación después de aplicar

1. Ejecutar el SQL en Supabase.
2. Recargar `/uploads.html` en producción (login como Fernando o Karolina).
3. Subir un archivo pequeño.
4. Expandir la fila y click en "Historial (n) ▼". Debe verse el evento con nombre del usuario y hora relativa.
5. Abrir en otro navegador/usuario y verificar que ve el mismo evento.

Si el fetch al server falla (401, offline, etc.), el uploader **cae con gracia al historial local** — no rompe, solo pierde la visibilidad cross-usuario hasta que el server vuelva.
