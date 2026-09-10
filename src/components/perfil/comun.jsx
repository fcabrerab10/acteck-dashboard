// Piezas base del perfil: vidrio translúcido, Overlay, Modal centrado, HojaLateral, filas y controles.
// Sólo tokens de tema + rgba; nada de hex ni Tailwind de color.
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR, reduceMotion } from '../../lib/motion';
import { elevation, bordeFlotante } from '../../lib/elevation';

export const esOscuro = (theme) => theme?.mode === 'dark';
export const hoverBg = (theme) => (esOscuro(theme) ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.045)');
export const suaveBg = (theme) => (esOscuro(theme) ? 'rgba(255,255,255,0.07)' : 'rgba(120,120,128,0.10)');
export const hairline = (theme) => theme?.border || (esOscuro(theme) ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)');

/** Superficie translúcida flotante (popover / hoja / modal). blur 24 · ELEV.flotante · borde flotante. */
export function vidrio(theme, radio = 14) {
  return {
    background: esOscuro(theme) ? 'rgba(36,36,40,0.88)' : theme?.key === 'marfil' ? 'rgba(255,251,244,0.92)' : 'rgba(255,255,255,0.90)',
    backdropFilter: 'saturate(180%) blur(24px)', WebkitBackdropFilter: 'saturate(180%) blur(24px)',
    border: bordeFlotante(theme), borderRadius: radio, boxShadow: elevation(theme, 'flotante'),
    color: theme?.text, fontFamily: TYPO.fontText,
  };
}

/** Fondo oscurecido + Esc + click fuera. Mantiene el hijo montado DUR.page ms al cerrar para animar la salida. */
export function Overlay({ abierto, onClose, zIndex = 80, alinear = 'center', justificar = 'center', children }) {
  const [montado, setMontado] = useState(abierto);
  useEffect(() => {
    if (abierto) { setMontado(true); return; }
    const t = setTimeout(() => setMontado(false), DUR.page);
    return () => clearTimeout(t);
  }, [abierto]);
  useEffect(() => {
    if (!abierto) return;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [abierto, onClose]);
  if (!montado) return null;
  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: 'fixed', inset: 0, zIndex, display: 'flex', alignItems: alinear, justifyContent: justificar,
        background: abierto ? 'rgba(0,0,0,0.34)' : 'rgba(0,0,0,0)', transition: `background ${DUR.page}ms ${EASE}`,
        padding: 'env(safe-area-inset-top) 0 env(safe-area-inset-bottom)',
      }}>
      {children}
    </div>
  );
}

function useVisible(abierto) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // setTimeout y no rAF: en pestañas ocultas rAF no dispara y la hoja se quedaría fuera de pantalla.
    if (abierto) { const t = setTimeout(() => setVisible(true), 20); return () => clearTimeout(t); }
    setVisible(false);
  }, [abierto]);
  return visible;
}

/** Modal centrado (escala .96 → 1). */
export function Modal({ abierto, onClose, titulo, sub, ancho = 480, children, pie, theme, zIndex = 80 }) {
  const visible = useVisible(abierto);
  const rm = reduceMotion();
  return (
    <Overlay abierto={abierto} onClose={onClose} zIndex={zIndex}>
      <div role="dialog" aria-modal="true" aria-label={titulo} style={{
        ...vidrio(theme, 18), width: `min(calc(100vw - 24px), ${ancho}px)`, maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column',
        transform: visible || rm ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(8px)', opacity: visible ? 1 : 0,
        transition: `transform ${DUR.content}ms ${EASE}, opacity ${DUR.state}ms ${EASE}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px 18px 10px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em', color: theme?.text }}>{titulo}</div>
            {sub && <div style={{ fontSize: 12, color: theme?.textMuted, marginTop: 2 }}>{sub}</div>}
          </div>
          <BotonIcono theme={theme} icon={X} onClick={onClose} title="Cerrar" />
        </div>
        <div style={{ overflowY: 'auto', padding: '4px 18px 16px', WebkitOverflowScrolling: 'touch' }}>{children}</div>
        {pie && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 18px 14px', borderTop: `1px solid ${hairline(theme)}` }}>{pie}</div>}
      </div>
    </Overlay>
  );
}

/** Hoja lateral derecha (desliza 340 ms); en pantallas angostas ocupa todo el ancho. */
export function HojaLateral({ abierto, onClose, titulo, sub, ancho = 440, children, theme, zIndex = 80, acciones }) {
  const visible = useVisible(abierto);
  return (
    <Overlay abierto={abierto} onClose={onClose} zIndex={zIndex} alinear="stretch" justificar="flex-end">
      <div role="dialog" aria-modal="true" aria-label={titulo} style={{
        ...vidrio(theme, 0), borderRadius: '16px 0 0 16px', borderRight: 0, width: `min(100vw, ${ancho}px)`, height: '100%', display: 'flex', flexDirection: 'column',
        transform: visible ? 'translateX(0)' : 'translateX(100%)', transition: `transform ${DUR.page}ms ${EASE}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 18px 10px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 600, letterSpacing: '-0.025em', color: theme?.text }}>{titulo}</div>
            {sub && <div style={{ fontSize: 12, color: theme?.textMuted, marginTop: 2 }}>{sub}</div>}
          </div>
          {acciones}
          <BotonIcono theme={theme} icon={X} onClick={onClose} title="Cerrar (Esc)" />
        </div>
        <div style={{ overflowY: 'auto', padding: '0 14px 24px', WebkitOverflowScrolling: 'touch', flex: 1 }}>{children}</div>
      </div>
    </Overlay>
  );
}

/** Botón circular de icono (36 px). */
export function BotonIcono({ theme, icon: Icon, onClick, title, size = 30, style }) {
  const [hover, setHover] = useState(false);
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        width: size, height: size, borderRadius: 999, border: 0, padding: 0, cursor: 'pointer', flexShrink: 0,
        background: hover ? hoverBg(theme) : suaveBg(theme), color: theme?.textMuted,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: `background ${DUR.state}ms ${EASE}`, ...style,
      }}>
      <Icon size={Math.round(size * 0.47)} strokeWidth={2} />
    </button>
  );
}

/** Título de grupo en versalitas. */
export function Seccion({ theme, children, style }) {
  return (
    <div style={{
      fontSize: 10.5, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase',
      color: theme?.textSubtle || theme?.textMuted, padding: '18px 10px 6px', ...style,
    }}>{children}</div>
  );
}

/** Grupo de filas estilo Ajustes (card con hairlines). */
export function Grupo({ theme, children, style }) {
  return (
    <div style={{ background: esOscuro(theme) ? 'rgba(255,255,255,0.04)' : theme?.surface, border: `1px solid ${hairline(theme)}`, borderRadius: 12, overflow: 'hidden', ...style }}>
      {children}
    </div>
  );
}

/** Fila: icono · label/sub · control a la derecha (o chevron si es clicable). */
export function Fila({ theme, icon: Icon, label, sub, children, onClick, peligro = false, primera = false, alto = 44 }) {
  const [hover, setHover] = useState(false);
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: alto, padding: '6px 12px', border: 0,
        borderTop: primera ? 0 : `1px solid ${hairline(theme)}`, background: onClick && hover ? hoverBg(theme) : 'transparent',
        cursor: onClick ? 'pointer' : 'default', textAlign: 'left', color: peligro ? theme?.red : theme?.text, fontFamily: TYPO.fontText,
        transition: `background ${DUR.state}ms ${EASE}`,
      }}>
      {Icon && <Icon size={16} strokeWidth={1.75} style={{ color: peligro ? theme?.red : theme?.textMuted, flexShrink: 0 }} />}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 500, letterSpacing: '-0.005em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        {sub && <span style={{ display: 'block', fontSize: 11.5, color: theme?.textMuted, marginTop: 1 }}>{sub}</span>}
      </span>
      {children}
    </Tag>
  );
}

/** Interruptor iOS. */
export function Interruptor({ theme, on, onChange, title }) {
  return (
    <button type="button" role="switch" aria-checked={on} title={title} onClick={() => onChange?.(!on)}
      style={{ width: 38, height: 22, borderRadius: 999, border: 0, padding: 0, cursor: 'pointer', position: 'relative', flexShrink: 0,
        background: on ? theme?.green : (esOscuro(theme) ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.14)'), transition: `background ${DUR.state}ms ${EASE}` }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: 999, background: theme?.textOnDark || theme?.surface, boxShadow: elevation(theme, 'hover'), transition: `left ${DUR.state}ms ${EASE}` }} />
    </button>
  );
}

/** Campo de texto compacto. */
export function Campo({ theme, value, onChange, placeholder, onBlur, onKeyDown, disabled, ancho = 180, style, type = 'text', autoFocus }) {
  const [foco, setFoco] = useState(false);
  return (
    <input type={type} value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder} disabled={disabled} autoFocus={autoFocus}
      onFocus={() => setFoco(true)} onBlur={(e) => { setFoco(false); onBlur?.(e); }} onKeyDown={onKeyDown}
      style={{
        width: ancho, height: 30, padding: '0 10px', borderRadius: 8, fontFamily: TYPO.fontText, fontSize: 13, color: theme?.text,
        background: suaveBg(theme), border: `1px solid ${foco ? theme?.accent : 'transparent'}`, outline: 'none',
        boxShadow: foco ? `0 0 0 3px ${theme?.accentBg || 'rgba(0,122,255,0.15)'}` : 'none', transition: `box-shadow ${DUR.state}ms ${EASE}`, ...style,
      }} />
  );
}

/** Spinner discreto (anillo). */
export function Spinner({ theme, size = 22 }) {
  return (
    <span aria-hidden style={{ width: size, height: size, borderRadius: 999, display: 'inline-block', flexShrink: 0,
      border: `2px solid ${suaveBg(theme)}`, borderTopColor: theme?.accent, animation: 'perfil-spin 0.9s linear infinite' }}>
      <style>{'@keyframes perfil-spin{to{transform:rotate(360deg)}}'}</style>
    </span>
  );
}

export const ROL_LABEL = { super_admin: 'Super Admin', admin: 'Administrador', asistente: 'Asistente', cliente: 'Cliente', viewer: 'Viewer' };
export const cargoDe = (perfil) => perfil?.puesto || ROL_LABEL[perfil?.rol] || perfil?.rol || '';
