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
│   ├── import-central.js      — Upsert por chunks. Whitelist de tablas + unique keys
│   ├── cron.js                — Tareas programadas (vercel.json)
│   └── admin/
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

### Tablas que la app SÍ escribe (cuidado con la cache — ver Rendimiento)

`pagos`, `pendientes*`, `minutas`, `inversion_marketing`, `marketing_actividades`, `fondos_*_movimientos`, `propuestas_borradores`, `spiffs`, `lineamientos_cliente`, `forecast_propuestas*`, `forecast_avisos`, `sugeridos_compra`, `solicitudes_compra*`, `oc_*`, `perfiles`, `cuotas_mensuales`, `roadmap_sku`, `sellout_sku`, `inventario_cliente`, `ventas_mensuales`, `clientes_credito_config`, `evaluaciones*`, `eventos_*`.

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
- **Propuesta de diseño Ferruteck 2** (kit de 6 componentes, plantilla arriba-de-página, Midnight completo, movimiento): artefacto publicado el 2026-09-10; pendiente de aprobación de Fernando antes de migrar pantallas.

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

**Dos máquinas (laptop + Mac mini) con la misma cuenta:** las sesiones y la memoria de Claude Code son locales por máquina; este archivo sí viaja con git. Trabajar cada máquina en su propia rama/worktree, hacer `git pull --rebase` antes de pushear y **no pushear a `main` desde las dos a la vez**. `.env.local` se crea a mano en cada máquina (no compartir por chat ni git).
