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
- **Estado de Resultados V3 (2026-09-11)**: `src/modules/general/EstadoResultados.jsx` + `resultados/` (datos.js · calculo.js puro con `scripts/test-resultados-calculo.mjs` · textos.js · Tendencia · TablaFormal · FichaMes · Puente). Kit completo (Hero con frase del mes, `FrescuraPill pantalla="estadoResultados"` + pill de cadencia día 10, alertas como pills que abren la ficha; Segmented año · mes · Mes/YTD; 4 KpiCard con Δ vs año anterior y pp en márgenes; TablaCompacta formal con grupos plegables, 12 meses, Mes vs mismo mes AA, YTD vs YTD AA y fila expandible con 24 meses en Recharts; ficha en `HojaLateral`; `ExportMenu` Excel (P&L + puente) y PDF). Toda la pestaña es sensible (`puedeVerSensible`, si no → `SinAcceso`). Nombres: "UAII" = `uafir_sin_proyectos` (UB − gastos), "UAI" = `uaii_contable_sin_proyectos` (tras financieros). **Puente ERP vs P&L**: la cuenta `venta_neta` del P&L (tasa general + tasa 0 % − devol/desc/bonif) cuadra con **Venta Neta** del ERP (±0.3 % en 2026); la Fact. Neta del ERP queda ~7–8 % arriba porque el P&L ya descuenta bonificaciones. La alerta (> 2 %) se evalúa contra Venta Neta del ERP; Contribución ERP vs Utilidad bruta P&L difiere 19–52 % (empaque, e-commerce, dev. s/compra). `v_fuentes_frescura` incluye `estados_resultados` (umbral 40 d; migración `20260911_estado_resultados_frescura.sql`).
- **3.21.0 (2026-09-12) · Capa canónica de medidas.** Las cifras de todas las pestañas salen ahora de las **medidas DAX del director** (Power BI), traducidas una sola vez. Catálogo: `docs/MEDIDAS_DIRECTOR.md`; auditoría de las incoherencias que había: `docs/AUDITORIA_MEDIDAS.md`.
  - SQL (`supabase/migrations/20260912_medidas_*.sql`): `parametros_medidas` (TC 17/20, base 90 d, bandera de Rama desconocida) + `almacenes_config.exclusivo` / `.inv_actual_extra` + MV `mv_articulo_rama` (Rama viene de `erp_ventas`, no de `catalogo_articulos`) · `v_medidas_ventas_mes` / `_cliente_mes` / `_canal_mes` / `_sku` (añaden lost profit, pérdida x dev/RMA, % MC Bruta, % MUC, ticket, utilidad promedio, CV 3 meses y YTD por cliente y canal, cuota y % alcance) · `v_medidas_inventario` (**una fila**: Inv Actual, Inv Total, Días de Inv, Días de Inv Total, Costo Promedio, Inv Promedio, Vueltas) + `_sku` / `_dia` / `_mes` + `v_medidas_compras` + `v_inventario_almacen_medida` (detalle SKU × almacén con `en_inv_actual` ya resuelto) · `v_medidas_cuota_mes` / `_cliente_mes` (+ columnas `cuotas_mensuales.cuota_piezas` y `.cuota_costo`, **pendientes de cargar por el puente**).
  - JS: **`src/lib/medidas.js`** es la fuente única de las derivadas (`derivadas()`, `agregar()`, `diasInventario()`, `cuotas()`, `mesesCerrados()`), de las etiquetas oficiales (`ETIQUETA`/`FORMULA`) y del tooltip `tooltip('pct_mc')` → "Medida: % MC · Contribucion / Fact Neta". Tests: `node --test scripts/test-medidas.mjs` (11). Hook `useMedidasInventario()` en `queries.js`. `KpiCard` y `HeroStat` aceptan `medida=`.
  - **Regla: los % NUNCA se suman ni se promedian** — se recalculan al agregar con `derivadas()`. Y `divide()` devuelve `null` (pinta `—`), no 0.
  - **Inventario comercial = `[Inv Actual]`** ($143.3 M · 709,653 pz) en Inicio, Visión General, Inventario global, S&OP, Estrategia de Precios y móvil. Antes había tres cifras: `Σ costoinventario` ($152.1 M, Inicio e Inventario global) y `Σ costodisponible` ($143.4 M, Visión General), ninguna con el filtro `Rama = PRODUCTO`. El Set `ALM_COMERCIALES` de `inventario/constantes.js` **ya no decide nada**: la regla vive en `en_inv_actual`.
  - **Cobertura**: había cinco fórmulas. La oficial es `[Dias de Inv] = Inv Actual / CV 3 meses CERRADOS × 90` (141 d hoy). Visión General dividía inventario a costo entre venta a precio; S&OP metía el mes en curso en su ventana de 3 meses (corregido a `slice(-4,-1)`). Donde el motor necesita otra (cobertura por SKU en piezas), se muestran **las dos con su etiqueta**.
  - **Dudas abiertas para Fernando** (§6 de `MEDIDAS_DIRECTOR.md`): el 2º término de `[Inv Actual]` está cortado en la captura (`Almacen[Almacen] = "4…"`, parametrizado en `inv_actual_extra`, hoy en 0); TC 17 vs 20; qué compras entran en `[Costo de Compra]`; si los SKUs sin Rama cuentan.

- **Apoyo comercial y equipo comercial (2026-09-12)**: migración `20260912_bonificaciones_concepto.sql` → `v_bonificaciones_concepto_mes` (bonificaciones por concepto: `erp_ventas` con `rama='SERVICIOS'`, cuadra al peso con `[Bonificaciones]`, −$34.4 M en 2026), `v_medidas_ventas_vendedor_mes` (mismas fórmulas que `_cliente_mes` + `clientes`) y `v_ventas_vendedor_cliente_mes`; las tres materializadas y refrescadas dentro de `refresh_facturacion_clientes()`.
  Se ven en **Sell In consolidado** (paneles plegables "Apoyo comercial" — Segmented Por concepto · Por cliente — y "Equipo comercial"), en el **Sell In de cada cliente** (V2/Dicotech/PCEL: panel de apoyo), en el **drill de Análisis por Cliente** ("Apoyo comercial del año") y en el **celular** (Sell In global y por cliente). Cálculo puro en `sellin/apoyo.js`, hooks en `sellin/datos.js`, pruebas en `scripts/test-sellin-ssr.mjs`.

- **Decisiones web (en curso, pestaña por pestaña):** Inicio = + bloque "Hoy" alimentado de Pendientes y Calendario (mejorar esa pestaña) + permiso "Información sensible" asignable en Administración (sin él no se ven márgenes/utilidad/contribución/costos; David Millán ve todo sin editar, Karolina sin sensible). Estado de Resultados = hecho (ver arriba); carga manual mensual; David lo ve completo. Visión General: pendiente de respuestas.
- **Propuestas V3 (2026-09-11)**: `PropuestasTab.jsx` es sólo el orquestador; las 4 vistas viven en `src/modules/comercial/propuestas/` (Landing, ElegirCliente, Armar + MiPropuesta + PrecioPicker, Revisar, TarjetaPropuesta, SpiffPanel) con el kit. Persistencia únicamente en `propuestas_borradores` (migración `20260911_propuestas_estado_lineas.sql`: `estado` ∈ borrador|enviada|cerrada en minúsculas, `lineas` jsonb canónico, `enviada_at`, `cerrada_at`, `folio` PRP-YYMM-NNN, `creado_por`, `anio/mes` objetivo; el trigger `fn_propuestas_sync` mantiene `propuesta` (mapa) para código viejo). Los recientes de localStorage se migran una vez y se borra la llave. Acceso a datos en `propuestas/recientes.js`; efectividad y cierre automático en `propuestas/efectividad.js` (ventana = mes siguiente al envío, + el mismo mes si se envió antes del día 15; enviada con ≥ 1 SKU facturado → cerrada al cargar la landing); resumen WhatsApp en `propuestas/textos.js` (sin costo ni lista). Margen/costo sólo con `puedeVerSensible`. El móvil (`src/movil/pestanas/Propuesta*.jsx`) lee/escribe `lineas` y los estados en minúsculas.
- **3.12.0 (2026-09-11) · Tracking Pedidos V3** (`src/modules/comercial/TrackingPedidos.jsx` orquestador + `tracking/`: `calculo.js` puro con tests `scripts/test-tracking-calculo.mjs`, `parserCorreoOC.js` con `scripts/test-tracking-parser.mjs`, `datos.js`, Embudo/TablaPedidos/DrillOC/Backorder/SurtirHoy/Tiempos/FacturasSinOC/FormOC/FormEnvio/FormCotizacion). Migración `20260911_tracking_v3.sql`: conserva `oc_*` (105 OCs de Karolina) y añade `oc_clientes.facturas[]/fuente/cotizacion_id`, `oc_cotizaciones`, `oc_facturas` + `oc_factura_skus`, `oc_envios.fuente/guia_erp_id/fecha_envio_erp/fecha_entrega_erp/fecha_elegida`, vista `v_erp_facturas_oc` (12 meses, ~90 ms) y RPC `oc_sincronizar_erp()` (idempotente, ~0.4 s; la llama la pantalla al cargar y el cron). Liga factura↔OC por referencia normalizada (`oc_liga_referencia`, mismo cliente, −15/+120 d) **o** por folio capturado en `facturas[]` (aunque el ERP tenga la factura en otro cliente → `cliente_key_erp`). Guías `guias_erp` por factura (movid) u OC; lo manual gana, desfase > 2 d se elige (`fecha_elegida`). Etapas derivadas cotización→recibida→facturada→enviada→entregada; detenida > 3 d en cotización/recibida/facturada. Alertas `oc_detenida`, `oc_backorder_sin_po`, `factura_sin_oc` (área `tracking`). **`guias_erp` sigue viniendo de la hoja "Guias" del Excel manual (`uploads.html`, última carga 2026-08-10): falta pasarla al puente** (ver docs/SYNC_SQL_BRIDGE.md). `MobileTrackingPedidos.jsx` sigue legacy.
- **Agenda (2026-09-11)**: pestaña `agenda` debajo de Inicio (permiso global `agenda`, migrado de `admin_interna`; `adminInterna` redirige). Modelo `agenda_items` (tareas y puntos de reunión; etiquetas `cliente_key` #cliente y `responsables` @persona; estados abierta·hecha·cancelada·arrastrada) + `agenda_reuniones` (reuniones con minuta y eventos `tipo='evento'`) + `agenda_google` (refresh_token sólo service role). Migraciones `20260911_agenda_modelo.sql` (tablas, RLS `agenda_puede_ver/editar`, auditoría, `alertas.para_usuario`, copia idempotente de `pendientes_equipo`/`pendientes`/`minutas`/`minuta_acuerdos`/`eventos_equipo` con `migrado_de`; RPCs `agenda_cerrar_reunion` y `agenda_arrastrar_pendientes`) y `20260911_agenda_google.sql`. Código en `src/modules/agenda/` (Agenda.jsx orquesta A Bandeja / C Tablero según pref `agenda.modo`; lógica pura `calculo.js`/`etiquetas.js`/`textos.js` con tests `scripts/test-agenda-*.mjs`; datos en `datos.js` con `useBandejaHoy` que también alimenta el bloque "Hoy" de Inicio). Cron: reglas `agenda_vencida`/`agenda_asignado` en `generar-alertas` (la app deja `notificar_a` en el ítem) y task `agenda-hoy` 08:30 CDMX; las alertas de agenda van dirigidas (`para_usuario`). Google Calendar: `api/google-calendar.js` (OAuth propio, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, redirect `/api/google-calendar?action=callback`). Las tablas viejas no se borran. Pantallas legacy borradas: `AdministracionInterna`, `MinutasPanel`, `RecurrentesPanel`; `PendientesCalendarioV2` en `src/_archivo/agenda-v2/`.
- Pendientes V3: archivar `src/components/Mobile*.jsx`, app móvil (usa la navegación iPhone), pantallas restantes al kit (Configuración, Análisis, Estrategia, Forecast, S&OP, Propuestas), colocar `FrescuraPill` en cada pantalla, borrar `UserMenu`/`Sidebar.jsx` legacy, migrar helpers de formato a `src/lib/format.js`.

### Pagos unificados · diseño B (3.27.0 · 2026-09-12)

Pantalla global `pagos` (`src/modules/comercial/PagosUnificados.jsx` + `pagosv3/`; móvil `src/movil/pestanas/pagos/`).
**Ya no existe la pestaña Pagos dentro de cada cliente** (quitada de `PESTANAS_CLIENTE` en `arbol.js`, de `rutas.js` CLIENTE
y del árbol móvil): cualquier enlace "cliente › Pagos" (Home del cliente, alertas `pago_*`, FichaCliente móvil) pasa por
`handleNavegar` / `nav.navegar` y abre la global con ese cliente **preelegido** (`App.jsx` estado `pagosCliente`; móvil
`inicial.cliente`). Estructura: mini resumen de las tres cuentas (tarjetas = selector) → Hero del cliente elegido (únicas
cifras en dinero) → flujo del mes en pagos (5 etapas, filtran la tabla) → tabla + calendario lado a lado → una sección
secundaria a la vez (Segmented Cálculo · Marketing · Fondo · Reglas · Historial). Regla: ninguna cifra se repite en dos
bloques. Detalle en `docs/PAGOS_V3.md`.

### Regla de ancho (2026-09-12)

Navegar horizontalmente lo menos posible: lo que va dentro de una tarjeta cabe en su ancho. `TablaCompacta` pinta el
`renderExpandido` sticky al ancho visible del contenedor (el drill nunca viaja con el scroll de la tabla); en tablas
anchas se recortan columnas (el detalle va al drill) y las tendencias van como mini trazo de `GraficaLineas` (90 px),
no como pastillas. Las pastillas de lectura de `GraficaLineas` van en fila propia, nunca en la cabecera del Panel.

### Importación: tiempos reales y foto diaria (2026-09-12)

- **Tiempos y flete de importación** (`supabase/migrations/20260912_embarques_tiempos.sql`): `v_embarques_contenedor` (1 fila por contenedor — **el `costo_flete` del Master Embarques está capturado por contenedor, sumarlo por renglón lo infla 2-3×**), `v_embarques_contenedor_tiempos`, `v_embarques_proveedor`, `v_embarques_naviera`, `v_embarques_mes` + función `emb_fecha_ok()` (descarta las fechas imposibles del Sheet). Días = **mediana de los contenedores ya arribados**. Hook único `src/modules/comercial/forecast/useEmbarquesTiempos.js`; se ve en S&OP (Panel plegable "Proveedores y navieras · tiempos reales"), en Inventario global (columnas Naviera y Navegando de "Próximos arribos") y en el S&OP móvil. Cifra real 2026: **$56 USD/CBM** de flete y ciclo PO emisión→CEDIS ≈ 106 d (el $330/CBM de `docs/DATOS_SIN_APROVECHAR.md` venía de sumar el flete por renglón).
- **Foto diaria de inventario**: además del puente, la dispara el cron de Vercel — tarea `inventario-foto` en `api/cron.js` + `vercel.json` a las 01:30 UTC (19:30 CDMX). El RPC `snapshot_inventario_diario()` es idempotente, así que las dos fuentes conviven.

### Sell Out consolidado (3.24.0 · 2026-09-12)

Pantalla global `sellOut` (`src/modules/comercial/SellOutGlobal.jsx` + `sellout/`), permiso `sell_out`,
siluetas `sellOutGlobal` y `selloutDrill`. Hero "la empresa como equipo" + 4 KPIs + evolución 12 meses +
composición del mes + tabla por cuenta con **drill en línea por pestañas** (Resumen · SKUs · Inventario ·
Sucursales y vendedores · Clientes finales · Mapa; sólo se muestran las que la fuente alimenta) y panel
de mapa plegable. Montos siempre **sin IVA**.

- **17 cuentas** = 12 mayoristas de `sellout_general` + Dicotech (monto de `sellout_detalle`, dimensiones de
  `v_sellout_general_dicotech`) + Digitalife + PCEL + una fila "Mostrador + e-commerce (directo)"
  + **Ingram retail representados** (ver abajo). El mapeo mayorista ↔ código de cliente del ERP vive en
  la vista `v_sellout_cuentas`.
- **Ingram son dos clientes** (2026-09-12, migración `20260912_sellout_ingram_dos_clientes.sql`): en el ERP hay
  dos códigos con el MISMO `cliente_nombre` ("INGRAM MICRO MEXICO") — `00226` mayoreo, que es el que reporta
  sell out por el puente (`sellout_general.mayorista = 'INGRAM MICRO'`), y `04126` retail representados, que
  **sólo tiene sell in**. Salen como dos filas: `ingram` y `ingram_retail`. `v_sellout_cuentas.tiene_sellout`
  (= `fuente is not null`) marca las cuentas sin fuente; `calculo.js` las devuelve con `sinFuente: true`
  (sell out, YoY, YTD y SO/SI en `null`/0) y la pantalla pinta **"—", nunca $0**, no abre su drill y deja su
  sell in fuera del denominador del SO/SI del equipo (`totalesDeFilas().sellInSinFuente`). `v_sellout_cuenta_mes`
  ya no exige sell out: las cuentas sin fuente entran por los meses en que tienen sell in.
  Lo que ya estaba bien y no se tocó: `mv_analisis_cliente_mes` / `mv_analisis_cliente_sku_mes` agrupan por
  `COALESCE(cliente, cliente_nombre)` (código) y `v_sellin_global_sku_*` son por artículo, sin cliente.
  Lo que sí estaba mal: `refresh_facturacion_clientes()` decidía el canal por `cliente_nombre`, así que los
  ~14 M de retail representados de Ingram se contaban como mayoreo en `facturacion_clientes` (y por tanto en
  Sell In consolidado). Ahora agrupa por código; **el dato cambia con la siguiente carga del ERP**, no antes.
- **Agregación en Postgres** (`supabase/migrations/20260912_sellout_global_base.sql` y `…_vistas.sql`):
  `mv_sellout_cuenta_dia` (MTD/YTD a mismo día), `mv_sellout_cuenta_sku_mes`, `mv_sellout_dim_cuenta_mes`,
  `mv_sellout_estado_mes`, `mv_sellout_cliente_final_mes`, `mv_sellout_vendedor_mes`, `mv_sellout_sucursal_mes`,
  `mv_sellout_estado_norm` (diccionario de estados) + las vistas `v_sellout_cuenta_mes`,
  `v_sellout_inventario_cuenta_{mes,sku}`, `v_sellout_{clientes,vendedores}_resumen_mes`.
  La pantalla NO toca las 440 K filas de `sellout_general`: baja ~9 K filas.
- **Refresco**: `refresh_sellout_global()` (≈ 50 s). `refresh_mv_sellout_unificado()` ya la llama, así que
  el puente (`bridge/lib/api.mjs`) y `api/import-central.js` la arrastran sin cambios de código.
- **Reglas de cálculo** (`sellout/calculo.js`, pruebas en `scripts/test-sellout-calculo.mjs`):
  `dia = 0` marca las fuentes sin detalle diario (el directo, que viene del pivot mensual); a su año anterior
  se le aplica la misma fracción de mes para no exagerar la caída. Semanas de inventario **en piezas** al ritmo
  de los **3 meses cerrados** anteriores. `SO / SI` no se muestra si el sell in del mes es ≤ 0.
- **Mapa**: `sellout/MapaMexico.jsx` + `sellout/mexico-estados.json` (32 estados, geometría real simplificada,
  82 KB, ya proyectada a un viewBox de 1000). Se carga con `React.lazy` para no pesar en el arranque.
  Nombres en MAYÚSCULAS SIN ACENTOS, iguales a los que devuelve `normalizar_estado_mx()` en Postgres.
- **Reutilizable**: `sellout/ResumenSellOut.jsx` (Bento del resumen) se monta también arriba del drill de
  Análisis por Cliente para los clientes con fuente de sell out.
- **Frescura por cliente** (migración `20260912_frescura_sellout_detalle_cliente.sql`): `sellout_detalle`
  guarda Digitalife y Dicotech en la misma tabla y la única fila de `v_fuentes_frescura` tapaba al que llevaba
  días sin cargar. Ahora hay `sellout_detalle_digitalife` y `sellout_detalle_dicotech` (max `updated_at` y
  `fecha` por cliente, índice `(cliente, updated_at)`); `FrescuraPill` las etiqueta "Digitalife" y "Dicotech",
  `SELLOUT_POR_CLIENTE` y `FUENTES_POR_PANTALLA.sellOutGlobal` (src/lib/frescura.js) apuntan a ellas y
  `FUENTES_UPLOAD` de `api/cron.js` alerta por cliente. La fila agregada `sellout_detalle` se queda para
  compatibilidad ("Sell Out detalle (Digitalife + Dicotech)").
- **Celular** (`src/movil/pestanas/selloutGlobal/`): `SellOutGlobal.jsx` (hero del mes con selector, filtro de
  canal, `FrescuraPill detallado` y "Compartir resumen del mes" con el texto de la web · 4 KPIs · evolución
  12 m con `GraficaLineas compacto` · composición canal/marca/categoría · cuentas agrupadas por canal con
  mini trazo de 6 m) y `Cuenta.jsx` (push, pestañas Resumen · SKUs · Inventario · Sucursales · Clientes finales
  · Estados, sólo las que la fuente alimenta; buscador de SKU y ficha por cuenta; "Compartir estatus" e
  "Ir a <cliente> › Sell Out"). Nodo global `sellOut` en `src/movil/rutas.js`, silueta `movilSellOutGlobal`.
  **El mapa NO se importa en el celular**: los estados van como lista con su % (chunk móvil 29 KB / 9.6 KB gz).
  `agregarDimension()` y `clientesFinalesDelMes()` se movieron de `DrillCuenta.jsx` a `sellout/calculo.js` para
  que web y móvil compartan la agregación.
- **Cuota por cuenta (3.25.0 · 2026-09-12)**: `v_cuota_cliente_erp` + `v_cuota_erp_mes`
  (migración `20260912_cuotas_clientes_mapa.sql`) traducen los 29 slugs de `cuotas_mensuales` a
  código de cliente del ERP y a cuenta de sell out (unicom = 00335 GUC; Ingram 00226 / 04126;
  `directo` sin cuota). Se ve como columna **Cuota** (% de alcance = sell in ÷ cuota, semáforo
  100/85) en Sell Out consolidado y en Análisis por Cliente, en sus dos versiones móviles y en los
  textos para compartir; el % del total se recalcula sobre las cuentas con cuota, nunca se promedia.
  Detalle y mapa completo en `docs/MEDIDAS_DIRECTOR.md` §2.1.
- Lógica pura en `sellout/calculo.js` y hooks en `sellout/datos.js`, sin dependencias de layout.
  Textos en `sellout/textos.js` (`src/lib/whatsapp.js` no se tocó).

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

**Deploy en Vercel (regla desde 2026-09-11).** El plan Hobby permite **12 funciones serverless** por deploy (archivos en `api/` sin `_`); la 13ª hizo fallar todos los deploys de la 3.13.0 a la 3.19.1 sin que nadie lo notara. `npm run build` corre antes `scripts/verificar-deploy.mjs` (conteo de funciones, `vercel.json`, import de cada API en Node) y falla con mensaje claro; Vercel también lo ejecuta. Reglas: (1) usar `npm run build`, no `npx vite build`, antes de cada push; (2) endpoint nuevo = fusionarlo en uno existente con `?action=` salvo que se libere espacio; (2b) los endpoints de administración viven en `api/admin/_<accion>.js` y los despacha `api/admin.js` (rewrite `/api/admin/:accion` en vercel.json), hoy 8 de 12 funciones; (3) tras cada push, comprobar que producción sirve la versión nueva: `curl -s https://acteck-dashboard.vercel.app/ | grep -o '/assets/index-[^"]*\.js'` y buscar la versión dentro de ese archivo; si no cambia en 3 minutos, el deploy falló.

```bash
npm install
npm run dev          # localhost:5173
npx vite build       # medir bundle
git push             # Vercel despliega desde main
```

**Versionado (desde V3, 2026-09-09).** La versión vive en `package.json` (`"version"`) y se **edita a mano** — `npm version` no se usa (crea tags/commits que no queremos). `vite.config.js` la inyecta como `import.meta.env.VITE_APP_VERSION` junto con `VITE_COMMIT` (hash corto); `src/lib/version.js` expone `versionLabel()` → "v3.0.0 · a1b2c3d", visible en el menú de usuario del Topbar, en Configuración y en Mobile › Yo. Regla: **cada deploy con cambios visibles sube la versión** — patch (3.0.x) ajustes y fixes · minor (3.x.0) pantallas nuevas · major (x.0.0) rediseños. El service worker está en modo `prompt`: al publicarse un build nuevo, `src/main.jsx` muestra el toast "Hay una versión nueva del dashboard · Recargar" (persistente hasta que el usuario recarga o lo cierra). El mismo `version+commit` sirve de buster del cache persistido de React Query.

**Dos máquinas (laptop + Mac mini) con la misma cuenta:** las sesiones y la memoria de Claude Code son locales por máquina; este archivo sí viaja con git. Trabajar cada máquina en su propia rama/worktree, hacer `git pull --rebase` antes de pushear y **no pushear a `main` desde las dos a la vez**. `.env.local` se crea a mano en cada máquina (no compartir por chat ni git).
