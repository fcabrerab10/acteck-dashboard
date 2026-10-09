// Agenda «que te lleva» (V6 · 2026-10-08) · «Por cliente» en el celular: una lista por cliente (abiertos, acuerdos, mandados,
// vencidos, próxima reunión) que se despliega al tocar.
import React, { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Pill } from '../../../components/kit';
import { Vacio } from '../../piezas';
import { nombreClienteAgenda } from '../../../modules/agenda5/base/etiquetas';
import { porCliente, isoDe } from '../../../modules/agenda6/calculo';
import { fechaCorta } from '../../../modules/agenda6/piezas';
import { FilaM6 } from './piezasM';

export default function PorClienteM({ d, uid, propietario, personasPorId, puedeEditar, hoy, abrirItem, abrirMinuta, onNuevo }) {
  const { theme } = useTheme();
  const hoyIso = isoDe(hoy);
  const lista = useMemo(() => porCliente(d.items, d.reuniones, propietario, hoy), [d.items, d.reuniones, propietario, hoy]);
  const [abierto, setAbierto] = useState(() => new Set(lista.slice(0, 2).map((g) => g.cliente)));
  const toggle = (k) => setAbierto((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  if (lista.length === 0) return <Vacio titulo="Nada abierto con cliente" sub="Escribe el nombre del cliente al capturar («…de Digitalife») y aparecerá aquí." />;
  return (
    <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {lista.map((g) => { const on = abierto.has(g.cliente); const reunion = g.proximaReunion ? d.reuniones.find((r) => r.cliente_key === g.cliente && String(r.fecha).slice(0, 10) === g.proximaReunion) : null; return (
        <div key={g.cliente} style={{ background: theme.surface, borderRadius: 14, overflow: 'hidden' }}>
          <button type="button" onClick={() => toggle(g.cliente)} style={{ width: '100%', minHeight: 56, border: 0, background: 'transparent', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', color: theme.text, textAlign: 'left' }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontFamily: TYPO.fontDisplay, fontWeight: 700, fontSize: 16, letterSpacing: '-0.01em' }}>{nombreClienteAgenda(g.cliente)}</span>
              <span style={{ display: 'block', fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{g.items.length} abiertos{g.acuerdos ? ` · ${g.acuerdos} acuerdos` : ''}{g.mandadas ? ` · ${g.mandadas} mandados` : ''}{g.proximaReunion ? ` · reunión ${g.proximaReunion === hoyIso ? 'hoy' : fechaCorta(g.proximaReunion)}` : ''}</span>
            </span>
            {g.vencidas > 0 && <Pill size="xs" tone="red">{g.vencidas} venc.</Pill>}
            <ChevronDown size={16} style={{ color: theme.textMuted, transform: on ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }} />
          </button>
          {on && (
            <div>
              {g.items.map((it) => <FilaM6 key={it.id} item={it} uid={uid} personasPorId={personasPorId} hoyIso={hoyIso} puedeEditar={puedeEditar} onAbrir={abrirItem} mostrarFecha extra={it.reunionTitulo ? <span>minuta {fechaCorta(it.reunionFecha)}</span> : null} />)}
              <div style={{ display: 'flex', gap: 8, padding: '6px 12px 12px' }}>
                {puedeEditar && <button type="button" onClick={() => onNuevo?.(`${nombreClienteAgenda(g.cliente)}: `)} style={{ minHeight: 40, flex: 1, border: 0, borderRadius: 11, background: `${theme.accent}14`, color: theme.accent, fontFamily: TYPO.fontDisplay, fontWeight: 700, fontSize: 13 }}>+ Nuevo para {nombreClienteAgenda(g.cliente)}</button>}
                {reunion && <button type="button" onClick={() => abrirMinuta?.(reunion)} style={{ minHeight: 40, flex: 1, border: `1px solid ${theme.border}`, borderRadius: 11, background: 'transparent', color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 700, fontSize: 13 }}>Minuta {fechaCorta(g.proximaReunion)}</button>}
              </div>
            </div>
          )}
        </div>); })}
      <div style={{ height: 120 }} />
    </div>
  );
}
