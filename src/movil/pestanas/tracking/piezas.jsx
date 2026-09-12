// Tracking móvil · piezas de layout táctil. TODA la lógica viene de src/modules/comercial/tracking
// (calculo.js · textos.js · datos.js); aquí sólo hay tacto: campos de 44 px, chips, filas con gesto.
//   · FilaOC: fila de la lista · deslizar a la DERECHA = registrar envío · a la IZQUIERDA = compartir estatus
//   · CampoF / SelectM / FechaM / ChipsFolios / BuscadorSkuM: campos de hoja con tipografía de 16 px (iOS no hace zoom)
// Pills (ClientePill · EtapaPill · FuentePill) y las barras de avance se reusan tal cual de la web (tracking/ui.jsx).
import React, { useMemo, useState } from 'react';
import { Truck, Share2, X } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Pill } from '../../../components/kit';
import { ClientePill, EtapaPill, FuentePill, Avance } from '../../../modules/comercial/tracking/ui';
import { fmtInt, fmtFecha, fmtPct, normalizar, tokens as toks, nombreCliente } from '../../../modules/comercial/tracking/textos';
import { FilaGesto, CampoM, BotonMic, ChipM, lbl } from '../agenda/comun';
import { Fila } from '../../piezas';
import { colorCliente } from '../../datos';
import { MONO } from '../../util';

export { ClientePill, EtapaPill, FuentePill, Avance, ChipM };

/** Fila de OC (o cotización) dentro de una ListaAgrupada, con los dos gestos. */
export function FilaOC({ oc, onAbrir, onEnvio, onCompartir }) {
  const { theme } = useTheme();
  const dias = oc.diasEnEtapa != null ? `${Math.round(oc.diasEnEtapa)} d` : '—';
  const sub = oc.esCotizacion
    ? [nombreCliente(oc.cliente_key), oc.fechaEtapa ? fmtFecha(oc.fechaEtapa) : null, oc.pedido ? `${fmtInt(oc.pedido)} pz` : null].filter(Boolean).join(' · ')
    : [nombreCliente(oc.cliente_key), oc.fecha_recibida ? `rec. ${fmtFecha(oc.fecha_recibida)}` : null, `${fmtInt(oc.pedido)} pz`, oc.pedido ? `fill ${fmtPct(oc.fill)}` : null].filter(Boolean).join(' · ');
  return (
    <FilaGesto mantener style={{ borderRadius: 0, marginBottom: 0 }}
      onDerecha={onEnvio && !oc.esCotizacion ? () => onEnvio(oc) : null} onIzquierda={onCompartir ? () => onCompartir(oc) : null}
      labelDerecha="Registrar envío" iconoDerecha={Truck} colorDerecha={theme.accent}
      labelIzquierda="Compartir" iconoIzquierda={Share2} colorIzquierda={theme.green}>
      <Fila alto={62} style={{ background: theme.surface }} tono={oc.detenida ? theme.red : colorCliente(oc.cliente_key, theme)}
        titulo={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: MONO, fontWeight: 600 }}>{oc.esCotizacion ? '' : 'OC '}{oc.numero_oc_cliente}</span>
          <EtapaPill oc={oc} />
          {oc.detenida && <Pill tone="red" size="xs" dot>detenida</Pill>}
          {oc.surtibleHoy && <Pill tone="green" size="xs">surtible</Pill>}
        </span>}
        sub={sub}
        trailing={<span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <Avance oc={oc} ancho={58} />
          <span style={{ fontFamily: MONO, fontSize: 11, color: oc.detenida ? theme.red : theme.textMuted }}>{dias}</span>
        </span>}
        onClick={() => onAbrir?.(oc)} />
    </FilaGesto>
  );
}

// ── Campos de hoja (16 px para que iOS no haga zoom al enfocar) ──
export function CampoF({ label, sub, children, style }) {
  const { theme } = useTheme();
  return (
    <div style={{ marginBottom: 14, ...style }}>
      <span style={lbl(theme)}>{label}{sub && <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400, marginLeft: 6, color: theme.textSubtle || theme.textMuted }}>{sub}</span>}</span>
      {children}
    </div>
  );
}

export function SelectM({ value, onChange, opciones, placeholder, style }) {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  return (
    <select value={value ?? ''} onChange={(e) => onChange?.(e.target.value)}
      style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '0 10px', borderRadius: 12, border: `1px solid ${theme.border}`, background: dark ? 'rgba(255,255,255,0.06)' : theme.surface, color: theme.text, fontFamily: TYPO.fontText, fontSize: 16, appearance: 'auto', ...style }}>
      {placeholder != null && <option value="">{placeholder}</option>}
      {opciones.map((o) => <option key={o.id ?? o} value={o.id ?? o}>{o.label ?? o}</option>)}
    </select>
  );
}

export const FechaM = (props) => <CampoM type="date" {...props} />;

/** Chips de folios de factura: escribe y Enter (o el botón +). */
export function ChipsFolios({ items = [], onChange, placeholder = 'Folio y Enter' }) {
  const { theme } = useTheme();
  const [txt, setTxt] = useState('');
  const add = () => { const v = txt.trim().toUpperCase(); if (v && !items.includes(v)) onChange([...items, v]); setTxt(''); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {items.map((f) => (
            <span key={f} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 6px 5px 11px', borderRadius: 999, background: theme.mode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(120,120,128,0.12)', fontFamily: MONO, fontSize: 13, fontWeight: 600, color: theme.text }}>
              {f}
              <button type="button" onClick={() => onChange(items.filter((x) => x !== f))} aria-label={`Quitar ${f}`}
                style={{ width: 22, height: 22, border: 0, borderRadius: 999, background: 'transparent', color: theme.textMuted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}><X size={13} strokeWidth={2.6} /></button>
            </span>
          ))}
        </div>
      )}
      <CampoM value={txt} onChange={setTxt} placeholder={placeholder} onEnter={add} style={{ fontFamily: MONO }} />
    </div>
  );
}

/** Buscador de SKU sobre el roadmap (con dictado opcional). Devuelve la fila elegida. */
export function BuscadorSkuM({ roadmap = [], onElegir, placeholder = 'Buscar SKU o descripción' }) {
  const { theme } = useTheme();
  const [q, setQ] = useState('');
  const res = useMemo(() => {
    const t = toks(q); if (!t.length) return [];
    const out = [];
    for (const r of roadmap) { const hay = normalizar(`${r.sku} ${r.descripcion || ''} ${r.marca || ''} ${r.familia || ''}`); if (t.every((x) => hay.includes(x))) { out.push(r); if (out.length >= 6) break; } }
    return out;
  }, [q, roadmap]);
  const elegir = (r) => { onElegir?.(r); setQ(''); };
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <CampoM value={q} onChange={setQ} placeholder={placeholder} style={{ fontFamily: MONO }}
          onEnter={() => { const e = res.find((r) => r.sku.toUpperCase() === q.trim().toUpperCase()) || res[0]; if (e) elegir(e); else if (/^[A-Z]{2}-[0-9A-Z]{5,7}$/i.test(q.trim())) elegir({ sku: q.trim().toUpperCase(), descripcion: '' }); }} />
        <BotonMic onTexto={(t) => setQ(t)} size={44} />
      </div>
      {res.length > 0 && (
        <div style={{ marginTop: 8, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden', background: theme.surface }}>
          {res.map((r, i) => (
            <button key={r.sku} type="button" onClick={() => elegir(r)}
              style={{ display: 'flex', gap: 10, width: '100%', textAlign: 'left', minHeight: 46, alignItems: 'center', padding: '6px 12px', border: 0, borderTop: i ? `1px solid ${theme.border}` : 0, background: 'transparent', cursor: 'pointer', fontFamily: TYPO.fontText, fontSize: 13.5, color: theme.text }}>
              <span style={{ fontFamily: MONO, fontWeight: 600, minWidth: 84 }}>{r.sku}</span>
              <span style={{ color: theme.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.descripcion}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Nota de color dentro de una hoja (avisos del parser, ayudas). */
export function NotaM({ children, tone = 'gray' }) {
  const { theme } = useTheme();
  const col = tone === 'orange' ? theme.orange : tone === 'green' ? theme.green : tone === 'blue' ? theme.accent : theme.textMuted;
  return <div style={{ padding: '9px 12px', borderRadius: 12, background: `${col}14`, color: col, fontSize: 12.5, lineHeight: 1.45, marginBottom: 12 }}>{children}</div>;
}
