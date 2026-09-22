// Agenda web · hilo de seguimiento de UN punto (2026-09-21).
// Fernando: «abajo de cada punto ir poniendo los comentarios (seguimiento o mejora) para que no se
// pierda nada». Lo usan la Minuta (debajo de cada punto) y HojaItem (sección «Seguimiento», con el
// hilo completo aunque el punto venga arrastrado de reuniones anteriores).
//
//   <Hilo item={punto} hilo={hiloComentarios(comentarios, punto, porId)} personasPorId
//         reunionId={reunion.id} puedeEditar onNavegar />
//
// El hilo llega ya calculado (calculo.js#hiloComentarios) para que la misma lista sirva en el móvil.
import React, { useState } from 'react';
import { Trash2, CornerDownRight } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { Pill, toast } from '../../components/kit';
import { relativo } from '../../lib/format';
import { TIPOS_COMENTARIO, TIPO_COMENTARIO_LABEL, TIPO_COMENTARIO_TONE, fmtCorta, isoDia } from './calculo';
import { crearComentario, borrarComentario } from './datos';
import { Avatar } from './comun';

export default function Hilo({ item, hilo = [], personasPorId, reunionId = null, puedeEditar = true, compacto = false, vacio = null }) {
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
    <div style={{ paddingLeft: compacto ? 20 : 0, marginTop: compacto ? 2 : 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {!hilo.length && vacio && <div style={{ fontSize: 11, color: theme.textMuted }}>{vacio}</div>}
      {hilo.map((c) => (
        <Comentario key={c.id} c={c} theme={theme} persona={personasPorId?.get(c.autor)} puedeEditar={puedeEditar} onBorrar={() => borrar(c)} />
      ))}
      {puedeEditar && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
          <CornerDownRight size={12} style={{ color: theme.textMuted, flexShrink: 0 }} />
          <input value={texto} onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || !e.shiftKey)) { e.preventDefault(); enviar(); } }}
            placeholder="Comentario de seguimiento… (⌘↵)" aria-label="Comentario de seguimiento"
            style={{ flex: 1, minWidth: 0, border: `1px solid ${theme.border}`, borderRadius: 8, background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, fontSize: 11.5, padding: '3px 8px', outline: 'none' }} />
          {TIPOS_COMENTARIO.filter((t) => t.id !== 'acuerdo').map((t) => (
            <button key={t.id} type="button" onClick={() => setTipo(t.id)} title={`Marcar como ${t.label.toLowerCase()}`}
              style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', opacity: tipo === t.id ? 1 : 0.45 }}>
              <Pill tone={t.tone} size="xs">{t.label}</Pill>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Comentario({ c, theme, persona, puedeEditar, onBorrar }) {
  const [hover, setHover] = useState(false);
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 11.5, color: theme.text, lineHeight: 1.4 }}>
      <div style={{ paddingTop: 1 }}><Avatar persona={persona} size={16} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 10.5, color: theme.textMuted, marginRight: 6 }}>
          {(persona?.nombre || 'Alguien').split(' ')[0]} · {c.created_at ? relativo(c.created_at) : ''}
        </span>
        <Pill tone={TIPO_COMENTARIO_TONE[c.tipo] || 'gray'} size="xs">{TIPO_COMENTARIO_LABEL[c.tipo] || c.tipo}</Pill>
        {c.deOtraReunion && <Pill tone="gray" size="xs" title="Se escribió en una reunión anterior">{c.created_at ? fmtCorta(isoDia(new Date(c.created_at))) : 'antes'}</Pill>}
        <div style={{ marginTop: 1, whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>{c.texto}</div>
      </div>
      {puedeEditar && (
        <button type="button" onClick={onBorrar} title="Borrar comentario"
          style={{ border: 0, background: 'transparent', color: theme.textMuted, cursor: 'pointer', opacity: hover ? 1 : 0, padding: 2, display: 'inline-flex', flexShrink: 0 }}><Trash2 size={11} /></button>
      )}
    </div>
  );
}
