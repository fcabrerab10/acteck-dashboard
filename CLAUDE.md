# acteck-dashboard — Contexto para Claude Code

## Proyecto

Dashboard web de administración de clientes para **Acteck** y **Balam Rush**. Permite a Fernando Cabrera y su equipo gestionar Sell In, Sell Out, Inventario, Pagos, Marketing, S&OP y Forecast por cliente desde una sola interfaz.

**URL live:** https://acteck-dashboard.vercel.app/
**Repo:** `fcabrerab10/acteck-dashboard`
**Deploy:** Vercel — auto-deploy desde `main`. Cada push a main despliega en ~60 segundos.

---

## Stack

- **Frontend:** React 18 + Vite + Tailwind CSS (+ estilos inline "Ferruteck": iOS blue `#007AFF`, hairlines, SF Mono para números)
- **Backend:** Serverless functions en `/api/` (Node.js, Vercel). Cron único en `api/cron.js`.
- **DB:** Supabase PostgreSQL (`hrhccvuhnedahznewgaj`) con RLS habilitado
- **Auth:** Google OAuth (principal) + email/password (fallback) vía Supabase Auth
- **Data layer:** React Query (persistido en IndexedDB) + helpers en `src/lib/queries.js`
- **Charts:** Recharts · **Icons:** Lucide React · **Excel:** SheetJS / xlsx-js-style (carga bajo demanda)

---

## Estructura del proyecto

```
acteck-dashboard/
├── public/uploads.html        — Uploader de fuentes de datos (SheetJS in-browser → /api/import-central)
├── index.html                 — Shell. NO agregar <script> síncronos aquí (ver Rendimiento)
├── vite.config.js             — manualChunks por vendor (función) + PWA/service worker
├── src/
│   ├── App.jsx                — Routing por estado. TODAS las pantallas son React.lazy (ver Rendimiento)
│   ├── lib/
│   │   ├── supabase.js        — Cliente Supabase + DB_CONFIGURED
│   │   ├── queryClient.js     — QueryClient (staleTime 5 min, gcTime 30 min) + persister IndexedDB
│   │   ├── queries.js         — fetchAll / fetchAllQ / cachedQuery / invalidateDataCache + hooks useX
│   │   ├── constants.js, utils.js, permisos.js, themeContext.js, themeTokens.js
│   ├── components/            — Topbar, MobileShell, loaders, tarjetas, Mobile* (pantallas móviles)
│   └── modules/
│       ├── auth/, configuracion/, settings/, interno/, general/
│       └── comercial/         — Home*, SellIn*, SellOut*, PagosCliente, ForecastClientesTab (S&OP),
│                                PropuestasTab, ForecastReservas, VisionGeneral, EstrategiaPrecios, …
├── api/
│   ├── import-central.js      — Upsert por chunks. Whitelist de tablas + unique keys. Acepta JWT super_admin o x-sync-secret
│   ├── cron.js                — Tareas programadas (vercel.json)
│   ├── _embarques.js          — Transformaciones Master Embarques (cron + bridge)
│   └── admin/
├── bridge/                    — Puente SQL Server/Sheets → Supabase que corre en la Mac mini (docs/SYNC_SQL_BRIDGE.md)
├── supabase/migrations/       — SQL versionado (tablas, vistas, constraints)
└── .env.local                 — Variables locales (NO commitear)
```

---

## Clientes

| ID interno | Nombre display | Marca | Nombre en ERP (`facturacion_clientes.cliente_nombre`) |
|------------|---------------|-------|-------------------------------------------------------|
| `digitalife` | Digitalife | Acteck / Balam Rush | `API GLOBAL` / `CAJADL01` |
| `pcel` | PCEL | Acteck | `PC ONLINE` |
| `dicotech` | Dicotech | Acteck / Balam Rush | `DICOTECH` (REVKO) |

Los demás clientes del ERP (CVA, CT, PCH, Amazon, Mercado Libre, Cyberpuerta…) no tienen tab propio: caen a `cliente_key` = slug del canal (`mayoreo`, `distribuidor`, `e_commerce`, `mostrador`, `retail_*`). Sell In tiene un toggle "Todos los canales" para verlos consolidados.

---

## Base de datos Supabase

**Project ref:** `hrhccvuhnedahznewgaj` · **URL:** `https://hrhccvuhnedahznewgaj.supabase.co`

### Tablas de datos (se cargan por `uploads.html`; la app NO las escribe)

`facturacion_clientes` (sell-in canónico), `sellout_general`, `sellout_detalle`, `sellout_pcel`, `inventario_acteck`, `precios_sku`, `embarques_compras` (UNIQUE por `po,codigo,arribo_cedis,shp_qty`), `estados_cuenta*`, `compras_oc`, `guias_erp`, `programacion_arribos`, `proveedores_master`, `catalogo_articulos`, `estados_resultados`.

Vistas clave: `v_transito_sku` (tránsito por PO, capado por `po_qty - llegado`), `v_inventario_comercial` (usa `almacenes_config.comercial = true`), `v_estrategia_precios_lista` (1 fila por sku+lista, precio más reciente), `v_vision_*`.

Almacenes comerciales (fuente única `almacenes_config`): `1, 2, 3, 6, 9, 12, 14, 15, 16, 17, 19, 25, 44, 64, 71`.

### Ventas del ERP y medidas del director (2026-09-09)

- `erp_ventas` = `Vw_TablaH_Ventas` renglón a renglón (PK `venta_id, venta_renglon`, ~176K filas 2025-2026, 35 columnas). Sustituye a `ventas_erp` (vieja, sin cargar desde jul-2026; no borrar aún). `cliente_key` sigue la regla de `facturacion_clientes` (digitalife/pcel/dicotech o slug del canal).
- Se carga desde `uploads.html` (tarjeta ERP, clave `streamed`) con `public/xlsx-stream.js` + `public/fflate.min.js`: lee el zip por streaming porque SheetJS no puede abrir esa hoja (519 MB de XML). Replace por año, envío paralelo (`postChunksFast`). Lectura ≈ 25 s en navegador, 6 s en Node.
- `v_erp_medidas` (grano anio, mes, cliente_key, cliente_nombre, canal, articulo, marca) y `v_erp_medidas_mes` traducen literal las medidas DAX del director (Fact Bruta/Neta, Devoluciones, RMA's, Bonificaciones, Venta Neta, Costos, Contribución, Utilidad Comercial, Piezas, CV últimos 3 meses, YTD). Validadas al peso contra el Excel (Fact Neta ene-2026 = 57,534,140). Los % (MC, MUC, Lost Profit) se calculan al agregar, nunca se suman.
- **Fase 3 (misma fecha):** `facturacion_clientes` ya NO viene del pivot del Excel: la reconstruye `refresh_facturacion_clientes(anios)` desde `erp_ventas` (monto = Fact Neta oficial; piezas = unidades de facturas + devoluciones, sin bonificaciones). La llama `import-central` con `finalize:'refresh_facturacion_clientes'` al terminar la carga de erp_ventas; también refresca `mv_erp_medidas_cliente_mes`. Fernando validó el cuadre en producción el 2026-09-09 (respaldo del pivot ya borrado).
- Rentabilidad en pantalla: `src/modules/comercial/RentabilidadBloque.jsx` (Visión General global vía `v_erp_medidas_mes`; Sell In por cliente vía `v_erp_medidas_cliente_mes`). Ambas vistas leen la MV (ms); la vista viva por SKU `v_erp_medidas` tarda ~1.5 s y el rol anon la cancela a 3 s: no usarla desde la app sin filtro.
- Migraciones: `20260909_erp_ventas_medidas.sql` (tabla + vistas) y `20260909_facturacion_desde_erp.sql` (función, MV, vistas mensuales).

### Puente SQL en la Mac mini (2026-09-09)

`bridge/` corre en la Mac mini de la oficina y sustituye las cargas manuales de Ventas/Inventario/Precios (SQL `192.168.0.151`), Cuotas (`192.168.0.213`), Sell Out General (`192.168.0.160`) y Master Embarques (Google Sheets). Lee las vistas con `mssql`, mapea con réplicas de los parsers de `uploads.html` (`bridge/lib/mappers.mjs` — si cambia uno, cambiar el otro) y escribe directo en Supabase por PostgREST con el service role key (`bridge/lib/api.mjs`: upsert, replace, `refresh_facturacion_clientes`, refresh de MVs, `sync_events`/`sync_status`). Sin key cae al modo vía `POST /api/import-central` con header `x-sync-secret` (`SYNC_SECRET` en Vercel, `isSyncRequest()` en `api/_auth.js`; body `{ table, syncEvent }` para la bitácora). Cuotas: `192.168.0.213` base `RevkoBi` tabla `dbo.BP`; sell out: `192.168.0.160` base `SELLOUT`. Transformaciones del Master Embarques compartidas en `api/_embarques.js` (las usa también `api/cron.js`). Credenciales en `bridge/credenciales.env` (lo crea `bridge/setup.sh`, ignorado por git). Horarios en `bridge/launchd/`. Guía: `docs/SYNC_SQL_BRIDGE.md`.

### Importador central (2026-09-11)

Configuración → Actualización de datos (`src/modules/settings/ActualizacionDatos.jsx` + `importador/`) es el importador: cargas automáticas del puente (latido `sync_status.puente`, cola `sync_solicitudes` que atiende `bridge/sync.mjs solicitudes` cada 5 min, log) y cargas manuales por grupo con anillo de frescura por cadencia (lunes: Digitalife/Dicotech/EdC · martes: PCEL · día 10: P&L · día 3: Revko · Roadmap cuando cambie). Parsers de las fuentes manuales: `src/lib/parsers/` (fuente de verdad; `public/uploads.html` es respaldo técnico, sin la tarjeta ERP). Cuotas y Master Embarques se suben a mano sólo desde `uploads.html?fuente=<id>`. Tras un cambio en `bridge/launchd/*.plist`, en la Mac mini: `git pull` + `./launchd/install.sh`.

### Tablas que la app SÍ escribe (cuidado con la cache — ver Rendimiento)

`pagos`, `sync_solicitudes` (Pedir corrida), `pendientes*`, `minutas`, `inversion_marketing`, `marketing_actividades`, `fondos_*_movimientos`, `propuestas_borradores`, `spiffs`, `lineamientos_cliente`, `forecast_propuestas*`, `forecast_avisos`, `sugeridos_compra`, `solicitudes_compra*`, `oc_*`, `perfiles`, `cuotas_mensuales`, `roadmap_sku`, `sellout_sku`, `inventario_cliente`, `ventas_mensuales`, `clientes_credito_config`, `evaluaciones*`, `eventos_*`.

### Acceso directo a la BD desde Claude Code

`.env.local` tiene `SUPABASE_ACCESS_TOKEN` (Management API: `POST https://api.supabase.com/v1/projects/hrhccvuhnedahznewgaj/database/query`) y `SUPABASE_SERVICE_ROLE_KEY`. Usar solo para diagnóstico/migraciones; nunca exponer en código ni commits. Toda migración aplicada a mano se guarda también en `supabase/migrations/`.

---

## Rendimiento — reglas (2026-09-08)

Se partió el bundle y se centralizó la carga de datos. Arranque: ~1,067 KB gz → ~177 KB gz. Estas reglas evitan regresiones:

1. **Pantallas nuevas = lazy.** En `App.jsx`: `const X = lazy(() => import('./modules/…/X'))` y el archivo debe tener `export default`. Nunca importar pantallas estáticas ni vía el barrel `modules/comercial/index.js` (arrastra todo al chunk inicial).
2. **Nada síncrono en `index.html`.** Excel se carga bajo demanda: `loadSheetJS()` (utils.js) o `await import('xlsx-js-style')` dentro del handler de exportar. No volver a poner SheetJS en el `<head>`.
3. **Carga de datos SOLO por `src/lib/queries.js`:**
   - `fetchAll(table, select, filtro)` y `fetchAllQ(qFactory, { pageSize, orderCol })` — paginación **paralela** (count exact + 5 páginas en vuelo), retries, y **cache 5 min por URL** (dedupe + IndexedDB). No escribir bucles `while(range)` en módulos.
   - `cachedQuery(builder)` para lecturas puntuales (`.single()`, `.limit()`). Solo cachea GET.
   - **No envolver con `cachedQuery` tablas que la app escribe** (lista arriba). Si una tabla escrita por la app se lee vía `fetchAll`/hooks (`cuotas_mensuales`, `roadmap_sku`, `sellout_sku`, `inventario_cliente`, `ventas_mensuales`), llamar `invalidateDataCache()` justo después del `insert/update/upsert/delete`.
4. **Vendors** se reparten en `vite.config.js` con `manualChunks` como función (react / recharts / xlsx / supabase / query / icons). Mantenerla como función; la forma objeto dejaba React fuera de su chunk.
5. **Medir antes de afirmar:** `npx vite build` y gzip de `dist/assets/*.js`; el arranque real = entry + `modulepreload` de `dist/index.html`. Perfil `preview-dist` en `.claude/launch.json` sirve el build para verificar en el Browser pane.

Pendientes conocidos de rendimiento: agregar en Postgres (vistas/RPC) lo que hoy se agrega en JS desde `sellout_general` (360K filas), `sellout_detalle` y `facturacion_clientes`; recortar `select('*')` en `v_vision_*`.

---

## Funcionalidad transversal (2026-09-10)

- **Exportar:** `src/lib/exportar.js` (`exportarExcel` con xlsx-js-style bajo demanda, `exportarPDF` = ventana de impresión "como se ve", `tablaDesdeDOM`) + `src/components/ExportMenu.jsx` (pill Excel/PDF). Ya está en Sell In, Visión General, S&OP, Pagos, Inventario, Sell Out, Análisis de clientes y Cobranza. Para otra pantalla: `ref` en la raíz + `<ExportMenu titulo subtitulo excel={…} pdf={{ ref }} />`.
- **Comparador de periodos:** `src/modules/comercial/ComparadorPeriodos.jsx` (`clienteKey` null = global). Fuentes: `v_fact_cliente_mes` / `v_facturacion_global_mensual`, medidas de `v_erp_medidas_*`, movers por SKU lazy. Montado en Sell In (V2 y global).
- **Historial de cambios:** tabla `auditoria_cambios` + trigger `fn_auditoria()` en 36 tablas que la app escribe (migración `20260910_auditoria_cambios.sql`; no audita `sellout_sku`, `inventario_cliente`, `eventos_usuario`). Pantalla `src/modules/interno/HistorialCambios.jsx`, permiso global `historial_cambios` (super admin lo ve siempre). Retención: `purgar_auditoria(dias)`.
- **Alertas:** tabla `alertas` + task `generar-alertas` en `api/cron.js` (diaria) + `src/lib/alertas.js` (`useAlertas`, resolver/posponer) + `src/components/BandejaAlertas.jsx` (bandeja "Qué atender hoy" y `BadgeAlertas` del Topbar). Reglas: stock vs tránsito, cuota en riesgo, devoluciones anormales, rebate por generar, datos sin actualizar.
- **Ferruteck 2 (aprobado 2026-09-10: hero negro en todas, radios 12).** Kit en `src/components/kit/` (Hero/HeroStat, KpiCard, Pill/DeltaPill, Segmented, TablaCompacta, HeatCell, Panel, Boton, Skeleton, toast/ToastHost) + `src/lib/motion.js` (EASE iOS, DUR tap 140 / state 220 / content 260 / page 340 / exit 160). `PageTransition` ya hace salida + entrada; hijos de `<div data-stagger>` entran con desfase 60 ms. Plantilla obligatoria por pantalla: Hero narrativo → 3-4 KpiCard → detalle → secundario en Panel plegable. **Pantallas migradas:** Pagos (`PagosCliente.jsx` + `pagos/`), Marketing (`MarketingCliente.jsx` + `marketing/`; `MarketingClienteV2.jsx` queda como respaldo sin uso), Inventario global (+ `inventario/`), Crédito y Cobranza V2, Visión General (tokens y radios, misma estructura Bento). Pendientes: Estado de Resultados, Configuración, móviles y el resto según `node scripts/auditar-colores.mjs` (reporte en `docs/AUDITORIA_COLORES.md`). Regla: pantalla nueva o migrada se arma sólo con el kit; nada de Tailwind de color ni hex fuera de constantes de paleta; `alert()` de éxito → `toast.ok()`.

## V3 (2026-09-11) · estado

- **Ferruteck retirado** de la interfaz (copilot, tira de recomendaciones, loader). Código en `src/_archivo/ferruteck/` (no se compila). Loader único: `Cargando` del kit (silueta/skeleton, elegido por Fernando).
- **Sombras**: `src/lib/elevation.js` (`ELEV` reposo/hover/flotante, `elevation(theme, nivel)`); nada de `boxShadow` ad-hoc.
- **Versión**: `package.json` es la fuente (`VITE_APP_VERSION`); aviso de nueva versión por toast (SW en modo prompt). Ver Flujo de trabajo.
- **Home único**: `HomeClienteV3.jsx` + `home/` (config por cliente). Los 4 Home anteriores en `src/_archivo/home-v2/`.
- **Frescura de datos**: vista `v_fuentes_frescura` + `src/lib/frescura.js` + `src/components/FrescuraPill.jsx` (`<FrescuraPill pantalla="sellIn" clienteKey inverso />` dentro del Hero). Pendiente: colocarla en cada pantalla.
- **Limpieza**: ver `docs/LIMPIEZA_V3.md` (huérfanos borrados, `src/lib/format.js` como fuente única de formato; migrar helpers duplicados al tocar cada pantalla). `ventas_erp` sigue en uso por Estrategia de Producto (PCEL) y fill-rates: no borrar.
- **3.1.0 (2026-09-11)**: menú de tres modos (`src/components/nav/`: BarraApple, SidebarIpad, BarraIphone, Paleta ⌘K, NavShell; preferencias en `perfiles.preferencias` vía RPC `set_preferencias`, store `src/lib/preferencias.js`); pestaña **Inicio** de dirección general (`src/modules/general/Inicio.jsx` + `inicio/`, Mes/Año, MV `mv_erp_medidas_canal_mes`); **central de notificaciones** estilo Centro iOS (`src/components/notificaciones/`, pilas por área, `resumen-programado` en cron a 09/13/18 CDMX con preferencias por usuario, `alertas.area/accion/caduca_at`, `notificaciones_lectura`); **perfil** con foto ilustrada (`src/components/perfil/`, `api/avatar.js`, buckets `avatares`/`avatares-privado`, IA con `IMAGE_API_KEY`/`IMAGE_PROVIDER`, fallback selfie+fondo SVG) y panel rápido desde el avatar (PanelPerfil en Topbar; `UserMenu` viejo queda sin uso).
- **Piezas**: desde 2026-09-11 todas las medidas usan `COALESCE(unidades, piezas, 0)` (la carga del ERP del 09-10 trajo Unidades vacía). Migración `20260911_piezas_coalesce_unidades.sql`.
- **Cargas automáticas (puente SQL en la Mac mini, `bridge/`, en main desde PR #1):** ventas/inventario/precios cada hora 8-19 L-S y 06:30, cuotas y sell out a las 06:30, Master Embarques a las 07:00. Escribe directo en Supabase con service role y registra `sync_status`/`sync_events` como "Puente SQL (Mac mini)". **La tarjeta "Actualizaciones ERP" (Excel) y `public/xlsx-stream.js` quedan obsoletos**: no volver a proponer cargas manuales del ERP. Cambios en `bridge/` requieren `git pull` en la Mac mini. Página del importador: `src/modules/settings/ActualizacionDatos.jsx` (rediseño V3 pendiente de elección A/B/C).
- **3.2.0 (2026-09-10)**: Importador central dentro del dashboard (`src/modules/settings/ActualizacionDatos.jsx` + `importador/`; parsers compartidos en `src/lib/parsers/`; automáticas con latido y "Pedir corrida" vía `sync_solicitudes`; manuales por grupo con anillo de frescura y drag&drop). `uploads.html` queda sólo como respaldo técnico. Enlaces internos navegan a la página `actualizacion` (evento `acteck:navegar`). En la Mac mini: `git pull`, `npm ci` en bridge y `./launchd/install.sh` (agente de solicitudes cada 5 min + latido).
- **3.3.0 (2026-09-10)**: **app móvil desde cero** en `src/movil/` (MovilApp: Inicio con "Hoy" · Clientes · Alertas · Buscar · Más; ficha de producto con canasta de SKUs, lista de precios obligatoria, texto de WhatsApp en `src/lib/whatsapp.js`; los `src/components/Mobile*.jsx` viejos quedan sin uso, pendientes de archivar). **Siluetas de carga por pantalla** (`kit/siluetas.js`, `Cargando pantalla=`). **Chrome**: sidebar con tarjeta de perfil arriba y "acteck." al pie; pastilla derecha = buscar + avatar con contador; `PanelAvatar` con pestañas Avisos · Datos · Yo (`src/components/perfil/`); `UpdatePanel`/`BadgeAlertas` fuera del chrome. **Cadencias** de fuentes manuales en `fuentes_config` (editables en el importador): lunes+3 (Digitalife, PCEL, Dicotech, EdC), Revko martes+3, P&L día 10 (+10), Roadmap cuando cambie. iOS: `apple-touch-icon.png` + metas en `index.html`.
- **3.3.0 · Administración** (página `configuracion`; nodo "Administración" en el grupo Interno del menú, sin grupo Configuración ni nodo "Actualizar datos"; la fila del avatar → Yo se quitó). `src/modules/configuracion/`: Hero + Segmented **Usuarios y permisos** (dos columnas; permisos pestaña por pestaña con `TriNivel`, guardado al instante con `update perfiles.permisos` optimista + rollback, "aplicar a PCEL y Dicotech", "Copiar permisos de…", "Ver como" = `construirArbol(perfil)` en hoja lateral sin cambiar sesión) · **Datos** (reutiliza `PestanaDatos`) · **Notificaciones del equipo** (`PreferenciasNotificaciones` en modo controlado `valor/onGuardar` escribe `perfiles.preferencias.notif` del otro usuario; destinatarios del cron informativos) · **Sistema** (versión, `novedades.js`, estado de servicios, enlaces, retención de auditoría vía RPC `purgar_auditoria_admin(365)` — migración `20260910_purgar_auditoria_admin.sql`). Preferencias personales sólo en el avatar.
- **3.4.0–3.5.0 (2026-09-10)**: menú móvil con el árbol de la web (cajón lateral default · barra por grupos; `menu.modoMovil`); pantallas móviles: Visión General (+ "Compartir cierre" con pronóstico UAI = contribución − gastos promedio 3 meses del P&L), Análisis por Cliente (ficha híbrida, compartir limpio), Sell In/Sell Out de cliente (selector de mes, `HeatmapSku`, categorías; Sell In "Compartir avance" con cuota), Marketing (consulta + captura; fotos tras `FOTOS_ACTIVAS` cuando exista bucket `marketing`), Crédito y Cobranza (estado de cuenta + historial de cortes), Forecast (consulta), S&OP (canasta + export de compra compartible) y Propuestas (crear/editar/enviar). Lógica compartida extraída a `forecast/calculo.js`, `forecast/excelSOP.js`, `propuestas/*`. `src/lib/compartirArchivo.js` (navigator.share con archivos, iOS ≥ 15). **Pendientes móviles definidos por Fernando:** Sell Out general, Cobranza general, Tracking Pedidos (desde cero), Pagos (desde cero); Resumen de Clientes fuera del móvil.
- **Decisiones web (en curso, pestaña por pestaña):** Inicio = + bloque "Hoy" alimentado de Pendientes y Calendario (mejorar esa pestaña) + permiso "Información sensible" asignable en Administración (sin él no se ven márgenes/utilidad/contribución/costos; David Millán ve todo sin editar, Karolina sin sensible). Estado de Resultados = kit + Mes/YTD con comparativo + puente ventas ERP vs P&L, conservando todo; carga manual mensual; David lo ve completo. Visión General: pendiente de respuestas.
- Pendientes V3: archivar `src/components/Mobile*.jsx`, app móvil (usa la navegación iPhone), pantallas restantes al kit (Estado de Resultados, Configuración, Análisis, Estrategia, Forecast, S&OP, Propuestas), colocar `FrescuraPill` en cada pantalla, borrar `UserMenu`/`Sidebar.jsx` legacy, migrar helpers de formato a `src/lib/format.js`.

## Convenciones de código

- `formatMXN(n)` — Intl.NumberFormat es-MX, MXN, sin decimales · `formatFecha(str)` — 'YYYY-MM-DD' → 'DD Mes YYYY'
- EstrategiaProducto.jsx y MarketingCliente.jsx tienen `formatMXN` local (shadow intencional, no romper)
- Sin TypeScript — solo JSX + JS vanilla. Tailwind + estilos inline con `theme`/`TYPO`.
- Meses "cerrados" en Propuestas: siempre los 3 anteriores al actual (Fernando: "un día sin cargar no afecta").

---

## Variables de entorno (`.env.local`, no versionado)

```
VITE_SUPABASE_URL=https://hrhccvuhnedahznewgaj.supabase.co
VITE_SUPABASE_ANON_KEY=…
SUPABASE_SERVICE_ROLE_KEY=…
SUPABASE_ACCESS_TOKEN=…
```
En Vercel ya están configuradas (más SMTP y `CRON_SECRET` para el cron de avisos).

---

## Flujo de trabajo

```bash
npm install
npm run dev          # localhost:5173
npx vite build       # medir bundle
git push             # Vercel despliega desde main
```

**Versionado (desde V3, 2026-09-09).** La versión vive en `package.json` (`"version"`) y se **edita a mano** — `npm version` no se usa (crea tags/commits que no queremos). `vite.config.js` la inyecta como `import.meta.env.VITE_APP_VERSION` junto con `VITE_COMMIT` (hash corto); `src/lib/version.js` expone `versionLabel()` → "v3.0.0 · a1b2c3d", visible en el menú de usuario del Topbar, en Configuración y en Mobile › Yo. Regla: **cada deploy con cambios visibles sube la versión** — patch (3.0.x) ajustes y fixes · minor (3.x.0) pantallas nuevas · major (x.0.0) rediseños. El service worker está en modo `prompt`: al publicarse un build nuevo, `src/main.jsx` muestra el toast "Hay una versión nueva del dashboard · Recargar" (persistente hasta que el usuario recarga o lo cierra). El mismo `version+commit` sirve de buster del cache persistido de React Query.

**Dos máquinas (laptop + Mac mini) con la misma cuenta:** las sesiones y la memoria de Claude Code son locales por máquina; este archivo sí viaja con git. Trabajar cada máquina en su propia rama/worktree, hacer `git pull --rebase` antes de pushear y **no pushear a `main` desde las dos a la vez**. `.env.local` se crea a mano en cada máquina (no compartir por chat ni git).
