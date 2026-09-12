// KPI card · eyebrow + badge · título · cifra grande (+ small) · sub · progreso opcional.
// Extraída de SellInClienteV2. Hover eleva 1px con sombra ELEV.hover; onClick opcional.
import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';
import { elevation } from '../../lib/elevation';
import Pill from './Pill';

// `medida`: nombre oficial de la medida del director (src/lib/medidas.js → tooltip()).
// Se pinta como title= de la tarjeta para que cualquiera pueda verificar la fórmula.
export default function KpiCard({ eyebrow, badge, titulo, big, bigSmall, bigColor, sub, progress, progressColor, progressSecondary, onClick, style, medida }) {
  const { theme } = useTheme();
  const [hover, setHover] = useState(false);
  const green = theme.green || '#34C759', orange = theme.orange || '#FF9500';
  const progCol = progressColor || (progress == null ? theme.textMuted : progress >= 100 ? green : progress >= 85 ? theme.text : orange);
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onClick={onClick} title={medida || undefined}
      style={{
        background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '12px 14px',
        cursor: onClick ? 'pointer' : 'default', position: 'relative', minWidth: 0, fontFamily: TYPO.fontText,
        transition: `transform ${DUR.state}ms ${EASE}, box-shadow ${DUR.state}ms ${EASE}`,
        transform: hover && onClick ? 'translateY(-1px)' : 'none',
        boxShadow: elevation(theme, hover && onClick ? 'hover' : 'reposo'), ...style,
      }}>
      {onClick && <ChevronRight size={13} style={{ position: 'absolute', top: 10, right: 12, color: theme.textSubtle || theme.textMuted }} />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 2, paddingRight: onClick ? 14 : 0 }}>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{eyebrow}</span>
        {badge && <Pill tone={badge.tone || 'gray'} size="xs">{badge.l ?? badge.label}</Pill>}
      </div>
      {titulo && <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, letterSpacing: '-0.005em', margin: '0 0 8px', color: theme.text }}>{titulo}</div>}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, minWidth: 0 }}>
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1, color: bigColor || theme.text, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{big}</div>
        {bigSmall && <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 500, color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bigSmall}</div>}
      </div>
      {sub && <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{sub}</div>}
      {progress != null && (
        <div style={{ marginTop: 8, position: 'relative', height: progressSecondary != null ? 8 : 3, background: `${theme.text}0F`, borderRadius: 999, overflow: 'hidden' }}>
          {progressSecondary != null && <div style={{ position: 'absolute', top: 0, left: 0, height: 3, width: `${Math.min(100, Math.max(0, progressSecondary))}%`, background: progCol, opacity: 0.5, borderRadius: 999, transition: `width 600ms ${EASE}` }} />}
          <div style={{ position: 'absolute', bottom: 0, left: 0, height: 3, width: `${Math.min(100, Math.max(0, progress))}%`, background: progCol, borderRadius: 999, transition: `width 600ms ${EASE}` }} />
        </div>
      )}
    </div>
  );
}
