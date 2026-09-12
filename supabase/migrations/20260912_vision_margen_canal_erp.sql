-- 2026-09-12 · v_vision_margen_canal deja de leer la tabla vieja `ventas_erp`.
--
-- `ventas_erp` no se carga desde el 2026-07-06 (la sustituyó `erp_ventas`, cargada
-- por el puente SQL cada hora). Cualquier margen por canal que saliera de ahí estaba
-- congelado en julio. Ver docs/AUDITORIA_MEDIDAS.md §6.9.
--
-- Nueva fuente: `v_medidas_ventas_canal_mes` (→ `mv_erp_medidas_canal_mes` → `erp_ventas`),
-- que ya trae las medidas oficiales del director.
--
-- Mismas columnas de salida (nombre, orden y tipo) para no romper a nadie:
--   anio, mes, canal, admin_interna, venta, costo, margen_bruto, piezas
--
-- Equivalencias:
--   venta         = SUM(monto_venta_pesos) de todos los movimientos  →  [Venta Neta]
--                   (Fact Bruta + Devoluciones + RMA's + Bonificaciones)
--   costo         = SUM(costo_venta_pesos)                           →  [Costo Venta Neta]
--   margen_bruto  = venta − costo                                    →  [Utilidad Comercial]
--   piezas        = SUM(piezas)                                      →  [Piezas Venta Neta]
--   admin_interna = `erp_ventas` NO tiene esa columna (sí la tenía `ventas_erp`);
--                   se deja igual a `canal`, que es lo que devolvía el COALESCE
--                   original para el 100 % de las filas con canal.
--
-- Nadie en src/ ni en api/ consulta esta vista hoy (grep -rn v_vision_margen_canal),
-- y ninguna otra vista depende de ella: el cambio no toca pantallas.
--
-- Revertir = volver a ejecutar la definición vieja, al pie de este archivo.

create or replace view public.v_vision_margen_canal as
select m.anio,
       m.mes,
       m.canal,
       m.canal                                as admin_interna,
       round(m.venta_neta, 2)                 as venta,
       round(m.costo_venta_neta, 2)           as costo,
       round(m.utilidad_comercial, 2)         as margen_bruto,
       m.piezas_venta_neta::integer           as piezas
  from public.v_medidas_ventas_canal_mes m
 where m.canal is not null
   and m.canal <> 'x'
   and m.anio is not null
   and m.mes between 1 and 12;

comment on view public.v_vision_margen_canal is
  'Margen por canal y mes. Desde 2026-09-12 sale de v_medidas_ventas_canal_mes (erp_ventas), no de la tabla vieja ventas_erp. admin_interna = canal porque erp_ventas no trae esa dimensión.';

grant select on public.v_vision_margen_canal to authenticated, anon, service_role;

notify pgrst, 'reload schema';

-- ── Definición anterior (para revertir) ───────────────────────────────────
-- create or replace view public.v_vision_margen_canal as
--  SELECT anio, mes, canal,
--     COALESCE(admin_interna, canal) AS admin_interna,
--     round(sum(monto_venta_pesos), 2) AS venta,
--     round(sum(costo_venta_pesos) FILTER (WHERE costo_venta_pesos IS NOT NULL), 2) AS costo,
--     round(sum(monto_venta_pesos) FILTER (WHERE costo_venta_pesos IS NOT NULL)
--         - sum(costo_venta_pesos) FILTER (WHERE costo_venta_pesos IS NOT NULL), 2) AS margen_bruto,
--     sum(piezas)::integer AS piezas
--    FROM ventas_erp
--   WHERE canal IS NOT NULL AND canal <> 'x'::text AND anio IS NOT NULL AND mes >= 1 AND mes <= 12
--   GROUP BY anio, mes, canal, admin_interna;
