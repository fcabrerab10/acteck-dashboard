# Sistema de diseño — Acteck Dashboard

**Objetivo:** que este dashboard parezca desarrollado por Apple. Cada pantalla se juzga contra apple.com o iPhone/iPadOS, no contra otros dashboards.

Este documento es la única fuente de verdad para colores, tipografía, iconografía, spacing, componentes y layouts por pestaña. Si algo entra al código y no está en línea con lo que dice aquí, se corrige el código — no el documento.

---

# PARTE 1 · SISTEMA

## 1 · Filosofía

Reglas que aplican a los 3 temas por igual:

1. **Un solo momento hero por pantalla.** Un número gigante, un título gigante, o una gráfica dominante — nunca los tres compitiendo.
2. **Whitespace masivo.** Antes de agregar un elemento, quita padding. Apple respira; los dashboards baratos no.
3. **Paleta ultra restringida.** El neutro (blanco/negro/gris) lleva 90% de la superficie. Un solo color acento por pantalla, usado con intención.
4. **Cero gradientes en UI.** No en botones, cards, números ni anillos. Los gradientes se sienten AI-generated. Apple usa gradientes sólo en fondos ambientales de landing hero, nunca en chrome de UI.
5. **Números como protagonistas.** `font-variant-numeric: tabular-nums` en toda cifra sin excepción. Display font, letter-spacing negativo, weight 600.
6. **Charts sin chrome.** Sin grid, sin ejes decorados, sin borders. La línea o barra habla; todo lo demás sobra.
7. **Iconos monoline.** Lucide con `strokeWidth 1.5–2`, tamaño 14–20px. Nunca íconos filled ni multicolor.
8. **Notificaciones como pill discreto.** Nunca banners amarillos gigantes que roban atención. Un pill de 10–12px con dot + mensaje corto.

---

## 2 · Los 3 temas

Los 3 temas comparten estructura de tokens (`bg`, `surface`, `text`, `accent`…) pero cambian los valores. Cada uno tiene una **personalidad y un uso** claros.

### 2.1 · ☀ Claro _(default · trabajo diario)_

**Inspiración:** apple.com puro — blanco clínico, cards alternadas negras/blancas, azul Apple para CTAs.

**Uso:** el día a día. Trabajo largo frente a la pantalla, revisar cifras, exportar reportes. Es el default.

| Token | Valor | Uso |
|-------|-------|-----|
| `bg` | `#FFFFFF` | Fondo de página en secciones "blancas" |
| `bgAlt` | `#F5F5F7` | Fondo alternativo (entre secciones, cards muted) |
| `surface` | `#FFFFFF` | Cards blancas |
| `surfaceDark` | `#000000` | Cards negras alternadas |
| `text` | `#1D1D1F` | Títulos, cifras, texto primario |
| `textOnDark` | `#F5F5F7` | Texto sobre superficies negras |
| `textMuted` | `#6E6E73` | Body secundario, labels |
| `textSubtle` | `#86868B` | Captions, hairlines |
| `textMutedOnDark` | `rgba(245,245,247,0.7)` | Muted sobre negro |
| `border` | `rgba(0,0,0,0.06)` | Divisores muy sutiles |
| `divider` | `rgba(0,0,0,0.1)` | Divisores de tabla hairline |
| `accent` | `#0066CC` | Azul Apple para links y CTAs sobre blanco |
| `accentDark` | `#2997FF` | Azul iOS para links sobre superficies negras |
| `green` | `#1F7A3D` | Delta positivo (nunca decoración) |
| `red` | `#B00020` | Delta negativo, cifras negativas |
| `nav` | `rgba(29,29,31,0.72)` + `backdrop-filter: blur(20px) saturate(180%)` | Nav superior estilo apple.com |
| `subnav` | `rgba(251,251,253,0.85)` + `backdrop-filter: blur(20px)` | Sub-nav sticky |
| `shadow` | `none` | El Claro NO usa sombras. Separa con color de superficie. |

**Regla estructural del Claro:** las secciones alternan blanco↔negro a lo largo de la página. La página se lee como una landing de producto.

### 2.2 · 🌙 Midnight _(presentaciones · noche · foco)_

**Inspiración:** iPhone Pro OLED + Apple TV — negro puro, glow radial tenue en esquinas, un único acento cyan neon.

**Uso:** presentar en pantalla grande, revisar en noche, foco. Cinematográfico.

| Token | Valor | Uso |
|-------|-------|-----|
| `bg` | `#000000` | Fondo puro OLED |
| `surface` | `#0F0F0F` | Cards, contenedores |
| `surfaceElevated` | `#1D1D1F` | Cards elevados (modal, popover) |
| `text` | `#EDEDF0` | Texto primario |
| `textStrong` | `#FFFFFF` | Cifras hero grandes |
| `textMuted` | `rgba(237,237,240,0.6)` | Body secundario |
| `textSubtle` | `rgba(237,237,240,0.4)` | Captions |
| `border` | `rgba(255,255,255,0.06)` | Bordes de cards (obligatorios en dark) |
| `borderStrong` | `rgba(255,255,255,0.15)` | Bordes de subtotales, hairlines de tabla |
| `divider` | `rgba(255,255,255,0.06)` | Row hairlines |
| `accent` | `#64D2FF` | Cyan neon — único acento del tema |
| `accentGlow` | `rgba(100,210,255,0.15)` | Text-shadow y ring-shadow del acento |
| `accentBg` | `rgba(50,200,255,0.10)` | Fondo de pill/badge de acento |
| `green` | `#30D158` | Delta positivo (iOS dark) |
| `red` | `#FF453A` | Delta negativo (iOS dark) |
| `sidebar` | `#0A0A0C` | Sidebar aún más negra que el bg |
| `glowCyan` | `radial-gradient(circle, rgba(50,200,255,0.06) 0%, transparent 60%)` | Halo esquina superior izquierda |
| `glowPurple` | `radial-gradient(circle, rgba(191,90,242,0.05) 0%, transparent 60%)` | Halo esquina inferior derecha |

**Regla estructural del Midnight:** cifras hero enormes (hasta 200px) con `text-shadow: 0 0 40px accentGlow`. Sombra imposible en dark → todo se separa con hairlines de `rgba(255,255,255,0.06)`.

### 2.3 · 🎨 Marfil _(diferente · reportes formales)_

**Inspiración:** apple.com/newsroom + Apple Investor Relations — cream cálido, azul cobalto profundo, terracotta oscuro para acentos editoriales.

**Uso:** ver reportes formales, presentar al board, compartir con el CFO. Se siente como un documento impreso Apple.

| Token | Valor | Uso |
|-------|-------|-----|
| `bg` | `#F7F3EC` | Marfil warm, nunca gris frío |
| `surface` | `#EEE7DA` | Card marfil más oscuro |
| `surfaceInverse` | `#0055B5` | Superficie de contraste — featurettes azules |
| `text` | `#1A1A1A` | Texto primario (casi negro pero no puro) |
| `textOnInverse` | `#F7F3EC` | Texto sobre superficie azul |
| `textMuted` | `#575757` | Body secundario |
| `textMutedOnInverse` | `#7BB3EC` | Muted sobre azul |
| `textSubtle` | `#8A7F6C` | Captions warm |
| `border` | `rgba(26,26,26,0.08)` | Divisores muy sutiles |
| `borderStrong` | `#1A1A1A` | Bordes de subtotales, headers de tabla |
| `divider` | `rgba(26,26,26,0.08)` | Row hairlines |
| `accent` | `#0055B5` | Azul cobalto profundo (no el iOS blue) |
| `accentSoft` | `rgba(0,85,181,0.10)` | Fondo de pills accent |
| `eyebrow` | `#A34209` | Terracotta oscuro — sólo para eyebrow labels y UAII final |
| `eyebrowSoft` | `rgba(196,82,13,0.10)` | Fondo de pill eyebrow |
| `green` | `#1F7A3D` | Delta positivo |
| `red` | `#B00020` | Delta negativo |
| `shadow` | `none` | El Marfil también evita sombras — separa con color de superficie |

**Regla estructural del Marfil:** una featurette azul de ancho completo (bleed edge-to-edge, márgenes negativos) que corta la lectura y funciona como capítulo. Se lee como un informe anual.

---

## 3 · Tipografía

Fuente única en los 3 temas: **SF Pro** — el mismo stack que usa `apple.com` en producción. Sin Inter, sin Segoe, sin Roboto — los fallbacks intermedios ensucian y no son necesarios: `-apple-system` cubre macOS/iOS, y `Helvetica Neue → Helvetica → Arial` cubre todo lo demás con una tipografía humanista suficientemente parecida.

```css
--font-text:    -apple-system, BlinkMacSystemFont, "SF Pro Text",
                "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif;
--font-display: -apple-system, BlinkMacSystemFont, "SF Pro Display",
                "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif;
```

Es el mismo stack CSS que sirve Apple en `apple.com/mx` (Store, Mac, iPhone). En Mac se ve SF Pro real; en Windows/Linux cae a Helvetica Neue / Arial que respeta la métrica.

**Opcional recomendado — self-hosting de SF Pro:** Apple distribuye SF Pro gratis para descarga desde <https://developer.apple.com/fonts/>. Si en el futuro queremos que Windows también vea SF Pro, se descarga el `.woff2` y se sirve desde `/public/fonts/` con `@font-face`. Sin licencia extra requerida — Apple lo permite explícitamente.

**Regla:** display para cifras y títulos ≥20px, text para body, labels, captions.

### Escala universal (definida en `themeTokens.js` → `TYPO`)

| Token | Size | Weight | Letter-spacing | Uso |
|-------|------|--------|----------------|-----|
| `heroMax` | 200–240px | 600 | -0.065em | Cifra hero dominante (Claro/Midnight) |
| `heroDisplay` | 96px | 600 | -0.05em | Título de pestaña estilo apple.com |
| `hero` | 72px | 600 | -0.045em | Título de sección negra alternada |
| `h1` | 48px | 600 | -0.035em | Título de sección secundario |
| `h2` | 32px | 600 | -0.025em | Título de subsección / detail |
| `h3` | 22px | 500 | -0.015em | Título de card / nav item |
| `tagline` | 28px | 400 | -0.02em | Lead bajo título hero |
| `body` | 15px | 400 | 0 | Párrafos, lead corto |
| `bodyLg` | 19px | 400 | 0 | Body en secciones hero |
| `eyebrow` | 12–13px | 500–600 | 0 | Label sobre título |
| `label` | 11–12px | 600 | 0.06–0.08em (uppercase) | Labels de KPI, secciones de tabla |
| `caption` | 12px | 400 | 0 | Metadata, notas al pie |
| `kpiXl` | 88px | 600 | -0.045em | Cifra hero de widget/card grande |
| `kpiLg` | 64px | 600 | -0.04em | Cifra hero de card negra |
| `kpiMd` | 44px | 600 | -0.035em | Cifra hero de widget/card mediano |
| `kpiSm` | 26px | 600 | -0.02em | Cifra de KPI mini |
| `total` | 16–17px | 600 | -0.015em | Subtotales de tabla |

### Reglas de aplicación

- **Nunca** hardcodear `font-size` fuera de esta escala. Si necesitas un tamaño intermedio, ajusta la escala primero.
- **Toda cifra** lleva `fontVariantNumeric: 'tabular-nums'`. Sin excepción.
- **Los eyebrows** usan `text-transform: uppercase` sólo cuando `letter-spacing >= 0.06em`. Un eyebrow uppercase con letter-spacing 0 grita.
- **Los taglines y body large** usan `text-wrap: balance` para que no cuelgue una palabra sola.
- **En Midnight**, los números hero llevan `text-shadow: 0 0 40px var(--accent-glow)` para el efecto OLED cinemático.

---

## 4 · Iconografía

Librería única: **Lucide React**. Prohibido mezclar con otras.

| Regla | Valor |
|-------|-------|
| Grosor de trazo | `strokeWidth: 2` (íconos en botones), `1.5` (íconos decorativos en cards) |
| Tamaño estándar | 14, 16, 18, 20 px. Fuera de esa escala, justifícalo |
| Color | `theme.text` para primarios, `theme.textMuted` para secundarios |
| Nunca | íconos filled, multicolor, emoji, ni SVG externos que no sean Lucide |

**Íconos por sección (mantiene consistencia visual entre pestañas):**

| Pestaña | Ícono | Notas |
|---------|-------|-------|
| Estado de resultados | `Calculator` | 20px, strokeWidth 1.5 |
| Sell in / Sell out | `TrendingUp` | 20px |
| Inventario | `Package` | 20px |
| Marketing | `Megaphone` | 20px |
| Pagos | `Wallet` | 20px |
| Crédito y cobranza | `Coins` | 20px |
| Forecast | `LineChart` | 20px |
| Análisis | `BarChart3` | 20px |
| Estrategia de precios | `Tags` | 20px |
| Propuestas | `FileText` | 20px |
| Configuración | `Settings2` | 20px |
| Alertas | `AlertCircle` | 16px, nunca `AlertTriangle` |

---

## 5 · Spacing y grid

Sistema en múltiplos de 4. Prefiere 8, 12, 16, 20, 24, 32, 40, 60, 80, 100.

| Uso | Valor |
|-----|-------|
| Padding lateral de página (Claro) | 40px estándar, 80px en secciones tech-specs |
| Padding lateral de página (Midnight/Marfil) | 40–48px |
| Padding vertical hero | 80–100px |
| Padding vertical sección estándar | 40–60px |
| Gap entre cards en bento | 12–16px |
| Padding interno de card estándar | 20–28px |
| Padding interno de card featurette | 40–60px |
| Padding celda de tabla | `10px 12px` (dense) o `20px 16px` (spec) |
| Margin entre secciones relacionadas | 32px |
| Margin entre secciones independientes | 60–80px |

**Regla:** layout con `gap`, nunca con `margin` entre siblings.

---

## 6 · Componentes base

### 6.1 · Botones

| Variante | Uso | Claro | Midnight | Marfil |
|----------|-----|-------|----------|--------|
| **Primary pill** | CTA principal | `#0066CC` bg, white text, `999px` radius | Igual pero glow tenue del accent | `#0055B5` bg, `#F7F3EC` text |
| **Ghost pill** | CTA secundario | Transparente + `1px solid border` | Igual | Igual |
| **Link con chevron** | Navegación textual | `#0066CC` sin subrayado, `›` con hover `margin-left: 6px` | `#2997FF` | Igual Claro |
| **Icon btn circular** | Search, compartir, config | `36px`, `999px`, `rgba(0,0,0,0.05)` bg | `rgba(255,255,255,0.06)` bg | `rgba(26,26,26,0.05)` |

### 6.2 · Segmented control

Pattern iOS estándar. Fondo `rgba(0,0,0,0.05)` (light) o `rgba(255,255,255,0.08)` (dark). Padding 3px, gap 1px, radius 10px. Botón activo: fondo `white` con `box-shadow: 0 1px 2px rgba(0,0,0,0.08)`.

### 6.3 · Cards

| Tema | Radius | Padding | Background | Border | Shadow |
|------|--------|---------|-----------|--------|--------|
| Claro (white card) | `22px` | `20–60px` | `#FFFFFF` | none | none |
| Claro (black card) | `22px` | `20–60px` | `#000` | none | none |
| Midnight | `16px` | `20–28px` | `#0F0F0F` | `1px solid rgba(255,255,255,0.06)` | none |
| Marfil (surface) | `24px` | `28–40px` | `#EEE7DA` | none | none |
| Marfil (featurette) | `0` (edge-to-edge) | `80px 60px` | `#0055B5` | none | none |

### 6.4 · Notice pill (alertas)

Nunca banner amarillo full-width. Pill 999px con `padding: 8px 14px`, fondo `accent bg 10% opacity`, texto en color accent, dot 6px del color a la izquierda.

### 6.5 · Tabla formal

Estructura común:
- `thead th`: 11–11.5px, uppercase, letter-spacing 0.08em, weight 700, `border-bottom: 1.5px solid text`
- `tbody td`: 13–15px, tabular-nums, padding `10–20px 8–16px`, `border-bottom: 1px solid divider`
- Group headers: fila con `background rgba(0,0,0,0.02)`, dot de color a la izquierda
- Subtotales: `border-top: 1.5–2px solid text`, weight 600, display font, padding vertical +4px
- Deltas: `pos` color verde, `neg` color rojo, ambos weight 500

### 6.6 · Sparkline (charts inline)

- Height 18–24px
- Stroke 2px, linecap round
- Color: `theme.text` (neutro), `theme.green` (positivo), `theme.red` (negativo)
- Hover: círculo destacado + `<title>` con "Mes: valor"
- Cero grid, cero labels internos

---

# PARTE 2 · PESTAÑAS

Aquí empieza la parte más importante: cómo se ve cada pestaña en cada tema.

Todos los temas comparten los mismos módulos React (`EstadoResultados.jsx`, etc.). Lo que cambia es qué componentes se rendean según el `theme.mode`. El componente lee `useTheme()` y aplica el patrón del tema activo.

---

## 7 · Menú (Sidebar)

**Estructura común:**
El dashboard tiene demasiadas pestañas (15+) para top-nav. Se mantiene sidebar left en los 3 temas, pero con estilos radicalmente distintos.

- **Ancho:** 264px expandido, 72px colapsado
- **Header:** logo/brand + selector cliente
- **Body:** navegación jerárquica de 3 niveles (Cliente → Sección → Pestaña)
- **Footer:** user card + toggle presentación

### 7.1 · Menú en ☀ Claro

**Feel:** apple.com sidebar (macOS Ventura Finder). Blanco puro, hairlines, íconos monoline, tipografía apretada.

```
background: #FFFFFF
border-right: 1px solid rgba(0,0,0,0.06)
padding: 20px 12px
```

- **Brand block** (top): `Acteck` en `SF Pro Display` 21px weight 600 + logo mark 24px cuadrado con fondo `#1D1D1F`
- **Selector cliente**: pill segmented `[Digitalife · PCEL · ML]`, radius 10px, activo con `background #F5F5F7`
- **Group header** (Ventas · Operaciones · Config): `label` 11px uppercase letter-spacing 0.08em, color `#86868B`, `padding: 20px 12px 8px`
- **Nav item inactive**: padding `10px 12px`, radius 8px, ícono Lucide 18px + texto 14px, color `#1D1D1F`, hover `background #F5F5F7`
- **Nav item active**: fondo `rgba(0,102,204,0.10)`, texto `#0066CC` weight 500, ícono también `#0066CC`
- **User card** (bottom): avatar 32px circular con inicial, nombre 13px, email 11px muted. Radius 12px sobre `#F5F5F7`
- **Toggle presentación**: switch iOS 32×20px

### 7.2 · Menú en 🌙 Midnight

**Feel:** iPhone Control Center / Apple TV sidebar. Negro más profundo que el bg, glow tenue en item activo.

```
background: #0A0A0C
border-right: 1px solid rgba(255,255,255,0.06)
padding: 20px 12px
```

- **Brand block**: `ACTECK` uppercase letter-spacing 0.12em 13px weight 700 en `#EDEDF0`, logo mark 24px con `background #64D2FF` y `box-shadow: 0 0 12px rgba(100,210,255,0.4)`
- **Selector cliente**: segmented con fondo `rgba(255,255,255,0.06)`, activo `rgba(100,210,255,0.15)` + texto `#64D2FF`
- **Group header**: `label` 11px uppercase, color `rgba(237,237,240,0.4)`
- **Nav item inactive**: `#EDEDF0`, hover `rgba(255,255,255,0.05)`
- **Nav item active**: fondo `rgba(100,210,255,0.10)`, texto y ícono `#64D2FF`, con `border-left: 2px solid #64D2FF` (barra vertical de acento)
- **User card**: avatar con `background rgba(100,210,255,0.15)` y borde `#64D2FF`, nombre `#EDEDF0`
- **Toggle presentación**: switch fill `#64D2FF` con glow

### 7.3 · Menú en 🎨 Marfil

**Feel:** apple.com sidebar warm. Cream marfil con hairlines terracotta muy sutiles, tipografía editorial.

```
background: #F7F3EC
border-right: 1px solid rgba(26,26,26,0.08)
padding: 24px 14px
```

- **Brand block**: `Acteck` en `SF Pro Display` 22px weight 600 con letter-spacing -0.02em, color `#1A1A1A`
- **Selector cliente**: pill oscuro `background #EEE7DA`, activo con `background #1A1A1A` y texto `#F7F3EC`
- **Group header**: `eyebrow` 11px uppercase letter-spacing 0.08em, color `#8A7F6C` (warm subtle)
- **Nav item inactive**: color `#1A1A1A` weight 400, hover `background rgba(26,26,26,0.03)`
- **Nav item active**: `background #EEE7DA` (surface marfil), texto weight 600 sin cambio de color; opcionalmente ícono en `#A34209` (terracotta) para el activo
- **User card**: sobre `#EEE7DA` con avatar circular
- **Toggle presentación**: switch con fill `#0055B5` (azul cobalto)

---

## 8 · Estado de Resultados

Esta es LA pestaña de referencia. Los patrones aquí se replican en las demás pestañas de análisis financiero.

**Datos comunes** (los 3 temas leen lo mismo desde `estados_resultados`):
- Header info: pestaña + año + fecha
- KPIs principales: Venta neta, Utilidad bruta, UAFIR, UAII, Margen bruto
- Tendencia mensual comparada con año anterior
- Detalle mensual por cuenta (con 7 grupos + subtotales)
- Info general (colaboradores, T.C., etc.)
- Alertas de variaciones

### 8.1 · Estado de Resultados en ☀ Claro

**Patrón:** landing apple.com. Alterna secciones blancas y negras. Muchos scrolls verticales bien definidos.

**Estructura:**

1. **Sub-nav sticky** (después de la nav principal). Contiene título "Estado de resultados" 21px + acciones: `Ver detalle | Exportar PDF | [pill azul: 2026]`

2. **Sección hero blanca** (`background #FFFFFF, padding: 80px 40px`):
   - Eyebrow: "Reporte Q1 2026" (SF Pro Display 21px, sin uppercase)
   - Título: `Estado de resultados.` 96px display 600 letter-spacing -0.05em
   - Tagline: `La mejor utilidad de los últimos tres años.` 28px 400
   - 2 links azules con chevron: `Ver el desglose completo ›  Exportar PDF ›`
   - Cifra hero: `$26.00M` a 240px display 600 letter-spacing -0.07em
   - Caption: `UAII acumulada · ↑ 233.8% vs Q1 2025 · 17.0% s/ venta neta` (verde en el delta)

3. **Sección hero negra alternada** (`background #000, padding: 100px 40px`):
   - Título: `Cifras que sostienen el trimestre.` 72px display 600 en blanco
   - Lead: `Venta neta arriba 20.5%. Utilidad bruta arriba 62.3%. Márgenes en su mejor nivel.` 21px blanco 85% opacity
   - Link azul iOS: `Descubre el detalle mes por mes ›`
   - Grid de 3 métricas: Venta neta / Utilidad bruta / UAFIR — cada una con label uppercase pequeña + cifra 64px display + delta verde

4. **Grid 2x2 de feature cards** (`background #F5F5F7, padding: 24px, gap: 24px`):
   - Alternancia: NEGRA · BLANCA / BLANCA · NEGRA
   - Cada card: 60px padding, min-height 380px
   - Categoría uppercase 13px weight 600
   - Título 40px display con parte destacada (`.highlight` en gris 40%)
   - Cifra 88px display al pie
   - Delta verde/rojo weight 500
   - Link con chevron abajo

5. **Sección Tech Specs** (`background #FFFFFF, padding: 100px 80px`):
   - Título centrado `Detalle por cuenta.` 48px display
   - Subtítulo `Los números detrás del Q1 2026.` 19px muted
   - Tabla max-width 1000px centrada
   - Grupos como subtítulos display 24px con border-bottom
   - Subtotales con `border-top: 2px solid #1D1D1F` weight 600

6. **Footer** discreto con cifras/fuente en 12px muted

**Charts en Claro:** en la sección negra o en cards blancas dedicadas, sparkline monoline `#1D1D1F` con hover interactivo (círculo destacado + tooltip abajo con valor y delta).

### 8.2 · Estado de Resultados en 🌙 Midnight

**Patrón:** iPhone Pro OLED — hero cinematográfico con la cifra en escala máxima + glow tenue en las esquinas. KPI band con hairlines tipo film-frame. Tabla dark con UAII final en cyan glow.

**Estructura:**

1. **Top bar** (`padding: 48px 40px, border-bottom hairline`):
   - Breadcrumb izquierda: `General › Estado de resultados`
   - Badge derecha: pill cyan `● Sincronizado · hace 3 min` (con dot glow)

2. **Hero centrado** (`padding: 100px 20px 120px, border-bottom hairline`):
   - Super label: `UTILIDAD ANTES DE IMPUESTOS · Q1 2026` 13px uppercase letter-spacing 0.15em
   - Cifra dominante: `$26.00M` 200px display 700 letter-spacing -0.065em blanco puro con `text-shadow: 0 0 40px rgba(100,210,255,0.15)`
   - Sub: `↑ 233.8% vs Q1 2025 · 17.0% s/venta · mejor arranque en 3 años` (con "233.8%" y "17.0%" en cyan #64D2FF)

3. **KPI band** (grid de 4 columnas con hairlines verticales):
   - `border-top` y `border-bottom` con `rgba(255,255,255,0.1)`
   - Cada celda: padding 32px 24px, `border-right rgba(255,255,255,0.06)` (excepto la última)
   - Label uppercase 11px muted + cifra 44px display blanco + delta 13px

4. **Detail header** (`padding-bottom 16px + border-bottom hairline`):
   - Título `Detalle por cuenta.` 28px display
   - Meta derecha: `Preparado 15 mar 2026 · MXN` 12px muted

5. **Detail card** (`background #0F0F0F, border rgba(255,255,255,0.06), radius 16px, padding 8px 24px 20px`):
   - Tabla con 7 columnas: Cuenta / Ene / Feb / Mar / Q1 2026 / Q1 2025 / Δ%
   - Group headers con dot cyan y `box-shadow` glow
   - Row hover: `background rgba(100,210,255,0.03)` sutil
   - Subtotales: `border-top rgba(255,255,255,0.2)` + `background rgba(100,210,255,0.03)` + display font
   - Fila final UAII: color cyan `#64D2FF` con `text-shadow: 0 0 10px rgba(100,210,255,0.3)` — el único momento acento de la página

6. **Glows radiales absolutos** en el `.midnight::before` y `::after`:
   - Superior izquierda: cyan al 6% opacity, 500×500px
   - Inferior derecha: purple al 5%, 600×600px

**Charts en Midnight:** SVG con línea `#EDEDF0` gruesa 2.5px + puntos blanco con `stroke #64D2FF` en el actual, y línea comparativa dashed `rgba(237,237,240,0.4)`. Nunca área con gradient. Tooltip fondo `#0F0F0F` con border cyan.

### 8.3 · Estado de Resultados en 🎨 Marfil

**Patrón:** apple.com/newsroom + informe anual. Hero centrado + featurette azul de ancho completo (bleed) + detail card en marfil oscuro.

**Estructura:**

1. **Top bar** (`padding: 48px 40px, border-bottom warm`):
   - Breadcrumb izquierda: `General › Estado de resultados` (14px, separador warm brown)
   - Botones derecha: `[Ghost: 2025] [Primary: Exportar PDF]` (pill 999px, azul cobalto para primary)

2. **Hero centrado** (`padding: 80px 20px 100px`):
   - Eyebrow pill terracotta: `Q1 2026 · Cierre disponible` (12px weight 600 sobre `rgba(196,82,13,0.10)`)
   - Título: `Un trimestre récord.` 96px display 600 con salto de línea intencional
   - Lead: `La UAII de REVKO cerró en el mejor arranque de año de los últimos 3.` 22px muted
   - Cifra hero: `$26.00M` 200px display letter-spacing -0.065em
   - Delta: `↑ 233.8% vs Q1 2025 · 17.0% s/ venta neta` verde con lbl gris

3. **Featurette azul bleed** (`background #0055B5, margin: 40px -40px, padding: 80px 60px, text-align: center`):
   - Eyebrow cyan claro: `LOS NÚMEROS DETRÁS`
   - Título en marfil: `Todo lo que hizo posible este trimestre.` 56px display
   - Grid de 3 métricas: cada una con `border-top rgba(247,243,236,0.2)` + label cyan claro + cifra 40px display + sub cyan claro

4. **Detail card en marfil oscuro** (`background #EEE7DA, radius 24px, padding 40px`):
   - Título: `Detalle por cuenta.` 32px display
   - Tabla clean con hairlines `rgba(26,26,26,0.08)`
   - Group headers en `background rgba(26,26,26,0.03)` con label uppercase 11px muted warm
   - Subtotales: `border-top 1.5px solid #1A1A1A` weight 600 display 16px
   - UAII contable final: color terracotta `#A34209` (único acento fuerte)

**Charts en Marfil:** línea `#1A1A1A` sobre marfil, área `fill: #1A1A1A, fill-opacity: 0.05`. Línea comparativa dashed `#575757`. Puntos negros con `stroke #EEE7DA`. Los charts pueden ir dentro de la featurette azul (invertidos: línea `#F7F3EC` sobre azul) o en la card marfil oscuro.

---

## 9 · Otras pestañas _(pending — mismo template)_

Cada pestaña que se codee debe:
1. Documentar aquí su spec por tema (secciones 9.x, 10.x, …)
2. Usar los tokens y componentes ya definidos (no inventar nuevos)
3. Elegir UN patrón hero por tema y aplicarlo consistente

Pestañas por documentar:
- Home Cliente
- Sell Out / Sell In
- Inventario
- Estrategia de Precios
- Marketing
- Pagos / Crédito y Cobranza
- Forecast
- Análisis
- Propuestas
- Configuración

---

## 10 · Anti-patterns _(qué NO hacer)_

- ❌ Gradiente en un número (`background-clip: text`).
- ❌ Gradiente en un ring, barra o botón.
- ❌ Rojo/verde/naranja saturados iOS (`#FF9500`, `#FF3B30`) en Claro o Marfil — usar los tonos oscuros (`#B00020`, `#1F7A3D`, `#A34209`).
- ❌ Sombras marcadas más allá del `none` que usa cada tema.
- ❌ Cards de colores pastel (`#E6F1FB`, `#FAECE7`) — eso es Notion, no Apple.
- ❌ `border-radius > 28px`. Apple máx 22px en cards estándar, 28px sólo en cards ambient tipo Fitness.
- ❌ Íconos coloreados o filled.
- ❌ Banners de alerta amarillos ancho completo — usar notice pill.
- ❌ Cifras sin `tabular-nums`.
- ❌ Tres o más colores acento en una misma pantalla.
- ❌ Font-family diferente a SF Pro dentro del sistema.
- ❌ Mezclar patrones estructurales entre temas (ej. featurette azul del Marfil en el Claro).

---

## 11 · Checklist antes de mergear una pestaña

- [ ] Todos los colores vienen de `theme.*` — cero hex hardcoded
- [ ] Toda la tipografía viene de `TYPO` — cero `fontSize` fuera de la escala
- [ ] Todas las cifras llevan `tabular-nums`
- [ ] Cero `linear-gradient` en cualquier elemento de UI
- [ ] Íconos Lucide con `strokeWidth 1.5–2`
- [ ] Charts sin grid, sin ejes decorados, un solo acento
- [ ] Charts interactivos con hover tooltip
- [ ] Se ve consistente aplicando cada uno de los 3 temas (test manual en Configuración)
- [ ] Un solo "momento hero" por pantalla
- [ ] La pestaña está documentada en la sección 9 de este manual
- [ ] Anti-patterns de la sección 10 = cero
