// Agenda «que te lleva» (V6 · 2026-10-08) · «Por cliente»: lo abierto de cada cliente en un solo lugar — tareas con el
// chip (principal o adicional), acuerdos de minutas, lo que mandaste — con la próxima reunión y lo vencido.
import React, { useMemo, useState } from 'react';
import { ChevronDown, Users } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { Pill } from '../../components/kit';
import { Titulo } from '../agenda5/comun';
import { nombreClienteAgenda } from '../agenda5/base/etiquetas';
import { porCliente, isoDe } from './calculo';
import { FilaRapida, fechaCorta } from './piezas';

export default function PorCliente({ d, uid, propietario, personasPorId, puedeEditar, onAbrirItem, onCapturar, onAbrirReunion }) {
  const { theme } = useTheme();
  const hoy = useMemo(() => new Date(), []);
  const hoyIso = isoDe(hoy);
  const lista = useMemo(() => porCliente(d.items, d.reuniones, propietario, hoy), [d.items, d.reuniones, propietario, hoy]);
  const [abierto, setAbierto] = useState(() => new Set(lista.slice(0, 3).map((g) => g.cliente)));
  const toggle = (k) => setAbierto((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const total = lista.reduce((s, g) => s + g.items.length, 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Titulo meta={`${lista.length} clientes · ${total} abiertos`}>Por cliente</Titulo>
      {lista.length === 0 && <div style={{ padding: '26px 12px', textAlign: 'center', color: theme.textMuted, fontSize: 13 }}>Nada abierto con cliente. Escribe el nombre del cliente en la captura («…de Digitalife») y aparecerá aquí.</div>}
      {lista.map((g) => { const on = abierto.has(g.cliente); const reunion = g.proximaReunion ? d.reuniones.find((r) => r.cliente_key === g.cliente && String(r.fecha).slice(0, 10) === g.proximaReunion) : null; return (
        <div key={g.cliente} style={{ border: `1px solid ${theme.border}`, borderRadius: 12, background: theme.surface, overflow: 'hidden' }}>
          <button type="button" onClick={() => toggle(g.cliente)} style={{ width: '100%', border: 0, background: 'transparent', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer', color: theme.text, textAlign: 'left' }}>
            <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 700, fontSize: 14.5, letterSpacing: '-0.01em' }}>{nombreClienteAgenda(g.cliente)}</span>
            <span style={{ fontSize: 11.5, color: theme.textMuted }}>{g.items.length} abiertos{g.acuerdos ? ` · ${g.acuerdos} acuerdos` : ''}{g.mandadas ? ` · ${g.mandadas} mandados` : ''}</span>
            {g.vencidas > 0 && <Pill size="xs" tone="red">{g.vencidas} vencid{g.vencidas === 1 ? 'o' : 'os'}</Pill>}
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: theme.textMuted }}>
              {g.proximaReunion && <span onClick={(e) => { if (reunion) { e.stopPropagation(); onAbrirReunion?.(reunion); } }} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: theme.accent, fontWeight: 600 }}><Users size={12} />Reunión {g.proximaReunion === hoyIso ? 'hoy' : fechaCorta(g.proximaReunion)}</span>}
              <ChevronDown size={14} style={{ transform: on ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }} />
            </span>
          </button>
          {on && (
            <div style={{ padding: '0 6px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {g.items.map((it) => <FilaRapida key={it.id} item={it} uid={uid} personasPorId={personasPorId} personas={d.personas} hoyIso={hoyIso} puedeEditar={puedeEditar} onAbrir={onAbrirItem} mostrarFecha compacta
                extra={it.reunionTitulo ? <span title={it.reunionTitulo} style={{ color: theme.textMuted }}>minuta {fechaCorta(it.reunionFecha)}</span> : null} />)}
              {puedeEditar && <button type="button" onClick={() => onCapturar?.(`${nombreClienteAgenda(g.cliente)}: `)} style={{ border: 0, background: 'transparent', color: theme.accent, fontSize: 12, fontWeight: 600, textAlign: 'left', padding: '6px 10px', cursor: 'pointer', fontFamily: TYPO.fontDisplay }}>+ Nuevo para {nombreClienteAgenda(g.cliente)}</button>}
            </div>
          )}
        </div>); })}
    </div>
  );
}
