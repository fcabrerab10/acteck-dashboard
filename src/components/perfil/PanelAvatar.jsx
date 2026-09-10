// PanelAvatar · el avatar de la pastilla derecha (chrome V3, opción C) con contador encima y un
// panel de 340 px (vidrio blur 24 · ELEV.flotante · radio 14 · 220 ms · Esc / clic fuera) con
// cabecera (avatar 40 con lápiz → CambiarFoto, nombre, cargo, versión) y Segmented de tres pestañas:
//   · Avisos  → CuerpoNotificaciones (pilas por área, Hoy/Semana/Silenciadas, resumen programado) +
//               "Preferencias de notificaciones · Resumen HH:MM ›". "Marcar leídas" en la cabecera.
//   · Datos   → PestanaDatos (sólo puedeActualizarDatos): puente, al día X/Y, atrasadas, por vencer.
//   · Yo      → PestanaYo: tema, menú, densidad, presentación, favoritos, preferencias, admin, salir.
// Abre en Avisos si hay novedades, si no en Yo; recuerda la pestaña mientras está abierto.
// Eventos en window:
//   · 'acteck:abrir-notificaciones' (Inicio → "Ver las N en Notificaciones") → abre en Avisos.
//   · 'acteck:abrir-avatar' { detail: { tab } } (tarjeta de perfil del sidebar) → abre en la pestaña pedida.
//
//   <PanelAvatar perfil onNavegar onCerrarSesion modoPresent onToggleModoPresent oscuro? size? />
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR, reduceMotion } from '../../lib/motion';
import { usePreferenciasNotif } from '../../lib/alertas';
import { puedeActualizarDatos } from '../../lib/permisos';
import { versionLabel } from '../../lib/version';
import { AvatarImg, usePerfilVivo } from '../../lib/avatar';
import { Segmented } from '../kit';
import { CuerpoNotificaciones, PreferenciasNotificaciones, useContadorNotificaciones } from '../notificaciones';
import { vidrio, hoverBg, hairline, cargoDe } from './comun';
import CambiarFoto from './CambiarFoto';
import PreferenciasHoja from './PreferenciasHoja';
import PestanaYo from './PestanaYo';
import PestanaDatos from './PestanaDatos';

export const EVENTO_AVATAR = 'acteck:abrir-avatar';
export const EVENTO_NOTIFICACIONES = 'acteck:abrir-notificaciones';
const ANCHO = 340;

/** Pide al PanelAvatar montado que se abra (opcionalmente en una pestaña). */
export function abrirPanelAvatar(tab) {
  if (typeof window === 'undefined') return false;
  const ev = new CustomEvent(EVENTO_AVATAR, { cancelable: true, detail: { tab } });
  window.dispatchEvent(ev);
  return ev.defaultPrevented;
}

export default function PanelAvatar({ perfil: perfilProp, onNavegar, onCerrarSesion, modoPresent, onToggleModoPresent, size = 30, oscuro = false }) {
  const { theme } = useTheme();
  const perfil = usePerfilVivo(perfilProp);
  const { data: prefsNotif } = usePreferenciasNotif();
  const contador = useContadorNotificaciones();
  const [abierto, setAbierto] = useState(false);
  const [visible, setVisible] = useState(false);
  const [tab, setTab] = useState('yo');
  const [vista, setVista] = useState('panel'); // 'panel' | 'prefsNotif'
  const [foto, setFoto] = useState(false);
  const [hoja, setHoja] = useState(null);      // null | sección de PreferenciasHoja
  const [hoverAvatar, setHoverAvatar] = useState(false);
  const [down, setDown] = useState(false);
  const raiz = useRef(null);
  const cuerpo = useRef(null);
  const hayNovedades = contador.pilas > 0;
  const puedeDatos = puedeActualizarDatos(perfil);

  const abrir = useCallback((t) => {
    setTab((cur) => t || (abierto ? cur : (hayNovedades ? 'avisos' : 'yo')));
    setVista('panel');
    setAbierto(true);
    requestAnimationFrame(() => setVisible(true));
  }, [abierto, hayNovedades]);
  const cerrar = useCallback(() => {
    setVisible(false);
    setTimeout(() => { setAbierto(false); setVista('panel'); }, reduceMotion() ? 0 : DUR.exit);
  }, []);

  // Eventos globales (Inicio, sidebar)
  useEffect(() => {
    const onNotif = (e) => { e.preventDefault(); abrir('avisos'); };
    const onAvatar = (e) => { e.preventDefault(); const t = e.detail?.tab; abrir(t === 'datos' && !puedeDatos ? 'yo' : t); };
    window.addEventListener(EVENTO_NOTIFICACIONES, onNotif);
    window.addEventListener(EVENTO_AVATAR, onAvatar);
    return () => { window.removeEventListener(EVENTO_NOTIFICACIONES, onNotif); window.removeEventListener(EVENTO_AVATAR, onAvatar); };
  }, [abrir, puedeDatos]);

  // Esc / clic fuera
  useEffect(() => {
    if (!abierto) return undefined;
    const onDown = (e) => { if (raiz.current && !raiz.current.contains(e.target)) cerrar(); };
    const onKey = (e) => { if (e.key === 'Escape') { if (vista === 'prefsNotif') setVista('panel'); else cerrar(); } };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [abierto, cerrar, vista]);

  const nombre = perfil?.nombre || perfil?.email || 'Usuario';
  const cargo = cargoDe(perfil);
  const horaResumen = prefsNotif?.resumen?.hora || '13:00';
  const badgeN = contador.pilas;
  const badgeCol = contador.criticaNueva ? (theme.red || '#FF3B30') : (theme.textMuted || '#86868B');
  const pestanas = [
    { id: 'avisos', label: 'Avisos', badge: contador.nuevas ? (contador.nuevas > 9 ? '9+' : contador.nuevas) : undefined },
    ...(puedeDatos ? [{ id: 'datos', label: 'Datos' }] : []),
    { id: 'yo', label: 'Yo' },
  ];
  const tabActiva = pestanas.some((p) => p.id === tab) ? tab : 'yo';
  const abrirPrefs = (seccion) => { cerrar(); setHoja(seccion || 'cuenta'); };

  return (
    <div ref={raiz} style={{ position: 'relative', display: 'inline-block', fontFamily: TYPO.fontText }}>
      {/* Botón avatar + contador */}
      <button type="button" onClick={() => (abierto ? cerrar() : abrir())} aria-haspopup="dialog" aria-expanded={abierto} title={badgeN ? `${nombre} · ${badgeN} con novedades` : nombre}
        onMouseDown={() => setDown(true)} onMouseUp={() => setDown(false)} onMouseLeave={() => setDown(false)}
        style={{ position: 'relative', border: 0, padding: 2, background: 'transparent', borderRadius: 999, cursor: 'pointer', display: 'inline-flex',
          boxShadow: abierto ? `0 0 0 2px ${theme.accent}` : modoPresent ? `0 0 0 2px ${theme.green || '#34C759'}` : 'none', transform: down ? 'scale(0.96)' : 'scale(1)',
          transition: `box-shadow ${DUR.state}ms ${EASE}, transform ${DUR.tap}ms ${EASE}` }}>
        <AvatarImg perfil={perfil} size={size} />
        {badgeN > 0 && (
          <span aria-label={`${badgeN} con novedades`} style={{
            position: 'absolute', top: -3, right: -4, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, boxSizing: 'content-box',
            background: badgeCol, color: '#FFF', fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 700, lineHeight: '16px', textAlign: 'center', fontVariantNumeric: 'tabular-nums',
            border: `2px solid ${oscuro ? 'rgba(29,29,31,0.95)' : theme.surface}`, boxShadow: contador.criticaNueva ? `0 0 8px ${badgeCol}88` : 'none',
          }}>{badgeN > 9 ? '9+' : badgeN}</span>
        )}
      </button>

      {abierto && (
        <div role="dialog" aria-label="Panel de usuario" style={{
          ...vidrio(theme, 14), position: 'absolute', top: size + 10, right: 0, zIndex: 1000, width: ANCHO, maxWidth: 'calc(100vw - 16px)', padding: 8, overflow: 'hidden',
          opacity: visible ? 1 : 0, transform: visible ? 'translateY(0) scale(1)' : 'translateY(-6px) scale(0.97)', transformOrigin: 'top right',
          transition: reduceMotion() ? 'none' : `opacity ${DUR.state}ms ${EASE}, transform ${DUR.state}ms ${EASE}`,
        }}>
          {vista === 'prefsNotif' ? (
            <div style={{ margin: -8, maxHeight: '72vh', overflowY: 'auto' }}><PreferenciasNotificaciones onVolver={() => setVista('panel')} /></div>
          ) : (
            <>
              {/* Cabecera */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 4px 10px' }}>
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
                  {cargo && <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cargo}</div>}
                  <div title="Versión del dashboard" style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9.5, color: theme.textSubtle || theme.textMuted, marginTop: 2, letterSpacing: '0.01em' }}>{versionLabel()}</div>
                </div>
                {tabActiva === 'avisos' && (
                  <button type="button" onClick={() => cuerpo.current?.marcarTodo()} disabled={!contador.nuevas}
                    style={{ border: 0, background: 'transparent', color: contador.nuevas ? theme.accent : theme.textSubtle, fontFamily: TYPO.fontText, fontSize: 12, fontWeight: 500, cursor: contador.nuevas ? 'pointer' : 'default', padding: '2px 4px', alignSelf: 'flex-start', whiteSpace: 'nowrap' }}>
                    Marcar leídas
                  </button>
                )}
              </div>

              <Segmented size="sm" value={tabActiva} onChange={setTab} options={pestanas} style={{ width: '100%', display: 'flex' }} />

              {/* Cuerpo por pestaña */}
              {tabActiva === 'avisos' && (
                <div style={{ margin: '10px -8px -8px' }}>
                  <CuerpoNotificaciones ref={cuerpo} onNavegar={onNavegar} onCerrar={cerrar} activo={abierto} maxAlto="52vh" />
                  <FilaPrefs theme={theme} hora={horaResumen} onClick={() => setVista('prefsNotif')} />
                </div>
              )}
              {tabActiva === 'datos' && puedeDatos && (
                <PestanaDatos activo={abierto} onNavegar={onNavegar} onCerrar={cerrar} />
              )}
              {tabActiva === 'yo' && (
                <PestanaYo perfil={perfil} onNavegar={onNavegar} onCerrarSesion={onCerrarSesion} modoPresent={modoPresent} onToggleModoPresent={onToggleModoPresent}
                  onAbrirPrefs={abrirPrefs} onCerrar={cerrar} />
              )}
            </>
          )}
        </div>
      )}

      <CambiarFoto abierto={foto} onClose={() => setFoto(false)} perfil={perfil} />
      <PreferenciasHoja abierto={!!hoja} seccionInicial={hoja || 'cuenta'} onClose={() => setHoja(null)} perfil={perfil} onNavegar={onNavegar} onCerrarSesion={onCerrarSesion} />
    </div>
  );
}

function FilaPrefs({ theme, hora, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '9px 16px', border: 0, borderTop: `1px solid ${hairline(theme)}`, cursor: 'pointer', textAlign: 'left',
        background: hover ? hoverBg(theme) : 'transparent', color: theme.text, fontFamily: TYPO.fontText, fontSize: 12, fontWeight: 500, transition: `background ${DUR.state}ms ${EASE}` }}>
      <span style={{ flex: 1 }}>Preferencias de notificaciones <span style={{ color: theme.textMuted, fontWeight: 400 }}>· Resumen <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: theme.text }}>{hora}</span></span></span>
      <span style={{ color: theme.textSubtle || theme.textMuted }}>›</span>
    </button>
  );
}
