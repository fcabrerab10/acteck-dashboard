-- Fase 1+2 · Base de ventas del ERP (Vw_TablaH_Ventas) y medidas del director (2026-09-09).
-- erp_ventas: 1 fila por renglón de venta, SOLO las columnas que usan las
-- medidas. Reemplaza a ventas_erp (163K filas, columnas duplicadas, sin
-- cargar desde jul-2026). cliente_key sigue la misma regla que
-- facturacion_clientes (digitalife/pcel/dicotech o slug del canal) para
-- que las policies por cliente apliquen igual.

CREATE TABLE IF NOT EXISTS public.erp_ventas (
  venta_id            bigint  NOT NULL,
  venta_renglon       bigint  NOT NULL,
  articulo            text,
  descripcion         text,
  marca               text,
  familia             text,
  rama                text,
  grupo_linea         text,
  categoria           text,
  cliente             text,
  cliente_nombre      text,
  cliente_key         text,
  canal               text,
  subcanal            text,
  almacen             integer,
  vendedor            text,
  folio               text,
  referencia          text,
  lista_precios       text,
  periodo             date,
  anio                integer,
  mes                 integer,
  dia                 integer,
  unidades            numeric,
  piezas              numeric,
  monto_venta_pesos   numeric,
  costo_venta_pesos   numeric,
  precio_unidad_pesos numeric,
  costo_pieza_pesos   numeric,
  tipo_cambio         numeric,
  moneda              text,
  movimiento_venta    text,
  movimiento_venta_id text,
  instruccion         text,
  estatus_venta       text,
  uploaded_at         timestamptz DEFAULT now(),
  PRIMARY KEY (venta_id, venta_renglon)
);
CREATE INDEX IF NOT EXISTS erp_ventas_anio_mes_idx        ON public.erp_ventas(anio, mes);
CREATE INDEX IF NOT EXISTS erp_ventas_cliente_key_idx     ON public.erp_ventas(cliente_key);
CREATE INDEX IF NOT EXISTS erp_ventas_cliente_nombre_idx  ON public.erp_ventas(cliente_nombre);
CREATE INDEX IF NOT EXISTS erp_ventas_articulo_idx        ON public.erp_ventas(articulo);
CREATE INDEX IF NOT EXISTS erp_ventas_mov_idx             ON public.erp_ventas(movimiento_venta);

ALTER TABLE public.erp_ventas ENABLE ROW LEVEL SECURITY;
-- Mismo juego de policies que facturacion_clientes (paridad de visibilidad).
DROP POLICY IF EXISTS erp_ventas_all           ON public.erp_ventas;
DROP POLICY IF EXISTS erp_ventas_select_scoped ON public.erp_ventas;
DROP POLICY IF EXISTS erp_ventas_read          ON public.erp_ventas;
DROP POLICY IF EXISTS erp_ventas_write         ON public.erp_ventas;
CREATE POLICY erp_ventas_all           ON public.erp_ventas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY erp_ventas_select_scoped ON public.erp_ventas FOR SELECT TO authenticated USING (user_can_see_cliente(normalize_cliente(cliente_key)));
CREATE POLICY erp_ventas_read          ON public.erp_ventas FOR SELECT USING (puede_ver_cliente_pestana(cliente_key, 'sellIn') OR puede_ver_cliente_pestana(cliente_key, 'analisis'));
CREATE POLICY erp_ventas_write         ON public.erp_ventas FOR ALL USING (puede_editar_cliente_pestana(cliente_key, 'sellIn'));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_ventas TO authenticated, service_role;
GRANT SELECT ON public.erp_ventas TO anon;

-- ── Medidas del director traducidas literal de DAX a SQL ──────────────
-- Grano: anio, mes, cliente_key, cliente_nombre, canal, articulo, marca.
-- Todo son SUMAS (agregables a cualquier nivel). Los % (MC, MUC, Lost
-- Profit, alcance, ticket promedio) se calculan al agregar, nunca se suman.
--   Fact Bruta      = Σ monto  · MovimientoVenta ∈ {Factura, Factura Com.Ext33}
--   Devoluciones    = Σ monto  · Devolucion Venta ∧ Instruccion <> "Nota Credito"
--   RMA's           = Σ monto  · Devolucion Venta ∧ Instruccion  = "Nota Credito"
--   Bonificaciones  = Σ monto  · Bonificacion Venta
--   Fact Neta       = Fact Bruta + Devoluciones
--   Venta Neta      = Fact Neta + RMA's + Bonificaciones
--   Costo Fact Bruta= Σ costo  · MovimientoVenta = Factura   (sic: sin Com.Ext33)
--   Costo Dev/RMA   = Σ costo  con los mismos filtros que Devoluciones/RMA's
--   Costo Fact Neta = Costo Fact Bruta + Costo Devoluciones
--   Costo Venta Neta= Costo Fact Neta + Costo RMA's
--   Contribucion    = Fact Neta − Costo Fact Neta
--   Contribucion Br.= Fact Bruta − Costo Fact Bruta
--   Utilidad Comerc.= Venta Neta − Costo Venta Neta
--   Piezas Venta Neta = Σ Unidades (sin filtro, como el DAX)
-- DAX compara texto sin distinguir mayúsculas y BLANK() <> "Nota Credito"
-- es verdadero → ILIKE + COALESCE reproducen eso.
-- Nota 2026-09-09: COALESCE en monto/costo. Sin él, un grupo cuyo costo es NULL en todos
-- sus renglones daba contribucion NULL y quedaba fuera de la suma (ene-2026 sobreestimaba 9K).
CREATE OR REPLACE VIEW public.v_erp_medidas
WITH (security_invoker = true) AS
SELECT s.*,
  (fact_bruta + devoluciones)                                   AS fact_neta,
  (fact_bruta + devoluciones + rmas + bonificaciones)           AS venta_neta,
  (costo_fact_bruta + costo_devoluciones)                       AS costo_fact_neta,
  (costo_fact_bruta + costo_devoluciones + costo_rmas)          AS costo_venta_neta,
  (fact_bruta + devoluciones) - (costo_fact_bruta + costo_devoluciones)                        AS contribucion,
  (fact_bruta - costo_fact_bruta)                                                              AS contribucion_bruta,
  (fact_bruta + devoluciones + rmas + bonificaciones) - (costo_fact_bruta + costo_devoluciones + costo_rmas) AS utilidad_comercial,
  (devoluciones - costo_devoluciones)                           AS perdida_devoluciones,
  (rmas - costo_rmas)                                           AS perdida_rmas
FROM (
  SELECT anio, mes, cliente_key, cliente_nombre, canal, articulo, marca,
    SUM(CASE WHEN movimiento_venta IN ('Factura','Factura Com.Ext33') THEN COALESCE(monto_venta_pesos,0) ELSE 0 END)                                            AS fact_bruta,
    SUM(CASE WHEN movimiento_venta = 'Devolucion Venta' AND COALESCE(instruccion,'') NOT ILIKE 'nota credito' THEN COALESCE(monto_venta_pesos,0) ELSE 0 END)   AS devoluciones,
    SUM(CASE WHEN movimiento_venta = 'Devolucion Venta' AND instruccion ILIKE 'nota credito' THEN COALESCE(monto_venta_pesos,0) ELSE 0 END)                    AS rmas,
    SUM(CASE WHEN movimiento_venta = 'Bonificacion Venta' THEN COALESCE(monto_venta_pesos,0) ELSE 0 END)                                                        AS bonificaciones,
    SUM(CASE WHEN movimiento_venta = 'Factura' THEN COALESCE(costo_venta_pesos,0) ELSE 0 END)                                                                   AS costo_fact_bruta,
    SUM(CASE WHEN movimiento_venta = 'Devolucion Venta' AND COALESCE(instruccion,'') NOT ILIKE 'nota credito' THEN COALESCE(costo_venta_pesos,0) ELSE 0 END)   AS costo_devoluciones,
    SUM(CASE WHEN movimiento_venta = 'Devolucion Venta' AND instruccion ILIKE 'nota credito' THEN COALESCE(costo_venta_pesos,0) ELSE 0 END)                    AS costo_rmas,
    SUM(COALESCE(unidades, 0))                                                                                                                      AS piezas_venta_neta,
    SUM(CASE WHEN movimiento_venta IN ('Factura','Factura Com.Ext33') THEN COALESCE(unidades,0) ELSE 0 END)                                          AS piezas_fact_bruta,
    COUNT(*)::int                                                                                                                                   AS renglones
  FROM public.erp_ventas
  GROUP BY anio, mes, cliente_key, cliente_nombre, canal, articulo, marca
) s;

-- Serie mensual global con las medidas de tiempo del director:
--   CV Ultimos 3 Meses = Costo Venta Neta de (mes-1) + (mes-2) + (mes-3)
--   YTD Costo de Venta = acumulado del año hasta el mes
CREATE OR REPLACE VIEW public.v_erp_medidas_mes
WITH (security_invoker = true) AS
WITH m AS (
  SELECT anio, mes,
    SUM(fact_bruta) fact_bruta, SUM(devoluciones) devoluciones, SUM(rmas) rmas, SUM(bonificaciones) bonificaciones,
    SUM(fact_neta) fact_neta, SUM(venta_neta) venta_neta,
    SUM(costo_fact_bruta) costo_fact_bruta, SUM(costo_devoluciones) costo_devoluciones, SUM(costo_rmas) costo_rmas,
    SUM(costo_fact_neta) costo_fact_neta, SUM(costo_venta_neta) costo_venta_neta,
    SUM(contribucion) contribucion, SUM(contribucion_bruta) contribucion_bruta, SUM(utilidad_comercial) utilidad_comercial,
    SUM(piezas_venta_neta) piezas_venta_neta, SUM(renglones) renglones
  FROM public.v_erp_medidas GROUP BY anio, mes
)
SELECT m.*,
  SUM(costo_venta_neta) OVER (ORDER BY anio, mes ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING) AS cv_ultimos_3_meses,
  SUM(costo_venta_neta) OVER (PARTITION BY anio ORDER BY mes)                              AS ytd_costo_venta,
  CASE WHEN piezas_venta_neta <> 0 THEN venta_neta / piezas_venta_neta END                 AS ticket_promedio,
  CASE WHEN piezas_venta_neta <> 0 THEN utilidad_comercial / piezas_venta_neta END         AS utilidad_promedio,
  CASE WHEN fact_neta  <> 0 THEN contribucion / fact_neta END                              AS pct_mc,
  CASE WHEN fact_bruta <> 0 THEN contribucion_bruta / fact_bruta END                       AS pct_mc_bruta,
  CASE WHEN venta_neta <> 0 THEN utilidad_comercial / venta_neta END                       AS pct_muc,
  CASE WHEN fact_neta  <> 0 THEN bonificaciones / fact_neta END                            AS pct_lost_profit_bonif,
  CASE WHEN fact_bruta <> 0 THEN (devoluciones - costo_devoluciones) / fact_bruta END      AS pct_lost_profit_dev,
  CASE WHEN fact_neta  <> 0 THEN (rmas - costo_rmas) / fact_neta END                       AS pct_lost_profit_rma
FROM m;

GRANT SELECT ON public.v_erp_medidas, public.v_erp_medidas_mes TO authenticated, anon, service_role;
NOTIFY pgrst, 'reload schema';
