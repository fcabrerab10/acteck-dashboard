-- Cuotas fijadas a mano que el puente/importador NO puede pisar (2026-09-22).
-- Fernando: «esta es la cuota real de Digitalife… que esa cuota en específico no la tome del ERP».
-- Regla en la base (no depende de que la Mac mini traiga el bridge nuevo): una fila con manual = true
-- sobrevive al replace por año del puente (DELETE ignorado) y a su upsert (UPDATE ignorado) salvo que
-- la escritura mande manual = false o una manual_nota distinta (Configuración o una migración).
ALTER TABLE public.cuotas_mensuales ADD COLUMN IF NOT EXISTS manual boolean NOT NULL DEFAULT false;
ALTER TABLE public.cuotas_mensuales ADD COLUMN IF NOT EXISTS manual_nota text;

CREATE OR REPLACE FUNCTION public.cuotas_proteger_manual()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.manual THEN RETURN NULL; END IF;   -- no se borra
    RETURN OLD;
  END IF;
  -- El puente hace upsert (merge) sin mandar `manual` ni `manual_nota`: NEW conserva los de OLD.
  -- Para cambiar una cuota manual a propósito hay que mandar manual = false o una manual_nota nueva.
  IF OLD.manual AND COALESCE(NEW.manual, false) AND NEW.manual_nota IS NOT DISTINCT FROM OLD.manual_nota
     AND (NEW.cuota_min, NEW.cuota_ideal, NEW.cuota_piezas, NEW.cuota_costo, NEW.cuota_minima_interna)
         IS DISTINCT FROM (OLD.cuota_min, OLD.cuota_ideal, OLD.cuota_piezas, OLD.cuota_costo, OLD.cuota_minima_interna) THEN
    RETURN NULL;                              -- el puente intenta pisarla: se ignora el UPDATE
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_cuotas_proteger_manual ON public.cuotas_mensuales;
CREATE TRIGGER trg_cuotas_proteger_manual BEFORE UPDATE OR DELETE ON public.cuotas_mensuales
  FOR EACH ROW EXECUTE FUNCTION public.cuotas_proteger_manual();

-- Digitalife 2026 (tabla "Objetivo Anual 2026"): 25M = cuota mínima · 30M = cuota ideal.
INSERT INTO public.cuotas_mensuales (cliente, anio, mes, cuota_min, cuota_ideal, manual, manual_nota) VALUES
  ('digitalife', 2026,  1, 2085554.97, 2502665.97, true, 'Objetivo Anual 2026 · 25M mín / 30M ideal · Fernando 2026-09-22'),
  ('digitalife', 2026,  2, 2017821.56, 2421385.87, true, 'Objetivo Anual 2026 · 25M mín / 30M ideal · Fernando 2026-09-22'),
  ('digitalife', 2026,  3, 1906096.43, 2287315.71, true, 'Objetivo Anual 2026 · 25M mín / 30M ideal · Fernando 2026-09-22'),
  ('digitalife', 2026,  4, 1349808.86, 1619770.63, true, 'Objetivo Anual 2026 · 25M mín / 30M ideal · Fernando 2026-09-22'),
  ('digitalife', 2026,  5, 1760290.15, 2112348.18, true, 'Objetivo Anual 2026 · 25M mín / 30M ideal · Fernando 2026-09-22'),
  ('digitalife', 2026,  6, 1726097.61, 2071317.14, true, 'Objetivo Anual 2026 · 25M mín / 30M ideal · Fernando 2026-09-22'),
  ('digitalife', 2026,  7, 2297507.88, 2757009.45, true, 'Objetivo Anual 2026 · 25M mín / 30M ideal · Fernando 2026-09-22'),
  ('digitalife', 2026,  8, 2283398.89, 2740078.67, true, 'Objetivo Anual 2026 · 25M mín / 30M ideal · Fernando 2026-09-22'),
  ('digitalife', 2026,  9, 2336212.59, 2803455.11, true, 'Objetivo Anual 2026 · 25M mín / 30M ideal · Fernando 2026-09-22'),
  ('digitalife', 2026, 10, 2478613.23, 2974335.88, true, 'Objetivo Anual 2026 · 25M mín / 30M ideal · Fernando 2026-09-22'),
  ('digitalife', 2026, 11, 2427506.99, 2913008.38, true, 'Objetivo Anual 2026 · 25M mín / 30M ideal · Fernando 2026-09-22'),
  ('digitalife', 2026, 12, 2331090.83, 2797309.00, true, 'Objetivo Anual 2026 · 25M mín / 30M ideal · Fernando 2026-09-22')
ON CONFLICT (cliente, mes, anio) DO UPDATE
  SET cuota_min = EXCLUDED.cuota_min, cuota_ideal = EXCLUDED.cuota_ideal, manual = true, manual_nota = EXCLUDED.manual_nota, updated_at = now();
