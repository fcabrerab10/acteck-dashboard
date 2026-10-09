// Agenda «que te lleva» (V6 · 2026-10-08) · «Lo que mandé» en el celular: chips por persona, vencidas · en curso · hechas,
// deslizar ← Recordar, tocar abre; Reasignar desde la hoja del ítem.
import React, { useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { toast } from '../../../components/kit';
import { ListaAgrupada, Vacio, FilaDeslizable } from '../../piezas';
import { Avatar } from '../../../modules/agenda5/comun';
import { delegadas, isoDe } from '../../../modules/agenda6/calculo';
import { actualizarRapido } from '../../../modules/agenda6/datos';
import { primerNombre } from '../../../modules/agenda6/piezas';
import { FilaM6 } from './piezasM';

export default function MandeM({ d, uid, propietario, personasPorId, puedeEditar, hoy, abrirItem }) {
  const { theme } = useTheme();
  const hoyIso = isoDe(hoy);
  const m = useMemo(() => delegadas(d.items, propietario, hoy, { personasPorId }), [d.items, propietario, hoy, personasPorId]);
  const [persona, setPersona] = useState(null);
  const filtra = (l) => (persona ? l.filter((it) => (it.responsables || []).includes(persona)) : l);
  const recordar = (it) => actualizarRapido(it.id, { notificar_a: (it.responsables || []).filter((u) => u !== uid), notificar_motivo: 'asignado' }).then(() => toast.ok('Recordatorio enviado')).catch((e) => toast.error(e.message));
  const chip = (on) => ({ border: 0, borderRadius: 999, padding: '7px 12px 7px 8px', minHeight: 36, fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', background: on ? theme.text : theme.surface, color: on ? theme.bg : theme.text, display: 'inline-flex', alignItems: 'center', gap: 6 });
  const fila = (it) => { const f = <FilaM6 key={it.id} item={it} uid={uid} personasPorId={personasPorId} hoyIso={hoyIso} puedeEditar={puedeEditar} onAbrir={abrirItem} mostrarFecha gestos={false} />; return puedeEditar && it.estado !== 'hecha' ? <FilaDeslizable key={it.id} acciones={[{ label: 'Recordar', icon: Bell, color: theme.accent, onClick: () => recordar(it) }]}>{f}</FilaDeslizable> : f; };
  return (
    <>
      {m.porPersona.length > 0 && (
        <div style={{ display: 'flex', gap: 6, padding: '0 16px 10px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          <button type="button" onClick={() => setPersona(null)} style={chip(!persona)}>Todos</button>
          {m.porPersona.map((p) => <button key={p.persona.user_id} type="button" onClick={() => setPersona(p.persona.user_id)} style={chip(persona === p.persona.user_id)}><Avatar persona={p.persona} size={20} />{primerNombre(p.persona)} · {p.n}</button>)}
        </div>
      )}
      {m.total === 0 && m.hechas.length === 0 && <Vacio titulo="No has mandado nada" sub="En «Nuevo» escribe «Pedirle a Karolina…» o elige a quién con los avatares." />}
      {[['Vencidas', m.vencidas], ['En curso', m.enCurso], ['Hechas · 7 días', m.hechas]].map(([t, l]) => { const f = filtra(l); return f.length > 0 && <ListaAgrupada key={t} titulo={t} meta={`${f.length}`} style={{ marginTop: 10 }}>{f.map(fila)}</ListaAgrupada>; })}
      <div style={{ padding: '10px 16px 0', fontSize: 11.5, color: theme.textMuted }}>Desliza ← para volver a avisar. Para reasignar, abre el pendiente.</div>
      <div style={{ height: 120 }} />
    </>
  );
}
