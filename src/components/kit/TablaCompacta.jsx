// Tabla compacta · header sticky en uppercase muted, hairlines, cifras tabulares, fila 26px.
// columnas: [{ key, label, align:'left'|'right'|'center', width, render?(row), sort?:bool, sum?:bool }]
// filas: objetos · onRowClick · orden {col, dir} + onSort · totales (fila final calculada de sum:true o pasada).
// grupos (opcional): fila superior de cabecera [{ label, colSpan, color }] — p. ej. un bloque por año en tablas multi-año.
// rowStyle (opcional): (row) → estilo extra de la fila (p. ej. fondo de fila seleccionada); el hover lo respeta.
import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';

const GRUPO_H = 24;

export default function TablaCompacta({ columnas, filas, rowKey = (r, i) => r.id ?? i, onRowClick, orden, onSort, totales, maxHeight, vacio = 'Sin datos.', dense = false, renderExpandido, expandidoKey, grupos, rowStyle }) {
  const { theme } = useTheme();
  const hair = `1px solid ${theme.divider || theme.border}`;
  const th = { padding: dense ? '4px 6px' : '6px 8px', fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.textMuted, borderBottom: hair, position: 'sticky', top: grupos ? GRUPO_H : 0, background: theme.surface, zIndex: 1, whiteSpace: 'nowrap' };
  const td = { padding: dense ? '3px 6px' : '5px 8px', borderBottom: `1px solid ${theme.border}`, fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums', fontSize: dense ? 11 : 11.5, color: theme.text, verticalAlign: 'middle' };
  const alignOf = (c) => c.align || 'right';
  const tot = totales === undefined && columnas.some((c) => c.sum)
    ? Object.fromEntries(columnas.filter((c) => c.sum).map((c) => [c.key, filas.reduce((s, r) => s + (Number(r[c.key]) || 0), 0)]))
    : totales;
  return (
    <div style={{ overflow: 'auto', maxHeight, borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.surface }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead>
          {grupos && (
            <tr>
              {grupos.map((g, i) => (
                <th key={i} colSpan={g.colSpan} style={{ ...th, top: 0, height: GRUPO_H, lineHeight: `${GRUPO_H}px`, padding: '0 8px', boxSizing: 'border-box', textAlign: 'center', borderBottom: 0, fontSize: 10.5, letterSpacing: '0.04em', color: g.color || th.color, boxShadow: g.label ? `inset 0 -2px 0 ${g.color || theme.border}` : 'none' }}>
                  {g.label}
                </th>
              ))}
            </tr>
          )}
          <tr>
            {columnas.map((c) => {
              const sortable = c.sort && onSort; const active = orden?.col === c.key;
              return (
                <th key={c.key} onClick={sortable ? () => onSort(c.key) : undefined}
                  style={{ ...th, textAlign: alignOf(c), width: c.width, cursor: sortable ? 'pointer' : 'default', color: active ? theme.text : th.color }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    {c.label}
                    {sortable && (active ? (orden.dir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} style={{ opacity: 0.4 }} />)}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {filas.length === 0 && <tr><td colSpan={columnas.length} style={{ ...td, textAlign: 'center', color: theme.textMuted, fontFamily: TYPO.fontText, padding: 18 }}>{vacio}</td></tr>}
          {filas.map((r, i) => {
            const k = rowKey(r, i); const abierto = renderExpandido && expandidoKey === k;
            const extra = rowStyle ? (rowStyle(r) || {}) : {};
            const bgReposo = extra.background || (abierto ? (theme.surfaceHover || 'rgba(0,0,0,0.02)') : 'transparent');
            return (
              <React.Fragment key={k}>
                <tr onClick={onRowClick ? () => onRowClick(r) : undefined}
                  onMouseEnter={(e) => { if (onRowClick && !extra.background) e.currentTarget.style.background = theme.surfaceHover || 'rgba(0,0,0,0.02)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = bgReposo; }}
                  style={{ cursor: onRowClick ? 'pointer' : 'default', transition: 'background 160ms', ...extra, background: bgReposo }}>
                  {columnas.map((c) => (
                    <td key={c.key} style={{ ...td, textAlign: alignOf(c), fontFamily: alignOf(c) === 'left' && !c.mono ? TYPO.fontText : td.fontFamily, fontWeight: c.bold ? 600 : 400, maxWidth: c.maxWidth, overflow: c.maxWidth ? 'hidden' : undefined, textOverflow: c.maxWidth ? 'ellipsis' : undefined, whiteSpace: c.wrap ? 'normal' : 'nowrap' }}>
                      {c.render ? c.render(r, i) : (r[c.key] ?? '—')}
                    </td>
                  ))}
                </tr>
                {abierto && <tr><td colSpan={columnas.length} style={{ padding: 0, borderBottom: `1px solid ${theme.border}` }}>{renderExpandido(r)}</td></tr>}
              </React.Fragment>
            );
          })}
        </tbody>
        {tot && (
          <tfoot>
            <tr>
              {columnas.map((c, i) => (
                <td key={c.key} style={{ ...td, textAlign: alignOf(c), fontWeight: 600, borderTop: hair, borderBottom: 0, background: theme.surface, position: 'sticky', bottom: 0 }}>
                  {i === 0 && tot[c.key] == null ? 'Total' : c.renderTotal ? c.renderTotal(tot[c.key], tot) : tot[c.key] != null ? (c.render && c.fmtTotal !== false && typeof tot[c.key] === 'number' ? (c.fmt ? c.fmt(tot[c.key]) : Math.round(tot[c.key]).toLocaleString('es-MX')) : tot[c.key]) : ''}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
