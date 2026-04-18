-- Migration: ampliar estatus permitidos + seed inicial con los pendientes
-- de Karolina (semanas del 13/04 al 20/04 de 2026).
--
-- Correr DESPUÉS de 20260417_administracion_interna.sql.
-- Idempotente: el seed sólo inserta si la tabla está vacía.

-- ─────────────────────────────────────────────────────────────
-- 1) Ampliar CHECK de estatus para aceptar 'urgente' y 'en_pausa'
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.pendientes_equipo
  DROP CONSTRAINT IF EXISTS pendientes_equipo_estatus_check;

ALTER TABLE public.pendientes_equipo
  ADD CONSTRAINT pendientes_equipo_estatus_check
  CHECK (estatus IN ('pendiente','en_proceso','urgente','en_pausa','listo'));

-- ─────────────────────────────────────────────────────────────
-- 2) Seed con los pendientes reales de Karolina
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  karolina_id UUID;
  yacargado   INT;
BEGIN
  -- Buscar a Karolina en perfiles
  SELECT user_id INTO karolina_id
  FROM public.perfiles
  WHERE nombre ILIKE '%Karolina%' OR email ILIKE '%karolina%'
  LIMIT 1;

  -- Evitar duplicar si ya se corrió
  SELECT COUNT(*) INTO yacargado FROM public.pendientes_equipo;
  IF yacargado > 0 THEN
    RAISE NOTICE 'pendientes_equipo ya tiene % filas — se omite seed.', yacargado;
    RETURN;
  END IF;

  -- ── LUNES 13/04/2026 ──
  INSERT INTO public.pendientes_equipo (cuenta, tarea, categoria, fecha_limite, estatus, notas, responsable) VALUES
    ('mercadolibre', 'Revisar reputación y alertas ML', 'Reputación ML', '2026-04-13', 'listo', NULL, karolina_id),
    ('mercadolibre', 'Gestionar mensajes postventa', 'Mensajes postventa / Reclamos y Preguntas', '2026-04-13', 'listo', NULL, karolina_id),
    ('mercadolibre', 'Revisar que productos tienen videos y cuáles faltan para subirlos', 'Publicaciones', '2026-04-13', 'listo', NULL, karolina_id),
    ('mercadolibre', 'Terminar de subir nuevos productos HUBs y baterías recargables', 'Publicaciones', '2026-04-13', 'listo', NULL, karolina_id),
    ('digitalife',   'Pendientes de junta con Digitalife', 'Materiales de marketing', '2026-04-13', 'listo', NULL, karolina_id),
    ('digitalife',   'Pendientes Vic: entrega de solicitudes', 'Campañas y promociones', '2026-04-13', 'listo', 'Presentación Q1 corregida + inventario Chapalita', karolina_id),
    ('digitalife',   'Organizar torneo de evento Monterrey', 'Ayuda a Hans', '2026-04-13', 'listo', NULL, karolina_id),
    ('otro',         'Comenzar curso de Excel', 'Excel', '2026-04-13', 'en_proceso', NULL, karolina_id);

  -- ── MARTES 14/04/2026 ──
  INSERT INTO public.pendientes_equipo (cuenta, tarea, categoria, fecha_limite, estatus, notas, responsable) VALUES
    ('mercadolibre', 'Revisar reputación y alertas ML', 'Reputación ML', '2026-04-14', 'en_proceso', NULL, karolina_id),
    ('mercadolibre', 'Gestionar mensajes postventa', 'Mensajes postventa / Reclamos y Preguntas', '2026-04-14', 'en_proceso', NULL, karolina_id),
    ('digitalife',   'Registrar métricas de marketing en dashboard', 'Materiales de marketing', '2026-04-14', 'listo', NULL, karolina_id),
    ('digitalife',   'Excel de productos de exhibidores', 'Campañas y promociones', '2026-04-14', 'listo', NULL, karolina_id),
    ('otro',         'Tomar curso de Excel en la tarde', 'Excel', '2026-04-14', 'en_proceso', NULL, karolina_id),
    ('digitalife',   'Dinámica de Hans', 'Campañas y promociones', '2026-04-14', 'listo', NULL, karolina_id),
    ('digitalife',   'Preguntar sobre diseño de banners', 'Campañas y promociones', '2026-04-14', 'en_proceso', NULL, karolina_id),
    ('digitalife',   'Productos de Herin', 'Campañas y promociones', '2026-04-14', 'listo', NULL, karolina_id);

  -- ── MIÉRCOLES 15/04/2026 ──
  INSERT INTO public.pendientes_equipo (cuenta, tarea, categoria, fecha_limite, estatus, notas, responsable) VALUES
    ('mercadolibre', 'Revisar reputación y alertas ML', 'Reputación ML', '2026-04-15', 'en_proceso', NULL, karolina_id),
    ('mercadolibre', 'Gestionar mensajes postventa', 'Mensajes postventa / Reclamos y Preguntas', '2026-04-15', 'en_proceso', NULL, karolina_id),
    ('digitalife',   'Ver con Laura las facturas pendientes y solicitar archivo compartido', 'Seguimiento de pagos / facturas', '2026-04-15', 'urgente', NULL, karolina_id),
    ('digitalife',   'Hacer archivo de productos y exhibiciones', 'Campañas y promociones', '2026-04-15', 'urgente', NULL, karolina_id),
    ('digitalife',   'Pedir a Pablo manteles para eventos del próximo mes, lavarlos y plancharlos', 'Campañas y promociones', '2026-04-15', 'en_proceso', 'Cotizar tintorería', karolina_id);

  -- ── JUEVES 16/04/2026 ──
  INSERT INTO public.pendientes_equipo (cuenta, tarea, categoria, fecha_limite, estatus, notas, responsable) VALUES
    ('mercadolibre', 'Revisar reputación y alertas ML', 'Reputación ML', '2026-04-16', 'listo', NULL, karolina_id),
    ('mercadolibre', 'Gestionar mensajes postventa', 'Mensajes postventa / Reclamos y Preguntas', '2026-04-16', 'listo', NULL, karolina_id),
    ('digitalife',   'Solicitar a Vic de nuevo las medidas de los banners y layout de la página web', 'Materiales de marketing', '2026-04-16', 'listo', NULL, karolina_id),
    ('digitalife',   'Hacer solicitud de diseños del mes de mayo a Brenda y equipo', 'Seguimiento de solicitud de diseños', '2026-04-16', 'listo', NULL, karolina_id),
    ('digitalife',   'Comenzar a ver opciones y ejemplos de "bolsas reutilizables"', 'Campañas y promociones', '2026-04-16', 'en_proceso', NULL, karolina_id),
    ('digitalife',   'Dinámica Día del Niño (Liz)', 'Campañas y promociones', '2026-04-16', 'listo', NULL, karolina_id),
    ('digitalife',   'Enviar forma de exhibiciones al equipo de Camilo', 'Campañas y promociones', '2026-04-16', 'listo', NULL, karolina_id),
    ('digitalife',   'Ver con Laura las facturas pendientes', 'Seguimiento de pagos / facturas', '2026-04-16', 'listo', NULL, karolina_id);

  -- ── VIERNES 17/04/2026 (HOY) ──
  INSERT INTO public.pendientes_equipo (cuenta, tarea, categoria, fecha_limite, estatus, notas, responsable) VALUES
    ('mercadolibre', 'Revisar reputación y alertas ML', 'Reputación ML', '2026-04-17', 'listo', NULL, karolina_id),
    ('mercadolibre', 'Gestionar mensajes postventa', 'Mensajes postventa / Reclamos y Preguntas', '2026-04-17', 'listo', NULL, karolina_id),
    ('mercadolibre', 'Terminar de subir las promociones', 'Campañas y promociones', '2026-04-17', 'en_proceso', NULL, karolina_id),
    ('digitalife',   'Comenzar a ver opciones y ejemplos de "bolsas reutilizables"', 'Materiales de marketing', '2026-04-17', 'en_proceso', NULL, karolina_id),
    ('digitalife',   'Terminar de llenar dashboard', 'Campañas y promociones', '2026-04-17', 'listo', NULL, karolina_id),
    ('digitalife',   'Pagos con Fernando — Cobranza', 'Seguimiento de pagos / facturas', '2026-04-17', 'en_pausa', 'Junta el lunes', karolina_id),
    ('digitalife',   'Cerrar actualización del stand y hacer Excel de productos extras a comprar', 'Campañas y promociones', '2026-04-17', 'en_proceso', 'Limpieza para pantallas, flores, libretas, velcros, trapos', karolina_id),
    ('digitalife',   'Extras a sucursales (etiquetas, categorías, diferenciadores, QR de redes, ficha técnica) + mejoras del stand Chapalita', 'Campañas y promociones', '2026-04-17', 'listo', 'Mariana', karolina_id),
    ('otro',         'Curso de Excel', 'Excel', '2026-04-17', 'en_proceso', NULL, karolina_id);

  -- ── LUNES 20/04/2026 ──
  INSERT INTO public.pendientes_equipo (cuenta, tarea, categoria, fecha_limite, estatus, notas, responsable) VALUES
    ('mercadolibre', 'Revisar reputación y alertas ML', 'Reputación ML', '2026-04-20', 'pendiente', NULL, karolina_id),
    ('mercadolibre', 'Gestionar mensajes postventa', 'Mensajes postventa / Reclamos y Preguntas', '2026-04-20', 'pendiente', NULL, karolina_id),
    ('otro',         'Torneo de Hans — Monterrey', 'Ayuda a Hans', '2026-04-20', 'pendiente', NULL, karolina_id),
    ('digitalife',   'Carga plan de MKT de abril, mayo y junio', 'Plan de MKT', '2026-04-20', 'pendiente', NULL, karolina_id);

  -- ── RUTINAS SIN FECHA ESPECÍFICA (checklist diario operativo) ──
  -- Estas se dejan sin fecha_limite para que Karolina decida cuándo moverlas
  INSERT INTO public.pendientes_equipo (cuenta, tarea, categoria, fecha_limite, estatus, notas, responsable) VALUES
    ('mercadolibre', 'Revisar publicaciones con alertas activas', 'Publicaciones', NULL, 'pendiente', 'Identificar publicaciones pausadas o con bajo stock', karolina_id),
    ('mercadolibre', 'Coordinación de Clip semanal', 'Clips / Contenido', NULL, 'pendiente', 'Avanzar producción según calendario', karolina_id),
    ('pcel',         'Revisar correos y novedades de PCEL', 'Seguimiento de pagos / facturas', NULL, 'pendiente', 'Revisar bandeja y actualizar dashboard si hay cambios', karolina_id),
    ('pcel',         'Actualizar condiciones comerciales en dashboard', 'Seguimiento de pagos / facturas', NULL, 'pendiente', 'Verificar vigencia de acuerdos', karolina_id),
    ('pcel',         'Enviar cotización de nuevos SKUs', 'Envío de cotizaciones', NULL, 'pendiente', 'Según lista de productos solicitados por PCEL', karolina_id),
    ('pcel',         'Coordinar entrega de materiales de marketing', 'Materiales de marketing', NULL, 'pendiente', 'Banners e imágenes solicitados', karolina_id);

  RAISE NOTICE 'Seed completo. Pendientes cargados.';
END $$;
