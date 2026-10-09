// Agenda «que te lleva» (V6 · 2026-10-08) · piezas táctiles: fila con palomita de 44 px, un toque abre, deslizar → hecha /
// ← mañana (opcional), y el toast con Deshacer de accionItem. Todo optimista: pinta al instante y guarda atrás.
import React from 'react';
import { Check, CalendarClock, Send } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Pill } from '../../../components/kit';
import { Avatar } from '../../../modules/agenda5/comun';
import { nombreClienteAgenda } from '../../../modules/agenda5/base/etiquetas';
import { accionItem } from '../../../modules/agenda6/datos';
import { fechaCorta } from '../../../modules/agenda6/piezas';
import { FilaGesto, PalomitaM } from '../agenda5/comun';

export function FilaM6({ item, uid, personasPorId, hoyIso, puedeEditar, onAbrir, mostrarFecha = false, gestos = true, izquierda = 'manana', extra = null }) {
  const { theme } = useTheme();
  const hecha = item.estado === 'hecha';
  const otros = (item.responsables || []).filter((u) => u !== uid).map((u) => personasPorId?.get(u)).filter(Boolean);
  const fecha = item.cuando || item.fecha_limite || null;
  const vencida = !hecha && fecha && hoyIso && fecha < hoyIso;
  const act = (a, o) => accionItem(item, a, { hoyIso, ...(o || {}) }).catch(() => {});
  const fila = (
    <div onClick={() => onAbrir?.(item)} role="button" style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 56, padding: '6px 12px 6px 8px', background: theme.surface, opacity: hecha ? 0.6 : 1 }}>
      <span style={{ width: 44, height: 44, display: 'grid', placeItems: 'center', flexShrink: 0 }}><PalomitaM hecha={hecha} size={26} disabled={!puedeEditar} onClick={() => act(hecha ? 'reabrir' : 'hecha')} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.25, color: theme.text, textDecoration: hecha ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.titulo}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, fontSize: 12, color: theme.textMuted, overflow: 'hidden' }}>
          {item.hora && <b style={{ fontFamily: TYPO.fontDisplay, color: theme.text }}>{item.hora}</b>}
          {item.cliente_key && item.cliente_key !== 'interno' && <span style={{ color: '#C77700', fontWeight: 600 }}>{nombreClienteAgenda(item.cliente_key)}</span>}
          {(item.clientes || []).map((c) => <span key={c} style={{ color: '#C77700', fontWeight: 600 }}>{nombreClienteAgenda(c)}</span>)}
          {otros.length > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Send size={10} />{otros.map((p) => <Avatar key={p.user_id} persona={p} size={16} />)}</span>}
          {mostrarFecha && fecha && <span style={{ color: vencida ? theme.red : theme.textMuted, fontWeight: vencida ? 600 : 400 }}>{vencida ? 'venció ' : ''}{fechaCorta(fecha)}</span>}
          {item.prioridad === 'alta' && !hecha && <Pill size="xs" tone="red">!</Pill>}
          {extra}
        </span>
      </span>
    </div>
  );
  if (!gestos || !puedeEditar || hecha) return fila;
  const izq = izquierda === 'hoy' ? { label: 'Hoy', fn: () => act('hoy'), icon: CalendarClock } : { label: 'Mañana', fn: () => act('manana'), icon: CalendarClock };
  return <FilaGesto onDerecha={() => act('hecha')} onIzquierda={izq.fn} labelDerecha="Hecha" labelIzquierda={izq.label} iconoDerecha={Check} iconoIzquierda={izq.icon}>{fila}</FilaGesto>;
}

/** Botones de acción grandes en una fila (44 px): Hoy · Semana · Ya no, etc. */
export function AccionesM({ acciones = [] }) {
  const { theme } = useTheme();
  return (
    <div style={{ display: 'flex', gap: 6, padding: '0 12px 8px 62px' }}>
      {acciones.map((a) => <button key={a.label} type="button" onClick={(e) => { e.stopPropagation(); a.onClick?.(); }} style={{ flex: 1, minHeight: 40, border: `1px solid ${a.tone === 'red' ? theme.red : a.tone === 'blue' ? theme.accent : theme.border}`, borderRadius: 11, background: a.tone === 'blue' ? theme.accent : theme.surface, color: a.tone === 'blue' ? '#fff' : a.tone === 'red' ? theme.red : theme.text, fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{a.label}</button>)}
    </div>
  );
}
