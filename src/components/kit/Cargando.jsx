// Cargando · loader oficial de pantalla (V3). Único punto donde se decide el estilo del loader:
// hoy renderiza SkeletonPantalla con la silueta REAL de la pantalla que está cargando
// (hero + sus N KPIs + sus paneles con la misma disposición; presets en ./siluetas.js).
// Uso: <Cargando pantalla="sellIn" /> · <Cargando silueta={[{ tipo:'hero' }, …]} />
//      <Cargando label="Cargando Sell In…" sub="Trayendo facturación" minHeight={480} />
// Props: pantalla = clave de SILUETAS (o alias de paginaActiva: 'estrategia' → sellOut, 'cartera' → cobranza…);
// silueta = arreglo de filas explícito (gana sobre pantalla); sin ninguna de las dos usa SILUETAS.default.
// label / sub se conservan por compatibilidad (texto discreto bajo el skeleton),
// minHeight reserva alto para que la pantalla no salte; fullscreen cubre la ventana (arranque de la app).
import React from 'react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { SkeletonPantalla } from './Skeleton';
import { resolverSilueta } from './siluetas';

export default function Cargando({ pantalla, silueta, label, sub, minHeight = 320, fullscreen = false, style }) {
  const { theme } = useTheme();
  const base = fullscreen
    ? { position: 'fixed', inset: 0, zIndex: 200, background: theme?.bg || '#F5F5F7', padding: '24px', overflow: 'hidden' }
    : { minHeight };
  return (
    <div role="status" aria-busy="true" aria-label={label || 'Cargando'} style={{ ...base, fontFamily: TYPO.fontText, ...style }}>
      <SkeletonPantalla silueta={silueta || resolverSilueta(pantalla)} />
      {(label || sub) && (
        <div style={{ marginTop: 14, textAlign: 'center' }}>
          {label && <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 500, color: theme?.textMuted || '#6E6E73', letterSpacing: '-0.005em' }}>{label}</div>}
          {sub && <div style={{ fontSize: 11, color: theme?.textSubtle || theme?.textMuted || '#86868B', marginTop: 2 }}>{sub}</div>}
        </div>
      )}
    </div>
  );
}
