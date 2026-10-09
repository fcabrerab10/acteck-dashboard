// Agenda «que te lleva» (V6 · 2026-10-08) · «Lo que mandé»: todo lo que asignaste a otros, por persona o por estado
// (vencidas · en curso · hechas en 7 días). Recordar (vuelve a avisar) · Reasignar (avatares) · Ya no.
import React, { useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { Pill, toast } from '../../components/kit';
import { Titulo, Seccion, Avatar } from '../agenda5/comun';
import { delegadas, isoDe } from './calculo';
import { actualizarRapido } from './datos';
import { FilaRapida, Accion, primerNombre } from './piezas';

export default function Mande({ d, uid, propietario, personasPorId, puedeEditar, onAbrirItem, onCapturar }) {
  const { theme } = useTheme();
  const hoy = useMemo(() => new Date(), []);
  const hoyIso = isoDe(hoy);
  const m = useMemo(() => delegadas(d.items, propietario, hoy, { personasPorId }), [d.items, propietario, hoy, personasPorId]);
  const [persona, setPersona] = useState(null);
  const filtra = (l) => (persona ? l.filter((it) => (it.responsables || []).includes(persona)) : l);
  const recordar = (it) => actualizarRapido(it.id, { notificar_a: (it.responsables || []).filter((u) => u !== uid), notificar_motivo: 'asignado' }).then(() => toast.ok(`Recordatorio enviado · ${it.titulo.slice(0, 40)}`)).catch((e) => toast.error(e.message));
  const fila = (it, extra) => <FilaRapida key={it.id} item={it} uid={uid} personasPorId={personasPorId} personas={d.personas} hoyIso={hoyIso} puedeEditar={puedeEditar} onAbrir={onAbrirItem} mostrarFecha acciones={['mandar', 'yano']}
    extra={puedeEditar && it.estado !== 'hecha' ? <Accion onClick={() => recordar(it)} title="Vuelve a avisar"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Bell size={10} />Recordar</span></Accion> : null} />;
  const grupos = [['Vencidas', m.vencidas, 'red'], ['En curso', m.enCurso, 'blue'], ['Hechas · 7 días', m.hechas, 'green']];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Titulo meta={`${m.total} abiertas${m.vencidas.length ? ` · ${m.vencidas.length} vencidas` : ''}`} acciones={puedeEditar && <Pill size="sm" tone="blue" style={{ cursor: 'pointer' }} onClick={onCapturar}>+ Mandar algo (N)</Pill>}>Lo que mandé</Titulo>
      {m.porPersona.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setPersona(null)} style={chip(theme, !persona)}>Todos</button>
          {m.porPersona.map((p) => <button key={p.persona.user_id} type="button" onClick={() => setPersona(p.persona.user_id)} style={chip(theme, persona === p.persona.user_id)}><Avatar persona={p.persona} size={18} />{primerNombre(p.persona)}<span style={{ opacity: 0.7 }}>{p.n}</span></button>)}
        </div>
      )}
      {m.total === 0 && m.hechas.length === 0 && <div style={{ padding: '26px 12px', textAlign: 'center', color: theme.textMuted, fontSize: 13 }}>No has mandado nada a nadie. En la captura escribe «Pedirle a Karolina…» o elige a quién con los avatares.</div>}
      {grupos.map(([label, l, tone]) => { const f = filtra(l); return f.length > 0 && (
        <div key={label}><Seccion meta={<Pill size="xs" tone={tone}>{f.length}</Pill>}>{label}</Seccion><div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{f.map((it) => fila(it))}</div></div>); })}
      <div style={{ fontSize: 11, color: theme.textMuted, padding: '0 4px' }}>Al mandar algo la persona recibe el aviso en su campana y en su resumen del día. «Recordar» se lo vuelve a mandar.</div>
    </div>
  );
}

const chip = (theme, on) => ({ border: `1px solid ${on ? theme.text : theme.border}`, background: on ? theme.text : theme.surface, color: on ? theme.bg : theme.text, borderRadius: 999, padding: '4px 10px 4px 6px', fontSize: 12, fontWeight: 600, fontFamily: TYPO.fontDisplay, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 });
