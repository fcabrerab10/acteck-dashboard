-- 2026-09-11 · fuentes_config: cadencia esperada de cada fuente manual del importador.
--
-- La columna "Esperada" de Configuración → Actualización de datos la edita el
-- super admin; el resto de usuarios sólo la lee (panel Datos del avatar, anillo
-- y pill de la tabla). Las mismas cadencias viven como default en
-- src/modules/settings/importador/config.js: si una fuente no tiene fila aquí
-- se usa la del código.
--
-- cadencia (jsonb):
--   { "tipo": "semanal", "dia": 1..7 (1 = lunes), "tolerancia": N }  → esperada el día `dia`, atrasada `tolerancia` días después
--   { "tipo": "mensual", "dia": 1..28, "tolerancia": N }             → esperada el día N de cada mes
--   { "tipo": "cambio" }                                              → se carga cuando cambia; nunca atrasada
--
-- Estados derivados (estadoManual en importador/frescura.js):
--   al_dia     · cargada en el periodo vigente (o todavía no llega la fecha esperada)
--   por_vencer · entre la fecha esperada y el límite (esperada + tolerancia), sin carga
--   atrasada   · después del límite sin carga (o sin carga nunca)

CREATE TABLE IF NOT EXISTS public.fuentes_config (
  fuente_id   TEXT PRIMARY KEY,
  cadencia    JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  TEXT,
  CONSTRAINT fuentes_config_cadencia_tipo CHECK (cadencia->>'tipo' IN ('semanal','mensual','cambio'))
);

COMMENT ON TABLE public.fuentes_config IS
  'Cadencia esperada por fuente manual del importador (tipo semanal/mensual/cambio, día y tolerancia en días). Lectura: todos; escritura: super admin.';

ALTER TABLE public.fuentes_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fuentes_config_select ON public.fuentes_config;
CREATE POLICY fuentes_config_select ON public.fuentes_config
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS fuentes_config_insert ON public.fuentes_config;
CREATE POLICY fuentes_config_insert ON public.fuentes_config
  FOR INSERT TO authenticated WITH CHECK (es_super_admin_check());

DROP POLICY IF EXISTS fuentes_config_update ON public.fuentes_config;
CREATE POLICY fuentes_config_update ON public.fuentes_config
  FOR UPDATE TO authenticated USING (es_super_admin_check()) WITH CHECK (es_super_admin_check());

DROP POLICY IF EXISTS fuentes_config_delete ON public.fuentes_config;
CREATE POLICY fuentes_config_delete ON public.fuentes_config
  FOR DELETE TO authenticated USING (es_super_admin_check());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fuentes_config TO authenticated;

-- Semilla (misma tabla que los defaults en código):
--   semanal lunes, atraso desde jueves (tolerancia 3): Digitalife sell out e inventario, PCEL venta-marca,
--   Dicotech sell out e inventario, Estados de cuenta ×3.
--   Sellout Acteck (Revko): semanal martes, atrasada desde viernes (tolerancia 3).
--   Estado de Resultados: mensual día 10, atrasada desde el 20 (tolerancia 10).
--   Roadmap: cuando cambie.
INSERT INTO public.fuentes_config (fuente_id, cadencia) VALUES
  ('roadmap',            '{"tipo":"cambio"}'),
  ('estados-resultados', '{"tipo":"mensual","dia":10,"tolerancia":10}'),
  ('revko-sellout',      '{"tipo":"semanal","dia":2,"tolerancia":3}'),
  ('digitalife-sellout', '{"tipo":"semanal","dia":1,"tolerancia":3}'),
  ('digitalife-inv',     '{"tipo":"semanal","dia":1,"tolerancia":3}'),
  ('pcel-vm',            '{"tipo":"semanal","dia":1,"tolerancia":3}'),
  ('dicotech-sellout',   '{"tipo":"semanal","dia":1,"tolerancia":3}'),
  ('dicotech-inv',       '{"tipo":"semanal","dia":1,"tolerancia":3}'),
  ('ec-digitalife',      '{"tipo":"semanal","dia":1,"tolerancia":3}'),
  ('ec-pcel',            '{"tipo":"semanal","dia":1,"tolerancia":3}'),
  ('ec-dicotech',        '{"tipo":"semanal","dia":1,"tolerancia":3}')
ON CONFLICT (fuente_id) DO NOTHING;
