// Primitivas Apple.com — se usan en todas las pestañas para consistencia.
// Todas leen tokens del ThemeContext, así el mismo componente se ve distinto
// según Airy / Puro / Híbrida.
import React from 'react';
import { useTheme } from '../../lib/themeContext';

// ─── Título grande de página ───
export function AppleH1({ children, style }) {
  const { theme } = useTheme();
  return (
    <h1 style={{
      fontFamily: '-apple-system, "SF Pro Display", sans-serif',
      fontSize: 44, fontWeight: 700, letterSpacing: '-0.035em',
      lineHeight: 1.05, margin: 0, color: theme.text,
      ...style,
    }}>{children}</h1>
  );
}

// ─── Eyebrow (label pequeño arriba del título) ───
export function AppleEyebrow({ children, color, style }) {
  const { theme } = useTheme();
  return (
    <p style={{
      fontSize: 13, fontWeight: 500, letterSpacing: 0,
      color: color || theme.textMuted, margin: '0 0 6px', ...style,
    }}>{children}</p>
  );
}

// ─── Subtítulo de página ───
export function AppleSubtitle({ children, style }) {
  const { theme } = useTheme();
  return (
    <p style={{
      fontSize: 16, color: theme.textMuted, margin: 0, ...style,
    }}>{children}</p>
  );
}

// ─── Título de sección ───
export function AppleH2({ children, style }) {
  const { theme } = useTheme();
  return (
    <h2 style={{
      fontFamily: '-apple-system, "SF Pro Display", sans-serif',
      fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em',
      margin: '32px 0 16px', color: theme.text, ...style,
    }}>{children}</h2>
  );
}

// ─── Card base (blanca en airy/hibrida, oscura en puro) ───
export function AppleCard({ children, style, padding = 26, hoverable = false, onClick }) {
  const { theme } = useTheme();
  const [hover, setHover] = React.useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => hoverable && setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: theme.surface,
        border: theme.mode === 'dark' ? `1px solid ${theme.border}` : 'none',
        borderRadius: 22, padding,
        boxShadow: hover ? theme.shadowHover : theme.shadow,
        transition: 'box-shadow 240ms, transform 200ms',
        transform: hover && hoverable ? 'translateY(-2px)' : 'translateY(0)',
        cursor: onClick ? 'pointer' : 'default',
        color: theme.text,
        ...style,
      }}>{children}</div>
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

  let valueStyle = {
    fontFamily: '-apple-system, "SF Pro Display", sans-serif',
    fontSize: s.val, fontWeight: 600, letterSpacing: s.letter,
    lineHeight: 1, margin: '12px 0 6px',
    fontVariantNumeric: 'tabular-nums',
    color: textCol,
  };
  if (accent === 'gradient') {
    valueStyle = { ...valueStyle,
      background: `linear-gradient(135deg, ${theme.orange}, ${theme.pink})`,
      WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
    };
  } else if (accent) {
    valueStyle = { ...valueStyle, color: accent };
  }

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
