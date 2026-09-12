# Pasada de rendimiento · 2026-09-12

Objetivo de Fernando: *"siempre lo más optimizado posible, que parezca casi nativa de Apple, web y móvil"*.
Nada de lo de abajo cambia comportamiento ni diseño: mismas transiciones, mismas siluetas, mismos gestos.
Donde una optimización iba a costar una animación (paneles perezosos), se añadió un mecanismo para conservarla.

Medido con `npm run build` + gzip real de `dist/assets/*`, el `modulepreload` de `dist/index.html`,
`EXPLAIN (ANALYZE)` con `SET ROLE authenticated`, y el cascarón servido con gzip en el Browser pane.

---

## Tabla antes / después

| Métrica | Antes | Después | |
|---|---:|---:|---|
| **Arranque web** (entry + vendors del `modulepreload` + CSS, gz) | **232.3 KB** | **173.3 KB** | −25 % |
| · chunk `index-*.js` | 73.4 KB gz | **46.6 KB gz** | −36 % |
| · chunk `vendor` (redux/immer/es-toolkit de recharts) | 30.2 KB gz | **0** (se fue a `vendor-recharts`) | −100 % |
| · `vendor-supabase` · `vendor-react` · `vendor-query` · `vendor-icons` | 50.2 / 46.4 / 13.7 / 10.5 | 50.4 / 45.2 / 13.4 / 10.1 | = |
| **Precache del service worker (primera visita)** | **155 archivos · 4 973 KB** | **15 archivos · 653 KB raw · 181 KB gz** | −87 % |
| **recharts en el arranque / al abrir Inicio** | 89 KB gz al entrar a Inicio | **0** (chunk aparte, en el ralentí) | fuera |
| **Login servido (transferido, desktop y móvil 375×812)** | 447 KB · JS+CSS 229 KB · DCL 55 ms | **396 KB · JS+CSS 178 KB · DCL 45 ms** | −11 % / −22 % |
| **Sell In consolidado** (2 años, red real) | 4 páginas · 31 919 filas · **2 486 / 1 143 / 845 ms** | 2 páginas · 7 650 filas pivotadas · **1 093 / 533 / 498 ms** | −55 % |
| · la consulta en Postgres | 184 ms por página | **6 ms** | −97 % |
| **Inicio** | **18 peticiones** · mediana 385-534 ms | **7 peticiones** · mediana 449-512 ms | −61 % de viajes, mismo reloj |
| · `v_fact_cliente_mes` (la lee Inicio, Comparador, Cobranza, móvil, cron) | **890 ms** | **0.12 ms** | −99.99 % |
| **xlsx (315 KB gz)** | sólo al exportar | igual | ya estaba bien |

Los milisegundos de red son de esta Mac contra Supabase (`us-east`), varias corridas; la primera de
cada tanda es en frío y se anota aparte. Las cifras de Postgres son `EXPLAIN ANALYZE` con `SET ROLE authenticated`.

---

## Qué cambió, por archivo

### 1 · Service worker y reparto de vendors — `vite.config.js`

**`manualChunks`.** El hallazgo grande: recharts 3 arrastra `@reduxjs/toolkit`, `immer`, `react-redux`,
`redux`, `reselect`, `decimal.js-light`, `es-toolkit`, `eventemitter3`… (~90 KB / 30 KB gz). Ninguno
encajaba en las reglas, así que caían en el chunk `vendor` — y el entry importa `vendor` por
`workbox-window`, de modo que **toda la maquinaria de las gráficas se descargaba en el arranque**,
incluso en la pantalla de login. Ahora van a `vendor-recharts` (perezoso). Igual con `iceberg-js` y
`tslib`, que son de `@supabase/*` y ahora van a `vendor-supabase`. El resto se llama `vendor-base`
(sólo workbox-window, 2.6 KB) para poder precachearlo por glob.

**Precache.** Era la app entera: 155 archivos / 4.9 MB descargados en segundo plano en la primera
visita — las ~130 pantallas lazy, recharts, xlsx, el mapa de México, `uploads.html`. Ahora
`globPatterns` deja **sólo el cascarón** (index.html, manifest, iconos, CSS, entry y los 5 vendors del
arranque): 15 archivos, 653 KB raw / **181 KB gz**, muy por debajo de la meta de 400 KB.

**`runtimeCaching`.** Todo lo demás entra por red la primera vez y se queda en cache:
- `/assets/*.js|css` → `CacheFirst` (`acteck-chunks`, 250 entradas / 60 días). El nombre lleva hash de
  contenido, así que un archivo nunca cambia bajo el mismo nombre: seguro por construcción.
- fuentes SF Pro → `CacheFirst` a un año (`acteck-fonts`).
- resto de estáticos → `StaleWhileRevalidate`.
- Se conservan tal cual: `registerType: 'prompt'` + el toast "Hay una versión nueva · Recargar" de
  `src/main.jsx`, `index.html` por `NetworkFirst`, y `uploads.html` por `NetworkOnly`.

### 2 · Gráficas al ralentí — `src/components/kit/GraficaLineasLazy.jsx` (nuevo), `kit/index.js`, `SellOutGlobal.jsx`

`kit/index.js` reexportaba `GraficaLineas`, así que cualquier pantalla con gráfica metía recharts
(114 KB gz) en su carga: **entrar a Inicio, la pestaña por defecto, lo descargaba antes de pintar**.
Ahora el kit exporta un envoltorio `lazy()`; el nombre y la API no cambian, así que **ninguna de las
30 pantallas que usan `GraficaLineas` se tocó**. `prefetchGraficas()` (llamada desde `App.jsx` al
entrar) pide recharts en `requestIdleCallback`, de modo que cuando se monta una gráfica el módulo ya
está en memoria y React la pinta en el mismo frame. Si aún no llegó, el hueco tiene **exactamente** el
alto final (y el mismo `Panel` si lleva título): no hay salto de layout. Verificado en el build:
`Inicio`, `VisionGeneral`, `HomeClienteV3` y `MovilApp` ya **no** importan `vendor-recharts`.

### 3 · Chunk de arranque — `PanelAvatar.jsx`, `NavShell.jsx`, `Topbar.jsx`, `App.jsx`, `lib/montajeDiferido.js` (nuevo)

De 73.4 a 46.6 KB gz sacando lo que sólo aparece al hacer clic:

- **Panel del avatar**: el botón y su contador están siempre en pantalla, así que arrastraban
  `CambiarFoto` (16 KB), `PreferenciasHoja` (15 KB), `PestanaYo`, `PestanaDatos` y el centro de
  notificaciones — ~70 KB de fuente. Ahora son `lazy()`, y `prefetchPanelAvatar()` los pide al pasar
  el ratón por el avatar (y al abrirlo por teclado/evento), así que en la práctica ya están cargados.
- **Paleta ⌘K y hoja de atajos**: estaban montadas siempre con `abierto={false}`. Ahora perezosas, con
  `prefetchFlotantes()` al montar NavShell.
- **Barril `./perfil`**: `Topbar` importaba `{ PanelAvatar } from './perfil'`; rollup no poda los
  re-exports de módulos locales, así que el barril volvía a meter `CambiarFoto` y `PreferenciasHoja` en
  el arranque. Import directo. Lo mismo con `./components` en `App.jsx` (arrastraba `Sidebar` y las 8
  tarjetas legacy) → import directo de `OfflineBadge`.
- `BandejaAlertas` (sólo en Resumen y en el Home de cliente) y `SetPasswordPage` (sólo en
  `#/set-password`) pasan a `lazy()`. Se quitaron los imports muertos de `MobileNav` y `MobileShell`.

**`src/lib/montajeDiferido.js`** existe por el detalle que casi se escapa: estos paneles animan la
entrada con `abierto: false → true` (`Overlay` funde el velo, `HojaLateral` desliza). Un componente
perezoso que se monta ya con `abierto=true` **aparece de golpe, sin animación**. `abrirDiferido()`
baja el módulo, lo monta **cerrado** forzando ese pintado (`flushSync`) y lo abre en el frame
siguiente: la transición queda idéntica a como estaba. Cuesta un frame (~16 ms) la primera vez.

### 4 · Sell In consolidado — `supabase/migrations/20260912_perf_sellin_global.sql`, `SellInCliente.jsx`, `movil/pestanas/sellin/datos.js`

MV **`mv_sellin_global_sku_canal_anio`** + vista `v_sellin_global_sku_canal_anio`: una fila por
`sku × canal × es_clave × AÑO` con los 12 meses **pivotados en dos arrays** `piezas[12]` / `monto[12]`.
31 919 filas → 7 650 (una página por año en vez de dos, sin `count=exact` extra) y la consulta pasa de
184 ms a 6 ms. El hook vuelve a expandir los arrays a la forma fila-por-mes **exacta** que ya
consumían los agregados, así que la lógica de la pantalla no cambió ni una línea. `null` en el array
significa "ese mes no tenía fila", que es justo lo que hacía la vista vieja. Comprobado contra la
vista viva: **31 919 filas idénticas, 0 diferencias**, y los totales cuadran al peso
(2026: 393 588 782.53 / 937 617 pz). Se aplicó también a la pantalla móvil de Sell In.
La refresca `refresh_facturacion_clientes()` (`REFRESH ... CONCURRENTLY`).

### 5 · Inicio — `supabase/migrations/20260912_perf_inicio_datos.sql`, `20260912_perf_fact_cliente_mes.sql`, `useInicioData.js`

- **`v_fact_cliente_mes` sobre MV** (`mv_fact_cliente_mes`): era un `GROUP BY` vivo con
  `count(DISTINCT sku)` sobre `facturacion_clientes` para devolver 192 filas → **890 ms → 0.12 ms**.
  Mismo nombre y mismas columnas, así que se benefician sin tocar nada Inicio, el Comparador de
  periodos, Crédito y Cobranza, Propuestas, Resumen de Clientes, dos pantallas móviles y `api/cron.js`.
  Se refresca donde ya se refrescan las otras 6 MV de la misma fuente.
- **RPC `inicio_datos(p_anio, p_dias, p_pesados)`**, `SECURITY INVOKER` (respeta RLS). Devuelve 14 de
  las 18 lecturas en un JSON; las 5 opcionales van cada una en su bloque con `EXCEPTION` para que un
  perfil sin `GRANT` sobre una tabla reciba `[]` en vez de tumbar la llamada entera (mismo criterio que
  `opcional()` en el hook — sin esto, un solo *permission denied* invalidaba todo el JSON).
- **`p_pesados` existe por una medición incómoda**: dentro de una función plpgsql las consultas van
  **en serie**. Metiendo las 18 dentro, el JSON tardaba **~870 ms**, más que las 18 peticiones en
  paralelo (~600 ms). Con `p_pesados => false` la función omite las cuatro vistas vivas caras
  (`v_sellout_dicotech_mensual` ~380 ms, `v_sellout_pcel_mensual` ~290 ms, `v_medidas_inventario`
  ~200 ms, `v_sellout_digitalife_mensual` ~30 ms) y también `inv`/`transito` (rápidas de leer pero el
  90 % de los bytes, y serializarlas a jsonb retrasaba todo lo demás). El hook las pide en paralelo
  junto a la RPC: **7 peticiones en vez de 18**, y el reloj lo marca la más lenta, no la suma.
  La RPC sola tarda **78-131 ms**.
- `useInicioData` intenta el camino rápido y, si algo falla, **cae al camino de siempre**, que quedó
  intacto justo debajo.

### 6 · Prefetch inteligente — `src/lib/prefetch.js` (nuevo), `App.jsx`

El prefetch anterior bajaba ~16 chunks fijos (todas las pantallas del cliente + 9 globales) y competía
con la pantalla que se estaba abriendo. Ahora `siguientesPantallas({ pagina, clienteActivo, movil })`
devuelve **las 2-3 más probables desde donde está el usuario** (Inicio → Visión General y Agenda ·
Agenda → Inicio · Home de cliente → su Sell In y su Sell Out · Sell In → Sell Out · Pagos → Cobranza…),
de una en una, en `requestIdleCallback`, tras 1.2 s de respiro. `redLimitada()` corta el prefetch con
`connection.saveData` **y** en `slow-2g`/`2g`/`3g`.

### 7 · Móvil — `movil/piezas/ListaAgrupada.jsx`, `lib/avatar.js`

- `ListaAgrupada` aplica `content-visibility: auto` + `contain-intrinsic-size: auto 52px` (el alto real
  de `Fila`) **sólo a partir de 50 filas**: el navegador se salta layout y pintado de lo que está fuera
  de pantalla y la barra de scroll sale bien desde el primer frame.
- `AvatarImg` ya tenía `width`/`height` fijos; se le añadió `loading="lazy"` + `decoding="async"`.
- Revisado con `grep`: `src/movil/` **no importa ninguna pantalla de la web**, sólo helpers
  (`config.js`, `calculo.js`, `datos.js`). El mapa de México (89 KB / 33 KB gz) **no entra al móvil**
  (comprobado en el grafo de chunks del build).

### 8 · Medición del cascarón

`dist/` servido con gzip en `localhost`, medido con `performance.getEntriesByType('navigation'|'resource')`
en la pantalla de login (no hay sesión), en desktop y en 375×812:

| | Antes | Después |
|---|---:|---:|
| recursos | 11 | 11 |
| JS + CSS transferidos | 229.1 KB | **178.1 KB** |
| total transferido (con las 3 fuentes SF Pro, 217 KB) | 447 KB | **396 KB** |
| DOMContentLoaded / load | 55 ms | **45 ms** |
| `vendor-recharts` en la carga | — (no estaba) | no |

---

## Qué quedó fuera, y por qué

- **Meta de 150 KB gz en el arranque**: se llegó a **173.3**. Lo que queda es irreducible sin riesgo:
  `vendor-react` 45.2 y `vendor-supabase` 50.4 (supabase-js v2 empaqueta realtime/storage/functions sin
  tree-shaking oficial) son 96 KB de los 173. **Probado y descartado**: quitar la regla `vendor-icons`
  para que rollup reparta los iconos por pantalla dejó el arranque **peor** (175.5 KB) porque los
  iconos acaban en un chunk común igualmente.
- **Los 3 modos de menú y `LoginPage` siguen estáticos.** Cargar sólo el modo activo ahorraría ~5 KB gz
  pero mete una petición **antes del primer pintado** para quien no use el modo por defecto; y
  `LoginPage` es literalmente la primera pantalla del que no tiene sesión. No compensa.
- **Las 3 vistas de sell out mensual y `v_medidas_inventario` siguen vivas** (~900 ms sumadas, ~380 ms
  en paralelo): hoy son el suelo de Inicio. `v_sellout_dicotech_mensual` y `v_sellout_digitalife_mensual`
  se pueden materializar sin riesgo (dependen sólo de `sellout_detalle` / `sellout_general`, que ya
  disparan `refresh_mv_sellout_unificado`). **`v_sellout_pcel_mensual` no**: su `monto` depende de
  `precios_sku` vía `v_precio_pcel_sku`, y los precios se cargan cada hora por un camino que **no**
  refresca las MV de sell out — materializarla daría montos viejos. Queda pendiente con esa condición.
- **No se pudo medir con sesión iniciada.** No hay credenciales y no debo escribir contraseñas, así que
  las pantallas internas (Inicio, Sell In) se midieron contra la base de datos y en el build, no
  cronometrando la UI real. El cascarón sí se midió en el navegador.
- **El service worker no se pudo verificar en ejecución** desde el Browser pane (el registro falla en
  ese entorno, `navigator.serviceWorker.controller === null`, igual antes que después). Las cifras de
  precache son las del manifiesto que imprime el build, que es lo que el SW descarga.
- **`scripts/test-pagos-nc.mjs` falla**, pero es ajeno a esta pasada: apareció sin versionar en el
  worktree durante la sesión (junto con `src/modules/comercial/pagosv3/` y tres migraciones
  `20260912_pagos_v3_*`), prueba un lector de PDF que no toqué, y falla porque no consigue extraer
  texto del PDF de ejemplo. Los **103 tests restantes pasan**.

## Migraciones aplicadas

- `supabase/migrations/20260912_perf_sellin_global.sql` — MV + vista del Sell In pivotado, y
  `refresh_facturacion_clientes()` actualizada para refrescarla junto con `mv_fact_cliente_mes`.
- `supabase/migrations/20260912_perf_fact_cliente_mes.sql` — `mv_fact_cliente_mes` + la vista encima.
- `supabase/migrations/20260912_perf_inicio_datos.sql` — RPC `inicio_datos(integer, integer, boolean)`.

Sólo vistas, MV, funciones e índices. **Ningún dato se tocó.**
