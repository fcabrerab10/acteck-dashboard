// Tracking Pedidos V3 · piezas chicas compartidas por los componentes de la pestaña (sólo kit + tokens de tema).
import React from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Pill, toneColors } from '../../../components/kit';
import { suaveBg } from '../../../components/perfil/comun';
import { ETAPAS, ETAPA_LABEL, ETAPA_TONE, ESTADO_COT_LABEL, TONE_CLIENTE, nombreCliente, fmtFecha } from './textos';

export function ClientePill({ k, size = 'xs' }) {
  return <Pill tone={TONE_CLIENTE[k] || 'gray'} size={size} dot>{nombreCliente(k)}</Pill>;
}

/** Pill de etapa (con "parcial" cuando aplica y estado de cotización). */
export function EtapaPill({ oc, size = 'xs' }) {
  if (oc.esCotizacion || oc.etapa === 'cotizacion') {
    const est = oc.cotizacion?.estado;
    return <Pill tone={est === 'perdida' ? 'red' : est === 'aceptada' ? 'green' : 'purple'} size={size}>{ESTADO_COT_LABEL[est] || 'Cotización'}</Pill>;
  }
  const parcial = oc.etapa === 'facturada' && oc.fill < 99.5;
  return <Pill tone={ETAPA_TONE[oc.etapa] || 'gray'} size={size}>{ETAPA_LABEL[oc.etapa] || oc.etapa}{parcial ? ' parcial' : ''}</Pill>;
}

/** Karolina / ERP. */
export function FuentePill({ fuente, size = 'xs' }) {
  if (!fuente) return null;
  return <Pill tone={fuente === 'erp' ? 'blue' : 'gray'} size={size}>{fuente === 'erp' ? 'ERP' : 'Karolina'}</Pill>;
}

/** Barras de avance por etapa (4 o 5 segmentos): hecho = color de etapa, parcial = mitad, pendiente = gris. */
export function Avance({ oc, ancho = 92 }) {
  const { theme } = useTheme();
  const etapas = oc.timeline?.length ? oc.timeline : ETAPAS.filter((e) => e !== 'cotizacion').map((e) => ({ etapa: e, estado: 'pendiente' }));
  const base = theme.mode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)';
  return (
    <div title={etapas.map((t) => `${ETAPA_LABEL[t.etapa]}: ${t.fecha ? fmtFecha(t.fecha) : '—'}`).join(' · ')} style={{ display: 'inline-flex', gap: 2, width: ancho }}>
      {etapas.map((t) => {
        const [, col] = toneColors(theme, t.estado === 'perdida' ? 'red' : ETAPA_TONE[t.etapa]);
        const hecho = t.estado === 'hecho' || t.estado === 'perdida';
        return (
          <span key={t.etapa} style={{ flex: 1, height: 6, borderRadius: 3, background: base, position: 'relative', overflow: 'hidden' }}>
            {(hecho || t.estado === 'parcial') && <span style={{ position: 'absolute', inset: 0, width: t.estado === 'parcial' ? '55%' : '100%', background: col, borderRadius: 3 }} />}
          </span>
        );
      })}
    </div>
  );
}

// ── Formularios (HojaLateral) ──
export function Etiqueta({ children, sub }) {
  const { theme } = useTheme();
  return (
    <div style={{ marginBottom: 4 }}>
      <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: theme.textMuted }}>{children}</span>
      {sub && <span style={{ fontSize: 10.5, color: theme.textSubtle || theme.textMuted, marginLeft: 6 }}>{sub}</span>}
    </div>
  );
}
const campoBase = (theme, foco) => ({
  width: '100%', boxSizing: 'border-box', height: 32, padding: '0 10px', borderRadius: 8, fontFamily: TYPO.fontText, fontSize: 13, color: theme.text,
  background: suaveBg(theme), border: `1px solid ${foco ? theme.accent : 'transparent'}`, outline: 'none', boxShadow: foco ? `0 0 0 3px ${theme.accent || '#007AFF'}22` : 'none',
});
export function Input({ value, onChange, type = 'text', placeholder, mono = false, autoFocus, disabled, style, onKeyDown, list }) {
  const { theme } = useTheme();
  const [foco, setFoco] = React.useState(false);
  return <input type={type} value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} disabled={disabled} list={list} onKeyDown={onKeyDown}
    onFocus={() => setFoco(true)} onBlur={() => setFoco(false)} style={{ ...campoBase(theme, foco), fontFamily: mono ? TYPO.fontDisplay : TYPO.fontText, fontVariantNumeric: 'tabular-nums', opacity: disabled ? 0.55 : 1, ...style }} />;
}
export function Select({ value, onChange, opciones, placeholder, style }) {
  const { theme } = useTheme();
  const [foco, setFoco] = React.useState(false);
  return (
    <select value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} onFocus={() => setFoco(true)} onBlur={() => setFoco(false)} style={{ ...campoBase(theme, foco), appearance: 'auto', ...style }}>
      {placeholder != null && <option value="">{placeholder}</option>}
      {opciones.map((o) => <option key={o.id ?? o} value={o.id ?? o}>{o.label ?? o}</option>)}
    </select>
  );
}
export function TextArea({ value, onChange, placeholder, filas = 4, mono = false, autoFocus, style }) {
  const { theme } = useTheme();
  const [foco, setFoco] = React.useState(false);
  return <textarea value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder} rows={filas} autoFocus={autoFocus} onFocus={() => setFoco(true)} onBlur={() => setFoco(false)}
    style={{ ...campoBase(theme, foco), height: 'auto', padding: '8px 10px', resize: 'vertical', fontFamily: mono ? TYPO.fontDisplay : TYPO.fontText, fontSize: 12.5, lineHeight: 1.4, ...style }} />;
}
export function Campo({ label, sub, children, style }) {
  return <div style={{ marginBottom: 12, ...style }}><Etiqueta sub={sub}>{label}</Etiqueta>{children}</div>;
}
export function Fila2({ children, cols = '1fr 1fr', gap = 10 }) {
  return <div style={{ display: 'grid', gridTemplateColumns: cols, gap }}>{children}</div>;
}
/** Chips editables (folios de factura). */
export function Chips({ items = [], onChange, placeholder = 'Folio y Enter', mono = true }) {
  const { theme } = useTheme();
  const [txt, setTxt] = React.useState('');
  const add = () => { const v = txt.trim().toUpperCase(); if (v && !items.includes(v)) onChange([...items, v]); setTxt(''); };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      {items.map((f) => (
        <span key={f} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 4px 2px 8px', borderRadius: 999, background: suaveBg(theme), fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, color: theme.text }}>
          {f}<button type="button" onClick={() => onChange(items.filter((x) => x !== f))} title="Quitar" style={{ border: 0, background: 'transparent', color: theme.textMuted, cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: '0 4px' }}>×</button>
        </span>
      ))}
      <Input value={txt} onChange={setTxt} placeholder={placeholder} mono={mono} style={{ width: 150, height: 28 }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }} />
    </div>
  );
}
/** Nota discreta (avisos del parser, ayudas). */
export function Nota({ children, tone = 'gray' }) {
  const { theme } = useTheme();
  const [bg, col] = toneColors(theme, tone);
  return <div style={{ padding: '6px 10px', borderRadius: 8, background: bg, color: col, fontSize: 11.5, lineHeight: 1.4, marginBottom: 8 }}>{children}</div>;
}
