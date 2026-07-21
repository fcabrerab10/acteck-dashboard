// Primitivas Apple.com — se usan en todas las pestañas para consistencia.
// Todas leen tokens del ThemeContext + la escala TYPO de themeTokens.
import React from 'react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';

// Helper para crear estilos tipográficos desde TYPO tokens
const typoStyle = (t) => ({
  fontFamily: t === TYPO.body || t === TYPO.sub || t === TYPO.eyebrow || t === TYPO.label || t === TYPO.caption
    ? TYPO.fontText : TYPO.fontDisplay,
  fontSize: t.fs, fontWeight: t.w,
  letterSpacing: t.ls, lineHeight: t.lh || 1.4,
});

// ─── Título hero de página (56px, gigante) ───
export function AppleHero({ children, style }) {
  const { theme } = useTheme();
  return (
    <h1 style={{ ...typoStyle(TYPO.hero), margin: 0, color: theme.text, ...style }}>
      {children}
    </h1>
  );
}

// ─── Título de página (44px, uso más común) ───
export function AppleH1({ children, style }) {
  const { theme } = useTheme();
  return (
    <h1 style={{ ...typoStyle(TYPO.h1), margin: 0, color: theme.text, ...style }}>
      {children}
    </h1>
  );
}

// ─── Eyebrow (label pequeño arriba del título) ───
export function AppleEyebrow({ children, color, style }) {
  const { theme } = useTheme();
  return (
    <p style={{
      ...typoStyle(TYPO.eyebrow),
      color: color || theme.textMuted, margin: '0 0 8px', ...style,
    }}>{children}</p>
  );
}

// ─── Subtítulo de página ───
export function AppleSubtitle({ children, style }) {
  const { theme } = useTheme();
  return (
    <p style={{
      ...typoStyle(TYPO.sub), color: theme.textMuted, margin: 0, ...style,
    }}>{children}</p>
  );
}

// ─── Título de sección (h2 con weight 700) ───
export function AppleH2({ children, style }) {
  const { theme } = useTheme();
  return (
    <h2 style={{
      ...typoStyle(TYPO.h2), margin: '32px 0 16px', color: theme.text, ...style,
    }}>{children}</h2>
  );
}

// ─── Título de card (h3) ───
export function AppleH3({ children, style }) {
  const { theme } = useTheme();
  return (
    <h3 style={{
      ...typoStyle(TYPO.h3), margin: 0, color: theme.text, ...style,
    }}>{children}</h3>
  );
}

// ─── Number displays reusables ───
// Sin `gradient` prop — el sistema prohíbe gradientes en cifras (anti-pattern §18).
// Si se necesita destacar una cifra, usar `accent` con un color sólido del tema.
export function AppleKpiValue({ children, size = 'md', accent, style }) {
  const { theme } = useTheme();
  const t = size === 'lg' ? TYPO.kpiLg : size === 'total' ? TYPO.total : TYPO.kpiMd;
  return (
    <div style={{
      ...typoStyle(t),
      fontVariantNumeric: 'tabular-nums',
      color: accent || theme.text,
      margin: '12px 0 8px',
      ...style,
    }}>{children}</div>
  );
}

// ─── Card base — flat en Claro/Marfil, dark border en Midnight ───
// Opcional accent: strip 3px arriba con color, usa cuando el card necesita
// diferenciarse por semántica (ej. sección de alertas).
export function AppleCard({ children, style, padding = 26, hoverable = false, onClick, accent }) {
  const { theme } = useTheme();
  const [hover, setHover] = React.useState(false);
  const isDark = theme.mode === 'dark';
  return (
    <div onClick={onClick}
      onMouseEnter={() => hoverable && setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: theme.surface,
        // Midnight requiere border para separar del bg negro; Claro/Marfil usan color de surface para separar
        border: isDark ? `1px solid ${theme.border}` : 'none',
        borderRadius: 22, padding,
        boxShadow: hover ? theme.shadowHover : theme.shadow,
        transition: 'box-shadow 240ms, transform 200ms',
        transform: hover && hoverable ? 'translateY(-2px)' : 'translateY(0)',
        cursor: onClick ? 'pointer' : 'default',
        color: theme.text,
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}>
      {accent && (
        <div style={{
          position: 'absolute', top: 0, left: padding, right: padding, height: 3,
          borderRadius: '0 0 4px 4px', background: accent,
        }} />
      )}
      {children}
    </div>
  );
}

// ─── Card oscura premium (para KPIs hero) ───
export function AppleCardDark({ children, style, padding = 26 }) {
  const { theme } = useTheme();
  return (
    <div style={{
      background: theme.heroCardBg,
      color: theme.heroCardText,
      border: theme.mode === 'dark' ? `1px solid ${theme.border}` : 'none',
      borderRadius: 22, padding,
      boxShadow: theme.mode === 'light' ? '0 4px 20px rgba(0,0,0,0.15)' : 'none',
      ...style,
    }}>{children}</div>
  );
}

// ─── KPI compacto (label + valor grande) ───
export function AppleKpi({ label, value, sub, delta, size = 'md', accent, dark }) {
  const { theme } = useTheme();
  const sizes = {
    lg: { val: 56, letter: '-0.04em' },
    md: { val: 38, letter: '-0.03em' },
    sm: { val: 28, letter: '-0.02em' },
  };
  const s = sizes[size] || sizes.md;
  const textCol = dark ? theme.heroCardText : theme.text;
  const mutedCol = dark ? theme.textMutedOnDark : theme.textMuted;

  const valueStyle = {
    fontFamily: TYPO.fontDisplay,
    fontSize: s.val, fontWeight: 600, letterSpacing: s.letter,
    lineHeight: 1, margin: '12px 0 6px',
    fontVariantNumeric: 'tabular-nums',
    color: accent || textCol,
  };

  return (
    <div>
      <div style={{ fontSize: 12, color: mutedCol, fontWeight: 500 }}>{label}</div>
      <div style={valueStyle}>{value}</div>
      {delta && <AppleDelta value={delta.value} tone={delta.tone} dark={dark} />}
      {sub && <div style={{ fontSize: 13, color: mutedCol }}>{sub}</div>}
    </div>
  );
}

// ─── Delta chip ───
export function AppleDelta({ value, tone = 'neutral', dark = false }) {
  const { theme } = useTheme();
  const map = {
    pos: dark ? theme.green : theme.green,
    neg: dark ? theme.red : theme.red,
    neutral: dark ? theme.textMutedOnDark : theme.textMuted,
  };
  return (
    <span style={{
      fontSize: 13, fontWeight: 500,
      color: map[tone] || map.neutral,
      display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>{value}</span>
  );
}

// ─── Botón primario Apple (pill azul) ───
export function AppleButton({ children, onClick, variant = 'primary', size = 'md', style, disabled }) {
  const { theme } = useTheme();
  const [hover, setHover] = React.useState(false);
  const sizes = {
    sm: { padding: '6px 14px', font: 12 },
    md: { padding: '8px 18px', font: 13 },
    lg: { padding: '11px 24px', font: 14 },
  };
  const s = sizes[size];

  const variants = {
    primary: {
      background: hover ? theme.accentHover : theme.accent,
      color: 'white', border: 'none',
    },
    secondary: {
      background: theme.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
      color: theme.text,
      border: 'none',
    },
    ghost: {
      background: 'transparent',
      color: theme.textMuted,
      border: 'none',
    },
  };

  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        ...variants[variant],
        padding: s.padding, borderRadius: 999,
        fontSize: s.font, fontWeight: 500,
        fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 200ms',
        ...style,
      }}>{children}</button>
  );
}

// ─── Segmented control (año, tabs, etc.) ───
export function AppleSegment({ options, value, onChange, style }) {
  const { theme } = useTheme();
  return (
    <div style={{
      display: 'inline-flex',
      background: theme.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      padding: 3, borderRadius: 12, gap: 2, ...style,
    }}>
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button key={opt.value} onClick={() => onChange(opt.value)}
            style={{
              background: on ? (theme.mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'white') : 'transparent',
              color: on ? theme.text : theme.textMuted,
              border: 'none', padding: '7px 16px', fontSize: 13,
              fontWeight: on ? 600 : 500,
              borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: on && theme.mode === 'light' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'background 160ms',
            }}>{opt.label}</button>
        );
      })}
    </div>
  );
}

// ─── Icono mono (SVG) — placeholder para íconos por sección ───
export function AppleIcon({ path, size = 20, color }) {
  const { theme } = useTheme();
  return (
    <span style={{
      width: size, height: size, display: 'inline-flex',
      alignItems: 'center', justifyContent: 'center',
      color: color || theme.text,
    }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {path}
      </svg>
    </span>
  );
}
