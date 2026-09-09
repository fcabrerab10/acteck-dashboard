# Auditoría de colores fijos (modo Midnight)

_Generado el 2026-09-09 con `node scripts/auditar-colores.mjs`. No editar a mano: se regenera al correr el script._

## Qué detecta

- **hex** — literales `#RRGGBB` / `#RGB` en JSX o estilos inline.
- **rgb** — `rgb(…)` / `rgba(…)` con valores fijos. Se toleran overlays neutros `rgba(0,0,0,a)` y `rgba(255,255,255,a)` con `a ≤ 0.12`.
- **tailwind** — clases de color (`text-gray-500`, `bg-white`, `border-red-200`, `divide-…`, `ring-…`, …) con paleta `gray, slate, zinc, neutral, emerald, green, red, blue, indigo, amber, yellow, orange, purple, violet, pink, sky`.

Se excluyen `src/lib/themeTokens.js`, `src/components/kit/**` y las líneas dentro de bloques `const PALETTE | TIPOS | MARCAS | CATEGORIA_META | COLS_* = { … }` (paletas declaradas a propósito).

## Resumen

| Métrica | Valor |
|---|---:|
| Archivos escaneados | 150 |
| Archivos afectados | 110 |
| Total ocurrencias | 7374 |
| · hex | 3541 |
| · rgb/rgba | 723 |
| · tailwind | 3110 |
| Líneas omitidas por estar en bloques de paleta | 42 |

## Orden sugerido

Pantallas de uso diario primero; después las móviles; al final el resto ordenado por conteo.

### 1. Pagos

| Archivo | Total | hex | rgb | tw |
|---|---:|---:|---:|---:|
| `src/modules/comercial/PagosCliente.jsx` | 2 | 0 | 2 | 0 |

### 2. Marketing

| Archivo | Total | hex | rgb | tw |
|---|---:|---:|---:|---:|
| `src/modules/comercial/MarketingClienteV2.jsx` | 36 | 16 | 20 | 0 |

### 3. Cobranza / Crédito

| Archivo | Total | hex | rgb | tw |
|---|---:|---:|---:|---:|
| `src/modules/comercial/CreditoCobranza.jsx` | 279 | 3 | 0 | 276 |
| `src/modules/comercial/CreditoCobranzaV2.jsx` | 5 | 5 | 0 | 0 |

### 4. Estado de Resultados

| Archivo | Total | hex | rgb | tw |
|---|---:|---:|---:|---:|
| `src/modules/general/EstadoResultados.jsx` | 8 | 1 | 7 | 0 |

### 5. Configuración

| Archivo | Total | hex | rgb | tw |
|---|---:|---:|---:|---:|
| `src/modules/configuracion/Configuracion.jsx` | 169 | 24 | 5 | 140 |
| `src/modules/configuracion/WizardNuevoUsuario.jsx` | 77 | 72 | 5 | 0 |
| `src/modules/settings/ActualizacionDatos.jsx` | 33 | 33 | 0 | 0 |

### 6. Móviles

| Archivo | Total | hex | rgb | tw |
|---|---:|---:|---:|---:|
| `src/components/MobileShell.jsx` | 43 | 29 | 14 | 0 |
| `src/components/MobileEdR.jsx` | 36 | 25 | 11 | 0 |
| `src/components/MobileHome.jsx` | 35 | 25 | 10 | 0 |
| `src/components/MobileEquipo.jsx` | 33 | 28 | 5 | 0 |
| `src/components/MobileYo.jsx` | 24 | 20 | 4 | 0 |
| `src/components/MobileCartera.jsx` | 23 | 21 | 2 | 0 |
| `src/components/MobileTrackingPedidos.jsx` | 20 | 16 | 4 | 0 |
| `src/components/MobileHoy.jsx` | 19 | 13 | 6 | 0 |
| `src/components/MobileSellOut.jsx` | 19 | 17 | 2 | 0 |
| `src/components/MobileInventarioGlobal.jsx` | 15 | 13 | 2 | 0 |
| `src/components/MobileVisionGeneral.jsx` | 14 | 14 | 0 | 0 |
| `src/components/MobileCobranzaGlobal.jsx` | 12 | 12 | 0 | 0 |
| `src/components/MobileHomeCliente.jsx` | 11 | 11 | 0 | 0 |
| `src/components/MobilePropuestas.jsx` | 11 | 8 | 3 | 0 |
| `src/components/MobileSellIn.jsx` | 10 | 10 | 0 | 0 |
| `src/components/MobileSOP.jsx` | 10 | 10 | 0 | 0 |
| `src/components/MobileMarketing.jsx` | 9 | 7 | 2 | 0 |
| `src/components/MobileAnalisisClientes.jsx` | 8 | 8 | 0 | 0 |
| `src/components/MobileSellInGlobal.jsx` | 8 | 8 | 0 | 0 |
| `src/components/MobileBuscar.jsx` | 7 | 5 | 2 | 0 |
| `src/components/MobileSellOutGlobal.jsx` | 6 | 6 | 0 | 0 |
| `src/components/MobileEstrategiaPrecios.jsx` | 5 | 5 | 0 | 0 |
| `src/components/MobileNav.jsx` | 2 | 0 | 2 | 0 |

### 7. Resto (por conteo)

| Archivo | Total | hex | rgb | tw |
|---|---:|---:|---:|---:|
| `src/modules/comercial/HomeCliente.jsx` | 739 | 671 | 12 | 56 |
| `src/modules/comercial/SellOutCliente.jsx` | 494 | 105 | 0 | 389 |
| `src/modules/comercial/EstrategiaProducto.jsx` | 480 | 452 | 8 | 20 |
| `src/modules/interno/EvaluacionesPanel.jsx` | 466 | 33 | 1 | 432 |
| `src/modules/interno/AdministracionInterna.jsx` | 361 | 38 | 1 | 322 |
| `src/modules/comercial/AnalisisCliente.jsx` | 215 | 215 | 0 | 0 |
| `src/modules/comercial/ForecastClientesTab.jsx` | 193 | 104 | 63 | 26 |
| `src/modules/comercial/ReporteSection.jsx` | 192 | 5 | 0 | 187 |
| `src/modules/comercial/PagosPromociones.jsx` | 163 | 12 | 2 | 149 |
| `src/modules/comercial/OrdenesCompraTab.jsx` | 160 | 16 | 1 | 143 |
| `src/modules/comercial/ForecastCliente.jsx` | 150 | 148 | 2 | 0 |
| `src/modules/comercial/ForecastReservas.jsx` | 146 | 106 | 40 | 0 |
| `src/components/Topbar.jsx` | 145 | 84 | 61 | 0 |
| `src/modules/interno/RecurrentesPanel.jsx` | 144 | 9 | 1 | 134 |
| `src/modules/comercial/forecast/NovedadesCard.jsx` | 142 | 0 | 0 | 142 |
| `src/modules/comercial/PropuestasTab.jsx` | 141 | 106 | 35 | 0 |
| `src/modules/interno/TelemetriaPanel.jsx` | 138 | 119 | 19 | 0 |
| `src/modules/interno/MinutasPanel.jsx` | 123 | 8 | 1 | 114 |
| `src/modules/comercial/SellInCliente.jsx` | 122 | 41 | 20 | 61 |
| `src/modules/comercial/SellOutClienteV2.jsx` | 91 | 59 | 32 | 0 |
| `src/modules/comercial/SellOutPcel.jsx` | 91 | 59 | 32 | 0 |
| `src/modules/interno/PendientesCalendarioV2.jsx` | 89 | 60 | 29 | 0 |
| `src/modules/comercial/forecast/SolicitudesPanel.jsx` | 79 | 0 | 0 | 79 |
| `src/modules/comercial/SellInClienteV2.jsx` | 73 | 46 | 27 | 0 |
| `src/App.jsx` | 71 | 2 | 1 | 68 |
| `src/modules/comercial/SellOutDicotech.jsx` | 70 | 35 | 35 | 0 |
| `src/modules/comercial/TrackingPedidos.jsx` | 69 | 54 | 15 | 0 |
| `src/modules/comercial/AnalisisClientesGlobal.jsx` | 60 | 27 | 5 | 28 |
| `src/modules/comercial/HomeDicotech.jsx` | 48 | 35 | 13 | 0 |
| `src/modules/comercial/HomeDigitalife.jsx` | 48 | 35 | 13 | 0 |
| `src/modules/comercial/HomePcel.jsx` | 48 | 35 | 13 | 0 |
| `src/modules/comercial/forecast/EnviosEditor.jsx` | 46 | 0 | 0 | 46 |
| `src/modules/comercial/SellInDicotech.jsx` | 45 | 33 | 12 | 0 |
| `src/modules/comercial/SellInPcel.jsx` | 45 | 33 | 12 | 0 |
| `src/modules/comercial/EstrategiaPrecios.jsx` | 43 | 35 | 8 | 0 |
| `src/modules/comercial/LineamientosCliente.jsx` | 43 | 4 | 0 | 39 |
| `src/modules/comercial/forecast/SolicitudesModal.jsx` | 41 | 0 | 0 | 41 |
| `src/modules/comercial/forecast/GrupoContenedorEditor.jsx` | 39 | 0 | 0 | 39 |
| `src/modules/comercial/SellInDrillDown.jsx` | 35 | 28 | 6 | 1 |
| `src/components/Sidebar.jsx` | 32 | 23 | 9 | 0 |
| `src/modules/comercial/forecast/NecesidadCard.jsx` | 32 | 4 | 0 | 28 |
| `src/modules/auth/LoginPage.jsx` | 30 | 9 | 21 | 0 |
| `src/modules/comercial/forecast/AlertasCard.jsx` | 30 | 0 | 0 | 30 |
| `src/modules/auth/SetPasswordPage.jsx` | 27 | 25 | 2 | 0 |
| `src/modules/comercial/forecast/TransitoTimeline.jsx` | 27 | 0 | 0 | 27 |
| `src/components/FerrutekLoader.jsx` | 24 | 21 | 3 | 0 |
| `src/lib/roadmapColors.js` | 24 | 24 | 0 | 0 |
| `src/modules/comercial/forecast/AgregarLineaModal.jsx` | 23 | 14 | 9 | 0 |
| `src/modules/interno/HistorialCambios.jsx` | 22 | 18 | 4 | 0 |
| `src/modules/comercial/VisionGeneral.jsx` | 20 | 0 | 20 | 0 |
| `src/modules/interno/AxonMexico.jsx` | 20 | 0 | 0 | 20 |
| `src/components/TarjetaMinuta.jsx` | 18 | 0 | 0 | 18 |
| `src/components/TarjetaPagos.jsx` | 14 | 0 | 0 | 14 |
| `src/components/GestionCuotasPanel.jsx` | 13 | 9 | 4 | 0 |
| `src/modules/comercial/ResumenClientesTab.jsx` | 13 | 10 | 3 | 0 |
| `src/modules/comercial/ComparadorPeriodos.jsx` | 10 | 5 | 5 | 0 |
| `src/components/BandejaAlertas.jsx` | 9 | 9 | 0 | 0 |
| `src/components/Semaforo.jsx` | 9 | 0 | 0 | 9 |
| `src/components/TarjetaPendientes.jsx` | 9 | 0 | 0 | 9 |
| `src/components/TarjetaPromociones.jsx` | 8 | 0 | 0 | 8 |
| `src/lib/constants.js` | 8 | 8 | 0 | 0 |
| `src/components/BarraCuota.jsx` | 7 | 3 | 0 | 4 |
| `src/lib/exportar.js` | 7 | 5 | 2 | 0 |
| `src/lib/toast.jsx` | 7 | 5 | 2 | 0 |
| `src/components/ExportMenu.jsx` | 6 | 4 | 2 | 0 |
| `src/components/KPICard.jsx` | 5 | 0 | 0 | 5 |
| `src/main.jsx` | 5 | 5 | 0 | 0 |
| `src/modules/comercial/marketing/Calendario.jsx` | 5 | 5 | 0 | 0 |
| `src/modules/comercial/marketing/config.js` | 5 | 5 | 0 | 0 |
| `src/modules/comercial/pagos/pagosUI.jsx` | 5 | 2 | 3 | 0 |
| `src/modules/comercial/RentabilidadBloque.jsx` | 5 | 5 | 0 | 0 |
| `src/components/SinAcceso.jsx` | 4 | 0 | 0 | 4 |
| `src/modules/comercial/marketing/ActividadForm.jsx` | 4 | 0 | 4 | 0 |
| `src/components/apple/AppleLoader.jsx` | 3 | 3 | 0 | 0 |
| `src/components/apple/index.jsx` | 2 | 0 | 2 | 0 |
| `src/components/CardHeader.jsx` | 2 | 0 | 0 | 2 |
| `src/modules/comercial/marketing/ActividadFila.jsx` | 1 | 1 | 0 | 0 |
| `src/modules/comercial/pagos/FondosPanels.jsx` | 1 | 1 | 0 | 0 |
| `src/modules/comercial/pagos/SpiffPanels.jsx` | 1 | 1 | 0 | 0 |

## Tabla por archivo (orden descendente)

| # | Archivo | Total | hex | rgb | tw | Líneas |
|---:|---|---:|---:|---:|---:|---:|
| 1 | `src/modules/comercial/HomeCliente.jsx` | 739 | 671 | 12 | 56 | 520 |
| 2 | `src/modules/comercial/SellOutCliente.jsx` | 494 | 105 | 0 | 389 | 373 |
| 3 | `src/modules/comercial/EstrategiaProducto.jsx` | 480 | 452 | 8 | 20 | 337 |
| 4 | `src/modules/interno/EvaluacionesPanel.jsx` | 466 | 33 | 1 | 432 | 322 |
| 5 | `src/modules/interno/AdministracionInterna.jsx` | 361 | 38 | 1 | 322 | 186 |
| 6 | `src/modules/comercial/CreditoCobranza.jsx` | 279 | 3 | 0 | 276 | 215 |
| 7 | `src/modules/comercial/AnalisisCliente.jsx` | 215 | 215 | 0 | 0 | 159 |
| 8 | `src/modules/comercial/ForecastClientesTab.jsx` | 193 | 104 | 63 | 26 | 129 |
| 9 | `src/modules/comercial/ReporteSection.jsx` | 192 | 5 | 0 | 187 | 140 |
| 10 | `src/modules/configuracion/Configuracion.jsx` | 169 | 24 | 5 | 140 | 111 |
| 11 | `src/modules/comercial/PagosPromociones.jsx` | 163 | 12 | 2 | 149 | 105 |
| 12 | `src/modules/comercial/OrdenesCompraTab.jsx` | 160 | 16 | 1 | 143 | 110 |
| 13 | `src/modules/comercial/ForecastCliente.jsx` | 150 | 148 | 2 | 0 | 105 |
| 14 | `src/modules/comercial/ForecastReservas.jsx` | 146 | 106 | 40 | 0 | 108 |
| 15 | `src/components/Topbar.jsx` | 145 | 84 | 61 | 0 | 111 |
| 16 | `src/modules/interno/RecurrentesPanel.jsx` | 144 | 9 | 1 | 134 | 82 |
| 17 | `src/modules/comercial/forecast/NovedadesCard.jsx` | 142 | 0 | 0 | 142 | 95 |
| 18 | `src/modules/comercial/PropuestasTab.jsx` | 141 | 106 | 35 | 0 | 112 |
| 19 | `src/modules/interno/TelemetriaPanel.jsx` | 138 | 119 | 19 | 0 | 113 |
| 20 | `src/modules/interno/MinutasPanel.jsx` | 123 | 8 | 1 | 114 | 71 |
| 21 | `src/modules/comercial/SellInCliente.jsx` | 122 | 41 | 20 | 61 | 61 |
| 22 | `src/modules/comercial/SellOutClienteV2.jsx` | 91 | 59 | 32 | 0 | 68 |
| 23 | `src/modules/comercial/SellOutPcel.jsx` | 91 | 59 | 32 | 0 | 68 |
| 24 | `src/modules/interno/PendientesCalendarioV2.jsx` | 89 | 60 | 29 | 0 | 50 |
| 25 | `src/modules/comercial/forecast/SolicitudesPanel.jsx` | 79 | 0 | 0 | 79 | 47 |
| 26 | `src/modules/configuracion/WizardNuevoUsuario.jsx` | 77 | 72 | 5 | 0 | 60 |
| 27 | `src/modules/comercial/SellInClienteV2.jsx` | 73 | 46 | 27 | 0 | 57 |
| 28 | `src/App.jsx` | 71 | 2 | 1 | 68 | 50 |
| 29 | `src/modules/comercial/SellOutDicotech.jsx` | 70 | 35 | 35 | 0 | 55 |
| 30 | `src/modules/comercial/TrackingPedidos.jsx` | 69 | 54 | 15 | 0 | 64 |
| 31 | `src/modules/comercial/AnalisisClientesGlobal.jsx` | 60 | 27 | 5 | 28 | 47 |
| 32 | `src/modules/comercial/HomeDicotech.jsx` | 48 | 35 | 13 | 0 | 44 |
| 33 | `src/modules/comercial/HomeDigitalife.jsx` | 48 | 35 | 13 | 0 | 44 |
| 34 | `src/modules/comercial/HomePcel.jsx` | 48 | 35 | 13 | 0 | 44 |
| 35 | `src/modules/comercial/forecast/EnviosEditor.jsx` | 46 | 0 | 0 | 46 | 27 |
| 36 | `src/modules/comercial/SellInDicotech.jsx` | 45 | 33 | 12 | 0 | 39 |
| 37 | `src/modules/comercial/SellInPcel.jsx` | 45 | 33 | 12 | 0 | 39 |
| 38 | `src/components/MobileShell.jsx` | 43 | 29 | 14 | 0 | 31 |
| 39 | `src/modules/comercial/EstrategiaPrecios.jsx` | 43 | 35 | 8 | 0 | 36 |
| 40 | `src/modules/comercial/LineamientosCliente.jsx` | 43 | 4 | 0 | 39 | 35 |
| 41 | `src/modules/comercial/forecast/SolicitudesModal.jsx` | 41 | 0 | 0 | 41 | 26 |
| 42 | `src/modules/comercial/forecast/GrupoContenedorEditor.jsx` | 39 | 0 | 0 | 39 | 27 |
| 43 | `src/components/MobileEdR.jsx` | 36 | 25 | 11 | 0 | 20 |
| 44 | `src/modules/comercial/MarketingClienteV2.jsx` | 36 | 16 | 20 | 0 | 29 |
| 45 | `src/components/MobileHome.jsx` | 35 | 25 | 10 | 0 | 23 |
| 46 | `src/modules/comercial/SellInDrillDown.jsx` | 35 | 28 | 6 | 1 | 21 |
| 47 | `src/components/MobileEquipo.jsx` | 33 | 28 | 5 | 0 | 21 |
| 48 | `src/modules/settings/ActualizacionDatos.jsx` | 33 | 33 | 0 | 0 | 30 |
| 49 | `src/components/Sidebar.jsx` | 32 | 23 | 9 | 0 | 28 |
| 50 | `src/modules/comercial/forecast/NecesidadCard.jsx` | 32 | 4 | 0 | 28 | 27 |
| 51 | `src/modules/auth/LoginPage.jsx` | 30 | 9 | 21 | 0 | 26 |
| 52 | `src/modules/comercial/forecast/AlertasCard.jsx` | 30 | 0 | 0 | 30 | 19 |
| 53 | `src/modules/auth/SetPasswordPage.jsx` | 27 | 25 | 2 | 0 | 17 |
| 54 | `src/modules/comercial/forecast/TransitoTimeline.jsx` | 27 | 0 | 0 | 27 | 25 |
| 55 | `src/components/FerrutekLoader.jsx` | 24 | 21 | 3 | 0 | 23 |
| 56 | `src/components/MobileYo.jsx` | 24 | 20 | 4 | 0 | 19 |
| 57 | `src/lib/roadmapColors.js` | 24 | 24 | 0 | 0 | 24 |
| 58 | `src/components/MobileCartera.jsx` | 23 | 21 | 2 | 0 | 13 |
| 59 | `src/modules/comercial/forecast/AgregarLineaModal.jsx` | 23 | 14 | 9 | 0 | 19 |
| 60 | `src/modules/interno/HistorialCambios.jsx` | 22 | 18 | 4 | 0 | 14 |
| 61 | `src/components/MobileTrackingPedidos.jsx` | 20 | 16 | 4 | 0 | 15 |
| 62 | `src/modules/comercial/VisionGeneral.jsx` | 20 | 0 | 20 | 0 | 12 |
| 63 | `src/modules/interno/AxonMexico.jsx` | 20 | 0 | 0 | 20 | 16 |
| 64 | `src/components/MobileHoy.jsx` | 19 | 13 | 6 | 0 | 16 |
| 65 | `src/components/MobileSellOut.jsx` | 19 | 17 | 2 | 0 | 5 |
| 66 | `src/components/TarjetaMinuta.jsx` | 18 | 0 | 0 | 18 | 14 |
| 67 | `src/components/MobileInventarioGlobal.jsx` | 15 | 13 | 2 | 0 | 5 |
| 68 | `src/components/MobileVisionGeneral.jsx` | 14 | 14 | 0 | 0 | 13 |
| 69 | `src/components/TarjetaPagos.jsx` | 14 | 0 | 0 | 14 | 11 |
| 70 | `src/components/GestionCuotasPanel.jsx` | 13 | 9 | 4 | 0 | 11 |
| 71 | `src/modules/comercial/ResumenClientesTab.jsx` | 13 | 10 | 3 | 0 | 13 |
| 72 | `src/components/MobileCobranzaGlobal.jsx` | 12 | 12 | 0 | 0 | 8 |
| 73 | `src/components/MobileHomeCliente.jsx` | 11 | 11 | 0 | 0 | 5 |
| 74 | `src/components/MobilePropuestas.jsx` | 11 | 8 | 3 | 0 | 4 |
| 75 | `src/components/MobileSellIn.jsx` | 10 | 10 | 0 | 0 | 3 |
| 76 | `src/components/MobileSOP.jsx` | 10 | 10 | 0 | 0 | 7 |
| 77 | `src/modules/comercial/ComparadorPeriodos.jsx` | 10 | 5 | 5 | 0 | 5 |
| 78 | `src/components/BandejaAlertas.jsx` | 9 | 9 | 0 | 0 | 8 |
| 79 | `src/components/MobileMarketing.jsx` | 9 | 7 | 2 | 0 | 6 |
| 80 | `src/components/Semaforo.jsx` | 9 | 0 | 0 | 9 | 3 |
| 81 | `src/components/TarjetaPendientes.jsx` | 9 | 0 | 0 | 9 | 6 |
| 82 | `src/components/MobileAnalisisClientes.jsx` | 8 | 8 | 0 | 0 | 4 |
| 83 | `src/components/MobileSellInGlobal.jsx` | 8 | 8 | 0 | 0 | 3 |
| 84 | `src/components/TarjetaPromociones.jsx` | 8 | 0 | 0 | 8 | 8 |
| 85 | `src/lib/constants.js` | 8 | 8 | 0 | 0 | 8 |
| 86 | `src/modules/general/EstadoResultados.jsx` | 8 | 1 | 7 | 0 | 6 |
| 87 | `src/components/BarraCuota.jsx` | 7 | 3 | 0 | 4 | 5 |
| 88 | `src/components/MobileBuscar.jsx` | 7 | 5 | 2 | 0 | 4 |
| 89 | `src/lib/exportar.js` | 7 | 5 | 2 | 0 | 5 |
| 90 | `src/lib/toast.jsx` | 7 | 5 | 2 | 0 | 7 |
| 91 | `src/components/ExportMenu.jsx` | 6 | 4 | 2 | 0 | 4 |
| 92 | `src/components/MobileSellOutGlobal.jsx` | 6 | 6 | 0 | 0 | 3 |
| 93 | `src/components/KPICard.jsx` | 5 | 0 | 0 | 5 | 4 |
| 94 | `src/components/MobileEstrategiaPrecios.jsx` | 5 | 5 | 0 | 0 | 2 |
| 95 | `src/main.jsx` | 5 | 5 | 0 | 0 | 5 |
| 96 | `src/modules/comercial/CreditoCobranzaV2.jsx` | 5 | 5 | 0 | 0 | 5 |
| 97 | `src/modules/comercial/marketing/Calendario.jsx` | 5 | 5 | 0 | 0 | 3 |
| 98 | `src/modules/comercial/marketing/config.js` | 5 | 5 | 0 | 0 | 5 |
| 99 | `src/modules/comercial/pagos/pagosUI.jsx` | 5 | 2 | 3 | 0 | 5 |
| 100 | `src/modules/comercial/RentabilidadBloque.jsx` | 5 | 5 | 0 | 0 | 3 |
| 101 | `src/components/SinAcceso.jsx` | 4 | 0 | 0 | 4 | 4 |
| 102 | `src/modules/comercial/marketing/ActividadForm.jsx` | 4 | 0 | 4 | 0 | 2 |
| 103 | `src/components/apple/AppleLoader.jsx` | 3 | 3 | 0 | 0 | 3 |
| 104 | `src/components/apple/index.jsx` | 2 | 0 | 2 | 0 | 2 |
| 105 | `src/components/CardHeader.jsx` | 2 | 0 | 0 | 2 | 2 |
| 106 | `src/components/MobileNav.jsx` | 2 | 0 | 2 | 0 | 2 |
| 107 | `src/modules/comercial/PagosCliente.jsx` | 2 | 0 | 2 | 0 | 1 |
| 108 | `src/modules/comercial/marketing/ActividadFila.jsx` | 1 | 1 | 0 | 0 | 1 |
| 109 | `src/modules/comercial/pagos/FondosPanels.jsx` | 1 | 1 | 0 | 0 | 1 |
| 110 | `src/modules/comercial/pagos/SpiffPanels.jsx` | 1 | 1 | 0 | 0 | 1 |

## Detalle por archivo — 5 líneas más repetidas

### `src/modules/comercial/HomeCliente.jsx` — 739 (hex 671 · rgb 12 · tw 56)

| Veces | Líneas | Código |
|---:|---|---|
| 12 | 1784, 1795, 1806, 1839, 2412, 2416, 2420, 2424, … (+4) | `React.createElement("div", { style: { fontSize: 10, color: "#94A3B8", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" } },` |
| 7 | 132, 167, 226, 233, 240, 247, 258 | `<div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">` |
| 5 | 976, 985, 1026, 1197, 1202 | `React.createElement("div", { style: { paddingTop: 10, borderTop: "1px dashed #E2E8F0" } },` |
| 4 | 922, 965, 1019, 1188 | `React.createElement("h4", { style: { margin: 0, fontSize: 13, color: "#1E293B", fontWeight: 700, display: "flex", alignItems: "center", gap:` |
| 3 | 963, 1018, 1187 | `return React.createElement("div", { style: { background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: 16, display: "flex"` |

### `src/modules/comercial/SellOutCliente.jsx` — 494 (hex 105 · rgb 0 · tw 389)

| Veces | Líneas | Código |
|---:|---|---|
| 5 | 707, 733, 917, 942, 1097 | `<div className="bg-white border border-gray-200 rounded-xl p-4">` |
| 5 | 1880, 2332, 2339, 2347, 2358 | `<div className="bg-gray-50 rounded-md p-2.5 border border-gray-100">` |
| 5 | 1872, 2341, 2349, 2375, 2394 | `<div className="text-[14px] font-bold tabular-nums text-gray-800">` |
| 4 | 1141, 1148, 1155, 1165 | `<div className="bg-white border border-sky-200 rounded-md p-2.5">` |
| 4 | 1151, 1158, 1170, 2352 | `<div className="text-[10px] text-gray-500 tabular-nums">` |

### `src/modules/comercial/EstrategiaProducto.jsx` — 480 (hex 452 · rgb 8 · tw 20)

| Veces | Líneas | Código |
|---:|---|---|
| 7 | 3149, 3150, 3170, 3171, 3207, 3208, 3209 | `React.createElement('th', { style: { textAlign: 'right', padding: '6px 8px', color: '#94A3B8', fontWeight: 600, fontSize: 10, textTransform:` |
| 6 | 3768, 3769, 3770, 3771, 3772, 3773 | `React.createElement("th", { style: { textAlign: "right", padding: "8px 10px", fontWeight: 600, color: "#991B1B", borderBottom: "2px solid #F` |
| 5 | 3147, 3148, 3168, 3169, 3206 | `React.createElement('th', { style: { textAlign: 'left', padding: '6px 8px', color: '#94A3B8', fontWeight: 600, fontSize: 10, textTransform: ` |
| 3 | 4145, 4220, 4359 | `style: { padding: "8px 16px", background: "#fff", color: "#475569", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 13, fontWeight: ` |
| 3 | 3375, 3376, 3377 | `React.createElement("th", { style: { textAlign: "left", padding: "8px 6px", fontWeight: 600, color: "#475569", borderBottom: "2px solid #E2E` |

### `src/modules/interno/EvaluacionesPanel.jsx` — 466 (hex 33 · rgb 1 · tw 432)

| Veces | Líneas | Código |
|---:|---|---|
| 13 | 604, 1588, 1603, 1608, 1753, 1993, 1999, 2014, … (+5) | `className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />` |
| 4 | 571, 1578, 1724, 1983 | `<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">` |
| 4 | 575, 1582, 1728, 1987 | `<button onClick={onClose}><X className="w-4 h-4 text-gray-500" /></button>` |
| 4 | 617, 1686, 1762, 2065 | `<button onClick={onClose} className="px-3 py-2 rounded-lg text-sm hover:bg-gray-100">Cancelar</button>` |
| 4 | 1592, 2003, 2024, 2041 | `className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">` |

### `src/modules/interno/AdministracionInterna.jsx` — 361 (hex 38 · rgb 1 · tw 322)

| Veces | Líneas | Código |
|---:|---|---|
| 3 | 819, 843, 867 | `: "bg-white border-gray-200 text-gray-600 hover:bg-gray-50",` |
| 3 | 818, 842, 1728 | `? "bg-blue-600 border-blue-600 text-white"` |
| 3 | 1669, 1710, 1917 | `className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">` |
| 3 | 1675, 1682, 1884 | `className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"` |
| 3 | 1688, 1906, 1911 | `className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />` |

### `src/modules/comercial/CreditoCobranza.jsx` — 279 (hex 3 · rgb 0 · tw 276)

| Veces | Líneas | Código |
|---:|---|---|
| 7 | 422, 584, 662, 714, 770, 841, 923 | `<div className="bg-white rounded-2xl shadow-sm p-5 mb-6">` |
| 4 | 1125, 1132, 1141, 1148 | `className="w-full px-2 py-1 border border-gray-300 rounded text-xs" />` |
| 3 | 615, 671, 683 | `<div className="h-3 bg-gray-100 rounded-full overflow-hidden">` |
| 3 | 650, 654, 870 | `<p className="text-sm text-gray-400 mt-2 italic">` |
| 3 | 716, 772, 780 | `<p className="text-xs text-gray-400 mb-3">` |

### `src/modules/comercial/AnalisisCliente.jsx` — 215 (hex 215 · rgb 0 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 8 | 663, 670, 674, 678, 686, 693, 697, 701 | `style: { padding: "5px 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 12 } },` |
| 3 | 709, 746, 789 | `el("tr", { style: { background: "#f8fafc", borderBottom: "2px solid #e2e8f0" } },` |
| 2 | 762, 804 | `var cSI = dSI === null ? "#94a3b8" : dSI >= 0 ? "#10b981" : "#ef4444";` |
| 2 | 763, 805 | `var cSO = dSO === null ? "#94a3b8" : dSO >= 0 ? "#10b981" : "#ef4444";` |
| 2 | 728, 764 | `return el("tr", { key: i, style: { borderBottom: "1px solid #f1f5f9" } },` |

### `src/modules/comercial/ForecastClientesTab.jsx` — 193 (hex 104 · rgb 63 · tw 26)

| Veces | Líneas | Código |
|---:|---|---|
| 2 | 2281, 2375 | `background: isDark ? 'rgba(255,159,10,0.14)' : 'rgba(255,149,0,0.12)',` |
| 2 | 2865, 3782 | `background: '#000', color: '#F5F5F7',` |
| 2 | 2886, 3467 | `background: 'rgba(10,132,255,.24)', color: '#5AC8FA',` |
| 2 | 1855, 1859 | `btnColor = '#fff';` |
| 2 | 2376, 2470 | `color: theme.orange \|\| '#FF9500',` |

### `src/modules/comercial/ReporteSection.jsx` — 192 (hex 5 · rgb 0 · tw 187)

| Veces | Líneas | Código |
|---:|---|---|
| 5 | 1352, 1357, 1363, 1368, 1374 | `className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />` |
| 3 | 499, 506, 514 | `className="rounded border-gray-300" />` |
| 2 | 1053, 1093 | `<div className="bg-white rounded-lg border border-gray-200 p-3">` |
| 2 | 381, 394 | `<Package className="w-5 h-5 text-gray-600" />` |
| 2 | 384, 397 | `<span className="text-xs text-gray-500 font-normal ml-2">` |

### `src/modules/configuracion/Configuracion.jsx` — 169 (hex 24 · rgb 5 · tw 140)

| Veces | Líneas | Código |
|---:|---|---|
| 3 | 394, 410, 416 | `className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"` |
| 2 | 386, 782 | `<div className="bg-white rounded-2xl shadow-sm p-6 mb-6 border border-gray-100">` |
| 2 | 467, 494 | `<label className="block text-sm font-medium text-gray-700 mb-2">` |
| 2 | 470, 497 | `<p className="text-xs text-gray-500 mb-3">` |
| 2 | 506, 680 | `<p className="text-[11px] text-gray-500 truncate">{p.desc}</p>` |

### `src/modules/comercial/PagosPromociones.jsx` — 163 (hex 12 · rgb 2 · tw 149)

| Veces | Líneas | Código |
|---:|---|---|
| 6 | 381, 476, 505, 511, 548, 555 | `className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"` |
| 2 | 489, 527 | `className="px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-xs font-medium whitespace-nowrap">` |
| 2 | 88, 675 | `<div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>` |
| 2 | 89, 676 | `<div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">` |
| 2 | 91, 677 | `<div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">` |

### `src/modules/comercial/OrdenesCompraTab.jsx` — 160 (hex 16 · rgb 1 · tw 143)

| Veces | Líneas | Código |
|---:|---|---|
| 9 | 747, 751, 755, 759, 763, 773, 777, 781, … (+1) | `className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />` |
| 3 | 334, 342, 351 | `className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-2 text-sm">` |
| 3 | 839, 843, 847 | `className="w-20 px-1.5 py-1 rounded border border-gray-200 text-xs text-right" />` |
| 2 | 231, 243 | `<div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">` |
| 2 | 741, 767 | `className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">` |

### `src/modules/comercial/ForecastCliente.jsx` — 150 (hex 148 · rgb 2 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 4 | 318, 322, 326, 330 | `React.createElement('div', { style: { backgroundColor: '#f1f5f9', padding: '6px 8px', borderRadius: '8px' } },` |
| 1 | 528 | `var colorMap = { critico: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' }, bajo: { bg: '#fffbeb', border: '#fde68a', text: '#92400e' }` |
| 1 | 223 | `var color = semanas < 2 ? '#dc2626' : semanas < 4 ? '#d97706' : semanas <= 12 ? '#16a34a' : '#2563eb';` |
| 1 | 601 | `backgroundColor: isActive ? '#6366f1' : '#ffffff', color: isActive ? '#ffffff' : '#64748b',` |
| 1 | 208 | `critico: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', label: 'Cr\u00edtico' },` |

### `src/modules/comercial/ForecastReservas.jsx` — 146 (hex 106 · rgb 40 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 2 | 753, 910 | `<div style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba` |
| 2 | 1182, 1327 | `{ key: 'digitalife', label: 'Digitalife', dot: '#AF52DE' },` |
| 2 | 1183, 1328 | `{ key: 'pcel', label: 'PCEL', dot: '#34C759' },` |
| 2 | 1184, 1329 | `{ key: 'dicotech', label: 'Dicotech', dot: '#FF9500' },` |
| 1 | 461 | `<div style={{ padding: 20, maxWidth: 720, margin: '40px auto', background: '#FBECEA', border: '1px solid #C0392B', borderRadius: 12, color: ` |

### `src/components/Topbar.jsx` — 145 (hex 84 · rgb 61 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 4 | 621, 777, 841, 939 | `background: isMidnight ? 'rgba(40,40,45,0.90)' : 'rgba(255,255,255,0.92)',` |
| 4 | 626, 782, 846, 944 | `boxShadow: isMidnight ? '0 12px 40px rgba(0,0,0,0.5)' : '0 12px 40px rgba(0,0,0,0.12)',` |
| 3 | 989, 999, 1007 | `onMouseEnter={(e) => e.currentTarget.style.background = isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,113,227,0.06)'}` |
| 2 | 408, 1106 | `linear-gradient(180deg, #1e1e2e 0%, #0d0d19 100%)ˋ,` |
| 2 | 406, 1104 | `radial-gradient(circle at 20% 30%, rgba(191,90,242,0.35) 0%, transparent 55%),` |

### `src/modules/interno/RecurrentesPanel.jsx` — 144 (hex 9 · rgb 1 · tw 134)

| Veces | Líneas | Código |
|---:|---|---|
| 3 | 606, 629, 648 | `: "bg-white border-gray-200 text-gray-600 hover:bg-gray-50",` |
| 2 | 647, 717 | `? "bg-blue-600 border-blue-600 text-white"` |
| 2 | 668, 698 | `className="w-24 px-3 py-2 rounded-lg border border-gray-200 text-sm"` |
| 1 | 194 | `tabResp === t.id ? "bg-white text-blue-700 shadow-sm" : "text-gray-600 hover:text-gray-900",` |
| 1 | 225 | `className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-sm text-gray-700 flex items-center gap-1.5 disabled:` |

### `src/modules/comercial/forecast/NovedadesCard.jsx` — 142 (hex 0 · rgb 0 · tw 142)

| Veces | Líneas | Código |
|---:|---|---|
| 2 | 303, 308 | `className="px-2 py-1 text-xs border border-gray-200 rounded bg-white">` |
| 2 | 268, 613 | `<Sparkles className="w-4 h-4 text-amber-500" />` |
| 2 | 610, 779 | `<div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>` |
| 2 | 612, 781 | `<div className="px-5 py-3 border-b border-gray-200 flex items-center gap-2">` |
| 2 | 616, 786 | `<X className="w-4 h-4 text-gray-500" />` |

### `src/modules/comercial/PropuestasTab.jsx` — 141 (hex 106 · rgb 35 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 6 | 2507, 2508, 2509, 2510, 2511, 2512 | `<th style={{ textAlign: 'right', padding: '8px 8px', color: '#FFF', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: ` |
| 4 | 1317, 1326, 1335, 1344 | `<div style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 24, fontWeight: 600, letterSpacing: '-0.028em', lineHeight: 1, col` |
| 4 | 1316, 1325, 1334, 1343 | `<div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(245,245,247,0.55)', marginBot` |
| 3 | 619, 1164, 2018 | `const heroBg = theme.heroCardBg \|\| (isDark ? '#0F0F0F' : '#1D1D1F');` |
| 3 | 2418, 2428, 2439 | `<div style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 22, fontWeight: 600, letterSpacing: '-0.025em', marginTop: 3, colo` |

### `src/modules/interno/TelemetriaPanel.jsx` — 138 (hex 119 · rgb 19 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 3 | 924, 942, 1386 | `<span style={{ color: '#8E8E93', fontVariantNumeric: 'tabular-nums' }}>{fmtHm(cnt)} · {pct.toFixed(0)}%</span>` |
| 2 | 877, 905 | `icon: '!', color: '#B25000',` |
| 2 | 1476, 1513 | `{!disabled && <button onClick={() => remove(i)} style={{ color: '#8E8E93', background: 'transparent', border: 'none', fontSize: 14, cursor: ` |
| 2 | 1485, 1528 | `<button onClick={add} style={{ background: '#1F7A3D', border: 'none', color: 'white',` |
| 1 | 8 | `const CLIENTE_COLOR = { 1: '#8B5CF6', 2: '#10B981', 3: '#0EA5E9', 4: '#F59E0B', 99: '#94A3B8' };` |

### `src/modules/interno/MinutasPanel.jsx` — 123 (hex 8 · rgb 1 · tw 114)

| Veces | Líneas | Código |
|---:|---|---|
| 3 | 750, 761, 766 | `className="px-2 py-1.5 rounded border border-gray-200 text-xs bg-white"` |
| 2 | 595, 612 | `className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"` |
| 1 | 321 | `listo ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-300 bg-white hover:border-emerald-500",` |
| 1 | 630 | `: "bg-white border-gray-200 text-gray-700 hover:bg-gray-50",` |
| 1 | 62 | `{ id: "alta", label: "Alta", bg: "bg-red-100", text: "text-red-700", dot: "#DC2626" },` |

### `src/modules/comercial/SellInCliente.jsx` — 122 (hex 41 · rgb 20 · tw 61)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 30 | `const CAT_COLORS = ['#0EA5E9', '#6366F1', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#94A3B8', '#F97316'];` |
| 1 | 26 | `dicotech: { nombre: 'Dicotech', marca: 'Acteck', accent: '#0EA5E9', badgeBg: 'bg-sky-50', badgeText: 'text-sky-700', dot: 'bg-sky-500' },` |
| 1 | 27 | `pcel: { nombre: 'PCEL', marca: 'Acteck', accent: '#0EA5E9', badgeBg: 'bg-sky-50', badgeText: 'text-sky-700', dot: 'bg-sky-500' },` |
| 1 | 28 | `digitalife: { nombre: 'Digitalife', marca: 'Acteck / Balam Rush', accent: '#0EA5E9', badgeBg: 'bg-sky-50', badgeText: 'text-sky-700', dot: '` |
| 1 | 120 | `? { nombre: 'Dirección Comercial', marca: 'Consolidado de todos los clientes', accent: '#0EA5E9', badgeBg: 'bg-sky-50', badgeText: 'text-sky` |

### `src/modules/comercial/SellOutClienteV2.jsx` — 91 (hex 59 · rgb 32 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 286 | `const CAT_COLORS = ['#0071E3', '#FF9F0A', '#30D158', '#BF5AF2', '#FF375F', '#64D2FF', '#5E5CE6', '#40C8E0', '#FFD60A', '#FF9500'];` |
| 1 | 40 | `const MARCA_COLORS = { acteck: '#0071E3', 'balam rush': '#BF5AF2', balam: '#BF5AF2', vorago: '#FF9F0A' };` |
| 1 | 469 | `const heroBg = theme.heroCardBg \|\| (isDark ? '#0A0A0C' : '#1C1C1E');` |
| 1 | 581 | `if (tone === 'good') return { bg: 'rgba(48,209,88,0.14)', color: '#0F8A3A' };` |
| 1 | 582 | `if (tone === 'warn') return { bg: 'rgba(255,159,10,0.14)', color: '#B76E00' };` |

### `src/modules/comercial/SellOutPcel.jsx` — 91 (hex 59 · rgb 32 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 289 | `const CAT_COLORS = ['#0071E3', '#FF9F0A', '#30D158', '#BF5AF2', '#FF375F', '#64D2FF', '#5E5CE6', '#40C8E0', '#FFD60A', '#FF9500'];` |
| 1 | 46 | `const MARCA_COLORS = { acteck: '#0071E3', 'balam rush': '#BF5AF2', balam: '#BF5AF2', vorago: '#FF9F0A' };` |
| 1 | 472 | `const heroBg = theme.heroCardBg \|\| (isDark ? '#0A0A0C' : '#1C1C1E');` |
| 1 | 584 | `if (tone === 'good') return { bg: 'rgba(48,209,88,0.14)', color: '#0F8A3A' };` |
| 1 | 585 | `if (tone === 'warn') return { bg: 'rgba(255,159,10,0.14)', color: '#B76E00' };` |

### `src/modules/interno/PendientesCalendarioV2.jsx` — 89 (hex 60 · rgb 29 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 3 | 493, 1031, 1301 | `const heroBg = theme.heroCardBg \|\| (isDark ? '#0F0F0F' : '#000000');` |
| 3 | 838, 1002, 1058 | `color: '#FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',` |
| 2 | 981, 1100 | `border: ˋ1.5px solid ${done ? theme.accent : (isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.15)')}ˋ,` |
| 2 | 983, 1102 | `color: '#FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700,` |
| 2 | 1035, 1305 | `position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',` |

### `src/modules/comercial/forecast/SolicitudesPanel.jsx` — 79 (hex 0 · rgb 0 · tw 79)

| Veces | Líneas | Código |
|---:|---|---|
| 2 | 209, 215 | `className="w-full px-1.5 py-0.5 border border-gray-200 rounded text-xs tabular-nums" />` |
| 2 | 221, 227 | `className="w-full px-1.5 py-0.5 border border-gray-200 rounded text-xs" />` |
| 1 | 40 | `className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"` |
| 1 | 143 | `className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font` |
| 1 | 157 | `? 'flex-1 bg-red-50 hover:bg-red-100 text-red-700 inline-flex items-center justify-center gap-1'` |

### `src/modules/configuracion/WizardNuevoUsuario.jsx` — 77 (hex 72 · rgb 5 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 2 | 456, 538 | `padding: '14px 18px', background: '#000', color: '#FFF',` |
| 2 | 451, 533 | `background: '#FFF', borderRadius: 16, overflow: 'hidden',` |
| 2 | 478, 562 | `<div style={{ fontSize: 14, fontWeight: 500, color: '#1D1D1F', lineHeight: 1.35 }}>{p.label}</div>` |
| 2 | 479, 563 | `<div style={{ fontSize: 12, color: '#86868B', marginTop: 3, lineHeight: 1.4 }}>{p.desc}</div>` |
| 1 | 206 | `color: n === paso ? '#000' : (n < paso ? '#34C759' : 'rgba(255,255,255,0.55)'),` |

### `src/modules/comercial/SellInClienteV2.jsx` — 73 (hex 46 · rgb 27 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 1023 | `const bg = r.sev === 'urgente' ? '#FF453A' : r.sev === 'warn' ? '#FF9F0A' : '#64D2FF';` |
| 1 | 421 | `const heroBg = theme.heroCardBg \|\| (isDark ? '#0A0A0C' : '#1C1C1E');` |
| 1 | 1000 | `linear-gradient(180deg, #1e1e2e 0%, #0d0d19 100%)ˋ,` |
| 1 | 1024 | `const iconColor = r.sev === 'info' ? '#000' : '#FFF';` |
| 1 | 1122 | `if (r > 0.50) return { bg: isDark ? 'rgba(10,132,255,0.45)' : ˋ${b}59ˋ, color: '#FFF', weight: 600 };` |

### `src/App.jsx` — 71 (hex 2 · rgb 1 · tw 68)

| Veces | Líneas | Código |
|---:|---|---|
| 2 | 664, 684 | `<p className="text-gray-500">Próximamente — esta pestaña está en construcción.</p>` |
| 1 | 133 | `className: "w-full py-2.5 rounded-lg text-sm font-medium transition-all " + (cargando ? "bg-gray-200 text-gray-500" : "bg-blue-600 text-whit` |
| 1 | 158 | `className: "w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"` |
| 1 | 162 | `React.createElement("div", { className: "bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200" },` |
| 1 | 172 | `React.createElement("div", { className: "bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 border border-emerald-200 cursor-po` |

### `src/modules/comercial/SellOutDicotech.jsx` — 70 (hex 35 · rgb 35 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 2 | 2018, 2271 | `const bg = isDark ? 'rgba(100,210,255,0.06)' : 'rgba(90,200,250,0.05)';` |
| 2 | 2019, 2272 | `const border = isDark ? 'rgba(100,210,255,0.20)' : 'rgba(90,200,250,0.28)';` |
| 2 | 1384, 1716 | `if (r > 0.75) return { bg: b, color: '#FFF', weight: 600 };` |
| 1 | 695 | `const heroBg = theme.heroCardBg \|\| (isDark ? '#0A0A0C' : '#1C1C1E');` |
| 1 | 896 | `if (tone === 'good') return { bg: 'rgba(48,209,88,0.14)', color: '#0F8A3A' };` |

### `src/modules/comercial/TrackingPedidos.jsx` — 69 (hex 54 · rgb 15 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 4 | 2424, 2442, 2471, 2558 | `const green = P.green \|\| '#34C759';` |
| 2 | 548, 1817 | `const heroBg = theme.heroCardBg \|\| (isDark ? '#0F0F0F' : '#1D1D1F');` |
| 2 | 549, 1818 | `const heroText = theme.heroCardText \|\| '#F5F5F7';` |
| 2 | 550, 1819 | `const heroMuted = 'rgba(255,255,255,0.72)';` |
| 2 | 551, 1820 | `const heroSub = 'rgba(255,255,255,0.55)';` |

### `src/modules/comercial/AnalisisClientesGlobal.jsx` — 60 (hex 27 · rgb 5 · tw 28)

| Veces | Líneas | Código |
|---:|---|---|
| 5 | 102, 637, 790, 1033, 1312 | `const green = theme.green \|\| '#34C759';` |
| 5 | 103, 638, 791, 1034, 1313 | `const red = theme.red \|\| '#FF3B30';` |
| 1 | 716 | `className={ˋpx-2.5 py-1 rounded text-xs ${orden === 'ytd' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}ˋ}` |
| 1 | 720 | `className={ˋpx-2.5 py-1 rounded text-xs ${orden === 'mes' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}ˋ}` |
| 1 | 634 | `const invBg = theme.surfaceInverse \|\| (isDark ? '#F5F5F7' : '#000000');` |

### `src/modules/comercial/HomeDicotech.jsx` — 48 (hex 35 · rgb 13 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 2 | 917, 1124 | `<rect x={boxX} y={boxY} width={boxW} height={32} rx="6" fill="#0A0A0C" />` |
| 2 | 919, 1126 | `fontFamily={TYPO.fontDisplay} fontSize="10.5" fontWeight="600" fill="#FFF">` |
| 2 | 923, 1130 | `fontFamily='"SF Mono", ui-monospace, monospace' fontSize="9" fill="rgba(255,255,255,0.65)">` |
| 1 | 1212 | `const bg = r.sev === 'urgente' ? '#FF453A' : r.sev === 'warn' ? '#FF9F0A' : '#64D2FF';` |
| 1 | 1177 | `linear-gradient(180deg, #1e1e2e 0%, #0d0d19 100%)ˋ,` |

### `src/modules/comercial/HomeDigitalife.jsx` — 48 (hex 35 · rgb 13 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 2 | 892, 1099 | `<rect x={boxX} y={boxY} width={boxW} height={32} rx="6" fill="#0A0A0C" />` |
| 2 | 894, 1101 | `fontFamily={TYPO.fontDisplay} fontSize="10.5" fontWeight="600" fill="#FFF">` |
| 2 | 898, 1105 | `fontFamily='"SF Mono", ui-monospace, monospace' fontSize="9" fill="rgba(255,255,255,0.65)">` |
| 1 | 1187 | `const bg = r.sev === 'urgente' ? '#FF453A' : r.sev === 'warn' ? '#FF9F0A' : '#64D2FF';` |
| 1 | 1152 | `linear-gradient(180deg, #1e1e2e 0%, #0d0d19 100%)ˋ,` |

### `src/modules/comercial/HomePcel.jsx` — 48 (hex 35 · rgb 13 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 2 | 903, 1110 | `<rect x={boxX} y={boxY} width={boxW} height={32} rx="6" fill="#0A0A0C" />` |
| 2 | 905, 1112 | `fontFamily={TYPO.fontDisplay} fontSize="10.5" fontWeight="600" fill="#FFF">` |
| 2 | 909, 1116 | `fontFamily='"SF Mono", ui-monospace, monospace' fontSize="9" fill="rgba(255,255,255,0.65)">` |
| 1 | 1198 | `const bg = r.sev === 'urgente' ? '#FF453A' : r.sev === 'warn' ? '#FF9F0A' : '#64D2FF';` |
| 1 | 1163 | `linear-gradient(180deg, #1e1e2e 0%, #0d0d19 100%)ˋ,` |

### `src/modules/comercial/forecast/EnviosEditor.jsx` — 46 (hex 0 · rgb 0 · tw 46)

| Veces | Líneas | Código |
|---:|---|---|
| 2 | 164, 172 | `className="px-2 py-1 text-xs rounded border border-gray-200 hover:bg-gray-50 text-gray-700"` |
| 1 | 219 | `className="w-full py-1.5 rounded border border-dashed border-gray-300 text-blue-600 hover:bg-blue-50 text-xs font-medium flex items-center j` |
| 1 | 228 | `? 'bg-emerald-50 border border-emerald-200 text-emerald-700'` |
| 1 | 229 | `: 'bg-amber-50 border border-amber-200 text-amber-700',` |
| 1 | 250 | `className="flex-1 px-3 py-2 rounded-md border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium disabled:opacity-50"` |

### `src/modules/comercial/SellInDicotech.jsx` — 45 (hex 33 · rgb 12 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 891 | `const bg = r.sev === 'urgente' ? '#FF453A' : r.sev === 'warn' ? '#FF9F0A' : '#64D2FF';` |
| 1 | 313 | `const heroBg = theme.heroCardBg \|\| (isDark ? '#0A0A0C' : '#1C1C1E');` |
| 1 | 868 | `linear-gradient(180deg, #1e1e2e 0%, #0d0d19 100%)ˋ,` |
| 1 | 892 | `const iconColor = r.sev === 'info' ? '#000' : '#FFF';` |
| 1 | 947 | `if (r > 0.50) return { bg: isDark ? 'rgba(10,132,255,0.45)' : ˋ${b}59ˋ, color: '#FFF', weight: 600 };` |

### `src/modules/comercial/SellInPcel.jsx` — 45 (hex 33 · rgb 12 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 929 | `const bg = r.sev === 'urgente' ? '#FF453A' : r.sev === 'warn' ? '#FF9F0A' : '#64D2FF';` |
| 1 | 350 | `const heroBg = theme.heroCardBg \|\| (isDark ? '#0A0A0C' : '#1C1C1E');` |
| 1 | 906 | `linear-gradient(180deg, #1e1e2e 0%, #0d0d19 100%)ˋ,` |
| 1 | 930 | `const iconColor = r.sev === 'info' ? '#000' : '#FFF';` |
| 1 | 990 | `if (r > 0.50) return { bg: isDark ? 'rgba(10,132,255,0.45)' : ˋ${b}59ˋ, color: '#FFF', weight: 600 };` |

### `src/components/MobileShell.jsx` — 43 (hex 29 · rgb 14 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 349 | `background: ˋradial-gradient(circle at 20% 30%, rgba(191,90,242,0.35) 0%, transparent 55%), radial-gradient(circle at 80% 70%, rgba(100,210,` |
| 1 | 55 | `const CLIENTE_DOT = { digitalife: '#5856D6', dicotech: '#FF9500', pcel: '#34C759' };` |
| 1 | 193 | `const chromeSurface = isDark ? 'rgba(20,20,22,0.72)' : (theme.key === 'marfil' ? 'rgba(247,243,236,0.86)' : 'rgba(255,255,255,0.82)');` |
| 1 | 217 | `background: theme.mode === 'dark' ? 'rgba(120,120,128,.24)' : 'rgba(120,120,128,.16)',` |
| 1 | 262 | `background: ˋlinear-gradient(135deg, ${theme.pink \|\| '#FF2D55'}, ${theme.orange \|\| '#FF9500'})ˋ,` |

### `src/modules/comercial/EstrategiaPrecios.jsx` — 43 (hex 35 · rgb 8 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 2 | 382, 852 | `const heroBg = theme.heroCardBg \|\| (isDark ? '#0F0F0F' : '#1D1D1F');` |
| 2 | 139, 1166 | `color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center',` |
| 2 | 383, 853 | `const heroText = theme.heroCardText \|\| '#F5F5F7';` |
| 2 | 385, 855 | `const heroSubtle = 'rgba(255,255,255,0.55)';` |
| 1 | 41 | `RMI: { bg:'#E1F5EE', text:'#085041' },` |

### `src/modules/comercial/LineamientosCliente.jsx` — 43 (hex 4 · rgb 0 · tw 39)

| Veces | Líneas | Código |
|---:|---|---|
| 2 | 114, 131 | `<div key={i} className="flex items-center gap-3 bg-gray-50 rounded px-3 py-1.5">` |
| 1 | 192 | `className="text-xs px-2 py-1 rounded bg-white border border-gray-200 hover:border-blue-400 hover:text-blue-600 inline-flex items-center gap-` |
| 1 | 251 | `className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 inline-flex items-center gap-1"` |
| 1 | 156 | `<div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">` |
| 1 | 207 | `<div className="mt-2 text-xs text-gray-500 italic border-l-2 border-gray-200 pl-3">` |

### `src/modules/comercial/forecast/SolicitudesModal.jsx` — 41 (hex 0 · rgb 0 · tw 41)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 112 | `className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"` |
| 1 | 124 | `className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs"` |
| 1 | 134 | `className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-50 hover:bg-red-100 text-red-700 text-xs"` |
| 1 | 147 | `className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs"` |
| 1 | 19 | `pendiente: { label: 'Pendiente', bg: 'bg-amber-100', text: 'text-amber-700' },` |

### `src/modules/comercial/forecast/GrupoContenedorEditor.jsx` — 39 (hex 0 · rgb 0 · tw 39)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 195 | `className="flex-1 px-3 py-2 rounded-md border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium disabled:opacity-50"` |
| 1 | 203 | `className="flex-1 px-3 py-2 rounded-md bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium disabled:opacity-50"` |
| 1 | 223 | `: 'bg-white border-gray-200 hover:bg-gray-50',` |
| 1 | 228 | `selected ? 'bg-purple-600 border-purple-600' : 'border-gray-300',` |
| 1 | 120 | `<div className="px-5 py-3 bg-gray-50/50 border-b border-gray-100 text-xs">` |

### `src/components/MobileEdR.jsx` — 36 (hex 25 · rgb 11 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 228 | `? (isDark ? 'linear-gradient(135deg, rgba(48,209,88,.14), rgba(48,209,88,.06))' : 'linear-gradient(135deg, rgba(52,199,89,.14), rgba(52,199,` |
| 1 | 229 | `: (isDark ? 'linear-gradient(135deg, rgba(255,69,58,.14), rgba(255,69,58,.06))' : 'linear-gradient(135deg, rgba(255,59,48,.14), rgba(255,59,` |
| 1 | 230 | `border: ˋ1px solid ${utFinalYTD >= 0 ? (isDark ? 'rgba(48,209,88,.30)' : 'rgba(52,199,89,.30)') : 'rgba(255,59,48,.30)'}ˋ,` |
| 1 | 235 | `color: utFinalYTD >= 0 ? (theme.green \|\| '#34C759') : (theme.red \|\| '#FF3B30'),` |
| 1 | 242 | `de {fmtCompact(ventaYTD)} en ingresos · <b style={{ color: margenNeto >= 8 ? (theme.green \|\| '#34C759') : (theme.orange \|\| '#FF9500') }}>{fm` |

### `src/modules/comercial/MarketingClienteV2.jsx` — 36 (hex 16 · rgb 20 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 2 | 1082, 1253 | `? '0 40px 100px rgba(0,0,0,0.60), 0 8px 26px rgba(0,0,0,0.35)'` |
| 2 | 1083, 1254 | `: '0 40px 100px rgba(0,0,0,0.30), 0 8px 26px rgba(0,0,0,0.14)';` |
| 2 | 1087, 1257 | `style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,12,0.55)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-sta` |
| 1 | 866 | `if (tone === 'good') return { bg: 'rgba(48,209,88,0.14)', color: '#0F8A3A' };` |
| 1 | 867 | `if (tone === 'warn') return { bg: 'rgba(255,159,10,0.14)', color: '#B76E00' };` |

### `src/components/MobileHome.jsx` — 35 (hex 25 · rgb 10 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 2 | 393, 502 | `color: '#fff', display: 'grid', placeItems: 'center',` |
| 1 | 362 | `home: '#8E8E93', sellIn: '#007AFF', estrategia: '#FF9500',` |
| 1 | 363 | `marketing: '#AF52DE', pagos: '#34C759', cartera: '#FF2D55',` |
| 1 | 154 | `background: isDark ? 'rgba(120,120,128,.24)' : 'rgba(120,120,128,.16)',` |
| 1 | 228 | `? 'linear-gradient(135deg, rgba(255,55,95,.14), rgba(255,159,10,.08))'` |

### `src/modules/comercial/SellInDrillDown.jsx` — 35 (hex 28 · rgb 6 · tw 1)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 13 | `RMI: { bg:'#E1F5EE', text:'#085041' },` |
| 1 | 14 | `RML: { bg:'#EEEDFE', text:'#3C3489' },` |
| 1 | 15 | `2026: { bg:'#FAEEDA', text:'#854F0B' },` |
| 1 | 16 | `RMS: { bg:'#FBEAF0', text:'#993556' },` |
| 1 | 20 | `DISTRIBUIDOR: { bg: '#E5EAF2', color: '#334155', label: 'Distrib' },` |

### `src/components/MobileEquipo.jsx` — 33 (hex 28 · rgb 5 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 2 | 275, 329 | `background: theme.green \|\| '#34C759',` |
| 1 | 43 | `['#FF2D55', '#FF9500'], ['#5856D6', '#AF52DE'], ['#5AC8FA', '#007AFF'],` |
| 1 | 44 | `['#34C759', '#5AC8FA'], ['#FF9500', '#FFCC00'], ['#AF52DE', '#FF2D55'],` |
| 1 | 148 | `background: theme.mode === 'dark' ? 'rgba(120,120,128,.24)' : 'rgba(120,120,128,.16)',` |
| 1 | 270 | `background: 'rgba(52,199,89,.15)', color: theme.green \|\| '#34C759',` |

### `src/modules/settings/ActualizacionDatos.jsx` — 33 (hex 33 · rgb 0 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 2 | 287, 690 | `<div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap` |
| 2 | 290, 692 | `<h3 style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', margin: 0 }}>{title}</h3>` |
| 1 | 304 | `background: disabled ? '#94a3b8' : '#2563eb', color: 'white', border: 0, borderRadius: 8,` |
| 1 | 310 | `{log && <pre style={{ fontSize: 11, color: '#475569', background: '#f8fafc', padding: 8, borderRadius: 6, margin: 0, maxHeight: 120, overflo` |
| 1 | 608 | `style={{ background: '#3B82F6', color: '#fff', padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none'` |

### `src/components/Sidebar.jsx` — 32 (hex 23 · rgb 9 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 3 | 462, 485, 594 | `color: 'var(--t-sidebarTextMuted, #86868B)',` |
| 2 | 51, 64 | `color: '#EF4444',` |
| 2 | 232, 254 | `color: 'var(--t-sidebarText, #1D1D1F)',` |
| 2 | 258, 375 | `color: 'var(--t-sidebarTextMuted, #6E6E73)',` |
| 1 | 245 | `color: theme.key === 'midnight' ? '#000' : theme.textOnDark \|\| '#F5F5F7',` |

### `src/modules/comercial/forecast/NecesidadCard.jsx` — 32 (hex 4 · rgb 0 · tw 28)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 106 | `<div className="bg-white rounded-xl border border-gray-200">` |
| 1 | 146 | `<div className="font-bold tabular-nums" style={{ color: p.brechaMxn > 0 ? '#dc2626' : '#10B981' }}>` |
| 1 | 183 | `<div className="overflow-y-auto max-h-72 rounded border border-gray-200 bg-white">` |
| 1 | 185 | `<thead className="bg-gray-50 text-[10px] text-gray-500 sticky top-0">` |
| 1 | 196 | `<tr key={s.sku} className="border-t border-gray-100 hover:bg-blue-50/30">` |

### `src/modules/auth/LoginPage.jsx` — 30 (hex 9 · rgb 21 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 279 | `background: loading ? 'rgba(10,132,255,0.55)' : (hover ? '#409CFF' : '#0A84FF'),` |
| 1 | 234 | `color: floated ? 'rgba(245,245,247,0.6)' : 'rgba(245,245,247,0.5)',` |
| 1 | 287 | `? '0 8px 32px rgba(10,132,255,0.5), 0 0 0 1px rgba(255,255,255,0.15) inset'` |
| 1 | 88 | `background: '#000',` |
| 1 | 98 | `radial-gradient(circle at ${mouseX}% ${mouseY}%, rgba(10,132,255,0.35) 0%, transparent 40%),` |

### `src/modules/comercial/forecast/AlertasCard.jsx` — 30 (hex 0 · rgb 0 · tw 30)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 142 | `alta: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: 'text-red-500' },` |
| 1 | 143 | `media: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: 'text-amber-500' },` |
| 1 | 144 | `baja: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', icon: 'text-gray-400' },` |
| 1 | 97 | `<div className="bg-white rounded-xl border border-gray-200 p-4">` |
| 1 | 116 | `<div className="bg-white rounded-xl border border-gray-200">` |

### `src/modules/auth/SetPasswordPage.jsx` — 27 (hex 25 · rgb 2 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 2 | 160, 193 | `background: '#F5F5F7', border: '1px solid rgba(0,0,0,0.06)',` |
| 2 | 162, 195 | `fontFamily: 'inherit', color: '#1D1D1F',` |
| 1 | 20 | `const FUERZA_COLOR = ['#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#0A84FF'];` |
| 1 | 210 | `background: loading ? '#4DA3FF' : '#007AFF', color: '#FFF',` |
| 1 | 113 | `background: 'linear-gradient(180deg, #F5F5F7 0%, #E8E8ED 100%)',` |

### `src/modules/comercial/forecast/TransitoTimeline.jsx` — 27 (hex 0 · rgb 0 · tw 27)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 110 | `<div className="bg-white rounded-xl border border-gray-200">` |
| 1 | 157 | `{expandido ? <ChevronUp className="w-4 h-4 text-gray-400"/> : <ChevronDown className="w-4 h-4 text-gray-400"/>}` |
| 1 | 111 | `<div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">` |
| 1 | 112 | `<Ship className="w-4 h-4 text-blue-600" />` |
| 1 | 113 | `<h3 className="font-semibold text-gray-800 text-sm">Tránsito · próximos 6 meses</h3>` |

### `src/components/FerrutekLoader.jsx` — 24 (hex 21 · rgb 3 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 107 | `background: ˋradial-gradient(ellipse, ${isDark ? 'rgba(191,90,242,0.4)' : 'rgba(0,0,0,0.35)'}, transparent 70%)ˋ,` |
| 1 | 16 | `<stop offset="0%" stopColor="#F5E6FF" />` |
| 1 | 17 | `<stop offset="40%" stopColor="#D0A8F0" />` |
| 1 | 18 | `<stop offset="100%" stopColor="#AF52DE" />` |
| 1 | 22 | `<ellipse cx="70" cy="75" rx="52" ry="60" fill="#AF52DE" opacity="0.22" />` |

### `src/components/MobileYo.jsx` — 24 (hex 20 · rgb 4 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 2 | 79, 104 | `background: theme.accentSoft \|\| 'rgba(0,122,255,.10)', color: theme.accent,` |
| 2 | 90, 258 | `color: '#fff', display: 'grid', placeItems: 'center',` |
| 1 | 32 | `claro: { a: '#F5F5F7', b: '#000000', label: 'Claro', emoji: '☀' },` |
| 1 | 33 | `midnight: { a: '#000000', b: '#1D1D1F', label: 'Midnight', emoji: '🌙' },` |
| 1 | 34 | `marfil: { a: '#F7F3EC', b: '#0055B5', label: 'Marfil', emoji: '🎨' },` |

### `src/lib/roadmapColors.js` — 24 (hex 24 · rgb 0 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 6 | 18, 24, 29, 39, 44, 66 | `color: "#1F2937",` |
| 2 | 34, 50 | `color: "#FFFFFF",` |
| 2 | 43, 65 | `bg: "#FFC000",` |
| 2 | 55, 60 | `bg: "#FEE2E2",` |
| 2 | 56, 61 | `color: "#991B1B",` |

### `src/components/MobileCartera.jsx` — 23 (hex 21 · rgb 2 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 260 | `const color = r.dias > 180 ? '#B00020' : r.dias > 90 ? '#FF3B30' : r.dias > 60 ? '#FF2D55' : r.dias > 30 ? '#FF9500' : '#FFCC00';` |
| 1 | 181 | `<div style={{ margin: '4px 18px', padding: 16, background: 'rgba(255,59,48,.10)', border: '1px solid rgba(255,59,48,.22)', borderRadius: 12,` |
| 1 | 219 | `background: linea.pct > 90 ? (theme.red \|\| '#FF3B30') : linea.pct > 75 ? (theme.orange \|\| '#FF9500') : (theme.green \|\| '#34C759'),` |
| 1 | 298 | `: dAtr <= 180 ? '#FF3B30' : '#B00020';` |
| 1 | 329 | `const color = positive === true ? (theme.green \|\| '#34C759') : positive === false ? (theme.pink \|\| theme.red \|\| '#FF3B30') : theme.textMuted` |

### `src/modules/comercial/forecast/AgregarLineaModal.jsx` — 23 (hex 14 · rgb 9 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 103 | `background: '#000', color: '#F5F5F7',` |
| 1 | 170 | `background: isDark ? 'rgba(10,132,255,.10)' : 'rgba(0,122,255,.06)',` |
| 1 | 312 | `background: isDark ? 'rgba(48,209,88,.12)' : 'rgba(52,199,89,.10)',` |
| 1 | 351 | `background: theme.accent \|\| '#007AFF', border: 0, color: '#fff',` |
| 1 | 32 | `const semGreen = '#1C7A34';` |

### `src/modules/interno/HistorialCambios.jsx` — 22 (hex 18 · rgb 4 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 135 | `const PALETA_AVATAR = ['#007AFF', '#AF52DE', '#FF9500', '#34C759', '#FF2D55', '#5AC8FA', '#5856D6', '#FFCC00'];` |
| 1 | 164 | `const heroBg = theme.heroCardBg \|\| (isDark ? '#0A0A0C' : '#1C1C1E');` |
| 1 | 137 | `if (!email) return '#86868B';` |
| 1 | 157 | `blue: theme.accent \|\| '#007AFF',` |
| 1 | 158 | `green: theme.green \|\| '#34C759',` |

### `src/components/MobileTrackingPedidos.jsx` — 20 (hex 16 · rgb 4 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 10 | `const CLIENTE_DOT = { digitalife: '#5856D6', dicotech: '#FF9500', pcel: '#34C759' };` |
| 1 | 86 | `<div style={{ margin: '4px 18px 10px', padding: '12px 14px', background: 'rgba(255,59,48,.10)', border: '1px solid rgba(255,59,48,.22)', bor` |
| 1 | 87 | `<div style={{ width: 30, height: 30, borderRadius: 8, background: theme.red \|\| '#FF3B30', color: '#fff', display: 'grid', placeItems: 'cente` |
| 1 | 145 | `function Kpi({ theme, label, value, delta, positive }) { const color = positive === true ? (theme.green \|\| '#34C759') : positive === false ?` |
| 1 | 16 | `cotizacion: { label: 'Cotización', color: '#5856D6' },` |

### `src/modules/comercial/VisionGeneral.jsx` — 20 (hex 0 · rgb 20 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 3 | 241, 1738, 2237 | `const invMuted = isDark ? 'rgba(29,29,31,0.7)' : 'rgba(245,245,247,0.72)';` |
| 2 | 1042, 2724 | `const invMuted = theme.mode === 'dark' ? 'rgba(29,29,31,0.65)' : 'rgba(245,245,247,0.7)';` |
| 2 | 1081, 1286 | `const invMuted = isDark ? 'rgba(29,29,31,0.65)' : 'rgba(245,245,247,0.7)';` |
| 1 | 893 | `const invMuted = theme.mode === 'dark' ? 'rgba(29,29,31,0.72)' : 'rgba(245,245,247,0.72)';` |
| 1 | 242 | `const invDivider = isDark ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.14)';` |

### `src/modules/interno/AxonMexico.jsx` — 20 (hex 0 · rgb 0 · tw 20)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 26 | `<div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3 mb-6">` |
| 1 | 40 | `<div className="bg-white border border-gray-200 rounded-xl overflow-hidden">` |
| 1 | 41 | `<div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">` |
| 1 | 76 | `<span className="text-[11px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">` |
| 1 | 16 | `<div className="p-2.5 bg-indigo-100 rounded-lg">` |

### `src/components/MobileHoy.jsx` — 19 (hex 13 · rgb 6 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 31 | `digitalife: { bg: 'rgba(88,86,214,0.12)', color: '#5856D6', label: 'Digitalife' },` |
| 1 | 32 | `dicotech: { bg: 'rgba(255,149,0,0.12)', color: '#FF9500', label: 'Dicotech' },` |
| 1 | 33 | `pcel: { bg: 'rgba(52,199,89,0.12)', color: '#34C759', label: 'PCEL' },` |
| 1 | 239 | `padding: '12px 14px', background: 'rgba(255,59,48,.10)',` |
| 1 | 240 | `border: '1px solid rgba(255,59,48,.22)', borderRadius: 14,` |

### `src/components/MobileSellOut.jsx` — 19 (hex 17 · rgb 2 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 21 | `const MARCA_COLORS = ['#007AFF', '#FF2D55', '#FF9500', '#5856D6', '#34C759', '#AF52DE'];` |
| 1 | 22 | `const SUC_COLORS = ['#5856D6', '#34C759', '#FF9500', '#5AC8FA', '#FF2D55', '#AF52DE'];` |
| 1 | 215 | `<div style={{ margin: '4px 18px', padding: 16, background: 'rgba(255,59,48,.10)', border: '1px solid rgba(255,59,48,.22)', borderRadius: 12,` |
| 1 | 255 | `color: delta > 0 ? (theme.green \|\| '#34C759') : delta < 0 ? (theme.pink \|\| '#FF3B30') : theme.textMuted }}>` |
| 1 | 328 | `const color = positive === true ? (theme.green \|\| '#34C759') : positive === false ? (theme.pink \|\| theme.red \|\| '#FF3B30') : theme.textMuted` |

### `src/components/TarjetaMinuta.jsx` — 18 (hex 0 · rgb 0 · tw 18)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 32 | `<div className={ˋh-full rounded-full ${pct === 100 ? "bg-green-500" : pct >= 60 ? "bg-yellow-400" : "bg-red-400"}ˋ}` |
| 1 | 39 | `<div key={a.id} className={ˋflex gap-3 text-sm p-3 rounded-xl ${a.cumplido ? "bg-green-50" : "bg-gray-50"}ˋ}>` |
| 1 | 42 | `<p className={ˋfont-medium leading-snug ${a.cumplido ? "text-gray-500 line-through" : "text-gray-800"}ˋ}>{a.descripcion}</p>` |
| 1 | 9 | `<div className="bg-white rounded-2xl shadow-sm p-5">` |
| 1 | 13 | `<p className="text-xs text-gray-400">Fecha reunión</p>` |

### `src/components/MobileInventarioGlobal.jsx` — 15 (hex 13 · rgb 2 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 10 | `const FAM_COLORS = ['#007AFF', '#FF2D55', '#FF9500', '#5856D6', '#AF52DE', '#34C759', '#5AC8FA', '#FFCC00'];` |
| 1 | 88 | `style={{ width: 'calc(100% - 36px)', margin: '4px 18px 10px', padding: '12px 14px', background: 'rgba(255,59,48,.10)', border: '1px solid rg` |
| 1 | 89 | `<div style={{ width: 30, height: 30, borderRadius: 8, background: theme.red \|\| '#FF3B30', color: '#fff', display: 'grid', placeItems: 'cente` |
| 1 | 127 | `function Kpi({ theme, label, value, delta, positive }) { const color = positive === true ? (theme.green \|\| '#34C759') : positive === false ?` |
| 1 | 113 | `<div style={{ fontSize: 10.5, color: theme.pink \|\| theme.red \|\| '#FF3B30' }}>{r.dias_sin_venta}d</div>` |

### `src/components/MobileVisionGeneral.jsx` — 14 (hex 14 · rgb 0 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 313 | `const color = positive === true ? (theme.green \|\| '#34C759') : positive === false ? (theme.pink \|\| theme.red \|\| '#FF3B30') : theme.textMuted` |
| 1 | 26 | `digitalife: '#5856D6',` |
| 1 | 27 | `dicotech: '#FF9500',` |
| 1 | 28 | `pcel: '#34C759',` |
| 1 | 29 | `mercadolibre: '#FFCC00',` |

### `src/components/TarjetaPagos.jsx` — 14 (hex 0 · rgb 0 · tw 14)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 8 | `"vencida": { bg: "bg-red-100", text: "text-red-700", icon: "â ️" },` |
| 1 | 9 | `"por vencer": { bg: "bg-yellow-100", text: "text-yellow-700", icon: "🕐" },` |
| 1 | 10 | `"vigente": { bg: "bg-green-100", text: "text-green-700", icon: "â" },` |
| 1 | 14 | `<div className="bg-white rounded-2xl shadow-sm p-5">` |
| 1 | 23 | `<p className="text-gray-700 font-medium">{p.factura}</p>` |

### `src/components/GestionCuotasPanel.jsx` — 13 (hex 9 · rgb 4 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 192 | `<div style={{ background: '#000', color: '#F5F5F7', padding: '18px 22px', borderRadius: '16px 16px 0 0', display: 'flex', alignItems: 'cente` |
| 1 | 230 | `background: '#000', color: '#fff', fontFamily: 'inherit', opacity: busy ? 0.5 : 1,` |
| 1 | 17 | `const P_ACCENT = '#007AFF';` |
| 1 | 182 | `position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)',` |
| 1 | 189 | `boxShadow: '0 20px 60px rgba(0,0,0,0.25)', border: ˋ1px solid ${theme.border}ˋ,` |

### `src/modules/comercial/ResumenClientesTab.jsx` — 13 (hex 10 · rgb 3 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 35 | `accent: theme.accent \|\| '#007AFF',` |
| 1 | 36 | `green: theme.green \|\| '#34C759',` |
| 1 | 37 | `orange: theme.orange \|\| '#FF9500',` |
| 1 | 38 | `red: theme.red \|\| '#FF3B30',` |
| 1 | 39 | `purple: theme.purple \|\| '#AF52DE',` |

### `src/components/MobileCobranzaGlobal.jsx` — 12 (hex 12 · rgb 0 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 10 | `const CLIENTE_DOT = { digitalife: '#5856D6', dicotech: '#FF9500', pcel: '#34C759' };` |
| 1 | 155 | `function Kpi({ theme, label, value, delta, positive }) { const color = positive === true ? (theme.green \|\| '#34C759') : positive === false ?` |
| 1 | 158 | `function MiniKpi({ theme, label, value, sub, positive }) { const color = positive === true ? (theme.green \|\| '#34C759') : positive === false` |
| 1 | 108 | `<div style={{ width: 30, height: 30, borderRadius: 8, background: c.color, color: '#fff', display: 'grid', placeItems: 'center', fontFamily:` |
| 1 | 127 | `{ n: '0-30d', m: agingData.d0_30, c: theme.green \|\| '#34C759' },` |

### `src/components/MobileHomeCliente.jsx` — 11 (hex 11 · rgb 0 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 213 | `const iconColor = { sellIn: theme.accent, estrategia: theme.orange \|\| '#FF9500', marketing: theme.purple \|\| '#AF52DE', pagos: theme.green \|\|` |
| 1 | 23 | `const CLIENTE_DOT = { digitalife: '#5856D6', dicotech: '#FF9500', pcel: '#34C759' };` |
| 1 | 275 | `const color = positive === true ? (theme.green \|\| '#34C759') : positive === false ? (theme.pink \|\| theme.red \|\| '#FF3B30') : theme.textMuted` |
| 1 | 175 | `<div style={{ fontSize: 11.5, marginTop: 6, color: theme.pink \|\| theme.red \|\| '#FF3B30', fontWeight: 600 }}>` |
| 1 | 179 | `<div style={{ fontSize: 11.5, marginTop: 6, color: theme.green \|\| '#34C759', fontWeight: 700 }}>` |

### `src/components/MobilePropuestas.jsx` — 11 (hex 8 · rgb 3 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 58 | `const badge = p.estado === 'Enviada' ? { bg: 'rgba(52,199,89,.14)', c: theme.green \|\| '#34C759' } : p.estado === 'Cerrada' ? { bg: 'rgba(0,1` |
| 1 | 9 | `const CLIENTE_DOT = { digitalife: '#5856D6', dicotech: '#FF9500', pcel: '#34C759' };` |
| 1 | 88 | `function Kpi({ theme, label, value, delta, positive }) { const color = positive === true ? (theme.green \|\| '#34C759') : positive === false ?` |
| 1 | 62 | `<div style={{ width: 26, height: 26, borderRadius: 7, background: cliCol, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: ` |

### `src/components/MobileSellIn.jsx` — 10 (hex 10 · rgb 0 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 304 | `const MARCA_COLORS = ['#007AFF', '#FF2D55', '#FF9500', '#5856D6', '#34C759', '#AF52DE'];` |
| 1 | 225 | `color: delta > 0 ? (theme.green \|\| '#34C759') : delta < 0 ? (theme.pink \|\| '#FF3B30') : theme.textMuted }}>` |
| 1 | 307 | `const color = positive === true ? (theme.green \|\| '#34C759') : positive === false ? (theme.pink \|\| theme.red \|\| '#FF3B30') : theme.textMuted` |

### `src/components/MobileSOP.jsx` — 10 (hex 10 · rgb 0 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 12 | `const CLIENTE_DOT = { digitalife: '#5856D6', dicotech: '#FF9500', pcel: '#34C759' };` |
| 1 | 161 | `function Kpi({ theme, label, value, delta, positive }) { const color = positive === true ? (theme.green \|\| '#34C759') : positive === false ?` |
| 1 | 129 | `<div style={{ position: 'absolute', top: -2, bottom: -2, left: ˋ${metaPct}%ˋ, width: 2, background: theme.red \|\| '#FF3B30' }} />` |
| 1 | 138 | `<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 2, height: 10, background: theme.red \|\| '#FF3B3` |
| 1 | 148 | `<br /><br />Necesitas cerrar <b style={{ color: theme.red \|\| '#FF3B30' }}>{fmtCompact(kpis.gap)} en {kpis.rest} días</b> — ritmo de {fmtComp` |

### `src/modules/comercial/ComparadorPeriodos.jsx` — 10 (hex 5 · rgb 5 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 75 | `const accent = theme.accent \|\| '#007AFF', green = theme.green \|\| '#34C759', red = theme.red \|\| '#FF3B30';` |
| 1 | 173 | `const segBg = isDark ? 'rgba(120,120,128,0.24)' : 'rgba(120,120,128,0.12)';` |
| 1 | 174 | `const segOn = isDark ? 'rgba(99,99,102,0.9)' : '#FFFFFF';` |
| 1 | 175 | `const segOff = isDark ? 'rgba(235,235,245,0.60)' : 'rgba(60,60,67,0.60)';` |
| 1 | 258 | `style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 999, cursor: 'pointer', background: copiad` |

### `src/components/BandejaAlertas.jsx` — 9 (hex 9 · rgb 0 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 190 | `const col = c.critica ? (theme.red \|\| '#FF3B30') : (theme.orange \|\| '#FF9500');` |
| 1 | 30 | `critica: theme.red \|\| '#FF3B30',` |
| 1 | 31 | `alta: theme.orange \|\| '#FF9500',` |
| 1 | 32 | `media: theme.yellow \|\| '#FFCC00',` |
| 1 | 33 | `info: theme.accent \|\| '#007AFF',` |

### `src/components/MobileMarketing.jsx` — 9 (hex 7 · rgb 2 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 151 | `<div style={{ margin: '4px 18px', padding: 16, background: 'rgba(255,59,48,.10)', border: '1px solid rgba(255,59,48,.22)', borderRadius: 12,` |
| 1 | 253 | `const color = positive === true ? (theme.green \|\| '#34C759') : positive === false ? (theme.pink \|\| theme.red \|\| '#FF3B30') : theme.textMuted` |
| 1 | 93 | `.map(([k, v]) => ({ k, monto: v, def: TIPOS[k] \|\| { label: k, color: '#8E8E93' } }))` |
| 1 | 204 | `const tipo = TIPOS[a.tipo] \|\| { label: a.tipo \|\| 'Otro', color: '#8E8E93', Icon: PartyPopper };` |
| 1 | 229 | `{done && <span style={{ color: theme.green \|\| '#34C759', fontWeight: 700 }}>· ✓ listo</span>}` |

### `src/components/Semaforo.jsx` — 9 (hex 0 · rgb 0 · tw 9)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 5 | `verde: { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500", label: "Saludable" },` |
| 1 | 6 | `amarillo: { bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-400", label: "Atención" },` |
| 1 | 7 | `rojo: { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500", label: "Crítico" },` |

### `src/components/TarjetaPendientes.jsx` — 9 (hex 0 · rgb 0 · tw 9)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 8 | `"pendiente": "bg-gray-100 text-gray-600",` |
| 1 | 9 | `"en proceso": "bg-blue-100 text-blue-700",` |
| 1 | 10 | `"completado": "bg-green-100 text-green-700",` |
| 1 | 13 | `<div className="bg-white rounded-2xl shadow-sm p-5">` |
| 1 | 19 | `<p className="text-gray-800 font-medium leading-snug">{p.tarea}</p>` |

### `src/components/MobileAnalisisClientes.jsx` — 8 (hex 8 · rgb 0 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 2 | 205, 215 | `const color = positive === true ? (theme.green \|\| '#34C759') : positive === false ? (theme.pink \|\| theme.red \|\| '#FF3B30') : theme.textMuted` |
| 1 | 13 | `const CLIENTE_DOT = { digitalife: '#5856D6', dicotech: '#FF9500', pcel: '#34C759' };` |
| 1 | 165 | `<div style={{ width: 30, height: 30, borderRadius: 8, background: r.color, color: '#fff', display: 'grid', placeItems: 'center', fontFamily:` |

### `src/components/MobileSellInGlobal.jsx` — 8 (hex 8 · rgb 0 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 12 | `const CLIENTE_DOT = { digitalife: '#5856D6', dicotech: '#FF9500', pcel: '#34C759' };` |
| 1 | 13 | `const MARCA_COLOR = { ACTECK: '#007AFF', 'BALAM RUSH': '#FF2D55', OTRAS: '#8E8E93' };` |
| 1 | 201 | `const color = positive === true ? (theme.green \|\| '#34C759') : positive === false ? (theme.pink \|\| theme.red \|\| '#FF3B30') : theme.textMuted` |

### `src/components/TarjetaPromociones.jsx` — 8 (hex 0 · rgb 0 · tw 8)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 8 | `<div className="bg-white rounded-2xl shadow-sm p-5">` |
| 1 | 17 | `<p className="font-semibold text-gray-800">{p.nombre}</p>` |
| 1 | 18 | `<span className="text-xs text-gray-400">{p.vigencia}</span>` |
| 1 | 21 | `<span className="text-blue-700">Nuestra aportación: <b>{formatMXN(p.aportacionActeck)}</b></span>` |
| 1 | 22 | `<span className="text-purple-700">Cliente aporta: <b>{formatMXN(p.aportacionCliente)}</b></span>` |

### `src/lib/constants.js` — 8 (hex 8 · rgb 0 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 2 | 90, 147 | `color: "#E31E26",` |
| 1 | 100 | `color: "#3b82f6",` |
| 1 | 110 | `color: "#8b5cf6",` |
| 1 | 120 | `color: "#f59e0b",` |
| 1 | 170 | `{ id: 2, tarea: "Confirmar entrega de pedido #4821", responsable: "Logística", fecha: "2026-04-08", estado: "en proceso" },` |

### `src/modules/general/EstadoResultados.jsx` — 8 (hex 1 · rgb 7 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 654 | `background: theme.eyebrowSoft \|\| (theme.mode === 'dark' ? 'rgba(255,149,0,0.14)' : 'rgba(196,82,13,0.08)'),` |
| 1 | 1065 | `style={{ background: hover ? (theme.mode === 'dark' ? 'rgba(10,132,255,0.06)' : 'rgba(0,113,227,0.03)') : 'transparent' }}` |
| 1 | 463 | `body { background: #fff !important; }` |
| 1 | 1168 | `position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',` |
| 1 | 1177 | `? '-12px 0 40px rgba(0,0,0,0.6)'` |

### `src/components/BarraCuota.jsx` — 7 (hex 3 · rgb 0 · tw 4)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 10 | `style={{ width: ˋ${pctObj}%ˋ, backgroundColor: pctObj >= 100 ? "#22c55e" : pctObj >= 80 ? "#eab308" : "#ef4444" }} />` |
| 1 | 8 | `<div className="relative h-2 bg-gray-100 rounded-full overflow-visible">` |
| 1 | 12 | `<div className="absolute top-0 h-full w-0.5 bg-orange-400" style={{ left: ˋ${pctMin}%ˋ }} title="Mínimo 25M" />` |
| 1 | 14 | `<div className="flex justify-between text-xs text-gray-400 mt-0.5">` |
| 1 | 16 | `<span className="text-orange-500">Mín {Math.round(pctMin)}%</span>` |

### `src/components/MobileBuscar.jsx` — 7 (hex 5 · rgb 2 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 12 | `const CLIENTE_DOT = { digitalife: '#5856D6', dicotech: '#FF9500', pcel: '#34C759' };` |
| 1 | 79 | `<div style={{ margin: '10px 18px 12px', padding: '10px 12px', background: theme.mode === 'dark' ? 'rgba(120,120,128,.24)' : 'rgba(120,120,12` |
| 1 | 146 | `icon={<FileText size={16} />} iconBg={theme.purple \|\| '#AF52DE'}` |
| 1 | 162 | `icon={<ClipboardList size={16} />} iconBg={theme.orange \|\| '#FF9500'}` |

### `src/lib/exportar.js` — 7 (hex 5 · rgb 2 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 255 | `#__pdf_head { display: flex; align-items: center; gap: 10px; padding: 0 0 10px; margin-bottom: 14px; border-bottom: 1px solid rgba(0,0,0,0.1` |
| 1 | 256 | `#__pdf_head .logo { width: 22px; height: 22px; border-radius: 6px; background: #000; color: #fff; display: inline-flex; align-items: center;` |
| 1 | 253 | `html, body { background: #FFFFFF !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }` |
| 1 | 258 | `#__pdf_head .sep { color: rgba(0,0,0,0.35); }` |
| 1 | 259 | `#__pdf_head .fecha { margin-left: auto; color: #6E6E73; font-variant-numeric: tabular-nums; }` |

### `src/lib/toast.jsx` — 7 (hex 5 · rgb 2 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 42 | `success: 'var(--t-green, #34C759)',` |
| 1 | 43 | `error: 'var(--t-red, #FF3B30)',` |
| 1 | 44 | `info: 'var(--t-accent, #007AFF)',` |
| 1 | 90 | `background: 'var(--t-surface, rgba(255,255,255,0.95))',` |
| 1 | 93 | `'0 10px 40px rgba(0,0,0,0.15), 0 2px 6px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.08)',` |

### `src/components/ExportMenu.jsx` — 6 (hex 4 · rgb 2 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 168 | `background: isDark ? (theme.surface \|\| '#1C1C1E') : (theme.surface \|\| '#FFFFFF'),` |
| 1 | 197 | `background: theme.red \|\| '#FF3B30', color: '#FFFFFF',` |
| 1 | 171 | `boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.45)' : '0 8px 24px rgba(0,0,0,0.10)',` |
| 1 | 199 | `boxShadow: '0 4px 14px rgba(0,0,0,0.18)', whiteSpace: 'normal',` |

### `src/components/MobileSellOutGlobal.jsx` — 6 (hex 6 · rgb 0 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 12 | `const CLIENTE_DOT = { digitalife: '#5856D6', dicotech: '#FF9500', pcel: '#34C759' };` |
| 1 | 134 | `function Kpi({ theme, label, value, delta, positive }) { const color = positive === true ? (theme.green \|\| '#34C759') : positive === false ?` |
| 1 | 108 | `<ChartMensual theme={theme} serie={serieTotal} color={theme.orange \|\| '#FF9500'} mesActual={mesActual} anio={anio} title="Evolución mensual"` |

### `src/components/KPICard.jsx` — 5 (hex 0 · rgb 0 · tw 5)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 8 | `{sub && <p className={ˋtext-xs mt-1 ${alerta ? "text-red-500 font-semibold" : "text-gray-400"}ˋ}>{sub}</p>}` |
| 1 | 5 | `<div className={ˋbg-white rounded-2xl shadow-sm p-5 border-t-4ˋ} style={{ borderColor: color }}>` |
| 1 | 6 | `<p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>` |
| 1 | 7 | `<p className="text-2xl font-bold text-gray-800">{valor}</p>` |

### `src/components/MobileEstrategiaPrecios.jsx` — 5 (hex 5 · rgb 0 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 11 | `const CLIENTE_DOT = { digitalife: '#5856D6', dicotech: '#FF9500', pcel: '#34C759' };` |
| 1 | 121 | `function Kpi({ theme, label, value, delta, positive }) { const color = positive === true ? (theme.green \|\| '#34C759') : positive === false ?` |

### `src/main.jsx` — 5 (hex 5 · rgb 0 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 20 | `<div style={{ padding: 40, fontFamily: '-apple-system, sans-serif', background: '#FFF5F5', minHeight: '100vh' }}>` |
| 1 | 21 | `<h1 style={{ color: '#B00020', fontSize: 24, marginBottom: 12 }}>Se rompió algo en el dashboard</h1>` |
| 1 | 22 | `<p style={{ color: '#6E6E73', marginBottom: 16 }}>Manda esta info a Fernando para que lo arregle:</p>` |
| 1 | 23 | `<pre style={{ background: 'white', padding: 16, borderRadius: 12, fontSize: 13, overflow: 'auto', color: '#1D1D1F', border: '1px solid rgba(` |
| 1 | 31 | `<button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: '10px 20px', background: '#0071E3', color: 'white', border` |

### `src/modules/comercial/CreditoCobranzaV2.jsx` — 5 (hex 5 · rgb 0 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 45 | `accent: theme.accent \|\| '#007AFF',` |
| 1 | 46 | `green: theme.green \|\| '#34C759',` |
| 1 | 47 | `orange: theme.orange \|\| '#FF9500',` |
| 1 | 48 | `red: theme.red \|\| '#FF3B30',` |
| 1 | 49 | `yellow: theme.yellow \|\| '#FFCC00',` |

### `src/modules/comercial/marketing/Calendario.jsx` — 5 (hex 5 · rgb 0 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 2 | 11, 57 | `const inv = theme.surfaceInverse \|\| '#000', onInv = theme.textOnInverse \|\| '#F5F5F7';` |
| 1 | 42 | `<span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: esHoy(c.day) \|\| sel ? 700 : 500, fontVariantNumeric: 'tabular-nums'` |

### `src/modules/comercial/marketing/config.js` — 5 (hex 5 · rgb 0 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 54 | `tiktok: { label: 'TikTok', color: '#000000' },` |
| 1 | 55 | `facebook: { label: 'Facebook', color: '#1877F2' },` |
| 1 | 56 | `instagram: { label: 'Instagram', color: '#E4405F' },` |
| 1 | 57 | `youtube: { label: 'YouTube', color: '#FF0000' },` |
| 1 | 64 | `const TIPO_DESCONOCIDO = { label: '?', color: '#8E8E93', tone: 'gray', Icon: Megaphone, metricas: [] };` |

### `src/modules/comercial/pagos/pagosUI.jsx` — 5 (hex 2 · rgb 3 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 124 | `<div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'cente` |
| 1 | 125 | `<div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: width, maxHeight: '88vh', display: 'flex', flexDirection: 'colum` |
| 1 | 160 | `<div style={{ position: 'absolute', right: 0, top: 26, zIndex: 20, minWidth: 190, background: theme.surface, border: ˋ1px solid ${theme.bord` |
| 1 | 178 | `const green = theme.green \|\| '#34C759';` |
| 1 | 181 | `style={{ width: 22, height: 22, borderRadius: 999, border: ˋ1.5px solid ${pagado ? green : theme.borderStrong \|\| theme.border}ˋ, background:` |

### `src/modules/comercial/RentabilidadBloque.jsx` — 5 (hex 5 · rgb 0 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 85 | `const green = theme.green \|\| '#34C759', red = theme.red \|\| '#FF3B30', orange = theme.orange \|\| '#FF9500';` |
| 1 | 86 | `const blue = theme.accent \|\| '#007AFF';` |
| 1 | 100 | `{ k: 'Costo de venta', v: -ytd.costo_venta_neta, col: theme.textSubtle \|\| '#86868B' },` |

### `src/components/SinAcceso.jsx` — 4 (hex 0 · rgb 0 · tw 4)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 6 | `<div className="bg-white rounded-2xl shadow-sm p-8 max-w-md text-center">` |
| 1 | 8 | `<h2 className="text-xl font-bold text-gray-800 mb-2">Sin acceso a esta sección</h2>` |
| 1 | 9 | `<p className="text-sm text-gray-500 mb-1">` |
| 1 | 12 | `<p className="text-xs text-gray-400 mt-4">` |

### `src/modules/comercial/marketing/ActividadForm.jsx` — 4 (hex 0 · rgb 4 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 38 | `<div onClick={onClose} style={{ position: 'fixed', inset: 0, background: dark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.35)', backdropFilter: 'blu` |
| 1 | 44 | `boxShadow: dark ? '0 24px 60px rgba(0,0,0,0.6)' : '0 24px 60px rgba(0,0,0,0.18)', animation: ˋmktFormIn ${DUR.content}ms ${EASE} bothˋ,` |

### `src/components/apple/AppleLoader.jsx` — 3 (hex 3 · rgb 0 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 63 | `minHeight: '100vh', background: '#F5F5F7',` |
| 1 | 79 | `background: '#6E6E73',` |
| 1 | 87 | `<div style={{ fontSize: 13, color: '#86868B', fontWeight: 500 }}>{label}</div>` |

### `src/components/apple/index.jsx` — 2 (hex 0 · rgb 2 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 138 | `boxShadow: theme.mode === 'light' ? '0 4px 20px rgba(0,0,0,0.15)' : 'none',` |
| 1 | 248 | `background: on ? (theme.mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'white') : 'transparent',` |

### `src/components/CardHeader.jsx` — 2 (hex 0 · rgb 0 · tw 2)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 18 | `? <Icon className="w-4 h-4 text-gray-600" />` |
| 1 | 24 | `<h3 className="font-bold text-gray-700 text-base">{titulo}</h3>` |

### `src/components/MobileNav.jsx` — 2 (hex 0 · rgb 2 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 181 | `background: 'rgba(0,0,0,0.45)',` |
| 1 | 193 | `boxShadow: '4px 0 24px rgba(0,0,0,0.2)',` |

### `src/modules/comercial/PagosCliente.jsx` — 2 (hex 0 · rgb 2 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 1850 | `{c.cartera?.ultimaActualizacion && <Pill tone="inverse" size="xs" style={{ background: 'transparent', color: theme.mode === 'dark' ? 'rgba(2` |

### `src/modules/comercial/marketing/ActividadFila.jsx` — 1 (hex 1 · rgb 0 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 19 | `color: disabled ? (theme.textSubtle \|\| theme.textMuted) : peligro ? (theme.red \|\| '#FF3B30') : theme.text,` |

### `src/modules/comercial/pagos/FondosPanels.jsx` — 1 (hex 1 · rgb 0 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 106 | `onClose={onClose} footer={<><Boton onClick={onClose}>Cancelar</Boton><Boton primario peligro={!esAporte} onClick={onSave} style={!esAporte ?` |

### `src/modules/comercial/pagos/SpiffPanels.jsx` — 1 (hex 1 · rgb 0 · tw 0)

| Veces | Líneas | Código |
|---:|---|---|
| 1 | 171 | `return <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 999, back` |

