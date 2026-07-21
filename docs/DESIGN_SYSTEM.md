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

## 9 · Otras pestañas

Cada pestaña sigue una de estas 3 arquetípicas por tema. La 9.0 define el patrón base — el resto sólo documenta variaciones y casos especiales.

### 9.0 · Patrón base

Estructura común de cualquier pestaña:
1. **Header** — título + acciones (segmented year, filter, exportar)
2. **Contenido principal** — varía por naturaleza (analytical / operational / config)
3. **Footer opcional** — metadata (fuente, timestamp)

**Cómo cada tema resuelve el esqueleto por default:**

| Tema | Header | Contenido |
|------|--------|-----------|
| ☀ Claro | Sub-nav sticky + hero blanco con título 96px + tagline 28px + link chevron | Secciones alternadas blanco↔negro o cards 2×2 + tech-specs table |
| 🌙 Midnight | Top bar minimal + hero cifra 88-140px con text-shadow cyan glow | KPI band film-frame + tabla dark card #0F0F0F |
| 🎨 Marfil | Top bar warm + hero centrado con eyebrow terracotta pill + tagline | Featurette azul bleed (para ideas destacadas) + detail card marfil #EEE7DA |

Pestañas de naturaleza distinta (tablas dominantes, kanban, wizard, settings) tienen sus propias secciones abajo.

---

### 9.1 · Home Cliente

**Datos:** venta mes actual + delta MoM + inventario + próximos pagos + promociones activas + minuta última visita.

**Estructura común:** hero con nombre del cliente + logo + KPI principal (venta mes) + bento de 4 áreas (Sell In · Sell Out · Inventario · Pagos) + timeline del cliente (últimos eventos).

**Claro:** hero blanco con nombre cliente 72px + venta del mes 140px + link "Ver análisis detallado ›". Debajo: sección negra alternada con 4 metric cards (los KPIs de cada área). Luego grid 2×2 de cards blancas/negras alternadas con tarjeta por área (Sell In, Sell Out, Inventario, Pagos) — cada una con su cifra hero y CTA.

**Midnight:** top bar con dot del color del cliente + nombre. Hero cinemático: venta del mes en 140px cyan glow tenue. KPI band de 4 columnas (Sell In · Sell Out · Inventario · Pagos). Debajo, 4 cards `#0F0F0F` con timeline de eventos recientes.

**Marfil:** hero warm con eyebrow terracotta pill "Cliente Q1 2026" + nombre 72px + venta del mes 140px. Featurette azul bleed con 4 métricas de negocio (venta / margen / rotación / cartera). Detail card marfil con timeline mensual.

**Regla especial:** nunca mostrar el color de brand del cliente (Digitalife rojo, PCEL rojo, Dicotech cyan) como fondo ambiental. Sólo como dot 8px o strip 2px marcador. La paleta del tema domina.

---

### 9.2 · Análisis por Cliente _(vista dentro del cliente)_

**Datos:** ranking de SKUs por venta/margen · concentración top-10 · promedio de días de inventario · mix de familias.

**Estructura común:** hero con "análisis Q# del cliente X" + KPIs de concentración + gráficas de mix (bar/donut) + tabla ranking top SKUs.

**Claro:** hero blanco centrado con "Los productos que mueven el negocio." + KPI dominante (participación del top-10). Después sección negra con 3 métricas de concentración. Grid 2×2 con card por familia. Tech-specs table con ranking al final.

**Midnight:** hero cifra "60%" del top-10 en 200px + KPI band con Familias / SKUs / Concentración / Rotación. Tabla dark con ranking de SKUs, primer SKU en cyan glow (protagonista).

**Marfil:** hero centrado + featurette azul "Los 10 SKUs que definen el trimestre" con lista de 10 en 3 columnas. Detail card con tabla ranking completa.

---

### 9.3 · Análisis Global _(agregado de 3 clientes)_

**Datos:** comparativo entre 3 clientes · rentabilidad relativa · quién está creciendo · quién bajando.

**Estructura común:** tabla comparativa dominante · 3 columnas por cliente con misma métrica en cada fila.

**Claro:** hero blanco con título "Comparativo Q1 2026 · Digitalife · PCEL · Dicotech" + 3 metric cards alternadas negras/blancas (uno por cliente, cada card con su venta neta 88px + delta). Tabla tech-specs con las cuentas comparadas por columna.

**Midnight:** hero con "3 clientes · $X.XM combinado" en 140px. KPI band de 3 celdas (una por cliente), cada una con hairline vertical separadora tipo film-frame. Tabla dark comparativa.

**Marfil:** hero + featurette azul mostrando las 3 marcas alineadas (nombre + venta + delta cada una en su columna). Detail card marfil con tabla comparativa completa.

---

### 9.4 · Sell In

**Datos:** ERP ventas por SKU/semana/mes · vs meta anual · Rebate SPIFF acumulado.

**Estructura común:** cuota anual dominante + segmented year + tabla mensual de sell in por cliente.

**Claro:** hero blanco "Sell In {año}." + BarraCuota gigante (progress bar sutil, 8px alto) + KPI hero de acumulado. Sección negra con 3 métricas (acumulado / restante / cuota). Grid 2×2 con card por mes destacado. Tech-specs table por SKU.

**Midnight:** hero cifra acumulada + cuota como sub. KPI band mensual (Ene/Feb/Mar/Total). Tabla dark con sell in por SKU y sparkline.

**Marfil:** hero + featurette azul "Al 87% de la cuota anual." con la barra de progreso en marfil sobre azul. Detail card con tabla SKU-mensual.

---

### 9.5 · Sell Out

**Datos:** unidades y valor vendidas al canal · desglose semanal · por sucursal · por SKU.

**Estructura común:** venta semanal dominante + minimap 52 semanas + tabla SKU × semana.

**Claro:** hero blanco "Sell Out · última semana" + cifra venta semanal 140px + delta vs semana anterior. Sección negra con 3 métricas (semana / MoM / YoY). Grid 2×2 con cards por top-4 SKU. Tech-specs table con SKUs y sparklines.

**Midnight:** hero cifra venta semana + KPI band 4 columnas (Semana / MoM / YoY / Ranking). Minimap 52 semanas en línea cyan sobre negro. Tabla dark SKU × semana.

**Marfil:** hero + featurette azul con "Semana X · $Y.YM movidos" + 3 top SKUs. Detail card con tabla completa.

**Regla especial:** el minimap de 52 semanas usa la misma paleta Sparkline (color = theme.text). Nunca escalones colorados por bloque.

---

### 9.6 · Estrategia de Precios

**Datos:** SKU × versión de lista de precios · precio actual vs anterior · margen vs costo.

**Estructura común:** tabla dominante con filas TODOS del mismo tamaño (regla establecida por el usuario). Sin thumbnails. Precio actualizado en display font.

**Claro:** hero blanco "Estrategia de precios · marzo 2026" + KPI de cuántos SKUs actualizados. Sección negra con 3 métricas (SKUs activos / actualizados / con margen negativo). Tech-specs table dominante — Sin cards intermedias, la tabla ES el contenido.

**Midnight:** top bar minimal, sin hero-cifra grande (la tabla es lo importante). Tabla dark protagonista con precio actual en cyan cuando cambió esta semana.

**Marfil:** hero centrado + directo a la detail card marfil oscuro con la tabla. Sin featurette azul (no hay hero moment aquí).

**Regla especial (usuario):** filas de tabla mismo tamaño exacto. Sin `min-height` variable. Padding celda idéntico en todas.

---

### 9.7 · Marketing

**Datos:** campañas activas · inversión mensual · calendario de contenidos · resultados por campaña.

**Estructura común:** calendario + KPI de inversión + tabla de campañas.

**Claro:** hero blanco con inversión mes 88px + delta vs mes anterior. Sección negra con 3 métricas (activas / próximas / cerradas). Grid 2×2 con cards por tipo de campaña. Al pie: calendario de contenidos como tabla tech-specs (por día).

**Midnight:** hero cifra inversión + KPI band 4 (activas / próximas / cerradas / ROI). Calendario en grid oscuro con dot cyan por día con contenido.

**Marfil:** hero + featurette azul "La campaña del mes" con detalle destacado. Calendario en marfil oscuro debajo.

---

### 9.8 · Pagos

**Datos:** pagos programados · vencidos · pagados este mes · desglose por método · calculadora Rebate/SPIFF.

**Estructura común:** KPI de vencidos (dominante — el que urge) + tabla de pagos + sección calculadora colapsable.

**Claro:** hero blanco con "Pagos · $X.XM vencidos" en 140px, delta rojo si sube. Sección negra con 3 métricas (vencidos / programados / pagados). Grid 2×2 por tipo. Tech-specs table de pagos con status pills. Calculadora en sección aparte al final (sin hero).

**Midnight:** hero cifra vencidos en 140px, en rojo `#FF453A` con text-shadow rojo tenue (no cyan). KPI band. Tabla dark de pagos con hover cyan.

**Marfil:** hero + featurette azul con "Cierre de mes · X pagos pendientes" con calendario compacto. Detail card marfil con tabla de pagos.

**Regla especial:** cuando el KPI dominante es "vencidos" (negativo), Midnight cambia el glow del hero de cyan → rojo, pero **conserva la estructura**. El acento del tema (cyan) cede paso a la semántica cuando la información es urgente.

---

### 9.9 · Crédito y Cobranza

**Datos:** cartera vencida · aging por rango de días · saldos por cliente/factura · comportamiento histórico.

**Estructura común:** aging chart (barras stacked) + tabla facturas + KPI dominante = "días promedio cobro".

**Claro:** hero blanco "DSO · X días" + delta. Sección negra con 4 buckets aging (0-30 / 31-60 / 61-90 / +90) como 4 metric cards. Grid 2×2 por cliente. Tech-specs table facturas.

**Midnight:** hero cifra DSO + KPI band aging 4 columnas. Aging chart con barras horizontales negras + primer bucket (0-30) en cyan glow. Tabla dark facturas.

**Marfil:** hero + featurette azul con visualización del aging (4 columnas de altura variable, marfil sobre azul). Detail card marfil con tabla.

---

### 9.10 · Inventario

**Datos:** stock actual (Acteck + cliente) · en tránsito · roadmap SKU · días de inventario · pronta expiración.

**Estructura común:** cifra total inventario + minimap por familia + tabla SKU con stock/rotación.

**Claro:** hero blanco "Inventario · $X.XM" 140px. Sección negra 3 métricas (SKUs / rotación / días). Grid 2×2 por familia. Tech-specs table SKU × ubicación.

**Midnight:** hero cifra + KPI band (Acteck / cliente / tránsito / total). Minimap de familias como pequeños rings cyan. Tabla dark SKU.

**Marfil:** hero + featurette azul "Cobertura de 87 días de venta" con desglose por familia. Detail card marfil con tabla.

**Regla especial:** las alertas de "stock crítico" y "por vencer" son NoticePills discretos (§6.4), nunca banners full-width.

---

### 9.11 · Forecast · S&OP

**Datos:** venta actual vs plan · pronóstico próximos 6 meses · sesgo del pronóstico (bias).

**Estructura común:** gráfica dominante (real vs plan vs forecast) + KPI de accuracy + tabla mensual.

**Claro:** hero blanco "Forecast · precisión Y%" + tagline. Sección negra con 3 métricas (venta real / plan / forecast). Grid 2×2 con cards por horizonte (1M / 3M / 6M / 12M). Tech-specs table mensual.

**Midnight:** hero cifra accuracy + KPI band + gráfica lineal grande (real solid + plan dashed + forecast dotted, todo en cyan tenue con el tramo actual full opacity). Tabla dark mensual.

**Marfil:** hero + featurette azul "Cerraremos el año en $X.XM (pronóstico)" con gráfica invertida (línea marfil sobre azul). Detail card marfil con tabla proyectada.

---

### 9.12 · Tracking Pedidos _(órdenes de compra)_

**Datos:** órdenes activas · próximos arribos · retrasadas · tabla de embarques con status.

**Estructura común:** timeline dominante (kanban-like por status) + tabla de pedidos.

**Claro:** hero blanco "X pedidos en tránsito." + delta vs semana anterior. Sección negra con 4 metric cards por status (Confirmado / Producción / Tránsito / Recibido). Kanban board con 4 columnas alternadas negras/blancas. Al pie: tech-specs table de embarques.

**Midnight:** hero cifra pedidos activos + KPI band 4 status. Kanban en cards `#0F0F0F` con dot de color por status (cyan = tránsito). Tabla dark de embarques.

**Marfil:** hero + featurette azul "Próximo arribo: MMM DD · $X.XM" (el que urge). Kanban compacto marfil. Detail card marfil con tabla.

**Regla especial:** este es el único caso donde un layout **kanban horizontal** es aceptado — normalmente evitamos kanbans, pero acá el status del pedido es su naturaleza.

---

### 9.13 · Propuestas _(wizard de armado)_

**Datos:** wizard de 5 pasos (Cliente → Contexto → Catálogo → Ajustes → Revisar) + preview + export Excel.

**Estructura común:** este NO sigue el patrón hero-cifra. Es un wizard con progress bar + form central + preview lateral.

**Claro:** landing blanca inicial con hero "Nueva propuesta." + botón CTA azul grande "Iniciar ›". Al iniciar: layout 2-col (form 60% + preview 40%). Progress bar 5-steps horizontal apple.com estilo (dots numerados con línea que se llena). Cada paso es una sección con hero pequeño + inputs. Al final: pantalla de export con vista previa del Excel.

**Midnight:** landing con hero cyan "Nueva propuesta." + botón cyan. Wizard en card `#0F0F0F` con progress dots cyan. Preview lateral en card separada.

**Marfil:** landing hero centrado + featurette azul explicando "el flujo". Wizard en card marfil con progress bar en 5 pasos usando terracotta como color activo.

**Regla especial:** el wizard es Apple-natural — Apple usa este pattern en Apple ID setup, iCloud onboarding, App Store checkout. Progress bar debe estar sticky arriba del wizard.

---

### 9.14 · Resumen de Clientes

**Datos:** grid con card por cliente · venta mes / delta / status / próximo evento.

**Estructura común:** grid de 3-4 cards de cliente, cada uno con acceso rápido drill-down.

**Claro:** hero blanco "Tus clientes." + subtitle "Resumen del cierre {mes}." Grid 3 col con card por cliente, alternando la 2da como negra (visual rhythm). Cada card: nombre + venta mes 44px + delta + link "Ver detalle ›".

**Midnight:** grid 3 col de cards `#0F0F0F` con dot de color del cliente arriba izquierda + venta 64px + delta cyan si positivo. Sin hero cifra global.

**Marfil:** hero + featurette azul con "3 clientes · $X.XM combinado" agregado. Grid marfil oscuro debajo.

---

### 9.15 · Visión General _(dashboard ejecutivo)_

**Datos:** un shot único con todos los KPIs críticos del negocio en una sola vista.

**Estructura común:** bento denso — muchas cifras visibles a la vez.

**Claro:** hero blanco pequeño (título 40px, sin cifra dominante — el bento es el hero). Bento 4 col × 3 filas con cifras y sparklines. Sección negra con 3 highlights del mes. Al pie: tech-specs table resumida.

**Midnight:** top bar minimal. Bento 4×3 en cards `#0F0F0F` con hairlines internas separadoras. Sin hero cifra — la cifra principal (UAII) va en la card top-izquierda 2×2. Cyan glow sólo en la UAII.

**Marfil:** hero + featurette azul con las 3 métricas de negocio. Bento marfil oscuro debajo.

**Regla especial:** esta pestaña es data-first, no storytelling. Puede tener MÁS densidad que el estándar — es la excepción a "un solo hero por pantalla".

---

### 9.16 · Administración Interna _(Pendientes & Calendario)_

**Datos:** tareas pendientes · calendario de eventos · notas · reuniones agendadas.

**Estructura común:** layout 2-col: pendientes (kanban lite) + calendario mes.

**Claro:** hero blanco "Tu semana." + KPI "X pendientes." Sección negra con 3 métricas (por vencer / esta semana / atrasados). Layout 2-col: pendientes columna izq + calendario columna der. Sin tech-specs table (data operacional, no analítica).

**Midnight:** hero cifra pendientes + KPI band. 2-col dark con pendientes en cards `#0F0F0F` y calendario en grid dark con hover cyan.

**Marfil:** hero + featurette azul "Foco de la semana." con 3 items destacados. 2-col marfil debajo.

---

### 9.17 · Telemetría _(Actividad del equipo)_

**Datos:** eventos del equipo (logins, cambios, uploads, actividad por usuario), evaluaciones mensuales.

**Estructura común:** feed cronológico + resumen por usuario + panel de evaluaciones.

**Claro:** hero blanco "Actividad del equipo." + KPI eventos hoy. Sección negra con 3 métricas (usuarios activos / eventos hoy / evaluaciones pendientes). Grid 2×2 por área (Sell / Cobranza / Marketing / Config). Feed cronológico como tech-specs table.

**Midnight:** hero cifra eventos + KPI band 4 categorías. Feed en cards `#0F0F0F` con dot cyan tipo notification.

**Marfil:** hero + featurette azul con "Los 5 usuarios más activos esta semana." Feed en marfil.

**Regla especial:** el feed debe respetar los mismos íconos por sección definidos en §4 (ícono por pestaña visitada).

---

### 9.18 · Axon de México

**Datos:** aún vacía. Placeholder con "Próximamente".

**Estructura común:** empty state limpio.

**Los 3 temas:** hero centrado con ícono `Building2` 48px del color del tema + "Axon de México" + subtítulo "En construcción". Sin bento ni tabla. Un solo elemento visual centrado.

---

### 9.19 · Configuración

**Datos:** gestión de usuarios · permisos granulares · selector de apariencia (temas).

**Estructura común:** sin hero-cifra. Es un panel de settings tipo apple.com/account.

**Claro:** header simple "Configuración." + subtitle. Selector de apariencia como bloque destacado arriba (3 preview cards). Debajo: formulario de gestión de usuarios como cards blancas con inputs apple.com estilo (labels flotantes, pill buttons). Tabla de usuarios como tech-specs.

**Midnight:** header + selector de apariencia con preview cards en dark. Formulario en cards `#0F0F0F`. Tabla dark de usuarios.

**Marfil:** header + selector en cards marfil. Sin featurette (no aplica). Formulario en marfil oscuro.

**Regla especial:** el selector de tema DEBE mostrar los 3 previews con render real de cada uno. Nunca colored dots o iconografía — se muestra el layout real en miniatura.

---

### 9.20 · Reporte

**Datos:** super-admin only. Vista consolidada de cierre para descargar/imprimir.

**Estructura común:** documento formal print-ready.

**Los 3 temas:** IGNORA los layouts propios y usa una versión "print-first" para todos: fondo blanco puro, tipografía negra, hairlines. El tema activo del usuario NO se aplica aquí — es un documento único imprimible. Único caso donde rompemos la regla de "consistente en los 3 temas".

**Regla especial:** cuando el usuario imprime desde esta pestaña, el CSS `@media print` produce PDF idéntico independientemente del tema. Es un "documento", no una pantalla.

---

### Pestañas dentro de un cliente activo _(Marketing, Pagos, Cartera del cliente)_

Cuando el usuario está en un cliente específico (ej. Digitalife → Marketing), la pestaña **hereda** la spec de la pestaña global equivalente (§9.7 Marketing, §9.8 Pagos, §9.9 Crédito y Cobranza) con estas adiciones:

- El top-bar/subnav muestra el nombre del cliente antes del título ("Digitalife · Marketing")
- El dot 8px del color del cliente aparece a la izquierda del título
- El resto del layout es idéntico

---

---

# PARTE 3 · RESPONSIVE

Este dashboard tiene que verse bien desde un iPhone SE (375px) hasta un monitor externo 4K. Esta parte define cómo cada componente se adapta.

## 12 · Breakpoints

Alineados con la lógica que usa apple.com y con los dispositivos más comunes del mercado en 2026:

| Nombre | Rango px | Dispositivos objetivo |
|--------|---------|-----------------------|
| `mobile` | 320 – 767 | iPhone SE, iPhone 15/16, iPhone 17 Pro, iPhone Pro Max (portrait) |
| `tablet` | 768 – 1023 | iPad Mini (portrait), iPad Air 11" (portrait), iPhone Pro Max (landscape) |
| `laptop` | 1024 – 1439 | iPad Pro 11" (portrait), iPad Pro 12.9" (portrait), Surface Pro, MacBook Air 11", Windows laptops HD (1366×768 y 1440×900) |
| `desktop` | 1440 – 1919 | MacBook Air 13" M-series, MacBook Pro 14"/16", Windows FHD 1920×1080, iPad Pro 12.9" landscape |
| `wide` | 1920 + | Studio Display, iMac 24", monitores externos WQHD/4K, Windows QHD 2560×1440 |

**Media queries en CSS (mobile-first, siempre):**

```css
/* Base = mobile */
@media (min-width: 768px)  { /* tablet */ }
@media (min-width: 1024px) { /* laptop */ }
@media (min-width: 1440px) { /* desktop */ }
@media (min-width: 1920px) { /* wide */ }
```

**Nunca max-width queries.** Se escribe mobile primero y se agrega complejidad hacia arriba — más fácil de mantener y más rápido en móvil.

---

## 13 · Dispositivos objetivo (tabla completa)

### Apple

| Dispositivo | Portrait | Landscape | Notas |
|-------------|---------|----------|-------|
| iPhone SE | 375 × 667 | 667 × 375 | Mínimo absoluto de soporte |
| iPhone 15/16 | 393 × 852 | 852 × 393 | — |
| iPhone 17 | 393 × 852 | 852 × 393 | — |
| iPhone 15/16/17 Pro Max | 430 × 932 | 932 × 430 | **Landscape muy común para revisar dashboards** — priorizar |
| iPad Mini 6 | 744 × 1133 | 1133 × 744 | — |
| iPad 10 / iPad Air 11 | 820 × 1180 | 1180 × 820 | — |
| iPad Pro 11" | 834 × 1194 | 1194 × 834 | — |
| iPad Pro 12.9" / 13" | 1024 × 1366 | 1366 × 1024 | En landscape ya es "laptop" |
| MacBook Air 13" (M3) | — | 1440 × 900 (efectivo) | Retina @ 2× |
| MacBook Pro 14" | — | 1512 × 982 | Retina @ 2× |
| MacBook Pro 16" | — | 1728 × 1117 | Retina @ 2× |
| iMac 24" | — | 2240 × 1260 (efectivo) | — |
| Studio Display / Pro Display | — | 2560 × 1440 y arriba | — |

### Windows y otros

| Dispositivo | Resolución nativa | Efectivo |
|-------------|-------------------|---------|
| Windows laptop HD | 1366 × 768 | 1366 × 768 | Aún muy común en corporativo |
| Windows FHD | 1920 × 1080 | 1920 × 1080 | Mayoría en 2026 |
| Windows QHD | 2560 × 1440 | 1707 × 960 @ 150% (default) | Escala 125-150% típica |
| Surface Pro | 2880 × 1920 | 1440 × 960 | Aspect 3:2 |
| Android phones populares | 360 × 800 – 412 × 915 | — | Cubierto por rango `mobile` |
| Samsung Galaxy Fold (desplegado) | 812 × 673 | — | Cubierto por rango `tablet` |

**Regla:** cualquier pantalla entre 320px y 4K debe funcionar. Testear en `iPhone SE (375)`, `iPad Air portrait (820)`, `MacBook Air (1440)`, `Windows FHD (1920)` cubre el 95% de casos.

---

## 14 · Reglas responsivas base

### 14.1 · Container y padding lateral

| Breakpoint | Max-width | Padding X |
|-----------|-----------|-----------|
| mobile | 100% | 20px |
| tablet | 100% | 32px |
| laptop | 1240px | 40px |
| desktop | 1240px | 40px |
| wide | 1440px | 60px |

Nunca dejar el contenido "flotando" ancho completo en pantallas >1440 — se rompe la línea de lectura y las cifras se ven perdidas.

### 14.2 · Escala tipográfica reducida en mobile

Todos los tokens de `TYPO` escalan hacia abajo automáticamente vía `clamp()`:

| Token | Mobile | Tablet | Laptop+ |
|-------|--------|--------|---------|
| `heroMax` (200-240) | 88px | 140px | 240px |
| `heroDisplay` (96) | 40px | 64px | 96px |
| `hero` (72) | 32px | 48px | 72px |
| `h1` (48) | 28px | 36px | 48px |
| `h2` (32) | 24px | 28px | 32px |
| `h3` (22) | 19px | 21px | 22px |
| `tagline` (28) | 18px | 22px | 28px |
| `kpiXl` (88) | 44px | 64px | 88px |
| `kpiLg` (64) | 36px | 52px | 64px |
| `kpiMd` (44) | 28px | 36px | 44px |
| `body` (15) | 15px | 15px | 15px |
| `caption` (12) | 12px | 12px | 12px |

Implementación en CSS: `font-size: clamp(<mobile>, <preferred>, <max>);` donde preferred es un cálculo vw + rem.

### 14.3 · Grids colapsables

| Grid original | Mobile | Tablet | Laptop+ |
|---------------|--------|--------|---------|
| Bento 4 col | 1 col | 2 col | 4 col |
| Bento 3 col | 1 col | 2 col | 3 col |
| Feature cards 2×2 | 1 col × 4 filas | 2×2 | 2×2 |
| KPI band (4 verticales) | 2×2 stacked | 4 horizontal | 4 horizontal |
| Sidebar 264 + main | Off-canvas + main full | Off-canvas + main full | 264 + main |

### 14.4 · Touch targets

En mobile y tablet, todo elemento clicable debe tener **mínimo 44×44px** de área táctil (Apple HIG estándar). Si el diseño visual tiene un botón de 32px, se compensa con padding invisible o `min-height/min-width: 44px`.

### 14.5 · Safe area insets (iPhone notch + home indicator)

En mobile, cualquier UI que llegue al borde de pantalla debe respetar los notches:

```css
padding-top: env(safe-area-inset-top);
padding-bottom: env(safe-area-inset-bottom);
padding-left: env(safe-area-inset-left);   /* iPhone landscape */
padding-right: env(safe-area-inset-right);
```

Y en `index.html` el meta debe ser:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

Con `viewport-fit=cover` para que el fondo llene toda la pantalla incluidas las notches (importante especialmente en Midnight, donde el fondo negro debe llegar edge-to-edge en iPhone Pro Max).

### 14.6 · Overflow horizontal

Ninguna página debe hacer scroll horizontal del body. Las tablas anchas van en un container con `overflow-x: auto; -webkit-overflow-scrolling: touch;` y sombra sutil al borde derecho para indicar scroll disponible.

### 14.7 · Hover vs Touch

Los `:hover` no existen en touch. Todo estado de hover debe tener también un estado equivalente `:active` o `:focus-visible` para touch. Cuando un elemento sólo se activa con hover (ej. tooltip de sparkline), en mobile se activa con tap.

Detección:
```css
@media (hover: hover) { /* estilos hover — Mac/Windows/mouse */ }
@media (hover: none)  { /* touch — mobile/tablet */ }
```

---

## 15 · Menú (Sidebar) responsive

El sidebar de 264px del desktop se transforma según pantalla:

### 15.1 · Desktop y wide (≥1024)

Como en la spec sección 7. Fixed left, 264px, siempre visible.

### 15.2 · Tablet (768-1023)

- **Portrait (ej. iPad Air 820px):** sidebar colapsado a 72px (solo íconos, sin labels). Hover expande a 264px por 300ms.
- **Landscape (ej. iPad Pro landscape 1194px):** ya cae en `laptop`, sidebar completo 264px.

### 15.3 · Mobile (320-767)

- **Sidebar desaparece** completamente. Se reemplaza por dos patrones combinados:
  - **Top bar sticky** de 56px con: hamburger (izq) + título de pestaña actual (centro) + acción principal (der)
  - **Bottom tab bar** iOS-style de 60px con 5 íconos: Home · Ventas · Inventario · Pagos · Más — el resto de pestañas caen en "Más"
- Hamburger abre un drawer full-height desde la izquierda con la jerarquía completa. El drawer respeta safe-area-inset-top.
- Bottom tab bar respeta `safe-area-inset-bottom` (área del home indicator en iPhone).

### 15.4 · Comportamiento por tema en mobile

- **Claro:** top bar dark blur (mismo `#1D1D1F` translúcido), bottom tab bar blanco con hairline superior
- **Midnight:** top bar `#0A0A0C` con hairline `rgba(255,255,255,0.08)`, bottom tab bar mismo negro. Ícono activo en cyan `#64D2FF` con glow
- **Marfil:** top bar `#F7F3EC` con hairline warm, bottom tab bar `#EEE7DA`. Ícono activo con dot azul cobalto `#0055B5` debajo

---

## 16 · Estado de Resultados responsive

### 16.1 · Desktop y wide (≥1024)

Como en la spec sección 8. Layout completo por tema.

### 16.2 · Laptop (1024-1439)

- Container max-width 1240px.
- Hero cifra del Claro/Midnight de 240px → 180px.
- Featurette azul del Marfil mantiene bleed edge-to-edge.
- Grid 2×2 de feature cards del Claro se mantiene, cards con padding 40px en lugar de 60px.

### 16.3 · Tablet (768-1023)

- **Claro:**
  - Sub-nav sticky se mantiene pero con menos acciones (los links secundarios entran en menú "···")
  - Hero cifra 240px → 120px
  - Grid 2×2 de feature cards → 2×2 pero cards más chicas (min-height 280px)
  - Tabla tech specs: font-size 13px, padding celda `14px 12px`
- **Midnight:**
  - Hero cifra 200px → 120px
  - KPI band 4 col → 2×2 (dos filas de dos)
  - Glows laterales reducidos al 60% de tamaño para no cargar mucho
- **Marfil:**
  - Hero cifra 200px → 120px
  - Featurette azul: `margin: 40px -32px` (respeta el padding lateral tablet)
  - Grid de 3 métricas en featurette → 3 columnas (aún cabe)

### 16.4 · Mobile (320-767)

- **Todos los temas:**
  - Los top bars y bottom tab bar del sidebar (sección 15.3) sustituyen la nav
  - Container padding X = 20px, contenido single column
  - Cifras hero grandes (200-240px) → 72-88px
  - Deltas y sub-info debajo de la cifra en línea múltiple (no todo en un renglón)
  - Tabla detalle: **columnas colapsan** a solo `Cuenta | YTD | Δ%` (los meses individuales se muestran en drill-down modal, no en la tabla principal). El detalle mensual queda accesible via tap en la fila.
  - Grid 2×2 de feature cards (Claro) → 1 columna, 4 cards apiladas
  - KPI band Midnight (4 celdas) → 2×2 con hairlines
  - Featurette azul del Marfil: sigue bleed edge-to-edge, padding reducido a `48px 24px`

- **Claro específico:** las secciones alternadas (blanco → negro → blanco) se sienten muy bien en scroll vertical mobile — como landing de apple.com/iphone en móvil
- **Midnight específico:** el hero cinematográfico funciona mejor en landscape iPhone Pro Max (932×430). Considerar rotación forzada NO — sólo optimizar landscape para que la cifra dominante quede visible sin scroll
- **Marfil específico:** en mobile la featurette bleed toca los bordes exactos de la pantalla — hairline superior/inferior para separar del contenido marfil

### 16.5 · Landscape iPhone Pro Max (932 × 430)

Caso especial que muchos usuarios ocuparán:
- Layout mobile pero con hero-band 2 col en lugar de 1 col
- KPI mini de 4 cards en un solo row (no stackea)
- Bottom tab bar reduce su altura a 44px para no comerse tanto verticalmente

---

## 17 · Reglas técnicas de implementación

### 17.1 · CSS custom properties + clamp()

Toda la tipografía responsiva se resuelve con `clamp()` en las custom properties del tema:

```css
:root {
  --font-hero-max: clamp(88px, 15vw, 240px);
  --font-hero-display: clamp(40px, 8vw, 96px);
  --font-hero: clamp(32px, 6vw, 72px);
  /* ... resto */
}
```

Ventaja: la tipografía escala suavemente entre breakpoints, no hay "saltos" bruscos.

### 17.2 · CSS Grid con auto-fit para bento

En lugar de escribir `grid-template-columns: 1fr / 2fr / 4fr` por breakpoint, usar:

```css
grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
```

Las cards se auto-organizan según ancho disponible sin necesidad de media queries manuales para cada rango.

### 17.3 · Testing manual antes de mergear

Chrome DevTools → toggle device toolbar → probar en:
- iPhone SE (375)
- iPhone 15 Pro Max (430)
- iPhone 15 Pro Max landscape (932 × 430)
- iPad Mini portrait (768)
- iPad Air portrait (820)
- iPad Pro 11" landscape (1194)
- Windows FHD (1920)

Si en cualquiera de esos: (a) hay scroll horizontal del body, (b) el touch target de un botón mide <44px, (c) una cifra hero rompe el layout, (d) una tabla se sale de pantalla — no se mergea.

### 17.4 · Reduced motion

Respetar preferencia de sistema:

```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

Los glows radiales del Midnight y el hover suave de Fitness rings deben desactivarse cuando el usuario tiene la preferencia activa (iOS `Ajustes → Accesibilidad → Movimiento`).

---

---

# PARTE 4 · REGLAS Y CHECKLIST

## 18 · Anti-patterns _(qué NO hacer)_

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

## 19 · Checklist antes de mergear una pestaña

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
- [ ] Anti-patterns de la sección 18 = cero
- [ ] Responsive: testeada en iPhone SE (375), iPhone Pro Max landscape (932×430), iPad Air portrait (820), MacBook Air (1440), Windows FHD (1920)
- [ ] Ningún scroll horizontal del body en cualquier breakpoint
- [ ] Touch targets ≥ 44×44px en mobile/tablet
- [ ] Safe area insets respetados (env(safe-area-inset-*))
- [ ] Estados de hover tienen equivalente de touch (:active o :focus-visible)
- [ ] Sidebar colapsa correctamente en tablet/mobile (drawer + bottom tab bar)
- [ ] `@media (prefers-reduced-motion)` respetado — glows y animaciones desactivadas
