// CentroNotificaciones — campana + panel flotante "Centro iOS" (propuesta A).
//
//   <CentroNotificaciones onNavegar={handleNavegar} />
//
// Props:
//   onNavegar(clienteKey, paginaId, extra) — como App.handleNavegar. `extra`
//                trae { tipo, label, sku, alerta }. Las acciones tipo url abren
//                pestaña nueva (uploads.html).
//   email      — opcional, para resuelta_por; si no viene se toma de supabase.auth.
//   align      — 'right' (default) | 'left': lado hacia el que se abre el panel.
//   size       — tamaño del botón (default 32).
//
// El interior (pilas por área, Hoy/Semana/Silenciadas, resumen programado, acciones) vive en
// CuerpoNotificaciones y lo comparte con la pestaña Avisos del PanelAvatar (chrome V3) y la
// hoja "Alertas" del modo iPhone. Esta campana ya no se monta en el chrome; queda como
// componente independiente (y para layouts que quieran la campana clásica).
// Badge = nº de pilas con novedades (rojo si hay crítica nueva).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Settings } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR, reduceMotion } from '../../lib/motion';
import { elevation, bordeFlotante } from '../../lib/elevation';
import CuerpoNotificaciones from './CuerpoNotificaciones';
import PreferenciasNotificaciones from './PreferenciasNotificaciones';
import useContadorNotificaciones from './useContadorNotificaciones';

const ANCHO = 380;

export default function CentroNotificaciones({ onNavegar, email, align = 'right', size = 32, escucharEvento = false }) {
  const { theme } = useTheme();
  const [abierto, setAbierto] = useState(false);
  const [visible, setVisible] = useState(false); // para animar salida
  const [vista, setVista] = useState('lista'); // 'lista' | 'prefs'
  const raiz = useRef(null);
  const cuerpo = useRef(null);
  const contador = useContadorNotificaciones();

  // Abrir / cerrar con animación (220 ms EASE, salida DUR.exit)
  const abrir = useCallback(() => { setAbierto(true); requestAnimationFrame(() => setVisible(true)); }, []);
  // `acteck:abrir-notificaciones` lo atiende el PanelAvatar (chrome V3). Sólo si esta campana se monta
  // sola (escucharEvento) responde ella al evento.
  useEffect(() => {
    if (!escucharEvento) return undefined;
    const on = (e) => { e.preventDefault(); abrir(); };
    window.addEventListener('acteck:abrir-notificaciones', on);
    return () => window.removeEventListener('acteck:abrir-notificaciones', on);
  }, [abrir, escucharEvento]);
  const cerrar = useCallback(() => {
    setVisible(false);
    setTimeout(() => { setAbierto(false); setVista('lista'); }, reduceMotion() ? 0 : DUR.exit);
  }, []);
  useEffect(() => {
    if (!abierto) return undefined;
    const onDoc = (e) => { if (raiz.current && !raiz.current.contains(e.target)) cerrar(); };
    const onKey = (e) => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [abierto, cerrar]);

  const badgeN = contador.pilas;
  const badgeCol = contador.criticaNueva ? (theme.red || '#FF3B30') : (theme.accent || '#007AFF');
  const hayNuevas = contador.nuevas > 0;

  return (
    <div ref={raiz} style={{ position: 'relative', display: 'inline-flex', fontFamily: TYPO.fontText }}>
      <button type="button" onClick={() => (abierto ? cerrar() : abrir())} title="Notificaciones" aria-haspopup="dialog" aria-expanded={abierto}
        style={{
          position: 'relative', width: size, height: size, borderRadius: 999, border: `1px solid ${abierto ? theme.borderStrong || theme.border : 'transparent'}`,
          background: abierto ? (theme.surfaceHover || 'rgba(0,0,0,0.04)') : 'transparent', color: abierto ? theme.text : theme.textMuted,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
          transition: `background ${DUR.state}ms ${EASE}, color ${DUR.state}ms ${EASE}`,
        }}
        onMouseEnter={(e) => { if (!abierto) e.currentTarget.style.color = theme.text; }}
        onMouseLeave={(e) => { if (!abierto) e.currentTarget.style.color = theme.textMuted; }}>
        <Bell size={Math.round(size * 0.53)} strokeWidth={1.9} />
        {badgeN > 0 && (
          <span aria-label={`${badgeN} con novedades`} style={{
            position: 'absolute', top: -2, right: -3, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999,
            background: badgeCol, color: '#FFF', fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 700, lineHeight: '16px', textAlign: 'center',
            border: `2px solid ${theme.surface}`, boxSizing: 'content-box', boxShadow: contador.criticaNueva ? `0 0 8px ${badgeCol}88` : 'none', fontVariantNumeric: 'tabular-nums',
          }}>{badgeN > 9 ? '9+' : badgeN}</span>
        )}
      </button>

      {abierto && (
        <div role="dialog" aria-label="Notificaciones" style={{
          position: 'absolute', top: size + 8, [align === 'left' ? 'left' : 'right']: 0, width: ANCHO, maxWidth: 'calc(100vw - 24px)', zIndex: 1000,
          background: theme.surface, border: bordeFlotante(theme), borderRadius: 12, boxShadow: elevation(theme, 'flotante'), overflow: 'hidden',
          opacity: visible ? 1 : 0, transform: visible ? 'translateY(0) scale(1)' : 'translateY(-6px) scale(0.98)', transformOrigin: `top ${align}`,
          transition: reduceMotion() ? 'none' : `opacity ${DUR.state}ms ${EASE}, transform ${DUR.state}ms ${EASE}`,
        }}>
          {vista === 'prefs' ? (
            <div style={{ maxHeight: '72vh', overflowY: 'auto' }}><PreferenciasNotificaciones onVolver={() => setVista('lista')} /></div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 12px 10px 16px' }}>
                <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', color: theme.text }}>Notificaciones</span>
                <span style={{ flex: 1 }} />
                <button type="button" onClick={() => cuerpo.current?.marcarTodo()} disabled={!hayNuevas} style={{ border: 0, background: 'transparent', color: hayNuevas ? (theme.accent || '#007AFF') : theme.textSubtle, fontFamily: TYPO.fontText, fontSize: 12, fontWeight: 500, cursor: hayNuevas ? 'pointer' : 'default', padding: '2px 4px' }}>Marcar leídas</button>
                <button type="button" onClick={() => setVista('prefs')} title="Preferencias" style={{ width: 26, height: 26, borderRadius: 8, border: `1px solid ${theme.border}`, background: 'transparent', color: theme.textMuted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = theme.surfaceHover || 'rgba(0,0,0,0.03)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                  <Settings size={14} />
                </button>
              </div>
              <CuerpoNotificaciones ref={cuerpo} onNavegar={onNavegar} onCerrar={cerrar} email={email} activo={abierto} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
