# Histórico por cliente — qué hay, qué falta y de dónde sale

**Fecha:** 2026-09-11 · **Alcance:** sólo lectura (no se modificó código ni datos).
**Pregunta de Fernando:** *"Revisa el histórico: de Digitalife por ejemplo sí debemos tener más información; revisa también PCEL y Dicotech."*

**Respuesta corta:** no se borró historia. El sell-out y el sell-in sí tienen profundidad (Digitalife desde sep-2024, Dicotech y sell-in desde ene-2025, cuotas desde 2023). Lo que se ve "corto" son las **fotos semanales** — inventario del cliente y estado de cuenta — que sólo existen desde que el dashboard empezó a tomarlas (14-abr-2026) y el **sell-out de PCEL**, que nunca tuvo 2025 porque el archivo de PCEL trae una ventana móvil de 3 meses.

---

## 1. Cobertura por tabla y cliente

### 1.1 Sell out — `sellout_detalle` / `sellout_sku`

| Cliente | Primer dato | Último | Meses | Filas | Huecos de **mes** | Huecos de **semana** |
|---|---|---|---:|---:|---|---|
| digitalife | 2024-09-30 | 2026-09-06 | 25 | 25,826 | **ninguno** | **ninguno** (2025 y 2026 completas) |
| dicotech | 2025-01-01 | 2026-09-05 | 21 | 44,463 | ninguno | **2026 semanas 19 y 20** (la 18 llega parcial: 75 filas) |
| pcel | — | — | — | 0 | *no usa esta tabla* | — |

`sellout_sku` es el agregado exacto de `sellout_detalle` (mismos meses, mismas piezas). Cero filas de PCEL.

### 1.2 Sell out — PCEL (`sellout_pcel` semanal · `sellout_pcel_mensual`)

| Tabla | Cobertura | Huecos |
|---|---|---|
| `sellout_pcel` | **sólo 2026**, semanas 15–36 (+ una fila espuria en semana 1) | semanas 2–14 de 2026 y **todo 2025** |
| `sellout_pcel_mensual` | **2026-02 → 2026-09** | **2025 completo y enero-2026** |

`catalogo_sku_pcel`: 987 SKUs (sin dimensión temporal).

### 1.3 Sell out — `sellout_general` (mayorista DICOTECH, puente SQL)

**2025-01 → 2026-09, 21 meses, 45,016 filas, sin un solo mes hueco.** Es la serie más completa y confiable de Dicotech (viene del servidor `192.168.0.160` vía `bridge/`, dedup por folio). Sus cifras de mayo/julio/agosto/septiembre 2026 son **mayores** que las de la carga manual (`sellout_detalle`), justo por las semanas 19-20 que faltan.

### 1.4 Inventario del cliente — `inventario_cliente`

Todo es **2026**; no hay un solo corte de 2025.

| Cliente | Semanas presentes | Primer corte | Huecos |
|---|---|---|---|
| digitalife | 16–22, 24, 25, 26, 28–37 (20 cortes) | 2026-04-16 | **23 y 27** |
| dicotech | 24, 25, 26, 28, 29, 30, 31, 33, 34, 35, 36, 37 (12 cortes) | 2026-06-08 | **27 y 32** |
| pcel | — | — | **0 filas** (su inventario vive en `sellout_pcel.inventario`) |

> Hay además 3 filas basura en la tabla (`cliente = '__test__'`, un `<!DOCTYPE html>` completo como cliente, y un bloque `digitalife` con `anio`/`semana` NULL de 1,424 filas del 2026-04-16). Son restos de pruebas; no afectan a las pantallas porque filtran por `anio`/`semana`.

### 1.5 `inventario_cliente_sucursal`

Sólo **dicotech**, semanas 28–31 y 33–37 de 2026 (7 sucursales). Huecos: **32**, y **24, 25, 26** (esos cortes sí están en `inventario_cliente` pero sin desglose). Digitalife y PCEL: 0 filas.

### 1.6 Estados de cuenta — `estados_cuenta` + `estados_cuenta_detalle`

Todo es **2026 desde la semana 16**. Nada de 2025.

| Cliente | Semanas presentes | Cortes | Huecos |
|---|---|---:|---|
| digitalife | 16–23, 25, 27, 29–37 | 19 | **24, 26, 28** |
| pcel | 16, 18–23, 25, 27, 29–37 | 18 | **17, 24, 26, 28** · la semana 27 está **sin detalle (0 facturas)** |
| dicotech | 22, 24, 25, 27, 29–37 | 13 | **23, 26, 28** (y nada antes de la 22) |

El detalle por factura sí acompaña a cada corte (digitalife 123–226 filas, pcel 45–165, dicotech 5–25), salvo pcel semana 27.

### 1.7 Marketing y pagos (capturados en la app, no importados)

| Tabla | digitalife | pcel | dicotech |
|---|---|---|---|
| `marketing_actividades` | 2026-01 → 2026-09 · 128 registros | 0 | **sólo 2026-09** · 7 registros |
| `inversion_marketing` | **tabla vacía** | vacía | vacía |
| `pagos` | 37 (6 meses con `mes_sellout`, resto sin periodo) | 6 | 15 |

Aquí no hay "historia perdida": son tablas que se llenan a mano y empezaron en 2026.

### 1.8 Sell in y cuotas (referencia — sí tienen profundidad)

| Tabla | digitalife | pcel | dicotech |
|---|---|---|---|
| `facturacion_clientes` | 2025-01 → 2026-09 (21 meses) | idem | idem |
| `erp_ventas` | 2025 (112,779 filas) + 2026 (64,176) | — | — |
| `cuotas_mensuales` | 2023 → 2026 (48 meses) | idem | idem |

> Único faltante relevante de sell-in: **`erp_ventas` sólo tiene 2025 y 2026**. El ERP tiene más años (las cuotas llegan a 2023); si se quiere 2023-2024 hay que pedirle al puente una corrida con esos años.

---

## 2. ¿Alguna carga borró historia?

**No.** Revisado en `api/import-central.js`, `src/lib/parsers/` y `src/modules/settings/importador/`:

| Tabla | Unique key | Estrategia | ¿Puede borrar periodos anteriores? |
|---|---|---|---|
| `sellout_detalle` | `cliente,fecha,no_parte,row_hash` | upsert; `deleteCliente` **sólo** si se marca "es histórico completo" en Digitalife | Sí, pero sólo esa casilla y sólo para digitalife — y el archivo que se sube con ella (`Historico Sellout Digitalife.xlsx`) trae la historia completa |
| `inventario_cliente` | `cliente,sku,anio,semana` | upsert puro | **No** |
| `inventario_cliente_sucursal` | `cliente,sku,sucursal,anio,semana` | upsert puro | **No** |
| `estados_cuenta` / `_detalle` | `cliente,anio,semana` / `id` | upsert puro | **No** |
| `sellout_pcel` | `anio,semana,sku` | upsert puro | **No** |
| `sellout_pcel_mensual` | `anio,mes,sku` | upsert puro (reescribe el mes que trae) | No borra meses ajenos |
| `sellout_general` | `id` (hash determinista) | upsert puro | **No** |
| `roadmap_sku` | `sku` | `replace: true` (`deleteAll`) | Sí, pero es un catálogo sin dimensión temporal |
| `erp_ventas`, `cuotas_mensuales` | — | `deleteAnios` (replace por año) | Sí, pero reponen el año completo en la misma corrida |

Evidencia adicional:
- **`auditoria_cambios`** (13,688 filas, desde el 2026-09-09): el único DELETE masivo es `cuotas_mensuales` (5,690 filas, replace por año del puente, repuesto con 6,596 INSERT). Ningún DELETE sobre `sellout_detalle`, `inventario_cliente`, `estados_cuenta` ni `sellout_pcel`.
- **`sync_events`** sólo arranca el **2026-08-04** (`sellout-general` incluso el 2026-09-10), así que no existe bitácora de las cargas previas; la cronología anterior se infiere de `updated_at` de las propias tablas, que coincide semana a semana con los archivos en disco.
- **`sync_status`** se sembró el **2026-04-14** con `registros = 0` para `sellout_digitalife`, `sellout_pcel`, `inventario_digitalife`, `edc_digitalife`, `edc_pcel` y `transito`: ésa es la fecha de nacimiento del pipeline.

**Conclusión:** la historia que falta **nunca estuvo** en la base. Inventario y estado de cuenta son **fotos del día**; sólo existen desde que alguien las empezó a tomar (abr-2026 para Digitalife y PCEL, jun-2026 para Dicotech). No se puede reconstruir hacia atrás salvo con archivos guardados.

**Por qué se pierden semanas sueltas:** `semanaSnapshot()` (`src/lib/parsers/_util.js`) calcula `anio`/`semana` con **la fecha del día en que se sube el archivo**, no con la del corte. Si nadie sube esa semana, el hueco queda; y si se sube tarde, crea una semana nueva en vez de llenar la que falta. (Es el hallazgo #10 de `docs/AUDITORIA_CARGAS_CLIENTES.md`.) El parser de estados de cuenta **sí** lee la fecha de corte del pie del archivo (`isoWeek`), así que ahí sí se puede cargar histórico y cae en la semana correcta.

---

## 3. Tablas viejas / respaldos en la BD

Revisadas las 200 tablas de `public`. No hay ningún respaldo con historia de estos clientes:

| Tabla | Filas | Contenido | ¿Sirve? |
|---|---:|---|---|
| `ventas_mensuales` | 50 | sell-in mensual 2025-01→2026-05 de digitalife/pcel/mercadolibre · **`sell_out` = 0 en todas las filas** | No |
| `sell_in_sku_legacy` | 6,652 | sell-in por SKU 2025-01→2026-05, superado por `facturacion_clientes` | No |
| `ventas_erp` | 162,591 | tabla vieja de ventas ERP (sell-in), sin cargar desde jul-2026 | No (sigue en uso por Estrategia de Producto PCEL) |
| `inventario_historico` | 9,951 | inventario **de Acteck**, un solo día: 2026-09-10 | No |
| `precios_historico` | 6,457 | precios, no ventas | No |
| `productos_cliente` | 3,280 | catálogo por cliente (abr-2026), sin dimensión temporal | No |
| `dashboard_data` | 10 | blobs JSON de gastos/compras de la app vieja | No |
| `embarques_compras_backup_20260825` | 382 | respaldo de embarques | No |
| `reporte_skus`, `productos`, `_temp_code`, `inventario_en_camino`, `forecast_snapshots` | 818 / 243 / 0 / 0 / 0 | — | No |

---

## 4. Archivos en disco y qué hueco llena cada uno

### 4.1 Se pueden cargar hoy y llenan un hueco real

| # | Archivo | Fecha | Llena |
|---|---|---|---|
| 1 | `~/Downloads/Clientes/PCEL/Antigüedad de Saldos - Cuentas por Cobrar-PCEL.xlsx` (pie **03/dic/2025**) | 11-dic-2025 | **EdC PCEL 2025 semana 49** — hoy no hay ni un corte de 2025 |
| 2 | `~/Downloads/Personal/Antigüedad de Saldos - Cuentas por Cobrar-PC ONLINE.xlsx` (pie **27/ene/2026**) | 28-ene-2026 | **EdC PCEL 2026 semana 5** |
| 3 | `~/Downloads/Antigüedad de Saldos - Cuentas por Cobrar-PC ONLINE.xlsx` (pie **21/abr/2026**) | 29-abr-2026 | **EdC PCEL 2026 semana 17** (hueco confirmado) |
| 4 | `~/Downloads/Antigüedad de Saldos - Cuentas por Cobrar-PC ONLINE-01-07.xlsx` (pie **30/jun/2026**) | 05-jul-2026 | **EdC PCEL semana 27** — hoy el corte existe pero **con 0 facturas de detalle** |
| 5 | `~/Downloads/Antigüedad de Saldos - Cuentas por Cobrar- DICOTECH.xlsx` (pie **04/jun/2026**) | 08-jun-2026 | **EdC Dicotech 2026 semana 23** (hoy empieza en la 22 y salta a la 24) |
| 6 | `~/Downloads/Clientes/PCEL/Antigüedad de Saldos - Cuentas por Cobrar PCEL.xlsx` | 08-jul-2025 | **EdC PCEL ~2025 semana 28** — ⚠️ este archivo **no trae fecha al pie**; el parser caería a la última `fecha_emision`. Verificar la semana resultante antes de subirlo |

Estos 6 entran por el importador tal cual (fuentes `ec-pcel` / `ec-dicotech`): el parser de "Antigüedad de Saldos" toma la fecha del pie y calcula la semana ISO, así que aterrizan en el periodo correcto.

### 4.2 Existen, pero el importador los etiquetaría mal (requieren elegir la semana)

| # | Archivo | Fecha | Llenaría |
|---|---|---|---|
| 7 | `~/Downloads/Reporte-Inventario_Inventario Acteck Semanal (11).csv` | 03-ago-2026 | **Inventario Dicotech semana 32** |
| 8 | `~/Downloads/Reporte-Inventario_Inventario Acteck Semanal.csv` | 01-jun-2026 | **Inventario Dicotech semana 23** (extendería la serie una semana hacia atrás) |
| 9 | `~/Downloads/Acteck_BalamRush_Inventario (1).xlsx` | 10-abr-2026 | **Inventario Digitalife semana 15** (extendería la serie una semana hacia atrás) |

⚠️ **Bloqueo:** `semanaSnapshot()` usa la fecha de HOY, así que subirlos ahora los guardaría como **semana 37/2026** y pisaría el corte vigente. Para cargarlos hay que (a) arreglar el parser para leer la semana del archivo / permitir elegirla en el importador — hallazgo #10 de la auditoría previa — o (b) insertarlos por SQL con el `anio`/`semana` correcto.

### 4.3 Huecos sin archivo — hay que pedirlos

| Hueco | Situación |
|---|---|
| **Inventario semana 27/2026 (Digitalife y Dicotech)** | No existe ningún archivo entre el 22-jun y el 05-jul que caiga en la semana 27. Nadie descargó el corte. **Pedirlo a los clientes o aceptar el hueco.** |
| **Inventario Digitalife semana 23/2026** | Tampoco hay archivo (se pasa del 26-may al 08-jun). **Pedirlo a Digitalife.** |
| **EdC Digitalife (API GLOBAL) histórico** | En disco sólo queda un archivo de bloqueo `~/Downloads/Pedidos/~$Antigüedad de Saldos - Cuentas por Cobrar-API GLOBAL.xlsx`; el original ya no está. **Pedir a crédito y cobranza los cortes de 2025 y ene-abr 2026.** |
| **EdC huecos 24, 26 y 28 de 2026 (los tres clientes)** | Sin archivo. Pedir a crédito los cortes de esas fechas, o aceptar el hueco. |
| **Sell out PCEL 2025 y enero-2026** | El archivo semanal `venta-marca-ACTECK-*.xls` trae **ventana móvil de 3 meses**: el más antiguo en disco (20-abr-2026, semana 16) sólo alcanza Feb/Mar/Abr 2026 — exactamente donde arranca la BD. **No hay forma de recuperarlo desde disco: pedir a PCEL el sell-out mensual por SKU de 2025 y enero-2026.** |
| **Inventario y EdC de Digitalife/Dicotech anteriores a abr/jun-2026** | Fotos que nunca se tomaron. Pedir al cliente si conserva cortes históricos. |
| **`erp_ventas` 2023-2024** | Está en el ERP (las cuotas llegan a 2023). Pedir al puente una corrida con esos años si se quiere comparativo de 3 años. |

### 4.4 Se puede reconstruir **sin archivo**, desde la propia base

| Hueco | Fuente |
|---|---|
| **Sell out Dicotech semanas 19 y 20 de 2026** (y la 18 parcial) | `sellout_general` (mayorista DICOTECH) tiene mayo-2026 completo: **3,493 pzs / $919,499** contra **2,273 pzs / $706,910** en `sellout_detalle`. Se reconstruye con un `INSERT ... SELECT` desde `sellout_general`. En rigor, la recomendación #1 de `AUDITORIA_CARGAS_CLIENTES.md` (dejar `sellout_general` como fuente única de Dicotech) resuelve este hueco y de paso el doble conteo, el IVA mezclado y los duplicados. |

### 4.5 Ya cargado — no hacer nada

| Archivo | Comentario |
|---|---|
| `~/Desktop/Actualización Dashboard/Historico Sellout Digitalife.xlsx` (14-abr-2026) | 20,111 filas, **2024-09-30 → 2026-04-05**. Es exactamente lo que hay en la BD. *(La auditoría anterior lo dio por no encontrado; sí existe, en el Desktop.)* Ésta es toda la historia que Digitalife entregó — no hay nada anterior a sep-2024. |
| Los 18 CSV `Reporte-SellOut_Ventas Semanal Acteck_Revko*.csv` (26-may → 07-sep 2026) | Cubren semanas 22–37; ya cargados. Ninguno cubre las semanas 19-20 que faltan. |
| Los 22 `venta-marca-ACTECK-*.xls` (semanas 16–36) | Ya cargados; la BD tiene 15–36. |
| Los 23 `Acteck_BalamRush_Inventario*.xlsx` y 20 `Reporte-Inventario_*` | Ya cargados salvo los 3 de §4.2. |

### 4.6 Existen pero en otro formato (valor marginal)

`~/Downloads/Clientes/Revko/`: 6 fotos sueltas de inventario de Dicotech — `REVKO.INV.11.07.24`, `Revko.Inventario.27.08.24`, `REVKO.Inventario.23.09.24`, `Inv.REVKO.29.10.24`, `Inv.REVKO.21.11.24`, `Inventario.REVKO.03.03.25`. Traen columnas del portal Revko (`Sku · Descripcion · Fabricante · Modelo · Inventario · Transito · Venta Act. · Venta mes ant`), **no** el CSV de 8 almacenes que espera `dicotechInventario`. Cargarlas exigiría un parser nuevo para 6 cortes sueltos de 2024-2025: no vale la pena salvo que se quiera un comparativo interanual de inventario.

Los `Resumen PCEL 2025.xlsx` / `Cierre PCEL 2025.xlsx` / `Resumen Dicotech 2026.xlsx` son hojas comerciales de trabajo (objetivos, spiffs, cotizaciones), no reportes a nivel SKU: no son cargables.

---

## 5. Orden sugerido

1. **Cargar los 6 estados de cuenta de §4.1** por el importador — ganancia inmediata y sin riesgo (upsert por `cliente,anio,semana`, la semana la saca del archivo).
2. **Reconstruir el sell-out de Dicotech desde `sellout_general`** (semanas 19-20 de 2026 y, de paso, el resto de los hallazgos críticos de la auditoría previa).
3. **Pedir a PCEL** el sell-out mensual por SKU de 2025 + enero-2026: es el único hueco grande de historia comercial que no se puede tapar con nada de lo que hay.
4. **Arreglar `semanaSnapshot()`** (semana del archivo o elegible en el importador) y entonces cargar los 3 inventarios de §4.2.
5. **Pedir a crédito y cobranza** los cortes históricos de EdC de Digitalife (no queda ni un archivo en disco) y los huecos 24/26/28 de 2026.
6. Limpiar las 3 filas basura de `inventario_cliente` (`__test__`, el `<!DOCTYPE html>`, y el bloque `anio`/`semana` NULL de 1,424 filas).

---

## ✅ Aplicado el 2026-09-12 (sesión `sweet-kare-624569`)

| Paso | Estado |
|---|---|
| 1 · Estados de cuenta históricos de PCEL | ✅ cargados los 4: **sem 49/2025**, **sem 5/2026**, **sem 17/2026** y **sem 27/2026** (ésta pasó de 0 a 80 facturas de detalle). El #6 (PCEL ~sem 28/2025, sin fecha al pie) **no** se cargó |
| 2 · Sell out de Dicotech semanas 19-20 | ✅ reconstruidas desde `sellout_general` (2026-05-01 → 05-17, 900 filas) y todo may–sep recargado desde los CSV semanales |
| 3 · Pedir a PCEL el sell out 2025 + ene-2026 | ⏳ pendiente (fuera de la máquina) |
| 4 · `semanaSnapshot()` + los 3 inventarios de §4.2 | ✅ `semanaDeCorte()` en `src/lib/parsers/_util.js` + columna "Corte" en el importador; cargados **Dicotech sem 23 y 32** y **Digitalife sem 15** |
| 5 · Pedir a crédito los cortes de EdC faltantes | ⏳ pendiente (fuera de la máquina) |
| 6 · Filas basura de `inventario_cliente` | ✅ borradas las 1,426 (respaldo `_respaldo_inventario_cliente_20260912`) |

Detalle, conteos y cómo revertir: **`docs/CORRECCION_CLIENTES_20260912.md`**.

Huecos que siguen abiertos: inventario semana 27 (Digitalife y Dicotech), inventario
Digitalife semana 23, EdC semanas 24/26/28 de 2026 y todo el EdC histórico de Digitalife,
sell out de PCEL de 2025 y enero-2026, y `erp_ventas` 2023-2024.
