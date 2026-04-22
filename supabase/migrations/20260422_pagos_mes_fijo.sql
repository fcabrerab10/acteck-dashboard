-- pagos: agregar mes_fijo / anio_fijo para pagos fijos mensuales
-- Así el "mes que representa el pago" queda independiente de fecha_compromiso.
-- Si mueves fecha_compromiso (porque adelantas o atrasas el pago), el mes al
-- que pertenece el pago fijo NO cambia.

ALTER TABLE public.pagos
  ADD COLUMN IF NOT EXISTS mes_fijo  INTEGER CHECK (mes_fijo  BETWEEN 1 AND 12),
  ADD COLUMN IF NOT EXISTS anio_fijo INTEGER CHECK (anio_fijo BETWEEN 2020 AND 2100);

-- Back-fill: para los pagos fijos existentes, derivar mes_fijo/anio_fijo
-- desde fecha_compromiso (así no se rompe la vista actual).
UPDATE public.pagos
SET
  mes_fijo  = EXTRACT(MONTH FROM fecha_compromiso)::int,
  anio_fijo = EXTRACT(YEAR  FROM fecha_compromiso)::int
WHERE categoria = 'pagosFijos'
  AND fecha_compromiso IS NOT NULL
  AND (mes_fijo IS NULL OR anio_fijo IS NULL);

-- Unique (cliente, concepto, mes_fijo, anio_fijo) para pagos fijos, para
-- evitar duplicar el mismo mes del mismo concepto.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pagos_fijos_concepto_mes
  ON public.pagos(cliente, concepto, mes_fijo, anio_fijo)
  WHERE categoria = 'pagosFijos';
