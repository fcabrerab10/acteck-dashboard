-- Reporte de SKUs: lista curada para monitoreo en Resumen Clientes
-- Mantiene un orden custom definido por el usuario (no por algoritmo).

CREATE TABLE IF NOT EXISTS public.reporte_skus (
  id          BIGSERIAL PRIMARY KEY,
  sku         TEXT NOT NULL UNIQUE,
  orden       INTEGER NOT NULL,
  activo      BOOLEAN NOT NULL DEFAULT true,
  notas       TEXT,
  -- Snapshot de campos opcionales por si el SKU es nuevo (no está en roadmap_sku/precios_sku aún)
  roadmap_manual    TEXT,
  descripcion_manual TEXT,
  precio_aaa_manual NUMERIC,
  descuento_manual  NUMERIC,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reporte_skus_orden ON public.reporte_skus(orden);

CREATE OR REPLACE FUNCTION public.tg_reporte_skus_touch()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reporte_skus_touch ON public.reporte_skus;
CREATE TRIGGER trg_reporte_skus_touch BEFORE UPDATE ON public.reporte_skus
  FOR EACH ROW EXECUTE FUNCTION public.tg_reporte_skus_touch();

ALTER TABLE public.reporte_skus ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier interno
DROP POLICY IF EXISTS reporte_skus_read ON public.reporte_skus;
CREATE POLICY reporte_skus_read ON public.reporte_skus
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.perfiles p
      WHERE p.user_id = auth.uid() AND p.activo = true
      AND (p.tipo = 'interno' OR p.es_super_admin = true OR p.rol IN ('super_admin','asistente','admin')))
  );

-- Escritura: solo super_admin
DROP POLICY IF EXISTS reporte_skus_write ON public.reporte_skus;
CREATE POLICY reporte_skus_write ON public.reporte_skus
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = auth.uid() AND p.es_super_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = auth.uid() AND p.es_super_admin = true));

COMMENT ON TABLE public.reporte_skus IS
  'Lista curada de SKUs a monitorear en la sección "Reporte" de Resumen Clientes. El orden importa y lo define manualmente Fernando.';
