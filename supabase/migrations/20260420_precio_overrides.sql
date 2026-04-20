-- precio_overrides — permite editar manualmente el precio de un SKU por cliente
-- Se aplica por encima de precios_sku.precio_descuento (que viene del Roadmap).
-- Patrón análogo a sugerido_overrides.

CREATE TABLE IF NOT EXISTS public.precio_overrides (
  id          BIGSERIAL PRIMARY KEY,
  cliente     TEXT NOT NULL,
  sku         TEXT NOT NULL,              -- sku numérico del cliente (PCEL) o modelo según cliente
  precio      NUMERIC NOT NULL,
  updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_precio_overrides UNIQUE (cliente, sku)
);

CREATE INDEX IF NOT EXISTS idx_precio_ov_cliente ON public.precio_overrides(cliente);

CREATE OR REPLACE FUNCTION public.tg_precio_overrides_touch()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_precio_overrides_touch ON public.precio_overrides;
CREATE TRIGGER trg_precio_overrides_touch
  BEFORE UPDATE ON public.precio_overrides
  FOR EACH ROW EXECUTE FUNCTION public.tg_precio_overrides_touch();

ALTER TABLE public.precio_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS precio_ov_read ON public.precio_overrides;
CREATE POLICY precio_ov_read ON public.precio_overrides FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS precio_ov_write ON public.precio_overrides;
CREATE POLICY precio_ov_write ON public.precio_overrides FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
