// PreciosLinea — todos los precios de lista de UN SKU de la propuesta (web · 2026-11-18; venía sólo en el celular,
// RevisarM). Se abre al tocar la línea en Revisar: cada lista es un botón grande (sirve con dedo, nada depende de hover)
// con su precio y el Δ % contra el precio actual de la línea; al elegir una cambia la lista SÓLO de esa línea.
// Cálculo: propuestas/resumen.js#preciosDeLinea (el mismo que usa el celular).
import React from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Pill } from '../../../components/kit';
import { money } from '../../../lib/format';
import { listaColor } from './constantes';
import { preciosDeLinea } from './resumen';

export default function PreciosLinea({ r, onElegir }) {
  const { theme } = useTheme();
  const opciones = preciosDeLinea(r.precios, { precio: r.precio, listaSel: r.listaSel });
  const custom = r.listaSel === '__custom';
  return (
    <div style={{ padding: '10px 12px', background: theme.surfaceHover || theme.bg, fontFamily: TYPO.fontText }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, color: theme.text }}>Precios de lista de {r.sku}</span>
        <span style={{ fontSize: 10.5, color: theme.textMuted }}>sin IVA · elige una y cambia sólo esta línea · hoy {money(r.precio)}{custom ? ' (personalizado)' : ''}</span>
      </div>
      {!opciones.length && <div style={{ fontSize: 11.5, color: theme.textMuted }}>Este SKU no tiene precio en las listas; queda el personalizado.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
        {opciones.map((o) => (
          <button key={o.lista} type="button" onClick={() => onElegir?.({ listaSel: o.lista, precio: o.precio })} aria-pressed={o.elegida}
            style={{ display: 'flex', flexDirection: 'column', gap: 3, minHeight: 'max(52px, var(--tap-min, 0px))', padding: '8px 10px', textAlign: 'left', cursor: 'pointer', borderRadius: 10, background: theme.surface, color: theme.text, border: `1px solid ${o.elegida ? theme.accent : theme.border}` }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: listaColor(o.lista), flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.lista}</span>
              {o.elegida && <Pill tone="blue" size="xs" style={{ marginLeft: 'auto', flexShrink: 0 }}>Elegida</Pill>}
            </span>
            <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{money(o.precio)}</span>
              <span style={{ fontSize: 10.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: o.delta == null ? theme.textMuted : o.delta > 0 ? theme.green : theme.red }}>
                {o.delta == null ? 'precio actual' : `${o.delta > 0 ? '+' : '−'}${Math.abs(o.delta).toFixed(1)} % vs actual`}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
