-- ══════════════════════════════════════════════════════════════════════
-- Pagos mensuales para promociones tipo "sellout"
-- ══════════════════════════════════════════════════════════════════════
-- Contexto:
--   Cada promo sellout se paga mes a mes según lo que VENDIÓ el cliente
--   al consumidor final. Ej: lo que se vendió en abril se paga en mayo.
--   Hoy el código sólo guardaba el total estimado (inv_inicial × monto/pz);
--   ahora generamos un registro en `pagos` por cada mes cerrado.
-- ══════════════════════════════════════════════════════════════════════

-- 1. promociones: columnas para tracking acumulado y cierre
ALTER TABLE public.promociones
  ADD COLUMN IF NOT EXISTS piezas_pagadas_acum     NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cerrada_manual          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cerrada_por_inventario  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cerrada_at              TIMESTAMPTZ;

-- 2. pagos: ligar con promo + mes/año del sellout que se está pagando
ALTER TABLE public.pagos
  ADD COLUMN IF NOT EXISTS promocion_id   BIGINT REFERENCES public.promociones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mes_sellout    INTEGER CHECK (mes_sellout BETWEEN 1 AND 12),
  ADD COLUMN IF NOT EXISTS anio_sellout   INTEGER CHECK (anio_sellout BETWEEN 2020 AND 2100),
  ADD COLUMN IF NOT EXISTS piezas_mes     NUMERIC;

-- Evita duplicar el pago del mismo mes para la misma promo.
-- Sólo aplica cuando promocion_id no es NULL (pagos no-promocionales siguen
-- funcionando igual). Index parcial para no chocar con NULLs.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pagos_promo_mes
  ON public.pagos(promocion_id, anio_sellout, mes_sellout)
  WHERE promocion_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pagos_promo_id
  ON public.pagos(promocion_id)
  WHERE promocion_id IS NOT NULL;

-- 3. Trigger: cuando se crea un pago de promo, sumar piezas al acumulado.
--    Cuando se borra, restarlas. Cuando se actualiza, ajustar la diferencia.
CREATE OR REPLACE FUNCTION public.tg_actualiza_piezas_pagadas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.promocion_id IS NOT NULL AND NEW.piezas_mes IS NOT NULL THEN
    UPDATE public.promociones
      SET piezas_pagadas_acum = COALESCE(piezas_pagadas_acum, 0) + NEW.piezas_mes
      WHERE id = NEW.promocion_id;
  ELSIF TG_OP = 'DELETE' AND OLD.promocion_id IS NOT NULL AND OLD.piezas_mes IS NOT NULL THEN
    UPDATE public.promociones
      SET piezas_pagadas_acum = GREATEST(0, COALESCE(piezas_pagadas_acum, 0) - OLD.piezas_mes)
      WHERE id = OLD.promocion_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.promocion_id IS NOT NULL THEN
    -- si cambió piezas_mes, ajusta delta
    UPDATE public.promociones
      SET piezas_pagadas_acum = GREATEST(0,
        COALESCE(piezas_pagadas_acum, 0)
          - COALESCE(OLD.piezas_mes, 0)
          + COALESCE(NEW.piezas_mes, 0)
      )
      WHERE id = NEW.promocion_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_pagos_actualiza_piezas ON public.pagos;
CREATE TRIGGER trg_pagos_actualiza_piezas
  AFTER INSERT OR UPDATE OR DELETE ON public.pagos
  FOR EACH ROW EXECUTE FUNCTION public.tg_actualiza_piezas_pagadas();

-- 4. Reconciliación: si por alguna razón el acumulado quedó desync, recalcular.
--    (Idempotente — corre seguro cualquier vez.)
UPDATE public.promociones p
SET piezas_pagadas_acum = COALESCE((
  SELECT SUM(piezas_mes) FROM public.pagos pg
  WHERE pg.promocion_id = p.id AND pg.piezas_mes IS NOT NULL
), 0)
WHERE p.tipo = 'sellout';
