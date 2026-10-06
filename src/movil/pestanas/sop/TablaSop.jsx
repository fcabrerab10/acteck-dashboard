// S&OP del celular · tabla por SKU (Días · Venta/mes · Stock · Llega · Sug.). Propia (no TablaAnual) porque aquí el 0
// significa algo: «Agotado» en Días y «0» en Stock se pintan, no se tapan con «—». Tocar un encabezado ordena desc → asc.
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { MONO } from '../../util';

const fmt = (n) => (n == null ? '—' : Math.round(n).toLocaleString('es-MX'));

export default function TablaSop({ columnas = [], filas = [], ordenInicial = null, vacio = 'Sin SKUs.' }) {
  const { theme } = useTheme();
  const [orden, setOrden] = useState(ordenInicial);
  const lista = useMemo(() => {
    if (!orden) return filas;
    const dir = orden.dir === 'asc' ? 1 : -1;
    return [...filas].sort((a, b) => { const va = a.valores?.[orden.col], vb = b.valores?.[orden.col]; if (va == null && vb == null) return 0; if (va == null) return 1; if (vb == null) return -1; return (va - vb) * dir; });
  }, [filas, orden]);
  const tocar = (i) => setOrden((o) => (!o || o.col !== i ? { col: i, dir: 'desc' } : o.dir === 'desc' ? { col: i, dir: 'asc' } : null));
  const th = { fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: theme.textMuted, padding: '6px 4px', textAlign: 'right', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' };
  const td = { padding: '7px 4px', textAlign: 'right', fontFamily: MONO, fontSize: 12, fontVariantNumeric: 'tabular-nums', borderTop: `1px solid ${theme.border}`, whiteSpace: 'nowrap', color: theme.text };
  const colorDias = (f) => (f.dias == null ? theme.textMuted : f.dias <= 0 ? theme.red : f.dias < 30 ? theme.red : f.dias < 60 ? theme.orange : theme.text);
  return (
    <div style={{ background: theme.surface, borderRadius: 14, padding: '4px 10px 6px', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup><col style={{ width: '38%' }} />{columnas.map((c) => <col key={c} />)}</colgroup>
        <thead><tr>
          <th style={{ ...th, textAlign: 'left', cursor: 'default' }}>SKU</th>
          {columnas.map((c, i) => <th key={c} onClick={() => tocar(i)} style={{ ...th, color: orden?.col === i ? theme.text : theme.textMuted }}>{c}{orden?.col === i ? (orden.dir === 'desc' ? ' ▾' : ' ▴') : ''}</th>)}
        </tr></thead>
        <tbody>
          {!lista.length && <tr><td colSpan={columnas.length + 1} style={{ ...td, textAlign: 'center', color: theme.textMuted, fontFamily: TYPO.fontText }}>{vacio}</td></tr>}
          {lista.map((f) => (
            <tr key={f.sku} onClick={f.onClick} style={f.onClick ? { cursor: 'pointer' } : undefined}>
              <td style={{ ...td, textAlign: 'left', fontFamily: TYPO.fontDisplay, fontWeight: 600, color: f.onClick ? theme.accent : theme.text, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12.5 }} title={f.sub}>{f.label}{f.sub && <span style={{ display: 'block', fontFamily: TYPO.fontText, fontSize: 10.5, color: theme.textMuted, fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.sub}</span>}</td>
              {columnas.map((c, i) => <td key={c} style={{ ...td, color: i === 0 ? colorDias(f) : f.valores?.[i] ? theme.text : theme.textMuted }}>{i === 0 && f.dias != null && f.dias <= 0 ? 'Agot.' : fmt(f.valores?.[i])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
