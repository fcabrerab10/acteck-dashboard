-- PCEL — preservar histórico mensual y catálogo de SKUs
-- Fecha: 2026-04-20
--
-- Dos tablas nuevas:
--
-- 1) sellout_pcel_mensual — totales mensuales reportados por el cliente.
--    Cada archivo semanal trae los 3 meses más recientes. Se hace upsert
--    por (anio, mes, sku) así nunca perdemos meses antiguos.
--
-- 2) catalogo_sku_pcel — historial de catálogo por SKU:
--    primera_aparicion, ultima_aparicion, apariciones.
--    El estatus (activo / descontinuado / nuevo) se deriva en consulta
--    según la fecha del archivo más reciente vs ultima_aparicion.

-- ────────── sellout_pcel_mensual ──────────
CREATE TABLE IF NOT EXISTS public.sellout_pcel_mensual (
  id                    BIGSERIAL PRIMARY KEY,
  anio                  INT NOT NULL,
  mes                   INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  nombre_mes            TEXT,                    -- 'Ene', 'Feb', etc.
  sku                   TEXT NOT NULL,
  piezas                NUMERIC NOT NULL DEFAULT 0,
  ultima_semana_cargada INT,                     -- semana del archivo que dejó este valor
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_sellout_pcel_mensual UNIQUE (anio, mes, sku)
);

CREATE INDEX IF NOT EXISTS idx_spm_sku       ON public.sellout_pcel_mensual(sku);
CREATE INDEX IF NOT EXISTS idx_spm_anio_mes  ON public.sellout_pcel_mensual(anio, mes);

CREATE OR REPLACE FUNCTION public.tg_sellout_pcel_mensual_touch()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_spm_touch ON public.sellout_pcel_mensual;
CREATE TRIGGER trg_spm_touch
  BEFORE UPDATE ON public.sellout_pcel_mensual
  FOR EACH ROW EXECUTE FUNCTION public.tg_sellout_pcel_mensual_touch();

-- ────────── catalogo_sku_pcel ──────────
CREATE TABLE IF NOT EXISTS public.catalogo_sku_pcel (
  sku                TEXT PRIMARY KEY,
  producto           TEXT,
  marca              TEXT,
  modelo             TEXT,
  familia            TEXT,
  subfamilia         TEXT,
  primera_aparicion  DATE NOT NULL DEFAULT CURRENT_DATE,
  ultima_aparicion   DATE NOT NULL DEFAULT CURRENT_DATE,
  apariciones        INT  NOT NULL DEFAULT 1,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cat_pcel_ultima ON public.catalogo_sku_pcel(ultima_aparicion DESC);
CREATE INDEX IF NOT EXISTS idx_cat_pcel_marca  ON public.catalogo_sku_pcel(marca);
CREATE INDEX IF NOT EXISTS idx_cat_pcel_familia ON public.catalogo_sku_pcel(familia);

-- Trigger específico para upsert: preserva primera_aparicion, incrementa
-- apariciones cuando ultima_aparicion cambia, refresca updated_at.
CREATE OR REPLACE FUNCTION public.tg_cat_pcel_upsert()
RETURNS TRIGGER AS $$
BEGIN
  NEW.primera_aparicion := OLD.primera_aparicion;
  IF NEW.ultima_aparicion IS DISTINCT FROM OLD.ultima_aparicion THEN
    NEW.apariciones := OLD.apariciones + 1;
  ELSE
    NEW.apariciones := OLD.apariciones;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cat_pcel_touch ON public.catalogo_sku_pcel;
DROP TRIGGER IF EXISTS trg_cat_pcel_upsert ON public.catalogo_sku_pcel;
CREATE TRIGGER trg_cat_pcel_upsert
  BEFORE UPDATE ON public.catalogo_sku_pcel
  FOR EACH ROW EXECUTE FUNCTION public.tg_cat_pcel_upsert();

-- ────────── RLS (permisivo; data interna) ──────────
ALTER TABLE public.sellout_pcel_mensual ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogo_sku_pcel    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS spm_read ON public.sellout_pcel_mensual;
CREATE POLICY spm_read ON public.sellout_pcel_mensual FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS spm_write ON public.sellout_pcel_mensual;
CREATE POLICY spm_write ON public.sellout_pcel_mensual FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS cat_pcel_read ON public.catalogo_sku_pcel;
CREATE POLICY cat_pcel_read ON public.catalogo_sku_pcel FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS cat_pcel_write ON public.catalogo_sku_pcel;
CREATE POLICY cat_pcel_write ON public.catalogo_sku_pcel FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
