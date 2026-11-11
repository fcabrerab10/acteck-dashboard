// Tabla compacta · header sticky en uppercase muted, hairlines, cifras tabulares, fila 26px.
// columnas: [{ key, label, align:'left'|'right'|'center', width, render?(row), sort?:bool, sum?:bool }]
// filas: objetos · onRowClick · orden {col, dir} + onSort · totales (fila final calculada de sum:true o pasada).
// grupos (opcional): fila superior de cabecera [{ label, colSpan, color }] — p. ej. un bloque por año en tablas multi-año.
// rowStyle (opcional): (row) → estilo extra de la fila (p. ej. fondo de fila seleccionada); el hover lo respeta.
import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { esTactil } from '../../lib/tactil';
import Vacio from './Vacio';
import { X } from 'lucide-react';
import { usePrefsDispositivo } from '../../lib/dispositivo';

const GRUPO_H = 24;

export default function TablaCompacta({ columnas, filas, rowKey = (r, i) => r.id ?? i, onRowClick, orden, onSort, totales, maxHeight, vacio = 'Sin datos.', dense = false, renderExpandido, expandidoKey, grupos, rowStyle, dividir = true, columnasLista }) {
  const props = arguments[0];
  const { theme } = useTheme();
  const hair = `1px solid ${theme.divider || theme.border}`;
  // Ancho visible del contenedor: el drill de una fila (renderExpandido) se pinta sticky a ese ancho,
  // para que nunca haya que desplazarse horizontalmente para verlo aunque la tabla sea más ancha.
  const scrollRef = useRef(null);
  const [anchoVisible, setAnchoVisible] = useState(0);
  // 2026-10-02 · Ventana de filas (fluidez): con muchas filas (p. ej. 500 SKUs × 12 HeatCells) el navegador pintaba
  // miles de celdas en cada orden/filtro. Con maxHeight y > UMBRAL filas sólo se montan las visibles (+ margen) y el
  // resto se reserva con dos filas espaciadoras; el drill abierto y los totales no cambian.
  // Con dedo (iPhone Duo, iPad) las filas crecen para que se puedan tocar; la ventana de filas usa ese alto.
  const tactil = esTactil();
  const UMBRAL = 120, ALTO_FILA = tactil ? (dense ? 33 : 39) : (dense ? 27 : 33), MARGEN = 12;
  const virtual = !!maxHeight && filas.length > UMBRAL;
  const [scrollTop, setScrollTop] = useState(0);
  const rafRef = useRef(0);
  const onScroll = virtual ? (e) => { const st = e.currentTarget.scrollTop; cancelAnimationFrame(rafRef.current); rafRef.current = requestAnimationFrame(() => setScrollTop(st)); } : undefined;
  const altoMax = typeof maxHeight === 'number' ? maxHeight : 600;
  const ini = virtual ? Math.max(0, Math.floor(scrollTop / ALTO_FILA) - MARGEN) : 0;
  const fin = virtual ? Math.min(filas.length, Math.ceil((scrollTop + altoMax) / ALTO_FILA) + MARGEN) : filas.length;
  const visibles = virtual ? filas.slice(ini, fin) : filas;
  // Vista dividida (diseño B · 2026-11-11): si el dispositivo la tiene prendida y hay una fila abierta, la tabla se
  // queda a la izquierda como lista (sus primeras columnas, o `columnasLista`) y el detalle se pinta a la derecha.
  const prefsDisp = usePrefsDispositivo();
  const contRef = useRef(null);
  const [anchoCont, setAnchoCont] = useState(0);
  const idxAbierta = renderExpandido && expandidoKey != null ? filas.findIndex((r, i) => rowKey(r, i) === expandidoKey) : -1;
  const partir = !!renderExpandido && dividir && !!prefsDisp.dividida && idxAbierta >= 0 && anchoCont >= 700;
  useEffect(() => {
    if (!renderExpandido || !dividir) return undefined;
    const el = contRef.current || scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const medir = () => setAnchoCont(el.clientWidth);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [renderExpandido, dividir, partir]);
  useEffect(() => {
    if (!renderExpandido) return undefined;
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const medir = () => setAnchoVisible(el.clientWidth);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [renderExpandido]);
  const th = { padding: dense ? '4px 6px' : '6px 8px', fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.textMuted, borderBottom: hair, position: 'sticky', top: grupos ? GRUPO_H : 0, backgroundColor: theme.surface, background: `color-mix(in srgb, ${theme.surface} 82%, transparent)`, backdropFilter: 'saturate(160%) blur(12px)', WebkitBackdropFilter: 'saturate(160%) blur(12px)', zIndex: 1, whiteSpace: 'nowrap' };
  const td = { padding: tactil ? (dense ? '6px 6px' : '8px 8px') : dense ? '3px 6px' : 'var(--dens-fila-pad, 5px 8px)', borderBottom: '1px solid transparent', fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums', fontSize: dense ? 11 : 11.5, color: theme.text, verticalAlign: 'middle' };
  const alignOf = (c) => c.align || 'right';
  const tot = totales === undefined && columnas.some((c) => c.sum)
    ? Object.fromEntries(columnas.filter((c) => c.sum).map((c) => [c.key, filas.reduce((s, r) => s + (Number(r[c.key]) || 0), 0)]))
    : totales;
  if (partir) {
    const fila = filas[idxAbierta];
    const clavesLista = columnasLista || columnas.slice(0, 2).map((c) => c.key);
    const resalte = theme.mode === 'dark' ? 'rgba(10,132,255,0.16)' : 'rgba(0,122,255,0.09)';
    return (
      <div ref={contRef} style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 32%) minmax(0, 1fr)', gap: 10, alignItems: 'start' }}>
        <TablaCompacta {...props} columnas={columnas.filter((c) => clavesLista.includes(c.key)).map((c) => ({ ...c, width: undefined }))} renderExpandido={undefined} expandidoKey={undefined} grupos={undefined} totales={null} dividir={false}
          maxHeight={typeof maxHeight === 'number' ? maxHeight : 'calc(100dvh - 170px)'}
          rowStyle={(r) => (r === fila ? { background: resalte } : (rowStyle ? rowStyle(r) : null))} />
        <div style={{ position: 'sticky', top: 8, maxHeight: 'calc(100dvh - 150px)', overflow: 'auto', WebkitOverflowScrolling: 'touch', borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.surface, minWidth: 0 }}>
          <div style={{ position: 'sticky', top: 0, zIndex: 2, display: 'flex', justifyContent: 'flex-end', height: 0 }}>
            <button type="button" title="Cerrar el detalle" onClick={() => onRowClick?.(fila)} style={{ margin: 6, width: 30, height: 30, borderRadius: 999, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.textMuted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><X size={15} /></button>
          </div>
          {renderExpandido(fila)}
        </div>
      </div>
    );
  }
  return (
    <div ref={scrollRef} onScroll={onScroll} style={{ overflow: 'auto', maxHeight: typeof maxHeight === 'number' ? `min(${maxHeight}px, max(320px, calc(100dvh - 170px)))` : maxHeight, WebkitOverflowScrolling: 'touch', borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.surface }}>
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
          {filas.length === 0 && <tr><td colSpan={columnas.length} style={{ ...td, textAlign: 'center', color: theme.textMuted, fontFamily: TYPO.fontText, padding: 0, whiteSpace: 'normal' }}>{typeof vacio === 'string' ? (() => { const i = vacio.search(/[.:] /); return <Vacio compacto titulo={i > 0 ? vacio.slice(0, i) : vacio.replace(/\.$/, '')} sub={i > 0 ? vacio.slice(i + 2) : null} />; })() : vacio}</td></tr>}
          {virtual && ini > 0 && <tr aria-hidden="true"><td colSpan={columnas.length} style={{ padding: 0, height: ini * ALTO_FILA, border: 0 }} /></tr>}
          {visibles.map((r, j) => {
            const i = ini + j;
            const k = rowKey(r, i); const abierto = renderExpandido && expandidoKey === k;
            const extra = rowStyle ? (rowStyle(r) || {}) : {};
            const bgReposo = extra.background || (abierto ? (theme.surfaceHover || 'rgba(0,0,0,0.02)') : 'transparent');
            return (
              <React.Fragment key={k}>
                <tr onClick={onRowClick ? () => onRowClick(r) : undefined}
                  onMouseEnter={(e) => { if (!extra.background) e.currentTarget.style.background = theme.surfaceHover || 'rgba(0,0,0,0.02)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = bgReposo; }}
                  style={{ cursor: onRowClick ? 'pointer' : 'default', transition: 'background 160ms', ...extra, background: bgReposo }}>
                  {columnas.map((c) => (
                    <td key={c.key} style={{ ...td, textAlign: alignOf(c), fontFamily: alignOf(c) === 'left' && !c.mono ? TYPO.fontText : td.fontFamily, fontWeight: c.bold ? 600 : 400, maxWidth: c.maxWidth, overflow: c.maxWidth ? 'hidden' : undefined, textOverflow: c.maxWidth ? 'ellipsis' : undefined, whiteSpace: c.wrap ? 'normal' : 'nowrap' }}>
                      {c.render ? c.render(r, i) : (r[c.key] ?? '—')}
                    </td>
                  ))}
                </tr>
                {abierto && (
                  <tr><td colSpan={columnas.length} style={{ padding: 0, borderBottom: `1px solid ${theme.border}` }}>
                    <div style={{ position: 'sticky', left: 0, width: anchoVisible ? anchoVisible - 2 : 'auto', maxWidth: '100%', boxSizing: 'border-box', minWidth: 0, overflow: 'hidden' }}>{renderExpandido(r)}</div>
                  </td></tr>
                )}
              </React.Fragment>
            );
          })}
          {virtual && fin < filas.length && <tr aria-hidden="true"><td colSpan={columnas.length} style={{ padding: 0, height: (filas.length - fin) * ALTO_FILA, border: 0 }} /></tr>}
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
