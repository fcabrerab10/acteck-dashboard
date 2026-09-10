// KPI móvil · 2 por fila (KpiGrid). eyebrow · cifra · sub · pill opcional · barra de progreso opcional.
import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';
import { Pill } from '../../components/kit';

export function KpiGrid({ children, cols = 2, style }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gap: 10, padding: '0 16px', ...style }}>{children}</div>;
}

export default function KpiM({ eyebrow, big, bigColor, sub, pill, progress, onClick, style }) {
  const { theme } = useTheme();
  const [down, setDown] = useState(false);
  const progCol = progress == null ? theme.textMuted : progress >= 100 ? theme.green : progress >= 85 ? theme.text : theme.orange;
  return (
    <div onClick={onClick} role={onClick ? 'button' : undefined}
      onTouchStart={() => onClick && setDown(true)} onTouchEnd={() => setDown(false)} onTouchCancel={() => setDown(false)}
      style={{
        background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '12px 14px', minWidth: 0, position: 'relative',
        fontFamily: TYPO.fontText, cursor: onClick ? 'pointer' : 'default',
        transform: down ? 'scale(0.97)' : 'scale(1)', transition: `transform ${DUR.tap}ms ${EASE}`, ...style,
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{eyebrow}</span>
        {pill && <Pill tone={pill.tone || 'gray'} size="xs">{pill.label}</Pill>}
        {!pill && onClick && <ChevronRight size={13} style={{ color: theme.textSubtle || theme.textMuted, flexShrink: 0 }} />}
      </div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1, color: bigColor || theme.text, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{big}</div>
      {sub != null && <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 5, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
      {progress != null && (
        <div style={{ marginTop: 8, height: 3, background: `${theme.text}0F`, borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: 3, width: `${Math.min(100, Math.max(0, progress))}%`, background: progCol, borderRadius: 999, transition: `width 600ms ${EASE}` }} />
        </div>
      )}
    </div>
  );
}
