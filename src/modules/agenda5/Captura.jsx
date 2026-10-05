// Agenda V5 · captura rápida (⌘K / N dentro de la Agenda): un campo, chips que se pintan mientras escribes, Enter crea.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';
import { toast } from '../../components/kit';
import { interpretarCaptura } from './interpretar';
import { crearDesdeCaptura } from './datos';

const TONO = { fecha: ['rgba(10,132,255,0.14)', '#0A84FF'], hora: ['rgba(10,132,255,0.14)', '#0A84FF'], duracion: ['rgba(10,132,255,0.14)', '#0A84FF'], cliente: ['rgba(255,159,10,0.16)', '#C77700'], persona: ['rgba(191,90,242,0.16)', '#9D4EDD'], prioridad: ['rgba(255,69,58,0.14)', '#FF453A'], tipo: ['rgba(48,209,88,0.16)', '#1E9E46'], categoria: ['rgba(120,120,128,0.16)', '#6E6E73'] };

export default function Captura({ abierto, onClose, personas, propietario, hoy = new Date(), onCreado, inicial = '' }) {
  const { theme } = useTheme();
  const [texto, setTexto] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const ref = useRef(null);
  useEffect(() => { if (abierto) { setTexto(inicial); setTimeout(() => ref.current?.focus(), 30); } }, [abierto, inicial]);
  const i = useMemo(() => (texto.trim() ? interpretarCaptura(texto, personas, hoy) : null), [texto, personas, hoy]);
  if (!abierto) return null;
  const crear = async () => {
    if (!texto.trim() || guardando) return;
    setGuardando(true);
    try { const r = await crearDesdeCaptura(texto, { personas, propietario, hoy }); toast.ok(r.interpretado.bandeja ? 'Guardado en la Bandeja' : `Guardado · ${r.interpretado.chips.map((c) => c.label).join(' · ') || 'hoy'}`); onCreado?.(r); setTexto(''); onClose?.(); }
    catch (e) { toast.error(e.message || String(e)); }
    finally { setGuardando(false); }
  };
  return createPortal(
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.28)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 'min(14vh, 120px)', backdropFilter: 'blur(4px)' }}>
      <div role="dialog" aria-label="Captura rápida" style={{ width: 'min(560px, calc(100vw - 24px))', background: theme.surface, borderRadius: 14, boxShadow: '0 24px 70px rgba(0,0,0,0.28)', border: `1px solid ${theme.border}`, overflow: 'hidden', animation: `capIn ${DUR.state}ms ${EASE} both`, fontFamily: TYPO.fontText }}>
        <style>{`@keyframes capIn { from { opacity: 0; transform: translateY(-6px) scale(0.985) } to { opacity: 1; transform: none } }`}</style>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
          <Sparkles size={16} style={{ color: theme.accent, flexShrink: 0 }} />
          <input ref={ref} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Llamar a Juan mañana 10am 30m #Dicotech @karolina" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); crear(); } if (e.key === 'Escape') onClose?.(); }}
            style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', fontSize: 16, color: theme.text, fontFamily: TYPO.fontText }} />
          <kbd style={{ fontSize: 10.5, color: theme.textMuted, border: `1px solid ${theme.border}`, borderRadius: 5, padding: '1px 6px' }}>↵</kbd>
        </div>
        <div style={{ borderTop: `1px solid ${theme.border}`, padding: '10px 14px', minHeight: 44, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12, color: theme.textMuted }}>
          {!i && <span>Escribe en lenguaje natural: fecha («mañana», «lunes», «15 oct»), hora («a las 4», «10am»), duración («30m», «1h»), #cliente, @persona, p1/p2/p3, «idea:» o «nota:».</span>}
          {i && !i.chips.length && <span>Sin fecha ni hora → va a la <b style={{ color: theme.text }}>Bandeja</b>.</span>}
          {i && i.chips.map((c, k) => { const [bg, col] = TONO[c.tipo] || TONO.categoria; return <span key={k} style={{ background: bg, color: col, borderRadius: 999, padding: '3px 9px', fontSize: 11.5, fontWeight: 600, animation: `capIn 180ms ${EASE} both` }}>{c.label}</span>; })}
          {i && i.chips.length > 0 && <span style={{ marginLeft: 'auto' }}>{i.bandeja ? 'Bandeja' : i.cuando ? 'Hoy / fecha' : ''}{i.titulo ? ` · «${i.titulo.slice(0, 40)}»` : ''}</span>}
        </div>
      </div>
    </div>, document.body);
}
