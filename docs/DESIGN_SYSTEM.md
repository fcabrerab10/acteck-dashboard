# Sistema de diseño — Acteck Dashboard

**Objetivo:** que este dashboard parezca desarrollado por Apple. Cada pantalla se juzga contra apple.com, no contra otros dashboards.

Este documento es la única fuente de verdad para colores, tipografía, iconografía, spacing, gráficas y componentes. Si algo entra al código y no está en línea con lo que dice aquí, se corrige el código — no el documento.

---

## 1 · Principios base (aplican a los 3 temas)

1. **Un solo momento hero por pantalla.** Un número gigante, un título gigante, o una gráfica dominante — nunca los tres.
2. **Whitespace masivo.** Antes de agregar un elemento, quita padding. Apple respira; los dashboards baratos no.
3. **Color muy restringido.** Neutros (blanco/negro/gris) llevan el 90% de la superficie. El acento aparece una vez, no cinco.
4. **Cero gradientes en UI.** No en botones, no en cards, no en números, no en anillos. Los gradientes se sienten "AI-generated". Apple sólo usa gradiente en fondos ambientales o mesh de páginas hero, nunca en chrome de UI.
5. **Números como protagonistas.** `font-variant-numeric: tabular-nums` en toda cifra sin excepción. Display font, letter-spacing negativo, weight 600.
6. **Charts sin chrome.** Sin grid, sin ejes decorados, sin borders. La línea o barra habla; todo lo demás sobra.
7. **Iconos monoline.** Lucide con `strokeWidth: 1.5–2`, tamaño 14–20px. Nunca íconos rellenos ni de colores.
8. **Notificaciones como pill discreto.** Nunca banners amarillos gigantes que roban atención. Un pill de 10–12px con dot + mensaje corto.

---

## 2 · Los 3 temas del dashboard

El usuario elige su tema en Configuración. La estructura de tokens es idéntica en los 3; sólo cambian los valores.

### 2.1 · Airy _(default)_

**Uso:** el día a día de Fernando. Trabajo tranquilo, muchas cifras, aire.

| Token | Valor | Uso |
|-------|-------|-----|
| `bg` | `#F5F5F7` | Fondo página |
| `surface` | `#FFFFFF` | Cards, tablas |
| `text` | `#1D1D1F` | Títulos, cifras, íconos primarios |
| `textMuted` | `#6E6E73` | Body secundario, labels |
| `textSubtle` | `#86868B` | Captions, hairlines |
| `border` | `rgba(0,0,0,0.06)` | Divisores muy sutiles |
| `divider` | `rgba(0,0,0,0.05)` | Row hairlines en tablas |
| `accent` | `#0071E3` | Links, primary buttons, selected state |
| `green` | `#1F7A3D` | Delta positivo, dot sección Ingresos |
| `red` | `#B00020` | Delta negativo, cifras negativas |
| `orange` | `#C4520D` | Eyebrow "NUEVO/POR TIEMPO LIMITADO" tipo apple.com. Nunca en área grande |
| `purple` | `#6E44A6` | Dot sección Indicadores. Uso puntual |
| `pink` | `#B62755` | Dot sección Financieros. Uso puntual |

**Sombra:** `0 1px 3px rgba(0,0,0,0.04)` — casi imperceptible. Nunca box-shadow marcado.

### 2.2 · Puro

**Uso:** ver el dashboard proyectado, presentaciones, revisar en noche.

| Token | Valor | Uso |
|-------|-------|-----|
| `bg` | `#000000` | Fondo (pure black tipo iPhone Pro) |
| `surface` | `#1D1D1F` | Cards, tablas |
| `text` | `#F5F5F7` | Títulos, cifras |
| `textMuted` | `rgba(245,245,247,0.6)` | Body secundario |
| `textSubtle` | `rgba(245,245,247,0.4)` | Captions |
| `border` | `rgba(255,255,255,0.08)` | Bordes de cards (requeridos para separar del bg) |
| `accent` | `#0A84FF` | Links, primary — la versión dark del blue |
| `green` | `#30D158` | Delta positivo iOS dark |
| `red` | `#FF453A` | Delta negativo iOS dark |
| `orange` | `#FF9500` | iOS system orange dark — sólo cuando se necesita warmth |

**Sombra:** `none`. En dark no hay sombra, sólo `border`.

### 2.3 · Vibrant

**Uso:** cuando el usuario quiere sentirse en Apple Music / Fitness. Mesh gradient tenue de fondo, glass cards con blur encima.

Ojo: los mesh gradients aparecen **sólo en el fondo del body**. Todo lo que va encima (cards, texto, íconos) es plano y usa los mismos valores que Airy. Nunca poner gradient en un número o en un botón — eso rompe el sistema.

| Token | Valor | Uso |
|-------|-------|-----|
| `bg` | `radial-gradient(...) #F5F5F7` (mesh tri-color muy tenue) | Fondo del body |
| `surface` | `rgba(255,255,255,0.72)` + `backdrop-filter: blur(20px) saturate(180%)` | Cards con glass |
| `text` / `textMuted` / `divider` / semánticos | Idénticos a Airy | — |

---

## 3 · Tipografía

Fuente única en los 3 temas: **SF Pro** (con fallback a Inter → system sans).

```
fontText:    -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI Variable", sans-serif
fontDisplay: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter Display", "Segoe UI Variable Display", sans-serif
```

Regla: **display** para cifras y títulos (todo lo que sea > 20px); **text** para body, labels, captions.

### Escala (definida en `themeTokens.js` → `TYPO`)

| Token | Size | Weight | Letter-spacing | Uso |
|-------|------|--------|----------------|-----|
| `hero` | 56px | 600 | -0.045em | Hero de landing (Login, Home) |
| `h1` | 44px | 600 | -0.035em | Título de pestaña |
| `h2` | 28px | 700 | -0.025em | Título de sección |
| `h3` | 17px | 600 | -0.015em | Título de card |
| `body` | 15px | 400 | 0 | Párrafos, lead |
| `sub` | 15px | 400 | 0 | Subtítulos |
| `eyebrow` | 13px | 500 | 0 | Label sobre título |
| `label` | 12px | 500 | 0 | Labels de KPI cards |
| `caption` | 12px | 400 | 0 | Metadata, notas al pie |
| `kpiLg` | 52px | 600 | -0.04em | Cifra hero |
| `kpiMd` | 34px | 600 | -0.03em | Cifra card |
| `total` | 20px | 600 | -0.02em | Subtotal de tabla |

Reglas de aplicación:
- **Nunca** hardcodear `font-size` fuera de esta escala. Si necesitas un tamaño intermedio, pídelo a la escala primero.
- **Toda cifra** lleva `fontVariantNumeric: 'tabular-nums'`. Sin excepción.
- **Los eyebrows** usan `text-transform: uppercase` sólo cuando `letter-spacing >= 0.06em`. Un eyebrow uppercase con `letter-spacing: 0` grita.
- **Títulos** con `text-wrap: balance` (o control manual del quiebre) para que no cuelgue una palabra sola.

---

## 4 · Iconografía

Librería única: **Lucide React**. Prohibido mezclar con otras.

| Regla | Valor |
|-------|-------|
| Grosor de trazo | `strokeWidth: 2` (íconos en botones), `1.5` (íconos decorativos en cards) |
| Tamaño estándar | 14, 16, 18, 20 px. Fuera de esa escala, justifícalo |
| Color | `theme.text` para primarios, `theme.textMuted` para secundarios |
| Nunca | íconos filled, íconos multicolor, íconos emoji |

**Íconos por sección (para consistencia con Apple):**
- Estado de resultados → `Calculator`
- Sell in / Sell out → `TrendingUp`
- Inventario → `Package`
- Marketing → `Megaphone`
- Pagos → `Wallet`
- Análisis → `LineChart`
- Configuración → `Settings2`
- Alertas → `AlertCircle` (nunca `AlertTriangle` que se ve pesado)

---

## 5 · Spacing

Sistema en múltiplos de 4. Prefiere 8, 12, 16, 20, 24, 32, 40, 60, 80.

| Uso | Valor |
|-----|-------|
| Padding lateral de página | 24–32px (mobile), 40–60px (desktop) |
| Padding vertical de página | 32px top, 60–80px bottom |
| Gap entre cards en bento | 12px |
| Padding interno de card | 20–28px (24 default) |
| Padding celda de tabla | `10px 12px` |
| Margin entre secciones | 32px (relacionadas), 60–80px (independientes) |

Regla: **Layout con `gap`, nunca con `margin`** entre siblings — el gap no colapsa y es predecible.

---

## 6 · Gráficas

Todas las gráficas del dashboard deben respetar estas reglas:

- **Sin grid lines.** Si necesitas una referencia, dibuja UNA línea baseline en `theme.divider`.
- **Sin ejes decorados.** Los labels de meses van directamente pegados al chart sin ticks ni axis line.
- **Colores muy restringidos.** Serie principal en `theme.text`. Serie de comparativo en `theme.textSubtle` con `strokeDasharray="4 3"`.
- **Cero gradientes.** Área bajo curva = `fill={theme.text} fillOpacity="0.05"`. Nunca `linearGradient`.
- **Un solo acento.** Si necesitas resaltar un dato final (ej. UAII), pinta ese único punto/barra en `theme.orange`. El resto en `theme.text`.
- **Interactivo por default.** Hover muestra tooltip con valor + delta vs comparativo. Click abre drill-down si aplica.
- **Tabular-nums en todos los labels numéricos** dentro del SVG.

### Sparklines
- Height 18–24px, width flexible.
- Stroke 2px, linecap round.
- Color: `theme.text` (positivo o neutro), `theme.red` (negativo).
- Hover: círculo destacado + `<title>` con "Mes: valor".

---

## 7 · Componentes de UI (Apple primitives)

Todos exportados de `src/components/apple/index.jsx`. Nunca crear un H1/Card/Button suelto en un módulo — usa la primitiva.

| Componente | Uso |
|------------|-----|
| `AppleHero` | Hero de página (56px) |
| `AppleH1` / `AppleH2` / `AppleH3` | Jerarquía de títulos |
| `AppleEyebrow` | Label sobre título |
| `AppleSubtitle` | Body grande bajo título |
| `AppleCard` | Card estándar (respeta el tema — glass en vibrant, dark border en puro) |
| `AppleCardDark` | Card negra premium (KPI hero en airy) |
| `AppleKpi` / `AppleKpiValue` | Cifra grande estilo Apple |
| `AppleDelta` | Chip de delta ±X% |
| `AppleButton` | Pill (primary blue / secondary gris / ghost) |
| `AppleSegment` | Segmented control (año, tabs) |
| `AppleLoader` | Spinner iOS 12-strokes |
| `PageTransition` | Wrapper para fade-slide entre pestañas |

---

## 8 · Reglas por pestaña

Cada pestaña se rige por el sistema anterior. Estas son las variaciones específicas:

### Estado de Resultados _(Fitness + Report híbrido)_
- **Layout:** bento arriba (hero ring + 4 KPI + trend wide) + tabla formal abajo.
- **Cifras:** UAII y subtotales en display 20–64px. Delta chips en `text.body`.
- **Charts:** trend con hover interactivo (valor + delta vs prev year). Sparklines por fila.
- **Acento:** ninguno de forma decorativa. Verde/rojo sólo en deltas.

### Home Cliente _(pending redesign)_
- Hero: nombre cliente + KPI de venta mes + delta.
- Bento con Sell In / Sell Out / Inventario / Pagos como 4 cards iguales.
- **Nunca** mezclar colores de brand del cliente (Digitalife naranja, Balam magenta) con la UI. Los brand colors sólo pueden aparecer como accent muy chico (bandera 2px arriba del card).

### Sell Out / Sell In _(pending redesign)_
- Tabla dominante estilo Numbers. Filas alternadas con `rgba(0,0,0,0.015)` sutil.
- Filtros arriba en `AppleSegment`.
- SKU drill-down abre modal side panel (no full page).

### Estrategia de Precios _(pending redesign)_
- Tabla con filas de mismo tamaño (regla explícita del usuario, ya establecida).
- SKU sin thumbnails de imagen dentro de row — cover art distrae.
- Precio actualizado en display font 20px, tabular-nums.

### Análisis Cliente / Inventario / Marketing / Pagos / Forecast
- Sin lineamientos específicos aún — heredan las reglas base.

### Configuración
- Selector de tema muestra los 3 preview cards con render real del tema.
- Cada setting card es glass-plana, sin acentos.

### Login
- Mesh gradient reactivo al mouse. Es la ÚNICA página del sistema con mesh en el chrome (no sólo en el fondo).
- Card glass central con inputs float-label.

---

## 9 · Anti-patterns _(qué NO hacer)_

- ❌ Gradiente en un número (`background-clip: text` con linear-gradient) — se ve AI-generado.
- ❌ Gradiente en un ring, barra, o botón.
- ❌ Naranja/rojo/verde saturado tipo iOS (#FF9500, #FF3B30) en Airy — usar los terracottas/crimson (#C4520D, #B00020).
- ❌ `box-shadow` marcado (más allá de `0 1px 3px rgba(0,0,0,0.04)`).
- ❌ Cards de colores pastel (#E6F1FB, #FAECE7, etc.) — esos son de Notion, no de Apple.
- ❌ `border-radius > 24px` — Apple llega máximo a 22px en cards grandes, 12–16 en cards pequeños.
- ❌ Íconos coloreados o filled.
- ❌ Banners de alerta amarillos de ancho completo.
- ❌ `font-family` diferente a SF Pro dentro del sistema.
- ❌ Cifras sin `tabular-nums`.
- ❌ Tres o más colores acento en una misma pantalla.

---

## 10 · Checklist antes de mergear una pestaña

- [ ] Todos los colores vienen de `theme.*` — cero hex hardcoded
- [ ] Toda la tipografía viene de `TYPO` — cero `fontSize` hardcoded fuera de la escala
- [ ] Todas las cifras llevan `tabular-nums`
- [ ] Cero `linear-gradient` en cualquier elemento de UI (permitido sólo en background del tema Vibrant)
- [ ] Íconos con `strokeWidth 1.5–2`
- [ ] Charts sin grid, sin ejes decorados, un solo acento
- [ ] Charts interactivos con hover tooltip
- [ ] Se ve consistente en los 3 temas (probar switch en Configuración)
- [ ] Un solo "momento hero" por pantalla
- [ ] Anti-patterns de la sección 9 = cero
