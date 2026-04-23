-- clientes_credito_config — configuración fija por cliente para Crédito y Cobranza
-- (línea de crédito + plazo). No se reemplaza con el Excel del corte semanal —
-- el usuario la edita manualmente cuando cambia algo.

CREATE TABLE IF NOT EXISTS public.clientes_credito_config (
  cliente              TEXT PRIMARY KEY,
  linea_credito_usd    NUMERIC,
  plazo_dias_credito   INTEGER NOT NULL DEFAULT 90,
  notas                TEXT,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_clientes_credito_config_touch()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clientes_credito_config_touch ON public.clientes_credito_config;
CREATE TRIGGER trg_clientes_credito_config_touch
  BEFORE UPDATE ON public.clientes_credito_config
  FOR EACH ROW EXECUTE FUNCTION public.tg_clientes_credito_config_touch();

-- RLS: todos los authenticated pueden leer; solo user_can_edit puede escribir
ALTER TABLE public.clientes_credito_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clientes_credito_config_select ON public.clientes_credito_config;
CREATE POLICY clientes_credito_config_select ON public.clientes_credito_config
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS clientes_credito_config_insert ON public.clientes_credito_config;
CREATE POLICY clientes_credito_config_insert ON public.clientes_credito_config
  FOR INSERT TO authenticated WITH CHECK (public.user_can_edit());

DROP POLICY IF EXISTS clientes_credito_config_update ON public.clientes_credito_config;
CREATE POLICY clientes_credito_config_update ON public.clientes_credito_config
  FOR UPDATE TO authenticated USING (public.user_can_edit()) WITH CHECK (public.user_can_edit());

DROP POLICY IF EXISTS clientes_credito_config_delete ON public.clientes_credito_config;
CREATE POLICY clientes_credito_config_delete ON public.clientes_credito_config
  FOR DELETE TO authenticated USING (public.user_can_edit());

-- Seed: valores actuales (del último corte conocido)
INSERT INTO public.clientes_credito_config (cliente, linea_credito_usd, plazo_dias_credito, notas)
VALUES
  ('digitalife',    500000, 90, 'Configuración inicial desde corte sem 16/2026'),
  ('pcel',         1000000, 90, 'Configuración inicial desde corte sem 16/2026'),
  ('mercadolibre',    NULL, 90, 'Pendiente confirmar')
ON CONFLICT (cliente) DO NOTHING;
