// Lista + detalle lado a lado (2026-11-11 · diseño B), como Mail o Notas en iPad: la lista se queda a la izquierda
// con su propio desplazamiento y el detalle cambia a la derecha sin perder de vista las demás filas.
//   items: [{ id, titulo, sub?, pill?: { l, tone } }] · activo: id · onElegir(id) · children = detalle
import React, { useEffect, useRef } from 'react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { elevation } from '../../lib/elevation';
import Pill from './Pill';

export default function ListaDetalle({ items = [], activo, onElegir, titulo, accionLista, anchoLista = 264, children }) {
  const { theme } = useTheme();
  const refActivo = useRef(null);
  useEffect(() => { refActivo.current?.scrollIntoView?.({ block: 'nearest' }); }, [activo]);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `${anchoLista}px minmax(0, 1fr)`, gap: 12, alignItems: 'start', fontFamily: TYPO.fontText }}>
      <aside style={{ position: 'sticky', top: 8, maxHeight: 'calc(100dvh - 110px)', display: 'flex', flexDirection: 'column', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, boxShadow: elevation(theme, 'tarjeta'), overflow: 'hidden' }}>
        {(titulo || accionLista) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 12px 8px', borderBottom: `1px solid ${theme.border}` }}>
            <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, color: theme.text }}>{titulo}</span>{accionLista}
          </div>
        )}
        <div style={{ overflowY: 'auto', padding: 6, WebkitOverflowScrolling: 'touch' }}>
          {items.map((it) => {
            const on = it.id === activo;
            return (
              <button key={it.id} ref={on ? refActivo : undefined} type="button" onClick={() => onElegir?.(it.id)}
                style={{ width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '7px 10px', border: 0, borderRadius: 11, cursor: 'pointer', textAlign: 'left',
                  background: on ? `${theme.accent}22` : 'transparent', color: theme.text, fontFamily: TYPO.fontText }}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 12.5, fontWeight: on ? 600 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.titulo}</span>
                  {it.sub && <span style={{ display: 'block', fontSize: 10.5, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.sub}</span>}
                </span>
                {it.pill && <Pill tone={it.pill.tone} size="xs">{it.pill.l}</Pill>}
              </button>
            );
          })}
        </div>
      </aside>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}
