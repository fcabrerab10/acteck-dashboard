// Lista agrupada estilo Ajustes · título de sección + contenedor con hairlines entre filas.
//   <ListaAgrupada titulo="Hoy" meta="3" pie="…">
//     <Fila icon={Wallet} color={theme.orange} titulo="…" sub="…" valor="$1.2M" pill={{tone,label}} onClick chevron />
//   </ListaAgrupada>
// FilaDeslizable: la misma fila con acciones al deslizar a la izquierda (touch): [{ label, color, icon, onClick }].
import React, { useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';
import { Pill } from '../../components/kit';
import { IconoApp } from '../../components/nav/comun';
import { MONO } from '../util';

export function TituloSeccionM({ children, meta, accion, style }) {
  const { theme } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, padding: '0 12px 6px', ...style }}>
      <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: theme.textSubtle || theme.textMuted }}>
        {children}{meta != null && <span style={{ marginLeft: 6, letterSpacing: 0, textTransform: 'none', fontFamily: MONO, fontWeight: 500 }}>{meta}</span>}
      </span>
      {accion}
    </div>
  );
}

export default function ListaAgrupada({ titulo, meta, accion, pie, children, style }) {
  const { theme } = useTheme();
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <section style={{ padding: '0 16px', ...style }}>
      {titulo && <TituloSeccionM meta={meta} accion={accion}>{titulo}</TituloSeccionM>}
      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {items.map((ch, i) => (
          <div key={ch.key ?? i} style={{ borderTop: i === 0 ? 0 : `1px solid ${theme.border}` }}>{ch}</div>
        ))}
      </div>
      {pie && <div style={{ fontSize: 11.5, color: theme.textSubtle || theme.textMuted, padding: '6px 12px 0', lineHeight: 1.4 }}>{pie}</div>}
    </section>
  );
}

export function Fila({ icon, color, avatar, titulo, sub, valor, valorSub, pill, chevron = true, onClick, trailing, alto = 52, tono, style }) {
  const { theme } = useTheme();
  const [down, setDown] = useState(false);
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick}
      onTouchStart={() => onClick && setDown(true)} onTouchEnd={() => setDown(false)} onTouchCancel={() => setDown(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: alto, padding: '8px 12px', border: 0, textAlign: 'left',
        background: down ? (theme.surfaceHover || 'rgba(0,0,0,0.03)') : 'transparent', color: theme.text, fontFamily: TYPO.fontText, cursor: onClick ? 'pointer' : 'default',
        transition: `background ${DUR.state}ms ${EASE}`, boxSizing: 'border-box', ...style,
      }}>
      {avatar}
      {icon && <IconoApp icon={icon} color={color || theme.accent} size={32} radius={8} />}
      {!icon && !avatar && tono && <span style={{ width: 8, height: 8, borderRadius: 999, background: tono, flexShrink: 0, marginLeft: 2 }} />}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titulo}</span>
        {sub != null && <span style={{ display: 'block', fontSize: 12, color: theme.textMuted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>}
      </span>
      {(valor != null || valorSub != null) && (
        <span style={{ textAlign: 'right', flexShrink: 0 }}>
          {valor != null && <span style={{ display: 'block', fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums', color: theme.text }}>{valor}</span>}
          {valorSub != null && <span style={{ display: 'block', fontSize: 11, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{valorSub}</span>}
        </span>
      )}
      {pill && <Pill tone={pill.tone || 'gray'} size="sm" style={{ flexShrink: 0 }}>{pill.label}</Pill>}
      {trailing}
      {onClick && chevron && <ChevronRight size={15} style={{ color: theme.textSubtle || theme.textMuted, flexShrink: 0, marginRight: -2 }} />}
    </Tag>
  );
}

/** Fila con acciones al deslizar a la izquierda (touch). acciones: [{ label, color, icon: Icon, onClick }]. */
export function FilaDeslizable({ acciones = [], children, saliendo = false }) {
  const { theme } = useTheme();
  const [dx, setDx] = useState(0);
  const [abierta, setAbierta] = useState(false);
  const [anim, setAnim] = useState(true);
  const inicio = useRef(null);
  const dxRef = useRef(0);
  const ponDx = (v) => { dxRef.current = v; setDx(v); };
  const ancho = acciones.length * 78;

  const onStart = (e) => { const t = e.touches[0]; inicio.current = { x: t.clientX, y: t.clientY, base: abierta ? -ancho : 0, bloqueado: null }; setAnim(false); };
  const onMove = (e) => {
    const s = inicio.current; if (!s) return;
    const t = e.touches[0]; const ddx = t.clientX - s.x, ddy = t.clientY - s.y;
    if (s.bloqueado == null) { if (Math.abs(ddx) < 6 && Math.abs(ddy) < 6) return; s.bloqueado = Math.abs(ddx) > Math.abs(ddy) ? 'x' : 'y'; }
    if (s.bloqueado !== 'x') return;
    ponDx(Math.max(-ancho - 24, Math.min(0, s.base + ddx)));
  };
  const onEnd = () => {
    const s = inicio.current; inicio.current = null; setAnim(true);
    if (!s || s.bloqueado !== 'x') return;
    const abrir = dxRef.current < -ancho / 2;
    setAbierta(abrir); ponDx(abrir ? -ancho : 0);
  };
  const cerrar = () => { setAnim(true); setAbierta(false); ponDx(0); };

  return (
    <div style={{
      position: 'relative', overflow: 'hidden', maxHeight: saliendo ? 0 : 200, opacity: saliendo ? 0 : 1,
      transition: `max-height ${DUR.content}ms ${EASE}, opacity ${DUR.exit}ms ${EASE}`,
    }}>
      <div aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, right: 0, display: 'flex' }}>
        {acciones.map((a) => {
          const Icon = a.icon;
          return (
            <button key={a.label} type="button" onClick={() => { cerrar(); a.onClick?.(); }}
              style={{ width: 78, border: 0, background: a.color, color: theme.textOnDark || '#FFF', fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer' }}>
              {Icon && <Icon size={16} strokeWidth={2.2} />}{a.label}
            </button>
          );
        })}
      </div>
      <div onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd} onTouchCancel={onEnd} onClick={abierta ? (e) => { e.stopPropagation(); cerrar(); } : undefined}
        style={{ position: 'relative', background: theme.surface, transform: `translateX(${dx}px)`, transition: anim ? `transform ${DUR.content}ms ${EASE}` : 'none' }}>
        {children}
      </div>
    </div>
  );
}
