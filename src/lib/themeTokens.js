// Sistema de tokens visuales por tema. Todos los componentes deben leer de aquí,
// no hardcodear colores. Cada tema comparte la MISMA estructura de tokens.

// ═══ Escala tipográfica Apple — se aplica en todos los temas ═══
export const TYPO = {
  fontText:    '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI Variable", "Segoe UI", Roboto, sans-serif',
  fontDisplay: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter Display", "Inter", "Segoe UI Variable Display", "Segoe UI", Roboto, sans-serif',
  // Sizes
  hero:    { fs: 56, w: 600, ls: '-0.045em', lh: 1 },
  h1:      { fs: 44, w: 600, ls: '-0.035em', lh: 1.05 },
  h2:      { fs: 28, w: 700, ls: '-0.025em', lh: 1.15 },
  h3:      { fs: 17, w: 600, ls: '-0.015em', lh: 1.2 },
  body:    { fs: 15, w: 400, ls: 0, lh: 1.5 },
  sub:     { fs: 15, w: 400, ls: 0, lh: 1.5 },
  eyebrow: { fs: 13, w: 500, ls: 0 },
  label:   { fs: 12, w: 500, ls: 0 },
  caption: { fs: 12, w: 400, ls: 0 },
  kpiLg:   { fs: 52, w: 600, ls: '-0.04em', lh: 1 },
  kpiMd:   { fs: 34, w: 600, ls: '-0.03em', lh: 1 },
  total:   { fs: 20, w: 600, ls: '-0.02em' },
};

export const THEMES = {
  airy: {
    key: 'airy',
    label: 'Airy',
    desc: 'Fondo claro, cards blancas, aire generoso.',
    mode: 'light',
    bg: '#F5F5F7',
    bgElevated: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceHover: 'rgba(0,0,0,0.02)',
    surfaceDark: '#1D1D1F',
    border: 'rgba(0,0,0,0.06)',
    borderStrong: 'rgba(0,0,0,0.1)',
    divider: 'rgba(0,0,0,0.05)',
    text: '#1D1D1F',
    textOnDark: '#F5F5F7',
    textMuted: '#6E6E73',
    textSubtle: '#86868B',
    textMutedOnDark: 'rgba(245,245,247,0.7)',
    textSubtleOnDark: 'rgba(245,245,247,0.5)',
    accent: '#0071E3',
    accentHover: '#0077ED',
    green: '#34C759',
    red: '#FF3B30',
    orange: '#F56300',
    orangeSoft: '#FF6482',
    pink: '#FF375F',
    purple: '#BF5AF2',
    shadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)',
    shadowHover: '0 4px 20px rgba(0,0,0,0.08)',
    heroCardBg: '#1D1D1F', // card negra premium para KPI hero en airy
    heroCardText: '#F5F5F7',
    sidebar: '#FFFFFF',
    sidebarText: '#1D1D1F',
    sidebarTextMuted: '#6E6E73',
    sidebarActive: 'rgba(0,113,227,0.10)',
    sidebarActiveText: '#0071E3',
    sidebarBorder: 'rgba(0,0,0,0.06)',
  },
  puro: {
    key: 'puro',
    label: 'Puro',
    desc: 'Todo negro. Alto contraste. Sensación cinematográfica.',
    mode: 'dark',
    bg: '#000000',
    bgElevated: '#1D1D1F',
    surface: '#1D1D1F',
    surfaceHover: '#2A2A2C',
    surfaceDark: '#000000',
    border: 'rgba(255,255,255,0.08)',
    borderStrong: 'rgba(255,255,255,0.15)',
    divider: 'rgba(255,255,255,0.06)',
    text: '#F5F5F7',
    textOnDark: '#F5F5F7',
    textMuted: 'rgba(245,245,247,0.6)',
    textSubtle: 'rgba(245,245,247,0.4)',
    textMutedOnDark: 'rgba(245,245,247,0.6)',
    textSubtleOnDark: 'rgba(245,245,247,0.4)',
    accent: '#0A84FF',
    accentHover: '#409CFF',
    green: '#30D158',
    red: '#FF453A',
    orange: '#FF9500',
    orangeSoft: '#FF6482',
    pink: '#FF375F',
    purple: '#BF5AF2',
    shadow: 'none',
    shadowHover: '0 4px 20px rgba(0,0,0,0.6)',
    heroCardBg: 'linear-gradient(180deg, #1D1D1F, #000)',
    heroCardText: '#F5F5F7',
    sidebar: '#0A0A0C',
    sidebarText: '#F5F5F7',
    sidebarTextMuted: 'rgba(245,245,247,0.6)',
    sidebarActive: 'rgba(10,132,255,0.18)',
    sidebarActiveText: '#409CFF',
    sidebarBorder: 'rgba(255,255,255,0.08)',
  },
  hibrida: {
    key: 'hibrida',
    label: 'Vibrant',
    desc: 'Mesh gradient tricolor, glass cards con blur, KPI hero con orb glow.',
    mode: 'vibrant',
    // Fondo con mesh tricolor tenue — se aplica al body via CSS var
    bg: 'radial-gradient(circle at 20% 0%, rgba(0,113,227,0.08) 0%, transparent 45%), radial-gradient(circle at 90% 30%, rgba(191,90,242,0.08) 0%, transparent 45%), radial-gradient(circle at 40% 100%, rgba(255,55,95,0.08) 0%, transparent 45%), #F5F5F7',
    bgElevated: 'rgba(255,255,255,0.72)',
    surface: 'rgba(255,255,255,0.72)', // glass — usan backdrop-filter en el componente
    surfaceHover: 'rgba(255,255,255,0.85)',
    surfaceDark: 'linear-gradient(135deg, #1D1D1F 0%, #2C2C2E 50%, #1D1D1F 100%)',
    border: 'rgba(255,255,255,0.7)',
    borderStrong: 'rgba(0,0,0,0.08)',
    divider: 'rgba(0,0,0,0.04)',
    text: '#1D1D1F',
    textOnDark: '#F5F5F7',
    textMuted: '#6E6E73',
    textSubtle: '#86868B',
    textMutedOnDark: 'rgba(245,245,247,0.7)',
    textSubtleOnDark: 'rgba(245,245,247,0.5)',
    accent: '#0071E3',
    accentHover: '#0077ED',
    green: '#34C759',
    red: '#FF3B30',
    orange: '#F56300',
    orangeSoft: '#FF6482',
    pink: '#FF375F',
    purple: '#BF5AF2',
    shadow: '0 4px 20px rgba(0,0,0,0.04)',
    shadowHover: '0 8px 30px rgba(0,0,0,0.08)',
    heroCardBg: 'linear-gradient(135deg, #1D1D1F 0%, #2C2C2E 50%, #1D1D1F 100%)',
    heroCardText: '#F5F5F7',
    sidebar: 'rgba(255,255,255,0.72)', // sidebar glass
    sidebarText: '#1D1D1F',
    sidebarTextMuted: '#6E6E73',
    sidebarActive: 'rgba(0,113,227,0.14)',
    sidebarActiveText: '#0055B5',
    sidebarBorder: 'rgba(0,0,0,0.06)',
  },
};

export const DEFAULT_THEME = 'airy';

export function getTheme(key) {
  return THEMES[key] || THEMES[DEFAULT_THEME];
}

// Aplicar tokens como CSS custom properties en el body
export function applyThemeToRoot(theme) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(theme)) {
    if (typeof v === 'string') root.style.setProperty(`--t-${k}`, v);
  }
  root.setAttribute('data-theme', theme.key);
}
