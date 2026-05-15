-- Fuente de pago — de dónde sale el dinero para cada concepto
-- Fecha: 2026-05-15
--
-- Valores:
--   fondo_mkt      → Sale del Fondo de Marketing (descuenta saldo del ledger)
--   fondo_directo  → Sale del Fondo Directo / Rebate (descuenta saldo del ledger)
--   vendor         → Lo paga el cliente / vendor con su propio dinero (no afecta fondo)
--   empresa        → Sale directo de la empresa (Revko/Acteck). Ej: SPIFF
--   null           → Sin asignar — pendiente de revisar

ALTER TABLE public.pagos ADD COLUMN IF NOT EXISTS fuente TEXT;
COMMENT ON COLUMN public.pagos.fuente IS 'fondo_mkt | fondo_directo | vendor | empresa | NULL (pendiente)';
CREATE INDEX IF NOT EXISTS pagos_fuente_idx ON public.pagos(fuente) WHERE fuente IS NOT NULL;

ALTER TABLE public.marketing_actividades ADD COLUMN IF NOT EXISTS fuente TEXT;
COMMENT ON COLUMN public.marketing_actividades.fuente IS 'fondo_mkt | fondo_directo | vendor | empresa | NULL (pendiente)';
CREATE INDEX IF NOT EXISTS mkt_act_fuente_idx ON public.marketing_actividades(fuente) WHERE fuente IS NOT NULL;

-- Vincular movimiento del fondo a su pago o actividad de origen
ALTER TABLE public.fondo_pcel_movimientos ADD COLUMN IF NOT EXISTS pago_id UUID;
ALTER TABLE public.fondo_pcel_movimientos ADD COLUMN IF NOT EXISTS actividad_id UUID;
CREATE INDEX IF NOT EXISTS fondo_pago_idx ON public.fondo_pcel_movimientos(pago_id) WHERE pago_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS fondo_act_idx ON public.fondo_pcel_movimientos(actividad_id) WHERE actividad_id IS NOT NULL;
