# Medidas del director (Power BI) — catálogo oficial y dónde vive cada una

**Fecha:** 2026-09-12 · **Alcance:** las 47 medidas de "Administrar medidas" del modelo del director, traducidas a nuestras tablas.

Este documento es la **fuente de verdad de las definiciones**. Si una pantalla muestra un número que no está aquí, está mal.

## 0. Dónde vive cada cosa

| Capa | Archivo | Qué contiene |
|---|---|---|
| Parámetros | `supabase/migrations/20260912_medidas_parametros.sql` → `parametros_medidas`, `almacenes_config.exclusivo`, `mv_articulo_rama` | TC 17/20, base 90 días, bandera de Rama desconocida |
| Ventas (SQL) | `20260912_medidas_ventas.sql` → `v_medidas_ventas_mes` · `_cliente_mes` · `_canal_mes` · `_sku` | todas las medidas de venta, costo, contribución, lost profit, cuota, alcance |
| Inventario (SQL) | `20260912_medidas_inventario.sql` → `v_medidas_inventario` (1 fila) · `_sku` · `_dia` · `_mes` · `v_medidas_compras` · `v_inventario_almacen_medida` | Inv Actual, Inv Total, Días de Inv, Costo Promedio, Vueltas |
| Cuota (SQL) | `20260912_medidas_cuota.sql` → `v_medidas_cuota_mes` · `_cliente_mes` | Cuota Venta / Mínima / Piezas / Costo / Contribución |
| Derivadas (JS) | `src/lib/medidas.js` (+ `scripts/test-medidas.mjs`, 11 tests) | los % SIEMPRE al agregar, etiquetas oficiales, tooltips, regla única de cuota |
| Hook | `src/lib/queries.js` → `useMedidasInventario()` | la fila única de inventario |

**Regla de oro:** las medidas base (sumas) se piden ya sumadas a Postgres. Los porcentajes **nunca** se suman ni se promedian: se recalculan al agregar con `derivadas()` de `src/lib/medidas.js`. Un promedio de porcentajes es siempre un bug.

Cada cifra visible lleva su nombre oficial en el `title=` vía `tooltip('clave')` → *"Medida: Dias de Inv · Inv Actual / CV Ultimos 3 Meses × 90"*.

---

## 1. Ventas — `erp_ventas` (= `Vw_TablaH_Ventas`)

| Medida | DAX del director | Nuestro SQL | Estado |
|---|---|---|---|
| **Fact Bruta** | `SUM(MontoVentaPesos)` · `MovimientoVenta ∈ {Factura, Factura Com.Ext33}` | `fact_bruta` | ✅ ya existía |
| **Devoluciones** | `SUM(MontoVentaPesos)` · `Devolucion Venta` ∧ `Instruccion <> "Nota Credito"` | `devoluciones` | ✅ |
| **RMA's** | idem con `Instruccion = "Nota Credito"` | `rmas` | ✅ |
| **Bonificaciones** | `SUM(MontoVentaPesos)` · `Bonificacion Venta` | `bonificaciones` | ✅ |
| **Fact Neta** | `[Fact Bruta] + [Devoluciones]` | `fact_neta` | ✅ |
| **Venta Neta** | `[Fact Neta] + [RMA's] + [Bonificaciones]` | `venta_neta` | ✅ |
| **Costo Fact Bruta** | `SUM(CostoVentaPesos)` · `MovimientoVenta = "Factura"` (sic: **sin** Com.Ext33) | `costo_fact_bruta` | ✅ |
| **Costo Devoluciones** | `SUM(CostoVentaPesos)` · Dev sin NC | `costo_devoluciones` | ✅ |
| **Costo RMA's** | `SUM(CostoVentaPesos)` · Dev con NC | `costo_rmas` | ✅ |
| **Costo Fact Neta** | `[Costo Fact Bruta] + [Costo Devoluciones]` | `costo_fact_neta` | ✅ |
| **Costo Venta Neta** | `[Costo Fact Neta] + [Costo RMA's]` | `costo_venta_neta` | ✅ |
| **Contribucion** | `[Fact Neta] − [Costo Fact Neta]` | `contribucion` | ✅ |
| **Contribucion Bruta** | `[Fact Bruta] − [Costo Fact Bruta]` | `contribucion_bruta` | ✅ |
| **Utilidad Comercial** | `[Venta Neta] − [Costo Venta Neta]` | `utilidad_comercial` | ✅ |
| **Piezas Venta Neta** | `SUM(Ventas[Unidades])` | `SUM(COALESCE(unidades, piezas, 0))` | ✅ (ver §6.4) |
| **Perdida x Devoluciones** | `[Devoluciones] − [Costo Devoluciones]` | `perdida_devoluciones` | 🆕 **añadida** |
| **Perdida x RMA's** | `[RMA's] − [Costo RMA's]` | `perdida_rmas` | 🆕 **añadida** |
| **% MC** | `[Contribucion] / [Fact Neta]` | `pct_mc` | ✅ |
| **% MC Bruta** | `DIVIDE([Contribucion Bruta],[Fact Bruta],0)` | `pct_mc_bruta` | 🆕 **añadida** a cliente/canal |
| **% MUC** | `DIVIDE([Utilidad Comercial],[Venta Neta],0)` | `pct_muc` | ✅ |
| **% Lost Profit Bonif** | `DIVIDE([Bonificaciones],[Fact Neta],0)` | `pct_lost_profit_bonif` | 🆕 a cliente/canal |
| **% Lost Profit Dev** | `DIVIDE([Perdida x Devoluciones],[Fact Bruta],0)` | `pct_lost_profit_dev` | 🆕 |
| **% Lost Profit RMA** | `DIVIDE([Perdida x RMA's],[Fact Neta],0)` | `pct_lost_profit_rma` | 🆕 |
| **Ticket Promedio** | `DIVIDE([Venta Neta],[Piezas Venta Neta],0)` | `ticket_promedio` | 🆕 a cliente/canal/SKU |
| **Utilidad Promedio** | `DIVIDE([Utilidad Comercial],[Piezas Venta Neta],0)` | `utilidad_promedio` | 🆕 |
| **CV Ultimos 3 Meses** | `[Costo Venta Neta]` de −1, −2, −3 (DATEADD) | ventana `ROWS 3 PRECEDING AND 1 PRECEDING` | ✅ global · 🆕 por cliente y canal |
| **YTD Costo de Venta** | `TOTALYTD([Costo Venta Neta])` | `SUM(...) OVER (PARTITION BY anio ORDER BY mes)` | ✅ global · 🆕 por cliente y canal |
| **Pendiente x Facturar** | `SUM(OrdenSurtidoOS[MontoVentaPesos])` | — | ❌ **no tenemos** `OrdenSurtidoOS`. Falta cargar esa vista del ERP por el puente. |
| **Sell Out** | `SUM(sellout[importe])` | `sellout_general.importe` | ⚠️ **difiere** (ver §6.5) |

`DIVIDE(x, y, 0)` de DAX devuelve el alternativo cuando el denominador es 0. Nuestro `divide()` de `medidas.js` devuelve **`null` por defecto** (para pintar `—` y no un 0 engañoso); el `0` del director se pide explícitamente con el tercer argumento.

---

## 2. Cuota — `cuotas_mensuales` / `cuotas_canales` (= tabla `BP`)

| Medida | DAX | Nuestro SQL | Estado |
|---|---|---|---|
| **Cuota Venta** | `SUM(BP[IMPORTEDEVENTA])` | `cuotas_mensuales.cuota_ideal` → `v_medidas_cuota_*.cuota_venta` | ✅ |
| **Cuota Minima** | `SUM(BP[CUOTAMINIMA])` | `cuotas_mensuales.cuota_min` | ✅ |
| **Cuota Piezas** | `SUM(BP[UNIDADES])` | `cuotas_mensuales.cuota_piezas` | ⚠️ **columna creada, vacía** |
| **Cuota Costo** | `SUM(BP[COSTODEVENTA])` | `cuotas_mensuales.cuota_costo` | ⚠️ **columna creada, vacía** |
| **Cuota Contribucion** | `[Cuota Venta] − [Cuota Costo]` | `cuota_contribucion` | ⚠️ NULL hasta que llegue Cuota Costo |
| **Cuota % Contribucion** | `DIVIDE([Cuota Contribucion],[Cuota Venta],0)` | `cuota_pct_contribucion` | ⚠️ idem |
| **% Alcance Venta** | `DIVIDE([Fact Neta],[Cuota Venta],0)` | `pct_alcance_venta` | 🆕 **añadida** |
| **% Alcance Piezas** | `DIVIDE([Piezas Venta Neta],[Cuota Piezas],0)` | `pct_alcance_piezas` | ⚠️ NULL sin Cuota Piezas |
| **+/- $ Venta** = **Diferencia Cuota** | `[Fact Neta] − [Cuota Venta]` | `diferencia_cuota` | 🆕 |
| **+/- Piezas** | `[Piezas Venta Neta] − [Cuota Piezas]` | `diferencia_piezas` | ⚠️ NULL |
| **Deficit Contribucion** | `[Contribucion] − [Cuota Contribucion]` | `deficit_contribucion` | ⚠️ NULL |

**Qué falta hacer (Mac mini):** el puente lee `RevkoBi.dbo.BP` y hoy sólo mapea `CUOTAMINIMA` e `IMPORTEDEVENTA` (`bridge/lib/mappers.mjs` → `cuotasDesdeBP`, `bridge/sync.mjs` → `CUOTAS_COLS`). Añadir `UNIDADES` y `COSTODEVENTA` a `CUOTAS_COLS` y al mapper para que se llenen `cuota_piezas` y `cuota_costo`. Mientras tanto salen `—` (nunca 0).

**Precedencia de la cuota global** (`cuotas_canales` fila `TOTAL` anual ÷ 12 → si no, Σ `cuotas_mensuales.cuota_ideal`): estaba reimplementada en 4 pantallas (Inicio, Visión General, Sell In, móvil Sell In). Ahora vive en `cuotas()` de `src/lib/medidas.js`. `cuotas_canales` **está vacía hoy**, así que todo cae a la suma de clientes.

### 2.1 Cuotas por cliente: mapa y dónde se ven (2026-09-12)

`cuotas_mensuales.cliente` trae **29 slugs con cuota 2026** (los pone el puente al leer `RevkoBi.dbo.BP`), no sólo los tres clientes propios. El mapa a cliente del ERP vive en la vista **`v_cuota_cliente_erp`** (`cuota_cliente`, `cliente_erp`, `cliente_nombre`, `cuenta_sellout`) y la cuota ya traducida en **`v_cuota_erp_mes`** (migración `supabase/migrations/20260912_cuotas_clientes_mapa.sql`).

La liga es siempre por **código** de cliente, nunca por nombre: "INGRAM MICRO MEXICO" son dos códigos (`00226` mayoreo = cuota `ingram`; `04126` retail representados = cuota `ingram_retail`) y hay dos clientes casi homónimos (`00514` TECHS MART DE MEXICO = cuota `techs_mart`; `00682` TECHSMART MAYOREO = cuota `techsmart`). El único slug que no coincide por nombre es **`unicom` → `00335` GRUPO UNIDADES DE COMPUTO** (cuenta de sell out `guc`).

Trece slugs no son una de las 17 cuentas de Sell Out y sólo salen en Análisis por Cliente: decme, svenska, stuffactory, amazon, mercado_libre, techsmart, arrangoiz, keops, mavi, tony_tiendas, dsw, dist._liverpool, zona_digital. La cuenta `directo` (mostrador + e-commerce) se queda **sin cuota a propósito**: agrupa varios clientes y mezclar sus cuotas daría un alcance falso. Quedan fuera 24 slugs históricos con cuota sólo en 2023-2025 (listados en la migración).

**% de alcance** = `[Fact Neta]` del cliente ÷ `[Cuota Venta]` del mismo periodo, con la regla de siempre: **los % no se suman**; el total se recalcula sobre los clientes que sí tienen cuota (`totalesDeFilas` en `sellout/calculo.js`, `alcanceCuota` en `analisis/calc.js`). Sin cuota cargada se pinta `—`, nunca 0 %. Semáforo: ≥ 100 % verde · ≥ 85 % azul · resto naranja.

**Dónde se ve:**

| Pantalla | Dónde |
|---|---|
| Sell Out consolidado (web) | Columna **Cuota** por cuenta (las semanas de inventario se fundieron en la celda de "Inv. cliente" para no pasarse de ancho) · stat del Hero "Cuentas en cuota" · caja **Cuota sell in** en el Resumen del drill · Excel y texto de "Compartir resumen del mes" |
| Análisis por Cliente (web) | Columna **Cuota** (del mes o del YTD según el modo; "Venta neta" se movió al drill) · stat del Hero "Clientes en cuota" · KpiCard del drill · Excel |
| Sell Out consolidado (celular) | `cuota 104 %` en el sub de cada cuenta · sub del Hero · Dato **Cuota sell in** en el Resumen de la cuenta · texto para compartir |
| Análisis por cliente (celular) | `cuota 104 %` en el sub de cada cliente (mes o YTD según el orden elegido) |

---

## 3. Inventario — `inventario_acteck`, `inventario_historico`, `compras_oc`

| Medida | DAX | Nuestro SQL | Estado |
|---|---|---|---|
| **Inv Actual** | `Σ CostoInventario` (≠0) · `Almacen[Exclusivo] <> "Inventario"` · `Articulo[Rama] = "PRODUCTO"` **+** `Σ CostoInventario` de `Almacen[Almacen] = "4…"` | `v_medidas_inventario.inv_actual` | 🆕 · ⚠️ **2º término pendiente** (ver §6.1) |
| **Costo Promedio** | `AVERAGE(Inventario[costopromedio])` con `CostoInventario <> 0` | `v_medidas_inventario_sku.costo_promedio` | 🆕 |
| **Costo de Compra TC 17 / TC 20** | `SUM(Compras[Costo Compra USD]) × 17` / `× 20` | `v_medidas_compras` (TC en `parametros_medidas`) | 🆕 · ⚠️ ver §6.2 |
| **Inv Total (Inv+OC)** | `[Costo de Compra TC 17] + [Inv Actual]` | `inv_total` | 🆕 |
| **Dias de Inv** | `DIVIDE([Inv Actual],[CV Ultimos 3 Meses],0) × 90` | `dias_inv` | 🆕 |
| **Dias de Inv Total** | `DIVIDE([Inv Total],[CV Ultimos 3 Meses],0) × 90` | `dias_inv_total` | 🆕 |
| **Inv Cierre de Mes** | `Σ HistAlmacenInv[CostoInventario]` del último día del mes | `v_medidas_inventario_mes.inv_cierre_mes` | 🆕 · ⚠️ historia desde 2026-09-10 |
| **Inv Cierre −1/−2/−3 Mes** | DATEADD sobre la anterior | se obtiene filtrando `v_medidas_inventario_mes` | 🆕 · ⚠️ sin historia |
| **Inv Promedio** | `Σ CalendarioInv[InvPromCost]` ≠ 0 | promedio diario de `v_medidas_inventario_dia` | 🆕 · ⚠️ con 1 día de historia = el valor de ese día |
| **Vueltas de Inv** | `DIVIDE([YTD Costo de Venta],[Inv Promedio],0)` | `vueltas_inv` | 🆕 · ⚠️ poco fiable hasta tener ≥ 1 año |

**Traducciones que tuvimos que inventar** (nuestras tablas no tienen las dimensiones del director):

- `Almacen[Exclusivo]` → columna nueva `almacenes_config.exclusivo`. Si está NULL se **deduce del nombre**: `almacen_nombre ILIKE 'VENTAS%'` ⇒ `'Ventas'`, el resto `'Inventario'`. Comprobado: esa deducción reproduce `almacenes_config.comercial = true` salvo el almacén 15 (STOCK ROTATION TEMPORAL, $11,708 — irrelevante). Los almacenes "NO COMERCIAL …", REPARACIONES, PRODUCCION, ROBO, REMISIONES, MUESTRAS y REFACTURACION quedan fuera, que es lo correcto.
- `Articulo[Rama]` → `catalogo_articulos` **no trae Rama**. Se reconstruye desde `erp_ventas.rama` (modo por artículo) en la MV `mv_articulo_rama` (1,456 artículos con rama; 1,216 son `PRODUCTO`). Los SKUs que nunca se han vendido no tienen rama: el parámetro `inv_rama_desconocida` (0 por default = estricto) decide si cuentan. Hoy quedan fuera **$6.24 M**.

---

## 4. Otras

| Medida | DAX | Nuestro | Estado |
|---|---|---|---|
| **Sell Out** | `SUM(sellout[importe])` | `sellout_general.importe` (agregados en `v_vision_sellout_*`) | ⚠️ ver §6.5 |
| **Pendiente x Facturar** | `SUM(OrdenSurtidoOS[MontoVentaPesos])` | — | ❌ falta la fuente |

---

## 4.1 Apoyo comercial y vendedor (2026-09-12)

Dos cosas que ya venían en `erp_ventas` (el puente las carga cada hora) y no se veían en ninguna pantalla.
Migración: `supabase/migrations/20260912_bonificaciones_concepto.sql`.

| Vista | Grano | Qué trae |
|---|---|---|
| **`v_bonificaciones_concepto_mes`** (MV `mv_bonificaciones_concepto_mes`) | anio, mes, cliente_key, **cliente (código)**, cliente_nombre, canal, **concepto_codigo**, concepto | `monto` (**negativo**, como en el ERP) y `renglones` |
| **`v_medidas_ventas_vendedor_mes`** (MV `mv_medidas_ventas_vendedor_mes`) | anio, mes, **vendedor** | Las MISMAS columnas y fórmulas que `v_medidas_ventas_cliente_mes` (Fact Bruta/Neta, Devoluciones, RMA's, Bonificaciones, Venta Neta, costos, Contribución, Utilidad Comercial, Piezas, CV 3 meses, YTD, % MC / MC Bruta / MUC / Lost Profit, ticket y utilidad promedio) **+ `clientes`** = `count(distinct cliente)`. Sin cuota: no hay cuota por vendedor. |
| **`v_ventas_vendedor_cliente_mes`** (MV `mv_ventas_vendedor_cliente_mes`) | anio, mes, vendedor, cliente_key, cliente, cliente_nombre | `fact_neta`, `piezas` — sólo para el drill del vendedor |

- **Apoyo comercial = `[Bonificaciones]`.** Los renglones con `rama = 'SERVICIOS'` son exactamente los de
  `movimiento_venta = 'Bonificacion Venta'` (verificado en 2026: 912 renglones, **−$34,445,391** en las dos
  definiciones), así que el desglose por concepto suma la medida del director sin residuo. `articulo` es el
  código del concepto (BPRM-101 promoción general de temporada, BVND-201 rebate/fondo de sell out,
  BVND-202 apoyo de marketing, BINC-901 protección de precios, BADM-401 pronto pago…). Las pantallas lo
  pintan **en positivo** con la etiqueta "apoyo"; el `%` que muestran es sobre la **Fact. Bruta** del mismo
  universo (el director usa Fact Neta en `[% Lost Profit Bonif]`: son dos cifras distintas, cada una con su
  etiqueta).
- **La suma por vendedor cuadra con el total:** `Σ fact_neta` de 2026 por vendedor = `v_medidas_ventas_mes`
  = **$393,588,783**. `vendedor` está lleno al 100 % (25 vendedores; 57 renglones sin vendedor de 176,955
  caen en `SIN VENDEDOR`).
- **Por qué las tres van materializadas:** el `count(distinct cliente)` del grano vendedor obliga a ordenar
  las 177 K filas (3.7–4.7 s) y, en las otras dos, una consulta con `LIMIT` hacía elegir al planner un plan
  de arranque rápido que se pasaba de los 3 s del rol `anon`. Materializadas son 424 / 2 K / 7 K filas y
  responden en ms. Se refrescan dentro de `refresh_facturacion_clientes()` (el `finalize` de cada carga de
  `erp_ventas`: puente y `api/import-central`), enganchadas con un `DO` idempotente para no reescribir esa
  función entera.
- **En JS:** cálculo puro en `src/modules/comercial/sellin/apoyo.js` (pruebas en
  `scripts/test-sellin-ssr.mjs`), hooks en `src/modules/comercial/sellin/datos.js`. Los % del panel del
  equipo se recalculan con `derivadas()` / `divide()` de `src/lib/medidas.js`: nunca se promedian.

---

## 5. Qué pantalla usa qué (después del 2026-09-12)

| Pantalla | Ventas | Inventario | Cuota | Cobertura/días |
|---|---|---|---|---|
| Inicio (web y móvil) | `v_erp_medidas_mes` / `_cliente_mes` / `_canal_mes` | **`v_medidas_inventario`** | `cuotas()` de medidas.js | **`dias_inv`** |
| Visión General (web y móvil) | `v_vision_factura_dimension_mes` (= Fact Neta, Contribucion) + `RentabilidadBloque` | **`v_medidas_inventario`** | `cuotas_canales`/`cuotas_mensuales` | **`dias_inv`** |
| Inventario global | — | **`v_inventario_almacen_medida`** (bandera `en_inv_actual`) + **`v_medidas_inventario`** en el hero | — | **`dias_inv`** en el hero; cobertura por SKU en piezas, etiquetada aparte |
| Sell In consolidado | `v_sellin_global_sku_canal_mes` (= Fact Neta) + `RentabilidadBloque` + **`v_bonificaciones_concepto_mes`** (apoyo) + **`v_medidas_ventas_vendedor_mes`** (equipo) | `v_inventario_comercial` sólo como bandera "tiene stock" | **`cuotas()`** | — |
| Análisis por cliente global | `v_analisis_cliente_mes` (medidas del director) | — | — | — |
| Estado de Resultados (puente) | `v_erp_medidas_mes` | — | — | — |
| S&OP | `facturacion_clientes` (piezas) | `v_inventario_comercial` (motor por SKU) + **`v_medidas_inventario`** en el hero | `cuotas_mensuales` | **las dos**, etiquetadas |
| Estrategia de Precios | — | **`v_medidas_inventario_sku.costo_promedio`** = [Costo Promedio] | — | — |
| Ficha de producto / Buscar (móvil) | `facturacion_clientes` | **`v_medidas_inventario_sku`** | — | cobertura por SKU en piezas, etiquetada |

---

## 6. Dudas para Fernando

### 6.1 — El 2º término de `[Inv Actual]` está cortado en la captura

```
Inv Actual = CALCULATE(SUM(Inventario[CostoInventario]), CostoInventario <> 0,
                       Almacen[Exclusivo] <> "Inventario", Articulo[Rama] = "PRODUCTO")
           + CALCULATE(SUM(Inventario[CostoInventario]), Almacen[Almacen] = "4…
```

Candidatos en nuestro ERP, con su valor de hoy:

| Almacén | Nombre | Valor |
|---|---|---:|
| 4 | NO COMERCIAL DIFERENCIAS DE INVENTARIO | $1,334,978 |
| 41 | NO COMERCIAL DESTRUCCION AUDITADO GDL | $13,082,109 |
| 42 | REPARACIONES GDL | $4,124,650 |
| 43 | NO COMERCIAL DESTRUCCION VIRTUAL OCT 2024 | $1,775 |
| 44 | VENTAS EMPAQUE DANADO GUADALAJARA | $3,421,142 (ya entra por ser "VENTAS …") |

**Hoy no sumamos ninguno** (`almacenes_config.inv_actual_extra = false` en todos). Para activarlo basta: `UPDATE almacenes_config SET inv_actual_extra = true WHERE no_almacen = <n>;` — no hay que tocar código.

### 6.2 — TC 17 vs TC 20

El director tiene las dos medidas. `[Inv Total (Inv+OC)]` usa **TC 17**; `[Costo de Compra TC 20]` se usa en otro lado. Los dos viven en `parametros_medidas` (`tc_compra_inv = 17`, `tc_compra = 20`) y son editables sin migración. **Pregunta:** ¿son tipos de cambio fijos de presupuesto o hay que mover el de 17 al TC real (hoy ~16.9–17.4 en `compras_oc.tipocambio`)?

### 6.3 — ¿Qué compras entran en `[Costo de Compra]`?

`compras_oc.costo_usd` es **unitario**. Usamos `costo_usd × cantidad_pendiente` de las OC con `estatus = 'PENDIENTE'` = **9,395,132 USD** ⇒ $159.7 M a TC 17. Eso hace `Inv Total` = $303 M y `Dias de Inv Total` = **298 días**, que suena alto. ¿El `Vw_TablaH_Compras` del director trae sólo lo pendiente, o el total ordenado del año?

### 6.4 — Piezas: 107,854 vs 107,726 en agosto

`[Piezas Venta Neta]` = `SUM(Unidades)` **sin filtro de movimiento**, así que incluye las unidades de las bonificaciones (128 pzs en agosto). `facturacion_clientes.piezas` y `v_vision_factura_dimension_mes.piezas` sí excluyen las bonificaciones. Diferencia del 0.1 %. ¿Se deja así (cada una con su etiqueta) o se unifica?

### 6.5 — Sell Out: `[Sell Out]` del director no es comparable con el nuestro

`sellout_general` mezcla bases (Dicotech ene–abr sin IVA, may–ago con IVA, sep en NULL; PCEL nunca manda pesos y cada pantalla lo valúa distinto). Ver `docs/AUDITORIA_CARGAS_CLIENTES.md`. **Antes de canonizar `[Sell Out]` hay que arreglar la carga**, no la medida.

### 6.6 — La regla Rama = PRODUCTO recorta mucho las piezas

Inventario global pasaba de 923,805 pzs a **709,653**: quedan fuera refacciones, empaque, spare parts, y sobre todo los **$6.24 M de SKUs sin historia de venta** (sin rama). ¿Confirmas que el inventario "comercial" del director es sólo `PRODUCTO`? Si prefieres que los SKUs sin rama cuenten: `UPDATE parametros_medidas SET valor_num = 1 WHERE clave = 'inv_rama_desconocida';` (sube a $149.6 M).
