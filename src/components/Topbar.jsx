// Topbar · chrome común de la app (sin navegación: esa vive en src/components/nav/).
// ─ ChromeDerecho (pastilla derecha, chrome V3 opción C): buscar (⌘K, cuando `mostrarBuscar`) y el
//   avatar con contador encima (PanelAvatar: Avisos · Datos · Yo). Ya no hay badge de alertas, botón
//   de refrescar ni campana: todo vive dentro del panel del avatar.
// ─ Topbar (default): fila sticky con ChromeDerecho a la derecha; la usan los modos Sidebar e iPhone.
//   El modo Barra embebe <ChromeDerecho oscuro /> dentro de su barra.
import React from 'react';
import { Search } from 'lucide-react';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';
import { elevation } from '../lib/elevation';
import { PanelAvatar } from './perfil';

// ═════════ Chrome derecho (reutilizable) ═════════
export function ChromeDerecho({ onNavegar, onCerrarSesion, perfilUsuario, modoPresent, onToggleModoPresent, oscuro = false, onAbrirPaleta, mostrarBuscar = false }) {
  const { theme } = useTheme();
  const isMidnight = theme.key === 'midnight';
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6, pointerEvents: 'auto' }}>
      {mostrarBuscar && (
        <button type="button" onClick={onAbrirPaleta} title="Buscar (⌘K)" style={{
          height: 28, padding: '0 8px 0 9px', border: 0, borderRadius: 999, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 7,
          background: oscuro ? 'rgba(255,255,255,0.10)' : (isMidnight ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'),
          color: oscuro ? 'rgba(255,255,255,0.8)' : theme.textMuted, fontFamily: TYPO.fontText, fontSize: 12,
        }}>
          <Search size={12} /> <span>Buscar</span>
          <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9, padding: '1px 5px', borderRadius: 4, background: oscuro || isMidnight ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)' }}>⌘K</span>
        </button>
      )}

      {/* Avatar con contador → PanelAvatar (Avisos · Datos · Yo) */}
      <PanelAvatar perfil={perfilUsuario} onNavegar={onNavegar} onCerrarSesion={onCerrarSesion}
        modoPresent={modoPresent} onToggleModoPresent={onToggleModoPresent} oscuro={oscuro} size={oscuro ? 28 : 30} />
    </div>
  );
}

// ═════════ Topbar (fila sticky) · modos Sidebar e iPhone ═════════
export default function Topbar(props) {
  const { theme } = useTheme();
  const { modoPresent, marca } = props;
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 40, pointerEvents: 'none',
      display: 'flex', alignItems: 'center', justifyContent: marca ? 'space-between' : 'flex-end', gap: 10,
      padding: marca ? '10px 20px 0' : '8px 16px 0', maxWidth: marca ? 1040 : 1600, margin: '0 auto', width: '100%', fontFamily: TYPO.fontText,
    }}>
      {marca}
      {modoPresent && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 999, pointerEvents: 'auto',
          background: 'rgba(52,199,89,0.14)', color: theme.green || '#34C759', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          <span style={{ width: 5, height: 5, borderRadius: 999, background: theme.green || '#34C759' }} />Presentación
        </span>
      )}
      <div style={{
        pointerEvents: 'auto', display: 'inline-flex', alignItems: 'center', height: 36, padding: '0 4px 0 6px', borderRadius: 999,
        background: theme.key === 'midnight' ? 'rgba(30,30,32,0.72)' : theme.key === 'marfil' ? 'rgba(255,251,244,0.78)' : 'rgba(255,255,255,0.78)',
        backdropFilter: 'saturate(180%) blur(24px)', WebkitBackdropFilter: 'saturate(180%) blur(24px)',
        border: `1px solid ${theme.key === 'midnight' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
        boxShadow: elevation(theme, 'hover'),
      }}>
        <ChromeDerecho {...props} />
      </div>
    </div>
  );
}
