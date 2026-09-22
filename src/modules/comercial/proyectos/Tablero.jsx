// Tablero: una columna por mes del horizonte (+ "Más adelante") con las tarjetas de
// proyecto dentro. Se arrastra una tarjeta a otra columna para cambiarle el mes objetivo.
import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { EASE, DUR } from '../../../lib/motion';
import { int } from '../../../lib/format';
import TarjetaProyecto from './TarjetaProyecto';

export default function Tablero({ columnas, onAbrir, onMoverAMes, onMoverRelativo, onNuevo, puedeEditar }) {
  const { theme } = useTheme();
  const [sobre, setSobre] = useState(null);

  const soltar = (col) => (e) => {
    e.preventDefault();
    setSobre(null);
    if (!puedeEditar || !col.anio) return;
    const id = e.dataTransfer.getData('text/plain');
    if (id) onMoverAMes?.(id, col.anio, col.mes);
  };

  return (
    <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(210px, 1fr)', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
      {columnas.map((col) => {
        const activa = sobre === col.clave;
        return (
          <section key={col.clave}
            onDragOver={(e) => { if (puedeEditar && col.anio) { e.preventDefault(); setSobre(col.clave); } }}
            onDragLeave={() => setSobre((s) => (s === col.clave ? null : s))}
            onDrop={soltar(col)}
            style={{
              background: activa ? (theme.surfaceHover || 'rgba(0,122,255,0.06)') : theme.surface,
              border: `1px solid ${activa ? (theme.accent || '#007AFF') : theme.border}`,
              borderRadius: 12, padding: 8, minHeight: 190, display: 'flex', flexDirection: 'column', gap: 8,
              transition: `background ${DUR.state}ms ${EASE}, border-color ${DUR.state}ms ${EASE}`,
            }}>
            <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6, padding: '2px 4px' }}>
              <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, letterSpacing: '-0.01em', color: theme.text }}>{col.label}</span>
              <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                {col.proyectos.length ? `${col.proyectos.length} · ${int(col.piezas)} pz` : '—'}
              </span>
            </header>

            {col.proyectos.map((p) => (
              <TarjetaProyecto key={p.id} proyecto={p} onAbrir={onAbrir}
                arrastrable={puedeEditar}
                onMover={puedeEditar ? onMoverRelativo : null} />
            ))}

            {puedeEditar && col.anio && (
              <button type="button" onClick={() => onNuevo?.(col.anio, col.mes)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, width: '100%', padding: '7px 0',
                  border: `1px dashed ${theme.border}`, borderRadius: 10, background: 'transparent', color: theme.textMuted,
                  fontFamily: TYPO.fontText, fontSize: 11.5, cursor: 'pointer',
                }}>
                <Plus size={12} /> Proyecto
              </button>
            )}
            {!col.proyectos.length && !puedeEditar && (
              <div style={{ fontSize: 11, color: theme.textSubtle || theme.textMuted, padding: '10px 4px' }}>Sin proyectos.</div>
            )}
          </section>
        );
      })}
    </div>
  );
}
