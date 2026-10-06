// «Su día» (2026-10-05): cómo organiza su agenda cada persona (Mi ritmo) y qué tiene para hoy. Se ve en Actividad del
// equipo (web: HojaPersona · celular: equipo/Persona). Datos: perfiles.preferencias.agenda.horas, cumplimientoAgenda().deHoy
// y agenda_registro_dia de hoy.
import React from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Pill } from '../../../components/kit';
import { resumenRitmo } from '../../agenda5/dia/ritmo';
import { fmtMin } from '../../agenda5/dia/proponer';

export function datosSuDia({ u, agenda, registrosHoy = [] }) {
  const horas = u?.preferencias?.agenda?.horas || null;
  const registro = registrosHoy.find((r) => r.usuario === u?.user_id) || null;
  const deHoy = agenda?.deHoy || [], hechas = agenda?.hechasHoy || [], vencidos = agenda?.vencidosHoy || [];
  const frase = !horas && !deHoy.length && !hechas.length ? 'Todavía no configura su ritmo ni tiene nada para hoy.'
    : `${hechas.length} hecha${hechas.length === 1 ? '' : 's'} · ${deHoy.length} por hacer${vencidos.length ? ` · ${vencidos.length} vencida${vencidos.length === 1 ? '' : 's'}` : ''}${registro?.cerrado_at ? ' · día cerrado' : ''}`;
  return { horas, registro, deHoy, hechas, vencidos, frase, ritmo: resumenRitmo(horas), plan: agenda?.minPlanHoy || 0, real: agenda?.minRealHoy || 0 };
}

const ENERGIA = { 1: '😮‍💨', 2: '😐', 3: '🙂', 4: '😄' };

/** Cuerpo compartido (sin Panel): lo envuelve cada pantalla. */
export default function SuDia({ u, agenda, registrosHoy, compacto = false }) {
  const { theme } = useTheme();
  const s = datosSuDia({ u, agenda, registrosHoy });
  const fila = (it, hecha) => (
    <div key={it.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '5px 0', borderTop: `1px solid ${theme.border}`, fontSize: compacto ? 12.5 : 12, opacity: hecha ? 0.6 : 1 }}>
      <span style={{ fontVariantNumeric: 'tabular-nums', color: theme.textMuted, width: 44, flexShrink: 0 }}>{it.hora || (hecha ? '✓' : '—')}</span>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: theme.text, textDecoration: hecha ? 'line-through' : 'none' }}>{it.titulo}</span>
      {it.duracion_min ? <span style={{ color: theme.textMuted, flexShrink: 0 }}>{it.duracion_min} min</span> : null}
    </div>
  );
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 6 }}>
        <Pill tone={s.horas ? 'blue' : 'gray'} size="xs">{s.horas ? `Ritmo ${s.ritmo}` : 'Sin ritmo configurado'}</Pill>
        {s.registro?.cerrado_at && <Pill tone="green" size="xs">Día cerrado {s.registro.energia ? ENERGIA[s.registro.energia] : ''}</Pill>}
        {s.plan > 0 && <Pill tone="gray" size="xs">Plan {fmtMin(s.plan)}{s.real ? ` · real ${fmtMin(s.real)}` : ''}</Pill>}
      </div>
      <div style={{ fontSize: 12.5, color: theme.text, fontFamily: TYPO.fontText, marginBottom: 4 }}>{s.frase}</div>
      {s.vencidos.slice(0, 3).map((it) => fila(it, false))}
      {s.deHoy.slice(0, compacto ? 6 : 10).map((it) => fila(it, false))}
      {s.hechas.slice(0, 5).map((it) => fila(it, true))}
      {s.registro?.resumen && <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 6, fontStyle: 'italic' }}>«{s.registro.resumen}»{s.registro.manana_empiezo ? ` · mañana: ${s.registro.manana_empiezo}` : ''}</div>}
    </div>
  );
}
