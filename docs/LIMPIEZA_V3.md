# Limpieza V3 — 2026-09-09

Pasada de limpieza previa al rediseño V3. Sin commit: los cambios están en el working tree
del worktree `claude/sweet-kare-624569` para que Fernando los revise.

## 1. Archivos huérfanos

Método: script en Node que recorre `src/` (excluye `src/_archivo/`), extrae todos los
`import … from '…'`, `export … from '…'`, `import('…')` y `require('…')` relativos
(incluyendo `src/App.jsx`, `index.html` y los barrels `index.js`) y lista los archivos
que ningún otro archivo importa. Raíces: `src/main.jsx`, `src/App.jsx`.

### Borrados (nadie los importaba; evidencia en git)

| Archivo | Líneas | Por qué es obsoleto |
|---|---|---|
| `src/modules/comercial/MarketingClienteV2.jsx` | 1,279 | `App.jsx` renderiza sólo `MarketingCliente` (kit Ferruteck 2). Único importador era el barrel `comercial/index.js` (también huérfano). |
| `src/modules/comercial/OrdenesCompraTab.jsx` | 910 | Sustituido por `TrackingPedidos.jsx` (commit `bfe5893` "renombrar 'Órdenes de Compra' → 'Tracking Pedidos'"). Dependía de `ventas_erp`. |
| `src/modules/comercial/parsersOC.js` | — | Sólo lo importaba `OrdenesCompraTab.jsx`. |
| `src/modules/comercial/forecast/AlertasCard.jsx` | 170 | Quitado del S&OP en `b8b56cd` "rework Necesidad + Novedades, quita AlertasCard". |
| `src/modules/interno/EvaluacionesPanel.jsx` | 2,571 | Pestaña eliminada en `6b420b2` "elimina pestana 'Evaluaciones (historico)'". |
| `src/components/GestionCuotasPanel.jsx` | 329 | Quitado de Configuración en `d86f80b`; las cuotas se cargan desde `/uploads.html`. (Queda una mención en un comentario de `index.html`.) |
| `src/modules/comercial/index.js` | 28 | Barrel que nadie importa; CLAUDE.md prohíbe usarlo (arrastra todo al chunk inicial). |
| `src/modules/interno/index.js` | 2 | Barrel huérfano. |
| `src/modules/configuracion/index.js` | 1 | Barrel huérfano. |

Total: 9 archivos, ~5,600 líneas. Ninguno estaba en `dist/` (no se importaban), así que el
tamaño del bundle no cambia por esto; cambia el repo y la carga mental.

### Huérfano NO borrado (decide Fernando)

- `src/modules/interno/AdministracionInterna.jsx` (1,971 líneas). Sólo lo exportaba el barrel
  `interno/index.js`. Fue reemplazado por `PendientesCalendarioV2.jsx` (commit `34275a6`), pero
  no está marcado como versión vieja y arrastra `MinutasPanel.jsx` / `RecurrentesPanel.jsx`
  (verificar si siguen importados desde otro sitio antes de borrarlo).

## 2. `VisionGeneral.jsx` — código muerto

Eliminados (verificado con grep que nada los referenciaba dentro ni fuera del archivo):
`BentoKpi`, `BloqueBento`, `MiniKpi`, `ProximamenteKpi`, `CarteraCard`, `AgingTile`,
`CaminoHero`, `LeadtimeEtapas`, `ConcentracionSemanal`, `TopProveedores`, `AgotadosConOrden`,
y los helpers que sólo ellos usaban: `CANAL_COLOR`, `colorBloque`, estilos `thLeft/thRight/tdLeft/tdRight`,
más imports sin uso (`TrendingDown`, `ChevronRight`, `ChevronDown`, `LineChart`, `Line`, `PieChart`, `Pie`, `Legend`).

Conservados: `RentabilidadBloque`, `ExportMenu`, `MiniKpiRow`, `HeroCard`, `ClientesPanel`,
`TendenciaCard`, `InventarioSection` y sus `*Compact`, todo el bloque Sell Out.

Resultado: 2,868 → 2,388 líneas (`-483 / +3`). Build OK.

## 3. `ventas_erp` — NO se toca

La tabla vieja **sí la lee una pantalla**, así que no se retiró del uploader ni de `ALLOWED`
y no se creó la migración de DROP:

- `src/lib/pcelAdapter.js:123` — `fetchHistoricoComprasPcel()` hace `.from("ventas_erp")` (cliente PC ONLINE, últimos 6 meses).
- `src/modules/comercial/EstrategiaProducto.jsx:1139` importa ese adapter y usa `histPcel` (líneas ~1886 y ~1915: "compra histórica en ventas_erp").

Además la usan del lado servidor:
- `api/recalculate.js:74` y `:127` — recalcula `ventas_mensuales` y `sell_in_sku` desde `ventas_erp` (lo dispara `uploads.html:3290` tras ciertas cargas).
- `api/cron.js` `?task=actualizar-fill-rates` → RPC `actualizar_fill_rate_todas()` (`supabase/migrations/20260424_oc_cruce_erp.sql`) cruza OCs con `ventas_erp`.
- `api/status.js:17` la lista para el conteo de filas.

Para poder darla de baja hay que: (a) migrar `fetchHistoricoComprasPcel` a `erp_ventas`,
(b) migrar o retirar `api/recalculate.js`, (c) reescribir `actualizar_fill_rate_oc` sobre
`erp_ventas` (o retirarla si Tracking Pedidos ya no la usa). Sólo entonces `DROP TABLE`.

## 4. `src/lib/format.js` — fuente única de formato

Nuevo módulo con `money`, `moneyCompact`, `int`, `pct`, `pp`, `fecha`, `fechaCorta`,
`relativo` y reexport de `formatMXN` / `formatFecha` (utils.js). Probado en Node (34 casos).
Ninguna pantalla se migró todavía (otros agentes las editan).

### Helpers de formato duplicados — pendientes de migrar a `format.js`

`grep -rn "const money = \|const fmt = \|const fmtCompact\|function fmtMXN\|const int = \|const fmtMXN\|const formatMXN"` (2026-09-09):

Mobile (`src/components/`):
- `MobileAnalisisClientes.jsx:16` fmtCompact
- `MobileCartera.jsx:20` fmtMXN
- `MobileCobranzaGlobal.jsx:12` fmtCompact
- `MobileEdR.jsx:57` fmtCompact
- `MobileEstrategiaPrecios.jsx:13` fmtCompact
- `MobileHomeCliente.jsx:25` fmtMXN
- `MobileInventarioGlobal.jsx:12` fmtCompact
- `MobileMarketing.jsx:31` fmtMXN
- `MobilePropuestas.jsx:10` fmtCompact
- `MobileSOP.jsx:15` fmtCompact
- `MobileSellIn.jsx:24` fmtMXN
- `MobileSellInGlobal.jsx:15` fmtCompact
- `MobileSellOut.jsx:24` fmtMXN
- `MobileSellOutGlobal.jsx:14` fmtCompact
- `MobileTrackingPedidos.jsx:11` fmtCompact
- `MobileVisionGeneral.jsx:38` fmtCompact

Desktop (`src/modules/`):
- `comercial/AnalisisClientesGlobal.jsx:295` fmtCompact
- `comercial/ComparadorPeriodos.jsx:23,30` money, int
- `comercial/EstrategiaPrecios.jsx:52` fmtCompact
- `comercial/EstrategiaProducto.jsx:706` formatMXN local (shadow intencional, ver CLAUDE.md) · `:2974`, `:3079` fmtMXN inline
- `comercial/PropuestasTab.jsx:63` fmtCompact
- `comercial/RentabilidadBloque.jsx:18` money
- `comercial/ResumenClientesTab.jsx:58` fmtCompact
- `comercial/SellInClienteV2.jsx:42`, `SellInDicotech.jsx:34`, `SellInPcel.jsx:38` objeto `fmt`
- `comercial/SellOutClienteV2.jsx:68`, `SellOutDicotech.jsx:74`, `SellOutPcel.jsx:74` objeto `fmt`
- `comercial/TrackingPedidos.jsx:61` fmtCompact · `:2476` fmt (decimal)
- `comercial/VisionGeneral.jsx:379-394` fmtCompact, fmtMoney, fmtPct, fmtPctDelta, fmtInt
- `comercial/marketing/config.js:83,85` fmtMXN, money (exportados; los consume Marketing*)
- `comercial/inventario/constantes.js:94` fmtCompact (exportado; lo consume Inventario*)
- `general/EstadoResultados.jsx:48` fmtCompact
- `MarketingCliente.jsx` tiene `formatMXN` local (shadow intencional, ver CLAUDE.md)

Ojo al migrar: varios `fmtCompact` locales devuelven `'$0'` para nulos; `format.js` devuelve `'—'`.
Revisar cada pantalla para no cambiar el copy de KPIs vacíos sin querer.

## 5. Métricas

- `du -sh dist`: 5.2M antes (5,344 KB) → 5.2M después (5,328 KB). Los huérfanos nunca
  estaban en el bundle; la diferencia viene del chunk `VisionGeneral-*.js` (94 KB raw / 21 KB gz).
- `npx vite build`: OK, sin errores (aviso preexistente de `MobileYo.jsx` importado
  estática y dinámicamente, no relacionado).
