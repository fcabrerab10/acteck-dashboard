# Datos que ya llegan solos y todavía no usamos

**Fecha:** 2026-09-12 · **Para:** Fernando Cabrera · **Cómo se hizo:** se revisó qué escribe el puente de la Mac mini (`bridge/`), el cron de Vercel (`api/cron.js`) y el importador (`api/import-central.js`), columna por columna; luego se buscó cada columna en todo el código del dashboard; y por último se midió en la base de datos real cuántas filas traen dato y con qué valores.

Sólo aparecen aquí cosas **con datos reales** (se descartaron las columnas vacías y los IDs técnicos). Las coberturas son al 2026-09-12.

---

## 1. Ventas del ERP (`erp_ventas`) — 176,955 renglones, se actualiza cada hora

Es la tabla más rica que tenemos y de sus 35 columnas el dashboard usa poco más de la mitad. Lo que falta:

| Dato | Qué contiene (ejemplo real) | Cobertura | Para qué serviría | Esfuerzo |
|---|---|---|---|---|
| **Vendedor** | 25 vendedores con nombre: Carolina Romero $83.6 M, David Millán $64.4 M, Fernando Cabrera $52.7 M, Jhordy Sánchez $43.4 M… (2026) | **100 %** | Pestaña **"Equipo comercial"**: venta, margen, devoluciones y % de cuota **por vendedor**, no sólo por cliente. Y ranking mensual. Hoy no existe ninguna vista del negocio por persona. | Medio |
| **Concepto de la bonificación** (`descripcion` de los renglones con `rama = SERVICIOS`) | −$34.4 M en 2026 desglosados en 12 conceptos: Promoción general de temporada −$15.0 M · Rebate fondo sell out −$5.4 M · Apoyo marketing −$4.2 M · Promoción especial autorizada −$2.3 M · Pago de PM's −$1.9 M · Protección de precios −$1.7 M · Bonificación por RMA's −$0.9 M · Pronto pago −$0.26 M | 100 % de esos renglones | **La joya de la corona.** Hoy sólo vemos "Bonificaciones" como un número total. Con esto sale un bloque **"¿En qué se va el apoyo comercial?"** por cliente y por concepto (CT −$9.9 M, CVA −$6.5 M, DECME −$2.1 M, Stuffactory −$1.9 M…), con comparativo contra el año pasado. Contesta directo "cuánto le estoy dando a cada cuenta y por qué". | **Bajo** (el dato ya está, sólo hay que agrupar) |
| **Lista de precios de la venta** | 43 listas: Mayoreo AAA $111 M · Mayoreo PMM $83 M · DECME Provisional $48 M · PCEL Provisional $22 M · Ingram Retail $14 M · Mercado Libre Full $13 M · Amazon $8 M… | 100 % | Saber **a qué lista se factura de verdad** vs. la lista que tenemos cargada en Estrategia de Precios; alerta "factura fuera de lista". También permite margen por lista. | Medio |
| **Almacén de la venta** | 27 almacenes: 1 Guadalajara $156 M · 3 México $108 M · 6 DECME MX $37 M · 97 Remisiones $25 M · 17 Retail MX $17 M | 100 % | Vista **por CEDIS / plaza**: cuánto vende Guadalajara vs. México, y detectar el almacén 97 (remisiones, $25 M) que hoy no se distingue. | Bajo |
| **Referencia del pedido del cliente** | "PCHSO1698068", "ANAHUAC 596773", "AEROPUERTO PO95939" (la OC o sucursal del cliente) | 98.3 % | Ya se usa para ligar facturas con OCs en Tracking, pero **no** para ver **venta por sucursal del cliente** (PCH Anáhuac, Kabik Huejutla…). Serviría en la ficha de cada cuenta. | Medio |
| **Subcanal** | Mayoreo de Cómputo, E-Commerce, Club de Precios, Autoservicio, Departamental, B2B, Mostrador | 34.9 % (sólo 2026) | Cortar Retail en "club de precios / autoservicio / departamental". Útil pero la cobertura es parcial. | Bajo |
| **Grupo (línea) y Familia** | 54 líneas y 141 familias distintas | 90 % / 96 % | Hoy sólo cortamos por Marca y Categoría. Añadir **Línea** daría un nivel más de mix (y ya está en la tabla). | Bajo |
| Instrucción | "Nota crédito" (3,543 renglones), "Por recibir" (39) | 2 % | Marca qué devoluciones son nota de crédito. Poco volumen, poco valor. | — |
| Moneda / tipo de cambio del renglón | 20 renglones en dólares de 176,955 | 0.01 % | **No vale la pena.** Prácticamente todo se factura en pesos. | — |

---

## 2. Inventario (`inventario_acteck` + foto diaria) — 9,947 filas, cada hora

| Dato | Qué contiene (ejemplo real) | Cobertura | Para qué serviría | Esfuerzo |
|---|---|---|---|---|
| **Apartado** (`inventario − disponible`) | 36,851 piezas apartadas = **$8.8 M** de producto comprometido y no vendible | 100 % | KPI **"Inventario comprometido"** en Inventario global y en la ficha de SKU: hoy mostramos inventario y disponible por separado pero nunca la diferencia, que es justo lo que ya está apartado para pedidos. También alerta "SKU con más apartado que disponible". | **Bajo** |
| **Inventario fuera de los almacenes comerciales** | Almacén 41 "Destrucción auditado GDL" **$13.1 M** · 13 "Paqueterías" $8.3 M · 42 "Reparaciones GDL" $4.1 M · 70 "Centro de servicio" $2.4 M · 200 "Producción materia prima" $1.6 M | 100 % | El dashboard sólo mira los 15 almacenes comerciales ($143 M). Hay **~$30 M más** parados en almacenes no comerciales que nadie ve. Un panel **"Inventario fuera de venta"** (destrucción, reparación, empaque dañado) es dinero dormido identificable SKU por SKU. | Bajo |
| **Foto diaria del inventario** (`inventario_historico`) | El puente guarda un corte al cierre de cada día. Hoy hay **1 solo día** (2026-09-10) | arrancando | La pantalla de Inventario ya tiene el panel "Tendencia" listo y vacío. En 30 días habrá curva de inventario, y con eso: **días de inventario históricos, antigüedad y rotación real por SKU**. Sólo hay que confirmar que la corrida de las 19:00 la esté guardando todos los días. | Bajo (verificar) |

---

## 3. Cuotas (`cuotas_mensuales`) — 1,649 filas, diario 06:30

| Dato | Qué contiene (ejemplo real) | Cobertura | Para qué serviría | Esfuerzo |
|---|---|---|---|---|
| **Cuotas de 29 clientes** (no sólo de 3) | 2026: DECME $128 M · CT $100 M · CVA $77 M · PCEL $50 M · Mercado Libre $44 M · PCH $31 M · Ingram Retail $25 M · Amazon $22 M · Unicom $20 M · Arroba $30 M · Svenska $18 M · Stuffactory $10 M… | 100 % (2023-2026) | Hoy la cuota por cuenta sólo se ve en Digitalife / PCEL / Dicotech; a nivel global se usa la **suma**. Poner **% de alcance de cuota en cada una de las 17 cuentas de Sell Out** y en Sell In "todos los canales" es el semáforo que falta. Además hay 4 años de historia para ver quién cumple siempre y quién nunca. | **Bajo** (la vista `v_medidas_cuota_cliente_mes` ya existe y ninguna pantalla la usa) |
| Cuota en piezas y cuota en costo | Columnas ya creadas y ya programadas en el código | **0 %** | **Pendiente real:** el puente no las trae todavía. Hay que confirmar el nombre de las columnas UNIDADES / COSTODEVENTA en la base RevkoBi. Con eso saldría "% de alcance en piezas" además de en pesos. | Bajo (configuración) |

---

## 4. Sell Out de mayoristas (`sellout_general`) — 393,659 filas, diario

Sucursal, vendedor, cliente final y estado **ya se usan** en la pestaña de Sell Out. Lo que sigue sin usarse:

| Dato | Qué contiene (ejemplo real) | Cobertura | Para qué serviría | Esfuerzo |
|---|---|---|---|---|
| **RFC del cliente final** | 11,428 RFCs distintos | 34.7 % | Cruzar **el mismo cliente final entre mayoristas**: hoy "Grupo X" comprando por CT y por CVA se ven como dos clientes. Con el RFC se consolida y se ve quién nos compra de verdad y a través de quién. Es la base para un mapa de canal real. | Medio |
| **Importe en dólares** | 57 % de las filas traen importe USD (CVA, DC, Dicotech, Loma, Exel) | 57 % | Sirve poco para dirección (el dashboard va en pesos), pero explica diferencias de tipo de cambio con los mayoristas. | — |
| **SKU del mayorista** (`sku_cliente`) | El código con el que CT/CVA nombran nuestro producto | 59.8 % | Tabla de equivalencias para las propuestas y para reclamos de sell out. Valor operativo, no directivo. | Bajo |
| **Almacén del mayorista** | 61 almacenes (Dicotech 44 K filas, CVA 92 K, PCH) | 36.5 % | Ver de qué bodega del mayorista sale el producto; complementa "sucursales". | Bajo |
| **Marca y línea según el mayorista** | 14 marcas (98.7 %) y 36 líneas (4.1 %) | 99 % / 4 % | Hoy la marca del Sell Out se saca de **nuestro** catálogo, no de la que reporta el mayorista. Compararlas detecta SKUs mal clasificados en el mayorista. Nicho. | Bajo |
| Factura del mayorista | 99.3 % | 99 % | Auditoría de reclamos de rebate (probar que el sell out reportado existe). | Bajo |

---

## 5. Embarques de importación (`embarques_compras`) — 3,899 filas, diario 07:00

Fechas, PO, cantidades y estatus ya se usan en S&OP y Forecast. **Todo el bloque de costo y de producción está sin usar:**

| Dato | Qué contiene (ejemplo real) | Cobertura | Para qué serviría | Esfuerzo |
|---|---|---|---|---|
| **Valor FOB del embarque** (`total_amount`) | **$12.8 M USD** comprados en 2026; proveedor top Shenzhen Acteck $22.8 M histórico, Maxpac $17.1 M | 99.9 % | Pestaña **"Compras e importación"**: cuánto dinero tenemos comprometido en el agua, por proveedor y por mes de arribo. Hoy Compras no tiene pantalla propia. | Medio |
| **Costo de flete** | **$1.82 M USD** de flete en 2026 sobre 5,517 CBM = **$330 USD por CBM** | 67 % | KPI **costo logístico por CBM y por pieza**, y su tendencia. Es el número que dice si el flete se está comiendo el margen. | Bajo |
| **Naviera** | 22 navieras: MSK 317 embarques (29.7 días de tránsito promedio), ZIM 218 (27.4 d), ONE 163 (31.8 d), CMA 158 (34.4 d), YML 142 (25.5 d) | 43 % | **Ranking de navieras por días de tránsito y cumplimiento.** Sirve para negociar. (Ojo: hay fechas mal capturadas en el Sheet que ensucian el promedio de PIL; conviene limpiar antes de publicarlo.) | Medio |
| **Fechas de producción** (inicio / fin) | Shenzhen Acteck 61 días promedio de producción, Maxpac 69, Soeyi 71, Sohoo 49 | 97-99 % | **Lead time real por proveedor**: días de producción + tránsito + puerto→CEDIS. Hoy el S&OP usa un lead time fijo. Con esto se planea de verdad. En 2026: 34 días de ETD a CEDIS, 28 de tránsito, 6 de puerto a CEDIS. | Medio |
| **Método de pago** | LC $20.3 M · TT/LC $12.5 M · TT $4.4 M | 49 % | Perfil de exposición financiera con proveedores. Interés de finanzas, no comercial. | Bajo |
| **Comentarios de tráfico y de diseño** | Texto libre del equipo | 22 % | Contexto en el detalle del embarque ("por qué se atrasó"). | Bajo |
| Fracción arancelaria, ref. FF, agente aduanal, LT, FDW | Datos aduanales | 41-71 % | Ya existen en vistas de Forecast pero no se muestran. Uso operativo de tráfico. | Bajo |

---

## 6. Programación de arribos (`programacion_arribos`) — 241 contenedores, diario

Ya se usa en el drill de Forecast (contenedor, terminal, cita, arribo). Sin usar:

| Dato | Qué contiene (ejemplo real) | Cobertura | Para qué serviría | Esfuerzo |
|---|---|---|---|---|
| **Agencia aduanal** | ASA en el 91 % de los contenedores | 90.9 % | Desempeño por agencia (días de puerto a almacén). Con una sola agencia dominante, valor bajo hoy. | Bajo |
| **Custodia y línea transportista** | Custodia: SDG, Bicéfala, "No necesaria" · Transportistas: Translusa & VG, Logcem, Yanira | 86.7 % | Detalle en la ficha del contenedor; permite ver qué transportista llega tarde. | Bajo |
| Días de demoras / almacenajes / hora de cita / PROFEPA | Columnas mapeadas | **0 %** | **Están vacías en el Google Sheet.** No proponer nada hasta que tráfico las llene. | — |

---

## 7. Tablas completas que llegan solas y nadie abre

| Tabla | Qué contiene (ejemplo real) | Cobertura | Para qué serviría | Esfuerzo |
|---|---|---|---|---|
| **`compras_oc`** (órdenes de compra vivas del ERP, se refresca cada hora) | 429 renglones · 113 OCs · 39 proveedores · **585,491 piezas pendientes por $9.59 M USD** | 100 % | Hoy sólo alimenta un KPI escondido de inventario. Merece bloque propio: **"Qué viene en camino y de quién"**, cruzado con inventario y forecast para el sugerido de compra. | Medio |
| **`series_generadas`** (hoja SN del Master Embarques) | 955 filas, 258 POs, con **EAN (97.7 %)**, rangos de números de serie y estatus (94.5 %). Última PO 2026-09-10 | alta | Rastreo de series para garantías/RMA y **catálogo de EAN** para listas de mayoristas y Amazon/ML. Hoy **cero** uso. | Medio |
| **`catalogo_articulos`** | 9,492 artículos con descripción (99.9 %) e **ISBN/EAN (93.3 %)** | alta | Sólo usamos `articulo` + `descripcion` como respaldo de nombres. El **código de barras de 8,850 SKUs** está ahí sin usar: sirve para fichas de producto, listas a clientes y validación de altas. | Bajo |
| **`proveedores_master`** | 58 proveedores con nombre, código Intelisis e ISBN | 100 % | Nombre bonito del proveedor en embarques y compras (hoy se muestra el texto crudo "SHENZHEN ACTECK COORPORATION LIMITED"). | Bajo |
| **`tipo_cambio`** (FIX Banxico) | 427 días, de 2025-01-02 a 2026-09-11 | 100 % | Ya se usa en Cobranza. **Ojo:** la tarea `tipo-cambio` **no está programada** en `vercel.json` — el histórico se llenó a mano. Si se quiere usar para valuar inventario o compras en USD, hay que agendarla. | Bajo (configuración) |
| **`guias_erp`** (envíos y paqueterías) | 13,248 guías · agente (99.9 %) · sector (100 %) · destino con estado (86.5 %) · paquetería (32.6 %): Estafeta 3,223 envíos con **3.0 días promedio** de entrega, Almex 8.9 días, flota Acteck mismo día | parcial | **Mapa de entregas y cumplimiento de paqueterías.** PERO: la última carga es del **2026-08-10** — esta tabla **todavía no está en el puente**, se sube a mano desde el Excel. Pasarla al puente desbloquea el tiempo de entrega real en Tracking Pedidos. | Medio (requiere puente) |

---

## 8. Dos cosas que hoy estamos perdiendo (no es que no se usen: se borran)

1. ~~**Historia de precios.**~~ **HECHO 2026-09-12.** El puente ya no hace *replace completo* de `precios_sku`: reemplaza sólo el periodo que reescribe (`deleteWhere: anio=eq.X&mes=eq.Y`), así que la tabla —cuya PK ya era `(sku, lista, anio, mes)`— se vuelve la serie histórica. Vista nueva `v_precio_vigente_sku_lista` (precio vigente + `vigente_desde` + nº de periodos) y panel "Historial de precio" en el drill de Estrategia de Precios. `precios_historico` y su trigger siguen capturando (aportan `primera_vez`/`ultima_vez`). **Requiere `git pull` en la Mac mini** para que empiece a acumular.
2. ~~**Sólo cargamos 5 de las 43 listas de precios.**~~ **HECHO 2026-09-12.** `LISTAS_PRECIOS` en `bridge/lib/mappers.mjs` son ya las **10** con más facturación 2026 (se sumaron Mayoreo PMM $83.5 M, Ingram Retail $14.2 M, ML Full $13.1 M, Svenska $8.7 M y Amazon $8.3 M) y el nombre se compara normalizado. La pantalla no las trae en duro: las descubre de los datos (`listasDeDatos`), muestra 5 columnas por la regla de ancho y las demás con el filtro "Listas"; el drill y el Excel las llevan todas. **Requiere `git pull` en la Mac mini.**

---

## Top 10 oportunidades (valor ÷ esfuerzo)

| # | Oportunidad | Fuente | Esfuerzo | Por qué primero |
|---|---|---|---|---|
| 1 | **"¿En qué se va el apoyo comercial?"** — desglose de los $34.4 M de bonificaciones por concepto y por cliente | `erp_ventas` (rama SERVICIOS) | Bajo | El dato está completo y es la pregunta más cara del negocio. Nadie la puede contestar hoy. |
| 2 | **% de alcance de cuota en las 17 cuentas** de Sell Out y en Sell In global | `cuotas_mensuales` + vista ya hecha | Bajo | La vista `v_medidas_cuota_cliente_mes` ya existe y nadie la consume. Es conectar cables. |
| 3 | **Pestaña "Equipo comercial"** — venta, margen, devoluciones y cuota por vendedor (25 personas) | `erp_ventas.vendedor` | Medio | 100 % de cobertura y una dimensión completa del negocio que no existe en el dashboard. |
| 4 | **Inventario comprometido ($8.8 M apartado) e inventario fuera de venta (~$30 M)** | `inventario_acteck` | Bajo | Dos números grandes, ya en la tabla, con una resta. |
| 5 | ~~Ampliar listas de precios (5 → 10) y confirmar que se guarda la historia~~ **HECHO 2026-09-12** (falta `git pull` en la Mac mini) | `precios_sku` | Bajo | Cambio de una línea en el puente; sin él, Estrategia de Precios se queda ciega en la mitad de la facturación. |
| 6 | **Lead time real y costo de flete por CBM** ($330/CBM, 34 días ETD→CEDIS, por proveedor y naviera) | `embarques_compras` | Medio | Mejora directa del S&OP, que hoy usa lead time fijo. |
| 7 | **Confirmar la foto diaria de inventario** y encender el panel "Tendencia" | `inventario_historico` | Bajo | El panel ya está construido y vacío; sólo falta que se acumulen días. |
| 8 | **Bloque "Compras en camino"** — $9.59 M USD y 585 K piezas pendientes por proveedor | `compras_oc` | Medio | Tabla completa que hoy no se abre en ninguna pantalla. |
| 9 | **Pasar `guias_erp` al puente** y encender tiempo de entrega por paquetería | `guias_erp` | Medio | Lleva un mes sin actualizarse; con el puente, Tracking Pedidos gana el dato de entrega real. |
| 10 | ~~EAN/código de barras en ficha de producto y listas a clientes~~ **HECHO 2026-09-12** · vista `v_sku_ean` (ficha móvil con copiar, columna EAN en el Excel de Propuestas y línea EAN en los textos de WhatsApp). **Ojo: son 4,239 SKUs, no 8,850** — 4,711 de los `isbn` de `catalogo_articulos` son un "0" de relleno. | `catalogo_articulos` + `series_generadas` | Bajo | Dato limpio y pedido recurrentemente por mayoristas y marketplaces. |

**Bonus de configuración (5 minutos cada uno):** agendar la tarea `tipo-cambio` en `vercel.json` (hoy no corre sola) y confirmar en RevkoBi el nombre de las columnas de **cuota en piezas y en costo**, que ya están programadas de punta a punta y llegan vacías.
