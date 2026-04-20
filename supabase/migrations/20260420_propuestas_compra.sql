-- propuestas_compra — historial de Excel de sugerido exportados
-- Cada vez que el usuario hace click en "Exportar Excel" en Estrategia de
-- Producto, se guarda un snapshot con las filas y totales. Así no se pierde
-- la propuesta que mandó al cliente.

CREATE TABLE IF NOT EXISTS public.propuestas_compra (
  id           BIGSERIAL PRIMARY KEY,
  cliente      TEXT NOT NULL,
  fecha        TIMESTAMPTZ NOT NULL DEFAULT now(),
  filas        JSONB NOT NULL,             -- [{sku, modelo, descripcion, sugerido, precio, ...}, ...]
  skus_count   INT  NOT NULL DEFAULT 0,
  piezas_total NUMERIC NOT NULL DEFAULT 0,
  monto_total  NUMERIC NOT NULL DEFAULT 0,
  nota         TEXT,
  creado_por   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prop_compra_cliente_fecha
  ON public.propuestas_compra(cliente, fecha DESC);

ALTER TABLE public.propuestas_compra ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prop_compra_read ON public.propuestas_compra;
CREATE POLICY prop_compra_read ON public.propuestas_compra FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS prop_compra_write ON public.propuestas_compra;
CREATE POLICY prop_compra_write ON public.propuestas_compra FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
