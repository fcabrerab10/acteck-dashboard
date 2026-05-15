-- Fondos PCEL — ledger de movimientos del Fondo MKT y Fondo Directo (Rebate)
-- Fecha: 2026-05-15
--
-- Cada fila es un movimiento (entrada o salida) del fondo correspondiente.
-- El saldo se calcula sumando todos los movimientos hasta una fecha.
--
-- Tipos:
--   tipo_fondo  = 'mkt'      → Fondo de MKT (acumula, se gasta en actividades/promos)
--                 'directo'  → Fondo Directo Generación Sell Out (se paga como rebate al cliente)
--   tipo_mov    = 'aporte'   → Entrada (se genera del trimestre cuando alcance >= 90%)
--                 'gasto'    → Salida (evento, promoción, pago de rebate)
--                 'inicial'  → Saldo inicial arrastrado de años previos

CREATE TABLE IF NOT EXISTS public.fondo_pcel_movimientos (
  id BIGSERIAL PRIMARY KEY,
  tipo_fondo TEXT NOT NULL CHECK (tipo_fondo IN ('mkt','directo')),
  tipo_mov   TEXT NOT NULL CHECK (tipo_mov IN ('aporte','gasto','inicial')),
  fecha      DATE NOT NULL,
  anio       INT NOT NULL,
  trimestre  INT,                       -- 1-4, null para movimientos no atados a Q
  concepto   TEXT NOT NULL,
  monto      NUMERIC NOT NULL,          -- positivo aporte/inicial, positivo gasto (se resta en agg)
  folio      TEXT,                       -- folio de pago/factura
  referencia_id UUID,                    -- link opcional a marketing_actividades.id o pagos.id
  notas      TEXT,
  creado_por TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fondo_pcel_fondo_idx ON fondo_pcel_movimientos(tipo_fondo);
CREATE INDEX IF NOT EXISTS fondo_pcel_fecha_idx ON fondo_pcel_movimientos(fecha);
CREATE INDEX IF NOT EXISTS fondo_pcel_anio_q_idx ON fondo_pcel_movimientos(anio, trimestre);

ALTER TABLE public.fondo_pcel_movimientos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fondo_pcel_all ON public.fondo_pcel_movimientos;
CREATE POLICY fondo_pcel_all ON public.fondo_pcel_movimientos FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE public.fondo_pcel_movimientos IS
  'Ledger de Fondo MKT y Fondo Directo de PCEL. Saldo = SUM(aporte+inicial) - SUM(gasto) por tipo_fondo.';

-- Seed: saldos iniciales 2026 (arrastrados del cierre 2025)
INSERT INTO public.fondo_pcel_movimientos (tipo_fondo, tipo_mov, fecha, anio, trimestre, concepto, monto, notas)
VALUES
  ('mkt',     'inicial', '2026-01-01', 2026, 1, 'Saldo arrastrado del cierre 2025', 534691.05, 'Importado del Excel A. 00473 PCEL hoja HOJA DE CONTROL 2025 R36'),
  ('directo', 'inicial', '2026-01-01', 2026, 1, 'Saldo arrastrado del cierre 2025',  23727.29, 'Importado del Excel A. 00473 PCEL hoja HOJA DE CONTROL 2025 R36')
ON CONFLICT DO NOTHING;

-- Vista de saldos actuales por tipo de fondo
CREATE OR REPLACE VIEW public.fondo_pcel_saldo AS
SELECT
  tipo_fondo,
  SUM(CASE WHEN tipo_mov IN ('aporte','inicial') THEN monto ELSE 0 END) AS total_entradas,
  SUM(CASE WHEN tipo_mov = 'gasto' THEN monto ELSE 0 END)               AS total_gastos,
  SUM(CASE WHEN tipo_mov IN ('aporte','inicial') THEN monto ELSE -monto END) AS saldo
FROM public.fondo_pcel_movimientos
GROUP BY tipo_fondo;
