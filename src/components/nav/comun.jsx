// Piezas compartidas por los tres modos de menú: superficies translúcidas, Kbd, estrella de favorito,
// hoja inferior (iPhone), overlay y el icono de app (cuadrado de color) del modo iPhone.
import React, { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';
import { elevation, bordeFlotante } from '../../lib/elevation';

export const esMidnight = (theme) => theme?.key === 'midnight';
export const esMarfil = (theme) => theme?.key === 'marfil';

/** Fondo translúcido de chrome (sidebar / hojas / popovers). */
export function vidrio(theme, nivel = 'chrome') {
  const dark = esMidnight(theme);
  if (nivel === 'popover') {
    return {
      background: dark ? 'rgba(40,40,45,0.90)' : esMarfil(theme) ? 'rgba(255,251,244,0.94)' : 'rgba(255,255,255,0.92)',
      backdropFilter: 'saturate(180%) blur(30px)', WebkitBackdropFilter: 'saturate(180%) blur(30px)',
      border: bordeFlotante(theme), boxShadow: elevation(theme, 'flotante'),
    };
  }
  return {
    background: dark ? 'rgba(10,10,12,0.78)' : esMarfil(theme) ? 'rgba(247,243,236,0.86)' : 'rgba(245,245,247,0.82)',
    backdropFilter: 'saturate(180%) blur(24px)', WebkitBackdropFilter: 'saturate(180%) blur(24px)',
  };
}

export const hoverBg = (theme) => (esMidnight(theme) ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)');
export const suaveBg = (theme) => (esMidnight(theme) ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)');
export const hairline = (theme) => (esMidnight(theme) ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)');

/** Logotipo de palabra "acteck." · SF Display 600 con el punto en theme.accent (en Midnight cian).
 *  `oscuro` fuerza texto blanco (barra apple.com). */
export function Logotipo({ theme, size = 15, oscuro = false, style, onClick, title }) {
  const punto = esMidnight(theme) ? (theme?.accentCyan || theme?.accent) : (theme?.accent || '#007AFF');
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} title={title} style={{
      border: 0, background: 'transparent', padding: 0, cursor: onClick ? 'pointer' : 'default',
      fontFamily: TYPO.fontDisplay, fontSize: size, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1,
      color: oscuro ? '#FFF' : theme?.text, whiteSpace: 'nowrap', userSelect: 'none', display: 'inline-flex', alignItems: 'baseline', ...style,
    }}>acteck<span style={{ color: punto }}>.</span></Tag>
  );
}

/** Monograma "a" (sidebar colapsada): sólo la letra, mismo peso, con el punto de color. */
export function Monograma({ theme, size = 17, style, onClick, title }) {
  const punto = esMidnight(theme) ? (theme?.accentCyan || theme?.accent) : (theme?.accent || '#007AFF');
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} title={title} style={{
      border: 0, background: 'transparent', padding: 0, cursor: onClick ? 'pointer' : 'default',
      fontFamily: TYPO.fontDisplay, fontSize: size, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1, color: theme?.text, userSelect: 'none', display: 'inline-flex', alignItems: 'baseline', ...style,
    }}>a<span style={{ color: punto }}>.</span></Tag>
  );
}

/** Tecla estilo macOS. */
export function Kbd({ children, theme, oscuro = false, style }) {
  const dark = oscuro || esMidnight(theme);
  return (
    <span style={{
      fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9.5, lineHeight: 1,
      padding: '3px 5px', borderRadius: 4,
      background: dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
      color: dark ? 'rgba(255,255,255,0.7)' : (theme?.textMuted || '#6E6E73'),
      whiteSpace: 'nowrap', ...style,
    }}>{children}</span>
  );
}

/** Estrella de favorito: aparece en hover del contenedor si `visible`, siempre si ya es favorito. */
export function BotonFav({ theme, activo, visible = true, onToggle, size = 12, style }) {
  const [hover, setHover] = useState(false);
  if (!activo && !visible) return null;
  return (
    <span role="button" tabIndex={0} title={activo ? 'Quitar de favoritos' : 'Añadir a favoritos'}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onToggle?.(e); } }} onClick={(e) => { e.stopPropagation(); e.preventDefault(); onToggle?.(); }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        width: size + 10, height: size + 10, padding: 0, border: 0, borderRadius: 6, cursor: 'pointer', flexShrink: 0,
        background: hover ? hoverBg(theme) : 'transparent',
        color: activo ? (theme?.yellow || '#FFCC00') : (theme?.textSubtle || theme?.textMuted),
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        opacity: activo || hover ? 1 : 0.55, transition: `opacity ${DUR.state}ms ${EASE}, background ${DUR.state}ms ${EASE}`,
        ...style,
      }}>
      <Star size={size} strokeWidth={2} fill={activo ? 'currentColor' : 'none'} />
    </span>
  );
}

/** Punto de color del cliente. */
export function PuntoCliente({ color, size = 8, activo = false, style }) {
  return (
    <span aria-hidden style={{
      width: size, height: size, borderRadius: 999, background: color, flexShrink: 0, display: 'inline-block',
      boxShadow: activo ? `0 0 0 3px ${color}33` : 'none', transition: `box-shadow ${DUR.state}ms ${EASE}`, ...style,
    }} />
  );
}

/** Icono de app (modo iPhone): cuadrado 44 radio 11 con el icono en blanco. */
export function IconoApp({ icon: Icon, color, size = 44, radius = 11, style }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0,
      background: `linear-gradient(160deg, ${color} 0%, ${color}CC 100%)`,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#FFF',
      boxShadow: 'inset 0 0 0 0.5px rgba(255,255,255,0.18), 0 1px 2px rgba(0,0,0,0.12)', ...style,
    }}>
      {Icon && <Icon size={Math.round(size * 0.48)} strokeWidth={2} />}
    </span>
  );
}

/** Overlay oscuro con fade; cierra al clic. */
export function Overlay({ abierto, onClose, zIndex = 60, children, alinear = 'flex-end' }) {
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
        position: 'fixed', inset: 0, zIndex, display: 'flex', alignItems: alinear, justifyContent: 'center',
        background: abierto ? 'rgba(0,0,0,0.32)' : 'rgba(0,0,0,0)', transition: `background ${DUR.page}ms ${EASE}`,
      }}>
      {children}
    </div>
  );
}

/** Hoja que sube desde abajo (340 ms) · modo iPhone. */
export function Hoja({ abierto, onClose, titulo, children, alto = '78vh', theme, zIndex = 60, acciones }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // setTimeout en vez de rAF: rAF no dispara con la pestaña oculta y la hoja se quedaría abajo.
    if (abierto) { const t = setTimeout(() => setVisible(true), 16); return () => clearTimeout(t); }
    setVisible(false);
  }, [abierto]);
  const dark = esMidnight(theme);
  return (
    <Overlay abierto={abierto} onClose={onClose} zIndex={zIndex}>
      <div role="dialog" aria-modal="true" style={{
        width: 'min(100%, 640px)', maxHeight: alto, display: 'flex', flexDirection: 'column',
        background: dark ? 'rgba(28,28,30,0.96)' : esMarfil(theme) ? 'rgba(250,247,241,0.97)' : 'rgba(248,248,250,0.97)',
        backdropFilter: 'saturate(180%) blur(30px)', WebkitBackdropFilter: 'saturate(180%) blur(30px)',
        borderRadius: '18px 18px 0 0', border: bordeFlotante(theme), borderBottom: 0,
        boxShadow: elevation(theme, 'flotante'),
        transform: visible ? 'translateY(0)' : 'translateY(100%)', transition: `transform ${DUR.page}ms ${EASE}`,
        paddingBottom: 'env(safe-area-inset-bottom)', fontFamily: TYPO.fontText, color: theme?.text,
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 2px' }}>
          <span style={{ width: 36, height: 5, borderRadius: 999, background: dark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)' }} />
        </div>
        {(titulo || acciones) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 18px 10px' }}>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em' }}>{titulo}</div>
            <div style={{ display: 'flex', gap: 6 }}>{acciones}</div>
          </div>
        )}
        <div style={{ overflowY: 'auto', padding: '0 12px 16px', WebkitOverflowScrolling: 'touch' }}>{children}</div>
      </div>
    </Overlay>
  );
}

/** Título de sección en versalitas (9.5 / 600 / .09em). */
export function TituloSeccion({ theme, children, style }) {
  return (
    <div style={{
      fontFamily: TYPO.fontText, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase',
      color: theme?.textSubtle || theme?.textMuted, padding: '12px 10px 5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...style,
    }}>{children}</div>
  );
}

/** Fila de lista estilo Ajustes (icono de color · texto · dato · chevron). */
export function FilaAjustes({ theme, icon, color, label, sub, dato, trailing, onClick, activo, disabled, primera, ultima }) {
  const [hover, setHover] = useState(false);
  return (
    <button type="button" onClick={disabled ? undefined : onClick} disabled={disabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 44, padding: '6px 12px', border: 0,
        background: activo ? `${theme?.accent}14` : hover && !disabled ? hoverBg(theme) : 'transparent',
        borderTop: primera ? 0 : `1px solid ${hairline(theme)}`,
        borderRadius: primera && ultima ? 12 : primera ? '12px 12px 0 0' : ultima ? '0 0 12px 12px' : 0,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1, textAlign: 'left', color: theme?.text, fontFamily: TYPO.fontText,
      }}>
      <IconoApp icon={icon} color={color} size={30} radius={8} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: activo ? 600 : 500, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        {sub && <span style={{ display: 'block', fontSize: 11.5, color: theme?.textMuted, marginTop: 1 }}>{sub}</span>}
      </span>
      {dato != null && <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 12, color: theme?.textMuted, fontVariantNumeric: 'tabular-nums' }}>{dato}</span>}
      {trailing}
    </button>
  );
}
