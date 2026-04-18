-- Promociones — tabla dedicada para acuerdos comerciales con cliente
-- Fecha: 2026-04-18
--
-- Separa el acuerdo (promo) del pago ejecutado (tabla pagos).
-- Al cerrar y aprobar la promo, se inserta un registro en pagos
-- con categoria='promociones' y monto_aprobado.
--
-- Cuatro tipos de promoción:
--   sellout            — monto fijo por pieza vendida en el periodo
--   proteccion_precio  — (precio_viejo − precio_nuevo) × inv_al_momento
--   sell_in            — monto fijo por pieza comprada en el periodo
--   bolsa              — monto fijo total (no depende de piezas)
--
-- Ciclo de vida:
--   borrador → activa → por_calcular → aprobada → pagada
--              (fecha_inicio)  (fecha_fin alcanzada)

CREATE TABLE IF NOT EXISTS public.promociones (
  id              BIGSERIAL PRIMARY KEY,
  cliente         TEXT NOT NULL CHECK (cliente IN ('digitalife','pcel','mercadolibre')),
  tipo            TEXT NOT NULL CHECK (tipo IN ('sellout','proteccion_precio','sell_in','bolsa')),
  titulo          TEXT NOT NULL,
  descripcion     TEXT,
  estatus         TEXT NOT NULL DEFAULT 'borrador'
                  CHECK (estatus IN ('borrador','activa','por_calcular','aprobada','pagada','cancelada')),

  -- Periodo
  fecha_inicio    DATE NOT NULL,
  fecha_fin       DATE NOT NULL,

  -- Alcance: array de SKUs (todos con el mismo monto por pieza en esta promo)
  skus            TEXT[] NOT NULL DEFAULT '{}',

  -- Sellout / Sell In
  monto_por_pieza      NUMERIC,
  inventario_inicial   NUMERIC,

  -- Protección de precios
  precio_viejo         NUMERIC,
  precio_nuevo         NUMERIC,
  fecha_baja_precio    DATE,
  inventario_al_momento NUMERIC,

  -- Bolsa
  monto_total_bolsa    NUMERIC,

  -- Cálculo al cerrar (híbrido: auto y override manual)
  piezas_vendidas_auto    NUMERIC,  -- calculado desde sellout_detalle al cerrar
  piezas_vendidas_manual  NUMERIC,  -- override manual opcional
  monto_calculado         NUMERIC,  -- resultado del cálculo automático
  monto_aprobado          NUMERIC,  -- lo que Fernando/Karo aprueba (puede ajustar)

  -- Resultado
  pago_id         UUID REFERENCES public.pagos(id) ON DELETE SET NULL,
  folio_nc        TEXT,             -- folio de la nota de crédito
  fecha_pago      DATE,

  notas           TEXT,
  creado_por      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  aprobado_por    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  fecha_aprobacion TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_fechas_validas CHECK (fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS idx_promo_cliente      ON public.promociones(cliente);
CREATE INDEX IF NOT EXISTS idx_promo_tipo         ON public.promociones(tipo);
CREATE INDEX IF NOT EXISTS idx_promo_estatus      ON public.promociones(estatus);
CREATE INDEX IF NOT EXISTS idx_promo_fecha_inicio ON public.promociones(fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_promo_fecha_fin    ON public.promociones(fecha_fin);
CREATE INDEX IF NOT EXISTS idx_promo_pago_id      ON public.promociones(pago_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_promociones_touch()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_promociones_touch ON public.promociones;
CREATE TRIGGER trg_promociones_touch
  BEFORE UPDATE ON public.promociones
  FOR EACH ROW EXECUTE FUNCTION public.tg_promociones_touch();

-- ─────────── RLS ───────────
ALTER TABLE public.promociones ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier usuario autenticado con rol válido
DROP POLICY IF EXISTS promociones_read ON public.promociones;
CREATE POLICY promociones_read ON public.promociones
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.user_id = auth.uid() AND p.activo = true
    )
  );

-- Escritura: super_admin, admin, o asistente con puede_editar=true
DROP POLICY IF EXISTS promociones_write ON public.promociones;
CREATE POLICY promociones_write ON public.promociones
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.user_id = auth.uid() AND p.activo = true
        AND (
          p.rol IN ('super_admin','admin')
          OR (p.rol = 'asistente' AND p.puede_editar = true)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.user_id = auth.uid() AND p.activo = true
        AND (
          p.rol IN ('super_admin','admin')
          OR (p.rol = 'asistente' AND p.puede_editar = true)
        )
    )
  );
