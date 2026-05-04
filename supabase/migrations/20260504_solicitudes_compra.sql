-- Solicitudes de compra (S&OP Ferru) — Forecast Clientes v3
-- Fecha: 2026-05-04
--
-- Sistema para que Fernando arme borradores de compras desde la pestaña
-- Forecast Clientes y los exporte como Excel "S&OP Ferru <Mes> <Año>" para
-- mandarlos al equipo de compras.
--
-- Flujo de estados:
--   borrador  → solo Fernando ve, mientras arma la lista de SKUs
--   pendiente → cerrada como solicitud, exportable a Excel, Karolina ya la ve
--   colocada  → marcada manualmente cuando se mandó al proveedor
--   cancelada → descartada
--
-- Después de "colocada" el flujo natural es vía master_embarques (no se
-- duplica acá).

-- ─── Tabla: solicitudes_compra (header) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.solicitudes_compra (
  id BIGSERIAL PRIMARY KEY,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_cerrada TIMESTAMPTZ,
  estado TEXT NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador','pendiente','colocada','cancelada')),
  -- Mes/año al que pertenece (deriva de fecha_cerrada si existe, o
  -- fecha_creacion para borradores). Usado para listar por mes.
  mes INT,
  anio INT,
  notas TEXT,
  creado_por UUID REFERENCES public.perfiles(id),
  -- Marcas para detectar si ya se exportó a Excel
  exportada_en TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS solcom_estado_idx ON public.solicitudes_compra(estado);
CREATE INDEX IF NOT EXISTS solcom_anio_mes_idx ON public.solicitudes_compra(anio, mes);
CREATE INDEX IF NOT EXISTS solcom_creador_idx ON public.solicitudes_compra(creado_por);

ALTER TABLE public.solicitudes_compra ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS solcom_all ON public.solicitudes_compra;
CREATE POLICY solcom_all ON public.solicitudes_compra FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE public.solicitudes_compra IS
  'Header de solicitudes de compra (S&OP Ferru) — borrador → pendiente → colocada.';

-- ─── Tabla: solicitudes_compra_lineas ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.solicitudes_compra_lineas (
  id BIGSERIAL PRIMARY KEY,
  solicitud_id BIGINT NOT NULL REFERENCES public.solicitudes_compra(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  descripcion TEXT,
  cantidad NUMERIC NOT NULL DEFAULT 0,
  proveedor TEXT,
  -- fecha estimada de arribo = hoy + lead_time_promedio del SKU
  fecha_estimada DATE,
  -- Último costo USD del SKU al momento de crear la línea
  ultimo_costo_usd NUMERIC,
  -- Capacidad por contenedor del SKU (si se sabe). null = no se ha comprado
  piezas_por_contenedor NUMERIC,
  -- Cuántos contenedores son (para SKUs no consolidados)
  contenedores NUMERIC,
  -- Si el SKU es consolidado (varios SKUs comparten contenedor)
  es_consolidado BOOLEAN DEFAULT FALSE,
  orden INT, -- para mantener orden visual dentro de la solicitud
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS solcom_lin_sol_idx ON public.solicitudes_compra_lineas(solicitud_id);
CREATE INDEX IF NOT EXISTS solcom_lin_sku_idx ON public.solicitudes_compra_lineas(sku);

ALTER TABLE public.solicitudes_compra_lineas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS solcom_lin_all ON public.solicitudes_compra_lineas;
CREATE POLICY solcom_lin_all ON public.solicitudes_compra_lineas FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE public.solicitudes_compra_lineas IS
  'Líneas (1 SKU = 1 línea) de cada solicitud de compra.';

-- ─── Trigger: derivar mes/anio de fecha_cerrada (o fecha_creacion) ─────
CREATE OR REPLACE FUNCTION public.solcom_set_mes_anio() RETURNS TRIGGER AS $$
BEGIN
  -- Si está cerrada, usa fecha_cerrada; si no, fecha_creacion
  IF NEW.fecha_cerrada IS NOT NULL THEN
    NEW.mes := EXTRACT(MONTH FROM NEW.fecha_cerrada);
    NEW.anio := EXTRACT(YEAR FROM NEW.fecha_cerrada);
  ELSE
    NEW.mes := EXTRACT(MONTH FROM NEW.fecha_creacion);
    NEW.anio := EXTRACT(YEAR FROM NEW.fecha_creacion);
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS solcom_set_mes_anio_trigger ON public.solicitudes_compra;
CREATE TRIGGER solcom_set_mes_anio_trigger
  BEFORE INSERT OR UPDATE ON public.solicitudes_compra
  FOR EACH ROW EXECUTE FUNCTION public.solcom_set_mes_anio();

-- ─── Trigger: updated_at en líneas ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.solcom_lin_touch() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS solcom_lin_touch_trigger ON public.solicitudes_compra_lineas;
CREATE TRIGGER solcom_lin_touch_trigger
  BEFORE UPDATE ON public.solicitudes_compra_lineas
  FOR EACH ROW EXECUTE FUNCTION public.solcom_lin_touch();
