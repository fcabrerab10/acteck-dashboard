# Proyectos y abasto (V3 · 2026-09-21)

Sustituye por completo a **Forecast › Reservas**. La página sigue llamándose
`forecastReservas` por dentro (permiso `forecast_reservas`, alertas y rutas móviles no
cambian de nombre), pero la pantalla se rehízo desde cero con la propuesta A "Tablero de
proyectos" que aprobó Fernando.

## Qué contesta la pantalla

> ¿Alcanza lo que tengo —inventario disponible + embarques en tránsito— para lo que ya
> prometí a Digitalife, PCEL y Dicotech? Y si no alcanza, ¿qué compro y antes de cuándo?

Un **proyecto** es una venta comprometida: nombre, cliente, mes objetivo, probabilidad,
responsable y una lista de SKUs con piezas.

## Modelo de datos

Migración: `supabase/migrations/20260921_proyectos_abasto.sql` (aplicada en producción el
2026-09-21).

| Objeto | Qué es |
|---|---|
| `proyectos` | cabecera: `nombre`, `cliente` (digitalife\|pcel\|dicotech), `anio`, `mes`, `probabilidad` (prospecto\|probable\|confirmado\|entregado\|cancelado), `responsable`, `notas`, `creado_por`, timestamps |
| `proyecto_lineas` | SKUs del proyecto: `sku`, `piezas`, `reservado`, `notas`. UNIQUE (`proyecto_id`, `sku`), borrado en cascada |
| `v_proyectos_sku_mes` | demanda por SKU y mes (sin cancelados) + `proyectos` jsonb con {id, nombre, cliente, probabilidad, piezas} |

- **RLS**: `SELECT` para cualquier autenticado; `ALL` para el equipo interno — el mismo
  predicado que `sugeridos_compra` (perfil activo con `tipo='interno'`, `es_super_admin` o
  rol super_admin/asistente/admin).
- **Auditoría**: trigger genérico `fn_auditoria('id')` en las dos tablas → salen en el
  Historial de la pantalla y en Interno › Historial de cambios.
- **La cobertura NO se guarda.** Se calcula en el cliente contra el inventario y el tránsito
  vivos, para que nunca quede una cifra vieja en la base.

## Reglas de cálculo (`src/modules/comercial/proyectos/calculo.js`)

Motor puro, sin React ni red. Pruebas: `node --test scripts/test-proyectos-calculo.mjs` (16).

1. **Demanda**: sólo los estados `prospecto`, `probable` y `confirmado` comprometen
   inventario. `entregado` y `cancelado` se siguen listando, pero no consumen piezas.
2. **Reparto FIFO por mes**: los meses se atienden en orden cronológico (incluidos los que
   caen fuera del horizonte de 6 meses). Cada mes toma primero del **disponible** que quede
   y después de los **embarques cuya ETA cae dentro de ese mes o antes**. Lo que un mes se
   lleva ya no está para los siguientes; así dos proyectos distintos no salen cubiertos por
   las mismas piezas. Un arribo **sin ETA** nunca cubre un mes (va al final de la fila).
3. **Tono de la celda**: `rojo` si falta; `naranja` si alcanza pero la holgura sobrante es
   < 15 % de la necesidad ("justo"); `verde` en cualquier otro caso.
4. **Cobertura del proyecto** = piezas cubiertas / piezas comprometidas. Lo cubierto de cada
   mes se reparte **a prorrata** entre las líneas de ese mes.
5. **Fecha límite de compra** = primer día del mes objetivo − **lead time real** del SKU
   (`v_lead_time_sku.dias_promedio`), con respaldo por proveedor (`v_lead_time_supplier`) y
   default de **104 días**. Si esa fecha ya pasó, la compra sale marcada `llegaTarde`.
6. **Los porcentajes nunca se promedian**: el % del hero se recalcula sobre los totales, y
   `divide()` devuelve `null` (se pinta "—"), nunca 0.

## Dónde está cada cosa

```
src/modules/comercial/ProyectosAbasto.jsx      orquestador (lazy en App.jsx)
src/modules/comercial/proyectos/
  calculo.js        motor puro (FIFO, cobertura, compras sugeridas, matriz, tablero)
  textos.js         frases del hero, formatos y columnas de Excel
  datos.js          hooks de React Query + escrituras + "Mandar al S&OP"
  campos.jsx        Campo / Entrada / AreaTexto / Selector
  Tablero.jsx       columnas por mes, drag & drop entre meses
  TarjetaProyecto.jsx  tarjeta (barra de cobertura + flechas ‹ ›)
  HojaProyecto.jsx  hoja lateral: campos, SKUs y acciones
  MatrizSkuMes.jsx  SKU × 6 meses, celdas coloreadas por cobertura
  HojaSku.jsx       hoja lateral del SKU: meses, proyectos, arribos y sugerido
  QueFaltaComprar.jsx  panel derecho + botones S&OP / Excel
  Historial.jsx     auditoria_cambios de las dos tablas
src/movil/pestanas/Proyectos.jsx               app móvil (ruta forecastReservas)
scripts/test-proyectos-calculo.mjs             16 pruebas del motor
scripts/test-proyectos-ssr.mjs                 smoke SSR (web + móvil)
```

Siluetas de carga: `proyectos` (web) y `movilProyectos` (celular) en
`src/components/kit/siluetas.js`. Frescura: `FUENTES_POR_PANTALLA.proyectos` =
`inventario_acteck` + `embarques_compras`.

## Las tres vistas

- **Tablero** — una columna por mes (los próximos 6) más "Más adelante" para lo que cae
  fuera. Las tarjetas se arrastran entre columnas (cambia `anio`/`mes` del proyecto) o se
  mueven con las flechas ‹ ›. A la derecha, el panel "Qué falta comprar".
- **Matriz SKU × mes** — un renglón por SKU con demanda de proyectos y una celda por mes.
  El selector **Necesidad · Faltante · Reservado** cambia el número; el **color siempre
  cuenta la misma historia** (¿alcanza para ese mes?). Toggle "Sólo con faltante". Al tocar
  un renglón se abre la hoja del SKU.
- **Historial** — `auditoria_cambios` filtrada a `proyectos` y `proyecto_lineas`: quién,
  qué campo, de qué a qué y cuándo.

## "Mandar al S&OP"

No inventa un flujo nuevo: reusa las **solicitudes de compra** que ya existen
(`forecast/useSolicitudes.js`, pantalla S&OP). `mandarAlSop()` busca un `solicitudes_compra`
en estado `borrador`; si no hay, crea uno con `notas = 'Proyectos y abasto'`. Después
inserta en `solicitudes_compra_lineas` un renglón por SKU faltante con `cantidad = falta`,
`proveedor` y `fecha_estimada = fecha límite`. Los SKUs que ya estaban en el borrador no se
duplican (el toast lo dice). El botón **Excel** baja lo mismo en dos hojas ("Qué falta
comprar" y "Proyectos") con `src/lib/exportar.js`.

## Alertas (api/cron.js → `generar-alertas`)

Las dos reglas usan el **mismo motor** que la pantalla, así que no pueden discrepar:

| Tipo | Cuándo | Severidad |
|---|---|---|
| `proyecto_sin_cobertura` | proyecto activo a ≤ 30 días de su mes con piezas sin respaldo | crítica si es confirmado y faltan ≤ 15 días · alta si confirmado · media si no |
| `arribo_tarde_proyecto` | hay embarque de ese SKU, pero su ETA cae después del mes objetivo (proyecto a ≤ 60 días) | alta si confirmado · media si no |

Ambas van al área `forecast` y navegan a `forecastReservas`. `caduca_at` = día 15 del mes
siguiente al del proyecto. En `src/lib/alertas.js` están dadas de alta en `AREA_POR_TIPO` y
en `destinoAlerta`.

## Lo que quedó fuera a propósito

- `ForecastReservas.jsx` y `src/modules/comercial/reservas/` **siguen en el repo sin uso**
  (Fernando pidió "desde 0"). Las tablas viejas `forecast_propuestas` /
  `forecast_propuesta_lineas` no se tocan: las alertas `reserva_3dias` / `reserva_dia`
  siguen funcionando igual mientras existan esas propuestas.
- El móvil consulta y edita (estado, piezas, alta de proyecto), pero no arrastra entre meses
  ni manda al S&OP: eso vive en la computadora.
