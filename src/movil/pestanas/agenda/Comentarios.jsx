// Agenda móvil · hilo de seguimiento de UN punto (2026-09-21).
// Mismo modelo que la web (agenda_item_comentarios + calculo.js#hiloComentarios): debajo de cada
// punto de la minuta y dentro de la hoja del ítem. Chips Seguimiento · Mejora, campo de una línea
// y envío con el botón o con Enter.
import React, { useState } from 'react';
import { CornerDownRight, Plus } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Pill, toast } from '../../piezas';
import { relativo } from '../../../lib/format';
import { TIPOS_COMENTARIO, TIPO_COMENTARIO_LABEL, TIPO_COMENTARIO_TONE } from '../../../modules/agenda/calculo';
import { crearComentario, borrarComentario } from '../../../modules/agenda/datos';
import { ChipM } from './comun';

export default function HiloM({ item, hilo = [], personasPorId, reunionId = null, puedeEditar = true, vacio = null }) {
  const { theme } = useTheme();
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState('seguimiento');
  const [busy, setBusy] = useState(false);

  const enviar = async () => {
    const t = texto.trim();
    if (!t || busy) return;
    setBusy(true);
    try { await crearComentario({ itemId: item.id, texto: t, tipo, reunionId }); setTexto(''); }
    catch (e) { toast.error(e.message); }
    setBusy(false);
  };
  const borrar = async (c) => { try { await borrarComentario(c.id); } catch (e) { toast.error(e.message); } };

  return (
    <div style={{ paddingLeft: 32, display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
      {!hilo.length && vacio && <div style={{ fontSize: 12, color: theme.textMuted }}>{vacio}</div>}
      {hilo.map((c) => (
        <div key={c.id} onDoubleClick={puedeEditar ? () => borrar(c) : undefined} style={{ fontSize: 13, color: theme.text, lineHeight: 1.35 }}>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, color: theme.textMuted, marginRight: 6 }}>
            {(personasPorId?.get(c.autor)?.nombre || 'Alguien').split(' ')[0]} · {c.created_at ? relativo(c.created_at) : ''}
          </span>
          <Pill tone={TIPO_COMENTARIO_TONE[c.tipo] || 'gray'} size="xs">{TIPO_COMENTARIO_LABEL[c.tipo] || c.tipo}</Pill>
          <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>{c.texto}</div>
        </div>
      ))}
      {puedeEditar && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <CornerDownRight size={14} style={{ color: theme.textMuted, flexShrink: 0 }} />
          <input value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); enviar(); } }}
            placeholder="Comentario de seguimiento…" aria-label="Comentario de seguimiento" enterKeyHint="send" autoCapitalize="sentences"
            style={{ flex: 1, minWidth: 0, border: `1px solid ${theme.border}`, borderRadius: 10, background: theme.surface, color: theme.text, fontFamily: TYPO.fontText, fontSize: 15, padding: '5px 10px', height: 34, outline: 'none' }} />
          {texto.trim()
            ? <button type="button" onClick={enviar} aria-label="Guardar comentario" style={{ width: 34, height: 34, borderRadius: 999, border: 0, background: theme.accent, color: '#FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}><Plus size={16} strokeWidth={2.6} /></button>
            : TIPOS_COMENTARIO.filter((t) => t.id !== 'acuerdo').map((t) => <ChipM key={t.id} on={tipo === t.id} tone={t.tone} onClick={() => setTipo(t.id)}>{t.label}</ChipM>)}
        </div>
      )}
    </div>
  );
}
