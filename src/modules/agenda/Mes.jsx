// Agenda · vista Mes (rejilla 6×7) con las mismas fuentes y toggles que Semana.
// V4 (2026-09-21): el mes es la vista principal y es interactivo — se arrastra un pendiente a otro
// día (cambia fecha_limite) y al hacer clic en un día se abre el menú Pendiente / Reunión / Viaje.
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { toneColors, EASE, DUR } from '../../components/kit';
import { eventosCalendario, FUENTES_CALENDARIO, inicioSemana, sumarDias, isoDia } from './calculo';

const DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const TONE = Object.fromEntries(FUENTES_CALENDARIO.map((f) => [f.id, f.tone]));
const MAX_POR_DIA = 4;

export default function Mes({ ini, datos, toggles, hoy, onAbrir, onDia, alto = 92, puedeEditar = false, onSoltar }) {
  const { theme } = useTheme();
  const [over, setOver] = useState(null);
  const primero = new Date(ini.getFullYear(), ini.getMonth(), 1);
  const desde = inicioSemana(primero);
  const celdas = useMemo(() => Array.from({ length: 42 }, (_, i) => sumarDias(desde, i)), [desde]);
  const eventos = useMemo(() => eventosCalendario(datos, isoDia(desde), isoDia(sumarDias(desde, 41)), toggles), [datos, desde, toggles]);
  const hoyIso = isoDia(hoy);
  const finde = (d) => d.getDay() === 0 || d.getDay() === 6;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderBottom: `1px solid ${theme.border}` }}>
        {DIAS.map((d) => <div key={d} style={{ padding: '5px 6px', textAlign: 'center', fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted }}>{d}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
        {celdas.map((dia) => {
          const iso = isoDia(dia); const evs = eventos.get(iso) || [];
          const fuera = dia.getMonth() !== ini.getMonth();
          const esHoy = iso === hoyIso;
          const fondo = over === iso ? (theme.accentBg || 'rgba(0,122,255,0.10)')
            : esHoy ? (theme.mode === 'dark' ? 'rgba(10,132,255,0.10)' : 'rgba(0,122,255,0.06)')
            : finde(dia) ? (theme.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)') : 'transparent';
          return (
            <div key={iso}
              onClick={onDia ? (e) => onDia(dia, e) : undefined}
              onDragOver={puedeEditar && onSoltar ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(iso); } : undefined}
              onDragLeave={() => setOver((o) => (o === iso ? null : o))}
              onDrop={puedeEditar && onSoltar ? (e) => { e.preventDefault(); setOver(null); onSoltar(e, dia); } : undefined}
              style={{ minHeight: alto, borderRight: `1px solid ${theme.border}`, borderBottom: `1px solid ${theme.border}`, padding: 3, opacity: fuera ? 0.4 : 1, background: fondo, cursor: onDia ? 'pointer' : 'default', transition: `background ${DUR.state}ms ${EASE}`, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 999, margin: '1px 2px 2px', fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums', background: esHoy ? theme.accent : 'transparent', color: esHoy ? '#FFF' : theme.text }}>{dia.getDate()}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {evs.slice(0, MAX_POR_DIA).map((ev) => {
                  const [bg, col] = toneColors(theme, TONE[ev.fuente] || 'gray');
                  const arrastrable = puedeEditar && ev.fuente === 'tareas';
                  return (
                    <div key={ev.id} draggable={arrastrable}
                      onDragStart={arrastrable ? (e) => { e.stopPropagation(); e.dataTransfer.setData('agenda/item', ev.ref.id); e.dataTransfer.effectAllowed = 'move'; } : undefined}
                      onClick={(e) => { e.stopPropagation(); onAbrir?.(ev); }} title={`${ev.titulo}${ev.hora ? ` · ${ev.hora}` : ''}`}
                      style={{ borderRadius: 4, padding: '1px 5px', background: bg, color: col, fontSize: 9.5, fontWeight: 600, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', cursor: arrastrable ? 'grab' : 'pointer', fontFamily: TYPO.fontText }}>
                      {ev.hora ? <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 500, marginRight: 3 }}>{ev.hora}</span> : null}{ev.titulo}
                    </div>
                  );
                })}
                {evs.length > MAX_POR_DIA && <div style={{ fontSize: 9.5, color: theme.textMuted, padding: '0 4px' }}>+{evs.length - MAX_POR_DIA} más</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
