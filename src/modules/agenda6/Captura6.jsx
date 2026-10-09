// Agenda «que te lleva» (V6 · 2026-10-08) · captura libre (N): escribes como hablas, sin etiquetas obligatorias. Debajo
// salen chips de lo que entendió (fecha, hora, persona, cliente…) que se quitan con ×, avatares para «Mandar a» (varios) y
// los clientes del equipo para marcar uno o dos. `#cliente` y `@persona` siguen funcionando. Enter crea · Shift+Enter renglón.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';
import { toast } from '../../components/kit';
import { CLIENTES_AGENDA } from '../agenda5/base/etiquetas';
import { interpretarLibre, isoDe as isoDia } from './calculo';
import { crearLibre } from './datos';
import { ChipsInterp, AvataresMandar } from './piezas';

/** Estado de la captura compartido por web y celular: texto → interpretación → ajustes del usuario → fila final. */
export function useCapturaLibre({ personas, hoy, uid }) {
  const [texto, setTexto] = useState('');
  const [quitados, setQuitados] = useState(() => new Set());
  const [mandarA, setMandarA] = useState(null);     // null = lo que entendió; [] = nadie extra; [...] = elegido
  const [clientesExtra, setClientesExtra] = useState([]);
  const base = useMemo(() => (texto.trim() ? interpretarLibre(texto, personas, hoy) : null), [texto, personas, hoy]);
  const i = useMemo(() => {
    if (!base) return null;
    const sinQuitados = (lista, tipo) => lista.filter((v) => !quitados.has(`${tipo}:${v}`));
    const responsables = mandarA ?? sinQuitados(base.responsables || [], 'persona');
    const clientes = Array.from(new Set([...sinQuitados(base.clientes || [], 'cliente'), ...clientesExtra]));
    const cuando = quitados.has(`fecha:${base.cuando}`) ? null : base.cuando;
    const hora = quitados.has(`hora:${base.hora}`) ? null : base.hora;
    const chips = base.chips.filter((c) => !(c.tipo === 'persona' && !responsables.includes(c.valor)) && !(c.tipo === 'cliente' && !clientes.includes(c.valor)));
    return { ...base, responsables, clientes, cliente_key: clientes[0] || 'interno', cuando, hora, chips, bandeja: false };
  }, [base, quitados, mandarA, clientesExtra]);
  const quitar = (c) => setQuitados((s) => new Set([...s, `${c.tipo}:${c.valor ?? c.label}`]));
  const reset = () => { setTexto(''); setQuitados(new Set()); setMandarA(null); setClientesExtra([]); };
  const toggleCliente = (k) => { if (i?.clientes.includes(k)) { setClientesExtra((l) => l.filter((x) => x !== k)); setQuitados((s) => new Set([...s, `cliente:${k}`])); } else { setClientesExtra((l) => [...l, k].slice(-2)); setQuitados((s) => { const n = new Set(s); n.delete(`cliente:${k}`); return n; }); } };
  const crear = async ({ propietario, extra } = {}) => {
    if (!texto.trim()) return null;
    // Sin fecha → hoy (las ideas y notas se quedan sin fecha, en Ideas).
    const esIdea = i.tipo === 'idea' || i.tipo === 'nota';
    const interp = { ...i, cuando: i.cuando || (esIdea || i.fecha_limite ? null : isoDia(hoy)), bandeja: false };
    const r = await crearLibre(texto, { personas, propietario, hoy, interp, extra });
    reset();
    return r;
  };
  return { texto, setTexto, i, quitar, quitados, mandarA, setMandarA, clientesExtra, toggleCliente, reset, crear, uid };
}

export default function Captura6({ abierto, onClose, personas, propietario, uid, hoy = new Date(), onCreado, inicial = '' }) {
  const { theme } = useTheme();
  const cap = useCapturaLibre({ personas, hoy, uid });
  const [guardando, setGuardando] = useState(false);
  const [verMandar, setVerMandar] = useState(false);
  const ref = useRef(null);
  useEffect(() => { if (abierto) { cap.reset(); if (inicial) cap.setTexto(inicial); setVerMandar(false); setTimeout(() => ref.current?.focus(), 30); } }, [abierto, inicial]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!abierto) return null;
  const crear = async () => {
    if (!cap.texto.trim() || guardando) return;
    setGuardando(true);
    try {
      const r = await cap.crear({ propietario });
      const resp = (r.interpretado.responsables || []).filter((u) => u !== uid).map((u) => personas.find((p) => p.user_id === u)?.nombre?.split(' ')[0]).filter(Boolean);
      const fecha = r.interpretado.chips.find((c) => c.tipo === 'fecha')?.label || (r.interpretado.cuando ? 'hoy' : 'sin fecha');
      toast.ok(`Guardado · ${fecha}${resp.length ? ` · mandado a ${resp.join(' y ')}` : ''}`);
      onCreado?.(r); onClose?.();
    } catch (e) { toast.error(e.message || String(e)); }
    finally { setGuardando(false); }
  };
  const i = cap.i;
  const sinFecha = i && !i.cuando && !i.fecha_limite;
  return createPortal(
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.28)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh' }}>
      <div role="dialog" aria-label="Captura" style={{ width: 'min(600px, calc(100vw - 24px))', background: theme.surface, borderRadius: 14, boxShadow: '0 24px 70px rgba(0,0,0,0.28)', border: `1px solid ${theme.border}`, overflow: 'hidden', animation: `capIn ${DUR.content}ms ${EASE} both` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px' }}>
          <Sparkles size={16} style={{ color: theme.accent, flexShrink: 0, marginTop: 4 }} />
          <textarea ref={ref} value={cap.texto} onChange={(e) => cap.setTexto(e.target.value)} rows={2} placeholder="Pedirle a Karolina los estados de cuenta de Dicotech para el lunes"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); crear(); } if (e.key === 'Escape') onClose?.(); }}
            style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', fontSize: 16, color: theme.text, fontFamily: TYPO.fontText, resize: 'none', lineHeight: 1.4 }} />
          <kbd style={{ fontSize: 10.5, color: theme.textMuted, border: `1px solid ${theme.border}`, borderRadius: 5, padding: '1px 6px', marginTop: 4 }}>↵</kbd>
        </div>
        <div style={{ borderTop: `1px solid ${theme.border}`, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: theme.textMuted }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minHeight: 24 }}>
            {!i && <span>Escribe como hablas: «Llamar a Carlos de Digitalife 11am», «Karolina: cuadrar apoyos», «mañana», «lunes», «30m». También #cliente y @persona.</span>}
            {i && <ChipsInterp chips={sinFecha ? [{ tipo: 'fecha', label: 'hoy' }, ...i.chips] : i.chips} onQuitar={(c) => { if (c.label !== 'hoy') cap.quitar(c); }} />}
          </div>
          {i && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Mandar a</span>
              <AvataresMandar key={String(verMandar)} personas={personas} uid={uid} valor={i.responsables} compacto size={24} onChange={(r) => cap.setMandarA(r.filter((u) => u !== uid))} />
              <span style={{ width: 1, height: 18, background: theme.border }} />
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Cliente</span>
              {CLIENTES_AGENDA.filter((c) => c.key !== 'interno').slice(0, 6).map((c) => { const on = i.clientes.includes(c.key); return (
                <button key={c.key} type="button" onClick={() => cap.toggleCliente(c.key)} aria-pressed={on} style={{ border: `1px solid ${on ? '#C77700' : theme.border}`, background: on ? 'rgba(255,159,10,0.16)' : 'transparent', color: on ? '#C77700' : theme.textMuted, borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{c.label}</button>); })}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{i ? `«${(i.titulo || '').slice(0, 60)}»` : ''}</span>
            <button type="button" disabled={!i || guardando} onClick={crear} style={{ marginLeft: 'auto', border: 0, borderRadius: 999, padding: '6px 14px', background: theme.accent, color: '#fff', fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', opacity: !i ? 0.5 : 1 }}>Guardar</button>
          </div>
        </div>
      </div>
    </div>, document.body);
}
