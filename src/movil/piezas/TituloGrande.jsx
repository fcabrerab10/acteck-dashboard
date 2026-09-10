// Título grande estilo iOS (28/600) + subtítulo opcional (texto o nodo, p. ej. FrescuraPill).
import React from 'react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';

export default function TituloGrande({ titulo, sub, derecha, style }) {
  const { theme } = useTheme();
  return (
    <div style={{ padding: '6px 20px 10px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, ...style }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ margin: 0, fontFamily: TYPO.fontDisplay, fontSize: 28, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.1, color: theme.text }}>{titulo}</h1>
        {sub != null && (
          <div style={{ marginTop: 5, fontFamily: TYPO.fontText, fontSize: 13, color: theme.textMuted, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>{sub}</div>
        )}
      </div>
      {derecha}
    </div>
  );
}
