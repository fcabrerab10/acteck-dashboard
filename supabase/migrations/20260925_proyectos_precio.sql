-- Proyectos y forecast (2026-09-25, Fernando): cada línea del proyecto lleva precio (lista elegida o
-- personalizado) para que el tablero sume en dinero lo que hay que cerrar mes a mes por cliente.
ALTER TABLE public.proyecto_lineas ADD COLUMN IF NOT EXISTS precio numeric;
ALTER TABLE public.proyecto_lineas ADD COLUMN IF NOT EXISTS lista  text;
COMMENT ON COLUMN public.proyecto_lineas.precio IS 'Precio unitario del proyecto (lista del cliente o personalizado)';
COMMENT ON COLUMN public.proyecto_lineas.lista  IS 'Nombre de la lista de precios elegida o __custom';
