// PestanaYo · contenido de la pestaña "Yo" del PanelAvatar (antes PanelPerfil):
// tiles Tema (con auto) · Menú · Densidad · Presentación (toggle) + filas Favoritos, Todas las
// preferencias y Cerrar sesión (Administración vive en el menú Interno). Cambios al instante (sin Guardar).
import React, { useState } from 'react';
import { Sun, Moon, Palette, Monitor, PanelTop, Tablet, Smartphone, Rows3, Rows4, Star, SlidersHorizontal, LogOut, ChevronRight, Eye } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';
import { usePreferencias } from '../../lib/preferencias';
import { Segmented } from '../kit';
import { hoverBg, suaveBg, hairline } from './comun';

const TEMAS = [
  { id: 'claro',    icon: Sun,     title: 'Claro' },
  { id: 'midnight', icon: Moon,    title: 'Midnight' },
  { id: 'marfil',   icon: Palette, title: 'Marfil' },
  { id: 'auto',     icon: Monitor, title: 'Auto · sigue al sistema' },
];
const MENUS = [
  { id: 'barra',   icon: PanelTop,   title: 'Barra' },
  { id: 'sidebar', icon: Tablet,     title: 'iPad (sidebar)' },
  { id: 'iphone',  icon: Smartphone, title: 'iPhone' },
];
const DENSIDADES = [
  { id: 'comoda',   icon: Rows3, title: 'Cómoda' },
  { id: 'compacta', icon: Rows4, title: 'Compacta' },
];
const opcionesIcono = (lista) => lista.map((o) => ({ id: o.id, title: o.title, label: <o.icon size={13} strokeWidth={2} aria-label={o.title} /> }));

export default function PestanaYo({ perfil, onNavegar, onCerrarSesion, modoPresent, onToggleModoPresent, onAbrirPrefs, onCerrar }) {
  const { theme, themeKey, setThemeKey } = useTheme();
  const { menu, favoritos, setPreferencia } = usePreferencias();
  const cambiarTema = (id) => { setThemeKey(id); setPreferencia('tema', id); };

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: '8px 0 4px' }}>
        <Tile theme={theme} label="Tema" span={2}>
          <Segmented options={opcionesIcono(TEMAS)} value={themeKey || theme.key} onChange={cambiarTema} />
        </Tile>
        <Tile theme={theme} label="Menú">
          <Segmented options={opcionesIcono(MENUS)} value={menu.modo} onChange={(v) => setPreferencia('menu.modo', v)} />
        </Tile>
        <Tile theme={theme} label="Densidad">
          <Segmented options={opcionesIcono(DENSIDADES)} value={menu.densidad || 'comoda'} onChange={(v) => setPreferencia('menu.densidad', v)} />
        </Tile>
        {onToggleModoPresent && (
          <Tile theme={theme} label="Presentación" span={2} onClick={onToggleModoPresent} activo={!!modoPresent}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: theme.text }}>
              <Eye size={13} strokeWidth={2} style={{ color: modoPresent ? theme.green : theme.textMuted }} /> {modoPresent ? 'Activo · oculta cifras sensibles' : 'Oculta cifras sensibles al proyectar'}
            </span>
            <Toggle theme={theme} on={!!modoPresent} />
          </Tile>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 4 }}>
        <FilaMenu theme={theme} icon={Star} iconColor={theme.yellow} onClick={() => { onCerrar?.(); onAbrirPrefs?.('menu'); }}>
          Favoritos <span style={{ color: theme.textMuted, fontWeight: 400 }}>· {favoritos.length} fijado{favoritos.length === 1 ? '' : 's'}</span>
        </FilaMenu>
        <FilaMenu theme={theme} icon={SlidersHorizontal} onClick={() => { onCerrar?.(); onAbrirPrefs?.('cuenta'); }}>Todas las preferencias</FilaMenu>
        {onCerrarSesion && (
          <>
            <div style={{ height: 1, background: hairline(theme), margin: '4px 2px' }} />
            <FilaMenu theme={theme} icon={LogOut} peligro chevron={false} onClick={() => { onCerrar?.(); onCerrarSesion(); }}>Cerrar sesión</FilaMenu>
          </>
        )}
      </div>
    </>
  );
}

function Toggle({ theme, on }) {
  return (
    <span style={{ marginLeft: 'auto', width: 30, height: 18, borderRadius: 999, background: on ? (theme.green || '#34C759') : (theme.mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'), position: 'relative', transition: `background ${DUR.state}ms`, flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 1, left: on ? 13 : 1, width: 16, height: 16, borderRadius: 999, background: '#FFF', boxShadow: '0 1px 3px rgba(0,0,0,0.15)', transition: `left ${DUR.state}ms ${EASE}` }} />
    </span>
  );
}

export function Tile({ theme, label, children, span = 1, onClick, activo = false }) {
  const [hover, setHover] = useState(false);
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ gridColumn: span === 2 ? '1 / -1' : 'auto', borderRadius: 10, border: 0, padding: '7px 8px 7px', textAlign: 'left', cursor: onClick ? 'pointer' : 'default',
        background: onClick && hover ? hoverBg(theme) : suaveBg(theme), display: 'flex', flexDirection: onClick ? 'row' : 'column', alignItems: onClick ? 'center' : 'flex-start', gap: 6,
        boxShadow: activo ? `inset 0 0 0 1px ${theme.green}66` : 'none',
        fontFamily: TYPO.fontText, transition: `background ${DUR.state}ms ${EASE}` }}>
      <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: theme.textSubtle || theme.textMuted, whiteSpace: 'nowrap' }}>{label}</span>
      {children}
    </Tag>
  );
}

export function FilaMenu({ theme, icon: Icon, iconColor, children, onClick, peligro = false, chevron = true }) {
  const [hover, setHover] = useState(false);
  const color = peligro ? theme.red : theme.text;
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '8px 8px', borderRadius: 8, border: 0, cursor: 'pointer', textAlign: 'left',
        background: hover ? (peligro ? `${theme.red}14` : hoverBg(theme)) : 'transparent', color, fontFamily: TYPO.fontText, fontSize: 12.5, fontWeight: 500, letterSpacing: '-0.005em',
        transition: `background ${DUR.state}ms ${EASE}` }}>
      <Icon size={14} strokeWidth={2} style={{ color: peligro ? theme.red : (iconColor || theme.textMuted), flexShrink: 0 }} fill={Icon === Star ? 'currentColor' : 'none'} />
      <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{children}</span>
      {chevron && <ChevronRight size={13} style={{ color: theme.textSubtle || theme.textMuted, flexShrink: 0 }} />}
    </button>
  );
}
