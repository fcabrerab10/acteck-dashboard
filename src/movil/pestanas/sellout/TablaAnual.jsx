// TablaAnual · heatmap filas × meses del año con primera columna fija, columna Prom, columna Total y fila Total.
// Es la variante "año completo" de TablaHeat (sellin/piezas.jsx): misma estética (HeatCell del kit,
// cabecera pegajosa, scroll horizontal) y dos columnas de cierre a la derecha:
//
//   Prom  — promedio SÓLO sobre los meses con dato (valor distinto de 0); un SKU que arrancó en mayo
//           no se castiga con los ceros de enero-abril. `promMeses` fija el divisor si se prefiere fijo.
//   Total — suma de los meses de la fila.
//
// Para series de saldo (stock al cierre de cada mes) el total no significa nada: `conTotalCol={false}`.
//
// 2026-10-05 (Sell Out / Sell In de la empresa en el celular), sin cambiar a quien ya la usa:
//   ordenable — tocar el encabezado de un mes, de Total o de Δ ordena de mayor a menor; volver a tocar invierte
//               (flecha en el encabezado activo). La fila Total no se mueve.
//   conDelta  — columna Δ = total de la fila frente a `fila.prev` (los mismos 12 meses del año anterior);
//               «—» si la fila no trae `prev` o su suma es 0.
//
//   <TablaAnual columnas={['Ene',…,'Dic']} filas={[{ label:'2026', sub:'Ene–Sep', valores:[…], prev:[…] }]}
//     fmt={moneyCompact} etiquetaFilas="2 años" ordenable conDelta />
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { HeatCell } from '../../../components/kit';
import { MONO, N } from '../../util';

const prom = (valores, promMeses) => {
  const vals = (valores || []).map((v) => N(v));
  const con = promMeses || vals.filter((v) => v !== 0).length;
  if (!con) return 0;
  return vals.reduce((s, v) => s + v, 0) / con;
};
const suma = (valores) => (valores || []).reduce((s, v) => s + N(v), 0);
/** Δ % de la fila contra su año anterior; null si no hay con qué comparar. */
export const deltaFila = (fila) => {
  if (!fila || !Array.isArray(fila.prev)) return null;
  const p = suma(fila.prev);
  if (!p) return null;
  return ((suma(fila.valores) - p) / Math.abs(p)) * 100;
};

/** Ordena las filas por una columna ('total' · 'delta' · índice de mes); puro, lo prueba el SSR. */
export function ordenarFilas(filas, orden) {
  if (!orden || orden.col == null) return filas;
  const valor = (f) => (orden.col === 'total' ? suma(f.valores) : orden.col === 'delta' ? deltaFila(f) : N(f.valores?.[orden.col]));
  const dir = orden.dir === 'asc' ? 1 : -1;
  return [...filas].sort((a, b) => {
    const va = valor(a), vb = valor(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;   // los «—» siempre al final
    if (vb == null) return -1;
    return (va - vb) * dir;
  });
}

export default function TablaAnual({
  columnas = [], filas = [], fmt, etiquetaFilas = '', totalLabel = 'Total',
  conTotalFila = true, conTotalCol = true, conProm = true, promMeses = null, vacio = 'Sin movimiento en estos meses.',
  ordenable = false, conDelta = false, ordenInicial = null,
}) {
  const { theme } = useTheme();
  const [orden, setOrden] = useState(ordenInicial);
  const f = fmt || ((n) => Math.round(n).toLocaleString('es-MX'));
  const totalesCol = columnas.map((_, i) => filas.reduce((s, x) => s + N(x.valores?.[i]), 0));
  const maxTotalCol = Math.max(0, ...totalesCol);
  const granTotal = totalesCol.reduce((s, v) => s + v, 0);
  const totalPrev = conDelta ? filas.reduce((s, x) => s + (Array.isArray(x.prev) ? suma(x.prev) : 0), 0) : 0;
  const deltaTotal = conDelta && totalPrev ? ((granTotal - totalPrev) / Math.abs(totalPrev)) * 100 : null;
  const extras = (conProm ? 1 : 0) + (conTotalCol ? 1 : 0) + (conDelta ? 1 : 0);
  const ordenadas = useMemo(() => (ordenable ? ordenarFilas(filas, orden) : filas), [filas, orden, ordenable]);

  const tocar = (col) => {
    if (!ordenable) return;
    setOrden((o) => (o && o.col === col ? (o.dir === 'desc' ? { col, dir: 'asc' } : null) : { col, dir: 'desc' }));
  };
  const flecha = (col) => (ordenable && orden && orden.col === col ? (orden.dir === 'desc' ? ' ▾' : ' ▴') : '');
  const activo = (col) => (ordenable && orden && orden.col === col ? { color: theme.accent } : null);

  const th = { position: 'sticky', top: 0, background: theme.surface, zIndex: 1, padding: '8px 6px', fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: theme.textMuted, textAlign: 'center', whiteSpace: 'nowrap', borderBottom: `1px solid ${theme.border}`, cursor: ordenable ? 'pointer' : 'default', userSelect: 'none', WebkitUserSelect: 'none' };
  const tdLabel = { position: 'sticky', left: 0, background: theme.surface, zIndex: 1, padding: '7px 10px', fontSize: 12.5, fontWeight: 500, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 132, borderRight: `1px solid ${theme.border}` };
  const td = { padding: '5px 5px', textAlign: 'center' };
  const tdTot = { ...td, fontFamily: MONO, fontSize: 11, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
  const sepL = { borderLeft: `1px solid ${theme.border}` };
  const colorDelta = (d) => (d == null ? theme.textMuted : d >= 0 ? theme.green : theme.red);
  const fmtDelta = (d) => (d == null ? '—' : `${d > 0 ? '+' : ''}${Math.round(d)}%`);

  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden' }}>
      {filas.length === 0 && <div style={{ padding: 18, fontSize: 12.5, color: theme.textMuted, textAlign: 'center' }}>{vacio}</div>}
      {filas.length > 0 && (
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 132 + columnas.length * 56 + extras * 66 }}>
            <thead>
              <tr>
                <th style={{ ...th, ...tdLabel, textAlign: 'left', zIndex: 2, textTransform: 'none', letterSpacing: 0, fontSize: 10.5, cursor: 'default' }}>{etiquetaFilas}</th>
                {columnas.map((c, i) => <th key={`${c}-${i}`} style={{ ...th, ...activo(i) }} onClick={() => tocar(i)}>{c}{flecha(i)}</th>)}
                {conProm && <th style={{ ...th, ...sepL, cursor: 'default' }}>Prom</th>}
                {conTotalCol && <th style={{ ...th, ...(conProm ? null : sepL), ...activo('total') }} onClick={() => tocar('total')}>Total{flecha('total')}</th>}
                {conDelta && <th style={{ ...th, ...(conProm || conTotalCol ? null : sepL), ...activo('delta') }} onClick={() => tocar('delta')} title="Frente a los mismos 12 meses del año anterior">Δ{flecha('delta')}</th>}
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((fila, fi) => {
                const max = Math.max(0, ...(fila.valores || []).map((v) => N(v)));
                const tot = suma(fila.valores);
                const d = conDelta ? deltaFila(fila) : null;
                return (
                  <tr key={fila.key || fila.label || fi} onClick={fila.onClick} style={fila.onClick ? { cursor: 'pointer' } : undefined}>
                    <td style={{ ...tdLabel, ...(fila.onClick ? { color: theme.accent } : null) }} title={fila.label}>{fila.label}{fila.sub && <span style={{ display: 'block', fontSize: 10.5, color: theme.textMuted, fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis' }}>{fila.sub}</span>}</td>
                    {columnas.map((c, i) => <td key={`${c}-${i}`} style={td}><HeatCell v={N(fila.valores?.[i])} max={max} fmt={f} /></td>)}
                    {conProm && <td style={{ ...tdTot, ...sepL }}>{f(prom(fila.valores, fila.promMeses ?? promMeses))}</td>}
                    {conTotalCol && <td style={{ ...tdTot, ...(conProm ? null : sepL), fontWeight: 600, color: theme.text }}>{f(tot)}</td>}
                    {conDelta && <td style={{ ...tdTot, ...(conProm || conTotalCol ? null : sepL), fontWeight: 600, color: colorDelta(d) }}>{fmtDelta(d)}</td>}
                  </tr>
                );
              })}
              {conTotalFila && filas.length > 1 && (
                <tr>
                  <td style={{ ...tdLabel, fontFamily: TYPO.fontDisplay, fontWeight: 600, borderTop: `1px solid ${theme.border}` }}>{totalLabel}</td>
                  {totalesCol.map((v, i) => <td key={i} style={{ ...td, borderTop: `1px solid ${theme.border}` }}><HeatCell v={v} max={maxTotalCol} fmt={f} /></td>)}
                  {conProm && <td style={{ ...tdTot, ...sepL, borderTop: `1px solid ${theme.border}` }}>{f(prom(totalesCol, promMeses))}</td>}
                  {conTotalCol && <td style={{ ...tdTot, ...(conProm ? null : sepL), borderTop: `1px solid ${theme.border}`, fontWeight: 700, color: theme.text }}>{f(granTotal)}</td>}
                  {conDelta && <td style={{ ...tdTot, ...(conProm || conTotalCol ? null : sepL), borderTop: `1px solid ${theme.border}`, fontWeight: 700, color: colorDelta(deltaTotal) }}>{fmtDelta(deltaTotal)}</td>}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
