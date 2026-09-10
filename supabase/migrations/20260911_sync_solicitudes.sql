-- 2026-09-11 · Solicitudes de corrida al puente (Mac mini) + latido.
--
-- La página Configuración → Actualización de datos inserta una fila por cada
-- "Pedir corrida" (fuente = ventas | inventario | precios | cuotas | sellout |
-- embarques | all). El agente launchd com.acteck.sync.solicitudes (cada 5 min)
-- corre `sync.mjs solicitudes`: toma las pendientes, las marca en_proceso,
-- ejecuta la fuente y guarda el resultado. El puente escribe con service role.
--
-- El latido del puente NO usa esta tabla: cada corrida upserta
-- sync_status.fuente = 'puente' (ultima_actualizacion = now(), meta {version,
-- node, agentes}). La página lo lee por /api/status?type=sync.

CREATE TABLE IF NOT EXISTS sync_solicitudes (
  id             BIGSERIAL PRIMARY KEY,
  fuente         TEXT NOT NULL CHECK (fuente IN ('ventas','inventario','precios','cuotas','sellout','embarques','all')),
  solicitado_por TEXT,
  solicitado_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  estado         TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_proceso','hecha','error')),
  resultado      JSONB,
  atendida_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sync_solicitudes_estado ON sync_solicitudes (estado, solicitado_at);
CREATE INDEX IF NOT EXISTS idx_sync_solicitudes_at     ON sync_solicitudes (solicitado_at DESC);

ALTER TABLE sync_solicitudes ENABLE ROW LEVEL SECURITY;

-- Sólo el super admin (mismo criterio que puedeActualizarDatos en la app) puede
-- pedir corridas y ver la cola. El puente usa el service role (salta RLS).
DROP POLICY IF EXISTS sync_solicitudes_select ON sync_solicitudes;
CREATE POLICY sync_solicitudes_select ON sync_solicitudes
  FOR SELECT TO authenticated USING (es_super_admin_check());

DROP POLICY IF EXISTS sync_solicitudes_insert ON sync_solicitudes;
CREATE POLICY sync_solicitudes_insert ON sync_solicitudes
  FOR INSERT TO authenticated WITH CHECK (es_super_admin_check() AND estado = 'pendiente');

COMMENT ON TABLE sync_solicitudes IS 'Cola de corridas pedidas desde Actualización de datos; la atiende bridge/sync.mjs solicitudes (launchd cada 5 min).';
