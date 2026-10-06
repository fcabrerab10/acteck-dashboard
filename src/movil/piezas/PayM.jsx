// Gráfica de pay (dona) con leyenda a la derecha, genérica (2026-10-05; nació como inicio/PayMix).
//   <PayM titulo="Mix" filas={[{ label, v }]} formato={moneyCompact} acciones={<Segmented …/>} centro="YTD" />
// Hasta `top` rebanadas; el resto se agrupa en «Otros». Los % se recalculan sobre el total, nunca se suman.
import React, { useMemo } from 'react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';

export default function PayM({ titulo, filas = [], formato = (n) => String(n), acciones, centro = 'TOTAL', top = 5, vacio = 'Sin datos en el período.', style }) {
  const { theme } = useTheme();
  const colores = [theme.accent, theme.teal || theme.accent, theme.purple || theme.indigo || theme.accent, theme.orange, theme.green, theme.textMuted];
  const lista = useMemo(() => {
    const src = filas.filter((x) => Number(x.v) > 0).sort((a, b) => b.v - a.v);
    const cab = src.slice(0, top); const resto = src.slice(top).reduce((s, x) => s + Number(x.v), 0);
    const out = cab.map((x) => ({ key: x.key || x.label, label: x.label, v: Number(x.v) }));
    if (resto > 0) out.push({ key: '__otros', label: 'Otros', v: resto });
    return out;
  }, [filas, top]);
  const total = lista.reduce((s, x) => s + x.v, 0);
  const C = 62, Rr = 56, r = 37; let a0 = -Math.PI / 2;
  const p = (ang, rad) => `${(C + rad * Math.cos(ang)).toFixed(2)},${(C + rad * Math.sin(ang)).toFixed(2)}`;
  const segs = lista.map((x, k) => {
    const frac = total ? x.v / total : 0;
    const a1 = a0 + frac * 2 * Math.PI - (lista.length > 1 ? 0.02 : 0);
    const big = a1 - a0 > Math.PI ? 1 : 0;
    const d = frac >= 0.999 ? `M${p(a0, Rr)}A${Rr},${Rr},0,1,1,${p(a0 + Math.PI, Rr)}A${Rr},${Rr},0,1,1,${p(a0, Rr)}L${p(a0, r)}A${r},${r},0,1,0,${p(a0 + Math.PI, r)}A${r},${r},0,1,0,${p(a0, r)}Z`
      : `M${p(a0, Rr)}A${Rr},${Rr},0,${big},1,${p(a1, Rr)}L${p(a1, r)}A${r},${r},0,${big},0,${p(a0, r)}Z`;
    a0 = a1 + (lista.length > 1 ? 0.02 : 0);
    return <path key={x.key} d={d} fill={colores[k % colores.length]} />;
  });
  return (
    <div style={{ marginTop: 18, ...style }}>
      {(titulo || acciones) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '0 4px 6px 2px' }}>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em', color: theme.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titulo}</span>
          {acciones && <span style={{ display: 'inline-flex', gap: 4, flexShrink: 0 }}>{acciones}</span>}
        </div>
      )}
      <div style={{ background: theme.surface, borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 14 }}>
        {lista.length === 0 ? <div style={{ fontSize: 12.5, color: theme.textMuted, padding: '12px 0' }}>{vacio}</div> : (
          <>
            <svg viewBox="0 0 124 124" style={{ width: 124, height: 124, flexShrink: 0 }}>
              {segs}
              <text x="62" y="58" textAnchor="middle" fontSize="9" fill={theme.textMuted} fontWeight="600" fontFamily={TYPO.fontDisplay}>{centro}</text>
              <text x="62" y="74" textAnchor="middle" fontSize="15" fontWeight="700" fill={theme.text} fontFamily={TYPO.fontDisplay}>{formato(total)}</text>
            </svg>
            <div style={{ flex: 1, minWidth: 0 }}>
              {lista.map((x, k) => (
                <div key={x.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5, padding: '4px 0', fontVariantNumeric: 'tabular-nums' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: theme.text }}><i style={{ width: 9, height: 9, borderRadius: 3, background: colores[k % colores.length], flexShrink: 0 }} /><span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.label}</span></span>
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

/** Botones-chip para elegir la dimensión del pay (Canal · Marca · Categoría, Sell in · Sell out…). */
export function ChipsPay({ opciones = [], value, onChange }) {
  const { theme } = useTheme();
  return opciones.map(([id, l]) => (
    <button key={id} type="button" onClick={() => onChange(id)} style={{ border: 0, borderRadius: 999, padding: '3px 9px', fontFamily: TYPO.fontText, fontSize: 11.5, fontWeight: 500, cursor: 'pointer', background: value === id ? theme.accent : `${theme.text}14`, color: value === id ? (theme.textOnDark || '#FFF') : theme.textMuted }}>{l}</button>
  ));
}
