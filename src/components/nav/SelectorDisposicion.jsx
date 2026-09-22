// Selector de disposición de paneles · pictogramas de cada layout con su nombre.
// Lo comparten el control "Paneles" de la barra superior y Preferencias → Apariencia,
// para que no haya dos selectores que se puedan desincronizar.
//
//   <SelectorDisposicion valor="dos" onElegir={(id) => …} ancho={2560} alto={1440} />
import React from 'react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { disposicionesDisponibles, rectosDisposicion } from '../../lib/dispositivo';

/** Pictograma: cajitas con la forma real de la rejilla (16:10, como un monitor). */
export function Pictograma({ id, color, colorPrincipal, tam = 40 }) {
  const w = tam;
  const h = Math.round(tam * 0.62);
  const g = 2; // separación entre cajitas
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" style={{ display: 'block' }}>
      {rectosDisposicion(id).map((r, i) => (
        <rect
          key={i}
          x={r.x * w + g / 2}
          y={r.y * h + g / 2}
          width={Math.max(1, r.w * w - g)}
          height={Math.max(1, r.h * h - g)}
          rx={2.5}
          fill={i === 0 ? colorPrincipal : 'none'}
          stroke={i === 0 ? colorPrincipal : color}
          strokeWidth={1.2}
          opacity={i === 0 ? 0.9 : 0.75}
        />
      ))}
    </svg>
  );
}

export default function SelectorDisposicion({ valor, onElegir, ancho, alto, compacto = false }) {
  const { theme } = useTheme();
  const opciones = disposicionesDisponibles({ ancho, alto });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
      {opciones.map((d) => {
        const on = d.id === valor;
        const bloqueada = !d.disponible;
        return (
          <button
            key={d.id}
            type="button"
            disabled={bloqueada}
            aria-pressed={on}
            onClick={() => !bloqueada && onElegir?.(d.id)}
            title={bloqueada ? `${d.nombre} · ${d.razon}` : `${d.nombre} · ${d.descripcion}`}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: compacto ? '6px 3px 5px' : '8px 4px 6px', borderRadius: 10,
              border: `1px solid ${on ? theme.accent : theme.border}`,
              background: on ? `${theme.accent}14` : 'transparent',
              color: bloqueada ? theme.textMuted : on ? theme.accent : theme.text,
              opacity: bloqueada ? 0.4 : 1,
              cursor: bloqueada ? 'not-allowed' : 'pointer',
            }}
          >
            <Pictograma
              id={d.id}
              tam={compacto ? 34 : 40}
              color={bloqueada ? theme.textMuted : on ? theme.accent : theme.textMuted}
              colorPrincipal={bloqueada ? theme.textMuted : on ? theme.accent : theme.text}
            />
            <span style={{
              fontFamily: TYPO.fontText, fontSize: 9.5, lineHeight: 1.15, textAlign: 'center',
              letterSpacing: '-0.01em',
            }}>
              {d.nombre}
            </span>
          </button>
        );
      })}
    </div>
  );
}
