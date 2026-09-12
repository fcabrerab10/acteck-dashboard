# Auditoría de cargas manuales de clientes — Digitalife · PCEL · Dicotech

**Fecha:** 2026-09-11 · **Alcance:** sólo lectura (no se modificó código ni datos).
**Objetivo:** verificar que lo que Fernando y Karolina cargan cada semana, y lo que el dashboard muestra en piezas, montos e inventario, sea correcto y verídico; y ver qué información de valor de Dicotech no se está aprovechando.

**Fuentes cotejadas en disco** (`~/Downloads`, las más recientes):

| Archivo | Fecha | Alimenta |
|---|---|---|
| `Reporte-SellOut_Ventas Semanal Acteck_Revko (17).csv` | 07-sep | `sellout_detalle` (dicotech) + `sellout_general` (DICOTECH) |
| `Reporte-Inventario_Inventario Acteck Semanal (16).csv` | 07-sep | `inventario_cliente` + `inventario_cliente_sucursal` (dicotech) |
| `venta-marca-ACTECK-2026-09-07-….xls` | 07-sep | `sellout_pcel`, `sellout_pcel_mensual`, `catalogo_sku_pcel` |
| `Acteck_BalamRush_Inventario (22).xlsx` | 08-sep | `inventario_cliente` (digitalife) |

No se encontró en disco el `Historico Sellout Digitalife.xlsx`: el cuadre de Digitalife se basa en consistencia interna.

---

## 1. Mapeo columna a columna (qué se carga y qué se descarta)

### 1.1 Digitalife — sell out (`src/lib/parsers/digitalife.js` → `sellout_detalle`)

Hoja `Sellout Digitalife`. Encabezados normalizados a snake_case (`objSnake`).

| Columna archivo | Campo BD | Nota |
|---|---|---|
| Fecha | `fecha` | define el mes (`EXTRACT(MONTH FROM fecha)`) |
| Marca | `marca` | |
| No Parte | `no_parte` | **SKU canónico**; sin mapeo `sku_cliente` |
| Descripción | `descripcion` | |
| Cantidad | `cantidad` | piezas |
| Precio | `precio` | |
| Descuento | `descuento` | se guarda pero **no se resta en ningún cálculo** |
| IVA | `iva` | |
| Subtotal | `subtotal` | |
| Total | `total` | **es el campo que el dashboard usa como monto → CON IVA** |

- Clave de upsert: `(cliente, fecha, no_parte, row_hash)`; `row_hash = hash(fecha|no_parte|cantidad|total)` — **determinista**, recargar el mismo archivo no duplica.
- Casilla "es histórico completo" → `deleteCliente: 'digitalife'` borra todo antes de insertar (replace limpio).
- `recalc: ['sellout_sku']` → `api/recalculate.js` reconstruye `sellout_sku` con `piezas = Σ cantidad`, **`monto_pesos = Σ total` (con IVA)**.

### 1.2 Digitalife — inventario (`digitalifeInv` → `inventario_cliente`)

Hoja `Hoja39`. Columnas reales del archivo del 08-sep: `Parte · Marca · Título · Stock · Stock Ensambles · Costo Convenio · Precio Venta · Fecha Ultima Venta · Días sin Venta · Ultima Entrada`.

| Archivo | BD | Estado |
|---|---|---|
| Parte → `sku`, Marca, Título, Stock, Costo Convenio, Precio Venta, Fecha Ultima Venta, Días sin Venta | ok | cargan bien |
| **(no existe columna "Valor")** | `valor` | **NULL en el 100 % de las filas** |
| **`Stock Ensambles`** | — | **se descarta** (322 pzs en el corte de semana 37) |
| `Ultima Entrada` | — | se descarta |

- `anio`/`semana` = **fecha del día en que se sube** (`semanaSnapshot()`), no del archivo.

### 1.3 Dicotech — sell out (`dicotechSelloutSemanal` → `sellout_detalle`)

CSV de Revko. **Las columnas del CSV cambiaron**: hoy trae
`Fecha · Usuario Cliente · Venta · Cantidad · Descripcion · Sucursal que genera venta · Cliente · Subfamilia · Vendedor · Marca · Distribuidor · costo_compra_antes_IVA · Moneda · precio_venta_antes_IVA · total_venta_antes_IVA · Numero de parte · Moneda_1 · Costo`

| Espera el parser | ¿Existe hoy? | Consecuencia |
|---|---|---|
| `Fecha`, `Cantidad`, `Marca`, `Descripcion`, `Numero de parte`, `precio_venta_antes_IVA`, `total_venta_antes_IVA` | Sí | ok |
| **`total_venta`** (con IVA) | **NO** | `total = NULL` → `iva = 0` → **`sellout_sku.monto_pesos = 0`** |
| **`Clave`** | **NO** | entra `undefined` en el `row_hash` y `sku_cliente = NULL` |
| **`Sucursal que despacha el inventario`** | **NO** | `almacen = NULL` |
| **`Familia`** | **NO** | `linea = NULL` |

- `row_hash = hash(Venta | Clave | cantidad | total_sin_IVA | **i**)` — **incluye el índice de fila `i`**. Es la causa de los duplicados (ver hallazgo #2).
- Campos del CSV que el parser manual **descarta por completo**: `Vendedor`, `Cliente`, `Sucursal que genera venta`, `Venta` (folio), `Subfamilia`, `Distribuidor`, `costo_compra_antes_IVA`, `Moneda`, `Usuario Cliente`.

### 1.4 Dicotech — inventario (`dicotechInventario`)

CSV con 8 almacenes (`DC · Arboledas · Amazon · Dicoags2 · Guadalajara · Zacatecas · leon2 · santafe`). `stock` = suma de los 8; `costo_convenio` = `costo_compra_antes_IVA`; `valor = stock × costo`; `fecha_ultima_venta` = `Fecha ultima factura`. No hay `precio_venta` ni `dias_sin_venta`. Desglose por sucursal → `inventario_cliente_sucursal`. **Cuadra al peso** con el archivo (ver §2.4).

### 1.5 Dicotech — el mismo CSV también va a `sellout_general` (`revkoSellout`)

Se sube por la fuente "Sellout Acteck (Revko)" del grupo Globales, con `mayorista = 'DICOTECH'`, `idcliente = 708`, `importe = total_venta_antes_IVA` (**sin IVA**), `id` = hash determinista de `(Venta|Numero de parte|Fecha|Cantidad)` — ese sí no duplica.

**Es decir: el mismo dato entra dos veces a la BD por dos rutas distintas, con bases de IVA distintas y hashes distintos.**

### 1.6 PCEL (`src/lib/parsers/pcel.js`)

Hoja `"Ventas por Fabricante "` (ojo: **el nombre real trae espacio final**, por lo que `primeraHoja()` no lo matchea y cae al fallback "primera hoja del libro"; funciona por suerte porque el libro tiene una sola hoja).

Columnas reales hoy: `Sku · Producto · Marca · Modelo · Familia · Subfamilia · Inventario · Costo Promedio · Antiguedad · Transito · Back Order · Vta Semana 36 · Vta Sep · Vta Ago · Vta Jul` — **sólo 3 columnas de mes**, por lo que `vta_mes_3` siempre queda NULL.

- `sellout_pcel` clave `(anio, semana, sku)`; `anio` = **año del día de la carga**, `semana` = la del encabezado `Vta Semana N`.
- `sellout_pcel_mensual` clave `(anio, mes, sku)` con `piezas` = la columna `Vta <Mes>` — **ésta es la cifra oficial de PCEL por mes** y se reescribe en cada carga (correcto).
- **No hay monto**: PCEL nunca manda pesos. Todo monto de PCEL en el dashboard es una valuación inventada por quien la calcula (costo promedio, costo de facturación o precio de lista, según la pantalla).

### 1.7 `api/import-central.js` — ¿puede duplicar?

Whitelist con unique key por tabla y `Prefer: resolution=merge-duplicates`. **El upsert nunca duplica si el `row_hash` es determinista.** El riesgo no está en el endpoint sino en el parser: `sellout_detalle` de Dicotech mete el índice de fila en el hash, así que la misma venta subida en dos CSV semanales distintos produce dos filas. Digitalife no tiene ese problema.

---

## 2. Consistencia interna en la BD

### 2.1 Sell-out por cliente y mes (2026) — `sellout_detalle` vs `sellout_sku`

`sellout_sku` = `Σ cantidad` y `Σ total` de `sellout_detalle`. Cuadra exacto en piezas y monto para ambos clientes en todos los meses. **El problema no es la agregación, es qué se agrega.**

**Digitalife** (monto = `total`, con IVA):

| Mes 2026 | Piezas | Subtotal | Descuento | IVA | **Total = monto del dashboard** |
|---|---:|---:|---:|---:|---:|
| 01 | 1,530 | 1,604,742 | 185,532 | 227,073 | **1,646,283** |
| 02 | 1,413 | 1,333,863 | 144,386 | 190,316 | **1,379,793** |
| 03 | 1,644 | 1,623,477 | 189,156 | 229,491 | **1,663,812** |
| 04 | 1,730 | 1,657,321 | 169,551 | 238,043 | **1,725,813** |
| 05 | 1,921 | 1,743,705 | 182,372 | 249,813 | **1,811,147** |
| 06 | 1,979 | 1,707,624 | 177,660 | 244,794 | **1,774,758** |
| 07 | 2,034 | 1,550,453 | 145,833 | 224,739 | **1,629,359** |
| 08 | 2,003 | 1,424,917 | 173,969 | 200,152 | **1,451,099** |
| 09 (parcial) | 532 | 290,423 | 28,344 | 41,933 | **304,012** |

> Nota: `total ≠ subtotal + iva` exactamente (hay ~5 % de diferencia); el archivo trae las tres columnas y el parser las copia tal cual, no las recalcula. El descuento se guarda pero no se aplica.

**Dicotech** — aquí la serie está rota en tres tramos:

| Mes 2026 | Piezas | Subtotal | IVA | Total | **monto del dashboard** | Base |
|---|---:|---:|---:|---:|---:|---|
| 01 | 5,960 | 1,987,003 | 0 | 1,987,003 | 1,987,003 | **sin IVA** |
| 02 | 4,086 | 1,269,509 | 0 | 1,269,509 | 1,269,509 | **sin IVA** |
| 03 | 3,788 | 1,032,098 | 0 | 1,032,098 | 1,032,098 | **sin IVA** |
| 04 | 2,881 | 759,091 | 0 | 759,091 | 759,091 | **sin IVA** |
| 05 | 2,273 | 593,804 | 113,106 | 706,910 | 706,910 | **con IVA** |
| 06 | 6,452 | 2,041,467 | 388,851 | 2,430,318 | 2,430,318 | **con IVA** |
| 07 | 4,078 | 1,151,487 | 219,331 | 1,370,818 | 1,370,818 | **con IVA** |
| 08 | 5,731 | 1,660,790 | 289,178 | 1,807,363 | 1,807,363 | mixto (267 filas sin total) |
| 09 | 1,157 | 228,753 | 0 | **NULL** | **0** | **roto** |

Ene–abr se cargaron el 26-may con un parser que ponía `total = total_sin_IVA`; may–ago con el parser actual (`total = total_venta`, con IVA); desde el CSV del 03-ago dejó de venir `total_venta` y a partir de ahí `total` queda NULL. **El salto de abril a mayo en la gráfica de Dicotech es artificial (+16 % de IVA), y septiembre muestra $0.**

### 2.2 Duplicados en `sellout_detalle`

**Digitalife: 0 duplicados.** (hash determinista)

**Dicotech: 3,046 filas duplicadas en 2026** (mismos `fecha + no_parte + cantidad + subtotal`, distinto `row_hash`):

| Mes | Grupos | Filas extra | Piezas infladas | Monto inflado (sin IVA) | % del mes |
|---|---:|---:|---:|---:|---:|
| 01 | 288 | 408 | 444 | 178,277 | 9.0 % |
| 02 | 148 | 175 | 197 | 72,784 | 5.7 % |
| 03 | 118 | 132 | 163 | 49,507 | 4.8 % |
| 04 | 93 | 107 | 115 | 33,680 | 4.4 % |
| 05 | 251 | 287 | 600 | 135,897 | 22.9 % |
| **06** | **1,318** | **1,548** | **3,007** | **951,213** | **46.6 %** |
| 07 | 140 | 168 | 193 | 62,241 | 5.4 % |
| 08 | 156 | 188 | 221 | 60,905 | 3.7 % |
| 09 | 29 | 33 | 39 | 11,113 | 4.9 % |

Junio 2026 está inflado casi al doble: 6,452 pzs cargadas contra 3,953 que reporta `sellout_general` para el mismo mes.

> Parte de los "duplicados" pueden ser ventas legítimas repetidas el mismo día (mismo SKU, misma cantidad, mismo precio, distinta factura). La cota conservadora es la comparación contra `sellout_general` (§2.3), que sí deduplica por folio de venta.

### 2.3 Dicotech: carga manual vs puente — la misma venta, dos cifras

| Mes 2026 | `sellout_detalle` pzs | `sellout_general` pzs | Δ pzs | `sellout_detalle` monto | `sellout_general` importe (sin IVA) | Δ $ | Δ % |
|---|---:|---:|---:|---:|---:|---:|---:|
| 01 | 5,960 | 5,960 | 0 | 1,987,003 | 1,987,003 | 0 | 0 % |
| 02–04 | = | = | 0 | = | = | 0 | 0 % |
| 05 | 2,273 | 3,493 | **−1,220** | 706,910 | 919,499 | −212,589 | **−23 %** |
| 06 | 6,452 | 3,953 | **+2,499** | 2,430,318 | 1,212,019 | +1,218,299 | **+101 %** |
| 07 | 4,078 | 4,954 | **−876** | 1,370,818 | 1,397,678 | −26,860 | −1.9 % |
| 08 | 5,731 | 6,830 | **−1,099** | 1,807,363 | 1,967,802 | −160,439 | −8.2 % |
| 09 | 1,157 | 1,332 | −175 | **0** | 284,851 | −284,851 | **−100 %** |

Ene–abr coinciden al 100 % (misma carga). De mayo en adelante divergen: mayo/julio/agosto **le faltan semanas a la carga manual**, junio **está duplicado**, septiembre **no tiene monto**.

### 2.4 Cotejo contra los archivos fuente

| Fuente | Archivo | BD | Veredicto |
|---|---|---|---|
| Dicotech inventario sem 37 | 180 SKUs · 7,901 pzs · $2,152,010 | 180 · 7,901 · $2,152,010 | ✅ **exacto** |
| Dicotech sucursales sem 37 | 7 sucursales con stock | suma por sucursal = 7,901 = agregado | ✅ **cuadra** |
| Digitalife inventario sem 37 | 1,307 SKUs · 16,348 pzs | 1,307 · 16,348 | ✅ piezas exactas |
| Digitalife valor inventario | archivo no trae "Valor"; a costo convenio = **$7,383,400**, a precio venta = $9,497,172 | `valor` = **NULL ×1,307** | ⚠️ se salva sólo porque las pantallas caen al fallback `stock × costo_convenio` |
| Digitalife `Stock Ensambles` | 322 pzs | no se carga | ⚠️ inventario invisible |
| Dicotech sell-out CSV 07-sep | 674 filas · sep 407 (1,157 pzs, $228,753 s/IVA) + ago 267 (467 pzs, $142,605) · **`total_venta` ausente en las 674** | sep: 407 filas, total NULL en 407; ago: 267 filas con total NULL | ✅ la carga reprodujo el archivo — el archivo es el que ya no trae el total con IVA |
| PCEL sem 36 | 982 SKUs · inv 8,160 · $8,563,102 · Vta Sem 855 · Sep 628 · Ago 3,682 · Jul 4,107 | idéntico en `sellout_pcel` y `sellout_pcel_mensual` | ✅ **exacto** |

**Conclusión del cuadre contra archivo: el importador carga fielmente lo que le dan.** Los problemas nacen (a) de que el CSV de Revko cambió de columnas sin que nadie ajustara el parser, (b) del `row_hash` con índice, y (c) de cómo se interpreta y se valúa el dato aguas abajo.

### 2.5 PCEL: semanas y la fórmula `(semana−1)/4+1`

Semanas cargadas en 2026: **1, 15–36**. Faltan las semanas 2–14 (ene–abr) por completo. No hay semanas duplicadas. `sellout_pcel_mensual` sí tiene ene–sep porque las columnas `Vta <Mes>` traen histórico.

`v_sellout_unificado` convierte semana → mes con `LEAST(12, GREATEST(1,(semana−1)/4+1))`. Al ser 4 semanas fijas por mes, la deriva acumulada es grave:

| Mes 2026 | Oficial (`Vta <Mes>`) | Fórmula `(sem−1)/4+1` | Error | Semana ISO real |
|---|---:|---:|---:|---:|
| 04 | 3,712 | 1,745 | **−53 %** | 3,406 |
| 05 | 3,029 | 3,012 | −0.6 % | 2,956 |
| 06 | 2,488 | 2,742 | +10 % | 2,267 |
| 07 | 4,107 | 2,283 | **−44 %** | 4,517 |
| 08 | 3,682 | 4,255 | **+16 %** | 3,260 |
| 09 (parcial) | 628 | 3,224 | **+413 %** | 855 |

La fórmula desplaza el calendario ~1 semana por trimestre. Todo lo que cuelga de `mv_sellout_unificado` (Visión General) lee PCEL con esa deriva.

### 2.6 Inventario: semanas faltantes y calidad de campos

Semanas 2026 en `inventario_cliente`:
- **digitalife:** 16–22, 24, 25, 26, 28–37 → **faltan 23 y 27** (y todo ene–abr).
- **dicotech:** 24, 25, 26, 28, 29, 30, 31, 33, 34, 35, 36, 37 → **faltan 27 y 32**.

Corte semana 37:

| | Digitalife | Dicotech |
|---|---|---|
| SKUs | 1,307 | 180 |
| Stock | 16,348 | 7,901 |
| Stock negativo / nulo | 0 / 0 | 0 / 0 |
| `valor` poblado | **0 / 1,307** | 179 / 180 |
| `costo_convenio` | 1,307 / 1,307 | 179 / 180 |
| `precio_venta` | 1,307 / 1,307 | **0 / 180** |
| `dias_sin_venta` | 894 / 1,307 | **0 / 180** |
| `fecha_ultima_venta` | 856 / 1,307 | 179 / 180 |
| SKUs con stock 0 | 939 (72 %) | 0 |

`valor` vs `stock × costo_convenio`: Dicotech cuadra en 179/180 filas. Digitalife no aplica (valor NULL).

### 2.7 SKUs huérfanos (no cruzan con `roadmap_sku`)

| Cliente | SKUs 2026 | Sin roadmap | Piezas huérfanas | Monto huérfano |
|---|---:|---:|---:|---:|
| dicotech | 326 | 21 (6.4 %) | 70 de 36,406 (0.2 %) | $193,116 |
| digitalife | 501 | 7 (1.4 %) | 10 de 14,786 (0.07 %) | $6,807 |

Sell-out: irrelevante. **Inventario sí:** de los 1,307 SKUs de Digitalife en semana 37, **468 (36 %) no existen en `roadmap_sku`** — aunque todos con stock 0, así que no distorsionan valor. Dicotech: 2 SKUs, 2 piezas.

---

## 3. Qué muestra cada pantalla — y por qué dos pantallas dan cifras distintas

| Cliente | Pantalla | Tabla/vista | Campo monto | Base |
|---|---|---|---|---|
| Digitalife | `SellOutClienteV2.jsx` | `v_sellout_digitalife_mensual` | `Σ sellout_detalle.total` | con IVA |
| Digitalife | Home V3, móvil | `v_sellout_detalle_sku_mes` | `Σ total` | con IVA |
| Digitalife | Resumen Clientes | `sellout_sku.monto_pesos` | `Σ total` | con IVA |
| **Digitalife** | | | | **✅ las 3 coinciden** |
| Dicotech | `SellOutDicotech.jsx` KPIs | `v_sellout_dicotech_mensual` | `Σ sellout_detalle.total` | **con IVA (y con duplicados)** |
| Dicotech | `SellOutDicotech.jsx` rankings (vendedor/cliente/sucursal) | `sellout_general` | `Σ importe` | **sin IVA** |
| Dicotech | Home V3 / Resumen / móvil | `sellout_sku.monto_pesos` | `Σ total` | con IVA |
| Dicotech | Visión General | `mv_sellout_unificado` | **ambas ramas sumadas** | **doble conteo** |
| PCEL | `SellOutPcel.jsx`, Home V3, móvil FichaCliente | `v_sellout_pcel_mensual` | piezas × `costo_promedio` | a costo |
| PCEL | Resumen Clientes | JS: piezas × (costo_promedio ‖ costo de facturación) | a costo, otro costo | |
| PCEL | móvil `SellOutCliente.jsx` | JS: piezas × **precio de lista** | a precio | |
| PCEL | `AnalisisCliente.jsx` | `sellout_pcel_mensual` | **`monto = 0` forzado** | ninguna |
| PCEL | Visión General | `mv_sellout_unificado` | `vta_semana` × precio, mes por `(sem−1)/4+1` | otra más |

### Cifra que daría cada pantalla — 2026-07 y 2026-08

**Digitalife**

| Pantalla | jul piezas | jul monto | ago piezas | ago monto |
|---|---:|---:|---:|---:|
| Sell Out V2 / Home / Resumen / móvil | 2,034 | $1,629,359 | 2,003 | $1,451,099 |
| Visión General (unificado) | 2,034 | $1,629,359 | 2,003 | $1,451,099 |

✅ Coherente. La única salvedad: es **venta con IVA**, y se compara contra sell-in que va **sin IVA**.

**Dicotech**

| Pantalla | jul piezas | jul monto | ago piezas | ago monto |
|---|---:|---:|---:|---:|
| Sell Out Dicotech — KPI superior | 4,078 | **$1,370,818** | 5,731 | **$1,807,363** |
| Sell Out Dicotech — suma de los rankings | 4,954 | **$1,397,678** | 6,830 | **$1,967,802** |
| Home V3 / Resumen / móvil | 4,078 | $1,370,818 | 5,731 | $1,807,363 |
| Visión General (`mv_sellout_unificado`) | **9,032** | **$2,768,496** | **12,094** | **$3,775,165** |
| “Facturas” del hero | **11** (son sucursales) | | **12** | |

❌ Tres cifras distintas para el mismo mes, y Visión General duplica.
Septiembre: Sell Out Dicotech mostraría **$0 con 1,157 piezas**.

**PCEL**

| Pantalla | jul piezas | jul monto | ago piezas | ago monto |
|---|---:|---:|---:|---:|
| Oficial del archivo (`Vta Jul/Ago`) | **4,107** | — | **3,682** | — |
| Sell Out PCEL / Home / móvil Ficha | 3,839 | $2,974,173 (a costo) | 3,453 | $2,694,030 (a costo) |
| Resumen Clientes | 3,839 | otro costo | 3,453 | otro costo |
| móvil Sell Out | 3,839 | a **precio de lista** | 3,453 | a precio de lista |
| Análisis de Cliente | 3,839 | **$0** | 3,453 | **$0** |
| Visión General (unificado) | **2,290** | $1,765,764 | **4,262** | $3,376,732 |

❌ Las piezas pierden 6.5 % por el `JOIN pcel_sku_map`, y Visión General muestra un mes completamente distinto.

---

## 4. Hallazgos ordenados por severidad

### 🔴 Crítico

**#1 · Dicotech se cuenta dos veces en Visión General.**
El mismo CSV de Revko alimenta `sellout_detalle` (rama `distribuidor`) **y** `sellout_general` (rama `mayoreo`), y `v_sellout_unificado` hace `UNION ALL` de ambas. Ago-2026: $1,807,363 + $1,967,802 = **$3,775,165** cuando la venta real es ~$1.97 M sin IVA. El sell-out total de la compañía está inflado ~$2 M/mes.
*Corrección:* excluir `cliente = 'dicotech'` de la rama `sellout_detalle` de `v_sellout_unificado` (o excluir `mayorista = 'DICOTECH'` de la rama `sellout_general`) y refrescar la MV. Decidir cuál es la fuente canónica — recomendable `sellout_general`, que es la del puente, no duplica y trae vendedor/cliente/sucursal.

**#2 · Dicotech septiembre muestra $0 (y agosto está subvalorado).**
El CSV de Revko dejó de traer la columna `total_venta`. `dicotech.js` hace `total = toNum(r['total_venta'])` → NULL, y `sellout_sku.monto_pesos = Σ total` → 0. 407 filas de sep y 267 de ago sin monto.
*Corrección:* `total = totalConIVA ?? totalSinIVA * 1.16` (o mejor: usar `subtotal` como monto canónico en todo el dashboard) e `iva = totalConIVA != null ? max(0, totalConIVA − totalSinIVA) : totalSinIVA * 0.16`. Recargar el histórico de Dicotech después.

**#3 · `row_hash` de Dicotech incluye el índice de fila → duplicados al recargar.**
`hash([Venta, Clave, cantidad, totalSinIVA, i])`. Cualquier CSV que se traslape con uno anterior (o que se recargue corregido) crea filas nuevas en lugar de sobrescribir. Resultado: **3,046 filas extra en 2026**, con junio inflado **+46 %** (6,452 pzs vs 3,953 reales). Además `Clave` ya no existe en el CSV, así que entra `undefined` fijo en el hash.
*Corrección:* quitar `i` y `Clave`; usar `hash(Venta|Numero de parte|Fecha|Cantidad|total_sin_IVA)` — el mismo criterio determinista que ya usa `revkoSellout` para `sellout_general`. Después, purgar y recargar el histórico de Dicotech (`deleteCliente`).

### 🟠 Alto

**#4 · La serie de Dicotech mezcla monto sin IVA (ene–abr) y con IVA (may–ago).**
El salto abril→mayo (+16 %) que se ve en la gráfica es contable, no comercial. Además, dentro de la *misma pantalla* `SellOutDicotech.jsx`, el KPI superior va con IVA y los rankings de vendedores/clientes van sin IVA: no suman.
*Corrección:* fijar una única base. Recomendado **sin IVA** (`subtotal`), que es como viene el sell-in y como viene `sellout_general`. Cambiar `recalcSelloutSku` a `Σ subtotal` y las vistas `v_sellout_*_mensual` a `Σ subtotal`.

**#5 · Digitalife se reporta con IVA y Dicotech/PCEL no → comparaciones entre clientes inválidas.**
`sellout_sku.monto_pesos = Σ total` (Digitalife: con IVA, ~14 % arriba del subtotal). Resumen de Clientes y Visión General comparan esa cifra contra PCEL a costo y contra sell-in sin IVA.
*Corrección:* misma que #4 — `Σ subtotal` como monto canónico de `sellout_detalle` para todos los clientes.

**#6 · PCEL: cinco valuaciones distintas para el mismo mes, y una de ellas es 0.**
`v_sellout_pcel_mensual` (piezas × costo promedio), Resumen (otro costo), móvil (precio de lista), `AnalisisCliente` (`monto = 0` forzado) y Visión General (vta_semana × precio de lista/mayoreo). PCEL nunca manda pesos, así que **cualquier monto de PCEL es una estimación**; hoy no está etiquetada como tal en ninguna pantalla salvo el móvil.
*Corrección:* una sola función de valuación de PCEL (`piezas × precio de lista PCEL`, con respaldo a costo promedio), usada por todas las pantallas, y una etiqueta visible "estimado a lista".

**#7 · `v_sellout_unificado` reparte PCEL por semanas con `(semana−1)/4+1`.**
Error de hasta −53 % (abril) y +413 % (septiembre parcial). El dato correcto ya existe en `sellout_pcel_mensual`.
*Corrección:* reemplazar la rama PCEL de `v_sellout_unificado` por `sellout_pcel_mensual` (o al menos usar la semana ISO real: `date_trunc('month', make_date(anio,1,1) + (semana−1)*7)`).

### 🟡 Medio

**#8 · `v_sellout_pcel_sku_mes` hace `INNER JOIN pcel_sku_map` y tira 3–8 % de las piezas en silencio.**
Jul-2026: 4,107 reales → 3,839 mostradas (−268). Ago: 3,682 → 3,453 (−229). ~85 SKUs sin mapa cada mes.
*Corrección:* `LEFT JOIN` conservando el SKU de PCEL, y un tablero en Administración con los SKUs sin mapear.

**#9 · `inventario_cliente.valor` de Digitalife está 100 % NULL.**
El archivo `Hoja39` no trae columna "Valor"; el parser la busca de todos modos. Las pantallas se salvan por el fallback `stock × costo_convenio` ($7,383,400 en la semana 37), pero `SellOutClienteV2.jsx` marca explícitamente "sin costeo" cuando no hay valor.
*Corrección:* que el parser calcule `valor = stock × costo_convenio` cuando la columna no venga.

**#10 · Semanas de inventario faltantes: Digitalife 23 y 27; Dicotech 27 y 32.**
`semanaSnapshot()` usa **la fecha de la carga**, no la del archivo: una subida en martes cae en la semana siguiente, y un archivo corregido subido tarde crea una semana nueva en vez de corregir la anterior.
*Corrección:* derivar la semana de `Fecha ultima entrada`/`Fecha ultima factura` del archivo, o permitir elegir la semana en el importador.

**#11 · `v_sellout_dicotech_mensual.facturas` no son facturas.**
Está definido como `count(DISTINCT sucursal)` → muestra 11–12 en vez de ~1,800. Y mezcla piezas/monto de `sellout_detalle` con clientes de `sellout_general`.
*Corrección:* `count(DISTINCT factura)`. (En `v_sellout_digitalife_mensual`, `facturas = count(DISTINCT fecha)` → 31 = días del mes; renombrar a `dias_con_venta`.)

**#12 · `SellOutPcel.jsx` pide inventario a tablas vacías.**
Consulta `inventario_cliente` e `inventario_cliente_sucursal` con `cliente='pcel'`: **0 filas** en ambas. Ningún parser de PCEL las alimenta (el inventario de PCEL vive en `sellout_pcel.inventario`).
*Corrección:* que la pantalla lea `sellout_pcel` como ya hacen Home V3, Resumen y el móvil.

**#13 · `inventario_cliente_sucursal` sólo existe para Dicotech.**
0 filas para Digitalife y PCEL, pero `SellOutClienteV2.jsx` y `SellOutPcel.jsx` la consultan igual: el panel de sucursales sale vacío.

### 🔵 Bajo

**#14 · Digitalife: `descuento` se guarda y nunca se usa** (~$1.5 M/año). Ni se resta del monto ni se muestra como KPI de rentabilidad del canal.

**#15 · Digitalife: `Stock Ensambles` (322 pzs) y `Ultima Entrada` se descartan** del archivo de inventario.

**#16 · La hoja de PCEL se llama `"Ventas por Fabricante "` con espacio final** y `primeraHoja()` no la matchea; funciona sólo porque el libro tiene una hoja. Si PCEL agrega una segunda hoja, la carga se rompe en silencio.

**#17 · PCEL sólo trae 3 columnas de mes** → `vta_mes_3` siempre NULL; y `sellout_pcel.anio` se toma del día de la carga, así que una carga de la semana 1 de enero etiquetaría mal la semana 52 del año anterior.

**#18 · 468 de 1,307 SKUs del inventario de Digitalife no existen en `roadmap_sku`** (todos con stock 0, sin impacto en valor, pero ensucian los cruces).

**#19 · `sku_cliente`, `almacen`, `linea` y `estado` de `sellout_general` DICOTECH están vacíos o degradándose** (ago: `linea` 0/3,125; sep: `sku_cliente` 0/522) por las columnas que desapareció el CSV.

---

## 5. Dicotech: información de valor que no se aprovecha

**Lo que llega hoy** (`sellout_general`, mayorista DICOTECH, ~3,000 filas/mes): `cliente_nombre` (~900 clientes finales distintos/mes), `vendedor_nombre` (~30), `sucursal` (~9) y `almacen`, `factura` (~1,800/mes), `precio_unitario`, `moneda`, `linea`/`Subfamilia`, `marca`. La carga manual a `sellout_detalle` **tira vendedor, cliente final, sucursal y folio de venta**: se queda sólo con fecha, SKU, cantidad y precio. `estado` está 100 % vacío.

**Ya se muestra:** sucursales y vendedores en `SellOutDicotech.jsx` (rankings y drill) y `v_sellout_dicotech_sucursal_mes` / `v_sellout_general_vendedor_mes`.

**Sin explotar:** los ~900 clientes finales (quién compra qué, altas y bajas de cuenta, concentración), el folio de `factura` (ticket promedio real, frecuencia de recompra), `precio_unitario` por cliente/sucursal (dispersión de precio y erosión vs lista) y el cruce cliente-final × SKU.

**Propuesta (6 líneas):**
1. Dejar `sellout_general` como fuente única de Dicotech y quitar la carga manual a `sellout_detalle` (resuelve #1, #2, #3 y #4 de un golpe).
2. Panel "Clientes finales de Dicotech": top 20 por mes, altas/bajas contra el mes previo y % de concentración en el top 10.
3. Cohortes de recompra por cliente final (meses activos, ticket promedio por `factura`, días desde la última compra) → alimenta las alertas de cuentas dormidas.
4. Matriz vendedor × marca/familia con mix y precio promedio, para detectar quién no empuja Balam Rush.
5. Dispersión de `precio_unitario` por SKU y sucursal contra la lista, como KPI de erosión de precio.
6. Heatmap cliente-final × SKU para el sugerido de resurtido y para el Master de cobertura por plaza.

---

## 6. Orden de corrección sugerido

1. `sellout_detalle` Dicotech: quitar `i` y `Clave` del `row_hash`, arreglar `total`, purgar y recargar el histórico. *(o eliminar la ruta manual — ver §5.1)*
2. Desduplicar Dicotech en `v_sellout_unificado` y refrescar `mv_sellout_unificado`.
3. Unificar la base de monto a **sin IVA** (`Σ subtotal`) en `recalcSelloutSku` y en las vistas `v_sellout_*_mensual`.
4. Rama PCEL de `v_sellout_unificado` → `sellout_pcel_mensual`; `v_sellout_pcel_sku_mes` → `LEFT JOIN`.
5. Una sola valuación de PCEL, etiquetada como estimada, en las 5 pantallas.
6. `valor` calculado en `digitalifeInv`; semana del archivo y no del día de carga.
7. `facturas` real en `v_sellout_dicotech_mensual`; `SellOutPcel.jsx` al inventario correcto.

---

## ✅ Aplicado el 2026-09-12 (sesión `sweet-kare-624569`)

Ya no es sólo diagnóstico. Lo corregido, con respaldos y cómo revertir, está en
**`docs/CORRECCION_CLIENTES_20260912.md`**. Resumen:

| Hallazgo | Estado |
|---|---|
| #1 Dicotech doble en Visión General | ✅ `v_sellout_unificado` excluye `mayorista='DICOTECH'` de la rama mayoreo |
| #2 Dicotech septiembre en $0 | ✅ monto canónico = `subtotal − descuento`; parser lee `total_venta_antes_IVA` |
| #3 `row_hash` con índice de fila | ✅ hash determinista `REVKO\|folio\|sku\|fecha\|cantidad\|precio` + recarga completa de may–sep |
| #4 Dicotech mezcla con/sin IVA | ✅ toda la serie sin IVA |
| #5 Digitalife con IVA | ✅ `sellout_sku`, vistas y pantallas usan `subtotal − descuento` |
| #6 PCEL con cinco valuaciones | ✅ una sola: `v_precio_pcel_sku` (PCEL PROVISIONAL → Mayoreo AAA) |
| #7 PCEL con `(semana−1)/4+1` | ✅ mes ISO (jueves de la semana) |
| #8 `v_sellout_pcel_sku_mes` INNER JOIN | ✅ LEFT JOIN + aviso de SKUs sin mapear en pantalla |
| #9 `valor` NULL en Digitalife | ✅ el parser calcula `stock × costo_convenio` |
| #10 Semana del día de carga | ✅ `semanaDeCorte()` + columna "Corte" y confirmación en el importador |
| #11 `facturas` = sucursales | ✅ `count(distinct factura)` desde `v_sellout_general_dicotech` |
| #12, #13, #14, #15, #16, #17, #18 | ⏳ pendientes |

**Hallazgo nuevo (no estaba en la auditoría):**
- `sellout_general` de DICOTECH mezcla dos orígenes (puente SQL con `id > 0` y carga
  manual del CSV con `id < 0`) y en may–ago 2026 la misma venta está en los dos: el
  $1.97 M de agosto de esta auditoría también venía inflado. La cifra real de agosto es
  **$1.62 M**. `v_sellout_general_dicotech` deduplica por mes.
- El parser de Dicotech leía las fechas con `raw:false` y SheetJS las reformateaba en hora
  local: **todas las ventas quedaban un día antes**. Corregido con `raw:true`.
