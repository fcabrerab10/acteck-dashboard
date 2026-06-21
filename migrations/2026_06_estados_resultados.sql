-- Estados de Resultados (P&L) consolidado por empresa, año y mes.
-- Formato "tall": una fila por (razon_social, anio, mes, cuenta).
-- Soporta multi-empresa desde el inicio (default REVKO).
-- Se alimenta desde /uploads.html → tarjeta "Estado de Resultados".

CREATE TABLE IF NOT EXISTS estados_resultados (
  id            BIGSERIAL PRIMARY KEY,
  razon_social  TEXT NOT NULL DEFAULT 'REVKO TECHNOLOGY SA DE CV',
  anio          INT  NOT NULL,
  mes           INT  NOT NULL CHECK (mes BETWEEN 1 AND 12),
  cuenta        TEXT NOT NULL,             -- nombre literal del Excel
  cuenta_norm   TEXT NOT NULL,             -- snake_case sin acentos (clave de upsert)
  valor         NUMERIC,
  orden         INT,                       -- posición de la fila en el P&L original
  es_subtotal   BOOLEAN DEFAULT FALSE,     -- true para VENTA NETA, UTILIDAD BRUTA, UAFIR, UAII, TOTAL GASTOS…
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT estados_resultados_uk UNIQUE (razon_social, anio, mes, cuenta_norm)
);

-- Índices de consulta
CREATE INDEX IF NOT EXISTS estados_resultados_anio_mes_idx
  ON estados_resultados (anio, mes);
CREATE INDEX IF NOT EXISTS estados_resultados_cuenta_norm_idx
  ON estados_resultados (cuenta_norm);

-- Trigger para refrescar updated_at en cada upsert
CREATE OR REPLACE FUNCTION estados_resultados_touch()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS estados_resultados_touch_t ON estados_resultados;
CREATE TRIGGER estados_resultados_touch_t
  BEFORE INSERT OR UPDATE ON estados_resultados
  FOR EACH ROW EXECUTE FUNCTION estados_resultados_touch();

-- RLS — por ahora abierto a service_role; ajustar cuando se defina quién puede leer P&L
ALTER TABLE estados_resultados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full" ON estados_resultados;
CREATE POLICY "service_role_full" ON estados_resultados
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read" ON estados_resultados;
CREATE POLICY "authenticated_read" ON estados_resultados
  FOR SELECT TO authenticated USING (true);
