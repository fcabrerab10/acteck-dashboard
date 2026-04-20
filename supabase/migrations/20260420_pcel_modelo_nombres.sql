-- sellout_pcel: agregar modelo + nombres de mes
-- Para que la UI muestre "Abr 2026" en vez de "mes actual", y para
-- guardar el modelo (no solo el producto).

ALTER TABLE public.sellout_pcel
  ADD COLUMN IF NOT EXISTS modelo TEXT,
  ADD COLUMN IF NOT EXISTS vta_mes_actual_nombre TEXT,
  ADD COLUMN IF NOT EXISTS vta_mes_1_nombre      TEXT,
  ADD COLUMN IF NOT EXISTS vta_mes_2_nombre      TEXT,
  ADD COLUMN IF NOT EXISTS vta_mes_3_nombre      TEXT;
