-- ═══════════════════════════════════════════════════════════════════════════
-- 20260921 · Proyectos y abasto (sustituye la pestaña Forecast · Reservas)
--
-- Modelo mínimo y explícito: un PROYECTO es una venta comprometida a un cliente
-- propio para un mes, con sus SKUs y piezas. La cobertura (disponible, tránsito,
-- faltante, fecha límite de compra) NO se guarda: se calcula en el cliente con
-- src/modules/comercial/proyectos/calculo.js a partir del inventario y del
-- tránsito vivos, para que nunca quede una cifra vieja en la base.
--
--   proyectos        → cabecera (nombre, cliente, mes objetivo, probabilidad…)
--   proyecto_lineas  → SKUs del proyecto (piezas comprometidas + piezas ya reservadas)
--   v_proyectos_sku_mes → demanda por SKU y mes (lo que consume la Matriz SKU × mes)
--
-- RLS: lectura para cualquier autenticado; escritura para el equipo interno
-- (mismo predicado que `sugeridos_compra`, la tabla hermana de planeación).
-- Auditoría: trigger genérico fn_auditoria() en ambas tablas (Historial de cambios).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Tablas ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.proyectos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        text        NOT NULL,
  cliente       text        NOT NULL CHECK (cliente IN ('digitalife', 'pcel', 'dicotech')),
  anio          int,
  mes           int CHECK (mes IS NULL OR (mes BETWEEN 1 AND 12)),
  probabilidad  text        NOT NULL DEFAULT 'prospecto'
                  CHECK (probabilidad IN ('prospecto', 'probable', 'confirmado', 'entregado', 'cancelado')),
  responsable   text,
  notas         text,
  creado_por    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.proyecto_lineas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id  uuid NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  sku          text NOT NULL,
  piezas       int  NOT NULL DEFAULT 0,
  reservado    int  NOT NULL DEFAULT 0,
  notas        text,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, sku)
);

CREATE INDEX IF NOT EXISTS ix_proyectos_mes      ON public.proyectos (anio, mes);
CREATE INDEX IF NOT EXISTS ix_proyectos_cliente  ON public.proyectos (cliente);
CREATE INDEX IF NOT EXISTS ix_proyecto_lineas_sku ON public.proyecto_lineas (sku);

-- ─── 2. updated_at ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.proyectos_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_proyectos_touch ON public.proyectos;
CREATE TRIGGER trg_proyectos_touch BEFORE UPDATE ON public.proyectos
  FOR EACH ROW EXECUTE FUNCTION public.proyectos_touch();

DROP TRIGGER IF EXISTS trg_proyecto_lineas_touch ON public.proyecto_lineas;
CREATE TRIGGER trg_proyecto_lineas_touch BEFORE UPDATE ON public.proyecto_lineas
  FOR EACH ROW EXECUTE FUNCTION public.proyectos_touch();

-- ─── 3. RLS ────────────────────────────────────────────────────────────────
ALTER TABLE public.proyectos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proyecto_lineas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS proyectos_read ON public.proyectos;
CREATE POLICY proyectos_read ON public.proyectos
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS proyectos_rw ON public.proyectos;
CREATE POLICY proyectos_rw ON public.proyectos
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.perfiles p
                  WHERE p.user_id = auth.uid() AND p.activo = true
                    AND (p.tipo = 'interno' OR p.es_super_admin = true
                         OR p.rol = ANY (ARRAY['super_admin', 'asistente', 'admin']))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.perfiles p
                  WHERE p.user_id = auth.uid() AND p.activo = true
                    AND (p.tipo = 'interno' OR p.es_super_admin = true
                         OR p.rol = ANY (ARRAY['super_admin', 'asistente', 'admin']))));

DROP POLICY IF EXISTS proyecto_lineas_read ON public.proyecto_lineas;
CREATE POLICY proyecto_lineas_read ON public.proyecto_lineas
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS proyecto_lineas_rw ON public.proyecto_lineas;
CREATE POLICY proyecto_lineas_rw ON public.proyecto_lineas
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.perfiles p
                  WHERE p.user_id = auth.uid() AND p.activo = true
                    AND (p.tipo = 'interno' OR p.es_super_admin = true
                         OR p.rol = ANY (ARRAY['super_admin', 'asistente', 'admin']))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.perfiles p
                  WHERE p.user_id = auth.uid() AND p.activo = true
                    AND (p.tipo = 'interno' OR p.es_super_admin = true
                         OR p.rol = ANY (ARRAY['super_admin', 'asistente', 'admin']))));

GRANT SELECT ON public.proyectos, public.proyecto_lineas TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.proyectos, public.proyecto_lineas TO authenticated;

-- ─── 4. Auditoría (Historial de cambios) ───────────────────────────────────
DROP TRIGGER IF EXISTS trg_auditoria ON public.proyectos;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.proyectos
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria('id');

DROP TRIGGER IF EXISTS trg_auditoria ON public.proyecto_lineas;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.proyecto_lineas
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria('id');

-- ─── 5. Vista · demanda por SKU y mes ──────────────────────────────────────
-- Una fila por sku + mes objetivo, con el detalle de los proyectos que la piden.
-- Excluye los cancelados (no comprometen inventario). Los entregados se quedan
-- para que el histórico cuadre; la pantalla los filtra por `probabilidad`.
DROP VIEW IF EXISTS public.v_proyectos_sku_mes;
CREATE VIEW public.v_proyectos_sku_mes AS
SELECT
  l.sku,
  p.anio,
  p.mes,
  SUM(COALESCE(l.piezas, 0))::bigint    AS piezas,
  SUM(COALESCE(l.reservado, 0))::bigint AS reservado,
  jsonb_agg(jsonb_build_object(
    'id',           p.id,
    'nombre',       p.nombre,
    'cliente',      p.cliente,
    'probabilidad', p.probabilidad,
    'piezas',       COALESCE(l.piezas, 0)
  ) ORDER BY COALESCE(l.piezas, 0) DESC) AS proyectos
FROM public.proyecto_lineas l
JOIN public.proyectos p ON p.id = l.proyecto_id
WHERE p.probabilidad <> 'cancelado'
GROUP BY l.sku, p.anio, p.mes;

GRANT SELECT ON public.v_proyectos_sku_mes TO anon, authenticated;

COMMENT ON TABLE  public.proyectos          IS 'Proyectos y abasto (V3 · 2026-09-21): ventas comprometidas por cliente y mes. Ver docs/PROYECTOS_ABASTO.md';
COMMENT ON TABLE  public.proyecto_lineas    IS 'SKUs de cada proyecto: piezas comprometidas y piezas ya reservadas en Acteck.';
COMMENT ON VIEW   public.v_proyectos_sku_mes IS 'Demanda de proyectos por SKU y mes (sin cancelados) + detalle de proyectos en jsonb.';
