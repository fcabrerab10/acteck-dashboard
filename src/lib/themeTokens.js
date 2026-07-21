// Sistema de tokens visuales — Claro · Midnight · Marfil.
// Todos los componentes deben leer de aquí, no hardcodear colores.
// Los 3 temas comparten estructura de tokens; sólo cambian valores.
//
// Referencia: docs/DESIGN_SYSTEM.md

// ═══ Escala tipográfica ═══
// Los tamaños grandes usan clamp() para escalar suavemente mobile→desktop.
// Los pequeños son fijos porque en mobile no queremos que se encojan más.
export const TYPO = {
  // Stack CSS exacto que sirve apple.com/mx
  fontText:    '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif',
  fontDisplay: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif',

  // Cifras y títulos hero — responsive vía clamp
  heroMax:     { fs: 'clamp(72px, 15vw, 240px)', w: 600, ls: '-0.065em', lh: 0.85 },
  heroDisplay: { fs: 'clamp(40px, 8vw, 96px)',   w: 600, ls: '-0.05em',  lh: 0.95 },
  hero:        { fs: 'clamp(32px, 6vw, 72px)',   w: 600, ls: '-0.045em', lh: 1 },
  h1:          { fs: 'clamp(28px, 4vw, 48px)',   w: 600, ls: '-0.035em', lh: 1.05 },
  h2:          { fs: 'clamp(22px, 3vw, 32px)',   w: 600, ls: '-0.025em', lh: 1.15 },
  h3:          { fs: 'clamp(17px, 1.8vw, 22px)', w: 500, ls: '-0.015em', lh: 1.2 },
  tagline:     { fs: 'clamp(18px, 2.5vw, 28px)', w: 400, ls: '-0.02em',  lh: 1.15 },

  // Body y auxiliares — fijos
  body:        { fs: 15,                         w: 400, ls: 0,          lh: 1.5 },
  bodyLg:      { fs: 'clamp(15px, 1.6vw, 19px)', w: 400, ls: 0,          lh: 1.5 },
  eyebrow:     { fs: 13,                         w: 500, ls: 0 },
  label:       { fs: 12,                         w: 600, ls: '0.06em' },
  caption:     { fs: 12,                         w: 400, ls: 0 },

  // KPI values — responsive
  kpiXl:       { fs: 'clamp(44px, 8vw, 88px)',   w: 600, ls: '-0.045em', lh: 1 },
  kpiLg:       { fs: 'clamp(36px, 6vw, 64px)',   w: 600, ls: '-0.04em',  lh: 1 },
  kpiMd:       { fs: 'clamp(28px, 4vw, 44px)',   w: 600, ls: '-0.035em', lh: 1 },
  kpiSm:       { fs: 26,                         w: 600, ls: '-0.02em',  lh: 1 },
  total:       { fs: 17,                         w: 600, ls: '-0.015em' },
};

// ═══ Los 3 temas ═══
export const THEMES = {
  // ─── ☀ CLARO · apple.com puro ───
  claro: {
    key: 'claro',
    label: '☀ Claro',
    desc: 'apple.com puro. Blanco clínico, cards negras/blancas alternadas, azul Apple.',
    mode: 'light',
    // Superficies
    bg: '#FFFFFF',
    bgAlt: '#F5F5F7',
    surface: '#FFFFFF',
    surfaceHover: 'rgba(0,0,0,0.02)',
    surfaceDark: '#000000',
    // Texto
    text: '#1D1D1F',
    textOnDark: '#F5F5F7',
    textMuted: '#6E6E73',
    textSubtle: '#86868B',
    textMutedOnDark: 'rgba(245,245,247,0.7)',
    textSubtleOnDark: 'rgba(245,245,247,0.5)',
    // Bordes
    border: 'rgba(0,0,0,0.06)',
    borderStrong: 'rgba(0,0,0,0.15)',
    divider: 'rgba(0,0,0,0.1)',
    // Acentos
    accent: '#0066CC',       // Azul apple.com para links sobre blanco
    accentHover: '#0055B5',
    accentDark: '#2997FF',   // Azul iOS para links sobre negro
    // Semánticos
    green: '#1F7A3D',
    red: '#B00020',
    orange: '#C4520D',       // terracotta cálido tipo eyebrow "NUEVO" apple.com
    orangeSoft: '#E27A3F',
    pink: '#B62755',
    purple: '#6E44A6',
    // Sombras — Claro no usa sombras marcadas
    shadow: 'none',
    shadowHover: '0 1px 3px rgba(0,0,0,0.06)',
    // Sidebar
    sidebar: '#FFFFFF',
    sidebarBorder: 'rgba(0,0,0,0.06)',
    sidebarText: '#1D1D1F',
    sidebarTextMuted: '#6E6E73',
    sidebarActive: 'rgba(0,102,204,0.10)',
    sidebarActiveText: '#0066CC',
    // Nav superior tipo apple.com
    navBg: 'rgba(29,29,31,0.72)',
    navBackdrop: 'blur(20px) saturate(180%)',
    navText: '#F5F5F7',
    // Card hero negra premium (para KPI hero sobre fondo blanco)
    heroCardBg: '#000000',
    heroCardText: '#F5F5F7',
  },

  // ─── 🌙 MIDNIGHT · iPhone Pro OLED ───
  midnight: {
    key: 'midnight',
    label: '🌙 Midnight',
    desc: 'iPhone Pro OLED. Negro puro, cyan neon con glow tenue en esquinas.',
    mode: 'dark',
    // Superficies
    bg: '#000000',
    bgAlt: '#0A0A0C',
    surface: '#0F0F0F',
    surfaceHover: '#1D1D1F',
    surfaceElevated: '#1D1D1F',
    surfaceDark: '#000000',
    // Texto
    text: '#EDEDF0',
    textStrong: '#FFFFFF',
    textOnDark: '#EDEDF0',
    textMuted: 'rgba(237,237,240,0.6)',
    textSubtle: 'rgba(237,237,240,0.4)',
    textMutedOnDark: 'rgba(237,237,240,0.6)',
    textSubtleOnDark: 'rgba(237,237,240,0.4)',
    // Bordes
    border: 'rgba(255,255,255,0.06)',
    borderStrong: 'rgba(255,255,255,0.15)',
    divider: 'rgba(255,255,255,0.06)',
    // Acentos — un solo acento: cyan
    accent: '#64D2FF',
    accentHover: '#7DDDFF',
    accentDark: '#64D2FF',
    accentGlow: 'rgba(100,210,255,0.15)',
    accentBg: 'rgba(50,200,255,0.10)',
    // Semánticos
    green: '#30D158',
    red: '#FF453A',
    orange: '#FF9500',
    orangeSoft: '#FFB84D',
    pink: '#FF375F',
    purple: '#BF5AF2',
    // Sombras — dark no lleva sombras, separa con hairlines
    shadow: 'none',
    shadowHover: 'none',
    // Sidebar
    sidebar: '#0A0A0C',
    sidebarBorder: 'rgba(255,255,255,0.06)',
    sidebarText: '#EDEDF0',
    sidebarTextMuted: 'rgba(237,237,240,0.6)',
    sidebarActive: 'rgba(100,210,255,0.10)',
    sidebarActiveText: '#64D2FF',
    // Nav
    navBg: 'rgba(10,10,12,0.72)',
    navBackdrop: 'blur(20px) saturate(180%)',
    navText: '#EDEDF0',
    // Hero card (el bg ya es negro, la "hero" es más oscura del elevated)
    heroCardBg: '#0F0F0F',
    heroCardText: '#EDEDF0',
    // Glows radiales absolutos para las esquinas del layout
    glowCyan: 'radial-gradient(circle at 20% 0%, rgba(50,200,255,0.06) 0%, transparent 60%)',
    glowPurple: 'radial-gradient(circle at 80% 100%, rgba(191,90,242,0.05) 0%, transparent 60%)',
  },

  // ─── 🎨 MARFIL · apple.com/newsroom + Investor ───
  marfil: {
    key: 'marfil',
    label: '🎨 Marfil',
    desc: 'apple.com/newsroom. Cream warm, azul cobalto profundo, terracotta.',
    mode: 'light',
    // Superficies
    bg: '#F7F3EC',
    bgAlt: '#F0EAE0',
    surface: '#EEE7DA',
    surfaceHover: 'rgba(26,26,26,0.03)',
    surfaceInverse: '#0055B5',  // Featurette azul bleed
    surfaceDark: '#1A1A1A',
    // Texto
    text: '#1A1A1A',
    textOnInverse: '#F7F3EC',
    textOnDark: '#F7F3EC',
    textMuted: '#575757',
    textMutedOnInverse: '#7BB3EC',
    textSubtle: '#8A7F6C',
    textMutedOnDark: 'rgba(247,243,236,0.7)',
    textSubtleOnDark: 'rgba(247,243,236,0.5)',
    // Bordes
    border: 'rgba(26,26,26,0.08)',
    borderStrong: '#1A1A1A',
    divider: 'rgba(26,26,26,0.08)',
    // Acentos — azul cobalto + terracotta editorial
    accent: '#0055B5',       // Azul cobalto profundo (no iOS blue)
    accentHover: '#004599',
    accentDark: '#7BB3EC',
    accentSoft: 'rgba(0,85,181,0.10)',
    eyebrowColor: '#A34209', // Terracotta editorial — solo para eyebrows
    eyebrowSoft: 'rgba(196,82,13,0.10)',
    // Semánticos
    green: '#1F7A3D',
    red: '#B00020',
    orange: '#A34209',       // Alias del terracotta
    orangeSoft: '#C4520D',
    pink: '#B62755',
    purple: '#6E44A6',
    // Sombras — Marfil evita sombras, separa con color de superficie
    shadow: 'none',
    shadowHover: 'none',
    // Sidebar
    sidebar: '#F7F3EC',
    sidebarBorder: 'rgba(26,26,26,0.08)',
    sidebarText: '#1A1A1A',
    sidebarTextMuted: '#8A7F6C',
    sidebarActive: '#EEE7DA',
    sidebarActiveText: '#1A1A1A',
    sidebarActiveIcon: '#A34209',
    // Nav
    navBg: '#F7F3EC',
    navBackdrop: 'none',
    navText: '#1A1A1A',
    // Hero card = featurette azul cobalto
    heroCardBg: '#0055B5',
    heroCardText: '#F7F3EC',
  },
};

export const DEFAULT_THEME = 'claro';

// Migración desde los nombres viejos (airy/puro/hibrida) a los nuevos.
// Se aplica al leer perfil.tema_ui — el usuario no pierde su preferencia.
export const THEME_MIGRATIONS = {
  airy: 'claro',
  puro: 'midnight',
  hibrida: 'marfil',
  vibrant: 'marfil',
};

export function getTheme(key) {
  if (!key) return THEMES[DEFAULT_THEME];
  const migrated = THEME_MIGRATIONS[key] || key;
  return THEMES[migrated] || THEMES[DEFAULT_THEME];
}

// Aplicar tokens como CSS custom properties en el root.
// Todos los valores string se exponen como var(--t-<key>).
export function applyThemeToRoot(theme) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(theme)) {
    if (typeof v === 'string') root.style.setProperty(`--t-${k}`, v);
  }
  root.setAttribute('data-theme', theme.key);
}
