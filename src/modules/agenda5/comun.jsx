// Agenda V5 · piezas compartidas (web): fila de tarea con palomita animada, cronómetro, chips, avatar de persona.
import React, { useEffect, useState } from 'react';
import { Play, Pause, Clock } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';
import { Pill } from '../../components/kit';
import { nombreClienteAgenda } from './base/etiquetas';
import { fmtMin } from './calculo';

export const inicial = (p) => String(p?.nombre || p?.email || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();
export function Avatar({ persona, size = 24, style }) {
  const colores = ['#0A84FF,#5E5CE6', '#FF9F0A,#FF375F', '#30D158,#0A84FF', '#BF5AF2,#FF375F'];
  const i = String(persona?.user_id || '').charCodeAt(0) % colores.length || 0;
  return <span style={{ width: size, height: size, borderRadius: '50%', background: `linear-gradient(135deg, ${colores[i]})`, color: '#fff', fontSize: size * 0.4, fontWeight: 700, display: 'inline-grid', placeItems: 'center', flexShrink: 0, fontFamily: TYPO.fontDisplay, ...style }}>{inicial(persona)}</span>;
}

export function Palomita({ hecha, onClick, size = 20 }) {
  const { theme } = useTheme();
  return (
    <button type="button" aria-label={hecha ? 'Reabrir' : 'Hecha'} onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      style={{ width: size, height: size, borderRadius: '50%', border: `1.6px solid ${hecha ? theme.green : theme.textSubtle || theme.textMuted}`, background: hecha ? theme.green : 'transparent', display: 'grid', placeItems: 'center', padding: 0, cursor: 'pointer', flexShrink: 0, transition: `all ${DUR.state}ms ${EASE}`, transform: hecha ? 'scale(1.06)' : 'none' }}>
      <svg viewBox="0 0 12 12" style={{ width: size * 0.55, height: size * 0.55, stroke: '#fff', strokeWidth: 3, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', strokeDasharray: 20, strokeDashoffset: hecha ? 0 : 20, transition: `stroke-dashoffset 300ms ${EASE} 60ms` }}><path d="M2 6.5l2.6 2.6L10 3.5" /></svg>
    </button>
  );
}

export function Crono({ item, onToggle }) {
  const { theme } = useTheme();
  const [, tick] = useState(0);
  const corriendo = !!item.inicio_real;
  useEffect(() => { if (!corriendo) return undefined; const t = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(t); }, [corriendo]);
  const seg = corriendo ? Math.max(0, Math.floor((Date.now() - new Date(item.inicio_real).getTime()) / 1000)) : 0;
  const mm = String(Math.floor(seg / 60)).padStart(2, '0'), ss = String(seg % 60).padStart(2, '0');
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onToggle?.(corriendo ? 'parar' : 'iniciar'); }} title={corriendo ? 'Detener' : 'Iniciar cronómetro'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 0, background: corriendo ? `${theme.accent}18` : 'transparent', color: corriendo ? theme.accent : theme.textMuted, borderRadius: 999, padding: '2px 8px', cursor: 'pointer', fontFamily: 'SF Mono, ui-monospace, Menlo, monospace', fontSize: 11 }}>
      {corriendo ? <Pause size={11} /> : <Play size={11} />}{corriendo ? `${mm}:${ss}` : (item.min_real ? fmtMin(item.min_real) : 'iniciar')}
    </button>
  );
}

export function FilaTarea({ item, personasPorId, uid, onToggle, onAbrir, onCrono, mostrarFecha = false, compacta = false, extra = null }) {
  const { theme } = useTheme();
  const hecha = item.estado === 'hecha';
  const otros = (item.responsables || []).filter((u) => u !== uid).map((u) => personasPorId?.get(u)).filter(Boolean);
  return (
    <div onClick={() => onAbrir?.(item)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: compacta ? '6px 8px' : '8px 10px', borderRadius: 11, background: theme.surface, border: `1px solid transparent`, cursor: 'pointer', transition: `background ${DUR.state}ms ${EASE}, opacity 300ms`, opacity: hecha ? 0.6 : 1 }}
      onMouseEnter={(e) => { e.currentTarget.style.background = theme.surfaceHover || 'rgba(120,120,128,0.10)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = theme.surface; }}>
      <Palomita hecha={hecha} onClick={() => onToggle?.(item, !hecha)} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: theme.text, textDecoration: hecha ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.titulo}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, fontSize: 11, color: theme.textMuted }}>
        {extra}
        {item.cliente_key && item.cliente_key !== 'interno' && <Pill size="xs" tone="blue">{nombreClienteAgenda(item.cliente_key)}</Pill>}
        {item.prioridad === 'alta' && <Pill size="xs" tone="red">!</Pill>}
        {otros.map((p) => <Avatar key={p.user_id} persona={p} size={18} />)}
        {mostrarFecha && (item.cuando || item.fecha_limite) && <span>{item.hora ? `${item.hora} · ` : ''}{String(item.cuando || item.fecha_limite).slice(5)}</span>}
        {!mostrarFecha && item.hora && <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{item.hora}</span>}
        {item.duracion_min ? <span title="estimado"><Clock size={10} style={{ verticalAlign: -1 }} /> {fmtMin(item.duracion_min)}</span> : null}
        {onCrono && !hecha && <Crono item={item} onToggle={(acc) => onCrono(item, acc)} />}
      </span>
    </div>
  );
}

export const Titulo = ({ children, meta, acciones }) => {
  const { theme } = useTheme();
  return <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><div><div style={{ fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: theme.text }}>{children}</div>{meta && <div style={{ fontSize: 12.5, color: theme.textMuted, marginTop: 2 }}>{meta}</div>}</div>{acciones}</div>;
};
export const Seccion = ({ children, meta }) => {
  const { theme } = useTheme();
  return <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontFamily: TYPO.fontDisplay, fontSize: 10.5, letterSpacing: '0.07em', textTransform: 'uppercase', color: theme.textSubtle || theme.textMuted, fontWeight: 600, padding: '10px 4px 4px' }}><span>{children}</span>{meta && <span style={{ fontWeight: 500, letterSpacing: 0, textTransform: 'none', fontFamily: TYPO.fontText }}>{meta}</span>}</div>;
};
