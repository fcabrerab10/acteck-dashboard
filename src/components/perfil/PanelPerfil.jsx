// PanelPerfil · botón avatar + panel rápido (propuesta B).
//   <PanelPerfil perfil={perfil} onNavegar={onNavegar} onCerrarSesion={…} />
// Props opcionales: onAbrirPreferencias(seccion) · onAbrirNotificaciones() · onAbrirFavoritos().
// Si no se pasan, el panel monta por sí mismo la hoja "Todas las preferencias" (PreferenciasHoja).
// Cambios al instante (sin Guardar): tema → setThemeKey + prefs.tema; menú/densidad → setPreferencia.
import React, { useEffect, useRef, useState } from 'react';
import { Sun, Moon, Palette, Monitor, PanelTop, Tablet, Smartphone, Rows3, Rows4, Bell, Star, SlidersHorizontal, Shield, LogOut, ChevronRight, Pencil, Eye } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';
import { usePreferencias, getPath } from '../../lib/preferencias';
import { puedeConfigurar } from '../../lib/permisos';
import { versionLabel } from '../../lib/version';
import { AvatarImg, usePerfilVivo } from '../../lib/avatar';
import { Segmented } from '../kit';
import { vidrio, hoverBg, suaveBg, hairline, cargoDe } from './comun';
import CambiarFoto from './CambiarFoto';
import PreferenciasHoja from './PreferenciasHoja';

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

export default function PanelPerfil({ perfil: perfilProp, onNavegar, onCerrarSesion, onAbrirPreferencias, onAbrirNotificaciones, onAbrirFavoritos, filasExtra = [] }) {
  const { theme, themeKey, setThemeKey } = useTheme();
  const perfil = usePerfilVivo(perfilProp);
  const { menu, favoritos, prefs, setPreferencia } = usePreferencias();
  const [abierto, setAbierto] = useState(false);
  const [foto, setFoto] = useState(false);
  const [hoja, setHoja] = useState(null); // null | seccion
  const [hoverAvatar, setHoverAvatar] = useState(false);
  const raiz = useRef(null);

  // Cerrar con click fuera / Esc
  useEffect(() => {
    if (!abierto) return;
    const onDown = (e) => { if (raiz.current && !raiz.current.contains(e.target)) setAbierto(false); };
    const onKey = (e) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [abierto]);

  const cerrar = () => setAbierto(false);
  const abrirPrefs = (seccion) => { cerrar(); if (onAbrirPreferencias) onAbrirPreferencias(seccion); else setHoja(seccion || 'cuenta'); };
  const cambiarTema = (id) => { setThemeKey(id); setPreferencia('tema', id); };
  const horaResumen = getPath(prefs, 'notificaciones.resumenHora', '13:00');
  const esSuper = puedeConfigurar(perfil);
  const nombre = perfil?.nombre || perfil?.email || 'Usuario';

  const [down, setDown] = useState(false);

  return (
    <div ref={raiz} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" onClick={() => setAbierto((v) => !v)} aria-haspopup="dialog" aria-expanded={abierto} title={nombre}
        onMouseDown={() => setDown(true)} onMouseUp={() => setDown(false)} onMouseLeave={() => setDown(false)}
        style={{ border: 0, padding: 2, background: 'transparent', borderRadius: 999, cursor: 'pointer', display: 'inline-flex',
          boxShadow: abierto ? `0 0 0 2px ${theme.accent}` : 'none', transform: down ? 'scale(0.96)' : 'scale(1)',
          transition: `box-shadow ${DUR.state}ms ${EASE}, transform ${DUR.tap}ms ${EASE}` }}>
        <AvatarImg perfil={perfil} size={32} />
      </button>

      {abierto && (
        <div role="dialog" aria-label="Panel de perfil" style={{
          ...vidrio(theme, 14), position: 'absolute', top: 42, right: 0, zIndex: 70, width: 300, maxWidth: 'calc(100vw - 16px)', padding: 8,
          animation: `perfil-pop ${DUR.state}ms ${EASE}`, transformOrigin: 'top right',
        }}>
          <style>{'@keyframes perfil-pop{from{opacity:0;transform:scale(0.96) translateY(-4px)}to{opacity:1;transform:none}}'}</style>

          {/* Cabecera */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 6px 10px', borderBottom: `1px solid ${hairline(theme)}` }}>
            <button type="button" onClick={() => { cerrar(); setFoto(true); }} title="Cambiar foto"
              onMouseEnter={() => setHoverAvatar(true)} onMouseLeave={() => setHoverAvatar(false)}
              style={{ position: 'relative', border: 0, padding: 0, background: 'transparent', cursor: 'pointer', borderRadius: 999, flexShrink: 0 }}>
              <AvatarImg perfil={perfil} size={40} />
              <span aria-hidden style={{ position: 'absolute', right: -2, bottom: -2, width: 16, height: 16, borderRadius: 999, background: hoverAvatar ? theme.accent : theme.surface,
                border: `1px solid ${hairline(theme)}`, color: hoverAvatar ? (theme.textOnDark || theme.surface) : theme.textMuted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                transition: `background ${DUR.state}ms ${EASE}, color ${DUR.state}ms ${EASE}` }}>
                <Pencil size={9} strokeWidth={2.2} />
              </span>
            </button>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 13.5, fontWeight: 600, letterSpacing: '-0.01em', color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombre}</div>
              {cargoDe(perfil) && <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cargoDe(perfil)}</div>}
              <div title="Versión del dashboard" style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9.5, color: theme.textSubtle || theme.textMuted, marginTop: 2, letterSpacing: '0.01em' }}>{versionLabel()}</div>
            </div>
          </div>

          {/* Tiles */}
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
            <Tile theme={theme} label="Notificaciones" span={2} onClick={() => { cerrar(); if (onAbrirNotificaciones) onAbrirNotificaciones(); else abrirPrefs('notificaciones'); }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: theme.text }}>
                <Bell size={13} strokeWidth={2} style={{ color: theme.textMuted }} /> Resumen <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{horaResumen}</span>
              </span>
              <ChevronRight size={13} style={{ color: theme.textSubtle || theme.textMuted, marginLeft: 'auto' }} />
            </Tile>
          </div>

          {/* Filas */}
          <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 4 }}>
            <FilaMenu theme={theme} icon={Star} iconColor={theme.yellow} onClick={() => { cerrar(); if (onAbrirFavoritos) onAbrirFavoritos(); else abrirPrefs('menu'); }}>
              Favoritos <span style={{ color: theme.textMuted, fontWeight: 400 }}>· {favoritos.length} fijado{favoritos.length === 1 ? '' : 's'}</span>
            </FilaMenu>
            <FilaMenu theme={theme} icon={SlidersHorizontal} onClick={() => abrirPrefs('cuenta')}>Todas las preferencias</FilaMenu>
            {filasExtra.map((f) => (
              <FilaMenu key={f.label} theme={theme} icon={f.icon || Eye} chevron={f.toggle == null} onClick={() => { if (f.cerrar !== false) cerrar(); f.onClick?.(); }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%' }}>
                  <span>{f.label}</span>
                  {f.toggle != null && (
                    <span style={{ width: 30, height: 18, borderRadius: 999, background: f.toggle ? (theme.green || '#34C759') : (theme.mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'), position: 'relative', transition: `background ${DUR.state}ms`, flexShrink: 0 }}>
                      <span style={{ position: 'absolute', top: 1, left: f.toggle ? 13 : 1, width: 16, height: 16, borderRadius: 999, background: '#FFF', boxShadow: '0 1px 3px rgba(0,0,0,0.15)', transition: `left ${DUR.state}ms ${EASE}` }} />
                    </span>
                  )}
                </span>
              </FilaMenu>
            ))}
            {esSuper && (
              <FilaMenu theme={theme} icon={Shield} onClick={() => { cerrar(); onNavegar?.(null, 'configuracion'); }}>
                Administración <span style={{ color: theme.textMuted, fontWeight: 400 }}>· usuarios · datos · cuotas</span>
              </FilaMenu>
            )}
            {onCerrarSesion && (
              <>
                <div style={{ height: 1, background: hairline(theme), margin: '4px 2px' }} />
                <FilaMenu theme={theme} icon={LogOut} peligro chevron={false} onClick={() => { cerrar(); onCerrarSesion(); }}>Cerrar sesión</FilaMenu>
              </>
            )}
          </div>
        </div>
      )}

      <CambiarFoto abierto={foto} onClose={() => setFoto(false)} perfil={perfil} />
      {!onAbrirPreferencias && (
        <PreferenciasHoja abierto={!!hoja} seccionInicial={hoja || 'cuenta'} onClose={() => setHoja(null)} perfil={perfil} onNavegar={onNavegar} onCerrarSesion={onCerrarSesion} />
      )}
    </div>
  );
}

function Tile({ theme, label, children, span = 1, onClick }) {
  const [hover, setHover] = useState(false);
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ gridColumn: span === 2 ? '1 / -1' : 'auto', borderRadius: 10, border: 0, padding: '7px 8px 7px', textAlign: 'left', cursor: onClick ? 'pointer' : 'default',
        background: onClick && hover ? hoverBg(theme) : suaveBg(theme), display: 'flex', flexDirection: onClick ? 'row' : 'column', alignItems: onClick ? 'center' : 'flex-start', gap: 6,
        fontFamily: TYPO.fontText, transition: `background ${DUR.state}ms ${EASE}` }}>
      <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: theme.textSubtle || theme.textMuted, whiteSpace: 'nowrap' }}>{label}</span>
      {children}
    </Tag>
  );
}

function FilaMenu({ theme, icon: Icon, iconColor, children, onClick, peligro = false, chevron = true }) {
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
