// Inicio móvil · mix de sell in como gráfica de pay (dona) con leyenda a la derecha (2026-10-05, pedido de Fernando).
// Hasta 5 rebanadas; el resto se agrupa en «Otros». Segmented Canal · Marca · Categoría.
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { canalLabel } from '../../../modules/general/inicio/config';

const DIMS = [['canal', 'Canal'], ['marca', 'Marca'], ['categoria', 'Categoría']];

export default function PayMix({ mixes, formato, titulo }) {
  const { theme } = useTheme();
  const [dim, setDim] = useState('canal');
  const colores = [theme.accent, theme.teal || '#64D2FF', theme.purple || '#BF5AF2', theme.orange, theme.green, theme.textMuted];
  const filas = useMemo(() => {
    const src = (mixes?.[dim] || []).filter((x) => x.cur > 0).sort((a, b) => b.cur - a.cur);
    const top = src.slice(0, 5); const resto = src.slice(5).reduce((s, x) => s + x.cur, 0);
    const out = top.map((x) => ({ key: x.key, label: dim === 'canal' ? canalLabel(x.key) : x.key, v: x.cur }));
    if (resto > 0) out.push({ key: '__otros', label: 'Otros', v: resto });
    return out;
  }, [mixes, dim]);
  const total = filas.reduce((s, x) => s + x.v, 0);
  const C = 62, Rr = 56, r = 37; let a0 = -Math.PI / 2;
  const p = (ang, rad) => `${(C + rad * Math.cos(ang)).toFixed(2)},${(C + rad * Math.sin(ang)).toFixed(2)}`;
  const segs = filas.map((x, k) => {
    const frac = total ? x.v / total : 0;
    const a1 = a0 + frac * 2 * Math.PI - (filas.length > 1 ? 0.02 : 0);
    const big = a1 - a0 > Math.PI ? 1 : 0;
    const d = frac >= 0.999 ? `M${p(a0, Rr)}A${Rr},${Rr},0,1,1,${p(a0 + Math.PI, Rr)}A${Rr},${Rr},0,1,1,${p(a0, Rr)}L${p(a0, r)}A${r},${r},0,1,0,${p(a0 + Math.PI, r)}A${r},${r},0,1,0,${p(a0, r)}Z`
      : `M${p(a0, Rr)}A${Rr},${Rr},0,${big},1,${p(a1, Rr)}L${p(a1, r)}A${r},${r},0,${big},0,${p(a0, r)}Z`;
    a0 = a1 + (filas.length > 1 ? 0.02 : 0);
    return <path key={x.key} d={d} fill={colores[k % colores.length]} />;
  });
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px 6px 2px' }}>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em', color: theme.text }}>{titulo}</span>
        <span style={{ display: 'inline-flex', gap: 4 }}>
          {DIMS.map(([id, l]) => <button key={id} type="button" onClick={() => setDim(id)} style={{ border: 0, borderRadius: 999, padding: '3px 9px', fontFamily: TYPO.fontText, fontSize: 11.5, fontWeight: 500, cursor: 'pointer', background: dim === id ? theme.accent : `${theme.text}14`, color: dim === id ? '#FFF' : theme.textMuted }}>{l}</button>)}
        </span>
      </div>
      <div style={{ background: theme.surface, borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 14 }}>
        {filas.length === 0 ? <div style={{ fontSize: 12.5, color: theme.textMuted, padding: '12px 0' }}>Sin sell in en el período.</div> : (
          <>
            <svg viewBox="0 0 124 124" style={{ width: 124, height: 124, flexShrink: 0 }}>
              {segs}
              <text x="62" y="58" textAnchor="middle" fontSize="9" fill={theme.textMuted} fontWeight="600" fontFamily={TYPO.fontDisplay}>TOTAL</text>
              <text x="62" y="74" textAnchor="middle" fontSize="15" fontWeight="700" fill={theme.text} fontFamily={TYPO.fontDisplay}>{formato(total)}</text>
            </svg>
            <div style={{ flex: 1, minWidth: 0 }}>
              {filas.map((x, k) => (
                <div key={x.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5, padding: '4px 0', fontVariantNumeric: 'tabular-nums' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: theme.text }}><i style={{ width: 9, height: 9, borderRadius: 3, background: colores[k % colores.length], flexShrink: 0 }} />{x.label}</span>
                  <span style={{ flexShrink: 0, fontWeight: 600, color: theme.text }}>{total ? Math.round((x.v / total) * 100) : 0}% <span style={{ color: theme.textMuted, fontWeight: 500 }}>· {formato(x.v)}</span></span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
