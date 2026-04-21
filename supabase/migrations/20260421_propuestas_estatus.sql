-- propuestas_compra — agregar estatus y timestamps de ciclo de vida
-- Flujo:
--   'pendiente'    → propuesta exportada, esperando OC del cliente
--   'cerrada'      → ya cruzada con OC del cliente (o descartada)
-- Los SKUs que están en propuestas 'pendientes' se OCULTAN de la tabla
-- SKUs en riesgo de desabasto (ya no hay que volver a proponerlos).

ALTER TABLE public.propuestas_compra
  ADD COLUMN IF NOT EXISTS estatus TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estatus IN ('pendiente', 'cerrada', 'cancelada')),
  ADD COLUMN IF NOT EXISTS cerrada_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cerrada_por UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prop_compra_estatus
  ON public.propuestas_compra(cliente, estatus, fecha DESC);
