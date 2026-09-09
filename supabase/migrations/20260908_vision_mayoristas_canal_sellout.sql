-- Visión General leía sellMayoristas.canal_sellout, columna que la vista no
-- exponía (siempre undefined; la UI caía a fallbacks). La vista filtra
-- canal_sellout='mayoreo', así que se expone como constante. CREATE OR
-- REPLACE sólo permite AÑADIR columnas al final: misma definición + 1 col.
CREATE OR REPLACE VIEW public.v_vision_sellout_mayoristas AS
SELECT anio,
       fuente                        AS mayorista,
       sum(importe)                  AS importe,
       count(DISTINCT cliente_final) AS clientes_finales,
       count(DISTINCT sku)           AS skus,
       'mayoreo'::text               AS canal_sellout
FROM public.mv_sellout_unificado
WHERE canal_sellout = 'mayoreo'::text
GROUP BY anio, fuente;

NOTIFY pgrst, 'reload schema';
