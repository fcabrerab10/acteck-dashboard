// Agenda · vista Mes (rejilla 6×7) con las mismas fuentes y toggles que Semana. Clic en un día crea reunión/evento.
import React, { useMemo } from 'react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { toneColors } from '../../components/kit';
import { eventosCalendario, FUENTES_CALENDARIO, inicioSemana, sumarDias, isoDia } from './calculo';

const DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const TONE = Object.fromEntries(FUENTES_CALENDARIO.map((f) => [f.id, f.tone]));
const MAX_POR_DIA = 3;

export default function Mes({ ini, datos, toggles, hoy, onAbrir, onDia }) {
  const { theme } = useTheme();
  const primero = new Date(ini.getFullYear(), ini.getMonth(), 1);
  const desde = inicioSemana(primero);
  const celdas = useMemo(() => Array.from({ length: 42 }, (_, i) => sumarDias(desde, i)), [desde]);
  const eventos = useMemo(() => eventosCalendario(datos, isoDia(desde), isoDia(sumarDias(desde, 41)), toggles), [datos, desde, toggles]);
  const hoyIso = isoDia(hoy);
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderBottom: `1px solid ${theme.border}` }}>
        {DIAS.map((d) => <div key={d} style={{ padding: '5px 6px', textAlign: 'center', fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted }}>{d}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
        {celdas.map((dia) => {
          const iso = isoDia(dia); const evs = eventos.get(iso) || [];
          const fuera = dia.getMonth() !== ini.getMonth();
          return (
            <div key={iso} onClick={onDia ? () => onDia(dia) : undefined} style={{ minHeight: 78, borderRight: `1px solid ${theme.border}`, borderBottom: `1px solid ${theme.border}`, padding: 3, opacity: fuera ? 0.45 : 1, background: iso === hoyIso ? (theme.mode === 'dark' ? 'rgba(10,132,255,0.06)' : 'rgba(0,122,255,0.04)') : 'transparent', cursor: onDia ? 'pointer' : 'default' }}>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, color: iso === hoyIso ? theme.accent : theme.text, padding: '1px 3px' }}>{dia.getDate()}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {evs.slice(0, MAX_POR_DIA).map((ev) => { const [bg, col] = toneColors(theme, TONE[ev.fuente] || 'gray'); return <div key={ev.id} onClick={(e) => { e.stopPropagation(); onAbrir?.(ev); }} title={ev.titulo} style={{ borderRadius: 4, padding: '1px 5px', background: bg, color: col, fontSize: 9.5, fontWeight: 600, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', cursor: 'pointer' }}>{ev.hora ? `${ev.hora} ` : ''}{ev.titulo}</div>; })}
                {evs.length > MAX_POR_DIA && <div style={{ fontSize: 9.5, color: theme.textMuted, padding: '0 4px' }}>+{evs.length - MAX_POR_DIA} más</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
