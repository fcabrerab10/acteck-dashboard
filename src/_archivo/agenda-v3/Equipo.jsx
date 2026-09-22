// Agenda · panel Equipo: pendientes por persona con vencidas (clic filtra la lista por esa persona).
import React from 'react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { Panel, Pill } from '../../components/kit';
import { Avatar } from './comun';

export default function Equipo({ equipoRes, filtros, setFiltros, style }) {
  const { theme } = useTheme();
  return (
    <Panel titulo="Equipo" meta="pendientes por persona · aviso diario 08:30" style={style}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
        {equipoRes.map((e) => {
          const on = filtros.personas.has(e.user_id);
          return (
            <button key={e.user_id} type="button" onClick={() => setFiltros({ ...filtros, personas: on ? new Set() : new Set([e.user_id]) })}
              style={{ textAlign: 'left', border: `1px solid ${on ? theme.accent : theme.border}`, borderRadius: 10, padding: '8px 10px', background: on ? (theme.accentBg || 'rgba(0,122,255,0.06)') : theme.bg, cursor: 'pointer', fontFamily: TYPO.fontText, color: theme.text }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Avatar persona={e} size={20} />
                <span style={{ fontSize: 11.5, fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(e.nombre || '').split(' ')[0]}</span>
                {e.vencidas ? <Pill tone="red" size="xs">{e.vencidas} venc.</Pill> : <Pill tone="green" size="xs">al día</Pill>}
              </div>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 17, fontWeight: 600, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{e.total}</div>
              <div style={{ fontSize: 10, color: theme.textMuted }}>{e.hoy} hoy · {e.puntos} punto{e.puntos === 1 ? '' : 's'}</div>
              <div style={{ height: 4, background: `${theme.text}12`, borderRadius: 999, marginTop: 5, overflow: 'hidden' }}><i style={{ display: 'block', height: '100%', width: `${e.pct}%`, background: e.vencidas ? theme.orange : theme.accent, borderRadius: 999 }} /></div>
            </button>
          );
        })}
        {!equipoRes.length && <div style={{ fontSize: 12, color: theme.textMuted }}>Sin perfiles internos activos.</div>}
      </div>
    </Panel>
  );
}
