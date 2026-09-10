// Cargando · loader oficial de pantalla (V3). Único punto donde se decide el estilo del loader:
// hoy renderiza SkeletonPantalla; cuando Fernando elija el estilo definitivo se cambia aquí y aplica a todo.
// Uso: <Cargando /> · <Cargando label="Cargando Sell In…" sub="Trayendo facturación" minHeight={480} />
// Props: label / sub se conservan por compatibilidad (se muestran como texto discreto bajo el skeleton),
// minHeight reserva alto para que la pantalla no salte; fullscreen cubre la ventana (arranque de la app).
import React from 'react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { SkeletonPantalla } from './Skeleton';

export default function Cargando({ label, sub, minHeight = 320, fullscreen = false, style }) {
  const { theme } = useTheme();
  const base = fullscreen
    ? { position: 'fixed', inset: 0, zIndex: 200, background: theme?.bg || '#F5F5F7', padding: '24px', overflow: 'hidden' }
    : { minHeight };
  return (
    <div role="status" aria-busy="true" aria-label={label || 'Cargando'} style={{ ...base, fontFamily: TYPO.fontText, ...style }}>
      <SkeletonPantalla />
      {(label || sub) && (
        <div style={{ marginTop: 14, textAlign: 'center' }}>
          {label && <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 500, color: theme?.textMuted || '#6E6E73', letterSpacing: '-0.005em' }}>{label}</div>}
          {sub && <div style={{ fontSize: 11, color: theme?.textSubtle || theme?.textMuted || '#86868B', marginTop: 2 }}>{sub}</div>}
        </div>
      )}
    </div>
  );
}
