-- Forecast Clientes / Órdenes de Compra — cimientos
-- Fecha: 2026-04-24
--
-- 1) almacenes_config: clasificación comercial/no-comercial por no_almacen
-- 2) Ampliar embarques_compras con columnas que faltan del Master Embarques
-- 3) ordenes_compra + ordenes_compra_detalle (OCs que mandan los clientes)
-- 4) sugeridos_compra (sugeridos generados desde Forecast Clientes, desaparecen
--    cuando aparecen en embarques_compras)
-- 5) Funciones/vistas: lead_time_sku, v_inventario_comercial, v_transito_sku

-- ============================================================
-- 1) almacenes_config
-- ============================================================
CREATE TABLE IF NOT EXISTS public.almacenes_config (
  no_almacen    INTEGER PRIMARY KEY,
  nombre        TEXT NOT NULL,
  cedis         TEXT,
  comercial     BOOLEAN NOT NULL DEFAULT false,
  tipo          TEXT,   -- 'cedis' | 'retail' | 'decme' | 'propio' | 'empaque_danado' | 'fiscal' | 'otro'
  notas         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.tg_almacenes_touch()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_almacenes_touch ON public.almacenes_config;
CREATE TRIGGER trg_almacenes_touch
  BEFORE UPDATE ON public.almacenes_config
  FOR EACH ROW EXECUTE FUNCTION public.tg_almacenes_touch();

-- Seed inicial — comerciales
INSERT INTO public.almacenes_config (no_almacen, nombre, cedis, comercial, tipo) VALUES
  (1,  'Central GDL',          'ALMACENES GUADALAJARA', true, 'cedis'),
  (2,  'Colotlán GDL',         'ALMACENES COLOTLAN',    true, 'cedis'),
  (3,  'Tultitlán CDMX',       'ALMACENES MEXICO',      true, 'cedis'),
  (6,  'Decme',                'ALMACENES MEXICO',      true, 'decme'),
  (14, 'Retail 14',             NULL,                    true, 'retail'),
  (16, 'Retail / Decme 16',     NULL,                    true, 'retail'),
  (17, 'Retail 17',             NULL,                    true, 'retail'),
  (25, 'Almacén propio',        NULL,                    true, 'propio'),
  (44, 'Empaque dañado',        NULL,                    true, 'empaque_danado')
ON CONFLICT (no_almacen) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  cedis = EXCLUDED.cedis,
  comercial = EXCLUDED.comercial,
  tipo = EXCLUDED.tipo;

-- ============================================================
-- 2) Ampliar embarques_compras con columnas faltantes del Master
-- ============================================================
ALTER TABLE public.embarques_compras
  ADD COLUMN IF NOT EXISTS ref_ff                TEXT,
  ADD COLUMN IF NOT EXISTS cbm                   NUMERIC,
  ADD COLUMN IF NOT EXISTS fraccion_arancelaria  TEXT,
  ADD COLUMN IF NOT EXISTS porcentaje            NUMERIC,
  ADD COLUMN IF NOT EXISTS fdw                   TEXT,
  ADD COLUMN IF NOT EXISTS agente_aduanal        TEXT,
  ADD COLUMN IF NOT EXISTS arribo_almacen        DATE,
  ADD COLUMN IF NOT EXISTS lt                    TEXT,
  ADD COLUMN IF NOT EXISTS entrega_directa_cliente TEXT;  -- 'DECME' u otros cuando CEDIS no es almacén propio

-- Índices clave
CREATE INDEX IF NOT EXISTS idx_embarques_codigo        ON public.embarques_compras(codigo);
CREATE INDEX IF NOT EXISTS idx_embarques_estatus       ON public.embarques_compras(estatus);
CREATE INDEX IF NOT EXISTS idx_embarques_supplier      ON public.embarques_compras(supplier);
CREATE INDEX IF NOT EXISTS idx_embarques_fecha_emision ON public.embarques_compras(fecha_emision);
CREATE INDEX IF NOT EXISTS idx_embarques_arribo_cedis  ON public.embarques_compras(arribo_cedis);

-- ============================================================
-- 3) ordenes_compra + detalle
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ordenes_compra (
  id               BIGSERIAL PRIMARY KEY,
  cliente          TEXT NOT NULL CHECK (cliente IN ('digitalife','pcel','mercadolibre')),
  oc_numero        TEXT NOT NULL,                    -- 521775, etc
  fecha_oc         DATE NOT NULL,
  fecha_esperada   DATE,                             -- ETA si aplica
  proveedor        TEXT,                             -- p.ej. REVKO (quien nos surte si es triangulación)
  moneda           TEXT DEFAULT 'MXN',
  tipo_cambio      NUMERIC DEFAULT 1,
  iva_pct          NUMERIC,
  plazo_dias       INTEGER,
  autorizada       BOOLEAN DEFAULT true,
  lugar_entrega    TEXT,
  total_cantidad   INTEGER NOT NULL DEFAULT 0,
  total_importe    NUMERIC NOT NULL DEFAULT 0,
  estado           TEXT NOT NULL DEFAULT 'abierta'
                   CHECK (estado IN ('abierta','parcial','completa','vencida','cancelada')),
  fuente           TEXT,                             -- 'pdf_pcel', 'excel_digitalife', 'manual'
  archivo_url      TEXT,
  notas            TEXT,
  creado_por       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cliente, oc_numero)
);

CREATE INDEX IF NOT EXISTS idx_oc_cliente_fecha ON public.ordenes_compra(cliente, fecha_oc DESC);
CREATE INDEX IF NOT EXISTS idx_oc_estado        ON public.ordenes_compra(estado);

CREATE TABLE IF NOT EXISTS public.ordenes_compra_detalle (
  id               BIGSERIAL PRIMARY KEY,
  oc_id            BIGINT NOT NULL REFERENCES public.ordenes_compra(id) ON DELETE CASCADE,
  sku              TEXT NOT NULL,
  descripcion      TEXT,
  cantidad         INTEGER NOT NULL DEFAULT 0,
  cantidad_surtida INTEGER NOT NULL DEFAULT 0,
  costo_unitario   NUMERIC,
  total            NUMERIC,
  fill_rate        NUMERIC GENERATED ALWAYS AS (
    CASE WHEN cantidad > 0 THEN (cantidad_surtida::NUMERIC / cantidad) * 100 ELSE 0 END
  ) STORED,
  -- Digitalife divide su facturación en varias fechas con colores
  -- {"schedule":[{"fecha":"2026-03-16","cantidad":34,"color":"#xxxxxx"}, ...]}
  facturacion_esperada JSONB NOT NULL DEFAULT '[]'::jsonb,
  notas            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oc_det_oc  ON public.ordenes_compra_detalle(oc_id);
CREATE INDEX IF NOT EXISTS idx_oc_det_sku ON public.ordenes_compra_detalle(sku);

CREATE OR REPLACE FUNCTION public.tg_oc_touch()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_oc_touch      ON public.ordenes_compra;
CREATE TRIGGER trg_oc_touch      BEFORE UPDATE ON public.ordenes_compra      FOR EACH ROW EXECUTE FUNCTION public.tg_oc_touch();
DROP TRIGGER IF EXISTS trg_oc_det_touch  ON public.ordenes_compra_detalle;
CREATE TRIGGER trg_oc_det_touch  BEFORE UPDATE ON public.ordenes_compra_detalle  FOR EACH ROW EXECUTE FUNCTION public.tg_oc_touch();

-- Trigger: recalcular totales y estado del header al cambiar detalle
CREATE OR REPLACE FUNCTION public.tg_oc_recalc()
RETURNS TRIGGER AS $$
DECLARE
  v_oc_id      BIGINT;
  v_cantidad   INTEGER;
  v_importe    NUMERIC;
  v_surtido    INTEGER;
  v_fecha_exp  DATE;
  v_estado_act TEXT;
  v_fill_rate  NUMERIC;
  v_nuevo_est  TEXT;
BEGIN
  v_oc_id := COALESCE(NEW.oc_id, OLD.oc_id);

  SELECT
    COALESCE(SUM(cantidad), 0),
    COALESCE(SUM(COALESCE(total, cantidad * COALESCE(costo_unitario, 0))), 0),
    COALESCE(SUM(cantidad_surtida), 0)
    INTO v_cantidad, v_importe, v_surtido
  FROM public.ordenes_compra_detalle
  WHERE oc_id = v_oc_id;

  SELECT fecha_esperada, estado INTO v_fecha_exp, v_estado_act
  FROM public.ordenes_compra WHERE id = v_oc_id;

  IF v_cantidad > 0 THEN
    v_fill_rate := (v_surtido::NUMERIC / v_cantidad) * 100;
  ELSE
    v_fill_rate := 0;
  END IF;

  -- Determinar nuevo estado (no sobreescribe cancelada)
  IF v_estado_act = 'cancelada' THEN
    v_nuevo_est := 'cancelada';
  ELSIF v_fill_rate >= 95 THEN
    v_nuevo_est := 'completa';
  ELSIF v_fill_rate > 0 THEN
    v_nuevo_est := 'parcial';
  ELSE
    v_nuevo_est := 'abierta';
  END IF;

  -- Vencida: >15 días después de fecha_esperada y <95% surtido
  IF v_estado_act <> 'cancelada' AND v_fecha_exp IS NOT NULL
     AND v_fecha_exp + INTERVAL '15 days' < CURRENT_DATE
     AND v_fill_rate < 95 THEN
    v_nuevo_est := 'vencida';
  END IF;

  UPDATE public.ordenes_compra
     SET total_cantidad = v_cantidad,
         total_importe  = v_importe,
         estado         = v_nuevo_est,
         updated_at     = now()
   WHERE id = v_oc_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_oc_recalc_ins ON public.ordenes_compra_detalle;
CREATE TRIGGER trg_oc_recalc_ins AFTER INSERT ON public.ordenes_compra_detalle
  FOR EACH ROW EXECUTE FUNCTION public.tg_oc_recalc();
DROP TRIGGER IF EXISTS trg_oc_recalc_upd ON public.ordenes_compra_detalle;
CREATE TRIGGER trg_oc_recalc_upd AFTER UPDATE ON public.ordenes_compra_detalle
  FOR EACH ROW EXECUTE FUNCTION public.tg_oc_recalc();
DROP TRIGGER IF EXISTS trg_oc_recalc_del ON public.ordenes_compra_detalle;
CREATE TRIGGER trg_oc_recalc_del AFTER DELETE ON public.ordenes_compra_detalle
  FOR EACH ROW EXECUTE FUNCTION public.tg_oc_recalc();

-- ============================================================
-- 4) sugeridos_compra (se limpian cuando aparecen en master embarques)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sugeridos_compra (
  id               BIGSERIAL PRIMARY KEY,
  sku              TEXT NOT NULL,
  descripcion      TEXT,
  supplier         TEXT,
  cantidad         INTEGER NOT NULL,
  costo_estimado   NUMERIC,
  horizonte_meses  INTEGER NOT NULL DEFAULT 3,
  razon            TEXT,                             -- "demanda proyectada excede inventario+tránsito"
  junta_fecha      DATE,                             -- junta de compras para la que se generó
  estado           TEXT NOT NULL DEFAULT 'pendiente'
                   CHECK (estado IN ('pendiente','exportado','comprado','cancelado')),
  comprado_po      TEXT,                             -- si ya se encontró en embarques_compras
  comprado_fecha   DATE,
  creado_por       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sug_estado      ON public.sugeridos_compra(estado);
CREATE INDEX IF NOT EXISTS idx_sug_sku         ON public.sugeridos_compra(sku);
CREATE INDEX IF NOT EXISTS idx_sug_junta       ON public.sugeridos_compra(junta_fecha);

DROP TRIGGER IF EXISTS trg_sug_touch ON public.sugeridos_compra;
CREATE TRIGGER trg_sug_touch BEFORE UPDATE ON public.sugeridos_compra
  FOR EACH ROW EXECUTE FUNCTION public.tg_oc_touch();

-- ============================================================
-- 5) Funciones y vistas
-- ============================================================

-- Lead time por SKU: promedio de (arribo_cedis - fecha_emision) de embarques CONCLUIDO
CREATE OR REPLACE FUNCTION public.lead_time_sku(p_codigo TEXT)
RETURNS TABLE(dias_promedio NUMERIC, muestras INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROUND(AVG((arribo_cedis - fecha_emision)::NUMERIC), 1) AS dias_promedio,
    COUNT(*)::INTEGER AS muestras
  FROM public.embarques_compras
  WHERE codigo = p_codigo
    AND estatus = 'CONCLUIDO'
    AND arribo_cedis IS NOT NULL
    AND fecha_emision IS NOT NULL
    AND arribo_cedis > fecha_emision;
END;
$$ LANGUAGE plpgsql;

-- Lead time por proveedor (fallback cuando no hay historia del SKU)
CREATE OR REPLACE FUNCTION public.lead_time_supplier(p_supplier TEXT)
RETURNS TABLE(dias_promedio NUMERIC, muestras INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROUND(AVG((arribo_cedis - fecha_emision)::NUMERIC), 1) AS dias_promedio,
    COUNT(*)::INTEGER AS muestras
  FROM public.embarques_compras
  WHERE supplier = p_supplier
    AND estatus = 'CONCLUIDO'
    AND arribo_cedis IS NOT NULL
    AND fecha_emision IS NOT NULL
    AND arribo_cedis > fecha_emision;
END;
$$ LANGUAGE plpgsql;

-- Vista: inventario comercial agregado por SKU (suma solo almacenes comerciales)
CREATE OR REPLACE VIEW public.v_inventario_comercial AS
SELECT
  ia.articulo                           AS sku,
  SUM(ia.disponible)::NUMERIC           AS disponible,
  SUM(ia.inventario)::NUMERIC           AS inventario,
  AVG(ia.costopromedio)                 AS costo_promedio,
  SUM(ia.costodisponible)               AS costo_disponible,
  COUNT(DISTINCT ia.no_almacen)         AS almacenes_con_stock,
  jsonb_object_agg(ia.no_almacen, ia.disponible) FILTER (WHERE ia.disponible > 0) AS por_almacen
FROM public.inventario_acteck ia
JOIN public.almacenes_config ac ON ac.no_almacen = ia.no_almacen AND ac.comercial = true
WHERE ia.articulo IS NOT NULL AND ia.articulo <> '__TEST__'
GROUP BY ia.articulo;

-- Vista: tránsito por SKU (embarques no CONCLUIDOS ni rechazados, agregados)
CREATE OR REPLACE VIEW public.v_transito_sku AS
SELECT
  ec.codigo                              AS sku,
  ec.supplier,
  SUM(COALESCE(ec.shp_qty, ec.po_qty))::INTEGER AS cantidad,
  MIN(ec.arribo_cedis)                   AS eta_mas_cercana,
  MAX(ec.arribo_cedis)                   AS eta_mas_lejana,
  COUNT(*)                               AS embarques,
  jsonb_agg(
    jsonb_build_object(
      'po', ec.po,
      'estatus', ec.estatus,
      'cantidad', COALESCE(ec.shp_qty, ec.po_qty),
      'eta', ec.arribo_cedis,
      'etd', ec.etd,
      'eta_puerto', ec.eta_puerto,
      'cedis', ec.cedis,
      'directo_cliente', ec.entrega_directa_cliente
    )
    ORDER BY ec.arribo_cedis NULLS LAST
  ) AS embarques_detalle
FROM public.embarques_compras ec
WHERE ec.codigo IS NOT NULL
  AND ec.estatus IN ('EN PRODUCCION','PROXIMO A ZARPAR','TRANSITO MARITIMO','EN ESPERA DE CONSOLIDAR','EN RESGUARDO','Pendiente modular')
  -- Excluir entregas directas a clientes externos (DECME, etc): no son inventario para nosotros
  AND (ec.entrega_directa_cliente IS NULL OR ec.entrega_directa_cliente = '')
GROUP BY ec.codigo, ec.supplier;

-- Trigger: cuando se inserta en embarques_compras, marcar sugeridos_compra como 'comprado'
-- si existe un sugerido pendiente del mismo SKU previo a la fecha de emisión
CREATE OR REPLACE FUNCTION public.tg_sugeridos_auto_close()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.sugeridos_compra
     SET estado = 'comprado',
         comprado_po = NEW.po,
         comprado_fecha = COALESCE(NEW.fecha_emision, CURRENT_DATE)
   WHERE sku = NEW.codigo
     AND estado IN ('pendiente','exportado')
     AND (NEW.fecha_emision IS NULL OR created_at <= NEW.fecha_emision + INTERVAL '3 days');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sugeridos_auto_close ON public.embarques_compras;
CREATE TRIGGER trg_sugeridos_auto_close
  AFTER INSERT OR UPDATE ON public.embarques_compras
  FOR EACH ROW EXECUTE FUNCTION public.tg_sugeridos_auto_close();

-- ============================================================
-- 6) RLS: todo para internos
-- ============================================================
ALTER TABLE public.almacenes_config          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordenes_compra            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordenes_compra_detalle    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sugeridos_compra          ENABLE ROW LEVEL SECURITY;

-- Policy helper: todos los internos + super_admin + roles legacy
-- Lectura abierta para internos; escritura solo para editores de forecast_clientes
DROP POLICY IF EXISTS almacenes_read      ON public.almacenes_config;
CREATE POLICY almacenes_read ON public.almacenes_config
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = auth.uid() AND p.activo = true
      AND (p.tipo = 'interno' OR p.es_super_admin = true OR p.rol IN ('super_admin','asistente','admin')))
  );

DROP POLICY IF EXISTS almacenes_write     ON public.almacenes_config;
CREATE POLICY almacenes_write ON public.almacenes_config
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = auth.uid() AND p.activo = true
      AND (p.es_super_admin = true OR p.rol = 'super_admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = auth.uid() AND p.activo = true
      AND (p.es_super_admin = true OR p.rol = 'super_admin'))
  );

DROP POLICY IF EXISTS oc_rw ON public.ordenes_compra;
CREATE POLICY oc_rw ON public.ordenes_compra
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = auth.uid() AND p.activo = true
      AND (p.tipo = 'interno' OR p.es_super_admin = true OR p.rol IN ('super_admin','asistente','admin')))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = auth.uid() AND p.activo = true
      AND (p.tipo = 'interno' OR p.es_super_admin = true OR p.rol IN ('super_admin','asistente','admin')))
  );

DROP POLICY IF EXISTS oc_det_rw ON public.ordenes_compra_detalle;
CREATE POLICY oc_det_rw ON public.ordenes_compra_detalle
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = auth.uid() AND p.activo = true
      AND (p.tipo = 'interno' OR p.es_super_admin = true OR p.rol IN ('super_admin','asistente','admin')))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = auth.uid() AND p.activo = true
      AND (p.tipo = 'interno' OR p.es_super_admin = true OR p.rol IN ('super_admin','asistente','admin')))
  );

DROP POLICY IF EXISTS sug_rw ON public.sugeridos_compra;
CREATE POLICY sug_rw ON public.sugeridos_compra
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = auth.uid() AND p.activo = true
      AND (p.tipo = 'interno' OR p.es_super_admin = true OR p.rol IN ('super_admin','asistente','admin')))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = auth.uid() AND p.activo = true
      AND (p.tipo = 'interno' OR p.es_super_admin = true OR p.rol IN ('super_admin','asistente','admin')))
  );

-- ============================================================
-- 7) Comentarios
-- ============================================================
COMMENT ON TABLE public.almacenes_config IS
  'Clasificación de almacenes: comercial=true son los 9 aprobados para venta B2B a los 3 clientes (1,2,3,6,14,16,17,25,44).';
COMMENT ON VIEW public.v_inventario_comercial IS
  'Inventario agregado por SKU considerando solo almacenes comerciales. Usar en Forecast Clientes.';
COMMENT ON VIEW public.v_transito_sku IS
  'Embarques en tránsito por SKU. Excluye CONCLUIDOS, cancelados y entregas directas a clientes externos (DECME).';
COMMENT ON TABLE public.sugeridos_compra IS
  'Sugeridos de compra generados en Forecast Clientes. Al entrar el SKU a embarques_compras se marca automáticamente como comprado y deja de aparecer en la vista activa.';
