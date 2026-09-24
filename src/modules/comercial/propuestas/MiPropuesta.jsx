// MiPropuesta — tarjeta lateral del armador: totales, SPIFF ganado, margen ⌀ (sólo sensible), líneas y acciones.
// Indicador discreto del autoguardado (PropuestasTab guarda solo ~3 s después de cada cambio y al salir):
//   Guardando… · Guardado hace 10 s · Sin guardar (cambios recién hechos, el timer corre) · Nuevo (nada que guardar).
import React, { useEffect, useState } from 'react';
import { ChevronRight, Save, X, Minus, Plus } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, Pill, Boton } from '../../../components/kit';
import { money, int, pct, relativo } from '../../../lib/format';
import CampoNumero from './CampoNumero';

export function IndicadorGuardado({ autosave }) {
  const { guardando, guardadoAt, sucio } = autosave || {};
  const [, tick] = useState(0);
  useEffect(() => { if (!guardadoAt) return; const t = setInterval(() => tick((n) => n + 1), 5000); return () => clearInterval(t); }, [guardadoAt]);
  if (guardando) return <Pill tone="gray" size="xs" dot>Guardando…</Pill>;
  if (sucio) return <Pill tone="orange" size="xs" dot title="Se guarda solo en unos segundos">Sin guardar</Pill>;
  if (guardadoAt) {
    const seg = Math.round((Date.now() - guardadoAt) / 1000);
    const txt = seg < 5 ? 'Guardado' : seg < 60 ? `Guardado hace ${seg} s` : `Guardado ${relativo(guardadoAt)}`;
    return <Pill tone="green" size="xs" dot title="Autoguardado en la base">{txt}</Pill>;
  }
  return <Pill tone="gray" size="xs" title="Se guarda solo en cuanto marques algo">Nuevo</Pill>;
}

export default function MiPropuesta({ cliente, propuestaLista, totalPropuesta, piezasTotal, spiffTotal, spiffSkusCount, spiffDisponiblesCount, margenProm, sensible, autosave, onGuardar, onRevisar, onQuitar, onVaciar, onEditar }) {
  const { theme } = useTheme();
  const vacia = propuestaLista.length === 0;
  const mono = { fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums' };
  const eyebrow = { fontFamily: TYPO.fontDisplay, fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.textMuted };
  return (
    <Panel titulo="Mi propuesta" meta={`${cliente.label} · ${propuestaLista.length} SKU${propuestaLista.length === 1 ? '' : 's'}`}
      acciones={<IndicadorGuardado autosave={autosave} />} padding="12px 14px" style={{ position: 'sticky', top: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 10, borderBottom: `1px solid ${theme.border}` }}>
        <div>
          <div style={eyebrow}>Total propuesta</div>
          <div style={{ ...mono, fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: vacia ? theme.textMuted : (theme.green || '#34C759'), marginTop: 3, lineHeight: 1 }}>{vacia ? '—' : money(totalPropuesta)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={eyebrow}>Piezas</div>
          <div style={{ ...mono, fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text, marginTop: 3, lineHeight: 1 }}>{int(piezasTotal)}</div>
        </div>
      </div>
      {(spiffDisponiblesCount > 0 || (sensible && margenProm != null)) && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '10px 0 0' }}>
          {spiffDisponiblesCount > 0 && <Pill tone="yellow" title={`${spiffSkusCount} de ${spiffDisponiblesCount} SKUs con SPIFF en la propuesta`}>SPIFF {spiffTotal > 0 ? money(spiffTotal) : '—'} · {spiffSkusCount}/{spiffDisponiblesCount}</Pill>}
          {sensible && margenProm != null && <Pill tone={margenProm >= 25 ? 'green' : margenProm >= 15 ? 'orange' : 'red'} title="Margen ponderado vs costo promedio (sólo visible con permiso de información sensible)">Margen ⌀ {pct(margenProm, 1)}</Pill>}
        </div>
      )}
      {vacia ? (
        <div style={{ margin: '12px 0', padding: '18px 12px', textAlign: 'center', color: theme.textMuted, fontSize: 11.5, border: `1px dashed ${theme.border}`, borderRadius: 10 }}>
          Acepta los sugeridos o marca SKUs de la tabla para armar tu propuesta.
        </div>
      ) : (
        <div style={{ maxHeight: 260, overflow: 'auto', margin: '8px 0 4px' }}>
          {propuestaLista.slice(0, 40).map((r) => (
            <div key={r.sku} style={{ display: 'grid', gridTemplateColumns: onQuitar ? '1fr auto auto auto' : '1fr auto auto', gap: 6, alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${theme.divider || theme.border}`, fontSize: 10.5 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ ...mono, fontWeight: 600, color: theme.text }}>{r.sku}</div>
                <div style={{ fontSize: 9.5, color: theme.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.descripcion}</div>
              </div>
              {/* Piezas editables (2026-09-24, Fernando: «quiero poder modificar yo las piezas»): −/+ de 5 en 5 y captura directa. */}
              {onEditar ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }} title="Piezas a proponer">
                  <button type="button" onClick={() => onEditar(r.sku, { piezas: Math.max(0, (Number(r.piezas) || 0) - 5) })} aria-label="5 piezas menos" style={pasoBtn(theme)}><Minus size={11} /></button>
                  <CampoNumero value={r.piezas} onChange={(n) => onEditar(r.sku, { piezas: n ?? 0 })} ancho={50} ariaLabel={`Piezas de ${r.sku}`} style={{ padding: '0 4px', fontSize: 11, color: theme.accent || '#007AFF' }} />
                  <button type="button" onClick={() => onEditar(r.sku, { piezas: (Number(r.piezas) || 0) + 5 })} aria-label="5 piezas más" style={pasoBtn(theme)}><Plus size={11} /></button>
                </span>
              ) : <div style={{ ...mono, color: theme.accent || '#007AFF', fontWeight: 600 }}>{int(r.piezas)} pz</div>}
              <div style={{ ...mono, color: theme.text, fontWeight: 600, minWidth: 64, textAlign: 'right' }}>{money((Number(r.piezas) || 0) * (Number(r.precio) || 0))}</div>
              {/* Quitar de la propuesta (2026-09-24, Fernando: «le piqué a algunos productos sin querer y no me deja borrarlos») */}
              {onQuitar && <button type="button" onClick={() => onQuitar(r.sku)} title={`Quitar ${r.sku} de la propuesta`} aria-label={`Quitar ${r.sku}`}
                style={{ width: 26, height: 26, margin: '-4px -6px -4px 0', borderRadius: 999, border: 0, background: 'transparent', color: theme.textMuted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><X size={13} /></button>}
            </div>
          ))}
          {propuestaLista.length > 40 && <div style={{ padding: '8px 0', textAlign: 'center', fontSize: 10, color: theme.textMuted }}>+{propuestaLista.length - 40} más…</div>}
        </div>
      )}
      {!vacia && onVaciar && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => { if (window.confirm(`¿Vaciar la propuesta? Se quitan los ${propuestaLista.length} SKUs.`)) onVaciar(); }}
            style={{ border: 0, background: 'transparent', color: theme.textMuted, fontFamily: TYPO.fontText, fontSize: 10.5, cursor: 'pointer', padding: '2px 0' }}>Vaciar propuesta</button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
        <Boton primario size="md" disabled={vacia} onClick={onRevisar} style={{ flex: 1, justifyContent: 'center' }}>Revisar y exportar <ChevronRight size={13} /></Boton>
        <Boton size="md" icon={Save} onClick={onGuardar} disabled={vacia || autosave?.guardando} title="Guardar ahora (además del autoguardado)">Guardar</Boton>
      </div>
    </Panel>
  );
}

const pasoBtn = (theme) => ({ width: 22, height: 22, borderRadius: 999, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.textMuted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 });
