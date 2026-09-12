// Piezas de UI compartidas de Pagos V3 · sólo kit + tokens (nada de Tailwind de color).
import React from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Pill, EASE, DUR } from '../../../components/kit';
import { ETAPAS, ETAPAS_IDS, ESTADO_META, TIPO_META, indiceEtapa } from './estados';
import { CLIENTE_LABEL, CLIENTE_COLOR } from './reglas';

export const MONO = { fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums' };

export const mxn = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-MX');
export const mxn2 = (n) => '$' + (Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const mxnCorto = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)} M`;
  if (Math.abs(v) >= 1e3) return `$${Math.round(v / 1e3)} K`;
  return mxn(v);
};
export const pctTxt = (n, d = 0) => `${((Number(n) || 0) * 100).toFixed(d)} %`;

export function EstadoPill({ estado, size = 'sm' }) {
  const m = ESTADO_META[estado] || ESTADO_META.calculado;
  return <Pill tone={m.tone} dot size={size}>{m.label}</Pill>;
}

export function TipoPill({ tipo, origen, size = 'sm' }) {
  const m = TIPO_META[tipo] || TIPO_META.otro;
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      <Pill tone={m.tone} size={size}>{m.label}</Pill>
      {origen && <Pill tone={origen === 'auto' ? 'blue' : 'gray'} size="xs">{origen === 'auto' ? 'auto' : 'manual'}</Pill>}
    </span>
  );
}

export function ClientePill({ clienteKey, size = 'xs' }) {
  const { theme } = useTheme();
  const col = CLIENTE_COLOR[clienteKey] || theme.textMuted;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: size === 'xs' ? 11 : 11.5, color: theme.text, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: col, flexShrink: 0 }} />
      {CLIENTE_LABEL[clienteKey] || clienteKey || '—'}
    </span>
  );
}

/** Barra de 5 segmentos: dónde va el pago dentro del flujo. */
export function FlujoBarras({ estado, compacto = false }) {
  const { theme } = useTheme();
  const i = indiceEtapa(estado);
  const fuera = i < 0;
  const m = ESTADO_META[estado] || {};
  const col = fuera ? (estado === 'rechazado' ? theme.red : theme.textMuted) : (theme.accent || '#007AFF');
  return (
    <span title={`${m.label || estado}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      {ETAPAS_IDS.map((id, k) => (
        <span key={id} style={{
          width: compacto ? 8 : 12, height: 4, borderRadius: 999,
          background: !fuera && k <= i ? col : `${theme.text}1A`,
          transition: `background ${DUR.state}ms ${EASE}`,
        }} />
      ))}
      {!compacto && <span style={{ marginLeft: 4 }}><EstadoPill estado={estado} size="xs" /></span>}
    </span>
  );
}

/** Línea de tiempo del flujo con quién y cuándo (drill y móvil). */
export function LineaTiempo({ pago }) {
  const { theme } = useTheme();
  const sellos = [
    { id: 'calculado', at: pago.created_at, por: pago.origen === 'auto' ? 'sistema' : (pago.responsable || 'captura') },
    { id: 'solicitado', at: pago.solicitado_at, por: pago.solicitado_por },
    { id: 'autorizado', at: pago.autorizado_at, por: pago.autorizado_por },
    { id: 'folio', at: pago.folio_at, por: pago.folio ? `${pago.folio_por || ''} · ${pago.folio}`.trim() : pago.folio_por },
    { id: 'pagado', at: pago.pagado_at, por: pago.nc_folio ? `NC ${pago.nc_folio}` : pago.pagado_por },
  ];
  const i = indiceEtapa(pago.estado);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 6 }}>
      {sellos.map((s, k) => {
        const meta = ESTADO_META[s.id];
        const hecho = i >= k && i >= 0;
        return (
          <div key={s.id} style={{ padding: '6px 8px', borderRadius: 10, border: `1px solid ${theme.border}`, background: hecho ? `${theme.accent || '#007AFF'}0D` : 'transparent', opacity: hecho ? 1 : 0.55 }}>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 600 }}>{meta.label}</div>
            <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 2, wordBreak: 'break-word' }}>
              {s.at ? `${String(s.at).slice(0, 10)}${s.por ? ` · ${s.por}` : ''}` : (k === i + 1 ? 'pendiente' : '—')}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Tabla de evidencia del cálculo (las filas que guardó el motor en `detalle`). */
export function TablaEvidencia({ detalle }) {
  const { theme } = useTheme();
  const filas = detalle?.filas || [];
  if (filas.length === 0) return <div style={{ fontSize: 11, color: theme.textMuted }}>Sin desglose guardado.</div>;
  const hayPct = filas.some((f) => f.pct != null);
  const hayBase = filas.some((f) => f.base != null);
  const hayPremio = filas.some((f) => f.premio);
  const th = { textAlign: 'right', padding: '4px 6px', fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.textMuted, borderBottom: `1px solid ${theme.border}` };
  const td = { textAlign: 'right', padding: '4px 6px', borderBottom: `1px solid ${theme.border}`, fontSize: 11.5, ...MONO };
  const total = filas.reduce((s, f) => s + (Number(f.monto) || 0), 0);
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'left' }}>Concepto</th>
            {hayBase && <th style={th}>Base</th>}
            {hayPct && <th style={th}>%</th>}
            {hayPremio && <th style={{ ...th, textAlign: 'left' }}>Premio</th>}
            <th style={th}>Monto</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i}>
              <td style={{ ...td, textAlign: 'left', fontFamily: TYPO.fontText }}>{f.concepto}</td>
              {hayBase && <td style={td}>{f.base != null ? mxn(f.base) : '—'}</td>}
              {hayPct && <td style={td}>{f.pct != null ? `${(f.pct * 100).toFixed(2)} %` : '—'}</td>}
              {hayPremio && <td style={{ ...td, textAlign: 'left', fontFamily: TYPO.fontText }}>{f.premio || '—'}</td>}
              <td style={td}>{mxn(f.monto)}</td>
            </tr>
          ))}
          <tr>
            <td style={{ ...td, textAlign: 'left', fontWeight: 600, borderBottom: 0 }}>Total</td>
            {hayBase && <td style={{ ...td, borderBottom: 0 }}>{mxn(filas.reduce((s, f) => s + (Number(f.base) || 0), 0))}</td>}
            {hayPct && <td style={{ ...td, borderBottom: 0 }} />}
            {hayPremio && <td style={{ ...td, borderBottom: 0 }} />}
            <td style={{ ...td, fontWeight: 600, borderBottom: 0 }}>{mxn(total)}</td>
          </tr>
        </tbody>
      </table>
      {(detalle?.alcance != null || detalle?.cuota != null) && (
        <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 6, fontFamily: TYPO.fontText }}>
          {detalle.cuota != null && `Cuota ${mxn(detalle.cuota)} · `}
          {detalle.cuota_sell_out != null && `Cuota de sell out ${mxn(detalle.cuota_sell_out)} (${pctTxt(detalle.factor_cuota_so)} de la de sell in) · `}
          {detalle.alcance != null && `Alcance ${pctTxt(detalle.alcance)}`}
          {detalle.nivel && ` · nivel ${detalle.nivel}`}
        </div>
      )}
    </div>
  );
}

/** Pill clicable con conteo (los filtros de la tabla). */
export function FiltroPill({ activo, onClick, children, tone = 'gray', n }) {
  const { theme } = useTheme();
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999,
      border: `1px solid ${activo ? (theme.accent || '#007AFF') : theme.border}`,
      background: activo ? `${theme.accent || '#007AFF'}14` : 'transparent',
      color: activo ? (theme.accent || '#007AFF') : theme.textMuted,
      fontFamily: TYPO.fontText, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
      transition: `all ${DUR.tap}ms ${EASE}`,
    }}>
      {children}
      {n != null && <span style={{ ...MONO, fontSize: 10.5, opacity: 0.8 }}>{n}</span>}
    </button>
  );
}

export function Etiqueta({ children }) {
  const { theme } = useTheme();
  return <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.07em', color: theme.textMuted, fontWeight: 600 }}>{children}</span>;
}

export function CampoInline({ label, children, ancho }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, width: ancho }}>
      <Etiqueta>{label}</Etiqueta>
      {children}
    </label>
  );
}

export function Entrada({ style, ...props }) {
  const { theme } = useTheme();
  return <input {...props} style={{
    width: '100%', boxSizing: 'border-box', height: 30, padding: '0 10px', borderRadius: 8,
    border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text,
    fontFamily: TYPO.fontText, fontSize: 12, outline: 'none', ...style,
  }} />;
}

export function Selector({ style, children, ...props }) {
  const { theme } = useTheme();
  return <select {...props} style={{
    width: '100%', boxSizing: 'border-box', height: 30, padding: '0 8px', borderRadius: 8,
    border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text,
    fontFamily: TYPO.fontText, fontSize: 12, outline: 'none', ...style,
  }}>{children}</select>;
}

export function AreaTexto({ style, ...props }) {
  const { theme } = useTheme();
  return <textarea {...props} style={{
    width: '100%', boxSizing: 'border-box', padding: 8, borderRadius: 8,
    border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text,
    fontFamily: TYPO.fontText, fontSize: 12, outline: 'none', resize: 'vertical', ...style,
  }} />;
}

export function Nota({ children, style }) {
  const { theme } = useTheme();
  return <div style={{ fontSize: 10.5, color: theme.textMuted, lineHeight: 1.5, fontFamily: TYPO.fontText, ...style }}>{children}</div>;
}

export { ETAPAS };
