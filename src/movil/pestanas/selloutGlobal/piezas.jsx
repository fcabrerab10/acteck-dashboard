// Piezas propias del Sell Out consolidado en el celular.
// Nada de datos ni de cálculo aquí: eso vive en src/modules/comercial/sellout/{calculo,datos,textos}.js
// y se comparte con la web.
import React, { useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { ListaAgrupada, Pill } from '../../piezas';
import { moneyCompact, N } from '../../util';

/** Pastilla tocable sobre el hero inverso (misma que en sellin/SellInGlobal: vive sobre fondo negro/marfil). */
export function PillHero({ on = false, onClick, children, theme, style }) {
  const activo = theme.mode === 'dark' ? 'rgba(29,29,31,0.92)' : 'rgba(245,245,247,0.95)';
  const texto = theme.mode === 'dark' ? 'rgba(245,245,247,0.95)' : 'rgba(29,29,31,0.92)';
  const inactivo = theme.mode === 'dark' ? 'rgba(29,29,31,0.14)' : 'rgba(245,245,247,0.16)';
  return (
    <button type="button" onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 11px', borderRadius: 999, border: 0, cursor: 'pointer',
      background: on ? activo : inactivo, color: on ? texto : (theme.textOnInverse || theme.textOnDark),
      fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, letterSpacing: '-0.01em', whiteSpace: 'nowrap', ...style,
    }}>{children}</button>
  );
}

/**
 * Lista "Composición del mes": una barra por concepto con su % y su monto.
 * filas: [{ id, label, importe, pct }] (salida de porCanal / composicion de calculo.js).
 */
export function Composicion({ filas = [], titulo, pie, meta, style }) {
  const { theme } = useTheme();
  const max = Math.max(0, ...filas.map((f) => N(f.importe)));
  return (
    <ListaAgrupada titulo={titulo} meta={meta ?? `${filas.length}`} pie={pie} style={{ marginTop: 18, ...style }}>
      {filas.length === 0 && <div style={{ padding: 18, fontSize: 12.5, color: theme.textMuted, textAlign: 'center' }}>Sin venta este mes.</div>}
      {filas.map((f) => (
        <div key={f.id || f.label} style={{ padding: '9px 12px', fontFamily: TYPO.fontText }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: theme.text }}>{f.label}</span>
            <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 13.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums', flexShrink: 0, color: theme.text }}>
              {f.pct == null ? '—' : `${Math.round(f.pct)}%`}
              <span style={{ fontWeight: 500, color: theme.textMuted, marginLeft: 6, fontSize: 12, fontFamily: TYPO.fontText }}>{moneyCompact(f.importe)}</span>
            </span>
          </div>
          <div style={{ marginTop: 6, height: 4, background: `${theme.text}0F`, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: 4, width: `${max > 0 ? (N(f.importe) / max) * 100 : 0}%`, background: theme.accent, borderRadius: 999 }} />
          </div>
        </div>
      ))}
    </ListaAgrupada>
  );
}

/** Dato suelto (mismo patrón que FichaSkuSellOut) para rejillas de 2-4 columnas. */
export function Dato({ k, v, sub, color }) {
  const { theme } = useTheme();
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: color || theme.text, lineHeight: 1.2, whiteSpace: 'nowrap' }}>{v}</div>
      {sub && <div style={{ fontSize: 10.5, color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
    </div>
  );
}

/** Tarjeta con una rejilla de Datos (el "bento" del Resumen, en una columna de celular). */
export function CajaDatos({ children, cols = 2, style }) {
  const { theme } = useTheme();
  return (
    <div style={{ margin: '0 16px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '12px 14px', ...style }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gap: 12 }}>{children}</div>
    </div>
  );
}

/** Barra de pestañas con scroll horizontal (el Segmented del kit no cabe con 6 opciones en 375 px). */
export function TabsScroll({ opciones = [], valor, onChange, style }) {
  const { theme } = useTheme();
  return (
    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '0 16px 2px', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', ...style }}>
      {opciones.map((o) => {
        const on = o.id === valor;
        return (
          <button key={o.id} type="button" onClick={() => onChange(o.id)} style={{
            flexShrink: 0, height: 32, padding: '0 13px', borderRadius: 999, cursor: 'pointer',
            border: `1px solid ${on ? 'transparent' : theme.border}`,
            background: on ? theme.accent : theme.surface, color: on ? (theme.textOnDark || '#FFF') : theme.text,
            fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, letterSpacing: '-0.01em', whiteSpace: 'nowrap',
          }}>{o.label}</button>
        );
      })}
    </div>
  );
}

/** Bloque de texto para compartir + el pie de fuente de cada pantalla. */
export function Fuente({ children, style }) {
  const { theme } = useTheme();
  return (
    <div style={{ padding: '16px 28px 0', fontSize: 11, color: theme.textSubtle || theme.textMuted, lineHeight: 1.45, fontFamily: TYPO.fontText, ...style }}>
      {children}
    </div>
  );
}

/** Pastilla de "sin fuente" (cuenta que factura pero no reporta sell out). */
export function PillSinFuente({ style }) {
  const [visto, setVisto] = useState(false);
  return (
    <Pill tone="gray" size="xs" onClick={() => setVisto((v) => !v)} style={style}
      title="Este cliente no reporta sell out a nadie">{visto ? 'sólo sell in' : 'sin fuente'}</Pill>
  );
}
