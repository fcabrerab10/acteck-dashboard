// Anillo de frescura · SVG 30 px. Se llena con la fracción de la cadencia transcurrida
// (verde al día, naranja ≥ 80 %, rojo atrasada) y muestra los días dentro; ✓ para
// "cuando cambie". Mientras sube un archivo, muestra el progreso en accent.
import React from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { EASE } from '../../../lib/motion';

export default function Anillo({ pct = 0, tone = 'green', label, progreso = null, size = 30, title }) {
  const { theme } = useTheme();
  const col = progreso != null ? theme.accent : { green: theme.green, orange: theme.orange, red: theme.red, gray: theme.textSubtle || theme.textMuted }[tone] || theme.textMuted;
  const r = (size - 4) / 2, c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, progreso != null ? progreso : pct));
  const texto = progreso != null ? `${Math.round(progreso * 100)}` : label;
  return (
    <span title={title} style={{ position: 'relative', display: 'inline-flex', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={theme.text} strokeOpacity={0.08} strokeWidth={2.5} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={2.5} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - frac)} style={{ transition: `stroke-dashoffset 600ms ${EASE}, stroke 300ms ${EASE}` }} />
      </svg>
      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: TYPO.fontDisplay, fontSize: texto != null && String(texto).length > 2 ? 8 : 9.5, fontWeight: 700, color: col, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
        {texto ?? '—'}
      </span>
    </span>
  );
}
