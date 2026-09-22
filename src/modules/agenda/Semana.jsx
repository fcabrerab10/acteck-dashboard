// Agenda · rejilla de la Semana (L–V / L–D). Desde V4 ya no trae Panel, navegación ni toggles:
// de eso se encarga Calendario.jsx, que la monta cuando la vista es "Semana" y le pasa `ini`,
// `datos`, `toggles` y los manejadores. Se arrastra un pendiente a otro día y el encabezado de
// cada día abre el menú Pendiente / Reunión / Viaje.
import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { Pill, toneColors, EASE, DUR } from '../../components/kit';
import { eventosCalendario, FUENTES_CALENDARIO, sumarDias, isoDia } from './calculo';
import { EnlaceExterno } from './comun';

const DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const TONE = Object.fromEntries(FUENTES_CALENDARIO.map((f) => [f.id, f.tone]));

export default function Semana({ ini, datos, toggles, hoy, onAbrir, onSoltar, onDia, puedeEditar, compacta = false }) {
  const { theme } = useTheme();
  const [finDeSemana, setFinDeSemana] = useState(false);
  const [dragOver, setDragOver] = useState(null);
  const nDias = finDeSemana ? 7 : 5;
  const dias = useMemo(() => Array.from({ length: nDias }, (_, i) => sumarDias(ini, i)), [ini, nDias]);
  const eventos = useMemo(() => eventosCalendario(datos, isoDia(ini), isoDia(sumarDias(ini, 6)), toggles), [datos, ini, toggles]);

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${nDias}, minmax(0, 1fr))` }}>
        {dias.map((dia) => {
          const iso = isoDia(dia); const esHoy = iso === isoDia(hoy);
          const evs = eventos.get(iso) || [];
          return (
            <div key={iso}
              onDragOver={puedeEditar && onSoltar ? (e) => { e.preventDefault(); setDragOver(iso); } : undefined}
              onDragLeave={() => setDragOver((o) => (o === iso ? null : o))}
              onDrop={puedeEditar && onSoltar ? (e) => { e.preventDefault(); setDragOver(null); onSoltar(e, dia); } : undefined}
              style={{ borderRight: `1px solid ${theme.border}`, minHeight: compacta ? 160 : 260, background: dragOver === iso ? (theme.accentBg || 'rgba(0,122,255,0.10)') : esHoy ? (theme.mode === 'dark' ? 'rgba(10,132,255,0.08)' : 'rgba(0,122,255,0.05)') : 'transparent', transition: `background ${DUR.state}ms ${EASE}`, display: 'flex', flexDirection: 'column' }}>
              <div onClick={onDia ? (e) => onDia(dia, e) : undefined} title={onDia ? 'Crear aquí' : undefined}
                style={{ padding: '6px 6px 4px', borderBottom: `1px solid ${theme.border}`, textAlign: 'center', cursor: onDia ? 'pointer' : 'default' }}>
                <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted }}>{DIAS[(dia.getDay() + 6) % 7]}</div>
                <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, color: esHoy ? theme.accent : theme.text }}>{dia.getDate()}</div>
              </div>
              <div style={{ padding: 3, display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
                {evs.map((ev) => <Evento key={ev.id} ev={ev} theme={theme} onClick={() => onAbrir?.(ev)} arrastrable={puedeEditar && ev.fuente === 'tareas'} compacta={compacta} />)}
                {onDia && !evs.length && (
                  <div onClick={(e) => onDia(dia, e)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.textSubtle || theme.textMuted, cursor: 'pointer', opacity: 0.45 }} title="Crear aquí"><Plus size={12} /></div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '5px 10px' }}>
        <Pill tone="gray" size="xs" onClick={() => setFinDeSemana((v) => !v)} style={{ cursor: 'pointer', border: `1px solid ${theme.border}` }}>{finDeSemana ? 'L–D' : 'L–V'}</Pill>
      </div>
    </>
  );
}

export function Evento({ ev, theme, onClick, arrastrable, compacta }) {
  const [bg, col] = toneColors(theme, TONE[ev.fuente] || 'gray');
  return (
    <div draggable={arrastrable} onDragStart={arrastrable ? (e) => { e.dataTransfer.setData('agenda/item', ev.ref.id); e.dataTransfer.effectAllowed = 'move'; } : undefined} onClick={onClick} title={`${ev.titulo}${ev.hora ? ` · ${ev.hora}` : ''}`}
      style={{ borderRadius: 6, padding: '2px 6px', background: bg, color: col, borderLeft: `3px solid ${col}`, fontSize: compacta ? 9.5 : 10.5, fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', cursor: arrastrable ? 'grab' : 'pointer', fontFamily: TYPO.fontText }}>
      {ev.hora && <span style={{ fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums', marginRight: 4, fontWeight: 500 }}>{ev.hora}</span>}{ev.titulo}
      {ev.fuente === 'google' && ev.url && <span style={{ marginLeft: 4 }}><EnlaceExterno href={ev.url}>Google</EnlaceExterno></span>}
    </div>
  );
}
