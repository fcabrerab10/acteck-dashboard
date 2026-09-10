// Cabecera de pantalla empujada: "‹ Atrás" (44 px de alto táctil) + acción opcional a la derecha.
import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';

export default function Cabecera({ onVolver, etiqueta = 'Atrás', derecha }) {
  const { theme } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px 0 6px', minHeight: 44 }}>
      {onVolver ? (
        <button type="button" onClick={onVolver} style={{ display: 'inline-flex', alignItems: 'center', gap: 0, height: 44, padding: '0 8px 0 4px', border: 0, background: 'transparent', color: theme.accent, fontFamily: TYPO.fontText, fontSize: 16, cursor: 'pointer' }}>
          <ChevronLeft size={24} strokeWidth={2.2} style={{ marginLeft: -4 }} />{etiqueta}
        </button>
      ) : <span />}
      {derecha}
    </div>
  );
}
