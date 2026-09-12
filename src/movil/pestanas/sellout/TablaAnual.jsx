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
//   <TablaAnual columnas={['Ene',…,'Dic']} filas={[{ label:'2026', sub:'Ene–Sep', valores:[…] }]}
//     fmt={moneyCompact} etiquetaFilas="2 años" />
import React from 'react';
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

export default function TablaAnual({
  columnas = [], filas = [], fmt, etiquetaFilas = '', totalLabel = 'Total',
  conTotalFila = true, conTotalCol = true, conProm = true, promMeses = null, vacio = 'Sin movimiento en estos meses.',
}) {
  const { theme } = useTheme();
  const f = fmt || ((n) => Math.round(n).toLocaleString('es-MX'));
  const totalesCol = columnas.map((_, i) => filas.reduce((s, x) => s + N(x.valores?.[i]), 0));
  const maxTotalCol = Math.max(0, ...totalesCol);
  const granTotal = totalesCol.reduce((s, v) => s + v, 0);
  const extras = (conProm ? 1 : 0) + (conTotalCol ? 1 : 0);

  const th = { position: 'sticky', top: 0, background: theme.surface, zIndex: 1, padding: '8px 6px', fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: theme.textMuted, textAlign: 'center', whiteSpace: 'nowrap', borderBottom: `1px solid ${theme.border}` };
  const tdLabel = { position: 'sticky', left: 0, background: theme.surface, zIndex: 1, padding: '7px 10px', fontSize: 12.5, fontWeight: 500, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 132, borderRight: `1px solid ${theme.border}` };
  const td = { padding: '5px 5px', textAlign: 'center' };
  const tdTot = { ...td, fontFamily: MONO, fontSize: 11, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
  const sepL = { borderLeft: `1px solid ${theme.border}` };

  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden' }}>
      {filas.length === 0 && <div style={{ padding: 18, fontSize: 12.5, color: theme.textMuted, textAlign: 'center' }}>{vacio}</div>}
      {filas.length > 0 && (
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 132 + columnas.length * 56 + extras * 66 }}>
            <thead>
              <tr>
                <th style={{ ...th, ...tdLabel, textAlign: 'left', zIndex: 2, textTransform: 'none', letterSpacing: 0, fontSize: 10.5 }}>{etiquetaFilas}</th>
                {columnas.map((c, i) => <th key={`${c}-${i}`} style={th}>{c}</th>)}
                {conProm && <th style={{ ...th, ...sepL }}>Prom</th>}
                {conTotalCol && <th style={{ ...th, ...(conProm ? null : sepL) }}>Total</th>}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila, fi) => {
                const max = Math.max(0, ...(fila.valores || []).map((v) => N(v)));
                const tot = (fila.valores || []).reduce((s, v) => s + N(v), 0);
                return (
                  <tr key={fila.label || fi}>
                    <td style={tdLabel} title={fila.label}>{fila.label}{fila.sub && <span style={{ display: 'block', fontSize: 10.5, color: theme.textMuted, fontWeight: 400 }}>{fila.sub}</span>}</td>
                    {columnas.map((c, i) => <td key={`${c}-${i}`} style={td}><HeatCell v={N(fila.valores?.[i])} max={max} fmt={f} /></td>)}
                    {conProm && <td style={{ ...tdTot, ...sepL }}>{f(prom(fila.valores, fila.promMeses ?? promMeses))}</td>}
                    {conTotalCol && <td style={{ ...tdTot, ...(conProm ? null : sepL), fontWeight: 600, color: theme.text }}>{f(tot)}</td>}
                  </tr>
                );
              })}
              {conTotalFila && filas.length > 1 && (
                <tr>
                  <td style={{ ...tdLabel, fontFamily: TYPO.fontDisplay, fontWeight: 600, borderTop: `1px solid ${theme.border}` }}>{totalLabel}</td>
                  {totalesCol.map((v, i) => <td key={i} style={{ ...td, borderTop: `1px solid ${theme.border}` }}><HeatCell v={v} max={maxTotalCol} fmt={f} /></td>)}
                  {conProm && <td style={{ ...tdTot, ...sepL, borderTop: `1px solid ${theme.border}` }}>{f(prom(totalesCol, promMeses))}</td>}
                  {conTotalCol && <td style={{ ...tdTot, ...(conProm ? null : sepL), borderTop: `1px solid ${theme.border}`, fontWeight: 700, color: theme.text }}>{f(granTotal)}</td>}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
