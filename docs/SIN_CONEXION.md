# Sin conexión · visitas a clientes (2026-09-22)

Fernando visita clientes donde el internet es malo o simplemente no hay. Tres promesas:

1. **Nada de lo que se captura se pierde** → *Buzón de salida*.
2. **Lo que ya se vio abre sin red** → *Modo visita* + service worker.
3. **Las pantallas pesadas bajan menos** → recortes medidos.

---

## 1 · Buzón de salida (`src/lib/buzon.js`)

Cola de escrituras pendientes en IndexedDB (`idb-keyval`, llave `acteck-buzon-v1`).

### Cómo funciona

```
escribir({ tabla, op, filas, match, origen, onConflict, titulo })
```

1. Si hay señal, se intenta la escritura real con **tope de 6 s**.
2. Si falla por red (o `navigator.onLine === false`), la fila se guarda en la cola y la
   pantalla resuelve **optimista**: en un `insert` devuelve la fila con un id temporal
   `tmp_…` y `_pendiente: true`. Toast: *"Guardado en el dispositivo · se sincroniza al
   volver la señal"*.
3. Un error **de datos** (RLS, constraint, columna inexistente) NO se encola: se propaga
   para que la pantalla lo enseñe. Lo decide `esErrorDeRed()`.

`op` ∈ `insert` · `update` · `upsert` · `delete` · `rpc`.
`match` = `{ columna: valor }` (igualdad) o `{ columna: { in: [...] } }`.

### Sincronización

`sincronizar()` corre al evento `online`, al foco de la app, cada 60 s y al tocar la
pastilla. Aplica la cola **en orden de llegada (FIFO)** y:

- guarda el mapa `tmp_… → id real`, y **sustituye los ids temporales** en todo lo que venía
  después (una subtarea creada sin señal acaba apuntando al id real de su tarea);
- **se detiene en el primer fallo** para no desordenar el historial (una edición no puede
  subir antes del alta que la creó). El elemento queda con `error` e `intentos`;
- si un elemento depende de un `tmp_…` que ya no existe (se descartó el alta), no se manda
  a ciegas: se marca con *"depende de algo que ya no existe"*;
- al subir algo llama `invalidateDataCache()` (App.jsx) y avisa con un toast.

### Qué está enganchado hoy

| Pantalla | Archivo | Escrituras |
|---|---|---|
| Agenda / minutas | `src/modules/agenda/datos.js` | crear/editar/borrar ítem, crear/editar reunión, cerrar reunión (RPC), puntos de la minuta, comentarios |
| Proyectos y abasto | `src/modules/comercial/proyectos/datos.js` | proyectos y líneas (alta, edición, baja, upsert, reservar) |
| Marketing (web y móvil) | `MarketingCliente.jsx`, `movil/pestanas/MarketingForm.jsx`, `movil/pestanas/MarketingCliente.jsx` | alta/edición/baja de actividad y cambio de estatus |
| Pagos | `src/modules/comercial/pagosv3/datos.js` | `cambiarEstado` + su bitácora |

**Fuera del buzón a propósito:** subidas a Storage (foto de marketing, PDF de nota de
crédito) y los RPC de configuración (`set_preferencias`, `purgar_auditoria_admin`), que no
son captura de campo. Subtareas y cuentas de seguimiento siguen por la vía directa.

### Lo que ve el usuario

- **Pastilla** en el chrome web (`Topbar → ChromeDerecho`) y en la barra superior del móvil
  (`movil/menu/BarraSuperior`): `src/components/BuzonPill.jsx`.
  Se esconde cuando hay señal y la cola está vacía. Textos: *"Sin conexión"* ·
  *"Sin conexión · 3 por sincronizar"* · *"Sincronizando…"* · *"2 sin sincronizar"* (rojo).
- **Hoja** (`src/components/BuzonHoja.jsx`, perezosa): lista los cambios en orden con su
  hora y origen, marca cuál es el siguiente en subir, muestra el error y ofrece
  **Reintentar** (todo) y **Descartar** (uno).
- **Toast persistente** (`ms: 0`) *"1 cambio no se pudo sincronizar"* cuando aparece un
  error nuevo; se arranca y se escucha en `src/App.jsx`.

### API

```js
import { escribir, sincronizar, useBuzon, arrancarBuzon } from '../lib/buzon';
const { pendientes, sincronizando, ultimoError, items, online } = useBuzon();
```

Pruebas: `node --test scripts/test-buzon.mjs` (15). El almacén se inyecta con
`configurarAlmacen({ leer, escribir })` — un `Map` en las pruebas — y el aplicador de red
con el parámetro `aplicar`. Por eso `buzon.js` **no importa `./supabase` ni `idb-keyval` de
forma estática**: ambos entran por `import()` perezoso. Si se añaden imports estáticos de
módulos que usan `import.meta.env`, la prueba deja de cargar en Node.

---

## 2 · Modo visita (`src/lib/modoVisita.js`)

Botón **"Preparar visita"** (icono de descarga) en:

- web · Resumen del cliente (`HomeClienteV3.jsx`, dentro del Hero);
- móvil · ficha de cliente (`movil/pestanas/FichaCliente.jsx`, sólo clientes propios).

Componente: `src/components/BotonPrepararVisita.jsx` (barra de progreso dentro del propio
botón). Al terminar: *"Listo para visitar sin conexión · datos al 14:32"*. Recuerda en
`localStorage` cuándo se preparó cada cliente y lo enseña en la etiqueta.

### Qué baja (7 pasos)

1. **Resumen** — `cargarHomeData()` del Home V3: estados de cuenta y su detalle, pendientes,
   minutas, marketing del año, pagos pendientes, `v_inventario_comercial`, sell-out del
   cliente, inventario del cliente y el mapa sku → marca.
2. **Sell In** — `facturacion_clientes` del cliente (2 años, los dos `select` que usan las
   tres pantallas), `roadmap_sku` y `cuotas_mensuales`.
3. **Sell Out** — la receta del cliente: `v_sellout_digitalife_*` / `v_sellout_dicotech_*`
   (+ `sellout_general` de Dicotech) / `v_sellout_pcel_*`, y `v_sellout_detalle_sku_mes`.
4. **Inventario del cliente** — `inventario_cliente`, `inventario_cliente_sucursal`,
   `v_inventario_comercial`, `v_transito_sku`.
5. **Listas de precios** — `v_estrategia_precios_lista` (las 10 listas, ~9.6 K filas) y
   `precios_sku`.
6. **Propuestas recientes** — `propuestas_borradores` del cliente (50).
7. **Reuniones y minutas** — `agenda_items`, `agenda_reuniones`, `agenda_item_comentarios`,
   personas y las 5 últimas reuniones del cliente (misma consulta que `useMinutasCliente`).

Un paso que falla no detiene los demás: se avisa cuáles faltaron.

### Por qué funciona sin red

Dos capas, y la que de verdad aguanta es la segunda:

- **React Query** — se llaman las MISMAS funciones que usan las pantallas (`fetchAll` /
  `cachedQuery` de `lib/queries.js`, cuya llave es la URL de PostgREST), así que al abrir la
  pantalla la cache ya está caliente. Las llaves de hook del cliente
  (`facturacion_clientes`, `cuotas_mensuales`, `roadmap_sku`, `precios_sku`,
  `inventario_cliente`, `sellout_sku`, `agenda`…) se pasan a `gcTime` de **7 días** con
  `setQueryDefaults`, para que el persister de IndexedDB (`maxAge` 7 días) las conserve
  aunque nadie tenga la pantalla abierta.
- **Service worker** — esas consultas viajan por la red de verdad, así que el
  `runtimeCaching` de Workbox (`supabase-rest`, **NetworkFirst** con caída a cache,
  `networkTimeoutSeconds: 3`, 7 días) se queda con cada respuesta. Ésta es la capa que
  sobrevive a **recargar la app sin señal**: al repetirse la misma URL, el SW la sirve del
  disco. `maxEntries` se subió de 100 → **500** (una visita sola mete ~40 respuestas).

### Lo que NO se puede precachear

- **RPC de Supabase**: van por `POST /rest/v1/rpc/*` y la Cache API sólo guarda `GET`;
  Workbox además sólo enruta `GET`, así que pasan derecho a la red y fallan sin señal.
  Hoy el único RPC de **lectura** es `inicio_datos` (portada de dirección general,
  `src/modules/general/inicio/useInicioData.js`): esa pestaña no abre sin señal. Ninguna
  pantalla de cliente depende de un RPC. Si algún día hace falta, la salida es duplicar el
  RPC como vista (`GET`) o cachearlo a mano en IndexedDB desde `modoVisita.js`.
- **Storage** (`/storage/*`) y **auth** (`/auth/*`) son `NetworkOnly` a propósito: fotos de
  marketing, PDFs de notas de crédito y el refresco de sesión.
- La **sesión de Supabase** se guarda en `localStorage`, así que la app no pide login
  estando offline mientras el token no caduque; si caduca, no hay forma de renovarlo sin
  red y hay que volver a entrar.

---

## 3 · Pantallas más ligeras

### Inventario global — `inventario/useInventarioDatos.js`

`v_inventario_almacen_medida` tiene **10 066** filas, de las que sólo **2 603** entran en
`[Inv Actual]` (`en_inv_actual = true`) — y "Sólo comerciales" es el estado por omisión de
la pantalla. Ahora el primer viaje pide únicamente ésas:

| | filas al abrir |
|---|---|
| antes | 10 066 |
| después | **2 603** (−74 %) |

Las 7 463 restantes se bajan con `cargarTodas()` (idempotente), y sólo cuando alguien las
pide: al pasar el Segmented a **"Todos los almacenes"** o al desplegar el panel
**"Fuera de venta"** (que arma su detalle por SKU con las filas en memoria). El resto de la
pantalla no cambió: `filasAlcance` ya filtraba por `en_inv_actual`.

### Sell In consolidado — `SellInCliente.jsx` (`clienteKey = null`)

Ya estaba resuelto en la pasada 3.21 y se verificó: la pantalla lee la MV
`v_sellin_global_sku_canal_anio` (**7 755** filas para 2025 + 2026, un año por página de
10 K) en vez de las **55 125** filas de `facturacion_clientes` de esos dos años — y los
arrays de 12 meses se expanden en el navegador a la misma forma fila-por-mes de antes.
El único toque a `facturacion_clientes` es `useAnioMinimo()`: `select('anio').limit(1)`,
**1 fila**. El drill por SKU (`sellin/DrillSku.jsx`) sí baja `facturacion_clientes` pero
sólo de ese SKU y sólo al abrirlo. **No había nada que cambiar.**

Sell Out consolidado ya venía de MVs (`mv_sellout_*`, ~9 K filas) desde 3.24.

---

## Comprobar

```bash
node scripts/verificar-deploy.mjs
npx vite build
node --test scripts/test-buzon.mjs
node --test scripts/test-pantallas-ssr.mjs
```

Para probar a mano: DevTools → Network → **Offline**, capturar una tarea en la Agenda
(aparece la pastilla y el toast), volver a **Online** y ver cómo se vacía la cola.
