// Barra superior de la app móvil (ambos modos) · vidrio con hairline abajo, 48 px + safe-area.
//   Izquierda: modo "cajón" → "☰ Menú" (abre el cajón) · modo "barra" → logotipo "acteck."
//   Derecha:   Buscar (lupa) · Alertas (campana con contador de pilas) · avatar (sólo en "cajón": abre la hoja de perfil).
// La lupa y la campana quedan resaltadas mientras su pestaña está al frente; tocarlas de nuevo vuelve a la anterior.
import React from 'react';
import { Menu, Search, Bell } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';
import { AvatarImg } from '../../lib/avatar';
import { vidrio, hairline, suaveBg, Logotipo } from '../../components/nav/comun';
import { ALTO_BARRA_SUP } from '../nav';

export default function BarraSuperior({ modo, tab, badge = 0, badgeCritica = false, perfil, onMenu, onBuscar, onAlertas, onAvatar }) {
  const { theme } = useTheme();
  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 55, paddingTop: 'env(safe-area-inset-top)',
      ...vidrio(theme, 'chrome'), borderBottom: `1px solid ${hairline(theme)}`, color: theme.text, fontFamily: TYPO.fontText, userSelect: 'none', WebkitUserSelect: 'none',
    }}>
      <div style={{ height: ALTO_BARRA_SUP, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px 0 6px' }}>
        {modo === 'cajon' ? (
          <button type="button" onClick={onMenu} aria-label="Abrir menú" style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, height: 40, padding: '0 10px 0 8px', border: 0, borderRadius: 10, background: 'transparent',
            color: theme.text, fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em', cursor: 'pointer',
          }}>
            <Menu size={21} strokeWidth={2} />Menú
          </button>
        ) : (
          <div style={{ paddingLeft: 10 }}><Logotipo theme={theme} size={18} title="Acteck Dashboard" /></div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <BotonIcono theme={theme} label="Buscar" activo={tab === 'buscar'} onClick={onBuscar}><Search size={20} strokeWidth={2} /></BotonIcono>
          <BotonIcono theme={theme} label="Alertas" activo={tab === 'alertas'} onClick={onAlertas}>
            <Bell size={20} strokeWidth={2} />
            {badge > 0 && (
              <span aria-label={`${badge} con novedades`} style={{
                position: 'absolute', top: 4, right: 3, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, boxSizing: 'border-box',
                background: badgeCritica ? theme.red : theme.accent, color: theme.textOnDark || '#FFF', fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 700, lineHeight: '16px', textAlign: 'center', fontVariantNumeric: 'tabular-nums',
              }}>{badge > 9 ? '9+' : badge}</span>
            )}
          </BotonIcono>
          {modo === 'cajon' && (
            <button type="button" onClick={onAvatar} aria-label="Perfil y preferencias" style={{ width: 40, height: 40, border: 0, background: 'transparent', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <AvatarImg perfil={perfil} size={28} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function BotonIcono({ theme, label, activo, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} aria-pressed={activo} style={{
      position: 'relative', width: 40, height: 40, border: 0, borderRadius: 999, padding: 0, cursor: 'pointer',
      background: activo ? suaveBg(theme) : 'transparent', color: activo ? theme.text : theme.textMuted,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: `background ${DUR.state}ms ${EASE}, color ${DUR.state}ms ${EASE}`,
    }}>{children}</button>
  );
}
