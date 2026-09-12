# Auditoría de incoherencias entre pestañas — agosto 2026 y MTD septiembre

**Fecha:** 2026-09-12 · **Motivo:** "la información es incoherente entre pestañas: en Visión General aparece un número de inventario comercial y en Inventario otro".
**Snapshot de inventario:** `inventario_acteck.updated_at` = 2026-09-12 01:29 UTC. **Definiciones:** `docs/MEDIDAS_DIRECTOR.md`.

---

## 1. Resumen en una línea

**Las ventas ya cuadraban. El inventario no, y la cobertura estaba mal calculada en 5 pantallas distintas.**

- Fact Neta de agosto 2026 = **$39,086,166** en las cuatro fuentes (`v_erp_medidas_mes`, `v_vision_factura_dimension_mes`, `facturacion_clientes`, `v_sellin_global_sku_canal_mes`). Cero diferencia. Todo cuelga de `refresh_facturacion_clientes()`.
- Inventario comercial daba **tres números distintos** en tres pestañas, y ninguno era la medida `[Inv Actual]` del director.
- "Cobertura" / "días de inventario" tenía **cinco fórmulas distintas** presentadas como si fueran la misma cifra.

---

## 2. Inventario comercial — el hallazgo principal

| Pantalla | Fuente | Columna de valor | Columna de piezas | Valor (antes) | Piezas (antes) |
|---|---|---|---|---:|---:|
| Inicio (web y móvil) | `v_inventario_comercial` | `Σ inventario × AVG(costopromedio)` | `inventario` | **$152,141,682** | **923,805** |
| Inventario global | `inventario_acteck` + Set de 15 almacenes en JS | `Σ costoinventario` | `inventario` | **$152,141,682** | **923,805** |
| Visión General (web y móvil) | `v_vision_inventario_global` | `Σ costodisponible` | `disponible` | **$143,369,756** | **886,960** |
| S&OP / Estrategia de Producto | `v_inventario_comercial` | — | `inventario` (S&OP) vs `disponible` (EstrategiaProducto) | — | — |
| **Medida del director `[Inv Actual]`** | `v_medidas_inventario` | `Σ costoinventario` ≠0 · almacén no exclusivo · Rama PRODUCTO | ídem | **$143,334,891** | **709,653** |

**Por qué diferían:**

1. **`costoinventario` vs `costodisponible`.** Son columnas distintas del ERP: la primera valúa todo el inventario, la segunda sólo lo no comprometido. Diferencia: **$8.77 M** ($152.1 M vs $143.4 M). Visión General usaba la segunda; Inicio e Inventario global la primera.
2. **`inventario` vs `disponible`** en piezas: 923,805 vs 886,960 (36,845 pzs reservadas).
3. **`almacenes_config.comercial` (15 almacenes) vs la regla del director.** La regla real es `Almacen[Exclusivo] <> "Inventario"` ∧ `Articulo[Rama] = "PRODUCTO"`. El filtro por almacén resulta casi idéntico (los 15 comerciales ≈ los almacenes "VENTAS …", salvo el 15 por $11,708), pero **el filtro de Rama nunca se aplicó**: entraban refacciones, empaque, spare parts y los SKUs sin historia de venta. Eso explica el resto de la diferencia y la caída fuerte en piezas.
4. **Un Set de almacenes duplicado en JS.** `src/modules/comercial/inventario/constantes.js:62` mantenía a mano `ALM_COMERCIALES = Set([1,2,3,6,9,12,14,15,16,17,19,25,44,64,71])` con el comentario admitiendo que había que resincronizarlo con Supabase. `almacenes_config` sólo se leía en **un** lugar de toda la app (`tracking/datos.js:36`).
5. **`v_vision_inventario_global` no estaba versionada** en el repo: sólo existía en la base. Ahora la sustituye `v_medidas_inventario` (sí versionada); de la vieja se conserva únicamente `skus_agotados`, que es el único dato que cruza con demanda de 90 días.

---

## 3. Cobertura / días de inventario — cinco fórmulas

| Pantalla | Fórmula (antes) | Unidades | Problema |
|---|---|---|---|
| Inicio | `valor / (cv_ultimos_3_meses / 90)` | $ costo ÷ $ costo/día | Dimensionalmente correcta; era la más cercana al director |
| Visión General | `(valor_inventario / venta_promedio_mensual_YTD) × 30` | $ **costo** ÷ $ **precio de venta** | **Mal**: subestima los días en, aproximadamente, el margen bruto |
| Inventario global | `Σ piezas / Σ(demanda_mes/30)` | pzs ÷ pzs/día | Correcta pero en piezas — no comparable con las de pesos |
| S&OP | `inv / (demandaMesErp / 30)`, con `demandaMesErp` de **3 meses incluyendo el mes en curso** | pzs ÷ pzs/día | **Mal**: un mes a medias hunde el ritmo e infla la cobertura |
| Resumen de Clientes | `inventarioValor / (sell-out 3m / 90)` | $ venta ÷ $ venta (Digitalife/Dicotech), $ costo ÷ $ costo (PCEL) | Internamente coherente, pero el consolidado promedia los 3 días **sin ponderar** |
| Home cliente V3 | `stock / (sell-out piezas / 30)`, ventana que se acorta en ene–mar | pzs | La ventana no cruza el año |

Y con **umbrales distintos**: 60/120 en Visión General, 30/90 en Inventario global y S&OP, 30/120 en Inicio.

**Medida oficial:** `[Dias de Inv] = Inv Actual / CV Últimos 3 Meses × 90` = **141.2 días** hoy (CV 3 meses cerrados = $91,374,985).
`[Dias de Inv Total]` = **298.5 días** (Inv Total = $303,052,129, incluye $159.7 M de OC pendientes a TC 17 — ver duda §6.3 de MEDIDAS_DIRECTOR.md).

---

## 4. Tabla pantalla × medida — agosto 2026 (y MTD septiembre)

Ventas: todas las pantallas coinciden y coinciden con el director. Se listan para dejar constancia.

| Medida | Valor ago-2026 | Valor MTD sep-2026 | Fuente canónica |
|---|---:|---:|---|
| Fact Bruta | $42,624,033 | $13,365,655 | `v_medidas_ventas_mes` |
| Devoluciones | −$3,537,867 | −$83,618 | ídem |
| RMA's | −$443,542 | −$228,950 | ídem |
| Bonificaciones | −$5,353,435 | −$476,412 | ídem |
| **Fact Neta** | **$39,086,166** | **$13,282,038** | ídem |
| **Venta Neta** | $33,289,189 | $12,576,676 | ídem |
| **Piezas Venta Neta** | 107,854 | 31,847 | ídem |
| Contribucion / % MC | $13,166,880 / 33.69 % | $4,345,557 / 32.72 % | ídem |
| % MUC | 22.98 % | 30.21 % | ídem |
| Perdida x Devoluciones | −$1,629,734 | −$30,438 | ídem |
| Perdida x RMA's | −$165,076 | −$69,730 | ídem |
| Ticket Promedio | $308.65 | $394.91 | ídem |
| **Cuota Venta** | $59,214,812 | $64,340,934 | `v_medidas_cuota_mes` |
| **% Alcance Venta** | 66.0 % | 20.6 % | ídem |
| Cuota Piezas / % Alcance Piezas | — | — | **no cargada** (falta en el puente) |
| CV Últimos 3 Meses | $92,468,405 | $91,374,985 | `v_medidas_ventas_mes` |
| Sell-out (`sellout_general`) | $33,397,668 | — | ⚠️ bases de IVA mezcladas |
| Cartera (saldo actual, último corte) | $22,122,584 | | `v_vision_cartera_consolidada` |
| Tránsito (Master Embarques, en camino) | $163,970,636 | | `v_vision_camino_resumen` |

Por cliente, agosto 2026 (`v_medidas_ventas_cliente_mes`):

| Cliente | Fact Neta | Piezas | % MC | Cuota Venta | % Alcance |
|---|---:|---:|---:|---:|---:|
| Dicotech | $1,999,417 | 7,932 | 35.1 % | $1,314,015 | 152.2 % |
| PCEL | $1,507,120 | 4,730 | 38.1 % | $4,370,602 | 34.5 % |
| Digitalife | $809,515 | 3,024 | 27.2 % | $1,534,670 | 52.7 % |

---

## 5. Antes → después por pantalla

| Pantalla | Cifra | Antes | Después | Cómo |
|---|---|---:|---:|---|
| **Inicio** (web y móvil) | Inventario comercial | $152,141,682 · 923,805 pz | **$143,334,891 · 709,653 pz** | `inventario()` de `inicio/calc.js` lee `v_medidas_inventario` |
| **Inicio** | Cobertura | 141 d (`valor/(cv3/90)`) | **141 d** (`dias_inv`) | misma fórmula, ahora con Inv Actual |
| **Visión General** (web y móvil) | Inventario comercial | $143,369,756 · 886,960 pz | **$143,334,891 · 709,653 pz** | `v_medidas_inventario` en lugar de `v_vision_inventario_global` |
| **Visión General** | Cobertura / Días de Inv | ~36 d (`valor/venta_prom×30`) | **141 d** (`dias_inv`) | se elimina la división costo ÷ precio |
| **Inventario global** | Valor comercial | $152,141,682 · 923,805 pz | **$143,334,891 · 709,653 pz** | filas de `v_inventario_almacen_medida` filtradas por `en_inv_actual` |
| **Inventario global** | Hero "Cobertura" | cobertura por SKU en piezas, sin etiqueta | **"Días de Inv" = 141 d** (director) cuando el alcance es el comercial completo; si hay filtro de CEDIS cae a "Cobertura SKU" con su etiqueta | |
| **S&OP** | Demanda de 3 meses | incluía el mes en curso | **3 meses cerrados** (`slice(-4,-1)`) | sube la demanda, baja la cobertura por SKU (deja de estar inflada) |
| **S&OP** | Hero | sólo cobertura por SKU | **añade "Días de Inv" 141 d** del director junto a la de SKU, cada una etiquetada | |
| **Estrategia de Precios** | Costo del margen | `v_inventario_comercial.costo_promedio` colapsado en un Map (última fila gana) | **`[Costo Promedio]` = $306.06 promedio**, 1 fila por SKU | `v_medidas_inventario_sku` |
| **Sell In consolidado** | Cuota | regla reimplementada en el archivo | **`cuotas()` de `lib/medidas.js`** | mismo resultado, una sola implementación |
| **Ficha de producto / Buscar (móvil)** | Inventario por SKU | `v_inventario_comercial` | **`v_medidas_inventario_sku`** | mismas piezas que Inventario global |
| **Análisis global · Estado de Resultados · RentabilidadBloque** | — | ya usaban las medidas | **sin cambio de cifra**; se renombran las etiquetas a los nombres oficiales y se añaden tooltips | |

Los tres números de inventario que Fernando veía distintos ahora son **uno solo: $143,334,891**.

---

## 6. Pendiente en las pantallas que este trabajo no podía editar

Otros agentes están tocando estos archivos. Lista exacta de cambios:

### 6.1 `SellOutCliente.jsx` · `SellOutClienteV2.jsx` · `SellOutPcel.jsx` · `SellOutDicotech.jsx`
- `SellOutCliente.jsx:1926` — `v_inventario_comercial ... .maybeSingle()`: la vista devuelve **1 fila por SKU**, pero si algún día deja de agrupar, `maybeSingle()` lanza. Cambiar a `v_medidas_inventario_sku` con `.eq('articulo', sku)` (columnas `inv_actual_piezas`, `inv_actual_disponible`, `costo_promedio`, `inv_actual`).
- PCEL se valúa con **cinco bases de costo distintas** entre pantallas (`valor` del archivo, `stock × costo_convenio`, `stock × precio_venta`, `sellout_pcel.costo_promedio`, `monto/piezas` de facturación). Elegir una — la recomendación es `[Costo Promedio]` del director — y etiquetarla.
- El sell-out de PCEL va **a costo** y el de Digitalife/Dicotech **a precio de venta**: no sumarlos sin convertir (hoy `resumen/calculo.js:243` y móvil `Inicio.jsx:84` los suman).

### 6.2 `EstrategiaProducto.jsx`
- `:1153-1155` — el comentario dice "misma fuente que Forecast Clientes para mantener consistencia" pero usa `disponible` mientras S&OP usa `inventario`. **El comentario es falso.** Cambiar a `v_medidas_inventario_sku` (`inv_actual_piezas`).
- `:1149`, `:1169`, `:1177`, `:1150` — años **hardcodeados** `2026`/`2025`. Rompen el 2027-01-01.

### 6.3 `HomeClienteV3.jsx` + `home/`
- `home/calc.js:69-72` — la ventana de 3 meses hace `.filter(m => m >= 1)`: en ene–mar se acorta en vez de cruzar al año anterior. Usar `mesesCerrados()` de `src/lib/medidas.js`.
- `home/useHomeData.js:58-59` — `costo = costo_convenio || precio_venta`: mezcla base de costo y base de venta en la misma columna `valor`. Separarlas.
- `useHomeData.js:88` — `v_inventario_comercial` → `v_medidas_inventario_sku`.

### 6.4 `ResumenClientesTab.jsx` + `resumen/`
- `resumen/calculo.js:125` — `costoPromedioSku = monto/piezas` se llama "costo" pero es **precio de venta**. Renombrar y, si se quiere costo, usar `[Costo Promedio]`.
- `resumen/calculo.js:258` — `coberturaProm` es un promedio simple de los días de 3 clientes. Ponderar por valor de inventario.
- `resumen/datos.js:100-102` — `.limit(200)` sin `order` en la consulta de márgenes. Hoy caben 72 filas; es una bomba de tiempo.

### 6.5 `ForecastCliente.jsx`
- `:25` — `facturacion_clientes` **sin filtro de año y sin paginación**: PostgREST corta en 1,000 filas en silencio. Usar `fetchAll` con `.in('anio', [...])`.

### 6.6 `AnalisisCliente.jsx`
- Lee el modelo viejo (`ventas_mensuales`, `sell_in_sku`, `productos_cliente`) en vez de `v_medidas_ventas_cliente_mes`. Migrarlo es lo que lo hará cuadrar con Análisis global.

### 6.7 `ReporteSection.jsx`, `propuestas/datos.js`, `reservas/datos.js`, `SellInDrillDown.jsx`, `components/MobileInventarioGlobal.jsx`
- Todos leen `inventario_acteck` crudo con criterios propios. Pasarlos a `v_inventario_almacen_medida` (trae `en_inv_actual` resuelto).
- `MobileInventarioGlobal.jsx:40` pide columnas `sku,stock,valor_mxn` que **no existen** en `inventario_acteck` — código muerto, archivar.

### 6.8 Móvil Sell Out y `movil/pestanas/VisionGeneral.jsx`
- `movil/pestanas/VisionGeneral.jsx:72-80` — `contribucionRenglones()` reimplementa a mano la regla de Fact Neta sobre renglones crudos de `erp_ventas` (para la estacionalidad al mismo día). La regla es **idéntica** a la de la vista hoy, pero es una segunda copia que puede divergir. Si algún día se necesita el corte por día, exponer una vista `v_medidas_ventas_dia` en vez de calcularlo en JS.

### 6.9 Fuera del alcance de este trabajo pero bloqueante
- ~~**`v_vision_margen_canal` lee la tabla vieja `ventas_erp`**~~ — **resuelto 2026-09-12** (`20260912_vision_margen_canal_erp.sql`): ahora sale de `v_medidas_ventas_canal_mes`, con las mismas 8 columnas (`admin_interna` = `canal`, porque `erp_ventas` no trae esa dimensión). Nadie la consumía en `src/` ni en `api/`. En el mismo pase se migraron a `erp_ventas` los otros lectores de la tabla vieja: `src/lib/pcelAdapter.js` → `fetchHistoricoComprasPcel` (devolvía **0 filas**; ahora 295 filas / 107 SKUs), `api/recalculate.js` (`ventas_mensuales`, `sell_in_sku`) y el RPC `actualizar_fill_rate_oc()` (`20260912_fill_rate_desde_erp_ventas.sql`). Siguen citando `ventas_erp` sólo las listas de tablas (`api/import-central.js`, `api/status.js`, RLS) y el uploader legacy `public/import.html`.
- **Piezas por canal salían en 0** (hallazgo del mismo pase): `mv_erp_medidas_canal_mes.piezas_venta_neta` y `v_erp_medidas.piezas_fact_bruta` usaban `COALESCE(unidades, 0)` — se quedaron fuera de `20260911_piezas_coalesce_unidades.sql`. Corregido en `20260912_piezas_canal_coalesce.sql` (agosto-2026 pasa de 0 a 107,854 piezas).
- **`sellout_general` de Dicotech** mezcla bases de IVA y septiembre está en 0; PCEL nunca manda pesos. Ver `docs/AUDITORIA_CARGAS_CLIENTES.md`. Ninguna medida de sell-out es confiable hasta arreglar la carga.
- **`estados_cuenta` con `.limit(60)`** en `inicio/useInicioData.js:54`: si la tabla crece, la reducción "último corte por cliente" puede perder clientes.
- **Cuota Piezas y Cuota Costo**: el código del puente ya las mapea (2026-09-12); falta `git pull` + ajustar `CUOTAS_COLS` en `credenciales.env` de la Mac mini y correr `node sync.mjs cuotas`.
- **`inventario_historico` tiene 1 solo día** (2026-09-10). `Inv Cierre de Mes`, `Inv Promedio` y `Vueltas de Inv` no serán fiables hasta que acumule meses.
