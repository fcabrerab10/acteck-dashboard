// Matriz SKU × mes: un renglón por SKU con demanda de proyectos y una celda por mes del
// horizonte, coloreada por cobertura (verde cubierto · naranja justo · rojo falta).
// El selector de medida cambia lo que dice el número, no el color: el color siempre
// cuenta la misma historia (¿alcanza para ese mes?).
import React from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { EASE, DUR } from '../../../lib/motion';
import { int } from '../../../lib/format';
import { TONOS } from './textos';

const FONDO = {
  verde:   (t) => (t.mode === 'dark' ? 'rgba(48,209,88,0.16)' : 'rgba(52,199,89,0.13)'),
  naranja: (t) => (t.mode === 'dark' ? 'rgba(255,159,10,0.18)' : 'rgba(255,149,0,0.16)'),
  rojo:    (t) => (t.mode === 'dark' ? 'rgba(255,69,58,0.18)' : 'rgba(255,59,48,0.13)'),
};
const TINTA = {
  verde:   (t) => (t.mode === 'dark' ? '#30D158' : '#1F7A3D'),
  naranja: (t) => (t.mode === 'dark' ? '#FF9F0A' : '#9A5500'),
  rojo:    (t) => (t.mode === 'dark' ? '#FF6961' : '#B00020'),
};

export default function MatrizSkuMes({ filas, horizonte, medida = 'necesidad', onAbrirSku }) {
  const { theme } = useTheme();
  const hair = `1px solid ${theme.border}`;
  const th = { padding: '6px 8px', fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.textMuted, borderBottom: hair, position: 'sticky', top: 0, background: theme.surface, zIndex: 1, whiteSpace: 'nowrap' };

  if (!filas.length) {
    return <div style={{ padding: '26px 12px', textAlign: 'center', color: theme.textMuted, fontFamily: TYPO.fontText, fontSize: 12 }}>Ningún SKU con demanda de proyectos en estos seis meses.</div>;
  }

  return (
    <div style={{ overflow: 'auto', maxHeight: 520, borderRadius: 10, border: hair, background: theme.surface }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'left', left: 0, zIndex: 2 }}>SKU</th>
            {horizonte.map((m) => <th key={m.clave} style={{ ...th, textAlign: 'right' }}>{m.label}</th>)}
            <th style={{ ...th, textAlign: 'right' }}>Total</th>
            <th style={{ ...th, textAlign: 'right' }}>Falta</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((r) => (
            <tr key={r.sku} onClick={() => onAbrirSku?.(r.sku)} style={{ cursor: 'pointer' }}>
              <td style={{ padding: '4px 8px', borderBottom: hair, maxWidth: 260 }}>
                <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, color: theme.text }}>{r.sku}</div>
                {r.descripcion && <div style={{ fontFamily: TYPO.fontText, fontSize: 10, color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.descripcion}</div>}
              </td>
              {horizonte.map((m) => {
                const c = r.celdas[m.clave];
                const v = r[m.clave];
                if (!c || v == null || (medida !== 'necesidad' && !v)) {
                  return <td key={m.clave} style={{ padding: '4px 8px', borderBottom: hair, textAlign: 'right', color: theme.textSubtle || theme.textMuted, fontFamily: TYPO.fontDisplay, fontSize: 11 }}>{c ? '0' : '—'}</td>;
                }
                const titulo = `${m.labelLargo || m.label} · necesidad ${int(c.necesidad)} pz · disponible ${int(c.disponible)} · tránsito a tiempo ${int(c.transitoAntes)}${c.faltante ? ` · faltan ${int(c.faltante)}` : ''} — ${TONOS[c.tono]?.label}`;
                return (
                  <td key={m.clave} title={titulo}
                    style={{
                      padding: '4px 8px', borderBottom: hair, textAlign: 'right',
                      background: FONDO[c.tono]?.(theme), color: TINTA[c.tono]?.(theme),
                      fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                      transition: `background ${DUR.state}ms ${EASE}`,
                    }}>
                    {int(v)}
                  </td>
                );
              })}
              <td style={{ padding: '4px 8px', borderBottom: hair, textAlign: 'right', fontFamily: TYPO.fontDisplay, fontSize: 11.5, color: theme.text, fontVariantNumeric: 'tabular-nums' }}>{int(r.total)}</td>
              <td style={{ padding: '4px 8px', borderBottom: hair, textAlign: 'right', fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, color: r.faltante > 0 ? (theme.red || '#FF3B30') : theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{r.faltante > 0 ? int(r.faltante) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
